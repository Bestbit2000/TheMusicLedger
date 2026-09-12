// Tool-level duration presets (ML-7) - shared across the save-session screen
// and the practice timer, not account-scoped. See db/migrations/011_duration_options.sql.

import pool from '../config/db.js';
import { withStatus } from './metronomeSetups.js';

export async function listDurationOptions() {
  const { rows } = await pool.query(
    'SELECT minutes FROM duration_options WHERE active = true ORDER BY sort_order'
  );
  return rows.map(r => r.minutes);
}

// Admin panel "Usage" stats (ML-109 follow-up) - sessions.total_duration_minutes isn't a real
// reference to duration_options (a session just stores whatever number of minutes was entered,
// custom or preset), so this counts by VALUE match, not a join on a foreign key. A session's minutes
// happening to equal a preset by coincidence rather than the preset actually being picked is possible
// but considered unlikely enough not to matter. Every duration (active or not) is included, for a
// complete historical picture rather than just what's currently offered.
export async function listDurationUsageStats() {
  const { rows } = await pool.query(
    `SELECT dopt.minutes, COUNT(s.id) AS usage_count
     FROM duration_options dopt
     LEFT JOIN sessions s ON s.total_duration_minutes = dopt.minutes
     GROUP BY dopt.id, dopt.minutes
     ORDER BY dopt.sort_order`
  );
  return rows.map(r => ({ minutes: r.minutes, usageCount: Number(r.usage_count) }));
}

// ---- Admin panel (ML-109) - no usage-check on delete: a duration is a value typed into a session/
// timer at the moment it's used, never stored by reference, so removing a preset can't orphan
// anything already saved. sort_order is set to one past the current max, then editable directly -
// simplest way to let an admin reorder without a drag-and-drop UI. ----

export async function listDurationOptionsForAdmin() {
  const { rows } = await pool.query(
    'SELECT id, minutes, sort_order, active FROM duration_options ORDER BY sort_order'
  );
  return rows.map(r => ({ id: Number(r.id), minutes: r.minutes, sortOrder: r.sort_order, active: r.active }));
}

export async function createDurationOption(minutes) {
  const m = Number(minutes);
  if (!Number.isInteger(m) || m <= 0) throw withStatus(400, 'Enter a whole number of minutes greater than 0.');
  try {
    const maxOrder = await pool.query('SELECT COALESCE(MAX(sort_order), 0) AS max FROM duration_options');
    const { rows } = await pool.query(
      'INSERT INTO duration_options (minutes, sort_order) VALUES ($1, $2) RETURNING id, minutes, sort_order, active',
      [m, Number(maxOrder.rows[0].max) + 1]
    );
    return { id: Number(rows[0].id), minutes: rows[0].minutes, sortOrder: rows[0].sort_order, active: rows[0].active };
  } catch (error) {
    if (error.code === '23505') throw withStatus(409, `${m} minutes is already in the list.`);
    throw error;
  }
}

export async function updateDurationOption(id, { minutes, sortOrder, active }) {
  const m = Number(minutes);
  if (!Number.isInteger(m) || m <= 0) throw withStatus(400, 'Enter a whole number of minutes greater than 0.');
  try {
    const { rows } = await pool.query(
      'UPDATE duration_options SET minutes = $1, sort_order = $2, active = $3 WHERE id = $4 RETURNING id',
      [m, Number(sortOrder) || 0, !!active, id]
    );
    if (!rows.length) throw withStatus(404, 'Duration not found');
  } catch (error) {
    if (error.code === '23505') throw withStatus(409, `${m} minutes is already in the list.`);
    throw error;
  }
}

export async function deleteDurationOption(id) {
  const { rows } = await pool.query('DELETE FROM duration_options WHERE id = $1 RETURNING id', [id]);
  if (!rows.length) throw withStatus(404, 'Duration not found');
}
