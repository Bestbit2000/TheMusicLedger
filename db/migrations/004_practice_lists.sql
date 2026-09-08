-- Practice lists. See docs/database-schema.md "Practice lists".
-- target_session_id has no FK yet: sessions doesn't exist until 005_sessions.sql,
-- and sessions.practice_list_id points back at practice_lists - a genuine
-- circular reference between the two tables, resolved with an ALTER TABLE
-- in 005 once both tables exist.

CREATE TABLE practice_lists (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    owner_account_id BIGINT REFERENCES accounts(id) ON DELETE CASCADE,
    owner_band_id BIGINT REFERENCES bands(id) ON DELETE CASCADE,
    target_session_id BIGINT,
    name TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT practice_lists_exactly_one_owner CHECK (
        (owner_account_id IS NOT NULL)::int + (owner_band_id IS NOT NULL)::int = 1
    )
);

CREATE TABLE practice_list_scores (
    practice_list_id BIGINT NOT NULL REFERENCES practice_lists(id) ON DELETE CASCADE,
    score_id BIGINT NOT NULL REFERENCES scores(id) ON DELETE CASCADE,
    order_index INTEGER NOT NULL,
    PRIMARY KEY (practice_list_id, score_id)
);

-- Only insert a row when overriding away from the default (all segments
-- included). No row = included.
CREATE TABLE practice_list_segment_overrides (
    practice_list_id BIGINT NOT NULL REFERENCES practice_lists(id) ON DELETE CASCADE,
    metronome_segment_id BIGINT NOT NULL REFERENCES metronome_segments(id) ON DELETE CASCADE,
    included BOOLEAN NOT NULL,
    PRIMARY KEY (practice_list_id, metronome_segment_id)
);
