// Generic key/value app config (ML-47) - see db/migrations/026_app_config.sql for why this exists
// (admin-editable settings, like the PostHog dashboard link, that shouldn't need a release to change).

import pool from '../config/db.js';
import { withStatus } from './metronomeSetups.js';

export async function getConfigValue(key) {
  const { rows } = await pool.query('SELECT value FROM app_config WHERE key = $1', [key]);
  if (!rows.length) throw withStatus(404, `Unknown config key "${key}"`);
  return rows[0].value;
}

export async function setConfigValue(key, value) {
  const { rows } = await pool.query(
    `UPDATE app_config SET value = $1, updated_at = now() WHERE key = $2 RETURNING value`,
    [value, key]
  );
  if (!rows.length) throw withStatus(404, `Unknown config key "${key}"`);
  return rows[0].value;
}
