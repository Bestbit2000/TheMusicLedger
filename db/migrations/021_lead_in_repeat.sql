-- Whether the loop-back point on every repeat includes the lead-in again, or
-- skips straight to the first regular block after it plays once at the start
-- (ML-85: "the music comes round too soon, I need a break in between each
-- loop to gather and work out where I am again"). Only meaningful on the
-- setup's one is_lead_in row (017_multibar_metronome.sql); ignored on
-- regular blocks, same as pickup_beats.

ALTER TABLE metronome_segments ADD COLUMN repeat_lead_in BOOLEAN NOT NULL DEFAULT false;
