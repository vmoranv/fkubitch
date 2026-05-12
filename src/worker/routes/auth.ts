import { Hono } from 'hono';
import type { Context } from 'hono';
import type { AppType, Env } from '../types';
import { generateId } from '../utils';
import { signAccessToken, generateRefreshToken, hashToken } from '../services/session';
import { requireAuth } from '../middleware/auth';
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

const auth = new Hono<AppType>();

function getBaseUrl(c: Context<AppType>): string {
  const url = new URL(c.req.url);
  return `${url.protocol}//${url.host}`;
}

function getGitHubProvider(c: Context<AppType>) {
  const base = getBaseUrl(c);
  return new GitHub(c.env.GITHUB_CLIENT_ID, c.env.GITHUB_CLIENT_SECRET, `${base}/api/auth/github/callback`);
}

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

    let payload: GoogleIdPayload;
    try {
      const idParts = tokenData.id_token!.split('.');
      payload = JSON.parse(atob(idParts[1]));
    } catch {
      const idParts = tokenData.id_token!.split('.');
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

auth.post('/refresh', requireAuth, async (c) => {
  const refreshToken = c.req.header('X-Refresh-Token');
  if (!refreshToken) return c.json({ success: false, error: '缺少刷新令牌' }, 400);
  const hash = await hashToken(refreshToken);
  const db = createDb(c.env.DB);

  const session = await db.select()
    .from(authSessions)
    .where(and(
      eq(authSessions.refreshTokenHash, hash),
      sql`${authSessions.revokedAt} IS NULL`,
      sql`${authSessions.expiresAt} > datetime('now')`,
    ))
    .get();
  if (!session) return c.json({ success: false, error: '刷新令牌无效或已过期' }, 401);

  const user = await db.select({ public_id: users.publicId, role: users.role })
    .from(users)
    .where(eq(users.id, session.userId))
    .get();
  if (!user) return c.json({ success: false, error: '用户不存在' }, 401);

  const accessToken = await signAccessToken(c.env, { sub: user.public_id, sid: String(session.id), role: user.role });
  const newRefreshToken = generateRefreshToken();
  const newHash = await hashToken(newRefreshToken);
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

  await db.batch([
    db.update(authSessions).set({ revokedAt: sql`datetime('now')` }).where(eq(authSessions.id, session.id)),
    db.insert(authSessions).values({ userId: session.userId, refreshTokenHash: newHash, expiresAt }),
  ]);

  return c.json({ success: true, data: { access_token: accessToken, refresh_token: newRefreshToken } });
});

auth.post('/logout', requireAuth, async (c) => {
  const userId = c.get('userId')!;
  const db = createDb(c.env.DB);
  const user = await db.select({ id: users.id })
    .from(users)
    .where(eq(users.publicId, userId))
    .get();
  if (user) {
    await db.update(authSessions)
      .set({ revokedAt: sql`datetime('now')` })
      .where(and(eq(authSessions.userId, user.id), sql`${authSessions.revokedAt} IS NULL`))
      .run();
  }
  return c.json({ success: true });
});

auth.post('/dev-login', async (c) => {
  try {
    const body = await c.req.json<{ key: string }>();
    if (body.key !== c.env.ADMIN_API_KEY) return c.json({ success: false, error: '无效的管理员密钥' }, 403);
    const db = createDb(c.env.DB);

    let user = await db.select({ public_id: users.publicId, role: users.role })
      .from(users)
      .where(eq(users.role, 'admin'))
      .limit(1)
      .get();

    if (!user) {
      const publicId = generateId('u');
      await db.insert(users).values({ publicId, nickname: 'admin', role: 'admin' }).run();
      user = { public_id: publicId, role: 'admin' };
    }
    const tokens = await createSession(c.env, user);
    return c.json({ success: true, data: { ...tokens, user } });
  } catch (e) { return c.json({ success: false, error: String(e) }, 500); }
});

async function findOrCreateUser(env: Env, provider: 'github' | 'google', providerUserId: string, email: string | null, login: string, avatarUrl: string): Promise<{ public_id: string; role: 'user' | 'admin' }> {
  const db = createDb(env.DB);
  const existing = await db.select({ id: users.id, public_id: users.publicId, role: users.role })
    .from(users)
    .innerJoin(oauthAccounts, eq(users.id, oauthAccounts.userId))
    .where(and(eq(oauthAccounts.provider, provider), eq(oauthAccounts.providerUserId, providerUserId)))
    .get();

  if (existing) {
    await db.batch([
      db.update(oauthAccounts).set({
        lastLoginAt: sql`datetime('now')`,
        providerEmail: sql`COALESCE(${email}, ${oauthAccounts.providerEmail})`,
        providerLogin: login,
      }).where(and(eq(oauthAccounts.provider, provider), eq(oauthAccounts.providerUserId, providerUserId))),
      db.update(users).set({
        updatedAt: sql`datetime('now')`,
        avatarUrl: sql`COALESCE(NULLIF(${avatarUrl}, ''), ${users.avatarUrl})`,
      }).where(eq(users.id, existing.id)),
    ]);
    return { public_id: existing.public_id, role: existing.role };
  }

  const publicId = generateId('u');
  const nickname = login || email?.split('@')[0] || '用户';
  const result = await db.insert(users).values({ publicId, nickname, avatarUrl: avatarUrl || null }).run();
  const userId = result.meta?.last_row_id;
  if (!userId) throw new Error('Failed to create user');
  await db.insert(oauthAccounts).values({ userId, provider, providerUserId, providerEmail: email, providerLogin: login }).run();
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
    .where(eq(users.publicId, user.public_id))
    .get();
  await db.insert(authSessions).values({ userId: userRow!.id, refreshTokenHash: hash, expiresAt }).run();
  return { access_token: accessToken, refresh_token: refreshToken };
}

export default auth;
