// Admin panel (ML-26) - Release tests section. Reads the same authToken the
// main app stores in localStorage (same origin) rather than duplicating its
// login flow. No admin-role check yet - see the note in admin.html.
(function () {
    const API_BASE_URL = window.location.hostname === 'localhost'
        ? window.location.origin // any local port (two dev servers can run side by side)
        : `https://${window.location.hostname}`;

    // ML-288: pop-ups open with .show and close without it - never style.display (same as app.js).
    const showModal = (id) => document.getElementById(id)?.classList.add('show');
    const hideModal = (id) => document.getElementById(id)?.classList.remove('show');
    const setShown = (id, on) => document.getElementById(id)?.classList.toggle('hidden-group', !on);

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
        btn.classList.toggle('is-danger', isDanger);
        btn.textContent = isDanger ? 'Delete' : 'Confirm';
        confirmCallback = callback;
        showModal('adminConfirmModal');
    }

    function closeConfirmModal() {
        hideModal('adminConfirmModal');
        confirmCallback = null;
    }

    let toastTimeout = null;
    function showToast(message, type = 'warning') {
        const t = document.getElementById('adminToast');
        if (!t) return;
        t.className = `toast ${type} show`;
        document.getElementById('adminToastMsg').textContent = message;
        clearTimeout(toastTimeout);
        toastTimeout = setTimeout(() => { t.classList.remove('show'); }, 5000);
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

    // ========================================
    // Feature add/edit modal + delete
    // ========================================
    let editingFeatureId = null;

    function openFeatureForm(feature) {
        if (accessChangesPending()) return;
        editingFeatureId = feature ? feature.id : null;
        document.getElementById('featureFormTitle').textContent = feature ? 'Edit feature' : 'Add feature';
        document.getElementById('featureKeyInput').value = feature ? feature.featureKey : '';
        document.getElementById('featureNameInput').value = feature ? feature.name : '';
        document.getElementById('featureDescInput').value = feature ? (feature.description || '') : '';
        // ML-414: Live is set on Feature access - here it's only said
        document.getElementById('featureLiveNote').textContent = feature
            ? `${feature.enabled ? 'Live' : 'Not live'} - the Live switch and the account types are in the grid.`
            : 'A new feature starts Live and Super admin only - tick the account types that get it once it is added.';
        showModal('featureFormModal');
        document.getElementById('featureKeyInput').focus();
    }

    function closeFeatureForm() {
        hideModal('featureFormModal');
        editingFeatureId = null;
    }

    async function saveFeatureForm() {
        const featureKey = document.getElementById('featureKeyInput').value.trim();
        const name = document.getElementById('featureNameInput').value.trim();
        const description = document.getElementById('featureDescInput').value.trim();
        const enabled = editingFeatureId ? !!(featuresById.get(editingFeatureId) || {}).enabled : true; // ML-414: Live is Feature access's switch

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
        if (accessChangesPending()) return;
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

    // ML-414: the catalogue lives on Feature access now - after an add, edit or delete its grid is loaded again
    async function reloadFeatures() {
        await loadFeatureAccess();
    }
    // Adding, editing or deleting a feature reloads the grid, which would drop ticks not saved yet
    function accessChangesPending() {
        if (access.live.size + access.cells.size + access.limits.size === 0) return false;
        showToast('Save or discard your changes first.');
        return true;
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
        const navBtn = document.querySelector(`.admin-nav-item[data-section="${sectionName}"]`);
        navBtn?.classList.add('active');
        document.getElementById(`${sectionName}-section`).classList.remove('hidden-group');
        // ML-240: the phone-width head row names the open section, since the list itself is folded
        // away behind ☰ there - and picking a section closes that list again.
        const current = document.getElementById('adminCurrentSection');
        if (current && navBtn) current.textContent = navBtn.firstChild.textContent.trim();
        setAdminNavOpen(false);
        // ML-443: the group holding the open page is open, and the page has its own address, so a
        // reload stays on it and Back goes to the page before.
        const group = navBtn?.closest('.admin-nav-group');
        if (group) setNavGroupOpen(group, true);
        if (navBtn && location.hash.slice(1) !== sectionName) location.hash = sectionName;
    }

    // ML-443: the menu's groups. A heading opens and closes its group; which ones are shut is kept on
    // this device (a convenience only - the menu works without it). A shut group's heading carries
    // the total of the counts inside it, so something waiting is never hidden.
    const NAV_GROUPS_KEY = 'adminNavGroupsClosed';
    const NAV_FOLDED_KEY = 'adminNavFolded';
    const navStore = {
        read(key) { try { return JSON.parse(localStorage.getItem(key)); } catch (error) { return null; } },
        write(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch (error) { /* private window: not kept */ } }
    };
    function refreshNavCounts() {
        document.querySelectorAll('.admin-nav-group').forEach((group) => {
            const total = [...group.querySelectorAll('.admin-nav-group-items .admin-nav-count:not(.hidden-group)')].reduce((sum, el) => sum + (Number(el.textContent) || 0), 0);
            const shut = group.querySelector('.admin-nav-group-head').getAttribute('aria-expanded') !== 'true';
            const count = group.querySelector('[data-group-count]');
            count.textContent = String(total);
            count.classList.toggle('hidden-group', !shut || !total);
        });
    }
    function setNavCount(id, n) {
        const el = document.getElementById(id);
        if (!el) return;
        el.textContent = String(n);
        el.classList.toggle('hidden-group', !n);
        refreshNavCounts();
    }
    function setNavGroupOpen(group, open) {
        group.querySelector('.admin-nav-group-head').setAttribute('aria-expanded', open ? 'true' : 'false');
        group.querySelector('.admin-nav-group-items').classList.toggle('hidden-group', !open);
        group.querySelector('[data-group-arrow]').textContent = open ? 'expand_more' : 'chevron_right';
        refreshNavCounts();
    }
    // The whole menu folds away on a wide screen, so a wide table gets the window (a phone has ☰ instead)
    function setNavFolded(folded) {
        const btn = document.getElementById('adminNavFold');
        document.getElementById('adminShell').classList.toggle('is-nav-folded', folded);
        btn.setAttribute('aria-expanded', folded ? 'false' : 'true');
        btn.setAttribute('aria-label', folded ? 'Show the admin menu' : 'Hide the admin menu');
        btn.firstElementChild.textContent = folded ? 'keyboard_double_arrow_right' : 'keyboard_double_arrow_left';
    }
    function initNavGroups() {
        const closed = navStore.read(NAV_GROUPS_KEY) || [];
        document.querySelectorAll('.admin-nav-group').forEach((group) => {
            const here = [...group.querySelectorAll('.admin-nav-item')].some((b) => b.dataset.section === (location.hash.slice(1) || 'dashboard'));
            if (closed.includes(group.dataset.navGroup) && !here) setNavGroupOpen(group, false);
            group.querySelector('.admin-nav-group-head').addEventListener('click', (e) => {
                setNavGroupOpen(group, e.currentTarget.getAttribute('aria-expanded') !== 'true');
                navStore.write(NAV_GROUPS_KEY, [...document.querySelectorAll('.admin-nav-group')].filter((g) => g.querySelector('.admin-nav-group-head').getAttribute('aria-expanded') !== 'true').map((g) => g.dataset.navGroup));
            });
        });
        setNavFolded(navStore.read(NAV_FOLDED_KEY) === true);
        document.getElementById('adminNavFold').addEventListener('click', (e) => {
            const folded = e.currentTarget.getAttribute('aria-expanded') === 'true';
            setNavFolded(folded);
            navStore.write(NAV_FOLDED_KEY, folded);
        });
        // Back, Forward and a typed address: go to the page the address names (no address = the first page)
        window.addEventListener('hashchange', openPageFromAddress);
    }
    function openPageFromAddress() {
        const name = location.hash.slice(1) || 'dashboard';
        const btn = [...document.querySelectorAll('.admin-nav-item[data-section]')].find((b) => b.dataset.section === name);
        // A click, not showSection, so a page that loads itself when it is opened still does
        if (btn && !btn.classList.contains('active')) btn.click();
    }

    // ML-240: ☰ toggle for the section list on a phone-width screen (admin.css hides the toggle and
    // always shows the list on wider screens, so this is a no-op there).
    function setAdminNavOpen(open) {
        const sidebar = document.getElementById('adminSidebar');
        const toggle = document.getElementById('adminNavToggle');
        if (!sidebar || !toggle) return;
        sidebar.classList.toggle('expanded', open);
        toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
        toggle.setAttribute('aria-label', open ? 'Hide admin sections' : 'Show admin sections');
    }
    function initNavToggle() {
        const toggle = document.getElementById('adminNavToggle');
        toggle?.addEventListener('click', () => {
            setAdminNavOpen(toggle.getAttribute('aria-expanded') !== 'true');
        });
        document.getElementById('adminSidebar')?.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && toggle?.getAttribute('aria-expanded') === 'true') {
                setAdminNavOpen(false);
                toggle.focus();
            }
        });
    }

    // Section switching - all sidebar items ("Features", "Release tests",
    // "Accounts", "Bands", "Metadata lists", "Usage") toggle a section by
    // data-section. "Test cases" is a sub-view reached via a link, not the sidebar.
    function initNav() {
        initNavToggle();
        initNavGroups();
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
        ['beta_tester', 'Beta tester'],
        ['teacher', 'Teacher'] // ML-346
    ];

    function accountDisplayName(a) {
        return [a.firstName, a.surname].filter(Boolean).join(' ').trim() || a.email;
    }

    // ML-355 batch 3: how each account logs in, and the help an admin can give with it.
    let passwordLoginOn = false; // from /api/admin/invites (reloadInvites)
    let emailsAreSent = true;    // ML-479: false on a site that only keeps its emails (dev, sandbox)
    function accountLoginLine(a) {
        const parts = [a.hasPassword ? 'Google or email + password' : 'Google'];
        if (a.hasPassword) parts.push(a.twoStepOn ? 'two-step on' : 'two-step off');
        if (a.lastPasswordLoginAt) parts.push(`last password login ${fmtDate(a.lastPasswordLoginAt)}`);
        if (a.lockedUntil) parts.push(`<strong>locked until ${fmtDate(a.lockedUntil)}</strong> (too many wrong tries)`);
        return parts.join(' &middot; ');
    }
    const ACCOUNT_ACTIONS = {
        'send-reset': (a) => [a.hasPassword ? 'Send a reset link' : 'Send a link to add a password', emailsAreSent ? `Email ${a.email} a link to choose a new password? It works once, for an hour.` : `Make a link for ${a.email} to choose a new password? This site doesn't send emails, so it won't reach them from here.`],
        unlock: (a) => ['Unlock', `Let ${accountDisplayName(a)} try their password and codes again straight away?`],
        'two-step/off': (a) => ['Turn off two-step sign-in', `Turn off ${accountDisplayName(a)}'s two-step sign-in - for a lost phone with no recovery codes? Only do this once you're sure it's really them.${a.accountLevel === 'super_admin' ? ' As a super admin, they\'ll have to set it up again at their next password login.' : ' They can set it up again in Sign-in and security.'}`],
        'sign-out': (a) => ['Sign out everywhere', `Sign ${accountDisplayName(a)} out on every device? They'll need to log in again.`]
    };

    // ===== ML-415 / ML-416: one floating ⋮ menu for a table row =====
    // items: [{ label, icon, href? (opens in a new tab), danger?, run? }]. One menu element, placed by the
    // button that opened it; a click anywhere else or Escape closes it.
    let rowMenuItems = [];
    let rowMenuBtn = null;
    function closeRowMenu() {
        document.getElementById('adminRowMenu')?.classList.remove('show');
        if (rowMenuBtn) rowMenuBtn.setAttribute('aria-expanded', 'false');
        rowMenuBtn = null;
    }
    function openRowMenu(btn, items) {
        const menu = document.getElementById('adminRowMenu');
        closeRowMenu();
        rowMenuItems = items;
        rowMenuBtn = btn;
        menu.innerHTML = items.map((it, i) => {
            const inner = `<span class="material-symbols-outlined dropdown-item-icon" aria-hidden="true">${it.icon}</span><span class="dropdown-item-text">${escapeHtml(it.label)}</span>`;
            return it.href
                ? `<a class="dropdown-item" role="menuitem" href="${escapeHtml(it.href)}" target="_blank" rel="noopener">${inner}</a>`
                : `<button type="button" class="dropdown-item${it.danger ? ' account-band-menu-delete' : ''}" role="menuitem" data-row-menu="${i}">${inner}</button>`;
        }).join('');
        menu.classList.add('show');
        btn.setAttribute('aria-expanded', 'true');
        const r = btn.getBoundingClientRect();
        const left = Math.max(8, Math.min(r.right - menu.offsetWidth, window.innerWidth - menu.offsetWidth - 8));
        const top = Math.min(r.bottom + 4, window.innerHeight - menu.offsetHeight - 8);
        menu.style.setProperty('--place-x', `${left}px`);
        menu.style.setProperty('--place-y', `${top}px`);
        menu.classList.add('is-placed');
        menu.querySelector('.dropdown-item')?.focus({ preventScroll: true });
    }
    document.getElementById('adminRowMenu')?.addEventListener('click', (e) => {
        const item = e.target.closest('[data-row-menu]');
        const btn = rowMenuBtn;
        const chosen = item ? rowMenuItems[Number(item.dataset.rowMenu)] : null;
        closeRowMenu();
        if (chosen && chosen.run) chosen.run(btn);
    });
    document.addEventListener('click', (e) => { if (!e.target.closest('[data-row-menu-btn]') && !e.target.closest('#adminRowMenu')) closeRowMenu(); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && rowMenuBtn) { const b = rowMenuBtn; closeRowMenu(); b.focus(); } });
    window.addEventListener('scroll', closeRowMenu); // the page moved under it
    const rowMenuBtnHtml = (attr, id, label) => `<button type="button" class="list-item-menu-btn" data-row-menu-btn ${attr}="${id}" aria-label="Options for ${escapeHtml(label)}" aria-haspopup="menu" aria-expanded="false"><span class="material-symbols-outlined" aria-hidden="true">more_vert</span></button>`;

    // ML-415: one line per account - and per invite that hasn't been accepted - with a search, a filter
    // (All / each account type that has someone / how they sign in / invites) and a ⋮ menu for the changes.
    let allAccounts = [];
    let allInvites = [];
    let accountsFilter = 'all';
    let accountsQuery = '';
    const accountLevelLabel = (level) => (ACCOUNT_LEVELS.find(([v]) => v === level) || [0, level || ''])[1];
    const inviteName = (i) => [i.firstName, i.surname].filter(Boolean).join(' ') || i.email;
    function accountSignIn(a) {
        const parts = [a.hasPassword ? 'Google or password' : 'Google'];
        if (a.hasPassword && a.twoStepOn) parts.push('two-step');
        return escapeHtml(parts.join(' · ')) + (a.lockedUntil ? ` <span class="admin-feedback-badge cat" title="Too many wrong tries - locked until ${escapeHtml(fmtDate(a.lockedUntil))}">Locked</span>` : '');
    }
    // ML-443: the day a member last used the app (accounts.last_seen_on). Empty until they next use it.
    const daysSinceSeen = (a) => (a.lastSeenOn ? Math.round((Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), new Date().getUTCDate()) - Date.parse(`${a.lastSeenOn}T00:00:00Z`)) / 86400000) : null);
    const LAPSED_DAYS = 30;
    function lastSeenHtml(a) {
        const days = daysSinceSeen(a);
        if (days === null) return '<span class="text-muted">Not yet</span>';
        const when = days <= 0 ? 'Today' : days === 1 ? 'Yesterday' : `${days} days ago`;
        return `${when}${days >= LAPSED_DAYS ? ' <span class="admin-feedback-badge cat">Lapsed</span>' : ''}`;
    }
    function accountsShown() {
        const q = accountsQuery;
        const hit = (name, email) => !q || name.toLowerCase().includes(q) || String(email || '').toLowerCase().includes(q);
        const f = accountsFilter;
        const accounts = f === 'invited' ? [] : allAccounts.filter(a => hit(accountDisplayName(a), a.email)
            && (f === 'all' || (f === 'seen:week' ? (daysSinceSeen(a) !== null && daysSinceSeen(a) < 7) : f === 'seen:lapsed' ? (daysSinceSeen(a) !== null && daysSinceSeen(a) >= LAPSED_DAYS) : f === 'auth:google' ? !a.hasPassword : f === 'auth:password' ? !!a.hasPassword : a.accountLevel === f)));
        const invites = f === 'all' || f === 'invited' ? allInvites.filter(i => hit(inviteName(i), i.email)) : [];
        return { accounts, invites };
    }
    function renderAccountsFilter() {
        const count = (fn) => allAccounts.filter(fn).length;
        const pills = [['all', 'All', allAccounts.length + allInvites.length],
            ...ACCOUNT_LEVELS.map(([v, label]) => [v, label, count(a => a.accountLevel === v)]).filter(p => p[2] > 0),
            ['auth:google', 'Google only', count(a => !a.hasPassword)],
            ['auth:password', 'Email + password', count(a => !!a.hasPassword)],
            ['seen:week', 'Seen this week', count(a => daysSinceSeen(a) !== null && daysSinceSeen(a) < 7)],
            ['seen:lapsed', `Not seen for ${LAPSED_DAYS} days`, count(a => daysSinceSeen(a) !== null && daysSinceSeen(a) >= LAPSED_DAYS)],
            ['invited', 'Invites not accepted', allInvites.length]];
        if (!pills.some(p => p[0] === accountsFilter)) accountsFilter = 'all';
        const box = document.getElementById('accountsFilterPills');
        box.innerHTML = pills.map(([key, label, n]) => `<button type="button" class="filter-pill${accountsFilter === key ? ' active' : ''}" data-accounts-filter="${key}" aria-pressed="${accountsFilter === key}">${escapeHtml(label)} <span class="filter-pill-count">${n}</span></button>`).join('');
        box.querySelectorAll('[data-accounts-filter]').forEach(b => b.addEventListener('click', () => { accountsFilter = b.dataset.accountsFilter; renderAccountsList(); }));
    }
    function renderAccountsList() {
        renderAccountsFilter();
        const el = document.getElementById('accountsList');
        if (!allAccounts.length && !allInvites.length) { el.innerHTML = '<p>No accounts yet.</p>'; return; }
        const { accounts, invites } = accountsShown();
        if (!accounts.length && !invites.length) { el.innerHTML = '<p>No accounts match.</p>'; return; }
        el.innerHTML = `
            <div class="admin-stat-table-wrap">
                <table class="admin-stat-table admin-accounts-table">
                    <thead><tr><th>Name</th><th>Email</th><th>Account type</th><th>Signs in with</th><th>Joined</th><th>Last seen</th><th><span class="visually-hidden">Options</span></th></tr></thead>
                    <tbody>${invites.map(i => `
                        <tr data-invite-row="${i.id}">
                            <td><strong>${escapeHtml(inviteName(i))}</strong></td>
                            <td>${escapeHtml(i.email)}</td>
                            <td>${escapeHtml(accountLevelLabel(i.accountLevel))}</td>
                            <td><span class="admin-feedback-badge cat">Invited</span> not accepted yet</td>
                            <td title="The link works until ${escapeHtml(fmtDate(i.expiresAt))}">sent ${escapeHtml(new Date(i.createdAt).toLocaleDateString())}</td>
                            <td></td>
                            <td>${rowMenuBtnHtml('data-invite-menu', i.id, 'the invite to ' + i.email)}</td>
                        </tr>`).join('')}${accounts.map(a => `
                        <tr data-account-row="${a.id}">
                            <td>${accountDisplayName(a) === a.email ? '<span class="text-muted">No name yet</span>' : `<strong>${escapeHtml(accountDisplayName(a))}</strong>`}</td>
                            <td>${escapeHtml(a.email)}</td>
                            <td>${escapeHtml(accountLevelLabel(a.accountLevel))}</td>
                            <td>${accountSignIn(a)}</td>
                            <td>${escapeHtml(new Date(a.createdAt).toLocaleDateString())}</td>
                            <td>${lastSeenHtml(a)}</td>
                            <td>${rowMenuBtnHtml('data-account-menu', a.id, accountDisplayName(a))}</td>
                        </tr>`).join('')}
                    </tbody>
                </table>
            </div>`;
        el.querySelectorAll('[data-account-menu]').forEach(btn => btn.addEventListener('click', () => {
            const a = allAccounts.find(x => String(x.id) === btn.dataset.accountMenu);
            if (!a) return;
            const act = (key, icon) => ({ label: ACCOUNT_ACTIONS[key](a)[0], icon, run: () => accountAction(a, key) });
            openRowMenu(btn, [
                { label: 'Change account type', icon: 'badge', run: () => openAccountType(a) },
                ...(passwordLoginOn ? [act('send-reset', 'link')] : []),
                ...(a.lockedUntil ? [act('unlock', 'lock_open')] : []),
                ...(a.twoStepOn ? [act('two-step/off', 'phonelink_erase')] : []),
                act('sign-out', 'logout')
            ]);
        }));
        el.querySelectorAll('[data-invite-menu]').forEach(btn => btn.addEventListener('click', () => {
            openRowMenu(btn, [{ label: 'Cancel invite', icon: 'delete', danger: true, run: () => cancelInvite(btn.dataset.inviteMenu) }]);
        }));
    }
    function accountAction(a, key) {
        const [title, text] = ACCOUNT_ACTIONS[key](a);
        showConfirmModal(title, text, async () => {
            try {
                const { message } = await apiCall(`/api/admin/accounts/${a.id}/${key}`, 'POST', {});
                showToast(message, 'success');
                await reloadAccounts();
            } catch (error) {
                showToast(error.message);
            }
        }, false);
    }
    // Change account type: one pop-up, the current type selected; it saves as soon as one is picked
    function openAccountType(a) {
        document.getElementById('accountTypeWho').textContent = accountDisplayName(a) === a.email ? a.email : `${accountDisplayName(a)} - ${a.email}`;
        const box = document.getElementById('accountTypeOptions');
        box.innerHTML = ACCOUNT_LEVELS.map(([value, label]) => `<button type="button" class="flow-choice-option${a.accountLevel === value ? ' selected' : ''}" aria-pressed="${a.accountLevel === value}" data-account-type="${value}">${escapeHtml(label)}</button>`).join('');
        box.querySelectorAll('[data-account-type]').forEach(b => b.addEventListener('click', async () => {
            hideModal('accountTypeModal');
            if (b.dataset.accountType === a.accountLevel) return;
            try {
                await apiCall(`/api/admin/accounts/${a.id}/level`, 'PUT', { accountLevel: b.dataset.accountType });
                showToast('Account type updated.', 'success');
            } catch (error) {
                showToast(error.message);
            }
            await reloadAccounts();
        }));
        showModal('accountTypeModal');
    }
    function cancelInvite(id) {
        showConfirmModal('Cancel invite', 'Cancel this invite? The link in their email stops working.', async () => {
            try { await apiCall(`/api/admin/invites/${id}`, 'DELETE'); await reloadAccounts(); showToast('Invite cancelled.', 'success'); }
            catch (error) { showToast(error.message); }
        }, true);
    }
    document.getElementById('accountsSearch')?.addEventListener('input', (e) => { accountsQuery = e.target.value.trim().toLowerCase(); renderAccountsList(); });

    async function reloadAccounts() {
        await reloadInvites(); // first: it says whether password login is on (the reset link item)
        const { accounts } = await apiCall('/api/admin/accounts');
        allAccounts = accounts;
        renderAccountsList();
    }

    // ML-355: invites to log in with an email and a password. Not super admin - a super admin needs
    // two-step sign-in. ML-415: they're lines in the accounts table ("Invited - not accepted yet").
    async function reloadInvites() {
        let data;
        try { data = await apiCall('/api/admin/invites'); } catch (e) { allInvites = []; return; } // before migration 074
        passwordLoginOn = !!data.enabled;
        emailsAreSent = data.emailsAreSent !== false;
        document.getElementById('inviteFormIntro').textContent = emailsAreSent
            ? 'They get an email with a link to choose a password. It works once, for 7 days. Someone who already logs in with Google keeps their account and gains a password.'
            : "This site doesn't send emails, so the link to choose a password won't reach them from here. Someone who already logs in with Google keeps their account and gains a password.";
        setShown('invitesOffNote', !data.enabled);
        document.getElementById('inviteBtn').disabled = !data.enabled;
        allInvites = data.invites || [];
        if (allAccounts.length) renderAccountsList();
    }
    function openInviteForm() {
        ['inviteEmailInput', 'inviteFirstNameInput', 'inviteSurnameInput'].forEach(id => { document.getElementById(id).value = ''; });
        document.getElementById('inviteLevelInput').innerHTML = ACCOUNT_LEVELS.filter(([v]) => v !== 'super_admin')
            .map(([v, l]) => `<option value="${v}"${v === 'standard_member' ? ' selected' : ''}>${l}</option>`).join('');
        showModal('inviteFormModal');
        document.getElementById('inviteEmailInput').focus();
    }
    async function sendInvite() {
        const btn = document.getElementById('inviteFormSaveBtn');
        btn.disabled = true;
        try {
            const { message } = await apiCall('/api/admin/invites', 'POST', {
                email: document.getElementById('inviteEmailInput').value,
                firstName: document.getElementById('inviteFirstNameInput').value,
                surname: document.getElementById('inviteSurnameInput').value,
                accountLevel: document.getElementById('inviteLevelInput').value
            });
            hideModal('inviteFormModal');
            showToast(message, 'success');
            await reloadInvites();
        } catch (error) {
            showToast(error.message);
        } finally {
            btn.disabled = false;
        }
    }
    document.getElementById('inviteBtn')?.addEventListener('click', openInviteForm);
    document.getElementById('inviteFormCancelBtn')?.addEventListener('click', () => hideModal('inviteFormModal'));
    document.getElementById('inviteFormSaveBtn')?.addEventListener('click', sendInvite);

    // ========================================
    // Bands (ML-89) - the shared band directory. Same add/edit/delete-with-
    // shared-modal pattern as Features above.
    // ========================================
    let bandsById = new Map();
    // Migration 073's details - the same lists the server checks (server/services/bands.js).
    const BAND_TYPES = ['Brass Band', 'Concert Band', 'Wind Band', 'Youth Brass Band', 'Youth Wind Band', 'Training Band', 'Brass Ensemble', 'Massed Band'];
    const BAND_SECTIONS = ['Championship', 'First', 'Second', 'Third', 'Fourth', 'Non-contesting'];
    // "Brass Band · Third section · Cobham, Surrey KT11 3EJ · part of The Cobham Band"
    function bandDetailLine(b) {
        const where = [b.town, b.county].filter(Boolean).join(', ') + (b.rehearsalPostcode ? ` ${b.rehearsalPostcode}` : '');
        return [b.ensembleType, b.sectionLevel && `${b.sectionLevel} section`, where.trim(), b.parentName && `part of ${b.parentName}`].filter(Boolean).join(' · ');
    }

    function renderBandsList(bands) {
        bandsById = new Map(bands.map(b => [b.id, b]));
        const el = document.getElementById('bandsList');
        if (!bands.length) { el.innerHTML = '<p>No bands yet - use "+ Add band" above.</p>'; return; }
        el.innerHTML = bands.map(b => `
            <div class="admin-feature">
                <div class="admin-feature-header">
                    <div class="admin-feature-header-text">
                        <h2>${escapeHtml(b.listName || b.displayName)}${b.active ? '' : ' (archived)'}</h2>
                        <p>${b.website ? `<a href="${escapeHtml(b.website)}" target="_blank" rel="noopener">${escapeHtml(b.website)}</a>` : 'No website'}</p>
                        ${bandDetailLine(b) ? `<p class="admin-test-case-meta">${escapeHtml(bandDetailLine(b))}</p>` : ''}
                        ${b.notes ? `<p class="admin-test-case-meta">${escapeHtml(b.notes)}</p>` : ''}
                        <p class="admin-test-case-meta">${b.memberCount} member${b.memberCount === 1 ? '' : 's'} in ${b.groupCount} shared space${b.groupCount === 1 ? '' : 's'}</p>
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
        const options = (el, blank, values, current) => {
            el.innerHTML = `<option value="">${blank}</option>` + values.map(([v, l]) => `<option value="${escapeHtml(String(v))}"${String(v) === String(current ?? '') ? ' selected' : ''}>${escapeHtml(l)}</option>`).join('');
        };
        options(document.getElementById('bandTypeInput'), 'Not known', BAND_TYPES.map(t => [t, t]), band?.ensembleType);
        options(document.getElementById('bandSectionInput'), 'None (not a contesting brass band)', BAND_SECTIONS.map(s => [s, s]), band?.sectionLevel);
        // A main band is one that isn't itself part of another band (one level only).
        const mains = [...bandsById.values()].filter(b => !b.parentBandId && b.active && (!band || b.id !== band.id));
        options(document.getElementById('bandParentInput'), 'Nothing - it is a main band', mains.map(b => [b.id, b.listName || b.displayName]), band?.parentBandId);
        document.getElementById('bandTownInput').value = band?.town || '';
        document.getElementById('bandCountyInput').value = band?.county || '';
        document.getElementById('bandPostcodeInput').value = band?.rehearsalPostcode || '';
        document.getElementById('bandNotesInput').value = band?.notes || '';
        showModal('bandFormModal');
        document.getElementById('bandNameInput').focus();
    }

    function closeBandForm() {
        hideModal('bandFormModal');
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

        const details = {
            ensembleType: document.getElementById('bandTypeInput').value,
            sectionLevel: document.getElementById('bandSectionInput').value,
            parentBandId: document.getElementById('bandParentInput').value || null,
            town: document.getElementById('bandTownInput').value,
            county: document.getElementById('bandCountyInput').value,
            rehearsalPostcode: document.getElementById('bandPostcodeInput').value,
            notes: document.getElementById('bandNotesInput').value
        };

        const saveBtn = document.getElementById('bandFormSaveBtn');
        saveBtn.disabled = true;
        try {
            if (editingBandId) {
                await apiCall(`/api/admin/bands/${editingBandId}`, 'PUT', { name, website, contactEmail, ...details });
            } else {
                await apiCall('/api/admin/bands', 'POST', { name, website, ...details });
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
                        <h2>${d.minutes} minutes${d.active ? '' : ' (inactive)'}${d.isDefault ? ' (timer default)' : ''}</h2>
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
        document.getElementById('durationDefaultInput').checked = !!duration?.isDefault;
        document.getElementById('durationDefaultRow').classList.toggle('hidden-group', !duration);
        showModal('durationFormModal');
        document.getElementById('durationMinutesInput').focus();
    }
    function closeDurationForm() {
        hideModal('durationFormModal');
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
                const isDefault = document.getElementById('durationDefaultInput').checked;
                await apiCall(`/api/admin/durations/${editingDurationId}`, 'PUT', { minutes, sortOrder: d.sortOrder, active, isDefault });
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
        showModal('timeSigFormModal');
        document.getElementById('timeSigNumeratorInput').focus();
    }
    function closeTimeSigForm() {
        hideModal('timeSigFormModal');
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

    // ML-308: two bar charts from every saved session length - the 5-minute steps 5-120 in order,
    // then every other length (custom ones) most common first - to see whether the presets need
    // changing. The stats screen's bar-chart pieces (specs/components/charts.md), .chart-labelled so
    // every bar has its label. Each chart is also a role="img" with every value in its label, each bar
    // has a hover title, and the custom lengths are listed as a table too.
    const pl = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;
    function durationChartHtml(bars, label) {
        const max = Math.max(1, ...bars.map(b => b.sessions));
        const steps = [1, 2, 3, 4, 5, 7, 10, 15, 20, 25, 30, 40, 50, 75, 100, 150, 200, 250, 300, 500, 1000, 2000, 5000];
        const step = steps.find(s => s * 3.5 >= max) || Math.ceil(max / 3);
        const top = Math.max(max * 1.05, step * 3);
        const pct = (v) => `${(v / top) * 100}%`;
        const lines = [0, 1, 2, 3].map(i => `<div class="grid-line${i ? '' : ' is-baseline'}" data-pos="${pct(step * i)}"></div>`).join('');
        const yLabels = [0, 1, 2, 3].map(i => `<span class="chart-y-label" data-pos="${pct(step * i)}">${step * i}</span>`).join('');
        const barHtml = bars.map(b => `
            <div class="chart-bar-container" title="${b.minutes} min: ${pl(b.sessions, 'session')}">
                <div class="chart-bar series-sessions" data-h="${pct(b.sessions)}"></div>
                <span class="chart-x-label">${b.minutes}</span>
            </div>`).join('');
        return `<div class="chart-wrapper chart-labelled" role="img" aria-label="${escapeHtml(label)}">
                <div class="chart-grid-lines">${lines}</div>
                <div class="chart-y-axis"><div class="chart-y-axis-container">${yLabels}</div></div>
                <div class="chart-scroll-area">${barHtml}</div>
            </div>`;
    }
    // Chart geometry is a run-time value: set as custom properties the chart classes read (ML-288).
    function applyChartGeometry(root) {
        root.querySelectorAll('[data-pos]').forEach(el => el.style.setProperty('--line-pos', el.dataset.pos));
        root.querySelectorAll('[data-h]').forEach(el => el.style.setProperty('--bar-h', el.dataset.h));
    }
    function renderDurationUsageList(durationUsage, sessionMinutes) {
        const el = document.getElementById('usageDurationsList');
        const count = new Map((sessionMinutes || []).map(r => [r.minutes, r.sessions]));
        const presets = new Set(durationUsage.map(d => d.minutes));
        const steps = Array.from({ length: 24 }, (_, i) => (i + 1) * 5).map(m => ({ minutes: m, sessions: count.get(m) || 0 }));
        const others = (sessionMinutes || []).filter(r => r.minutes % 5 !== 0 || r.minutes > 120)
            .sort((a, b) => b.sessions - a.sessions || a.minutes - b.minutes);
        const stepTotal = steps.reduce((s, b) => s + b.sessions, 0), otherTotal = others.reduce((s, b) => s + b.sessions, 0);
        const describe = (bars) => bars.map(b => `${b.minutes} min ${b.sessions}`).join(', ');
        el.innerHTML = `
            <div class="admin-stat-section-title">5-minute lengths, 5 to 120 minutes</div>
            <p class="admin-test-case-meta">${pl(stepTotal, 'session')}. Presets on offer now: ${[...presets].sort((a, b) => a - b).join(', ') || 'none'} minutes.</p>
            ${durationChartHtml(steps, `Sessions per length, 5 to 120 minutes in 5-minute steps: ${describe(steps)}`)}
            <div class="admin-stat-section-title">Other lengths, most common first</div>
            <p class="admin-test-case-meta">Lengths typed in that aren't a 5-minute step from 5 to 120: ${pl(otherTotal, 'session')}, ${pl(others.length, 'different length')}.</p>
            ${others.length ? `${durationChartHtml(others, `Sessions per other length, most common first: ${describe(others)}`)}
            <div class="admin-stat-table-wrap"><table class="admin-stat-table">
                <thead><tr><th>Minutes</th><th>Sessions</th></tr></thead>
                <tbody>${others.map(b => `<tr><td>${b.minutes}</td><td>${b.sessions}</td></tr>`).join('')}</tbody>
            </table></div>` : '<p>No other lengths saved yet.</p>'}`;
        applyChartGeometry(el);
    }
    // ML-309: Theory grades - read-only, from the engine itself (no request).
    function renderTheoryGrades() {
        const el = document.getElementById('theoryGradesList');
        const T = window.TheoryEngine;
        if (!el || !T) return;
        const FORM = { harmonic: 'harmonic', melodic: 'melodic' };
        const RANGE = { 0: 'on the stave (and the space just above and below)', 2: 'up to 2 ledger lines above and below', 4: 'up to 4 ledger lines above and below', 6: 'up to 6 ledger lines' };
        const ACC = { none: 'naturals', sharps: 'sharps', flats: 'flats' };
        const SET = { basics: 'Symbols', dynamics: 'Dynamics', rhythm: 'Rhythm and time', structure: 'Structure', terms: 'Terms' };
        const keyName = (id) => id.replace(/b(?= )/, '♭').replace(/#/, '♯');
        el.innerHTML = T.gradeSummary().map(g => {
            const lines = [];
            const line = (label, text) => `<p class="admin-test-case-meta"><strong>${label}:</strong> ${escapeHtml(text)}</p>`;
            if (g.clefs.length) lines.push(line('Clefs', g.clefs.join(', ')));
            if (g.rangeChanged) lines.push(line('Note names', RANGE[g.range]));
            if (g.accidentals.length) lines.push(line('Note spellings', g.accidentals.map(a => ACC[a]).join(', ')));
            if (g.keys.length) lines.push(line('Keys', g.keys.map(keyName).join(', ')));
            if (g.minorForms.length) lines.push(line('Minor scales', g.minorForms.map(f => FORM[f]).join(', ')));
            for (const t of g.topics || []) lines.push(line(t.label, t.text)); // ML-309 C: intervals, chords...
            const bySet = Object.keys(SET).map(set => [set, g.symbols.filter(s => s.set === set)]).filter(([, list]) => list.length);
            return `
                <div class="admin-feature">
                    <div class="admin-feature-header"><div class="admin-feature-header-text">
                        <h2>Grade ${g.grade} adds</h2>
                        <p class="admin-test-case-meta">${g.symbols.length} symbols and terms · ${T.gradeContent(g.grade).symbols.length} in total up to Grade ${g.grade}</p>
                    </div></div>
                    ${lines.join('')}
                    ${bySet.map(([set, list]) => `
                        <h3>${SET[set]}</h3>
                        ${list.map(s => `<p class="admin-test-case-meta"><strong>${escapeHtml(s.name)}</strong> - ${escapeHtml(s.meaning)}</p>`).join('')}`).join('')}
                </div>`;
        }).join('');
    }

    // ML-309: practice by instrument.
    async function reloadInstrumentUsage() {
        const el = document.getElementById('usageInstruments');
        try {
            const u = await apiCall('/api/admin/usage/instruments');
            const hours = m => (m / 60).toFixed(1);
            el.innerHTML = `
                <p class="admin-test-case-meta">${u.accountsWithInstruments} of ${u.accounts} accounts have chosen an instrument. No instrument: ${u.untaggedSessions} session${u.untaggedSessions === 1 ? '' : 's'}, ${hours(u.untaggedMinutes)} h.</p>
                ${u.instruments.length ? `<div class="admin-stat-table-wrap"><table class="admin-stat-table">
                    <thead><tr><th>Instrument</th><th>Family</th><th>Players (main)</th><th>Sessions</th><th>Hours</th></tr></thead>
                    <tbody>${u.instruments.map(i => `<tr><td>${escapeHtml(i.name)}</td><td>${escapeHtml(i.family)}</td><td>${i.players} (${i.mainPlayers})</td><td>${i.sessions}</td><td>${hours(i.minutes)}</td></tr>`).join('')}</tbody>
                </table></div>` : '<p>No one has chosen an instrument yet.</p>'}
                ${await instrumentRangesHtml()}`;
        } catch (error) {
            el.innerHTML = `<p>Error loading instrument usage: ${escapeHtml(error.message)}</p>`;
        }
    }
    // ML-322: each instrument's typical written range - the outer limit for the range picker and the
    // Range tool (never a player's starting point) - listed for review. From the catalogue
    // (band_instruments_master_catalog.json -> migration 065); change it there and generate a new migration.
    async function instrumentRangesHtml() {
        const list = await apiCall('/api/instruments');
        const note = (p) => (p ? escapeHtml(p.replace(/^([A-G])#/, '$1♯').replace(/^([A-G])b/, '$1♭')) : '');
        const shift = (n) => (n === null || n === undefined ? '' : n === 0 ? 'concert pitch' : `sounds ${Math.abs(n)} semitone${Math.abs(n) === 1 ? '' : 's'} ${n > 0 ? 'higher' : 'lower'}`);
        return `
            <div class="admin-stat-section-title">Typical ranges (Range's outer limit)</div>
            <p class="admin-test-case-meta">Written notes, in the clef each instrument is read in here (brass band treble where there is one). Players set their own comfortable range inside this; Range never goes beyond it. None = holding a note doesn't apply.</p>
            <div class="admin-stat-table-wrap"><table class="admin-stat-table">
                <thead><tr><th>Instrument</th><th>Clef</th><th>Lowest</th><th>Highest</th><th>Transposition</th></tr></thead>
                <tbody>${list.map(i => `<tr><td>${escapeHtml(i.name)}</td><td>${escapeHtml(i.theoryClef)}</td><td>${i.rangeLow ? note(i.rangeLow) : 'none'}</td><td>${note(i.rangeHigh)}</td><td>${shift(i.writtenToConcert)}</td></tr>`).join('')}</tbody>
            </table></div>`;
    }
    async function reloadDurationUsage() {
        const { durationUsage, sessionMinutes } = await apiCall('/api/admin/usage/durations');
        renderDurationUsageList(durationUsage, sessionMinutes);
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

    // ML-424: bar by bar against quick entry (time and the work it took), and quick entry step by step -
    // the step with the most seconds or taps is the next thing to speed up.
    function quickEntryTables(data) {
        const methods = data.byMethod || [];
        const steps = data.quickSteps || [];
        // ML-428: five stages with steps inside; 'extras' is the single Extras step pieces made on 0.39 recorded
        const stepNames = { about: 'About', howLong: 'Structure: how long', marks: 'Structure: marks', time: 'Tempo: time', speed: 'Tempo: speed', extras: 'Extras (0.39, one step)', xIntro: 'Order of play: introduction', xRepeats: 'Order of play: repeats', xPauses: 'Tempo: pauses', xRamps: 'Tempo: gradual speed changes', xSigns: 'Order of play: signs and jumps', mAudio: 'Media: recording', mVideo: 'Media: YouTube', mDocs: 'Media: score or part', media: 'Media', tempo: 'Tempo: time and speed (one step, briefly)' };
        const methodRows = methods.length
            ? methods.map(m => `<tr><td>${m.creationSource === 'quick' ? 'Quick entry' : 'Bar by bar'}</td><td>${m.n}</td><td>${fmtSeconds(m.seconds)}</td><td>${m.taps || '–'}</td><td>${m.keys || '–'}</td><td>${m.bars}</td><td>${m.secondsPerBar === null ? '–' : fmtRate(m.secondsPerBar)}</td></tr>`).join('')
            : '<tr><td colspan="7" class="admin-stat-empty">No completed pieces yet.</td></tr>';
        const stepRows = steps.length
            ? steps.map(s => `<tr><td>${stepNames[s.step] || escapeHtml(s.step)}</td><td>${s.n}</td><td>${fmtSeconds(s.seconds)}</td><td>${s.taps}</td><td>${s.keys}</td><td>${s.visits}</td></tr>`).join('')
            : '<tr><td colspan="6" class="admin-stat-empty">No piece has been made with quick entry yet.</td></tr>';
        return `
            <div class="admin-stat-section-title">Bar by bar against quick entry</div>
            <p class="admin-intro">New pieces only, medians. Taps and keys are counted from release 0.39 on, so older bar-by-bar runs show none &ndash; compare like with like.</p>
            <div class="admin-stat-table-wrap"><table class="admin-stat-table">
                <thead><tr><th>Way in</th><th>Pieces</th><th>Time</th><th>Taps</th><th>Keys</th><th>Bars</th><th>Per bar</th></tr></thead>
                <tbody>${methodRows}</tbody>
            </table></div>
            <div class="admin-stat-section-title">Quick entry, step by step</div>
            <p class="admin-intro">Averages per piece. The step with the most seconds or taps is the next one to speed up; visits over 1 mean going back to it.</p>
            <div class="admin-stat-table-wrap"><table class="admin-stat-table">
                <thead><tr><th>Step</th><th>Pieces</th><th>Time</th><th>Taps</th><th>Keys</th><th>Visits</th></tr></thead>
                <tbody>${stepRows}</tbody>
            </table></div>`;
    }

    function renderFlowAuthoringStats(data) {
        const el = document.getElementById('flowAuthoringStats');
        const h = data.headline;
        const o = data.outcomes;

        if (!h.n) {
            el.innerHTML = `<p class="admin-stat-empty">No completed manual Flow builds recorded yet.${
                o.live || o.stale ? ` (${o.live} in progress, ${o.stale} never finished.)` : ''
            } Build a Flow from &ldquo;Create your own&rdquo; through to Done and it'll appear here.</p>`;
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
                    <td>${r.kind}${r.creationSource === 'from_file' ? ' (import)' : r.creationSource === 'quick' ? ' (quick entry)' : ''}</td>
                    <td>${r.outcome}</td>
                    <td>${fmtSeconds(r.activeSeconds)}</td>
                    <td>${fmtSeconds(r.barsActiveSeconds)}</td>
                    <td>${r.totalBarsEnd}</td>
                    <td>${r.kind === 'create' && r.totalBarsEnd > 0 ? fmtRate(Math.round((r.barsActiveSeconds / r.totalBarsEnd) * 10) / 10) : '–'}</td>
                    <td>${r.blockCountEnd}</td>
                    <td>+${r.blocksAdded}/~${r.blocksEdited}/-${r.blocksDeleted}</td>
                    <td>${r.tapCount || '–'}</td>
                    <td>${r.keyCount || '–'}</td>
                    <td>${escapeHtml(r.deviceKind || '–')}</td>
                    <td>${escapeHtml(r.appVersion || '–')}</td>
                    <td><button class="admin-stat-exclude-btn" data-exclude-id="${r.id}" data-excluded="${r.isExcluded}" type="button">${r.isExcluded ? 'Include' : 'Exclude'}</button></td>
                </tr>`).join('')
            : `<tr><td colspan="15" class="admin-stat-empty">Nothing recorded yet.</td></tr>`;

        el.innerHTML = `
            ${tiles}
            ${statTable('By app version', data.byVersion, 'Version', r => `${r.appVersion || 'unknown'}${r.creationSource === 'quick' ? ' (quick entry)' : ' (bar by bar)'}`,
                'The before/after comparison. Cut a release, keep building flows the same way, and compare the rows &ndash; anything else (a different device, a much longer piece) is a confound, which is what the two tables below are for.')}
            ${quickEntryTables(data)}
            ${statTable('Create vs edit', data.byKind, 'Session', r => `${r.kind}${r.creationSource === 'from_file' ? ' (import)' : r.creationSource === 'quick' ? ' (quick entry)' : ''}`,
                'Initial creation against later editing stints, per ML-199. Per bar is blank for edits &ndash; see the note above.')}
            ${statTable('By length of music', data.bySize, 'Flow length', r => r.bucket,
                'Whether a longer piece costs proportionally more or there&rsquo;s a fixed overhead. If per-bar holds steady across the buckets, the cost is genuinely per bar and the redesign should attack bar entry; if it falls as flows get longer, the overhead is in the setup around it.')}
            ${statTable('By device', data.byDevice, 'Device', r => r.deviceKind,
                'Thumbing a phone and typing on a desktop are different activities &ndash; worth checking a change in the headline figure isn&rsquo;t just a change in which device was used.')}
            <div class="admin-stat-section-title">Recent sessions</div>
            <p class="admin-intro">The raw runs behind the figures above, newest first (100 max), so a surprising median can be traced to the run that caused it. Per bar is that run&rsquo;s bars time divided by its bars &ndash; blank for an edit, which touches an unknown part of the piece. Bar changes are shown as added/edited/deleted. Excluding a run drops it from every statistic above but keeps the row &ndash; use it for a run you know was interrupted, not one you simply dislike. A session with no heartbeat for ${data.staleAfterMinutes} minutes counts as abandoned.</p>
            <div class="admin-stat-table-wrap">
                <table class="admin-stat-table">
                    <thead><tr>
                        <th>Flow</th><th>Who</th><th>Type</th><th>Outcome</th><th>Active</th><th>Bars time</th>
                        <th>Bars</th><th>Per bar</th><th>Blocks</th><th>Changes</th><th>Taps</th><th>Keys</th><th>Device</th><th>Version</th><th></th>
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
        setNavCount('feedbackNavCount', data.counts.untriaged);

        if (!data.feedback.length) {
            el.innerHTML = data.counts.total
                ? '<p>Nothing matches these filters.</p>'
                : '<p>No feedback yet. It arrives here from the app\'s hamburger menu &rarr; Send feedback.</p>';
            return;
        }

        el.innerHTML = data.feedback.map(f => `
            <div class="admin-feature" data-feedback-row="${f.id}">
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
        showModal('feedbackReviewModal');
    }
    function closeFeedbackReview() {
        hideModal('feedbackReviewModal');
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
        showModal('configFormModal');
        document.getElementById('configValueInput').focus();
    }

    function closeConfigForm() {
        hideModal('configFormModal');
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
        showModal('speedFormModal');
        document.getElementById('speedPercentInput').focus();
    }
    function closeSpeedForm() {
        hideModal('speedFormModal');
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

    // ========================================
    // Flows (ML-204) - export any flow on this environment as MusicXML (one .musicxml, or a .zip
    // for several), and import such files as the admin's own private flows. Import is preview
    // first (parse + validate, nothing written), then all-or-nothing - see flowTransfer.js.
    // ========================================
    let allFlows = [];
    const selectedFlowIds = new Set();
    let pendingImportFile = null;

    const FLOW_OWNERSHIP_LABELS = { personal: 'Personal', band: 'Band', public: 'Public' };

    function flowOwnerText(f) {
        if (f.ownership === 'public') return '';
        if (f.ownership === 'band') return f.bandName || '?';
        return f.ownerName || f.ownerEmail || '-';
    }

    // ML-310: All / Public (the public library everyone sees) / Personal / Band.
    let flowsOwnershipFilter = 'all';
    function renderFlowsOwnershipPills() {
        const pills = document.getElementById('flowsOwnershipPills');
        if (!pills) return;
        const count = key => key === 'all' ? allFlows.length : allFlows.filter(f => f.ownership === key).length;
        pills.innerHTML = [['all', 'All'], ['public', 'Public library'], ['personal', 'Personal'], ['band', 'Band']].map(([key, label]) =>
            `<button type="button" class="filter-pill${flowsOwnershipFilter === key ? ' active' : ''}" data-flows-ownership="${key}" aria-pressed="${flowsOwnershipFilter === key}">${label} <span class="filter-pill-count">${count(key)}</span></button>`).join('');
        pills.querySelectorAll('[data-flows-ownership]').forEach(b => b.addEventListener('click', () => {
            flowsOwnershipFilter = b.dataset.flowsOwnership;
            renderFlows();
        }));
    }

    function filteredFlows() {
        const q = (document.getElementById('flowsFilter')?.value || '').trim().toLowerCase();
        const shown = flowsOwnershipFilter === 'all' ? allFlows : allFlows.filter(f => f.ownership === flowsOwnershipFilter);
        if (!q) return shown;
        return shown.filter(f => [f.title, f.composer, f.ownerName, f.ownerEmail, f.bandName]
            .some(v => v && String(v).toLowerCase().includes(q)));
    }

    function updateFlowsExportButton() {
        const btn = document.getElementById('flowsExportSelectedBtn');
        if (!btn) return;
        btn.disabled = !selectedFlowIds.size;
        btn.innerText = selectedFlowIds.size ? `Export selected (${selectedFlowIds.size})` : 'Export selected';
    }

    function flowMediaText(f) {
        const parts = [];
        if (f.youtubeCount) parts.push(`${f.youtubeCount} YouTube`);
        if (f.fileMediaCount) parts.push(`${f.fileMediaCount} file${f.fileMediaCount === 1 ? '' : 's'} (not exported)`);
        return parts.join(', ') || '-';
    }

    function renderFlows() {
        const el = document.getElementById('flowsList');
        renderFlowsOwnershipPills();
        const flows = filteredFlows();
        if (!allFlows.length) { el.innerHTML = '<p>No flows on this environment yet.</p>'; return; }
        if (!flows.length) { el.innerHTML = '<p>No flows match that filter.</p>'; return; }
        const allSelected = flows.every(f => selectedFlowIds.has(f.id));
        el.innerHTML = `
            <div class="admin-stat-table-wrap">
                <table class="admin-stat-table admin-flows-table">
                    <thead><tr>
                        <th><input type="checkbox" id="flowsSelectAll" aria-label="Select all shown" ${allSelected ? 'checked' : ''}></th>
                        <th>Title</th><th>Owner</th><th>Blocks</th><th>Bars</th><th>Media</th><th>Created</th><th><span class="visually-hidden">Options</span></th>
                    </tr></thead>
                    <tbody>${flows.map(f => `
                        <tr>
                            <td><input type="checkbox" data-flow-select="${f.id}" aria-label="Select ${escapeHtml(f.title)}" ${selectedFlowIds.has(f.id) ? 'checked' : ''}></td>
                            <td><strong>${escapeHtml(f.title)}</strong>${f.composer ? `<br><span class="admin-test-case-meta">${escapeHtml(f.composer)}</span>` : ''}</td>
                            <td><span class="admin-feedback-badge cat">${escapeHtml(FLOW_OWNERSHIP_LABELS[f.ownership])}</span> ${escapeHtml(flowOwnerText(f))}</td>
                            <td>${f.blockCount}</td>
                            <td>${f.totalBars}</td>
                            <td>${escapeHtml(flowMediaText(f))}</td>
                            <td>${escapeHtml(new Date(f.createdAt).toLocaleDateString())}</td>
                            <td>${rowMenuBtnHtml('data-flow-menu', f.id, f.title)}</td>
                        </tr>`).join('')}
                    </tbody>
                </table>
            </div>`;
        el.querySelectorAll('[data-flow-select]').forEach(cb => {
            cb.addEventListener('change', () => {
                const id = Number(cb.dataset.flowSelect);
                if (cb.checked) selectedFlowIds.add(id); else selectedFlowIds.delete(id);
                updateFlowsExportButton();
                const selectAll = document.getElementById('flowsSelectAll');
                if (selectAll) selectAll.checked = filteredFlows().every(f => selectedFlowIds.has(f.id));
            });
        });
        document.getElementById('flowsSelectAll')?.addEventListener('change', (e) => {
            filteredFlows().forEach(f => { if (e.target.checked) selectedFlowIds.add(f.id); else selectedFlowIds.delete(f.id); });
            renderFlows();
            updateFlowsExportButton();
        });
        // ML-416: View / Edit (a new tab), Publish or Unpublish (not a band's piece) and Export live in each
        // row's ⋮ menu - four buttons a row didn't fit the width.
        el.querySelectorAll('[data-flow-menu]').forEach(btn => btn.addEventListener('click', () => {
            const flow = allFlows.find(f => f.id === Number(btn.dataset.flowMenu));
            if (!flow) return;
            openRowMenu(btn, [
                { label: 'View', icon: 'play_arrow', href: `/?flow=${flow.id}&flowMode=play` },
                { label: 'Edit', icon: 'edit', href: `/?flow=${flow.id}&flowMode=edit` },
                ...(flow.ownership === 'band' ? [] : [{ label: flow.ownership === 'public' ? 'Unpublish' : 'Publish', icon: flow.ownership === 'public' ? 'public_off' : 'public', run: () => flowPublishToggle(flow) }]),
                { label: 'Export', icon: 'download', run: (b) => exportFlowFiles([flow.id], b) }
            ]);
        }));
    }
    // ML-310: publishing puts it in everyone's library and Rehearse (view, play, copy); either way
    // the piece becomes yours (flows.js publishFlow / unpublishFlow).
    function flowPublishToggle(flow) {
        const makePublic = flow.ownership !== 'public';
        const msg = makePublic
            ? `Publish "${flow.title}"? Everyone will see it in their library and Rehearse, and can copy it. It becomes yours.`
            : `Unpublish "${flow.title}"? It leaves everyone's library and becomes your own private piece.`;
        showConfirmModal(makePublic ? 'Publish' : 'Unpublish', msg, async () => {
            try {
                await apiCall('/api/flows/' + flow.id + (makePublic ? '/publish' : '/unpublish'), 'PUT');
                showToast(makePublic ? 'Published' : 'Unpublished', 'success');
                await reloadFlows();
            } catch (error) {
                showToast('Error: ' + error.message);
            }
        }, false);
    }

    async function reloadFlows() {
        const el = document.getElementById('flowsList');
        try {
            const { flows } = await apiCall('/api/admin/flows');
            allFlows = flows;
            // Drop selections for flows that no longer exist on this environment.
            [...selectedFlowIds].forEach(id => { if (!flows.some(f => f.id === id)) selectedFlowIds.delete(id); });
            renderFlows();
            updateFlowsExportButton();
        } catch (error) {
            el.innerHTML = `<p>Error loading flows: ${escapeHtml(error.message)}</p>`;
        }
    }

    // "attachment; filename="x.zip"; filename*=UTF-8''x.zip" - the encoded form wins when present.
    function downloadFileName(disposition, fallback) {
        const encoded = disposition.match(/filename\*=UTF-8''([^;]+)/);
        if (encoded) return decodeURIComponent(encoded[1]);
        const plain = disposition.match(/filename="([^"]+)"/);
        return plain ? plain[1] : fallback;
    }

    // A download needs the auth header, so it can't be a plain link - fetch the file and save the
    // blob under the name the server chose (Content-Disposition).
    async function exportFlowFiles(ids, btn) {
        const label = btn.innerText;
        btn.disabled = true;
        btn.innerText = 'Exporting...';
        try {
            const response = await fetch(`${API_BASE_URL}/api/admin/flows/export`, {
                method: 'POST',
                headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ ids })
            });
            if (!response.ok) {
                const err = await response.json().catch(() => ({}));
                throw new Error(err.error || `Export failed (${response.status})`);
            }
            const fileName = downloadFileName(response.headers.get('Content-Disposition') || '', 'flows.musicxml');
            const url = URL.createObjectURL(await response.blob());
            const a = document.createElement('a');
            a.href = url;
            a.download = fileName;
            document.body.appendChild(a);
            a.click();
            a.remove();
            setTimeout(() => URL.revokeObjectURL(url), 1000);
            showToast(`Exported ${ids.length} flow${ids.length === 1 ? '' : 's'} as ${fileName}`, 'success');
        } catch (error) {
            showToast(error.message);
        } finally {
            btn.disabled = false;
            btn.innerText = label;
            updateFlowsExportButton();
        }
    }

    async function postImportFile(endpoint, file) {
        const response = await fetch(`${API_BASE_URL}${endpoint}?fileName=${encodeURIComponent(file.name)}`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/octet-stream' },
            body: file
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error || `Import failed (${response.status})`);
        return data;
    }

    function plural(n, word) { return `${n} ${word}${n === 1 ? '' : 's'}`; }

    function renderImportPreview(preview) {
        const count = preview.flows.length;
        const failing = preview.flows.filter(f => f.errors.length).length;
        document.getElementById('flowsImportSummary').innerText = preview.ok
            ? `${plural(count, 'flow')} ready to import as your own private ${count === 1 ? 'flow' : 'flows'}.`
            : `${failing} of ${plural(count, 'flow')} can't be imported - nothing will be imported until ${failing === 1 ? 'it is' : 'they are'} fixed.`;
        document.getElementById('flowsImportList').innerHTML = preview.flows.map(f => {
            const meta = [
                escapeHtml(f.fileName),
                `${plural(f.blockCount, 'block')}, ${plural(f.totalBars, 'bar')}`,
                f.ownFormat ? 'TheMusicLedger export' : 'other software',
                f.youtubeCount ? plural(f.youtubeCount, 'YouTube link') : null,
                // ML-401: how often a public piece has been taken up - prepared as it is, or copied to a library
                f.ownership === 'public' ? `taken up ${f.preparedBy + f.copyCount} ${f.preparedBy + f.copyCount === 1 ? 'time' : 'times'} (${f.preparedBy} prepared it, ${f.copyCount} ${f.copyCount === 1 ? 'copy' : 'copies'})` : null,
                f.importTitle !== f.title ? 'renamed - title already in use' : null
            ].filter(Boolean).join(' &bull; ');
            return `
            <div class="admin-flows-import-item${f.errors.length ? ' has-errors' : ''}">
                <strong>${escapeHtml(f.importTitle)}</strong>
                <span class="admin-test-case-meta">${meta}</span>
                ${f.skippedMediaCount ? `<p class="admin-flows-import-note">${plural(f.skippedMediaCount, 'uploaded media file')} on the original not included.</p>` : ''}
                ${f.errors.map(e => `<p class="admin-flows-import-error">${escapeHtml(e)}</p>`).join('')}
                ${f.warnings.map(w => `<p class="admin-flows-import-note">${escapeHtml(w)}</p>`).join('')}
            </div>`;
        }).join('');
        const confirmBtn = document.getElementById('flowsImportConfirmBtn');
        confirmBtn.disabled = !preview.ok;
        confirmBtn.innerText = `Import ${plural(count, 'flow')}`;
    }

    function closeImportModal() {
        hideModal('flowsImportModal');
        pendingImportFile = null;
        document.getElementById('flowsImportFile').value = '';
    }

    async function onImportFileChosen(file) {
        if (!file) return;
        pendingImportFile = file;
        const btn = document.getElementById('flowsImportBtn');
        btn.disabled = true;
        btn.innerText = 'Reading...';
        try {
            renderImportPreview(await postImportFile('/api/admin/flows/import/preview', file));
            showModal('flowsImportModal');
        } catch (error) {
            showToast(error.message);
            pendingImportFile = null;
            document.getElementById('flowsImportFile').value = '';
        } finally {
            btn.disabled = false;
            btn.innerHTML = 'Import&hellip;';
        }
    }

    async function confirmImport() {
        if (!pendingImportFile) return;
        const btn = document.getElementById('flowsImportConfirmBtn');
        btn.disabled = true;
        btn.innerText = 'Importing...';
        try {
            const { imported } = await postImportFile('/api/admin/flows/import', pendingImportFile);
            closeImportModal();
            await reloadFlows();
            showToast(`Imported ${plural(imported.length, 'flow')}: ${imported.map(f => f.title).join(', ')}`, 'success');
        } catch (error) {
            showToast(error.message);
            btn.disabled = false;
            btn.innerText = 'Import';
        }
    }

    function initFlows() {
        document.getElementById('flowsFilter')?.addEventListener('input', renderFlows);
        document.getElementById('flowsExportSelectedBtn')?.addEventListener('click', (e) => {
            if (selectedFlowIds.size) exportFlowFiles([...selectedFlowIds], e.currentTarget);
        });
        document.getElementById('flowsImportBtn')?.addEventListener('click', () => document.getElementById('flowsImportFile').click());
        document.getElementById('flowsImportFile')?.addEventListener('change', (e) => onImportFileChosen(e.target.files[0]));
        document.getElementById('flowsImportCancelBtn')?.addEventListener('click', closeImportModal);
        document.getElementById('flowsImportConfirmBtn')?.addEventListener('click', confirmImport);
    }

    // ========================================
    // Warm-ups (ML-294) - the Warm-ups tool's exercises: list (in play order, grouped by kind), add /
    // edit with a tap-to-build note editor, switch on/off, move up/down, delete. Checked as you go
    // with public/warmups.js - the same engine the server checks every save with.
    // ========================================
    const W = window.Warmups;
    let warmupsAdmin = [];
    let warmupEditing = null;   // { id|null, notes: [...], selected: index|null, undo: [] }
    const warmupKindLabel = (id) => (W.KINDS.find(k => k.id === id) || {}).label || id;
    const WARMUP_KEYS = ['C#', 'D#', 'F#', 'G#', 'A#', 'C', 'D', 'E', 'F', 'G', 'A', 'B', 'Db', 'Eb', 'Gb', 'Ab', 'Bb'];
    const warmupKeyLabel = (n) => n.replace('#', '♯').replace(/^([A-G])b$/, '$1♭');

    function warmupStaveHtml(ex, clef, { firstRowOnly = false, label } = {}) {
        const rows = W.rows(ex, clef);
        const stepRange = W.stepRange(ex, clef);
        return (firstRowOnly ? rows.slice(0, 1) : rows)
            .map(r => Notation.staff({ clef, items: r.items, spans: r.spans, stepRange, noteGap: 2.2, justify: 60, label: label ? `${label}, notes ${r.from + 1} to ${r.to + 1}` : undefined }))
            .join('');
    }

    function renderWarmupsAdmin() {
        const el = document.getElementById('warmupsAdminList');
        if (!warmupsAdmin.length) { el.innerHTML = '<p>No exercises yet.</p>'; return; }
        let html = '', lastKind = null;
        warmupsAdmin.forEach((ex, i) => {
            if (ex.kind !== lastKind) {
                const n = warmupsAdmin.filter(x => x.kind === ex.kind).length;
                html += `<h2 class="admin-warmup-kind">${escapeHtml(warmupKindLabel(ex.kind))} (${n})</h2>`;
                lastKind = ex.kind;
            }
            const bars = W.check(ex).bars.length;
            html += `
            <div class="admin-feature${ex.isActive ? '' : ' admin-warmup-off'}">
                <div class="admin-feature-header">
                    <div class="admin-feature-header-text">
                        <h2>${escapeHtml(ex.title)}</h2>
                        <p class="admin-test-case-meta">${ex.bpm} bpm &bull; ${bars} bar${bars === 1 ? '' : 's'} in ${ex.beatsPerBar}/4${ex.isActive ? '' : ' &bull; switched off'}</p>
                        ${ex.tip ? `<p>${escapeHtml(ex.tip)}</p>` : ''}
                        <div class="admin-warmup-row-preview">${warmupStaveHtml(ex, 'treble', { firstRowOnly: true, label: ex.title })}</div>
                    </div>
                    <div class="admin-feature-actions">
                        <button class="btn-edit" type="button" data-warmup-up="${ex.id}" aria-label="Move ${escapeHtml(ex.title)} earlier"${i === 0 ? ' disabled' : ''}>&uarr;</button>
                        <button class="btn-edit" type="button" data-warmup-down="${ex.id}" aria-label="Move ${escapeHtml(ex.title)} later"${i === warmupsAdmin.length - 1 ? ' disabled' : ''}>&darr;</button>
                        <button class="btn-edit" type="button" data-warmup-edit="${ex.id}">Edit</button>
                        <button class="btn-edit" type="button" data-warmup-active="${ex.id}">${ex.isActive ? 'Switch off' : 'Switch on'}</button>
                        <button class="btn-delete" type="button" data-warmup-delete="${ex.id}">Delete</button>
                    </div>
                </div>
            </div>`;
        });
        el.innerHTML = html;
        const byId = (id) => warmupsAdmin.find(x => x.id === Number(id));
        el.querySelectorAll('[data-warmup-edit]').forEach(b => b.addEventListener('click', () => openWarmupForm(byId(b.dataset.warmupEdit))));
        el.querySelectorAll('[data-warmup-up]').forEach(b => b.addEventListener('click', () => moveWarmupAdmin(b.dataset.warmupUp, -1)));
        el.querySelectorAll('[data-warmup-down]').forEach(b => b.addEventListener('click', () => moveWarmupAdmin(b.dataset.warmupDown, 1)));
        el.querySelectorAll('[data-warmup-active]').forEach(b => b.addEventListener('click', async () => {
            const ex = byId(b.dataset.warmupActive);
            try { await apiCall(`/api/admin/warmups/${ex.id}/active`, 'PUT', { isActive: !ex.isActive }); await reloadWarmupsAdmin(); }
            catch (error) { showToast('Error: ' + error.message); }
        }));
        el.querySelectorAll('[data-warmup-delete]').forEach(b => b.addEventListener('click', () => {
            const ex = byId(b.dataset.warmupDelete);
            showConfirmModal('Delete exercise?', `"${ex.title}" will be removed from the Warm-ups tool. Switch it off instead to keep it.`, async () => {
                try { await apiCall(`/api/admin/warmups/${ex.id}`, 'DELETE'); await reloadWarmupsAdmin(); showToast('Exercise deleted', 'success'); }
                catch (error) { showToast('Error: ' + error.message); }
            });
        }));
    }
    async function reloadWarmupsAdmin() {
        try {
            warmupsAdmin = (await apiCall('/api/admin/warmups')).exercises;
            renderWarmupsAdmin();
        } catch (error) {
            document.getElementById('warmupsAdminList').innerHTML = `<p>Error loading warm-ups: ${escapeHtml(error.message)}</p>`;
        }
    }
    async function moveWarmupAdmin(id, direction) {
        try { warmupsAdmin = (await apiCall(`/api/admin/warmups/${id}/move`, 'PUT', { direction })).exercises; renderWarmupsAdmin(); }
        catch (error) { showToast('Error: ' + error.message); }
    }

    // --- The editor ---
    const warmupRadio = (name) => document.querySelector(`input[name="${name}"]:checked`)?.value;
    function warmupSetRadio(name, value) { const el = document.getElementById(`${name}-${value}`); if (el) el.checked = true; }
    function warmupDraft() {
        return {
            title: document.getElementById('warmupTitleInput').value,
            kind: document.getElementById('warmupKindInput').value,
            tip: document.getElementById('warmupTipInput').value,
            bpm: Number(document.getElementById('warmupBpmInput').value),
            beatsPerBar: Number(document.getElementById('warmupBeatsInput').value),
            isActive: document.getElementById('warmupActiveInput').checked,
            notes: warmupEditing.notes,
        };
    }
    // Selecting a note shows its own length, so tapping another length changes it.
    function warmupSyncLength() {
        const n = warmupEditing.selected !== null ? warmupEditing.notes[warmupEditing.selected] : null;
        if (!n) return;
        warmupSetRadio('warmupLength', n.d);
        document.getElementById('warmupDotInput').checked = !!n.dot;
    }
    function renderWarmupEditor() {
        const draft = warmupDraft();
        const clef = warmupRadio('warmupPreviewClef') || 'treble';
        const preview = document.getElementById('warmupPreview');
        const check = W.check(draft);
        preview.innerHTML = draft.notes.length && draft.beatsPerBar ? warmupStaveHtml(draft, clef) : '<p class="text-muted">No notes yet - choose a length, then tap a note below.</p>';
        const sel = warmupEditing.selected;
        if (sel !== null) preview.querySelectorAll(`.warmup-note-${sel}`).forEach(el => el.classList.add('is-selected'));
        preview.querySelectorAll('.warmup-note').forEach(el => el.addEventListener('click', () => {
            const i = Number((/warmup-note-(\d+)/.exec(el.getAttribute('class')) || [])[1]);
            warmupEditing.selected = warmupEditing.selected === i ? null : i;
            warmupSyncLength();
            renderWarmupEditor();
        }));
        const status = document.getElementById('warmupStatus');
        const bars = check.bars.length;
        status.textContent = check.ok
            ? `${draft.notes.length} note${draft.notes.length === 1 ? '' : 's'}, ${bars} bar${bars === 1 ? '' : 's'}${check.shortLast ? ' (the last bar is short - fine to end on)' : ''}.${sel !== null ? ` Note ${sel + 1} selected: a tap on a note replaces it.` : ''}`
            : check.errors.join(' ');
        status.classList.toggle('has-errors', !check.ok);
        document.getElementById('warmupFormSaveBtn').disabled = !check.ok;
        document.getElementById('warmupDeleteNoteBtn').disabled = sel === null;
        document.getElementById('warmupAddEndBtn').disabled = sel === null;
        document.getElementById('warmupUndoBtn').disabled = !warmupEditing.undo.length;
        // ML-361: slur the selected note to the next one (not from a rest, not the last note)
        const slurBtn = document.getElementById('warmupSlurBtn');
        const selNote = sel !== null ? draft.notes[sel] : null;
        const nextNote = sel !== null ? draft.notes[sel + 1] : null;
        slurBtn.disabled = !selNote || selNote.p === null || !nextNote || nextNote.p === null;
        slurBtn.setAttribute('aria-pressed', String(!!(selNote && selNote.sl)));
        slurBtn.textContent = selNote && selNote.sl ? 'Remove slur' : 'Slur to next note';
    }
    function warmupChangeNotes(fn) {
        warmupEditing.undo.push(JSON.stringify(warmupEditing.notes));
        if (warmupEditing.undo.length > 100) warmupEditing.undo.shift();
        fn(warmupEditing.notes);
        renderWarmupEditor();
    }
    // Tap a key (or Rest): with a note selected, replace it (and move on to the next); otherwise add at the end.
    function warmupPut(pitch) {
        const note = { p: pitch, d: warmupRadio('warmupLength') || 'q' };
        if (document.getElementById('warmupDotInput').checked && note.d !== 'e') note.dot = true;
        warmupChangeNotes((notes) => {
            const sel = warmupEditing.selected;
            if (sel === null) notes.push(note);
            else { if (notes[sel].sl && note.p !== null) note.sl = true; notes[sel] = note; warmupEditing.selected = sel + 1 < notes.length ? sel + 1 : null; }
        });
    }
    function openWarmupForm(ex) {
        warmupEditing = { id: ex ? ex.id : null, notes: ex ? JSON.parse(JSON.stringify(ex.notes)) : [], selected: null, undo: [] };
        document.getElementById('warmupFormTitle').innerText = ex ? 'Edit exercise' : 'New exercise';
        const kind = document.getElementById('warmupKindInput');
        kind.innerHTML = W.KINDS.map(k => `<option value="${k.id}">${escapeHtml(k.label)}</option>`).join('');
        kind.value = ex ? ex.kind : W.KINDS[0].id;
        document.getElementById('warmupTitleInput').value = ex ? ex.title : '';
        document.getElementById('warmupTipInput').value = ex ? ex.tip : '';
        document.getElementById('warmupBpmInput').value = ex ? ex.bpm : 72;
        document.getElementById('warmupBeatsInput').value = String(ex ? ex.beatsPerBar : 4);
        document.getElementById('warmupActiveInput').checked = ex ? ex.isActive : true;
        warmupSetRadio('warmupPreviewClef', 'treble');
        warmupSetRadio('warmupLength', 'q');
        warmupSetRadio('warmupOctave', '4');
        document.getElementById('warmupDotInput').checked = false;
        document.getElementById('warmupKeyboard').innerHTML = WARMUP_KEYS.map(n => `<button type="button" class="flow-picker-tile" data-id="${n}"><span class="flow-picker-tile-icon-row">${warmupKeyLabel(n)}</span></button>`).join('');
        document.querySelectorAll('#warmupKeyboard .flow-picker-tile').forEach(b => b.addEventListener('click', () => warmupPut(b.dataset.id + (warmupRadio('warmupOctave') || '4'))));
        renderWarmupEditor();
        showModal('warmupFormModal');
    }
    function closeWarmupForm() { hideModal('warmupFormModal'); warmupEditing = null; }
    async function saveWarmupForm() {
        const body = warmupDraft();
        const btn = document.getElementById('warmupFormSaveBtn');
        btn.disabled = true;
        btn.innerText = 'Saving...';
        try {
            if (warmupEditing.id) await apiCall(`/api/admin/warmups/${warmupEditing.id}`, 'PUT', body);
            else await apiCall('/api/admin/warmups', 'POST', body);
            closeWarmupForm();
            await reloadWarmupsAdmin();
            showToast('Exercise saved', 'success');
        } catch (error) {
            showToast('Error saving: ' + error.message);
        } finally {
            btn.innerText = 'Save';
            if (warmupEditing) renderWarmupEditor();
        }
    }
    document.getElementById('addWarmupBtn')?.addEventListener('click', () => openWarmupForm(null));
    document.getElementById('warmupFormCancelBtn')?.addEventListener('click', closeWarmupForm);
    document.getElementById('warmupFormSaveBtn')?.addEventListener('click', saveWarmupForm);
    document.getElementById('warmupRestBtn')?.addEventListener('click', () => warmupPut(null));
    document.getElementById('warmupDeleteNoteBtn')?.addEventListener('click', () => {
        const sel = warmupEditing.selected;
        if (sel === null) return;
        warmupChangeNotes((notes) => { notes.splice(sel, 1); warmupEditing.selected = notes.length ? Math.min(sel, notes.length - 1) : null; });
    });
    document.getElementById('warmupAddEndBtn')?.addEventListener('click', () => { warmupEditing.selected = null; renderWarmupEditor(); });
    document.getElementById('warmupSlurBtn')?.addEventListener('click', () => {
        const sel = warmupEditing.selected;
        if (sel === null) return;
        warmupChangeNotes((notes) => { if (notes[sel].sl) delete notes[sel].sl; else notes[sel].sl = true; });
    });
    document.getElementById('warmupUndoBtn')?.addEventListener('click', () => {
        const prev = warmupEditing.undo.pop();
        if (prev === undefined) return;
        warmupEditing.notes = JSON.parse(prev);
        warmupEditing.selected = null;
        renderWarmupEditor();
    });
    const warmupStep = (d) => {
        const n = warmupEditing.notes.length;
        if (!n) return;
        const sel = warmupEditing.selected;
        warmupEditing.selected = sel === null ? (d < 0 ? n - 1 : 0) : Math.max(0, Math.min(n - 1, sel + d));
        warmupSyncLength();
        renderWarmupEditor();
    };
    document.getElementById('warmupPrevNoteBtn')?.addEventListener('click', () => warmupStep(-1));
    document.getElementById('warmupNextNoteBtn')?.addEventListener('click', () => warmupStep(1));
    ['warmupTitleInput', 'warmupTipInput', 'warmupBpmInput', 'warmupBeatsInput', 'warmupActiveInput'].forEach(id => document.getElementById(id)?.addEventListener('input', () => warmupEditing && renderWarmupEditor()));
    document.querySelectorAll('input[name="warmupPreviewClef"]').forEach(r => r.addEventListener('change', () => warmupEditing && renderWarmupEditor()));
    // A different length re-lengthens the selected note straight away.
    document.querySelectorAll('input[name="warmupLength"], #warmupDotInput').forEach(r => r.addEventListener('change', () => {
        const sel = warmupEditing && warmupEditing.selected;
        if (sel === null || sel === undefined) return;
        const d = warmupRadio('warmupLength');
        const dot = document.getElementById('warmupDotInput').checked && d !== 'e';
        warmupChangeNotes((notes) => { notes[sel] = { p: notes[sel].p, d, ...(dot ? { dot: true } : {}) }; });
    }));
    document.getElementById('warmupFormModal')?.addEventListener('click', (e) => { if (e.target === e.currentTarget) closeWarmupForm(); });

    // ========================================
    // Notifications (ML-201) - announcements for every account's ☰ -> Notifications. "Live" is
    // computed server-side from the clock (no scheduler), so a scheduled one just starts appearing.
    // ========================================
    const NOTIFICATION_STATUS_LABELS = { live: 'Live', scheduled: 'Scheduled', expired: 'Expired', withdrawn: 'Withdrawn' };
    let notificationsById = new Map();
    let editingNotificationId = null;

    // <input type="datetime-local"> works in local time with no zone: ISO -> "YYYY-MM-DDTHH:mm" local.
    function toLocalInputValue(iso) {
        if (!iso) return '';
        const d = new Date(iso);
        const pad = (n) => String(n).padStart(2, '0');
        return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
    }
    function fromLocalInputValue(value) {
        return value ? new Date(value).toISOString() : null;
    }

    function renderNotificationsAdmin(data) {
        const el = document.getElementById('notificationsAdminList');
        notificationsById = new Map(data.notifications.map(n => [n.id, n]));
        if (!data.notifications.length) {
            el.innerHTML = '<p>No notifications yet.</p>';
            return;
        }
        el.innerHTML = data.notifications.map(n => `
            <div class="admin-feature">
                <div class="admin-feature-header">
                    <div class="admin-feature-header-text">
                        <h2>${escapeHtml(n.title)}</h2>
                        <p class="admin-test-case-meta">${n.status === 'scheduled' ? 'Publishes' : 'Published'} ${escapeHtml(fmtDate(n.publishAt))}${
                            n.expiresAt ? ` &bull; ${n.status === 'expired' ? 'expired' : 'expires'} ${escapeHtml(fmtDate(n.expiresAt))}` : ''}${
                            n.createdBy ? ` &bull; by ${escapeHtml(n.createdBy)}` : ''}</p>
                        <p class="admin-notification-body">${escapeHtml(n.body)}</p>
                        <div class="admin-feedback-badges">
                            <span class="admin-feedback-badge notification-status-${n.status}">${NOTIFICATION_STATUS_LABELS[n.status] || n.status}</span>
                            ${n.urgent ? '<span class="admin-feedback-badge notification-status-urgent">Urgent</span>' : ''}
                            <span class="admin-feedback-badge cat">Read by ${n.readCount} of ${data.accountCount}</span>
                        </div>
                    </div>
                    <div class="admin-feature-actions">
                        <button class="btn-edit" type="button" data-notification-edit="${n.id}">Edit</button>
                        <button class="btn-edit" type="button" data-notification-withdraw="${n.id}">${n.status === 'withdrawn' ? 'Restore' : 'Withdraw'}</button>
                        <button class="btn-delete" type="button" data-notification-delete="${n.id}">Delete</button>
                    </div>
                </div>
            </div>`).join('');
        el.querySelectorAll('[data-notification-edit]').forEach(btn => btn.addEventListener('click', () => openNotificationForm(notificationsById.get(Number(btn.dataset.notificationEdit)))));
        el.querySelectorAll('[data-notification-withdraw]').forEach(btn => btn.addEventListener('click', () => toggleNotificationWithdrawn(Number(btn.dataset.notificationWithdraw))));
        el.querySelectorAll('[data-notification-delete]').forEach(btn => btn.addEventListener('click', () => deleteNotificationAdmin(Number(btn.dataset.notificationDelete))));
    }

    async function reloadNotificationsAdmin() {
        try {
            renderNotificationsAdmin(await apiCall('/api/admin/notifications'));
        } catch (error) {
            document.getElementById('notificationsAdminList').innerHTML = `<p>Error loading notifications: ${escapeHtml(error.message)}</p>`;
        }
    }

    function syncNotificationPublishMode() {
        const scheduled = document.getElementById('notificationPublishMode').value === 'scheduled';
        document.getElementById('notificationPublishAtGroup').classList.toggle('hidden-group', !scheduled);
    }

    function openNotificationForm(n) {
        editingNotificationId = n ? n.id : null;
        document.getElementById('notificationFormTitle').innerText = n ? 'Edit notification' : 'New notification';
        document.getElementById('notificationTitleInput').value = n ? n.title : '';
        document.getElementById('notificationBodyInput').value = n ? n.body : '';
        // An existing notification keeps its own publish time unless it's changed here.
        const scheduled = !!n;
        document.getElementById('notificationPublishMode').value = scheduled ? 'scheduled' : 'now';
        document.getElementById('notificationPublishAtInput').value = n ? toLocalInputValue(n.publishAt) : '';
        document.getElementById('notificationExpiresAtInput').value = n ? toLocalInputValue(n.expiresAt) : '';
        document.getElementById('notificationUrgentInput').checked = !!(n && n.urgent); // ML-167
        syncNotificationPublishMode();
        showModal('notificationFormModal');
    }
    function closeNotificationForm() {
        hideModal('notificationFormModal');
        editingNotificationId = null;
    }

    async function saveNotificationForm() {
        const scheduled = document.getElementById('notificationPublishMode').value === 'scheduled';
        const publishValue = document.getElementById('notificationPublishAtInput').value;
        if (scheduled && !publishValue) { showToast('Choose when to publish it.'); return; }
        const body = {
            title: document.getElementById('notificationTitleInput').value,
            body: document.getElementById('notificationBodyInput').value,
            publishAt: scheduled ? fromLocalInputValue(publishValue) : null,
            expiresAt: fromLocalInputValue(document.getElementById('notificationExpiresAtInput').value),
            urgent: document.getElementById('notificationUrgentInput').checked // ML-167
        };
        const btn = document.getElementById('notificationFormSaveBtn');
        btn.disabled = true;
        btn.innerText = 'Saving...';
        try {
            if (editingNotificationId) await apiCall(`/api/admin/notifications/${editingNotificationId}`, 'PUT', body);
            else await apiCall('/api/admin/notifications', 'POST', body);
            closeNotificationForm();
            await reloadNotificationsAdmin();
            showToast(scheduled ? 'Notification scheduled' : 'Notification published', 'success');
        } catch (error) {
            showToast(error.message);
        } finally {
            btn.disabled = false;
            btn.innerText = 'Save';
        }
    }

    async function toggleNotificationWithdrawn(id) {
        const n = notificationsById.get(id);
        if (!n) return;
        try {
            await apiCall(`/api/admin/notifications/${id}/withdrawn`, 'PUT', { withdrawn: n.status !== 'withdrawn' });
            await reloadNotificationsAdmin();
            showToast(n.status === 'withdrawn' ? 'Notification restored' : 'Notification withdrawn', 'success');
        } catch (error) {
            showToast(error.message);
        }
    }

    function deleteNotificationAdmin(id) {
        const n = notificationsById.get(id);
        showConfirmModal('Delete notification', `Delete "${n ? n.title : 'this notification'}" and its read history? Withdraw instead to hide it but keep the numbers.`, async () => {
            try {
                await apiCall(`/api/admin/notifications/${id}`, 'DELETE');
                await reloadNotificationsAdmin();
                showToast('Notification deleted', 'success');
            } catch (error) {
                showToast(error.message);
            }
        });
    }

    function initNotificationsAdmin() {
        document.getElementById('addNotificationBtn')?.addEventListener('click', () => openNotificationForm(null));
        document.getElementById('notificationPublishMode')?.addEventListener('change', syncNotificationPublishMode);
        document.getElementById('notificationFormCancelBtn')?.addEventListener('click', closeNotificationForm);
        document.getElementById('notificationFormSaveBtn')?.addEventListener('click', saveNotificationForm);
    }

    // ========================================
    // Rest messages (ML-390) - what the 30-second rest between practice blocks shows. Add, change,
    // switch off, move up/down, delete - straight away, no release. Grouped by kind, in the order kept here
    // (players get their own shuffle; see services/restMessages.js).
    // ========================================
    const REST_KIND_ADMIN = { why: 'Why we stop', breathe: 'Breathe', body: 'Loosen up', think: 'Think like a musician', fact: 'Did you know?', care: 'Look after yourself', kind: 'Kind words' };
    const REST_AUDIENCE_ADMIN = { all: 'Everyone', brass: 'Brass players', wind: 'Brass and woodwind' };
    let restMessagesAdmin = [];
    let editingRestMessageId = null;
    function renderRestMessagesAdmin() {
        const el = document.getElementById('restMessagesAdminList');
        if (!el) return;
        if (!restMessagesAdmin.length) { el.innerHTML = '<p>No messages yet - the rest shows a breathing circle on its own.</p>'; return; }
        const order = Object.keys(REST_KIND_ADMIN);
        const sorted = restMessagesAdmin.slice().sort((a, b) => order.indexOf(a.kind) - order.indexOf(b.kind));
        let html = '', lastKind = null;
        sorted.forEach(m => {
            if (m.kind !== lastKind) {
                const all = restMessagesAdmin.filter(x => x.kind === m.kind);
                html += `<h2 class="admin-warmup-kind">${escapeHtml(REST_KIND_ADMIN[m.kind] || m.kind)} (${all.filter(x => x.active).length} on${all.some(x => !x.active) ? `, ${all.filter(x => !x.active).length} off` : ''})</h2>`;
                lastKind = m.kind;
            }
            const i = restMessagesAdmin.indexOf(m);
            html += `
            <div class="admin-feature${m.active ? '' : ' admin-warmup-off'}">
                <div class="admin-feature-header">
                    <div class="admin-feature-header-text">
                        <h2><span class="material-symbols-outlined" aria-hidden="true">${escapeHtml(m.kind === 'breathe' ? 'air' : m.icon)}</span> ${escapeHtml(m.title)}</h2>
                        <p>${escapeHtml(m.body)}</p>
                        <p class="admin-test-case-meta">For ${escapeHtml(REST_AUDIENCE_ADMIN[m.audience] || m.audience)}${m.active ? '' : ' &bull; switched off'}</p>
                    </div>
                    <div class="admin-feature-actions">
                        <button class="btn-edit" type="button" data-rest-move="${m.id}" data-dir="-1" aria-label="Move ${escapeHtml(m.title)} earlier"${i === 0 ? ' disabled' : ''}>&uarr;</button>
                        <button class="btn-edit" type="button" data-rest-move="${m.id}" data-dir="1" aria-label="Move ${escapeHtml(m.title)} later"${i === restMessagesAdmin.length - 1 ? ' disabled' : ''}>&darr;</button>
                        <button class="btn-edit" type="button" data-rest-edit="${m.id}">Edit</button>
                        <button class="btn-edit" type="button" data-rest-active="${m.id}">${m.active ? 'Switch off' : 'Switch on'}</button>
                        <button class="btn-delete" type="button" data-rest-delete="${m.id}">Delete</button>
                    </div>
                </div>
            </div>`;
        });
        el.innerHTML = html;
        const byId = (id) => restMessagesAdmin.find(x => x.id === Number(id));
        el.querySelectorAll('[data-rest-edit]').forEach(b => b.addEventListener('click', () => openRestMessageForm(byId(b.dataset.restEdit))));
        el.querySelectorAll('[data-rest-move]').forEach(b => b.addEventListener('click', async () => {
            try { restMessagesAdmin = (await apiCall(`/api/admin/rest-messages/${b.dataset.restMove}/move`, 'PUT', { dir: Number(b.dataset.dir) })).messages; renderRestMessagesAdmin(); }
            catch (error) { showToast('Error: ' + error.message); }
        }));
        el.querySelectorAll('[data-rest-active]').forEach(b => b.addEventListener('click', async () => {
            const m = byId(b.dataset.restActive);
            try { await apiCall(`/api/admin/rest-messages/${m.id}/active`, 'PUT', { active: !m.active }); await reloadRestMessagesAdmin(); }
            catch (error) { showToast('Error: ' + error.message); }
        }));
        el.querySelectorAll('[data-rest-delete]').forEach(b => b.addEventListener('click', () => {
            const m = byId(b.dataset.restDelete);
            showConfirmModal('Delete message?', `"${m.title}" won't be shown in any rest again. Switch it off instead to keep it.`, async () => {
                try { await apiCall(`/api/admin/rest-messages/${m.id}`, 'DELETE'); await reloadRestMessagesAdmin(); showToast('Message deleted', 'success'); }
                catch (error) { showToast('Error: ' + error.message); }
            });
        }));
    }
    async function reloadRestMessagesAdmin() {
        try {
            restMessagesAdmin = (await apiCall('/api/admin/rest-messages')).messages;
            renderRestMessagesAdmin();
        } catch (error) {
            const el = document.getElementById('restMessagesAdminList');
            if (el) el.innerHTML = `<p>Error loading rest messages: ${escapeHtml(error.message)}</p>`;
        }
    }
    function syncRestMessageIconPreview() {
        const kind = document.getElementById('restMessageKindInput').value;
        const icon = document.getElementById('restMessageIconInput').value.trim();
        document.getElementById('restMessageIconPreview').textContent = kind === 'breathe' ? 'air' : (icon || 'self_improvement');
    }
    function openRestMessageForm(m) {
        editingRestMessageId = m ? m.id : null;
        document.getElementById('restMessageFormTitle').innerText = m ? 'Edit rest message' : 'New rest message';
        document.getElementById('restMessageKindInput').value = m ? m.kind : 'why';
        document.getElementById('restMessageTitleInput').value = m ? m.title : '';
        document.getElementById('restMessageBodyInput').value = m ? m.body : '';
        document.getElementById('restMessageIconInput').value = m ? m.icon : '';
        document.getElementById('restMessageAudienceInput').value = m ? m.audience : 'all';
        syncRestMessageIconPreview();
        showModal('restMessageFormModal');
        document.getElementById('restMessageTitleInput').focus();
    }
    async function saveRestMessageForm() {
        const existing = editingRestMessageId ? restMessagesAdmin.find(x => x.id === editingRestMessageId) : null;
        const body = {
            kind: document.getElementById('restMessageKindInput').value,
            title: document.getElementById('restMessageTitleInput').value,
            body: document.getElementById('restMessageBodyInput').value,
            icon: document.getElementById('restMessageIconInput').value.trim() || 'self_improvement',
            audience: document.getElementById('restMessageAudienceInput').value,
            active: existing ? existing.active : true
        };
        const btn = document.getElementById('restMessageFormSaveBtn');
        btn.disabled = true;
        try {
            if (editingRestMessageId) await apiCall(`/api/admin/rest-messages/${editingRestMessageId}`, 'PUT', body);
            else await apiCall('/api/admin/rest-messages', 'POST', body);
            hideModal('restMessageFormModal');
            editingRestMessageId = null;
            await reloadRestMessagesAdmin();
            showToast('Rest message saved', 'success');
        } catch (error) {
            showToast(error.message);
        } finally {
            btn.disabled = false;
        }
    }
    function initRestMessagesAdmin() {
        document.getElementById('addRestMessageBtn')?.addEventListener('click', () => openRestMessageForm(null));
        document.getElementById('restMessageFormCancelBtn')?.addEventListener('click', () => { hideModal('restMessageFormModal'); editingRestMessageId = null; });
        document.getElementById('restMessageFormSaveBtn')?.addEventListener('click', saveRestMessageForm);
        document.getElementById('restMessageIconInput')?.addEventListener('input', syncRestMessageIconPreview);
        document.getElementById('restMessageKindInput')?.addEventListener('change', syncRestMessageIconPreview);
    }

    // ========================================
    // Security (ML-192) - repeatable review of the OMR service. Everything below is read-only
    // except "Run now", which re-runs the automated checks server-side and records them. The deep
    // review's results come from the repo (server/securityReviews/), shown alongside.
    // ========================================
    const SECURITY_STATUS_LABELS = { pass: 'Pass', warn: 'Warn', fail: 'Fail', info: 'Info', not_run: 'Not run', error: 'Error' };
    // Maps a result status onto an .admin-badge modifier (pill-badge spec) - "error" is a failure
    // of the check itself, shown the same way as a failed check so it can't be missed.
    const SECURITY_BADGE_CLASS = { pass: 'pass', warn: 'warn', fail: 'fail', info: 'info', not_run: 'never', error: 'fail' };
    const VERDICT_LABELS = { go: ['pass', 'Go'], conditional: ['warn', 'Conditional'], 'no-go': ['fail', 'Not yet'] };

    function securityBadge(status) {
        return `<span class="admin-badge ${SECURITY_BADGE_CLASS[status] || 'never'}">${SECURITY_STATUS_LABELS[status] || 'Never run'}</span>`;
    }

    const shortSha = (sha) => (sha ? String(sha).slice(0, 8) : '-');
    const fmtDay = (iso) => (iso ? new Date(iso).toLocaleDateString() : '-');

    function renderSecurityEvidence(lines) {
        if (!lines || !lines.length) return '';
        return `<ul class="admin-security-evidence">${lines.map((l) => `<li>${escapeHtml(l)}</li>`).join('')}</ul>`;
    }

    function renderSecurityCheck(check, result) {
        const kindLabel = check.mode === 'automated' ? 'Automated' : 'Deep review';
        const meta = result
            ? `${kindLabel} &middot; ${fmtDate(result.at)} &middot; ${securityWord()} ${escapeHtml(shortSha(result.upstreamCommitSha))}`
            : `${kindLabel} &middot; never run`;
        return `
            <div class="admin-test-case">
                <div class="admin-feature-header-text">
                    <div class="admin-security-head">
                        <div class="admin-test-case-title">${escapeHtml(check.title)}</div>
                        ${securityBadge(result ? result.status : null)}
                    </div>
                    <div class="admin-test-case-meta">${meta}</div>
                    ${result ? `<p class="admin-run-notes">${escapeHtml(result.summary)}</p>` : ''}
                    <details class="admin-security-details">
                        <summary>Evidence and how to re-run</summary>
                        ${result ? renderSecurityEvidence(result.details) : ''}
                        <p class="admin-run-notes"><strong>How to re-run:</strong> ${escapeHtml(check.rerun)}</p>
                    </details>
                </div>
            </div>`;
    }

    function renderSecurityHistoryRun(run, checksByKey) {
        const counts = Object.entries(run.counts || {})
            .sort(([a], [b]) => Object.keys(SECURITY_STATUS_LABELS).indexOf(a) - Object.keys(SECURITY_STATUS_LABELS).indexOf(b))
            .map(([status, n]) => `${n} ${SECURITY_STATUS_LABELS[status]?.toLowerCase() || status}`).join(', ');
        const verdict = run.verdict ? VERDICT_LABELS[run.verdict.status] : null;
        return `
            <div class="admin-test-case">
                <details class="admin-security-details">
                    <summary>${fmtDate(run.at)} &middot; ${run.kind === 'automated' ? 'Automated run' : 'Deep review'}${run.by ? ` by ${escapeHtml(run.by)}` : ''} &middot; ${escapeHtml(counts || 'no results')}</summary>
                    <p class="admin-test-case-meta">${securityTarget === 'site' ? 'App version' : 'Upstream commit'} ${escapeHtml(shortSha(run.upstreamCommitSha))}${verdict ? ` &middot; verdict: ${verdict[1]}` : ''}</p>
                    ${run.tools && run.tools.length ? `<p class="admin-run-notes"><strong>Tools:</strong> ${run.tools.map(escapeHtml).join('; ')}</p>` : ''}
                    ${run.results.map((r) => `
                        <div class="admin-run-row">
                            <div class="admin-run-when">${securityBadge(r.status)}</div>
                            <div class="admin-run-detail">
                                <strong>${escapeHtml(checksByKey.get(r.checkKey)?.title || r.checkKey)}</strong>
                                <p class="admin-run-notes">${escapeHtml(r.summary)}</p>
                                ${renderSecurityEvidence(r.details)}
                            </div>
                        </div>`).join('')}
                </details>
            </div>`;
    }

    function renderSecurityReview(data) {
        const el = document.getElementById('securityReview');
        const checksByKey = new Map(data.checks.map((c) => [c.key, c]));
        const verdict = data.verdict ? VERDICT_LABELS[data.verdict.status] : null;
        const deep = data.lastDeepReview;
        const auto = data.lastAutomatedRun;
        const t = data.target;

        const tiles = `
            <div class="admin-stat-tiles">
                <div class="admin-stat-tile"><div class="admin-stat-tile-label">Verdict</div><div class="admin-stat-tile-value">${verdict ? verdict[1] : '-'}</div></div>
                <div class="admin-stat-tile"><div class="admin-stat-tile-label">Last deep review</div><div class="admin-stat-tile-value">${fmtDay(deep?.at)}</div><div class="admin-stat-tile-sub">${securityWord()} ${escapeHtml(shortSha(deep?.upstreamCommitSha))}</div></div>
                <div class="admin-stat-tile"><div class="admin-stat-tile-label">Last automated run</div><div class="admin-stat-tile-value">${auto ? fmtDay(auto.at) : 'Never'}</div><div class="admin-stat-tile-sub">${data.automatedRunDue ? `Due - over ${data.automatedDueAfterDays} days` : 'Up to date'}</div></div>
                <div class="admin-stat-tile"><div class="admin-stat-tile-label">${escapeHtml(t.changeLabel || 'Upstream since deep review')}</div><div class="admin-stat-tile-value">${!auto ? 'Unknown' : data.upstreamChangedSinceDeepReview ? 'Changed' : 'Unchanged'}</div><div class="admin-stat-tile-sub">${auto ? `${securityTarget === 'site' ? 'now on' : 'head'} ${escapeHtml(shortSha(auto.upstreamCommitSha))}` : 'run the automated checks'}</div></div>
            </div>`;

        const verdictCard = `
            <div class="admin-feature">
                <div class="admin-feature-header">
                    <div class="admin-feature-header-text">
                        <h2>${escapeHtml(t.name)}</h2>
                        <p><a href="https://github.com/${encodeURI(t.repo)}" target="_blank" rel="noopener">github.com/${escapeHtml(t.repo)}</a> &middot; <a href="https://bestbit2000.atlassian.net/browse/${encodeURIComponent(t.jiraKey)}" target="_blank" rel="noopener">${escapeHtml(t.jiraKey)}</a> &middot; gates <code>${escapeHtml(t.gatedFeature)}</code></p>
                    </div>
                    ${verdict ? `<span class="admin-badge ${verdict[0]}">${verdict[1]}</span>` : ''}
                </div>
                ${data.verdict ? `
                <div class="admin-test-case">
                    <p class="admin-run-notes">${escapeHtml(data.verdict.summary)}</p>
                    <ul class="admin-security-evidence">
                        ${(data.verdict.conditions || []).map((c) => `<li><strong>${c.done ? 'Done' : 'To do'}:</strong> ${escapeHtml(c.text)}</li>`).join('')}
                    </ul>
                    ${data.upstreamChangedSinceDeepReview ? `<p class="admin-run-notes"><strong>${securityTarget === 'site' ? 'A release has gone out since this verdict' : 'The upstream repo has changed since this verdict'}</strong> - re-run the deep review before relying on it.</p>` : ''}
                </div>` : ''}
            </div>`;

        const sections = data.sections.map((section) => {
            const checks = data.checks.filter((c) => c.section === section.key);
            if (!checks.length) return '';
            return `
                <h2 class="admin-stat-section-title">${escapeHtml(section.title)}</h2>
                <div class="admin-feature">${checks.map((c) => renderSecurityCheck(c, data.latest[c.key])).join('')}</div>`;
        }).join('');

        const history = `
            <h2 class="admin-stat-section-title">History</h2>
            <p class="admin-intro">Every run, newest first. Automated runs are stored per environment; deep reviews come from the repo, so every environment shows the same ones.</p>
            <div class="admin-feature">${data.history.length ? data.history.map((r) => renderSecurityHistoryRun(r, checksByKey)).join('') : '<p class="admin-test-case">No runs yet.</p>'}</div>`;

        el.innerHTML = tiles + verdictCard + sections + history;
    }

    // ========================================
    // Third parties (ML-267) - the register of everyone the app depends on. Read-only: it's a file
    // in the repo (server/thirdParties/register.js), so it changes with a release. Built from the
    // Security page's parts (cards, badges, evidence lists) - no styles of its own.
    // ========================================
    const THIRD_PARTY_GROUPS = [
        ['service', 'Services the live app needs', 'If one of these stops or changes its terms, the app is affected straight away.'],
        ['asset', 'Fonts and icons', 'Files the app shows or loads. Each licence is kept next to the file where we host it ourselves.'],
        ['content', 'Content and influences', 'Other people\'s material and ideas the app follows.'],
        ['library', 'Code libraries', 'Open-source code the app is built from (npm packages). A copy of each licence is kept in the app.'],
        ['build', 'Tools used to build it', 'Not part of the running app, but the work depends on them.']
    ];
    const THIRD_PARTY_STATUS = { in_use: ['pass', 'In use'], not_in_use: ['never', 'Not in use yet'], attention: ['warn', 'Needs attention'] };

    const thirdPartyList = (items) => `<ul class="admin-security-evidence">${items.map((i) => `<li>${i}</li>`).join('')}</ul>`;
    const thirdPartyLinks = (e) => {
        const links = (e.terms || []).map((t) => `<a href="${escapeHtml(t.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(t.label)}</a>${t.dated ? ` (${escapeHtml(t.dated)})` : ''}`);
        if (e.licenceFile) links.push(`<a href="${escapeHtml(e.licenceFile.replace(/^public/, ''))}" target="_blank" rel="noopener">Our copy of the licence</a>`);
        return `<p class="admin-test-case-meta">${links.join(' &middot; ')}${links.length ? ' &middot; ' : ''}checked ${fmtDay(e.termsCheckedOn)}</p>`;
    };
    const thirdPartyAsks = (e) => (e.asks || []).map((a) => `<strong>${a.check ? 'Checked on every release' : 'Check by hand'}:</strong> ${escapeHtml(a.text)}`);

    function renderThirdPartyDetails(e) {
        const terms = [
            e.says && e.says.length ? `<p class="admin-run-notes"><strong>What the terms say</strong></p>${thirdPartyList(e.says.map(escapeHtml))}` : '',
            `<p class="admin-run-notes"><strong>What they ask of us</strong></p>${e.asks && e.asks.length ? thirdPartyList(thirdPartyAsks(e)) : '<p class="admin-run-notes">Nothing beyond keeping to the terms.</p>'}`,
            e.watch && e.watch.length ? `<p class="admin-run-notes"><strong>Keep an eye on</strong></p>${thirdPartyList(e.watch.map(escapeHtml))}` : ''
        ].join('');
        const limits = e.limits && e.limits.length ? `
            <details class="admin-security-details">
                <summary>Limits on this plan and the next step up</summary>
                ${thirdPartyList(e.limits.map((l) => `<strong>${escapeHtml(l.what)}:</strong> ${escapeHtml(l.allowance)}`))}
                ${e.overLimit ? `<p class="admin-run-notes"><strong>If we go over:</strong> ${escapeHtml(e.overLimit)}</p>` : ''}
                ${e.nextTier ? `<p class="admin-run-notes"><strong>Next step up:</strong> ${escapeHtml(e.nextTier)}</p>` : ''}
            </details>` : '';
        return `
            <details class="admin-security-details">
                <summary>Terms and what they ask of us</summary>
                ${terms}
            </details>${limits}`;
    }

    function renderThirdParty(e) {
        const [badgeClass, badgeLabel] = THIRD_PARTY_STATUS[e.status] || THIRD_PARTY_STATUS.in_use;
        return `
            <div class="admin-feature">
                <div class="admin-feature-header">
                    <div class="admin-feature-header-text">
                        <h2>${escapeHtml(e.name)}</h2>
                        <p>${escapeHtml(e.who)}${e.plan ? ` &middot; ${escapeHtml(e.plan)}` : ''} &middot; ${escapeHtml(e.cost)}</p>
                    </div>
                    <span class="admin-badge ${badgeClass}">${badgeLabel}</span>
                </div>
                <div class="admin-test-case">
                    ${(e.attention || []).map((a, i) => `<p class="admin-run-notes"><strong>Needs attention:</strong> ${escapeHtml(a)} <button type="button" class="admin-stat-exclude-btn" data-attn-party="${escapeHtml(e.key)}" data-attn-open="${i}">Mark as done</button></p>`).join('')}
                    ${(e.attentionDone || []).map((a, i) => `<p class="admin-run-notes text-muted"><strong>Dealt with${a.on ? ` ${escapeHtml(fmtDay(a.on))}` : ''}:</strong> ${escapeHtml(a.text)} <button type="button" class="admin-stat-exclude-btn" data-attn-party="${escapeHtml(e.key)}" data-attn-done="${i}">Undo</button></p>`).join('')}
                    ${e.record && e.record.reference ? `<p class="admin-run-notes"><strong>My reference:</strong> ${escapeHtml(e.record.reference)}</p>` : ''}
                    ${e.record && e.record.note ? `<p class="admin-run-notes"><strong>My note:</strong> ${escapeHtml(e.record.note)}</p>` : ''}
                    <p class="admin-run-notes"><button type="button" class="admin-stat-exclude-btn" data-party-record="${escapeHtml(e.key)}">${e.record && (e.record.reference || e.record.note) ? 'Change my reference and note' : 'Add my reference or a note'}</button></p>
                    ${e.statusNote ? `<p class="admin-run-notes"><strong>${escapeHtml(e.statusNote)}</strong></p>` : ''}
                    <p class="admin-run-notes"><strong>What it gives us:</strong> ${escapeHtml(e.provides)}</p>
                    <p class="admin-run-notes"><strong>Where it's used:</strong> ${escapeHtml(e.usedIn)}</p>
                    <p class="admin-run-notes"><strong>Licence or terms:</strong> ${escapeHtml(e.licence)}</p>
                    ${e.noTermsLink ? `<p class="admin-run-notes">${escapeHtml(e.noTermsLink)}</p>` : ''}
                    ${thirdPartyLinks(e)}
                    ${renderThirdPartyDetails(e)}
                </div>
            </div>`;
    }

    // Libraries are many and alike, so they share one card: a row each.
    function renderThirdPartyLibrary(e) {
        return `
            <div class="admin-test-case">
                <div class="admin-security-head">
                    <div class="admin-test-case-title">${escapeHtml(e.name)}</div>
                    <span class="admin-badge never">${escapeHtml(e.licence)}</span>
                </div>
                <div class="admin-test-case-meta">${escapeHtml(e.who)} &middot; ${escapeHtml(e.usedIn)}</div>
                <p class="admin-run-notes">${escapeHtml(e.provides)}</p>
                ${(e.attention || []).map((a) => `<p class="admin-run-notes"><strong>Needs attention:</strong> ${escapeHtml(a)}</p>`).join('')}
                ${e.noLicenceFile ? `<p class="admin-run-notes">${escapeHtml(e.noLicenceFile)}</p>` : ''}
                ${thirdPartyLinks(e)}
            </div>`;
    }

    // ---- ML-429: what it costs, and usage against each plan's limits (the top of the Third parties page).
    // Money is shown in pounds with US dollars beside it; the rate is the owner's own (app_config usd_per_gbp).
    let thirdPartyData = null;
    let editingCostId = null;
    let readingMeterKey = null;
    const money = (x) => `£${x.gbp.toFixed(2)}`;
    const dollars = (x) => `$${x.usd.toFixed(2)}`;
    const CADENCE_WORDS = { one_off: 'once', weekly: 'a week', monthly: 'a month', yearly: 'a year' };
    const amountText = (n, unit) => `${Number(n) >= 100 ? Math.round(Number(n)).toLocaleString('en-GB') : (Math.round(Number(n) * 100) / 100)} ${unit}`;
    const partyName = (key) => ((thirdPartyData && thirdPartyData.entries.find((e) => e.key === key)) || { name: key }).name;

    function renderThirdPartyCosts(data) {
        const c = data.costs;
        if (!c) return '<p class="admin-intro">Costs and usage couldn\'t be loaded.</p>';
        const rows = c.rows.length ? c.rows.map((r) => `
            <tr>
                <td>${escapeHtml(partyName(r.partyKey))}</td>
                <td>${escapeHtml(r.description || '–')}</td>
                <td>${money(r.each)}<div class="admin-stat-tile-sub">${dollars(r.each)}</div></td>
                <td>${CADENCE_WORDS[r.cadence]}</td>
                <td>${fmtDay(r.startedOn)}</td>
                <td>${r.endedOn ? fmtDay(r.endedOn) : (r.cadence === 'one_off' ? '–' : 'still running')}</td>
                <td>${money(r.spent)}<div class="admin-stat-tile-sub">${dollars(r.spent)} · ${r.charges} payment${r.charges === 1 ? '' : 's'}</div></td>
                <td><button class="admin-stat-exclude-btn" data-cost-edit="${r.id}" type="button">Change</button> <button class="admin-stat-exclude-btn" data-cost-delete="${r.id}" type="button">Delete</button></td>
            </tr>`).join('') : '<tr><td colspan="8" class="admin-stat-empty">No costs recorded yet. Add what you pay for - Claude Code, a domain, the ICO fee...</td></tr>';
        return `
            <h2 class="admin-stat-section-title">What it costs</h2>
            <p class="admin-intro">Pounds, with US dollars underneath, at £1 = $${c.rate.toFixed(2)} (your own rate - change it when it moves). "Spent so far" counts every payment up to today.</p>
            <div class="admin-stat-tiles">
                <div class="admin-stat-tile"><div class="admin-stat-tile-label">Spent so far</div><div class="admin-stat-tile-value">${money(c.spent)}</div><div class="admin-stat-tile-sub">${dollars(c.spent)}</div></div>
                <div class="admin-stat-tile"><div class="admin-stat-tile-label">Costing now, a month</div><div class="admin-stat-tile-value">${money(c.perMonth)}</div><div class="admin-stat-tile-sub">${dollars(c.perMonth)}</div></div>
                <div class="admin-stat-tile"><div class="admin-stat-tile-label">Costing now, a year</div><div class="admin-stat-tile-value">${money(c.perYear)}</div><div class="admin-stat-tile-sub">${dollars(c.perYear)}</div></div>
                <div class="admin-stat-tile"><div class="admin-stat-tile-label">Exchange rate</div><div class="admin-stat-tile-value">$${c.rate.toFixed(2)}</div><div class="admin-stat-tile-sub">to the pound</div></div>
            </div>
            <div class="admin-security-toolbar">
                <button class="btn-submit no-margin" id="costAddBtn" type="button">+ Add a cost</button>
                <button class="admin-stat-exclude-btn" id="costRateBtn" type="button">Change the exchange rate</button>
            </div>
            <div class="admin-stat-table-wrap"><table class="admin-stat-table">
                <thead><tr><th>Paid to</th><th>What for</th><th>Amount</th><th>How often</th><th>From</th><th>Until</th><th>Spent so far</th><th></th></tr></thead>
                <tbody>${rows}</tbody>
            </table></div>`;
    }

    const USAGE_LEVEL = { pass: ['pass', 'Fine'], warn: ['warn', 'Getting near'], fail: ['fail', 'Nearly full'], info: ['never', '–'] };
    function renderThirdPartyUsage(data) {
        const usage = data.usage;
        if (!usage) return '';
        const rows = usage.map((m) => {
            const s = m.status;
            const [badge, word] = s ? USAGE_LEVEL[s.level] : ['never', m.latest && m.latest.stale ? 'Old reading' : m.connected ? 'No reading yet' : 'Not connected'];
            const read = m.latest ? `${fmtDate(m.latest.readAt)} · ${{ app: 'counted by the app', api: 'from their API', manual: 'typed in' }[m.latest.source]}` : (m.connected ? 'never' : `needs ${escapeHtml(m.needs)}`);
            const heading = s && s.projected !== null ? `${amountText(s.projected, m.unit)}${s.reachesLimitOn ? `<div class="admin-stat-tile-sub">limit reached ${fmtDay(s.reachesLimitOn)}</div>` : ''}` : '–';
            return `
            <tr>
                <td>${escapeHtml(m.name)}<div class="admin-stat-tile-sub">${escapeHtml(partyName(m.party))}</div></td>
                <td>${m.latest ? amountText(m.latest.value, m.unit) : '–'}${m.latest && m.latest.note ? `<div class="admin-stat-tile-sub">${escapeHtml(m.latest.note)}</div>` : ''}</td>
                <td>${amountText(m.limit, m.unit)}<div class="admin-stat-tile-sub">${{ month: 'a month', day: 'a day', total: 'in all' }[m.per]}</div></td>
                <td><span class="admin-badge ${badge}">${s && s.percent !== null ? `${s.percent}%` : word}</span>${s && s.percent !== null ? `<div class="admin-stat-tile-sub">${word}</div>` : ''}</td>
                <td>${heading}</td>
                <td>${read}</td>
                <td><button class="admin-stat-exclude-btn" data-reading="${m.key}" type="button">Type a reading</button></td>
            </tr>`;
        }).join('');
        return `
            <h2 class="admin-stat-section-title">Usage against each plan's limits</h2>
            <p class="admin-intro">The latest reading of each thing a plan limits, and where it is heading by the end of the period at this rate. Read once a day; <strong>Read now</strong> takes one straight away. ${data.alertsGoTo ? 'You are emailed at 75% and at 90%.' : 'No warning emails yet: set USAGE_ALERT_EMAIL (or SIGNUP_ALERT_EMAIL) on Vercel.'} The limits were checked against each provider's pricing page on ${fmtDay(data.limitsCheckedOn)}.</p>
            <div class="admin-security-toolbar">
                <button class="btn-submit no-margin" id="usageReadBtn" type="button">Read now</button>
                <span id="usageReadStatus" class="admin-test-case-meta" role="status" aria-live="polite"></span>
            </div>
            <div class="admin-stat-table-wrap"><table class="admin-stat-table">
                <thead><tr><th>What</th><th>Used</th><th>Limit</th><th>How full</th><th>Heading for</th><th>Last read</th><th></th></tr></thead>
                <tbody>${rows}</tbody>
            </table></div>
            <div class="admin-feature"><div class="admin-test-case"><details class="admin-security-details"><summary>How each one is measured</summary>${thirdPartyList(usage.map((m) => `<strong>${escapeHtml(m.name)}:</strong> ${escapeHtml(m.how)}`))}</details></div></div>`;
    }

    function openCostForm(id) {
        const row = id ? thirdPartyData.costs.rows.find((r) => r.id === id) : null;
        editingCostId = id || null;
        document.getElementById('costFormTitle').textContent = row ? 'Change a cost' : 'Add a cost';
        document.getElementById('costPartyInput').innerHTML = thirdPartyData.entries.slice().sort((a, b) => a.name.localeCompare(b.name)).map((e) => `<option value="${escapeHtml(e.key)}">${escapeHtml(e.name)}</option>`).join('');
        document.getElementById('costPartyInput').value = row ? row.partyKey : 'claude-code';
        document.getElementById('costDescriptionInput').value = row ? row.description : '';
        document.getElementById('costAmountInput').value = row ? row.amount : '';
        document.getElementById('costCurrencyInput').value = row ? row.currency : 'USD';
        document.getElementById('costCadenceInput').value = row ? row.cadence : 'monthly';
        document.getElementById('costStartInput').value = row ? row.startedOn : new Date().toISOString().slice(0, 10);
        document.getElementById('costEndInput').value = row && row.endedOn ? row.endedOn : '';
        showModal('costFormModal');
        document.getElementById('costAmountInput').focus();
    }
    async function saveCostForm() {
        const body = {
            partyKey: document.getElementById('costPartyInput').value, description: document.getElementById('costDescriptionInput').value,
            amount: document.getElementById('costAmountInput').value, currency: document.getElementById('costCurrencyInput').value,
            cadence: document.getElementById('costCadenceInput').value, startedOn: document.getElementById('costStartInput').value,
            endedOn: document.getElementById('costEndInput').value || null
        };
        const btn = document.getElementById('costFormSaveBtn');
        btn.disabled = true;
        try {
            renderThirdParties(await apiCall(editingCostId ? `/api/admin/third-parties/costs/${editingCostId}` : '/api/admin/third-parties/costs', editingCostId ? 'PUT' : 'POST', body));
            hideModal('costFormModal');
        } catch (error) {
            showToast(error.message);
        } finally {
            btn.disabled = false;
        }
    }
    function openReadingForm(key) {
        const m = thirdPartyData.usage.find((x) => x.key === key);
        readingMeterKey = key;
        document.getElementById('readingFormTitle').textContent = m.name;
        document.getElementById('readingFormHow').textContent = `${m.how} The limit is ${amountText(m.limit, m.unit)} ${{ month: 'a month', day: 'a day', total: 'in all' }[m.per]}.`;
        document.getElementById('readingValueLabel').textContent = `Used so far (${m.unit})`;
        document.getElementById('readingValueInput').value = '';
        document.getElementById('readingNoteInput').value = '';
        showModal('readingFormModal');
        document.getElementById('readingValueInput').focus();
    }
    async function saveReadingForm() {
        const btn = document.getElementById('readingFormSaveBtn');
        btn.disabled = true;
        try {
            renderThirdParties(await apiCall(`/api/admin/third-parties/usage/${readingMeterKey}`, 'POST', { value: document.getElementById('readingValueInput').value, note: document.getElementById('readingNoteInput').value }));
            hideModal('readingFormModal');
        } catch (error) {
            showToast(error.message);
        } finally {
            btn.disabled = false;
        }
    }
    // ML-462: the owner's own records about a third party - a reference, a note, and "needs attention"
    // items marked as dealt with. Kept in the database (third_party_records), so no code change is needed.
    let recordPartyKey = null;
    function initThirdPartyRecords() {
        document.getElementById('partyRecordCancelBtn')?.addEventListener('click', () => hideModal('partyRecordModal'));
        document.getElementById('partyRecordSaveBtn')?.addEventListener('click', async (e) => {
            const btn = e.currentTarget;
            btn.disabled = true;
            try {
                renderThirdParties(await apiCall(`/api/admin/third-parties/${recordPartyKey}/record`, 'PUT', { reference: document.getElementById('partyRecordReference').value, note: document.getElementById('partyRecordNote').value }));
                hideModal('partyRecordModal');
                showToast('Saved', 'success');
            } catch (error) { showToast(error.message); } finally { btn.disabled = false; }
        });
        document.getElementById('thirdParties')?.addEventListener('click', async (e) => {
            const t = e.target.closest('button');
            if (!t || !thirdPartyData) return;
            const entry = (key) => thirdPartyData.entries.find((x) => x.key === key);
            if (t.dataset.partyRecord) {
                const en = entry(t.dataset.partyRecord);
                recordPartyKey = en.key;
                document.getElementById('partyRecordTitle').textContent = `${en.name}: my reference and note`;
                document.getElementById('partyRecordReference').value = en.record ? en.record.reference : '';
                document.getElementById('partyRecordNote').value = en.record ? en.record.note : '';
                showModal('partyRecordModal');
                document.getElementById('partyRecordReference').focus();
                return;
            }
            if (t.dataset.attnParty) {
                const en = entry(t.dataset.attnParty);
                const done = t.dataset.attnOpen !== undefined;
                const text = done ? en.attention[Number(t.dataset.attnOpen)] : en.attentionDone[Number(t.dataset.attnDone)].text;
                t.disabled = true;
                try { renderThirdParties(await apiCall(`/api/admin/third-parties/${en.key}/attention`, 'POST', { text, done })); } catch (error) { showToast(error.message); t.disabled = false; }
            }
        });
    }

    function initThirdPartyMoney() {
        document.getElementById('costFormCancelBtn')?.addEventListener('click', () => hideModal('costFormModal'));
        document.getElementById('costFormSaveBtn')?.addEventListener('click', saveCostForm);
        document.getElementById('readingFormCancelBtn')?.addEventListener('click', () => hideModal('readingFormModal'));
        document.getElementById('readingFormSaveBtn')?.addEventListener('click', saveReadingForm);
        // The page is redrawn after every change, so its buttons are heard from the container
        document.getElementById('costsUsage')?.addEventListener('click', async (e) => {
            const t = e.target.closest('button');
            if (!t || !thirdPartyData) return;
            if (t.id === 'costAddBtn') { openCostForm(null); return; }
            if (t.id === 'costRateBtn') { openConfigForm('usd_per_gbp', 'US dollars to the pound', String(thirdPartyData.costs.rate), 'How many dollars £1 buys (e.g. 1.30)', reloadThirdParties); return; }
            if (t.dataset.costEdit) { openCostForm(Number(t.dataset.costEdit)); return; }
            if (t.dataset.costDelete) {
                const row = thirdPartyData.costs.rows.find((r) => r.id === Number(t.dataset.costDelete));
                showConfirmModal('Delete this cost?', `${partyName(row.partyKey)}${row.description ? ` - ${row.description}` : ''}. Its payments come off the totals.`, async () => {
                    try { renderThirdParties(await apiCall(`/api/admin/third-parties/costs/${row.id}`, 'DELETE')); } catch (error) { showToast(error.message); }
                });
                return;
            }
            if (t.dataset.reading) { openReadingForm(t.dataset.reading); return; }
            if (t.id === 'usageReadBtn') {
                t.disabled = true;
                document.getElementById('usageReadStatus').textContent = 'Reading...';
                try {
                    const data = await apiCall('/api/admin/third-parties/usage/read', 'POST');
                    const said = `${data.results.filter((r) => r.ok).length} read${data.results.some((r) => !r.ok) ? `, ${data.results.filter((r) => !r.ok).length} not (${data.results.filter((r) => !r.ok).map((r) => r.message).filter((v, i, a) => a.indexOf(v) === i).join('; ')})` : ''}.`;
                    renderThirdParties(data);
                    document.getElementById('usageReadStatus').textContent = said;
                } catch (error) {
                    showToast(error.message);
                    t.disabled = false;
                    document.getElementById('usageReadStatus').textContent = '';
                }
            }
        });
    }

    function renderThirdParties(data) {
        thirdPartyData = data;
        const entries = data.entries;
        const attention = entries.flatMap((e) => (e.attention || []).map((a) => `<strong>${escapeHtml(e.name)}:</strong> ${escapeHtml(a)}`));
        const byHand = entries.flatMap((e) => (e.asks || []).filter((a) => !a.check).map((a) => `<strong>${escapeHtml(e.name)}:</strong> ${escapeHtml(a.text)}`));
        const paid = entries.filter((e) => e.paid);
        const oldest = entries.map((e) => e.termsCheckedOn).filter(Boolean).sort()[0];

        const tiles = `
            <div class="admin-stat-tiles">
                <div class="admin-stat-tile"><div class="admin-stat-tile-label">In the register</div><div class="admin-stat-tile-value">${entries.length}</div><div class="admin-stat-tile-sub">${entries.filter((e) => e.group === 'service').length} the live app needs</div></div>
                <div class="admin-stat-tile"><div class="admin-stat-tile-label">Need attention</div><div class="admin-stat-tile-value">${attention.length}</div><div class="admin-stat-tile-sub">${attention.length ? 'listed below' : 'nothing to do'}</div></div>
                <div class="admin-stat-tile"><div class="admin-stat-tile-label">Paid for</div><div class="admin-stat-tile-value">${paid.length}</div><div class="admin-stat-tile-sub">${paid.length ? escapeHtml(paid.map((e) => e.name).join(', ')) : 'everything is on a free plan'}</div></div>
                <div class="admin-stat-tile"><div class="admin-stat-tile-label">Terms last checked</div><div class="admin-stat-tile-value">${fmtDay(oldest)}</div><div class="admin-stat-tile-sub">the oldest check in the list</div></div>
            </div>`;

        const attentionCard = attention.length ? `
            <h2 class="admin-stat-section-title">Needs attention</h2>
            <div class="admin-feature"><div class="admin-test-case">${thirdPartyList(attention)}</div></div>` : '';

        const byHandCard = byHand.length ? `
            <h2 class="admin-stat-section-title">Check by hand before a release</h2>
            <p class="admin-intro">What a licence or set of terms asks of us that a script can't check. Everything else they ask is checked automatically on every release.</p>
            <div class="admin-feature"><div class="admin-test-case"><details class="admin-security-details"><summary>${byHand.length} things to check</summary>${thirdPartyList(byHand)}</details></div></div>` : '';

        const groups = THIRD_PARTY_GROUPS.map(([key, title, intro]) => {
            const inGroup = entries.filter((e) => e.group === key);
            if (!inGroup.length) return '';
            const body = key === 'library'
                ? `<div class="admin-feature">${inGroup.map(renderThirdPartyLibrary).join('')}</div>`
                : inGroup.map(renderThirdParty).join('');
            return `<h2 class="admin-stat-section-title">${title} (${inGroup.length})</h2><p class="admin-intro">${escapeHtml(intro)}</p>${body}`;
        }).join('');

        // ML-443: costs and usage are their own page (Business → Costs and usage); the same answer draws both
        document.getElementById('costsUsage').innerHTML = renderThirdPartyCosts(data) + renderThirdPartyUsage(data);
        document.getElementById('thirdParties').innerHTML = tiles + attentionCard + byHandCard + groups;
        // What is waiting shows on the menu: things needing attention, and limits getting near or nearly full
        setNavCount('thirdPartiesNavCount', attention.length);
        setNavCount('costsNavCount', (data.usage || []).filter((m) => m.status && (m.status.level === 'warn' || m.status.level === 'fail')).length);
    }

    async function reloadThirdParties() {
        renderThirdParties(await apiCall('/api/admin/third-parties'));
    }

    // ML-231: the page reviews two things - this site (the first tab) and the PDF import service (ML-192)
    let securityTarget = 'site';
    const securityWord = () => (securityTarget === 'site' ? 'version' : 'upstream');
    const securityPath = (run) => `/api/admin/security-review${run ? '/run' : ''}${securityTarget === 'site' ? '?target=site' : ''}`;
    const SECURITY_INTRO = {
        site: 'Security review of <strong>this site</strong> (ML-231): who can reach what, what members can type or upload, signing in, the browser\'s protections, packages and settings. <strong>Run now</strong> repeats the automated checks - do it once a month and after anything that touches sign-in or sharing. The deep review (a read of every route and every place member-typed text is shown) is done by Claude Code in a session: ask it to "re-run the ML-231 site security review". Full write-up: <code>docs/site-security-review.md</code>.',
        omr: 'Security review of <strong>solfascribe-omr</strong>, the third-party OMR service behind "Create from file" PDF import (ML-192). <strong>Run now</strong> repeats the automated checks. The deep review (code read, secret scan, dependency scans) is done by Claude Code in a session: ask it to "re-run the ML-192 OMR security review". Full write-up: <code>docs/omr-security-review.md</code>.'
    };
    async function reloadSecurityReview() {
        document.getElementById('securityIntro').innerHTML = SECURITY_INTRO[securityTarget];
        document.querySelectorAll('[data-security-target]').forEach((b) => { const on = b.dataset.securityTarget === securityTarget; b.classList.toggle('active', on); b.setAttribute('aria-selected', on ? 'true' : 'false'); });
        renderSecurityReview(await apiCall(securityPath(false)));
    }

    function initSecurityReview() {
        document.querySelectorAll('[data-security-target]').forEach((tab) => tab.addEventListener('click', () => {
            securityTarget = tab.dataset.securityTarget;
            document.getElementById('securityRunStatus').textContent = '';
            document.getElementById('securityReview').innerHTML = '<p class="admin-intro">Loading&hellip;</p>';
            reloadSecurityReview().catch((error) => { document.getElementById('securityReview').innerHTML = `<p>Error loading data: ${escapeHtml(error.message)}</p>`; });
        }));
        const btn = document.getElementById('securityRunBtn');
        const status = document.getElementById('securityRunStatus');
        btn?.addEventListener('click', async () => {
            btn.disabled = true;
            status.textContent = 'Running the automated checks - this takes a few seconds…';
            try {
                const data = await apiCall(securityPath(true), 'POST');
                renderSecurityReview(data);
                status.textContent = 'Done - results updated below.';
            } catch (error) {
                status.textContent = '';
                showToast(error.message);
            } finally {
                btn.disabled = false;
            }
        });
    }

    // ========================================
    // ML-345: Feature access - every feature by account type, plus Live (the master switch). The grid
    // ("All account types") or one type at a time (a tab each). Changes wait in the Save bar and save
    // together (PUT /api/admin/feature-access). Super admins always have everything (locked column).
    // See docs/feature-access-plan.md.
    // ========================================
    const ACCESS_GROUPS = [
        ['Tools - Everyday', ['metronome', 'tuner', 'timer']],
        ['Tools - My routine', ['warmups', 'scales_practice']],
        ['Tools - Practise', ['rehearse']],
        ['Tools - Learn', ['theory_practice', 'theory_grades', 'theory_smart_learn', 'ear_training', 'tap_tempo', 'gap_trainer', 'range_trainer', 'rhythm_trainer']],
        ['Practice sessions', ['practice_levels', 'scales_levels']],
        ['Menu', ['challenges', 'flow_manage', 'manage_tutor', 'notifications', 'feedback', 'invite_members']],
        ['My music', ['flow_create', 'flow_import_musicxml', 'flow_import_from_file', 'flow_export_musicxml', 'flow_playback', 'flow_editor', 'flow_consistency_check']],
        ['Metronome and tuner', ['metronome_history', 'metronome_save_to_flow', 'tuner_rewind']]
    ];
    // ML-383: limits (a number per account type, e.g. how many Metronome plays history lists) wait in
    // access.limits ('limitId|level' -> value) and save with the rest.
    const access = { data: null, view: 'all', live: new Map(), cells: new Map(), limits: new Map() };
    function accessLimitValue(l, level) {
        const k = accessCellKey(l.id, level);
        return access.limits.has(k) ? access.limits.get(k) : l.values[level];
    }
    function accessSetLimit(l, level, value) {
        const k = accessCellKey(l.id, level);
        if (value === l.values[level]) access.limits.delete(k); else access.limits.set(k, value);
    }
    function accessLimitInput(l, t) {
        const changed = access.limits.has(accessCellKey(l.id, t.key));
        const v = accessLimitValue(l, t.key);
        return `<input type="number" class="admin-access-limit${changed ? ' is-changed' : ''}" min="0" max="100000" step="1" inputmode="numeric" data-limit="${l.id}|${t.key}" value="${v === null || v === undefined ? '' : v}" aria-label="${escapeHtml(l.name)} for ${escapeHtml(t.label)}">`;
    }
    const accessCellKey = (id, level) => `${id}|${level}`;
    function accessLive(f) { return access.live.has(f.id) ? access.live.get(f.id) : f.live; }
    function accessOn(f, level) {
        if (level === 'super_admin') return true;
        const k = accessCellKey(f.id, level);
        return access.cells.has(k) ? access.cells.get(k) : f.access[level];
    }
    function accessSetCell(f, level, on) {
        const k = accessCellKey(f.id, level);
        if (on === f.access[level]) access.cells.delete(k); else access.cells.set(k, on);
    }
    function accessSetLive(f, on) {
        if (on === f.live) access.live.delete(f.id); else access.live.set(f.id, on);
    }
    function accessGroups() {
        const byKey = new Map(access.data.features.map(f => [f.featureKey, f]));
        const used = new Set();
        const groups = ACCESS_GROUPS.map(([title, keys]) => [title, keys.map(k => byKey.get(k)).filter(Boolean)])
            .map(([title, fs]) => { fs.forEach(f => used.add(f.featureKey)); return [title, fs]; });
        const rest = access.data.features.filter(f => !used.has(f.featureKey));
        if (rest.length) groups.push(['Core and other', rest]);
        return groups.filter(([, fs]) => fs.length);
    }
    async function loadFeatureAccess() {
        const body = document.getElementById('accessBody');
        try {
            access.data = await apiCall('/api/admin/feature-access');
            access.live.clear();
            access.cells.clear();
            access.limits.clear();
            renderFeatureAccess();
        } catch (error) {
            body.innerHTML = `<p>Error loading feature access: ${escapeHtml(error.message)}</p>`;
        }
    }
    function renderFeatureAccess() {
        if (!access.data) return;
        const { types, features } = access.data;
        const tabs = document.getElementById('accessTabs');
        tabs.innerHTML = [['all', 'All account types'], ...types.map(t => [t.key, t.label])].map(([k, l]) =>
            `<button type="button" class="admin-subtab-item${access.view === k ? ' active' : ''}" role="tab" aria-selected="${access.view === k}" data-access-tab="${k}">${escapeHtml(l)}</button>`).join('');
        tabs.querySelectorAll('[data-access-tab]').forEach(b => b.addEventListener('click', () => { access.view = b.dataset.accessTab; renderFeatureAccess(); }));

        const type = types.find(t => t.key === access.view);
        const onCount = type ? features.filter(f => accessLive(f) && accessOn(f, type.key)).length : 0;
        document.getElementById('accessSummary').innerHTML = type
            ? `<strong>${escapeHtml(type.label)}</strong> - ${onCount} of ${features.length} features on`
            : `${features.length} features · ${types.length} account types`;
        const copy = document.getElementById('accessCopyFrom');
        const canCopy = !!type && type.key !== 'super_admin';
        copy.classList.toggle('hidden-group', !canCopy);
        if (canCopy) copy.innerHTML = `<option value="">Copy from…</option>${types.filter(t => t.key !== type.key && t.key !== 'super_admin').map(t => `<option value="${t.key}">${escapeHtml(t.label)}</option>`).join('')}`;
        const preview = document.getElementById('accessPreviewSelect');
        const previewTypes = types.filter(t => t.key !== 'super_admin');
        preview.innerHTML = `<option value="">Preview the app as…</option>${previewTypes.map(t => `<option value="${t.key}"${type && type.key === t.key ? ' selected' : ''}>${escapeHtml(t.label)}</option>`).join('')}`;

        // ML-414: the catalogue's own form reads a feature from here (enabled = Live)
        featuresById = new Map(features.map(f => [f.id, { ...f, enabled: f.live }]));
        const body = document.getElementById('accessBody');
        body.innerHTML = type ? renderAccessType(type) : renderAccessGrid(types);
        body.querySelectorAll('[data-feature-menu]').forEach(btn => btn.addEventListener('click', () => {
            const id = Number(btn.dataset.featureMenu);
            openRowMenu(btn, [
                { label: 'Edit', icon: 'edit', run: () => openFeatureForm(featuresById.get(id)) },
                { label: 'Delete', icon: 'delete', danger: true, run: () => deleteFeature(id) }
            ]);
        }));
        body.querySelectorAll('[data-cell]').forEach(input => input.addEventListener('change', () => {
            const [id, level] = input.dataset.cell.split('|');
            accessSetCell(features.find(f => f.id === Number(id)), level, input.checked);
            renderFeatureAccess();
        }));
        body.querySelectorAll('[data-live]').forEach(input => input.addEventListener('change', () => {
            accessSetLive(features.find(f => f.id === Number(input.dataset.live)), input.checked);
            renderFeatureAccess();
        }));
        body.querySelectorAll('[data-copy-premium]').forEach(b => b.addEventListener('click', () => accessCopy('premium_member', 'beta_tester')));
        body.querySelectorAll('[data-limit]').forEach(input => input.addEventListener('change', () => {
            const [id, level] = input.dataset.limit.split('|');
            const l = access.data.limits.find(x => x.id === Number(id));
            const n = Number(input.value);
            if (input.value === '' || !Number.isInteger(n) || n < 0 || n > 100000) {
                showToast('A limit is a whole number from 0 to 100000.');
                input.value = accessLimitValue(l, level) ?? '';
                return;
            }
            accessSetLimit(l, level, n);
            // Not a full re-render: 'change' fires as the box loses focus, and replacing it mid-blur throws.
            const changed = access.limits.has(accessCellKey(l.id, level));
            input.classList.toggle('is-changed', changed);
            input.closest('.admin-access-row')?.classList.toggle('is-changed', changed);
            renderAccessSaveBar();
        }));
        renderAccessSaveBar();
    }
    function renderAccessSaveBar() {
        const changes = access.live.size + access.cells.size + access.limits.size;
        document.getElementById('accessSaveBar').classList.toggle('hidden-group', changes === 0);
        document.getElementById('accessSaveText').innerHTML = `<strong>${changes} change${changes === 1 ? '' : 's'}</strong> not saved yet`;
    }
    function renderAccessGrid(types) {
        const head = `<tr><th scope="col">Feature</th><th scope="col" class="admin-access-live">Live</th>${types.map(t => `<th scope="col">${escapeHtml(t.label)}${t.key === 'beta_tester' ? '<button type="button" class="btn-text admin-access-copy" data-copy-premium>Same as Premium</button>' : ''}</th>`).join('')}</tr>`;
        const rows = accessGroups().map(([title, fs]) => `<tr class="admin-access-group"><th scope="rowgroup" colspan="${types.length + 2}">${escapeHtml(title)}</th></tr>` + fs.map(f => {
            const live = accessLive(f);
            return `<tr><th scope="row"><div class="flex-row gap-sm items-center"><span class="grow"><strong>${escapeHtml(f.name)}</strong><small title="${escapeHtml(f.description || '')}">${escapeHtml(f.description || f.featureKey)}</small></span>${rowMenuBtnHtml('data-feature-menu', f.id, f.name)}</div></th>
                <td class="admin-access-live"><label class="toggle-switch"><input type="checkbox" data-live="${f.id}"${live ? ' checked' : ''} aria-label="${escapeHtml(f.name)} live for everyone"><span class="toggle-slider"></span></label></td>
                ${types.map(t => {
                    const locked = t.key === 'super_admin';
                    const changed = access.cells.has(accessCellKey(f.id, t.key));
                    return `<td><label class="admin-access-cell${changed ? ' is-changed' : ''}"><input type="checkbox"${locked ? ' disabled' : ` data-cell="${f.id}|${t.key}"`}${accessOn(f, t.key) ? ' checked' : ''} aria-label="${escapeHtml(f.name)} for ${escapeHtml(t.label)}${locked ? ' (always)' : ''}"></label></td>`;
                }).join('')}</tr>`;
        }).join('')).join('');
        const limits = access.data.limits || [];
        const limitRows = limits.length ? `<tr class="admin-access-group"><th scope="rowgroup" colspan="${types.length + 2}">Limits</th></tr>` + limits.map(l =>
            `<tr><th scope="row"><strong>${escapeHtml(l.name)}</strong><small title="${escapeHtml(l.description || '')}">${escapeHtml(l.description || l.limitKey)}</small></th><td class="admin-access-live"></td>${types.map(t => `<td>${accessLimitInput(l, t)}</td>`).join('')}</tr>`).join('') : '';
        return `<div class="admin-stat-table-wrap"><table class="admin-stat-table admin-access-table"><thead>${head}</thead><tbody>${rows}${limitRows}</tbody></table></div>`;
    }
    function renderAccessType(type) {
        const locked = type.key === 'super_admin';
        return (locked ? '<p class="admin-intro">Super admins always have every feature that\'s Live. Use Preview to see the app as another account type.</p>' : '')
            + accessGroups().map(([title, fs]) => `<div class="admin-stat-section-title">${escapeHtml(title)}</div>` + fs.map(f => {
                const changed = access.cells.has(accessCellKey(f.id, type.key));
                const live = accessLive(f);
                return `<div class="admin-access-row${changed ? ' is-changed' : ''}"><div class="grow"><strong>${escapeHtml(f.name)}</strong><small title="${escapeHtml(f.description || '')}">${escapeHtml(f.description || f.featureKey)}${live ? '' : ' - off for everyone (Live is off)'}</small></div>
                    <label class="toggle-switch"><input type="checkbox"${locked ? ' disabled' : ` data-cell="${f.id}|${type.key}"`}${accessOn(f, type.key) ? ' checked' : ''} aria-label="${escapeHtml(f.name)} for ${escapeHtml(type.label)}"><span class="toggle-slider"></span></label>${rowMenuBtnHtml('data-feature-menu', f.id, f.name)}</div>`;
            }).join('')).join('')
            + ((access.data.limits || []).length ? '<div class="admin-stat-section-title">Limits</div>' + access.data.limits.map(l =>
                `<div class="admin-access-row${access.limits.has(accessCellKey(l.id, type.key)) ? ' is-changed' : ''}"><div class="grow"><strong>${escapeHtml(l.name)}</strong><small title="${escapeHtml(l.description || '')}">${escapeHtml(l.description || l.limitKey)}</small></div>${accessLimitInput(l, type)}</div>`).join('') : '');
    }
    function accessCopy(from, to) {
        access.data.features.forEach(f => accessSetCell(f, to, accessOn(f, from)));
        renderFeatureAccess();
    }
    function initFeatureAccess() {
        document.querySelector('.admin-nav-item[data-section="feature-access"]')?.addEventListener('click', () => { if (!access.data) loadFeatureAccess(); });
        document.getElementById('accessCopyFrom')?.addEventListener('change', (e) => {
            const from = e.target.value;
            if (from && access.view !== 'all') accessCopy(from, access.view);
        });
        document.getElementById('accessPreviewBtn')?.addEventListener('click', () => {
            const level = document.getElementById('accessPreviewSelect').value;
            if (!level) { showToast('Choose an account type to preview.'); return; }
            window.open(`/?preview=${encodeURIComponent(level)}`, '_blank', 'noopener');
        });
        document.getElementById('accessDiscardBtn')?.addEventListener('click', () => { access.live.clear(); access.cells.clear(); access.limits.clear(); renderFeatureAccess(); });
        document.getElementById('accessSaveBtn')?.addEventListener('click', async () => {
            const btn = document.getElementById('accessSaveBtn');
            btn.disabled = true;
            try {
                access.data = await apiCall('/api/admin/feature-access', 'PUT', {
                    live: [...access.live].map(([featureId, enabled]) => ({ featureId, enabled })),
                    access: [...access.cells].map(([k, enabled]) => { const [featureId, level] = k.split('|'); return { featureId: Number(featureId), level, enabled }; }),
                    limits: [...access.limits].map(([k, value]) => { const [limitId, level] = k.split('|'); return { limitId: Number(limitId), level, value }; })
                });
                access.live.clear();
                access.cells.clear();
                access.limits.clear();
                renderFeatureAccess();
                showToast('Feature access saved', 'success');
            } catch (error) {
                showToast('Not saved: ' + error.message);
            } finally {
                btn.disabled = false;
            }
        });
    }

    async function load() {
        initNav();
        initFeatureAccess();
        initSecurityReview();
        initThirdPartyMoney();
        initThirdPartyRecords();
        initFeatureForm();
        initConfirmModal();
        initBandForm();
        initAdminSubtabs();
        initDurationForm();
        initTimeSigForm();
        initSpeedForm();
        initConfigForm();
        initFeedback();
        initFlows();
        initNotificationsAdmin();
        initRestMessagesAdmin();
        document.getElementById('adminShell').classList.remove('hidden-group');
        openPageFromAddress(); // ML-443: admin.html#accounts opens on Accounts
        if (!location.hash.slice(1) || location.hash === '#dashboard') window.AdminDashboard?.open(); // the first page reads itself
        try {
            loadFeatureAccess(); // ML-414: the first page - who can use what, and the catalogue
            const backtest = await apiCall('/api/admin/backtest');
            renderSummary(backtest);
            renderFeatures(backtest);
            await Promise.all([
                reloadAccounts(), reloadBands(), reloadDurations(), reloadTimeSigs(), reloadNoteValues(), reloadSpeeds(), reloadDurationUsage(), reloadInstrumentUsage(), Promise.resolve(renderTheoryGrades()), reloadFlowAuthoring(), reloadFeedback(), reloadFlows(), reloadNotificationsAdmin(), reloadRestMessagesAdmin(), reloadWarmupsAdmin(), reloadPosthogLink(),
                reloadSecurityReview().catch((error) => { document.getElementById('securityReview').innerHTML = `<p>Error loading data: ${escapeHtml(error.message)}</p>`; }),
                reloadThirdParties().catch((error) => { document.getElementById('thirdParties').innerHTML = `<p>Error loading data: ${escapeHtml(error.message)}</p>`; }),
                reloadFlowDefaultName(), reloadFlowDefaultTimeSig(), reloadFlowDefaultBpm(), reloadFlowDefaultBarCount(), reloadFlowDefaultNoteValue()
            ]);
        } catch (error) {
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

    // ML-443: what a page kept in its own file (admin-business.js) needs from this one.
    window.AdminPanel = { apiCall, escapeHtml, showToast, showModal, hideModal, showConfirmModal, openRowMenu };

    checkAccessAndLoad();
})();
