import type { users, challenges, submissions, userChallengeProgress, modelResults } from './db/schema';

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Challenge = typeof challenges.$inferSelect;
export type Submission = typeof submissions.$inferSelect;
export type UserChallengeProgress = typeof userChallengeProgress.$inferSelect;
export type ModelResult = typeof modelResults.$inferSelect;

export interface AnswerKey {
  positions: number[];
}

export interface LeaderboardEntry {
  rank: number;
  user_id: string;
  nickname: string;
  avatar_url: string | null;
  score: number;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface JwtPayload {
  sub: string;
  sid: string;
  role: 'user' | 'admin';
  iat: number;
  exp: number;
}

export interface Env {
  DB: D1Database;
  KV: KVNamespace;
  JWT_SECRET: string;
  GITHUB_CLIENT_ID: string;
  GITHUB_CLIENT_SECRET: string;
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
  TURNSTILE_SECRET_KEY: string;
  ADMIN_API_KEY: string;
  CORS_ORIGIN: string;
  ENVIRONMENT: string;
}

export type AppType = {
  Bindings: Env;
  Variables: {
    userId: string | null;
    userRole: 'user' | 'admin' | undefined;
  };
};
