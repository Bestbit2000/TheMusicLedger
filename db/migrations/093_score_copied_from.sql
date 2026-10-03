-- ML-401: a copy of a public piece remembers the public piece it came from, so how often a public piece
-- is taken up can be counted - prepared as it is (piece_chunks on the public piece itself) or as a copy
-- in someone's library (this link). A copy of a copy carries the same original (duplicateFlow), so the
-- count holds however many times it's been cloned. Nothing on screen reads it except Admin -> Flows.
-- Copies made before this have no link. ON DELETE SET NULL: deleting the original leaves the copies.
ALTER TABLE scores ADD COLUMN IF NOT EXISTS copied_from_score_id BIGINT REFERENCES scores(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS scores_copied_from ON scores (copied_from_score_id) WHERE copied_from_score_id IS NOT NULL;
