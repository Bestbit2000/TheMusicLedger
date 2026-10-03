-- ML-406: Pitch, Tempo, Pulse and Rhythm are no longer tiles of their own - they open from one Skills
-- tool (All tools > Learn). Anyone with one of them on their Home screen gets Skills there instead, in
-- the place of the first of them (accounts.home_tools keeps its order; no duplicates).
UPDATE accounts a
SET home_tools = (
    SELECT array_agg(tool ORDER BY first_pos)
    FROM (
        SELECT CASE WHEN t IN ('pitch', 'tempo', 'pulse', 'rhythm') THEN 'skills' ELSE t END AS tool, MIN(ord) AS first_pos
        FROM unnest(a.home_tools) WITH ORDINALITY AS u(t, ord)
        GROUP BY 1
    ) x
)
WHERE a.home_tools && ARRAY['pitch', 'tempo', 'pulse', 'rhythm'];
