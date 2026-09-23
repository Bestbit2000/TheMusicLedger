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
                        <h2>${escapeHtml(f.name)}${f.enabled ? '' : ' (disabled)'}</h2>
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
        document.getElementById('featureEnabledInput').checked = feature ? feature.enabled : true;
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
        const enabled = document.getElementById('featureEnabledInput').checked;

        if (!featureKey || !name) {
            showToast('Feature key and name are both required.');
            return;
        }

        const saveBtn = document.getElementById('featureFormSaveBtn');
        saveBtn.disabled = true;
        try {
            if (editingFeatureId) {
                await apiCall(`/api/admin/features/${editingFeatureId}`, 'PUT', { featureKey, name, description, enabled });
            } else {
                await apiCall('/api/admin/features', 'POST', { featureKey, name, description, enabled });
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

    // Section switching - all sidebar items ("Features", "Release tests",
    // "Accounts", "Bands", "Metadata lists", "Usage") toggle a section by
    // data-section. "Test cases" is a sub-view reached via a link, not the sidebar.
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

    // ========================================
    // Metadata lists (ML-109) - Durations, Time signatures, Note values (read-only),
    // Playback speeds. One inner sub-tab row inside the Metadata lists section.
    // ========================================
    // Scoped to the clicked button's own .admin-section - Metadata lists and Usage each have their
    // own independent row of sub-tabs, and without scoping, switching one section's sub-tab would
    // also deactivate/hide the other section's (both live in the DOM at once, only their top-level
    // .admin-section is toggled) - leaving it with nothing active/visible on next visit.
    function initAdminSubtabs() {
        document.querySelectorAll('.admin-subtab-item[data-subtab]').forEach((btn) => {
            btn.addEventListener('click', () => {
                const scope = btn.closest('.admin-section') || document;
                scope.querySelectorAll('.admin-subtab-item[data-subtab]').forEach((b) => b.classList.remove('active'));
                scope.querySelectorAll('.admin-subtab-panel').forEach((p) => p.classList.add('hidden-group'));
                btn.classList.add('active');
                document.getElementById(`${btn.dataset.subtab}-subtab`).classList.remove('hidden-group');
            });
        });
    }

    // ---- Durations ----
    let durationsById = new Map();
    function renderDurationsList(durations) {
        durationsById = new Map(durations.map(d => [d.id, d]));
        const el = document.getElementById('durationsList');
        if (!durations.length) { el.innerHTML = '<p>No durations yet - use "+ Add duration" above.</p>'; return; }
        el.innerHTML = durations.map(d => `
            <div class="admin-feature">
                <div class="admin-feature-header">
                    <div class="admin-feature-header-text">
                        <h2>${d.minutes} minutes${d.active ? '' : ' (inactive)'}</h2>
                    </div>
                    <div class="admin-feature-actions">
                        <button class="btn-icon-edit" data-edit-id="${d.id}" aria-label="Edit ${d.minutes} minutes" type="button"><span class="material-symbols-outlined">edit</span></button>
                        <button class="btn-icon-delete" data-delete-id="${d.id}" aria-label="Delete ${d.minutes} minutes" type="button"><span class="material-symbols-outlined">delete</span></button>
                    </div>
                </div>
            </div>
        `).join('');
        el.querySelectorAll('[data-edit-id]').forEach((btn) => {
            btn.addEventListener('click', () => openDurationForm(durationsById.get(Number(btn.dataset.editId))));
        });
        el.querySelectorAll('[data-delete-id]').forEach((btn) => {
            btn.addEventListener('click', () => deleteDuration(Number(btn.dataset.deleteId)));
        });
    }
    async function reloadDurations() {
        const { durations } = await apiCall('/api/admin/durations');
        renderDurationsList(durations);
    }
    let editingDurationId = null;
    function openDurationForm(duration) {
        editingDurationId = duration ? duration.id : null;
        document.getElementById('durationFormTitle').textContent = duration ? 'Edit duration' : 'Add duration';
        document.getElementById('durationMinutesInput').value = duration ? duration.minutes : '';
        document.getElementById('durationActiveInput').checked = duration ? duration.active : true;
        document.getElementById('durationActiveRow').classList.toggle('hidden-group', !duration);
        document.getElementById('durationFormModal').style.display = 'flex';
        document.getElementById('durationMinutesInput').focus();
    }
    function closeDurationForm() {
        document.getElementById('durationFormModal').style.display = 'none';
        editingDurationId = null;
    }
    async function saveDurationForm() {
        const minutes = document.getElementById('durationMinutesInput').value;
        const active = document.getElementById('durationActiveInput').checked;
        const saveBtn = document.getElementById('durationFormSaveBtn');
        saveBtn.disabled = true;
        try {
            if (editingDurationId) {
                const d = durationsById.get(editingDurationId);
                await apiCall(`/api/admin/durations/${editingDurationId}`, 'PUT', { minutes, sortOrder: d.sortOrder, active });
            } else {
                await apiCall('/api/admin/durations', 'POST', { minutes });
            }
            closeDurationForm();
            await reloadDurations();
            showToast('Duration saved.', 'success');
        } catch (error) {
            showToast(error.message);
        } finally {
            saveBtn.disabled = false;
        }
    }
    function deleteDuration(id) {
        const d = durationsById.get(id);
        showConfirmModal('Delete duration', `Delete "${d?.minutes} minutes"?`, async () => {
            try {
                await apiCall(`/api/admin/durations/${id}`, 'DELETE');
                await reloadDurations();
                showToast('Duration deleted.', 'success');
            } catch (error) {
                showToast(error.message);
            }
        }, true);
    }
    function initDurationForm() {
        document.getElementById('addDurationBtn')?.addEventListener('click', () => openDurationForm(null));
        document.getElementById('durationFormCancelBtn')?.addEventListener('click', closeDurationForm);
        document.getElementById('durationFormSaveBtn')?.addEventListener('click', saveDurationForm);
    }

    // ---- Time signatures ----
    let timeSigsById = new Map();
    function renderTimeSigsList(timeSigs) {
        timeSigsById = new Map(timeSigs.map(t => [t.id, t]));
        const el = document.getElementById('timeSigsList');
        if (!timeSigs.length) { el.innerHTML = '<p>No time signatures yet - use "+ Add time signature" above.</p>'; return; }
        el.innerHTML = timeSigs.map(t => `
            <div class="admin-feature">
                <div class="admin-feature-header">
                    <div class="admin-feature-header-text">
                        <h2>${escapeHtml(t.label)}${t.active ? '' : ' (archived)'}</h2>
                        <p class="admin-test-case-meta">${t.usageCount} block${t.usageCount === 1 ? '' : 's'} using it</p>
                    </div>
                    <div class="admin-feature-actions">
                        <button class="btn-icon-edit" data-edit-id="${t.id}" aria-label="Edit ${escapeHtml(t.label)}" type="button"><span class="material-symbols-outlined">edit</span></button>
                        <button class="btn-icon-delete" data-delete-id="${t.id}" aria-label="Delete ${escapeHtml(t.label)}" type="button"><span class="material-symbols-outlined">delete</span></button>
                    </div>
                </div>
            </div>
        `).join('');
        el.querySelectorAll('[data-edit-id]').forEach((btn) => {
            btn.addEventListener('click', () => openTimeSigForm(timeSigsById.get(Number(btn.dataset.editId))));
        });
        el.querySelectorAll('[data-delete-id]').forEach((btn) => {
            btn.addEventListener('click', () => deleteTimeSig(Number(btn.dataset.deleteId)));
        });
    }
    async function reloadTimeSigs() {
        const { timeSignatures } = await apiCall('/api/admin/time-signatures');
        renderTimeSigsList(timeSignatures);
    }
    let editingTimeSigId = null;
    function openTimeSigForm(timeSig) {
        editingTimeSigId = timeSig ? timeSig.id : null;
        document.getElementById('timeSigFormTitle').textContent = timeSig ? 'Edit time signature' : 'Add time signature';
        document.getElementById('timeSigNumeratorInput').value = timeSig ? timeSig.numerator : '';
        document.getElementById('timeSigDenominatorInput').value = timeSig ? timeSig.denominator : '';
        document.getElementById('timeSigLabelInput').value = timeSig ? timeSig.label : '';
        document.getElementById('timeSigActiveInput').checked = timeSig ? timeSig.active : true;
        document.getElementById('timeSigActiveRow').classList.toggle('hidden-group', !timeSig);
        document.getElementById('timeSigFormModal').style.display = 'flex';
        document.getElementById('timeSigNumeratorInput').focus();
    }
    function closeTimeSigForm() {
        document.getElementById('timeSigFormModal').style.display = 'none';
        editingTimeSigId = null;
    }
    async function saveTimeSigForm() {
        const numerator = document.getElementById('timeSigNumeratorInput').value;
        const denominator = document.getElementById('timeSigDenominatorInput').value;
        const label = document.getElementById('timeSigLabelInput').value.trim() || `${numerator}/${denominator}`;
        const active = document.getElementById('timeSigActiveInput').checked;
        const saveBtn = document.getElementById('timeSigFormSaveBtn');
        saveBtn.disabled = true;
        try {
            if (editingTimeSigId) {
                const t = timeSigsById.get(editingTimeSigId);
                await apiCall(`/api/admin/time-signatures/${editingTimeSigId}`, 'PUT', { numerator, denominator, label, sortOrder: t.sortOrder, active });
            } else {
                await apiCall('/api/admin/time-signatures', 'POST', { numerator, denominator, label });
            }
            closeTimeSigForm();
            await reloadTimeSigs();
            showToast('Time signature saved.', 'success');
        } catch (error) {
            showToast(error.message);
        } finally {
            saveBtn.disabled = false;
        }
    }
    function deleteTimeSig(id) {
        const t = timeSigsById.get(id);
        showConfirmModal('Delete time signature', `Delete "${t?.label}"? A signature still in use is archived instead of removed.`, async () => {
            try {
                const result = await apiCall(`/api/admin/time-signatures/${id}`, 'DELETE');
                await reloadTimeSigs();
                showToast(result.message, 'success');
            } catch (error) {
                showToast(error.message);
            }
        }, true);
    }
    function initTimeSigForm() {
        document.getElementById('addTimeSigBtn')?.addEventListener('click', () => openTimeSigForm(null));
        document.getElementById('timeSigFormCancelBtn')?.addEventListener('click', closeTimeSigForm);
        document.getElementById('timeSigFormSaveBtn')?.addEventListener('click', saveTimeSigForm);
    }

    // ---- Usage (ML-109 follow-up) - stats-only, no add/edit/delete on either of these. ----
    function renderNoteValuesList(noteValues) {
        const el = document.getElementById('noteValuesList');
        el.innerHTML = noteValues.map(n => `
            <div class="admin-feature">
                <div class="admin-feature-header">
                    <div class="admin-feature-header-text">
                        <h2>${escapeHtml(n.label)}</h2>
                        <p class="admin-test-case-meta">${n.usageCount} block${n.usageCount === 1 ? '' : 's'} using it</p>
                    </div>
                </div>
            </div>
        `).join('');
    }
    async function reloadNoteValues() {
        const { noteValues } = await apiCall('/api/admin/usage/note-values');
        renderNoteValuesList(noteValues);
    }

    function renderDurationUsageList(durationUsage) {
        const el = document.getElementById('usageDurationsList');
        el.innerHTML = durationUsage.map(d => `
            <div class="admin-feature">
                <div class="admin-feature-header">
                    <div class="admin-feature-header-text">
                        <h2>${d.minutes} minutes</h2>
                        <p class="admin-test-case-meta">${d.usageCount} session${d.usageCount === 1 ? '' : 's'}</p>
                    </div>
                </div>
            </div>
        `).join('');
    }
    async function reloadDurationUsage() {
        const { durationUsage } = await apiCall('/api/admin/usage/durations');
        renderDurationUsageList(durationUsage);
    }

    // ---- Flow authoring time (ML-199) - the baseline for how long building a Flow by hand takes.
    // Every table here shows median first with min-max beside it, never a bare mean: at baseline
    // sample sizes a single interrupted run moves a mean visibly, and a wide min-max is the signal
    // that the median isn't describing anything stable yet. See server/services/flowAuthoringStats.js
    // for what counts as eligible/stale and why per-bar is blank on edit rows. ----

    // Seconds are the storage unit but not a readable one past a minute or so - a bare "847" is
    // hard to feel, "14m 7s" isn't. Sub-minute values stay in seconds rather than becoming "0m 42s".
    function fmtSeconds(s) {
        if (s === null || s === undefined) return '–';
        if (s < 60) return `${s}s`;
        const m = Math.floor(s / 60);
        const rem = Math.round(s % 60);
        return rem ? `${m}m ${rem}s` : `${m}m`;
    }
    // Per-bar/per-block figures stay in raw seconds with one decimal: they're small numbers where
    // the decimal is the whole signal (4.2s vs 4.9s per bar is a real difference worth seeing).
    function fmtRate(v) {
        return (v === null || v === undefined) ? '–' : `${v}s`;
    }
    function fmtSpread(min, max, fmt) {
        if (min === null || min === undefined || max === null || max === undefined) return '–';
        return `${fmt(min)} – ${fmt(max)}`;
    }

    // One <td> trio per measure: median, then the min-max spread beneath it in the same cell, so a
    // reader can't pick up the headline number without also seeing how much it's moving around.
    function statCells(s) {
        return `
            <td>${s.n}</td>
            <td>${fmtSeconds(s.active.median)}<div class="admin-stat-tile-sub">${fmtSpread(s.active.min, s.active.max, fmtSeconds)}</div></td>
            <td>${fmtSeconds(s.bars.median)}<div class="admin-stat-tile-sub">${fmtSpread(s.bars.min, s.bars.max, fmtSeconds)}</div></td>
            <td>${fmtRate(s.perBar.median)}<div class="admin-stat-tile-sub">${fmtSpread(s.perBar.min, s.perBar.max, fmtRate)}</div></td>
            <td>${fmtRate(s.perBlock.median)}<div class="admin-stat-tile-sub">${fmtSpread(s.perBlock.min, s.perBlock.max, fmtRate)}</div></td>
            <td>${s.meanBars ?? '–'}</td>`;
    }
    const STAT_HEADERS = `
        <th>Runs</th><th>Active time</th><th>Bars time</th><th>Per bar</th><th>Per block</th><th>Avg bars</th>`;

    function statTable(title, rows, firstColHeader, firstColFn, note) {
        const body = rows.length
            ? rows.map(r => `<tr><td>${escapeHtml(String(firstColFn(r)))}</td>${statCells(r)}</tr>`).join('')
            : `<tr><td colspan="7" class="admin-stat-empty">No completed sessions yet.</td></tr>`;
        return `
            <div class="admin-stat-section-title">${escapeHtml(title)}</div>
            ${note ? `<p class="admin-intro">${note}</p>` : ''}
            <div class="admin-stat-table-wrap">
                <table class="admin-stat-table">
                    <thead><tr><th>${escapeHtml(firstColHeader)}</th>${STAT_HEADERS}</tr></thead>
                    <tbody>${body}</tbody>
                </table>
            </div>`;
    }

    function renderFlowAuthoringStats(data) {
        const el = document.getElementById('flowAuthoringStats');
        const h = data.headline;
        const o = data.outcomes;

        if (!h.n) {
            el.innerHTML = `<p class="admin-stat-empty">No completed manual Flow builds recorded yet.${
                o.live || o.stale ? ` (${o.live} in progress, ${o.stale} never finished.)` : ''
            } Build a Flow from &ldquo;Create your own&rdquo; through to Open player and it'll appear here.</p>`;
            return;
        }

        const tiles = `
            <div class="admin-stat-tiles">
                <div class="admin-stat-tile">
                    <div class="admin-stat-tile-label">Median time per flow</div>
                    <div class="admin-stat-tile-value">${fmtSeconds(h.active.median)}</div>
                    <div class="admin-stat-tile-sub">${fmtSpread(h.active.min, h.active.max, fmtSeconds)} &bull; ${h.n} run${h.n === 1 ? '' : 's'}</div>
                </div>
                <div class="admin-stat-tile">
                    <div class="admin-stat-tile-label">Median on the Bars tab</div>
                    <div class="admin-stat-tile-value">${fmtSeconds(h.bars.median)}</div>
                    <div class="admin-stat-tile-sub">${fmtSpread(h.bars.min, h.bars.max, fmtSeconds)}</div>
                </div>
                <div class="admin-stat-tile">
                    <div class="admin-stat-tile-label">Median per bar</div>
                    <div class="admin-stat-tile-value">${fmtRate(h.perBar.median)}</div>
                    <div class="admin-stat-tile-sub">${fmtSpread(h.perBar.min, h.perBar.max, fmtRate)}</div>
                </div>
                <div class="admin-stat-tile">
                    <div class="admin-stat-tile-label">Median per block</div>
                    <div class="admin-stat-tile-value">${fmtRate(h.perBlock.median)}</div>
                    <div class="admin-stat-tile-sub">${fmtSpread(h.perBlock.min, h.perBlock.max, fmtRate)}</div>
                </div>
            </div>
            <p class="admin-intro">Mean time per flow is ${fmtSeconds(h.active.mean)} against a median of ${fmtSeconds(h.active.median)}${
                h.active.mean > h.active.median * 1.3
                    ? ' &ndash; the mean sitting well above the median means at least one long run is pulling it up, so trust the median.'
                    : '.'
            } Raw wall clock (idle included) has a median of ${fmtSeconds(h.medianElapsedSeconds)}. Outcomes: ${o.completed} completed, ${o.abandoned} abandoned, ${o.stale} never finished${
                o.live ? `, ${o.live} in progress` : ''
            }${o.excluded ? `, ${o.excluded} excluded from these figures` : ''}${
                o.abandonRate !== null ? ` &ndash; a ${o.abandonRate}% abandonment rate` : ''
            }.</p>`;

        const recentRows = data.recent.length
            ? data.recent.map(r => `
                <tr class="${r.isExcluded ? 'admin-stat-row-excluded' : ''}">
                    <td>${escapeHtml(r.flowTitle || 'Untitled')}${r.flowDeleted ? ' <span class="admin-stat-pill">deleted</span>' : ''}</td>
                    <td>${escapeHtml(r.email)}</td>
                    <td>${r.kind}${r.creationSource === 'from_file' ? ' (import)' : ''}</td>
                    <td>${r.outcome}</td>
                    <td>${fmtSeconds(r.activeSeconds)}</td>
                    <td>${fmtSeconds(r.barsActiveSeconds)}</td>
                    <td>${r.totalBarsEnd}</td>
                    <td>${r.blockCountEnd}</td>
                    <td>+${r.blocksAdded}/~${r.blocksEdited}/-${r.blocksDeleted}</td>
                    <td>${escapeHtml(r.deviceKind || '–')}</td>
                    <td>${escapeHtml(r.appVersion || '–')}</td>
                    <td><button class="admin-stat-exclude-btn" data-exclude-id="${r.id}" data-excluded="${r.isExcluded}" type="button">${r.isExcluded ? 'Include' : 'Exclude'}</button></td>
                </tr>`).join('')
            : `<tr><td colspan="12" class="admin-stat-empty">Nothing recorded yet.</td></tr>`;

        el.innerHTML = `
            ${tiles}
            ${statTable('By app version', data.byVersion, 'Version', r => r.appVersion || 'unknown',
                'The before/after comparison. Cut a release, keep building flows the same way, and compare the rows &ndash; anything else (a different device, a much longer piece) is a confound, which is what the two tables below are for.')}
            ${statTable('Create vs edit', data.byKind, 'Session', r => `${r.kind}${r.creationSource === 'from_file' ? ' (import)' : ''}`,
                'Initial creation against later editing stints, per ML-199. Per bar is blank for edits &ndash; see the note above.')}
            ${statTable('By length of music', data.bySize, 'Flow length', r => r.bucket,
                'Whether a longer piece costs proportionally more or there&rsquo;s a fixed overhead. If per-bar holds steady across the buckets, the cost is genuinely per bar and the redesign should attack bar entry; if it falls as flows get longer, the overhead is in the setup around it.')}
            ${statTable('By device', data.byDevice, 'Device', r => r.deviceKind,
                'Thumbing a phone and typing on a desktop are different activities &ndash; worth checking a change in the headline figure isn&rsquo;t just a change in which device was used.')}
            <div class="admin-stat-section-title">Recent sessions</div>
            <p class="admin-intro">The raw runs behind the figures above, newest first (100 max), so a surprising median can be traced to the run that caused it. Bar changes are shown as added/edited/deleted. Excluding a run drops it from every statistic above but keeps the row &ndash; use it for a run you know was interrupted, not one you simply dislike. A session with no heartbeat for ${data.staleAfterMinutes} minutes counts as abandoned.</p>
            <div class="admin-stat-table-wrap">
                <table class="admin-stat-table">
                    <thead><tr>
                        <th>Flow</th><th>Who</th><th>Type</th><th>Outcome</th><th>Active</th><th>Bars time</th>
                        <th>Bars</th><th>Blocks</th><th>Changes</th><th>Device</th><th>Version</th><th></th>
                    </tr></thead>
                    <tbody>${recentRows}</tbody>
                </table>
            </div>`;

        el.querySelectorAll('[data-exclude-id]').forEach(btn => {
            btn.addEventListener('click', async () => {
                const id = btn.dataset.excludeId;
                const nowExcluded = btn.dataset.excluded !== 'true';
                try {
                    await apiCall(`/api/admin/usage/flow-authoring/${id}/excluded`, 'PUT', {
                        isExcluded: nowExcluded,
                        reason: nowExcluded ? 'Excluded from the admin panel' : null
                    });
                    await reloadFlowAuthoring();
                } catch (error) {
                    showToast(error.message);
                }
            });
        });
    }

    async function reloadFlowAuthoring() {
        renderFlowAuthoringStats(await apiCall('/api/admin/usage/flow-authoring'));
    }

    // ---- Feedback triage (ML-170). Filtering is server-side (see listFeedbackForAdmin): the list
    // only grows, and the counts must be over everything rather than over the current filter, or
    // "3 untriaged" would vanish the moment you filtered to something else. ----
    const FEEDBACK_STATUS_LABELS = {
        under_review: 'Under review', planned: 'Planned', in_progress: 'In progress',
        not_progressing: 'Not progressing', resolved: 'Resolved'
    };
    const FEEDBACK_CATEGORY_LABELS = { bug: 'Bug', suggestion: 'Suggestion', comment: 'Comment' };

    let feedbackFilterStatus = 'all';
    let feedbackFilterCategory = 'all';
    let feedbackById = new Map();
    let editingFeedbackId = null;

    function formatFeedbackDate(iso) {
        const d = new Date(iso);
        const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
        return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}, ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
    }
    // Enough to recognise an entry without opening it; the row is a handle, not the content.
    function feedbackSnippet(message) {
        const flat = message.replace(/\s+/g, ' ').trim();
        return flat.length > 140 ? `${flat.slice(0, 140)}…` : flat;
    }

    function renderFeedbackList(data) {
        const el = document.getElementById('feedbackList');
        feedbackById = new Map(data.feedback.map(f => [f.id, f]));

        // The untriaged count on the sidebar item, so a waiting item is visible without opening the
        // tab at all - hidden entirely at zero rather than showing a "0" badge that reads as a
        // notification when there's nothing to notify about.
        const navCount = document.getElementById('feedbackNavCount');
        if (navCount) {
            navCount.innerText = String(data.counts.untriaged);
            navCount.classList.toggle('hidden-group', !data.counts.untriaged);
        }

        if (!data.feedback.length) {
            el.innerHTML = data.counts.total
                ? '<p>Nothing matches these filters.</p>'
                : '<p>No feedback yet. It arrives here from the app\'s hamburger menu &rarr; Send feedback.</p>';
            return;
        }

        el.innerHTML = data.feedback.map(f => `
            <div class="admin-feature" data-feedback-row="${f.id}" style="cursor:pointer;">
                <div class="admin-feature-header">
                    <div class="admin-feature-header-text">
                        <h2>${escapeHtml(f.email)}</h2>
                        <p class="admin-test-case-meta">${escapeHtml(formatFeedbackDate(f.createdAt))}${
                            f.route ? ` &bull; ${escapeHtml(f.route)}` : ''
                        }${f.appVersion ? ` &bull; v${escapeHtml(f.appVersion)}` : ''}${
                            f.deviceKind ? ` &bull; ${escapeHtml(f.deviceKind)}` : ''
                        }</p>
                        <p class="admin-feedback-snippet">${escapeHtml(feedbackSnippet(f.message))}</p>
                        <div class="admin-feedback-badges">
                            <span class="admin-feedback-badge status-${f.status}">${escapeHtml(FEEDBACK_STATUS_LABELS[f.status] || f.status)}</span>
                            <span class="admin-feedback-badge cat">${f.category ? escapeHtml(FEEDBACK_CATEGORY_LABELS[f.category]) : 'Untriaged'}</span>
                            ${f.adminResponse ? '<span class="admin-feedback-badge cat">Replied</span>' : ''}
                        </div>
                    </div>
                </div>
            </div>
        `).join('');

        el.querySelectorAll('[data-feedback-row]').forEach(row => {
            row.addEventListener('click', () => openFeedbackReview(Number(row.dataset.feedbackRow)));
        });
    }

    function openFeedbackReview(id) {
        const f = feedbackById.get(id);
        if (!f) return;
        editingFeedbackId = id;
        document.getElementById('feedbackReviewMeta').innerText =
            `${f.email} • ${formatFeedbackDate(f.createdAt)}`;
        // innerText, not innerHTML - this is somebody else's prose going onto an admin page, and the
        // CSS (.admin-feedback-message, white-space: pre-wrap) already preserves its line breaks.
        document.getElementById('feedbackReviewMessage').innerText = f.message;
        document.getElementById('feedbackReviewContext').innerText = [
            f.route ? `Screen: ${f.route}` : null,
            f.appVersion ? `Version: ${f.appVersion}` : null,
            f.deviceKind ? `Device: ${f.deviceKind}` : null,
            f.userAgent ? `UA: ${f.userAgent}` : null,
            f.updatedAt !== f.createdAt ? `Last reviewed: ${formatFeedbackDate(f.updatedAt)}` : null
        ].filter(Boolean).join('\n');
        document.getElementById('feedbackReviewCategory').value = f.category || '';
        document.getElementById('feedbackReviewStatus').value = f.status;
        document.getElementById('feedbackReviewResponse').value = f.adminResponse || '';
        document.getElementById('feedbackReviewModal').style.display = 'flex';
    }
    function closeFeedbackReview() {
        document.getElementById('feedbackReviewModal').style.display = 'none';
        editingFeedbackId = null;
    }

    async function saveFeedbackReview() {
        if (editingFeedbackId === null) return;
        const btn = document.getElementById('feedbackReviewSaveBtn');
        btn.disabled = true;
        btn.innerText = 'Saving...';
        try {
            await apiCall(`/api/admin/feedback/${editingFeedbackId}`, 'PUT', {
                // '' is a real value here (back to untriaged), so it's sent as null rather than
                // omitted - omitting would mean "leave it alone", which is a different intent.
                category: document.getElementById('feedbackReviewCategory').value || null,
                status: document.getElementById('feedbackReviewStatus').value,
                adminResponse: document.getElementById('feedbackReviewResponse').value
            });
            closeFeedbackReview();
            await reloadFeedback();
            showToast('Feedback updated', 'success');
        } catch (error) {
            showToast(error.message);
        } finally {
            btn.disabled = false;
            btn.innerText = 'Save';
        }
    }

    function initFeedback() {
        document.querySelectorAll('[data-feedback-status]').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('[data-feedback-status]').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                feedbackFilterStatus = btn.dataset.feedbackStatus;
                reloadFeedback().catch(e => showToast(e.message));
            });
        });
        document.querySelectorAll('[data-feedback-category]').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('[data-feedback-category]').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                feedbackFilterCategory = btn.dataset.feedbackCategory;
                reloadFeedback().catch(e => showToast(e.message));
            });
        });
        document.getElementById('feedbackReviewCancelBtn')?.addEventListener('click', closeFeedbackReview);
        document.getElementById('feedbackReviewSaveBtn')?.addEventListener('click', saveFeedbackReview);
    }

    async function reloadFeedback() {
        const params = new URLSearchParams({ status: feedbackFilterStatus, category: feedbackFilterCategory });
        renderFeedbackList(await apiCall(`/api/admin/feedback?${params}`));
    }

    // ---- App config (ML-47) - small admin-editable settings, e.g. the PostHog dashboard link,
    // stored in the app_config table so they can change without a release. Generic by key so
    // every other config value (the Flow defaults below included) reuses this one modal rather
    // than each getting its own. `label` sets the input's own field label (not just the modal
    // title) - "URL" was hardcoded here before this was still a one-off. `reloadFn` is called
    // after a successful save so each field's own display text refreshes itself. ----
    let editingConfigKey = null;
    let editingConfigReload = null;

    function openConfigForm(key, title, currentValue, label, reloadFn) {
        editingConfigKey = key;
        editingConfigReload = reloadFn;
        document.getElementById('configFormTitle').textContent = title;
        document.getElementById('configValueLabel').textContent = label;
        document.getElementById('configValueInput').value = currentValue || '';
        document.getElementById('configFormModal').style.display = 'flex';
        document.getElementById('configValueInput').focus();
    }

    function closeConfigForm() {
        document.getElementById('configFormModal').style.display = 'none';
        editingConfigKey = null;
        editingConfigReload = null;
    }

    async function saveConfigForm() {
        const value = document.getElementById('configValueInput').value.trim();
        const saveBtn = document.getElementById('configFormSaveBtn');
        saveBtn.disabled = true;
        try {
            await apiCall(`/api/admin/config/${editingConfigKey}`, 'PUT', { value });
            const reloadFn = editingConfigReload;
            closeConfigForm();
            if (reloadFn) await reloadFn();
        } catch (error) {
            showToast(error.message);
        } finally {
            saveBtn.disabled = false;
        }
    }

    function initConfigForm() {
        document.getElementById('editPosthogLinkBtn')?.addEventListener('click', () =>
            openConfigForm('posthog_dashboard_url', 'Edit PostHog dashboard link', lastPosthogLinkValue, 'URL', reloadPosthogLink));
        document.getElementById('editFlowDefaultNameBtn')?.addEventListener('click', () =>
            openConfigForm('flow_default_name', 'Edit default flow name', lastFlowDefaultName, 'Default name', reloadFlowDefaultName));
        document.getElementById('editFlowDefaultTimeSigBtn')?.addEventListener('click', () =>
            openConfigForm('flow_default_time_signature', 'Edit default time signature', lastFlowDefaultTimeSig, 'Time signature label (e.g. 4/4)', reloadFlowDefaultTimeSig));
        document.getElementById('editFlowDefaultBpmBtn')?.addEventListener('click', () =>
            openConfigForm('flow_default_bpm', 'Edit default bpm', lastFlowDefaultBpm, 'BPM', reloadFlowDefaultBpm));
        document.getElementById('editFlowDefaultBarCountBtn')?.addEventListener('click', () =>
            openConfigForm('flow_default_bar_count', 'Edit default bar count', lastFlowDefaultBarCount, 'Bar count', reloadFlowDefaultBarCount));
        document.getElementById('editFlowDefaultNoteValueBtn')?.addEventListener('click', () =>
            openConfigForm('flow_default_note_value', 'Edit default note value', lastFlowDefaultNoteValue, 'Note value', reloadFlowDefaultNoteValue));
        document.getElementById('configFormCancelBtn')?.addEventListener('click', closeConfigForm);
        document.getElementById('configFormSaveBtn')?.addEventListener('click', saveConfigForm);
    }

    let lastPosthogLinkValue = '';
    async function reloadPosthogLink() {
        const { value } = await apiCall('/api/admin/config/posthog_dashboard_url');
        lastPosthogLinkValue = value || '';
        const el = document.getElementById('posthogLinkText');
        el.innerHTML = lastPosthogLinkValue
            ? `<a href="${escapeHtml(lastPosthogLinkValue)}" target="_blank" rel="noopener">${escapeHtml(lastPosthogLinkValue)}</a>`
            : 'Not set.';
    }

    // ---- Flow defaults (ML-179 follow-up) - a brand new flow's first block, see
    // getFlowDefaultBlockSettings on the server for the fallback values used if any of these are
    // missing or don't resolve (e.g. a time signature label that no longer matches the catalog).
    // Default name is a separate concern (getUniqueDefaultFlowName) - it can collide with an
    // existing personal flow, where the others can't, so it gets its own resolution logic there. ----
    let lastFlowDefaultName = '';
    async function reloadFlowDefaultName() {
        const { value } = await apiCall('/api/admin/config/flow_default_name');
        lastFlowDefaultName = value || '';
        document.getElementById('flowDefaultNameText').textContent = lastFlowDefaultName || 'Not set.';
    }
    let lastFlowDefaultTimeSig = '';
    let lastFlowDefaultBpm = '';
    let lastFlowDefaultBarCount = '';
    let lastFlowDefaultNoteValue = '';
    async function reloadFlowDefaultTimeSig() {
        const { value } = await apiCall('/api/admin/config/flow_default_time_signature');
        lastFlowDefaultTimeSig = value || '';
        document.getElementById('flowDefaultTimeSigText').textContent = lastFlowDefaultTimeSig || 'Not set.';
    }
    async function reloadFlowDefaultBpm() {
        const { value } = await apiCall('/api/admin/config/flow_default_bpm');
        lastFlowDefaultBpm = value || '';
        document.getElementById('flowDefaultBpmText').textContent = lastFlowDefaultBpm || 'Not set.';
    }
    async function reloadFlowDefaultBarCount() {
        const { value } = await apiCall('/api/admin/config/flow_default_bar_count');
        lastFlowDefaultBarCount = value || '';
        document.getElementById('flowDefaultBarCountText').textContent = lastFlowDefaultBarCount || 'Not set.';
    }
    async function reloadFlowDefaultNoteValue() {
        const { value } = await apiCall('/api/admin/config/flow_default_note_value');
        lastFlowDefaultNoteValue = value || '';
        document.getElementById('flowDefaultNoteValueText').textContent = lastFlowDefaultNoteValue || 'Not set.';
    }

    // ---- Playback speeds ----
    let speedsById = new Map();
    function renderSpeedsList(speeds) {
        speedsById = new Map(speeds.map(s => [s.id, s]));
        const el = document.getElementById('speedsList');
        if (!speeds.length) { el.innerHTML = '<p>No playback speeds yet - use "+ Add playback speed" above.</p>'; return; }
        el.innerHTML = speeds.map(s => `
            <div class="admin-feature">
                <div class="admin-feature-header">
                    <div class="admin-feature-header-text">
                        <h2>${s.percent}%${s.active ? '' : ' (inactive)'}</h2>
                    </div>
                    <div class="admin-feature-actions">
                        <button class="btn-icon-edit" data-edit-id="${s.id}" aria-label="Edit ${s.percent}%" type="button"><span class="material-symbols-outlined">edit</span></button>
                        <button class="btn-icon-delete" data-delete-id="${s.id}" aria-label="Delete ${s.percent}%" type="button"><span class="material-symbols-outlined">delete</span></button>
                    </div>
                </div>
            </div>
        `).join('');
        el.querySelectorAll('[data-edit-id]').forEach((btn) => {
            btn.addEventListener('click', () => openSpeedForm(speedsById.get(Number(btn.dataset.editId))));
        });
        el.querySelectorAll('[data-delete-id]').forEach((btn) => {
            btn.addEventListener('click', () => deleteSpeed(Number(btn.dataset.deleteId)));
        });
    }
    async function reloadSpeeds() {
        const { playbackSpeeds } = await apiCall('/api/admin/playback-speeds');
        renderSpeedsList(playbackSpeeds);
    }
    let editingSpeedId = null;
    function openSpeedForm(speed) {
        editingSpeedId = speed ? speed.id : null;
        document.getElementById('speedFormTitle').textContent = speed ? 'Edit playback speed' : 'Add playback speed';
        document.getElementById('speedPercentInput').value = speed ? speed.percent : '';
        document.getElementById('speedActiveInput').checked = speed ? speed.active : true;
        document.getElementById('speedActiveRow').classList.toggle('hidden-group', !speed);
        document.getElementById('speedFormModal').style.display = 'flex';
        document.getElementById('speedPercentInput').focus();
    }
    function closeSpeedForm() {
        document.getElementById('speedFormModal').style.display = 'none';
        editingSpeedId = null;
    }
    async function saveSpeedForm() {
        const percent = document.getElementById('speedPercentInput').value;
        const active = document.getElementById('speedActiveInput').checked;
        const saveBtn = document.getElementById('speedFormSaveBtn');
        saveBtn.disabled = true;
        try {
            if (editingSpeedId) {
                await apiCall(`/api/admin/playback-speeds/${editingSpeedId}`, 'PUT', { percent, active });
            } else {
                await apiCall('/api/admin/playback-speeds', 'POST', { percent });
            }
            closeSpeedForm();
            await reloadSpeeds();
            showToast('Playback speed saved.', 'success');
        } catch (error) {
            showToast(error.message);
        } finally {
            saveBtn.disabled = false;
        }
    }
    function deleteSpeed(id) {
        const s = speedsById.get(id);
        showConfirmModal('Delete playback speed', `Delete "${s?.percent}%"?`, async () => {
            try {
                await apiCall(`/api/admin/playback-speeds/${id}`, 'DELETE');
                await reloadSpeeds();
                showToast('Playback speed deleted.', 'success');
            } catch (error) {
                showToast(error.message);
            }
        }, true);
    }
    function initSpeedForm() {
        document.getElementById('addSpeedBtn')?.addEventListener('click', () => openSpeedForm(null));
        document.getElementById('speedFormCancelBtn')?.addEventListener('click', closeSpeedForm);
        document.getElementById('speedFormSaveBtn')?.addEventListener('click', saveSpeedForm);
    }

    async function load() {
        initNav();
        initFeatureForm();
        initConfirmModal();
        initBandForm();
        initAdminSubtabs();
        initDurationForm();
        initTimeSigForm();
        initSpeedForm();
        initConfigForm();
        initFeedback();
        document.getElementById('adminShell').classList.remove('hidden-group');
        try {
            const [backtest, featuresRes] = await Promise.all([
                apiCall('/api/admin/backtest'),
                apiCall('/api/admin/features')
            ]);
            renderSummary(backtest);
            renderFeatures(backtest);
            renderFeaturesCatalog(featuresRes.features);
            await Promise.all([
                reloadAccounts(), reloadBands(), reloadDurations(), reloadTimeSigs(), reloadNoteValues(), reloadSpeeds(), reloadDurationUsage(), reloadFlowAuthoring(), reloadFeedback(), reloadPosthogLink(),
                reloadFlowDefaultName(), reloadFlowDefaultTimeSig(), reloadFlowDefaultBpm(), reloadFlowDefaultBarCount(), reloadFlowDefaultNoteValue()
            ]);
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
