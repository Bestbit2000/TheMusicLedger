-- ML-411: who added a band piece. A band piece has no owner account (owner_band_id only), so until now
-- nothing said who put it there - and it couldn't be deleted from anywhere in the app. The person who
-- added it can now delete it (server/services/flowPermissions.js); everyone else in the band can't.
-- Set when a piece is made in a band or moved into one, cleared when it leaves the band (flows.js).
-- Null on a personal or public piece, and on a band piece whose adder isn't known.
-- ON DELETE SET NULL: the piece stays in the band when that account goes.
ALTER TABLE scores ADD COLUMN IF NOT EXISTS added_by_account_id BIGINT REFERENCES accounts(id) ON DELETE SET NULL;

-- Band pieces from before this: the adder is whoever built the piece (its first 'create' authoring
-- session, ML-199) - only an account that owned a piece could move it into a band - as long as they are
-- still in that band. Where that isn't known it stays null, and only a super admin can delete the piece.
UPDATE scores s
SET added_by_account_id = c.account_id
FROM (
    SELECT DISTINCT ON (fas.score_id) fas.score_id, fas.account_id
    FROM flow_authoring_sessions fas
    WHERE fas.kind = 'create' AND fas.score_id IS NOT NULL
    ORDER BY fas.score_id, fas.started_at
) c
WHERE s.id = c.score_id
  AND s.owner_band_id IS NOT NULL
  AND s.added_by_account_id IS NULL
  AND EXISTS (SELECT 1 FROM band_members bm WHERE bm.band_id = s.owner_band_id AND bm.account_id = c.account_id);
