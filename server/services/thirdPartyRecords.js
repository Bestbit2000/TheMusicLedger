// ML-462: the owner's own records about a third party (third_party_records, migration 104) - a
// reference, a note and which "needs attention" items are dealt with. The laying-over is in
// server/thirdParties/records.js.
import pool from '../config/db.js';
import { AGREEMENT_STATUSES, TRANSFER_SAFEGUARDS } from '../thirdParties/records.js';

const withStatus = (status, message) => Object.assign(new Error(message), { status });
const clean = (v, max) => String(v === null || v === undefined ? '' : v).trim().slice(0, max);

// { [partyKey]: { reference, note, attentionDone: [{ text, on }], agreementStatus, agreementOn, transferSafeguard } }
export async function listRecords() {
  const { rows } = await pool.query(
    `SELECT party_key, reference, note, attention_done, agreement_status, to_char(agreement_on, 'YYYY-MM-DD') AS agreement_on, transfer_safeguard FROM third_party_records`);
  return Object.fromEntries(rows.map((r) => [r.party_key, {
    reference: r.reference, note: r.note, attentionDone: r.attention_done || [],
    agreementStatus: r.agreement_status, agreementOn: r.agreement_on, transferSafeguard: r.transfer_safeguard
  }]));
}

// ML-469: the data processing agreement and the transfer safeguard for a third party that handles
// personal information. `personalKeys`: the entries it is asked of. A date only goes with "in place".
export async function saveAgreement(partyKey, data, personalKeys) {
  if (!personalKeys.includes(partyKey)) throw withStatus(404, 'An agreement isn\'t recorded for that one.');
  const status = clean(data && data.status, 20);
  const safeguard = clean(data && data.safeguard, 20);
  if (status && !AGREEMENT_STATUSES.includes(status)) throw withStatus(400, 'Choose in place, not in place or not needed.');
  if (safeguard && !TRANSFER_SAFEGUARDS.includes(safeguard)) throw withStatus(400, 'Choose a transfer safeguard from the list.');
  let on = clean(data && data.on, 10) || null;
  if (on && (!/^\d{4}-\d{2}-\d{2}$/.test(on) || Number.isNaN(Date.parse(on)))) throw withStatus(400, 'Enter the date as a day, month and year.');
  if (on && on > new Date().toISOString().slice(0, 10)) throw withStatus(400, 'That date is in the future.');
  if (status !== 'in_place') on = null;
  await pool.query(
    `INSERT INTO third_party_records (party_key, agreement_status, agreement_on, transfer_safeguard) VALUES ($1, $2, $3, $4)
     ON CONFLICT (party_key) DO UPDATE SET agreement_status = EXCLUDED.agreement_status, agreement_on = EXCLUDED.agreement_on,
                                           transfer_safeguard = EXCLUDED.transfer_safeguard, updated_at = now()`,
    [partyKey, status, on, safeguard]
  );
}

const known = (partyKey, partyKeys) => { if (!partyKeys.includes(partyKey)) throw withStatus(404, 'That isn\'t in the list of third parties.'); };

export async function saveRecord(partyKey, data, partyKeys) {
  known(partyKey, partyKeys);
  await pool.query(
    `INSERT INTO third_party_records (party_key, reference, note) VALUES ($1, $2, $3)
     ON CONFLICT (party_key) DO UPDATE SET reference = EXCLUDED.reference, note = EXCLUDED.note, updated_at = now()`,
    [partyKey, clean(data && data.reference, 200), clean(data && data.note, 1000)]
  );
}

// Mark one "needs attention" item (by its wording) as dealt with today, or open again.
export async function setAttentionDone(partyKey, text, done, attentionTexts, partyKeys) {
  known(partyKey, partyKeys);
  if (!attentionTexts.includes(text)) throw withStatus(400, 'That item isn\'t on the list any more. Reload the page.');
  const records = await listRecords();
  const kept = ((records[partyKey] || {}).attentionDone || []).filter((d) => d.text !== text);
  if (done) kept.push({ text, on: new Date().toISOString().slice(0, 10) });
  await pool.query(
    `INSERT INTO third_party_records (party_key, attention_done) VALUES ($1, $2)
     ON CONFLICT (party_key) DO UPDATE SET attention_done = EXCLUDED.attention_done, updated_at = now()`,
    [partyKey, JSON.stringify(kept)]
  );
}
