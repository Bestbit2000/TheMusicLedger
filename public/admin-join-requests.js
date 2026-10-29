// ML-580: Admin -> Waiting list. The requests to join from the public page, newest first: who, their email, the
// band they named and their instrument. Let in sends the ordinary invitation email (a Standard member, in with
// Google or a password - whichever ways are on); Pass to
// the organiser - when the band they named shares its music here - sends that band's organisers a notice, and
// they decide; Not now removes it. Each goes from the list once done. The rules are
// server/services/joinRequests.js; docs/waiting-list.md. Built from the panel's own pieces; on a phone the table is
// a list of cards (.admin-stack-table, ML-624).
(function () {
    'use strict';
    const A = window.AdminPanel;
    if (!A) return;
    const esc = A.escapeHtml;
    const $ = (id) => document.getElementById(id);
    let data = null;

    const day = (iso) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

    function render() {
        A.setNavCount('waitingListNavCount', data.requests.length);
        if (!data.requests.length) {
            // owner, 29 Oct 2026: the notifications' "all caught up" drawing (public/restingArt.js) and a heading
            $('adminJoinRequests').innerHTML = `<div class="admin-empty">${window.RestingArt ? window.RestingArt.svg() : ''}
                <h2 class="notifications-empty-title">Nobody is waiting to join</h2>
                <p class="text-muted no-margin">You're all done here. A new request from the public page shows up here, with a number on the menu.</p></div>`;
            return;
        }
        // ML-624: data-label names each cell on a phone, where each request is a card (.admin-stack-table)
        const rows = data.requests.map((r) => `
            <tr>
                <td class="admin-bc-text"><strong>${esc(r.firstName)} ${esc(r.lastName)}</strong><div class="admin-stat-tile-sub">${esc(r.email)}</div>
                    ${r.isMember ? '<span class="admin-badge warn">Already a member</span>' : ''}${r.closed ? ' <span class="admin-badge fail">Closed account</span>' : ''}</td>
                <td class="admin-bc-text" data-label="Band">${r.band ? esc(r.band) : '<span class="text-muted">None given</span>'}${r.band && !r.fromDirectory ? '<div class="admin-stat-tile-sub">Not in the directory</div>' : ''}</td>
                <td class="admin-bc-text" data-label="Plays">${r.instrument ? esc(r.instrument) : '<span class="text-muted">-</span>'}</td>
                <td data-label="Asked">${esc(day(r.askedOn))}</td>
                <td>
                    <div class="admin-security-toolbar">
                        <button type="button" class="btn-submit no-margin" data-let-in="${r.id}"${r.closed || (r.isMember ? !data.myBands.length : !data.canLetIn) ? ' disabled' : ''}>${r.isMember ? 'Add to band' : 'Let in'}</button>
                        ${r.spaces.length ? `<button type="button" class="admin-stat-exclude-btn" data-pass="${r.id}">Pass to the organiser</button>` : ''}
                        ${r.suggestions && r.suggestions.length ? `<button type="button" class="admin-stat-exclude-btn" data-match="${r.id}">Match to a band</button>` : ''}
                        <button type="button" class="admin-stat-exclude-btn" data-dismiss="${r.id}">Not now</button>
                    </div>
                </td>
            </tr>`).join('');
        // ML-646: "Let in everyone asking for <band>" for each band of yours two or more are asking for
        const asking = data.myBands.map((b) => ({ band: b, count: data.requests.filter((r) => !r.closed && r.myBandIds.includes(b.id)).length })).filter((x) => x.count >= 2);
        $('adminJoinRequests').innerHTML = `
            ${data.canLetIn ? '' : '<p class="admin-intro"><span class="admin-badge warn">Let in is off</span> It sends an invitation, and no way of signing in is switched on on this site.</p>'}
            ${asking.length && data.canLetIn ? `<div class="admin-security-toolbar">${asking.map((x) => `<button type="button" class="admin-stat-exclude-btn" data-let-in-all="${x.band.id}">Let in everyone asking for ${esc(x.band.name)} (${x.count})</button>`).join('')}</div>` : ''}
            <div class="admin-stat-table-wrap"><table class="admin-stat-table admin-bc-table admin-stack-table">
                <thead><tr><th class="admin-bc-text">Who</th><th class="admin-bc-text">Band</th><th class="admin-bc-text">Plays</th><th>Asked</th><th><span class="visually-hidden">What to do</span></th></tr></thead>
                <tbody>${rows}</tbody>
            </table></div>
            <p class="admin-intro">Pass to the organiser shows only for a band whose music is shared here and has an organiser. Match to a band shows when a band typed in looks like one in the directory. A band that isn't in the directory, or doesn't share here yet: let them in, and they add it on My bands.</p>`;
    }

    async function open() {
        try { data = await A.apiCall('/api/admin/join-requests'); render(); } catch (error) { $('adminJoinRequests').innerHTML = `<p>Error loading data: ${esc(error.message)}</p>`; }
    }
    const find = (id) => data.requests.find((r) => String(r.id) === String(id));

    // ML-646 (owner, 28 Oct 2026): Let in puts them straight into the band they asked to join - one of the bands you
    // organise, picked to start with - with what they may do. Someone who already has an account is added at once.
    // forBand: "Let in everyone asking for <band>" - the same pop-up, for every request tied to that band.
    let letInFor = null;
    const allowanceLine = () => {
        const a = data.allowance;
        return a ? `Each band counts as one band invitation: you have ${a.left} left (${a.perDay} a day, ${a.perQuarter} a quarter).` : '';
    };
    const levelChosen = () => (document.querySelector('input[name="letInLevel"]:checked') || {}).value || 'play';
    function bandSwitches(picked, fixed) {
        $('letInBands').innerHTML = fixed ? '' : data.myBands.map((b) => `
            <div class="display-toggle-row"><span id="letInBand-${b.id}-label">${esc(b.name)}</span><label class="toggle-switch"><input type="checkbox" data-let-in-band="${b.id}" aria-labelledby="letInBand-${b.id}-label"${picked.includes(b.id) ? ' checked' : ''}><span class="toggle-slider"></span></label></div>`).join('');
        const any = () => fixed || [...document.querySelectorAll('[data-let-in-band]')].some((c) => c.checked);
        const show = () => { $('letInLevelGroup').classList.toggle('hidden-group', !any()); };
        $('letInBands').querySelectorAll('[data-let-in-band]').forEach((c) => c.addEventListener('change', show));
        show();
    }
    function letIn(r) {
        letInFor = { request: r };
        $('letInTitle').textContent = r.isMember ? `Add ${r.firstName} ${r.lastName} to a band` : `Let ${r.firstName} ${r.lastName} in`;
        $('letInIntro').textContent = r.isMember
            ? `They already have an account. They're put in the band now and told in the app.`
            : `They're sent the invitation email at ${r.email}, as a Standard member. Pick a band and they're in it as soon as they sign in - its organisers will see their name.`
              + (r.band && !r.myBandIds.length ? ` They asked for ${r.band}, which isn't one of yours - use Pass to the organiser for that.` : '');
        bandSwitches(r.myBandIds, false);
        $('letInGo').textContent = r.isMember ? 'Add to band' : 'Let them in';
        $('letInAllowance').textContent = data.myBands.length ? allowanceLine() : "You don't organise a band here, so they're let in without one.";
        A.showModal('letInModal');
    }
    function letInAll(band, count) {
        letInFor = { band };
        $('letInTitle').textContent = `Let in everyone asking for ${band.name}`;
        $('letInIntro').textContent = `${count} people asked to join ${band.name}. Each is sent the invitation email (or, with an account already, is added now), and is in the band as soon as they sign in. Its organisers will see their names.`;
        bandSwitches([band.id], true);
        $('letInGo').textContent = `Let in all ${count}`;
        $('letInAllowance').textContent = allowanceLine();
        A.showModal('letInModal');
    }
    async function letInGo() {
        const level = levelChosen();
        const target = letInFor;
        if (!target) return;
        A.hideModal('letInModal');
        try {
            if (target.band) {
                const out = await A.apiCall('/api/admin/join-requests/let-in-all', 'POST', { groupId: target.band.id, level });
                data = out; render();
                A.showToast(`${out.letIn} let in to ${target.band.name}${out.notLetIn.length ? ` - ${out.notLetIn.length} not: ${out.notLetIn.join('; ')}` : ''}`, out.notLetIn.length ? undefined : 'success');
                return;
            }
            const bands = [...document.querySelectorAll('[data-let-in-band]:checked')].map((c) => Number(c.dataset.letInBand));
            const out = await A.apiCall(`/api/admin/join-requests/${target.request.id}/let-in`, 'POST', { bands, level });
            data = out; render();
            A.showToast(out.joined ? 'Added to the band' : out.invite && out.invite.emailed === false ? 'Invitation made - this site does not send emails' : 'Invitation sent', 'success');
        } catch (error) { A.showToast(error.message); }
    }

    function passTo(r, space) {
        A.showConfirmModal(`Pass to ${space.name}?`, `${space.organisers === 1 ? 'Its organiser gets' : `Its ${space.organisers} organisers get`} a notice in the app saying ${r.firstName} ${r.lastName} asked to join, with their email, so they can invite them. ${r.firstName} is not told. The request goes from this list.`, async () => {
            try { data = await A.apiCall(`/api/admin/join-requests/${r.id}/pass`, 'POST', { groupId: space.id }); render(); A.showToast('Passed to the organiser', 'success'); } catch (error) { A.showToast(error.message); }
        }, false);
    }
    function pass(r) {
        if (r.spaces.length === 1) { passTo(r, r.spaces[0]); return; }
        // More than one shared space for the band (two people set up sharing): choose which
        $('bcChoiceTitle').textContent = 'Which shared space?';
        $('bcChoiceIntro').textContent = `${r.band} shares its music here more than once. Pass the request to the organisers of:`;
        $('bcChoiceIntro').classList.remove('hidden-group');
        const box = $('bcChoiceOptions');
        box.innerHTML = r.spaces.map((s, i) => `<button type="button" class="flow-choice-option" data-space="${i}">${esc(s.name)} (${s.organisers} organiser${s.organisers === 1 ? '' : 's'})</button>`).join('');
        box.querySelectorAll('[data-space]').forEach((b) => b.addEventListener('click', () => { A.hideModal('bcChoiceModal'); passTo(r, r.spaces[Number(b.dataset.space)]); }));
        A.showModal('bcChoiceModal');
    }

    // ML-625: the band they typed ("Cobham") is one of the directory's after all - tie the request to it, so it can be
    // passed to that band's organiser. The choices are the directory bands it most likely means (public/bandMatch.js).
    function match(r) {
        $('bcChoiceTitle').textContent = 'Which band did they mean?';
        $('bcChoiceIntro').textContent = `${r.firstName} typed "${r.band}". The bands in the directory it looks like:`;
        $('bcChoiceIntro').classList.remove('hidden-group');
        const box = $('bcChoiceOptions');
        box.innerHTML = r.suggestions.map((s, i) => `<button type="button" class="flow-choice-option" data-band="${i}">${esc(s)}</button>`).join('');
        box.querySelectorAll('[data-band]').forEach((b) => b.addEventListener('click', async () => {
            A.hideModal('bcChoiceModal');
            const label = r.suggestions[Number(b.dataset.band)];
            try { data = await A.apiCall(`/api/admin/join-requests/${r.id}/band`, 'POST', { label }); render(); A.showToast(`Matched to ${label}`, 'success'); } catch (error) { A.showToast(error.message); }
        }));
        A.showModal('bcChoiceModal');
    }

    function dismiss(r) {
        A.showConfirmModal(`Remove ${r.firstName} ${r.lastName}'s request?`, 'Nobody is told, and nothing is sent. They can ask again from the public page.', async () => {
            try { data = await A.apiCall(`/api/admin/join-requests/${r.id}`, 'DELETE'); render(); } catch (error) { A.showToast(error.message); }
        }, true);
    }

    document.addEventListener('DOMContentLoaded', () => {
        const host = $('adminJoinRequests');
        if (!host) return;
        document.querySelector('.admin-nav-item[data-section="waiting-list"]')?.addEventListener('click', open);
        $('letInGo')?.addEventListener('click', letInGo);
        $('letInCancel')?.addEventListener('click', () => A.hideModal('letInModal'));
        host.addEventListener('click', (e) => {
            const t = e.target.closest('button');
            if (!t || !data) return;
            if (t.dataset.letIn) letIn(find(t.dataset.letIn));
            if (t.dataset.letInAll) { const x = data.myBands.find((b) => String(b.id) === t.dataset.letInAll); if (x) letInAll(x, data.requests.filter((r) => !r.closed && r.myBandIds.includes(x.id)).length); }
            if (t.dataset.pass) pass(find(t.dataset.pass));
            if (t.dataset.match) match(find(t.dataset.match));
            if (t.dataset.dismiss) dismiss(find(t.dataset.dismiss));
        });
    });
    // The menu's count, without waiting for the page to be opened. admin.js asks for it once the panel has
    // loaded - not before: until the super admin has proved it is them (ML-518) every admin route says no, so
    // asked any earlier the count stayed off on every site with the check.
    function refreshCount() {
        A.apiCall('/api/admin/join-requests').then((d) => A.setNavCount('waitingListNavCount', d.requests.length)).catch(() => { /* the count just stays off */ });
    }
    window.AdminJoinRequests = { refreshCount };
})();
