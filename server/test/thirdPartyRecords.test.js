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
