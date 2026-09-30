// Feature gates (ML-190, by account type since ML-345) - the running app's read path against the
// `features` catalog and `feature_access`. See docs/feature-access-plan.md.
//
// A feature is on for someone when:
//   - it's Live (features.enabled - the master switch: off turns it off for everyone), and
//   - their account type has it: Super admin always does; any other type needs its feature_access
//     row switched on. A type with no row (a brand-new feature) doesn't have it yet.
// A feature_key that isn't in the catalog at all is not gated (opt-in gating, as before).
//
// The account type comes from the request (resolveAccount runs the rest of the request inside
// featureContext), so callers keep writing isFeatureEnabled('key'). With no request context (a
// script), only Live counts.
//
// The whole table is small, so it's held in memory for 30 seconds; the admin page clears it on save.
// Other server instances pick a change up within those 30 seconds.

import { AsyncLocalStorage } from 'node:async_hooks';
import pool from '../config/db.js';

export const featureContext = new AsyncLocalStorage();

// Every account type, in the order the admin page shows them.
export const ACCOUNT_TYPES = [
  { key: 'standard_member', label: 'Standard member' },
  { key: 'premium_member', label: 'Premium member' },
  { key: 'beta_tester', label: 'Beta tester' },
  { key: 'teacher', label: 'Teacher' },
  { key: 'band_admin', label: 'Band admin' },
  { key: 'super_admin', label: 'Super admin' }
];
export const ACCOUNT_TYPE_KEYS = ACCOUNT_TYPES.map(t => t.key);
const EDITABLE_TYPES = ACCOUNT_TYPE_KEYS.filter(k => k !== 'super_admin');

// entry: { live, levels: { [type]: boolean } } or undefined (not in the catalog). Pure - unit tested.
export function featureOn(entry, level) {
  if (!entry) return true;
  if (!entry.live) return false;
  if (!level) return true; // no account in context: Live alone
  if (level === 'super_admin') return true;
  return entry.levels[level] === true;
}

const TTL_MS = 30000;
let cache = null;
let cacheAt = 0;
let limitsCache = null;
let limitsCacheAt = 0;
export function clearFeatureCache() { cache = null; limitsCache = null; }

// ---- ML-383: limits by account type (feature_limits / feature_limit_values) ----
// A number per account type, set on Admin -> Feature access (Limits) - e.g. how many Metronome plays
// Show history lists. Cached like the feature matrix.
async function loadLimits() {
  if (limitsCache && Date.now() - limitsCacheAt < TTL_MS) return limitsCache;
  const { rows } = await pool.query(
    'SELECT l.limit_key, v.account_level, v.value FROM feature_limits l JOIN feature_limit_values v ON v.limit_id = l.id');
  const byKey = new Map();
  for (const r of rows) {
    if (!byKey.has(r.limit_key)) byKey.set(r.limit_key, {});
    byKey.get(r.limit_key)[r.account_level] = Number(r.value);
  }
  limitsCache = byKey;
  limitsCacheAt = Date.now();
  return limitsCache;
}
// Pure - unit tested. values: { [type]: n } or undefined. No account in context -> the lowest (safest).
export function limitFor(values, level, fallback) {
  if (!values) return fallback;
  if (level) return Number.isFinite(values[level]) ? values[level] : fallback;
  const all = Object.values(values).filter(Number.isFinite);
  return all.length ? Math.min(...all) : fallback;
}
export async function getLimit(limitKey, fallback, level = contextLevel()) {
  return limitFor((await loadLimits()).get(limitKey), level, fallback);
}
// For the client's startup bootstrap - every limit for this account's type, { key: n }.
export async function listLimits(level = contextLevel()) {
  const limits = await loadLimits();
  return Object.fromEntries([...limits.entries()].map(([key, values]) => [key, limitFor(values, level, null)]));
}

async function loadMatrix() {
  if (cache && Date.now() - cacheAt < TTL_MS) return cache;
  const [features, access] = await Promise.all([
    pool.query('SELECT id, feature_key, enabled FROM features'),
    pool.query('SELECT feature_id, account_level, enabled FROM feature_access')
  ]);
  const byId = new Map();
  const byKey = new Map();
  for (const f of features.rows) {
    const entry = { live: f.enabled, levels: {} };
    byId.set(String(f.id), entry);
    byKey.set(f.feature_key, entry);
  }
  for (const a of access.rows) {
    const entry = byId.get(String(a.feature_id));
    if (entry) entry.levels[a.account_level] = a.enabled;
  }
  cache = byKey;
  cacheAt = Date.now();
  return cache;
}

const contextLevel = () => featureContext.getStore()?.accountLevel || null;

export async function isFeatureEnabled(featureKey, level = contextLevel()) {
  return featureOn((await loadMatrix()).get(featureKey), level);
}

// ML-355: a feature's Live switch alone, for things used before anyone has logged in (password login).
// Unlike isFeatureEnabled, a feature missing from the table reads as OFF - fail closed.
export async function isFeatureLive(featureKey) {
  return !!(await loadMatrix()).get(featureKey)?.live;
}

// For the client's own startup bootstrap (GET /api/dropdown-options) - every feature_key on for this
// account's type, so the frontend can gate UI without a request per feature.
export async function listEnabledFeatureKeys(level = contextLevel()) {
  const matrix = await loadMatrix();
  return [...matrix.entries()].filter(([, entry]) => featureOn(entry, level)).map(([key]) => key);
}

// ---- Admin -> Feature access (super admins only - server/routes/admin.js) ----
export const LIMIT_MAX = 100000;
export async function getFeatureAccess() {
  const [features, access, limits, limitValues] = await Promise.all([
    pool.query('SELECT id, feature_key, name, description, enabled FROM features ORDER BY name'),
    pool.query('SELECT feature_id, account_level, enabled FROM feature_access'),
    pool.query('SELECT l.id, l.limit_key, l.name, l.description, f.feature_key FROM feature_limits l LEFT JOIN features f ON f.id = l.feature_id ORDER BY l.name'),
    pool.query('SELECT limit_id, account_level, value FROM feature_limit_values')
  ]);
  const valuesByLimit = new Map();
  for (const v of limitValues.rows) {
    const k = String(v.limit_id);
    if (!valuesByLimit.has(k)) valuesByLimit.set(k, {});
    valuesByLimit.get(k)[v.account_level] = Number(v.value);
  }
  const byFeature = new Map();
  for (const a of access.rows) {
    const k = String(a.feature_id);
    if (!byFeature.has(k)) byFeature.set(k, {});
    byFeature.get(k)[a.account_level] = a.enabled;
  }
  return {
    types: ACCOUNT_TYPES,
    features: features.rows.map(f => {
      const levels = byFeature.get(String(f.id)) || {};
      return {
        id: Number(f.id), featureKey: f.feature_key, name: f.name, description: f.description, live: f.enabled,
        access: Object.fromEntries(ACCOUNT_TYPE_KEYS.map(t => [t, t === 'super_admin' ? true : levels[t] === true]))
      };
    }),
    // ML-383: a number per account type (null = no value set yet)
    limits: limits.rows.map(l => {
      const values = valuesByLimit.get(String(l.id)) || {};
      return {
        id: Number(l.id), limitKey: l.limit_key, name: l.name, description: l.description, featureKey: l.feature_key || null,
        values: Object.fromEntries(ACCOUNT_TYPE_KEYS.map(t => [t, Number.isFinite(values[t]) ? values[t] : null]))
      };
    })
  };
}

// changes: { live: [{ featureId, enabled }], access: [{ featureId, level, enabled }],
// limits: [{ limitId, level, value }] (ML-383) } - saved together.
export async function saveFeatureAccess({ live = [], access = [], limits = [] } = {}) {
  if (!Array.isArray(live) || !Array.isArray(access) || !Array.isArray(limits) || live.length + access.length + limits.length > 2000) {
    const e = new Error('Bad changes.'); e.status = 400; throw e;
  }
  for (const a of access) {
    if (!EDITABLE_TYPES.includes(a.level)) { const e = new Error('Super admin always has every feature.'); e.status = 400; throw e; }
  }
  for (const l of limits) {
    if (!ACCOUNT_TYPE_KEYS.includes(l.level)) { const e = new Error('Unknown account type.'); e.status = 400; throw e; }
    if (!Number.isInteger(l.value) || l.value < 0 || l.value > LIMIT_MAX) { const e = new Error(`A limit is a whole number from 0 to ${LIMIT_MAX}.`); e.status = 400; throw e; }
  }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const l of live) {
      await client.query('UPDATE features SET enabled = $1, updated_at = now() WHERE id = $2', [!!l.enabled, Number(l.featureId)]);
    }
    for (const a of access) {
      await client.query(
        `INSERT INTO feature_access (feature_id, account_level, enabled) VALUES ($1, $2, $3)
         ON CONFLICT (feature_id, account_level) DO UPDATE SET enabled = EXCLUDED.enabled, updated_at = now()`,
        [Number(a.featureId), a.level, !!a.enabled]);
    }
    for (const l of limits) {
      await client.query(
        `INSERT INTO feature_limit_values (limit_id, account_level, value) VALUES ($1, $2, $3)
         ON CONFLICT (limit_id, account_level) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`,
        [Number(l.limitId), l.level, l.value]);
    }
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
  clearFeatureCache();
  return getFeatureAccess();
}
