// ML-443: Admin -> Business case. What each way of rolling the app out costs and could earn, month by
// month for up to five years, and when (or whether) the money comes back.
//
// - The sums are BusinessCase (public/businessCase.js, loaded before this file) and run here in the
//   browser, so a changed figure redraws at once. The server only stores the plan.
// - The plan is one document: plan settings, a price list of costs, and scenarios that choose from it
//   (docs/business-case.md). Changes wait in the Save bar, like Feature access: try things, then Save
//   or Discard.
// - The page is built from the panel's own pieces (stat tiles, tables, switches, the Save bar, value
//   boxes that open a pop-up). What is new is in specs/components/admin-business-case.md.
(function () {
    'use strict';
    const A = window.AdminPanel;
    const BC = window.BusinessCase;
    if (!A || !BC) return;
    const $ = (id) => document.getElementById(id);
    const esc = A.escapeHtml;

    const VAT_THRESHOLD = 90000; // sales in twelve months above which VAT has to be charged (read 5 Oct 2026)
    const BASIS = { paying: ['pass', 'Paying now'], published: ['info', 'Published price'], estimate: ['warn', 'Estimate'], mine: ['never', 'Mine'] };
    const EVERY_WORDS = { month: 'a month', year: 'a year', once: 'once' };
    const PAGES = { '@limits': 'Limits', '@actuals': 'Actual v forecast' }; // tabs that aren't a scenario ('@' can't be in a scenario's id)
    const state = { plan: null, actuals: [], savedJson: '', today: null, everSaved: false, tab: 'overview', view: 'cash', chart: null, monthYear: 1, results: {} };

    // ---- words and numbers
    const money = (v, plus) => { const n = Math.round(Number(v) || 0); return `${n < 0 ? '−' : (plus && n > 0 ? '+' : '')}£${Math.abs(n).toLocaleString('en-GB')}`; };
    const pence = (v) => `£${(Math.round((Number(v) || 0) * 100) / 100).toFixed(2)}`;
    const count = (v) => Math.round(Number(v) || 0).toLocaleString('en-GB');
    const tone = (v) => (v < -0.5 ? ' admin-bc-bad' : v > 0.5 ? ' admin-bc-good' : '');
    const yearsWord = (n) => `${n} year${n === 1 ? '' : 's'}`;
    const shortMonth = (label) => label.replace(/ \d\d(\d\d)$/, ' $1'); // Jan 2027 -> Jan 27
    const scenarioById = (id) => state.plan.scenarios.find((s) => s.id === id);
    const active = () => scenarioById(state.tab);
    const dirty = () => JSON.stringify(state.plan) !== state.savedJson;

    function amountText(c) {
        if (c.calc) return 'Worked out';
        const each = `${c.currency === 'USD' ? '$' : '£'}${Number(c.amount).toLocaleString('en-GB', { maximumFractionDigits: 2 })} ${EVERY_WORDS[c.every]}`;
        return c.perMemberOver === null ? each : `${each} for each member above ${count(c.perMemberOver)}`;
    }
    function whenText(c) {
        if (c.calc) return 'when it passes the free allowance';
        const point = (w) => (w.month ? BC.monthLabel(BC.ym(w.month)) : w.months === 0 ? 'launch' : w.months > 0 ? `${w.months} month${w.months === 1 ? '' : 's'} after launch` : `${-w.months} month${w.months === -1 ? '' : 's'} before launch`);
        let text = c.every !== 'once' ? `from ${point(c.from)}` : c.from.month ? `in ${point(c.from)}` : c.from.months === 0 ? 'at launch' : point(c.from);
        if (c.until) {
            if (c.until.month && c.from.month === c.until.month) text = `${point(c.from)} only`;
            else if (c.until.months === -1) text += ', until launch';
            else text += `, until ${point(c.until)}`;
        }
        if (c.minMembers > 0) text += `, once there are ${count(c.minMembers)} members`;
        return text;
    }

    // ---- sums
    function recalc() {
        state.results = {};
        state.plan.scenarios.forEach((s) => { state.results[s.id] = BC.project(state.plan, s.id); });
    }
    const paybackText = (r) => {
        if (r.neverSpent) return 'Nothing spent';
        if (r.total.in < 0.5) return 'No income: costs only';
        if (r.payback) return `Paid back ${r.payback.label}`;
        return `Not paid back in ${yearsWord(r.years)}`;
    };
    // `need` is the paying share that would get the money back by the end (BusinessCase.shareToPayBack), if any.
    function verdict(r, name, need) {
        if (r.neverSpent) return `${name}: nothing is spent in this plan.`;
        if (r.total.in < 0.5) return `${name}: nothing comes in, so this is what it costs to run: ${money(-r.endPosition)} by the end of year ${r.years}, counting what is spent before launch, and ${pence(r.running)} a month from then on.`;
        if (r.payback) {
            const y = Math.floor(r.payback.monthsFromLaunch / 12);
            const m = r.payback.monthsFromLaunch % 12;
            return `${name}: the money is back in ${r.payback.label}, ${y ? yearsWord(y) : ''}${y && m ? ' and ' : ''}${m ? `${m} month${m === 1 ? '' : 's'}` : ''} after launch. The most you are out of pocket is ${money(-r.lowest.amount)}, in ${r.lowest.label}.`;
        }
        const end = `${name}: not paid back within ${yearsWord(r.years)}. At the end you are ${money(-r.endPosition)} out of pocket`;
        const would = need === null || need === undefined ? '' : ` It would be back by then with ${need}% of members paying.`;
        if (r.yearsMore !== null) return `${end}, and the last year makes ${money(r.lastYearResult)}. At that rate it would take about ${r.yearsMore} more year${r.yearsMore === 1 ? '' : 's'}.${would}`;
        return `${end}, and the last year still loses ${money(-r.lastYearResult)}, so at these figures it never comes back.${would}`;
    }

    // ------------------------------------------------------------------ building the page

    const valueBox = (act, value, label, extra = '') => `<button type="button" class="metroBlk-ctrl-value-btn" data-act="${act}"${extra} aria-haspopup="dialog"><strong>${esc(value)}</strong><span class="metroBlk-ctrl-value-label">${esc(label)}</span></button>`;
    const toggle = (attr, on, label) => `<label class="toggle-switch"><input type="checkbox" ${attr}${on ? ' checked' : ''} aria-label="${esc(label)}"><span class="toggle-slider"></span></label>`;
    const numField = (label, bind, value, step = '1') => `<label class="admin-bc-field">${esc(label)}<input type="number" class="admin-bc-num" min="0" step="${step}" inputmode="decimal" data-bind="${bind}" value="${esc(value)}"></label>`;
    const tile = (label, value, sub = '', cls = '') => `<div class="admin-stat-tile"><div class="admin-stat-tile-label">${esc(label)}</div><div class="admin-stat-tile-value${cls}">${esc(value)}</div><div class="admin-stat-tile-sub">${esc(sub)}</div></div>`;

    function render() {
        const p = state.plan;
        recalc();
        if (state.tab !== 'overview' && !PAGES[state.tab] && !active()) state.tab = 'overview';
        if (!scenarioById(state.chart)) state.chart = (p.scenarios.find((s) => s.income.premium.on) || scenarioById(p.current) || p.scenarios[0]).id;
        state.monthYear = Math.min(state.monthYear, p.years);
        const tabs = [['overview', 'Overview'], ...p.scenarios.map((s) => [s.id, s.name]), ...Object.entries(PAGES)];
        $('businessCase').innerHTML = `
            <div class="admin-bc-settings">
                ${valueBox('launch', BC.monthLabel(BC.ym(p.launch)), 'launch')}
                ${valueBox('years', yearsWord(p.years), 'to look at')}
                ${valueBox('rate', `$${Number(p.usdPerGbp).toFixed(2)}`, 'to the pound')}
                ${valueBox('view', state.view === 'cash' ? 'Cash' : 'Revenue basis', 'how it is counted')}
            </div>
            <div class="admin-subtabs">
                <div class="flex-row flex-wrap gap-sm" role="tablist" aria-label="Overview and scenarios">
                    ${tabs.map(([id, name]) => `<button type="button" class="admin-subtab-item${state.tab === id ? ' active' : ''}" role="tab" aria-selected="${state.tab === id}" data-bc-tab="${esc(id)}">${esc(name)}</button>`).join('')}
                </div>
                <button type="button" class="admin-subtab-item" data-act="scenario-add">+ Add a scenario</button>
            </div>
            <div id="bcPanel">${state.tab === 'overview' ? overviewHtml() : state.tab === '@limits' ? limitsHtml() : state.tab === '@actuals' ? actualsHtml() : scenarioHtml(active())}</div>`;
        refresh();
    }

    // ---- Limits (ML-443): how many members each plan's limit can carry, from the usage readings, and
    // the cost each one steps up to. "Use N" sets that cost to wait for N members - a change like any
    // other, kept when Save is pressed.
    // a small share keeps two figures that mean something (0.0025 GB), a big one is a whole number
    const amountOf = (v, unit) => { const n = Number(v); return `${n >= 100 ? count(n) : n > 0 && n < 1 ? String(Number(n.toPrecision(2))) : (Math.round(n * 100) / 100).toLocaleString('en-GB')} ${unit}`; };
    function limitsHtml() {
        const p = state.plan;
        const t = state.today || {};
        const members = t.members || 0;
        const { rows, first } = BC.limits(t.meters, members);
        const firstRow = rows.find((r) => r.key === first);
        const read = rows.filter((r) => r.use !== null).length;
        const body = rows.map((r) => {
            const cost = p.costs.find((c) => c.meter === r.key);
            const step = cost
                ? `${esc(cost.name)}<div class="admin-stat-tile-sub">${amountText(cost)}${cost.minMembers > 0 ? `, once there are ${count(cost.minMembers)} members` : ''}</div>`
                : '<span class="text-muted">Nothing linked</span>';
            const use = cost && r.fits !== null && r.fits !== cost.minMembers ? `<button type="button" class="admin-stat-exclude-btn" data-act="limit-apply" data-meter="${esc(r.key)}">Use ${count(r.fits)}</button>` : '';
            return `
            <tr>
                <th scope="row" class="admin-bc-text">${esc(r.name)}${r.key === first ? ' <span class="admin-badge warn">Goes first</span>' : ''}</th>
                <td>${r.use === null ? '<span class="text-muted">No reading</span>' : `${amountOf(r.use, r.unit)}<div class="admin-stat-tile-sub">${r.per === 'month' && r.projected !== null ? 'on course for, this month' : { month: 'so far this month', day: 'today', total: 'in all' }[r.per]}</div>`}</td>
                <td>${amountOf(r.limit, r.unit)}<div class="admin-stat-tile-sub">${{ month: 'a month', day: 'a day', total: 'in all' }[r.per]}</div></td>
                <td>${r.perMember === null ? '–' : amountOf(r.perMember, r.unit)}</td>
                <td>${r.fits === null ? '–' : `<strong>${count(r.fits)}</strong>`}</td>
                <td class="admin-bc-text">${step}</td>
                <td><div class="flex-row flex-wrap gap-sm">${use}<button type="button" class="admin-stat-exclude-btn" data-act="limit-link" data-meter="${esc(r.key)}">${cost ? 'Change' : 'Link a cost'}</button></div></td>
            </tr>`;
        }).join('');
        return `
            <p class="admin-intro">How many members each free plan can carry before its limit is reached. One member's share is today's use divided by today's ${count(members)} member${members === 1 ? '' : 's'}. That use includes your own building and testing, so the share is overstated and the true number that fit is higher: read these as the cautious end. They sharpen as real members arrive. The readings come from <strong>Costs and usage</strong>.</p>
            <div class="admin-stat-tiles">
                ${tile('Members today', count(members), 'accounts, not counting deleted ones')}
                ${tile('Limits with a reading', `${read} of ${rows.length}`, read < rows.length ? 'the rest need a reading on Costs and usage' : 'all read')}
                ${tile('Goes first', firstRow ? firstRow.name : '–', firstRow ? 'the limit that is reached soonest' : 'no readings yet')}
                ${tile('Room for', firstRow ? `${count(firstRow.fits)} members` : '–', firstRow ? 'before that limit is reached' : '')}
            </div>
            <h2 class="admin-stat-section-title">Each limit</h2>
            <p class="admin-intro">Link a limit to the cost you would start paying when it is reached (the paid plan). <strong>Use</strong> then sets that cost to begin at the number of members the reading says fit, in every scenario that includes it.</p>
            <div class="admin-stat-table-wrap"><table class="admin-stat-table admin-bc-table">
                <thead><tr><th class="admin-bc-text">Limit</th><th>Used</th><th>The plan allows</th><th>One member uses</th><th>Members that fit</th><th class="admin-bc-text">Steps up to</th><th aria-label="Options"></th></tr></thead>
                <tbody>${body}</tbody>
            </table></div>`;
    }

    // ---- Actual v forecast (ML-443): a row a month - what was forecast (kept as it stood when the month
    // was first recorded) beside what happened. Read-only: the server keeps it (businessActuals.js).
    function actualsHtml() {
        const gap = (actual, forecast, moreIsGood, fmt) => {
            if (forecast === null || forecast === undefined) return '<td>–</td>';
            const d = actual - forecast;
            const cls = Math.abs(d) < 0.005 ? '' : (d > 0) === moreIsGood ? ' class="admin-bc-good"' : ' class="admin-bc-bad"';
            return `<td${cls}>${Math.abs(d) < 0.005 ? 'as forecast' : `${d > 0 ? '+' : '−'}${fmt(Math.abs(d))} ${d > 0 ? 'more' : 'less'}`}</td>`;
        };
        const rows = state.actuals.map((a, i) => {
            const f = a.forecast;
            return `
            <tr>
                <th scope="row" class="admin-bc-text">${esc(BC.monthLabel(BC.ym(a.month)))}${i === 0 ? '<div class="admin-stat-tile-sub">so far</div>' : ''}</th>
                <td>${f ? count(f.members) : '–'}</td><td>${count(a.members)}</td>${gap(a.members, f && f.members, true, count)}
                <td>${f ? pence(f.out) : '–'}</td><td>${pence(a.paid)}</td>${gap(a.paid, f && f.out, false, pence)}
                <td class="admin-bc-text">${f ? esc(f.scenario) : '<span class="text-muted">The plan did not cover this month</span>'}</td>
            </tr>`;
        }).join('');
        return `
            <p class="admin-intro">Each month, what the plan forecast beside what happened. The forecast is taken from the scenario you were in the first time the month was recorded and is <strong>kept as it stood</strong>, so changing the plan later can't hide how far out it was. Members are counted from accounts; money paid out is the payments on <strong>Costs and usage</strong> that fell in the month. This month's figures move until the month ends. Money coming in will join the table once there are payments to count.</p>
            ${rows ? `<div class="admin-stat-table-wrap"><table class="admin-stat-table admin-bc-table">
                <thead><tr><th class="admin-bc-text">Month</th><th>Members forecast</th><th>Members</th><th>Difference</th><th>Paid out forecast</th><th>Paid out</th><th>Difference</th><th class="admin-bc-text">Forecast from</th></tr></thead>
                <tbody>${rows}</tbody>
            </table></div>` : '<p class="admin-intro">No month has been recorded yet. The first is recorded today.</p>'}`;
    }

    // ---- Overview
    function overviewHtml() {
        const p = state.plan;
        const t = state.today || {};
        const u = p.usage;
        const f = p.fees;
        return `
            <h2 class="admin-stat-section-title">Today</h2>
            <div class="admin-stat-tiles">
                ${tile('Members today', t.members === null || t.members === undefined ? '–' : count(t.members), 'accounts, not counting deleted ones')}
                ${tile('Spent so far', t.spent === null || t.spent === undefined ? '–' : pence(t.spent), t.spent ? 'every payment on Costs and usage' : 'nothing on Costs and usage yet')}
                ${tile('Costing now, a month', t.perMonth === null || t.perMonth === undefined ? '–' : pence(t.perMonth), 'what is running on Costs and usage')}
                ${tile('Database this month', t.database ? `${Math.round(t.database.used)} of ${count(t.database.limit)} hours` : '–', t.database ? (t.database.projected ? `on course for ${Math.round(t.database.projected)}` : 'the free allowance') : 'no reading yet - Third parties, Read now')}
            </div>
            <h2 class="admin-stat-section-title">The scenarios</h2>
            <p class="admin-intro">Where each leaves you after ${yearsWord(p.years)}, counting what is spent before launch. Open one to change it, rename it or copy it. <strong>+ Add a scenario</strong>, beside the tabs, starts a new one from a copy, to compare.</p>
            <div class="admin-bc-cards" id="bcCards"></div>
            <div class="admin-security-toolbar">
                <button type="button" class="admin-stat-exclude-btn" data-act="reset">Back to the starting figures</button>
            </div>
            <div class="admin-bc-chart-card">
                <div class="admin-bc-head">
                    <div><h2>Running total, month by month</h2><p class="admin-intro" id="bcVerdict"></p></div>
                    ${valueBox('chart', '', 'shown in gold', ' id="bcChartPick"')}
                </div>
                <div id="bcChart" class="admin-bc-chart-host"></div>
                <p class="admin-intro">Money in less money out, added up from the first month of building. The gold line is the chosen scenario; the grey lines are the others, numbered in tab order. Cash, whichever way the tables are counted. The same figures are in the table underneath.</p>
            </div>
            <div class="admin-stat-table-wrap" id="bcCompare"></div>
            <div class="admin-feature"><div class="admin-test-case"><details class="admin-security-details">
                <summary>How the database cost is worked out</summary>
                <p class="admin-intro">Neon bills for the hours the database is awake, and it stays awake while anyone has the app on screen, so members' visits overlap. Free up to ${count(u.freeHours)} compute-hours a month, then every hour is paid for. The first two figures are guesses until members are using it.</p>
                <div class="admin-bc-fields">
                    ${numField('% of members who open it on a day', 'usage.dailyShare', u.dailyShare, '5')}
                    ${numField('Minutes a visit keeps it awake', 'usage.visitMinutes', u.visitMinutes, '5')}
                    ${numField('Hours a month used by development', 'usage.devHours', u.devHours, '5')}
                    ${numField('Free hours a month', 'usage.freeHours', u.freeHours, '10')}
                    ${numField('$ an hour after that', 'usage.hourPrice', u.hourPrice, '0.001')}
                </div>
                <p class="admin-intro" id="bcDbFit"></p>
                <div class="admin-stat-table-wrap" id="bcDbTable"></div>
            </details></div></div>
            <div class="admin-feature"><div class="admin-test-case"><details class="admin-security-details">
                <summary>What is taken from each payment</summary>
                <p class="admin-intro">By card on the website: a percentage and a fixed fee (Stripe's 1.5% for a UK card plus 0.7% for running the renewals, and 20p). Through the app stores: VAT comes off first, then the store's commission.</p>
                <div class="admin-bc-fields">
                    ${numField('Card fee %', 'fees.cardPercent', f.cardPercent, '0.1')}
                    ${numField('Card fee, fixed £', 'fees.cardFixed', f.cardFixed, '0.05')}
                    ${numField('VAT %', 'fees.vatRate', f.vatRate, '1')}
                    ${numField('Store commission %', 'fees.storeCommission', f.storeCommission, '1')}
                </div>
            </details></div></div>
            <p class="admin-intro">The starting figures were read on ${p.checkedOn ? new Date(`${p.checkedOn}T00:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }) : 'an unknown date'}. ${state.everSaved ? '' : 'This is still the starting plan: nothing has been saved yet.'}</p>`;
    }

    function refreshOverview() {
        const p = state.plan;
        $('bcCards').innerHTML = p.scenarios.map((s, i) => {
            const r = state.results[s.id];
            const here = s.id === p.current;
            return `<button type="button" class="admin-bc-card${here ? ' is-current' : ''}" data-bc-tab="${esc(s.id)}">
                <span class="admin-bc-card-name">${i + 1}. ${esc(s.name)}${here ? ' · where I am now' : ''}</span>
                <span class="admin-bc-card-value${tone(r.endPosition)}">${money(r.endPosition, true)}</span>
                <span class="admin-bc-card-line">${esc(paybackText(r))}</span>
                <span class="admin-bc-card-line">${pence(r.running)} a month once going${r.payersNeeded !== null ? ` · ${count(r.payersNeeded)} paying members cover it` : ''}</span>
            </button>`;
        }).join('');
        const chosen = scenarioById(state.chart);
        $('bcChartPick').querySelector('strong').textContent = chosen.name;
        $('bcVerdict').textContent = verdict(state.results[chosen.id], chosen.name, BC.shareToPayBack(p, chosen.id));
        drawChart();
        const yearCols = Array.from({ length: p.years }, (_, i) => i + 1);
        $('bcCompare').innerHTML = `<table class="admin-stat-table admin-bc-table">
            <thead><tr><th scope="col" class="admin-bc-text">Scenario</th><th scope="col">Before launch</th>${yearCols.map((y) => `<th scope="col">Year ${y}</th>`).join('')}<th scope="col">After ${yearsWord(p.years)}</th><th scope="col">Paid back</th></tr></thead>
            <tbody>${p.scenarios.map((s, i) => {
                const r = state.results[s.id];
                return `<tr><th scope="row" class="admin-bc-text">${i + 1}. ${esc(s.name)}</th><td>${money(-r.before)}</td>${yearCols.map((y) => `<td class="${tone(r.yearRows[y].result).trim()}">${money(r.yearRows[y].result, true)}</td>`).join('')}<td class="${tone(r.endPosition).trim()}"><strong>${money(r.endPosition, true)}</strong></td><td>${r.neverSpent ? '–' : r.total.in < 0.5 ? 'no income' : r.payback ? esc(r.payback.label) : r.yearsMore !== null ? `about ${r.yearsMore} more years` : 'never, at these figures'}</td></tr>`;
            }).join('')}</tbody></table>`;
        const u = p.usage;
        const fit = BC.membersOnFreeDatabase(u);
        $('bcDbFit').textContent = `At these figures the free database carries about ${fit === Infinity ? 'any number of' : count(fit)} members.`;
        $('bcDbTable').innerHTML = `<table class="admin-stat-table"><thead><tr><th scope="col">Members</th><th scope="col">Open it on a day</th><th scope="col">Compute-hours a month</th><th scope="col">Cost a month</th></tr></thead><tbody>${[10, 30, 60, 100, 150, 250, 500, 1000, 2000].map((m) => {
            const h = BC.databaseHours(m, u);
            return `<tr><td>${count(m)}</td><td>${count(m * u.dailyShare / 100)}</td><td>${Math.round(h)}</td><td>${h > u.freeHours ? pence(BC.databaseCost(h, u) / p.usdPerGbp) : 'free'}</td></tr>`;
        }).join('')}</tbody></table>`;
    }

    // ---- the chart: every scenario's running total; the chosen one in gold
    function drawChart() {
        const host = $('bcChart');
        if (!host) return;
        const p = state.plan;
        const chosen = state.chart;
        const W = Math.max(300, Math.floor(host.clientWidth || 800));
        const narrow = W < 560;
        const H = narrow ? 260 : 320;
        const pad = { l: narrow ? 52 : 64, r: narrow ? 70 : 96, t: 16, b: 28 };
        const base = state.results[chosen].months;
        const n = base.length;
        let lo = 0;
        let hi = 0;
        p.scenarios.forEach((s) => state.results[s.id].months.forEach((m) => { lo = Math.min(lo, m.cumulative); hi = Math.max(hi, m.cumulative); }));
        const raw = ((hi - lo) || 100) / 4;
        const pow = Math.pow(10, Math.floor(Math.log10(raw)));
        const step = [1, 2, 2.5, 5, 10].find((k) => k * pow >= raw) * pow;
        lo = Math.floor(lo / step) * step;
        hi = Math.ceil(hi / step) * step;
        if (hi === lo) hi = lo + step;
        const x = (i) => pad.l + ((i + 1) / n) * (W - pad.l - pad.r); // a point is the END of its month
        const y = (v) => pad.t + ((hi - v) / (hi - lo)) * (H - pad.t - pad.b);
        const path = (months) => `M ${pad.l} ${y(0).toFixed(1)} ${months.map((m, i) => `L ${x(i).toFixed(1)} ${y(m.cumulative).toFixed(1)}`).join(' ')}`;
        let svg = '';
        for (let v = lo; v <= hi + 1e-6; v += step) {
            svg += `<line class="${Math.abs(v) < 1e-6 ? 'admin-bc-chart-zero' : 'admin-bc-chart-grid'}" x1="${pad.l}" x2="${W - pad.r}" y1="${y(v).toFixed(1)}" y2="${y(v).toFixed(1)}"/>`;
            svg += `<text x="${pad.l - 8}" y="${(y(v) + 4).toFixed(1)}" text-anchor="end">${money(v)}</text>`;
        }
        base.forEach((m, i) => {
            const january = m.n % 12 === 0;
            if (!january && !(i === 0 && n <= 20)) return;
            svg += `<text x="${(x(i) - (W - pad.l - pad.r) / n).toFixed(1)}" y="${H - 8}" text-anchor="start">${january ? Math.floor(m.n / 12) : esc(m.label)}</text>`;
        });
        const launchAt = base.findIndex((m) => m.t === 0);
        if (launchAt > 0) {
            const lx = x(launchAt - 1).toFixed(1);
            svg += `<line class="admin-bc-chart-zero" x1="${lx}" x2="${lx}" y1="${pad.t}" y2="${H - pad.b}"/><text x="${Number(lx) + 5}" y="${pad.t + 10}">Launch</text>`;
        }
        const ends = [];
        p.scenarios.forEach((s, i) => {
            if (s.id === chosen) return;
            const months = state.results[s.id].months;
            svg += `<path class="admin-bc-chart-other" d="${path(months)}"/>`;
            ends.push({ text: String(i + 1), y: y(months[months.length - 1].cumulative), cls: '' });
        });
        const r = state.results[chosen];
        svg += `<path class="admin-bc-chart-line" d="${path(r.months)}"/>`;
        const lastMonth = r.months[n - 1];
        svg += `<circle class="admin-bc-chart-dot" cx="${x(n - 1).toFixed(1)}" cy="${y(lastMonth.cumulative).toFixed(1)}" r="5"/>`;
        if (r.payback) {
            const i = r.months.findIndex((m) => m.t === r.payback.t);
            svg += `<circle class="admin-bc-chart-dot" cx="${x(i).toFixed(1)}" cy="${y(r.months[i].cumulative).toFixed(1)}" r="5"/><text class="admin-bc-chart-end" x="${x(i).toFixed(1)}" y="${(y(r.months[i].cumulative) - 10).toFixed(1)}" text-anchor="middle">paid back</text>`;
        }
        ends.push({ text: money(lastMonth.cumulative, true), y: y(lastMonth.cumulative), cls: ' class="admin-bc-chart-end"' });
        // end labels that would sit on top of each other are moved apart
        ends.sort((a, b) => a.y - b.y);
        for (let i = 1; i < ends.length; i += 1) if (ends[i].y - ends[i - 1].y < 14) ends[i].y = ends[i - 1].y + 14;
        const over = ends.length ? ends[ends.length - 1].y - (H - pad.b) : 0;
        if (over > 0) ends.forEach((e) => { e.y -= over; });
        ends.forEach((e) => { svg += `<text${e.cls} x="${(x(n - 1) + 10).toFixed(1)}" y="${(e.y + 4).toFixed(1)}">${esc(e.text)}</text>`; });
        host.innerHTML = `<svg class="admin-bc-chart" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" tabindex="0" aria-label="Running total for every scenario, month by month. The same figures are in the table underneath.">${svg}<line class="admin-bc-chart-zero hidden-group" id="bcChartCross" y1="${pad.t}" y2="${H - pad.b}"/></svg><div class="admin-bc-chart-tip hidden-group" id="bcChartTip" role="status"></div>`;
        const el = host.querySelector('svg');
        const tip = $('bcChartTip');
        const cross = $('bcChartCross');
        let at = null;
        const show = (i) => {
            at = Math.min(n - 1, Math.max(0, i));
            cross.setAttribute('x1', x(at).toFixed(1));
            cross.setAttribute('x2', x(at).toFixed(1));
            cross.classList.remove('hidden-group');
            tip.innerHTML = `<strong>End of ${esc(base[at].label)}</strong>${p.scenarios.map((s, k) => `<div class="admin-bc-chart-tip-row"><span>${k + 1}. ${esc(s.name)}</span><strong>${money(state.results[s.id].months[at].cumulative, true)}</strong></div>`).join('')}`;
            tip.classList.remove('hidden-group');
            const left = x(at) + 14 + tip.offsetWidth > W ? x(at) - 14 - tip.offsetWidth : x(at) + 14;
            tip.style.setProperty('--tip-x', `${Math.max(0, left)}px`);
            tip.style.setProperty('--tip-y', `${pad.t}px`);
        };
        const hide = () => { at = null; cross.classList.add('hidden-group'); tip.classList.add('hidden-group'); };
        const nearest = (clientX) => { const box = el.getBoundingClientRect(); const px = (clientX - box.left) * (W / box.width); return Math.round(((px - pad.l) / (W - pad.l - pad.r)) * n - 1); };
        el.addEventListener('pointermove', (e) => show(nearest(e.clientX)));
        el.addEventListener('click', (e) => show(nearest(e.clientX)));
        el.addEventListener('pointerleave', hide);
        el.addEventListener('blur', hide);
        el.addEventListener('focus', () => show(at === null ? n - 1 : at));
        el.addEventListener('keydown', (e) => {
            if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
            e.preventDefault();
            show((at === null ? n - 1 : at) + (e.key === 'ArrowLeft' ? -1 : 1));
        });
    }

    // ---- one scenario
    function scenarioHtml(s) {
        const p = state.plan;
        const inc = s.income;
        const years = Array.from({ length: p.years }, (_, i) => i + 1);
        const costRows = p.groups.map((g) => {
            const mine = p.costs.filter((c) => c.group === g.id);
            if (!mine.length) return '';
            return `<tr class="admin-bc-group"><th scope="rowgroup" colspan="4">${esc(g.name)}</th><td data-out="group-${esc(g.id)}"></td><td></td></tr>${mine.map((c) => {
                const on = !!s.costs[c.id];
                const [badge, word] = BASIS[c.basis] || BASIS.mine;
                const changed = c.start && (c.start.amount !== c.amount || c.start.currency !== c.currency || c.start.every !== c.every);
                return `<tr class="${on ? '' : 'admin-bc-off'}" data-cost-row="${esc(c.id)}">
                    <td>${toggle(`data-cost="${esc(c.id)}"`, on, `Include ${c.name} in ${s.name}`)}</td>
                    <th scope="row" class="admin-bc-text">${esc(c.name)} <span class="admin-badge ${badge}">${word}</span><small>${esc(c.note)}${c.source ? ` <a href="${esc(c.source.url)}" target="_blank" rel="noopener">${esc(c.source.label)}</a>` : ''}</small></th>
                    <td>${esc(amountText(c))}${c.currency === 'USD' && !c.calc ? `<div class="admin-stat-tile-sub">${pence(c.amount / p.usdPerGbp)}</div>` : ''}${changed ? `<div class="admin-stat-tile-sub">was ${c.start.currency === 'USD' ? '$' : '£'}${c.start.amount} ${EVERY_WORDS[c.start.every]}</div>` : ''}</td>
                    <td class="admin-bc-text">${esc(whenText(c))}</td>
                    <td data-out="cost-${esc(c.id)}"></td>
                    <td><button type="button" class="admin-stat-exclude-btn" data-act="cost-edit" data-id="${esc(c.id)}">Change</button></td>
                </tr>`;
            }).join('')}`;
        }).join('');
        const extra = (x, i) => `<div class="admin-bc-income${x.on ? '' : ' admin-bc-off'}" data-income-row="x-${i}">
                <div class="admin-bc-income-head">${toggle(`data-flag="income.extras.${i}.on"`, x.on, `Include ${x.name} in ${s.name}`)}<strong>${esc(x.name)}</strong><span data-out="inc-${esc(x.id)}"></span></div>
                ${x.note ? `<p class="admin-intro">${esc(x.note)}</p>` : ''}
                <div class="admin-bc-fields">
                    ${numField('£ each', `income.extras.${i}.price`, x.price, '0.5')}
                    ${valueBox('extra-every', x.every === 'year' ? 'A year' : 'A month', 'paid', ` data-i="${i}"`)}
                    ${years.map((y) => numField(`How many, year ${y}`, `income.extras.${i}.counts.${y - 1}`, x.counts[y - 1])).join('')}
                    <button type="button" class="admin-stat-exclude-btn" data-act="extra-remove" data-i="${i}">Remove</button>
                </div>
            </div>`;
        return `
            <div class="admin-bc-head">
                <div><h2>${esc(s.name)}${s.id === p.current ? ' <span class="admin-badge pass">Where I am now</span>' : ''}</h2><p class="admin-intro">${esc(s.about)}</p></div>
                <span class="flex-row flex-wrap gap-sm items-center">
                    <button type="button" class="admin-stat-exclude-btn" data-act="scenario-rename">Rename</button>
                    <button type="button" class="admin-stat-exclude-btn" data-act="scenario-copy">Copy</button>
                    <button type="button" class="list-item-menu-btn" data-act="scenario-menu" data-row-menu-btn aria-haspopup="menu" aria-expanded="false" aria-label="More for ${esc(s.name)}"><span class="material-symbols-outlined" aria-hidden="true">more_vert</span></button>
                </span>
            </div>
            <div class="admin-stat-tiles" id="bcKpis"></div>
            <p class="admin-intro" id="bcVerdict"></p>

            <h2 class="admin-stat-section-title">Members</h2>
            <p class="admin-intro">How many members there are at launch and at the end of each year. In between it is a straight line.</p>
            <div class="admin-bc-fields">
                ${numField('At launch', 'members.0', s.members[0])}
                ${years.map((y) => numField(`End of year ${y}`, `members.${y}`, s.members[y])).join('')}
            </div>

            <h2 class="admin-stat-section-title">Costs</h2>
            <p class="admin-intro">Switch a cost in or out of this scenario. <strong>Change</strong> alters the cost itself, in every scenario.</p>
            <div class="admin-security-toolbar"><button type="button" class="btn-submit no-margin" data-act="cost-add">+ Add a cost</button></div>
            <div class="admin-stat-table-wrap"><table class="admin-stat-table admin-bc-table">
                <thead><tr><th scope="col">In</th><th scope="col" class="admin-bc-text">Cost</th><th scope="col">Amount</th><th scope="col" class="admin-bc-text">When</th><th scope="col">Over the plan</th><th scope="col" aria-label="Change"></th></tr></thead>
                <tbody>${costRows}</tbody>
            </table></div>

            <h2 class="admin-stat-section-title">Income</h2>
            <div class="admin-bc-income${inc.premium.on ? '' : ' admin-bc-off'}" data-income-row="premium">
                <div class="admin-bc-income-head">${toggle('data-flag="income.premium.on"', inc.premium.on, `Include Premium memberships in ${s.name}`)}<strong>Premium memberships</strong><span data-out="inc-premium"></span></div>
                <p class="admin-intro">The share of members who are paying at any one time. A yearly plan is paid when it is bought and again each year, by the same member or whoever replaces them. Of people who try a free app, about 2 in 100 pay (1 cautious, 4.5 hopeful).</p>
                <div class="admin-bc-fields">
                    ${numField('% of members paying', 'income.premium.payingShare', inc.premium.payingShare, '0.5')}
                    ${numField('£ a month', 'income.premium.priceMonth', inc.premium.priceMonth, '0.01')}
                    ${numField('£ a year', 'income.premium.priceYear', inc.premium.priceYear, '0.01')}
                    ${numField('% on the yearly plan', 'income.premium.yearlyShare', inc.premium.yearlyShare, '5')}
                    ${valueBox('route', inc.premium.route === 'stores' ? 'App stores' : 'By card', 'how it is paid')}
                </div>
                <p class="admin-intro" id="bcKeep"></p>
            </div>
            ${inc.extras.map(extra).join('')}
            <div class="admin-bc-income${inc.gifts.on ? '' : ' admin-bc-off'}" data-income-row="gifts">
                <div class="admin-bc-income-head">${toggle('data-flag="income.gifts.on"', inc.gifts.on, `Include gifts from supporters in ${s.name}`)}<strong>Gifts from supporters</strong><span data-out="inc-gifts"></span></div>
                <p class="admin-intro">A "support the app" button. The one kind of income the free hosting plan allows. Typically 0.5-2% of members give £5-£15 a year.</p>
                <div class="admin-bc-fields">${numField('% of members who give', 'income.gifts.share', inc.gifts.share, '0.5')}${numField('£ a year each', 'income.gifts.amount', inc.gifts.amount)}</div>
            </div>
            <div class="admin-bc-income${inc.ads.on ? '' : ' admin-bc-off'}" data-income-row="ads">
                <div class="admin-bc-income-head">${toggle('data-flag="income.ads.on"', inc.ads.on, `Include adverts in ${s.name}`)}<strong>Adverts</strong><span data-out="inc-ads"></span></div>
                <p class="admin-intro">For comparison. Adverts would need a consent banner, paid hosting and a change to the privacy promise, and could not appear around YouTube videos. Without profiling they pay roughly £0.25-£1 per 1,000 shown.</p>
                <div class="admin-bc-fields">${numField('% of members active in a month', 'income.ads.activeShare', inc.ads.activeShare, '5')}${numField('Visits a month each', 'income.ads.visits', inc.ads.visits)}${numField('Adverts seen a visit', 'income.ads.perVisit', inc.ads.perVisit)}${numField('£ per 1,000 shown', 'income.ads.rate', inc.ads.rate, '0.05')}</div>
            </div>
            <div class="admin-security-toolbar"><button type="button" class="btn-submit no-margin" data-act="extra-add">+ Add income</button></div>

            <h2 class="admin-stat-section-title">Tax on profit</h2>
            <p class="admin-intro">Taken from each year's profit once the losses of earlier years, and what was spent before launch, are used up; paid nine months after the year. 19% is corporation tax on small profits. Leave it at 0 while there is no profit to tax.</p>
            <div class="admin-bc-fields">${numField('% of profit', 'taxRate', s.taxRate, '1')}</div>

            <h2 class="admin-stat-section-title">Year by year</h2>
            <div class="admin-stat-table-wrap" id="bcYears"></div>
            <p class="admin-intro" id="bcNotes"></p>
            <div class="admin-feature"><div class="admin-test-case"><details class="admin-security-details" id="bcMonthsBox">
                <summary>Month by month</summary>
                <div class="admin-bc-fields">${valueBox('month-year', `Year ${state.monthYear}`, 'shown')}</div>
                <div class="admin-stat-table-wrap" id="bcMonths"></div>
            </details></div></div>`;
    }

    function refreshScenario() {
        const p = state.plan;
        const s = active();
        const r = state.results[s.id];
        const acc = state.view === 'revenue';
        const pick = (o) => (o ? (acc ? o.acc : o.cash) : 0);
        const need = BC.shareToPayBack(p, s.id);
        $('bcKpis').innerHTML = [
            tile(`After ${yearsWord(p.years)}`, money(r.endPosition, true), 'counting what is spent before launch', tone(r.endPosition)),
            tile('Money back', r.neverSpent || r.total.in < 0.5 ? '–' : r.payback ? r.payback.label : 'Not yet', r.payback ? `${r.payback.monthsFromLaunch} months after launch` : r.yearsMore !== null ? `about ${r.yearsMore} more years at the last year's rate` : r.neverSpent ? '' : r.total.in < 0.5 ? 'nothing comes in' : 'the last year still loses money'),
            tile('Most out of pocket', money(-r.lowest.amount), r.neverSpent ? '' : `in ${r.lowest.label}`),
            tile('A month, once going', pence(r.running), 'yearly costs as a twelfth, one-offs left out'),
            r.payersNeeded !== null ? tile('Paying members to cover it', count(r.payersNeeded), `each brings ${pence(r.perPayer)} a month after fees`) : '',
            r.membersNeeded !== null ? tile('Members needed for that', count(r.membersNeeded), `if ${s.income.premium.payingShare}% pay`) : '',
            s.income.premium.on ? tile('Paying share that gets it back', need === null ? 'None' : `${need}%`, need === null ? `not even every member paying, within ${yearsWord(p.years)}` : `of members paying, to be back by the end of year ${p.years}`) : ''
        ].join('');
        $('bcVerdict').textContent = verdict(r, s.name, need);
        p.groups.forEach((g) => { const el = document.querySelector(`[data-out="group-${CSS.escape(g.id)}"]`); if (el) el.textContent = money(r.yearRows.reduce((sum, y) => sum + ((y.groups[g.id] || {}).cash || 0), 0)); });
        p.costs.forEach((c) => {
            const el = document.querySelector(`[data-out="cost-${CSS.escape(c.id)}"]`);
            if (!el) return;
            const t = r.byCost[c.id];
            el.innerHTML = !t ? '–' : `${money(t.before + t.total)}${t.firstPaid && (c.calc || c.minMembers > 0) ? `<div class="admin-stat-tile-sub">from ${esc(t.firstPaid)}</div>` : !t.firstPaid ? '<div class="admin-stat-tile-sub">not reached in this plan</div>' : ''}`;
        });
        const incTotal = (key) => r.yearRows.reduce((sum, y) => sum + ((y.income[key] || {}).cash || 0), 0);
        const incOut = (key, on, extraText = '') => { const el = document.querySelector(`[data-out="inc-${CSS.escape(key)}"]`); if (el) el.textContent = on ? `${money(incTotal(key))} over the plan${extraText}` : 'left out'; };
        incOut('premium', s.income.premium.on, ` · ${count(r.months[r.months.length - 1].payers)} paying at the end`);
        s.income.extras.forEach((x) => incOut(x.id, x.on));
        incOut('gifts', s.income.gifts.on);
        incOut('ads', s.income.ads.on);
        const pr = s.income.premium;
        $('bcKeep').textContent = `After fees you keep ${pence(BC.netOfFees(pr.priceMonth, pr.route, p.fees))} of ${pence(pr.priceMonth)} a month, and ${pence(BC.netOfFees(pr.priceYear, pr.route, p.fees))} of ${pence(pr.priceYear)} a year.`;

        // year by year
        const cols = r.yearRows;
        const cell = (v, signed) => `<td class="${signed ? tone(v).trim() : ''}">${Math.abs(v) < 0.5 ? '–' : money(v, signed)}</td>`;
        const row = (label, values, opts = {}) => `<tr class="${opts.cls || ''}"><th scope="row" class="admin-bc-text">${esc(label)}</th>${values.map((v) => cell(v, opts.signed)).join('')}${opts.noTotal ? '<td></td>' : cell(values.reduce((a, b) => a + b, 0), opts.signed)}</tr>`;
        const groupRows = [...p.groups, { id: 'tax', name: 'Tax on profit' }].map((g) => { const v = cols.map((y) => pick(y.groups[g.id])); return v.some((n) => Math.abs(n) >= 0.5) ? row(g.name, v) : ''; }).join('');
        const incomeNames = { premium: 'Premium memberships', gifts: 'Gifts from supporters', ads: 'Adverts' };
        s.income.extras.forEach((x) => { incomeNames[x.id] = x.name; });
        const incomeRows = Object.keys(incomeNames).map((k) => { const v = cols.map((y) => pick(y.income[k])); return v.some((n) => Math.abs(n) >= 0.5) ? row(incomeNames[k], v) : ''; }).join('');
        const out = cols.map((y) => (acc ? y.accOut : y.out));
        const inn = cols.map((y) => (acc ? y.accIn : y.in));
        $('bcYears').innerHTML = `<table class="admin-stat-table admin-bc-table">
            <thead><tr><th scope="col" class="admin-bc-text">${acc ? 'Revenue basis' : 'Cash'}</th>${cols.map((y) => `<th scope="col">${esc(y.label)}${y.year ? `<div class="admin-stat-tile-sub">${esc(shortMonth(y.from))} to ${esc(shortMonth(y.to))}</div>` : ''}</th>`).join('')}<th scope="col">Whole plan</th></tr></thead>
            <tbody>
                ${groupRows}
                ${row('Money out', out, { cls: 'admin-bc-total' })}
                ${incomeRows}
                ${inn.some((v) => v > 0.5) ? row('Money in', inn, { cls: 'admin-bc-total' }) : ''}
                ${row('Result', cols.map((y, i) => inn[i] - out[i]), { cls: 'admin-bc-total', signed: true })}
                ${row('Running total', cols.map((y) => (acc ? y.cumulativeAcc : y.cumulative)), { signed: true, noTotal: true })}
                <tr><th scope="row" class="admin-bc-text">Members at the end</th>${cols.map((y) => `<td>${y.year ? count(y.membersEnd) : '–'}</td>`).join('')}<td></td></tr>
                ${s.income.premium.on ? `<tr><th scope="row" class="admin-bc-text">Paying members at the end</th>${cols.map((y) => `<td>${y.year ? count(y.payersEnd) : '–'}</td>`).join('')}<td></td></tr>` : ''}
            </tbody></table>`;
        const notes = [acc
            ? 'Revenue basis: a yearly payment is spread over the twelve months it covers, so a yearly membership bought in June counts as seven twelfths in its first year.'
            : 'Cash: money counted in the month it moves, so a yearly fee or a yearly membership lands in one month.'];
        if (r.taxAfterPlan > 0.5) notes.push(`${money(r.taxAfterPlan)} of tax on the last year's profit falls due after the plan ends.`);
        if (r.salesPeak >= VAT_THRESHOLD * 0.8) notes.push(`Sales reach ${money(r.salesPeak)} in a twelve-month stretch. VAT has to be charged above ${money(VAT_THRESHOLD)}, which takes a sixth of every sale - this plan does not allow for it.`);
        $('bcNotes').textContent = notes.join(' ');

        // month by month, for the chosen year
        const months = r.months.filter((m) => m.year === state.monthYear);
        const mrow = (label, values, opts = {}) => `<tr class="${opts.cls || ''}"><th scope="row" class="admin-bc-text">${esc(label)}</th>${values.map((v) => (opts.count ? `<td>${count(v)}</td>` : cell(v, opts.signed))).join('')}</tr>`;
        const mGroups = [...p.groups, { id: 'tax', name: 'Tax on profit' }].map((g) => { const v = months.map((m) => pick(m.groups[g.id])); return v.some((n) => Math.abs(n) >= 0.5) ? mrow(g.name, v) : ''; }).join('');
        const mOut = months.map((m) => (acc ? m.accOut : m.out));
        const mIn = months.map((m) => (acc ? m.accIn : m.in));
        $('bcMonths').innerHTML = `<table class="admin-stat-table admin-bc-table">
            <thead><tr><th scope="col" class="admin-bc-text">Year ${state.monthYear}</th>${months.map((m) => `<th scope="col">${esc(m.label)}</th>`).join('')}</tr></thead>
            <tbody>
                ${mGroups}
                ${mrow('Money out', mOut, { cls: 'admin-bc-total' })}
                ${mIn.some((v) => v > 0.5) ? mrow('Money in', mIn, { cls: 'admin-bc-total' }) : ''}
                ${mrow('Result', months.map((m, i) => mIn[i] - mOut[i]), { cls: 'admin-bc-total', signed: true })}
                ${mrow('Running total', months.map((m) => (acc ? m.cumulativeAcc : m.cumulative)), { signed: true })}
                ${mrow('Members', months.map((m) => m.members), { count: true })}
                ${s.income.premium.on ? mrow('Paying members', months.map((m) => m.payers), { count: true }) : ''}
            </tbody></table>`;
    }

    // Everything that is worked out, redrawn without touching the boxes being typed in.
    function refresh() {
        recalc();
        if (state.tab === 'overview') refreshOverview(); else if (active()) refreshScenario();
        const changed = dirty();
        $('bcSaveBar').classList.toggle('hidden-group', !changed);
        $('bcSaveText').textContent = changed ? 'Changes not saved yet' : '';
    }

    // ------------------------------------------------------------------ pop-ups

    // A choice from a short list; it is made as soon as one is picked.
    function choose(title, intro, options, current, onPick) {
        $('bcChoiceTitle').textContent = title;
        $('bcChoiceIntro').textContent = intro || '';
        $('bcChoiceIntro').classList.toggle('hidden-group', !intro);
        const box = $('bcChoiceOptions');
        box.innerHTML = options.map(([value, label]) => `<button type="button" class="flow-choice-option${String(value) === String(current) ? ' selected' : ''}" aria-pressed="${String(value) === String(current)}" data-value="${esc(value)}">${esc(label)}</button>`).join('');
        box.querySelectorAll('[data-value]').forEach((b) => b.addEventListener('click', () => { A.hideModal('bcChoiceModal'); onPick(b.dataset.value); }));
        A.showModal('bcChoiceModal');
    }

    // A short form: fields are { id, label, type ('text' | 'number' | 'month' | 'textarea' | 'select'), value, options?, step? }.
    let formSave = null;
    function form(title, intro, fields, onSave) {
        $('bcFormTitle').textContent = title;
        $('bcFormIntro').textContent = intro || '';
        $('bcFormIntro').classList.toggle('hidden-group', !intro);
        $('bcFormFields').innerHTML = fields.map((f) => {
            const id = `bcForm-${f.id}`;
            const more = f.type === 'number' ? ' min="0" step="' + (f.step || 'any') + '" inputmode="decimal"' : f.type === 'text' ? ' maxlength="80" autocomplete="off"' : '';
            const control = f.type === 'textarea' ? `<textarea id="${id}" rows="3" maxlength="400">${esc(f.value)}</textarea>`
                : f.type === 'select' ? `<select id="${id}">${f.options.map(([v, l]) => `<option value="${esc(v)}"${String(v) === String(f.value) ? ' selected' : ''}>${esc(l)}</option>`).join('')}</select>`
                    : `<input type="${f.type}" id="${id}" value="${esc(f.value)}"${more}>`;
            return `<div class="form-group"><label for="${id}">${esc(f.label)}</label>${control}</div>`;
        }).join('');
        formSave = () => {
            const values = {};
            fields.forEach((f) => { values[f.id] = $(`bcForm-${f.id}`).value; });
            const problem = onSave(values);
            if (problem) { A.showToast(problem); return; }
            A.hideModal('bcFormModal');
            render();
        };
        A.showModal('bcFormModal');
        const first = $('bcFormFields').querySelector('input, select, textarea');
        if (first) first.focus();
        if (first && first.type === 'text') first.select(); // a name that is already there is replaced by typing
    }

    // ---- a cost: add or change. It changes the cost itself, in every scenario.
    let editingCost = null;
    const pointKind = (w) => (!w ? 'never' : w.month ? 'month' : w.months === 0 ? 'launch' : 'after');
    function syncCostForm() {
        const show = (id, on) => $(id).classList.toggle('hidden-group', !on);
        show('bcCostFromMonthsGroup', $('bcCostFromKind').value === 'after');
        show('bcCostFromMonthGroup', $('bcCostFromKind').value === 'month');
        show('bcCostUntilMonthsGroup', $('bcCostUntilKind').value === 'after');
        show('bcCostUntilMonthGroup', $('bcCostUntilKind').value === 'month');
        show('bcCostOverGroup', $('bcCostScale').value === 'member');
    }
    function openCost(id) {
        const p = state.plan;
        const c = id ? p.costs.find((x) => x.id === id) : null;
        editingCost = c ? c.id : null;
        const worked = !!(c && c.calc);
        $('bcCostTitle').textContent = c ? 'Change a cost' : 'Add a cost';
        $('bcCostIntro').textContent = worked ? 'This one is worked out from the member numbers, so it has no amount to type. Its figures are under "How the database cost is worked out" on the Overview.' : c ? 'This changes the cost in every scenario that includes it.' : `It is added to the price list and switched on for ${active() ? active().name : 'this scenario'}.`;
        $('bcCostName').value = c ? c.name : '';
        $('bcCostGroup').innerHTML = p.groups.map((g) => `<option value="${esc(g.id)}">${esc(g.name)}</option>`).join('');
        $('bcCostGroup').value = c ? c.group : p.groups[0].id;
        $('bcCostAmount').value = c ? c.amount : '';
        $('bcCostCurrency').value = c ? c.currency : 'GBP';
        $('bcCostEvery').value = c ? c.every : 'month';
        $('bcCostFromKind').value = c ? pointKind(c.from) : 'launch';
        $('bcCostFromMonths').value = c && c.from.months ? c.from.months : 1;
        $('bcCostFromMonth').value = c && c.from.month ? c.from.month : p.launch;
        $('bcCostUntilKind').value = c ? pointKind(c.until) : 'never';
        $('bcCostUntilMonths').value = c && c.until && !c.until.month ? c.until.months : 12;
        $('bcCostUntilMonth').value = c && c.until && c.until.month ? c.until.month : p.launch;
        $('bcCostScale').value = c && c.perMemberOver !== null ? 'member' : 'fixed';
        $('bcCostOver').value = c && c.perMemberOver !== null ? c.perMemberOver : 0;
        $('bcCostMinMembers').value = c ? c.minMembers : 0;
        $('bcCostNote').value = c ? c.note : '';
        $('bcCostSource').value = c && c.source ? c.source.url : '';
        document.querySelectorAll('#bcCostModal [data-not-worked]').forEach((el) => el.classList.toggle('hidden-group', worked));
        const changed = c && c.start && (c.start.amount !== c.amount || c.start.currency !== c.currency || c.start.every !== c.every);
        $('bcCostStartRow').classList.toggle('hidden-group', !changed);
        if (changed) $('bcCostStartText').textContent = `The starting figure was ${c.start.currency === 'USD' ? '$' : '£'}${c.start.amount} ${EVERY_WORDS[c.start.every]}.`;
        $('bcCostDeleteBtn').classList.toggle('hidden-group', !c || worked);
        syncCostForm();
        A.showModal('bcCostModal');
        $('bcCostName').focus();
    }
    function saveCost() {
        const p = state.plan;
        const c = editingCost ? p.costs.find((x) => x.id === editingCost) : null;
        const name = $('bcCostName').value.trim();
        if (!name) { A.showToast('Give the cost a name.'); return; }
        const worked = !!(c && c.calc);
        const amount = Number($('bcCostAmount').value);
        if (!worked && !(amount >= 0 && $('bcCostAmount').value !== '')) { A.showToast('Type the amount as a number.'); return; }
        const source = $('bcCostSource').value.trim();
        if (source && !/^https:\/\//.test(source)) { A.showToast('A source link starts with https://'); return; }
        const point = (kind, months, month) => (kind === 'month' ? { month: $(month).value } : kind === 'after' ? { months: Math.round(Number($(months).value) || 0) } : kind === 'launch' ? { months: 0 } : null);
        const from = point($('bcCostFromKind').value, 'bcCostFromMonths', 'bcCostFromMonth');
        const until = point($('bcCostUntilKind').value, 'bcCostUntilMonths', 'bcCostUntilMonth');
        if ((from && from.month !== undefined && !BC.isMonth(from.month)) || (until && until.month !== undefined && !BC.isMonth(until.month))) { A.showToast('Choose the month.'); return; }
        const next = {
            ...(c || {}),
            id: c ? c.id : BC.newId(name, new Set(p.costs.map((x) => x.id))),
            name,
            group: $('bcCostGroup').value,
            note: $('bcCostNote').value.trim(),
            basis: c ? c.basis : 'mine'
        };
        if (source) next.source = { label: source.replace(/^https:\/\/(www\.)?/, '').split('/')[0], url: source }; else delete next.source;
        if (!worked) {
            Object.assign(next, {
                amount, currency: $('bcCostCurrency').value, every: $('bcCostEvery').value, from: from || { months: 0 }, until,
                perMemberOver: $('bcCostScale').value === 'member' ? Math.max(0, Math.round(Number($('bcCostOver').value) || 0)) : null,
                minMembers: Math.max(0, Math.round(Number($('bcCostMinMembers').value) || 0))
            });
            // a figure the owner has typed over is theirs from then on
            if (c && c.start) next.basis = c.start.amount !== next.amount || c.start.currency !== next.currency || c.start.every !== next.every ? 'mine' : (c.start.basis || next.basis);
        }
        if (c) p.costs[p.costs.indexOf(c)] = next;
        else { p.costs.push({ until: null, minMembers: 0, perMemberOver: null, ...next }); if (active()) active().costs[next.id] = true; }
        A.hideModal('bcCostModal');
        render();
    }

    // A new scenario always starts as a copy of one that is there - `from` when it is copied from its own
    // page, otherwise chosen in the form. It takes the same costs, members and income, then goes its own way.
    function addScenario(from) {
        const p = state.plan;
        if (p.scenarios.length >= BC.MAX_SCENARIOS) { A.showToast(`A plan holds up to ${BC.MAX_SCENARIOS} scenarios. Delete one first.`); return; }
        const fields = [{ id: 'name', label: 'Name', type: 'text', value: from ? `${from.name} - copy`.slice(0, 60) : '' }];
        if (!from) fields.push({ id: 'from', label: 'Start from a copy of', type: 'select', value: p.scenarios[p.scenarios.length - 1].id, options: p.scenarios.map((s) => [s.id, s.name]) });
        form(from ? `Copy ${from.name}` : 'Add a scenario', 'It starts with the same costs, members and income, which you then change - for example switch Teacher plans on, or raise the member numbers. Every scenario is compared on the Overview.', fields, (v) => {
            const name = v.name.trim();
            if (!name) return 'Give it a name.';
            if (p.scenarios.some((s) => s.name.toLowerCase() === name.toLowerCase())) return 'Another scenario already has that name.';
            const copy = JSON.parse(JSON.stringify(from || scenarioById(v.from)));
            copy.id = BC.newId(name, new Set(p.scenarios.map((s) => s.id)));
            copy.name = name;
            p.scenarios.push(copy);
            state.tab = copy.id;
            window.scrollTo(0, 0); // the new scenario opens at its top
            return null;
        });
    }

    // ------------------------------------------------------------------ what the buttons do

    const setPath = (root, path, value) => { const keys = path.split('.'); let o = root; for (let i = 0; i < keys.length - 1; i += 1) o = o[keys[i]]; o[keys[keys.length - 1]] = value; };
    const ACTIONS = {
        launch: () => form('Launch month', 'Costs dated from launch move with it.', [{ id: 'launch', label: 'Launch month', type: 'month', value: state.plan.launch }, { id: 'build', label: 'Building started', type: 'month', value: state.plan.buildStart }], (v) => {
            if (!BC.isMonth(v.launch) || !BC.isMonth(v.build)) return 'Choose both months.';
            if (BC.ym(v.build) > BC.ym(v.launch)) return 'Building starts before launch.';
            state.plan.launch = v.launch; state.plan.buildStart = v.build;
            return null;
        }),
        years: () => choose('How many years to look at', '', [1, 2, 3, 4, 5].map((n) => [n, yearsWord(n)]), state.plan.years, (v) => { state.plan.years = Number(v); render(); }),
        rate: () => form('US dollars to the pound', 'How many dollars £1 buys. Costs charged in dollars are turned into pounds at this rate.', [{ id: 'rate', label: 'Dollars to the pound', type: 'number', step: '0.01', value: state.plan.usdPerGbp }], (v) => {
            if (!(Number(v.rate) >= 0.2 && Number(v.rate) <= 10)) return 'Type the rate as a number, like 1.32.';
            state.plan.usdPerGbp = Number(v.rate);
            return null;
        }),
        view: () => choose('How it is counted', 'Cash is money in the month it moves. Revenue basis spreads a yearly payment over the twelve months it covers.', [['cash', 'Cash'], ['revenue', 'Revenue basis']], state.view, (v) => { state.view = v; render(); }),
        'limit-link': (btn) => {
            const p = state.plan;
            const key = btn.dataset.meter;
            const now = p.costs.find((c) => c.meter === key);
            choose('The cost this limit steps up to', 'What you would start paying when the limit is reached.', [['', 'Nothing'], ...p.costs.filter((c) => !c.calc).map((c) => [c.id, c.name])], now ? now.id : '', (v) => {
                p.costs.forEach((c) => { if (c.meter === key) delete c.meter; });
                const picked = p.costs.find((c) => c.id === v);
                if (picked) picked.meter = key;
                render();
            });
        },
        'limit-apply': (btn) => {
            const p = state.plan;
            const row = BC.limits((state.today || {}).meters, (state.today || {}).members || 0).rows.find((r) => r.key === btn.dataset.meter);
            const cost = p.costs.find((c) => c.meter === btn.dataset.meter);
            if (!row || row.fits === null || !cost) return;
            cost.minMembers = row.fits;
            A.showToast(`${cost.name} now starts at ${count(row.fits)} members`, 'success');
            render();
        },
        chart: () => choose('Scenario shown in gold', '', state.plan.scenarios.map((s, i) => [s.id, `${i + 1}. ${s.name}`]), state.chart, (v) => { state.chart = v; refresh(); }),
        'month-year': () => choose('Which year, month by month', '', Array.from({ length: state.plan.years }, (_, i) => [i + 1, `Year ${i + 1}`]), state.monthYear, (v) => { state.monthYear = Number(v); const open = $('bcMonthsBox').open; render(); $('bcMonthsBox').open = open; }),
        route: () => choose('How Premium is paid', 'By card you keep about 93-97%. Through the app stores about 71%: VAT comes off first, then 15%.', [['card', 'By card on the website'], ['stores', 'Through the app stores']], active().income.premium.route, (v) => { active().income.premium.route = v; render(); }),
        'extra-every': (btn) => choose('How often it is paid', '', [['month', 'Every month'], ['year', 'Once a year']], active().income.extras[Number(btn.dataset.i)].every, (v) => { active().income.extras[Number(btn.dataset.i)].every = v; render(); }),
        'extra-remove': (btn) => { active().income.extras.splice(Number(btn.dataset.i), 1); render(); },
        'extra-add': () => {
            const s = active();
            if (s.income.extras.length >= BC.MAX_EXTRAS) { A.showToast(`A scenario holds up to ${BC.MAX_EXTRAS} other kinds of income.`); return; }
            form('Add income', 'Something paid by a number of people or bodies: so many, at so much each.', [{ id: 'name', label: 'What it is', type: 'text', value: '' }, { id: 'price', label: '£ each', type: 'number', step: '0.01', value: '' }, { id: 'every', label: 'Paid', type: 'select', value: 'month', options: [['month', 'Every month'], ['year', 'Once a year']] }], (v) => {
                if (!v.name.trim()) return 'Say what it is.';
                if (!(Number(v.price) >= 0) || v.price === '') return 'Type the price as a number.';
                s.income.extras.push({ id: BC.newId(v.name, new Set([...s.income.extras.map((x) => x.id), 'premium', 'gifts', 'ads'])), name: v.name.trim(), on: true, price: Number(v.price), every: v.every, counts: [0, 0, 0, 0, 0], note: '' });
                return null;
            });
        },
        'cost-add': () => openCost(null),
        'cost-edit': (btn) => openCost(btn.dataset.id),
        // The scenarios are the owner's own: any number up to the limit, each renamed, copied, moved or deleted.
        'scenario-add': () => addScenario(null),
        'scenario-copy': () => addScenario(active()),
        'scenario-rename': () => {
            const s = active();
            form('Rename', 'The name is on its tab, its card and in the tables. The line under it is a note to yourself.', [{ id: 'name', label: 'Name', type: 'text', value: s.name }, { id: 'about', label: 'What it is', type: 'textarea', value: s.about }], (v) => {
                const name = v.name.trim();
                if (!name) return 'Give it a name.';
                if (state.plan.scenarios.some((x) => x !== s && x.name.toLowerCase() === name.toLowerCase())) return 'Another scenario already has that name.';
                s.name = name;
                s.about = v.about.trim();
                return null;
            });
        },
        'scenario-menu': (btn) => {
            const p = state.plan;
            const s = active();
            const i = p.scenarios.indexOf(s);
            const move = (by) => { p.scenarios.splice(i, 1); p.scenarios.splice(i + by, 0, s); render(); };
            A.openRowMenu(btn, [
                s.id !== p.current ? { label: 'This is where I am now', icon: 'my_location', run: () => { p.current = s.id; render(); } } : null,
                i > 0 ? { label: 'Move earlier', icon: 'arrow_back', run: () => move(-1) } : null,
                i < p.scenarios.length - 1 ? { label: 'Move later', icon: 'arrow_forward', run: () => move(1) } : null,
                { label: 'Delete this scenario', icon: 'delete', danger: true, run: () => {
                    if (p.scenarios.length === 1) { A.showToast('A plan needs at least one scenario.'); return; }
                    A.showConfirmModal('Delete this scenario?', `${s.name} and its figures go from the plan. The costs it uses stay in the price list.`, () => { p.scenarios = p.scenarios.filter((x) => x !== s); if (p.current === s.id) p.current = p.scenarios[0].id; state.tab = 'overview'; render(); });
                } }
            ].filter(Boolean));
        },
        reset: () => A.showConfirmModal('Back to the starting figures?', 'Every change you have saved to the plan is thrown away and the researched starting plan comes back. This can\'t be undone.', async () => {
            try { load(await A.apiCall('/api/admin/business-case/reset', 'POST')); A.showToast('Back to the starting figures', 'success'); } catch (error) { A.showToast(error.message); }
        }, false)
    };

    function load(data) {
        state.plan = data.plan;
        state.savedJson = JSON.stringify(data.plan);
        state.today = data.today;
        state.actuals = data.actuals || [];
        state.everSaved = !!data.saved;
        render();
    }

    let opened = false;
    async function open() {
        if (opened) return;
        opened = true;
        try {
            load(await A.apiCall('/api/admin/business-case'));
        } catch (error) {
            opened = false;
            $('businessCase').innerHTML = `<p>Error loading data: ${esc(error.message)}</p>`;
        }
    }

    function init() {
        const host = $('businessCase');
        if (!host) return;
        document.querySelector('.admin-nav-item[data-section="business-case"]')?.addEventListener('click', open);
        host.addEventListener('click', (e) => {
            const tab = e.target.closest('[data-bc-tab]');
            if (tab) { state.tab = tab.dataset.bcTab; render(); window.scrollTo(0, 0); return; }
            const btn = e.target.closest('[data-act]');
            if (btn && ACTIONS[btn.dataset.act]) ACTIONS[btn.dataset.act](btn);
        });
        // a number typed into a box: the plan changes and the worked-out parts redraw; the box is left alone
        host.addEventListener('input', (e) => {
            const bind = e.target.dataset.bind;
            if (!bind) return;
            const value = e.target.value === '' ? 0 : Number(e.target.value);
            if (!Number.isFinite(value) || value < 0) return;
            const s = active();
            setPath(/^(usage|fees)\./.test(bind) ? state.plan : s, bind, value);
            refresh();
        });
        host.addEventListener('change', (e) => {
            const t = e.target;
            const s = active();
            if (t.dataset.cost) {
                if (t.checked) s.costs[t.dataset.cost] = true; else delete s.costs[t.dataset.cost];
                t.closest('tr').classList.toggle('admin-bc-off', !t.checked);
                refresh();
            } else if (t.dataset.flag) {
                setPath(s, t.dataset.flag, t.checked);
                t.closest('.admin-bc-income').classList.toggle('admin-bc-off', !t.checked);
                refresh();
            }
        });
        $('bcSaveBtn').addEventListener('click', async () => {
            const btn = $('bcSaveBtn');
            btn.disabled = true;
            try {
                load(await A.apiCall('/api/admin/business-case', 'PUT', { plan: state.plan }));
                A.showToast('Business case saved', 'success');
            } catch (error) {
                A.showToast('Not saved: ' + error.message);
            } finally {
                btn.disabled = false;
            }
        });
        $('bcDiscardBtn').addEventListener('click', () => { state.plan = JSON.parse(state.savedJson); render(); });
        $('bcFormSaveBtn').addEventListener('click', () => { if (formSave) formSave(); });
        $('bcFormCancelBtn').addEventListener('click', () => A.hideModal('bcFormModal'));
        $('bcFormFields').addEventListener('keydown', (e) => { if (e.key === 'Enter' && e.target.tagName !== 'TEXTAREA') { e.preventDefault(); if (formSave) formSave(); } });
        $('bcCostSaveBtn').addEventListener('click', saveCost);
        $('bcCostCancelBtn').addEventListener('click', () => A.hideModal('bcCostModal'));
        ['bcCostFromKind', 'bcCostUntilKind', 'bcCostScale'].forEach((id) => $(id).addEventListener('change', syncCostForm));
        $('bcCostStartBtn').addEventListener('click', () => {
            const c = state.plan.costs.find((x) => x.id === editingCost);
            if (!c || !c.start) return;
            $('bcCostAmount').value = c.start.amount; $('bcCostCurrency').value = c.start.currency; $('bcCostEvery').value = c.start.every;
            $('bcCostStartRow').classList.add('hidden-group');
        });
        $('bcCostDeleteBtn').addEventListener('click', () => {
            const p = state.plan;
            const c = p.costs.find((x) => x.id === editingCost);
            if (!c) return;
            A.hideModal('bcCostModal');
            A.showConfirmModal('Delete this cost?', `${c.name} goes from the price list and from every scenario.`, () => {
                p.costs = p.costs.filter((x) => x !== c);
                p.scenarios.forEach((s) => { delete s.costs[c.id]; });
                render();
            });
        });
        let resizeTimer = null;
        window.addEventListener('resize', () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(() => { if (state.plan && state.tab === 'overview') drawChart(); }, 150); });
        // leaving the page with changes waiting: the browser asks first
        window.addEventListener('beforeunload', (e) => { if (state.plan && dirty()) e.preventDefault(); });
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
