// ML-581: the band leader's summary - how the band's players are getting on with one of the band's pieces, never
// anyone by name or on their own (product value 2, the owner's decisions of 22 Oct 2026; docs/practice-sessions.md,
// "The band leader's summary").
//
// Made only from the players in the band now who switched on "I'm happy to share my piece levels anonymously at a
// summary level only to the band leader" (band_members.shares_levels), and only from their Levels on the band's own
// piece - not a copy of it. A player's Level for a bar is what their own heat map shows (FlowJourney.barLevels); their
// Level for the piece is the average over the bars they have Levels on.
//
// Nothing is shown for the piece until MIN_PLAYERS have shared Levels on it, and a bar is left blank until
// MIN_PLAYERS have a Level on that bar. The answer holds numbers only - no account, no name, no count of how many
// shared or of who hasn't - so it can't point at anyone (a unit test checks).

import pool from '../config/db.js';
import { withStatus, assertFlowReadAccess } from './flows.js';
import { pieceBarCount, FlowJourney } from './practiceLevels.js';
import { isBandLeaderOf } from './bands.js';

export const MIN_PLAYERS = 3; // the owner: 3, not 5 - "with only 25 people in a band, 5 is a high number"
const MOST_WORK_SPREAD = 0.5; // a bar within half a Level of the lowest average is one of those needing most work
const MOST_WORK_SHOWN = 3;
const TOP_LEVEL = 5; // full speed

const oneDecimal = (n) => Math.round(n * 10) / 10;
const mean = (xs) => xs.reduce((s, x) => s + x, 0) / xs.length;

/**
 * Pure - unit tested. players: one array per player of their Level for each bar (null where they have none).
 * Returns { enough, bars: [{ avg, lo, hi } | null], piece: { avg, lo, hi } | null, mostWork: [{ from, to, avg }] }
 * - bars numbered from 1 in mostWork.
 */
export function summariseLevels(players, totalBars, min = MIN_PLAYERS) {
  const withLevels = players.filter((p) => p.some((v) => v != null));
  if (withLevels.length < min) return { enough: false, bars: [], piece: null, mostWork: [] };
  const bars = Array.from({ length: totalBars }, (_, i) => {
    const vs = withLevels.map((p) => p[i]).filter((v) => v != null);
    return vs.length >= min ? { avg: oneDecimal(mean(vs)), lo: Math.min(...vs), hi: Math.max(...vs) } : null;
  });
  const pieceLevels = withLevels.map((p) => mean(p.filter((v) => v != null)));
  const piece = { avg: oneDecimal(mean(pieceLevels)), lo: oneDecimal(Math.min(...pieceLevels)), hi: oneDecimal(Math.max(...pieceLevels)) };

  // The bars needing the most work: runs of bars within half a Level of the lowest average, lowest first.
  const shown = bars.filter(Boolean);
  const lowest = shown.length ? Math.min(...shown.map((b) => b.avg)) : null;
  const runs = [];
  if (lowest != null && lowest < TOP_LEVEL) { // every bar at full speed: nothing needs the most work
    let run = null;
    bars.forEach((b, i) => {
      if (b && b.avg <= lowest + MOST_WORK_SPREAD) {
        if (run && run.to === i) { run.to = i + 1; run.avgs.push(b.avg); } else { run = { from: i + 1, to: i + 1, avgs: [b.avg] }; runs.push(run); }
      } else run = null;
    });
  }
  const mostWork = runs.map((r) => ({ from: r.from, to: r.to, avg: oneDecimal(mean(r.avgs)) }))
    .sort((a, b) => a.avg - b.avg || a.from - b.from).slice(0, MOST_WORK_SHOWN);
  return { enough: true, bars, piece, mostWork };
}

// For the band leader of the piece's band only. A piece that isn't a band's has no summary.
export async function bandLevelsSummary(accountId, scoreId) {
  const score = await assertFlowReadAccess(accountId, scoreId);
  const bandId = score.owner_band_id ? Number(score.owner_band_id) : null;
  if (!bandId) throw withStatus(404, 'Only a band\'s own pieces have a band summary.');
  if (!(await isBandLeaderOf(accountId, bandId))) throw withStatus(403, 'Only the band leader sees the band summary.');
  const totalBars = await pieceBarCount(scoreId);
  const { rows } = await pool.query(
    `SELECT pc.account_id, pc.start_bar, pc.end_bar, pc.level
       FROM piece_chunks pc
       JOIN band_members bm ON bm.account_id = pc.account_id AND bm.band_id = $2 AND bm.shares_levels
      WHERE pc.score_id = $1 AND pc.level IS NOT NULL`,
    [scoreId, bandId]
  );
  const byPlayer = new Map();
  for (const r of rows) {
    const k = String(r.account_id);
    if (!byPlayer.has(k)) byPlayer.set(k, []);
    byPlayer.get(k).push({ startBar: Number(r.start_bar), endBar: Number(r.end_bar), level: Number(r.level) });
  }
  // The ids are dropped here - nothing below knows whose Levels are whose.
  const players = [...byPlayer.values()].map((chunks) => FlowJourney.barLevels(totalBars, chunks));
  return { title: score.title, totalBars, minimum: MIN_PLAYERS, ...summariseLevels(players, totalBars) };
}
