// Logs in via the local-dev bypass (server/routes/auth.js, requires both
// NODE_ENV=development and ALLOW_LOCAL_DEV_LOGIN=true - see server/.env and
// docs/environments.md) instead of real Google OAuth, so generated specs
// never need credentials. Every spec should call this in a beforeEach.
import { Page, expect } from '@playwright/test';
import pg from 'pg';

// ML-506: an organiser is an adult - the server refuses to set up sharing or invite for an account that
// hasn't confirmed it. The three local test accounts stand for adults running a band, so they are marked
// as having confirmed, once per test worker, the first time each signs in. (Back-test 67, which is about
// the confirmation itself, clears it again for its own account.)
const adultsConfirmed = new Set<string>();
async function confirmAdult(email: string) {
  if (adultsConfirmed.has(email) || !process.env.DATABASE_URL) return;
  adultsConfirmed.add(email);
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try { await client.query('UPDATE accounts SET organiser_adult_confirmed_on = COALESCE(organiser_adult_confirmed_on, CURRENT_DATE) WHERE email = $1', [email]); } finally { await client.end(); }
}

// Home's "Log time you've already played" link (ML-378 - it replaced the old Add-session-time button) is always there.
// An urgent notification (ML-167) pops up over every screen until it's read, so it's dismissed first - that
// marks it read for the test account only.
const LOG_TIME = "Log time you've already played";
async function onHome(page: Page) {
  await expect(page.getByRole('button', { name: LOG_TIME })).toBeVisible();
  // ...and so does an important notice (ML-463, "Before you continue..."), which comes first.
  const gotIt = page.locator('#importantNoticeModal.show #importantNoticeOkBtn, #urgentNotificationModal.show #urgentNotificationOkBtn').first();
  for (let i = 0; i < 5 && await gotIt.isVisible().catch(() => false); i++) {
    await gotIt.click();
    await page.waitForTimeout(300);
  }
}

export async function loginAsLocalDev(page: Page) {
  await page.goto('/auth/login');
  await onHome(page);
  await confirmAdult('local-dev@themusicledger.local');
}

// ML-345: a standard member (local-standard@themusicledger.local) - for checking what Standard members
// can't see. local-dev itself is a beta tester on dev (071_feature_access.sql), so it has everything.
export async function loginAsLocalStandard(page: Page) {
  await page.goto('/auth/login?as=standard');
  await onHome(page);
  await confirmAdult('local-standard@themusicledger.local');
}

// ML-310: the second dev account, local-admin@themusicledger.local - a super admin on dev (local-dev
// itself is a beta tester since ML-345), for admin-only actions such as publishing a piece.
export async function loginAsLocalAdmin(page: Page) {
  await page.goto('/auth/login?as=admin');
  await onHome(page);
  await confirmAdult('local-admin@themusicledger.local');
}
