-- ML-113: a Flow's lead-in is now a yes/no - always one whole bar before bar 1, in bar 1's time
-- signature and tempo. No pickup beats, no "repeat the lead-in on every loop", no quiet seconds before
-- it: looping and rests between repeats are Rehearse's repeat control (ML-302), a playback setting,
-- not part of the piece. flowBlocks.js (asFlowLeadIn) keeps every new write in this shape.
--
-- Flow lead-ins only (parent_score_id set). The columns stay: the old ad-hoc Metronome Blocks setups
-- (parent_adhoc_setup_id) still hold values in them. Production had no Flow lead-ins when this was
-- written; dev had 9 test ones.
UPDATE metronome_segments
SET bar_count = 1, pickup_beats = NULL, repeat_lead_in = false, quiet_seconds_before_lead_in = 0
WHERE parent_score_id IS NOT NULL
  AND is_lead_in = true
  AND (bar_count <> 1 OR pickup_beats IS NOT NULL OR repeat_lead_in OR quiet_seconds_before_lead_in <> 0);
