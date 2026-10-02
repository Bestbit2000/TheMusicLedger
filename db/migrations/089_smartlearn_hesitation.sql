-- ML-399: SmartLearn also brings back the questions you got right but hesitated on.
--
-- theory_question_weights.weight stays the total a round deals by (0-10). miss_weight is the part of it
-- that came from wrong answers; the rest (weight - miss_weight) came from hesitations - right answers
-- well over the player's own usual speed in that round, +1 each, never taking the total above 4.
-- "Your weak spots" lists and asks only questions with miss_weight above 0 (owner, 2026-10-02): a
-- question that is only slow is dealt more often in normal rounds, but isn't a weak spot.
--
-- Everything stored before this came from wrong answers, so miss_weight starts as the weight.

ALTER TABLE theory_question_weights
    ADD COLUMN IF NOT EXISTS miss_weight SMALLINT NOT NULL DEFAULT 0 CHECK (miss_weight BETWEEN 0 AND 10);

UPDATE theory_question_weights SET miss_weight = weight WHERE miss_weight = 0 AND weight > 0;

ALTER TABLE theory_question_weights DROP CONSTRAINT IF EXISTS theory_question_weights_miss_within_weight;
ALTER TABLE theory_question_weights ADD CONSTRAINT theory_question_weights_miss_within_weight CHECK (miss_weight <= weight);
