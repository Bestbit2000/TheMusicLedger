-- Flow's Pauses picker (ML-179) adds a second pause type, Caesura (a silent break), alongside the
-- existing Fermata (held beat). Both share the same bar/beat/duration shape, so this reuses
-- metronome_segment_fermatas (028_block_navigation_markup.sql) rather than a parallel table,
-- distinguished by this new column. hold_beats doubles as "silence duration" for a caesura row;
-- playback_mode is meaningless for a caesura (always silent) and is just left at its default there.
ALTER TABLE metronome_segment_fermatas ADD COLUMN kind TEXT NOT NULL DEFAULT 'fermata'
  CHECK (kind IN ('fermata', 'caesura'));
