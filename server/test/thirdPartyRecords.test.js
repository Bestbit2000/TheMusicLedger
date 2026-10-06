// ML-462: the owner's own records laid over the third-party register (server/thirdParties/records.js). Pure.
import test from 'node:test';
import assert from 'node:assert/strict';
import { applyRecords, openAttentionCount } from '../thirdParties/records.js';

const entries = [
  { key: 'ico', name: 'ICO', status: 'attention', attention: ['Pay the fee.', 'Tell them about a change.'] },
  { key: 'neon', name: 'Neon', status: 'in_use' },
  { key: 'resend', name: 'Resend', status: 'attention', attention: ['Verify a domain.'] }
];

test('with nothing recorded the register is as it was, with empty records', () => {
  const out = applyRecords(entries, {});
  assert.deepEqual(out[0].attention, ['Pay the fee.', 'Tell them about a change.']);
  assert.deepEqual(out[0].attentionDone, []);
  assert.equal(out[0].status, 'attention');
  assert.deepEqual(out[1].record, { reference: '', note: '' });
  assert.equal(openAttentionCount(entries, undefined), 3);
});

test('an item marked as dealt with moves out of the open list, with its date', () => {
  const out = applyRecords(entries, { ico: { reference: 'ZB123', note: 'Renews each October', attentionDone: [{ text: 'Pay the fee.', on: '2026-10-06' }] } });
  assert.deepEqual(out[0].attention, ['Tell them about a change.']);
  assert.deepEqual(out[0].attentionDone, [{ text: 'Pay the fee.', on: '2026-10-06' }]);
  assert.equal(out[0].status, 'attention'); // one is still open
  assert.deepEqual(out[0].record, { reference: 'ZB123', note: 'Renews each October' });
});

test('when every item is dealt with the entry stops saying it needs attention', () => {
  const records = { resend: { attentionDone: [{ text: 'Verify a domain.', on: '2026-10-06' }] } };
  assert.equal(applyRecords(entries, records)[2].status, 'in_use');
  assert.equal(openAttentionCount(entries, records), 2);
});

test('an item the register words afresh is open again, and an old mark for wording that has gone is ignored', () => {
  const out = applyRecords(entries, { resend: { attentionDone: [{ text: 'An older wording.', on: '2026-09-01' }] } });
  assert.deepEqual(out[2].attention, ['Verify a domain.']);
  assert.deepEqual(out[2].attentionDone, []);
});

test('the register itself is never changed', () => {
  applyRecords(entries, { ico: { attentionDone: [{ text: 'Pay the fee.', on: '2026-10-06' }] } });
  assert.equal(entries[0].attention.length, 2);
});

// ---- ML-469: the data processing agreement and the transfer safeguard
const { agreementMissing } = await import('../thirdParties/records.js');
const personal = [
  { key: 'neon', name: 'Neon', status: 'in_use', personalData: true },
  { key: 'vercel', name: 'Vercel', status: 'attention', personalData: true, attention: ['Upgrade to Pro.'] },
  { key: 'resend', name: 'Resend', status: 'not_in_use', personalData: true },
  { key: 'jsdelivr', name: 'jsDelivr', status: 'in_use' }
];

test('a third party that handles personal information with nothing recorded needs attention: the agreement and the safeguard', () => {
  const [neon, , , jsdelivr] = applyRecords(personal, {});
  assert.deepEqual(neon.agreement, { status: '', on: null, safeguard: '' });
  assert.equal(neon.agreementAttention.length, 2);
  assert.match(neon.agreementAttention[0], /Data processing agreement: not recorded yet/);
  assert.match(neon.agreementAttention[1], /Transfer safeguard: not recorded yet/);
  assert.equal(neon.status, 'attention');
  // One that handles nobody's information is not asked
  assert.equal(jsdelivr.agreement, undefined);
  assert.equal(jsdelivr.agreementAttention, undefined);
  assert.equal(jsdelivr.status, 'in_use');
});

test('in place with a safeguard: nothing to say, and the date is kept', () => {
  const [neon] = applyRecords(personal, { neon: { agreementStatus: 'in_place', agreementOn: '2026-10-06', transferSafeguard: 'data_bridge' } });
  assert.deepEqual(neon.agreement, { status: 'in_place', on: '2026-10-06', safeguard: 'data_bridge' });
  assert.deepEqual(neon.agreementAttention, []);
  assert.equal(neon.status, 'in_use');
});

test('not in place is said plainly, and counts on the menu and the Dashboard', () => {
  const records = { neon: { agreementStatus: 'in_place', transferSafeguard: 'data_bridge' }, vercel: { agreementStatus: 'not_in_place', transferSafeguard: 'data_bridge' } };
  const [, vercel] = applyRecords(personal, records);
  assert.deepEqual(vercel.agreementAttention, ['No data processing agreement is in place.']);
  assert.equal(vercel.status, 'attention');
  // Vercel: its own open item + the missing agreement. Resend isn't in use but is still counted as unrecorded (2).
  assert.equal(openAttentionCount(personal, records), 1 + 1 + 2);
});

test('"not needed" asks for nothing more - no safeguard either', () => {
  assert.deepEqual(agreementMissing({ status: 'not_needed', on: null, safeguard: '' }), []);
  assert.deepEqual(agreementMissing({ status: 'in_place', on: null, safeguard: '' }).length, 1);
  assert.deepEqual(agreementMissing({ status: 'in_place', on: null, safeguard: 'not_needed' }), []);
});

test('one that is not in use is not turned into "needs attention" by a missing agreement', () => {
  const [, , resend] = applyRecords(personal, {});
  assert.equal(resend.status, 'not_in_use');
});

test('a "needs attention" entry whose own items are all dealt with still needs attention while the agreement is missing', () => {
  const [, vercel] = applyRecords(personal, { vercel: { attentionDone: [{ text: 'Upgrade to Pro.', on: '2026-10-06' }] } });
  assert.deepEqual(vercel.attention, []);
  assert.equal(vercel.status, 'attention');
});

test('what can be recorded is checked before anything is saved', async () => {
  process.env.DATABASE_URL ||= 'postgres://test@localhost/test';
  const { saveAgreement } = await import('../services/thirdPartyRecords.js');
  const { default: pool } = await import('../config/db.js');
  const keys = ['neon', 'vercel'];
  const refused = (code) => (e) => e.status === code;
  try {
    await assert.rejects(saveAgreement('jsdelivr', { status: 'in_place' }, keys), refused(404)); // not one it is asked of
    await assert.rejects(saveAgreement('neon', { status: 'signed' }, keys), refused(400));
    await assert.rejects(saveAgreement('neon', { status: 'in_place', safeguard: 'trust' }, keys), refused(400));
    await assert.rejects(saveAgreement('neon', { status: 'in_place', on: '6 Oct 2026' }, keys), refused(400));
    await assert.rejects(saveAgreement('neon', { status: 'in_place', on: '2999-01-01' }, keys), refused(400));
  } finally {
    await pool.end().catch(() => {});
  }
});
