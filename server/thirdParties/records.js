// ML-462: the owner's own records laid over the register (pure - tested in thirdPartyRecords.test.js).
// A "needs attention" item is matched by its wording, so if the register later words a new item, that
// one is open again. An entry whose items are all dealt with stops saying "Needs attention".
// ML-469: the agreement and the transfer safeguard recorded for a third party that handles personal
// information (entry.personalData) - and what is still missing, in words. Pure.
export const AGREEMENT_STATUSES = ['in_place', 'not_in_place', 'not_needed'];
export const TRANSFER_SAFEGUARDS = ['data_bridge', 'uk_addendum', 'adequacy', 'not_needed'];
export function agreementMissing(agreement) {
  const out = [];
  if (!agreement.status) out.push('Data processing agreement: not recorded yet. Say whether one is in place.');
  else if (agreement.status === 'not_in_place') out.push('No data processing agreement is in place.');
  if (!agreement.safeguard && agreement.status !== 'not_needed') out.push('Transfer safeguard: not recorded yet. Say how information that leaves the UK is protected.');
  return out;
}

export function applyRecords(entries, records) {
  return entries.map((e) => {
    const r = (records && records[e.key]) || {};
    const agreement = e.personalData ? { status: r.agreementStatus || '', on: r.agreementOn || null, safeguard: r.transferSafeguard || '' } : null;
    const agreementAttention = agreement ? agreementMissing(agreement) : [];
    const done = Array.isArray(r.attentionDone) ? r.attentionDone : [];
    const all = e.attention || [];
    const open = all.filter((text) => !done.some((d) => d.text === text));
    const dealt = all.filter((text) => !open.includes(text)).map((text) => ({ text, on: done.find((d) => d.text === text).on || null }));
    return {
      ...e,
      attention: open,
      attentionDone: dealt,
      // (an agreement or safeguard still missing keeps - or makes - it "needs attention", unless it isn't in use)
      status: agreementAttention.length && e.status !== 'not_in_use' ? 'attention'
        : e.status === 'attention' && all.length && !open.length ? 'in_use' : e.status,
      record: { reference: r.reference || '', note: r.note || '' },
      ...(agreement ? { agreement, agreementAttention } : {})
    };
  });
}

export const openAttentionCount = (entries, records) => applyRecords(entries, records).reduce((sum, e) => sum + e.attention.length + (e.agreementAttention || []).length, 0);
