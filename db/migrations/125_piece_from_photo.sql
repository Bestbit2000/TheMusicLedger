-- ML-246: a piece from a photo or PDF. A vision model reads the structure of a part (bars, time signatures,
-- speeds, marks, repeats, signs) and Quick entry opens already filled in, with a high / medium / low rating
-- (docs/piece-from-photo.md). This adds the feature switch, a log of every read - what the reader said, what
-- it cost, and the piece as it was finally saved, so "right first time" can be counted and not guessed - and
-- the test library: a read whose file the owner chose to keep, so it can be read again with a new prompt or
-- a cheaper model.

-- A new feature is Super admin only until it is switched on for account types (Admin -> Feature access).
-- It stays that way until the owner has tested it on his own pieces (11 Oct 2026).
INSERT INTO features (feature_key, name, description, enabled) VALUES
    ('piece_from_photo', 'A piece from a photo or PDF', 'Add a piece by taking a photo of the part, or choosing a PDF: the app reads how many bars it has, the time signatures, speeds, rehearsal marks, repeats and signs, and opens Quick entry already filled in, with a rating that says how much to check. Each read costs money (Admin -> Third parties, Vercel AI Gateway).', true)
ON CONFLICT (feature_key) DO NOTHING;

-- The ML-199 stopwatch learns 'photo': a piece read from a photo and finished in Quick entry, so its time
-- can be set beside 'quick' (typed from nothing) and 'manual' (bar by bar).
ALTER TABLE flow_authoring_sessions DROP CONSTRAINT IF EXISTS flow_authoring_sessions_creation_source_check;
ALTER TABLE flow_authoring_sessions ADD CONSTRAINT flow_authoring_sessions_creation_source_check
    CHECK (creation_source IN ('manual', 'from_file', 'quick', 'photo'));

-- 1. One row per read (one file, or several photos, sent to the reader once). No picture is kept here: the
--    file is read and deleted. units_in / units_out are what the model charged for (its "tokens" - named
--    otherwise because the account export leaves out any column with "token" in its name, and these are
--    not secrets). test_files is filled only when the owner keeps the read as a test:
--    [{ "url": ..., "pathname": ... }] in the file store, under piece-read-tests/.
CREATE TABLE piece_reads (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    account_id BIGINT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    status TEXT NOT NULL CHECK (status IN ('read', 'failed')),
    failure TEXT,
    model TEXT,
    prompt_version TEXT,
    file_kind TEXT CHECK (file_kind IN ('pdf', 'photos')),
    file_count INTEGER NOT NULL DEFAULT 0,
    file_bytes BIGINT NOT NULL DEFAULT 0,
    units_in INTEGER NOT NULL DEFAULT 0,
    units_out INTEGER NOT NULL DEFAULT 0,
    ms INTEGER NOT NULL DEFAULT 0,
    test_files JSONB,
    test_kept_at TIMESTAMPTZ
);
CREATE INDEX idx_piece_reads_account ON piece_reads (account_id, created_at DESC);

-- 2. One row per piece found in a read (a file can hold several pieces or movements). `read` is the
--    reader's answer once checked, `outline` what Quick entry was opened with, `rating` and `checks` what
--    the member was shown. When the piece is saved: the piece (score_id), the outline as saved, and
--    `changes` - what differed between the two (PieceRead.compare). checked_at: the owner has checked the
--    saved piece against the page, so it can be trusted as the right answer in a test.
CREATE TABLE piece_read_pieces (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    read_id BIGINT NOT NULL REFERENCES piece_reads(id) ON DELETE CASCADE,
    piece_index INTEGER NOT NULL,
    title TEXT,
    bars INTEGER NOT NULL,
    rating TEXT NOT NULL CHECK (rating IN ('high', 'medium', 'low')),
    read JSONB NOT NULL,
    outline JSONB NOT NULL,
    checks JSONB NOT NULL,
    score_id BIGINT REFERENCES scores(id) ON DELETE SET NULL,
    saved JSONB,
    saved_at TIMESTAMPTZ,
    changes JSONB,
    checked_at TIMESTAMPTZ,
    UNIQUE (read_id, piece_index)
);

-- 3. A kept test read again later - a new prompt, another model. `pieces` is the same shape the first read
--    gave ([{ title, bars, rating, outline, changes }], changes against the saved piece), so a re-read can
--    be set beside the first and beside the answer.
CREATE TABLE piece_read_reruns (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    read_id BIGINT NOT NULL REFERENCES piece_reads(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    status TEXT NOT NULL CHECK (status IN ('read', 'failed')),
    failure TEXT,
    model TEXT,
    prompt_version TEXT,
    units_in INTEGER NOT NULL DEFAULT 0,
    units_out INTEGER NOT NULL DEFAULT 0,
    ms INTEGER NOT NULL DEFAULT 0,
    pieces JSONB
);
CREATE INDEX idx_piece_read_reruns_read ON piece_read_reruns (read_id, created_at DESC);
