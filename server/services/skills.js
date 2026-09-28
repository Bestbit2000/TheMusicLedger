// ML-321 (epic ML-314): your skills list - the playing skills you're working on, each at a step of its
// tool's own ladder. What the skills and their steps are lives in the browser (app.js, SKILLS - they
// come from Drills, TheoryEngine and the warm-up exercises); here are the list, where you're up to, and
// every go at a step. See db/migrations/064_practice_templates_skills.sql.
import pool from '../config/db.js';
import { withStatus } from './flows.js';

const KEY = /^[a-zA-Z][a-zA-Z0-9]*(:[a-z0-9-]+)?$/;

function toItem(r) {
  return { id: Number(r.id), key: r.skill_key, stepIndex: Number(r.step_index), sortOrder: r.sort_order, lastPractised: r.last_practised };
}
export async function listSkills(accountId) {
  const { rows } = await pool.query('SELECT * FROM skill_list_items WHERE account_id = $1 ORDER BY sort_order, id', [accountId]);
  return rows.map(toItem);
}
// Replace the list with these skill keys, in order - skills kept keep their step.
export async function setSkills(accountId, keys) {
  if (!Array.isArray(keys) || keys.length > 40) throw withStatus(400, 'A skills list has up to 40 skills.');
  const clean = [...new Set(keys.map(String))];
  if (clean.some(k => !KEY.test(k) || k.length > 60)) throw withStatus(400, 'Unknown skill.');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('DELETE FROM skill_list_items WHERE account_id = $1 AND NOT (skill_key = ANY($2::text[]))', [accountId, clean]);
    for (let i = 0; i < clean.length; i++) {
      await client.query(
        `INSERT INTO skill_list_items (account_id, skill_key, sort_order) VALUES ($1, $2, $3)
         ON CONFLICT (account_id, skill_key) DO UPDATE SET sort_order = EXCLUDED.sort_order`,
        [accountId, clean[i], i]);
    }
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
  return listSkills(accountId);
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
