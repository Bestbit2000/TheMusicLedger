-- Sessions and their up-to-4 segments. See docs/database-schema.md "Sessions".
--
-- Timing model: sessions.total_duration_minutes is the actual, authoritative
-- practice time (what stats are built from). session_segments.planned_duration_minutes
-- is guidance only and must never be summed to produce a total - a 45-minute
-- session might contain four "approximately 10 minute" pieces that don't add
-- up to 45; the session's own total is measured separately.

CREATE TABLE sessions (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    session_type TEXT NOT NULL CHECK (session_type IN ('practice', 'rehearsal', 'performance', 'lesson')),
    account_id BIGINT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    band_id BIGINT REFERENCES bands(id) ON DELETE SET NULL,
    tutor_id BIGINT REFERENCES tutors(id) ON DELETE SET NULL,
    practice_list_id BIGINT REFERENCES practice_lists(id) ON DELETE SET NULL,
    started_at TIMESTAMPTZ NOT NULL,
    total_duration_minutes INTEGER NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_sessions_account_started ON sessions (account_id, started_at DESC);
CREATE INDEX idx_sessions_band_started ON sessions (band_id, started_at DESC);

-- Closes the circular reference from 004_practice_lists.sql now that
-- sessions exists.
ALTER TABLE practice_lists
    ADD CONSTRAINT practice_lists_target_session_fkey
    FOREIGN KEY (target_session_id) REFERENCES sessions(id) ON DELETE SET NULL;

-- Attendance, split out from band_members deliberately: a one-off guest at a
-- rehearsal has a different lifetime than standing membership.
CREATE TABLE session_participants (
    session_id BIGINT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    account_id BIGINT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    is_guest BOOLEAN NOT NULL DEFAULT false,
    role TEXT,
    PRIMARY KEY (session_id, account_id)
);

CREATE TABLE session_segments (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    session_id BIGINT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    segment_type TEXT NOT NULL CHECK (segment_type IN ('warm_up', 'scales', 'technique', 'performance')),
    order_index INTEGER NOT NULL,
    planned_duration_minutes INTEGER,
    score_id BIGINT REFERENCES scores(id),
    metronome_segment_id BIGINT REFERENCES metronome_segments(id)
);

CREATE INDEX idx_session_segments_session ON session_segments (session_id, order_index);

-- Closes the forward reference from 002_scores_and_metronome.sql.
ALTER TABLE metronome_run_logs
    ADD CONSTRAINT metronome_run_logs_session_segment_fkey
    FOREIGN KEY (session_segment_id) REFERENCES session_segments(id) ON DELETE SET NULL;
