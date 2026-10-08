// ML-429: what the app costs and how close it is to each plan's limit - the database side of
// Admin -> Third parties' costs and usage. The sums are in server/thirdParties/costs.js (pure, tested);
// the limits themselves are facts about each plan, kept here with the date they were checked.
// See docs/third-party-providers.md ("Costs and usage").
//
// A METER is one thing a plan limits. Each has a way of being read:
//   'app'    - counted from our own database, no key needed
//   'api'    - asked from the provider, when its key is in the environment (see `needs`)
//   'manual' - typed in by the owner from the provider's dashboard
// Any meter can also be given a typed reading. A reader returns { value, period? } or null when it
// can't answer (no key) - it never throws for a missing key, so the page still loads.

import pool from '../config/db.js';
import { costSummary, periodFor, meterStatus, alertsDue, parseChargeLines, billingPeriod, spendBreakdown } from '../thirdParties/costs.js';
import { getConfigValue } from './appConfig.js';
import { sendMail } from './mail.js';

const withStatus = (status, message) => Object.assign(new Error(message), { status });
const GB = 1024 * 1024 * 1024;
const LIMITS_CHECKED = '2026-10-07'; // when the limits below were read from each provider's pricing page
const NEON_PROJECT = () => process.env.NEON_PROJECT_ID || 'little-haze-42527245'; // not secret - docs/environments.md
const today = () => new Date().toISOString().slice(0, 10);

// One call to Neon covers three meters, so it is made once per run and shared.
async function neonProject(cache) {
  if (!process.env.NEON_API_KEY) return null;
  if (!cache.neon) {
    cache.neon = fetch(`https://console.neon.tech/api/v2/projects/${NEON_PROJECT()}`, {
      headers: { Authorization: `Bearer ${process.env.NEON_API_KEY}`, Accept: 'application/json' }, signal: AbortSignal.timeout(10000)
    }).then(async (res) => {
      if (!res.ok) throw new Error(`Neon answered ${res.status}`);
      return (await res.json()).project || {};
    });
  }
  return cache.neon;
}
const neonPeriod = (p) => (p.consumption_period_start && p.consumption_period_end ? { start: p.consumption_period_start, end: p.consumption_period_end } : null);

// PostHog bills from a day of the month (the 12th on the owner's account), not the 1st.
function posthogPeriod() {
  const day = Math.min(28, Math.max(1, Number(process.env.POSTHOG_BILLING_DAY) || 12));
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (now.getUTCDate() < day ? 1 : 0), day));
  const end = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, day));
  return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) };
}

// Vercel (Pro since 7 Oct 2026) bills from the day of the month the plan was taken. Its billing API
// gives every charge for a day, service by service: what was used and what it cost. One call a run
// covers the spend meter and the breakdown under it; the lines are kept (third_party_usage_lines)
// so the page can show where the usage is going without asking Vercel again. 35 days are asked for,
// so the period before this one is there to compare with.
const vercelPeriod = () => billingPeriod(process.env.VERCEL_BILLING_DAY || 7, today());
const addDays = (day, n) => new Date(Date.parse(`${day}T00:00:00Z`) + n * 86400000).toISOString().slice(0, 10);
async function vercelCharges(cache) {
  if (!process.env.VERCEL_API_TOKEN) return null;
  if (!cache.vercel) {
    cache.vercel = (async () => {
      const period = vercelPeriod();
      const from = addDays(today(), -35) < period.start ? addDays(today(), -35) : period.start;
      const query = new URLSearchParams({ from: `${from}T00:00:00Z`, to: `${addDays(today(), 1)}T00:00:00Z` });
      if (process.env.VERCEL_TEAM_ID) query.set('teamId', process.env.VERCEL_TEAM_ID);
      const res = await fetch(`https://api.vercel.com/v1/billing/charges?${query}`, {
        headers: { Authorization: `Bearer ${process.env.VERCEL_API_TOKEN}` }, signal: AbortSignal.timeout(20000)
      });
      if (!res.ok) throw new Error(`Vercel answered ${res.status}`);
      const lines = parseChargeLines(await res.text());
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        // A day that is read again replaces what was there: Vercel can restate a day
        await client.query('DELETE FROM third_party_usage_lines WHERE party_key = $1 AND day >= $2', ['vercel', from]);
        for (const l of lines) {
          await client.query('INSERT INTO third_party_usage_lines (party_key, day, sku, category, service, unit, quantity, cost) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)', ['vercel', l.day, l.sku, l.category, l.service, l.unit, l.quantity, l.cost]);
        }
        await client.query('COMMIT');
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
      return { period, total: spendBreakdown(lines, period, today(), 0).total, lines: lines.length };
    })();
  }
  return cache.vercel;
}

export const METERS = [
  {
    key: 'neon-compute', party: 'neon', name: 'Database compute', unit: 'CU-hours', limit: 100, per: 'month', cumulative: true, source: 'api', needs: 'NEON_API_KEY',
    how: 'Neon\'s API: the compute seconds used in the current billing period.',
    async read(cache) { const p = await neonProject(cache); return p && p.compute_time_seconds != null ? { value: Number(p.compute_time_seconds) / 3600, period: neonPeriod(p) } : null; }
  },
  {
    key: 'neon-storage', party: 'neon', name: 'Database storage', unit: 'GB', limit: 1, per: 'total', cumulative: false, source: 'api', needs: 'NEON_API_KEY',
    how: 'Neon\'s API: the project\'s storage size across its branches. Without the key, the size of this environment\'s database only.',
    async read(cache) {
      const p = await neonProject(cache);
      if (p && p.synthetic_storage_size != null) return { value: Number(p.synthetic_storage_size) / GB };
      const { rows } = await pool.query('SELECT pg_database_size(current_database()) AS bytes');
      return { value: Number(rows[0].bytes) / GB, source: 'app', note: 'This environment\'s database only' };
    }
  },
  {
    key: 'neon-transfer', party: 'neon', name: 'Database data sent out', unit: 'GB', limit: 5, per: 'month', cumulative: true, source: 'api', needs: 'NEON_API_KEY',
    how: 'Neon\'s API: the data transferred in the current billing period.',
    async read(cache) { const p = await neonProject(cache); return p && p.data_transfer_bytes != null ? { value: Number(p.data_transfer_bytes) / GB, period: neonPeriod(p) } : null; }
  },
  {
    // No limit of its own on Pro: storage is paid from Vercel's $20 a month of usage, at $0.024 a GB
    key: 'blob-storage', party: 'vercel-blob', name: 'File storage', unit: 'GB', limit: null, per: 'total', cumulative: false, source: 'app',
    how: 'Added up from our own records: the size of every recording and document attached to a piece in this environment. There is no limit on Pro - it is paid for from Vercel\'s included usage.',
    async read() {
      const { rows } = await pool.query(`SELECT (SELECT COALESCE(SUM(file_size_bytes), 0) FROM score_recordings) + (SELECT COALESCE(SUM(file_size_bytes), 0) FROM score_documents) AS bytes`);
      return { value: Number(rows[0].bytes) / GB };
    }
  },
  {
    key: 'posthog-events', party: 'posthog', name: 'Analytics events', unit: 'events', limit: 1000000, per: 'month', cumulative: true, source: 'api', needs: 'POSTHOG_PERSONAL_API_KEY and POSTHOG_PROJECT_ID',
    how: 'PostHog\'s query API: the events recorded since the billing day (the 12th unless POSTHOG_BILLING_DAY says otherwise).',
    async read() {
      if (!process.env.POSTHOG_PERSONAL_API_KEY || !process.env.POSTHOG_PROJECT_ID) return null;
      const period = posthogPeriod();
      const res = await fetch(`https://eu.posthog.com/api/projects/${encodeURIComponent(process.env.POSTHOG_PROJECT_ID)}/query/`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${process.env.POSTHOG_PERSONAL_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: { kind: 'HogQLQuery', query: `SELECT count() FROM events WHERE timestamp >= toDateTime('${period.start} 00:00:00')` } }),
        signal: AbortSignal.timeout(15000)
      });
      if (!res.ok) throw new Error(`PostHog answered ${res.status}`);
      const body = await res.json();
      const n = body && body.results && body.results[0] ? Number(body.results[0][0]) : NaN;
      if (Number.isNaN(n)) throw new Error('PostHog\'s answer had no count in it');
      return { value: n, period };
    }
  },
  {
    // The three typed-in Vercel meters (server calls, data transfer, CPU time) went when the app moved
    // to Pro: their limits were the free plan's. Their old readings stay in the table.
    key: 'vercel-spend', party: 'vercel', name: 'Vercel usage, in dollars', unit: 'USD', limit: 20, per: 'month', cumulative: true, source: 'api', needs: 'VERCEL_API_TOKEN',
    how: 'Vercel\'s billing API: the cost of everything used since the billing day (the 7th unless VERCEL_BILLING_DAY says otherwise), against the $20 a month the Pro plan includes. Past $20 it is billed.',
    async read(cache) { const v = await vercelCharges(cache); return v ? { value: v.total, period: v.period, note: v.lines ? null : 'Vercel sent no charges for the period' } : null; }
  }
];
const meterByKey = (key) => METERS.find((m) => m.key === key);

async function storeReading(meterKey, value, source, period, note) {
  await pool.query(
    'INSERT INTO third_party_usage_readings (meter_key, value, source, period_start, period_end, note) VALUES ($1, $2, $3, $4, $5, $6)',
    [meterKey, value, source, period ? period.start : null, period ? period.end : null, note || null]
  );
}

// Take a reading of every meter that can be read without a person. Returns what happened to each.
export async function readMeters() {
  const cache = {};
  const results = [];
  for (const m of METERS) {
    if (!m.read) continue;
    try {
      const r = await m.read(cache);
      if (!r) { results.push({ key: m.key, ok: false, message: `Not connected - needs ${m.needs}` }); continue; }
      const period = m.per === 'total' ? null : periodFor(new Date(), r.period);
      await storeReading(m.key, r.value, r.source || m.source, period, r.note);
      results.push({ key: m.key, ok: true, value: r.value });
    } catch (error) {
      results.push({ key: m.key, ok: false, message: error.message });
    }
  }
  return results;
}

// A number typed in by the owner from a provider's dashboard.
export async function recordManualReading(meterKey, value, note) {
  const m = meterByKey(meterKey);
  if (!m) throw withStatus(404, 'Unknown meter.');
  const n = Number(value);
  if (!(n >= 0)) throw withStatus(400, 'Type the amount used as a number.');
  await storeReading(m.key, n, 'manual', m.per === 'total' ? null : periodFor(new Date(), m.per === 'day' ? { start: today(), end: today() } : null), note);
}

// Where every meter stands: its latest reading, the status worked out from it, and its last readings.
export async function usageSummary() {
  const { rows } = await pool.query(
    `SELECT meter_key, value, source, period_start, period_end, note, read_at FROM (
       SELECT *, row_number() OVER (PARTITION BY meter_key ORDER BY read_at DESC) AS n FROM third_party_usage_readings
     ) r WHERE n <= 14 ORDER BY meter_key, read_at DESC`
  );
  const day = (d) => (d ? new Date(d).toISOString().slice(0, 10) : null);
  return METERS.map((m) => {
    const mine = rows.filter((r) => r.meter_key === m.key);
    const latest = mine[0] || null;
    const period = latest && latest.period_start ? { start: day(latest.period_start), end: day(latest.period_end) } : null;
    // A reading from a period that is over says nothing about now
    const stale = !!(period && m.per !== 'total' && period.end < today());
    const status = latest && !stale ? meterStatus({ value: latest.value, limit: m.limit, period, today: today(), cumulative: m.cumulative }) : null;
    return {
      key: m.key, party: m.party, name: m.name, unit: m.unit, limit: m.limit, per: m.per, source: m.source, how: m.how,
      connected: m.source !== 'api' || !m.needs || m.needs.split(' and ').every((k) => !!process.env[k]),
      needs: m.needs || null,
      latest: latest ? { value: Number(latest.value), source: latest.source, note: latest.note, readAt: latest.read_at, period, stale } : null,
      status,
      history: mine.map((r) => ({ value: Number(r.value), source: r.source, readAt: r.read_at }))
    };
  });
}

// Email the owner once per meter, threshold and period as a limit gets near (75% and 90%).
export async function sendUsageWarnings() {
  const to = process.env.USAGE_ALERT_EMAIL || process.env.SIGNUP_ALERT_EMAIL;
  const sent = [];
  for (const m of await usageSummary()) {
    if (!m.status || m.status.percent === null) continue;
    const periodKey = m.latest.period ? m.latest.period.start : 'total';
    const { rows } = await pool.query('SELECT threshold FROM third_party_usage_alerts WHERE meter_key = $1 AND period_key = $2', [m.key, periodKey]);
    const due = alertsDue(m.status.percent, rows.map((r) => r.threshold));
    if (!due.length) continue;
    const top = Math.max(...due);
    if (to) {
      const used = `${fmt(m.status.value)} of ${fmt(m.limit)} ${m.unit}`;
      const text = [
        `${m.name} is at ${m.status.percent}% of its limit: ${used}${m.per === 'total' ? '' : ` this ${m.per}`}.`,
        m.status.reachesLimitOn ? `At this rate the limit is reached on ${m.status.reachesLimitOn}.` : '',
        '',
        'See Admin → Third parties for what happens past the limit and what the next plan costs.'
      ].filter((line, i) => line || i === 2).join('\n');
      await sendMail({ to, subject: `The Music Ledger: ${m.name} at ${Math.floor(m.status.percent)}% of its limit`, text });
    }
    // Recorded even with nobody to email, so turning the address on later doesn't send old news
    for (const t of due) await pool.query('INSERT INTO third_party_usage_alerts (meter_key, threshold, period_key) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING', [m.key, t, periodKey]);
    sent.push({ key: m.key, threshold: top, emailed: !!to });
  }
  return sent;
}
const fmt = (n) => (Number(n) >= 100 ? Math.round(Number(n)).toLocaleString('en-GB') : (Math.round(Number(n) * 100) / 100).toString());

// ---- costs
const toCost = (r) => ({ id: Number(r.id), partyKey: r.party_key, description: r.description, amount: Number(r.amount), currency: r.currency, cadence: r.cadence, startedOn: new Date(r.started_on).toISOString().slice(0, 10), endedOn: r.ended_on ? new Date(r.ended_on).toISOString().slice(0, 10) : null });
const CADENCES = ['one_off', 'weekly', 'monthly', 'yearly'];
const isDate = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s));

function cleanCost(data, partyKeys) {
  const d = data || {};
  if (!partyKeys.includes(d.partyKey)) throw withStatus(400, 'Choose who the cost is paid to.');
  const amount = Number(d.amount);
  if (!(amount >= 0) || d.amount === '' || d.amount === null) throw withStatus(400, 'Type the amount as a number.');
  if (!['GBP', 'USD'].includes(d.currency)) throw withStatus(400, 'The currency is pounds or US dollars.');
  if (!CADENCES.includes(d.cadence)) throw withStatus(400, 'How often is it paid?');
  if (!isDate(d.startedOn)) throw withStatus(400, 'When did it start?');
  if (d.endedOn && (!isDate(d.endedOn) || d.endedOn < d.startedOn)) throw withStatus(400, 'The end date is on or after the start.');
  return [d.partyKey, String(d.description || '').trim().slice(0, 200), amount, d.currency, d.cadence, d.startedOn, d.endedOn || null];
}

export async function listCosts() {
  const { rows } = await pool.query('SELECT * FROM third_party_costs ORDER BY started_on DESC, id DESC');
  return rows.map(toCost);
}
export async function addCost(accountId, data, partyKeys) {
  await pool.query('INSERT INTO third_party_costs (party_key, description, amount, currency, cadence, started_on, ended_on, created_by_account_id) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)', [...cleanCost(data, partyKeys), accountId]);
}
export async function updateCost(id, data, partyKeys) {
  const { rowCount } = await pool.query('UPDATE third_party_costs SET party_key = $1, description = $2, amount = $3, currency = $4, cadence = $5, started_on = $6, ended_on = $7 WHERE id = $8', [...cleanCost(data, partyKeys), id]);
  if (!rowCount) throw withStatus(404, 'That cost isn\'t there any more.');
}
export async function deleteCost(id) {
  await pool.query('DELETE FROM third_party_costs WHERE id = $1', [id]);
}

// Where Vercel's usage is going in the current billing period, service by service, from the lines
// the last reading kept - and the same per member who used the app in the period (a count of
// accounts by accounts.last_seen_on; nobody is named). null until there has been a reading.
export async function vercelBreakdown() {
  const period = vercelPeriod();
  const { rows } = await pool.query(
    `SELECT to_char(day, 'YYYY-MM-DD') AS day, sku, category, service, unit, quantity, cost, read_at FROM third_party_usage_lines WHERE party_key = 'vercel' AND day >= $1 AND day <= $2`,
    [period.start, period.end]
  );
  if (!rows.length) return null;
  const seen = await pool.query('SELECT count(*)::int AS n FROM accounts WHERE deleted_at IS NULL AND last_seen_on >= $1', [period.start]);
  const readAt = rows.reduce((latest, r) => (latest && latest > r.read_at ? latest : r.read_at), null);
  return { ...spendBreakdown(rows.map((r) => ({ ...r, quantity: Number(r.quantity), cost: Number(r.cost) })), period, today(), seen.rows[0].n), included: 20, readAt };
}

// Everything the page needs about money and limits, in one go.
export async function costsAndUsage() {
  const [costs, usage, rate, vercel] = await Promise.all([
    listCosts(), usageSummary(), getConfigValue('usd_per_gbp').catch(() => '1.30'),
    vercelBreakdown().catch((error) => { console.error('Vercel usage lines not read:', error.message); return null; })
  ]);
  return { costs: costSummary(costs, today(), Number(rate)), usage, vercelUsage: vercel, limitsCheckedOn: LIMITS_CHECKED, alertsGoTo: !!(process.env.USAGE_ALERT_EMAIL || process.env.SIGNUP_ALERT_EMAIL) };
}
