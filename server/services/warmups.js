// ML-294: warm-up exercises (db/migrations/055_warmups.sql). The app reads the switched-on ones;
// super admins edit them in Admin -> Warm-ups. Every save is checked with the same engine the tool
// and editor use (public/warmups.js, loaded with vm like theoryPractice.js loads theoryEngine.js), so a
// stored exercise always draws and plays - bars add up, pitches in range.
import fs from 'node:fs';
import vm from 'node:vm';
import pool from '../config/db.js';
import { withStatus } from './flows.js';
import { isFeatureEnabled } from './features.js';

const sandbox = { self: {} };
for (const f of ['notation.js', 'warmups.js']) {
  vm.runInNewContext(fs.readFileSync(new URL(`../../public/${f}`, import.meta.url), 'utf8'), sandbox);
}
const Warmups = sandbox.self.Warmups;

const COLS = 'id, title, kind, tip, notes, beats_per_bar, bpm, sort_order, is_active, updated_at';
function toExercise(row) {
  return {
    id: Number(row.id),
    title: row.title,
    kind: row.kind,
    tip: row.tip,
    notes: row.notes,
    beatsPerBar: row.beats_per_bar,
    bpm: row.bpm,
    sortOrder: row.sort_order,
    isActive: row.is_active,
    updatedAt: row.updated_at,
  };
}

export async function assertWarmupsEnabled() {
  if (!(await isFeatureEnabled('warmups'))) throw withStatus(403, "This feature isn't available right now.");
}

// The tool: switched-on exercises, in order.
export async function listActiveWarmups() {
  const { rows } = await pool.query(`SELECT ${COLS} FROM warmup_exercises WHERE is_active ORDER BY sort_order, id`);
  return rows.map(toExercise);
}

// Admin: every exercise, switched off ones included.
export async function listWarmupsForAdmin() {
  const { rows } = await pool.query(`SELECT ${COLS} FROM warmup_exercises ORDER BY sort_order, id`);
  return rows.map(toExercise);
}

// Checks and tidies an exercise from the admin editor; throws 400 with every problem.
function validated(body) {
  const title = String(body.title || '').trim();
  const tip = String(body.tip || '').trim();
  const kind = String(body.kind || '');
  const beatsPerBar = Number(body.beatsPerBar);
  const bpm = Math.round(Number(body.bpm));
  const notes = (Array.isArray(body.notes) ? body.notes : []).map((n) => {
    const out = { p: n && n.p ? String(n.p) : null, d: n && n.d };
    if (n && n.dot) out.dot = true;
    return out;
  });
  const errors = [];
  if (!title || title.length > 80) errors.push('A title (up to 80 characters) is needed.');
  if (tip.length > 200) errors.push('Keep the tip to 200 characters.');
  if (!Warmups.KIND_IDS.includes(kind)) errors.push('Choose a kind.');
  if (!(bpm >= 30 && bpm <= 200)) errors.push('Tempo must be 30 to 200.');
  const check = Warmups.check({ beatsPerBar, notes });
  errors.push(...check.errors);
  if (errors.length) throw withStatus(400, errors.join(' '));
  return { title, tip, kind, beatsPerBar, bpm, notes, isActive: body.isActive !== false };
}

export async function createWarmup(body) {
  const e = validated(body);
  const { rows } = await pool.query(
    `INSERT INTO warmup_exercises (title, kind, tip, notes, beats_per_bar, bpm, is_active, sort_order)
     VALUES ($1, $2, $3, $4::jsonb, $5, $6, $7, (SELECT COALESCE(MAX(sort_order), 0) + 10 FROM warmup_exercises))
     RETURNING ${COLS}`,
    [e.title, e.kind, e.tip, JSON.stringify(e.notes), e.beatsPerBar, e.bpm, e.isActive]
  );
  return toExercise(rows[0]);
}

export async function updateWarmup(id, body) {
  const e = validated(body);
  const { rows } = await pool.query(
    `UPDATE warmup_exercises SET title = $1, kind = $2, tip = $3, notes = $4::jsonb, beats_per_bar = $5, bpm = $6,
       is_active = $7, updated_at = now() WHERE id = $8 RETURNING ${COLS}`,
    [e.title, e.kind, e.tip, JSON.stringify(e.notes), e.beatsPerBar, e.bpm, e.isActive, id]
  );
  if (!rows.length) throw withStatus(404, 'Exercise not found');
  return toExercise(rows[0]);
}

// Switch one on or off without re-sending the notes.
export async function setWarmupActive(id, isActive) {
  const { rows } = await pool.query(`UPDATE warmup_exercises SET is_active = $1, updated_at = now() WHERE id = $2 RETURNING ${COLS}`, [!!isActive, id]);
  if (!rows.length) throw withStatus(404, 'Exercise not found');
  return toExercise(rows[0]);
}

// Move one place earlier (-1) or later (+1) in the overall order: swaps sort_order with its neighbour.
export async function moveWarmup(id, direction) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query('SELECT id, sort_order FROM warmup_exercises ORDER BY sort_order, id FOR UPDATE');
    const i = rows.findIndex((r) => Number(r.id) === Number(id));
    if (i < 0) throw withStatus(404, 'Exercise not found');
    const j = i + (direction < 0 ? -1 : 1);
    if (j >= 0 && j < rows.length) {
      // Renumber in tens, then swap the two - keeps the order unique even if sort_order had ties.
      const ids = rows.map((r) => Number(r.id));
      [ids[i], ids[j]] = [ids[j], ids[i]];
      for (let k = 0; k < ids.length; k++) await client.query('UPDATE warmup_exercises SET sort_order = $1 WHERE id = $2', [(k + 1) * 10, ids[k]]);
    }
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function deleteWarmup(id) {
  const { rows } = await pool.query('DELETE FROM warmup_exercises WHERE id = $1 RETURNING id', [id]);
  if (!rows.length) throw withStatus(404, 'Exercise not found');
}
