import { sqliteTable, text, integer, unique, index, check, primaryKey } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

// ====== 用户 ======
export const users = sqliteTable('users', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  publicId: text('public_id').notNull().unique(),
  nickname: text('nickname').notNull(),
  avatarUrl: text('avatar_url'),
  totalScore: integer('total_score').notNull().default(0),
  role: text('role', { enum: ['user', 'admin'] }).notNull().default('user'),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
  updatedAt: text('updated_at').notNull().default(sql`(datetime('now'))`),
}, (t) => [
  check('total_score_non_negative', sql`${t.totalScore} >= 0`),
  index('idx_users_score').on(t.totalScore),
]);

export const oauthAccounts = sqliteTable('oauth_accounts', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  provider: text('provider', { enum: ['github', 'google'] }).notNull(),
  providerUserId: text('provider_user_id').notNull(),
  providerEmail: text('provider_email'),
  providerLogin: text('provider_login'),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
  lastLoginAt: text('last_login_at').notNull().default(sql`(datetime('now'))`),
}, (t) => [
  unique('oauth_provider_user').on(t.provider, t.providerUserId),
  unique('oauth_user_provider').on(t.userId, t.provider),
]);

export const authSessions = sqliteTable('auth_sessions', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  refreshTokenHash: text('refresh_token_hash').notNull().unique(),
  expiresAt: text('expires_at').notNull(),
  revokedAt: text('revoked_at'),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
  lastSeenAt: text('last_seen_at').notNull().default(sql`(datetime('now'))`),
}, (t) => [
  index('idx_sessions_user_expires').on(t.userId, t.expiresAt),
  index('idx_sessions_token').on(t.refreshTokenHash),
]);

// ====== 题目 ======
export const challenges = sqliteTable('challenges', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  slug: text('slug').notNull().unique(),
  rawText: text('raw_text').notNull(),
  answerKeyJson: text('answer_key_json').notNull(),
  status: text('status', { enum: ['draft', 'published', 'archived', 'pending'] }).notNull().default('published'),
  submittedBy: integer('submitted_by').references(() => users.id),
  playCount: integer('play_count').notNull().default(0),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
}, (t) => [
  index('idx_challenges_status').on(t.status),
  index('idx_challenges_created').on(t.createdAt),
]);

export const dailyChallenges = sqliteTable('daily_challenges', {
  challengeDate: text('challenge_date').primaryKey(),
  challengeId: integer('challenge_id').notNull().references(() => challenges.id),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
}, (t) => [
  index('idx_daily_date').on(t.challengeDate),
]);

// ====== 人类提交 ======
export const submissions = sqliteTable('submissions', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  publicId: text('public_id').notNull().unique(),
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  challengeId: integer('challenge_id').notNull().references(() => challenges.id),
  segmentedText: text('segmented_text').notNull(),
  scoreTotal: integer('score_total').notNull(),
  scoreSegment: integer('score_segment').notNull(),
  scorePenalty: integer('score_penalty').notNull().default(0),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
}, (t) => [
  check('sub_score_range', sql`${t.scoreTotal} BETWEEN 0 AND 1000`),
  index('idx_submissions_user').on(t.userId, t.createdAt),
  index('idx_submissions_challenge').on(t.challengeId, t.scoreTotal),
  index('idx_submissions_score').on(t.scoreTotal),
]);

export const userChallengeProgress = sqliteTable('user_challenge_progress', {
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  challengeId: integer('challenge_id').notNull().references(() => challenges.id),
  bestSubmissionId: integer('best_submission_id'),
  bestScore: integer('best_score'),
  attempts: integer('attempts').notNull().default(1),
  lastSubmittedAt: text('last_submitted_at').notNull().default(sql`(datetime('now'))`),
}, (t) => [
  primaryKey({ columns: [t.userId, t.challengeId] }),
  check('progress_score_range', sql`${t.bestScore} BETWEEN 0 AND 1000`),
  check('progress_attempts_min', sql`${t.attempts} >= 1`),
  index('idx_progress_user').on(t.userId),
  index('idx_progress_challenge').on(t.challengeId, t.bestScore),
]);

// ====== LLM 结果 ======
export const modelResults = sqliteTable('model_results', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  challengeId: integer('challenge_id').notNull().references(() => challenges.id, { onDelete: 'cascade' }),
  provider: text('provider').notNull(),
  modelName: text('model_name').notNull(),
  segmentedText: text('segmented_text').notNull(),
  scoreTotal: integer('score_total').notNull(),
  scoreSegment: integer('score_segment').notNull(),
  scorePenalty: integer('score_penalty').notNull().default(0),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
}, (t) => [
  check('model_score_range', sql`${t.scoreTotal} BETWEEN 0 AND 1000`),
  unique('model_result_unique').on(t.challengeId, t.provider, t.modelName),
  index('idx_model_results_challenge').on(t.challengeId),
  index('idx_model_results_score').on(t.scoreTotal),
]);
