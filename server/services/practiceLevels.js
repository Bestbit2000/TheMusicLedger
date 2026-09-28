// ML-315 (epic ML-314): a piece's practice Levels - its chunks, each with a Level 1-5 (or not set),
// per account. See db/migrations/061_practice_levels.sql. The maths (Level %, sub-beats, chunk fit,
// the per-bar map) is in public/flowJourney.js, loaded here with vm like warmups.js loads its engine,
// so the server checks chunks with the same code the app runs.
import fs from 'node:fs';
import vm from 'node:vm';
import pool from '../config/db.js';
import { withStatus, assertFlowReadAccess } from './flows.js';
import { isFeatureEnabled } from './features.js';

const sandbox = { self: {} };
vm.runInNewContext(fs.readFileSync(new URL('../../public/flowJourney.js', import.meta.url), 'utf8'), sandbox);
const FlowJourney = sandbox.self.FlowJourney;

const KINDS = ['whole', 'hard', 'chunk', 'group'];
const SOURCES = ['setup', 'edit', 'during', 'rating'];

export async function assertPracticeLevelsEnabled() {
  if (!(await isFeatureEnabled('practice_levels'))) throw withStatus(403, "This feature isn't available right now.");
}

function toChunk(row) {
  return {
    id: Number(row.id),
    kind: row.kind,
    startBar: row.start_bar,
    endBar: row.end_bar,
    level: row.level == null ? null : Number(row.level),
    label: row.label,
    sortOrder: row.sort_order,
    updatedAt: row.updated_at,
  };
}

// The piece's length now: bars in its regular blocks (the lead-in isn't a numbered bar).
async function pieceBarCount(scoreId, client = pool) {
  const { rows } = await client.query(
    'SELECT COALESCE(SUM(bar_count), 0)::int AS bars FROM metronome_segments WHERE parent_score_id = $1 AND NOT is_lead_in',
    [scoreId]
  );
  return rows[0].bars;
}

async function subBeatsBelow(accountId) {
  const { rows } = await pool.query('SELECT practice_sub_beats_below FROM accounts WHERE id = $1', [accountId]);
  return rows.length ? Number(rows[0].practice_sub_beats_below) : FlowJourney.LEVELS.SUB_BEATS_BELOW;
}

// A piece's chunks for this account, plus what the screens need alongside them.
// barsChanged: the piece has a different number of bars now than when its chunks were saved.
export async function getPieceLevels(accountId, scoreId) {
  await assertFlowReadAccess(accountId, scoreId);
  const [{ rows }, totalBars, below] = await Promise.all([
    pool.query('SELECT * FROM piece_chunks WHERE account_id = $1 AND score_id = $2 ORDER BY sort_order, start_bar, id', [accountId, scoreId]),
    pieceBarCount(scoreId),
    subBeatsBelow(accountId),
  ]);
  const chunks = rows.map(toChunk);
  return {
    chunks,
    totalBars,
    barLevels: FlowJourney.barLevels(totalBars, chunks),
    barsChanged: rows.some(r => r.bars_total_at_setup !== totalBars),
    subBeatsBelow: below,
  };
}

function validateChunks(chunks, totalBars) {
  if (!Array.isArray(chunks)) throw withStatus(400, 'chunks must be a list.');
  if (chunks.length > 500) throw withStatus(400, 'Too many chunks.');
  if (!totalBars) throw withStatus(400, 'This piece has no bars yet.');
  const out = chunks.map((c, i) => {
    const kind = String(c.kind || '');
    const startBar = Number(c.startBar);
    const endBar = Number(c.endBar);
    const level = c.level == null || c.level === '' ? null : Number(c.level);
    if (!KINDS.includes(kind)) throw withStatus(400, `Chunk ${i + 1}: unknown kind.`);
    if (!Number.isInteger(startBar) || !Number.isInteger(endBar) || startBar < 1 || endBar < startBar || endBar > totalBars) {
      throw withStatus(400, `Chunk ${i + 1}: bars ${c.startBar}-${c.endBar} aren't in this piece (1-${totalBars}).`);
    }
    if (level !== null && (!Number.isInteger(level) || level < 1 || level > 5)) throw withStatus(400, `Chunk ${i + 1}: Level must be 1-5.`);
    const label = c.label == null ? null : String(c.label).trim().slice(0, 60) || null;
    const id = c.id == null ? null : Number(c.id);
    return { id, kind, startBar, endBar, level, label, sortOrder: i };
  });
  if (out.filter(c => c.kind === 'whole').length > 1) throw withStatus(400, 'A piece has at most one "whole piece" Level.');
  // Separate chunks (answer C) can't overlap each other; hard passages sit on top of the whole piece.
  const cut = out.filter(c => c.kind === 'chunk').sort((a, b) => a.startBar - b.startBar);
  for (let k = 1; k < cut.length; k++) {
    if (cut[k].startBar <= cut[k - 1].endBar) throw withStatus(400, `Chunks ${cut[k - 1].startBar}-${cut[k - 1].endBar} and ${cut[k].startBar}-${cut[k].endBar} overlap.`);
  }
  return out;
}

// Replace a piece's chunks (the setup screens save the whole set). Existing chunks are kept by id so
// their history stays attached; ones left out are deleted. Every new Level or changed Level is logged.
export async function replacePieceChunks(accountId, scoreId, chunks) {
  await assertFlowReadAccess(accountId, scoreId);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const totalBars = await pieceBarCount(scoreId, client);
    const incoming = validateChunks(chunks, totalBars);
    const { rows: existingRows } = await client.query(
      'SELECT * FROM piece_chunks WHERE account_id = $1 AND score_id = $2 FOR UPDATE', [accountId, scoreId]
    );
    const existing = new Map(existingRows.map(r => [Number(r.id), r]));
    const keep = new Set();
    for (const c of incoming) {
      const prev = c.id != null ? existing.get(c.id) : null;
      if (c.id != null && !prev) throw withStatus(400, 'One of those chunks belongs to a different piece.');
      let id;
      if (prev) {
        await client.query(
          `UPDATE piece_chunks SET kind = $2, start_bar = $3, end_bar = $4, level = $5, label = $6, sort_order = $7,
                  bars_total_at_setup = $8, updated_at = now() WHERE id = $1`,
          [c.id, c.kind, c.startBar, c.endBar, c.level, c.label, c.sortOrder, totalBars]
        );
        id = c.id;
        keep.add(id);
      } else {
        const { rows } = await client.query(
          `INSERT INTO piece_chunks (account_id, score_id, kind, start_bar, end_bar, level, label, sort_order, bars_total_at_setup)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id`,
          [accountId, scoreId, c.kind, c.startBar, c.endBar, c.level, c.label, c.sortOrder, totalBars]
        );
        id = Number(rows[0].id);
      }
      const before = prev && prev.level != null ? Number(prev.level) : null;
      if (c.level !== null && c.level !== before) {
        await client.query(
          `INSERT INTO chunk_level_changes (chunk_id, account_id, score_id, level_before, level_after, source)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [id, accountId, scoreId, before, c.level, prev ? 'edit' : 'setup']
        );
      }
    }
    const gone = [...existing.keys()].filter(id => !keep.has(id));
    if (gone.length) await client.query('DELETE FROM piece_chunks WHERE id = ANY($1::bigint[])', [gone]);
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
  return getPieceLevels(accountId, scoreId);
}

// One chunk's Level changes in practice: a Level up during a block, or the rating after it (up one,
// stay, down one, or a jump). percentPlayed is the speed it was played at.
export async function setChunkLevel(accountId, chunkId, { level, source, percentPlayed } = {}) {
  const lvl = Number(level);
  if (!Number.isInteger(lvl) || lvl < 1 || lvl > 5) throw withStatus(400, 'Level must be 1-5.');
  const src = SOURCES.includes(source) ? source : 'rating';
  const pct = percentPlayed == null ? null : Math.round(Number(percentPlayed));
  if (pct !== null && !(pct >= 1 && pct <= 100)) throw withStatus(400, 'percentPlayed must be 1-100.');
  const { rows } = await pool.query('SELECT * FROM piece_chunks WHERE id = $1 AND account_id = $2', [chunkId, accountId]);
  if (!rows.length) throw withStatus(404, 'Chunk not found');
  const prev = rows[0];
  await pool.query('UPDATE piece_chunks SET level = $2, updated_at = now() WHERE id = $1', [chunkId, lvl]);
  await pool.query(
    `INSERT INTO chunk_level_changes (chunk_id, account_id, score_id, level_before, level_after, source, percent_played)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [chunkId, accountId, prev.score_id, prev.level, lvl, src, pct]
  );
  return getPieceLevels(accountId, Number(prev.score_id));
}

// Settings -> practice: the speed below which session sub-beats switch on.
export async function setSubBeatsBelow(accountId, bpm) {
  const v = Math.round(Number(bpm));
  if (!(v >= 30 && v <= 200)) throw withStatus(400, 'Choose a speed between 30 and 200 bpm.');
  await pool.query('UPDATE accounts SET practice_sub_beats_below = $2 WHERE id = $1', [accountId, v]);
  return { subBeatsBelow: v };
}
