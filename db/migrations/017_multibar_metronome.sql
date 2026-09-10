-- Multi-bar metronome (Jira ML-35), ad-hoc/standalone only for this release -
-- score-attached blocks and the DC/coda/journey fields on metronome_segments
-- stay dormant until a later ticket wires up scores themselves.
--
-- Time signature moves from a free-text column to a real FK. Two tables
-- rather than one with a nullable owner column: time_signature_options is a
-- pure system catalog (no owner, migration-seeded only) so it's always safe
-- to add/edit and release straight to production without any risk of
-- touching a user's private entry. account_time_signatures holds exactly
-- that private/custom case. metronome_segments points at exactly one of the
-- two, same "exactly one" CHECK pattern as scores' owner_band_id/
-- owner_account_id.

CREATE TABLE time_signature_options (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    numerator SMALLINT NOT NULL,
    denominator SMALLINT NOT NULL,
    label TEXT NOT NULL,
    sort_order INTEGER NOT NULL,
    active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (numerator, denominator)
);

-- Seeded from the exact list that was hardcoded in index.html's metroTimeSig select.
INSERT INTO time_signature_options (numerator, denominator, label, sort_order) VALUES
    (2, 4, '2/4', 1), (3, 4, '3/4', 2), (4, 4, '4/4', 3), (5, 4, '5/4', 4),
    (6, 4, '6/4', 5), (8, 4, '8/4', 6), (2, 2, '2/2', 7), (2, 8, '2/8', 8),
    (3, 8, '3/8', 9), (4, 8, '4/8', 10), (6, 8, '6/8', 11), (9, 8, '9/8', 12),
    (12, 8, '12/8', 13);

-- Private custom time signatures. Never touched by a migration - if a
-- future review finds these converging on a common shape, promoting one to
-- time_signature_options is a manual/data decision, not a schema change.
CREATE TABLE account_time_signatures (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    account_id BIGINT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    numerator SMALLINT NOT NULL,
    denominator SMALLINT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (account_id, numerator, denominator)
);

-- Lead-in: played once at the very start, excluded from the loop-back to the
-- first non-lead-in segment. A lead-in can be a whole bar or two (bar_count,
-- as normal) or a partial bar (pickup_beats on a bar_count=1 row) - chained
-- as separate is_lead_in segments rather than combining both on one row,
-- since a lead-in needing both is not expected to happen.
ALTER TABLE metronome_segments ADD COLUMN is_lead_in BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE metronome_segments ADD COLUMN time_signature_id BIGINT REFERENCES time_signature_options(id);
ALTER TABLE metronome_segments ADD COLUMN account_time_signature_id BIGINT REFERENCES account_time_signatures(id);

ALTER TABLE metronome_segments DROP COLUMN time_signature;

ALTER TABLE metronome_segments ADD CONSTRAINT metronome_segments_exactly_one_time_signature CHECK (
    (time_signature_id IS NOT NULL)::int + (account_time_signature_id IS NOT NULL)::int = 1
);
