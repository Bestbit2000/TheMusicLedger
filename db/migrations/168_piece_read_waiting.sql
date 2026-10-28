-- ML-645: the waiting screen while a photo or PDF is read - an estimate of how long, and a way to stop.
--
-- piece_reads:
--   pages       how many pages a PDF has (counted when it is read, as well as it can be; null when it can't tell),
--               or how many photos - what the next estimates are worked out from.
--   estimate_ms what the waiting screen estimated, beside ms (what it took), so Admin -> Photo reads can say how good
--               the estimates are.
--   client_ref  a reference the browser makes for one read, so it can say "stop" before the read is logged.
--   cancelled_at the member stopped waiting. The owner, 28 Oct 2026: a read counts against the allowance only when a
--               result is returned - so a stopped read doesn't count, even though it may have been paid for.
ALTER TABLE piece_reads ADD COLUMN IF NOT EXISTS pages INTEGER;
ALTER TABLE piece_reads ADD COLUMN IF NOT EXISTS estimate_ms INTEGER;
ALTER TABLE piece_reads ADD COLUMN IF NOT EXISTS client_ref TEXT;
ALTER TABLE piece_reads ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS idx_piece_reads_client_ref ON piece_reads (client_ref) WHERE client_ref IS NOT NULL;

-- Every stop, while sending (no read happens) or while reading (the read may still finish on the server - it is then
-- marked cancelled_at by its client_ref). The owner asked to measure how often this happens (28 Oct 2026): Admin ->
-- Photo reads counts them, how long people waited and what the stopped reads cost. Deleted with the account.
CREATE TABLE piece_read_stops (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    account_id BIGINT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    client_ref TEXT NOT NULL,
    stage TEXT NOT NULL CHECK (stage IN ('sending', 'reading')),
    waited_ms INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_piece_read_stops_ref ON piece_read_stops (client_ref);
