PRAGMA foreign_keys = ON;

-- ====== 用户 ======
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    public_id TEXT NOT NULL UNIQUE,
    nickname TEXT NOT NULL,
    avatar_url TEXT,
    total_score INTEGER NOT NULL DEFAULT 0 CHECK (total_score >= 0),
    role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS oauth_accounts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    provider TEXT NOT NULL CHECK (provider IN ('github', 'google')),
    provider_user_id TEXT NOT NULL,
    provider_email TEXT,
    provider_login TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    last_login_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(provider, provider_user_id),
    UNIQUE(user_id, provider),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS auth_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    refresh_token_hash TEXT NOT NULL UNIQUE,
    expires_at TEXT NOT NULL,
    revoked_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    last_seen_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- ====== 题目 ======
-- standard_answer = insert_separators(raw_text, answer_key_json.positions) 可推导不存
-- slug = hex(sha256(raw_text))[:8]
CREATE TABLE IF NOT EXISTS challenges (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    slug TEXT NOT NULL UNIQUE,
    raw_text TEXT NOT NULL,
    answer_key_json TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'published' CHECK (status IN ('draft', 'published', 'archived')),
    play_count INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS daily_challenges (
    challenge_date TEXT PRIMARY KEY,
    challenge_id INTEGER NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (challenge_id) REFERENCES challenges(id)
);

-- ====== 人类提交 ======
CREATE TABLE IF NOT EXISTS submissions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    public_id TEXT NOT NULL UNIQUE,
    user_id INTEGER NOT NULL,
    challenge_id INTEGER NOT NULL,
    segmented_text TEXT NOT NULL,
    score_total INTEGER NOT NULL CHECK (score_total BETWEEN 0 AND 1000),
    score_segment INTEGER NOT NULL,
    score_penalty INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (challenge_id) REFERENCES challenges(id)
);

CREATE TABLE IF NOT EXISTS user_challenge_progress (
    user_id INTEGER NOT NULL,
    challenge_id INTEGER NOT NULL,
    best_submission_id INTEGER,
    best_score INTEGER NOT NULL CHECK (best_score BETWEEN 0 AND 1000),
    attempts INTEGER NOT NULL DEFAULT 1 CHECK (attempts >= 1),
    last_submitted_at TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (user_id, challenge_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (challenge_id) REFERENCES challenges(id)
);

-- ====== LLM 结果 (独立于人类) ======
CREATE TABLE IF NOT EXISTS model_results (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    challenge_id INTEGER NOT NULL,
    provider TEXT NOT NULL,
    model_name TEXT NOT NULL,
    segmented_text TEXT NOT NULL,
    score_total INTEGER NOT NULL CHECK (score_total BETWEEN 0 AND 1000),
    score_segment INTEGER NOT NULL,
    score_penalty INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(challenge_id, provider, model_name),
    FOREIGN KEY (challenge_id) REFERENCES challenges(id) ON DELETE CASCADE
);

-- ====== 索引 ======
CREATE INDEX IF NOT EXISTS idx_users_score ON users(total_score DESC);
CREATE INDEX IF NOT EXISTS idx_sessions_user_expires ON auth_sessions(user_id, expires_at);
CREATE INDEX IF NOT EXISTS idx_sessions_token ON auth_sessions(refresh_token_hash);
CREATE INDEX IF NOT EXISTS idx_challenges_status ON challenges(status);
CREATE INDEX IF NOT EXISTS idx_challenges_created ON challenges(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_submissions_user ON submissions(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_submissions_challenge ON submissions(challenge_id, score_total DESC);
CREATE INDEX IF NOT EXISTS idx_submissions_score ON submissions(score_total DESC);
CREATE INDEX IF NOT EXISTS idx_progress_user ON user_challenge_progress(user_id);
CREATE INDEX IF NOT EXISTS idx_progress_challenge ON user_challenge_progress(challenge_id, best_score DESC);
CREATE INDEX IF NOT EXISTS idx_model_results_challenge ON model_results(challenge_id);
CREATE INDEX IF NOT EXISTS idx_model_results_score ON model_results(score_total DESC);
CREATE INDEX IF NOT EXISTS idx_daily_date ON daily_challenges(challenge_date);
