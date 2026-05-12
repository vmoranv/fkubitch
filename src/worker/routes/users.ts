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
    public_id: users.publicId,
    nickname: users.nickname,
    avatar_url: users.avatarUrl,
    total_score: users.totalScore,
    role: users.role,
    created_at: users.createdAt,
  })
    .from(users)
    .where(eq(users.publicId, userId))
    .get();

  if (!user) return c.json({ success: false, error: '用户不存在' }, 404);

  const solvedRow = await db.select({ count: sql<number>`cast(count(*) as int)` })
    .from(userChallengeProgress)
    .innerJoin(users, eq(userChallengeProgress.userId, users.id))
    .where(eq(users.publicId, userId))
    .get();

  const rankRow = await db.select({ rank: sql<number>`cast(count(*) + 1 as int)` })
    .from(users)
    .where(sql`${users.totalScore} > ${user.total_score}`)
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
    .where(eq(users.publicId, userId))
    .get();
  if (!user) return c.json({ success: false, error: '用户不存在' }, 404);

  const items = await db.select({
    id: submissions.id,
    public_id: submissions.publicId,
    user_id: submissions.userId,
    challenge_id: submissions.challengeId,
    segmented_text: submissions.segmentedText,
    score_total: submissions.scoreTotal,
    score_segment: submissions.scoreSegment,
    score_penalty: submissions.scorePenalty,
    created_at: submissions.createdAt,
    challenge_slug: challenges.slug,
    challenge_raw_text: challenges.rawText,
  })
    .from(submissions)
    .innerJoin(challenges, eq(submissions.challengeId, challenges.id))
    .where(eq(submissions.userId, user.id))
    .orderBy(desc(submissions.createdAt))
    .limit(limit)
    .offset(offset)
    .all();

  const totalRow = await db.select({ total: sql<number>`cast(count(*) as int)` })
    .from(submissions)
    .where(eq(submissions.userId, user.id))
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
    .where(eq(users.publicId, userId))
    .get();
  if (!user) return c.json({ success: false, error: '用户不存在' }, 404);

  const progress = await db.select({
    user_id: userChallengeProgress.userId,
    challenge_id: userChallengeProgress.challengeId,
    best_submission_id: userChallengeProgress.bestSubmissionId,
    best_score: userChallengeProgress.bestScore,
    attempts: userChallengeProgress.attempts,
    last_submitted_at: userChallengeProgress.lastSubmittedAt,
    challenge_slug: challenges.slug,
    raw_text: challenges.rawText,
  })
    .from(userChallengeProgress)
    .innerJoin(challenges, eq(userChallengeProgress.challengeId, challenges.id))
    .where(eq(userChallengeProgress.userId, user.id))
    .orderBy(desc(userChallengeProgress.lastSubmittedAt))
    .limit(50)
    .all();

  return c.json({ success: true, data: progress });
});

export default usersRouter;
