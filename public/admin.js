// Admin panel (ML-26) - Release tests section. Reads the same authToken the
// main app stores in localStorage (same origin) rather than duplicating its
// login flow. No admin-role check yet - see the note in admin.html.
(function () {
    const API_BASE_URL = window.location.hostname === 'localhost'
        ? 'http://localhost:3000'
        : `https://${window.location.hostname}`;

    if (localStorage.getItem('darkMode') === 'true') {
        document.body.classList.add('dark-mode');
    }

    const token = localStorage.getItem('authToken');
    if (!token) {
        document.getElementById('loggedOutNotice').classList.remove('hidden-group');
        return;
    }

    async function apiCall(endpoint, method = 'GET', body = null) {
        const response = await fetch(`${API_BASE_URL}${endpoint}`, {
            method,
            headers: {
                Authorization: `Bearer ${token}`,
                ...(body ? { 'Content-Type': 'application/json' } : {})
            },
            ...(body ? { body: JSON.stringify(body) } : {})
        });
        if (!response.ok) {
            const err = await response.json().catch(() => ({}));
            const error = new Error(err.error || `API error: ${response.status}`);
            error.status = response.status;
            error.body = err;
            throw error;
        }
        return response.json();
    }

    function escapeHtml(str) {
        return String(str ?? '').replace(/[&<>"']/g, (c) => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        }[c]));
    }

    function fmtDate(iso) {
        return iso ? new Date(iso).toLocaleString() : '-';
    }

    function verdictBadge(verdict) {
        const cls = (verdict || 'never').toLowerCase();
        const label = verdict || 'Never run';
        return `<span class="admin-badge ${cls}">${label}</span>`;
    }

    // ========================================
    // Confirm modal + toast - replaces native confirm()/alert() everywhere
    // in this file, matching the main app's own modal/toast pattern.
    // ========================================
    let confirmCallback = null;

    function showConfirmModal(title, message, callback, isDanger = true) {
        document.getElementById('adminConfirmTitle').textContent = title;
        document.getElementById('adminConfirmMessage').textContent = message;
        const btn = document.getElementById('adminConfirmActionBtn');
        btn.style.background = isDanger ? 'var(--danger-color)' : 'var(--primary-action)';
        btn.textContent = isDanger ? 'Delete' : 'Confirm';
        confirmCallback = callback;
        document.getElementById('adminConfirmModal').style.display = 'flex';
    }

    function closeConfirmModal() {
        document.getElementById('adminConfirmModal').style.display = 'none';
        confirmCallback = null;
    }

    let toastTimeout = null;
    function showToast(message, type = 'warning') {
        const t = document.getElementById('adminToast');
        if (!t) return;
        t.className = `toast ${type}`;
        document.getElementById('adminToastMsg').textContent = message;
        t.style.display = 'flex';
        clearTimeout(toastTimeout);
        toastTimeout = setTimeout(() => { t.style.display = 'none'; }, 5000);
    }

    function renderSummary(data) {
        const totalTestCases = data.features.reduce((n, f) => n + f.testCases.length, 0);
        const lastRun = data.recentRuns[0];
        document.getElementById('backtestSummary').innerHTML = `
            <div class="stat-card"><div class="label">Features</div><div class="value">${data.features.length}</div></div>
            <div class="stat-card"><div class="label">Test cases</div><div class="value">${totalTestCases}</div></div>
            <div class="stat-card"><div class="label">Last run</div><div class="value">${lastRun ? fmtDate(lastRun.startedAt) : '-'}</div></div>
            <div class="stat-card"><div class="label">Last result</div><div class="value">${lastRun ? `${lastRun.passedTests}/${lastRun.totalTests} passed` : '-'}</div></div>
        `;
    }

    function renderRunRow(r) {
        return `
            <div class="admin-run-row">
                <div class="admin-run-when">${fmtDate(r.createdAt)}</div>
                <div class="admin-run-detail">
                    ${verdictBadge(r.verdict)}<span class="admin-run-duration">${r.durationMs}ms</span>
                    ${r.errorMessage ? `<pre class="admin-run-error">${escapeHtml(r.errorMessage)}</pre>` : ''}
                    ${r.notes ? `<p class="admin-run-notes"><strong>Action taken:</strong> ${escapeHtml(r.notes)}</p>` : ''}
                </div>
            </div>
        `;
    }

    function renderTestCase(tc) {
        const latest = tc.runs[0];
        return `
            <div class="admin-test-case">
                <div class="admin-test-case-head">
                    <div>
                        <div class="admin-test-case-title">${escapeHtml(tc.title)}</div>
                        <div class="admin-test-case-meta">
                            ${tc.jiraTicketKey ? `<a href="https://bestbit2000.atlassian.net/browse/${encodeURIComponent(tc.jiraTicketKey)}" target="_blank" rel="noopener">${escapeHtml(tc.jiraTicketKey)}</a> &middot; ` : ''}
                            ${tc.runs.length} run${tc.runs.length === 1 ? '' : 's'}${tc.isActive ? '' : ' &middot; inactive'}
                        </div>
                    </div>
                    ${verdictBadge(latest ? latest.verdict : null)}
                </div>
                <div class="admin-run-history">
                    ${tc.runs.length ? tc.runs.map(renderRunRow).join('') : '<p>No runs recorded yet.</p>'}
                </div>
            </div>
        `;
    }

    function renderFeatures(data) {
        const el = document.getElementById('featureList');
        if (!data.features.length) {
            el.innerHTML = '<p>No features registered yet - ask Claude to add test coverage for a feature (see .claude/skills/backtest).</p>';
            return;
        }
        el.innerHTML = data.features.map(f => `
            <div class="admin-feature">
                <div class="admin-feature-header">
                    <h2>${escapeHtml(f.name)}</h2>
                    <p>${escapeHtml(f.description || '')}</p>
                </div>
                ${f.testCases.map(renderTestCase).join('')}
            </div>
        `).join('');

        el.querySelectorAll('.admin-test-case-head').forEach((head) => {
            head.addEventListener('click', () => {
                head.nextElementSibling.classList.toggle('show');
            });
        });
    }

    let featuresById = new Map();

    function renderFeaturesCatalog(features) {
        featuresById = new Map(features.map(f => [f.id, f]));
        const el = document.getElementById('featuresCatalog');
        if (!features.length) {
            el.innerHTML = '<p>No features recorded yet - use "+ Add feature" above.</p>';
            return;
        }
        el.innerHTML = features.map(f => `
            <div class="admin-feature">
                <div class="admin-feature-header">
                    <div class="admin-feature-header-text">
                        <h2>${escapeHtml(f.name)}</h2>
                        <p>${escapeHtml(f.description || '')}</p>
                        <p class="admin-test-case-meta">${escapeHtml(f.featureKey)}</p>
                    </div>
                    <div class="admin-feature-actions">
                        <button class="btn-icon-edit" data-edit-id="${f.id}" aria-label="Edit ${escapeHtml(f.name)}" type="button"><span class="material-symbols-outlined">edit</span></button>
                        <button class="btn-icon-delete" data-delete-id="${f.id}" aria-label="Delete ${escapeHtml(f.name)}" type="button"><span class="material-symbols-outlined">delete</span></button>
                    </div>
                </div>
            </div>
        `).join('');

        el.querySelectorAll('[data-edit-id]').forEach((btn) => {
            btn.addEventListener('click', () => openFeatureForm(featuresById.get(Number(btn.dataset.editId))));
        });
        el.querySelectorAll('[data-delete-id]').forEach((btn) => {
            btn.addEventListener('click', () => deleteFeature(Number(btn.dataset.deleteId)));
        });
    }

    // ========================================
    // Feature add/edit modal + delete
    // ========================================
    let editingFeatureId = null;

    function openFeatureForm(feature) {
        editingFeatureId = feature ? feature.id : null;
        document.getElementById('featureFormTitle').textContent = feature ? 'Edit feature' : 'Add feature';
        document.getElementById('featureKeyInput').value = feature ? feature.featureKey : '';
        document.getElementById('featureNameInput').value = feature ? feature.name : '';
        document.getElementById('featureDescInput').value = feature ? (feature.description || '') : '';
        document.getElementById('featureFormModal').style.display = 'flex';
        document.getElementById('featureKeyInput').focus();
    }

    function closeFeatureForm() {
        document.getElementById('featureFormModal').style.display = 'none';
        editingFeatureId = null;
    }

    async function saveFeatureForm() {
        const featureKey = document.getElementById('featureKeyInput').value.trim();
        const name = document.getElementById('featureNameInput').value.trim();
        const description = document.getElementById('featureDescInput').value.trim();

        if (!featureKey || !name) {
            showToast('Feature key and name are both required.');
            return;
        }

        const saveBtn = document.getElementById('featureFormSaveBtn');
        saveBtn.disabled = true;
        try {
            if (editingFeatureId) {
                await apiCall(`/api/admin/features/${editingFeatureId}`, 'PUT', { featureKey, name, description });
            } else {
                await apiCall('/api/admin/features', 'POST', { featureKey, name, description });
            }
            closeFeatureForm();
            await reloadFeatures();
        } catch (error) {
            showToast(error.message);
        } finally {
            saveBtn.disabled = false;
        }
    }

    // Deleting a feature only removes its links in test_case_features - a
    // test case can cover several features, so this never touches run
    // history (see server/routes/admin.js).
    function deleteFeature(id) {
        const feature = featuresById.get(id);
        showConfirmModal(
            'Delete feature',
            `Delete "${feature?.name || 'this feature'}"? This cannot be undone.`,
            async () => {
                try {
                    await apiCall(`/api/admin/features/${id}`, 'DELETE');
                    await reloadFeatures();
                    showToast('Feature deleted.', 'success');
                } catch (error) {
                    showToast(error.message);
                }
            },
            true
        );
    }

    async function reloadFeatures() {
        const featuresRes = await apiCall('/api/admin/features');
        renderFeaturesCatalog(featuresRes.features);
    }

    // ========================================
    // Test cases (flat list, all features each one covers) - ML-26's
    // "link under Release tests to see the list of test cases".
    // ========================================
    function renderTestCaseListItem(tc) {
        return `
            <div class="admin-test-case">
                <div class="admin-test-case-head">
                    <div>
                        <div class="admin-test-case-title">${escapeHtml(tc.title)}</div>
                        <div class="admin-test-case-meta">
                            ${tc.jiraTicketKey ? `<a href="https://bestbit2000.atlassian.net/browse/${encodeURIComponent(tc.jiraTicketKey)}" target="_blank" rel="noopener">${escapeHtml(tc.jiraTicketKey)}</a> &middot; ` : ''}
                            ${tc.totalRuns} run${tc.totalRuns === 1 ? '' : 's'}${tc.isActive ? '' : ' &middot; inactive'}
                        </div>
                        <div class="admin-feature-chips">
                            ${tc.features.length ? tc.features.map(f => `<span class="admin-chip">${escapeHtml(f.name)}</span>`).join('') : '<span class="admin-chip admin-chip-empty">No feature linked</span>'}
                        </div>
                    </div>
                    ${verdictBadge(tc.latestVerdict)}
                </div>
                <p class="admin-run-notes">${escapeHtml(tc.passesIfCriteria)}</p>
            </div>
        `;
    }

    function renderTestCasesList(testCases) {
        const el = document.getElementById('testCasesList');
        if (!testCases.length) {
            el.innerHTML = '<p>No test cases yet - ask Claude to add coverage for a feature (see .claude/skills/backtest).</p>';
            return;
        }
        el.innerHTML = testCases.map(renderTestCaseListItem).join('');
    }

    async function loadTestCases() {
        const el = document.getElementById('testCasesList');
        el.innerHTML = 'Loading&hellip;';
        try {
            const { testCases } = await apiCall('/api/admin/test-cases');
            renderTestCasesList(testCases);
        } catch (error) {
            el.innerHTML = `<p>Error loading data: ${escapeHtml(error.message)}</p>`;
        }
    }

    function showSection(sectionName) {
        document.querySelectorAll('.admin-nav-item[data-section]').forEach((b) => b.classList.remove('active'));
        document.querySelectorAll('.admin-section').forEach((s) => s.classList.add('hidden-group'));
        document.querySelector(`.admin-nav-item[data-section="${sectionName}"]`)?.classList.add('active');
        document.getElementById(`${sectionName}-section`).classList.remove('hidden-group');
    }

    // Section switching - "Features", "Release tests", "Accounts" and "Bands"
    // are wired up to the sidebar; "Usage" stays a disabled placeholder until
    // built. "Test cases" is a sub-view reached via a link, not the sidebar.
    function initNav() {
        document.querySelectorAll('.admin-nav-item[data-section]').forEach((btn) => {
            btn.addEventListener('click', () => showSection(btn.dataset.section));
        });
        document.getElementById('viewTestCasesLink')?.addEventListener('click', (e) => {
            e.preventDefault();
            document.querySelectorAll('.admin-section').forEach((s) => s.classList.add('hidden-group'));
            document.getElementById('test-cases-section').classList.remove('hidden-group');
            loadTestCases();
        });
        document.getElementById('backToReleaseTestsLink')?.addEventListener('click', (e) => {
            e.preventDefault();
            showSection('release-tests');
        });
    }

    function initFeatureForm() {
        document.getElementById('addFeatureBtn')?.addEventListener('click', () => openFeatureForm(null));
        document.getElementById('featureFormCancelBtn')?.addEventListener('click', closeFeatureForm);
        document.getElementById('featureFormSaveBtn')?.addEventListener('click', saveFeatureForm);
    }

    function initConfirmModal() {
        document.getElementById('adminConfirmCancelBtn')?.addEventListener('click', closeConfirmModal);
        document.getElementById('adminConfirmActionBtn')?.addEventListener('click', () => {
            const callback = confirmCallback;
            closeConfirmModal();
            if (callback) callback();
        });
    }

    // ========================================
    // Accounts (ML-77) - every account + its site-wide level. Level changes
    // save immediately on select (matches the rest of this panel's pattern of
    // no extra confirm on edit, only on delete).
    // ========================================
    const ACCOUNT_LEVELS = [
        ['super_admin', 'Super admin'],
        ['band_admin', 'Band admin'],
        ['premium_member', 'Premium member'],
        ['standard_member', 'Standard member'],
        ['beta_tester', 'Beta tester']
    ];

    function accountDisplayName(a) {
        return [a.firstName, a.surname].filter(Boolean).join(' ').trim() || a.email;
    }

    function renderAccountsList(accounts) {
        const el = document.getElementById('accountsList');
        if (!accounts.length) { el.innerHTML = '<p>No accounts yet.</p>'; return; }
        el.innerHTML = accounts.map(a => `
            <div class="admin-feature">
                <div class="admin-feature-header">
                    <div class="admin-feature-header-text">
                        <h2>${escapeHtml(accountDisplayName(a))}</h2>
                        <p>${escapeHtml(a.email)}</p>
                        <p class="admin-test-case-meta">Joined ${fmtDate(a.createdAt)}</p>
                    </div>
                    <select class="admin-level-select" data-account-id="${a.id}" aria-label="Account level for ${escapeHtml(accountDisplayName(a))}">
                        ${ACCOUNT_LEVELS.map(([value, label]) => `<option value="${value}" ${a.accountLevel === value ? 'selected' : ''}>${label}</option>`).join('')}
                    </select>
                </div>
            </div>
        `).join('');
        el.querySelectorAll('.admin-level-select').forEach((sel) => {
            sel.addEventListener('change', async () => {
                try {
                    await apiCall(`/api/admin/accounts/${sel.dataset.accountId}/level`, 'PUT', { accountLevel: sel.value });
                    showToast('Account level updated.', 'success');
                } catch (error) {
                    showToast(error.message);
                    await reloadAccounts();
                }
            });
        });
    }

    async function reloadAccounts() {
        const { accounts } = await apiCall('/api/admin/accounts');
        renderAccountsList(accounts);
    }

    // ========================================
    // Bands (ML-89) - the shared band directory. Same add/edit/delete-with-
    // shared-modal pattern as Features above.
    // ========================================
    let bandsById = new Map();

    function renderBandsList(bands) {
        bandsById = new Map(bands.map(b => [b.id, b]));
        const el = document.getElementById('bandsList');
        if (!bands.length) { el.innerHTML = '<p>No bands yet - use "+ Add band" above.</p>'; return; }
        el.innerHTML = bands.map(b => `
            <div class="admin-feature">
                <div class="admin-feature-header">
                    <div class="admin-feature-header-text">
                        <h2>${escapeHtml(b.displayName)}${b.active ? '' : ' (archived)'}</h2>
                        <p>${b.website ? `<a href="${escapeHtml(b.website)}" target="_blank" rel="noopener">${escapeHtml(b.website)}</a>` : 'No website'}</p>
                        <p class="admin-test-case-meta">${b.memberCount} member${b.memberCount === 1 ? '' : 's'}</p>
                    </div>
                    <div class="admin-feature-actions">
                        <button class="btn-icon-edit" data-edit-id="${b.id}" aria-label="Edit ${escapeHtml(b.displayName)}" type="button"><span class="material-symbols-outlined">edit</span></button>
                        <button class="btn-icon-delete" data-delete-id="${b.id}" aria-label="Delete ${escapeHtml(b.displayName)}" type="button"><span class="material-symbols-outlined">delete</span></button>
                    </div>
                </div>
            </div>
        `).join('');
        el.querySelectorAll('[data-edit-id]').forEach((btn) => {
            btn.addEventListener('click', () => openBandForm(bandsById.get(Number(btn.dataset.editId))));
        });
        el.querySelectorAll('[data-delete-id]').forEach((btn) => {
            btn.addEventListener('click', () => deleteBand(Number(btn.dataset.deleteId)));
        });
    }

    async function reloadBands() {
        const { bands } = await apiCall('/api/admin/bands');
        renderBandsList(bands);
    }

    let editingBandId = null;

    function openBandForm(band) {
        editingBandId = band ? band.id : null;
        document.getElementById('bandFormTitle').textContent = band ? 'Edit band' : 'Add band';
        document.getElementById('bandNameInput').value = band ? band.name : '';
        document.getElementById('bandWebsiteInput').value = band ? (band.website || '') : '';
        document.getElementById('bandContactEmailInput').value = band ? (band.contactEmail || '') : '';
        document.getElementById('bandFormModal').style.display = 'flex';
        document.getElementById('bandNameInput').focus();
    }

    function closeBandForm() {
        document.getElementById('bandFormModal').style.display = 'none';
        editingBandId = null;
    }

    async function saveBandForm() {
        const name = document.getElementById('bandNameInput').value.trim();
        const website = document.getElementById('bandWebsiteInput').value.trim();
        const contactEmail = document.getElementById('bandContactEmailInput').value.trim();
        if (!name) { showToast('Band name is required.'); return; }
        // Website is only required when adding (it's the sole duplicate-detection key,
        // per ML-89) - an existing band grandfathered in with no website can keep it that way.
        if (!editingBandId && !website) { showToast('A website is required so new bands can be checked for duplicates.'); return; }

        const saveBtn = document.getElementById('bandFormSaveBtn');
        saveBtn.disabled = true;
        try {
            if (editingBandId) {
                await apiCall(`/api/admin/bands/${editingBandId}`, 'PUT', { name, website, contactEmail });
            } else {
                await apiCall('/api/admin/bands', 'POST', { name, website });
            }
            closeBandForm();
            await reloadBands();
            showToast('Band saved.', 'success');
        } catch (error) {
            showToast(error.message);
        } finally {
            saveBtn.disabled = false;
        }
    }

    // Archived rather than deleted outright if still in use (real members or
    // session history) - server decides which, see deleteOrArchiveBandAdmin.
    function deleteBand(id) {
        const band = bandsById.get(id);
        showConfirmModal(
            'Delete band',
            `Delete "${band?.displayName || 'this band'}"? A band still in use is archived instead of removed.`,
            async () => {
                try {
                    const result = await apiCall(`/api/admin/bands/${id}`, 'DELETE');
                    await reloadBands();
                    showToast(result.message, 'success');
                } catch (error) {
                    showToast(error.message);
                }
            },
            true
        );
    }

    function initBandForm() {
        document.getElementById('addBandBtn')?.addEventListener('click', () => openBandForm(null));
        document.getElementById('bandFormCancelBtn')?.addEventListener('click', closeBandForm);
        document.getElementById('bandFormSaveBtn')?.addEventListener('click', saveBandForm);
    }

    async function load() {
        initNav();
        initFeatureForm();
        initConfirmModal();
        initBandForm();
        document.getElementById('adminShell').classList.remove('hidden-group');
        try {
            const [backtest, featuresRes] = await Promise.all([
                apiCall('/api/admin/backtest'),
                apiCall('/api/admin/features')
            ]);
            renderSummary(backtest);
            renderFeatures(backtest);
            renderFeaturesCatalog(featuresRes.features);
            await Promise.all([reloadAccounts(), reloadBands()]);
        } catch (error) {
            document.getElementById('featuresCatalog').innerHTML = `<p>Error loading data: ${escapeHtml(error.message)}</p>`;
            document.getElementById('featureList').innerHTML = `<p>Error loading data: ${escapeHtml(error.message)}</p>`;
        }
    }

    // ML-77: the admin panel is now gated to Super admins - checked via the
    // regular (non-admin-gated) /api/account endpoint before loading anything
    // admin-only, since a non-super-admin's requests to /api/admin/* would
    // otherwise just 403 one at a time with no clear explanation.
    async function checkAccessAndLoad() {
        try {
            const profile = await apiCall('/api/account');
            if (profile.accountLevel !== 'super_admin') {
                document.getElementById('notAuthorizedNotice').classList.remove('hidden-group');
                return;
            }
            await load();
        } catch (error) {
            document.getElementById('loggedOutNotice').classList.remove('hidden-group');
        }
    }

    checkAccessAndLoad();
})();
