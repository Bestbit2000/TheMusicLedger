-- Challenges. See docs/database-schema.md "Challenges". Replaces the sheet's
-- Challenges tab (free-text piece/bar fields) with real score/segment
-- references, and replaces its aggregate timeSpent/sessions counters with a
-- proper log table.

CREATE TABLE challenges (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    account_id BIGINT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    type TEXT,
    challenge_priority INTEGER
);

CREATE TABLE challenge_items (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    challenge_id BIGINT NOT NULL REFERENCES challenges(id) ON DELETE CASCADE,
    score_id BIGINT REFERENCES scores(id),
    metronome_segment_id BIGINT REFERENCES metronome_segments(id),
    bar_from SMALLINT,
    bar_to SMALLINT,
    target_bpm SMALLINT,
    status TEXT NOT NULL DEFAULT 'To do',
    item_priority INTEGER
);

CREATE INDEX idx_challenge_items_challenge ON challenge_items (challenge_id, item_priority);

CREATE TABLE challenge_logs (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    challenge_item_id BIGINT NOT NULL REFERENCES challenge_items(id) ON DELETE CASCADE,
    session_id BIGINT REFERENCES sessions(id) ON DELETE SET NULL,
    logged_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    duration_minutes INTEGER,
    bpm_achieved SMALLINT
);

CREATE INDEX idx_challenge_logs_item ON challenge_logs (challenge_item_id, logged_at DESC);
