// Global feature gates (ML-190) - the running app's own read path against the `features` catalog
// (admin panel's Features page, server/routes/admin.js owns the CRUD: key/name/description/
// enabled). Deliberately separate from plan_feature_flags (per-subscription-plan billing gating,
// still unwired) - this is a single, global on/off switch an admin flips for everyone.
//
// A feature_key with no row here at all is treated as enabled - this is opt-in gating (a feature
// has to be added to the catalog AND have code checking it to ever be turned off), not a
// default-deny allowlist that would silently gate every unlisted feature.

import pool from '../config/db.js';

export async function isFeatureEnabled(featureKey) {
  const { rows } = await pool.query('SELECT enabled FROM features WHERE feature_key = $1', [featureKey]);
  return rows.length ? rows[0].enabled : true;
}

// For the client's own startup bootstrap (GET /api/dropdown-options) - every enabled feature_key
// in one list, so the frontend can gate UI without a request per feature.
export async function listEnabledFeatureKeys() {
  const { rows } = await pool.query('SELECT feature_key FROM features WHERE enabled = true');
  return rows.map((r) => r.feature_key);
}
