// Logs in via the local-dev bypass (server/routes/auth.js, requires both
// NODE_ENV=development and ALLOW_LOCAL_DEV_LOGIN=true - see server/.env and
// docs/environments.md) instead of real Google OAuth, so generated specs
// never need credentials. Every spec should call this in a beforeEach.
import { Page, expect } from '@playwright/test';

export async function loginAsLocalDev(page: Page) {
  await page.goto('/auth/login');
  await expect(page.getByRole('button', { name: 'Start a challenge' })).toBeVisible();
}
