-- ML-179 follow-up: a third "end of bar" structure option distinct from is_section_boundary (a
-- plain mid-piece double barline) - the actual final barline marking the end of the piece
-- (thin line followed by a thick line), selectable alongside Normal/Section in the End of bar
-- picker. Same shared metronome_segments column as is_section_boundary, so it's available to both
-- Flow blocks and the ad-hoc Metronome Blocks tool even though only Flow's picker exposes it today.
ALTER TABLE metronome_segments ADD COLUMN is_final_barline BOOLEAN NOT NULL DEFAULT false;
