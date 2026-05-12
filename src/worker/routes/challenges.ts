import { Hono } from 'hono';
import type { Context, Next } from 'hono';
import type { AppType } from '../types';
import { generateId, sha256 } from '../utils';
import { scoreSubmission } from '../services/scoring';
import { requireAuth } from '../middleware/auth';
import { turnstileVerify } from '../middleware/turnstile';
import { createDb } from '../db';
import { challenges, submissions, users, userChallengeProgress, dailyChallenges } from '../db/schema';
import { eq, desc, sql, and } from 'drizzle-orm';

const challengesRouter = new Hono<AppType>();

const submitCooldown = new Map<string, number>();
const SUBMIT_CD_MS = 30_000;
const CD_PRUNE_MS = 300_000;

function pruneCooldown() {
  const cutoff = Date.now() - CD_PRUNE_MS;
  for (const [k, v] of submitCooldown) {
    if (v < cutoff) submitCooldown.delete(k);
  }
}

challengesRouter.get('/', async (c) => {
  const page = parseInt(c.req.query('page') || '1');
  const limit = Math.min(parseInt(c.req.query('limit') || '20'), 50);
  const offset = (page - 1) * limit;
  const db = createDb(c.env.DB);

  const items = await db.select()
    .from(challenges)
    .where(eq(challenges.status, 'published'))
    .orderBy(desc(challenges.playCount), desc(challenges.createdAt))
    .limit(limit)
    .offset(offset)
    .all();

  const trimmed = items.map((r) => {
    if (r.rawText.length > 30) {
      return { ...r, rawText: r.rawText.slice(0, 30) + '…' };
    }
    return r;
  });

  const countResult = await db.select({ total: sql<number>`cast(count(*) as int)` })
    .from(challenges)
    .where(eq(challenges.status, 'published'))
    .get();

  return c.json({ success: true, data: { items: trimmed, total: countResult?.total || 0, page, limit } });
});

challengesRouter.get('/daily', async (c) => {
  const today = new Date().toISOString().split('T')[0];
  const db = createDb(c.env.DB);

  const daily = await db.select()
    .from(challenges)
    .innerJoin(dailyChallenges, eq(challenges.id, dailyChallenges.challengeId))
    .where(eq(dailyChallenges.challengeDate, today))
    .get();
  if (daily) return c.json({ success: true, data: daily.challenges });

  const fallback = await db.select()
    .from(challenges)
    .where(eq(challenges.status, 'published'))
    .orderBy(sql`RANDOM()`)
    .limit(1)
    .get();
  if (fallback) {
    await db.insert(dailyChallenges).values({
      challengeDate: today,
      challengeId: fallback.id,
    })
      .onConflictDoNothing()
      .run();
    return c.json({ success: true, data: fallback });
  }
  return c.json({ success: true, data: null });
});

challengesRouter.post('/submit', requireAuth, async (c) => {
  const userId = c.get('userId')!;
  const body = await c.req.json<{ raw_text: string; answer_key_json: string }>();
  if (!body.raw_text || !body.answer_key_json) {
    return c.json({ success: false, error: '缺少必填字段' }, 400);
  }
  const db = createDb(c.env.DB);

  const user = await db.select({ id: users.id, role: users.role })
    .from(users)
    .where(eq(users.publicId, userId))
    .get();
  if (!user) return c.json({ success: false, error: '用户不存在' }, 401);

  const slug = (await sha256(body.raw_text)).slice(0, 8);
  const existing = await db.select({ id: challenges.id })
    .from(challenges)
    .where(eq(challenges.slug, slug))
    .get();
  if (existing) return c.json({ success: false, error: '该文本已存在' }, 409);

  const status = user.role === 'admin' ? 'published' : 'pending';
  await db.insert(challenges).values({
    slug,
    rawText: body.raw_text,
    answerKeyJson: body.answer_key_json,
    status: status as 'draft' | 'published' | 'archived' | 'pending',
    submittedBy: user.id,
  }).run();

  return c.json({ success: true, data: { slug, status } });
});

challengesRouter.get('/:slug', async (c) => {
  const slug = c.req.param('slug')!;
  const db = createDb(c.env.DB);
  const row = await db.select()
    .from(challenges)
    .where(and(eq(challenges.slug, slug), eq(challenges.status, 'published')))
    .get();
  if (!row) return c.json({ success: false, error: '挑战不存在' }, 404);
  return c.json({ success: true, data: row });
});

challengesRouter.get('/:slug/submissions', async (c) => {
  const slug = c.req.param('slug')!;
  const db = createDb(c.env.DB);
  const challenge = await db.select({ id: challenges.id })
    .from(challenges)
    .where(eq(challenges.slug, slug))
    .get();
  if (!challenge) return c.json({ success: false, error: '挑战不存在' }, 404);

  const limit = Math.min(parseInt(c.req.query('limit') || '10'), 20);
  const subs = await db.select({
    id: submissions.id,
    public_id: submissions.publicId,
    user_id: submissions.userId,
    challenge_id: submissions.challengeId,
    segmented_text: submissions.segmentedText,
    score_total: submissions.scoreTotal,
    score_segment: submissions.scoreSegment,
    score_penalty: submissions.scorePenalty,
    created_at: submissions.createdAt,
    user_nickname: users.nickname,
  })
    .from(submissions)
    .innerJoin(users, eq(submissions.userId, users.id))
    .where(eq(submissions.challengeId, challenge.id))
    .orderBy(desc(submissions.scoreTotal))
    .limit(limit)
    .all();
  return c.json({ success: true, data: subs });
});

challengesRouter.get('/:slug/model-results', async (c) => {
  const slug = c.req.param('slug')!;
  const db = createDb(c.env.DB);
  const { modelResults } = await import('../db/schema');
  const challenge = await db.select({ id: challenges.id })
    .from(challenges)
    .where(eq(challenges.slug, slug))
    .get();
  if (!challenge) return c.json({ success: false, error: '挑战不存在' }, 404);

  const results = await db.select()
    .from(modelResults)
    .where(eq(modelResults.challengeId, challenge.id))
    .orderBy(desc(modelResults.scoreTotal))
    .all();
  return c.json({ success: true, data: results });
});

async function submitCooldownMw(c: Context<AppType>, next: Next) {
  const userId = c.get('userId');
  if (!userId) { await next(); return; }
  const last = submitCooldown.get(userId);
  if (last && Date.now() - last < SUBMIT_CD_MS) {
    const wait = Math.ceil((SUBMIT_CD_MS - (Date.now() - last)) / 1000);
    return c.json({ success: false, error: `提交太频繁，请等 ${wait} 秒` }, 429);
  }
  await next();
  if (c.res.status < 300) {
    submitCooldown.set(userId, Date.now());
    if (submitCooldown.size > 1000) pruneCooldown();
  }
}

challengesRouter.post('/:slug/submit', requireAuth, submitCooldownMw, turnstileVerify, async (c) => {
  const slug = c.req.param('slug')!;
  const userId = c.get('userId')!;
  const body = await c.req.json<{ segmented_text: string }>();
  if (!body.segmented_text) return c.json({ success: false, error: '请提供断句结果' }, 400);
  const db = createDb(c.env.DB);

  const challenge = await db.select()
    .from(challenges)
    .where(and(eq(challenges.slug, slug), eq(challenges.status, 'published')))
    .get();
  if (!challenge) return c.json({ success: false, error: '挑战不存在' }, 404);

  const user = await db.select({ id: users.id })
    .from(users)
    .where(eq(users.publicId, userId))
    .get();
  if (!user) return c.json({ success: false, error: '用户不存在' }, 401);

  const scores = scoreSubmission(challenge.rawText, body.segmented_text, challenge.answerKeyJson);

  const existingSame = await db.select({ id: submissions.id })
    .from(submissions)
    .where(and(
      eq(submissions.userId, user.id),
      eq(submissions.challengeId, challenge.id),
      eq(submissions.segmentedText, body.segmented_text),
    ))
    .limit(1)
    .get();
  if (existingSame) return c.json({ success: false, error: '已经提交过相同答案' }, 409);

  const submissionId = generateId('sub');

  const progress = await db.select()
    .from(userChallengeProgress)
    .where(and(eq(userChallengeProgress.userId, user.id), eq(userChallengeProgress.challengeId, challenge.id)))
    .get();

  if (progress) {
    const na = progress.attempts + 1;
    if (scores.score_total > (progress.bestScore ?? 0)) {
      const diff = scores.score_total - (progress.bestScore ?? 0);
      await db.batch([
        db.insert(submissions).values({
          publicId: submissionId,
          userId: user.id,
          challengeId: challenge.id,
          segmentedText: body.segmented_text,
          scoreTotal: scores.score_total,
          scoreSegment: scores.score_segment,
          scorePenalty: scores.score_penalty,
        }),
        db.update(userChallengeProgress).set({
          bestScore: scores.score_total,
          attempts: na,
          lastSubmittedAt: sql`datetime('now')`,
        }).where(and(eq(userChallengeProgress.userId, user.id), eq(userChallengeProgress.challengeId, challenge.id))),
        db.update(users).set({
          totalScore: sql`${users.totalScore} + ${diff}`,
          updatedAt: sql`datetime('now')`,
        }).where(eq(users.id, user.id)),
        db.update(challenges).set({
          playCount: sql`${challenges.playCount} + 1`,
        }).where(eq(challenges.id, challenge.id)),
      ]);
    } else {
      await db.batch([
        db.insert(submissions).values({
          publicId: submissionId,
          userId: user.id,
          challengeId: challenge.id,
          segmentedText: body.segmented_text,
          scoreTotal: scores.score_total,
          scoreSegment: scores.score_segment,
          scorePenalty: scores.score_penalty,
        }),
        db.update(userChallengeProgress).set({
          attempts: na,
          lastSubmittedAt: sql`datetime('now')`,
        }).where(and(eq(userChallengeProgress.userId, user.id), eq(userChallengeProgress.challengeId, challenge.id))),
        db.update(challenges).set({
          playCount: sql`${challenges.playCount} + 1`,
        }).where(eq(challenges.id, challenge.id)),
      ]);
    }
  } else {
    await db.batch([
      db.insert(submissions).values({
        publicId: submissionId,
        userId: user.id,
        challengeId: challenge.id,
        segmentedText: body.segmented_text,
        scoreTotal: scores.score_total,
        scoreSegment: scores.score_segment,
        scorePenalty: scores.score_penalty,
      }),
      db.insert(userChallengeProgress).values({
        userId: user.id,
        challengeId: challenge.id,
        bestScore: scores.score_total,
        attempts: 1,
      }),
      db.update(users).set({
        totalScore: sql`${users.totalScore} + ${scores.score_total}`,
        updatedAt: sql`datetime('now')`,
      }).where(eq(users.id, user.id)),
      db.update(challenges).set({
        playCount: sql`${challenges.playCount} + 1`,
      }).where(eq(challenges.id, challenge.id)),
    ]);
  }

  const updatedUser = await db.select({ totalScore: users.totalScore })
    .from(users)
    .where(eq(users.id, user.id))
    .get();
  const rank = await db.select({ rank: sql<number>`cast(count(*) + 1 as int)` })
    .from(users)
    .where(sql`${users.totalScore} > ${updatedUser?.totalScore || 0}`)
    .get();

  return c.json({ success: true, data: { submission_id: submissionId, ...scores, total_score: updatedUser?.totalScore, rank: rank?.rank } });
});

export default challengesRouter;
