// Orchestrates the on-request back-test workflow (ML-29): materialize specs
// from Neon -> run them -> record the result, even when tests fail (that's
// the case worth recording). A plain Node script rather than a shell chain
// so it behaves the same on Windows and POSIX shells.
//
// Usage: DATABASE_URL=<dev branch> npm run backtest

import { spawnSync } from 'node:child_process';

function step(command, args) {
  const result = spawnSync(command, args, { stdio: 'inherit', shell: true });
  return result.status ?? 1;
}

const materializeStatus = step('node', ['scripts/materialize-specs.mjs']);
if (materializeStatus !== 0) {
  console.error('Materializing specs failed - not running the suite against stale/no files.');
  process.exit(materializeStatus);
}

// Playwright's own exit code reflects test failures, not a script error -
// keep going so the failure still gets recorded.
step('npx', ['playwright', 'test', 'tests/generated']);

const recordStatus = step('node', ['scripts/record-backtest-run.mjs']);
process.exit(recordStatus);
