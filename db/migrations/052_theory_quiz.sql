-- ML-265 (ML-260 Theory practice): one row per finished quiz round, plus one row per question answered.
--
-- Scores and grades are worked out by the server from right/wrong and the round type (the same
-- public/theoryEngine.js the screen runs - see server/services/theoryPractice.js), never trusted from
-- the client. settings_key identifies "the same options" (quiz + round type + every visible option),
-- which is what history and personal bests are grouped by: a bass-clef round with ledger lines isn't
-- comparable with a treble-only one. options keeps the full choice set for display.
--
-- Theory counts as practice time, but isn't linked to practice sessions yet (agreed on ML-260) -
-- session_segment_id is here, nullable, for when it is, same as scale_practice_logs.

CREATE TABLE theory_quiz_attempts (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    account_id BIGINT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    quiz_id TEXT NOT NULL CHECK (quiz_id IN ('noteNames', 'keySignatures', 'symbolNames', 'symbolMeanings', 'scales')),
    round_type TEXT NOT NULL CHECK (round_type IN ('t30', 't60', 'q10', 'q20')),
    options JSONB NOT NULL,
    settings_key TEXT NOT NULL,
    -- Letters or solfège: shown answers only, doesn't change what's asked, so not part of settings_key.
    naming TEXT NOT NULL DEFAULT 'letters' CHECK (naming IN ('letters', 'solfege')),
    right_count SMALLINT NOT NULL CHECK (right_count >= 0),
    wrong_count SMALLINT NOT NULL CHECK (wrong_count >= 0),
    score SMALLINT NOT NULL CHECK (score BETWEEN 0 AND 100),
    grade SMALLINT NOT NULL CHECK (grade BETWEEN 1 AND 5),
    -- Timed rounds: the round length. Fixed rounds: how long the questions took (its own best).
    duration_ms INTEGER NOT NULL CHECK (duration_ms >= 0),
    started_at TIMESTAMPTZ NOT NULL,
    session_segment_id BIGINT REFERENCES session_segments(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- History/best for one set of options, and the latest round per quiz for the quiz list.
CREATE INDEX idx_theory_attempts_account_settings ON theory_quiz_attempts (account_id, settings_key, started_at DESC);
CREATE INDEX idx_theory_attempts_account_quiz ON theory_quiz_attempts (account_id, quiz_id, started_at DESC);

-- Every answer, in order. Not needed for grades - kept so a later "practise your weakest notes"
-- mode can find what someone gets wrong or slow. question_id is the engine's stable question id
-- (e.g. 'treble:F#5', 'bass:D major', 'fermata').
CREATE TABLE theory_quiz_answers (
    attempt_id BIGINT NOT NULL REFERENCES theory_quiz_attempts(id) ON DELETE CASCADE,
    seq SMALLINT NOT NULL CHECK (seq >= 1),
    question_id TEXT NOT NULL CHECK (length(question_id) <= 80),
    answer_id TEXT NOT NULL CHECK (length(answer_id) <= 40),
    correct BOOLEAN NOT NULL,
    ms INTEGER NOT NULL CHECK (ms >= 0),
    PRIMARY KEY (attempt_id, seq)
);

INSERT INTO features (feature_key, name, description, enabled) VALUES
    ('theory_practice', 'Theory practice', 'Home screen Theory tool (ML-260): timed quizzes on note names, key signatures, symbols and scales, with grades and personal bests. Notation drawn in the Bravura font (ML-262).', true)
ON CONFLICT (feature_key) DO NOTHING;
