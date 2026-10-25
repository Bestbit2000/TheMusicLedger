// ML-612: what a US dollar cost in pounds, month by month (exchange_rates, migration 159) - so each
// payment in dollars is changed into pounds at the rate for the month it was paid in.
// The rate is HMRC's monthly exchange rate, the one HMRC accepts for tax. HMRC publishes a month's rates
// as a CSV file a few days before the month starts; the daily job reads any month it doesn't have yet,
// from the month of the first cost to next month. A month the owner types in on Admin -> Costs and usage
// is kept as typed - HMRC's file never overwrites it. With no rate at all, the owner's own figure
// (app_config 'usd_per_gbp') is the fallback. The sums are rateLookup in server/thirdParties/costs.js.
// See docs/third-party-providers.md ("Costs and usage").
import pool from '../config/db.js';
import { parseHmrcUsd } from '../thirdParties/costs.js';
import { getConfigValue } from './appConfig.js';

const withStatus = (status, message) => Object.assign(new Error(message), { status });
const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;
const MOST_A_RUN = 24; // months fetched in one go - a first run fills two years at most
const addMonths = (month, n) => { const [y, m] = month.split('-').map(Number); const d = new Date(Date.UTC(y, m - 1 + n, 1)); return d.toISOString().slice(0, 7); };
const thisMonth = () => new Date().toISOString().slice(0, 7);

// HMRC's file for a month: monthly_csv_2026-10.csv (the month without a leading 0)
export const hmrcFileUrl = (month) => `https://www.trade-tariff.service.gov.uk/api/v2/exchange_rates/files/monthly_csv_${month.slice(0, 4)}-${Number(month.slice(5, 7))}.csv`;

// The dollar's rate for a month from HMRC, or null if HMRC hasn't published it (yet) or its file has no
// believable USD line. Throws only when HMRC can't be reached.
async function fetchHmrcUsd(month) {
  const res = await fetch(hmrcFileUrl(month), { signal: AbortSignal.timeout(10000) });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`HMRC answered ${res.status}`);
  return parseHmrcUsd(await res.text());
}

export async function listRates() {
  const { rows } = await pool.query(`SELECT to_char(month, 'YYYY-MM') AS month, usd_per_gbp, source, read_at FROM exchange_rates ORDER BY month DESC`);
  return rows.map((r) => ({ month: r.month, usdPerGbp: Number(r.usd_per_gbp), source: r.source, readAt: r.read_at }));
}

// What the sums need: { byMonth, fallback }
export async function ratesForSums() {
  const [rates, fallback] = await Promise.all([listRates(), getConfigValue('usd_per_gbp').catch(() => '1.30')]);
  return { byMonth: Object.fromEntries(rates.map((r) => [r.month, r.usdPerGbp])), fallback: Number(fallback) };
}

// Reads from HMRC every month from the first cost's month to next month that has no rate yet. Next month
// is usually there from the last week of this one; until then it is simply not found.
export async function refreshRates() {
  const [{ rows }, have] = await Promise.all([
    pool.query(`SELECT to_char(min(started_on), 'YYYY-MM') AS first FROM third_party_costs`),
    listRates()
  ]);
  const known = new Set(have.map((r) => r.month));
  const last = addMonths(thisMonth(), 1);
  const wanted = [];
  for (let m = rows[0].first && rows[0].first < thisMonth() ? rows[0].first : thisMonth(); m <= last; m = addMonths(m, 1)) {
    if (!known.has(m)) wanted.push(m);
  }
  const added = [];
  const notYet = [];
  for (const month of wanted.slice(-MOST_A_RUN)) {
    const rate = await fetchHmrcUsd(month);
    if (!rate) { notYet.push(month); continue; }
    // a typed rate that arrived meanwhile stays
    await pool.query(`INSERT INTO exchange_rates (month, usd_per_gbp, source) VALUES ($1, $2, 'hmrc') ON CONFLICT (month) DO NOTHING`, [`${month}-01`, rate]);
    added.push({ month, usdPerGbp: rate });
  }
  return { added, notYet };
}

// This month's rate missing (a new month before the daily job has run, or a new environment): read now.
// Never in the way of the page - if HMRC can't be reached the sums fall back as they would anyway.
export async function refreshRatesIfNeeded() {
  const { rows } = await pool.query(`SELECT 1 FROM exchange_rates WHERE month = $1`, [`${thisMonth()}-01`]);
  if (rows.length) return null;
  return refreshRates().catch((error) => { console.error('Exchange rates not read:', error.message); return null; });
}

// The owner's own rate for a month, kept as typed. An empty rate takes the month back to HMRC's.
export async function setMonthRate(month, value) {
  if (!MONTH.test(String(month))) throw withStatus(400, 'Which month?');
  if (value === '' || value === null || value === undefined) {
    await pool.query(`DELETE FROM exchange_rates WHERE month = $1 AND source = 'manual'`, [`${month}-01`]);
    const rate = await fetchHmrcUsd(month).catch(() => null);
    if (rate) await pool.query(`INSERT INTO exchange_rates (month, usd_per_gbp, source) VALUES ($1, $2, 'hmrc') ON CONFLICT (month) DO NOTHING`, [`${month}-01`, rate]);
    return;
  }
  const rate = Number(value);
  if (!(rate >= 0.5 && rate <= 3)) throw withStatus(400, 'Type how many dollars £1 bought, for example 1.3456.');
  await pool.query(
    `INSERT INTO exchange_rates (month, usd_per_gbp, source) VALUES ($1, $2, 'manual')
     ON CONFLICT (month) DO UPDATE SET usd_per_gbp = EXCLUDED.usd_per_gbp, source = 'manual', read_at = now()`,
    [`${month}-01`, Math.round(rate * 10000) / 10000]
  );
}
