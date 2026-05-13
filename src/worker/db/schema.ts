import { sqliteTable, text, integer, unique, index, check, primaryKey } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

// ====== 用户 ======
export const users = sqliteTable('users', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  public_id: text('public_id').notNull().unique(),
  nickname: text('nickname').notNull(),
  avatar_url: text('avatar_url'),
  total_score: integer('total_score').notNull().default(0),
  role: text('role', { enum: ['user', 'admin'] }).notNull().default('user'),
  created_at: text('created_at').notNull().default(sql`(datetime('now'))`),
  updated_at: text('updated_at').notNull().default(sql`(datetime('now'))`),
}, (t) => [
  check('total_score_non_negative', sql`${t.total_score} >= 0`),
  index('idx_users_score').on(t.total_score),
]);

export const oauthAccounts = sqliteTable('oauth_accounts', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  user_id: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  provider: text('provider', { enum: ['github', 'google'] }).notNull(),
  provider_user_id: text('provider_user_id').notNull(),
  provider_email: text('provider_email'),
  provider_login: text('provider_login'),
  created_at: text('created_at').notNull().default(sql`(datetime('now'))`),
  last_login_at: text('last_login_at').notNull().default(sql`(datetime('now'))`),
}, (t) => [
  unique('oauth_provider_user').on(t.provider, t.provider_user_id),
  unique('oauth_user_provider').on(t.user_id, t.provider),
]);

export const authSessions = sqliteTable('auth_sessions', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  user_id: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  refresh_token_hash: text('refresh_token_hash').notNull().unique(),
  expires_at: text('expires_at').notNull(),
  revoked_at: text('revoked_at'),
  created_at: text('created_at').notNull().default(sql`(datetime('now'))`),
  last_seen_at: text('last_seen_at').notNull().default(sql`(datetime('now'))`),
}, (t) => [
  index('idx_sessions_user_expires').on(t.user_id, t.expires_at),
  index('idx_sessions_token').on(t.refresh_token_hash),
]);

// ====== 题目 ======
export const challenges = sqliteTable('challenges', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  slug: text('slug').notNull().unique(),
  raw_text: text('raw_text').notNull(),
  answer_key_json: text('answer_key_json').notNull(),
  status: text('status', { enum: ['draft', 'published', 'archived', 'pending'] }).notNull().default('published'),
  submitted_by: integer('submitted_by').references(() => users.id),
  play_count: integer('play_count').notNull().default(0),
  created_at: text('created_at').notNull().default(sql`(datetime('now'))`),
}, (t) => [
  index('idx_challenges_status').on(t.status),
  index('idx_challenges_created').on(t.created_at),
]);

export const dailyChallenges = sqliteTable('daily_challenges', {
  challenge_date: text('challenge_date').primaryKey(),
  challenge_id: integer('challenge_id').notNull().references(() => challenges.id),
  created_at: text('created_at').notNull().default(sql`(datetime('now'))`),
}, (t) => [
  index('idx_daily_date').on(t.challenge_date),
]);

// ====== 人类提交 ======
export const submissions = sqliteTable('submissions', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  public_id: text('public_id').notNull().unique(),
  user_id: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  challenge_id: integer('challenge_id').notNull().references(() => challenges.id),
  segmented_text: text('segmented_text').notNull(),
  score_total: integer('score_total').notNull(),
  score_segment: integer('score_segment').notNull(),
  score_penalty: integer('score_penalty').notNull().default(0),
  created_at: text('created_at').notNull().default(sql`(datetime('now'))`),
}, (t) => [
  check('sub_score_range', sql`${t.score_total} BETWEEN 0 AND 1000`),
  index('idx_submissions_user').on(t.user_id, t.created_at),
  index('idx_submissions_challenge').on(t.challenge_id, t.score_total),
  index('idx_submissions_score').on(t.score_total),
]);

export const userChallengeProgress = sqliteTable('user_challenge_progress', {
  user_id: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  challenge_id: integer('challenge_id').notNull().references(() => challenges.id),
  best_submission_id: integer('best_submission_id'),
  best_score: integer('best_score'),
  attempts: integer('attempts').notNull().default(1),
  last_submitted_at: text('last_submitted_at').notNull().default(sql`(datetime('now'))`),
}, (t) => [
  primaryKey({ columns: [t.user_id, t.challenge_id] }),
  check('progress_score_range', sql`${t.best_score} BETWEEN 0 AND 1000`),
  check('progress_attempts_min', sql`${t.attempts} >= 1`),
  index('idx_progress_user').on(t.user_id),
  index('idx_progress_challenge').on(t.challenge_id, t.best_score),
]);

// ====== LLM 结果 ======
export const modelResults = sqliteTable('model_results', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  challenge_id: integer('challenge_id').notNull().references(() => challenges.id, { onDelete: 'cascade' }),
  provider: text('provider').notNull(),
  model_name: text('model_name').notNull(),
  segmented_text: text('segmented_text').notNull(),
  score_total: integer('score_total').notNull(),
  score_segment: integer('score_segment').notNull(),
  score_penalty: integer('score_penalty').notNull().default(0),
  created_at: text('created_at').notNull().default(sql`(datetime('now'))`),
}, (t) => [
  check('model_score_range', sql`${t.score_total} BETWEEN 0 AND 1000`),
  unique('model_result_unique').on(t.challenge_id, t.provider, t.model_name),
  index('idx_model_results_challenge').on(t.challenge_id),
  index('idx_model_results_score').on(t.score_total),
]);
