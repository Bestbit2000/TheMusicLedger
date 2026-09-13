-- Quick Play (front-page replacement for the old single-bar Metronome page)
-- writes every play to this same table as a history row, named with a
-- timestamp instead of a user-chosen name. is_quick_play distinguishes those
-- history rows from a real kept "Saved setups" entry so they don't show up
-- in that list (see listAdhocSetups).

ALTER TABLE adhoc_metronome_setups ADD COLUMN is_quick_play BOOLEAN NOT NULL DEFAULT false;
