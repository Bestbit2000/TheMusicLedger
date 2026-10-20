// ML-557: how far a piece has come, and the member's own pace. See db/migrations/141_levels_progress.sql.
//
// - Where each bar started (piece_level_starts): every bar's first Level, kept per member. Saved when a piece
//   is first prepared; a bar that gets its first Level later is filled in then. A piece prepared before ML-557
//   has its start worked out once from the history that still lines up (rebuilt) - each focus section's first
//   recorded Level - and a bar with none is "start not known".
// - Bar by bar: each bar's Level now and at the start, and the practice sessions and minutes spent on it (the
//   blocks whose bars cover it - session_segments.start_bar/end_bar, kept when the piece is cut again).
// - Pace (owner, 20 Oct 2026): blocks per Level gained, across all the member's pieces. The forecast uses it
//   (SmartLearn only) once there are 10 Level-ups to go on; until then one block is one Level, as before.
import pool from '../config/db.js';
import { assertFlowReadAccess, FlowJourney } from './flows.js';

export const PACE_MIN_LEVEL_UPS = 10;

// A piece's chunks' bars as each bar's Level (FlowJourney.barLevels - the narrowest chunk wins), 0 for none.
// Play-through parts (kind 'group') are left out: they never give a bar its Level.
const barMap = (totalBars, chunks) => FlowJourney.barLevels(totalBars, chunks.filter(c => c.kind !== 'group')).map(v => v || 0);
const asChunk = (r, level) => ({ kind: r.kind, startBar: r.start_bar, endBar: r.end_bar, level });

// Before ML-557 nothing kept where a bar started. For a piece with Levels and no start yet, work it out once from
// each focus section's first recorded Level (its history goes with it while the section keeps its bars).
async function rebuildStarts(db, accountId, scoreId, totalBars) {
  const { rows } = await db.query(
    `SELECT pc.kind, pc.start_bar, pc.end_bar,
            (SELECT c.level_after FROM chunk_level_changes c WHERE c.chunk_id = pc.id AND c.level_after IS NOT NULL ORDER BY c.created_at, c.id LIMIT 1) AS first_level
       FROM piece_chunks pc WHERE pc.account_id = $1 AND pc.score_id = $2 AND pc.kind <> 'group'`,
    [accountId, scoreId]);
  if (!rows.length) return null;
  return barMap(totalBars, rows.map(r => asChunk(r, r.first_level == null ? null : Number(r.first_level))));
}

// Make sure a piece that already has Levels has a start. Called before a save changes them, and when progress
// is read. Returns the row, or null when the piece has never been prepared.
export async function ensureLevelStarts(db, accountId, scoreId, totalBars) {
  const { rows } = await db.query('SELECT levels, rebuilt FROM piece_level_starts WHERE account_id = $1 AND score_id = $2', [accountId, scoreId]);
  if (rows.length) return { levels: rows[0].levels.map(Number), rebuilt: rows[0].rebuilt };
  const levels = await rebuildStarts(db, accountId, scoreId, totalBars);
  if (!levels || !levels.some(Boolean)) return null;
  await db.query(
    `INSERT INTO piece_level_starts (account_id, score_id, levels, rebuilt) VALUES ($1, $2, $3, true) ON CONFLICT (account_id, score_id) DO NOTHING`,
    [accountId, scoreId, levels]);
  return { levels, rebuilt: true };
}

// After a piece's Levels are saved: the first time, its start is what was just saved; after that, only a bar
// with no start yet takes the Level it has now.
export async function recordLevelStarts(db, accountId, scoreId, totalBars) {
  const { rows } = await db.query(`SELECT kind, start_bar, end_bar, level FROM piece_chunks WHERE account_id = $1 AND score_id = $2`, [accountId, scoreId]);
  const now = barMap(totalBars, rows.map(r => asChunk(r, r.level == null ? null : Number(r.level))));
  if (!now.some(Boolean)) return;
  const had = await db.query('SELECT levels FROM piece_level_starts WHERE account_id = $1 AND score_id = $2 FOR UPDATE', [accountId, scoreId]);
  if (!had.rows.length) {
    await db.query('INSERT INTO piece_level_starts (account_id, score_id, levels) VALUES ($1, $2, $3) ON CONFLICT (account_id, score_id) DO NOTHING', [accountId, scoreId, now]);
    return;
  }
  const old = had.rows[0].levels.map(Number);
  const merged = now.map((v, i) => (old[i] ? old[i] : v));
  if (merged.some((v, i) => v !== (old[i] || 0))) {
    await db.query('UPDATE piece_level_starts SET levels = $3, updated_at = now() WHERE account_id = $1 AND score_id = $2', [accountId, scoreId, merged]);
  }
}

// Bar by bar: { totalBars, now, start (null = no start kept), rebuilt, sessions, minutes } - arrays a bar each,
// bar 1 first - plus the piece's totals.
export async function getLevelsProgress(accountId, scoreId, totalBars) {
  await assertFlowReadAccess(accountId, scoreId);
  const starts = await ensureLevelStarts(pool, accountId, scoreId, totalBars);
  const [{ rows: chunks }, { rows: perBar }, { rows: totals }] = await Promise.all([
    pool.query('SELECT kind, start_bar, end_bar, level FROM piece_chunks WHERE account_id = $1 AND score_id = $2', [accountId, scoreId]),
    pool.query(
      `SELECT g.bar, COUNT(DISTINCT s.id)::int AS sessions, COALESCE(SUM(seg.actual_seconds), 0)::int AS seconds
         FROM generate_series(1, $3::int) AS g(bar)
         JOIN session_segments seg ON seg.score_id = $2 AND seg.start_bar <= g.bar AND seg.end_bar >= g.bar
         JOIN sessions s ON s.id = seg.session_id AND s.account_id = $1
        GROUP BY g.bar`,
      [accountId, scoreId, totalBars]),
    pool.query(
      `SELECT COUNT(DISTINCT s.id)::int AS sessions, COALESCE(SUM(seg.actual_seconds), 0)::int AS seconds
         FROM session_segments seg JOIN sessions s ON s.id = seg.session_id AND s.account_id = $1
        WHERE seg.score_id = $2 AND seg.start_bar IS NOT NULL`,
      [accountId, scoreId]),
  ]);
  const sessions = new Array(totalBars).fill(0);
  const minutes = new Array(totalBars).fill(0);
  perBar.forEach(r => { sessions[r.bar - 1] = r.sessions; minutes[r.bar - 1] = Math.round(r.seconds / 60); });
  return {
    totalBars,
    now: barMap(totalBars, chunks.map(r => asChunk(r, r.level == null ? null : Number(r.level)))),
    start: starts ? Array.from({ length: totalBars }, (_, i) => starts.levels[i] || 0) : null,
    rebuilt: !!(starts && starts.rebuilt),
    sessions,
    minutes,
    sessionsTotal: totals[0].sessions,
    minutesTotal: Math.round(totals[0].seconds / 60),
  };
}

// The member's own pace: practice blocks on pieces per Level gained in practice (Level up while playing, or
// "Did you nail it?"), across every piece. ready once there are PACE_MIN_LEVEL_UPS Levels gained.
export async function getPracticePace(accountId) {
  const [{ rows: ups }, { rows: blocks }] = await Promise.all([
    pool.query(
      `SELECT COALESCE(SUM(level_after - level_before), 0)::int AS gained FROM chunk_level_changes
        WHERE account_id = $1 AND source IN ('during', 'rating') AND level_before IS NOT NULL AND level_after > level_before`,
      [accountId]),
    pool.query(
      `SELECT COUNT(*)::int AS n FROM session_segments seg JOIN sessions s ON s.id = seg.session_id AND s.account_id = $1
        WHERE seg.segment_type = 'performance' AND (seg.start_bar IS NOT NULL OR seg.chunk_id IS NOT NULL)`,
      [accountId]),
  ]);
  const gained = ups[0].gained;
  const n = blocks[0].n;
  const ready = gained >= PACE_MIN_LEVEL_UPS && n > 0;
  return { levelUps: gained, blocks: n, needed: PACE_MIN_LEVEL_UPS, ready, blocksPerLevel: ready ? Math.round((n / gained) * 10) / 10 : null };
}
