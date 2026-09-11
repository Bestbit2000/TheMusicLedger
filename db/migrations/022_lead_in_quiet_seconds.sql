-- How many seconds of complete silence play immediately before the lead-in
-- starts (ML-92: "rather than a continuous beeping... a small moment between
-- loops... where nothing is played, then the lead in starts"). Applies every
-- time the lead-in is about to play - the very first time, and again on every
-- loop-back when repeat_lead_in (021_lead_in_repeat.sql) is true. 0 (the
-- default) means no gap, i.e. today's existing behaviour. Only meaningful on
-- the setup's one is_lead_in row, same as pickup_beats/repeat_lead_in.

ALTER TABLE metronome_segments ADD COLUMN quiet_seconds_before_lead_in INTEGER NOT NULL DEFAULT 0;
