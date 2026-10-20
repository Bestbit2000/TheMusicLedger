// The shared machinery behind Admin -> Security's review of this site (ML-231, siteSecurityReview.js):
// the OSV advisory lookup, saving an automated run and its results (security_review_runs/_results,
// 049_security_reviews.sql), and building the page's data for a review target from its checks, its
// automated runs and its deep-review history.
//
// ML-543 (owner's decision, 20 Oct 2026): this file began as the ML-192 review of solfascribe-omr, the
// third-party music-scanning service behind the old PDF import. That import and its review are removed;
// what is left is what the site review is built on.

import pool from '../config/db.js';

const FETCH_TIMEOUT_MS = 10000;

export async function fetchJson(url, options = {}) {
  const res = await fetch(url, { ...options, signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
  if (!res.ok) throw new Error(`${new URL(url).hostname} answered ${res.status}`);
  return res.json();
}

// ---------------------------------------------------------------- OSV

export async function osvLookup(queries) {
  if (!queries.length) return [];
  const batch = await fetchJson('https://api.osv.dev/v1/querybatch', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ queries })
  });
  const ids = new Set();
  batch.results.forEach((r) => (r.vulns || []).forEach((v) => ids.add(v.id)));
  const details = new Map();
  await Promise.all([...ids].map(async (id) => {
    try {
      details.set(id, await fetchJson(`https://api.osv.dev/v1/vulns/${encodeURIComponent(id)}`));
    } catch {
      details.set(id, { id });
    }
  }));
  return batch.results.map((r, i) => ({
    query: queries[i],
    vulns: (r.vulns || []).map((v) => {
      const d = details.get(v.id) || {};
      return { id: v.id, aliases: d.aliases || [], summary: d.summary || '', severity: (d.database_specific?.severity || 'UNKNOWN').toUpperCase() };
    })
  }));
}

// One automated run and its results, kept in the database. `head` is what was looked at: for this site,
// the app version (ML-231). (The column is named upstream_commit_sha from the ML-192 review it began with.)
export async function saveRun(targetKey, accountId, head, results) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: [run] } = await client.query(
      `INSERT INTO security_review_runs (target_key, kind, triggered_by_account_id, upstream_commit_sha)
       VALUES ($1, 'automated', $2, $3) RETURNING id`,
      [targetKey, accountId || null, head || null]
    );
    for (const r of results) {
      await client.query(
        `INSERT INTO security_review_results (run_id, check_key, status, summary, details) VALUES ($1, $2, $3, $4, $5)`,
        [run.id, r.key, r.status, r.summary, JSON.stringify((r.details || []).map(String))]
      );
    }
    await client.query('UPDATE security_review_runs SET completed_at = now() WHERE id = $1', [run.id]);
    await client.query('COMMIT');
    return Number(run.id);
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

// ---------------------------------------------------------------- the page's data

const AUTOMATED_DUE_AFTER_DAYS = 30;

// The page's data for one review target: the site review (ML-231, siteSecurityReview.js) passes its
// target, sections, checks and deep-review history.
export async function buildReview({ target, sections, checks, assisted = [], dueAfterDays = AUTOMATED_DUE_AFTER_DAYS }) {
  const checkKeys = new Set(checks.map((c) => c.key));
  const { rows: runRows } = await pool.query(
    `SELECT r.id, r.upstream_commit_sha, r.started_at, r.completed_at, a.email AS triggered_by
     FROM security_review_runs r LEFT JOIN accounts a ON a.id = r.triggered_by_account_id
     WHERE r.target_key = $1 ORDER BY r.started_at DESC LIMIT 50`,
    [target.key]
  );
  const runIds = runRows.map((r) => r.id);
  const { rows: resultRows } = runIds.length
    ? await pool.query('SELECT run_id, check_key, status, summary, details FROM security_review_results WHERE run_id = ANY($1)', [runIds])
    : { rows: [] };

  const automatedRuns = runRows.map((r) => ({
    id: `auto-${r.id}`,
    kind: 'automated',
    at: r.started_at,
    by: r.triggered_by || null,
    upstreamCommitSha: r.upstream_commit_sha,
    results: resultRows.filter((x) => x.run_id === r.id).map((x) => ({ checkKey: x.check_key, status: x.status, summary: x.summary, details: x.details || [] }))
  }));
  const deepRuns = assisted.map((r) => ({
    id: `deep-${r.id}`,
    kind: 'assisted',
    at: r.reviewedAt,
    by: r.reviewer,
    upstreamCommitSha: r.upstreamCommitSha,
    verdict: r.verdict,
    tools: r.tools || [],
    results: (r.results || []).filter((x) => checkKeys.has(x.checkKey))
  }));

  // Latest result per check, whichever kind of run it came from.
  const latest = {};
  for (const run of [...automatedRuns, ...deepRuns].sort((a, b) => new Date(b.at) - new Date(a.at))) {
    for (const res of run.results) {
      if (!latest[res.checkKey]) latest[res.checkKey] = { ...res, runId: run.id, at: run.at, upstreamCommitSha: run.upstreamCommitSha };
    }
  }

  const lastDeep = deepRuns[0] || null;
  const lastAuto = automatedRuns[0] || null;
  const currentHead = lastAuto?.upstreamCommitSha || null;
  const daysSinceAuto = lastAuto ? (Date.now() - new Date(lastAuto.at)) / 86400000 : null;
  return {
    target,
    sections,
    checks,
    latest,
    verdict: lastDeep?.verdict || null,
    lastDeepReview: lastDeep ? { at: lastDeep.at, by: lastDeep.by, upstreamCommitSha: lastDeep.upstreamCommitSha, tools: lastDeep.tools } : null,
    lastAutomatedRun: lastAuto ? { at: lastAuto.at, by: lastAuto.by, upstreamCommitSha: lastAuto.upstreamCommitSha } : null,
    upstreamChangedSinceDeepReview: Boolean(lastDeep && currentHead && currentHead !== lastDeep.upstreamCommitSha),
    automatedRunDue: daysSinceAuto === null || daysSinceAuto > dueAfterDays,
    automatedDueAfterDays: dueAfterDays,
    history: [...automatedRuns, ...deepRuns]
      .sort((a, b) => new Date(b.at) - new Date(a.at))
      .map((r) => ({ ...r, counts: r.results.reduce((acc, x) => ({ ...acc, [x.status]: (acc[x.status] || 0) + 1 }), {}) }))
  };
}
