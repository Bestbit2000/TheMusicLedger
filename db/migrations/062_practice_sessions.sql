-- ML-320 (epic ML-314): the practice session builder - a session of 5-minute blocks (Warm-up, Scales,
-- Skills, Rehearsal), run with a 4:30 nudge. A finished session is one `sessions` row (session_type
-- 'practice', so Stats and history keep working) plus one `session_segments` row per block - the
-- tables from 005_sessions.sql, unused until now. Block kinds map to segment_type: Warm-up = warm_up,
-- Scales = scales, Skills = technique (shown as "Skills"), Rehearsal = performance.
ALTER TABLE session_segments ADD COLUMN IF NOT EXISTS actual_seconds INTEGER CHECK (actual_seconds >= 0);
-- A Rehearsal block's chunk (ML-315); kept as history if the chunk is later re-chunked away.
ALTER TABLE session_segments ADD COLUMN IF NOT EXISTS chunk_id BIGINT REFERENCES piece_chunks(id) ON DELETE SET NULL;
-- A Skills block's tool: warmups | scales | tapTempo | gapTrainer | ear.
ALTER TABLE session_segments ADD COLUMN IF NOT EXISTS tool TEXT;
