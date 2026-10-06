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
