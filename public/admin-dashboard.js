// ML-443: Admin -> Dashboard, the page the panel opens on. People, the build, money and what needs
// the owner - read in one go from /api/admin/dashboard (server/services/adminDashboard.js), which
// only reads what the app already holds. Every box is a button that opens the page behind it (by
// its address, admin.html#accounts - admin.js does the rest). A part the server couldn't read is
// left out with a line saying so. See specs/components/admin-shell.md ("Dashboard").
(function () {
    'use strict';
    const A = window.AdminPanel;
    if (!A) return;
    const esc = A.escapeHtml;
    const host = () => document.getElementById('adminDashboard');

    const count = (v) => Math.round(Number(v) || 0).toLocaleString('en-GB');
    const pence = (v) => `£${(Math.round((Number(v) || 0) * 100) / 100).toFixed(2)}`;
    const money = (v) => { const n = Math.round(Number(v) || 0); return `${n < 0 ? '−' : n > 0 ? '+' : ''}£${Math.abs(n).toLocaleString('en-GB')}`; };
    const day = (iso) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
    const month = (ym) => new Date(`${ym}-01T00:00:00Z`).toLocaleDateString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' });
    const time = (minutes) => (minutes < 60 ? `${minutes} min` : `${Math.floor(minutes / 60)} h ${minutes % 60} min`);
    const plural = (n, one, many) => `${count(n)} ${n === 1 ? one : many}`;

    // A box: the figure, a line under it, then what it is - and the page it opens
    const tile = (page, label, value, sub = '', cls = '') => `<button type="button" class="admin-stat-tile admin-dash-tile" data-go="${page}"><span class="admin-stat-tile-label">${esc(label)}</span><span class="admin-stat-tile-value${cls}">${esc(value)}</span><span class="admin-stat-tile-sub">${esc(sub)}</span></button>`;
    const block = (title, tiles) => `<h2 class="admin-stat-section-title">${title}</h2>${tiles ? `<div class="admin-stat-tiles">${tiles}</div>` : '<p class="admin-intro">This couldn\'t be read just now.</p>'}`;

    function people(p) {
        if (!p) return '';
        const types = p.byType.map((t) => `${t.count} ${t.label}`).join(', ');
        return tile('accounts', 'Members', count(p.total), types)
            + tile('accounts', 'New this week', count(p.newThisWeek), p.invitesWaiting ? `${plural(p.invitesWaiting, 'invite', 'invites')} not accepted yet` : 'no invites waiting')
            + tile('usage', 'Practised this week', count(p.activeThisWeek), p.total ? `of ${plural(p.total, 'member', 'members')}, in the last 7 days` : 'in the last 7 days')
            + tile('usage', 'Practice logged this week', time(p.minutesThisWeek), plural(p.sessionsThisWeek, 'session', 'sessions'));
    }

    function build(b, m) {
        if (!b) return '';
        const t = b.tests;
        const launch = m && m.daysToLaunch !== null
            ? tile('business-case', 'Until launch', m.daysToLaunch > 0 ? plural(m.daysToLaunch, 'day', 'days') : 'Launched', `${month(m.launch)}, from the business case`)
            : '';
        return tile('release-tests', 'Version', b.version || '–', b.releasedOn ? `released ${day(b.releasedOn)}` : '')
            + tile('release-tests', 'Back-tests', t ? `${t.passed} of ${t.total} pass` : 'Never run', t ? (t.failed ? `${t.failed} failing · run ${day(t.at)}` : `run ${day(t.at)}`) : '', t && t.failed ? ' admin-bc-bad' : '')
            + tile('feature-access', 'Features for Standard members', `${b.features.standard} of ${b.features.live}`, `${b.features.live} of ${b.features.total} features are live`)
            + launch;
    }

    function cash(m) {
        if (!m) return '';
        const s = m.scenario;
        const none = (v) => v === null || v === undefined;
        return tile('costs-usage', 'Spent so far', none(m.spent) ? '–' : pence(m.spent), 'every payment on Costs and usage')
            + tile('costs-usage', 'Costing now, a month', none(m.perMonth) ? '–' : pence(m.perMonth), 'what is running today')
            + tile('business-case', `Forecast after ${m.years} year${m.years === 1 ? '' : 's'}`, money(s.endPosition), `the scenario you are in: ${s.name}`, s.endPosition < -0.5 ? ' admin-bc-bad' : s.endPosition > 0.5 ? ' admin-bc-good' : '')
            + tile('business-case', 'Money back', s.payback || (s.hasIncome ? 'Not in the plan' : 'No income'), s.payback ? 'the month the running total turns positive' : s.hasIncome ? `not paid back within ${m.years} year${m.years === 1 ? '' : 's'}` : 'this scenario has costs only');
    }

    const NEED = { fail: ['fail', 'Now'], warn: ['warn', 'Soon'], info: ['info', 'Waiting'] };
    function needs(list) {
        if (!list.length) return '<p class="admin-intro">Nothing needs you today.</p>';
        return `<div class="admin-feature admin-dash-needs">${list.map((n) => `<button type="button" class="admin-dash-need" data-go="${n.page}"><span class="admin-badge ${NEED[n.level][0]}">${NEED[n.level][1]}</span><span class="admin-dash-need-text">${esc(n.text)}</span><span class="material-symbols-outlined" aria-hidden="true">chevron_right</span></button>`).join('')}</div>`;
    }

    function render(d) {
        host().innerHTML = block('People', people(d.people))
            + block('The build', build(d.build, d.money))
            + block('Money', cash(d.money))
            + `<h2 class="admin-stat-section-title">Needs you</h2>${needs(d.needs)}`;
    }

    async function open() {
        try { render(await A.apiCall('/api/admin/dashboard')); } catch (error) { host().innerHTML = `<p>Error loading data: ${esc(error.message)}</p>`; }
    }

    document.addEventListener('DOMContentLoaded', () => {
        // Read again each time the page is opened, so it is never an old picture
        document.querySelector('.admin-nav-item[data-section="dashboard"]')?.addEventListener('click', open);
        host()?.addEventListener('click', (e) => {
            const go = e.target.closest('[data-go]');
            if (go) location.hash = go.dataset.go;
        });
        window.AdminDashboard = { open };
    });
})();
