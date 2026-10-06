// ML-462: the owner's own records laid over the register (pure - tested in thirdPartyRecords.test.js).
// A "needs attention" item is matched by its wording, so if the register later words a new item, that
// one is open again. An entry whose items are all dealt with stops saying "Needs attention".
export function applyRecords(entries, records) {
  return entries.map((e) => {
    const r = (records && records[e.key]) || {};
    const done = Array.isArray(r.attentionDone) ? r.attentionDone : [];
    const all = e.attention || [];
    const open = all.filter((text) => !done.some((d) => d.text === text));
    const dealt = all.filter((text) => !open.includes(text)).map((text) => ({ text, on: done.find((d) => d.text === text).on || null }));
    return {
      ...e,
      attention: open,
      attentionDone: dealt,
      status: e.status === 'attention' && all.length && !open.length ? 'in_use' : e.status,
      record: { reference: r.reference || '', note: r.note || '' }
    };
  });
}

export const openAttentionCount = (entries, records) => applyRecords(entries, records).reduce((sum, e) => sum + e.attention.length, 0);
