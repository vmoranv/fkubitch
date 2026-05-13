import { Hono } from 'hono';
import type { AppType } from '../types';
import { requireAuth } from '../middleware/auth';
import { createDb } from '../db';
import { users, submissions, challenges, userChallengeProgress } from '../db/schema';
import { eq, desc, sql } from 'drizzle-orm';

const usersRouter = new Hono<AppType>();

usersRouter.get('/me', requireAuth, async (c) => {
  const userId = c.get('userId')!;
  const db = createDb(c.env.DB);

  const user = await db.select({
    public_id: users.public_id,
    nickname: users.nickname,
    avatar_url: users.avatar_url,
    total_score: users.total_score,
    role: users.role,
    created_at: users.created_at,
  })
    .from(users)
    .where(eq(users.public_id, userId))
    .get();

  if (!user) return c.json({ success: false, error: '用户不存在' }, 404);

  const solvedRow = await db.select({ count: sql<number>`cast(count(*) as int)` })
    .from(userChallengeProgress)
    .innerJoin(users, eq(userChallengeProgress.user_id, users.id))
    .where(eq(users.public_id, userId))
    .get();

  const rankRow = await db.select({ rank: sql<number>`cast(count(*) + 1 as int)` })
    .from(users)
    .where(sql`${users.total_score} > ${user.total_score}`)
    .get();

  return c.json({
    success: true,
    data: { ...user, solved_count: solvedRow?.count || 0, rank: rankRow?.rank },
  });
});

usersRouter.get('/me/history', requireAuth, async (c) => {
  const userId = c.get('userId')!;
  const limit = Math.min(parseInt(c.req.query('limit') || '20'), 50);
  const offset = parseInt(c.req.query('offset') || '0');
  const db = createDb(c.env.DB);

  const user = await db.select({ id: users.id })
    .from(users)
    .where(eq(users.public_id, userId))
    .get();
  if (!user) return c.json({ success: false, error: '用户不存在' }, 404);

  const items = await db.select({
    id: submissions.id,
    public_id: submissions.public_id,
    user_id: submissions.user_id,
    challenge_id: submissions.challenge_id,
    segmented_text: submissions.segmented_text,
    score_total: submissions.score_total,
    score_segment: submissions.score_segment,
    score_penalty: submissions.score_penalty,
    created_at: submissions.created_at,
    challenge_slug: challenges.slug,
    challenge_raw_text: challenges.raw_text,
  })
    .from(submissions)
    .innerJoin(challenges, eq(submissions.challenge_id, challenges.id))
    .where(eq(submissions.user_id, user.id))
    .orderBy(desc(submissions.created_at))
    .limit(limit)
    .offset(offset)
    .all();

  const totalRow = await db.select({ total: sql<number>`cast(count(*) as int)` })
    .from(submissions)
    .where(eq(submissions.user_id, user.id))
    .get();

  return c.json({
    success: true,
    data: { items, total: totalRow?.total || 0 },
  });
});

usersRouter.get('/me/progress', requireAuth, async (c) => {
  const userId = c.get('userId')!;
  const db = createDb(c.env.DB);

  const user = await db.select({ id: users.id })
    .from(users)
    .where(eq(users.public_id, userId))
    .get();
  if (!user) return c.json({ success: false, error: '用户不存在' }, 404);

  const progress = await db.select({
    user_id: userChallengeProgress.user_id,
    challenge_id: userChallengeProgress.challenge_id,
    best_submission_id: userChallengeProgress.best_submission_id,
    best_score: userChallengeProgress.best_score,
    attempts: userChallengeProgress.attempts,
    last_submitted_at: userChallengeProgress.last_submitted_at,
    challenge_slug: challenges.slug,
    raw_text: challenges.raw_text,
  })
    .from(userChallengeProgress)
    .innerJoin(challenges, eq(userChallengeProgress.challenge_id, challenges.id))
    .where(eq(userChallengeProgress.user_id, user.id))
    .orderBy(desc(userChallengeProgress.last_submitted_at))
    .limit(50)
    .all();

  return c.json({ success: true, data: progress });
});

export default usersRouter;
