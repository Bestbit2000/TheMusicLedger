-- Sheets-to-database cutover: today's Challenges tab stores a free-text
-- piece name and reference, not a real linked score - challenge_items only
-- had score_id/metronome_segment_id (the eventual real-score link). These
-- are a bridge: score_id set = linked to a real score; piece_name set =
-- free text, same as the sheet today. Both nullable, both can be blank.
-- See docs/sheets-to-database-cutover.md.

ALTER TABLE challenge_items ADD COLUMN piece_name TEXT;
ALTER TABLE challenge_items ADD COLUMN ref TEXT;
