// ML-321 (epic ML-314): your skills list - the playing skills you're working on, each at a step of its
// tool's own ladder. What the skills and their steps are lives in the browser (app.js, SKILLS - they
// come from Drills, TheoryEngine and the warm-up exercises); here are the list, where you're up to, and
// every go at a step. See db/migrations/064_practice_templates_skills.sql.
import pool from '../config/db.js';
import { withStatus } from './flows.js';
import { WARMUP_KIND_IDS } from './warmups.js';

const KEY = /^[a-zA-Z][a-zA-Z0-9]*(:[a-z0-9-]+)?$/;

function toItem(r) {
  return { id: Number(r.id), key: r.skill_key, stepIndex: Number(r.step_index), sortOrder: r.sort_order, lastPractised: r.last_practised };
}
// Your progress on every skill you've had on a list (ML-339: shared by all your lists).
export async function listSkills(accountId) {
  const { rows } = await pool.query('SELECT * FROM skill_list_items WHERE account_id = $1 ORDER BY sort_order, id', [accountId]);
  return rows.map(toItem);
}

// ---- ML-339: named skills lists ----
function toList(r) {
  return { id: Number(r.id), name: r.name, keys: r.skill_keys || [] };
}
function cleanName(name) {
  const n = String(name ?? '').trim().slice(0, 60);
  if (!n) throw withStatus(400, 'Give the list a name.');
  return n;
}
function cleanKeys(keys) {
  if (!Array.isArray(keys) || keys.length > 40) throw withStatus(400, 'A skills list has up to 40 skills.');
  const clean = [...new Set(keys.map(String))];
  if (clean.some(k => !KEY.test(k) || k.length > 60)) throw withStatus(400, 'Unknown skill.');
  return clean;
}
// A skill going on a list gets its progress row (step 0) the first time.
async function ensureProgress(accountId, keys) {
  for (const k of keys) {
    await pool.query('INSERT INTO skill_list_items (account_id, skill_key) VALUES ($1, $2) ON CONFLICT (account_id, skill_key) DO NOTHING', [accountId, k]);
  }
}
export async function listSkillLists(accountId) {
  const { rows } = await pool.query('SELECT * FROM skill_lists WHERE account_id = $1 ORDER BY sort_order, id', [accountId]);
  return rows.map(toList);
}
// Everything My skills and the planner need: your lists and your progress.
export async function getSkillsAndLists(accountId) {
  const [lists, skills] = await Promise.all([listSkillLists(accountId), listSkills(accountId)]);
  return { lists, skills };
}
export async function createSkillList(accountId, { name, keys = [] } = {}) {
  const clean = cleanKeys(keys);
  const { rows: count } = await pool.query('SELECT count(*)::int AS n FROM skill_lists WHERE account_id = $1', [accountId]);
  if (count[0].n >= 20) throw withStatus(400, 'You can have up to 20 skills lists.');
  await ensureProgress(accountId, clean);
  await pool.query('INSERT INTO skill_lists (account_id, name, skill_keys, sort_order) VALUES ($1, $2, $3, $4)', [accountId, cleanName(name), clean, count[0].n]);
  return getSkillsAndLists(accountId);
}
export async function updateSkillList(accountId, id, { name, keys } = {}) {
  const sets = [];
  const values = [];
  const add = (col, v) => { values.push(v); sets.push(`${col} = $${values.length}`); };
  if (name !== undefined) add('name', cleanName(name));
  if (keys !== undefined) { const clean = cleanKeys(keys); await ensureProgress(accountId, clean); add('skill_keys', clean); }
  if (sets.length) {
    values.push(Number(id), accountId);
    const { rowCount } = await pool.query(`UPDATE skill_lists SET ${sets.join(', ')}, updated_at = now() WHERE id = $${values.length - 1} AND account_id = $${values.length}`, values);
    if (!rowCount) throw withStatus(404, 'Skills list not found');
  }
  return getSkillsAndLists(accountId);
}
export async function deleteSkillList(accountId, id) {
  const { rowCount } = await pool.query('DELETE FROM skill_lists WHERE id = $1 AND account_id = $2', [Number(id), accountId]);
  if (!rowCount) throw withStatus(404, 'Skills list not found');
  return getSkillsAndLists(accountId);
}

// ---- ML-343: your own warm-up lists (the standard ones live in public/practicePlan.js) ----
function toWarmupList(r) {
  return { id: Number(r.id), name: r.name, kinds: r.kinds, random: r.random_order };
}
export async function listWarmupLists(accountId) {
  const { rows } = await pool.query('SELECT * FROM warmup_lists WHERE account_id = $1 ORDER BY id', [accountId]);
  return rows.map(toWarmupList);
}
export async function saveWarmupList(accountId, id, { name, kinds, random } = {}) {
  const n = cleanName(name);
  const k = [...new Set((Array.isArray(kinds) ? kinds : []).map(String))];
  if (!k.length || k.some(x => !WARMUP_KIND_IDS.includes(x))) throw withStatus(400, 'Choose at least one kind of warm-up.');
  if (id == null) {
    const { rows } = await pool.query('SELECT count(*)::int AS n FROM warmup_lists WHERE account_id = $1', [accountId]);
    if (rows[0].n >= 20) throw withStatus(400, 'You can have up to 20 warm-up lists.');
    await pool.query('INSERT INTO warmup_lists (account_id, name, kinds, random_order) VALUES ($1, $2, $3, $4)', [accountId, n, k, !!random]);
  } else {
    const { rowCount } = await pool.query('UPDATE warmup_lists SET name = $1, kinds = $2, random_order = $3, updated_at = now() WHERE id = $4 AND account_id = $5', [n, k, !!random, Number(id), accountId]);
    if (!rowCount) throw withStatus(404, 'Warm-up list not found');
  }
  return listWarmupLists(accountId);
}
export async function deleteWarmupList(accountId, id) {
  const { rowCount } = await pool.query('DELETE FROM warmup_lists WHERE id = $1 AND account_id = $2', [Number(id), accountId]);
  if (!rowCount) throw withStatus(404, 'Warm-up list not found');
  return listWarmupLists(accountId);
}
// A go at a step. Passing the step you're on moves you to the next (up to stepCount = all done).
export async function recordSkillResult(accountId, { key, stepIndex, passed, grade, stepCount } = {}) {
  if (!KEY.test(String(key || ''))) throw withStatus(400, 'Unknown skill.');
  const step = Math.round(Number(stepIndex));
  const count = Math.round(Number(stepCount));
  if (!(step >= 0) || !(count >= 1) || step >= count) throw withStatus(400, 'That step isn\'t in this skill.');
  const g = grade == null ? null : Math.round(Number(grade));
  if (g !== null && !(g >= 1 && g <= 5)) throw withStatus(400, 'grade must be 1-5.');
  await pool.query('INSERT INTO skill_step_results (account_id, skill_key, step_index, passed, grade) VALUES ($1, $2, $3, $4, $5)', [accountId, key, step, !!passed, g]);
  await pool.query(
    `UPDATE skill_list_items SET last_practised = now(),
            step_index = CASE WHEN $3 AND step_index = $4 THEN LEAST($4 + 1, $5) ELSE step_index END
      WHERE account_id = $1 AND skill_key = $2`,
    [accountId, key, !!passed, step, count]);
  return listSkills(accountId);
}
