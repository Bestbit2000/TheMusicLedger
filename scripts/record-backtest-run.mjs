// Parses playwright-report.json (produced by `npx playwright test tests/generated`)
// and records the run in test_runs/test_run_results (ML-29). Pure bookkeeping,
// no AI call - on a failure, root_cause_analysis is left NULL for Claude to
// fill in on request (see .claude/skills/backtest), not written here.
//
// Usage: DATABASE_URL=<dev branch> node scripts/record-backtest-run.mjs

import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.join(__dirname, '..');

function resolveSuiteFile(suiteFile) {
  const candidates = [
    path.resolve(projectRoot, suiteFile),
    path.join(projectRoot, 'tests', 'generated', path.basename(suiteFile))
  ];
  return candidates.find((p) => existsSync(p));
}

// Playwright's JSON reporter nests recursively (a file suite can contain
// describe-block sub-suites) - flatten to the leaf suites that actually carry
// specs, since each generated file is one flat spec with no describe blocks.
// Playwright's error messages carry ANSI color codes meant for a terminal -
// strip them so error_message reads cleanly wherever it's displayed (e.g.
// the admin panel, ML-26).
function stripAnsi(str) {
  return String(str ?? '').replace(/[][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g, '');
}

function collectLeafSuites(suites, out = []) {
  for (const suite of suites || []) {
    if (suite.specs?.length) out.push(suite);
    collectLeafSuites(suite.suites, out);
  }
  return out;
}

async function run() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL is not set - point it at the dev branch (see docs/environments.md).');
  }

  const reportPath = path.join(projectRoot, 'playwright-report.json');
  if (!existsSync(reportPath)) {
    throw new Error(`${reportPath} not found - run "npx playwright test tests/generated" first.`);
  }
  const report = JSON.parse(readFileSync(reportPath, 'utf8'));
  const leafSuites = collectLeafSuites(report.suites);

  const client = new pg.Client({ connectionString });
  await client.connect();

  try {
    const runRes = await client.query(
      `INSERT INTO test_runs (trigger_source, total_tests) VALUES ('manual', $1) RETURNING id`,
      [leafSuites.length]
    );
    const runId = runRes.rows[0].id;

    let passed = 0;
    let failed = 0;

    for (const suite of leafSuites) {
      const filePath = resolveSuiteFile(suite.file);
      if (!filePath) continue;
      const specSource = readFileSync(filePath, 'utf8');
      const match = specSource.match(/\/\/ TEST_CASE_ID: (.+)/);
      if (!match) continue;
      const testCaseId = match[1].trim();

      const result = suite.specs[0]?.tests[0]?.results[0];
      const isPass = result?.status === 'passed';
      // Playwright reports fractional-millisecond durations; duration_ms is INTEGER.
      const duration = Math.round(result?.duration || 0);

      if (isPass) {
        passed++;
        await client.query(
          `INSERT INTO test_run_results (test_run_id, test_case_id, verdict, duration_ms) VALUES ($1, $2, 'PASS', $3)`,
          [runId, testCaseId, duration]
        );
      } else {
        failed++;
        const errorMessage = stripAnsi(result?.error?.message || result?.errors?.[0]?.message || 'Unknown execution error');
        await client.query(
          `INSERT INTO test_run_results (test_run_id, test_case_id, verdict, error_message, duration_ms) VALUES ($1, $2, 'FAIL', $3, $4)`,
          [runId, testCaseId, errorMessage, duration]
        );
      }
    }

    await client.query(
      `UPDATE test_runs SET passed_tests = $1, failed_tests = $2, duration_ms = $3, completed_at = now() WHERE id = $4`,
      [passed, failed, Math.round(report.stats?.duration || 0), runId]
    );

    console.log(`Recorded test run ${runId}: ${passed} passed, ${failed} failed.`);
    if (failed > 0) {
      console.log('Ask Claude Code to investigate the failing test_run_results rows - see .claude/skills/backtest.');
    }
  } finally {
    await client.end();
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
