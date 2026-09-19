-- Jump picker follow-up (029_block_landmarks_and_jumps.sql added the segno half of this set) - two
-- options the picker was still missing.

-- "D.C. al Coda" - jump back to the start, then on to the coda next time through - the goto_start_dc
-- equivalent of the existing goto_segno_then_coda, and likewise a distinct instruction from plain
-- goto_start_dc + goto_coda both set.
ALTER TABLE metronome_segments ADD COLUMN goto_start_dc_then_coda BOOLEAN NOT NULL DEFAULT false;

-- "Fine" - marks the bar where playback stops once a D.C./D.S. jump has looped back to replay from
-- the start/sign. Distinct from is_final_barline (036_flow_final_barline.sql's literal end of the
-- piece on a normal first pass) - a Fine mark is usually reached and passed over on the first pass,
-- only stopping playback the second time through.
ALTER TABLE metronome_segments ADD COLUMN is_fine BOOLEAN NOT NULL DEFAULT false;
