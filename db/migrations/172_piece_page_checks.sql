-- ML-657 part 3: the quick look at the pages before the full read - a cheaper model asked, per page, is it music, its
-- printed page number, an edge cut off, can it be read, which way up; and the time signature at the start. It never
-- uses one of the member's reads. One row per look: what it found (judged - PieceRead.judgePages), what it cost and
-- took, and what the member did ('carried on' when nothing stopped it, 'read anyway', 'retake', 'stopped'), linked
-- to the full read that followed - so Admin -> Photo reads can say whether it earns its few seconds.

-- A new feature is Super admin only until it is switched on for account types (Admin -> Feature access); switching it
-- off there stops the look altogether.
INSERT INTO features (feature_key, name, description, enabled) VALUES
    ('piece_page_check', 'A quick look at the pages before a photo read', 'Before a piece is read from a photo or PDF, a cheaper model takes a few seconds to look at the pages: is a page missing, an edge cut off, a page unreadable or on its side, and can the time signature be read. A problem is said before the full read is spent on it. It never uses one of the member''s reads (Admin -> Third parties, Vercel AI Gateway).', true)
ON CONFLICT (feature_key) DO NOTHING;

CREATE TABLE IF NOT EXISTS piece_page_checks (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    account_id BIGINT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    status TEXT NOT NULL CHECK (status IN ('checked', 'failed')),
    failure TEXT,
    model TEXT,
    prompt_version TEXT,
    file_kind TEXT,
    file_count INTEGER,
    units_in INTEGER,
    units_out INTEGER,
    ms INTEGER,
    judged JSONB,
    choice TEXT CHECK (choice IN ('carried on', 'read anyway', 'retake', 'stopped')),
    read_id BIGINT REFERENCES piece_reads(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_piece_page_checks_created ON piece_page_checks (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_piece_page_checks_account ON piece_page_checks (account_id);
