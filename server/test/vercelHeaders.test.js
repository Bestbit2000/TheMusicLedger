// ML-477: the pages on the live site are static files that Vercel serves without Express, so the
// security headers have to be declared in vercel.json as well as set by the middleware. This keeps the
// two in step: change the list in server/middleware/securityHeaders.js, then `npm run sync-vercel-headers`.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { securityHeaders, headerFindings } from '../middleware/securityHeaders.js';

const config = JSON.parse(fs.readFileSync(new URL('../../vercel.json', import.meta.url), 'utf8'));
const rule = (config.headers || []).find((h) => h.source === '/(.*)');
const declared = Object.fromEntries(((rule && rule.headers) || []).map((h) => [h.key, h.value]));
const HINT = 'vercel.json is out of step with securityHeaders() - run `npm run sync-vercel-headers`';

describe('vercel.json carries the security headers for the pages', () => {
  test('there is one rule for every address', () => {
    assert.ok(rule, 'vercel.json has no "headers" rule for /(.*)');
    assert.equal(rule.headers.length, Object.keys(declared).length, 'a header is declared twice');
  });
  test('it is the same list the app sends from Express - with the policy enforced', () => {
    // ML-555: the policy has been switched on for the pages since 7 Oct 2026 (ML-474). A plain run of the sync script once
    // put them back to report-only (0.63.0) and nothing noticed, so a report-only vercel.json now fails the release.
    assert.ok('Content-Security-Policy' in declared, 'vercel.json declares the content security policy report-only - run `npm run sync-vercel-headers` (enforced is its default)');
    assert.deepEqual(declared, securityHeaders({ enforceCsp: true }), HINT);
  });
  test('the review would pass a page that carries them', () => {
    const page = { ...declared, 'Strict-Transport-Security': 'max-age=63072000' }; // Vercel adds this one itself
    assert.deepEqual(headerFindings(page).filter((f) => !f.ok && f.level === 'fail'), []);
  });
});
