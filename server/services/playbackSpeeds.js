// Metronome Blocks' play-speed presets (ML-109) - see db/migrations/025_playback_speed_options.sql
// for why this is a table now instead of hardcoded buttons. Not per-account - shared across every
// account, same as duration_options.

import pool from '../config/db.js';
import { withStatus } from './metronomeSetups.js';

// What the Blocks speed picker itself offers - active presets only, low to high.
export async function listActivePlaybackSpeeds() {
  const { rows } = await pool.query(
    'SELECT percent FROM playback_speed_options WHERE active = true ORDER BY percent'
  );
  return rows.map(r => r.percent);
}

// ---- Admin panel (ML-109) - no usage-check on delete: a play-speed choice is a live playback
// setting, never stored against a saved block, same carve-out the ticket itself gives duration_options. ----

export async function listPlaybackSpeedsForAdmin() {
  const { rows } = await pool.query(
    'SELECT id, percent, active FROM playback_speed_options ORDER BY percent'
  );
  return rows.map(r => ({ id: Number(r.id), percent: r.percent, active: r.active }));
}

export async function createPlaybackSpeedOption(percent) {
  const p = Number(percent);
  if (!Number.isInteger(p) || p <= 0) throw withStatus(400, 'Enter a whole-number percentage greater than 0.');
  try {
    const { rows } = await pool.query(
      'INSERT INTO playback_speed_options (percent) VALUES ($1) RETURNING id, percent, active',
      [p]
    );
    return { id: Number(rows[0].id), percent: rows[0].percent, active: rows[0].active };
  } catch (error) {
    if (error.code === '23505') throw withStatus(409, `${p}% is already in the list.`);
    throw error;
  }
}

export async function updatePlaybackSpeedOption(id, { percent, active }) {
  const p = Number(percent);
  if (!Number.isInteger(p) || p <= 0) throw withStatus(400, 'Enter a whole-number percentage greater than 0.');
  try {
    const { rows } = await pool.query(
      'UPDATE playback_speed_options SET percent = $1, active = $2 WHERE id = $3 RETURNING id',
      [p, !!active, id]
    );
    if (!rows.length) throw withStatus(404, 'Playback speed not found');
  } catch (error) {
    if (error.code === '23505') throw withStatus(409, `${p}% is already in the list.`);
    throw error;
  }
}

export async function deletePlaybackSpeedOption(id) {
  const { rows } = await pool.query('DELETE FROM playback_speed_options WHERE id = $1 RETURNING id', [id]);
  if (!rows.length) throw withStatus(404, 'Playback speed not found');
}
