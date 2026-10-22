// ML-580: the waiting list's form (server/services/joinRequests.js, readJoinForm) - what is kept, what a robot is
// quietly told "thanks" for, and what a person is asked to put right. Plus, from the source: the form sends no
// email, its routes are the listed open ones, and the admin routes are guarded. Pure: the pool is never queried.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

process.env.DATABASE_URL ||= 'postgres://test@localhost/test';
const { readJoinForm, bandLabel, MIN_FILL_MS } = await import('../services/joinRequests.js');
const read = (path) => fs.readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');

const NOW = 1_800_000_000_000;
const person = { firstName: ' Sam ', lastName: 'Reed', email: 'Sam.Reed@Example.com ', band: 'The Cobham Band', instrumentId: '7', ageConfirmed: true, started: String(NOW - 60_000) };

describe('readJoinForm', () => {
  test('a person: names tidied, email lower-cased, band and instrument kept', () => {
    assert.deepEqual(readJoinForm(person, NOW), { firstName: 'Sam', lastName: 'Reed', email: 'sam.reed@example.com', band: 'The Cobham Band', instrumentId: 7 });
  });
  test('band and instrument are optional', () => {
    const out = readJoinForm({ ...person, band: '', instrumentId: '' }, NOW);
    assert.equal(out.band, null);
    assert.equal(out.instrumentId, null);
  });
  test('a robot - the hidden field filled, or sent a moment after the page opened - is dropped, not told', () => {
    assert.deepEqual(readJoinForm({ ...person, website: 'http://spam.example' }, NOW), { drop: true });
    assert.deepEqual(readJoinForm({ ...person, started: String(NOW - (MIN_FILL_MS - 1)) }, NOW), { drop: true });
  });
  test('without the script (no start time) the form still counts', () => {
    assert.equal(readJoinForm({ ...person, started: '' }, NOW).email, 'sam.reed@example.com');
  });
  test('a person is asked to put right a missing name, a bad email, or the age tick', () => {
    assert.match(readJoinForm({ ...person, lastName: '  ' }, NOW).error, /first name and last name/);
    assert.match(readJoinForm({ ...person, email: 'not-an-email' }, NOW).error, /email address/);
    assert.match(readJoinForm({ ...person, ageConfirmed: false }, NOW).error, /parent or carer/);
  });
  test('the plain form (no script) sends the tick as "true"', () => {
    assert.equal(readJoinForm({ ...person, ageConfirmed: 'true' }, NOW).firstName, 'Sam');
  });
  test('a directory band is offered with its town, so two of the same name can be told apart', () => {
    assert.equal(bandLabel({ name: 'Cobham Band', town: 'Cobham' }), 'Cobham Band (Cobham)');
    assert.equal(bandLabel({ name: 'Cobham Band', town: null }), 'Cobham Band');
  });
});

describe('the waiting list, from the source', () => {
  test('the form never sends an email', () => {
    const src = read('server/services/joinRequests.js');
    assert.doesNotMatch(src, /sendMail\(/);
    const submit = src.slice(src.indexOf('export async function submitJoinRequest'), src.indexOf('// ---- Admin'));
    assert.doesNotMatch(submit, /createInvite|createTargetedNotification/, 'only the owner\'s Let in or Pass on contacts anyone');
  });
  test('the sender is counted by a hash, never the address itself', () => {
    assert.match(read('server/services/joinRequests.js'), /limitJoinRequests\(crypto\.createHash\('sha256'\)/);
  });
  test('the admin routes are super admins only, behind the admin check', () => {
    const admin = read('server/routes/admin.js');
    for (const route of ["get('/join-requests'", "post('/join-requests/:id/let-in'", "post('/join-requests/:id/pass'", "delete('/join-requests/:id'"]) {
      assert.match(admin, new RegExp(`router\\.${route.replace(/[()/:.]/g, (c) => `\\${c}`)}, requireAuth, resolveAccount, requireSuperAdmin, requireAdminCheck,`), route);
    }
  });
  test('requests are cleared after 90 days by the daily job', () => {
    assert.match(read('server/services/retention.js'), /DELETE FROM join_requests WHERE updated_at < now\(\) - make_interval\(days => 90\)/);
  });
});
