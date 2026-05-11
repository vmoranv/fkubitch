import { Hono } from 'hono';
import type { Env } from '../types';
import { generateId } from '../utils';
import { scoreSubmission } from '../services/scoring';
import { requireAuth } from '../middleware/auth';
import { turnstileVerify } from '../middleware/turnstile';

const challenges = new Hono<{ Bindings: Env }>();

challenges.get('/', async (c) => {
  const page = parseInt(c.req.query('page') || '1');
  const limit = Math.min(parseInt(c.req.query('limit') || '20'), 50);
  const difficulty = c.req.query('difficulty');
  const offset = (page - 1) * limit;

  let query = 'SELECT c.* FROM challenges c WHERE c.status = ?';
  const params: unknown[] = ['published'];

  if (difficulty) {
    query += ' AND c.difficulty = ?';
    params.push(parseInt(difficulty));
  }

  query += ' ORDER BY c.play_count DESC, c.created_at DESC LIMIT ? OFFSET ?';
  params.push(limit, offset);

  const result = await c.env.DB.prepare(query).bind(...params).all();
  const items = result.results.map((row: Record<string, unknown>) => ({
    ...row,
    raw_text: (row.raw_text as string).length > 30
      ? (row.raw_text as string).slice(0, 30) + '…'
      : row.raw_text,
  }));

  const countQuery = 'SELECT COUNT(*) as total FROM challenges WHERE status = ?' + (difficulty ? ' AND difficulty = ?' : '');
  const countParams: unknown[] = ['published'];
  if (difficulty) countParams.push(parseInt(difficulty));
  const countResult = await c.env.DB.prepare(countQuery).bind(...countParams).first<{ total: number }>();

  return c.json({ success: true, data: { items, total: countResult?.total || 0, page, limit } });
});

challenges.get('/daily', async (c) => {
  const today = new Date().toISOString().split('T')[0];
  const daily = await c.env.DB.prepare(
    'SELECT c.* FROM challenges c JOIN daily_challenges dc ON c.id = dc.challenge_id WHERE dc.challenge_date = ?'
  ).bind(today).first();
  if (daily) return c.json({ success: true, data: daily });

  const fallback = await c.env.DB.prepare(
    'SELECT * FROM challenges WHERE status = ? ORDER BY RANDOM() LIMIT 1'
  ).bind('published').first();
  if (fallback) {
    await c.env.DB.prepare(
      'INSERT OR IGNORE INTO daily_challenges (challenge_date, challenge_id) VALUES (?, ?)'
    ).bind(today, (fallback as Record<string, unknown>).id).run();
  }
  return c.json({ success: true, data: fallback });
});

challenges.get('/:slug', async (c) => {
  const challenge = await c.env.DB.prepare(
    'SELECT * FROM challenges WHERE slug = ? AND status = ?'
  ).bind(c.req.param('slug'), 'published').first();
  if (!challenge) return c.json({ success: false, error: '挑战不存在' }, 404);
  return c.json({ success: true, data: challenge });
});

challenges.get('/:slug/submissions', async (c) => {
  const challenge = await c.env.DB.prepare(
    'SELECT id FROM challenges WHERE slug = ?'
  ).bind(c.req.param('slug')).first<{ id: number }>();
  if (!challenge) return c.json({ success: false, error: '挑战不存在' }, 404);

  const limit = Math.min(parseInt(c.req.query('limit') || '10'), 20);
  const submissions = await c.env.DB.prepare(
    `SELECT s.*, u.nickname as user_nickname FROM submissions s
     JOIN users u ON s.user_id = u.id
     WHERE s.challenge_id = ? ORDER BY s.score_total DESC LIMIT ?`
  ).bind(challenge.id, limit).all();
  return c.json({ success: true, data: submissions.results });
});

challenges.post('/:slug/submit', requireAuth, turnstileVerify, async (c) => {
  const slug = c.req.param('slug');
  const userId = c.get('userId');
  const body = await c.json<{ segmented_text: string }>();
  if (!body.segmented_text) return c.json({ success: false, error: '请提供断句结果' }, 400);

  const challenge = await c.env.DB.prepare(
    'SELECT * FROM challenges WHERE slug = ? AND status = ?'
  ).bind(slug, 'published').first<{ id: number; raw_text: string; answer_key_json: string }>();
  if (!challenge) return c.json({ success: false, error: '挑战不存在' }, 404);

  const user = await c.env.DB.prepare('SELECT id FROM users WHERE public_id = ?').bind(userId).first<{ id: number }>();
  if (!user) return c.json({ success: false, error: '用户不存在' }, 401);

  const scores = scoreSubmission(challenge.raw_text, body.segmented_text, challenge.answer_key_json);
  const normalizedText = body.segmented_text.replace(/\s+/g, '');

  const existingSame = await c.env.DB.prepare(
    'SELECT id FROM submissions WHERE user_id = ? AND challenge_id = ? AND normalized_text = ? LIMIT 1'
  ).bind(user.id, challenge.id, normalizedText).first();
  if (existingSame) return c.json({ success: false, error: '已经提交过相同答案' }, 409);

  const submissionId = generateId('sub');
  const result = await c.env.DB.prepare(
    `INSERT INTO submissions (public_id, user_id, challenge_id, segmented_text, normalized_text,
     score_total, score_edit, score_punctuation, scoring_version)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'v2')`
  ).bind(submissionId, user.id, challenge.id, body.segmented_text, normalizedText,
    scores.score_total, scores.score_segment, 1000 - scores.score_penalty).run();

  const progress = await c.env.DB.prepare(
    'SELECT * FROM user_challenge_progress WHERE user_id = ? AND challenge_id = ?'
  ).bind(user.id, challenge.id).first<{ best_score: number; attempts: number }>();

  if (progress) {
    const newAttempts = progress.attempts + 1;
    if (scores.score_total > progress.best_score) {
      const scoreDiff = scores.score_total - progress.best_score;
      await c.env.DB.prepare(
        'UPDATE user_challenge_progress SET best_submission_id = ?, best_score = ?, attempts = ?, last_submitted_at = datetime(\'now\') WHERE user_id = ? AND challenge_id = ?'
      ).bind(result.meta?.last_row_id, scores.score_total, newAttempts, user.id, challenge.id).run();
      await c.env.DB.prepare('UPDATE users SET total_score = total_score + ?, updated_at = datetime("now") WHERE id = ?').bind(scoreDiff, user.id).run();
    } else {
      await c.env.DB.prepare(
        'UPDATE user_challenge_progress SET attempts = ?, last_submitted_at = datetime(\'now\') WHERE user_id = ? AND challenge_id = ?'
      ).bind(newAttempts, user.id, challenge.id).run();
    }
  } else {
    await c.env.DB.prepare(
      'INSERT INTO user_challenge_progress (user_id, challenge_id, best_submission_id, best_score, attempts) VALUES (?, ?, ?, ?, 1)'
    ).bind(user.id, challenge.id, result.meta?.last_row_id, scores.score_total).run();
    await c.env.DB.prepare('UPDATE users SET total_score = total_score + ?, updated_at = datetime("now") WHERE id = ?').bind(scores.score_total, user.id).run();
  }

  await c.env.DB.prepare('UPDATE challenges SET play_count = play_count + 1 WHERE id = ?').bind(challenge.id).run();

  const updatedUser = await c.env.DB.prepare('SELECT total_score FROM users WHERE id = ?').bind(user.id).first<{ total_score: number }>();
  const rankResult = await c.env.DB.prepare('SELECT COUNT(*) + 1 as rank FROM users WHERE total_score > ?').bind(updatedUser?.total_score || 0).first<{ rank: number }>();

  return c.json({ success: true, data: { submission_id: submissionId, ...scores, total_score: updatedUser?.total_score, rank: rankResult?.rank } });
});

export default challenges;
