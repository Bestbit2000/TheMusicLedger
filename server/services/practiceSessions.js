// ML-320 (epic ML-314): the practice session builder. The planner and runner are in the browser
// (app.js); the server gives the Rehearsal blocks their chunks and logs a finished session as one
// `sessions` row plus its `session_segments` (db/migrations/062_practice_sessions.sql).
import pool from '../config/db.js';
import { withStatus } from './flows.js';
import { resolveSessionInstrument } from './instruments.js';

const KIND_TO_SEGMENT = { warmup: 'warm_up', scales: 'scales', skills: 'technique', rehearsal: 'performance', theory: 'theory' }; // theory: ML-418
const TOOLS = ['warmups', 'scales', 'tapTempo', 'gapTrainer', 'ear', 'range', 'rhythm'];

// Every chunk this account has given a Level, weakest first, then the one practised longest ago -
// what the planner hands out to Rehearsal blocks. last_practised counts Level ups and ratings only.
export async function listPracticeChunks(accountId) {
  const { rows } = await pool.query(
    `SELECT pc.id, pc.score_id, s.title, pc.kind, pc.start_bar, pc.end_bar, pc.level, pc.label,
            (SELECT MAX(c.created_at) FROM chunk_level_changes c
              WHERE c.chunk_id = pc.id AND c.source IN ('during', 'rating')) AS last_practised
       FROM piece_chunks pc
       JOIN scores s ON s.id = pc.score_id
      WHERE pc.account_id = $1 AND pc.level IS NOT NULL
      ORDER BY pc.level, last_practised NULLS FIRST, pc.score_id, pc.start_bar`,
    [accountId]
  );
  return rows.map(r => ({
    id: Number(r.id), scoreId: Number(r.score_id), title: r.title, kind: r.kind,
    startBar: r.start_bar, endBar: r.end_bar, level: Number(r.level), label: r.label,
    lastPractised: r.last_practised,
  }));
}

// A finished (or stopped early) session: minutes actually spent, and each block that was started.
// segments: [{ kind, plannedMinutes, actualSeconds, scoreId?, chunkId?, tool? }]
export async function savePracticeSession(accountId, { minutes, segments, instrumentId } = {}) {
  const total = Math.round(Number(minutes));
  if (!(total >= 1 && total <= 600)) throw withStatus(400, 'minutes must be 1-600.');
  if (!Array.isArray(segments) || !segments.length || segments.length > 48) throw withStatus(400, 'A session needs 1-48 blocks.');
  const segs = segments.map((s, i) => {
    const type = KIND_TO_SEGMENT[s.kind];
    if (!type) throw withStatus(400, `Block ${i + 1}: unknown kind.`);
    const tool = s.tool == null ? null : String(s.tool);
    if (tool !== null && !TOOLS.includes(tool)) throw withStatus(400, `Block ${i + 1}: unknown tool.`);
    const secs = Math.max(0, Math.round(Number(s.actualSeconds) || 0));
    return {
      type, order: i, planned: Math.max(1, Math.round(Number(s.plannedMinutes) || 5)), secs, tool,
      scoreId: s.scoreId == null ? null : Number(s.scoreId), chunkId: s.chunkId == null ? null : Number(s.chunkId),
    };
  });
  const instrument = await resolveSessionInstrument(accountId, instrumentId);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // A chunk or piece the account can't see is dropped from the log rather than failing the save.
    const chunkIds = segs.map(s => s.chunkId).filter(Boolean);
    const own = chunkIds.length
      ? new Set((await client.query('SELECT id FROM piece_chunks WHERE account_id = $1 AND id = ANY($2::bigint[])', [accountId, chunkIds])).rows.map(r => Number(r.id)))
      : new Set();
    const { rows } = await client.query(
      `INSERT INTO sessions (session_type, account_id, started_at, total_duration_minutes, instrument_id)
       VALUES ('practice', $1, now() - make_interval(mins => $2), $2, $3) RETURNING id`,
      [accountId, total, instrument]
    );
    const sessionId = Number(rows[0].id);
    for (const s of segs) {
      const chunkId = s.chunkId && own.has(s.chunkId) ? s.chunkId : null;
      await client.query(
        `INSERT INTO session_segments (session_id, segment_type, order_index, planned_duration_minutes, actual_seconds, score_id, chunk_id, tool)
         VALUES ($1, $2, $3, $4, $5, (SELECT score_id FROM piece_chunks WHERE id = $6), $6, $7)`,
        [sessionId, s.type, s.order, s.planned, s.secs, chunkId, s.tool]
      );
    }
    await client.query('COMMIT');
    return { sessionId, minutes: total, blocks: segs.length };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

// --- Your own templates (ML-320 follow-up) - "plans" on screen since ML-390 ---
// A plan made in Build my plan (ML-390) is its whole row of blocks (blocks); one saved before ML-390 is
// opening blocks + a focus (lead, focus) and keeps working that way.
const LEAD_KINDS = ['warmup', 'scales', 'skills', 'rehearsal', 'theory']; // theory: ML-418
function toTemplate(r) {
  return { id: Number(r.id), name: r.name, lead: r.lead_blocks, focus: r.focus, minutes: Number(r.minutes), blocks: r.blocks || null };
}
function validateTemplate(data) {
  const name = String(data.name || '').trim().slice(0, 40);
  if (!name) throw withStatus(400, 'Give your plan a name.');
  const blocks = Array.isArray(data.blocks) ? data.blocks.map(String) : null;
  if (blocks && (!blocks.length || blocks.length > 24 || blocks.some(k => !LEAD_KINDS.includes(k)))) throw withStatus(400, 'A plan is 1-24 blocks of Warm-up, Scales, Skills, Pieces or Theory.');
  const lead = blocks ? [] : Array.isArray(data.lead) ? data.lead.map(String) : [];
  if (lead.length > 24 || lead.some(k => !LEAD_KINDS.includes(k))) throw withStatus(400, 'Opening blocks must be Warm-up, Scales, Skills or Pieces (24 at most).');
  const focus = ['skills', 'both', 'rehearsal'].includes(data.focus) ? data.focus : 'both';
  const minutes = blocks ? blocks.length * 5 : Math.round(Number(data.minutes) / 5) * 5;
  if (!(minutes >= 5 && minutes <= 120)) throw withStatus(400, 'A session is 5-120 minutes.');
  return { name, lead, focus, minutes, blocks };
}
export async function listTemplates(accountId) {
  const { rows } = await pool.query('SELECT * FROM practice_templates WHERE account_id = $1 ORDER BY name, id', [accountId]);
  return rows.map(toTemplate);
}
export async function saveTemplate(accountId, templateId, data = {}) {
  const t = validateTemplate(data);
  if (templateId) {
    const { rows } = await pool.query(
      'UPDATE practice_templates SET name = $3, lead_blocks = $4, focus = $5, minutes = $6, blocks = $7 WHERE id = $1 AND account_id = $2 RETURNING *',
      [templateId, accountId, t.name, t.lead, t.focus, t.minutes, t.blocks]);
    if (!rows.length) throw withStatus(404, 'Template not found');
    return toTemplate(rows[0]);
  }
  const { rows: count } = await pool.query('SELECT COUNT(*)::int AS n FROM practice_templates WHERE account_id = $1', [accountId]);
  if (count[0].n >= 30) throw withStatus(400, 'You have 30 plans already - delete one first.');
  const { rows } = await pool.query(
    'INSERT INTO practice_templates (account_id, name, lead_blocks, focus, minutes, blocks) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
    [accountId, t.name, t.lead, t.focus, t.minutes, t.blocks]);
  return toTemplate(rows[0]);
}
export async function deleteTemplate(accountId, templateId) {
  const { rowCount } = await pool.query('DELETE FROM practice_templates WHERE id = $1 AND account_id = $2', [templateId, accountId]);
  if (!rowCount) throw withStatus(404, 'Plan not found');
  return { deleted: true };
}

// --- The session running now, kept so it carries on after a reload or on another device ---
// The browser sends the runner's state and how far into the current block it is; the block's start is
// stored by the database clock, and elapsedSeconds comes back worked out from it.
export async function getActivePractice(accountId) {
  const { rows } = await pool.query(
    `SELECT state, EXTRACT(EPOCH FROM (now() - block_started_at))::int AS elapsed,
            EXTRACT(EPOCH FROM (now() - updated_at))::int AS idle
       FROM active_practice_sessions WHERE account_id = $1`,
    [accountId]
  );
  if (!rows.length) return { active: null };
  return { active: { state: rows[0].state, elapsedSeconds: Math.max(0, rows[0].elapsed), idleSeconds: Math.max(0, rows[0].idle) } };
}
export async function putActivePractice(accountId, { state, blockElapsedSeconds } = {}) {
  if (!state || typeof state !== 'object') throw withStatus(400, 'state is required.');
  const json = JSON.stringify(state);
  if (json.length > 100000) throw withStatus(400, 'That session is too big to keep.');
  const elapsed = Math.max(0, Math.min(86400, Math.round(Number(blockElapsedSeconds) || 0)));
  await pool.query(
    `INSERT INTO active_practice_sessions (account_id, state, block_started_at, updated_at)
     VALUES ($1, $2::jsonb, now() - make_interval(secs => $3), now())
     ON CONFLICT (account_id) DO UPDATE SET state = EXCLUDED.state, block_started_at = EXCLUDED.block_started_at, updated_at = now()`,
    [accountId, json, elapsed]
  );
  return { saved: true };
}
export async function clearActivePractice(accountId) {
  await pool.query('DELETE FROM active_practice_sessions WHERE account_id = $1', [accountId]);
  return { cleared: true };
}
