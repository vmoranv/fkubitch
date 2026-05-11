INSERT OR IGNORE INTO challenges (slug, raw_text, answer_key_json, status)
VALUES ('a3f7c2d1', '大英警察进比利时等妲己把茶倒杯里', '{"positions":[3,8,12]}', 'published');

INSERT OR IGNORE INTO daily_challenges (challenge_date, challenge_id)
VALUES (date('now'), (SELECT id FROM challenges WHERE slug = 'a3f7c2d1'));
