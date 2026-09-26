-- ML-298 / ML-295 / ML-296: the three drill tools - Tap tempo, Gap trainer and Ear. One table for all
-- three: each finished round, its level, and the raw details it was scored from (the taps, or the notes
-- and answers). The server re-scores every round from those details with the same engine the app runs
-- (public/drills.js), so a stored score always follows the rules whatever the app sent. History and
-- personal bests come from here, per tool and level, like Theory's rounds (052_theory_quiz.sql).
CREATE TABLE drill_attempts (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    account_id BIGINT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    tool TEXT NOT NULL CHECK (tool IN ('tapTempo', 'gapTrainer', 'ear')),
    -- tapTempo: listen | guide | solo | names; gapTrainer: a pattern id; ear: mode:level (reference:triad)
    level TEXT NOT NULL CHECK (length(level) BETWEEN 1 AND 60),
    score SMALLINT NOT NULL CHECK (score BETWEEN 0 AND 100),
    grade SMALLINT NOT NULL CHECK (grade BETWEEN 1 AND 5),
    details JSONB NOT NULL,
    duration_ms INTEGER CHECK (duration_ms >= 0),
    started_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_drill_attempts_level ON drill_attempts (account_id, tool, level, started_at DESC);

INSERT INTO features (feature_key, name, description, enabled) VALUES
    ('tap_tempo', 'Tempo', 'Home screen Tempo tool (Tap tempo in the code) (ML-298): tap a given speed (a metronome mark, or an Italian speed name) on a pad; levels from hearing it first with a faster/slower meter to the number or name with no help. Scored and saved like Theory.', true),
    ('gap_trainer', 'Pulse', 'Home screen Pulse tool (Gap trainer in the code) (ML-295): the click goes silent (whole bars, beats 2 and 4, everything but the offbeats, or random bars) and you tap the beat through it; scored on how close you stayed, with early/late drift. Saved like Theory.', true),
    ('ear_training', 'Pitch', 'Home screen Pitch tool (Ear in the code) (ML-296): name a note after a home note, on its own, or play/sing it back into the mic. Notes are synthesised in the app, named in written pitch for your instrument. Saved like Theory.', true)
ON CONFLICT (feature_key) DO NOTHING;
