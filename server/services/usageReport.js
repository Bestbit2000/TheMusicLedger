// ML-22: Admin -> Usage -> Heat map, a tool's buttons and Quiet corners - the database side. The sums are
// usageReportRules.js (pure, tested); the counts are usage_counts (usageCounts.js). Read-only, super admins
// only. See docs/usage-stats.md.
import fs from 'node:fs';
import pool from '../config/db.js';
import { ACCOUNT_TYPES } from './features.js';
import { weekStarts, heatmap, toolButtons, quiet } from './usageReportRules.js';
import { Usage } from './usageRules.js';

// Every button and screen in the app, from scripts/usage-buttons.mjs (a unit test keeps it up to date)
const LIST = JSON.parse(fs.readFileSync(new URL('../usage/buttons.json', import.meta.url), 'utf8'));
const withStatus = (status, message) => Object.assign(new Error(message), { status });
const londonToday = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/London' });
const daysBefore = (n) => { const d = new Date(`${londonToday()}T00:00:00Z`); d.setUTCDate(d.getUTCDate() - n + 1); return d.toISOString().slice(0, 10); };

// who: 'members' (members only), 'everyone' (the owner's own use too) or 'all' (the test accounts too)
const WHO = ['members', 'everyone', 'all'];
const whoSql = (who) => ({ members: `who = 'member'`, everyone: `who IN ('member', 'admin')`, all: 'TRUE' }[who]);
// The same for the rounds kept with an account: a test account is a local one, the owner a super admin
const accountSql = (who) => ({ members: `a.email NOT LIKE '%@themusicledger.local' AND a.account_level <> 'super_admin'`, everyone: `a.email NOT LIKE '%@themusicledger.local'`, all: 'TRUE' }[who]);
const placeSql = (place) => ({ all: 'TRUE', own: `place = 'own'`, session: `place = 'session'` }[place]);

function clean(q) {
  const kind = ['use', 'tap', 'view'].includes(q.kind) ? q.kind : 'use';
  const place = ['all', 'own', 'session'].includes(q.place) ? q.place : 'all';
  const who = WHO.includes(q.who) ? q.who : 'members';
  const weeks = [4, 12, 26].includes(Number(q.weeks)) ? Number(q.weeks) : 12;
  const days = [7, 30, 90].includes(Number(q.days)) ? Number(q.days) : 30;
  return { kind, place, who, weeks, days };
}

// The rounds already kept in their own tables, by day: Theory, the four drills and Range
async function historyLines(from, who) {
  const day = `(x.created_at AT TIME ZONE 'Europe/London')::date`;
  const q = (table, item) => pool.query(
    `SELECT to_char(${day}, 'YYYY-MM-DD') AS day, ${item} AS item, count(*)::int AS started, count(DISTINCT x.account_id)::int AS members
       FROM ${table} x JOIN accounts a ON a.id = x.account_id
      WHERE x.created_at >= $1::date AND ${accountSql(who)} GROUP BY 1, 2`, [from]);
  const parts = await Promise.all([q('theory_quiz_attempts', `'theory'`), q('drill_attempts', 'x.tool'), q('range_goes', `'range'`)]);
  return parts.flatMap((p) => p.rows);
}

export async function heatmapReport(query) {
  const { kind, place, who, weeks: n } = clean(query || {});
  const weeks = weekStarts(londonToday(), n);
  const { rows } = await pool.query(
    `SELECT to_char(day, 'YYYY-MM-DD') AS day, kind, item, sum(started)::int AS started, sum(finished)::int AS finished, sum(members)::int AS members
       FROM usage_counts WHERE kind = $1 AND day >= $2::date AND ${placeSql(place)} AND ${whoSql(who)}
      GROUP BY day, kind, item`, [kind, weeks[0]]);
  // where a round was played isn't kept, so the rounds' history only shows with "on its own and in a session"
  const history = kind === 'use' && place === 'all' ? await historyLines(weeks[0], who) : null;
  return { ...heatmap({ kind, lines: rows, history, weeks, views: LIST.views }), kind, place, who, weeksShown: n, firstCounted: await firstDay() };
}

// The day counting began in this environment (nothing before it is missing - it wasn't counted yet)
async function firstDay() {
  const { rows } = await pool.query(`SELECT to_char(min(day), 'YYYY-MM-DD') AS first FROM usage_counts`);
  return rows[0].first;
}

async function tapsSince(from, who) {
  const { rows } = await pool.query(
    `SELECT item, place, sum(started)::int AS started, max(members)::int AS members FROM usage_counts
      WHERE kind = 'tap' AND day >= $1::date AND ${whoSql(who)} GROUP BY item, place`, [from]);
  return rows;
}

export async function toolReport(tool, query) {
  if (!Usage.GROUPS.some(([g]) => g === tool)) throw withStatus(404, 'No such tool.');
  const { who, days } = clean(query || {});
  const from = daysBefore(days);
  const [taps, uses] = await Promise.all([
    tapsSince(from, who),
    pool.query(`SELECT item, sum(started)::int AS started, sum(finished)::int AS finished, max(members)::int AS members, sum(CASE WHEN place = 'session' THEN started ELSE 0 END)::int AS in_session
                  FROM usage_counts WHERE kind = 'view' AND day >= $1::date AND ${whoSql(who)} GROUP BY item`, [from])
  ]);
  // the tool's screens opened, as its headline
  const screens = uses.rows.filter((r) => Usage.groupOf(r.item) === tool);
  const opened = screens.reduce((s, r) => s + r.started, 0);
  return { ...toolButtons({ tool, taps, buttons: LIST.buttons }), days, who, opened, openedInSession: opened ? Math.round((screens.reduce((s, r) => s + r.in_session, 0) / opened) * 100) : 0, members: screens.reduce((m, r) => Math.max(m, r.members), 0) };
}

export async function quietReport(query) {
  const { who, days } = clean(query || {});
  const below = [1, 5, 10].includes(Number(query && query.below)) ? Number(query.below) : 5;
  const from = daysBefore(days);
  const label = (k) => (ACCOUNT_TYPES.find((t) => t.key === k) || { label: k }).label;
  const [features, counts, taps] = await Promise.all([
    pool.query(`SELECT f.feature_key AS key, f.name, f.enabled,
                       coalesce(array_agg(fa.account_level) FILTER (WHERE fa.enabled AND fa.account_level <> 'super_admin'), '{}') AS levels
                  FROM features f LEFT JOIN feature_access fa ON fa.feature_id = f.id GROUP BY f.id ORDER BY f.name`),
    pool.query(`SELECT kind, item, sum(started)::int AS started FROM usage_counts
                 WHERE kind IN ('use', 'view') AND day >= $1::date AND ${whoSql(who)} GROUP BY kind, item`, [from]),
    tapsSince(from, who)
  ]);
  const uses = new Map(counts.rows.filter((r) => r.kind === 'use').map((r) => [r.item, r.started]));
  const viewsOpened = new Map(counts.rows.filter((r) => r.kind === 'view').map((r) => [r.item, r.started]));
  const order = (k) => ACCOUNT_TYPES.findIndex((t) => t.key === k);
  const result = quiet({ features: features.rows.map((f) => ({ ...f, levels: [...f.levels].sort((a, b) => order(a) - order(b)).map(label) })), uses, viewsOpened, taps, buttons: LIST.buttons, views: LIST.views, below });
  return { ...result, days, who, below, firstCounted: await firstDay() };
}
