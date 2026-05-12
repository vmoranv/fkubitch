import { Hono } from 'hono';
import type { AppType } from '../types';
import { createDb } from '../db';
import { users, modelResults } from '../db/schema';
import { sql } from 'drizzle-orm';

const leaderboard = new Hono<AppType>();

leaderboard.get('/', async (c) => {
  const limit = Math.min(parseInt(c.req.query('limit') || '10'), 10);
  const db = createDb(c.env.DB);

  const rows = await db.select({
    user_id: users.publicId,
    nickname: users.nickname,
    avatar_url: users.avatarUrl,
    score: users.totalScore,
  })
    .from(users)
    .orderBy(sql`${users.totalScore} DESC`)
    .limit(limit)
    .all();

  return c.json({
    success: true,
    data: rows.map((row, i) => ({ rank: i + 1, ...row })),
  });
});

leaderboard.get('/models', async (c) => {
  const limit = Math.min(parseInt(c.req.query('limit') || '10'), 10);
  const db = createDb(c.env.DB);

  const rows = await db.select({
    provider: modelResults.provider,
    model_name: modelResults.modelName,
    avg_score: sql<number>`cast(avg(${modelResults.scoreTotal}) as int)`,
    runs: sql<number>`cast(count(*) as int)`,
    best_score: sql<number>`max(${modelResults.scoreTotal})`,
  })
    .from(modelResults)
    .groupBy(modelResults.provider, modelResults.modelName)
    .orderBy(sql`avg(${modelResults.scoreTotal}) DESC`)
    .limit(limit)
    .all();

  return c.json({
    success: true,
    data: rows.map((row, i) => ({
      rank: i + 1,
      provider: row.provider,
      model_name: row.model_name,
      avg_score: row.avg_score,
      best_score: row.best_score,
      runs: row.runs,
    })),
  });
});

export default leaderboard;
