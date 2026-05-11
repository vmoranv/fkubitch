import { Hono } from 'hono';
import type { Env } from '../types';
import type { D1Result } from '@cloudflare/workers-types';
import { generateId } from '../utils';
import { signAccessToken, generateRefreshToken, hashToken } from '../services/session';
import {
  generateCodeVerifier,
  generateCodeChallenge,
  getGitHubAuthUrl,
  getGoogleAuthUrl,
  exchangeGitHubCode,
  exchangeGoogleCode,
} from '../services/oauth';
import { requireAuth } from '../middleware/auth';

const auth = new Hono<{ Bindings: Env }>();

auth.get('/github/start', (c) => {
  const state = generateId('gh_state');
  const url = getGitHubAuthUrl(c.env.GITHUB_CLIENT_ID, state);
  return c.redirect(url);
});

auth.get('/github/callback', async (c) => {
  const code = c.req.query('code');
  const state = c.req.query('state');
  if (!code) return c.json({ success: false, error: '缺少授权码' }, 400);

  try {
    const ghUser = await exchangeGitHubCode(
      code, c.env.GITHUB_CLIENT_ID, c.env.GITHUB_CLIENT_SECRET
    );

    const user = await findOrCreateUser(
      c.env, 'github', ghUser.providerUserId,
      ghUser.email, ghUser.login, ghUser.avatarUrl
    );

    return await createSession(c.env, user);
  } catch (e) {
    console.error('GitHub OAuth error:', e);
    return c.json({ success: false, error: 'GitHub 登录失败' }, 500);
  }
});

auth.get('/google/start', async (c) => {
  const state = generateId('go_state');
  const verifier = await generateCodeVerifier();
  const challenge = await generateCodeChallenge(verifier);

  await c.env.KV.put(`oauth:${state}`, verifier, { expirationTtl: 600 });

  const url = getGoogleAuthUrl(c.env.GOOGLE_CLIENT_ID, challenge, state);
  return c.redirect(url);
});

auth.get('/google/callback', async (c) => {
  const code = c.req.query('code');
  const state = c.req.query('state');
  if (!code) return c.json({ success: false, error: '缺少授权码' }, 400);

  const verifier = await c.env.KV.get(`oauth:${state}`);
  if (!verifier) return c.json({ success: false, error: 'OAuth 状态已过期' }, 400);
  await c.env.KV.delete(`oauth:${state}`);

  try {
    const googleUser = await exchangeGoogleCode(
      code, verifier, c.env.GOOGLE_CLIENT_ID, c.env.GOOGLE_CLIENT_SECRET
    );

    const user = await findOrCreateUser(
      c.env, 'google', googleUser.providerUserId,
      googleUser.email, googleUser.name, googleUser.avatarUrl
    );

    return await createSession(c.env, user);
  } catch (e) {
    console.error('Google OAuth error:', e);
    return c.json({ success: false, error: 'Google 登录失败' }, 500);
  }
});

auth.post('/refresh', requireAuth, async (c) => {
  const refreshToken = c.req.header('X-Refresh-Token');
  if (!refreshToken) return c.json({ success: false, error: '缺少刷新令牌' }, 400);

  const hash = await hashToken(refreshToken);
  const session = await c.env.DB.prepare(
    'SELECT * FROM auth_sessions WHERE refresh_token_hash = ? AND revoked_at IS NULL AND expires_at > datetime("now")'
  ).bind(hash).first<{ id: number; user_id: number }>();

  if (!session) return c.json({ success: false, error: '刷新令牌无效或已过期' }, 401);

  const user = await c.env.DB.prepare(
    'SELECT public_id, role FROM users WHERE id = ?'
  ).bind(session.user_id).first<{ public_id: string; role: 'user' | 'admin' }>();

  if (!user) return c.json({ success: false, error: '用户不存在' }, 401);

  const accessToken = await signAccessToken(c.env, {
    sub: user.public_id,
    sid: String(session.id),
    role: user.role,
  });

  const newRefreshToken = generateRefreshToken();
  const newHash = await hashToken(newRefreshToken);
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

  await c.env.DB.prepare(
    'UPDATE auth_sessions SET revoked_at = datetime("now") WHERE id = ?'
  ).bind(session.id).run();

  await c.env.DB.prepare(
    'INSERT INTO auth_sessions (user_id, refresh_token_hash, expires_at) VALUES (?, ?, ?)'
  ).bind(session.user_id, newHash, expiresAt).run();

  return c.json({
    success: true,
    data: { access_token: accessToken, refresh_token: newRefreshToken },
  });
});

auth.post('/logout', requireAuth, async (c) => {
  const userId = c.get('userId');
  const user = await c.env.DB.prepare(
    'SELECT id FROM users WHERE public_id = ?'
  ).bind(userId).first<{ id: number }>();

  if (user) {
    await c.env.DB.prepare(
      "UPDATE auth_sessions SET revoked_at = datetime('now') WHERE user_id = ? AND revoked_at IS NULL"
    ).bind(user.id).run();
  }

  return c.json({ success: true });
});

async function findOrCreateUser(
  env: Env,
  provider: 'github' | 'google',
  providerUserId: string,
  email: string | null,
  login: string,
  avatarUrl: string
): Promise<{ public_id: string; role: 'user' | 'admin' }> {
  const existing = await env.DB.prepare(
    'SELECT u.id, u.public_id, u.role FROM users u JOIN oauth_accounts oa ON u.id = oa.user_id WHERE oa.provider = ? AND oa.provider_user_id = ?'
  ).bind(provider, providerUserId).first<{ id: number; public_id: string; role: 'user' | 'admin' }>();

  if (existing) {
    await env.DB.prepare(
      "UPDATE oauth_accounts SET last_login_at = datetime('now'), provider_email = COALESCE(?, provider_email), provider_login = ? WHERE provider = ? AND provider_user_id = ?"
    ).bind(email, login, provider, providerUserId).run();

    await env.DB.prepare(
      "UPDATE users SET updated_at = datetime('now'), avatar_url = COALESCE(NULLIF(?, ''), avatar_url) WHERE id = ?"
    ).bind(avatarUrl, existing.id).run();

    return { public_id: existing.public_id, role: existing.role };
  }

  const publicId = generateId('u');
  const nickname = login || email?.split('@')[0] || '用户';
  const result = await env.DB.prepare(
    'INSERT INTO users (public_id, nickname, avatar_url) VALUES (?, ?, ?)'
  ).bind(publicId, nickname, avatarUrl || null).run();

  const userId = result.meta?.last_row_id;
  if (!userId) throw new Error('Failed to create user');

  await env.DB.prepare(
    'INSERT INTO oauth_accounts (user_id, provider, provider_user_id, provider_email, provider_login) VALUES (?, ?, ?, ?, ?)'
  ).bind(userId, provider, providerUserId, email, login).run();

  return { public_id: publicId, role: 'user' };
}

async function createSession(
  env: Env,
  user: { public_id: string; role: 'user' | 'admin' }
): Promise<Response> {
  const accessToken = await signAccessToken(env, {
    sub: user.public_id,
    sid: 'new',
    role: user.role,
  });

  const refreshToken = generateRefreshToken();
  const hash = await hashToken(refreshToken);
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

  const userRow = await env.DB.prepare(
    'SELECT id FROM users WHERE public_id = ?'
  ).bind(user.public_id).first<{ id: number }>();

  await env.DB.prepare(
    'INSERT INTO auth_sessions (user_id, refresh_token_hash, expires_at) VALUES (?, ?, ?)'
  ).bind(userRow!.id, hash, expiresAt).run();

  return new Response(
    JSON.stringify({
      success: true,
      data: { access_token: accessToken, refresh_token: refreshToken, user: user },
    }),
    { status: 200, headers: { 'Content-Type': 'application/json' } }
  );
}

export default auth;
