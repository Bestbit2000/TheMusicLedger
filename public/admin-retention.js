// ML-464: Admin -> Retention. The rule for accounts nobody uses - a switch, a unit (hours, days, months
// or years) and three lengths of time: first email, second email, deletion - then who is next, and
// "Run now". The unit can be made short so the whole thing can be watched working on sandbox without
// waiting two years. The rules are server/services/retentionRules.js; this page only shows and saves.
// Built from the panel's own pieces (value box + pop-up, number fields, a table): no classes of its own.
// docs/retention.md.
(function () {
    'use strict';
    const A = window.AdminPanel;
    if (!A) return;
    const esc = A.escapeHtml;
    const $ = (id) => document.getElementById(id);
    const UNITS = [['hours', 'Hours'], ['days', 'Days'], ['months', 'Months'], ['years', 'Years']];
    let data = null;
    let draft = null; // the rule as it stands on the page, before Save

    const day = (iso) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
    const moment = (iso, unit) => (unit === 'hours' ? new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : day(iso));
    const changed = () => JSON.stringify(draft) !== JSON.stringify(data.rule);
    const STEP = { 1: 'First email', 2: 'Second email', 3: 'Deleted' };
    const STAGE = { 0: 'None', 1: 'First', 2: 'First and second' };

    function render() {
        const r = draft;
        const rows = data.accounts.map((a) => `
            <tr>
                <td class="admin-bc-text">${a.name ? `<strong>${esc(a.name)}</strong>` : '<span class="text-muted">No name yet</span>'}<div class="admin-stat-tile-sub">${esc(a.email)}</div></td>
                <td>${a.lastSeenOn ? esc(day(a.lastSeenOn)) : '<span class="text-muted">Not yet</span>'}</td>
                <td>${STAGE[a.stage]}${a.stageAt ? `<div class="admin-stat-tile-sub">${esc(moment(a.stageAt, data.rule.unit))}</div>` : ''}</td>
                <td>${STEP[a.nextStep]}${a.due ? ' <span class="admin-badge warn">Due now</span>' : ''}</td>
                <td>${esc(moment(a.nextOn, data.rule.unit))}</td>
            </tr>`).join('');
        $('adminRetention').innerHTML = `
            <h2 class="admin-stat-section-title">The rule</h2>
            <div class="admin-bc-fields">
                <label class="toggle-switch"><input type="checkbox" id="retentionOn"${r.enabled ? ' checked' : ''} aria-label="Retention switched on"><span class="toggle-slider"></span></label>
                <span>${r.enabled ? 'Switched on' : 'Switched off - nothing is emailed or deleted'}</span>
            </div>
            <div class="admin-bc-fields">
                <button type="button" class="metroBlk-ctrl-value-btn" id="retentionUnit" aria-haspopup="dialog"><strong>${esc(UNITS.find((u) => u[0] === r.unit)[1])}</strong><span>counted in</span></button>
                <label class="admin-bc-field">First email after<input class="admin-bc-num" type="number" min="1" max="1000" step="1" inputmode="numeric" data-rule="first" value="${r.first}"></label>
                <label class="admin-bc-field">Second email after<input class="admin-bc-num" type="number" min="1" max="1000" step="1" inputmode="numeric" data-rule="second" value="${r.second}"></label>
                <label class="admin-bc-field">Deleted after<input class="admin-bc-num" type="number" min="1" max="1000" step="1" inputmode="numeric" data-rule="remove" value="${r.remove}"></label>
            </div>
            <p class="admin-intro" id="retentionWords">${esc(data.inWords)}${changed() ? ' <strong>(not saved yet)</strong>' : ''}</p>
            <div class="admin-security-toolbar">
                <button type="button" class="btn-submit no-margin" id="retentionSave"${changed() ? '' : ' disabled'}>Save the rule</button>
                <button type="button" class="admin-stat-exclude-btn" id="retentionRun"${changed() ? ' disabled' : ''}>Run now</button>
                <span class="admin-test-case-meta" id="retentionStatus" role="status" aria-live="polite">${data.blocked ? esc(data.blocked) : 'Runs once a day by itself.'}</span>
            </div>
            <p class="admin-intro">${data.mailIsReal ? 'Emails from this site are really sent.' : 'On this site emails are not really sent - they are written to the test outbox, so the rule can be tried without emailing anyone.'} An account that has never been seen counts from ${esc(day(data.countsFrom))}, the day last-seen recording began. With hours, an account counts as unused from the start of the day it was last seen.</p>
            <h2 class="admin-stat-section-title">Who is next</h2>
            <p class="admin-intro">Every account the rule covers, soonest first. A step is taken only if its email could be sent, and never sooner after the one before than the rule's own gap.</p>
            ${rows ? `<div class="admin-stat-table-wrap"><table class="admin-stat-table admin-bc-table">
                <thead><tr><th class="admin-bc-text">Account</th><th>Last seen</th><th>Emails sent</th><th>Next</th><th>When</th></tr></thead>
                <tbody>${rows}</tbody>
            </table></div>` : '<p class="admin-intro">No accounts are covered yet.</p>'}`;
    }

    function load(next) { data = next; draft = { ...next.rule }; render(); }
    async function open() {
        try { load(await A.apiCall('/api/admin/retention')); } catch (error) { $('adminRetention').innerHTML = `<p>Error loading data: ${esc(error.message)}</p>`; }
    }

    function chooseUnit() {
        $('bcChoiceTitle').textContent = 'Counted in';
        $('bcChoiceIntro').textContent = 'Months or years for real use. Hours or days make it quick to try out.';
        $('bcChoiceIntro').classList.remove('hidden-group');
        const box = $('bcChoiceOptions');
        box.innerHTML = UNITS.map(([value, label]) => `<button type="button" class="flow-choice-option${value === draft.unit ? ' selected' : ''}" aria-pressed="${value === draft.unit}" data-value="${value}">${label}</button>`).join('');
        box.querySelectorAll('[data-value]').forEach((b) => b.addEventListener('click', () => { A.hideModal('bcChoiceModal'); draft.unit = b.dataset.value; render(); }));
        A.showModal('bcChoiceModal');
    }

    async function save() {
        try { load(await A.apiCall('/api/admin/retention', 'PUT', draft)); A.showToast('Rule saved', 'success'); } catch (error) { A.showToast(error.message); }
    }
    function run() {
        const due = data.accounts.filter((a) => a.due);
        const going = due.filter((a) => a.nextStep === 3).length;
        const say = data.blocked ? data.blocked : due.length
            ? `${due.length} account${due.length === 1 ? ' is' : 's are'} due a step now${going ? `, and ${going} of them will be deleted. A deletion can't be undone` : ''}.`
            : 'No account is due a step, so only old invites and feedback are cleared.';
        A.showConfirmModal('Run retention now?', say, async () => {
            $('retentionStatus').textContent = 'Running...';
            try {
                const out = await A.apiCall('/api/admin/retention/run', 'POST');
                load(out);
                const r = out.result;
                $('retentionStatus').textContent = r.ran
                    ? `Done: ${r.firstEmails} first email${r.firstEmails === 1 ? '' : 's'}, ${r.secondEmails} second, ${r.deleted} deleted; ${r.invitesCleared} old invite${r.invitesCleared === 1 ? '' : 's'} and ${r.feedbackCleared} old feedback cleared.${r.problems.length ? ` ${r.problems.length} could not be done: ${r.problems[0]}` : ''}`
                    : r.why;
            } catch (error) { A.showToast(error.message); $('retentionStatus').textContent = ''; }
        }, going > 0);
    }

    document.addEventListener('DOMContentLoaded', () => {
        const host = $('adminRetention');
        if (!host) return;
        document.querySelector('.admin-nav-item[data-section="retention"]')?.addEventListener('click', open);
        host.addEventListener('click', (e) => {
            const t = e.target.closest('button');
            if (!t || !data) return;
            if (t.id === 'retentionUnit') chooseUnit();
            if (t.id === 'retentionSave') save();
            if (t.id === 'retentionRun') run();
        });
        host.addEventListener('change', (e) => {
            if (!data) return;
            if (e.target.id === 'retentionOn') { draft.enabled = e.target.checked; render(); return; }
            const key = e.target.dataset.rule;
            if (key) { draft[key] = Math.round(Number(e.target.value)) || 0; render(); }
        });
    });
})();
