import { Hono } from 'hono';
import type { Env } from '../types';
import { requireAuth, requireAdmin } from '../middleware/auth';
import { scoreSubmission } from '../services/scoring';

const admin = new Hono<{ Bindings: Env }>();
admin.use('*', requireAuth, requireAdmin);

// List all challenges (including drafts) with model result count
admin.get('/challenges', async (c) => {
  const result = await c.env.DB.prepare(
    `SELECT c.*, COUNT(mr.id) as model_count
     FROM challenges c LEFT JOIN model_results mr ON c.id = mr.challenge_id
     GROUP BY c.id ORDER BY c.created_at DESC`
  ).all();
  return c.json({ success: true, data: result.results });
});

admin.post('/challenges', async (c) => {
  const body = await c.req.json<{ slug: string; raw_text: string; answer_key_json: string; status?: string }>();
  if (!body.slug || !body.raw_text || !body.answer_key_json) {
    return c.json({ success: false, error: '缺少必填字段' }, 400);
  }
  const status = body.status || 'published';
  await c.env.DB.prepare(
    'INSERT INTO challenges (slug, raw_text, answer_key_json, status) VALUES (?, ?, ?, ?)'
  ).bind(body.slug, body.raw_text, body.answer_key_json, status).run();
  return c.json({ success: true, data: { slug: body.slug } });
});

admin.put('/challenges/:slug', async (c) => {
  const slug = c.req.param('slug');
  const body = await c.req.json<{ raw_text?: string; answer_key_json?: string; status?: string }>();
  const sets: string[] = [];
  const vals: unknown[] = [];
  if (body.raw_text !== undefined) { sets.push('raw_text = ?'); vals.push(body.raw_text); }
  if (body.answer_key_json !== undefined) { sets.push('answer_key_json = ?'); vals.push(body.answer_key_json); }
  if (body.status !== undefined) { sets.push('status = ?'); vals.push(body.status); }
  if (sets.length === 0) return c.json({ success: false, error: '没有要更新的字段' }, 400);
  vals.push(slug);
  await c.env.DB.prepare(`UPDATE challenges SET ${sets.join(', ')} WHERE slug = ?`).bind(...vals).run();
  return c.json({ success: true });
});

admin.delete('/challenges/:slug', async (c) => {
  const slug = c.req.param('slug');
  await c.env.DB.prepare('DELETE FROM challenges WHERE slug = ?').bind(slug).run();
  return c.json({ success: true });
});

// Pending challenges (submitted by users for review)
admin.get('/pending', async (c) => {
  const result = await c.env.DB.prepare(
    `SELECT c.*, u.nickname as submitted_by_name
     FROM challenges c LEFT JOIN users u ON c.submitted_by = u.id
     WHERE c.status = 'pending' ORDER BY c.created_at DESC`
  ).all();
  return c.json({ success: true, data: result.results });
});

admin.put('/challenges/:slug/approve', async (c) => {
  const slug = c.req.param('slug');
  await c.env.DB.prepare("UPDATE challenges SET status = 'published' WHERE slug = ?").bind(slug).run();
  return c.json({ success: true });
});

admin.put('/challenges/:slug/reject', async (c) => {
  const slug = c.req.param('slug');
  await c.env.DB.prepare("DELETE FROM challenges WHERE slug = ? AND status = 'pending'").bind(slug).run();
  return c.json({ success: true });
});

// Model results for a specific challenge
admin.get('/model-results/:slug', async (c) => {
  const challenge = await c.env.DB.prepare(
    'SELECT id FROM challenges WHERE slug = ?'
  ).bind(c.req.param('slug')).first<{ id: number }>();
  if (!challenge) return c.json({ success: false, error: '挑战不存在' }, 404);
  const results = await c.env.DB.prepare(
    'SELECT * FROM model_results WHERE challenge_id = ? ORDER BY score_total DESC'
  ).bind(challenge.id).all();
  return c.json({ success: true, data: results.results });
});

admin.post('/model-results', async (c) => {
  const body = await c.req.json<{
    challenge_slug: string; provider: string; model_name: string; segmented_text: string;
  }>();
  if (!body.challenge_slug || !body.provider || !body.model_name || !body.segmented_text) {
    return c.json({ success: false, error: '缺少必填字段' }, 400);
  }
  const challenge = await c.env.DB.prepare(
    'SELECT id, raw_text, answer_key_json FROM challenges WHERE slug = ?'
  ).bind(body.challenge_slug).first<{ id: number; raw_text: string; answer_key_json: string }>();
  if (!challenge) return c.json({ success: false, error: '挑战不存在' }, 404);

  const scores = scoreSubmission(challenge.raw_text, body.segmented_text, challenge.answer_key_json);
  await c.env.DB.prepare(
    `INSERT OR REPLACE INTO model_results
     (challenge_id, provider, model_name, segmented_text, score_total, score_segment, score_penalty)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).bind(challenge.id, body.provider, body.model_name, body.segmented_text,
    scores.score_total, scores.score_segment, scores.score_penalty).run();
  return c.json({ success: true, data: scores });
});

admin.put('/model-results/:id', async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json<{ segmented_text: string }>();
  if (!body.segmented_text) return c.json({ success: false, error: '缺少断句文本' }, 400);

  const row = await c.env.DB.prepare('SELECT * FROM model_results WHERE id = ?').bind(id)
    .first<{ challenge_id: number; provider: string; model_name: string }>();
  if (!row) return c.json({ success: false, error: '记录不存在' }, 404);

  const challenge = await c.env.DB.prepare(
    'SELECT raw_text, answer_key_json FROM challenges WHERE id = ?'
  ).bind(row.challenge_id).first<{ raw_text: string; answer_key_json: string }>();
  if (!challenge) return c.json({ success: false, error: '挑战不存在' }, 404);

  const scores = scoreSubmission(challenge.raw_text, body.segmented_text, challenge.answer_key_json);
  await c.env.DB.prepare(
    `UPDATE model_results SET segmented_text = ?, score_total = ?, score_segment = ?, score_penalty = ? WHERE id = ?`
  ).bind(body.segmented_text, scores.score_total, scores.score_segment, scores.score_penalty, id).run();
  return c.json({ success: true, data: scores });
});

admin.delete('/model-results/:id', async (c) => {
  await c.env.DB.prepare('DELETE FROM model_results WHERE id = ?').bind(c.req.param('id')).run();
  return c.json({ success: true });
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
