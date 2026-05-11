INSERT OR IGNORE INTO challenges (slug, raw_text, standard_answer, answer_key_json, difficulty, status, published_at) VALUES
('a3f7c2d1', '大英警察进比利时等妲己把茶倒杯里', '大英警|察进比利时|等妲己把|茶倒杯里', '{"positions":[3,9,13]}', 1, 'published', datetime('now'));

INSERT OR IGNORE INTO daily_challenges (challenge_date, challenge_id)
VALUES (date('now'), (SELECT id FROM challenges WHERE slug = 'a3f7c2d1'));
