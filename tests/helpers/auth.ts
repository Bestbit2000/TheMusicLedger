// Logs in via the local-dev bypass (server/routes/auth.js, requires both
// NODE_ENV=development and ALLOW_LOCAL_DEV_LOGIN=true - see server/.env and
// docs/environments.md) instead of real Google OAuth, so generated specs
// never need credentials. Every spec should call this in a beforeEach.
import { Page, expect } from '@playwright/test';

export async function loginAsLocalDev(page: Page) {
  await page.goto('/auth/login');
  await expect(page.getByRole('button', { name: 'Add session time' })).toBeVisible(); // always on Home (ML-320 swaps Start a challenge for Start a practice session)
}

// ML-310: the second dev account, local-admin@themusicledger.local - a super admin on dev (local-dev
// itself is an ordinary standard_member), for admin-only actions such as publishing a piece.
export async function loginAsLocalAdmin(page: Page) {
  await page.goto('/auth/login?as=admin');
  await expect(page.getByRole('button', { name: 'Add session time' })).toBeVisible(); // always on Home (ML-320 swaps Start a challenge for Start a practice session)
}
