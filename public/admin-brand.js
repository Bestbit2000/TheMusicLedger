// ML-484: Admin -> App name. "The Music Ledger" is a working title; this page switches the name the app
// goes by ON SCREEN between three, for everyone, so a candidate can be lived with before one is chosen.
// One button showing the name in use, a pop-up to change it (one button, one pop-up), and a confirm -
// because everyone sees the change on their next page load. What follows the setting and what doesn't is
// said on the page and in docs/brand-trial.md. The rules are server/services/brand.js; the pictures and
// what the app shows are public/brand.js. Built from the panel's own pieces: no classes of its own.
(function () {
    'use strict';
    const A = window.AdminPanel;
    if (!A) return;
    const esc = A.escapeHtml;
    const $ = (id) => document.getElementById(id);
    let data = null; // { brand, brands: { key: name } }

    const mark = (key) => `<img class="brand-mark" src="images/brands/${esc(key)}-mark.svg" alt="" aria-hidden="true">`;

    function render() {
        $('adminBrand').innerHTML = `
            <p class="admin-intro"><strong>Changes with it:</strong> the picture on the sign-in screen, the name and small mark at the top of Home and in the menu down the side, and the browser tab.</p>
            <p class="admin-intro"><strong>Does not change:</strong> the privacy policy and terms, emails, the installed app's icon and name, the About screen and this admin panel. They all still say The Music Ledger - so someone who is sent an invite will see both names.</p>
            <div class="metro-transport-grid-2 mt-4">
                <button type="button" class="metroBlk-ctrl-value-btn" id="brandChooseBtn" aria-haspopup="dialog">
                    <strong>${esc(data.brands[data.brand])}</strong>
                    <span class="metroBlk-ctrl-value-label">the name on screen</span>
                </button>
            </div>`;
    }
    async function open() {
        try { data = await A.apiCall('/api/admin/brand'); render(); } catch (error) { $('adminBrand').innerHTML = `<p>Error loading data: ${esc(error.message)}</p>`; }
    }
    function choose() {
        $('bcChoiceTitle').textContent = 'The name on screen';
        $('bcChoiceIntro').textContent = 'Everyone sees the one you pick, signed in or not, the next time they open the app.';
        $('bcChoiceIntro').classList.remove('hidden-group');
        const box = $('bcChoiceOptions');
        box.innerHTML = Object.keys(data.brands).map((key) => `<button type="button" class="flow-choice-option${key === data.brand ? ' selected' : ''}" aria-pressed="${key === data.brand}" data-value="${esc(key)}">${mark(key)}<span>${esc(data.brands[key])}</span></button>`).join('');
        box.querySelectorAll('[data-value]').forEach((b) => b.addEventListener('click', () => {
            A.hideModal('bcChoiceModal');
            const key = b.dataset.value;
            if (key === data.brand) return;
            A.showConfirmModal(`Call the app ${data.brands[key]}?`, 'Everyone will see this name and its pictures the next time they open the app. You can change it back here at any time.', async () => {
                try { data = await A.apiCall('/api/admin/brand', 'PUT', { brand: key }); render(); A.showToast(`The app is now called ${data.brands[data.brand]} on screen`, 'success'); } catch (error) { A.showToast(error.message); }
            }, false);
        }));
        A.showModal('bcChoiceModal');
    }

    document.addEventListener('DOMContentLoaded', () => {
        const host = $('adminBrand');
        if (!host) return;
        document.querySelector('.admin-nav-item[data-section="brand"]')?.addEventListener('click', open);
        host.addEventListener('click', (e) => { if (e.target.closest('#brandChooseBtn') && data) choose(); });
    });
})();
