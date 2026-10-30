-- ML-674: how long a piece takes to prepare, and how many taps, on the ML-199 stopwatch - so a change to the Prepare
-- screens can be compared by app version, the way entering a piece is. A sitting on the levels page is a row of kind
-- 'prepare'; bars_active_seconds is the same as active_seconds there, as the whole sitting is bar work.
ALTER TABLE flow_authoring_sessions DROP CONSTRAINT IF EXISTS flow_authoring_sessions_kind_check;
ALTER TABLE flow_authoring_sessions ADD CONSTRAINT flow_authoring_sessions_kind_check
    CHECK (kind IN ('create', 'edit', 'prepare'));

-- What it took: taps on a bar with each tool, Undo, Redo, typed entries, changes of tool, the median gap between taps on
-- a bar in tenths of a second, the bars that already had a level, the run-through's seconds, whether it came back from a
-- draft, and the focus sections at the end. Counts only - never which bars or what level.
ALTER TABLE flow_authoring_sessions ADD COLUMN IF NOT EXISTS prepare_counts JSONB;
