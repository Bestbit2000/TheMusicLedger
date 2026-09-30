-- ML-365: a pause (fermata or caesura) can sit between the time signature's written beats - e.g. after the
-- first crotchet of a 2/2 bar counted in crotchets (beat 1.5). beat_offset becomes a written-beat position
-- in quarter-beat steps (1, 1.25, 1.5 ...). Every existing position is a whole beat and stays exactly where
-- it is. The app reads it back as a number (server/services/metronomeSegments.js, metronomeSetups.js).
ALTER TABLE metronome_segment_fermatas ALTER COLUMN beat_offset TYPE NUMERIC(5, 2);
