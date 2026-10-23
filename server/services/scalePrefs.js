// ML-589: the Scales tool's settings (accounts.scale_prefs) - they follow the account to every device, as Warm-ups'
// (ML-586, server/services/warmups.js). The keys and values are checked by the same rules the app reads them back
// with: ScaleGrades.cleanPrefs in public/scaleGrades.js, loaded with vm as the tests load it.
import fs from 'node:fs';
import vm from 'node:vm';
import pool from '../config/db.js';

const sandbox = { self: {} };
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(new URL('../../public/scaleGrades.js', import.meta.url), 'utf8'), sandbox);
const ScaleGrades = sandbox.self.ScaleGrades;

// {} = nothing chosen yet (the app saves the device's copy the first time).
export async function getScalePrefs(accountId) {
  const { rows } = await pool.query('SELECT scale_prefs FROM accounts WHERE id = $1', [accountId]);
  return rows[0]?.scale_prefs || {};
}
export async function saveScalePrefs(accountId, prefs) {
  const clean = ScaleGrades.cleanPrefs(prefs);
  // Merged, so one setting can be saved without resending the others.
  const { rows } = await pool.query(
    'UPDATE accounts SET scale_prefs = scale_prefs || $2::jsonb WHERE id = $1 RETURNING scale_prefs',
    [accountId, JSON.stringify(clean)]);
  return rows[0]?.scale_prefs || {};
}
