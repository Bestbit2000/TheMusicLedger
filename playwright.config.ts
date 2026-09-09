// Back-test suite (ML-29). Specs live only in tests/generated/ - materialized
// from the test_cases table by scripts/materialize-specs.mjs, never written
// by hand or committed (see .gitignore). Runs against a local server on the
// `dev` Neon branch; auth goes through /auth/login's NODE_ENV=development
// bypass (see server/routes/auth.js) rather than real Google OAuth, so specs
// need no credentials - see tests/helpers/auth.ts.
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/generated',
  fullyParallel: false, // specs share one account's data (local-dev@themusicledger.local)
  workers: 1, // multiple spec FILES must not run concurrently either - same reason
  reporter: [
    ['list'],
    ['json', { outputFile: 'playwright-report.json' }]
  ],
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
