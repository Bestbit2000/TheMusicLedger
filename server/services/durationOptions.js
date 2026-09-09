// Tool-level duration presets (ML-7) - shared across the save-session screen
// and the practice timer, not account-scoped. See db/migrations/011_duration_options.sql.

import pool from '../config/db.js';

export async function listDurationOptions() {
  const { rows } = await pool.query(
    'SELECT minutes FROM duration_options WHERE active = true ORDER BY sort_order'
  );
  return rows.map(r => r.minutes);
}
