// ML-231: the site security review's own rules (pure), and - the part that matters on every release -
// the real route files checked for a route that has lost its guard. No database.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { securityHeaders, headerFindings, cspValue } from '../middleware/securityHeaders.js';

process.env.DATABASE_URL ||= 'postgres://test@localhost/test';
const { routesIn, routeGuardFindings, OPEN_ROUTES, CHECKS, SECTIONS } = await import('../services/siteSecurityReview.js');
const { default: history } = await import('../securityReviews/site.js');
const { default: pool } = await import('../config/db.js');
test.after(() => pool.end().catch(() => {}));

const source = (name) => fs.readFileSync(new URL(`../routes/${name}`, import.meta.url), 'utf8');

describe('reading a routes file', () => {
  test('finds each route with the names in its chain', () => {
    const routes = routesIn(`
      router.get('/a', requireAuth, resolveAccount, async (req, res) => {});
      router.post("/b/:id", requireAuth, resolveAccount, requireSuperAdmin, async (req, res) => {});
      router.delete('/c', (req, res) => {});
      router.put('/d',
        requireAuth,
        resolveAccount,
        async (req, res) => {});`);
    assert.deepEqual(routes.map((r) => `${r.method} ${r.path} [${r.guards.join(' ')}]`), [
      'GET /a [requireAuth resolveAccount]', 'POST /b/:id [requireAuth resolveAccount requireSuperAdmin]', 'DELETE /c []', 'PUT /d [requireAuth resolveAccount]']);
  });
  test('an admin route without requireSuperAdmin is a problem', () => {
    const out = routeGuardFindings(`router.get('/x', requireAuth, resolveAccount, async (req, res) => {}); router.get('/y', requireAuth, resolveAccount, requireSuperAdmin, async (req, res) => {});`, 'admin');
    assert.deepEqual(out, { count: 2, problems: ['GET /x is not limited to super admins'] });
  });
  test('an app route needs a sign-in and an account, unless it is one of the deliberate exceptions', () => {
    const out = routeGuardFindings(`
      router.get('/open', async (req, res) => {});
      router.get('/half', requireAuth, async (req, res) => {});
      router.get('/fine', requireAuth, resolveAccount, async (req, res) => {});
      router.post('/upload', requireAuthFromQueryOrHeader, async (req, res) => {});
      router.get('/cron/usage-readings', async (req, res) => {});`, 'app');
    assert.deepEqual(out.problems, ['GET /open does not need a sign-in', 'GET /half does not work out whose account it is']);
  });
});

describe('the real route files (checked on every release)', () => {
  test('every admin route is limited to super admins', () => {
    const out = routeGuardFindings(source('admin.js'), 'admin');
    assert.ok(out.count >= 80, `only ${out.count} admin routes were found - the reader has stopped understanding the file`);
    assert.deepEqual(out.problems, []);
  });
  test('every app route needs a signed-in account, apart from the listed exceptions', () => {
    const out = routeGuardFindings(source('api.js'), 'app');
    assert.ok(out.count >= 140, `only ${out.count} app routes were found - the reader has stopped understanding the file`);
    assert.deepEqual(out.problems, []);
  });
  test('each exception is still a real route', () => {
    const real = new Set(routesIn(source('api.js')).map((r) => `${r.method} ${r.path}`));
    for (const name of Object.keys(OPEN_ROUTES)) assert.ok(real.has(name), `${name} is listed as deliberately open but is not a route any more`);
  });
});

describe('security headers', () => {
  test('what every answer carries', () => {
    const h = securityHeaders({ enforceCsp: false });
    assert.equal(h['X-Content-Type-Options'], 'nosniff');
    assert.equal(h['X-Frame-Options'], 'DENY');
    assert.equal(h['Referrer-Policy'], 'strict-origin-when-cross-origin');
    assert.match(h['Permissions-Policy'], /microphone=\(self\).*geolocation=\(\)/);
    assert.ok(h['Content-Security-Policy-Report-Only'] && !h['Content-Security-Policy']);
    assert.ok(securityHeaders({ enforceCsp: true })['Content-Security-Policy']);
  });
  test('the policy names where things may come from, and never allows the app to be framed or to load plugins', () => {
    const csp = cspValue();
    assert.match(csp, /default-src 'self'/);
    assert.match(csp, /frame-ancestors 'none'/);
    assert.match(csp, /object-src 'none'/);
    assert.match(csp, /frame-src https:\/\/www\.youtube-nocookie\.com/);
    assert.ok(!/\*\s|;\s*script-src[^;]*\*[^.]/.test(csp), 'no bare wildcard source');
  });
  test('the review says what is missing', () => {
    const none = headerFindings({});
    assert.deepEqual(none.filter((f) => !f.ok && f.level === 'fail').map((f) => f.text.split(':')[0]), ['strict-transport-security', 'x-content-type-options', 'framing by other sites', 'referrer-policy']);
    const ours = headerFindings({ ...securityHeaders({ enforceCsp: false }), 'Strict-Transport-Security': 'max-age=63072000; includeSubDomains; preload' });
    assert.deepEqual(ours.filter((f) => !f.ok).map((f) => f.level), ['warn']); // only: the policy is report-only
    assert.match(ours.find((f) => !f.ok).text, /report-only/);
    const enforced = headerFindings({ ...securityHeaders({ enforceCsp: true }), 'Strict-Transport-Security': 'max-age=63072000' });
    assert.deepEqual(enforced.filter((f) => !f.ok), []); // ML-474: enforced, with no inline script allowed - nothing left to say
    const loose = headerFindings({ 'content-security-policy': "default-src 'self'; script-src 'self' 'unsafe-inline'", 'Strict-Transport-Security': 'max-age=63072000' });
    assert.match(loose.find((f) => f.text.startsWith('content-security-policy')).text, /inline script is still allowed/);
    assert.equal(headerFindings({ 'strict-transport-security': 'max-age=300' })[0].ok, false);
  });
});

describe('the review\'s own lists hang together', () => {
  test('every check belongs to a section, and every recorded result to a check', () => {
    const sections = new Set(SECTIONS.map((s) => s.key));
    const keys = new Set(CHECKS.map((c) => c.key));
    for (const c of CHECKS) assert.ok(sections.has(c.section), `${c.key} is in no section`);
    for (const run of history.runs) for (const r of run.results) assert.ok(keys.has(r.checkKey), `${r.checkKey} (run ${run.id}) is not a check`);
  });
  test('the latest deep review gives every deep check a result and has a verdict', () => {
    const last = history.runs[history.runs.length - 1];
    const done = new Set(last.results.map((r) => r.checkKey));
    for (const c of CHECKS.filter((x) => x.mode === 'assisted')) assert.ok(done.has(c.key), `${c.key} has no result in run ${last.id}`);
    assert.ok(['go', 'conditional', 'no-go'].includes(last.verdict.status));
  });
});
