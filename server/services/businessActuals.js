// ML-443: actual v forecast. One row a month in business_actuals (103): what really happened - members
// and money paid out - beside what the business case forecast for that month.
// - The actual figures are brought up to date whenever the month is recorded (every day, by the daily
//   job in routes/api.js, and when the business case is opened), so a month ends up as it stood on
//   its last day.
// - The forecast is written once, the first time the month is recorded, from the scenario the owner
//   was in then - and never changed, so editing the plan later can't hide how far out it was.
// See docs/business-case.md ("Actual v forecast").
import pool from '../config/db.js';
import { listCosts } from './thirdPartyUsage.js';
import { paidInMonth } from '../thirdParties/costs.js';
import { getConfigValue } from './appConfig.js';

// Pure: what the plan forecast for one month ('2026-10') in the scenario the owner is in, or null if
// the plan doesn't reach that month. Money is cash: what goes out and comes in that month.
export function forecastFor(BusinessCase, plan, month) {
  const result = BusinessCase.project(plan, plan.current);
  const m = result.months.find((x) => x.n === BusinessCase.ym(month));
  if (!m) return null;
  return { members: Math.round(m.members), out: Math.round(m.out * 100) / 100, in: Math.round(m.in * 100) / 100, scenario: result.scenario.name };
}

export async function recordMonth(BusinessCase, plan, today = new Date().toISOString().slice(0, 10)) {
  const month = today.slice(0, 7);
  const [members, costs, rate] = await Promise.all([
    pool.query('SELECT count(*)::int AS n FROM accounts WHERE deleted_at IS NULL'),
    listCosts(),
    getConfigValue('usd_per_gbp').catch(() => '1.30')
  ]);
  const f = forecastFor(BusinessCase, plan, month);
  await pool.query(
    `INSERT INTO business_actuals (month, members, paid_gbp, forecast_members, forecast_out_gbp, forecast_in_gbp, forecast_scenario)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (month) DO UPDATE SET members = EXCLUDED.members, paid_gbp = EXCLUDED.paid_gbp, updated_at = now()`,
    [`${month}-01`, members.rows[0].n, paidInMonth(costs, month, today, Number(rate)), f && f.members, f && f.out, f && f.in, f && f.scenario]
  );
}

export async function listActuals() {
  const { rows } = await pool.query(
    `SELECT to_char(month, 'YYYY-MM') AS month, members, paid_gbp, forecast_members, forecast_out_gbp, forecast_in_gbp, forecast_scenario, updated_at
       FROM business_actuals ORDER BY month DESC LIMIT 60`);
  const num = (v) => (v === null ? null : Number(v));
  return rows.map((r) => ({
    month: r.month, members: r.members, paid: Number(r.paid_gbp),
    forecast: r.forecast_scenario === null ? null : { members: r.forecast_members, out: num(r.forecast_out_gbp), in: num(r.forecast_in_gbp), scenario: r.forecast_scenario },
    updatedAt: r.updated_at
  }));
}
