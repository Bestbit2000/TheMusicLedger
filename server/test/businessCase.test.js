// ML-443: unit tests for the business case sums (public/businessCase.js) - costs by month, members,
// Premium income, the database step, tax, year totals and payback. Loaded with vm, like
// practicePlan.test.js. Every expected figure is worked out by hand in the test.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const sandbox = { self: {} };
vm.runInNewContext(fs.readFileSync(new URL('../../public/businessCase.js', import.meta.url), 'utf8'), sandbox);
const BC = sandbox.self.BusinessCase;
const plain = (v) => JSON.parse(JSON.stringify(v));
const close = (a, b, msg) => assert.ok(Math.abs(a - b) < 0.005, `${msg || 'figure'}: got ${a}, expected ${b}`);

const USAGE = { dailyShare: 35, visitMinutes: 30, windowHours: 15, devHours: 15, computeSize: 0.25, freeHours: 100, hourPrice: 0.106, storageGb: 1, storagePrice: 0.35 };
const FEES = { cardPercent: 1.5, cardFixed: 0.2, vatRate: 20, storeCommission: 15 };
const cost = (id, over) => ({ id, group: 'run', name: id, amount: 0, currency: 'GBP', every: 'month', from: { months: 0 }, until: null, minMembers: 0, perMemberOver: null, ...over });
const noIncome = () => ({ premium: { on: false }, extras: [], gifts: { on: false }, ads: { on: false } });
// A plan with one scenario that includes every cost given.
function plan(costs, over = {}, scenario = {}) {
    return {
        launch: '2027-01', buildStart: '2026-09', years: 1, usdPerGbp: 1.25, usage: USAGE, fees: FEES,
        groups: [{ id: 'run', name: 'Running' }, { id: 'legal', name: 'Legal' }],
        costs,
        scenarios: [{ id: 's', name: 'S', members: [1, 1, 1, 1, 1, 1], costs: Object.fromEntries(costs.map((c) => [c.id, true])), taxRate: 0, income: noIncome(), ...scenario }],
        ...over
    };
}
const run = (p) => BC.project(p, 's');

describe('costs', () => {
    const lines = [
        cost('max', { amount: 100, currency: 'USD', from: { month: '2026-09' }, until: { months: -1 } }),
        cost('pro', { amount: 20, currency: 'USD' }),
        cost('ico', { group: 'legal', amount: 47, every: 'year', from: { month: '2026-10' } }),
        cost('setup', { amount: 100, every: 'once', from: { months: 2 } })
    ];

    test('one year from a January launch runs Sep 2026 to Dec 2027', () => {
        const r = run(plan(lines));
        assert.equal(r.months.length, 16);
        assert.equal(r.months[0].label, 'Sep 2026');
        assert.equal(r.months[15].label, 'Dec 2027');
        assert.deepEqual(plain(r.yearRows.map((y) => y.label)), ['Before launch', 'Year 1']);
    });

    test('before launch: the build tool each month and the yearly fee; after: the rest', () => {
        const r = run(plan(lines));
        close(r.before, 4 * 80 + 47, 'four months of $100 at 1.25, and the fee');
        close(r.total.out, 12 * 16 + 47 + 100, 'twelve of $20, the fee again in October 2027, the one-off');
        close(r.total.result, -(12 * 16 + 47 + 100));
        close(r.endPosition, -(4 * 80 + 47 + 12 * 16 + 47 + 100), 'the running total counts both');
        close(r.yearRows[1].groups.legal.cash, 47);
        close(r.byCost.setup.total, 100);
        assert.equal(r.byCost.setup.firstPaid, 'Mar 2027');
    });

    test('revenue basis spreads a yearly cost over the twelve months it covers', () => {
        const r = run(plan(lines));
        // the Oct 2026 fee covers Oct 26 - Sep 27 (3 months before launch, 9 after); the Oct 2027 one covers 3 months of the year
        close(r.yearRows[0].accOut, 4 * 80 + 47 * 3 / 12);
        close(r.total.accOut, 12 * 16 + 47 * 9 / 12 + 47 * 3 / 12 + 100);
    });

    test('the running cost a month leaves out one-offs and what has stopped', () => {
        close(run(plan(lines)).running, 16 + 47 / 12);
    });

    test('a cost that is not in the scenario costs nothing', () => {
        const p = plan(lines);
        p.scenarios[0].costs = { pro: true };
        close(run(p).total.out, 12 * 16);
        close(run(p).before, 0);
    });

    test('moving the launch moves everything dated from it', () => {
        const r = run(plan(lines, { launch: '2027-04' }));
        close(r.before, 7 * 80 + 47, 'seven months of building before an April launch');
        assert.equal(r.months[r.months.length - 1].label, 'Mar 2028');
        close(r.total.out, 12 * 16 + 47 + 100, 'the October 2027 fee is still inside the year');
    });

    test('a yearly cost first due a year after launch is outside year one but in the running cost', () => {
        const r = run(plan([cost('statement', { amount: 50, every: 'year', from: { months: 12 } })]));
        close(r.total.out, 0);
        close(r.running, 50 / 12);
    });

    test('a cost can wait for members, or be so much for each member above a number', () => {
        const members = [0, 110, 110, 110, 110, 110]; // month t has 10t members
        const waits = run(plan([cost('email', { amount: 20, minMembers: 60 })], {}, { members }));
        close(waits.total.out, 6 * 20, 'months 6 to 11 have 60 members or more');
        assert.equal(waits.byCost.email.firstPaid, 'Jul 2027');
        const each = run(plan([cost('events', { amount: 0.1, perMemberOver: 50 })], {}, { members }));
        close(each.total.out, 0.1 * (10 + 20 + 30 + 40 + 50 + 60), 'months 6 to 11 are 10 to 60 members over');
        const once = run(plan([cost('licence', { amount: 200, every: 'once', minMembers: 100 })], {}, { members }));
        close(once.total.out, 200);
        assert.equal(once.byCost.licence.firstPaid, 'Nov 2027', 'a one-off waits for the first month with enough members');
    });
});

describe('members', () => {
    test('a straight line through each year, from the number at launch', () => {
        const m = [40, 480, 900, 900, 900, 900];
        assert.equal(BC.membersAt(m, 0), 40);
        assert.equal(BC.membersAt(m, 11), 480);
        close(BC.membersAt(m, 5.5), 260);
        assert.equal(BC.membersAt(m, 12), 480, 'year two starts where year one ended');
        assert.equal(BC.membersAt(m, 23), 900);
        assert.equal(BC.membersAt(m, 59), 900);
        assert.equal(BC.membersAt(m, -3), 0, 'nobody before launch');
    });
});

describe('Premium', () => {
    const premium = (over) => ({ ...noIncome(), premium: { on: true, payingShare: 10, priceMonth: 4, priceYear: 30, yearlyShare: 0, route: 'card', ...over } });
    const netMonth = 4 - (4 * 0.015 + 0.2);
    const netYear = 30 - (30 * 0.015 + 0.2);

    test('what is left after fees: by card, and through the app stores', () => {
        close(BC.netOfFees(29.99, 'card', FEES), 29.99 - (29.99 * 0.015 + 0.2));
        close(BC.netOfFees(29.99, 'stores', FEES), (29.99 / 1.2) * 0.85, 'VAT comes off first, then 15%');
        assert.equal(BC.netOfFees(0, 'card', FEES), 0);
    });

    test('monthly plans: cash and revenue are the same', () => {
        const r = run(plan([cost('host', { amount: 20 })], {}, { members: [100, 100, 100, 100, 100, 100], income: premium() }));
        close(r.total.in, 12 * 10 * netMonth);
        close(r.total.accIn, r.total.in);
        close(r.perPayer, BC.round2(netMonth));
        assert.equal(r.payersNeeded, Math.ceil(20 / netMonth));
        assert.equal(r.membersNeeded, Math.ceil(Math.ceil(20 / netMonth) / 0.1));
    });

    test('yearly plans: the cash arrives when bought, the revenue is spread, and it is paid again a year on', () => {
        const p = plan([], { years: 2 }, { members: [100, 100, 100, 100, 100, 100], income: premium({ yearlyShare: 100 }) });
        const r = run(p);
        const month = (t) => r.months.find((m) => m.t === t);
        close(month(0).in, 10 * netYear, 'ten yearly plans at launch');
        close(month(5).in, 0);
        close(month(12).in, 10 * netYear, 'renewed, or replaced, a year later');
        close(r.yearRows[1].in, 10 * netYear);
        close(month(3).accIn, 10 * netYear / 12);
        close(r.yearRows[1].accIn, 10 * netYear);
    });

    test('while it grows, the revenue basis is behind the cash', () => {
        const r = run(plan([], {}, { members: [0, 1100, 1100, 1100, 1100, 1100], income: premium({ yearlyShare: 100 }) }));
        close(r.total.in, 110 * netYear, '110 yearly payers by December');
        let want = 0; // 10 new payers each month from t=1; each earns (12 - t) twelfths inside the year
        for (let t = 1; t <= 11; t += 1) want += 10 * netYear * (12 - t) / 12;
        close(r.total.accIn, want);
    });
});

describe('other income', () => {
    test('income counted by the year, gifts and adverts', () => {
        const income = {
            ...noIncome(),
            extras: [
                { id: 'bands', name: 'Band licences', on: true, price: 60, every: 'year', counts: [10, 20, 0, 0, 0] },
                { id: 'teachers', name: 'Teacher plans', on: true, price: 8, every: 'month', counts: [5, 5, 0, 0, 0] },
                { id: 'off', name: 'Off', on: false, price: 100, every: 'month', counts: [9, 9, 9, 9, 9] }
            ],
            gifts: { on: true, share: 1, amount: 12 },
            ads: { on: true, activeShare: 50, visits: 10, perVisit: 2, rate: 1 }
        };
        const r = run(plan([], { years: 2 }, { members: [1000, 1000, 1000, 1000, 1000, 1000], income }));
        const band = 60 - (60 * 0.015 + 0.2);
        const teacher = 8 - (8 * 0.015 + 0.2);
        close(r.yearRows[1].income.bands.cash, 10 * band);
        close(r.yearRows[2].income.bands.cash, 20 * band, 'the second year has its own count');
        close(r.yearRows[1].income.teachers.cash, 12 * 5 * teacher);
        close(r.yearRows[1].income.gifts.cash, 1000 * 0.01 * 12);
        close(r.yearRows[1].income.ads.cash, 12 * (1000 * 0.5 * 10 * 2 / 1000) * 1);
        assert.equal(r.yearRows[1].income.off, undefined);
    });
});

describe('the database', () => {
    const db = { id: 'db', group: 'run', name: 'Database', calc: 'database' };
    test('free until it is awake more than its allowance, then every hour is paid for', () => {
        close(BC.databaseHours(0, USAGE), 15, 'nobody on it: only development');
        assert.ok(BC.databaseHours(100000, USAGE) <= 15 + 0.25 * 15 * 30.4 + 1e-9, 'never awake more than the whole day');
        const fit = BC.membersOnFreeDatabase(USAGE);
        assert.ok(BC.databaseHours(fit, USAGE) <= 100 && BC.databaseHours(fit + 1, USAGE) > 99.8, `the number that just fits (${fit})`);
        const few = run(plan([db], {}, { members: [10, 10, 10, 10, 10, 10] }));
        close(few.total.out, 0);
        const many = run(plan([db], {}, { members: [1000, 1000, 1000, 1000, 1000, 1000] }));
        const hours = BC.databaseHours(1000, USAGE);
        close(many.total.out, 12 * (hours * 0.106 + 0.35) / 1.25);
        close(many.running, (hours * 0.106 + 0.35) / 1.25);
    });
});

describe('several years and payback', () => {
    const premium = { ...noIncome(), premium: { on: true, payingShare: 10, priceMonth: 5, priceYear: 50, yearlyShare: 0, route: 'card' } };
    const net = 5 - (5 * 0.015 + 0.2);

    test('a row for before launch and one for each year, with the members at each year end', () => {
        const r = run(plan([cost('host', { amount: 10 })], { years: 5 }, { members: [0, 100, 200, 300, 400, 500] }));
        assert.equal(r.yearRows.length, 6);
        assert.equal(r.months[r.months.length - 1].label, 'Dec 2031');
        assert.deepEqual(plain(r.yearRows.map((y) => Math.round(y.membersEnd))), [0, 100, 200, 300, 400, 500]);
        close(r.total.out, 60 * 10);
        close(r.yearRows[3].out, 120);
        assert.equal(r.yearRows[5].from, 'Jan 2031');
    });

    test('paid back: the month the running total gets back to nought', () => {
        // 1,200 spent before launch (4 x 300); from launch 100 members, 10 paying 5 a month; nothing else
        const p = plan([cost('build', { amount: 300, from: { month: '2026-09' }, until: { months: -1 } })], { years: 5 }, { members: [100, 100, 100, 100, 100, 100], income: premium });
        const r = run(p);
        close(r.lowest.amount, -1200);
        assert.equal(r.lowest.label, 'Dec 2026');
        const monthsNeeded = Math.ceil(1200 / (10 * net));
        assert.equal(r.payback.monthsFromLaunch, monthsNeeded);
        assert.equal(r.payback.label, BC.monthLabel(BC.ym('2027-01') + monthsNeeded - 1));
        assert.equal(r.yearsMore, null);
    });

    test('not paid back in time: how far short, and how much longer at the last year\'s rate', () => {
        const p = plan([cost('build', { amount: 3000, from: { month: '2026-09' }, until: { months: -1 } })], { years: 2 }, { members: [100, 100, 100, 100, 100, 100], income: premium });
        const r = run(p);
        assert.equal(r.payback, null);
        close(r.endPosition, -12000 + 24 * 10 * net);
        const yearly = 12 * 10 * net;
        close(r.yearsMore, Math.ceil(((12000 - 24 * 10 * net) / yearly) * 10) / 10);
    });

    test('what it would take: the paying share that gets the money back by the end', () => {
        // 1,200 spent before launch; 100 members for 2 years; each payer brings `net` a month
        const p = plan([cost('build', { amount: 300, from: { month: '2026-09' }, until: { months: -1 } })], { years: 2 }, { members: [100, 100, 100, 100, 100, 100], income: { ...premium, premium: { ...premium.premium, payingShare: 1 } } });
        const need = BC.shareToPayBack(p, 's');
        const exact = (1200 / (24 * net)) / 100 * 100; // payers needed, as a percentage of 100 members
        assert.ok(need >= exact && need < exact + 0.11, `rounded up to a tenth: got ${need}, exactly ${exact}`);
        // with that share it is back; a tenth less and it is not
        const withShare = (share) => run({ ...p, scenarios: [{ ...p.scenarios[0], income: { ...p.scenarios[0].income, premium: { ...p.scenarios[0].income.premium, payingShare: share } } }] }).endPosition;
        assert.ok(withShare(need) >= 0);
        assert.ok(withShare(need - 0.1) < 0);
        // nothing to find when Premium is off, or when it can't be done
        assert.equal(BC.shareToPayBack(plan([cost('host', { amount: 10 })], {}, { income: noIncome() }), 's'), null);
        assert.equal(BC.shareToPayBack(plan([cost('host', { amount: 100000 })], {}, { members: [10, 10, 10, 10, 10, 10], income: premium }), 's'), null);
    });

    test('never paid back when the last year still loses money', () => {
        const r = run(plan([cost('host', { amount: 100 })], { years: 3 }, { members: [10, 10, 10, 10, 10, 10], income: premium }));
        assert.equal(r.payback, null);
        assert.equal(r.yearsMore, null);
        assert.ok(r.lastYearResult < 0);
    });
});

describe('tax on profit', () => {
    const premium = { ...noIncome(), premium: { on: true, payingShare: 100, priceMonth: 10, priceYear: 100, yearlyShare: 0, route: 'card' } };
    const net = 10 - (10 * 0.015 + 0.2);

    test('charged on each year\'s profit after earlier losses, and paid nine months after the year', () => {
        // 600 spent before launch; then 10 members all paying 10 a month and no costs
        const p = plan([cost('build', { amount: 150, from: { month: '2026-09' }, until: { months: -1 } })], { years: 3 }, { members: [10, 10, 10, 10, 10, 10], income: premium, taxRate: 19 });
        const r = run(p);
        const yearly = 12 * 10 * net;
        const tax1 = (yearly - 600) * 0.19; // the build cost comes off the first year's profit
        const tax2 = yearly * 0.19;
        close(r.yearRows[1].tax, tax1);
        close(r.yearRows[2].tax, tax2);
        const month = (t) => r.months.find((m) => m.t === t);
        close(month(21).out, tax1, 'year one\'s tax is paid in October of year two');
        close(month(33).out, tax2);
        close(r.taxAfterPlan, tax2, 'year three\'s tax falls due after the plan ends');
        close(r.yearRows[1].groups.tax.acc, tax1, 'on the revenue basis it belongs to the year it was earned');
    });

    test('no profit, no tax', () => {
        const r = run(plan([cost('host', { amount: 500 })], { years: 2 }, { members: [10, 10, 10, 10, 10, 10], income: premium, taxRate: 19 }));
        close(r.yearRows[1].tax, 0);
        close(r.taxAfterPlan, 0);
    });
});

describe('tidying a plan before it is saved', () => {
    const good = () => plan([cost('host', { amount: 20, source: { label: 'vercel.com', url: 'https://vercel.com/pricing' }, start: { amount: 20, currency: 'GBP', every: 'month' } })], { years: 5 });

    test('keeps a good plan as it is, and what it works out', () => {
        const t = BC.tidy(good());
        assert.equal(t.version, 1);
        assert.equal(t.costs[0].source.url, 'https://vercel.com/pricing');
        close(BC.project(t, 's').total.out, 60 * 20);
        assert.deepEqual(plain(BC.tidy(t)), plain(t), 'tidying twice changes nothing');
    });

    test('mends what it can', () => {
        const p = good();
        p.years = 99;
        p.costs[0].amount = 'lots';
        p.costs[0].every = 'fortnightly';
        p.costs[0].source = { label: 'x', url: 'javascript:alert(1)' };
        p.scenarios[0].costs.gone = true;
        p.scenarios[0].members = [5, 'ten'];
        const t = BC.tidy(p);
        assert.equal(t.years, 5);
        assert.equal(t.costs[0].amount, 0);
        assert.equal(t.costs[0].every, 'month');
        assert.equal(t.costs[0].source, undefined, 'only an https link is kept');
        assert.deepEqual(plain(t.scenarios[0].costs), { host: true });
        assert.deepEqual(plain(t.scenarios[0].members), [5, 0, 0, 0, 0, 0]);
    });

    test('refuses a plan it cannot work out', () => {
        const bad = (change) => { const p = good(); change(p); assert.throws(() => BC.tidy(p), (e) => e.status === 400); };
        bad((p) => { p.launch = 'next year'; });
        bad((p) => { p.scenarios = []; });
        bad((p) => { p.costs.push({ ...p.costs[0] }); });
        bad((p) => { p.costs[0].id = 'no spaces allowed'; });
        bad((p) => { p.costs = Array.from({ length: BC.MAX_COSTS + 1 }, (_, i) => cost(`c${i}`)); });
    });

    test('a new id is made from the name and never repeats', () => {
        assert.equal(BC.newId('Band licences', new Set()), 'band-licences');
        assert.equal(BC.newId('Band licences', new Set(['band-licences', 'band-licences-2'])), 'band-licences-3');
        assert.equal(BC.newId('***', new Set()), 'item');
    });
});

// ML-443 Limits: how many members each plan limit can carry, from the usage readings
describe('limits', () => {
    const meters = [
        { key: 'compute', name: 'Database compute', unit: 'CU-hours', limit: 100, per: 'month', used: 20, projected: 80 },
        { key: 'emails', name: 'Emails this month', unit: 'emails', limit: 3000, per: 'month', used: 12, projected: null },
        { key: 'storage', name: 'File storage', unit: 'GB', limit: 1, per: 'total', used: 0.25, projected: null },
        { key: 'calls', name: 'Server calls', unit: 'calls', limit: 1000000, per: 'month', used: null, projected: null }
    ];

    test('a monthly limit is judged on what it is on course for; the others on what is used', () => {
        const { rows } = BC.limits(meters, 8);
        assert.equal(rows[0].use, 80);
        close(rows[0].perMember, 10);
        assert.equal(rows[0].fits, 10);      // 100 hours / 10 a member
        assert.equal(rows[1].use, 12);       // no projection: what has been used
        assert.equal(rows[1].fits, 2000);    // 3,000 / 1.5 a member
        assert.equal(rows[2].fits, 32);      // 1 GB / (0.25 / 8)
    });

    test('the limit that carries the fewest members goes first', () => {
        assert.equal(BC.limits(meters, 8).first, 'compute');
    });

    test('no reading, or no members, gives no answer rather than a wrong one', () => {
        const none = BC.limits(meters, 8).rows[3];
        assert.equal(none.use, null);
        assert.equal(none.fits, null);
        const nobody = BC.limits(meters, 0);
        assert.ok(nobody.rows.every((r) => r.fits === null));
        assert.equal(nobody.first, null);
        assert.deepEqual(plain(BC.limits(undefined, 8)), { rows: [], first: null });
    });

    test('a cost keeps the limit it is the step up from through a save, and a bad one is dropped', () => {
        const p = plan([cost('pro', { amount: 20, meter: 'resend-month' }), cost('odd', { meter: 'Not a key!' })]);
        const tidy = BC.tidy(p);
        assert.equal(tidy.costs.find((c) => c.id === 'pro').meter, 'resend-month');
        assert.equal(tidy.costs.find((c) => c.id === 'odd').meter, undefined);
    });
});

// ML-443 actual v forecast: the month a forecast is read from
describe('the forecast for one month', () => {
    test('every month from the start of building to the end of the plan can be found by its month', () => {
        const r = BC.project(plan([cost('host', { amount: 10 })]), 's');
        const at = (month) => r.months.find((m) => m.n === BC.ym(month));
        assert.equal(at('2026-10').out, 0);      // before launch: the cost starts at launch
        assert.equal(at('2027-01').out, 10);
        assert.equal(at('2027-12').out, 10);
        assert.equal(at('2028-01'), undefined);  // a one-year plan stops there
        assert.equal(at('2026-08'), undefined);  // before building started
    });
});

// ML-461: the plan as a file, to copy it from one environment to another
describe('the plan as a file', () => {
    const p = () => plan([cost('host', { amount: 10 }), cost('pro', { amount: 20, meter: 'resend-month', minMembers: 500 })]);

    test('a plan saved to a file comes back the same, and gives the same figures', () => {
        const text = BC.toFile(p(), 'localhost', '2026-10-06T12:00:00.000Z');
        const got = BC.fromFile(text);
        assert.deepEqual(plain(got.plan), plain(BC.tidy(p())));
        assert.equal(got.savedFrom, 'localhost');
        assert.equal(got.savedAt, '2026-10-06T12:00:00.000Z');
        assert.equal(BC.project(got.plan, 's').endPosition, BC.project(BC.tidy(p()), 's').endPosition);
        // and back again: saving what was loaded gives the same file
        assert.equal(BC.toFile(got.plan, 'localhost', '2026-10-06T12:00:00.000Z'), text);
    });

    test('the file holds the plan and nothing about members or readings', () => {
        const file = JSON.parse(BC.toFile(p(), 'localhost'));
        assert.deepEqual(Object.keys(file).sort(), ['kind', 'plan', 'savedAt', 'savedFrom', 'version']);
    });

    test('a file that is not a business plan is refused with a plain message', () => {
        assert.throws(() => BC.fromFile('not json at all'), /can't be read/);
        assert.throws(() => BC.fromFile('{"flows":[]}'), /isn't a business plan/);
        assert.throws(() => BC.fromFile(JSON.stringify({ kind: 'music-ledger-business-plan', version: 1 })), /isn't a business plan/);
        assert.throws(() => BC.fromFile(JSON.stringify({ kind: 'music-ledger-business-plan', version: 2, plan: p() })), /newer version/);
    });

    test('a plan that can not be mended is refused, and a loose one is tidied like a save', () => {
        assert.throws(() => BC.fromFile(JSON.stringify({ kind: 'music-ledger-business-plan', version: 1, plan: { launch: '2027-01' } })), /can't be used/);
        const loose = p();
        loose.years = 99;
        assert.equal(BC.fromFile(JSON.stringify({ kind: 'music-ledger-business-plan', version: 1, plan: loose })).plan.years, BC.MAX_YEARS);
    });
});
