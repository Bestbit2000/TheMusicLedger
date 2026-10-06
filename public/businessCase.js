// ML-443: the sums behind Admin -> Business case - what each way of rolling the app out costs and
// could earn, month by month, for up to five years. Pure logic, no DOM and no database: loaded in the
// browser (window.BusinessCase, before admin-business.js) so a changed figure redraws at once, in Node
// by server/test/businessCase.test.js, and by the server to check a plan before saving it
// (server/services/businessCase.js). The rules are written up in docs/business-case.md.
//
//   - A PLAN is one document: when building started, the launch month, how many years to look at,
//     the dollar rate, a price list of COSTS, and the SCENARIOS that choose from it.
//   - A cost is paid every month, every year or once, from a month (so many months after launch, or a
//     set calendar month) until another. It can be a fixed amount or so much for each member above a
//     number, and can wait until there are enough members. One cost is worked out instead of typed:
//     the database, which is free until it has been awake more than its allowance in a month.
//   - A scenario says how many members there are at launch and at the end of each year (a straight
//     line in between), which costs it includes, and what it earns: Premium memberships, other
//     income counted by the year (band licences, teacher plans...), gifts and adverts.
//   - Two ways of counting. CASH is money in the month it moves. REVENUE BASIS spreads a yearly
//     payment over the twelve months it covers.
//   - The answer the owner wants is PAYBACK: the month the running total (from the first month of
//     building) gets back to nought - or how far short it is when the plan ends.
(function (root, factory) {
    if (typeof module === 'object' && module.exports) module.exports = factory();
    else root.BusinessCase = factory();
}(typeof self !== 'undefined' ? self : this, function () {
    'use strict';

    const MAX_YEARS = 5;
    const MAX_COSTS = 80;
    const MAX_SCENARIOS = 12;
    const MAX_EXTRAS = 12;
    const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const EVERY = ['month', 'year', 'once'];
    // What a cost's figure rests on: being paid today, a published price, an estimate, or the owner's own.
    const BASES = ['paying', 'published', 'estimate', 'mine'];
    const DAYS_IN_MONTH = 30.4;

    // A month as a number (year x 12 + month), so months can be added and compared.
    const ym = (s) => { const [y, m] = String(s).split('-').map(Number); return y * 12 + (m - 1); };
    const ymText = (n) => `${Math.floor(n / 12)}-${String((n % 12) + 1).padStart(2, '0')}`;
    const monthLabel = (n) => `${MONTH_NAMES[((n % 12) + 12) % 12]} ${Math.floor(n / 12)}`;
    const isMonth = (s) => typeof s === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(s);
    const round2 = (x) => Math.round((x + Number.EPSILON) * 100) / 100;

    // When a cost starts or stops: { months: n } is n months after launch (negative = before);
    // { month: 'YYYY-MM' } is a set calendar month.
    const when = (w, launch) => (w && w.month ? ym(w.month) : launch + ((w && Number(w.months)) || 0));

    // Members in month t (0 = the launch month). members[0] is the number at launch and members[y] the
    // number at the end of year y; each year runs in a straight line from one to the next.
    function membersAt(members, t) {
        if (t < 0) return 0;
        const y = Math.min(Math.floor(t / 12), members.length - 2);
        const a = Number(members[y]) || 0;
        const b = Number(members[y + 1]) || 0;
        return a + ((b - a) * Math.min(t - y * 12, 11)) / 11; // multiply first: 110 x 6 / 11 is exactly 60
    }

    // The database is billed for the hours it is awake, and it stays awake while anyone has the app
    // on screen, so visits overlap: the share of the day it is awake is 1 - (1 - visit/day)^visits.
    function databaseHours(members, u) {
        const visits = Math.max(0, members) * (u.dailyShare / 100);
        const q = Math.min(1, u.visitMinutes / (u.windowHours * 60));
        return u.devHours + u.computeSize * u.windowHours * DAYS_IN_MONTH * (1 - Math.pow(1 - q, visits));
    }
    // The most members the free database allowance carries at these usage figures.
    function membersOnFreeDatabase(u) {
        const room = (u.freeHours - u.devHours) / (u.computeSize * u.windowHours * DAYS_IN_MONTH);
        if (room <= 0) return 0;
        if (room >= 1) return Infinity;
        const q = Math.min(0.999999, u.visitMinutes / (u.windowHours * 60));
        return Math.floor(Math.log(1 - room) / Math.log(1 - q) / (u.dailyShare / 100));
    }
    const databaseCost = (hours, u) => hours * u.hourPrice + (u.storageGb || 0) * u.storagePrice; // US dollars

    // What is left of a price after the fees of the way it is paid: 'card' on the website, or 'stores'
    // (Apple and Google take the VAT off first, then their commission).
    function netOfFees(price, route, fees) {
        if (!(price > 0)) return 0;
        if (route === 'stores') return (price / (1 + fees.vatRate / 100)) * (1 - fees.storeCommission / 100);
        return price - (price * fees.cardPercent / 100 + fees.cardFixed);
    }

    // ------------------------------------------------------------------ the projection

    // One scenario of a plan, month by month and year by year.
    function project(plan, scenarioId) {
        const sc = plan.scenarios.find((s) => s.id === scenarioId) || plan.scenarios[0];
        const launch = ym(plan.launch);
        const years = Math.min(MAX_YEARS, Math.max(1, Number(plan.years) || 1));
        const last = launch + years * 12 - 1;
        const rate = Number(plan.usdPerGbp) > 0 ? Number(plan.usdPerGbp) : 1;
        const gbp = (amount, currency) => (currency === 'USD' ? amount / rate : amount);
        const costs = plan.costs.filter((c) => sc.costs && sc.costs[c.id]);

        let first = Math.min(launch, ym(plan.buildStart));
        costs.forEach((c) => { if (c.from && c.from.month) first = Math.min(first, ym(c.from.month)); });

        const months = [];
        for (let n = first; n <= last; n += 1) {
            const t = n - launch;
            months.push({
                n, t, label: monthLabel(n), year: t < 0 ? 0 : Math.floor(t / 12) + 1,
                members: membersAt(sc.members, t), payers: 0,
                out: 0, in: 0, accOut: 0, accIn: 0, groups: {}, income: {}, dbHours: 0
            });
        }
        const at = (n) => months[n - first];
        const addOut = (m, group, cash, acc) => {
            if (!m) return;
            m.out += cash; m.accOut += acc;
            const g = m.groups[group] || (m.groups[group] = { cash: 0, acc: 0 });
            g.cash += cash; g.acc += acc;
        };
        const addIn = (m, key, cash, acc) => {
            if (!m) return;
            m.in += cash; m.accIn += acc;
            const g = m.income[key] || (m.income[key] = { cash: 0, acc: 0 });
            g.cash += cash; g.acc += acc;
        };

        // ---- costs
        const byCost = {};
        costs.forEach((c) => {
            const tot = byCost[c.id] = { before: 0, total: 0, firstPaid: null };
            const paid = (m, amount) => { if (m.t < 0) tot.before += amount; else tot.total += amount; if (amount > 0 && tot.firstPaid === null) tot.firstPaid = m.label; };
            if (c.calc === 'database') {
                months.forEach((m) => {
                    if (m.t < 0) return;
                    m.dbHours = databaseHours(m.members, plan.usage);
                    if (m.dbHours <= plan.usage.freeHours) return;
                    const amount = gbp(databaseCost(m.dbHours, plan.usage), 'USD');
                    addOut(m, c.group, amount, amount);
                    paid(m, amount);
                });
                return;
            }
            const start = when(c.from, launch);
            const end = c.until ? when(c.until, launch) : Infinity;
            // A one-off that waits for members is paid in the first month there are enough; a monthly or
            // yearly cost is simply skipped in a month (or on an anniversary) when there aren't.
            const step = c.every === 'year' ? 12 : 1;
            for (let n = start; n <= last && n <= end; n += step) {
                if (n < first) continue;
                const m = at(n);
                if (m.members < (Number(c.minMembers) || 0)) continue;
                const each = c.perMemberOver === null || c.perMemberOver === undefined ? 1 : Math.max(0, m.members - Number(c.perMemberOver));
                const amount = gbp(Number(c.amount) || 0, c.currency) * each;
                if (c.every === 'year') {
                    // revenue basis: a yearly payment is spread over the twelve months it covers
                    addOut(m, c.group, amount, 0);
                    for (let k = 0; k < 12; k += 1) addOut(at(n + k), c.group, 0, amount / 12);
                } else {
                    addOut(m, c.group, amount, amount);
                }
                paid(m, amount);
                if (c.every === 'once') break;
            }
        });

        // ---- income
        const inc = sc.income || {};
        const post = months.filter((m) => m.t >= 0);
        const prem = inc.premium || {};
        let perPayer = 0;
        if (prem.on) {
            const share = Math.max(0, Number(prem.payingShare) || 0) / 100;
            const yearlyShare = Math.min(100, Math.max(0, Number(prem.yearlyShare) || 0)) / 100;
            const netMonth = netOfFees(Number(prem.priceMonth), prem.route, plan.fees);
            const netYear = netOfFees(Number(prem.priceYear), prem.route, plan.fees);
            perPayer = yearlyShare * netYear / 12 + (1 - yearlyShare) * netMonth;
            // The paying share is the share of members paying at any one time. A yearly plan is paid when
            // it is bought and again each year after, by the same member or by whoever replaced them.
            const yearlyPaid = [];
            let prevYearly = 0;
            post.forEach((m) => {
                m.payers = m.members * share;
                const yearly = m.payers * yearlyShare;
                const paidNow = Math.max(0, (yearly - prevYearly) + (m.t >= 12 ? yearlyPaid[m.t - 12] : 0));
                yearlyPaid[m.t] = paidNow;
                prevYearly = yearly;
                addIn(m, 'premium', (m.payers - yearly) * netMonth + paidNow * netYear, (m.payers - yearly) * netMonth);
                for (let k = 0; k < 12; k += 1) addIn(at(m.n + k), 'premium', 0, (paidNow * netYear) / 12);
            });
        }
        (inc.extras || []).forEach((x) => {
            if (!x.on) return;
            post.forEach((m) => {
                const count = Number((x.counts || [])[m.year - 1]) || 0;
                const price = netOfFees(Number(x.price) || 0, 'card', plan.fees);
                const v = count * (x.every === 'year' ? price / 12 : price);
                addIn(m, x.id, v, v);
            });
        });
        if (inc.gifts && inc.gifts.on) post.forEach((m) => { const v = (m.members * (Number(inc.gifts.share) / 100) * Number(inc.gifts.amount)) / 12; addIn(m, 'gifts', v, v); });
        if (inc.ads && inc.ads.on) {
            post.forEach((m) => {
                const shown = m.members * (Number(inc.ads.activeShare) / 100) * Number(inc.ads.visits) * Number(inc.ads.perVisit);
                const v = (shown / 1000) * Number(inc.ads.rate);
                addIn(m, 'ads', v, v);
            });
        }

        // ---- tax on profit: worked out a year at a time on the revenue basis, after the losses of
        // earlier years (and what was spent before launch) are used up; paid nine months after the year.
        const taxRate = Math.max(0, Number(sc.taxRate) || 0) / 100;
        let taxAfterPlan = 0;
        const taxByYear = [];
        if (taxRate > 0) {
            let losses = months.filter((m) => m.t < 0).reduce((s, m) => s + (m.accIn - m.accOut), 0);
            for (let y = 1; y <= years; y += 1) {
                const profit = months.filter((m) => m.year === y).reduce((s, m) => s + (m.accIn - m.accOut), 0) + losses;
                const tax = profit > 0 ? profit * taxRate : 0;
                losses = profit > 0 ? 0 : profit;
                taxByYear[y] = tax;
                if (!(tax > 0)) continue;
                const payMonth = at(launch + y * 12 + 9);
                addOut(at(launch + y * 12 - 1), 'tax', 0, tax);
                if (payMonth) addOut(payMonth, 'tax', tax, 0); else taxAfterPlan += tax;
            }
        }

        // ---- running totals
        let run = 0;
        let runAcc = 0;
        months.forEach((m) => { run += m.in - m.out; m.cumulative = run; runAcc += m.accIn - m.accOut; m.cumulativeAcc = runAcc; });

        // ---- year by year (year 0 = before launch)
        const yearRows = [];
        for (let y = 0; y <= years; y += 1) {
            const mine = months.filter((m) => m.year === y);
            if (!mine.length) { if (y === 0) yearRows.push({ year: 0, label: 'Before launch', out: 0, in: 0, accOut: 0, accIn: 0, result: 0, accResult: 0, groups: {}, income: {}, membersEnd: 0, payersEnd: 0, cumulative: 0, cumulativeAcc: 0, tax: 0 }); continue; }
            const row = { year: y, label: y === 0 ? 'Before launch' : `Year ${y}`, out: 0, in: 0, accOut: 0, accIn: 0, groups: {}, income: {}, tax: taxByYear[y] || 0 };
            mine.forEach((m) => {
                row.out += m.out; row.in += m.in; row.accOut += m.accOut; row.accIn += m.accIn;
                Object.keys(m.groups).forEach((g) => { const r = row.groups[g] || (row.groups[g] = { cash: 0, acc: 0 }); r.cash += m.groups[g].cash; r.acc += m.groups[g].acc; });
                Object.keys(m.income).forEach((g) => { const r = row.income[g] || (row.income[g] = { cash: 0, acc: 0 }); r.cash += m.income[g].cash; r.acc += m.income[g].acc; });
            });
            const end = mine[mine.length - 1];
            row.result = row.in - row.out;
            row.accResult = row.accIn - row.accOut;
            row.from = mine[0].label; row.to = end.label;
            row.membersEnd = end.members; row.payersEnd = end.payers;
            row.cumulative = end.cumulative; row.cumulativeAcc = end.cumulativeAcc;
            yearRows.push(row);
        }

        // ---- what it costs a month once it is running (the last month of the plan: yearly costs as a
        // twelfth, one-offs left out), and the paying members that would cover it
        const lastMonth = months[months.length - 1];
        let running = 0;
        costs.forEach((c) => {
            if (c.calc === 'database') { if (lastMonth.dbHours > plan.usage.freeHours) running += gbp(databaseCost(lastMonth.dbHours, plan.usage), 'USD'); return; }
            if (c.every === 'once') return;
            if (when(c.from, launch) > last + 12) return;
            if (c.until && when(c.until, launch) < last) return;
            if (lastMonth.members < (Number(c.minMembers) || 0)) return;
            const each = c.perMemberOver === null || c.perMemberOver === undefined ? 1 : Math.max(0, lastMonth.members - Number(c.perMemberOver));
            running += (gbp(Number(c.amount) || 0, c.currency) * each) / (c.every === 'year' ? 12 : 1);
        });
        const otherIncome = lastMonth.accIn - ((lastMonth.income.premium || {}).acc || 0);
        const payersNeeded = perPayer > 0 ? Math.max(0, Math.ceil((running - otherIncome) / perPayer)) : null;
        const share = prem.on && Number(prem.payingShare) > 0 ? Number(prem.payingShare) / 100 : null;

        // ---- payback: the month the running total gets back to nought, the deepest point, and - if it
        // isn't back by the end - how much longer the last year's rate would take
        const lowest = months.reduce((a, m) => (m.cumulative < a.cumulative ? m : a), months[0]);
        const back = lowest.cumulative < -0.005 ? months.find((m) => m.n > lowest.n && m.cumulative >= -0.005) || null : null;
        const lastYear = yearRows[yearRows.length - 1];
        const monthlyAtEnd = lastYear.result / 12;
        const short = Math.min(0, lastMonth.cumulative - taxAfterPlan);
        const firstSurplus = post.find((m) => m.accIn > 0 && m.accIn >= m.accOut) || null;
        const postTotals = post.reduce((a, m) => ({ out: a.out + m.out, in: a.in + m.in, accOut: a.accOut + m.accOut, accIn: a.accIn + m.accIn }), { out: 0, in: 0, accOut: 0, accIn: 0 });

        return {
            scenario: sc, years, months, yearRows, byCost,
            before: yearRows[0].out,
            total: { out: postTotals.out, in: postTotals.in, result: postTotals.in - postTotals.out, accOut: postTotals.accOut, accIn: postTotals.accIn, accResult: postTotals.accIn - postTotals.accOut },
            endPosition: lastMonth.cumulative,
            lowest: { amount: lowest.cumulative, label: lowest.label },
            payback: back ? { label: back.label, t: back.t, monthsFromLaunch: back.t + 1 } : null,
            neverSpent: lowest.cumulative >= -0.005,
            // if the plan ends short but the last year made a surplus: the years more at that rate
            yearsMore: !back && short < -0.005 && monthlyAtEnd > 0.005 ? Math.ceil((-short / monthlyAtEnd) / 12 * 10) / 10 : null,
            lastYearResult: lastYear.result,
            firstSurplus: firstSurplus ? firstSurplus.label : null,
            running: round2(running),
            perPayer: round2(perPayer),
            payersNeeded,
            membersNeeded: payersNeeded !== null && share ? Math.ceil(payersNeeded / share) : null,
            taxAfterPlan: round2(taxAfterPlan),
            // sales in the busiest twelve months - to warn when the VAT threshold is in sight
            salesPeak: (() => { let best = 0; for (let i = 0; i + 11 < post.length; i += 1) { let s = 0; for (let k = 0; k < 12; k += 1) s += post[i + k].in; best = Math.max(best, s); } return post.length < 12 ? postTotals.in : best; })()
        };
    }

    // "What would it take?" - the share of members that would have to be paying for the money to be back
    // by the end of the plan, everything else left as it is. null when Premium is off, or when even
    // every member paying would not do it. Found by halving: more payers never leaves you worse off.
    function shareToPayBack(plan, scenarioId) {
        const sc = plan.scenarios.find((s) => s.id === scenarioId) || plan.scenarios[0];
        if (!sc || !sc.income || !sc.income.premium || !sc.income.premium.on) return null;
        const endWith = (share) => {
            const trial = { ...plan, scenarios: plan.scenarios.map((s) => (s === sc ? { ...s, income: { ...s.income, premium: { ...s.income.premium, payingShare: share } } } : s)) };
            const r = project(trial, sc.id);
            return r.endPosition - r.taxAfterPlan;
        };
        if (endWith(100) < 0) return null;
        let lo = 0;
        let hi = 100;
        for (let i = 0; i < 40; i += 1) { const mid = (lo + hi) / 2; if (endWith(mid) >= 0) hi = mid; else lo = mid; }
        return Math.ceil(hi * 10 - 1e-6) / 10;
    }

    // ------------------------------------------------------------------ tidying a plan

    const text = (v, max) => String(v === null || v === undefined ? '' : v).trim().slice(0, max);
    const num = (v, min, max, fallback) => { const n = Number(v); return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback; };
    const idOk = (s) => typeof s === 'string' && /^[a-z0-9_-]{1,40}$/i.test(s);
    function point(w, fallback) {
        if (w && isMonth(w.month)) return { month: w.month };
        if (w && Number.isFinite(Number(w.months))) return { months: Math.round(num(w.months, -120, 120, 0)) };
        return fallback;
    }

    // A plan as it is safe to store and to work out: every number a number within bounds, every text a
    // sensible length, ids unique, nothing the sums don't know. Throws (with .status 400) on a plan
    // that can't be mended. The server runs every save through this.
    function tidy(plan) {
        const fail = (message) => { const e = new Error(message); e.status = 400; throw e; };
        const p = plan || {};
        if (!isMonth(p.launch)) fail('Choose the launch month.');
        if (!isMonth(p.buildStart)) fail('Choose the month building started.');
        if (!Array.isArray(p.costs) || !Array.isArray(p.scenarios) || !p.scenarios.length) fail('The plan has no scenarios.');
        if (p.costs.length > MAX_COSTS) fail(`A plan holds up to ${MAX_COSTS} costs.`);
        if (p.scenarios.length > MAX_SCENARIOS) fail(`A plan holds up to ${MAX_SCENARIOS} scenarios.`);
        const u = p.usage || {};
        const f = p.fees || {};
        const uniqueIn = (what) => { const seen = new Set(); return (id) => { if (!idOk(id) || seen.has(id)) fail(`Two ${what} in the plan have the same id.`); seen.add(id); return id; }; };
        let unique = uniqueIn('cost groups');
        const groups = (Array.isArray(p.groups) ? p.groups : []).slice(0, 12).map((g) => ({ id: unique(g.id), name: text(g.name, 60) || 'Costs' }));
        if (!groups.length) fail('The plan has no cost groups.');
        const groupIds = new Set(groups.map((g) => g.id));
        unique = uniqueIn('costs');
        const costs = p.costs.map((c) => {
            const every = EVERY.includes(c.every) ? c.every : 'month';
            const out = {
                id: unique(c.id),
                group: groupIds.has(c.group) ? c.group : groups[0].id,
                name: text(c.name, 120) || 'A cost',
                amount: num(c.amount, 0, 1000000, 0),
                currency: c.currency === 'USD' ? 'USD' : 'GBP',
                every,
                from: point(c.from, { months: 0 }),
                until: c.until ? point(c.until, null) : null,
                minMembers: Math.round(num(c.minMembers, 0, 10000000, 0)),
                perMemberOver: c.perMemberOver === null || c.perMemberOver === undefined || c.perMemberOver === '' ? null : Math.round(num(c.perMemberOver, 0, 10000000, 0)),
                note: text(c.note, 600),
                basis: BASES.includes(c.basis) ? c.basis : 'mine'
            };
            if (c.calc === 'database') out.calc = 'database';
            if (c.source && typeof c.source.url === 'string' && /^https:\/\/[^\s"'<>]{4,300}$/.test(c.source.url)) out.source = { label: text(c.source.label, 60) || 'source', url: c.source.url };
            // the figure the plan started with, so a changed one can show what it was and be put back
            if (c.start && Number.isFinite(Number(c.start.amount))) out.start = { amount: num(c.start.amount, 0, 1000000, 0), currency: c.start.currency === 'USD' ? 'USD' : 'GBP', every: EVERY.includes(c.start.every) ? c.start.every : every, basis: BASES.includes(c.start.basis) ? c.start.basis : 'published' };
            return out;
        });
        const costIds = new Set(costs.map((c) => c.id));
        unique = uniqueIn('scenarios');
        const scenarios = p.scenarios.map((s) => {
            const members = Array.from({ length: MAX_YEARS + 1 }, (_, i) => Math.round(num((s.members || [])[i], 0, 100000000, 0)));
            const inc = s.income || {};
            const prem = inc.premium || {};
            const included = {};
            Object.keys(s.costs || {}).forEach((id) => { if (costIds.has(id) && s.costs[id]) included[id] = true; });
            const extraIds = new Set();
            return {
                id: unique(s.id),
                name: text(s.name, 60) || 'Scenario',
                about: text(s.about, 400),
                members,
                costs: included,
                taxRate: num(s.taxRate, 0, 60, 0),
                income: {
                    premium: {
                        on: !!prem.on,
                        payingShare: num(prem.payingShare, 0, 100, 0),
                        priceMonth: num(prem.priceMonth, 0, 10000, 0),
                        priceYear: num(prem.priceYear, 0, 100000, 0),
                        yearlyShare: num(prem.yearlyShare, 0, 100, 0),
                        route: prem.route === 'stores' ? 'stores' : 'card'
                    },
                    extras: (Array.isArray(inc.extras) ? inc.extras : []).slice(0, MAX_EXTRAS).map((x) => {
                        if (!idOk(x.id) || extraIds.has(x.id) || ['premium', 'gifts', 'ads'].includes(x.id)) fail('Two income lines in a scenario have the same id.');
                        extraIds.add(x.id);
                        return { id: x.id, name: text(x.name, 80) || 'Income', on: !!x.on, price: num(x.price, 0, 1000000, 0), every: x.every === 'year' ? 'year' : 'month', counts: Array.from({ length: MAX_YEARS }, (_, i) => num((x.counts || [])[i], 0, 10000000, 0)), note: text(x.note, 400) };
                    }),
                    gifts: { on: !!(inc.gifts && inc.gifts.on), share: num(inc.gifts && inc.gifts.share, 0, 100, 0), amount: num(inc.gifts && inc.gifts.amount, 0, 100000, 0) },
                    ads: { on: !!(inc.ads && inc.ads.on), activeShare: num(inc.ads && inc.ads.activeShare, 0, 100, 0), visits: num(inc.ads && inc.ads.visits, 0, 10000, 0), perVisit: num(inc.ads && inc.ads.perVisit, 0, 1000, 0), rate: num(inc.ads && inc.ads.rate, 0, 1000, 0) }
                }
            };
        });
        return {
            version: 1,
            launch: p.launch,
            buildStart: p.buildStart,
            years: Math.round(num(p.years, 1, MAX_YEARS, MAX_YEARS)),
            usdPerGbp: num(p.usdPerGbp, 0.2, 10, 1.3),
            checkedOn: /^\d{4}-\d{2}-\d{2}$/.test(p.checkedOn || '') ? p.checkedOn : null,
            current: scenarios.some((s) => s.id === p.current) ? p.current : scenarios[0].id,
            usage: {
                dailyShare: num(u.dailyShare, 0, 100, 35), visitMinutes: num(u.visitMinutes, 1, 1440, 30), windowHours: num(u.windowHours, 1, 24, 15),
                devHours: num(u.devHours, 0, 10000, 15), computeSize: num(u.computeSize, 0.05, 64, 0.25), freeHours: num(u.freeHours, 0, 100000, 100),
                hourPrice: num(u.hourPrice, 0, 100, 0.106), storageGb: num(u.storageGb, 0, 100000, 1), storagePrice: num(u.storagePrice, 0, 100, 0.35)
            },
            fees: { cardPercent: num(f.cardPercent, 0, 50, 2.2), cardFixed: num(f.cardFixed, 0, 10, 0.2), vatRate: num(f.vatRate, 0, 50, 20), storeCommission: num(f.storeCommission, 0, 90, 15) },
            groups,
            costs,
            scenarios
        };
    }

    // An id nothing in the plan has yet, from a name ("Band licences" -> band-licences, band-licences-2...).
    function newId(name, taken) {
        const base = String(name || 'item').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 30) || 'item';
        let id = base;
        for (let i = 2; taken.has(id); i += 1) id = `${base}-${i}`;
        return id;
    }

    return { MAX_YEARS, MAX_COSTS, MAX_SCENARIOS, MAX_EXTRAS, EVERY, ym, ymText, monthLabel, isMonth, round2, when, membersAt, databaseHours, databaseCost, membersOnFreeDatabase, netOfFees, project, shareToPayBack, tidy, newId };
}));
