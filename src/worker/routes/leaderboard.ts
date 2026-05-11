import { Hono } from 'hono';
import type { Env } from '../types';

const leaderboard = new Hono<{ Bindings: Env }>();

// 人类排行榜
leaderboard.get('/', async (c) => {
  const limit = Math.min(parseInt(c.req.query('limit') || '50'), 100);

  const result = await c.env.DB.prepare(
    `SELECT public_id as user_id, nickname, avatar_url, total_score as score
     FROM users ORDER BY total_score DESC LIMIT ?`
  ).bind(limit).all();

  return c.json({
    success: true,
    data: result.results.map((row: Record<string, unknown>, i: number) => ({ rank: i + 1, ...row })),
  });
});

// LLM 排行榜
leaderboard.get('/models', async (c) => {
  const limit = Math.min(parseInt(c.req.query('limit') || '50'), 100);

  const result = await c.env.DB.prepare(
    `SELECT provider, model_name, AVG(score_total) as avg_score, COUNT(*) as runs,
            MAX(score_total) as best_score
     FROM model_results
     GROUP BY provider, model_name
     ORDER BY avg_score DESC LIMIT ?`
  ).bind(limit).all();

  return c.json({
    success: true,
    data: result.results.map((row: Record<string, unknown>, i: number) => ({
      rank: i + 1,
      provider: row.provider,
      model_name: row.model_name,
      avg_score: Math.round(row.avg_score as number),
      best_score: row.best_score,
      runs: row.runs,
    })),
  });
});

export default leaderboard;
