// Parses playwright-report.json (produced by `npx playwright test tests/generated`)
// and records the run in test_runs/test_run_results (ML-29). Pure bookkeeping,
// no AI call - on a failure, root_cause_analysis is left NULL for Claude to
// fill in on request (see .claude/skills/backtest), not written here.
//
// One test_run_results row per test case (spec file), counting EVERY test in the file - its
// describe blocks included (1 Oct 2026: it used to read only the first test of each file, so a
// file whose later tests failed was recorded PASS, and a file with a describe block got two rows):
//   - FAIL if any test failed (timed out, crashed...). error_message names the first failed test.
//   - SKIPPED if nothing failed but some test didn't run when it should have (a run cut short).
//   - PASS only when every test that was meant to run passed. A test skipped on purpose
//     (test.skip / fixme - expectedStatus 'skipped') doesn't stop a PASS; one that didn't run
//     after an earlier failure in a serial file is part of that file's FAIL.
// test_runs: total_tests = the rows written, passed_tests / failed_tests = PASS / FAIL rows.
//
// Usage: DATABASE_URL=<dev branch> node scripts/record-backtest-run.mjs
//        node scripts/record-backtest-run.mjs --report <path> --dry-run   (prints, writes nothing)

import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import pg from 'pg';
import { withVerifyFullSsl } from '../db/sslMode.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.join(__dirname, '..');

function resolveSuiteFile(suiteFile) {
  const candidates = [
    path.resolve(projectRoot, suiteFile),
    path.join(projectRoot, 'tests', 'generated', path.basename(suiteFile))
  ];
  return candidates.find((p) => existsSync(p));
}

// Playwright's error messages carry ANSI color codes meant for a terminal -
// strip them so error_message reads cleanly wherever it's displayed (e.g.
// the admin panel, ML-26).
function stripAnsi(str) {
  return String(str ?? '').replace(/[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g, '');
}

// Every test in a file suite, its describe blocks included: [{ title, test }].
function testsOf(suite, prefix = []) {
  const out = [];
  for (const spec of suite.specs || []) {
    for (const test of spec.tests || []) out.push({ title: [...prefix, spec.title].join(' › '), test });
  }
  for (const sub of suite.suites || []) out.push(...testsOf(sub, [...prefix, sub.title]));
  return out;
}

const lastResult = (test) => (test.results || [])[(test.results || []).length - 1];
const failed = (test) => test.status === 'unexpected';
// Skipped although it was meant to run: after a failure in a serial file, or a run cut short.
const didNotRun = (test) => test.status === 'skipped' && test.expectedStatus !== 'skipped';

// One file's verdict from all of its tests.
export function verdictFor(tests) {
  const failures = tests.filter(({ test }) => failed(test));
  const notRun = tests.filter(({ test }) => didNotRun(test));
  const duration = Math.round(tests.reduce((sum, { test }) => sum + (test.results || []).reduce((s, r) => s + (r.duration || 0), 0), 0));
  if (failures.length) {
    const first = lastResult(failures[0].test);
    const message = stripAnsi(first?.error?.message || first?.errors?.[0]?.message || `Ended ${first?.status || 'with an error'}`);
    const summary = `${failures.length} of ${tests.length} test${tests.length === 1 ? '' : 's'} failed`
      + (notRun.length ? `, ${notRun.length} didn't run after it` : '')
      + `. First failure - "${failures[0].title}":`;
    return { verdict: 'FAIL', errorMessage: `${summary}\n${message}`, duration };
  }
  if (notRun.length || !tests.length) {
    return { verdict: 'SKIPPED', errorMessage: tests.length ? `${notRun.length} of ${tests.length} tests didn't run - first: "${notRun[0].title}".` : 'No tests ran.', duration };
  }
  return { verdict: 'PASS', errorMessage: null, duration };
}

// The whole report -> one row per test case. readSpec(file) returns the spec's source (for its
// TEST_CASE_ID line) or null. Files are grouped by their file suite; two files claiming the same
// TEST_CASE_ID are merged into one row.
export function summariseReport(report, readSpec) {
  const byCase = new Map();
  for (const suite of report.suites || []) {
    const source = readSpec(suite.file);
    const match = source && source.match(/\/\/ TEST_CASE_ID: (.+)/);
    if (!match) continue;
    const id = match[1].trim();
    if (!byCase.has(id)) byCase.set(id, []);
    byCase.get(id).push(...testsOf(suite));
  }
  return [...byCase.entries()].map(([testCaseId, tests]) => ({ testCaseId, tests: tests.length, ...verdictFor(tests) }));
}

function readArgs(argv) {
  const args = { report: path.join(projectRoot, 'playwright-report.json'), dryRun: false };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--report') args.report = path.resolve(argv[++i]);
    else if (argv[i] === '--dry-run') args.dryRun = true;
  }
  return args;
}

async function run() {
  const args = readArgs(process.argv.slice(2));
  if (!existsSync(args.report)) {
    throw new Error(`${args.report} not found - run "npx playwright test tests/generated" first.`);
  }
  const report = JSON.parse(readFileSync(args.report, 'utf8'));
  const rows = summariseReport(report, (file) => {
    const p = resolveSuiteFile(file);
    return p ? readFileSync(p, 'utf8') : null;
  });
  const passed = rows.filter((r) => r.verdict === 'PASS').length;
  const failedCount = rows.filter((r) => r.verdict === 'FAIL').length;

  if (args.dryRun) {
    for (const r of rows) console.log(`tc_${r.testCaseId}: ${r.verdict} (${r.tests} test${r.tests === 1 ? '' : 's'}, ${r.duration} ms)${r.errorMessage ? ` - ${r.errorMessage.split('\n')[0]}` : ''}`);
    console.log(`Dry run - nothing recorded: ${rows.length} test cases, ${passed} passed, ${failedCount} failed, ${rows.length - passed - failedCount} skipped.`);
    return;
  }

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL is not set - point it at the dev branch (see docs/environments.md).');
  }
  const client = new pg.Client({ connectionString: withVerifyFullSsl(connectionString) });
  await client.connect();

  try {
    await client.query('BEGIN');
    const runRes = await client.query(
      `INSERT INTO test_runs (trigger_source, total_tests) VALUES ('manual', $1) RETURNING id`,
      [rows.length]
    );
    const runId = runRes.rows[0].id;
    for (const r of rows) {
      await client.query(
        `INSERT INTO test_run_results (test_run_id, test_case_id, verdict, error_message, duration_ms) VALUES ($1, $2, $3, $4, $5)`,
        [runId, r.testCaseId, r.verdict, r.errorMessage, r.duration]
      );
    }
    await client.query(
      `UPDATE test_runs SET total_tests = $1, passed_tests = $2, failed_tests = $3, duration_ms = $4, completed_at = now() WHERE id = $5`,
      [rows.length, passed, failedCount, Math.round(report.stats?.duration || 0), runId]
    );
    await client.query('COMMIT');

    console.log(`Recorded test run ${runId}: ${rows.length} test cases - ${passed} passed, ${failedCount} failed${rows.length - passed - failedCount ? `, ${rows.length - passed - failedCount} didn't finish` : ''}.`);
    if (failedCount > 0) {
      console.log('Ask Claude Code to investigate the failing test_run_results rows - see .claude/skills/backtest.');
    }
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    await client.end();
  }
}

// Run only when called as a script (the tests import summariseReport / verdictFor).
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  run().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
