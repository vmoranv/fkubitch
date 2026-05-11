export interface User {
  id: number;
  public_id: string;
  nickname: string;
  avatar_url: string | null;
  total_score: number;
  role: 'user' | 'admin';
  created_at: string;
  updated_at: string;
}

export interface AnswerKeySegment {
  pos: number;
}

export interface AnswerKey {
  positions: number[];
}

export interface Challenge {
  id: number;
  slug: string;
  raw_text: string;
  standard_answer: string;
  answer_key_json: string;
  difficulty: number;
  status: 'draft' | 'published' | 'archived';
  play_count: number;
  created_at: string;
  published_at: string;
  tags?: string[];
}

export interface Submission {
  id: number;
  public_id: string;
  user_id: number;
  challenge_id: number;
  segmented_text: string;
  normalized_text: string;
  score_total: number;
  score_edit: number;
  score_punctuation: number;
  scoring_version: string;
  created_at: string;
  user_nickname?: string;
}

export interface UserChallengeProgress {
  user_id: number;
  challenge_id: number;
  best_submission_id: number;
  best_score: number;
  attempts: number;
  first_submitted_at: string;
  last_submitted_at: string;
}

export interface ModelResult {
  id: number;
  challenge_id: number;
  provider: string;
  model_name: string;
  segmented_text: string;
  normalized_text: string;
  score_total: number;
  score_edit: number;
  score_punctuation: number;
  created_at: string;
}

export interface LeaderboardEntry {
  rank: number;
  user_id: string;
  nickname: string;
  avatar_url: string | null;
  total_score: number;
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
