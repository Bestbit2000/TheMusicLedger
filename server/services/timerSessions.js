// In-progress practice timer state (ML-197) - persisted so an accidental page reload/relogin
// doesn't lose it. See db/migrations/043_active_timer_sessions.sql for why this is a separate
// table from `sessions` rather than a status column bolted onto it. One row per account; a fresh
// start/sync always replaces whatever was there (ON CONFLICT upsert), never accumulates history.
//
// elapsed_seconds/updated_at together are a wall-clock anchor, not just a snapshot: while running,
// real time keeps passing whether or not the app is open to see it, so getActiveTimerSession
// projects elapsed_seconds forward by however long it's been since updated_at, computed in
// Postgres's own now() rather than trusting any client clock. A pause freezes that projection (see
// upsertActiveTimerSession's callers in public/app.js - pausing/resuming always re-syncs, which
// moves the anchor to that exact moment) - the ticket this exists for asked specifically for a
// paused stretch to never count against the remaining time, only a running one.
import pool from '../config/db.js';

export async function getActiveTimerSession(accountId) {
  const { rows } = await pool.query(
    `SELECT target_seconds,
            (CASE WHEN running
                  THEN elapsed_seconds + GREATEST(0, FLOOR(EXTRACT(EPOCH FROM (now() - updated_at))))::int
                  ELSE elapsed_seconds
             END) AS elapsed_seconds,
            running
     FROM active_timer_sessions WHERE account_id = $1`,
    [accountId]
  );
  if (!rows.length) return null;
  return {
    targetSeconds: rows[0].target_seconds,
    elapsedSeconds: rows[0].elapsed_seconds,
    running: rows[0].running
  };
}

export async function upsertActiveTimerSession(accountId, { targetSeconds, elapsedSeconds, running }) {
  await pool.query(
    `INSERT INTO active_timer_sessions (account_id, target_seconds, elapsed_seconds, running, updated_at)
     VALUES ($1, $2, $3, $4, now())
     ON CONFLICT (account_id) DO UPDATE
       SET target_seconds = EXCLUDED.target_seconds,
           elapsed_seconds = EXCLUDED.elapsed_seconds,
           running = EXCLUDED.running,
           updated_at = now()`,
    [accountId, targetSeconds, elapsedSeconds, running]
  );
}

export async function clearActiveTimerSession(accountId) {
  await pool.query('DELETE FROM active_timer_sessions WHERE account_id = $1', [accountId]);
}
