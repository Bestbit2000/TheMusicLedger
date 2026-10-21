// ML-572: the count of what is waiting in the admin panel, shown on the Administration item in the app's ☰ menu.
// The route is super admins only and answers with numbers only; the total is the five menu counts added up.
// The count itself runs against the dev database (node --env-file=../.env --test test/adminWaiting.test.js from
// server/); under plain `npm test` that part is skipped.

import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const onDev = process.env.NEON_BRANCH === 'dev' && !!process.env.DATABASE_URL;
process.env.DATABASE_URL ||= 'postgres://test@localhost/test';
const { default: pool } = await import('../config/db.js');
const { adminWaitingCounts } = await import('../services/adminDashboard.js');
after(() => pool.end().catch(() => {}));

test('the route is for super admins only, and is not under /api/admin', () => {
  const api = fs.readFileSync(new URL('../routes/api.js', import.meta.url), 'utf8');
  assert.match(api, /router\.get\('\/account\/admin-waiting', requireAuth, resolveAccount, requireSuperAdmin,/);
  const admin = fs.readFileSync(new URL('../routes/admin.js', import.meta.url), 'utf8');
  assert.doesNotMatch(admin, /admin-waiting/);
});

test('numbers only: the five menu counts and their total', { skip: !onDev && 'needs the dev database' }, async () => {
  const counts = await adminWaitingCounts();
  assert.deepEqual(Object.keys(counts).sort(), ['costs', 'feedback', 'reports', 'security', 'thirdParties', 'total']);
  for (const [key, n] of Object.entries(counts)) assert.ok(Number.isInteger(n) && n >= 0, `${key} is a count`);
  assert.equal(counts.total, counts.feedback + counts.reports + counts.costs + counts.security + counts.thirdParties);
});
