// ML-199: recording how long a Flow actually takes to build. See
// db/migrations/044_flow_authoring_stats.sql for why the table looks the way it does (two
// durations, abandoned attempts kept, score_id nulled rather than cascaded).
//
// The client owns the clock here, unlike ML-197's active_timer_sessions where the server projects
// elapsed time forward from an anchor. That's deliberate and it's the opposite choice for a
// reason: what's being measured is ACTIVE time - seconds where someone was actually entering bars -
// and only the browser can see the pointer/keyboard/visibility events that distinguish those from
// seconds where the app merely sat open. A server-side projection would measure the wrong thing
// very precisely. The cost is that the numbers are only as honest as the client sending them, so
// everything here is clamped rather than trusted, and the server still stamps the two fields that
// must not be client-supplied: app_version and the timestamps.
//
// Nothing in this file is allowed to break flow authoring. A stats write that fails should lose a
// measurement, never a flow - callers treat every function here as best-effort.

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pool from '../config/db.js';
import { withStatus, assertFlowAccess } from './flows.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Read from public/releases.json rather than package.json: that file is guaranteed to be in the
// deployed function bundle (vercel.json's includeFiles is "public/**", and the root package.json
// isn't necessarily there), and it's the same version string the About page shows the user - so a
// row's app_version always matches a release the user can actually point at. Cached at module load
// since it cannot change without a redeploy, which restarts the process anyway.
let cachedAppVersion;
export function currentAppVersion() {
  if (cachedAppVersion !== undefined) return cachedAppVersion;
  try {
    const raw = fs.readFileSync(path.resolve(__dirname, '../../public/releases.json'), 'utf8');
    const releases = JSON.parse(raw);
    cachedAppVersion = Array.isArray(releases) && releases.length ? releases[0].version : null;
  } catch {
    // An unreadable/missing releases.json must not stop the measurement being taken - a row with a
    // null app_version is still usable for everything except the before/after split.
    cachedAppVersion = null;
  }
  return cachedAppVersion;
}

const KINDS = ['create', 'edit'];
const CREATION_SOURCES = ['manual', 'from_file', 'quick']; // quick: ML-424, a piece entered as an outline
// 'extras' is the single Extras step of 0.39 (ML-424); ML-428 split it into one question a step and added About and Media.
const QUICK_STEPS = ['about', 'howLong', 'marks', 'time', 'speed', 'extras', 'xIntro', 'xRepeats', 'xPauses', 'xRamps', 'xSigns', 'mAudio', 'mVideo', 'mDocs', 'media', 'tempo']; // media: the one Media step (it was three until 0.44); tempo: time and speed as one step (0.44)
// ML-424: the per-step figures and what the piece held - only known shapes are kept
function cleanSteps(steps) {
  if (!Array.isArray(steps)) return null;
  const out = steps.filter(s => s && QUICK_STEPS.includes(s.step)).slice(0, QUICK_STEPS.length)
    .map(s => ({ step: s.step, seconds: clampSeconds(s.seconds), taps: clampCount(s.taps), keys: clampCount(s.keys), visits: clampCount(s.visits) }));
  return out.length ? JSON.stringify(out) : null;
}
function cleanOutlineCounts(c) {
  if (!c || typeof c !== 'object') return null;
  return JSON.stringify({ marks: clampCount(c.marks), exceptions: clampCount(c.exceptions), speeds: clampCount(c.speeds), extras: clampCount(c.extras) });
}
const DEVICE_KINDS = ['mobile', 'tablet', 'desktop'];
const FINAL_OUTCOMES = ['completed', 'abandoned'];

// 24h. Not a business rule, just a ceiling on nonsense: a client whose tab slept through a laptop
// suspend, or whose clock jumped, can otherwise report a number that quietly destroys every average
// it lands in. Clamped rather than rejected so the rest of the row (block counts, outcome) survives.
const MAX_REPORTED_SECONDS = 86400;

function clampSeconds(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.min(Math.round(n), MAX_REPORTED_SECONDS);
}

function clampCount(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.min(Math.round(n), 100000);
}

function toDto(row) {
  return {
    id: Number(row.id),
    kind: row.kind,
    startedAt: row.started_at,
    idleThresholdSeconds: row.idle_threshold_seconds
  };
}

// Started server-side rather than only written at the end, so an attempt that never reaches Play
// still leaves a row behind. assertFlowAccess is the same personal/band/admin-public check every
// other flow route uses - a stats row must not become a way to probe whether a flow id exists.
export async function startAuthoringSession(accountId, scoreId, {
  kind,
  creationSource = 'manual',
  deviceKind = null,
  idleThresholdSeconds,
  blockCountStart = 0
} = {}) {
  if (!KINDS.includes(kind)) throw withStatus(400, 'Invalid authoring session kind.');
  if (!CREATION_SOURCES.includes(creationSource)) throw withStatus(400, 'Invalid creation source.');
  if (deviceKind !== null && !DEVICE_KINDS.includes(deviceKind)) throw withStatus(400, 'Invalid device kind.');
  const idleThreshold = Number(idleThresholdSeconds);
  if (!Number.isFinite(idleThreshold) || idleThreshold <= 0) throw withStatus(400, 'Invalid idle threshold.');

  const flow = await assertFlowAccess(accountId, scoreId);

  const { rows } = await pool.query(
    `INSERT INTO flow_authoring_sessions
       (account_id, score_id, flow_title, kind, creation_source, device_kind,
        idle_threshold_seconds, block_count_start, block_count_end, app_version, last_heartbeat_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $8, $9, now())
     RETURNING id, kind, started_at, idle_threshold_seconds`,
    [
      accountId,
      scoreId,
      flow.title || null,
      kind,
      creationSource,
      deviceKind,
      Math.round(idleThreshold),
      clampCount(blockCountStart),
      currentAppVersion()
    ]
  );
  return toDto(rows[0]);
}

// One endpoint for both the periodic heartbeat and the final write - they carry the same payload,
// the only difference being whether `outcome` is present. Keeping them as one call means an
// abandoned-but-heartbeaten row and a completed row are built by exactly the same code path, so a
// row that never gets its final write is still a correctly-shaped row, just an in_progress one.
//
// Once an outcome is set the row is closed: a late-arriving heartbeat (a keepalive request that
// lost the race with the final write, say) must not reopen it or overwrite the finalised numbers.
// That's the `outcome = 'in_progress'` in the WHERE clause, not an accident.
export async function updateAuthoringSession(accountId, sessionId, {
  activeSeconds,
  barsActiveSeconds,
  elapsedSeconds,
  blockCountEnd,
  totalBarsEnd,
  blocksAdded,
  blocksEdited,
  blocksDeleted,
  tapCount,
  keyCount,
  steps,
  outlineCounts,
  outcome = null
} = {}) {
  if (outcome !== null && !FINAL_OUTCOMES.includes(outcome)) {
    throw withStatus(400, 'Invalid authoring session outcome.');
  }

  const { rows } = await pool.query(
    `UPDATE flow_authoring_sessions
        SET active_seconds = $3,
            bars_active_seconds = $4,
            elapsed_seconds = $5,
            block_count_end = $6,
            total_bars_end = $7,
            blocks_added = $8,
            blocks_edited = $9,
            blocks_deleted = $10,
            tap_count = $12,
            key_count = $13,
            steps = COALESCE($14::jsonb, steps),
            outline_counts = COALESCE($15::jsonb, outline_counts),
            outcome = COALESCE($11, outcome),
            ended_at = CASE WHEN $11 IS NULL THEN ended_at ELSE now() END,
            last_heartbeat_at = now(),
            -- Refreshed from the flow itself, not from the client: during a create the name is
            -- usually typed after this row already exists, so the title captured at start is
            -- typically the auto-generated "Untitled". Left as-is if the flow has since been
            -- deleted, which is exactly the case the snapshot exists for.
            flow_title = COALESCE((SELECT title FROM scores WHERE id = flow_authoring_sessions.score_id), flow_title)
      WHERE id = $1 AND account_id = $2 AND outcome = 'in_progress'
      RETURNING id`,
    [
      sessionId,
      accountId,
      clampSeconds(activeSeconds),
      clampSeconds(barsActiveSeconds),
      clampSeconds(elapsedSeconds),
      clampCount(blockCountEnd),
      clampCount(totalBarsEnd),
      clampCount(blocksAdded),
      clampCount(blocksEdited),
      clampCount(blocksDeleted),
      outcome,
      clampCount(tapCount),
      clampCount(keyCount),
      cleanSteps(steps),
      cleanOutlineCounts(outlineCounts)
    ]
  );
  // Not a 404: an already-closed row is the normal outcome of a racing keepalive write, and the
  // client has nothing useful to do about it either way.
  return { updated: rows.length > 0 };
}

// ========================================
// ADMIN READ PATH (ML-199) - super-admin-only, via server/routes/admin.js. Everything below is
// reporting; nothing here writes a measurement.
//
// Definitions the whole report hangs on, kept in one place so the admin UI can state them rather
// than leaving a reader to guess what an average is actually over:
//
//   ELIGIBLE   outcome = 'completed' AND is_excluded = false. Every statistic is over these rows
//              only. An abandoned attempt has no meaningful "time to build a flow", and an
//              excluded one was explicitly judged unrepresentative.
//   STALE      outcome = 'in_progress' with no heartbeat for STALE_AFTER_MINUTES. The client
//              heartbeats every 15s while the Hub is open, so this is a session whose browser went
//              away without a final write (closed tab, killed mobile app). Counted as abandoned in
//              the abandonment rate, but never averaged - its seconds are a lower bound, not a
//              measurement.
//   PER BLOCK  bars_active_seconds divided by block count.
//   PER BAR    bars_active_seconds divided by bar count. Both are reported because they answer
//              different questions and a flow's blocks are not all the same length: one 16-bar
//              block and sixteen 1-bar blocks are the same music but very different data entry.
//              Per-block measures the cost of the card UI; per-bar measures the cost per unit of
//              actual music, which is the fair way to compare flows of different lengths.
//
// MEDIAN, MIN AND MAX are all reported alongside the mean. With a baseline of a few dozen runs a
// single interrupted session moves a mean visibly, so the median leads - but min/max are what show
// the spread, and a min and max miles apart mean the median isn't yet describing anything stable.
// ========================================

const STALE_AFTER_MINUTES = 10;

const ELIGIBLE = `outcome = 'completed' AND is_excluded = false`;

// A create's cost is spread over every block in the finished flow; an edit's over the blocks it
// actually touched (dividing an edit by the whole flow would make a one-bar tweak to a 40-bar flow
// look 40x cheaper than it was). NULLIF keeps a zero denominator out of the statistics entirely
// rather than producing a divide-by-zero or a misleading 0.
const perBlockExpr = `
  CASE WHEN kind = 'create'
       THEN bars_active_seconds::numeric / NULLIF(block_count_end, 0)
       ELSE bars_active_seconds::numeric / NULLIF(blocks_added + blocks_edited + blocks_deleted, 0)
  END`;

// Deliberately NULL for an edit session rather than a number: total_bars_end is the whole flow's
// bar count, and an edit touches an unknown subset of it, so any per-bar figure for an edit would
// be arithmetic rather than a measurement. Blank is the honest answer; the edit rows still report
// per-block, where the denominator IS known.
const perBarExpr = `
  CASE WHEN kind = 'create'
       THEN bars_active_seconds::numeric / NULLIF(total_bars_end, 0)
       ELSE NULL
  END`;

// The statistic block every grouped view repeats. Kept as one string so "median seconds per bar"
// means exactly the same thing in the by-version table as in the headline - the entire point of
// this feature is comparing those two, and they'd be worthless if the definitions drifted.
const STAT_COLUMNS = `
  COUNT(*)::int AS n,
  ROUND(percentile_cont(0.5) WITHIN GROUP (ORDER BY active_seconds))::int AS median_active_seconds,
  ROUND(AVG(active_seconds))::int AS mean_active_seconds,
  MIN(active_seconds)::int AS min_active_seconds,
  MAX(active_seconds)::int AS max_active_seconds,
  ROUND(percentile_cont(0.5) WITHIN GROUP (ORDER BY bars_active_seconds))::int AS median_bars_seconds,
  ROUND(AVG(bars_active_seconds))::int AS mean_bars_seconds,
  MIN(bars_active_seconds)::int AS min_bars_seconds,
  MAX(bars_active_seconds)::int AS max_bars_seconds,
  ROUND(percentile_cont(0.5) WITHIN GROUP (ORDER BY elapsed_seconds))::int AS median_elapsed_seconds,
  ROUND(AVG(block_count_end), 1)::float AS mean_blocks,
  ROUND(AVG(total_bars_end), 1)::float AS mean_bars,
  -- ::numeric before the 2-arg ROUND: percentile_cont has no numeric variant, so it always returns
  -- double precision, and ROUND(double precision, integer) does not exist in Postgres.
  ROUND((percentile_cont(0.5) WITHIN GROUP (ORDER BY ${perBlockExpr}))::numeric, 1)::float AS median_seconds_per_block,
  ROUND(AVG(${perBlockExpr}), 1)::float AS mean_seconds_per_block,
  ROUND(MIN(${perBlockExpr}), 1)::float AS min_seconds_per_block,
  ROUND(MAX(${perBlockExpr}), 1)::float AS max_seconds_per_block,
  ROUND((percentile_cont(0.5) WITHIN GROUP (ORDER BY ${perBarExpr}))::numeric, 1)::float AS median_seconds_per_bar,
  ROUND(AVG(${perBarExpr}), 1)::float AS mean_seconds_per_bar,
  ROUND(MIN(${perBarExpr}), 1)::float AS min_seconds_per_bar,
  ROUND(MAX(${perBarExpr}), 1)::float AS max_seconds_per_bar`;

function toStatsDto(row, extra = {}) {
  return {
    n: row.n,
    active: {
      median: row.median_active_seconds, mean: row.mean_active_seconds,
      min: row.min_active_seconds, max: row.max_active_seconds
    },
    bars: {
      median: row.median_bars_seconds, mean: row.mean_bars_seconds,
      min: row.min_bars_seconds, max: row.max_bars_seconds
    },
    perBlock: {
      median: row.median_seconds_per_block, mean: row.mean_seconds_per_block,
      min: row.min_seconds_per_block, max: row.max_seconds_per_block
    },
    perBar: {
      median: row.median_seconds_per_bar, mean: row.mean_seconds_per_bar,
      min: row.min_seconds_per_bar, max: row.max_seconds_per_bar
    },
    medianElapsedSeconds: row.median_elapsed_seconds,
    meanBlocks: row.mean_blocks,
    meanBars: row.mean_bars,
    ...extra
  };
}

export async function getFlowAuthoringStats() {
  // Creates entered by hand only - bar by bar ('manual') or Quick entry ('quick') - for the headline and the
  // version/device/size breakdowns: the question is "how long does it take to build a flow by hand", so an
  // import-assisted session doesn't belong in it even though it is recorded and shown in the kind/source
  // breakdown. Quick entry was left out of these until 0.40 (they asked for 'manual' only), so nothing made
  // since 0.39 showed under By app version.
  const MANUAL_CREATE = `${ELIGIBLE} AND kind = 'create' AND creation_source IN ('manual', 'quick')`;

  const [headline, byVersion, byKind, byDevice, bySize, outcomes, recent] = await Promise.all([
    pool.query(`SELECT ${STAT_COLUMNS} FROM flow_authoring_sessions WHERE ${MANUAL_CREATE}`),

    // THE before/after table. Ordered by the numeric parts of the semver rather than the string, so
    // 0.9.0 doesn't sort above 0.23.0 - which it would, and which would put the wrong row at the
    // top of exactly the comparison this feature exists for.
    pool.query(
      // One row per version and way in, so a version's quick entry runs aren't averaged with its bar-by-bar ones
      `SELECT app_version, creation_source, ${STAT_COLUMNS} FROM flow_authoring_sessions
        WHERE ${MANUAL_CREATE}
        GROUP BY app_version, creation_source
        ORDER BY string_to_array(COALESCE(app_version, '0'), '.')::int[] DESC NULLS LAST, creation_source DESC`
    ),

    pool.query(
      `SELECT kind, creation_source, ${STAT_COLUMNS} FROM flow_authoring_sessions
        WHERE ${ELIGIBLE} GROUP BY kind, creation_source ORDER BY kind, creation_source`
    ),

    pool.query(
      `SELECT COALESCE(device_kind, 'unknown') AS device_kind, ${STAT_COLUMNS} FROM flow_authoring_sessions
        WHERE ${MANUAL_CREATE} GROUP BY device_kind ORDER BY device_kind`
    ),

    // Does a longer piece cost proportionally more, or is there a fixed overhead? That's ML-199's
    // "length of flows have a different input time", and it decides whether a redesign should
    // attack per-bar cost or the setup around it. Bucketed by BARS, not blocks - bars are the unit
    // of actual music, and it's the same reason per-bar is reported alongside per-block above.
    pool.query(
      `SELECT CASE WHEN total_bars_end <= 8 THEN '1-8 bars'
                   WHEN total_bars_end <= 32 THEN '9-32 bars'
                   ELSE '33+ bars' END AS bucket,
              MIN(total_bars_end) AS sort_key, ${STAT_COLUMNS}
         FROM flow_authoring_sessions
        WHERE ${MANUAL_CREATE}
        GROUP BY bucket ORDER BY sort_key`
    ),

    // Abandonment. A stale in_progress row counts as abandoned here (see STALE above) - treating it
    // as "still going" would quietly understate how often an attempt is walked away from.
    pool.query(
      `SELECT
         COUNT(*) FILTER (WHERE outcome = 'completed')::int AS completed,
         COUNT(*) FILTER (WHERE outcome = 'abandoned')::int AS abandoned,
         COUNT(*) FILTER (WHERE outcome = 'in_progress'
                            AND last_heartbeat_at < now() - ($1 || ' minutes')::interval)::int AS stale,
         COUNT(*) FILTER (WHERE outcome = 'in_progress'
                            AND last_heartbeat_at >= now() - ($1 || ' minutes')::interval)::int AS live,
         COUNT(*) FILTER (WHERE is_excluded)::int AS excluded
       FROM flow_authoring_sessions`,
      [STALE_AFTER_MINUTES]
    ),

    // The raw rows behind the statistics, so a surprising median can be traced to the run that
    // caused it and excluded, rather than just distrusted.
    pool.query(
      `SELECT fas.id, fas.flow_title, fas.kind, fas.creation_source, fas.outcome, fas.started_at,
              fas.active_seconds, fas.bars_active_seconds, fas.elapsed_seconds,
              fas.block_count_start, fas.block_count_end, fas.total_bars_end,
              fas.blocks_added, fas.blocks_edited, fas.blocks_deleted, fas.tap_count, fas.key_count, fas.steps, fas.outline_counts,
              fas.device_kind, fas.app_version, fas.is_excluded, fas.exclusion_reason,
              fas.score_id IS NULL AS flow_deleted,
              CASE WHEN a.deleted_at IS NULL THEN a.email ELSE 'Deleted account' END AS email
         FROM flow_authoring_sessions fas
         JOIN accounts a ON a.id = fas.account_id
        ORDER BY fas.started_at DESC
        LIMIT 100`
    )
  ]);

  // ML-424: quick entry, step by step - where the time and the taps go, over the completed quick runs
  const quickSteps = await pool.query(
    `SELECT s->>'step' AS step, COUNT(*)::int AS n,
            ROUND(AVG((s->>'seconds')::numeric))::int AS seconds, ROUND(AVG((s->>'taps')::numeric))::int AS taps,
            ROUND(AVG((s->>'keys')::numeric))::int AS keys, ROUND(AVG((s->>'visits')::numeric), 1)::float AS visits
       FROM flow_authoring_sessions, jsonb_array_elements(steps) s
      WHERE ${ELIGIBLE} AND creation_source = 'quick' AND steps IS NOT NULL
      GROUP BY 1`
  );
  // Manual against quick: the whole create, with the work it took
  const byMethod = await pool.query(
    `SELECT creation_source, COUNT(*)::int AS n,
            ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY active_seconds))::int AS seconds,
            ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY tap_count))::int AS taps,
            ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY key_count))::int AS keys,
            ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY total_bars_end))::int AS bars,
            ROUND((PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY active_seconds::numeric / NULLIF(total_bars_end, 0)))::numeric, 2)::float AS seconds_per_bar
       FROM flow_authoring_sessions
      WHERE ${ELIGIBLE} AND kind = 'create' AND creation_source IN ('manual', 'quick')
      GROUP BY 1 ORDER BY 1`
  );

  const o = outcomes.rows[0];
  const abandonedTotal = o.abandoned + o.stale;
  const decided = o.completed + abandonedTotal;

  return {
    staleAfterMinutes: STALE_AFTER_MINUTES,
    headline: toStatsDto(headline.rows[0]),
    byVersion: byVersion.rows.map(r => toStatsDto(r, { appVersion: r.app_version, creationSource: r.creation_source })),
    byKind: byKind.rows.map(r => toStatsDto(r, { kind: r.kind, creationSource: r.creation_source })),
    byDevice: byDevice.rows.map(r => toStatsDto(r, { deviceKind: r.device_kind })),
    bySize: bySize.rows.map(r => toStatsDto(r, { bucket: r.bucket })),
    byMethod: byMethod.rows.map(r => ({ creationSource: r.creation_source, n: r.n, seconds: r.seconds, taps: r.taps, keys: r.keys, bars: r.bars, secondsPerBar: r.seconds_per_bar })),
    quickSteps: QUICK_STEPS.map(step => quickSteps.rows.find(r => r.step === step)).filter(Boolean).map(r => ({ step: r.step, n: r.n, seconds: r.seconds, taps: r.taps, keys: r.keys, visits: r.visits })),
    outcomes: {
      completed: o.completed,
      abandoned: o.abandoned,
      stale: o.stale,
      live: o.live,
      excluded: o.excluded,
      // Null rather than 0 when nothing has finished yet - "0% abandoned" reads as a real finding,
      // "no data" doesn't.
      abandonRate: decided ? Math.round((abandonedTotal / decided) * 100) : null
    },
    recent: recent.rows.map(r => ({
      id: Number(r.id),
      flowTitle: r.flow_title,
      flowDeleted: r.flow_deleted,
      email: r.email,
      kind: r.kind,
      creationSource: r.creation_source,
      outcome: r.outcome,
      startedAt: r.started_at,
      activeSeconds: r.active_seconds,
      barsActiveSeconds: r.bars_active_seconds,
      elapsedSeconds: r.elapsed_seconds,
      blockCountStart: r.block_count_start,
      blockCountEnd: r.block_count_end,
      totalBarsEnd: r.total_bars_end,
      blocksAdded: r.blocks_added,
      blocksEdited: r.blocks_edited,
      blocksDeleted: r.blocks_deleted,
      tapCount: r.tap_count,
      keyCount: r.key_count,
      steps: r.steps,
      outlineCounts: r.outline_counts,
      deviceKind: r.device_kind,
      appVersion: r.app_version,
      isExcluded: r.is_excluded,
      exclusionReason: r.exclusion_reason
    }))
  };
}

// Excluding is a reporting judgement ("the phone rang during that one"), not a correction, so it is
// reversible and keeps the row and its numbers intact - never a delete.
export async function setFlowAuthoringSessionExcluded(sessionId, isExcluded, reason) {
  const { rows } = await pool.query(
    `UPDATE flow_authoring_sessions
        SET is_excluded = $2,
            exclusion_reason = CASE WHEN $2 THEN $3 ELSE NULL END
      WHERE id = $1
      RETURNING id, is_excluded, exclusion_reason`,
    [sessionId, !!isExcluded, reason || null]
  );
  if (!rows.length) throw withStatus(404, 'Authoring session not found');
  return { id: Number(rows[0].id), isExcluded: rows[0].is_excluded, exclusionReason: rows[0].exclusion_reason };
}
