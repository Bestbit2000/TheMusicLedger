-- Individual playing preferences. See docs/database-schema.md
-- "Individual playing preferences" - explicitly per-account, never band-wide.

CREATE TABLE account_segment_bar_exclusions (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    account_id BIGINT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    metronome_segment_id BIGINT NOT NULL REFERENCES metronome_segments(id) ON DELETE CASCADE,
    bar_from SMALLINT NOT NULL,
    bar_to SMALLINT NOT NULL,
    note TEXT,
    CONSTRAINT bar_exclusions_valid_range CHECK (bar_to >= bar_from)
);

CREATE INDEX idx_bar_exclusions_account_segment
    ON account_segment_bar_exclusions (account_id, metronome_segment_id);
