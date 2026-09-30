// Logs in via the local-dev bypass (server/routes/auth.js, requires both
// NODE_ENV=development and ALLOW_LOCAL_DEV_LOGIN=true - see server/.env and
// docs/environments.md) instead of real Google OAuth, so generated specs
// never need credentials. Every spec should call this in a beforeEach.
import { Page, expect } from '@playwright/test';

// Home's "Log time you've already played" link (ML-378 - it replaced the old Add-session-time button) is always there.
// An urgent notification (ML-167) pops up over every screen until it's read, so it's dismissed first - that
// marks it read for the test account only.
const LOG_TIME = "Log time you've already played";
async function onHome(page: Page) {
  await expect(page.getByRole('button', { name: LOG_TIME })).toBeVisible();
  const gotIt = page.locator('#urgentNotificationModal.show #urgentNotificationOkBtn');
  for (let i = 0; i < 5 && await gotIt.isVisible().catch(() => false); i++) {
    await gotIt.click();
    await page.waitForTimeout(300);
  }
}

export async function loginAsLocalDev(page: Page) {
  await page.goto('/auth/login');
  await onHome(page);
}

// ML-345: a standard member (local-standard@themusicledger.local) - for checking what Standard members
// can't see. local-dev itself is a beta tester on dev (071_feature_access.sql), so it has everything.
export async function loginAsLocalStandard(page: Page) {
  await page.goto('/auth/login?as=standard');
  await onHome(page);
}

// ML-310: the second dev account, local-admin@themusicledger.local - a super admin on dev (local-dev
// itself is a beta tester since ML-345), for admin-only actions such as publishing a piece.
export async function loginAsLocalAdmin(page: Page) {
  await page.goto('/auth/login?as=admin');
  await onHome(page);
}
