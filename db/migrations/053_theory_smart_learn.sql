-- ML-269 Theory smart learn: a per-person, per-question weight from 0 (known) to 10 (keeps getting it
-- wrong). Wrong +2, right -1, never outside 0-10 - applied by the server, in order, to every answer of
-- every finished round while the theory_smart_learn feature is on. The quiz engine
-- (public/theoryEngine.js, SMART / smartOrder) uses the weights to deal weak questions first.
--
-- Only rows above 0 matter; a weight that falls back to 0 is kept (with its counts) rather than
-- deleted, so "questions you've mastered" can be shown later. question_id is the engine's question id
-- (e.g. 'note:treble:F#5', 'scale:bass:A minor:harmonic', 'symbolMeaning:fermata') - the same id is the
-- same question whichever quiz or options asked it, so Mixed and the single quizzes share what's learned.
--
-- Gated by the theory_smart_learn feature (seeded ON here). It's intended for the paid tier once plans
-- exist; features.enabled is global today (no per-plan gating yet - see 047), and this is where that
-- check will go. With it off, rounds are a plain shuffle and nothing is recorded.

CREATE TABLE theory_question_weights (
    account_id BIGINT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    question_id TEXT NOT NULL CHECK (length(question_id) <= 80),
    weight SMALLINT NOT NULL DEFAULT 0 CHECK (weight BETWEEN 0 AND 10),
    wrong_count INTEGER NOT NULL DEFAULT 0 CHECK (wrong_count >= 0),
    right_count INTEGER NOT NULL DEFAULT 0 CHECK (right_count >= 0),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (account_id, question_id)
);

-- What a round start loads: this account's questions still being learned.
CREATE INDEX idx_theory_weights_active ON theory_question_weights (account_id) WHERE weight > 0;

INSERT INTO features (feature_key, name, description, enabled) VALUES
    ('theory_smart_learn', 'Theory smart learn', 'Theory practice (ML-269): remembers the questions each person gets wrong and deals those first and more often, until they get them right twice for every miss. Off = a plain shuffle with no memory. Intended for the paid tier.', true)
ON CONFLICT (feature_key) DO NOTHING;

-- "Your weak spots" rounds (a round of only the questions with a weight) are saved like any other quiz.
ALTER TABLE theory_quiz_attempts DROP CONSTRAINT theory_quiz_attempts_quiz_id_check;
ALTER TABLE theory_quiz_attempts ADD CONSTRAINT theory_quiz_attempts_quiz_id_check
    CHECK (quiz_id IN ('noteNames', 'keys', 'symbols', 'mixed', 'weakSpots'));
