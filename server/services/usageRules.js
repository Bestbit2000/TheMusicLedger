// ML-22: which usage counts the server takes (server/test/usageCounts.test.js). Pure - no database.
// The same rules as the page (public/usage.js), loaded with vm as restMessages.js loads practicePlan.js.
import fs from 'node:fs';
import vm from 'node:vm';

const sandbox = { self: {} };
vm.runInNewContext(fs.readFileSync(new URL('../../public/usage.js', import.meta.url), 'utf8'), sandbox);
export const Usage = sandbox.self.Usage;

const withStatus = (status, message) => Object.assign(new Error(message), { status });
const MOST_ROWS = 300;   // in one send
const MOST_EACH = 500;   // presses of one button in 30 seconds is already a lot

// Only well-formed rows: a known kind and place, an item that is a name (never typed text), a use from
// the list, a screen that is a screen, and small whole numbers. Anything else is dropped, not refused.
// One row per item (the device sends one already; two would stop the database adding them up).
export function cleanRows(rows) {
  if (!Array.isArray(rows) || rows.length > MOST_ROWS) throw withStatus(400, 'Too many counts at once.');
  const n = (v) => { const x = Number(v); return Number.isInteger(x) && x >= 0 ? Math.min(x, MOST_EACH) : 0; };
  return rows.filter((r) => r && Usage.KINDS.includes(r.k) && Usage.PLACES.includes(r.p) && typeof r.i === 'string' && Usage.ITEM.test(r.i)
    && (r.k !== 'use' || Object.prototype.hasOwnProperty.call(Usage.USES, r.i))
    && (r.k !== 'view' || /^[a-zA-Z0-9]+View$/.test(r.i)))
    .map((r) => ({ kind: r.k, item: r.i, place: r.p, started: n(r.s), finished: r.k === 'use' ? n(r.f) : 0, members: Math.min(n(r.m), 1) }))
    .filter((r) => r.started || r.finished)
    .reduce((list, r) => {
      const same = list.find((x) => x.kind === r.kind && x.item === r.item && x.place === r.place);
      if (!same) list.push(r);
      else { same.started = Math.min(same.started + r.started, MOST_EACH); same.finished = Math.min(same.finished + r.finished, MOST_EACH); same.members = Math.min(same.members + r.members, 1); }
      return list;
    }, []);
}

// who: 'member', 'admin' (a super admin - the owner's own use) or 'test' (a local test account)
export function whoFor(userId, level) {
  if (String(userId || '').toLowerCase().endsWith('@themusicledger.local')) return 'test';
  return level === 'super_admin' ? 'admin' : 'member';
}
