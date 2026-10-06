// ML-443: Admin -> Dashboard, the page the panel opens on. Four things at a glance - people, the build,
// money and what needs the owner - each read from what the app already holds (accounts, sessions,
// the back-test runs, Feature access, Costs and usage, the business case, feedback, the third-party
// register, the security review). Nothing new is stored. Each part is read on its own, so one that
// can't be read is left out (null) and the rest of the page still shows.
// "Active" is a member who used the app in the last seven days (accounts.last_seen_on, migration 103);
// "lapsed" is one who has been seen but not for 30 days. See specs/components/admin-shell.md ("Dashboard").
import pool from '../config/db.js';
import { ACCOUNT_TYPES, getFeatureAccess } from './features.js';
import { listPendingInvites } from './passwordAuth.js';
import { getBusinessCase, BusinessCase } from './businessCase.js';
import { costsAndUsage } from './thirdPartyUsage.js';
import { getSecurityReview } from './securityReview.js';
import { getSiteSecurityReview } from './siteSecurityReview.js';
import thirdPartyRegister from '../thirdParties/register.js';
import { listRecords } from './thirdPartyRecords.js';
import { openAttentionCount } from '../thirdParties/records.js';
import fs from 'node:fs';
import { daysToLaunch, needsYou } from './adminDashboardRules.js';
import { reviewsDue } from './reviews.js';

const part = async (name, read) => {
  try { return await read(); } catch (error) { console.error(`Admin dashboard: ${name} not read:`, error.message); return null; }
};

async function people() {
  const [types, week, invites] = await Promise.all([
    pool.query(`SELECT account_level, count(*)::int AS n, count(*) FILTER (WHERE created_at > now() - interval '7 days')::int AS fresh,
                       count(*) FILTER (WHERE last_seen_on > CURRENT_DATE - 7)::int AS seen,
                       count(*) FILTER (WHERE last_seen_on <= CURRENT_DATE - 30)::int AS lapsed
                  FROM accounts WHERE deleted_at IS NULL GROUP BY account_level`),
    pool.query(`SELECT count(DISTINCT s.account_id)::int AS active, count(*)::int AS sessions, coalesce(sum(s.total_duration_minutes), 0)::int AS minutes
                  FROM sessions s JOIN accounts a ON a.id = s.account_id
                 WHERE a.deleted_at IS NULL AND s.started_at > now() - interval '7 days'`),
    listPendingInvites()
  ]);
  const byKey = new Map(types.rows.map((r) => [r.account_level, r]));
  return {
    total: types.rows.reduce((sum, r) => sum + r.n, 0),
    newThisWeek: types.rows.reduce((sum, r) => sum + r.fresh, 0),
    byType: ACCOUNT_TYPES.map((t) => ({ key: t.key, label: t.label, count: (byKey.get(t.key) || { n: 0 }).n })).filter((t) => t.count),
    seenThisWeek: types.rows.reduce((sum, r) => sum + r.seen, 0),
    lapsed: types.rows.reduce((sum, r) => sum + r.lapsed, 0), // seen before, but not for 30 days
    practisedThisWeek: week.rows[0].active,
    sessionsThisWeek: week.rows[0].sessions,
    minutesThisWeek: week.rows[0].minutes,
    invitesWaiting: invites.length
  };
}

async function build() {
  const releases = JSON.parse(fs.readFileSync(new URL('../../public/releases.json', import.meta.url), 'utf8'));
  const [run, access] = await Promise.all([
    pool.query('SELECT total_tests, passed_tests, failed_tests, started_at FROM test_runs ORDER BY started_at DESC LIMIT 1'),
    getFeatureAccess()
  ]);
  const live = access.features.filter((f) => f.live);
  const last = run.rows[0];
  return {
    version: releases[0] ? releases[0].version : null,
    releasedOn: releases[0] ? releases[0].date : null,
    tests: last ? { total: last.total_tests, passed: last.passed_tests, failed: last.failed_tests, at: last.started_at } : null,
    features: { total: access.features.length, live: live.length, standard: live.filter((f) => f.access.standard_member).length }
  };
}

async function money() {
  const bc = await getBusinessCase();
  const plan = bc.plan;
  const result = BusinessCase.project(plan, plan.current);
  return {
    spent: bc.today.spent,
    perMonth: bc.today.perMonth,
    launch: plan.launch,
    daysToLaunch: daysToLaunch(plan.launch),
    years: result.years,
    scenario: { id: result.scenario.id, name: result.scenario.name, endPosition: result.endPosition, payback: result.payback ? result.payback.label : null, hasIncome: result.total.in > 0 }
  };
}

export async function getAdminDashboard() {
  const [who, made, cash, feedback, usage, security] = await Promise.all([
    part('people', people),
    part('the build', build),
    part('money', money),
    part('feedback', async () => (await pool.query('SELECT count(*) FILTER (WHERE category IS NULL)::int AS n FROM feedback')).rows[0].n),
    part('usage', async () => (await costsAndUsage()).usage),
    part('security review', async () => {
      const [r, site] = await Promise.all([getSecurityReview(), getSiteSecurityReview()]);
      // ML-231: this site's own review - is the monthly run due, has a release gone out since the deep
      // review, and did the last automated run find anything
      const failing = Object.values(site.latest).filter((x) => x.runId && String(x.runId).startsWith('auto-') && x.status === 'fail').length;
      return { runDue: r.automatedRunDue, upstreamChanged: r.upstreamChangedSinceDeepReview, siteRunDue: site.automatedRunDue, siteChanged: site.upstreamChangedSinceDeepReview, siteFailing: failing };
    })
  ]);
  const limits = (usage || []).filter((m) => m.status && (m.status.level === 'warn' || m.status.level === 'fail'))
    .map((m) => ({ name: m.name, percent: m.status.percent, level: m.status.level }));
  // ML-462: items the owner has marked as dealt with on Third parties no longer count
  const attention = openAttentionCount(thirdPartyRegister.entries, await part('third-party records', listRecords));
  const reviews = await part('reviews', reviewsDue); // ML-470: a review that is due, or has never been done
  return {
    people: who,
    build: made,
    money: cash,
    needs: needsYou({ feedback, attention, limits, tests: made && made.tests, security, reviews })
  };
}
