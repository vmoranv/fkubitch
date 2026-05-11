import { Hono } from 'hono';
import type { Env } from '../types';
import { requireAuth, requireAdmin } from '../middleware/auth';
import { scoreSubmission } from '../services/scoring';

const admin = new Hono<{ Bindings: Env }>();

admin.use('*', requireAuth, requireAdmin);

admin.post('/challenges', async (c) => {
  const body = await c.req.json<{
    slug: string; raw_text: string; standard_answer: string; answer_key_json: string;
  }>();
  if (!body.slug || !body.raw_text || !body.standard_answer || !body.answer_key_json) {
    return c.json({ success: false, error: '缺少必填字段' }, 400);
  }
  await c.env.DB.prepare(
    'INSERT INTO challenges (slug, raw_text, standard_answer, answer_key_json, status) VALUES (?, ?, ?, ?, \'published\')'
  ).bind(body.slug, body.raw_text, body.standard_answer, body.answer_key_json).run();
  return c.json({ success: true, data: { slug: body.slug } });
});

admin.post('/model-results', async (c) => {
  const body = await c.req.json<{
    challenge_slug: string; provider: string; model_name: string;
    segmented_text: string; prompt_version?: string;
  }>();
  const challenge = await c.env.DB.prepare(
    'SELECT id, raw_text, answer_key_json FROM challenges WHERE slug = ?'
  ).bind(body.challenge_slug).first<{ id: number; raw_text: string; answer_key_json: string }>();
  if (!challenge) return c.json({ success: false, error: '挑战不存在' }, 404);

  const scores = scoreSubmission(challenge.raw_text, body.segmented_text, challenge.answer_key_json);
  await c.env.DB.prepare(
    `INSERT OR REPLACE INTO model_results
     (challenge_id, provider, model_name, prompt_version, segmented_text, normalized_text,
      score_total, score_edit, score_punctuation, scoring_version)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'v2')`
  ).bind(challenge.id, body.provider, body.model_name, body.prompt_version || 'v1',
    body.segmented_text, body.segmented_text.replace(/\s+/g, ''),
    scores.score_total, scores.score_segment, 1000 - scores.score_penalty).run();
  return c.json({ success: true, data: scores });
});

admin.post('/daily-challenge', async (c) => {
  const body = await c.req.json<{ challenge_slug: string; date?: string }>();
  const date = body.date || new Date().toISOString().split('T')[0];
  const challenge = await c.env.DB.prepare('SELECT id FROM challenges WHERE slug = ?').bind(body.challenge_slug).first<{ id: number }>();
  if (!challenge) return c.json({ success: false, error: '挑战不存在' }, 404);
  await c.env.DB.prepare('INSERT OR REPLACE INTO daily_challenges (challenge_date, challenge_id) VALUES (?, ?)').bind(date, challenge.id).run();
  return c.json({ success: true });
});

export default admin;
