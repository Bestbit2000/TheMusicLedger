-- ML-478: one "My bands" list. Until now a member had two lists that looked like one: the names they
-- had logged rehearsals and performances with (rows of kind 'label'), and the shared spaces they were
-- in (kind 'group', through band_members) - and the "Who with?" box showed both, side by side.
--
-- Now My bands IS the member's labels: every band they play with is one label, and a label may
--   - say which directory entry it is (directory_band_id - until now only a group could), and
--   - show a shared space the member is in (shared_band_id - the group whose pieces, practice lists
--     and members appear on that entry).
-- Adding a band makes a label and nothing else: private, no invitation needed. A shared space comes
-- later, by invitation or by a deliberate "Set up sharing".
--
-- needs_tidy marks the names that were there before this (typed over the years, nothing said about
-- what they are) so "Tidy my bands" can ask once about each: a directory band, the same as another of
-- mine, my own, or one I don't play with now. Anything added from now on is not marked.

ALTER TABLE bands
    DROP CONSTRAINT bands_directory_link_check,
    ADD CONSTRAINT bands_directory_link_check CHECK (directory_band_id IS NULL OR kind IN ('group', 'label')),
    ADD COLUMN shared_band_id BIGINT REFERENCES bands(id) ON DELETE SET NULL,
    ADD COLUMN needs_tidy BOOLEAN NOT NULL DEFAULT false,
    ADD CONSTRAINT bands_shared_link_check CHECK (shared_band_id IS NULL OR kind = 'label');
CREATE INDEX idx_bands_shared ON bands (shared_band_id) WHERE shared_band_id IS NOT NULL;
CREATE INDEX idx_bands_label_owner ON bands (created_by_account_id) WHERE kind = 'label';

-- 1. Every shared space a member is in shows on one of their labels (the owner, 6 Oct 2026: the bands
--    already shared stay shared). A label of the same name is the same band: it takes the space, and
--    is shown again if it had been hidden. Where one member is in two spaces of the same name, the
--    older space takes the label.
UPDATE bands l
   SET shared_band_id = g.id, directory_band_id = g.directory_band_id, active = true
  FROM band_members bm
  JOIN bands g ON g.id = bm.band_id AND g.kind = 'group'
 WHERE l.kind = 'label' AND l.created_by_account_id = bm.account_id AND lower(l.name) = lower(g.name)
   AND l.id = (SELECT min(l2.id) FROM bands l2
                WHERE l2.kind = 'label' AND l2.created_by_account_id = bm.account_id AND lower(l2.name) = lower(g.name))
   AND g.id = (SELECT min(g2.id) FROM band_members bm2 JOIN bands g2 ON g2.id = bm2.band_id AND g2.kind = 'group'
                WHERE bm2.account_id = bm.account_id AND lower(g2.name) = lower(g.name));

--    A membership with no label yet gets one, named as the space is (with the space's number after it
--    in the rare case that name is already taken by another of the member's bands).
INSERT INTO bands (name, created_by_account_id, kind, directory_band_id, shared_band_id)
SELECT CASE WHEN EXISTS (SELECT 1 FROM bands t WHERE t.kind = 'label' AND t.created_by_account_id = bm.account_id AND lower(t.name) = lower(g.name))
            THEN g.name || ' (' || g.id || ')' ELSE g.name END,
       bm.account_id, 'label', g.directory_band_id, g.id
  FROM band_members bm
  JOIN bands g ON g.id = bm.band_id AND g.kind = 'group'
 WHERE NOT EXISTS (SELECT 1 FROM bands l WHERE l.kind = 'label' AND l.created_by_account_id = bm.account_id AND l.shared_band_id = g.id);

-- 2. The names already there that say nothing about what they are: ask once, in "Tidy my bands".
UPDATE bands SET needs_tidy = true
 WHERE kind = 'label' AND active AND shared_band_id IS NULL AND directory_band_id IS NULL;
