import type { Context, Next } from 'hono';
import type { Env } from '../types';
import { verifyAccessToken } from '../services/session';

export async function authMiddleware(c: Context<{ Bindings: Env }>, next: Next) {
  const authHeader = c.req.header('Authorization');
  const cookieToken = c.req.header('Cookie')?.match(/access_token=([^;]+)/)?.[1];

  const token = authHeader?.replace('Bearer ', '') || cookieToken;

  if (!token) {
    c.set('userId', null);
    await next();
    return;
  }

  const payload = await verifyAccessToken(c.env, token);
  if (payload) {
    c.set('userId', payload.sub);
    c.set('userRole', payload.role);
  } else {
    c.set('userId', null);
  }

  await next();
}

export async function requireAuth(c: Context<{ Bindings: Env }>, next: Next) {
  const userId = c.get('userId');
  if (!userId) {
    return c.json({ success: false, error: '请先登录' }, 401);
  }
  await next();
}

export async function requireAdmin(c: Context<{ Bindings: Env }>, next: Next) {
  const role = c.get('userRole');
  if (role !== 'admin') {
    return c.json({ success: false, error: '需要管理员权限' }, 403);
  }
  await next();
}
