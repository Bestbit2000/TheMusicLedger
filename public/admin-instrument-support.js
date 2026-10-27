// ML-610: Admin -> Instrument support. The businesses members see in Instrument support (repairers, shops, hire):
// add one, change it, hide it while you wait for a yes, or remove it when it asks. Each shows how often it was in a
// member's list in the last 30 days. Below, what members looked for and where (a town, never who) - the searches
// that found nothing nearby are where to look for more. The rules are server/services/instrumentSupport.js;
// docs/instrument-support.md. Built from the panel's own pieces: no classes of its own.
(function () {
    'use strict';
    const A = window.AdminPanel;
    if (!A) return;
    const esc = A.escapeHtml;
    const $ = (id) => document.getElementById(id);
    let data = null;
    let editing = null; // the business being changed, or null for a new one

    const OFFER_NAMES = {
        'repairs-brass': 'Brass repairs', 'repairs-woodwind': 'Woodwind repairs', 'repairs-percussion': 'Percussion repairs',
        'shop-brass': 'Brass shop', 'shop-woodwind': 'Woodwind shop', 'shop-percussion': 'Percussion shop', hire: 'Hire'
    };
    const LOOKED_FOR = { all: 'Everything', 'repairs-brass': 'Brass repairs', 'repairs-woodwind': 'Woodwind repairs', shop: 'A shop', hire: 'Hire', percussion: 'Percussion' };
    const day = (iso) => (iso ? new Date(`${iso}T12:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '-');

    function render() {
        const list = data.businesses;
        const rows = list.map((b) => `
            <tr>
                <td class="admin-bc-text"><strong>${esc(b.name)}</strong>
                    ${b.hidden ? ' <span class="admin-badge warn">Hidden</span>' : ''}${!b.ukWide && !b.located ? ' <span class="admin-badge fail">No position</span>' : ''}
                    <div class="admin-stat-tile-sub">${esc(b.offers.map((o) => OFFER_NAMES[o] || o).join(', '))}</div></td>
                <td class="admin-bc-text">${b.ukWide ? 'UK-wide' : ''}${b.ukWide && b.town ? ' · ' : ''}${esc(b.town || '')}${b.postcode ? `<div class="admin-stat-tile-sub">${esc(b.postcode)}</div>` : ''}</td>
                <td class="admin-bc-text">${b.source === 'owner' ? 'Known to us' : 'Own website'}<div class="admin-stat-tile-sub">checked ${esc(day(b.checkedOn))}</div></td>
                <td>${b.shown30}</td>
                <td><button type="button" class="list-item-menu-btn" data-support-menu="${b.id}" aria-haspopup="menu" aria-expanded="false" aria-label="More for ${esc(b.name)}"><span class="material-symbols-outlined" aria-hidden="true">more_vert</span></button></td>
            </tr>`).join('');
        const searches = data.searches.map((s) => `
            <tr>
                <td class="admin-bc-text">${esc(LOOKED_FOR[s.lookingFor] || s.lookingFor)}</td>
                <td class="admin-bc-text">${s.near ? esc(s.near) : 'My bands\' towns'}</td>
                <td>${s.searches}</td>
                <td>${s.empty ? `<span class="admin-badge warn">${s.empty}</span>` : '0'}</td>
            </tr>`).join('');
        $('adminSupport').innerHTML = `
            <button class="btn-submit no-margin admin-add-btn" data-support-add type="button">+ Add a business</button>
            ${list.length ? `<div class="admin-stat-table-wrap"><table class="admin-stat-table admin-stack-table admin-bc-table">
                <thead><tr><th class="admin-bc-text">Business</th><th class="admin-bc-text">Where</th><th class="admin-bc-text">From</th><th>Shown (30 days)</th><th><span class="visually-hidden">More</span></th></tr></thead>
                <tbody>${rows}</tbody>
            </table></div>` : '<p class="admin-intro">No businesses yet.</p>'}
            <h2>What members looked for (last 30 days)</h2>
            <p class="admin-intro">Counted by what and where only - never who. "Found nothing nearby" is a look with nothing within about 45 minutes: somewhere to find more.</p>
            ${data.searches.length ? `<div class="admin-stat-table-wrap"><table class="admin-stat-table admin-stack-table admin-bc-table">
                <thead><tr><th class="admin-bc-text">Looking for</th><th class="admin-bc-text">Near</th><th>Looks</th><th>Found nothing nearby</th></tr></thead>
                <tbody>${searches}</tbody>
            </table></div>` : '<p class="admin-intro">Nobody has looked yet.</p>'}`;
    }

    async function open() {
        try { data = await A.apiCall('/api/admin/support'); render(); } catch (error) { $('adminSupport').innerHTML = `<p>Error loading data: ${esc(error.message)}</p>`; }
    }
    const find = (id) => data.businesses.find((b) => String(b.id) === String(id));

    function openForm(b) {
        editing = b || null;
        $('supportFormTitle').textContent = b ? `Change ${b.name}` : 'Add a business';
        $('supportFormOffers').innerHTML = data.offers.map((o) => `<label class="text-sm fw-normal flex-row items-center gap-xs no-margin"><input type="checkbox" class="check-sm" value="${esc(o)}"${b && b.offers.includes(o) ? ' checked' : ''}> ${esc(OFFER_NAMES[o] || o)}</label>`).join('');
        const v = (id, value) => { $(id).value = value || ''; };
        v('supportFormName', b && b.name);
        v('supportFormTown', b && b.town);
        v('supportFormCounty', b && b.county);
        v('supportFormPostcode', b && b.postcode);
        v('supportFormLink', b && b.link);
        v('supportFormPhone', b && b.phone);
        v('supportFormEmail', b && b.email);
        v('supportFormWhat', b && b.whatTheyDo);
        v('supportFormCheckedUrl', b && b.checkedUrl);
        $('supportFormSource').value = b ? b.source : 'website';
        $('supportFormUkWide').checked = !!(b && b.ukWide);
        $('supportFormHidden').checked = !!(b && b.hidden);
        A.showModal('supportFormModal');
    }

    async function save() {
        const body = {
            name: $('supportFormName').value, offers: [...$('supportFormOffers').querySelectorAll('input:checked')].map((i) => i.value),
            ukWide: $('supportFormUkWide').checked, town: $('supportFormTown').value, county: $('supportFormCounty').value,
            postcode: $('supportFormPostcode').value, link: $('supportFormLink').value, phone: $('supportFormPhone').value,
            email: $('supportFormEmail').value, whatTheyDo: $('supportFormWhat').value, source: $('supportFormSource').value,
            checkedUrl: $('supportFormCheckedUrl').value, hidden: $('supportFormHidden').checked
        };
        try {
            data = editing ? await A.apiCall(`/api/admin/support/${editing.id}`, 'PUT', body) : await A.apiCall('/api/admin/support', 'POST', body);
            A.hideModal('supportFormModal');
            render();
            A.showToast(editing ? 'Saved' : 'Added', 'success');
        } catch (error) { A.showToast(error.message); }
    }

    // Hide / show without opening the form: sends the business back as it is, with hidden switched
    async function setHidden(b, hidden) {
        try { data = await A.apiCall(`/api/admin/support/${b.id}`, 'PUT', { ...b, hidden }); render(); } catch (error) { A.showToast(error.message); }
    }

    function remove(b) {
        A.showConfirmModal(`Remove ${b.name}?`, 'It goes from Instrument support for good, with its counts. To take it off for a while instead, hide it.', async () => {
            try { data = await A.apiCall(`/api/admin/support/${b.id}`, 'DELETE'); render(); } catch (error) { A.showToast(error.message); }
        }, true);
    }

    document.addEventListener('DOMContentLoaded', () => {
        const host = $('adminSupport');
        if (!host) return;
        document.querySelector('.admin-nav-item[data-section="instrument-support"]')?.addEventListener('click', open);
        host.addEventListener('click', (e) => {
            const t = e.target.closest('button');
            if (!t || !data) return;
            if (t.dataset.supportAdd !== undefined) openForm(null);
            const b = t.dataset.supportMenu && find(t.dataset.supportMenu);
            if (b) {
                A.openRowMenu(t, [
                    { label: 'Change', icon: 'edit', run: () => openForm(b) },
                    b.link ? { label: b.linkKind === 'facebook' ? 'Their Facebook page' : 'Their website', icon: 'open_in_new', href: b.link } : null,
                    b.hidden ? { label: 'Show to members', icon: 'visibility', run: () => setHidden(b, false) } : { label: 'Hide from members', icon: 'visibility_off', run: () => setHidden(b, true) },
                    { label: 'Remove', icon: 'delete', danger: true, run: () => remove(b) }
                ].filter(Boolean));
            }
        });
        $('supportFormSaveBtn')?.addEventListener('click', save);
        $('supportFormCancelBtn')?.addEventListener('click', () => A.hideModal('supportFormModal'));
    });
})();
