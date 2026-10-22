// ML-242: the pricing page's columns, read from Admin -> Feature access (GET /api/pricing) so the page
// can't drift from the app. A cell names its account type (data-plan), the features that must all be on
// for it (data-feature) and, for a number, the limit (data-limit) and how to write it (data-format).
// A feature or limit the answer doesn't have is left as typed in pricing.html - so is every cell if the
// answer can't be read. Nothing here is about a member: the answer is the same for everyone.
(function () {
    function setCell(td, state, text) {
        td.classList.remove('is-yes', 'is-no', 'is-coming');
        td.textContent = '';
        if (state === 'number') { td.textContent = text; return; }
        td.classList.add(state === 'yes' ? 'is-yes' : 'is-no');
        const label = document.createElement('span');
        label.className = 'visually-hidden';
        label.textContent = state === 'yes' ? 'Included' : 'Not included';
        td.appendChild(label);
    }

    function fill(columns) {
        document.querySelectorAll('.pricing-table td[data-plan]').forEach(function (td) {
            const plan = columns[td.dataset.plan];
            if (!plan) return;
            const keys = (td.dataset.feature || '').split(' ').filter(Boolean);
            if (keys.some(function (k) { return !(k in plan.features); })) return; // not in the catalog yet: keep what's typed
            const on = keys.every(function (k) { return plan.features[k]; });
            const limitKey = td.dataset.limit;
            if (!limitKey) { setCell(td, on ? 'yes' : 'no'); return; }
            if (!(limitKey in plan.limits)) return;
            const n = plan.limits[limitKey];
            if (!on || !Number.isFinite(n) || n <= 0) { setCell(td, 'no'); return; }
            setCell(td, 'number', (td.dataset.format || '{n}').replace('{n}', String(n)));
        });
    }

    fetch('/api/pricing', { cache: 'no-store' })
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (columns) { if (columns) fill(columns); })
        .catch(function () { /* leave the typed table */ });
})();
