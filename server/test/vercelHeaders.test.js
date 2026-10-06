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
  test('it is the same list the app sends from Express', () => {
    // The content security policy is either report-only or enforced (ML-474) - the same policy either way
    const enforced = 'Content-Security-Policy' in declared;
    assert.deepEqual(declared, securityHeaders({ enforceCsp: enforced }), HINT);
  });
  test('the review would pass a page that carries them', () => {
    const page = { ...declared, 'Strict-Transport-Security': 'max-age=63072000' }; // Vercel adds this one itself
    assert.deepEqual(headerFindings(page).filter((f) => !f.ok && f.level === 'fail'), []);
  });
});
