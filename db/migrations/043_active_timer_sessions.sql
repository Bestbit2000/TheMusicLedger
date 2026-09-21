-- ML-197: an in-progress practice timer, persisted so an accidental page reload/relogin (e.g.
-- pull-to-refresh on mobile, see the accompanying overscroll-behavior fix in public/style.css)
-- doesn't lose it. Deliberately NOT the same table as `sessions` - that one's
-- total_duration_minutes is the authoritative FINISHED practice-time figure
-- (docs/database-schema.md's "Session timing" guiding principle: NOT NULL, no status column,
-- never meant to represent a still-running session).
--
-- One row per account (account_id is the primary key, not a separate identity PK) since the
-- frontend only ever runs one timer at a time - starting a new one always replaces whatever was
-- here rather than accumulating history. Written only on start/pause/resume/snooze (see
-- public/app.js's syncActiveTimerSession), deleted once the timer actually finishes or is stopped.
--
-- elapsed_seconds/updated_at are a wall-clock anchor, not a periodically-refreshed snapshot: while
-- running is true, server/services/timerSessions.js's getActiveTimerSession projects elapsed_seconds
-- forward by however long it's been since updated_at (using Postgres's own now(), not any client
-- clock) - so a reload/relogin resumes with exactly the same time left it would have if it had been
-- a real clock running the whole time it was away, to the second. running=false freezes that
-- projection - a paused stretch must never count against the remaining time, only a running one.
CREATE TABLE active_timer_sessions (
    account_id BIGINT PRIMARY KEY REFERENCES accounts(id) ON DELETE CASCADE,
    target_seconds INTEGER, -- NULL for an open-ended (count-up) timer - same meaning as the client's own timerState.targetSeconds
    elapsed_seconds INTEGER NOT NULL,
    running BOOLEAN NOT NULL DEFAULT true,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now() -- the wall-clock anchor elapsed_seconds is projected forward from while running - see the comment above
);
