-- ML-639: what the member did with each of a read's checks when the piece was saved - agreed, agreed with "Agree all",
-- changed, checked, or left open - so Admin -> Photo reads can show, for each kind of check, how often its guess was
-- right. [{ id, kind, step, state, from, to }], set by PUT /api/piece-read/:id/saved (pieceReads.js markSaved).
ALTER TABLE piece_read_pieces ADD COLUMN IF NOT EXISTS check_answers JSONB;
