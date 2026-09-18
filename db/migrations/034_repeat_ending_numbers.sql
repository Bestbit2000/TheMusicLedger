-- Volta/repeat-ending numbers (ML-179 follow-up) - a bar's repeat ending isn't always just "1st"
-- or "2nd": some pieces play a section on passes 1, 3, 5 and a different ending on 2, 4. Replaces
-- the binary is_first_time_bar/is_second_time_bar pair's limits for Flow blocks (both columns stay
-- as-is, untouched and still readable, for the ad-hoc side, which isn't changing here) with an
-- explicit array of which repeat-pass numbers (1-10) this bar plays on. NULL/empty means "not a
-- volta" - same meaning the two old booleans being both false already had.
ALTER TABLE metronome_segments
  ADD COLUMN repeat_ending_numbers SMALLINT[];
