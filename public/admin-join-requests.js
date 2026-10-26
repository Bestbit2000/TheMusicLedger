// ML-580: Admin -> Waiting list. The requests to join from the public page, newest first: who, their email, the
// band they named and their instrument. Let in sends the ordinary invitation email (a Standard member, in with
// Google or a password - whichever ways are on); Pass to
// the organiser - when the band they named shares its music here - sends that band's organisers a notice, and
// they decide; Not now removes it. Each goes from the list once done. The rules are
// server/services/joinRequests.js; docs/waiting-list.md. Built from the panel's own pieces: no classes of its own.
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
            $('adminJoinRequests').innerHTML = '<p class="admin-intro">Nobody is waiting to join.</p>';
            return;
        }
        const rows = data.requests.map((r) => `
            <tr>
                <td class="admin-bc-text"><strong>${esc(r.firstName)} ${esc(r.lastName)}</strong><div class="admin-stat-tile-sub">${esc(r.email)}</div>
                    ${r.isMember ? '<span class="admin-badge warn">Already a member</span>' : ''}${r.closed ? ' <span class="admin-badge fail">Closed account</span>' : ''}</td>
                <td class="admin-bc-text">${r.band ? esc(r.band) : '<span class="text-muted">None given</span>'}${r.band && !r.fromDirectory ? '<div class="admin-stat-tile-sub">Not in the directory</div>' : ''}</td>
                <td class="admin-bc-text">${r.instrument ? esc(r.instrument) : '<span class="text-muted">-</span>'}</td>
                <td>${esc(day(r.askedOn))}</td>
                <td>
                    <div class="admin-security-toolbar">
                        <button type="button" class="btn-submit no-margin" data-let-in="${r.id}"${r.isMember || r.closed || !data.canLetIn ? ' disabled' : ''}>Let in</button>
                        ${r.spaces.length ? `<button type="button" class="admin-stat-exclude-btn" data-pass="${r.id}">Pass to the organiser</button>` : ''}
                        <button type="button" class="admin-stat-exclude-btn" data-dismiss="${r.id}">Not now</button>
                    </div>
                </td>
            </tr>`).join('');
        $('adminJoinRequests').innerHTML = `
            ${data.canLetIn ? '' : '<p class="admin-intro"><span class="admin-badge warn">Let in is off</span> It sends an invitation, and no way of signing in is switched on on this site.</p>'}
            <div class="admin-stat-table-wrap"><table class="admin-stat-table admin-bc-table">
                <thead><tr><th class="admin-bc-text">Who</th><th class="admin-bc-text">Band</th><th class="admin-bc-text">Plays</th><th>Asked</th><th><span class="visually-hidden">What to do</span></th></tr></thead>
                <tbody>${rows}</tbody>
            </table></div>
            <p class="admin-intro">Pass to the organiser shows only for a band whose music is shared here and has an organiser. A band that isn't in the directory, or doesn't share here yet: let them in, and they add it on My bands.</p>`;
    }

    async function open() {
        try { data = await A.apiCall('/api/admin/join-requests'); render(); } catch (error) { $('adminJoinRequests').innerHTML = `<p>Error loading data: ${esc(error.message)}</p>`; }
    }
    const find = (id) => data.requests.find((r) => String(r.id) === String(id));

    function letIn(r) {
        A.showConfirmModal(`Let ${r.firstName} ${r.lastName} in?`, `They are sent the invitation email at ${r.email}, as a Standard member, and the request goes from this list.`, async () => {
            try {
                const out = await A.apiCall(`/api/admin/join-requests/${r.id}/let-in`, 'POST');
                data = out; render();
                A.showToast(out.invite && out.invite.emailed === false ? 'Invitation made - this site does not send emails' : 'Invitation sent', 'success');
            } catch (error) { A.showToast(error.message); }
        }, false);
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

    function dismiss(r) {
        A.showConfirmModal(`Remove ${r.firstName} ${r.lastName}'s request?`, 'Nobody is told, and nothing is sent. They can ask again from the public page.', async () => {
            try { data = await A.apiCall(`/api/admin/join-requests/${r.id}`, 'DELETE'); render(); } catch (error) { A.showToast(error.message); }
        }, true);
    }

    document.addEventListener('DOMContentLoaded', () => {
        const host = $('adminJoinRequests');
        if (!host) return;
        document.querySelector('.admin-nav-item[data-section="waiting-list"]')?.addEventListener('click', open);
        host.addEventListener('click', (e) => {
            const t = e.target.closest('button');
            if (!t || !data) return;
            if (t.dataset.letIn) letIn(find(t.dataset.letIn));
            if (t.dataset.pass) pass(find(t.dataset.pass));
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
