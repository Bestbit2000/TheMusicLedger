// An answer from the server must never be kept by a browser. On 12 Oct 2026 a kept answer (GET
// /api/challenges, with Express's ETag) was found replaying an old X-Refreshed-Token header: every "not
// changed" (304) handed the app a sign-in that had run out, and the app swapped its good one for it - signed
// out on every page load. Both halves of the fix are checked here, from the source, so neither can be lost:
// the server says no-store on /api and /auth before any route, and the app asks with cache: 'no-store'.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (path) => fs.readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');

test('the server marks every /api and /auth answer no-store, before the routes', () => {
  const src = read('server/app.js');
  const rule = src.indexOf("app.use(['/api', '/auth'], (req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });");
  assert.ok(rule > -1, 'the no-store rule is in server/app.js');
  assert.ok(rule < src.indexOf("app.use('/auth', authRoutes)"), 'and comes before the routes');
});

test('the app never takes an answer from the browser\'s cache', () => {
  const app = read('public/app.js');
  const apiCall = app.slice(app.indexOf('async function apiCall('), app.indexOf('async function apiCall(') + 1500);
  assert.match(apiCall, /cache: 'no-store'/);
  assert.match(read('public/admin.js'), /fetch\(`\$\{API_BASE_URL\}\$\{endpoint\}`, \{\s+cache: 'no-store'/);
});

test('a sign-in handed back by the server is only taken when it is this member\'s and still runs', () => {
  const app = read('public/app.js');
  const body = app.slice(app.indexOf('updateToken(newToken) {'), app.indexOf('updateToken(newToken) {') + 900);
  assert.match(body, /if \(!this\.isUsable\(newToken\)\) return;/);
  assert.match(body, /Date\.now\(\) > payload\.exp/);
  assert.match(body, /payload\.userId/);
});
