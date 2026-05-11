import { Hono } from 'hono';
import type { Env } from '../types';

const leaderboard = new Hono<{ Bindings: Env }>();

leaderboard.get('/', async (c) => {
  const limit = Math.min(parseInt(c.req.query('limit') || '50'), 100);
  const period = c.req.query('period') || 'all';

  if (period === 'daily') {
    const today = new Date().toISOString().split('T')[0];
    const result = await c.env.DB.prepare(
      `SELECT u.public_id as user_id, u.nickname, u.avatar_url,
              SUM(ucp.best_score) as score
       FROM users u
       JOIN user_challenge_progress ucp ON u.id = ucp.user_id
       WHERE date(ucp.last_submitted_at) = ?
       GROUP BY u.id
       ORDER BY score DESC
       LIMIT ?`
    ).bind(today, limit).all();

    return c.json({
      success: true,
      data: result.results.map((row: Record<string, unknown>, i: number) => ({
        rank: i + 1, ...row,
      })),
    });
  }

  if (period === 'weekly') {
    const result = await c.env.DB.prepare(
      `SELECT u.public_id as user_id, u.nickname, u.avatar_url,
              SUM(ucp.best_score) as score
       FROM users u
       JOIN user_challenge_progress ucp ON u.id = ucp.user_id
       WHERE ucp.last_submitted_at >= datetime('now', '-7 days')
       GROUP BY u.id
       ORDER BY score DESC
       LIMIT ?`
    ).bind(limit).all();

    return c.json({
      success: true,
      data: result.results.map((row: Record<string, unknown>, i: number) => ({
        rank: i + 1, ...row,
      })),
    });
  }

  const result = await c.env.DB.prepare(
    `SELECT public_id as user_id, nickname, avatar_url, total_score as score
     FROM users
     ORDER BY total_score DESC
     LIMIT ?`
  ).bind(limit).all();

  return c.json({
    success: true,
    data: result.results.map((row: Record<string, unknown>, i: number) => ({
      rank: i + 1, ...row,
    })),
  });
});

export default leaderboard;
