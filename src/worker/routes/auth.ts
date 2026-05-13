import { Hono } from 'hono';
import type { Context } from 'hono';
import type { AppType, Env } from '../types';
import { generateId } from '../utils';
import { signAccessToken, generateRefreshToken, hashToken } from '../services/session';
import { requireAuth } from '../middleware/auth';
import { edgeCache } from '../middleware/cache';
import { GitHub } from 'arctic';
import { createDb } from '../db';
import { users, oauthAccounts, authSessions } from '../db/schema';
import { eq, and, sql } from 'drizzle-orm';

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

interface TokenResponse {
  access_token?: string;
  id_token?: string;
  error?: string;
  error_description?: string;
}

const auth = new Hono<AppType>();

function getBaseUrl(c: Context<AppType>): string {
  const url = new URL(c.req.url);
  return `${url.protocol}//${url.host}`;
}

function getGitHubProvider(c: Context<AppType>) {
  const base = getBaseUrl(c);
  return new GitHub(c.env.GITHUB_CLIENT_ID, c.env.GITHUB_CLIENT_SECRET, `${base}/api/auth/github/callback`);
}

function isConfigured(value: string | undefined): boolean {
  return !!value && value !== 'dev';
}

auth.get('/config', edgeCache({ cacheName: 'auth-config', maxAge: 3600, swr: 86400 }), (c) => {
  return c.json({
    success: true,
    data: {
      github: isConfigured(c.env.GITHUB_CLIENT_ID),
      google: isConfigured(c.env.GOOGLE_CLIENT_ID),
    },
  });
});

auth.get('/github/start', async (c) => {
  if (!isConfigured(c.env.GITHUB_CLIENT_ID)) {
    return c.json({ success: false, error: 'GitHub 登录未配置' }, 404);
  }
  const github = getGitHubProvider(c);
  const state = generateId('gh');
  const url = github.createAuthorizationURL(state, ['read:user', 'user:email']);
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
    const msg = e instanceof Error ? e.message : 'github_failed';
    return c.redirect(`${frontend}/#/?error=${encodeURIComponent(msg)}`);
  }
});

auth.get('/google/start', async (c) => {
  if (!isConfigured(c.env.GOOGLE_CLIENT_ID)) {
    return c.json({ success: false, error: 'Google 登录未配置' }, 404);
  }
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
    if (!tokenData.id_token) throw new Error('Missing id_token');

    const idParts = tokenData.id_token.split('.');
    if (idParts.length !== 3) throw new Error('Invalid Google ID token');
    let b64 = idParts[1].replace(/-/g, '+').replace(/_/g, '/');
    while (b64.length % 4) b64 += '=';
    const payload: GoogleIdPayload = JSON.parse(atob(b64));

    const user = await findOrCreateUser(c.env, 'google', payload.sub, payload.email || null, payload.name || 'Google User', payload.picture || '');
    const session = await createSession(c.env, user);
    return c.redirect(`${frontend}/#/auth/callback?access_token=${encodeURIComponent(session.access_token)}&refresh_token=${encodeURIComponent(session.refresh_token)}`);
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'google_failed';
    return c.redirect(`${frontend}/#/?error=${encodeURIComponent(msg)}`);
  }
});

auth.post('/refresh', requireAuth, async (c) => {
  const refreshToken = c.req.header('X-Refresh-Token');
  if (!refreshToken) return c.json({ success: false, error: '缺少刷新令牌' }, 400);
  const hash = await hashToken(refreshToken);
  const db = createDb(c.env.DB);

  const session = await db.select()
    .from(authSessions)
    .where(and(
      eq(authSessions.refresh_token_hash, hash),
      sql`${authSessions.revoked_at} IS NULL`,
      sql`${authSessions.expires_at} > datetime('now')`,
    ))
    .get();
  if (!session) return c.json({ success: false, error: '刷新令牌无效或已过期' }, 401);

  const user = await db.select({ public_id: users.public_id, role: users.role })
    .from(users)
    .where(eq(users.id, session.user_id))
    .get();
  if (!user) return c.json({ success: false, error: '用户不存在' }, 401);

  const accessToken = await signAccessToken(c.env, { sub: user.public_id, sid: String(session.id), role: user.role });
  const newRefreshToken = generateRefreshToken();
  const newHash = await hashToken(newRefreshToken);
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

  await db.batch([
    db.update(authSessions).set({ revoked_at: sql`datetime('now')` }).where(eq(authSessions.id, session.id)),
    db.insert(authSessions).values({ user_id: session.user_id, refresh_token_hash: newHash, expires_at: expiresAt }),
  ]);

  return c.json({ success: true, data: { access_token: accessToken, refresh_token: newRefreshToken } });
});

auth.post('/logout', requireAuth, async (c) => {
  const userId = c.get('userId')!;
  const db = createDb(c.env.DB);
  const user = await db.select({ id: users.id })
    .from(users)
    .where(eq(users.public_id, userId))
    .get();
  if (user) {
    await db.update(authSessions)
      .set({ revoked_at: sql`datetime('now')` })
      .where(and(eq(authSessions.user_id, user.id), sql`${authSessions.revoked_at} IS NULL`))
      .run();
  }
  return c.json({ success: true });
});

auth.post('/dev-login', async (c) => {
  try {
    const body = await c.req.json<{ key: string }>();
    if (body.key !== c.env.ADMIN_API_KEY) return c.json({ success: false, error: '无效的管理员密钥' }, 403);
    const db = createDb(c.env.DB);

    let user = await db.select({ public_id: users.public_id, role: users.role })
      .from(users)
      .where(eq(users.role, 'admin'))
      .limit(1)
      .get();

    if (!user) {
      const publicId = generateId('u');
      await db.insert(users).values({ public_id: publicId, nickname: 'admin', role: 'admin' }).run();
      user = { public_id: publicId, role: 'admin' };
    }
    const tokens = await createSession(c.env, user);
    return c.json({ success: true, data: { ...tokens, user } });
  } catch (e) { return c.json({ success: false, error: String(e) }, 500); }
});

async function findOrCreateUser(env: Env, provider: 'github' | 'google', providerUserId: string, email: string | null, login: string, avatar_url: string): Promise<{ public_id: string; role: 'user' | 'admin' }> {
  const db = createDb(env.DB);
  const existing = await db.select({ id: users.id, public_id: users.public_id, role: users.role })
    .from(users)
    .innerJoin(oauthAccounts, eq(users.id, oauthAccounts.user_id))
    .where(and(eq(oauthAccounts.provider, provider), eq(oauthAccounts.provider_user_id, providerUserId)))
    .get();

  if (existing) {
    await db.batch([
      db.update(oauthAccounts).set({
        last_login_at: sql`datetime('now')`,
        provider_email: sql`COALESCE(${email}, ${oauthAccounts.provider_email})`,
        provider_login: login,
      }).where(and(eq(oauthAccounts.provider, provider), eq(oauthAccounts.provider_user_id, providerUserId))),
      db.update(users).set({
        updated_at: sql`datetime('now')`,
        avatar_url: sql`COALESCE(NULLIF(${avatar_url}, ''), ${users.avatar_url})`,
      }).where(eq(users.id, existing.id)),
    ]);
    return { public_id: existing.public_id, role: existing.role };
  }

  const publicId = generateId('u');
  const nickname = login || email?.split('@')[0] || '用户';
  const result = await db.insert(users).values({ public_id: publicId, nickname, avatar_url: avatar_url || null }).run();
  const userId = result.meta?.last_row_id;
  if (!userId) throw new Error('Failed to create user');
  await db.insert(oauthAccounts).values({ user_id: userId, provider, provider_user_id: providerUserId, provider_email: email, provider_login: login }).run();
  return { public_id: publicId, role: 'user' };
}

async function createSession(env: Env, user: { public_id: string; role: 'user' | 'admin' }): Promise<{ access_token: string; refresh_token: string }> {
  const accessToken = await signAccessToken(env, { sub: user.public_id, sid: 'new', role: user.role });
  const refreshToken = generateRefreshToken();
  const hash = await hashToken(refreshToken);
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
  const db = createDb(env.DB);
  const userRow = await db.select({ id: users.id })
    .from(users)
    .where(eq(users.public_id, user.public_id))
    .get();
  await db.insert(authSessions).values({ user_id: userRow!.id, refresh_token_hash: hash, expires_at: expiresAt }).run();
  return { access_token: accessToken, refresh_token: refreshToken };
}

export default auth;
