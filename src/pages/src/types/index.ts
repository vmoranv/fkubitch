export interface User {
  public_id: string;
  nickname: string;
  avatar_url: string | null;
  total_score: number;
  role: 'user' | 'admin';
  created_at: string;
  solved_count?: number;
  rank?: number;
}

export interface Challenge {
  id: number;
  slug: string;
  raw_text: string;
  standard_answer: string;
  difficulty: number;
  status: string;
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
  score_total: number;
  score_edit: number;
  score_punctuation: number;
  created_at: string;
  user_nickname?: string;
}

export interface ModelResult {
  id: number;
  provider: string;
  model_name: string;
  segmented_text: string;
  score_total: number;
  score_edit: number;
  score_punctuation: number;
  created_at: string;
}

export interface ScoreData {
  score_total: number;
  score_edit: number;
  score_punctuation: number;
  segmented_text: string;
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

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
}
