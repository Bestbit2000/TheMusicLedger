-- ML-657: what the member told a read again - the time signature it starts with, whether it changes time, whether it
-- starts before the first full bar, and the bars in all if they knew - so Admin -> Photo reads shows when a read was
-- given them. { beats, beatType, changes, pickup, bars }, checked by PieceRead.cleanGivens; null for an ordinary read.
ALTER TABLE piece_reads ADD COLUMN IF NOT EXISTS givens JSONB;
