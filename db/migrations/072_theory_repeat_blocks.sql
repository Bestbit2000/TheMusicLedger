-- ML-354: a Theory test is one fixed-length block - 30 s or 10 questions - done 1 to 5 times. Each
-- time is scored as a round on its own, and the best one is the result, so a score never depends on
-- how long the test was. The 60 s and 20-question rounds are gone.
--
-- Everyone starts fresh (owner's decision on ML-354, 2026-09-29): every saved Theory round and its
-- answers are deleted, since the old 60 s / 20-question scores aren't comparable with the new blocks.
-- Smart learn's per-question weights (theory_question_weights) are learning, not scores - they stay.

DELETE FROM theory_quiz_attempts; -- theory_quiz_answers go with them (ON DELETE CASCADE)

ALTER TABLE theory_quiz_attempts DROP CONSTRAINT theory_quiz_attempts_round_type_check;
ALTER TABLE theory_quiz_attempts ADD CONSTRAINT theory_quiz_attempts_round_type_check CHECK (round_type IN ('t30', 'q10'));

-- How many times the block was done, and each time's score in order. score/grade/right_count/
-- wrong_count/duration_ms are the best block's (settings_key doesn't include repeats, so a x1 and a
-- x3 test with the same options share one history and one personal best).
ALTER TABLE theory_quiz_attempts ADD COLUMN repeats SMALLINT NOT NULL DEFAULT 1 CHECK (repeats BETWEEN 1 AND 5);
ALTER TABLE theory_quiz_attempts ADD COLUMN block_scores SMALLINT[] NOT NULL DEFAULT '{}';

-- Which time (1..repeats) each answer was given in.
ALTER TABLE theory_quiz_answers ADD COLUMN block SMALLINT NOT NULL DEFAULT 1 CHECK (block BETWEEN 1 AND 5);
