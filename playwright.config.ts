// Back-test suite (ML-29). Specs live only in tests/generated/ - materialized
// from the test_cases table by scripts/materialize-specs.mjs, never written
// by hand or committed (see .gitignore). Runs against a local server on the
// `dev` Neon branch; auth goes through /auth/login's NODE_ENV=development
// bypass (see server/routes/auth.js) rather than real Google OAuth, so specs
// need no credentials - see tests/helpers/auth.ts.
import { defineConfig } from '@playwright/test';
import os from 'node:os';
import path from 'node:path';

export default defineConfig({
  testDir: './tests/generated',
  // Traces/screenshots of a run go to the system temp folder, not test-results/ in the repo: the repo
  // lives in a OneDrive-synced folder, and OneDrive locking a trace file mid-write fails the test
  // (EBUSY) for reasons that have nothing to do with the app.
  outputDir: path.join(os.tmpdir(), 'tml-playwright-results'),
  fullyParallel: false, // specs share one account's data (local-dev@themusicledger.local)
  workers: 1, // multiple spec FILES must not run concurrently either - same reason
  reporter: [
    ['list'],
    ['json', { outputFile: 'playwright-report.json' }]
  ],
  // ML-193: visual baselines. Specs are regenerated from Neon into tests/generated/ (and wiped each
  // run), so screenshots are named explicitly by each test and kept in tests/visual-baselines/ - a
  // committed folder - rather than beside the spec. First run of a new screenshot: add
  // --update-snapshots to write its baseline, check the image by eye, commit it.
  snapshotPathTemplate: 'tests/visual-baselines/{arg}{ext}',
  expect: {
    toHaveScreenshot: { maxDiffPixelRatio: 0.01, animations: 'disabled', caret: 'hide' }
  },
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'retain-on-failure',
    // The tuner spec needs a mic; a fake device avoids ever prompting for a
    // real one or depending on real audio hardware in CI/headless runs.
    permissions: ['microphone'],
    launchOptions: {
      args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream']
    }
  },
  webServer: {
    command: 'node server/server.js',
    cwd: '.',
    url: 'http://localhost:3000',
    reuseExistingServer: true,
    timeout: 30_000
  }
});
