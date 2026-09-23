// ML-210: config for the committed axe-core accessibility scan (tests/a11y/). Same local server and
// dev-login bypass as the back-test suite (playwright.config.ts), but its own test directory.
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/a11y',
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: { baseURL: 'http://localhost:3000' },
  webServer: {
    command: 'node server/server.js',
    cwd: '.',
    url: 'http://localhost:3000',
    reuseExistingServer: true,
    timeout: 30_000
  }
});
