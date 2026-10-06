// ML-443: Admin -> Business case - the owner's plan of what each way of rolling the app out costs and
// could earn. The plan is one document (business_plans.plan, 102_business_case.sql): the sums are
// BusinessCase (public/businessCase.js), loaded here with vm like restMessages.js loads PracticePlan,
// so the page, the server and the tests run the same code. Until the owner saves a change the plan is
// the starting one (businessCaseDefaults.js). See docs/business-case.md.
import fs from 'node:fs';
import vm from 'node:vm';
import pool from '../config/db.js';
import { startingPlan } from './businessCaseDefaults.js';
import { costsAndUsage } from './thirdPartyUsage.js';
import { recordMonth, listActuals } from './businessActuals.js';

const sandbox = { self: {} };
vm.runInNewContext(fs.readFileSync(new URL('../../public/businessCase.js', import.meta.url), 'utf8'), sandbox);
export const BusinessCase = sandbox.self.BusinessCase;

const withStatus = (status, message) => Object.assign(new Error(message), { status });
const MAX_PLAN_BYTES = 200 * 1024;

// What is true today, to set beside the forecast: members, what has been spent (Costs and usage,
// ML-429) and how full the database's free allowance is. Each part is left out if it can't be read,
// so the page still loads.
async function today() {
  const out = { members: null, spent: null, perMonth: null, database: null, meters: [] };
  try {
    const { rows } = await pool.query('SELECT count(*)::int AS n FROM accounts WHERE deleted_at IS NULL');
    out.members = rows[0].n;
  } catch (error) { console.error('Business case: members not counted:', error.message); }
  try {
    const money = await costsAndUsage();
    out.spent = money.costs.spent.gbp;
    out.perMonth = money.costs.perMonth.gbp;
    const meter = money.usage.find((m) => m.key === 'neon-compute');
    if (meter && meter.status) out.database = { used: meter.status.value, limit: meter.limit, projected: meter.status.projected, readAt: meter.latest.readAt };
    // ML-443 Limits: every plan limit with its latest reading (none, or an old one, is "used: null")
    out.meters = money.usage.map((m) => ({
      key: m.key, party: m.party, name: m.name, unit: m.unit, limit: m.limit, per: m.per,
      used: m.status ? m.status.value : null, percent: m.status ? m.status.percent : null, projected: m.status ? m.status.projected : null,
      readAt: m.latest ? m.latest.readAt : null
    }));
  } catch (error) { console.error('Business case: costs and usage not read:', error.message); }
  return out;
}

async function savedRow() {
  const { rows } = await pool.query('SELECT id, plan, updated_at FROM business_plans ORDER BY id LIMIT 1');
  return rows[0] || null;
}

// The plan as the page needs it: the owner's saved one, or the starting one if nothing is saved yet.
export async function getBusinessCase() {
  const [row, now] = await Promise.all([savedRow(), today()]);
  let plan = null;
  if (row) {
    // A saved plan is tidied on the way out too, so a plan saved by an older version still works
    try { plan = BusinessCase.tidy(row.plan); } catch (error) { console.error('Business case: the saved plan could not be read, starting again:', error.message); }
  }
  const current = plan || BusinessCase.tidy(startingPlan());
  // ML-443 actual v forecast: this month is brought up to date each time the page is opened as well
  // as by the daily job; if that can't be done the page still loads.
  let actuals = [];
  try { await recordMonth(BusinessCase, current); actuals = await listActuals(); } catch (error) { console.error('Business case: actual v forecast not read:', error.message); }
  return { plan: current, saved: !!plan, savedAt: plan ? row.updated_at : null, today: now, actuals };
}

export async function saveBusinessCase(plan) {
  if (!plan || typeof plan !== 'object') throw withStatus(400, 'There is no plan to save.');
  if (Buffer.byteLength(JSON.stringify(plan)) > MAX_PLAN_BYTES) throw withStatus(400, 'The plan is too big to save.');
  const tidy = BusinessCase.tidy(plan); // throws with .status 400 and a message for the owner
  const row = await savedRow();
  if (row) await pool.query('UPDATE business_plans SET plan = $1, updated_at = now() WHERE id = $2', [JSON.stringify(tidy), row.id]);
  else await pool.query('INSERT INTO business_plans (plan) VALUES ($1)', [JSON.stringify(tidy)]);
  return getBusinessCase();
}

// Back to the starting figures: the saved plan is thrown away.
export async function resetBusinessCase() {
  await pool.query('DELETE FROM business_plans');
  return getBusinessCase();
}
