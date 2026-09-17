-- ML-34: Quick Play history entries can be starred as a favourite, which pulls
-- them to the top of the "Show history" list (alphabetically, ahead of every
-- non-favourite) instead of sitting in plain time order. Lives on the same
-- adhoc_metronome_setups row as is_quick_play (027_quick_play_flag.sql) rather
-- than a separate table - it's a per-row flag, not something with its own
-- lifecycle or attributes worth modeling separately. Not restricted to
-- is_quick_play rows at the column level (a plain saved setup could in
-- principle use it too later) - only the history list query cares.

ALTER TABLE adhoc_metronome_setups ADD COLUMN is_favorite BOOLEAN NOT NULL DEFAULT false;
