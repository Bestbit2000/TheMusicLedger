-- ML-179 follow-up: the Repeat bar / volta picker's "which bar does this ending start at?" field.
-- A volta/alternate ending can span more than one bar, and repeat_ending_numbers
-- (034_repeat_ending_numbers.sql) is set on every bar within it - this records where that span
-- starts, as an offset within the current block (1-based, bounded client-side by the block's own
-- bar_count). Nullable - only meaningful alongside a non-empty repeat_ending_numbers. Not
-- DB-enforced against bar_count since bar_count can shrink after the fact; the picker surfaces
-- that as a "needs fixing" state instead of the database blocking it.
ALTER TABLE metronome_segments ADD COLUMN repeat_ending_start_bar INTEGER;
