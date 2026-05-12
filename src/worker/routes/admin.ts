import { Hono } from 'hono';
import type { AppType } from '../types';
import { requireAuth, requireAdmin } from '../middleware/auth';
import { scoreSubmission } from '../services/scoring';
import { createDb } from '../db';
import { challenges, modelResults, users, dailyChallenges } from '../db/schema';
import { eq, desc, sql, and } from 'drizzle-orm';

const admin = new Hono<AppType>();
admin.use('*', requireAuth, requireAdmin);

admin.get('/challenges', async (c) => {
  const db = createDb(c.env.DB);
  const result = await db.select({
    id: challenges.id,
    slug: challenges.slug,
    rawText: challenges.rawText,
    answerKeyJson: challenges.answerKeyJson,
    status: challenges.status,
    submittedBy: challenges.submittedBy,
    playCount: challenges.playCount,
    createdAt: challenges.createdAt,
    model_count: sql<number>`cast(count(${modelResults.id}) as int)`,
  })
    .from(challenges)
    .leftJoin(modelResults, eq(challenges.id, modelResults.challengeId))
    .groupBy(challenges.id)
    .orderBy(desc(challenges.createdAt))
    .all();

  return c.json({ success: true, data: result });
});

admin.post('/challenges', async (c) => {
  const body = await c.req.json<{ slug: string; raw_text: string; answer_key_json: string; status?: string }>();
  if (!body.slug || !body.raw_text || !body.answer_key_json) {
    return c.json({ success: false, error: '缺少必填字段' }, 400);
  }
  const db = createDb(c.env.DB);
  const status = body.status || 'published';
  await db.insert(challenges).values({
    slug: body.slug,
    rawText: body.raw_text,
    answerKeyJson: body.answer_key_json,
    status: status as 'draft' | 'published' | 'archived' | 'pending',
  }).run();
  return c.json({ success: true, data: { slug: body.slug } });
});

admin.put('/challenges/:slug', async (c) => {
  const slug = c.req.param('slug');
  const body = await c.req.json<{ raw_text?: string; answer_key_json?: string; status?: string }>();
  const updates: Record<string, unknown> = {};
  if (body.raw_text !== undefined) updates.rawText = body.raw_text;
  if (body.answer_key_json !== undefined) updates.answerKeyJson = body.answer_key_json;
  if (body.status !== undefined) updates.status = body.status;
  if (Object.keys(updates).length === 0) return c.json({ success: false, error: '没有要更新的字段' }, 400);
  const db = createDb(c.env.DB);
  await db.update(challenges).set(updates).where(eq(challenges.slug, slug)).run();
  return c.json({ success: true });
});

admin.delete('/challenges/:slug', async (c) => {
  const db = createDb(c.env.DB);
  await db.delete(challenges).where(eq(challenges.slug, c.req.param('slug'))).run();
  return c.json({ success: true });
});

admin.get('/pending', async (c) => {
  const db = createDb(c.env.DB);
  const result = await db.select({
    id: challenges.id,
    slug: challenges.slug,
    rawText: challenges.rawText,
    answerKeyJson: challenges.answerKeyJson,
    status: challenges.status,
    submittedBy: challenges.submittedBy,
    playCount: challenges.playCount,
    createdAt: challenges.createdAt,
    submitted_by_name: users.nickname,
  })
    .from(challenges)
    .leftJoin(users, eq(challenges.submittedBy, users.id))
    .where(eq(challenges.status, 'pending'))
    .orderBy(desc(challenges.createdAt))
    .all();
  return c.json({ success: true, data: result });
});

admin.put('/challenges/:slug/approve', async (c) => {
  const db = createDb(c.env.DB);
  await db.update(challenges).set({ status: 'published' }).where(eq(challenges.slug, c.req.param('slug'))).run();
  return c.json({ success: true });
});

admin.put('/challenges/:slug/reject', async (c) => {
  const db = createDb(c.env.DB);
  await db.delete(challenges).where(
    and(eq(challenges.slug, c.req.param('slug')), eq(challenges.status, 'pending'))
  ).run();
  return c.json({ success: true });
});

admin.get('/model-results/:slug', async (c) => {
  const db = createDb(c.env.DB);
  const challenge = await db.select({ id: challenges.id })
    .from(challenges)
    .where(eq(challenges.slug, c.req.param('slug')))
    .get();
  if (!challenge) return c.json({ success: false, error: '挑战不存在' }, 404);

  const results = await db.select()
    .from(modelResults)
    .where(eq(modelResults.challengeId, challenge.id))
    .orderBy(desc(modelResults.scoreTotal))
    .all();
  return c.json({ success: true, data: results });
});

admin.post('/model-results', async (c) => {
  const body = await c.req.json<{
    challenge_slug: string; provider: string; model_name: string; segmented_text: string;
  }>();
  if (!body.challenge_slug || !body.provider || !body.model_name || !body.segmented_text) {
    return c.json({ success: false, error: '缺少必填字段' }, 400);
  }
  const db = createDb(c.env.DB);
  const challenge = await db.select({
    id: challenges.id,
    rawText: challenges.rawText,
    answerKeyJson: challenges.answerKeyJson,
  })
    .from(challenges)
    .where(eq(challenges.slug, body.challenge_slug))
    .get();
  if (!challenge) return c.json({ success: false, error: '挑战不存在' }, 404);

  const scores = scoreSubmission(challenge.rawText, body.segmented_text, challenge.answerKeyJson);
  await db.insert(modelResults).values({
    challengeId: challenge.id,
    provider: body.provider,
    modelName: body.model_name,
    segmentedText: body.segmented_text,
    scoreTotal: scores.score_total,
    scoreSegment: scores.score_segment,
    scorePenalty: scores.score_penalty,
  })
    .onConflictDoUpdate({
      target: [modelResults.challengeId, modelResults.provider, modelResults.modelName],
      set: {
        segmentedText: body.segmented_text,
        scoreTotal: scores.score_total,
        scoreSegment: scores.score_segment,
        scorePenalty: scores.score_penalty,
      },
    })
    .run();
  return c.json({ success: true, data: scores });
});

admin.put('/model-results/:id', async (c) => {
  const id = Number(c.req.param('id'));
  const body = await c.req.json<{ segmented_text: string }>();
  if (!body.segmented_text) return c.json({ success: false, error: '缺少断句文本' }, 400);

  const db = createDb(c.env.DB);
  const row = await db.select()
    .from(modelResults)
    .where(eq(modelResults.id, id))
    .get();
  if (!row) return c.json({ success: false, error: '记录不存在' }, 404);

  const challenge = await db.select({
    rawText: challenges.rawText,
    answerKeyJson: challenges.answerKeyJson,
  })
    .from(challenges)
    .where(eq(challenges.id, row.challengeId))
    .get();
  if (!challenge) return c.json({ success: false, error: '挑战不存在' }, 404);

  const scores = scoreSubmission(challenge.rawText, body.segmented_text, challenge.answerKeyJson);
  await db.update(modelResults).set({
    segmentedText: body.segmented_text,
    scoreTotal: scores.score_total,
    scoreSegment: scores.score_segment,
    scorePenalty: scores.score_penalty,
  }).where(eq(modelResults.id, id)).run();
  return c.json({ success: true, data: scores });
});

admin.delete('/model-results/:id', async (c) => {
  const db = createDb(c.env.DB);
  await db.delete(modelResults).where(eq(modelResults.id, Number(c.req.param('id')))).run();
  return c.json({ success: true });
});

admin.post('/daily-challenge', async (c) => {
  const body = await c.req.json<{ challenge_slug: string; date?: string }>();
  const date = body.date || new Date().toISOString().split('T')[0];
  const db = createDb(c.env.DB);
  const challenge = await db.select({ id: challenges.id })
    .from(challenges)
    .where(eq(challenges.slug, body.challenge_slug))
    .get();
  if (!challenge) return c.json({ success: false, error: '挑战不存在' }, 404);
  await db.insert(dailyChallenges).values({
    challengeDate: date,
    challengeId: challenge.id,
  })
    .onConflictDoUpdate({
      target: dailyChallenges.challengeDate,
      set: { challengeId: challenge.id },
    })
    .run();
  return c.json({ success: true });
});

export default admin;
