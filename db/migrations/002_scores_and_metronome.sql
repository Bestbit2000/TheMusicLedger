-- Scores and the ML-35 multi-bar metronome structure.
-- See docs/database-schema.md "Scores & metronome segments (Jira ML-35)".

CREATE TABLE scores (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    title TEXT NOT NULL,
    owner_band_id BIGINT REFERENCES bands(id) ON DELETE CASCADE,
    owner_account_id BIGINT REFERENCES accounts(id) ON DELETE CASCADE,
    forked_from_score_id BIGINT REFERENCES scores(id),
    is_public BOOLEAN NOT NULL DEFAULT false,
    default_bpm SMALLINT,
    default_time_signature TEXT,
    default_conductor_beats_per_bar SMALLINT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT scores_exactly_one_owner CHECK (
        (owner_band_id IS NOT NULL)::int + (owner_account_id IS NOT NULL)::int = 1
    )
);

-- Standalone manual multi-section metronome setup. Individual-only by design -
-- never band-owned (confirmed in conversation, unlike scores/practice_lists).
CREATE TABLE adhoc_metronome_setups (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    account_id BIGINT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- One row per section - belongs to EITHER a score OR an ad-hoc setup, never both.
-- No `subdivide` column: that's a live runtime override on the metronome player,
-- never saved.
CREATE TABLE metronome_segments (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    parent_score_id BIGINT REFERENCES scores(id) ON DELETE CASCADE,
    parent_adhoc_setup_id BIGINT REFERENCES adhoc_metronome_setups(id) ON DELETE CASCADE,
    order_index INTEGER NOT NULL,
    rehearsal_mark TEXT,
    bar_count SMALLINT NOT NULL,
    bpm SMALLINT NOT NULL,
    time_signature TEXT NOT NULL,
    conductor_beats_per_bar SMALLINT,

    -- Journey / repeat structure
    is_repeat_start BOOLEAN NOT NULL DEFAULT false,
    is_repeat_end BOOLEAN NOT NULL DEFAULT false,
    pickup_beats SMALLINT,
    goto_coda BOOLEAN NOT NULL DEFAULT false,
    goto_start_dc BOOLEAN NOT NULL DEFAULT false,
    is_coda BOOLEAN NOT NULL DEFAULT false,
    is_first_time_bar BOOLEAN NOT NULL DEFAULT false,
    is_second_time_bar BOOLEAN NOT NULL DEFAULT false,

    -- Carol-style intro, played once then skipped on repeat: exact note it
    -- starts/ends on, not just a whole-segment flag.
    intro_start_bar_offset SMALLINT,
    intro_start_beat_offset SMALLINT,
    intro_end_bar_offset SMALLINT,
    intro_end_beat_offset SMALLINT,

    -- Tempo ramp anchored at its START (bar/beat within this segment where
    -- acceleration begins); it ramps forward and lands on the NEXT segment's
    -- own bpm at the segment boundary - no separate target-tempo field needed.
    ramp_start_bar_offset SMALLINT,
    ramp_start_beat_offset SMALLINT,

    notes TEXT,

    CONSTRAINT metronome_segments_exactly_one_parent CHECK (
        (parent_score_id IS NOT NULL)::int + (parent_adhoc_setup_id IS NOT NULL)::int = 1
    )
);

CREATE INDEX idx_metronome_segments_score ON metronome_segments (parent_score_id, order_index);
CREATE INDEX idx_metronome_segments_adhoc ON metronome_segments (parent_adhoc_setup_id, order_index);

-- Polymorphic source (score or adhoc_setup): source_id has no FK constraint,
-- referential integrity for it is enforced at the application layer.
-- session_segment_id FK is added in 005_sessions.sql once session_segments exists.
CREATE TABLE metronome_run_logs (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    account_id BIGINT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    source_type TEXT NOT NULL CHECK (source_type IN ('score', 'adhoc_setup')),
    source_id BIGINT NOT NULL,
    session_segment_id BIGINT,
    run_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    completed BOOLEAN NOT NULL DEFAULT false
);

CREATE INDEX idx_metronome_run_logs_account ON metronome_run_logs (account_id, run_at DESC);
