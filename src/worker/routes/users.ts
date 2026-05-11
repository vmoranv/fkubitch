import { Hono } from 'hono';
import type { Env } from '../types';
import { requireAuth } from '../middleware/auth';

const users = new Hono<{ Bindings: Env }>();

users.get('/me', requireAuth, async (c) => {
  const userId = c.get('userId');

  const user = await c.env.DB.prepare(
    'SELECT public_id, nickname, avatar_url, total_score, role, created_at FROM users WHERE public_id = ?'
  ).bind(userId).first();

  if (!user) return c.json({ success: false, error: '用户不存在' }, 404);

  const solvedCount = await c.env.DB.prepare(
    'SELECT COUNT(*) as count FROM user_challenge_progress WHERE user_id = (SELECT id FROM users WHERE public_id = ?)'
  ).bind(userId).first<{ count: number }>();

  const rankResult = await c.env.DB.prepare(
    'SELECT COUNT(*) + 1 as rank FROM users WHERE total_score > ?'
  ).bind((user as Record<string, unknown>).total_score).first<{ rank: number }>();

  return c.json({
    success: true,
    data: { ...user as Record<string, unknown>, solved_count: solvedCount?.count || 0, rank: rankResult?.rank },
  });
});

users.get('/me/history', requireAuth, async (c) => {
  const userId = c.get('userId');
  const limit = Math.min(parseInt(c.req.query('limit') || '20'), 50);
  const offset = parseInt(c.req.query('offset') || '0');

  const user = await c.env.DB.prepare(
    'SELECT id FROM users WHERE public_id = ?'
  ).bind(userId).first<{ id: number }>();
  if (!user) return c.json({ success: false, error: '用户不存在' }, 404);

  const submissions = await c.env.DB.prepare(
    `SELECT s.*, c.slug as challenge_slug, c.raw_text as challenge_raw_text
     FROM submissions s
     JOIN challenges c ON s.challenge_id = c.id
     WHERE s.user_id = ?
     ORDER BY s.created_at DESC
     LIMIT ? OFFSET ?`
  ).bind(user.id, limit, offset).all();

  const total = await c.env.DB.prepare(
    'SELECT COUNT(*) as total FROM submissions WHERE user_id = ?'
  ).bind(user.id).first<{ total: number }>();

  return c.json({
    success: true,
    data: { items: submissions.results, total: total?.total || 0 },
  });
});

users.get('/me/progress', requireAuth, async (c) => {
  const userId = c.get('userId');

  const user = await c.env.DB.prepare(
    'SELECT id FROM users WHERE public_id = ?'
  ).bind(userId).first<{ id: number }>();
  if (!user) return c.json({ success: false, error: '用户不存在' }, 404);

  const progress = await c.env.DB.prepare(
    `SELECT ucp.*, c.slug as challenge_slug, c.raw_text, c.difficulty
     FROM user_challenge_progress ucp
     JOIN challenges c ON ucp.challenge_id = c.id
     WHERE ucp.user_id = ?
     ORDER BY ucp.last_submitted_at DESC
     LIMIT 50`
  ).bind(user.id).all();

  return c.json({ success: true, data: progress.results });
});

export default users;
