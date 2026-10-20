// The shared machinery behind Admin -> Security's site review (server/services/securityReview.js):
// the OSV advisory lookup the site's "Installed packages" check is built on. (ML-543: the rule
// helpers this file tested belonged to the review of the old PDF import's music-scanning service,
// ML-192, and went with it. The site review's own checks are tested in siteSecurity.test.js.)

import { test } from 'node:test';
import assert from 'node:assert/strict';

process.env.DATABASE_URL ??= 'postgres://test:test@localhost:5432/test';
const { osvLookup } = await import('../services/securityReview.js');

// Answers as api.osv.dev does: one result per query, then each advisory's details by id.
function fakeOsv(calls) {
  return async (url, options = {}) => {
    calls.push(url);
    const reply = (body) => ({ ok: true, status: 200, json: async () => body });
    if (url.endsWith('/v1/querybatch')) {
      const { queries } = JSON.parse(options.body);
      return reply({ results: queries.map((q) => (q.package.name === 'old-thing' ? { vulns: [{ id: 'GHSA-aaaa' }] } : {})) });
    }
    if (url.endsWith('/v1/vulns/GHSA-aaaa')) return reply({ id: 'GHSA-aaaa', aliases: ['CVE-2026-1'], summary: 'Bad input', database_specific: { severity: 'high' } });
    return { ok: false, status: 404, json: async () => ({}) };
  };
}

test('osvLookup pairs each package with its advisories, details filled in', async (t) => {
  const calls = [];
  t.mock.method(globalThis, 'fetch', fakeOsv(calls));
  const out = await osvLookup([
    { package: { ecosystem: 'npm', name: 'old-thing' }, version: '1.0.0' },
    { package: { ecosystem: 'npm', name: 'fine-thing' }, version: '2.0.0' }
  ]);
  assert.equal(out.length, 2);
  assert.deepEqual(out[0].vulns, [{ id: 'GHSA-aaaa', aliases: ['CVE-2026-1'], summary: 'Bad input', severity: 'HIGH' }]);
  assert.deepEqual(out[1].vulns, []);
  assert.equal(out[1].query.package.name, 'fine-thing');
  assert.ok(calls.every((u) => u.startsWith('https://api.osv.dev/')), 'only ever asks OSV');
});

test('osvLookup asks nothing for an empty list', async (t) => {
  const calls = [];
  t.mock.method(globalThis, 'fetch', fakeOsv(calls));
  assert.deepEqual(await osvLookup([]), []);
  assert.equal(calls.length, 0);
});
