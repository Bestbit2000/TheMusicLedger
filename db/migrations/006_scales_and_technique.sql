-- Scales and technique exercises. See docs/database-schema.md "Scales" and
-- "Technique exercises". Both log tables hang off session_segments so a
-- scales/technique segment's history can be traced back to the session it
-- happened in, but also work when logged outside a formal session.

CREATE TABLE scale_definitions (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT
);

CREATE TABLE scale_practice_logs (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    account_id BIGINT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    scale_id BIGINT NOT NULL REFERENCES scale_definitions(id),
    session_segment_id BIGINT REFERENCES session_segments(id) ON DELETE SET NULL,
    logged_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    bpm_achieved SMALLINT,
    status TEXT
);

CREATE INDEX idx_scale_practice_logs_account_scale ON scale_practice_logs (account_id, scale_id, logged_at DESC);

-- A reference range, e.g. "Book X, exercises 1-25". Individual-only.
CREATE TABLE technique_exercise_sets (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    account_id BIGINT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    source TEXT NOT NULL,
    exercise_from INTEGER NOT NULL,
    exercise_to INTEGER NOT NULL,
    name TEXT,
    CONSTRAINT technique_exercise_sets_valid_range CHECK (exercise_to >= exercise_from)
);

-- Which specific number was actually played and how it went - feeds the
-- "pick some randomly, or based on past performance" selection logic.
CREATE TABLE technique_exercise_logs (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    technique_exercise_set_id BIGINT NOT NULL REFERENCES technique_exercise_sets(id) ON DELETE CASCADE,
    session_segment_id BIGINT REFERENCES session_segments(id) ON DELETE SET NULL,
    exercise_number INTEGER NOT NULL,
    logged_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    status TEXT,
    bpm_achieved SMALLINT
);

CREATE INDEX idx_technique_exercise_logs_set ON technique_exercise_logs (technique_exercise_set_id, logged_at DESC);
