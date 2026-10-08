// ML-429: the sums behind Admin -> Third parties' costs and usage. Pure - no database - so they are
// tested on their own (server/test/thirdPartyCosts.test.js).

const DAY = 86400000;
const dayOf = (d) => { const x = new Date(typeof d === 'string' ? `${d.slice(0, 10)}T00:00:00Z` : d); return Date.UTC(x.getUTCFullYear(), x.getUTCMonth(), x.getUTCDate()); };
const iso = (ms) => new Date(ms).toISOString().slice(0, 10);

// How many times a cost has been charged up to and including `today`. A repeating cost is charged
// on the day it starts and then every week / month / year on from that; one that has ended stops at
// its end date. A cost that hasn't started yet has been charged 0 times.
export function chargesSoFar(cost, today) {
  const start = dayOf(cost.startedOn);
  const until = Math.min(dayOf(today), cost.endedOn ? dayOf(cost.endedOn) : Infinity);
  if (until < start) return 0;
  if (cost.cadence === 'one_off') return 1;
  if (cost.cadence === 'weekly') return Math.floor((until - start) / (7 * DAY)) + 1;
  const a = new Date(start);
  const b = new Date(until);
  let months = (b.getUTCFullYear() - a.getUTCFullYear()) * 12 + (b.getUTCMonth() - a.getUTCMonth());
  if (b.getUTCDate() < a.getUTCDate()) months -= 1; // this month's charge day hasn't come yet
  if (cost.cadence === 'monthly') return months + 1;
  return Math.floor(months / 12) + 1; // yearly
}

// Still being charged on `today`?
export function isRunning(cost, today) {
  if (cost.cadence === 'one_off') return false;
  const t = dayOf(today);
  return dayOf(cost.startedOn) <= t && (!cost.endedOn || dayOf(cost.endedOn) >= t);
}

const PER_YEAR = { weekly: 52, monthly: 12, yearly: 1 };

// Everything the page shows about money, in both currencies. usdPerGbp is the owner's own rate.
// Each amount is { gbp, usd }.
export function costSummary(costs, today, usdPerGbp) {
  const rate = Number(usdPerGbp) > 0 ? Number(usdPerGbp) : 1;
  const both = (amount, currency) => (currency === 'GBP' ? { gbp: amount, usd: amount * rate } : { gbp: amount / rate, usd: amount });
  const add = (sum, x) => ({ gbp: sum.gbp + x.gbp, usd: sum.usd + x.usd });
  const round = (x) => ({ gbp: Math.round(x.gbp * 100) / 100, usd: Math.round(x.usd * 100) / 100 });
  let spent = { gbp: 0, usd: 0 };
  let perYear = { gbp: 0, usd: 0 };
  const byParty = {};
  const rows = costs.map((c) => {
    const amount = Number(c.amount);
    const n = chargesSoFar(c, today);
    const paid = both(amount * n, c.currency);
    const running = isRunning(c, today);
    const yearly = running ? both(amount * PER_YEAR[c.cadence], c.currency) : { gbp: 0, usd: 0 };
    spent = add(spent, paid);
    perYear = add(perYear, yearly);
    const p = byParty[c.partyKey] || (byParty[c.partyKey] = { spent: { gbp: 0, usd: 0 }, perYear: { gbp: 0, usd: 0 } });
    p.spent = add(p.spent, paid);
    p.perYear = add(p.perYear, yearly);
    return { ...c, amount, charges: n, running, spent: round(paid), each: round(both(amount, c.currency)) };
  });
  Object.values(byParty).forEach((p) => { p.spent = round(p.spent); p.perMonth = round({ gbp: p.perYear.gbp / 12, usd: p.perYear.usd / 12 }); p.perYear = round(p.perYear); });
  return {
    rate,
    spent: round(spent),
    perMonth: round({ gbp: perYear.gbp / 12, usd: perYear.usd / 12 }),
    perYear: round(perYear),
    byParty,
    rows
  };
}

// ML-443: what was paid in one calendar month ('2026-10'), in pounds - the payments that fell in it, up
// to and including `today` if the month isn't over. A month that hasn't started has paid nothing.
export function paidInMonth(costs, month, today, usdPerGbp) {
  const rate = Number(usdPerGbp) > 0 ? Number(usdPerGbp) : 1;
  const [y, m] = month.split('-').map(Number);
  const first = Date.UTC(y, m - 1, 1);
  const upTo = Math.min(dayOf(today), Date.UTC(y, m, 0));
  if (upTo < first) return 0;
  const sum = costs.reduce((total, c) => {
    const amount = Number(c.amount) * (chargesSoFar(c, iso(upTo)) - chargesSoFar(c, iso(first - DAY)));
    return total + (c.currency === 'GBP' ? amount : amount / rate);
  }, 0);
  return Math.round(sum * 100) / 100;
}

// The billing period a reading belongs to: what its source said, or the calendar month of `at`.
export function periodFor(at, given) {
  if (given && given.start && given.end) return { start: iso(dayOf(given.start)), end: iso(dayOf(given.end)) };
  const d = new Date(dayOf(at));
  return { start: iso(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)), end: iso(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)) };
}

// Where a meter stands: percent of the limit used, what it is heading for by the end of the period
// at this rate, and - if that is over the limit - the day it would be reached. A meter with no
// period (a total, like storage) has no projection: it only goes up when something is added.
export function meterStatus({ value, limit, period, today, cumulative }) {
  const used = Number(value);
  const cap = Number(limit);
  const percent = cap > 0 ? Math.round((used / cap) * 1000) / 10 : null;
  const out = { value: used, limit: cap, percent, level: percent === null ? 'info' : percent >= 90 ? 'fail' : percent >= 75 ? 'warn' : 'pass', projected: null, reachesLimitOn: null };
  if (!cumulative || !period || !(cap > 0)) return out;
  const start = dayOf(period.start);
  const end = dayOf(period.end);
  const now = Math.min(Math.max(dayOf(today), start), end);
  const daysIn = (now - start) / DAY + 1;
  const daysTotal = (end - start) / DAY + 1;
  const perDay = used / daysIn;
  out.projected = Math.round(perDay * daysTotal * 10) / 10;
  if (perDay > 0 && out.projected > cap) out.reachesLimitOn = iso(start + Math.ceil(cap / perDay - 1) * DAY);
  return out;
}

// Which warnings are now due for a meter: the thresholds reached that haven't been sent this period.
export function alertsDue(percent, alreadySent, thresholds = [75, 90]) {
  if (percent === null || percent === undefined) return [];
  return thresholds.filter((t) => percent >= t && !alreadySent.includes(t));
}

// ---- Vercel's bill, line by line (the spend reader)
// Vercel's billing API answers in FOCUS format: one JSON object a line, each a charge for one
// service on one day - what was used (ConsumedQuantity, ConsumedUnit) and what it cost. The same
// service can come back several times for a day (a line per project or region), so the lines are
// added up to one per day, service and kind of charge. A line that can't be read is skipped.
//
// cost is the larger of BilledCost and EffectiveCost: which of the two carries the value of usage
// paid for by the plan's included credit is for the first real reading to show, and the larger is
// right either way.
export function parseChargeLines(text) {
  const byKey = new Map();
  String(text || '').split(/\r?\n/).forEach((raw) => {
    const line = raw.trim();
    if (!line) return;
    let c;
    try { c = JSON.parse(line); } catch (error) { return; }
    if (!c || typeof c !== 'object' || !c.ChargePeriodStart) return;
    const day = String(c.ChargePeriodStart).slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return;
    const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
    const sku = String(c.SkuId || c.ServiceName || 'unknown').slice(0, 200);
    const category = String(c.ChargeCategory || 'Usage');
    const key = `${day}|${sku}|${category}`;
    const row = byKey.get(key) || { day, sku, service: String(c.ServiceName || sku).slice(0, 200), category, unit: c.ConsumedUnit ? String(c.ConsumedUnit).slice(0, 60) : '', quantity: 0, cost: 0 };
    row.quantity += num(c.ConsumedQuantity);
    row.cost += Math.max(num(c.BilledCost), num(c.EffectiveCost));
    byKey.set(key, row);
  });
  return [...byKey.values()].sort((a, b) => (a.day + a.sku).localeCompare(b.day + b.sku));
}

// The billing period `today` falls in, for a provider that bills from a day of the month:
// { start, end }, both days inside the period. billingDay is kept to 1-28 so every month has one.
export function billingPeriod(billingDay, today) {
  const day = Math.min(28, Math.max(1, Math.floor(Number(billingDay)) || 1));
  const now = new Date(dayOf(today));
  const start = Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (now.getUTCDate() < day ? 1 : 0), day);
  const s = new Date(start);
  return { start: iso(start), end: iso(Date.UTC(s.getUTCFullYear(), s.getUTCMonth() + 1, day) - DAY) };
}

// Where the usage in a period is going: one row a service with what was used and what it cost so
// far, what both are heading for by the end of the period at this rate, and the same per member
// who used the app in the period. Only usage counts - the plan's own fee, tax and credits are not
// usage. The newest day in `lines` may be part-counted by the provider; the rate is taken over the
// days gone, as meterStatus does, so it errs low early in a day rather than high.
export function spendBreakdown(lines, period, today, activeMembers) {
  const start = dayOf(period.start);
  const end = dayOf(period.end);
  const now = Math.min(Math.max(dayOf(today), start), end);
  const daysIn = (now - start) / DAY + 1;
  const daysTotal = (end - start) / DAY + 1;
  const scale = daysTotal / daysIn;
  const members = Number(activeMembers) > 0 ? Number(activeMembers) : 0;
  const r4 = (n) => Math.round(n * 10000) / 10000;
  const bySku = new Map();
  const byDay = new Map();
  (lines || []).forEach((l) => {
    if (l.category !== 'Usage') return;
    const d = dayOf(l.day);
    if (d < start || d > end) return;
    const row = bySku.get(l.sku) || { sku: l.sku, service: l.service, unit: l.unit, quantity: 0, cost: 0 };
    row.quantity += Number(l.quantity) || 0;
    row.cost += Number(l.cost) || 0;
    if (!row.unit && l.unit) row.unit = l.unit;
    bySku.set(l.sku, row);
    byDay.set(l.day, (byDay.get(l.day) || 0) + (Number(l.cost) || 0));
  });
  const services = [...bySku.values()].map((s) => ({
    ...s, quantity: r4(s.quantity), cost: r4(s.cost),
    projectedQuantity: r4(s.quantity * scale), projectedCost: r4(s.cost * scale),
    perMember: members ? { quantity: r4((s.quantity * scale) / members), cost: r4((s.cost * scale) / members) } : null
  })).sort((a, b) => b.cost - a.cost || b.quantity - a.quantity || a.service.localeCompare(b.service));
  const total = services.reduce((sum, s) => sum + s.cost, 0);
  return {
    period, daysIn, daysTotal, members,
    total: r4(total), projected: r4(total * scale),
    perMember: members ? r4((total * scale) / members) : null,
    services,
    daily: [...byDay.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([day, cost]) => ({ day, cost: r4(cost) }))
  };
}
