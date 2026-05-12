import { Hono } from 'hono';
import type { Context } from 'hono';
import type { Env } from '../types';
import { generateId } from '../utils';
import { signAccessToken, generateRefreshToken, hashToken } from '../services/session';
import { requireAuth } from '../middleware/auth';
import { GitHub } from 'arctic';

interface GitHubUser {
  id: number;
  login: string;
  email: string | null;
  avatar_url: string;
}

interface GitHubEmail {
  email: string;
  primary: boolean;
  verified: boolean;
}

interface GoogleIdPayload {
  sub: string;
  email?: string;
  name?: string;
  picture?: string;
  iss: string;
  aud: string;
  exp: number;
}

interface TokenError {
  error: string;
  error_description?: string;
}

interface TokenResponse {
  access_token?: string;
  id_token?: string;
  error?: string;
  error_description?: string;
}

const auth = new Hono<{ Bindings: Env }>();

function getBaseUrl(c: Context<{ Bindings: Env }>): string {
  const url = new URL(c.req.url);
  return `${url.protocol}//${url.host}`;
}

function getGitHubProvider(c: Context<{ Bindings: Env }>) {
  const base = getBaseUrl(c);
  return new GitHub(c.env.GITHUB_CLIENT_ID, c.env.GITHUB_CLIENT_SECRET, `${base}/api/auth/github/callback`);
}

// GitHub OAuth
auth.get('/github/start', async (c) => {
  const github = getGitHubProvider(c);
  const state = generateId('gh');
  const url = await github.createAuthorizationURL(state, { scopes: ['read:user', 'user:email'] });
  return c.redirect(url.toString());
});

auth.get('/github/callback', async (c) => {
  const code = c.req.query('code');
  const state = c.req.query('state');
  const frontend = c.env.CORS_ORIGIN;
  if (!code || !state) return c.redirect(`${frontend}/#/?error=missing_params`);

  try {
    const github = getGitHubProvider(c);
    const tokens = await github.validateAuthorizationCode(code);
    const ghRes = await fetch('https://api.github.com/user', {
      headers: { Authorization: `Bearer ${tokens.accessToken()}`, 'User-Agent': 'fuckubitch' },
    });
    const ghUser: GitHubUser = await ghRes.json() as GitHubUser;

    let email = ghUser.email;
    if (!email) {
      const emailsRes = await fetch('https://api.github.com/user/emails', {
        headers: { Authorization: `Bearer ${tokens.accessToken()}`, 'User-Agent': 'fuckubitch' },
      });
      const emails: GitHubEmail[] = await emailsRes.json() as GitHubEmail[];
      const primary = emails.find((e) => e.primary && e.verified);
      if (primary) email = primary.email;
    }

    const user = await findOrCreateUser(c.env, 'github', String(ghUser.id), email, ghUser.login, ghUser.avatar_url);
    const session = await createSession(c.env, user);
    return c.redirect(`${frontend}/#/auth/callback?access_token=${encodeURIComponent(session.access_token)}&refresh_token=${encodeURIComponent(session.refresh_token)}`);
  } catch (e) {
    return c.redirect(`${frontend}/#/?error=${encodeURIComponent(e.message || 'github_failed')}`);
  }
});

// Google OAuth (simple code flow, no PKCE needed for server-side)
auth.get('/google/start', async (c) => {
  const base = getBaseUrl(c);
  const state = generateId('go');
  const params = new URLSearchParams({
    client_id: c.env.GOOGLE_CLIENT_ID,
    redirect_uri: `${base}/api/auth/google/callback`,
    response_type: 'code',
    scope: 'openid email profile',
    state,
  });
  return c.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`);
});

auth.get('/google/callback', async (c) => {
  const code = c.req.query('code');
  const frontend = c.env.CORS_ORIGIN;
  if (!code) return c.redirect(`${frontend}/#/?error=missing_code`);

  try {
    const base = getBaseUrl(c);
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: c.env.GOOGLE_CLIENT_ID,
        client_secret: c.env.GOOGLE_CLIENT_SECRET,
        code,
        grant_type: 'authorization_code',
        redirect_uri: `${base}/api/auth/google/callback`,
      }).toString(),
    });
    const tokenData = await tokenRes.json() as TokenResponse;
    if (tokenData.error) throw new Error(`${tokenData.error}: ${tokenData.error_description || ''}`);

    // Try JWT decode with fallback
    let payload: GoogleIdPayload;
    try {
      const idParts = tokenData.id_token.split('.');
      payload = JSON.parse(atob(idParts[1]));
    } catch {
      // Node/Workers fallback
      const idParts = tokenData.id_token.split('.');
      const decoded = Buffer.from(idParts[1], 'base64').toString();
      payload = JSON.parse(decoded);
    }

    const user = await findOrCreateUser(c.env, 'google', payload.sub, payload.email || null, payload.name || 'Google User', payload.picture || '');
    const session = await createSession(c.env, user);
    return c.redirect(`${frontend}/#/auth/callback?access_token=${encodeURIComponent(session.access_token)}&refresh_token=${encodeURIComponent(session.refresh_token)}`);
  } catch (e) {
    return c.redirect(`${frontend}/#/?error=${encodeURIComponent(e.message || 'google_failed')}`);
  }
});

// Refresh & logout
auth.post('/refresh', requireAuth, async (c) => {
  const refreshToken = c.req.header('X-Refresh-Token');
  if (!refreshToken) return c.json({ success: false, error: '缺少刷新令牌' }, 400);
  const hash = await hashToken(refreshToken);
  const session = await c.env.DB.prepare(
    'SELECT * FROM auth_sessions WHERE refresh_token_hash = ? AND revoked_at IS NULL AND expires_at > datetime("now")'
  ).bind(hash).first<{ id: number; user_id: number }>();
  if (!session) return c.json({ success: false, error: '刷新令牌无效或已过期' }, 401);
  const user = await c.env.DB.prepare('SELECT public_id, role FROM users WHERE id = ?').bind(session.user_id).first<{ public_id: string; role: 'user' | 'admin' }>();
  if (!user) return c.json({ success: false, error: '用户不存在' }, 401);
  const accessToken = await signAccessToken(c.env, { sub: user.public_id, sid: String(session.id), role: user.role });
  const newRefreshToken = generateRefreshToken();
  const newHash = await hashToken(newRefreshToken);
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
  await c.env.DB.prepare("UPDATE auth_sessions SET revoked_at = datetime('now') WHERE id = ?").bind(session.id).run();
  await c.env.DB.prepare('INSERT INTO auth_sessions (user_id, refresh_token_hash, expires_at) VALUES (?, ?, ?)').bind(session.user_id, newHash, expiresAt).run();
  return c.json({ success: true, data: { access_token: accessToken, refresh_token: newRefreshToken } });
});

auth.post('/logout', requireAuth, async (c) => {
  const userId = c.get('userId');
  const user = await c.env.DB.prepare('SELECT id FROM users WHERE public_id = ?').bind(userId).first<{ id: number }>();
  if (user) await c.env.DB.prepare("UPDATE auth_sessions SET revoked_at = datetime('now') WHERE user_id = ? AND revoked_at IS NULL").bind(user.id).run();
  return c.json({ success: true });
});

// Dev login
auth.post('/dev-login', async (c) => {
  try {
    const body = await c.req.json<{ key: string }>();
    if (body.key !== c.env.ADMIN_API_KEY) return c.json({ success: false, error: '无效的管理员密钥' }, 403);
    let user = await c.env.DB.prepare('SELECT public_id, role FROM users WHERE role = ? LIMIT 1').bind('admin').first<{ public_id: string; role: 'admin' }>();
    if (!user) {
      const publicId = generateId('u');
      await c.env.DB.prepare('INSERT INTO users (public_id, nickname, role) VALUES (?, ?, ?)').bind(publicId, 'admin', 'admin').run();
      user = { public_id: publicId, role: 'admin' };
    }
    const tokens = await createSession(c.env, user);
    return c.json({ success: true, data: { ...tokens, user } });
  } catch (e) { return c.json({ success: false, error: String(e) }, 500); }
});

async function findOrCreateUser(env: Env, provider: 'github' | 'google', providerUserId: string, email: string | null, login: string, avatarUrl: string): Promise<{ public_id: string; role: 'user' | 'admin' }> {
  const existing = await env.DB.prepare(
    'SELECT u.id, u.public_id, u.role FROM users u JOIN oauth_accounts oa ON u.id = oa.user_id WHERE oa.provider = ? AND oa.provider_user_id = ?'
  ).bind(provider, providerUserId).first<{ id: number; public_id: string; role: 'user' | 'admin' }>();
  if (existing) {
    await env.DB.prepare("UPDATE oauth_accounts SET last_login_at = datetime('now'), provider_email = COALESCE(?, provider_email), provider_login = ? WHERE provider = ? AND provider_user_id = ?").bind(email, login, provider, providerUserId).run();
    await env.DB.prepare("UPDATE users SET updated_at = datetime('now'), avatar_url = COALESCE(NULLIF(?, ''), avatar_url) WHERE id = ?").bind(avatarUrl, existing.id).run();
    return { public_id: existing.public_id, role: existing.role };
  }
  const publicId = generateId('u');
  const nickname = login || email?.split('@')[0] || '用户';
  const result = await env.DB.prepare('INSERT INTO users (public_id, nickname, avatar_url) VALUES (?, ?, ?)').bind(publicId, nickname, avatarUrl || null).run();
  const userId = result.meta?.last_row_id;
  if (!userId) throw new Error('Failed to create user');
  await env.DB.prepare('INSERT INTO oauth_accounts (user_id, provider, provider_user_id, provider_email, provider_login) VALUES (?, ?, ?, ?, ?)').bind(userId, provider, providerUserId, email, login).run();
  return { public_id: publicId, role: 'user' };
}

async function createSession(env: Env, user: { public_id: string; role: 'user' | 'admin' }): Promise<{ access_token: string; refresh_token: string }> {
  const accessToken = await signAccessToken(env, { sub: user.public_id, sid: 'new', role: user.role });
  const refreshToken = generateRefreshToken();
  const hash = await hashToken(refreshToken);
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
  const userRow = await env.DB.prepare('SELECT id FROM users WHERE public_id = ?').bind(user.public_id).first<{ id: number }>();
  await env.DB.prepare('INSERT INTO auth_sessions (user_id, refresh_token_hash, expires_at) VALUES (?, ?, ?)').bind(userRow!.id, hash, expiresAt).run();
  return { access_token: accessToken, refresh_token: refreshToken };
}

export default auth;
