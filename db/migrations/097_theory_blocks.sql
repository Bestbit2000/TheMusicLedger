-- ML-418: a practice session can have Theory blocks (nothing to play, no noise) - the Quiet practice plan
-- is Theory in every block, and Build my plan offers Theory as a fifth kind of block. Two lists of
-- allowed kinds learn the new one: a saved plan's row of blocks, and a logged session's segments.
ALTER TABLE practice_templates DROP CONSTRAINT IF EXISTS practice_templates_blocks_check;
ALTER TABLE practice_templates ADD CONSTRAINT practice_templates_blocks_check
    CHECK (blocks IS NULL OR (blocks <@ ARRAY['warmup', 'scales', 'skills', 'rehearsal', 'theory']::text[] AND cardinality(blocks) BETWEEN 1 AND 24));

ALTER TABLE session_segments DROP CONSTRAINT IF EXISTS session_segments_segment_type_check;
ALTER TABLE session_segments ADD CONSTRAINT session_segments_segment_type_check
    CHECK (segment_type IN ('warm_up', 'scales', 'technique', 'performance', 'theory'));
