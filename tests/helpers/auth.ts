// Logs in via the local-dev bypass (server/routes/auth.js, requires both
// NODE_ENV=development and ALLOW_LOCAL_DEV_LOGIN=true - see server/.env and
// docs/environments.md) instead of real Google OAuth, so generated specs
// never need credentials. Every spec should call this in a beforeEach.
import { Page, expect } from '@playwright/test';

export async function loginAsLocalDev(page: Page) {
  await page.goto('/auth/login');
  await expect(page.getByRole('button', { name: 'Add session time' })).toBeVisible(); // always on Home (ML-320 swaps Start a challenge for Start a practice session)
}

// ML-345: a standard member (local-standard@themusicledger.local) - for checking what Standard members
// can't see. local-dev itself is a beta tester on dev (071_feature_access.sql), so it has everything.
export async function loginAsLocalStandard(page: Page) {
  await page.goto('/auth/login?as=standard');
  await expect(page.getByRole('button', { name: 'Add session time' })).toBeVisible();
}

// ML-310: the second dev account, local-admin@themusicledger.local - a super admin on dev (local-dev
// itself is a beta tester since ML-345), for admin-only actions such as publishing a piece.
export async function loginAsLocalAdmin(page: Page) {
  await page.goto('/auth/login?as=admin');
  await expect(page.getByRole('button', { name: 'Add session time' })).toBeVisible(); // always on Home (ML-320 swaps Start a challenge for Start a practice session)
}
