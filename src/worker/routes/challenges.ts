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
    .orderBy(desc(challenges.play_count), desc(challenges.created_at))
    .limit(limit)
    .offset(offset)
    .all();

  const trimmed = items.map((r) => {
    if (r.raw_text.length > 30) {
      return { ...r, raw_text: r.raw_text.slice(0, 30) + '…' };
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
    .innerJoin(dailyChallenges, eq(challenges.id, dailyChallenges.challenge_id))
    .where(eq(dailyChallenges.challenge_date, today))
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
      challenge_date: today,
      challenge_id: fallback.id,
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
    .where(eq(users.public_id, userId))
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
    raw_text: body.raw_text,
    answer_key_json: body.answer_key_json,
    status: status as 'draft' | 'published' | 'archived' | 'pending',
    submitted_by: user.id,
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
    public_id: submissions.public_id,
    user_id: submissions.user_id,
    challenge_id: submissions.challenge_id,
    segmented_text: submissions.segmented_text,
    score_total: submissions.score_total,
    score_segment: submissions.score_segment,
    score_penalty: submissions.score_penalty,
    created_at: submissions.created_at,
    user_nickname: users.nickname,
  })
    .from(submissions)
    .innerJoin(users, eq(submissions.user_id, users.id))
    .where(eq(submissions.challenge_id, challenge.id))
    .orderBy(desc(submissions.score_total))
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
    .where(eq(modelResults.challenge_id, challenge.id))
    .orderBy(desc(modelResults.score_total))
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
    .where(eq(users.public_id, userId))
    .get();
  if (!user) return c.json({ success: false, error: '用户不存在' }, 401);

  const scores = scoreSubmission(challenge.raw_text, body.segmented_text, challenge.answer_key_json);

  const existingSame = await db.select({ id: submissions.id })
    .from(submissions)
    .where(and(
      eq(submissions.user_id, user.id),
      eq(submissions.challenge_id, challenge.id),
      eq(submissions.segmented_text, body.segmented_text),
    ))
    .limit(1)
    .get();
  if (existingSame) return c.json({ success: false, error: '已经提交过相同答案' }, 409);

  const submissionId = generateId('sub');

  const progress = await db.select()
    .from(userChallengeProgress)
    .where(and(eq(userChallengeProgress.user_id, user.id), eq(userChallengeProgress.challenge_id, challenge.id)))
    .get();

  if (progress) {
    const na = progress.attempts + 1;
    if (scores.score_total > (progress.best_score ?? 0)) {
      const diff = scores.score_total - (progress.best_score ?? 0);
      await db.batch([
        db.insert(submissions).values({
          public_id: submissionId,
          user_id: user.id,
          challenge_id: challenge.id,
          segmented_text: body.segmented_text,
          score_total: scores.score_total,
          score_segment: scores.score_segment,
          score_penalty: scores.score_penalty,
        }),
        db.update(userChallengeProgress).set({
          best_score: scores.score_total,
          attempts: na,
          last_submitted_at: sql`datetime('now')`,
        }).where(and(eq(userChallengeProgress.user_id, user.id), eq(userChallengeProgress.challenge_id, challenge.id))),
        db.update(users).set({
          total_score: sql`${users.total_score} + ${diff}`,
          updated_at: sql`datetime('now')`,
        }).where(eq(users.id, user.id)),
        db.update(challenges).set({
          play_count: sql`${challenges.play_count} + 1`,
        }).where(eq(challenges.id, challenge.id)),
      ]);
    } else {
      await db.batch([
        db.insert(submissions).values({
          public_id: submissionId,
          user_id: user.id,
          challenge_id: challenge.id,
          segmented_text: body.segmented_text,
          score_total: scores.score_total,
          score_segment: scores.score_segment,
          score_penalty: scores.score_penalty,
        }),
        db.update(userChallengeProgress).set({
          attempts: na,
          last_submitted_at: sql`datetime('now')`,
        }).where(and(eq(userChallengeProgress.user_id, user.id), eq(userChallengeProgress.challenge_id, challenge.id))),
        db.update(challenges).set({
          play_count: sql`${challenges.play_count} + 1`,
        }).where(eq(challenges.id, challenge.id)),
      ]);
    }
  } else {
    await db.batch([
      db.insert(submissions).values({
        public_id: submissionId,
        user_id: user.id,
        challenge_id: challenge.id,
        segmented_text: body.segmented_text,
        score_total: scores.score_total,
        score_segment: scores.score_segment,
        score_penalty: scores.score_penalty,
      }),
      db.insert(userChallengeProgress).values({
        user_id: user.id,
        challenge_id: challenge.id,
        best_score: scores.score_total,
        attempts: 1,
      }),
      db.update(users).set({
        total_score: sql`${users.total_score} + ${scores.score_total}`,
        updated_at: sql`datetime('now')`,
      }).where(eq(users.id, user.id)),
      db.update(challenges).set({
        play_count: sql`${challenges.play_count} + 1`,
      }).where(eq(challenges.id, challenge.id)),
    ]);
  }

  const updatedUser = await db.select({ total_score: users.total_score })
    .from(users)
    .where(eq(users.id, user.id))
    .get();
  const rank = await db.select({ rank: sql<number>`cast(count(*) + 1 as int)` })
    .from(users)
    .where(sql`${users.total_score} > ${updatedUser?.total_score || 0}`)
    .get();

  return c.json({ success: true, data: { submission_id: submissionId, ...scores, total_score: updatedUser?.total_score, rank: rank?.rank } });
});

export default challengesRouter;
