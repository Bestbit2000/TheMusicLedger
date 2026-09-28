// ML-322 / ML-305: your playing range per instrument (the notes you can play comfortably now,
// account_instruments.bottom_note / top_note) and the Range tool's goes and Levels (range_note_levels,
// range_goes - db/migrations/065_range.sql). Behind the range_trainer feature.
//
// A go is re-scored here with the same engine the app runs (public/range.js, loaded with vm like
// drills.js): the note is always the one just beyond your stored range - never a note the client names -
// and the Level comes from the beats held. docs/range.md has the rules.
import fs from 'node:fs';
import vm from 'node:vm';
import pool from '../config/db.js';
import { withStatus } from './flows.js';
import { isFeatureEnabled } from './features.js';

const sandbox = { self: {} };
for (const f of ['notation.js', 'range.js']) {
  vm.runInNewContext(fs.readFileSync(new URL(`../../public/${f}`, import.meta.url), 'utf8'), sandbox);
}
const PlayRange = sandbox.self.PlayRange;
const plain = (v) => JSON.parse(JSON.stringify(v));

export async function assertRangeEnabled() {
  if (!(await isFeatureEnabled('range_trainer'))) throw withStatus(404, 'Range is not switched on.');
}

const outerOf = (r) => (r.range_low && r.range_high ? { low: r.range_low, high: r.range_high } : null);

async function accountInstrument(accountId, instrumentId, client = pool) {
  const { rows } = await client.query(
    `SELECT ai.bottom_note, ai.top_note, i.id, i.name, i.theory_clef, i.written_to_concert, i.range_low, i.range_high
     FROM account_instruments ai JOIN instruments i ON i.id = ai.instrument_id
     WHERE ai.account_id = $1 AND ai.instrument_id = $2`,
    [accountId, instrumentId]
  );
  if (!rows.length) throw withStatus(404, 'You don\'t play that instrument - add it in My account first.');
  return rows[0];
}

// Your instruments with their range, and the Level of every note beyond it that you've tried.
export async function getRange(accountId) {
  const { rows } = await pool.query(
    `SELECT ai.bottom_note, ai.top_note, ai.is_primary, i.id, i.name, i.theory_clef, i.written_to_concert, i.range_low, i.range_high
     FROM account_instruments ai JOIN instruments i ON i.id = ai.instrument_id
     WHERE ai.account_id = $1 ORDER BY ai.is_primary DESC, ai.created_at, i.name`,
    [accountId]
  );
  const { rows: levels } = await pool.query(
    `SELECT instrument_id, note_midi, note, level, best_beats, streak, goes FROM range_note_levels WHERE account_id = $1`,
    [accountId]
  );
  return {
    instruments: rows.map(r => ({
      instrumentId: Number(r.id), name: r.name, isPrimary: r.is_primary, clef: r.theory_clef,
      writtenToConcert: r.written_to_concert, outer: outerOf(r),
      bottom: r.bottom_note, top: r.top_note,
      levels: levels.filter(l => Number(l.instrument_id) === Number(r.id)).map(l => ({
        midi: l.note_midi, note: l.note, level: l.level, bestBeats: Number(l.best_beats), streak: l.streak, goes: l.goes
      }))
    }))
  };
}

// Sets (or, with both null, clears) your comfortable bottom and top notes.
export async function setRange(accountId, instrumentId, { bottom, top } = {}) {
  const r = await accountInstrument(accountId, instrumentId);
  const outer = outerOf(r);
  if (!outer) throw withStatus(400, 'Range doesn\'t apply to this instrument.');
  if (bottom === null && top === null) {
    await pool.query('UPDATE account_instruments SET bottom_note = NULL, top_note = NULL WHERE account_id = $1 AND instrument_id = $2', [accountId, instrumentId]);
    return getRange(accountId);
  }
  // Kept as spelled on the picker (F♯ going up, G♭ coming down): a letter, one sharp or flat, an octave.
  const clean = (p) => (/^[A-G](#|b)?\d$/.test(String(p)) ? String(p) : null);
  const range = { bottom: clean(bottom), top: clean(top) };
  const problem = PlayRange.checkRange(range, outer);
  if (problem) throw withStatus(400, problem);
  await pool.query(
    'UPDATE account_instruments SET bottom_note = $3, top_note = $4 WHERE account_id = $1 AND instrument_id = $2',
    [accountId, instrumentId, range.bottom, range.top]
  );
  return getRange(accountId);
}

// A go at the note just beyond your range: how many beats you held it, and how that was measured.
// Returns the note's new Level and whether this go took it to Level 5 (the app then asks to move).
export async function recordGo(accountId, instrumentId, { direction, beats, bpm, method } = {}) {
  if (!PlayRange.DIRECTIONS.includes(direction)) throw withStatus(400, 'Direction must be up or down.');
  if (!['mic', 'self'].includes(method)) throw withStatus(400, 'Unknown method.');
  const b = Number(beats), tempo = Math.round(Number(bpm));
  if (!Number.isFinite(b) || b < 0) throw withStatus(400, 'Beats must be a number.');
  if (!Number.isInteger(tempo) || tempo < 30 || tempo > 200) throw withStatus(400, 'Tempo must be 30-200 bpm.');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const r = await accountInstrument(accountId, instrumentId, client);
    const t = PlayRange.target({ bottom: r.bottom_note, top: r.top_note }, outerOf(r), direction);
    if (!t) throw withStatus(400, 'There\'s no note beyond your range to work on - set your range first.');
    const { rows } = await client.query(
      'SELECT level, best_beats, streak, goes FROM range_note_levels WHERE account_id = $1 AND instrument_id = $2 AND note_midi = $3 FOR UPDATE',
      [accountId, instrumentId, t.midi]
    );
    const before = rows.length ? { level: rows[0].level, streak: rows[0].streak, bestBeats: Number(rows[0].best_beats), goes: rows[0].goes } : null;
    const after = plain(PlayRange.applyGo(before, b));
    await client.query(
      `INSERT INTO range_note_levels (account_id, instrument_id, note_midi, note, level, best_beats, streak, goes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (account_id, instrument_id, note_midi) DO UPDATE SET
         level = EXCLUDED.level, best_beats = EXCLUDED.best_beats, streak = EXCLUDED.streak, goes = EXCLUDED.goes, updated_at = now()`,
      [accountId, instrumentId, t.midi, t.pitch, after.level, after.bestBeats, after.streak, after.goes]
    );
    await client.query(
      `INSERT INTO range_goes (account_id, instrument_id, direction, note_midi, beats, bpm, method, level_after)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [accountId, instrumentId, direction, t.midi, Math.min(PlayRange.MAX_BEATS, Math.round(b * 100) / 100), tempo, method, after.level]
    );
    await client.query('COMMIT');
    return { note: t.pitch, midi: t.midi, ...after };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

// "Yes, move my range": only once the note beyond it has reached Level 5 - it becomes your new top (or
// bottom) note, and the next one out becomes the note to work on.
export async function moveRange(accountId, instrumentId, { direction } = {}) {
  if (!PlayRange.DIRECTIONS.includes(direction)) throw withStatus(400, 'Direction must be up or down.');
  const r = await accountInstrument(accountId, instrumentId);
  const t = PlayRange.target({ bottom: r.bottom_note, top: r.top_note }, outerOf(r), direction);
  if (!t) throw withStatus(400, 'There\'s no note beyond your range to move to.');
  const { rows } = await pool.query(
    'SELECT level FROM range_note_levels WHERE account_id = $1 AND instrument_id = $2 AND note_midi = $3',
    [accountId, instrumentId, t.midi]
  );
  if (!rows.length || rows[0].level < 5) throw withStatus(400, `${PlayRange.label(t.pitch)} isn't at Level 5 yet.`);
  await pool.query(
    `UPDATE account_instruments SET ${direction === 'up' ? 'top_note' : 'bottom_note'} = $3 WHERE account_id = $1 AND instrument_id = $2`,
    [accountId, instrumentId, t.pitch]
  );
  return getRange(accountId);
}
