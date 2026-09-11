    const API_BASE_URL = window.location.hostname === 'localhost'
        ? 'http://localhost:3000'
        : `https://${window.location.hostname}`;

    // ========================================
    // AUTHENTICATION & TOKEN MANAGEMENT
    // ========================================
    // No server has issued an unsigned token since ML-44 - a stored value
    // that isn't in this shape can never be valid, so it's not worth
    // sending to the server to find that out (see ML-48: doing so can
    // trigger a 401 + auto-logout redirect fast enough to look like the
    // app just forgot the user, with no visible error).
    function isValidTokenShape(token) {
        return typeof token === 'string' && (token.match(/\./g) || []).length === 1;
    }

    class AuthManager {
        constructor() {
            this.token = localStorage.getItem('authToken');
            this.userId = localStorage.getItem('userId');
            if (this.token && !isValidTokenShape(this.token)) {
                localStorage.removeItem('authToken');
                localStorage.removeItem('userId');
                this.token = null;
                this.userId = null;
            }
            this.isAuthenticated = !!this.token;
        }

        async login() {
            const authUrl = `${API_BASE_URL}/auth/login`;
            window.location.href = authUrl;
        }

        async handleCallback() {
            const params = new URLSearchParams(window.location.search);
            const token = params.get('authToken');
            const userId = params.get('userId');

            if (token && userId) {
                localStorage.setItem('authToken', token);
                localStorage.setItem('userId', userId);
                this.token = token;
                this.userId = userId;
                this.isAuthenticated = true;
                window.history.replaceState({}, document.title, window.location.pathname);
                return true;
            }
            return false;
        }

        logout() {
            localStorage.removeItem('authToken');
            localStorage.removeItem('userId');
            this.token = null;
            this.userId = null;
            this.isAuthenticated = false;
            window.location.href = window.location.pathname;
        }

        getAuthHeader() {
            return this.token ? { 'Authorization': `Bearer ${this.token}` } : {};
        }

        updateToken(newToken) {
            localStorage.setItem('authToken', newToken);
            this.token = newToken;
        }
    }

    const auth = new AuthManager();

    // ========================================
    // API HELPER FUNCTIONS
    // ========================================
    async function apiCall(endpoint, method = 'GET', body = null, tokenOverride = null) {
        if (!auth.isAuthenticated) {
            showWarningToast('Not authenticated. Please login.');
            const err = new Error('Not authenticated');
            err.status = 401;
            throw err;
        }

        // A token pinned at login time (see initializeApp) and threaded
        // explicitly through the startup sequence is used in preference to
        // the live auth.token, which has been observed to intermittently
        // revert to a stale value on some browsers between the first and
        // later requests of a page load - see ML-48.
        const effectiveToken = tokenOverride || auth.token;

        const options = {
            method,
            headers: {
                'Content-Type': 'application/json',
                ...(effectiveToken ? { 'Authorization': `Bearer ${effectiveToken}` } : {})
            }
        };

        if (body && (method === 'POST' || method === 'PUT' || method === 'DELETE')) {
            options.body = JSON.stringify(body);
        }

        const response = await fetch(`${API_BASE_URL}${endpoint}`, options);

        const refreshedToken = response.headers.get('X-Refreshed-Token');
        if (refreshedToken) {
            auth.updateToken(refreshedToken);
        }

        if (!response.ok) {
            const error = await response.json().catch(() => ({}));
            const err = new Error(error.error || `API error: ${response.status}`);
            err.status = response.status;
            throw err;
        }

        return await response.json();
    }

    // API endpoint wrappers
    const API = {
        dropdownOptions: (token) => apiCall('/api/dropdown-options', 'GET', null, token),
        sessions: {
            get: (token) => apiCall('/api/sessions', 'GET', null, token),
            create: (data) => apiCall('/api/sessions', 'POST', data),
            update: (row, data) => apiCall(`/api/sessions/${row}`, 'PUT', data),
            delete: (row, category) => apiCall(`/api/sessions/${row}`, 'DELETE', { category })
        },
        challenges: {
            get: (token) => apiCall('/api/challenges', 'GET', null, token),
            create: (data) => apiCall('/api/challenges', 'POST', data),
            update: (row, data) => apiCall(`/api/challenges/${row}`, 'PUT', data),
            delete: (row) => apiCall(`/api/challenges/${row}`, 'DELETE'),
            close: (id) => apiCall(`/api/challenges/${id}/close`, 'PUT'),
            updateGroup: (id, data) => apiCall(`/api/challenges/group/${id}`, 'PUT', data),
            deleteGroup: (id) => apiCall(`/api/challenges/group/${id}`, 'DELETE'),
            addItem: (groupId, data) => apiCall(`/api/challenges/group/${groupId}/items`, 'POST', data)
        },
        metronomeBlocks: {
            timeSignatures: {
                list: () => apiCall('/api/time-signatures'),
                createCustom: (numerator, denominator) => apiCall('/api/time-signatures/custom', 'POST', { numerator, denominator }),
                listCustomWithUsage: () => apiCall('/api/time-signatures/custom'),
                archiveCustom: (id) => apiCall(`/api/time-signatures/custom/${id}`, 'PUT', { active: false }),
                deleteCustom: (id) => apiCall(`/api/time-signatures/custom/${id}`, 'DELETE')
            },
            setups: {
                list: () => apiCall('/api/metronome/setups'),
                get: (id) => apiCall(`/api/metronome/setups/${id}`),
                getScratch: () => apiCall('/api/metronome/setups/scratch'),
                createNamed: (name) => apiCall('/api/metronome/setups/named', 'POST', { name }),
                duplicate: (id, name) => apiCall(`/api/metronome/setups/${id}/duplicate`, 'POST', { name }),
                save: (id, name) => apiCall(`/api/metronome/setups/${id}/save`, 'POST', { name }),
                rename: (id, name) => apiCall(`/api/metronome/setups/${id}`, 'PUT', { name }),
                delete: (id) => apiCall(`/api/metronome/setups/${id}`, 'DELETE')
            },
            segments: {
                create: (setupId, data) => apiCall(`/api/metronome/setups/${setupId}/segments`, 'POST', data),
                update: (segId, data) => apiCall(`/api/metronome/segments/${segId}`, 'PUT', data),
                delete: (segId) => apiCall(`/api/metronome/segments/${segId}`, 'DELETE')
            }
        },
        settings: {
            get: () => apiCall('/api/dropdown-options'),
            getListsWithUsage: () => apiCall('/api/settings/lists-with-usage'),
            addOrganisation: (name) => apiCall('/api/settings/organisations', 'POST', { name }),
            addTeacher: (name) => apiCall('/api/settings/teachers', 'POST', { name }),
            deleteOrganisation: (name) => apiCall(`/api/settings/organisations/${encodeURIComponent(name)}`, 'DELETE'),
            deleteTeacher: (name) => apiCall(`/api/settings/teachers/${encodeURIComponent(name)}`, 'DELETE'),
            renameOrganisation: (oldName, newName) => apiCall('/api/settings/organisations', 'PUT', { oldName, newName }),
            renameTeacher: (oldName, newName) => apiCall('/api/settings/teachers', 'PUT', { oldName, newName }),
            unarchiveOrganisation: (name) => apiCall(`/api/settings/organisations/${encodeURIComponent(name)}/unarchive`, 'POST'),
            unarchiveTeacher: (name) => apiCall(`/api/settings/teachers/${encodeURIComponent(name)}/unarchive`, 'POST')
        }
    };

    // ========================================
    // APP STATE & INITIALIZATION
    // ========================================
    let rawData = [];
    let appData = { organisations: [], teachers: [], durations: [] };
    let currentHistDate = new Date();
    let activeFilters = { 'Practise': true, 'Rehearsal': true, 'Lesson': true, 'Performance': true };
    const colorMap = { 'Practise': 'var(--cat-practise)', 'Rehearsal': 'var(--cat-rehearsal)', 'Lesson': 'var(--cat-lesson)', 'Performance': 'var(--cat-performance)' };

    // Challenge Data
    let allChallenges = [];
    let currentSessionLog = { time: 0, items: [] };
    let activeChallengeItems = [];
    let currentPlayIndex = 0;
    let currentSessionChallengeId = null;
    let editChallengeMeta = {};

    function parseDateSafely(dateStr) {
        if (!dateStr) return new Date();
        if (typeof dateStr !== 'string') return new Date(dateStr);
        const parts = dateStr.split('-');
        if (parts.length === 3) {
            return new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
        }
        return new Date(dateStr);
    }

    // ========================================
    // STREAK CALCULATIONS
    // ========================================
    function formatLocalDateStr(dateObj) {
        return `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}-${String(dateObj.getDate()).padStart(2, '0')}`;
    }

    function dateStrAddDays(dateStr, delta) {
        const d = parseDateSafely(dateStr);
        d.setDate(d.getDate() + delta);
        return formatLocalDateStr(d);
    }

    // Current streak counting backward from today. If today has no entry yet,
    // start from yesterday instead so an ongoing streak isn't shown as broken
    // just because today hasn't been logged yet.
    function calculateCurrentStreak(dateSet) {
        let streak = 0;
        let cursor = formatLocalDateStr(new Date());
        if (!dateSet.has(cursor)) cursor = dateStrAddDays(cursor, -1);
        while (dateSet.has(cursor)) {
            streak++;
            cursor = dateStrAddDays(cursor, -1);
        }
        return streak;
    }

    // Every historical streak length (runs of consecutive days present in dateSet)
    function calculateAllStreaks(dateSet) {
        const sorted = Array.from(dateSet).sort();
        const streaks = [];
        let current = 0;
        let prevDateStr = null;
        sorted.forEach(dStr => {
            if (prevDateStr && dateStrAddDays(prevDateStr, 1) === dStr) {
                current++;
            } else {
                if (current > 0) streaks.push(current);
                current = 1;
            }
            prevDateStr = dStr;
        });
        if (current > 0) streaks.push(current);
        return streaks;
    }

    function getStreakData() {
        const practiseDates = new Set();
        const playingDates = new Set();
        rawData.forEach(d => {
            playingDates.add(d.dateStr);
            if (d.category === 'Practise') practiseDates.add(d.dateStr);
        });
        return {
            currentPractise: calculateCurrentStreak(practiseDates),
            currentPlaying: calculateCurrentStreak(playingDates),
            practiseStreaks: calculateAllStreaks(practiseDates),
            playingStreaks: calculateAllStreaks(playingDates)
        };
    }

    function dayLabel(n) { return `${n} day${n === 1 ? '' : 's'}`; }

    function updateStreakBoxes() {
        const data = getStreakData();
        const p = document.getElementById('mainPractiseStreak');
        const pl = document.getElementById('mainPlayingStreak');
        if (p) p.innerText = dayLabel(data.currentPractise);
        if (pl) pl.innerText = dayLabel(data.currentPlaying);
    }

    function renderStreakStats() {
        try {
            const data = getStreakData();
            const avg = (arr) => arr.length ? (arr.reduce((a, b) => a + b, 0) / arr.length) : 0;

            const elCurP = document.getElementById('streakCurrentPractise');
            const elCurPl = document.getElementById('streakCurrentPlaying');
            const elAvgP = document.getElementById('streakAvgPractise');
            const elAvgPl = document.getElementById('streakAvgPlaying');
            if (elCurP) elCurP.innerText = dayLabel(data.currentPractise);
            if (elCurPl) elCurPl.innerText = dayLabel(data.currentPlaying);
            if (elAvgP) elAvgP.innerText = `${avg(data.practiseStreaks).toFixed(1)} days`;
            if (elAvgPl) elAvgPl.innerText = `${avg(data.playingStreaks).toFixed(1)} days`;

            renderStreakHistogram('streakChartPractise', data.practiseStreaks, '#4CAF50');
            renderStreakHistogram('streakChartPlaying', data.playingStreaks, 'var(--primary-action)');
        } catch (err) { showWarningToast("Streak stats error: " + err.message); }
    }

    function renderStreakHistogram(containerId, streaks, color) {
        const cont = document.getElementById(containerId);
        if (!cont) return;
        cont.innerHTML = '';
        if (!streaks.length) {
            cont.innerHTML = '<div style="text-align:center; color:#888; width:100%;">No streak data yet.</div>';
            return;
        }

        const maxLen = Math.max(...streaks);
        const counts = new Array(maxLen + 1).fill(0);
        streaks.forEach(s => counts[s]++);

        let maxCount = Math.max(...counts);
        if (maxCount === 0) maxCount = 1;
        let steps = [1, 2, 3, 4, 5, 7, 10, 15, 20, 25, 30, 40, 50];
        let step = steps.find(s => s * 3.5 >= maxCount) || Math.ceil(maxCount / 3);
        let chartMax = Math.max(maxCount * 1.05, step * 3);

        let gridLines = document.createElement('div');
        gridLines.className = 'chart-grid-lines';
        let yAxis = document.createElement('div');
        yAxis.className = 'chart-y-axis';
        let yAxisCont = document.createElement('div');
        yAxisCont.className = 'chart-y-axis-container';
        yAxis.appendChild(yAxisCont);

        [0, 1, 2, 3].forEach(i => {
            let val = step * i;
            let pct = (val / chartMax) * 100;
            let gl = document.createElement('div');
            gl.className = 'grid-line';
            gl.style.bottom = `${pct}%`;
            if (i === 0) gl.style.opacity = '0';
            gridLines.appendChild(gl);
            let yl = document.createElement('span');
            yl.style.position = 'absolute';
            yl.style.bottom = `${pct}%`;
            yl.style.right = '0px';
            yl.style.transform = 'translateY(50%)';
            yl.innerText = Math.round(val);
            yAxisCont.appendChild(yl);
        });

        cont.appendChild(gridLines);
        cont.appendChild(yAxis);
        let scroll = document.createElement('div');
        scroll.className = 'chart-scroll-area';

        for (let len = 1; len <= maxLen; len++) {
            let val = counts[len];
            let pct = (val / chartMax) * 100;
            let barCont = document.createElement('div');
            barCont.className = 'chart-bar-container';
            barCont.addEventListener('click', () => {
                showInfoToast(`${dayLabel(len)} streak: ${val} time${val === 1 ? '' : 's'}`);
            });

            let bar = document.createElement('div');
            bar.className = 'chart-bar';
            bar.style.height = `${pct}%`;
            bar.style.background = color;
            barCont.appendChild(bar);

            // Labelling every bar gets unreadable once streaks run long, so
            // only mark every 5th (5, 10, 15, ...) - and stop one step short
            // of the highest streak length rather than crowding a label
            // right up against the last bar (ML-72).
            if (len % 5 === 0 && len < maxLen) {
                let lbl = document.createElement('span');
                lbl.className = 'chart-x-label';
                lbl.innerText = len;
                barCont.appendChild(lbl);
            }

            scroll.appendChild(barCont);
        }
        cont.appendChild(scroll);
    }

    async function initializeApp() {
        // Check if coming back from OAuth callback
        if (await auth.handleCallback()) {
            console.log('OAuth callback processed');
        }

        // Check authentication - not logged in, so reveal the login button
        if (!auth.isAuthenticated) {
            displayLoginScreen();
            return;
        }

        // Ask the browser not to evict this origin's storage under space
        // pressure - some mobile browsers otherwise treat localStorage as
        // reclaimable cache and can clear it (silently logging the user
        // out) after the browser/app is fully closed. Best-effort: the
        // browser may ignore this, and it never prompts the user.
        navigator.storage?.persist?.().catch(() => {});

        // Pin the token now, once, and thread it explicitly through the
        // startup sequence below - see the comment in apiCall.
        const startupToken = auth.token;

        try {
            await loadAppData(startupToken);
            await fetchDataAndRender(startupToken);
            document.getElementById('date').valueAsDate = new Date();
            if (localStorage.getItem('darkMode') === 'true') {
                document.body.classList.add('dark-mode');
                document.getElementById('darkModeToggle').checked = true;
            }
            document.getElementById('tunerInstrumentSetting').value = localStorage.getItem(TUNER_INSTRUMENT_DEFAULT_KEY) || 'C';
            document.getElementById('tunerUseFlatsToggle').checked = localStorage.getItem(TUNER_USE_FLATS_KEY) === 'true';
        } catch (error) {
            console.warn('Failed to initialize app:', error.message);
            displayLoginScreen();
        }
    }

    function displayLoginScreen() {
        document.getElementById('mainContainer').style.display = 'none';
        document.getElementById('loginScreen').style.display = 'flex';
        const statusText = document.getElementById('loginStatusText');
        if (statusText) statusText.textContent = 'Please log in to continue';
        const btn = document.getElementById('loginBtn');
        if (btn) btn.style.display = 'inline-block';
    }

    function displayMainApp() {
        document.getElementById('loginScreen').style.display = 'none';
        document.getElementById('mainContainer').style.display = 'block';
    }

    document.getElementById('loginBtn')?.addEventListener('click', () => auth.login());
    window.logoutUser = function() {
        showConfirmModal('Log out', 'Are you sure you want to log out of Google?', () => auth.logout(), false);
    }

    async function loadAppData(token) {
        try {
            appData = await API.dropdownOptions(token);
            populateWhoDropdowns();
            renderDurationRadios();
        } catch (error) {
            console.warn('Failed to load settings:', error);
            appData = { organisations: [], teachers: [], durations: [] };
        }
    }

    // Archived organisations/teachers are hidden from pickers used for new
    // entries, but a record already assigned to one must keep showing it
    // (labelled as archived) so editing that record doesn't silently drop it.
    function activeNames(list) {
        return (list || []).filter(item => !item.archived).map(item => item.name);
    }

    function buildWhoOptionsHtml(list, selectedName) {
        const names = activeNames(list);
        let html = names.map(n => {
            const safe = String(n).replace(/'/g, "\\'").replace(/"/g, "&quot;");
            return `<option value="${safe}">${n}</option>`;
        }).join('');
        if (selectedName && !names.includes(selectedName)) {
            const safe = String(selectedName).replace(/'/g, "\\'").replace(/"/g, "&quot;");
            html += `<option value="${safe}">${selectedName} (archived)</option>`;
        }
        return html;
    }

    function populateWhoDropdowns() {
        const cWho = document.getElementById('cWho');
        if (!cWho) return;
        cWho.innerHTML = '<option value="">None</option>' + buildWhoOptionsHtml(appData.organisations);
    }

    // Duration presets come from the duration_options table (ML-7) rather
    // than being hardcoded here, so they can be managed without a release
    // and reused by both the save-session screen and the practice timer -
    // each gets its own id/name prefix since both radio groups exist in the
    // DOM at once (only one screen is visible, but ids must stay unique).
    function renderDurationOptionsInto(containerId, idPrefix, radioName) {
        const container = document.getElementById(containerId);
        if (!container) return;
        const optionsHtml = (appData.durations || []).map(mins =>
            `<input type="radio" id="${idPrefix}-${mins}" name="${radioName}" value="${mins}"><label for="${idPrefix}-${mins}">${mins}</label>`
        ).join('');
        container.innerHTML = optionsHtml +
            `<input type="radio" id="${idPrefix}-custom" name="${radioName}" value="custom"><label for="${idPrefix}-custom">Custom</label>`;
    }

    function renderDurationRadios() {
        renderDurationOptionsInto('durationRadios', 'dur', 'durationOption');
        renderDurationOptionsInto('timerDurationRadios', 'timerDur', 'timerDurationOption');
    }

    function fetchDataAndRender(token) {
        return Promise.all([
            API.sessions.get(token).then(data => { rawData = data; renderAllViews(); }),
            loadChallenges(token)
        ]).then(() => {
            displayMainApp();
        }).catch(err => {
            showWarningToast('Error loading data: ' + err.message);
            if (err.status === 401) {
                // A real auth failure (expired/invalid token) - the stored
                // token is no good, so actually log out rather than leave a
                // dead token in place for next time.
                auth.logout();
                return;
            }
            // Any other failure (e.g. a Sheets-backed 500) isn't an auth
            // problem - render with whatever data we have (rawData stays at
            // its default []) and show the shell anyway, so features that
            // don't need this data (Metronome, Tuner, Settings) stay reachable.
            renderAllViews();
            displayMainApp();
        });
    }

    // ========================================
    // BURGER MENU LOGIC
    // ========================================
    document.getElementById('navBurgerMenuBtn')?.addEventListener('click', (e) => {
        e.stopPropagation();
        document.getElementById('burgerDropdown').classList.toggle('show');
    });
    document.addEventListener('click', () => {
        const dropdown = document.getElementById('burgerDropdown');
        if(dropdown) dropdown.classList.remove('show');
    });
    function closeMenu() {
        const dropdown = document.getElementById('burgerDropdown');
        if(dropdown) dropdown.classList.remove('show');
    }

    // ========================================
    // CUSTOM MODALS LOGIC
    // ========================================
    let confirmCallback = null;
    function showConfirmModal(title, msg, callback, isDanger=true) {
        document.getElementById('confirmTitle').innerText = title;
        document.getElementById('confirmMessage').innerText = msg;
        const btn = document.getElementById('confirmActionBtn');
        btn.style.background = isDanger ? 'var(--danger-color)' : 'var(--primary-action)';
        btn.innerText = isDanger ? 'Delete' : 'Confirm';
        confirmCallback = callback;
        document.getElementById('confirmModal').style.display = 'flex';
    }
    window.closeConfirmModal = function() {
        document.getElementById('confirmModal').style.display = 'none';
        confirmCallback = null;
    }
    document.getElementById('confirmActionBtn')?.addEventListener('click', () => {
        if(confirmCallback) confirmCallback();
        closeConfirmModal();
    });

    let promptCallback = null;
    function showPromptModal(title, defaultVal, callback) {
        document.getElementById('promptTitle').innerText = title;
        const input = document.getElementById('promptInput');
        input.value = defaultVal || '';
        promptCallback = callback;
        document.getElementById('promptModal').style.display = 'flex';
        input.focus();
    }
    window.closePromptModal = function() {
        document.getElementById('promptModal').style.display = 'none';
        promptCallback = null;
    }
    document.getElementById('promptActionBtn')?.addEventListener('click', () => {
        const val = document.getElementById('promptInput').value.trim();
        if(promptCallback) promptCallback(val);
        closePromptModal();
    });

    // ========================================
    // VIEW NAVIGATION
    // ========================================
    const views = ['mainView', 'historyView', 'streakStatsView', 'statsView', 'entryForm', 'manageListsView', 'settingsView', 'aboutView', 'manageChallengesView', 'challengeSelectView', 'challengePlayView', 'challengeSummaryView', 'editChallengeView', 'metronomeView', 'metroBuilderView', 'tunerView', 'timerView'];
    let viewStack = ['mainView'];

    const viewAliasMap = {
        'main': 'mainView', 'history': 'historyView', 'stats': 'statsView', 'addForm': 'entryForm',
        'lists': 'manageListsView', 'settings': 'settingsView', 'challengesList': 'manageChallengesView',
        'challengeSelect': 'challengeSelectView', 'challengePlay': 'challengePlayView',
        'challengeSummary': 'challengeSummaryView', 'editChallenge': 'editChallengeView',
        'metronome': 'metronomeView', 'tuner': 'tunerView', 'timer': 'timerView'
    };

    window.switchView = function(viewName, isBack = false) {
        if (viewAliasMap[viewName]) viewName = viewAliasMap[viewName];

        if (!isBack && viewStack[viewStack.length - 1] !== viewName) viewStack.push(viewName);

        views.forEach(v => {
            const el = document.getElementById(v);
            if(el) el.style.display = 'none';
        });

        const targetEl = document.getElementById(viewName);
        if(targetEl) targetEl.style.display = 'block';

        const topBackBtn = document.getElementById('topBackBtn');
        if (viewName === 'mainView') {
            topBackBtn.classList.add('hidden-btn');
            document.getElementById('topTitle').innerText = 'The Music Ledger';
        } else {
            topBackBtn.classList.remove('hidden-btn');
        }

        if (viewName === 'historyView') { document.getElementById('topTitle').innerText = 'Session history'; renderHistoryList(rawData.filter(d => activeFilters[d.category])); }
        if (viewName === 'streakStatsView') { document.getElementById('topTitle').innerText = 'Streaks'; renderStreakStats(); }
        if (viewName === 'statsView') { document.getElementById('topTitle').innerText = 'Detailed stats'; scrollStatsToRight(); }
        if (viewName === 'entryForm') { document.getElementById('topTitle').innerText = 'Add record'; }
        if (viewName === 'manageListsView') { document.getElementById('topTitle').innerText = 'Manage lists'; loadManageLists(); }
        if (viewName === 'settingsView') {
            document.getElementById('topTitle').innerText = 'Settings';
            // Re-sync from storage in case the instrument was last changed on the Tuner page itself.
            document.getElementById('tunerInstrumentSetting').value = localStorage.getItem(TUNER_INSTRUMENT_DEFAULT_KEY) || 'C';
            document.getElementById('tunerUseFlatsToggle').checked = localStorage.getItem(TUNER_USE_FLATS_KEY) === 'true';
        }
        if (viewName === 'aboutView') { document.getElementById('topTitle').innerText = 'About'; renderAboutView(); }
        if (viewName === 'manageChallengesView') { document.getElementById('topTitle').innerText = 'Manage challenges'; renderChallengesList(); }
        if (viewName === 'challengeSelectView') { document.getElementById('topTitle').innerText = 'Select challenge'; renderChallengeSelect(); }
        if (viewName === 'challengePlayView') { document.getElementById('topTitle').innerText = 'Practise'; }
        if (viewName === 'challengeSummaryView') { document.getElementById('topTitle').innerText = 'Session complete'; topBackBtn.classList.add('hidden-btn'); }
        if (viewName === 'editChallengeView') { document.getElementById('topTitle').innerText = 'Edit challenge'; }
        if (viewName === 'metronomeView') {
            document.getElementById('topTitle').innerText = 'Metronome';
            metroPlayer.prewarm();
            // The initial paint runs while this view is still display:none (before the user has ever
            // navigated here), so the display-width measurement reads a 0px viewport and wrongly
            // decides the beats need the fixed-width/scrolling layout. Re-measure now that the view is
            // actually visible and has real dimensions.
            renderMetroTiers();
        }
        // The metronome itself is NOT stopped when navigating away (ML-64: "persist as a box at the
        // top of the screen") - only the mini-bar's visibility changes, exactly like the timer above.
        updateMetroMiniBarVisibility(viewName);

        if (viewName === 'metroBuilderView') {
            // No title text here any more (ML-91) - the tuner toggle takes that spot in the top bar
            // instead, and the view is unambiguous from its content anyway.
            document.getElementById('topTitle').innerText = '';
            metroBlkPlayer.prewarm();
            loadMetroBlkTimeSignatures();
            loadMetroBlkSetups();
            if (metroBlkCurrentSetup) {
                renderMetroBlkSetupHeader();
                renderMetroBlockTiles(); // also refreshes the play queue/preview above if it's gone stale
            } else {
                loadMetroBlkDefaultSetup();
            }
        }
        // Same persistence rule as the single-bar tool's mini bar (ML-64) - only visibility changes.
        updateMetroBlocksMiniBarVisibility(viewName);
        // The Metronome Blocks mini tuner is scoped to that one screen (unlike the metronome/timer
        // mini-bars, it doesn't persist elsewhere) - leaving the builder always closes it.
        updateMetroBlkMiniTunerVisibility(viewName);
        // The toggle that owns the tuner's on/off state (ML-91) only exists on this one screen.
        document.getElementById('topTunerToggleBtn')?.classList.toggle('hidden-group', viewName !== 'metroBuilderView');

        if (viewName === 'tunerView') {
            document.getElementById('topTitle').innerText = 'Tuner';
            startTuner();
        }
        // Don't kill the shared tuner engine's mic session just because the builder re-renders itself
        // (e.g. switching between saved setups) while its own mini tuner is the thing using it.
        else if (!(viewName === 'metroBuilderView' && metroBlkMiniTunerActive)) { stopTuner(); }

        if (viewName === 'timerView') {
            document.getElementById('topTitle').innerText = 'Timer';
            renderTimerScreen();
        }
        // The timer itself is NOT stopped when navigating away (ML-7: "shrink to a
        // bar") - only the mini-bar's visibility changes.
        updateTimerMiniBarVisibility(viewName);
    }

    window.goBack = function() {
        if (viewStack.length > 1) {
            viewStack.pop();
            switchView(viewStack[viewStack.length - 1], true);
        } else {
            switchView('mainView', true);
        }
    }

    // ========================================
    // ABOUT / RELEASES
    // ========================================
    function formatReleaseDate(dateStr) {
        const mNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
        const d = parseDateSafely(dateStr);
        return `${d.getDate()} ${mNames[d.getMonth()]} ${d.getFullYear()}`;
    }

    function renderChangeList(changes) {
        if (!changes.length) return '<div class="text-muted">No changes recorded for this release.</div>';
        const groups = [
            { label: '✨ New', items: changes.filter(c => c.type !== 'Fixes') },
            { label: '🐛 Fixes', items: changes.filter(c => c.type === 'Fixes') }
        ];
        return groups.filter(g => g.items.length).map(g => `
            <div style="margin-bottom:10px;">
                <strong style="font-size:0.85rem;">${g.label}</strong>
                <ul style="margin:5px 0 0 0; padding-left:20px;">
                    ${g.items.map(c => `<li style="margin-bottom:4px;">${c.summary}</li>`).join('')}
                </ul>
            </div>`).join('');
    }

    async function renderAboutView() {
        const currentEl = document.getElementById('aboutCurrentRelease');
        const historyEl = document.getElementById('aboutReleaseHistory');
        currentEl.innerHTML = 'Loading...';
        historyEl.innerHTML = '';

        try {
            const res = await fetch('/releases.json');
            const releases = await res.json();

            if (!releases.length) {
                currentEl.innerHTML = '<div class="text-muted">No releases recorded yet.</div>';
                return;
            }

            const [current, ...older] = releases;
            currentEl.innerHTML = `
                <div class="play-card" style="text-align:left;">
                    <div style="font-size:0.85rem; color:#888; margin-bottom:5px;">Current version</div>
                    <div class="play-piece">v${current.version}</div>
                    <div class="text-muted" style="margin-bottom:15px;">Released ${formatReleaseDate(current.date)}</div>
                    ${renderChangeList(current.changes)}
                </div>`;

            historyEl.innerHTML = older.length
                ? older.map(r => `
                    <div class="history-item" style="flex-direction:column; align-items:flex-start;">
                        <strong>v${r.version}</strong>
                        <div class="text-muted" style="font-size:0.85rem; margin-bottom:8px;">${formatReleaseDate(r.date)}</div>
                        ${renderChangeList(r.changes)}
                    </div>`).join('')
                : '<div class="text-muted">This is the first recorded release.</div>';
        } catch (err) {
            currentEl.innerHTML = `<div style="color:var(--danger-color);">Error loading releases: ${err.message}</div>`;
        }
    }

    // ========================================
    // CHALLENGE LOGIC
    // ========================================

    async function loadChallenges(token) {
        try {
            allChallenges = await API.challenges.get(token);
            if(document.getElementById('editChallengeView').style.display === 'block') renderEditChallengeItems();
            if(document.getElementById('manageChallengesView').style.display === 'block') renderChallengesList();
            if(document.getElementById('challengeSelectView').style.display === 'block') renderChallengeSelect();
        } catch (error) {
            showWarningToast('Error loading challenges: ' + error.message);
        }
    }

    document.getElementById('challTypeRadios')?.addEventListener('change', (e) => {
        const type = e.target.value;
        const perfFields = document.getElementById('cPerformanceFields');
        const techFields = document.getElementById('cTechniqueFields');
        const whoGroup = document.getElementById('cWhoGroup');
        const pieceLbl = document.getElementById('cPieceLabel');

        if(type === 'Performance') {
            perfFields.classList.remove('hidden-group');
            techFields.classList.add('hidden-group');
            whoGroup.classList.remove('hidden-group');
            pieceLbl.innerText = "Piece name";
        } else {
            perfFields.classList.add('hidden-group');
            techFields.classList.remove('hidden-group');
            whoGroup.classList.add('hidden-group');
            pieceLbl.innerText = "Exercise/Book name";
        }
    });

    document.getElementById('cTechAutoGenToggle')?.addEventListener('change', (e) => {
        if(e.target.checked) {
            document.getElementById('cTechAutoGenYes').classList.remove('hidden-group');
            document.getElementById('cTechAutoGenNo').classList.add('hidden-group');
        } else {
            document.getElementById('cTechAutoGenYes').classList.add('hidden-group');
            document.getElementById('cTechAutoGenNo').classList.remove('hidden-group');
        }
    });

    document.querySelectorAll('input[name="techBpmMode"]').forEach(radio => {
        radio.addEventListener('change', (e) => {
            if(e.target.value === 'fixed') {
                document.getElementById('cTechBpmFixedGroup').classList.remove('hidden-group');
                document.getElementById('cTechBpmRandomGroup').classList.add('hidden-group');
            } else {
                document.getElementById('cTechBpmFixedGroup').classList.add('hidden-group');
                document.getElementById('cTechBpmRandomGroup').classList.remove('hidden-group');
            }
        });
    });

    document.getElementById('saveNewChallBtn')?.addEventListener('click', async () => {
        const type = document.querySelector('input[name="challType"]:checked')?.value;
        const who = document.getElementById('cWho')?.value;
        const name = document.getElementById('cName')?.value;
        const piece = document.getElementById('cPiece')?.value;

        if(!name || !piece) return showWarningToast("Name and piece are required!");

        let itemsToSave = [];
        if (type === 'Performance') {
            itemsToSave.push({
                type, who, name, piece,
                ref: document.getElementById('cRef')?.value,
                barFrom: document.getElementById('cBarFrom')?.value,
                barTo: document.getElementById('cBarTo')?.value,
                bpm: document.getElementById('cBPM')?.value
            });
        } else {
            const isAuto = document.getElementById('cTechAutoGenToggle')?.checked;
            if (!isAuto) {
                itemsToSave.push({
                    type, who: '', name, piece,
                    ref: document.getElementById('cTechManualRef')?.value,
                    bpm: document.getElementById('cTechManualBpm')?.value
                });
            } else {
                const prefix = document.getElementById('cTechPrefix')?.value || '';
                const fNum = parseInt(document.getElementById('cTechFrom')?.value);
                const tNum = parseInt(document.getElementById('cTechTo')?.value);
                const bpmMode = document.querySelector('input[name="techBpmMode"]:checked')?.value;

                const fixedBpm = document.getElementById('cTechBpmFixed')?.value;
                const minBpm = parseInt(document.getElementById('cTechBpmMin')?.value) || 60;
                const maxBpm = parseInt(document.getElementById('cTechBpmMax')?.value) || 120;
                const interval = parseInt(document.getElementById('cTechBpmInterval')?.value) || 5;

                if (!isNaN(fNum) && !isNaN(tNum) && tNum >= fNum) {
                    for(let i = fNum; i <= tNum; i++) {
                        let finalBpm = '';
                        if (bpmMode === 'fixed') { finalBpm = fixedBpm; }
                        else {
                            let steps = Math.floor((maxBpm - minBpm) / interval);
                            if (steps < 0) steps = 0;
                            let rStep = Math.floor(Math.random() * (steps + 1));
                            finalBpm = minBpm + (rStep * interval);
                        }
                        let refStr = prefix ? `${prefix} ${i}`.trim() : `${i}`;
                        itemsToSave.push({ type, who: '', name, piece, ref: refStr, bpm: finalBpm });
                    }
                } else { return showWarningToast("Please enter valid From and To numbers."); }
            }
        }

        const btn = document.getElementById('saveNewChallBtn');
        btn.innerText = "Creating...";
        btn.disabled = true;

        try {
            const result = await API.challenges.create({ type, who: who || null, name, items: itemsToSave });
            showSuccessToast("Challenge created!");
            btn.innerText = "Create & add tasks";
            btn.disabled = false;
            document.getElementById('addChallengeModal').style.display = 'none';
            ['cName','cPiece','cRef','cBarFrom','cBarTo','cBPM','cTechFrom','cTechTo'].forEach(id => {
                let el = document.getElementById(id);
                if(el) el.value = '';
            });
            await loadChallenges();
        } catch (error) {
            showWarningToast("Creation error: " + error.message);
            btn.innerText = "Create & add tasks";
            btn.disabled = false;
        }
    });

    // List view filters
    document.getElementById('toggleShowCompletedChallenges')?.addEventListener('change', renderChallengesList);
    document.getElementById('filterChallPerf')?.addEventListener('change', renderChallengesList);
    document.getElementById('filterChallTech')?.addEventListener('change', renderChallengesList);

    function renderChallengesList() {
        try {
            const ui = document.getElementById('challengesListUI');
            if (!ui) return;
            ui.innerHTML = '';
            if(!allChallenges.length) {
                ui.innerHTML = "<p>No active challenges found.</p>";
                return;
            }

            let groups = {};
            allChallenges.forEach(c => {
                if(!groups[c.id]) {
                    groups[c.id] = { id: c.id, name: c.name, type: c.type, total:0, complete:0, time:0, p: c.priority };
                }
                groups[c.id].total++;
                if(isChallengeDone(c.status)) groups[c.id].complete++;
                groups[c.id].time += c.timeSpent || 0;
            });

            let showCompleted = document.getElementById('toggleShowCompletedChallenges')?.checked;
            let showPerf = document.getElementById('filterChallPerf')?.checked;
            let showTech = document.getElementById('filterChallTech')?.checked;

            let sortedIds = Object.keys(groups).sort((a,b) => groups[a].p - groups[b].p);

            sortedIds.forEach(id => {
                let g = groups[id];
                if(g.type === 'Performance' && !showPerf) return;
                if(g.type === 'Technique' && !showTech) return;

                let pct = Math.round((g.complete / g.total) * 100) || 0;
                if(!showCompleted && pct === 100) return;

                let typeColor = g.type === 'Performance' ? 'var(--cat-performance)' : 'var(--cat-lesson)';
                let typeIcon = g.type === 'Performance' ? '🎭' : '🛠️';

                ui.innerHTML += `<div class="history-item draggable-item" draggable="true" data-id="${g.id}" style="align-items:center; border-left-color: ${typeColor}; padding-left:5px;">
                    <span class="drag-handle" title="Drag to reorder">☰</span>
                    <div style="flex-grow:1; cursor:pointer;" onclick="openEditChallenge('${g.id}')">
                        <div style="display:flex; justify-content:space-between; width:100%; margin-bottom:8px;">
                            <strong>${typeIcon} ${g.name}</strong>
                            <span style="font-weight:bold; color:${pct===100?'var(--success-color)':'inherit'}">${pct}%</span>
                        </div>
                        <div style="font-size:0.85rem; color:#666;">
                            ${g.complete} / ${g.total} tasks complete | ${formatMins(g.time)} total time
                        </div>
                    </div>
                </div>`;
            });
            setupDragAndDrop(ui, 'challenge');
        } catch(err) { showWarningToast("Error loading challenges: " + err.message); }
    }

    function renderChallengeSelect() {
        try {
            const ui = document.getElementById('selectChallengesList');
            if (!ui) return;
            ui.innerHTML = '';

            if(!allChallenges.length) {
                ui.innerHTML = '<p>No challenges created yet.</p>';
                return;
            }

            let groups = {};
            allChallenges.forEach(c => {
                if(!groups[c.id]) {
                    groups[c.id] = { id: c.id, name: c.name, type: c.type, incomplete: 0 };
                }
                if(!isChallengeDone(c.status)) groups[c.id].incomplete++;
            });

            Object.values(groups).forEach(g => {
                if (g.incomplete > 0) {
                    const typeIcon = g.type === 'Performance' ? '🎭' : '🛠️';
                    const typeColor = g.type === 'Performance' ? 'var(--cat-performance)' : 'var(--cat-lesson)';
                    ui.innerHTML += `<button class="history-item" style="border-left-color: ${typeColor}; padding-left:5px; width:100%; text-align:left; cursor:pointer; flex-direction: column; align-items: flex-start; gap:4px;" onclick="startChallenge('${g.id}')">
                        <div style="width:100%;"><strong>${typeIcon} ${g.name}</strong></div>
                        <div class="text-muted" style="font-size:0.85rem;">${g.incomplete} remaining</div>
                    </button>`;
                }
            });
        } catch(err) { showWarningToast("Error loading challenge select: " + err.message); }
    }

    // --- CHALLENGE EDITOR (Items View) ---
    document.getElementById('toggleShowCompletedItems')?.addEventListener('change', renderEditChallengeItems);

    window.openEditChallenge = function(id) {
        editChallengeMeta.id = id;
        renderEditChallengeItems();
        switchView('editChallengeView');
    }

    window.editEntireChallenge = function() {
        showPromptModal('Rename challenge', editChallengeMeta.name, async (newName) => {
            if(newName && newName !== editChallengeMeta.name) {
                showInfoToast("Renaming...");
                try {
                    await API.challenges.updateGroup(editChallengeMeta.id, { name: newName });
                    showSuccessToast("Challenge renamed!");
                    editChallengeMeta.name = newName;
                    document.getElementById('ecName').innerText = newName;
                    await loadChallenges();
                } catch (error) {
                    showWarningToast(error.message);
                }
            }
        });
    }

    // "Closed" is distinct from "Complete" so a challenge abandoned partway
    // through doesn't read as finished, but both take it out of the active/
    // incomplete pool everywhere else in the UI.
    function isChallengeDone(status) {
        return status === 'Complete' || status === 'Closed';
    }

    window.closeEntireChallenge = function() {
        const items = allChallenges.filter(c => c.id == editChallengeMeta.id && !isChallengeDone(c.status));
        if (!items.length) return showWarningToast('Nothing left to close on this challenge.');
        showConfirmModal('Close challenge', `Mark the remaining ${items.length} task(s) as closed (not completed)?`, async () => {
            showInfoToast('Closing...');
            try {
                await API.challenges.close(editChallengeMeta.id);
                showSuccessToast('Challenge closed');
                await loadChallenges();
                renderEditChallengeItems();
            } catch (error) {
                showWarningToast('Error: ' + error.message);
            }
        }, false);
    }

    window.deleteEntireChallenge = function() {
        const items = allChallenges.filter(c => c.id == editChallengeMeta.id);
        const count = items.length;
        showConfirmModal('Delete challenge', `Are you sure? This will remove the challenge and all ${count} tasks.`, async () => {
            showInfoToast("Deleting challenge...");
            try {
                await API.challenges.deleteGroup(editChallengeMeta.id);
                showSuccessToast("Challenge deleted");
                await loadChallenges();
                goBack();
            } catch (error) {
                showWarningToast("Error: " + error.message);
            }
        });
    }

    function renderEditChallengeItems() {
        try {
            const items = allChallenges.filter(c => c.id == editChallengeMeta.id);
            const ecItemsList = document.getElementById('ecItemsList');
            const ecStats = document.getElementById('ecStats');
            const ecName = document.getElementById('ecName');
            const ecWhoType = document.getElementById('ecWhoType');

            if(!ecItemsList || !items.length) {
                if(ecItemsList) ecItemsList.innerHTML = "<p>No tasks remaining in this challenge.</p>";
                if(ecStats) ecStats.innerText = "0 / 0 tasks complete | 0h 0m total time";
                return;
            }

            editChallengeMeta.type = items[0].type;
            editChallengeMeta.who = items[0].who;
            editChallengeMeta.name = items[0].name;

            if(ecName) ecName.innerText = editChallengeMeta.name;
            if(ecWhoType) ecWhoType.innerText = `${editChallengeMeta.type} ${editChallengeMeta.who ? 'for ' + editChallengeMeta.who : ''}`;

            let completeCount = items.filter(i => isChallengeDone(i.status)).length;
            let totalTime = items.reduce((sum, i) => sum + (i.timeSpent || 0), 0);
            if(ecStats) ecStats.innerText = `${completeCount} / ${items.length} tasks complete | ${formatMins(totalTime)} total time`;

            let showCompleted = document.getElementById('toggleShowCompletedItems')?.checked;
            ecItemsList.innerHTML = '';

            items.forEach(item => {
                if(!showCompleted && isChallengeDone(item.status)) return;
                let refStr = item.ref || '';
                if (item.barFrom || item.barTo) refStr += ` (Bars ${item.barFrom || '?'} - ${item.barTo || '?'})`;
                let safePiece = String(item.piece).replace(/'/g, "\\'").replace(/"/g, "&quot;");
                let borderColor = item.status === 'Complete' ? 'var(--success-color)' : (item.status === 'Closed' ? '#999' : 'var(--primary-action)');

                ecItemsList.innerHTML += `
                <div class="history-item draggable-item" draggable="true" data-id="${item.row}" style="align-items:center; border-left: 4px solid ${borderColor}; padding-left:5px;">
                    <span class="drag-handle" title="Drag to reorder">☰</span>
                    <div style="flex-grow:1;">
                        <div style="display:flex; justify-content:space-between; width:100%;">
                            <strong>${item.piece}</strong>
                            <span style="font-size:0.85rem; color:#888;">${item.status}</span>
                        </div>
                        <div style="font-size:0.85rem; color:#666; margin-bottom:10px;">${refStr} ${item.bpm ? '| '+item.bpm+' bpm' : ''}</div>
                        <div style="display:flex; gap:5px; width:100%;">
                            <button class="btn-edit" style="flex:1" onclick="openItemDetailModal('${item.row}')">Edit</button>
                            <button class="btn-delete" style="flex:1" onclick="deleteChallengeItem('${item.row}', '${safePiece}')">Delete</button>
                        </div>
                    </div>
                </div>`;
            });
            setupDragAndDrop(ecItemsList, 'item');
        } catch(err) { showWarningToast("Error loading challenge editor: " + err.message); }
    }

    window.openItemDetailModal = function(row = null) {
        const modal = document.getElementById('itemDetailModal');
        const title = document.getElementById('itemModalTitle');
        document.getElementById('itemEditId').value = row || '';
        if(row) {
            title.innerText = "Edit task";
            const item = allChallenges.find(c => c.row == row);
            if (item) {
                document.getElementById('iPiece').value = item.piece;
                document.getElementById('iRef').value = item.ref || '';
                document.getElementById('iBarFrom').value = item.barFrom || '';
                document.getElementById('iBarTo').value = item.barTo || '';
                document.getElementById('iBPM').value = item.bpm || '';
            }
        } else {
            title.innerText = "Add new task";
            ['iPiece','iRef','iBarFrom','iBarTo','iBPM'].forEach(id => {
                const el = document.getElementById(id);
                if(el) el.value = '';
            });
        }
        if(modal) modal.style.display = 'flex';
    }

    document.getElementById('saveItemBtn')?.addEventListener('click', async () => {
        const row = document.getElementById('itemEditId').value;
        const piece = document.getElementById('iPiece')?.value;
        if(!piece) return showWarningToast("Task piece name is required!");

        const ref = document.getElementById('iRef')?.value;
        const bf = document.getElementById('iBarFrom')?.value;
        const bt = document.getElementById('iBarTo')?.value;
        const bpm = document.getElementById('iBPM')?.value;
        const details = { piece, ref: ref || '', barFrom: bf || '', barTo: bt || '', bpm: bpm || '' };

        const btn = document.getElementById('saveItemBtn');
        btn.innerText = "Saving...";
        btn.disabled = true;

        try {
            if (row) {
                await API.challenges.update(row, details);
            } else {
                await API.challenges.addItem(editChallengeMeta.id, details);
            }
            btn.innerText = "Save task";
            btn.disabled = false;
            document.getElementById('itemDetailModal').style.display = 'none';
            await loadChallenges();
            showSuccessToast("Task saved!");
        } catch (error) {
            btn.innerText = "Save task";
            btn.disabled = false;
            showWarningToast("Error: " + error.message);
        }
    });

    window.deleteChallengeItem = function(row, pieceName) {
        showConfirmModal('Delete task', `Delete "${pieceName}"?`, async () => {
            showInfoToast("Deleting...");
            try {
                await API.challenges.delete(row);
                showSuccessToast("Task deleted");
                await loadChallenges();
            } catch (error) {
                showWarningToast("Error: " + error.message);
            }
        });
    }

    function setupDragAndDrop(container, type) {
        let draggedEl = null;
        const items = container.querySelectorAll('.draggable-item');

        items.forEach(item => {
            item.addEventListener('dragstart', (e) => {
                draggedEl = item;
                e.dataTransfer.effectAllowed = 'move';
            });

            item.addEventListener('dragover', (e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                if (item !== draggedEl) {
                    container.insertBefore(draggedEl, item);
                }
            });

            item.addEventListener('dragend', async () => {
                if (draggedEl) {
                    const allIds = Array.from(container.querySelectorAll('.draggable-item')).map(el => el.getAttribute('data-id'));
                    if (type === 'challenge') {
                        try {
                            showInfoToast("Updating order...");
                            await Promise.all(allIds.map((id, idx) =>
                                API.challenges.updateGroup(id, { priority: idx })
                            ));
                            closeToast('toastInfo');
                            showSuccessToast("Order updated");
                        } catch (error) {
                            showWarningToast("Error updating order: " + error.message);
                        }
                    } else if (type === 'item') {
                        try {
                            showInfoToast("Updating order...");
                            await Promise.all(allIds.map((id, idx) =>
                                API.challenges.update(id, { priority: idx })
                            ));
                            closeToast('toastInfo');
                            showSuccessToast("Order updated");
                        } catch (error) {
                            showWarningToast("Error updating order: " + error.message);
                        }
                    }
                    draggedEl = null;
                }
            });
        });
    }

    async function startChallenge(id) {
        currentSessionChallengeId = id;
        activeChallengeItems = allChallenges.filter(c => c.id == id && !isChallengeDone(c.status));
        currentPlayIndex = 0;
        currentSessionLog = { time: 0, items: [] };

        if(activeChallengeItems.length === 0) return endChallengeSession(true);
        switchView('challengePlayView');
        loadNextChallengeItem();
    }

    function loadNextChallengeItem() {
        if (currentPlayIndex >= activeChallengeItems.length) {
            endChallengeSession(true);
            return;
        }

        const item = activeChallengeItems[currentPlayIndex];
        document.getElementById('playPiece').innerText = item.piece;
        document.getElementById('playRef').innerText = item.ref || 'No reference';
        document.getElementById('playBpm').innerText = item.bpm || 'No BPM';
        document.getElementById('playStatus').innerText = `Task ${currentPlayIndex + 1} of ${activeChallengeItems.length}`;
        document.querySelector('input[name="playStatus"][value="Attempted"]').checked = true;
        document.querySelector('input[name="playTime"][value="30"]').checked = true;
        document.getElementById('playCustomTime').value = '';
        document.getElementById('customTimeGroup')?.classList.add('hidden-group');
    }

    // Lets the player browse back and forth through the challenge's task
    // order (set when the challenge was created) without having to save
    // progress just to look at a neighbouring task.
    window.goToChallengeItem = function(delta) {
        const newIndex = currentPlayIndex + delta;
        if (!Number.isInteger(newIndex) || newIndex < 0 || newIndex >= activeChallengeItems.length) return;
        currentPlayIndex = newIndex;
        animateChallengeCardTransition(delta, loadNextChallengeItem);
    };

    // Slides the task card out in the direction of the swipe, swaps its
    // content once off-screen, then slides the new task in from the
    // opposite side - without this a swipe just changed text in place with
    // no visual sign anything had happened.
    let challengeCardAnimating = false;
    function animateChallengeCardTransition(direction, renderFn) {
        const card = document.querySelector('#challengePlayView .play-card');
        if (!card || challengeCardAnimating) { renderFn(); return; }

        challengeCardAnimating = true;
        const outClass = direction > 0 ? 'slide-out-left' : 'slide-out-right';
        const inClass = direction > 0 ? 'slide-in-right' : 'slide-in-left';

        card.classList.add(outClass);
        card.addEventListener('transitionend', function onOut() {
            card.classList.remove(outClass);
            renderFn();
            card.classList.add(inClass);
            void card.offsetWidth; // force reflow so the "entry" position registers before animating away from it
            requestAnimationFrame(() => {
                card.classList.remove(inClass);
                card.addEventListener('transitionend', () => { challengeCardAnimating = false; }, { once: true });
            });
        }, { once: true });
    }

    (function setupChallengePlaySwipe() {
        const el = document.getElementById('challengePlayView');
        if (!el) return;
        let startX = 0, startY = 0;
        el.addEventListener('touchstart', (e) => {
            startX = e.touches[0].clientX;
            startY = e.touches[0].clientY;
        }, { passive: true });
        el.addEventListener('touchend', (e) => {
            const dx = e.changedTouches[0].clientX - startX;
            const dy = e.changedTouches[0].clientY - startY;
            if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) {
                goToChallengeItem(dx < 0 ? 1 : -1);
            }
        }, { passive: true });
    })();

    async function processChallengeSave(proceedNext) {
        const item = activeChallengeItems[currentPlayIndex];
        const timeRadio = document.querySelector('input[name="playTime"]:checked')?.value;
        const addTime = timeRadio === 'custom' ? document.getElementById('playCustomTime')?.value : timeRadio;
        const newStatus = document.querySelector('input[name="playStatus"]:checked')?.value;

        if(!addTime || isNaN(addTime)) return showWarningToast("Please provide a valid time!");

        const btnNext = document.getElementById('saveNextBtn');
        const btnEnd = document.getElementById('saveEndBtn');
        btnNext.disabled = true;
        btnEnd.disabled = true;
        showInfoToast("Saving...");

        try {
            await API.challenges.update(item.row, {
                status: newStatus,
                timeSpent: (item.timeSpent || 0) + Number(addTime)
            });

            showSuccessToast(`Saved ${addTime} mins`);
            currentSessionLog.time += Number(addTime);
            currentSessionLog.items.push({ piece: item.piece, ref: item.ref, status: newStatus, time: addTime });

            item.timeSpent = (item.timeSpent || 0) + Number(addTime);
            item.status = newStatus;
            btnNext.disabled = false;
            btnEnd.disabled = false;

            if(proceedNext) {
                currentPlayIndex++;
                loadNextChallengeItem();
            } else {
                endChallengeSession(false);
            }
        } catch (error) {
            showWarningToast("Error saving: " + error.message);
            btnNext.disabled = false;
            btnEnd.disabled = false;
        }
    }

    document.getElementById('saveNextBtn')?.addEventListener('click', () => processChallengeSave(true));
    document.getElementById('saveEndBtn')?.addEventListener('click', () => processChallengeSave(false));

    document.getElementById('playTimeRadios')?.addEventListener('change', (e) => {
        if (e.target.name !== 'playTime') return;
        const customGroup = document.getElementById('customTimeGroup');
        if (e.target.value === 'custom') {
            customGroup.classList.remove('hidden-group');
            document.getElementById('playCustomTime')?.focus();
        } else {
            customGroup.classList.add('hidden-group');
        }
    });

    window.endChallengeSession = function(allCompleted = false) {
        switchView('challengeSummaryView');
        const title = document.getElementById('summaryTitle');
        if (allCompleted) {
            title.innerText = "All challenges complete! 🎉";
            title.style.color = "var(--success-color)";
        } else {
            title.innerText = "Session complete!";
            title.style.color = "var(--primary-action)";
        }

        document.getElementById('sumTime').innerText = formatMins(currentSessionLog.time);
        document.getElementById('sumItems').innerText = currentSessionLog.items.length;

        let ul = document.getElementById('sumCompletedItems');
        if(ul) {
            ul.innerHTML = '';
            currentSessionLog.items.forEach(i => {
                let color = i.status === 'Complete' ? 'var(--success-color)' : 'var(--selection-color)';
                ul.innerHTML += `<div style="padding:10px; border-bottom:1px solid #eee; display:flex; justify-content:space-between;"><span><strong>${i.piece}</strong> ${i.ref}</span><span style="color:${color}; font-weight:bold;">${i.status} (${i.time}m)</span></div>`;
            });
        }
        fetchDataAndRender();
    }

    // ========================================
    // GENERAL DASHBOARD/STATS LOGIC
    // ========================================
    window.scrollArea = function(btn, amount) {
        let container = btn.parentElement.querySelector('.chart-scroll-area, .heatmap-wrapper');
        if(container) container.scrollBy({ left: amount, behavior: 'smooth' });
    }

    function scrollStatsToRight() {
        setTimeout(() => {
            document.querySelectorAll('.chart-scroll-area, .heatmap-wrapper').forEach(w => w.scrollLeft = w.scrollWidth);
        }, 80);
    }

    document.getElementById('statsTimeframe')?.addEventListener('change', function() {
        const customDateRange = document.getElementById('customDateRange');
        if (this.value === 'custom') {
            customDateRange.classList.remove('hidden-group');
        } else {
            customDateRange.classList.add('hidden-group');
            renderStatsBoxes();
        }
    });
    document.getElementById('customStartDate')?.addEventListener('change', renderStatsBoxes);
    document.getElementById('customEndDate')?.addEventListener('change', renderStatsBoxes);

    function getDateRange(tf) {
        const today = new Date();
        let start = new Date(0);
        let end = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59);

        if (tf === 'this_cal_year') start = new Date(today.getFullYear(), 0, 1);
        else if (tf === 'this_prac_year') start = new Date((today.getMonth() >= 10) ? today.getFullYear() : today.getFullYear() - 1, 10, 1);
        else if (tf === 'this_month') start = new Date(today.getFullYear(), today.getMonth(), 1);
        else if (tf === 'last_3_months') start = new Date(today.getFullYear(), today.getMonth() - 2, 1);
        else if (tf === 'last_6_months') start = new Date(today.getFullYear(), today.getMonth() - 5, 1);
        else if (tf === 'this_week') start = new Date(today.getFullYear(), today.getMonth(), today.getDate() - ((today.getDay() + 6) % 7));
        else if (tf === 'last_2_weeks') start = new Date(today.getFullYear(), today.getMonth(), today.getDate() - ((today.getDay() + 6) % 7) - 7);
        else if (tf === 'last_4_weeks') start = new Date(today.getFullYear(), today.getMonth(), today.getDate() - ((today.getDay() + 6) % 7) - 21);
        else if (tf === 'custom') {
            const sVal = document.getElementById('customStartDate')?.value;
            const eVal = document.getElementById('customEndDate')?.value;
            if (sVal) start = parseDateSafely(sVal);
            if (eVal) { end = parseDateSafely(eVal); end.setHours(23, 59, 59); }
        }
        return { start, end };
    }

    function renderStatsBoxes() {
        const tf = document.getElementById('statsTimeframe')?.value;
        const { start, end } = getDateRange(tf);
        let catStats = { 'Practise':{m:0,s:0}, 'Rehearsal':{m:0,s:0}, 'Performance':{m:0,s:0}, 'Lesson':{m:0,s:0} };
        let totalMins = 0; let totalSess = 0;

        rawData.forEach(d => {
            const dObj = parseDateSafely(d.dateStr);
            if (dObj >= start && dObj <= end) {
                totalMins += d.duration; totalSess++;
                if (catStats[d.category]) { catStats[d.category].m += d.duration; catStats[d.category].s++; }
            }
        });

        const statOverall = document.getElementById('statOverall');
        const statPrac = document.getElementById('statPrac');
        const statReh = document.getElementById('statReh');
        const statPerf = document.getElementById('statPerf');
        const statLess = document.getElementById('statLess');

        if(statOverall) statOverall.innerHTML = `${formatMins(totalMins)} <span class="sess-count">(${totalSess})</span>`;
        if(statPrac) statPrac.innerHTML = `${formatMins(catStats['Practise'].m)} <span class="sess-count">(${catStats['Practise'].s})</span>`;
        if(statReh) statReh.innerHTML = `${formatMins(catStats['Rehearsal'].m)} <span class="sess-count">(${catStats['Rehearsal'].s})</span>`;
        if(statPerf) statPerf.innerHTML = `${formatMins(catStats['Performance'].m)} <span class="sess-count">(${catStats['Performance'].s})</span>`;
        if(statLess) statLess.innerHTML = `${formatMins(catStats['Lesson'].m)} <span class="sess-count">(${catStats['Lesson'].s})</span>`;
    }

    function updateFilterButtonText() {
        let active = Object.keys(activeFilters).filter(k => activeFilters[k]);
        let text = active.length === 4 ? 'All' : (active.length === 0 ? 'None' : active.join(', '));
        const filterStatsBtn = document.getElementById('filterStatsBtn');
        const filterHistoryBtn = document.getElementById('filterHistoryBtn');
        if(filterStatsBtn) filterStatsBtn.innerText = 'Filter stats (' + text + ')';
        if(filterHistoryBtn) filterHistoryBtn.innerText = 'Filter history (' + text + ')';
    }

    document.getElementById('filterAllOn')?.addEventListener('click', () => document.querySelectorAll('.cat-filter').forEach(cb => cb.checked = true));
    document.getElementById('filterAllOff')?.addEventListener('click', () => document.querySelectorAll('.cat-filter').forEach(cb => cb.checked = false));
    document.getElementById('applyFilterBtn')?.addEventListener('click', () => {
        document.querySelectorAll('.cat-filter').forEach(cb => activeFilters[cb.value] = cb.checked);
        document.getElementById('filterModal').style.display = 'none';
        updateFilterButtonText();
        renderFilteredVisuals();
    });

    document.getElementById('categoryRadios')?.addEventListener('change', function(e) {
        if(e.target.name === 'category') {
            const cat = e.target.value;
            const whoSelect = document.getElementById('who');
            if(!whoSelect) return;
            whoSelect.innerHTML = '';
            if (cat === 'Practise') {
                document.getElementById('whoGroup').classList.add('hidden-group');
            } else {
                document.getElementById('whoGroup').classList.remove('hidden-group');
                whoSelect.innerHTML = buildWhoOptionsHtml(cat === 'Lesson' ? appData.teachers : appData.organisations);
            }
        }
    });

    document.getElementById('durationRadios')?.addEventListener('change', (e) => {
        if (e.target.name !== 'durationOption') return;
        const customGroup = document.getElementById('customDurationGroup');
        if (e.target.value === 'custom') {
            customGroup.classList.remove('hidden-group');
            document.getElementById('duration')?.focus();
        } else {
            customGroup.classList.add('hidden-group');
        }
    });

    document.getElementById('submitBtn')?.addEventListener('click', async () => {
        const cat = document.querySelector('input[name="category"]:checked')?.value;
        const durRadio = document.querySelector('input[name="durationOption"]:checked')?.value;
        const dur = durRadio === 'custom' ? document.getElementById('duration')?.value : durRadio;
        const dStr = document.getElementById('date')?.value;
        const who = !document.getElementById('whoGroup')?.classList.contains('hidden-group') ? document.getElementById('who')?.value : '';

        if (!dur || isNaN(dur)) { showWarningToast('Duration required!'); return; }

        const btn = document.getElementById('submitBtn');
        btn.innerText = 'Saving...';
        btn.disabled = true;

        try {
            const result = await API.sessions.create({
                category: cat,
                duration: Number(dur),
                who: who || null,
                date: dStr
            });
            showSuccessToast(result.message);
            btn.innerText = 'Save session';
            btn.disabled = false;
            document.getElementById('duration').value = '';
            document.querySelectorAll('input[name="durationOption"]').forEach(r => r.checked = false);
            document.getElementById('customDurationGroup')?.classList.add('hidden-group');
            goBack();
            fetchDataAndRender();
        } catch (error) {
            showWarningToast('Save error: ' + error.message);
            btn.innerText = 'Save session';
            btn.disabled = false;
        }
    });

    function formatMins(mins) {
        mins = Math.round(mins);
        const h = Math.floor(mins / 60);
        const m = mins % 60;
        return `${h}h ${m}m`;
    }

    function renderAllViews() {
        try {
            let tMins = 0, tSess = 0;
            rawData.forEach(d => { tMins += d.duration; tSess++; });
            const mainTotalTime = document.getElementById('mainTotalTime');
            const mainTotalSessions = document.getElementById('mainTotalSessions');
            if(mainTotalTime) mainTotalTime.innerText = formatMins(tMins);
            if(mainTotalSessions) mainTotalSessions.innerText = tSess;
            updateStreakBoxes();
            updateFilterButtonText();
            renderStatsBoxes();
            renderFilteredVisuals();
        } catch(err) { showWarningToast("Render Error: " + err.message); }
    }

    function renderFilteredVisuals() {
        try {
            const filtered = rawData.filter(d => activeFilters[d.category]);
            let dailyMins = {}, dailySess = {};
            filtered.forEach(d => {
                const dateKey = d.dateStr;
                dailyMins[dateKey] = (dailyMins[dateKey]||0) + d.duration;
                dailySess[dateKey] = (dailySess[dateKey]||0) + 1;
            });
            buildHeatmap('timeHeatmap', dailyMins, 'time');
            buildHeatmap('sessHeatmap', dailySess, 'sess');
            buildCharts(filtered);
            renderHistoryList(filtered);
        } catch(err) { showWarningToast("Visuals Error: " + err.message); }
    }

    function buildHeatmap(containerId, dataMap, type) {
        try {
            const container = document.getElementById(containerId);
            if(!container) return;
            container.innerHTML = '';
            if(rawData.length === 0) return;

            const today = new Date();
            let minDateObj = rawData.length > 0 ? parseDateSafely(rawData[rawData.length-1].dateStr) : today;
            if (minDateObj > today) minDateObj = new Date(today.getFullYear()-1, today.getMonth(), today.getDate());

            const day = minDateObj.getDay();
            const diff = minDateObj.getDate() - day + (day === 0 ? -6 : 1);
            let current = new Date(minDateObj.getFullYear(), minDateObj.getMonth(), diff);
            let col = document.createElement('div');
            col.className = 'heat-col';

            while (current <= today) {
                let dow = (current.getDay() + 6) % 7;
                if (current.getDate() === 1 && col.children.length > 0) {
                    container.appendChild(col);
                    if (current.getMonth() === 0) {
                        let ys = document.createElement('div');
                        ys.className = 'year-spacer';
                        ys.innerHTML = `<span>${current.getFullYear()}</span>`;
                        container.appendChild(ys);
                    } else {
                        let ms = document.createElement('div');
                        ms.className = 'month-spacer';
                        container.appendChild(ms);
                    }
                    col = document.createElement('div');
                    col.className = 'heat-col';
                    let ml = document.createElement('div');
                    ml.className = 'month-label';
                    ml.innerText = current.toLocaleString('default', { month: 'short' });
                    col.appendChild(ml);
                    for(let i=0; i<dow; i++){
                        let b = document.createElement('div');
                        b.className = 'heat-cell blank';
                        col.appendChild(b);
                    }
                } else if (dow === 0 && col.children.length > 0) {
                    container.appendChild(col);
                    col = document.createElement('div');
                    col.className = 'heat-col';
                }

                let key = current.getFullYear() + '-' + String(current.getMonth()+1).padStart(2,'0') + '-' + String(current.getDate()).padStart(2,'0');
                let val = dataMap[key] || 0;
                let level = 0;
                if(type === 'time') {
                    if(val > 0) level=1;
                    if(val>=30) level=2;
                    if(val>=60) level=3;
                    if(val>=120) level=4;
                } else {
                    if(val > 0) level=1;
                    if(val>=2) level=2;
                    if(val>=3) level=3;
                    if(val>=4) level=4;
                }

                let cell = document.createElement('div');
                cell.className = `heat-cell h-${type}-${level}`;
                let [y, m, d] = key.split('-');
                let mNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
                let fDate = parseInt(d, 10) + ' ' + mNames[parseInt(m, 10)-1] + ' ' + y;
                cell.addEventListener('click', function() {
                    showInfoToast(`${fDate}: ${type==='time' ? Math.round(val)+' mins' : Math.round(val)+' sess'}`);
                });
                col.appendChild(cell);
                current.setDate(current.getDate() + 1);
            }
            container.appendChild(col);
        } catch(err) { showWarningToast("Heatmap Error: " + err.message); }
    }

    function buildCharts(filtered) {
        try {
            const contDays = document.getElementById('chartDays');
            const contHrs = document.getElementById('chartHours');
            const contSess = document.getElementById('chartSess');
            if(!contDays || !contHrs || !contSess) return;

            contDays.innerHTML = '';
            contHrs.innerHTML = '';
            contSess.innerHTML = '';
            if(rawData.length === 0) return;

            let minDate = parseDateSafely(rawData[rawData.length-1].dateStr);
            let today = new Date();
            let monthMap = {};
            let curr = new Date(minDate.getFullYear(), minDate.getMonth(), 1);
            let end = new Date(today.getFullYear(), today.getMonth(), 1);
            let order = [];

            while(curr <= end) {
                let key = curr.getFullYear() + '-' + String(curr.getMonth()+1).padStart(2,'0');
                order.push(key);
                monthMap[key] = { days: new Set(), hours: 0, sess: 0 };
                curr.setMonth(curr.getMonth() + 1);
            }

            filtered.forEach(d => {
                const dateStr = parseDateSafely(d.dateStr).toISOString().split('T')[0];
                let k = dateStr.substring(0,7);
                if(monthMap[k]) {
                    monthMap[k].days.add(dateStr);
                    monthMap[k].hours += (d.duration / 60);
                    monthMap[k].sess += 1;
                }
            });

            let maxDays=0, maxHrs=0, maxSess=0;
            order.forEach(k => {
                if(monthMap[k].days.size > maxDays) maxDays = monthMap[k].days.size;
                if(monthMap[k].hours > maxHrs) maxHrs = monthMap[k].hours;
                if(monthMap[k].sess > maxSess) maxSess = monthMap[k].sess;
            });

            renderBarChart(contHrs, order, monthMap, maxHrs, 'hours');
            renderBarChart(contDays, order, monthMap, maxDays, 'days');
            renderBarChart(contSess, order, monthMap, maxSess, 'sess');
        } catch(err) { showWarningToast("Chart Error: " + err.message); }
    }

    function renderBarChart(cont, order, dataMap, maxVal, type) {
        if (maxVal === 0) maxVal = 1;
        let steps = [1, 2, 3, 4, 5, 7, 10, 15, 20, 25, 30, 40, 50, 75, 100, 150, 200, 250, 300, 500, 1000];
        let step = steps.find(s => s * 3.5 >= maxVal) || Math.ceil(maxVal/3);
        let chartMax = Math.max(maxVal * 1.05, step * 3);

        let gridLines = document.createElement('div');
        gridLines.className = 'chart-grid-lines';
        let yAxis = document.createElement('div');
        yAxis.className = 'chart-y-axis';
        let yAxisCont = document.createElement('div');
        yAxisCont.className = 'chart-y-axis-container';
        yAxis.appendChild(yAxisCont);

        [0, 1, 2, 3].forEach(i => {
            let val = step * i;
            let pct = (val / chartMax) * 100;
            let gl = document.createElement('div');
            gl.className = 'grid-line';
            gl.style.bottom = `${pct}%`;
            if(i===0) gl.style.opacity = '0';
            gridLines.appendChild(gl);
            let yl = document.createElement('span');
            yl.style.position = 'absolute';
            yl.style.bottom = `${pct}%`;
            yl.style.right = `0px`;
            yl.style.transform = 'translateY(50%)';
            yl.innerText = val;
            yAxisCont.appendChild(yl);
        });

        cont.appendChild(gridLines);
        cont.appendChild(yAxis);
        let scroll = document.createElement('div');
        scroll.className = 'chart-scroll-area';

        order.forEach((k, idx) => {
            let val = (type === 'days') ? dataMap[k].days.size : dataMap[k][type];
            let pct = (val / chartMax) * 100;
            let barCont = document.createElement('div');
            barCont.className = 'chart-bar-container';
            let vStr = type === 'hours' ? val.toFixed(1) + ' hours' : Math.round(val) + (type === 'days' ? ' active days' : ' sessions');
            barCont.addEventListener('click', function() {
                let [y, m] = k.split('-');
                let mNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
                showInfoToast(`${mNames[parseInt(m, 10)-1]} ${y}: ${vStr}`);
            });

            let bar = document.createElement('div');
            bar.className = 'chart-bar';
            bar.style.height = `${pct}%`;
            if(type === 'hours') bar.style.background = '#4CAF50';
            if(type === 'days') bar.style.background = '#FFC107';
            if(type === 'sess') bar.style.background = '#9C27B0';
            barCont.appendChild(bar);

            let [y, m] = k.split('-');
            let mIdx = parseInt(m, 10) - 1;
            let mName = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][mIdx];
            let showLabel = false;
            let showYear = false;
            if (idx === 0) { showLabel = true; showYear = true; }
            else if (mIdx === 0) { showLabel = true; showYear = true; }
            else if (mIdx === 3 || mIdx === 6 || mIdx === 9) { showLabel = true; }

            if (showLabel) {
                let lbl = document.createElement('span');
                lbl.className = 'chart-x-label';
                if (showYear) {
                    lbl.innerHTML = `${mName}<br><span style="font-size:0.6rem;opacity:0.8;">${y}</span>`;
                } else {
                    lbl.innerHTML = mName;
                }
                barCont.appendChild(lbl);
            }
            scroll.appendChild(barCont);
        });
        cont.appendChild(scroll);
    }

    function renderHistoryList(filtered) {
        try {
            const y = currentHistDate.getFullYear();
            const m = currentHistDate.getMonth();
            const mNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
            const monthDisplay = document.getElementById('currentMonthDisplay');
            if(monthDisplay) monthDisplay.innerText = `${mNames[m]} ${y}`;

            const list = document.getElementById('historyList');
            if(!list) return;
            list.innerHTML = '';

            const monthData = filtered.filter(d => {
                let dObj = parseDateSafely(d.dateStr);
                return dObj.getFullYear()===y && dObj.getMonth()===m;
            });

            if(monthData.length === 0) {
                list.innerHTML = '<div style="text-align:center; padding: 20px;">No entries.</div>';
                const historySummary = document.getElementById('historySummary');
                if(historySummary) historySummary.innerText = `0h 0m (0)`;
                return;
            }

            let totalMins = 0;
            monthData.forEach(item => {
                totalMins += item.duration;
                const div = document.createElement('div');
                div.className = 'history-item';
                div.style.borderLeftColor = colorMap[item.category];

                let dObj = parseDateSafely(item.dateStr);
                let safeWho = String(item.who || '').replace(/'/g, "\\'").replace(/"/g, "&quot;");
                let mNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

                div.innerHTML = `
                    <div class="history-details">
                        <strong style="color: ${colorMap[item.category]}">${item.category} ${item.who ? '('+item.who+')' : ''}</strong>
                        ${dObj.getDate() || '?'} ${mNames[dObj.getMonth()] || '?'} ${dObj.getFullYear() || '?'} | ${Math.round(item.duration)} mins
                    </div>
                    <div style="display:flex; gap: 5px;">
                        <button class="btn-icon-edit" onclick="openEdit(${item.row}, '${item.category}')" aria-label="Edit"><span class="material-symbols-outlined">edit</span></button>
                    </div>
                `;
                list.appendChild(div);
            });
            const historySummary = document.getElementById('historySummary');
            if(historySummary) historySummary.innerText = `${formatMins(totalMins)} (${monthData.length})`;
        } catch (err) {
            const historyList = document.getElementById('historyList');
            if(historyList) historyList.innerHTML = `<div style="color:var(--danger-color); text-align:center; padding: 20px;">Error rendering history:<br>${err.message}</div>`;
            showWarningToast("History error: " + err.message);
        }
    }

    // --- MANAGE LISTS ---
    document.getElementById('showArchivedOrgs')?.addEventListener('change', renderManageLists);
    document.getElementById('showArchivedTeachers')?.addEventListener('change', renderManageLists);

    // The Manage Lists screen needs usedInHistory (which dropdown-options
    // doesn't compute, to keep the common app-load path cheap) so the edit
    // modal can label its action button correctly before the user opens it.
    async function loadManageLists() {
        try {
            const data = await API.settings.getListsWithUsage();
            appData.organisations = data.organisations;
            appData.teachers = data.teachers;
            renderManageLists();
        } catch (error) {
            showWarningToast('Error loading lists: ' + error.message);
        }
    }

    function renderManageLists() {
        renderSettingsList('orgList', appData.organisations, 'organisations', 'showArchivedOrgs');
        renderSettingsList('teacherList', appData.teachers, 'teachers', 'showArchivedTeachers');
    }

    function renderSettingsList(containerId, list, type, toggleId) {
        const container = document.getElementById(containerId);
        if (!container) return;
        const showArchived = document.getElementById(toggleId)?.checked;
        container.innerHTML = '';

        (list || []).forEach(item => {
            if (item.archived && !showArchived) return;
            const safe = String(item.name).replace(/'/g, "\\'").replace(/"/g, "&quot;");
            const label = item.archived
                ? `${item.name} <span class="text-muted" style="font-size:0.8rem;">(archived)</span>`
                : item.name;

            container.innerHTML += `<div class="history-item" style="${item.archived ? 'opacity:0.6;' : ''}">
                <span>${label}</span>
                <button class="btn-icon-edit" onclick="editListItem('${type}', '${safe}')" aria-label="Edit"><span class="material-symbols-outlined">edit</span></button>
            </div>`;
        });

        if (!container.innerHTML) container.innerHTML = '<div class="text-muted">None added yet.</div>';
    }

    window.addListItem = async function(type) {
        const input = type === 'teachers' ? document.getElementById('newTeacherInput') : document.getElementById('newOrgInput');
        if(!input) return;
        const name = input.value.trim();
        if(name) {
            showInfoToast('Adding...');
            try {
                if (type === 'teachers') {
                    await API.settings.addTeacher(name);
                } else {
                    await API.settings.addOrganisation(name);
                }
                input.value = '';
                await loadManageLists();
                showSuccessToast('Added successfully');
            } catch (error) {
                showWarningToast("Error adding item: " + error.message);
            }
        }
    }

    window.editListItem = function(type, name) {
        const list = (type === 'teachers' ? appData.teachers : appData.organisations) || [];
        const item = list.find(i => i.name === name);
        if (!item) return;

        document.getElementById('liType').value = type;
        document.getElementById('liOriginalName').value = name;
        document.getElementById('liName').value = name;
        document.getElementById('listItemModalTitle').innerText = `Edit ${type === 'teachers' ? 'teacher' : 'organisation'}`;

        const actionBtn = document.getElementById('liActionBtn');
        if (item.archived) {
            actionBtn.className = 'btn-nav no-margin';
            actionBtn.style.cssText = 'margin-top:10px;';
            actionBtn.innerHTML = 'Restore';
            actionBtn.setAttribute('aria-label', 'Restore');
        } else {
            actionBtn.className = 'btn-icon-delete';
            actionBtn.style.cssText = 'margin:10px auto 0 auto;';
            actionBtn.innerHTML = '<span class="material-symbols-outlined">delete</span>';
            actionBtn.setAttribute('aria-label', item.usedInHistory ? 'Archive' : 'Remove');
        }
        actionBtn.onclick = () => handleListItemAction(type, name, item);

        document.getElementById('listItemModal').style.display = 'flex';
    }

    document.getElementById('liSaveBtn')?.addEventListener('click', async () => {
        const type = document.getElementById('liType').value;
        const oldName = document.getElementById('liOriginalName').value;
        const newName = document.getElementById('liName')?.value.trim();
        if (!newName || newName === oldName) {
            document.getElementById('listItemModal').style.display = 'none';
            return;
        }

        showInfoToast('Updating...');
        try {
            if (type === 'teachers') {
                await API.settings.renameTeacher(oldName, newName);
            } else {
                await API.settings.renameOrganisation(oldName, newName);
            }
            document.getElementById('listItemModal').style.display = 'none';
            await loadManageLists();
            fetchDataAndRender();
            showSuccessToast('Name updated');
        } catch (error) {
            showWarningToast("Error updating name: " + error.message);
        }
    });

    async function handleListItemAction(type, name, item) {
        const runAction = async () => {
            showInfoToast('Working...');
            try {
                if (item.archived) {
                    await (type === 'teachers' ? API.settings.unarchiveTeacher(name) : API.settings.unarchiveOrganisation(name));
                    showSuccessToast(`${name} restored`);
                } else {
                    const result = type === 'teachers'
                        ? await API.settings.deleteTeacher(name)
                        : await API.settings.deleteOrganisation(name);
                    showSuccessToast(result.archived ? `${name} is still used in history, so it was archived instead of removed` : 'Removed successfully');
                }
                document.getElementById('listItemModal').style.display = 'none';
                await loadManageLists();
            } catch (error) {
                showWarningToast("Error: " + error.message);
            }
        };

        if (item.archived) {
            runAction();
            return;
        }

        const msg = item.usedInHistory
            ? `${name} is still connected to your past sessions, so it will be archived rather than deleted.`
            : `${name} isn't used anywhere, so it will be permanently deleted.`;
        showConfirmModal(item.usedInHistory ? 'Archive item' : 'Remove item', msg, runAction, !item.usedInHistory);
    }

    document.getElementById('prevMonthBtn')?.addEventListener('click', () => {
        currentHistDate.setMonth(currentHistDate.getMonth() - 1);
        renderHistoryList(rawData.filter(d=>activeFilters[d.category]));
    });
    document.getElementById('nextMonthBtn')?.addEventListener('click', () => {
        currentHistDate.setMonth(currentHistDate.getMonth() + 1);
        renderHistoryList(rawData.filter(d=>activeFilters[d.category]));
    });

    window.deleteHistory = function(row, cat, dur, who, dateStr) {
        let mNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
        let detailStr = `${cat} for ${dur} mins`;
        if (who) detailStr += ` with ${who}`;
        if (dateStr) {
            const dObj = parseDateSafely(dateStr);
            detailStr += ` on ${dObj.getDate()} ${mNames[dObj.getMonth()]} ${dObj.getFullYear()}`;
        }
        showConfirmModal('Delete entry', `Are you sure you want to delete this entry?\n\n${detailStr}`, async () => {
            showInfoToast('Deleting...');
            try {
                await API.sessions.delete(row, cat);
                showSuccessToast('Entry deleted');
                fetchDataAndRender();
            } catch (error) {
                showWarningToast("Delete error: " + error.message);
            }
        });
    }

    window.openEdit = async function(row, cat) {
        const session = rawData.find(s => s.row === row);
        if (!session) return showWarningToast('Session not found');

        document.getElementById('editCat').value = cat;
        document.getElementById('editRow').value = row;
        document.getElementById('editDate').value = session.dateStr;
        document.getElementById('editDuration').value = session.duration;

        const group = document.getElementById('editWhoGroup');
        const sel = document.getElementById('editWho');
        if(!sel) return;
        sel.innerHTML = '';

        if (cat === 'Practise') {
            group.classList.add('hidden-group');
        } else {
            group.classList.remove('hidden-group');
            sel.innerHTML = buildWhoOptionsHtml(cat === 'Lesson' ? appData.teachers : appData.organisations, session.who);
            if(session.who) sel.value = session.who;
        }

        const deleteBtn = document.getElementById('deleteEditBtn');
        if (deleteBtn) {
            deleteBtn.onclick = () => {
                document.getElementById('editModal').style.display = 'none';
                deleteHistory(row, cat, session.duration, session.who || '', session.dateStr);
            };
        }

        document.getElementById('editModal').style.display = 'flex';
    }

    document.getElementById('saveEditBtn')?.addEventListener('click', async () => {
        const row = document.getElementById('editRow').value;
        const cat = document.getElementById('editCat').value;
        const dur = document.getElementById('editDuration').value;
        const dStr = document.getElementById('editDate').value;
        const who = !document.getElementById('editWhoGroup')?.classList.contains('hidden-group') ? document.getElementById('editWho')?.value : '';

        if(!dur) return showWarningToast('Duration required!');

        const btn = document.getElementById('saveEditBtn');
        btn.innerText = 'Updating...';
        btn.disabled = true;

        try {
            await API.sessions.update(row, {
                category: cat,
                duration: Number(dur),
                who: who || null,
                date: dStr
            });
            document.getElementById('editModal').style.display = 'none';
            btn.innerText = 'Update record';
            btn.disabled = false;
            showSuccessToast('Record updated');
            fetchDataAndRender();
        } catch (error) {
            showWarningToast("Update error: " + error.message);
            btn.innerText = 'Update record';
            btn.disabled = false;
        }
    });

    // --- TOASTS ---
    let tInt, tInfoTimeout;
    function showSuccessToast(msg, cat, sessionId) {
        closeToast('toastWarning');
        closeToast('toastInfo');
        const t = document.getElementById('toastSuccess');
        if(!t) return;
        const msgEl = document.getElementById('toastMsg');
        if(msgEl) msgEl.innerText = msg;
        clearInterval(tInt);
        clearTimeout(tInfoTimeout);
        if (cat && sessionId) {
            let tl = 3;
            const countdown = document.getElementById('toastCountdown');
            if(countdown) countdown.innerText = tl;
            tInt = setInterval(() => { tl--; if(countdown) countdown.innerText = tl; if(tl <= 0) { clearInterval(tInt); closeToast('toastSuccess'); } }, 1000);
            const undoBtn = document.getElementById('toastUndoBtn');
            if(undoBtn) undoBtn.onclick = async () => {
                closeToast('toastSuccess');
                showInfoToast("Undoing...");
                try {
                    await API.sessions.delete(sessionId);
                    closeToast('toastInfo');
                    showSuccessToast("Undo successful");
                    fetchDataAndRender();
                } catch (error) {
                    showWarningToast("Error undoing: " + error.message);
                }
            };
        } else {
            tInfoTimeout = setTimeout(() => closeToast('toastSuccess'), 4000);
        }
        t.style.display = 'flex';
    }

    function showWarningToast(msg) {
        closeToast('toastSuccess');
        closeToast('toastInfo');
        const t = document.getElementById('toastWarning');
        if(!t) return;
        const msgEl = document.getElementById('toastWarningMsg');
        if(msgEl) msgEl.innerText = msg;
        clearTimeout(tInfoTimeout);
        tInfoTimeout = setTimeout(() => closeToast('toastWarning'), 5000);
        t.style.display = 'flex';
    }

    function showInfoToast(msg) {
        const t = document.getElementById('toastInfo');
        if(!t) return;
        const msgEl = document.getElementById('toastInfoMsg');
        if(msgEl) msgEl.innerText = msg;
        t.style.display = 'flex';
    }

    function closeToast(id) {
        const t = document.getElementById(id);
        if(t) t.style.display = 'none';
    }
    window.closeToast = closeToast;

    // ========================================
    // METRONOME
    // ========================================
    const METRO_MIN_BPM = 15;
    const METRO_MAX_BPM = 500;
    const METRO_SLIDER_TIERS = [200, 350, 500];
    const METRO_SPEED_STEP = 10; // percentage points, applied against the ORIGINAL target bpm each step (not compounding)
    // Plain numbers rather than musical terms (half/thirds/quarters) - "N per beat" reads the same
    // whether it's a preset or a custom-entered value, no vocabulary to keep track of.
    function metroSubdivideLabel(factor) { return factor <= 1 ? 'Off' : `${factor} per beat`; }

    // Standalone audio engine - deliberately has no DOM/UI knowledge so it can be reused elsewhere later.
    // Concept: three nested levels, each an independent multiplier -
    //   conductor beats (the pulse a conductor's baton keeps, e.g. 2 for a bar of 6/8 conducted in 2)
    //     -> notes per conductor beat (e.g. 3 for that same 6/8 bar - derived from "Set from music", 1 otherwise)
    //       -> practice subdivision (the manual Off/Half/Thirds control, purely a practice aid on top)
    // Regardless of how many levels are active there are still only 3 sounds: the first click of the bar
    // is the accented "tick", the first click of every other conductor beat is "tock", and every other
    // click (whether it's a compound-meter note or a practice subdivision) is a quieter "bom". E.g. 6/8
    // conducted in 2 (notesPerBeat 3, subdivision off): tick, bom, bom, tock, bom, bom.
    function createMetronomePlayer() {
        let audioCtx = null;
        let masterGain = null;
        let playing = false;
        let schedulerId = null;
        let nextClickTime = 0;
        let clickIndex = 0;
        let lastTotalPerBar = null; // detects a live grid-shape change (beats/subdivide edited mid-play) so clickIndex can be re-aligned to bar-start instead of drifting into the new grid mid-bar (ML-61)

        let conductorBpm = 120;
        let conductorBeatsPerBar = 4;
        let notesPerBeat = 1;
        let subdivisionFactor = 1;
        let speedPercent = 100;
        let volume = 0.8;
        let muted = false;
        let visualLatencyMs = 0; // extra delay applied to the beat callback only, to match Bluetooth output lag

        const LOOKAHEAD_MS = 25;
        const SCHEDULE_AHEAD_S = 0.12;
        const beatListeners = [];

        // Returns a promise that resolves once the context is actually running. On a cold start,
        // resume() is asynchronous - scheduling clicks against audioCtx.currentTime before it
        // resolves reads a currentTime that hasn't started advancing at real speed yet, which is
        // what caused the one-time lag around the second beat on the very first play.
        function ensureAudio() {
            if (!audioCtx) {
                const Ctx = window.AudioContext || window.webkitAudioContext;
                audioCtx = new Ctx();
                masterGain = audioCtx.createGain();
                masterGain.gain.value = muted ? 0 : volume;
                // A limiter, not a "sound" - it lets playClick push peaks well above 0dBFS for extra
                // perceived loudness (short percussive blips read as quiet at digital full-scale, per
                // normal loudness perception of very short transients) without the harsh hard-clipping
                // digital audio would otherwise apply at the destination.
                const limiter = audioCtx.createDynamicsCompressor();
                limiter.threshold.value = -18;
                limiter.knee.value = 6;
                limiter.ratio.value = 12;
                limiter.attack.value = 0.001;
                limiter.release.value = 0.1;
                masterGain.connect(limiter);
                limiter.connect(audioCtx.destination);
            }
            return audioCtx.state === 'suspended' ? audioCtx.resume() : Promise.resolve();
        }

        // A whole octave down while lowPitch is set (Metronome Blocks' lead-in - see setLowPitch)
        // so it's audibly not "real" beat 1 yet, distinguishable even before you've learned to
        // listen for the count.
        let lowPitch = false;

        // Only two sounds now (ML-62): a higher-pitched, more emphatic "tick" for the very first note
        // of the bar, and the lower "bom" for every other click, main beat or subdivision alike - a
        // third, in-between "tock" sound for non-first main beats made three near-identical clicks too
        // hard to tell apart. Zero-bar mode never uses "tick" at all (see scheduler below) since there
        // is no bar-start to accent, just an even, unaccented pulse.
        function playClick(kind, time) {
            const freq = (kind === 'tick' ? 1760 : 650) * (lowPitch ? 0.5 : 1);
            const peak = kind === 'tick' ? 2.0 : 1.1; // pushed past 0dBFS - the limiter above tames it
            const dur = kind === 'tick' ? 0.035 : 0.045;
            const osc = audioCtx.createOscillator();
            const g = audioCtx.createGain();
            osc.type = 'square'; // brighter/more harmonic-rich than triangle - reads as louder at the same peak, and cuts through a lossy Bluetooth link better
            osc.frequency.setValueAtTime(freq, time);
            g.gain.setValueAtTime(0.0001, time);
            g.gain.exponentialRampToValueAtTime(peak, time + 0.002);
            g.gain.exponentialRampToValueAtTime(0.0001, time + dur);
            osc.connect(g);
            g.connect(masterGain);
            osc.start(time);
            osc.stop(time + dur + 0.01);
        }

        function effectiveConductorBpm() {
            return conductorBpm * (speedPercent / 100);
        }

        function clicksPerConductorBeat() {
            return Math.max(1, notesPerBeat) * Math.max(1, subdivisionFactor);
        }

        function secondsPerBaseClick() {
            const baseClickBpm = effectiveConductorBpm() * clicksPerConductorBeat();
            return 60 / baseClickBpm;
        }

        function scheduler() {
            const zeroBar = conductorBeatsPerBar <= 0;
            const groupSize = clicksPerConductorBeat();
            const totalPerBar = zeroBar ? 1 : conductorBeatsPerBar * groupSize;
            const secondsPerConductorBeat = secondsPerBaseClick() * groupSize;

            // A live beats/conduct-in/subdivide edit changes the shape of the bar (totalPerBar) out
            // from under an in-progress clickIndex count - without this, the accent could land
            // anywhere in the new grid instead of at its start (ML-61).
            if (lastTotalPerBar !== null && totalPerBar !== lastTotalPerBar) clickIndex = 0;
            lastTotalPerBar = totalPerBar;

            while (nextClickTime < audioCtx.currentTime + SCHEDULE_AHEAD_S) {
                const idxInBar = clickIndex % totalPerBar;
                let kind, conductorBeatIndex, noteIndex, isConductorBeat, isNoteBoundary;
                if (zeroBar) {
                    // No bar-start to accent when there's no bar at all - every click is the same,
                    // unaccented pulse (ML-62).
                    kind = 'bom';
                    conductorBeatIndex = 0;
                    noteIndex = 0;
                    isConductorBeat = true;
                    isNoteBoundary = true;
                } else {
                    isConductorBeat = (idxInBar % groupSize) === 0;
                    isNoteBoundary = (idxInBar % Math.max(1, subdivisionFactor)) === 0;
                    kind = idxInBar === 0 ? 'tick' : 'bom';
                    noteIndex = Math.floor(idxInBar / Math.max(1, subdivisionFactor));
                    conductorBeatIndex = Math.floor(idxInBar / groupSize);
                }
                playClick(kind, nextClickTime);

                const fireTime = nextClickTime;
                // The click itself always fires bang on schedule - visualLatencyMs only holds back the
                // UI notification, so the baton/dots land in step with a click that's arriving late
                // through Bluetooth (a fixed pipeline delay the page has no way to detect or avoid).
                const delayMs = Math.max(0, (fireTime - audioCtx.currentTime) * 1000 + visualLatencyMs);
                setTimeout(() => {
                    // stop() only halts future scheduling - up to SCHEDULE_AHEAD_S worth of clicks may
                    // already be queued here, so without this guard a straggler can fire its UI
                    // notification just after stop() and leave the baton stranded mid-bar instead of
                    // at the reset position.
                    if (!playing) return;
                    beatListeners.forEach(cb => cb({
                        kind, clickIndexInBar: idxInBar, clicksPerBar: totalPerBar,
                        isConductorBeat, isNoteBoundary,
                        conductorBeatIndex, conductorBeatsPerBar: zeroBar ? 1 : conductorBeatsPerBar,
                        noteIndex, notesPerBar: zeroBar ? 1 : conductorBeatsPerBar * Math.max(1, notesPerBeat),
                        secondsPerConductorBeat
                    }));
                }, delayMs);

                nextClickTime += secondsPerBaseClick();
                clickIndex++;
            }
            schedulerId = setTimeout(scheduler, LOOKAHEAD_MS);
        }

        return {
            // Creates and resumes the AudioContext ahead of time, without starting playback. The very
            // first AudioContext resume on a page has a real (sometimes 500ms+) hardware/driver
            // cold-start latency that awaiting it in play() can't remove, only schedule around - so
            // call this as soon as the metronome view opens (itself a valid user gesture) to absorb
            // that one-time cost while the user is still looking at the controls, well before they
            // actually press Play.
            prewarm() { ensureAudio(); },
            // Resumes from wherever clickIndex currently is (0 the first time, or wherever pause() left
            // it) - use stop() first if you want a fresh bar from the beginning. leadingSilenceSeconds
            // (ML-92, Metronome Blocks' lead-in "quiet space") delays the very first scheduled click by
            // that many extra seconds - clickIndex/lastTotalPerBar are untouched, so whichever beat the
            // caller already aligned to (see resetToBarStart/setBeatIndex) is still what eventually
            // sounds, just after a silent gap instead of immediately.
            play(leadingSilenceSeconds = 0) {
                if (playing) return;
                playing = true;
                ensureAudio().then(() => {
                    if (!playing) return; // paused/stopped again before the context finished resuming
                    nextClickTime = audioCtx.currentTime + 0.05 + leadingSilenceSeconds;
                    scheduler();
                });
            },
            // Halts playback but leaves clickIndex where it is, so a subsequent play() continues
            // from this exact point in the bar rather than restarting it.
            pause() {
                playing = false;
                clearTimeout(schedulerId);
            },
            // Halts playback AND resets position back to the start of the bar.
            stop() {
                playing = false;
                clearTimeout(schedulerId);
                clickIndex = 0;
            },
            // Re-aligns to beat 1 without stopping - the scheduler already does this on its own
            // whenever the bar "shape" (beatsPerBar*notesPerBeat*subdivisionFactor) changes, but a
            // caller advancing through a sequence of externally-defined blocks (ML-35's multi-bar
            // metronome) needs this to fire on every block boundary even when two consecutive blocks
            // happen to share the same shape - e.g. a partial-bar lead-in followed by a full bar of
            // the same beat count, where the grid position genuinely needs resetting despite no shape
            // change being detected.
            // Also clears lastTotalPerBar so the scheduler's own shape-change detection doesn't fire
            // on its next tick and stomp this position back to 0 - without this, resuming into a bar
            // shape that happens to differ from whatever was last scheduled (e.g. Reset jumping back
            // to a lead-in after the loop's own bars have been playing) silently overrode setBeatIndex
            // below, so a partial lead-in always audibly started from its own beat 1 regardless of
            // which beats were actually meant to sound.
            resetToBarStart() { clickIndex = 0; lastTotalPerBar = null; },
            // Same idea as resetToBarStart, but to an arbitrary beat within the bar - used to start a
            // partial lead-in on its actual first beat (the tail end of the bar, not index 0).
            setBeatIndex(n) { clickIndex = n; lastTotalPerBar = null; },
            // Pushes the next scheduled click back by this many seconds of silence, without touching
            // clickIndex - the click that eventually fires still lands on whatever beat resetToBarStart/
            // setBeatIndex already aligned to. The mid-playback counterpart to play()'s own
            // leadingSilenceSeconds argument (ML-92): used when a loop-back lands back on the lead-in
            // while already playing, where there's no play() call to pass the delay through.
            delayNextClick(seconds) {
                if (!seconds || !audioCtx) return;
                nextClickTime = Math.max(nextClickTime, audioCtx.currentTime) + seconds;
            },
            isPlaying() { return playing; },
            setConductorBpm(v) { conductorBpm = v; },
            setConductorBeatsPerBar(n) { conductorBeatsPerBar = n; },
            setNotesPerBeat(n) { notesPerBeat = n; },
            setSubdivisionFactor(n) { subdivisionFactor = n; },
            setLowPitch(v) { lowPitch = v; },
            setSpeedPercent(p) { speedPercent = p; },
            setVolume(v) { volume = v; if (masterGain && !muted) masterGain.gain.value = v; },
            setMuted(m) { muted = m; if (masterGain) masterGain.gain.value = m ? 0 : volume; },
            setVisualLatencyMs(ms) { visualLatencyMs = ms; },
            getEffectiveConductorBpm: effectiveConductorBpm,
            onBeat(cb) { beatListeners.push(cb); }
        };
    }

    const metroPlayer = createMetronomePlayer();

    // Three independent timing levels, per the actual mental model:
    //   - notesBpm: tempo of the notes - the "beats per bar" row's click rate. The primary, slider-driven tempo.
    //   - conductorBpm: tempo of the conductor's own beat - always kept in sync as notesBpm/notesPerBeat, but
    //     also directly editable (editing it back-solves notesBpm instead, holding the note counts fixed).
    //   - subdivisionFactor: a further Off/Half/Thirds split of each note, purely a practice aid.
    // beatsPerBar (1-9,12) is how many notes are in the bar. conductIn (1..beatsPerBar, derived as
    // beatsPerBar/notesPerBeat) is how many of those notes the conductor actually beats/accents.
    const metroState = {
        notesBpm: 120,
        conductorBpm: 120, // internal only now - drives the engine/baton timing, no longer surfaced as its own field
        beatsPerBar: 4,
        notesPerBeat: 1, // = beatsPerBar / conductIn (rounded to a whole number)
        subdivisionFactor: 1,
        conductInLinked: true, // "Conductor beats" tracks "Beats per bar" live until an explicit conductor-beats choice breaks the link
        speedLevel: 0, // -9..+5 (10%-150%), each step = METRO_SPEED_STEP% of the stored notesBpm (not compounding)
        sliderMax: METRO_SLIDER_TIERS[0],
        volume: 80,
        muted: false,
        latencyMs: 0 // extra delay applied to the visual beat/baton only, to compensate for Bluetooth output lag
    };
    const METRO_LATENCY_KEY = 'metroLatencyMs';
    const METRO_LATENCY_STEP = 10;
    const METRO_LATENCY_MAX = 500;

    const METRO_SPEED_MIN_LEVEL = -9; // 10%
    const METRO_SPEED_MAX_LEVEL = 5;  // 150%

    function metroConductIn() { return metroState.beatsPerBar / metroState.notesPerBeat; }

    // Whole-number divisors of n, ascending - the only conductor-beats counts that evenly group a bar
    // of n notes. Offering (or landing on) a non-divisor is what let a picked value silently round
    // back to n itself, which looked exactly like the beats-per-bar link had never actually broken.
    function metroDivisorsOf(n) {
        const divs = [];
        for (let i = 1; i <= n; i++) if (n % i === 0) divs.push(i);
        return divs;
    }

    // Nearest valid divisor of n to a target value, preferring the larger one on an exact tie.
    function metroNearestDivisor(n, target) {
        const divisors = metroDivisorsOf(n);
        return divisors.reduce((best, d) => {
            const dDist = Math.abs(d - target), bestDist = Math.abs(best - target);
            return (dDist < bestDist || (dDist === bestDist && d > best)) ? d : best;
        }, divisors[0]);
    }
    function metroSpeedPercent() { return 100 + metroState.speedLevel * METRO_SPEED_STEP; }
    function metroEffectiveBpm() { return metroState.notesBpm * (metroSpeedPercent() / 100); }

    // Disable slower/faster past the point where the resulting bpm would leave the engine's hard 15-500 range.
    function metroSpeedLevelBounds() {
        let minLevel = METRO_SPEED_MIN_LEVEL, maxLevel = METRO_SPEED_MAX_LEVEL;
        while (minLevel < maxLevel && metroState.notesBpm * ((100 + minLevel * METRO_SPEED_STEP) / 100) < METRO_MIN_BPM) minLevel++;
        while (maxLevel > minLevel && metroState.notesBpm * ((100 + maxLevel * METRO_SPEED_STEP) / 100) > METRO_MAX_BPM) maxLevel--;
        return { minLevel, maxLevel };
    }

    function pushMetroSettingsToPlayer() {
        metroPlayer.setConductorBpm(metroState.conductorBpm);
        metroPlayer.setConductorBeatsPerBar(Math.round(metroConductIn()));
        metroPlayer.setNotesPerBeat(metroState.notesPerBeat);
        metroPlayer.setSubdivisionFactor(metroState.subdivisionFactor);
        metroPlayer.setSpeedPercent(metroSpeedPercent());
    }

    // Smallest tier that comfortably fits a value - used for direct/programmatic bpm changes.
    function metroBestFitTier(value) {
        for (const t of METRO_SLIDER_TIERS) if (value <= t) return t;
        return METRO_SLIDER_TIERS[METRO_SLIDER_TIERS.length - 1];
    }

    // One-tier-at-a-time expand/contract - used while actively dragging so the scale only
    // jumps when the thumb actually reaches an edge, in either direction.
    function metroStepTier(value) {
        const idx = METRO_SLIDER_TIERS.indexOf(metroState.sliderMax);
        if (idx < METRO_SLIDER_TIERS.length - 1 && value >= METRO_SLIDER_TIERS[idx]) {
            metroState.sliderMax = METRO_SLIDER_TIERS[idx + 1];
        } else if (idx > 0 && value < METRO_SLIDER_TIERS[idx - 1]) {
            metroState.sliderMax = METRO_SLIDER_TIERS[idx - 1];
        }
    }

    // Keeps conductorBpm in sync with notesBpm/notesPerBeat whenever either changes.
    function metroSyncConductorBpm() {
        metroState.conductorBpm = Math.round(Math.min(METRO_MAX_BPM, Math.max(1, metroState.notesBpm / metroState.notesPerBeat)));
    }

    function setMetroNotesBpm(bpm, opts = {}) {
        bpm = Math.round(Math.min(METRO_MAX_BPM, Math.max(METRO_MIN_BPM, bpm)));
        metroState.notesBpm = bpm;
        metroSyncConductorBpm();
        if (opts.resetSpeed) metroState.speedLevel = 0;
        if (opts.dragging) metroStepTier(bpm); else metroState.sliderMax = metroBestFitTier(bpm);
        pushMetroSettingsToPlayer();
        renderMetroSlider();
        renderMetroSpeedReadout();
    }

    // Beats per bar = notes per bar. notesBpm (the note grid's own tempo) stays fixed. When linked,
    // "conduct in" is simply kept equal to the new beats-per-bar (every note is a conductor beat);
    // otherwise the previous conduct-in count is kept if it still fits, or clamped down if not.
    function setMetroBeatsPerBar(n) {
        n = Math.min(METRO_CUSTOM_MAX, Math.max(0, Math.round(n)));
        // 0 (ML-63) is a hard-coded single unaccented beat, not an adjustable grid - conduct-in/
        // subdivide have nothing to group, so notesPerBeat is just forced back to 1 rather than run
        // through metroNearestDivisor, which has no divisors to offer for a bar of length 0.
        if (n === 0 || metroState.conductInLinked) {
            metroState.beatsPerBar = n;
            metroState.notesPerBeat = 1;
        } else {
            // Keep the previous conduct-in if it's still a valid (exact) grouping of the new bar
            // length; otherwise snap to the nearest count that actually divides it evenly, rather than
            // rounding notesPerBeat directly, which could land on an impossible in-between grouping.
            const prevConductIn = Math.min(metroConductIn(), n);
            const nearestValid = metroNearestDivisor(n, prevConductIn);
            metroState.beatsPerBar = n;
            metroState.notesPerBeat = Math.max(1, Math.round(n / nearestValid));
        }
        metroSyncConductorBpm();
        document.getElementById('metroBeatsPerBarLbl').innerText = n;
        pushMetroSettingsToPlayer();
        renderMetroTiers();
        renderMetroConductInLabel();
    }

    function setMetroSubdivision(factor) {
        factor = Math.min(METRO_CUSTOM_MAX, Math.max(1, Math.round(factor)));
        metroState.subdivisionFactor = factor;
        document.getElementById('metroSubdivideLbl').innerText = metroSubdivideLabel(factor);
        pushMetroSettingsToPlayer();
        renderMetroTiers();
    }

    // Sets every timing field at once from scratch (no preservation) - used by "Set from music" and
    // the initial default state. Always breaks the beats-per-bar/conductor-beats link, since "Set
    // from music" deliberately picks a specific (often divergent) conduct-in for compound metres.
    function setMetroFreshGrid({ notesBpm, beatsPerBar, notesPerBeat, subdivisionFactor }) {
        metroState.notesBpm = Math.round(Math.min(METRO_MAX_BPM, Math.max(METRO_MIN_BPM, notesBpm)));
        metroState.beatsPerBar = beatsPerBar;
        metroState.notesPerBeat = notesPerBeat;
        metroState.subdivisionFactor = subdivisionFactor;
        metroState.conductInLinked = false;
        metroState.speedLevel = 0;
        metroSyncConductorBpm();
        metroState.sliderMax = metroBestFitTier(metroState.notesBpm);
        document.getElementById('metroBeatsPerBarLbl').innerText = beatsPerBar;
        document.getElementById('metroSubdivideLbl').innerText = metroSubdivideLabel(subdivisionFactor);
        pushMetroSettingsToPlayer();
        renderMetroSlider();
        renderMetroSpeedReadout();
        renderMetroTiers();
        renderMetroConductInLabel();
    }

    // No more manual "Conductor beats" button to keep a label/link-icon in sync for (removed per
    // feedback - the visual "conduct" grouping it used to control disappeared in ML-66's unified dot
    // row anyway, leaving nothing for a manual picker to usefully show). The underlying conduct-in
    // grouping itself is untouched - "Set from music" still sets it for compound time signatures, it's
    // just no longer manually editable - so this now only keeps the zero-bar disabled state in sync.
    function renderMetroConductInLabel() {
        updateMetroZeroBarUI();
    }

    // 0 beats per bar (ML-63) is a hard-coded single beat, not an adjustable grid - subdivide has no
    // bar to group, so its picker is disabled while it's selected.
    function updateMetroZeroBarUI() {
        const zeroBar = metroState.beatsPerBar <= 0;
        const subdivideBtn = document.getElementById('metroSubdivideBtn');
        if (subdivideBtn) subdivideBtn.disabled = zeroBar;
    }

    function renderMetroSlider() {
        const track = document.getElementById('metroSliderTrack');
        if (!track) return;
        const fill = document.getElementById('metroSliderFill');
        const thumb = document.getElementById('metroSliderThumb');
        const pct = ((metroState.notesBpm - METRO_MIN_BPM) / (metroState.sliderMax - METRO_MIN_BPM)) * 100;
        fill.style.width = `${pct}%`;
        thumb.style.left = `${pct}%`;
        thumb.setAttribute('aria-valuenow', metroState.notesBpm);
        thumb.setAttribute('aria-valuemax', metroState.sliderMax);
        document.getElementById('metroSliderMaxLbl').innerText = metroState.sliderMax;
        document.getElementById('metroBpmValue').innerText = metroState.notesBpm;
        renderMetroMiniBpmSlider();
        syncMetroMiniLabels();
    }

    // Mirrors renderMetroSlider above, but for the compact BPM popup opened from the mini bar (ML-64) -
    // a separate slider element, same math, so it can be open (or not) independently of the full view.
    function renderMetroMiniBpmSlider() {
        const track = document.getElementById('metroMiniBpmSliderTrack');
        if (!track) return;
        const fill = document.getElementById('metroMiniBpmSliderFill');
        const thumb = document.getElementById('metroMiniBpmSliderThumb');
        const pct = ((metroState.notesBpm - METRO_MIN_BPM) / (metroState.sliderMax - METRO_MIN_BPM)) * 100;
        fill.style.width = `${pct}%`;
        thumb.style.left = `${pct}%`;
        thumb.setAttribute('aria-valuenow', metroState.notesBpm);
        thumb.setAttribute('aria-valuemax', metroState.sliderMax);
        document.getElementById('metroMiniBpmSliderMaxLbl').innerText = metroState.sliderMax;
        document.getElementById('metroMiniBpmModalValue').innerText = metroState.notesBpm;
    }

    function renderMetroSpeedReadout() {
        document.getElementById('metroSpeedPct').innerText = `${metroSpeedPercent()}%`;
        document.getElementById('metroSpeedBpm').innerText = `${Math.round(metroEffectiveBpm())} bpm`;
        const { minLevel, maxLevel } = metroSpeedLevelBounds();
        document.getElementById('metroSlowerBtn').disabled = metroState.speedLevel <= minLevel;
        document.getElementById('metroFasterBtn').disabled = metroState.speedLevel >= maxLevel;
        document.getElementById('metroMiniSpeedModalPct').innerText = `${metroSpeedPercent()}%`;
        document.getElementById('metroMiniSpeedModalBpm').innerText = `${Math.round(metroEffectiveBpm())} bpm`;
        document.getElementById('metroMiniSpeedMinus').disabled = metroState.speedLevel <= minLevel;
        document.getElementById('metroMiniSpeedPlus').disabled = metroState.speedLevel >= maxLevel;
        syncMetroMiniLabels();
    }

    // Keeps the mini bar's four quick-control labels (ML-64) in step with the full view's own -
    // called from every place that already re-renders the full view's equivalent labels.
    function syncMetroMiniLabels() {
        const beatsLbl = document.getElementById('metroMiniBeatsLbl');
        if (beatsLbl) beatsLbl.innerText = metroState.beatsPerBar;
        const subLbl = document.getElementById('metroMiniSubdivideLbl');
        if (subLbl) subLbl.innerText = metroSubdivideLabel(metroState.subdivisionFactor);
        const bpmLbl = document.getElementById('metroMiniBpmLbl');
        if (bpmLbl) bpmLbl.innerText = metroState.notesBpm;
        const speedLbl = document.getElementById('metroMiniSpeedLbl');
        if (speedLbl) speedLbl.innerText = metroSpeedPercent();
    }

    // The largest dot (the note tier, 15px, now the same size whether accented or not - see
    // .metro-dot-note.accent) plus breathing room - the per-click width used once there are too many
    // clicks to comfortably fit the screen at all, and the display has to switch from "stretch to
    // fit" to "fixed size, scroll to follow" instead. Needs clearance beyond the dot's own diameter or
    // adjacent dots visibly overlap even in this fixed-pitch mode.
    const METRO_SLOT_PX = 20;

    // Fixed pixel clearance reserved at each end of the click grid, so the largest dot (the accent/
    // conduct note, ~16px radius including its border and lit-state scale) never gets clipped by
    // metro-display-viewport's overflow:hidden at click index 0 or the last click. A pure percentage
    // inset (half a "unit") isn't enough once totalBaseClicks is large, since a unit shrinks well
    // below the dot's radius - see metroLeftStyle.
    const METRO_EDGE_PAD_PX = 16;

    // Sizes a scrollable content track: if beatsPerBar x subdivisionFactor clicks fit within the
    // viewport at METRO_SLOT_PX each (plus the edge padding reserved on each side), it stays 100%
    // (stretches to fit, no scroll needed). Otherwise it's pinned to its true full-size pixel width,
    // wider than the viewport, and flashMetroBeat's scroll-follow logic takes over to keep the current
    // beat in view as it plays. Takes a viewport/content id pair so the same sizing runs for both the
    // full view's row and the mini bar's own, narrower one (ML-64 feedback: the mini bar needs to pan
    // too, not just cram every beat in) - each measured and sized independently.
    function metroApplyDisplayWidth(viewportId, contentId, totalBaseClicks) {
        const viewport = document.getElementById(viewportId);
        const content = document.getElementById(contentId);
        if (!viewport || !content) return;
        const viewportWidthPx = viewport.getBoundingClientRect().width;
        // A viewport that's currently display:none (this row's view isn't on screen yet, or it's the
        // mini bar sitting hidden behind the full view) measures 0 here - reacting to that would lock
        // in a spuriously narrow fixed px width, and nothing re-measures it later just because it
        // becomes visible, so every dot ends up bunched at the left edge until some unrelated action
        // happens to re-render this same row while it's actually on screen (ML-88). Leaving the width
        // untouched while hidden is safe: the stylesheet's own default (100%) already stretches to fit
        // correctly the moment it's shown, without needing a fixed px value at all.
        if (viewportWidthPx === 0) return;
        const neededWidthPx = totalBaseClicks * METRO_SLOT_PX + METRO_EDGE_PAD_PX * 2;
        content.style.width = neededWidthPx > viewportWidthPx ? `${neededWidthPx}px` : '100%';
    }

    // Converts a 0-100 logical position (from metroTierGeometry's leftPct) into a CSS left value that
    // stays METRO_EDGE_PAD_PX clear of both ends of the row, regardless of the row's actual width -
    // percentage offsets alone can't do this (position:absolute ignores the parent's own padding, and
    // a percentage-only inset shrinks below the dot's radius once there are many clicks), so this
    // mixes a fixed px offset with the remaining percentage span via calc().
    function metroLeftStyle(pct) {
        return `calc(${METRO_EDGE_PAD_PX}px + (100% - ${METRO_EDGE_PAD_PX * 2}px) * ${pct / 100})`;
    }

    // The beats-per-bar row and the subdivide row (and the baton) all position their dots against the
    // SAME underlying base-click grid - beatsPerBar x subdivisionFactor slots, each of equal width -
    // rather than each row spacing its own dots independently. That's what guarantees a conductor
    // beat's dot always sits directly above the first subdivision dot of its group, instead of merely
    // "some evenly spread dot" that happens to have the same count.
    function metroTierGeometry() {
        const beatsPerBar = metroState.beatsPerBar > 0 ? metroState.beatsPerBar : 1;
        const notesPerBeat = metroState.beatsPerBar > 0 ? metroState.notesPerBeat : 1;
        const subFactor = metroState.beatsPerBar > 0 ? metroState.subdivisionFactor : 1;
        const totalBaseClicks = beatsPerBar * subFactor;
        const unit = 100 / totalBaseClicks;
        return {
            beatsPerBar, notesPerBeat, subFactor, totalBaseClicks,
            leftPct: (baseClickIndex) => baseClickIndex * unit + unit / 2
        };
    }

    // Every base click (beat or subdivision) gets one dot in a single row, positioned at its real
    // timeline slot, rather than beats and subdivisions living on two separate rows (ML-66). A
    // note-boundary click (every subFactor-th one) gets the larger "note" dot; everything in between
    // is a smaller "sub" dot. Only the very first note of the bar is visually accented - every other
    // dot, note or sub, looks (and, per ML-62, sounds) the same, so there's nothing left to distinguish.
    // Zero-bar mode (ML-63) never accents its one dot, matching its unaccented "sub" sound.
    // Fills a dot row (the full view's, or the mini bar's) with one dot per base click, identically
    // styled either way - the mini bar shows "the circles as per the existing metronome" (ML-64), not
    // a simplified stand-in. The mini row has no fixed-width/scroll treatment (metroApplyDisplayWidth
    // is display-only, main row exclusive): it's a much smaller space anyway, so dots just compress
    // proportionally via the same percentage leftPct positions rather than needing to scroll.
    function buildMetroDotRow(rowId, totalBaseClicks, subFactor, zeroBar, leftPct) {
        const row = document.getElementById(rowId);
        if (!row) return;
        row.innerHTML = '';
        for (let k = 0; k < totalBaseClicks; k++) {
            const isNoteBoundary = (k % subFactor) === 0;
            const dot = document.createElement('div');
            dot.className = 'metro-dot ' + (isNoteBoundary ? 'metro-dot-note' : 'metro-dot-sub') +
                (isNoteBoundary && k === 0 && !zeroBar ? ' accent' : '');
            dot.dataset.index = k;
            dot.style.left = metroLeftStyle(leftPct(k));
            row.appendChild(dot);
        }
    }

    function renderMetroTiers() {
        const { leftPct, subFactor, totalBaseClicks } = metroTierGeometry();
        metroApplyDisplayWidth('metroDisplayViewport', 'metroDisplayContent', totalBaseClicks);
        metroApplyDisplayWidth('metroMiniViewport', 'metroMiniContent', totalBaseClicks);
        const zeroBar = metroState.beatsPerBar <= 0;

        buildMetroDotRow('metroNotesRow', totalBaseClicks, subFactor, zeroBar, leftPct);
        buildMetroDotRow('metroMiniDots', totalBaseClicks, subFactor, zeroBar, leftPct);

        // Don't yank the scroll position back to bar-start while it's still playing in the background
        // (ML-64 lets it keep running off-screen) - only reset on a genuine stop, or the very first
        // render before anything has ever played.
        if (!metroPlayer.isPlaying()) {
            resetMetroScrollPosition('metroDisplayContent');
            resetMetroScrollPosition('metroMiniContent');
        }
        syncMetroMiniLabels();
    }

    function resetMetroScrollPosition(contentId) {
        const content = document.getElementById(contentId);
        if (content) { content.style.transitionDuration = '0s'; content.style.transform = 'translateX(0px)'; }
    }

    // When there are too many clicks to fit, keeps the current beat in view: the content track stays
    // put (scroll offset 0) until that beat would pass the viewport's centre, then an instant-snap-
    // then-glide is applied to the content's own translateX, so it scrolls in lockstep and the current
    // beat reads as pinned near the centre while the rest scroll past underneath it. Once the tail end
    // of the content reaches the viewport's right edge, the clamp holds the scroll there and resumes
    // once the bar wraps back to its start - the classic side-scroller camera clamp. Runs against
    // whichever viewport/content pair is passed, so the full view and the mini bar (ML-64) each pan
    // independently off their own (possibly different) fit-vs-scroll state.
    function metroScrollFollow(viewportId, contentId, arrivedPct, nextPct, durationSeconds) {
        const content = document.getElementById(contentId);
        const viewport = document.getElementById(viewportId);
        if (!content || !viewport) return;
        const contentWidthPx = content.getBoundingClientRect().width;
        const viewportWidthPx = viewport.getBoundingClientRect().width;
        const maxScrollPx = Math.max(0, contentWidthPx - viewportWidthPx);
        if (maxScrollPx <= 0) return; // fits on screen - nothing to scroll, leave translateX at 0

        const scrollForPct = (pct) => Math.min(maxScrollPx, Math.max(0, (pct / 100) * contentWidthPx - viewportWidthPx / 2));

        content.style.transitionDuration = '0s';
        content.style.transform = `translateX(${-scrollForPct(arrivedPct)}px)`;
        void content.offsetWidth; // force the instant snap to commit before animating, see flashMetroBeat
        content.style.transitionDuration = `${durationSeconds}s`;
        content.style.transform = `translateX(${-scrollForPct(nextPct)}px)`;
    }

    function flashTierDot(rowId, index) {
        const row = document.getElementById(rowId);
        const dot = row && row.querySelector(`.metro-dot[data-index="${index}"]`);
        if (dot) {
            dot.classList.add('lit');
            setTimeout(() => dot.classList.remove('lit'), 120);
        }
    }

    function flashMetroBeat(beatInfo) {
        // Every dot lives in one row now, keyed by its base-click index within the bar (ML-66) - no
        // more separate note/subdivide index spaces to look up. The mini bar's row mirrors it 1:1
        // (ML-64), whether or not it's actually visible right now.
        flashTierDot('metroNotesRow', beatInfo.clickIndexInBar);
        flashTierDot('metroMiniDots', beatInfo.clickIndexInBar);

        // No more moving baton/line to draw (ML-70) - but the auto-scroll that keeps the current
        // conductor beat in view still runs exactly as before, off the same conductor-beat timing -
        // for both the full view and the mini bar (ML-64).
        if (!beatInfo.isConductorBeat) return;
        const { notesPerBeat, subFactor, leftPct } = metroTierGeometry();
        const groupSize = notesPerBeat * subFactor;
        const nextIndex = (beatInfo.conductorBeatIndex + 1) % beatInfo.conductorBeatsPerBar;
        const arrivedPct = leftPct(beatInfo.conductorBeatIndex * groupSize);
        // Genuinely wraps back to nextIndex's true (small) position rather than continuing past 100% -
        // that "keep incrementing" trick only ever made sense for a baton that needed to visibly exit
        // right and reappear left (ML-70 removed it); applied to the scroll itself it just clamped the
        // camera at the far-right edge forever, so the bar's first beat looked like it landed on the
        // LAST circle instead of the first (reported after the ML-70 changes).
        const nextPct = leftPct(nextIndex * groupSize);
        metroScrollFollow('metroDisplayViewport', 'metroDisplayContent', arrivedPct, nextPct, beatInfo.secondsPerConductorBeat);
        metroScrollFollow('metroMiniViewport', 'metroMiniContent', arrivedPct, nextPct, beatInfo.secondsPerConductorBeat);
    }
    metroPlayer.onBeat(flashMetroBeat);

    function updateMetroPlayIcon() {
        const playing = metroPlayer.isPlaying();
        const icon = document.getElementById('metroPlayIcon');
        const btn = document.getElementById('metroPlayBtn');
        if (icon) icon.innerText = playing ? 'pause' : 'play_arrow';
        if (btn) btn.setAttribute('aria-label', playing ? 'Pause' : 'Play');
        const miniIcon = document.getElementById('metroMiniPlayIcon');
        const miniBtn = document.getElementById('metroMiniPlayBtn');
        if (miniIcon) miniIcon.innerText = playing ? 'pause' : 'play_arrow';
        if (miniBtn) miniBtn.setAttribute('aria-label', playing ? 'Pause' : 'Play');
        syncWakeLock();
    }

    // Whether the mini bar should be offered at all - true from the moment the metronome is first
    // played until it's explicitly Stopped, NOT just paused (ML-86 originally tied this to
    // isPlaying() directly, which also hid it on pause - reverted per direct feedback: a paused
    // session is still one you'd want to get back to from another page, not a dead one worth losing
    // track of).
    let metroMiniActive = false;

    // Shown whenever the metronome is active (playing or paused, not stopped) and the full Metronome
    // view itself isn't on-screen - called on every view change.
    function updateMetroMiniBarVisibility(viewName) {
        const bar = document.getElementById('metroMiniBar');
        if (!bar) return;
        bar.classList.toggle('hidden-group', !metroMiniActive || viewName === 'metronomeView');
    }

    // Resumes from wherever it was left (position 0 the first time, or wherever pauseMetronome() left
    // it) - use stopMetronome() first for a fresh bar from the beginning.
    function playMetronome() {
        pushMetroSettingsToPlayer();
        metroPlayer.play();
        metroMiniActive = true;
        updateMetroPlayIcon();
        updateMetroMiniBarVisibility(viewStack[viewStack.length - 1]);
    }

    // Halts playback without resetting position - playMetronome() will pick back up from here. Does
    // NOT touch the mini bar's visibility - see metroMiniActive above.
    function pauseMetronome() {
        metroPlayer.pause();
        updateMetroPlayIcon();
    }

    // Halts playback AND resets the beat position back to the start of the bar, and dismisses the
    // mini bar - the one deliberate action that ends the "active this session" state, since there's
    // no separate close button on the mini bar itself.
    function stopMetronome() {
        metroPlayer.stop();
        metroMiniActive = false;
        updateMetroPlayIcon();
        resetMetroScrollPosition('metroDisplayContent');
        resetMetroScrollPosition('metroMiniContent');
        updateMetroMiniBarVisibility(viewStack[viewStack.length - 1]);
    }

    document.getElementById('metroPlayBtn')?.addEventListener('click', () => {
        if (metroPlayer.isPlaying()) pauseMetronome(); else playMetronome();
    });
    document.getElementById('metroStopBtn')?.addEventListener('click', stopMetronome);
    document.getElementById('metroMiniPlayBtn')?.addEventListener('click', () => {
        if (metroPlayer.isPlaying()) pauseMetronome(); else playMetronome();
    });
    // Fully stops it (ML-87) - the only way to dismiss the mini bar from another screen without
    // navigating back to the full Metronome view first.
    document.getElementById('metroMiniCloseBtn')?.addEventListener('click', stopMetronome);

    // --- BPM step buttons (tap = +-1, hold = repeats, accelerating to +-10 per step after 15 taps' worth) ---
    function setupMetroBpmStepper(btnId, direction) {
        const btn = document.getElementById(btnId);
        if (!btn) return;
        const REPEAT_MS = 100;
        const INITIAL_DELAY_MS = 400;
        const ACCELERATE_AFTER = 15;
        let repeatTimer = null;
        let startTimer = null;
        let unitStepsTaken = 0;

        function step() {
            const amount = (unitStepsTaken >= ACCELERATE_AFTER ? 10 : 1) * direction;
            setMetroNotesBpm(metroState.notesBpm + amount, { resetSpeed: true });
            if (unitStepsTaken < ACCELERATE_AFTER) unitStepsTaken++;
        }

        function begin(e) {
            e.preventDefault();
            step();
            startTimer = setTimeout(() => {
                repeatTimer = setInterval(step, REPEAT_MS);
            }, INITIAL_DELAY_MS);
        }
        function end() {
            clearTimeout(startTimer);
            clearInterval(repeatTimer);
            unitStepsTaken = 0;
        }

        btn.addEventListener('pointerdown', begin);
        btn.addEventListener('pointerup', end);
        btn.addEventListener('pointerleave', end);
        btn.addEventListener('pointercancel', end);
    }
    setupMetroBpmStepper('metroBpmMinus', -1);
    setupMetroBpmStepper('metroBpmPlus', 1);
    setupMetroBpmStepper('metroMiniBpmMinus', -1);
    setupMetroBpmStepper('metroMiniBpmPlus', 1);

    // --- Slider (shared design-system component) drag + keyboard interaction ---
    // Value-agnostic: reports a 0-1 ratio for drags/clicks along the track, and a +-1 step for arrow
    // keys, leaving whatever the value actually means to the caller. Used by both the target-speed
    // BPM slider (3-stage rescaling track) and the plain 0-100 volume slider.
    function setupSliderInteraction(track, thumb, { onDragRatio, onArrowStep }) {
        if (!track || !thumb) return;

        function ratioFromClientX(clientX) {
            const rect = track.getBoundingClientRect();
            return Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
        }

        function onMove(e) { onDragRatio(ratioFromClientX(e.clientX)); }
        function onUp() {
            document.removeEventListener('pointermove', onMove);
            document.removeEventListener('pointerup', onUp);
        }

        thumb.addEventListener('pointerdown', (e) => {
            e.preventDefault();
            document.addEventListener('pointermove', onMove);
            document.addEventListener('pointerup', onUp);
        });

        track.addEventListener('pointerdown', (e) => {
            if (e.target === thumb) return;
            onDragRatio(ratioFromClientX(e.clientX));
        });

        if (onArrowStep) {
            thumb.addEventListener('keydown', (e) => {
                if (e.key === 'ArrowRight' || e.key === 'ArrowUp') onArrowStep(1);
                if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') onArrowStep(-1);
            });
        }
    }

    // Design system: any slider's numeric readout doubles as a tap target - clicking/tapping it
    // swaps in a real number input (pre-filled, focused, selected) so a value can be typed directly
    // instead of only dragging or stepping to it. Committing (blur or Enter) calls setValue and
    // restores the original display element in place; Escape cancels without calling it. Swaps the
    // SAME element back in (never destroyed, just detached while editing) so nothing else needs to
    // know the DOM changed - existing render functions keep working via the same id once restored.
    function makeSliderReadoutEditable(displayElId, getValue, setValue, opts = {}) {
        const displayEl = document.getElementById(displayElId);
        if (!displayEl) return;
        displayEl.style.cursor = 'pointer';
        displayEl.tabIndex = 0;
        displayEl.setAttribute('role', 'button');
        displayEl.setAttribute('aria-label', (opts.label || 'Value') + ', tap to type a number');

        function startEdit() {
            if (!displayEl.isConnected) return; // already mid-edit
            const input = document.createElement('input');
            input.type = 'number';
            input.className = 'slider-readout-input';
            input.value = getValue();
            if (opts.min !== undefined) input.min = opts.min;
            if (opts.max !== undefined) input.max = opts.max;
            displayEl.replaceWith(input);
            input.focus();
            input.select();

            function restore() { if (input.isConnected) input.replaceWith(displayEl); }
            input.addEventListener('blur', () => {
                const val = Number(input.value);
                restore();
                if (input.value !== '' && !Number.isNaN(val)) setValue(val);
            });
            input.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') { e.preventDefault(); input.blur(); }
                if (e.key === 'Escape') { e.preventDefault(); input.value = ''; input.blur(); }
            });
        }
        displayEl.addEventListener('click', startEdit);
        displayEl.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); startEdit(); }
        });
    }

    setupSliderInteraction(document.getElementById('metroSliderTrack'), document.getElementById('metroSliderThumb'), {
        onDragRatio: (ratio) => setMetroNotesBpm(METRO_MIN_BPM + ratio * (metroState.sliderMax - METRO_MIN_BPM), { resetSpeed: true, dragging: true }),
        onArrowStep: (dir) => setMetroNotesBpm(metroState.notesBpm + dir, { resetSpeed: true, dragging: true })
    });
    // Mini bar's BPM popup (ML-64) - same slider behaviour, separate DOM element.
    setupSliderInteraction(document.getElementById('metroMiniBpmSliderTrack'), document.getElementById('metroMiniBpmSliderThumb'), {
        onDragRatio: (ratio) => setMetroNotesBpm(METRO_MIN_BPM + ratio * (metroState.sliderMax - METRO_MIN_BPM), { resetSpeed: true, dragging: true }),
        onArrowStep: (dir) => setMetroNotesBpm(metroState.notesBpm + dir, { resetSpeed: true, dragging: true })
    });
    makeSliderReadoutEditable('metroBpmValue', () => metroState.notesBpm, (v) => setMetroNotesBpm(v, { resetSpeed: true }), { label: 'Beats per minute', min: METRO_MIN_BPM, max: METRO_MAX_BPM });
    makeSliderReadoutEditable('metroMiniBpmModalValue', () => metroState.notesBpm, (v) => setMetroNotesBpm(v, { resetSpeed: true }), { label: 'Beats per minute', min: METRO_MIN_BPM, max: METRO_MAX_BPM });

    document.getElementById('metroMiniBpmBtn')?.addEventListener('click', () => {
        renderMetroMiniBpmSlider();
        document.getElementById('metroMiniBpmModal').style.display = 'flex';
    });
    document.getElementById('metroMiniSpeedBtn')?.addEventListener('click', () => {
        document.getElementById('metroMiniSpeedModal').style.display = 'flex';
    });

    const METRO_CUSTOM_MAX = 50;

    // Opens a beats-per-bar / conductor-beats / subdivide picker popup. Nothing is applied as you tap
    // around inside it - a tap just changes what's currently selected (including switching into the
    // inline Custom stepper, no nested modal) - and only Save actually calls onSave and closes it;
    // Cancel closes without applying anything.
    //
    // cfg: { modalId, optionsId, customEntryId, customValueId, cancelBtnId, saveBtnId,
    //        values, currentValue, labelFor, customMin, customMax, onSave,
    //        extraOption?: {label, icon, onPick}, startAsExtra? }
    function openMetroPicker(cfg) {
        const modalEl = document.getElementById(cfg.modalId);
        const optsEl = document.getElementById(cfg.optionsId);
        const customEl = document.getElementById(cfg.customEntryId);
        const customValEl = document.getElementById(cfg.customValueId);
        if (!modalEl || !optsEl) return;

        let kind = cfg.startAsExtra ? 'extra' : 'preset'; // 'preset' | 'extra' | 'custom'
        let value = cfg.currentValue;

        function renderOptions() {
            let html = '';
            if (cfg.extraOption) {
                html += `<button class="metro-beats-option custom-option${kind === 'extra' ? ' selected' : ''}" data-extra="1">` +
                    (cfg.extraOption.icon ? `<span class="material-symbols-outlined metro-option-icon">${cfg.extraOption.icon}</span>` : '') +
                    `${cfg.extraOption.label}</button>`;
            }
            html += cfg.values.map(v =>
                `<button class="metro-beats-option${kind === 'preset' && v === value ? ' selected' : ''}" data-val="${v}">${cfg.labelFor ? cfg.labelFor(v) : v}</button>`
            ).join('');
            html += `<button class="metro-beats-option custom-option${kind === 'custom' ? ' selected' : ''}" data-custom="1">Custom&hellip;</button>`;
            optsEl.innerHTML = html;
        }

        function renderCustomEntry() {
            if (!customEl) return;
            customEl.classList.toggle('hidden-group', kind !== 'custom');
            if (kind === 'custom' && customValEl) customValEl.innerText = cfg.customLabelFor ? cfg.customLabelFor(value) : value;
        }

        optsEl.onclick = (e) => {
            const btn = e.target.closest('.metro-beats-option');
            if (!btn) return;
            if (btn.dataset.extra) {
                kind = 'extra';
            } else if (btn.dataset.custom) {
                kind = 'custom';
                // Custom starts from a fixed sensible default if given (there's no point landing on a
                // value that's already one of the presets); otherwise from what's presently set.
                value = cfg.customDefault !== undefined ? cfg.customDefault : cfg.currentValue;
            } else {
                kind = 'preset';
                value = parseInt(btn.dataset.val, 10);
            }
            renderOptions();
            renderCustomEntry();
        };

        if (customEl) {
            customEl.querySelectorAll('.metro-bpm-step').forEach(btn => {
                btn.onclick = () => {
                    const step = parseInt(btn.dataset.step, 10);
                    // customStep (optional): custom navigation, e.g. stepping through only the values
                    // that are actually valid (conductor beats must evenly divide beats per bar) rather
                    // than a plain +-1 that could land on one that isn't.
                    value = cfg.customStep ? cfg.customStep(value, step) : Math.min(cfg.customMax, Math.max(cfg.customMin, value + step));
                    if (customValEl) customValEl.innerText = cfg.customLabelFor ? cfg.customLabelFor(value) : value;
                };
            });
        }

        document.getElementById(cfg.saveBtnId).onclick = () => {
            if (kind === 'extra') cfg.extraOption.onPick();
            else cfg.onSave(value);
            modalEl.style.display = 'none';
        };
        document.getElementById(cfg.cancelBtnId).onclick = () => {
            modalEl.style.display = 'none';
        };

        renderOptions();
        renderCustomEntry();
        modalEl.style.display = 'flex';
    }

    // --- Beats per bar popup - opened from either the full view's button or the mini bar's (ML-64) ---
    function openMetroBeatsPicker() {
        openMetroPicker({
            modalId: 'metroBeatsModal', optionsId: 'metroBeatsOptions',
            customEntryId: 'metroBeatsCustomEntry', customValueId: 'metroBeatsCustomValue',
            cancelBtnId: 'metroBeatsCancelBtn', saveBtnId: 'metroBeatsSaveBtn',
            // 0 (ML-63): a single unaccented beat for pieces that can't use a variable-bar-length
            // version - one circle, no bar structure, just beat it out.
            values: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 12], currentValue: metroState.beatsPerBar,
            customMin: 1, customMax: METRO_CUSTOM_MAX,
            customDefault: 10, // not already one of the presets above, so Custom starts somewhere new
            onSave: (v) => setMetroBeatsPerBar(v)
        });
    }
    document.getElementById('metroBeatsBtn')?.addEventListener('click', openMetroBeatsPicker);
    document.getElementById('metroMiniBeatsBtn')?.addEventListener('click', openMetroBeatsPicker);

    // --- Subdivide popup (Off/2/3/4 plus Custom - "N per beat" throughout, presets and custom alike) ---
    function openMetroSubdividePicker() {
        openMetroPicker({
            modalId: 'metroSubdivideModal', optionsId: 'metroSubdivideOptions',
            customEntryId: 'metroSubdivideCustomEntry', customValueId: 'metroSubdivideCustomValue',
            cancelBtnId: 'metroSubdivideCancelBtn', saveBtnId: 'metroSubdivideSaveBtn',
            values: [1, 2, 3, 4], currentValue: metroState.subdivisionFactor,
            labelFor: v => metroSubdivideLabel(v),
            customLabelFor: v => `${v} per beat`,
            customMin: 1, customMax: METRO_CUSTOM_MAX,
            customDefault: 5, // not already one of the presets above
            onSave: (v) => setMetroSubdivision(v)
        });
    }
    document.getElementById('metroSubdivideBtn')?.addEventListener('click', openMetroSubdividePicker);
    document.getElementById('metroMiniSubdivideBtn')?.addEventListener('click', openMetroSubdividePicker);

    // --- Speed override (practice slower/faster than target, target itself untouched) - shared by
    // both the full view's buttons and the mini bar's popup (ML-64) ---
    function stepMetroSpeedLevel(delta) {
        const { minLevel, maxLevel } = metroSpeedLevelBounds();
        metroState.speedLevel = Math.min(maxLevel, Math.max(minLevel, metroState.speedLevel + delta));
        pushMetroSettingsToPlayer();
        renderMetroSpeedReadout();
    }
    document.getElementById('metroSlowerBtn')?.addEventListener('click', () => stepMetroSpeedLevel(-1));
    document.getElementById('metroFasterBtn')?.addEventListener('click', () => stepMetroSpeedLevel(1));
    document.getElementById('metroMiniSpeedMinus')?.addEventListener('click', () => stepMetroSpeedLevel(-1));
    document.getElementById('metroMiniSpeedPlus')?.addEventListener('click', () => stepMetroSpeedLevel(1));
    document.getElementById('metroSpeedResetBtn')?.addEventListener('click', () => {
        metroState.speedLevel = 0;
        pushMetroSettingsToPlayer();
        renderMetroSpeedReadout();
    });

    // --- Volume / mute (in-app gain only - a web page cannot control the device's hardware volume) ---
    function renderMetroVolumeSlider() {
        const fill = document.getElementById('metroVolumeFill');
        const thumb = document.getElementById('metroVolumeThumb');
        if (!fill || !thumb) return;
        fill.style.width = `${metroState.volume}%`;
        thumb.style.left = `${metroState.volume}%`;
        thumb.setAttribute('aria-valuenow', metroState.volume);
    }

    function setMetroVolume(v) {
        metroState.volume = Math.round(Math.min(100, Math.max(0, v)));
        metroPlayer.setVolume(metroState.volume / 100);
        renderMetroVolumeSlider();
    }

    setupSliderInteraction(document.getElementById('metroVolumeTrack'), document.getElementById('metroVolumeThumb'), {
        onDragRatio: (ratio) => setMetroVolume(ratio * 100),
        onArrowStep: (dir) => setMetroVolume(metroState.volume + dir * 5)
    });
    document.getElementById('metroMuteBtn')?.addEventListener('click', () => {
        metroState.muted = !metroState.muted;
        metroPlayer.setMuted(metroState.muted);
        document.getElementById('metroMuteIcon').innerText = metroState.muted ? 'volume_off' : 'volume_up';
        document.getElementById('metroMuteBtn').setAttribute('aria-pressed', String(metroState.muted));
    });

    // --- Headphone delay compensation ---
    function renderMetroLatencyReadout() {
        document.getElementById('metroLatencyMs').innerText = `${metroState.latencyMs} ms`;
    }
    function setMetroLatencyMs(ms) {
        metroState.latencyMs = Math.min(METRO_LATENCY_MAX, Math.max(0, ms));
        metroPlayer.setVisualLatencyMs(metroState.latencyMs);
        localStorage.setItem(METRO_LATENCY_KEY, String(metroState.latencyMs));
        renderMetroLatencyReadout();
    }
    document.getElementById('metroLatencyMinusBtn')?.addEventListener('click', () => setMetroLatencyMs(metroState.latencyMs - METRO_LATENCY_STEP));
    document.getElementById('metroLatencyPlusBtn')?.addEventListener('click', () => setMetroLatencyMs(metroState.latencyMs + METRO_LATENCY_STEP));
    document.getElementById('metroLatencyResetBtn')?.addEventListener('click', () => setMetroLatencyMs(0));

    // --- Set from music (note value + bpm + time signature -> notes bpm / beats per bar / conduct in) ---
    document.getElementById('metroMusicBtn')?.addEventListener('click', () => {
        document.getElementById('metroMusicModal').style.display = 'flex';
    });
    document.getElementById('metroApplyMusicBtn')?.addEventListener('click', () => {
        const noteTypeSelect = document.getElementById('metroNoteType');
        const noteFraction = parseFloat(noteTypeSelect.value);
        const noteTypeLabel = noteTypeSelect.selectedOptions[0].text;
        const enteredBpm = parseFloat(document.getElementById('metroNoteBpm').value);
        const timeSig = document.getElementById('metroTimeSig').value;
        const [numStr, denStr] = timeSig.split('/');
        const numerator = parseInt(numStr, 10);
        const denominator = parseInt(denStr, 10);

        if (!enteredBpm || enteredBpm <= 0) { showWarningToast('Enter a valid beats per minute for the note value.'); return; }

        const notesBpm = enteredBpm * noteFraction * denominator;
        // Compound time signatures (6/8, 9/8, 12/8...) are conducted in groups of 3 notes per beat.
        const isCompound = (numerator % 3 === 0) && numerator >= 6;
        const notesPerBeat = isCompound ? 3 : 1;

        if (notesBpm < METRO_MIN_BPM || notesBpm > METRO_MAX_BPM) {
            showWarningToast(`That works out to ${Math.round(notesBpm)} notes per minute, which is outside the ${METRO_MIN_BPM}-${METRO_MAX_BPM} range.`);
            return;
        }

        setMetroFreshGrid({ notesBpm, beatsPerBar: numerator, notesPerBeat, subdivisionFactor: 1 });
        document.getElementById('metroMusicModal').style.display = 'none';
        showSuccessToast(`Set to ${Math.round(notesBpm)} notes/min, ${numerator} beats per bar, conducted in ${Math.round(numerator / notesPerBeat)}.`);

        const readout = document.getElementById('metroAdvancedReadout');
        if (readout) {
            readout.innerText = `${noteTypeLabel} = ${enteredBpm}, ${timeSig}`;
            readout.classList.remove('hidden-group');
        }
    });

    // Re-check whether the display needs to switch between "stretch to fit" and "fixed width, scroll
    // to follow" if the viewport itself changes size (rotation, resizing the window).
    window.addEventListener('resize', () => {
        const view = document.getElementById('metronomeView');
        if (view && view.style.display !== 'none') renderMetroTiers();
    });

    // Initial paint
    setMetroFreshGrid({
        notesBpm: metroState.notesBpm, beatsPerBar: metroState.beatsPerBar,
        notesPerBeat: metroState.notesPerBeat, subdivisionFactor: metroState.subdivisionFactor
    });
    metroState.conductInLinked = true; // the default starting state is linked
    renderMetroConductInLabel();
    renderMetroVolumeSlider();
    setMetroLatencyMs(parseInt(localStorage.getItem(METRO_LATENCY_KEY), 10) || 0);

    // ========================================
    // METRONOME BLOCKS (Jira ML-35) - the multi-bar sequencer tool. Ad-hoc/
    // standalone only, see docs/database-schema.md "Scores & metronome
    // segments (Jira ML-35)". A separate tool from the single-bar Metronome
    // above (not a mode toggle) - reuses that tool's audio engine (a second,
    // independent createMetronomePlayer() instance) and its generic dot/
    // scroll helpers (buildMetroDotRow, metroApplyDisplayWidth, flashTierDot,
    // metroScrollFollow, resetMetroScrollPosition - all already parametrised
    // by element id, not tied to metroState) rather than rebuilding them.
    // ========================================
    function escapeHtml(str) {
        return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    let metroBlkSetups = [];
    let metroBlkCurrentSetup = null; // { id, name, segments: [...] }, loaded when entering the builder
    let metroBlkTimeSigCache = { public: [], custom: [] };

    // Sequencing: lead-in segments always play first (metroBlkCurrentSetup.segments is kept in that
    // order at all times - see normalizeMetroBlkOrder), then the rest loop from metroBlkLoopBackIndex -
    // which is the lead-in's own index (0) instead of past it, when that lead-in is marked
    // repeatLeadIn (ML-85), so it plays again on every loop rather than just once at the very start.
    let metroBlkPlayQueue = [];
    let metroBlkLoopBackIndex = 0;
    let metroBlkPlayIndex = 0;
    let metroBlkBeatsPlayedInBlock = 0;
    // Conductor beats only (for the "x of y" label) - metroBlkClicksPlayedInBlock below is every
    // click, main beats and sub-beats alike, and is what actually decides when to advance.
    let metroBlkClicksPlayedInBlock = 0;
    // Whether the mini bar should be offered at all - true from the moment the sequence is first
    // played, cleared only when switching to a different setup (there's no separate "stop" here, see
    // resetMetroBlk) - NOT on pause, which is still an in-progress session worth getting back to from
    // another page, not a dead one (reverted from an ML-86 change that hid it on pause too).
    let metroBlkMiniActive = false;
    // Seconds of quiet space (ML-92) queued up by the most recent metroBlkRealignPlayer call, waiting
    // to be consumed by the next playMetroBlk() - see the comment there and on metroBlkRealignPlayer.
    let metroBlkPendingLeadInSilence = 0;
    // True for the duration of that quiet space - nothing is actually sounding yet, so the row's dots
    // show fully greyed out (see renderMetroBlkRows/.metroBlk-quiet-gap) rather than looking ready to
    // play. Cleared the instant the lead-in's real first click arrives (onMetroBlkBeat).
    let metroBlkQuietGapActive = false;

    const metroBlkPlayer = createMetronomePlayer();

    // --- Setups list ---
    async function loadMetroBlkSetups() {
        const ui = document.getElementById('metroBlkSetupsList');
        if (ui) ui.innerHTML = 'Loading...';
        try {
            metroBlkSetups = await API.metronomeBlocks.setups.list();
            renderMetroBlkSetupsList();
        } catch (error) {
            showWarningToast('Error loading setups: ' + error.message);
        }
    }

    // One pass through the sequence (lead-in once, then every loop block once) - not the length of
    // an actual practice session, which loops indefinitely until stopped.
    function formatMetroBlkDuration(totalSeconds) {
        const s = Math.round(totalSeconds);
        return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
    }

    function renderMetroBlkSetupsList() {
        const ui = document.getElementById('metroBlkSetupsList');
        if (!ui) return;
        if (!metroBlkSetups.length) { ui.innerHTML = '<p>No saved setups yet - use "+ Add new" above to create one.</p>'; return; }
        ui.innerHTML = metroBlkSetups.map(s => `
            <div class="history-item" style="align-items:center;">
                <div style="flex-grow:1; cursor:pointer;" onclick="openMetroBlkSetup(${s.id})">
                    <strong>${escapeHtml(s.name)}</strong>
                    <div style="font-size:0.85rem; color:#666;">${s.blockCount} block${s.blockCount === 1 ? '' : 's'}${s.hasLeadIn ? ' + lead-in' : ''} &middot; ${formatMetroBlkDuration(s.totalSeconds)}</div>
                </div>
                <div class="metroBlk-setup-row-actions">
                    <button class="btn-icon-copy" aria-label="Copy" onclick="duplicateMetroBlkSetup(${s.id})"><span class="material-symbols-outlined">content_copy</span></button>
                    <button class="btn-icon-delete" aria-label="Delete" onclick="deleteMetroBlkSetup(${s.id})"><span class="material-symbols-outlined">delete</span></button>
                </div>
            </div>
        `).join('');
    }

    // The builder always has something loaded - a real saved setup, or the account's one
    // scratch (see server-side getOrCreateScratchSetup) seeded with a default 4/4 @ 60bpm
    // block so the tool is immediately playable with zero naming friction. Every edit from
    // here on autosaves straight through the existing segment PUT/POST/DELETE calls; the only
    // "cancel a one-off change" point is the edit-block modal's own Cancel button, which never
    // calls the API at all.
    async function loadMetroBlkDefaultSetup() {
        try {
            const fresh = await API.metronomeBlocks.setups.getScratch();
            fresh.segments = await normalizeMetroBlkOrder(fresh.segments);
            metroBlkCurrentSetup = fresh;
            renderMetroBlkSetupHeader();
            renderMetroBlockTiles();
        } catch (error) {
            showWarningToast('Error loading setup: ' + error.message);
        }
    }

    // "Block setup" placeholder until the setup actually has a name (saveAdhocSetup/
    // createNamedAdhocSetup are the only things that set savedAt) - the rename button only
    // makes sense once there's a real name to edit.
    function renderMetroBlkSetupHeader() {
        const nameEl = document.getElementById('metroBlkSetupName');
        const nameBtn = document.getElementById('metroBlkRenameBtn');
        const icon = document.getElementById('metroBlkRenameIcon');
        const saveBtn = document.getElementById('metroBlkSaveBtn');
        if (!nameEl || !metroBlkCurrentSetup) return;
        const isSaved = !!metroBlkCurrentSetup.savedAt;
        nameEl.innerText = isSaved ? metroBlkCurrentSetup.name : 'Block setup';
        nameBtn?.classList.toggle('metroBlk-setup-name-btn-disabled', !isSaved);
        icon?.classList.toggle('hidden-group', !isSaved);
        // Save is the only way to keep a scratch's work - it's the mutually exclusive counterpart
        // to the rename icon (which only makes sense once it's already named).
        saveBtn?.classList.toggle('hidden-group', isSaved);
    }

    document.getElementById('metroBlkRenameBtn')?.addEventListener('click', () => {
        if (metroBlkCurrentSetup) window.renameMetroBlkSetup(metroBlkCurrentSetup.id);
    });

    // Saves the CURRENT scratch's accumulated blocks under a name, in place - unlike "+ Add new" /
    // Copy, this doesn't create a fresh setup or touch the blocks at all, it just names and keeps
    // the one already sitting in the builder (the same saveAdhocSetup step "+ Add new" uses
    // internally, just triggered directly on what's already here instead of on a brand-new setup).
    document.getElementById('metroBlkSaveBtn')?.addEventListener('click', () => {
        if (!metroBlkCurrentSetup) return;
        showPromptModal('Save this setup', '', async (name) => {
            if (!name || !name.trim()) return;
            try {
                await API.metronomeBlocks.setups.save(metroBlkCurrentSetup.id, name.trim());
                metroBlkCurrentSetup.name = name.trim();
                metroBlkCurrentSetup.savedAt = new Date().toISOString();
                renderMetroBlkSetupHeader();
                await loadMetroBlkSetups();
                showSuccessToast('Saved');
            } catch (error) {
                showWarningToast('Error: ' + error.message);
            }
        });
    });

    // Asks for the name up front (unlike the old scratch-first flow) because this button's
    // whole point is adding a setup straight to the saved list, not another invisible scratch.
    document.getElementById('metroBlkAddSetBtn')?.addEventListener('click', () => {
        showPromptModal('Name this setup', '', async (name) => {
            if (!name || !name.trim()) return;
            try {
                const created = await API.metronomeBlocks.setups.createNamed(name.trim());
                created.segments = await normalizeMetroBlkOrder(created.segments);
                if (metroBlkPlayer.isPlaying()) metroBlkPlayer.pause();
                metroBlkMiniActive = false;
                metroBlkCurrentSetup = created;
                await loadMetroBlkSetups();
                switchView('metroBuilderView');
            } catch (error) {
                showWarningToast('Error: ' + error.message);
            }
        });
    });

    window.renameMetroBlkSetup = function(id) {
        const setup = metroBlkSetups.find(s => s.id === id);
        showPromptModal('Rename setup', setup ? setup.name : (metroBlkCurrentSetup?.name || ''), async (name) => {
            if (!name) return;
            try {
                await API.metronomeBlocks.setups.rename(id, name);
                showSuccessToast('Renamed');
                await loadMetroBlkSetups();
                if (metroBlkCurrentSetup && metroBlkCurrentSetup.id === id) {
                    metroBlkCurrentSetup.name = name;
                    renderMetroBlkSetupHeader();
                }
            } catch (error) {
                showWarningToast('Error: ' + error.message);
            }
        });
    }

    // "Copy this setup" - a new setup seeded with all of this one's blocks, as a starting point for
    // a variant. Loads straight into the builder afterwards, same as "+ Add new set".
    window.duplicateMetroBlkSetup = function(id) {
        const setup = metroBlkSetups.find(s => s.id === id);
        showPromptModal('Name the copy', setup ? `${setup.name} copy` : '', async (name) => {
            if (!name || !name.trim()) return;
            try {
                const created = await API.metronomeBlocks.setups.duplicate(id, name.trim());
                created.segments = await normalizeMetroBlkOrder(created.segments);
                if (metroBlkPlayer.isPlaying()) metroBlkPlayer.pause();
                metroBlkMiniActive = false;
                metroBlkCurrentSetup = created;
                await loadMetroBlkSetups();
                switchView('metroBuilderView');
            } catch (error) {
                showWarningToast('Error: ' + error.message);
            }
        });
    }

    window.deleteMetroBlkSetup = function(id) {
        const setup = metroBlkSetups.find(s => s.id === id);
        showConfirmModal('Delete setup', `Delete "${setup ? setup.name : 'this setup'}" and all its blocks?`, async () => {
            try {
                await API.metronomeBlocks.setups.delete(id);
                showSuccessToast('Setup deleted');
                await loadMetroBlkSetups();
                // This was also the setup loaded in the builder above the list - drop it and fall
                // straight back to the default scratch rather than leaving stale data on screen.
                if (metroBlkCurrentSetup && metroBlkCurrentSetup.id === id) {
                    if (metroBlkPlayer.isPlaying()) metroBlkPlayer.pause();
                    metroBlkMiniActive = false;
                    metroBlkCurrentSetup = null;
                    await loadMetroBlkDefaultSetup();
                }
            } catch (error) {
                showWarningToast('Error: ' + error.message);
            }
        });
    }

    window.openMetroBlkSetup = async function(id) {
        try {
            const fresh = await API.metronomeBlocks.setups.get(id);
            fresh.segments = await normalizeMetroBlkOrder(fresh.segments);
            // Opening a different setup than whatever the player is currently loaded with - pause it
            // (there's no "stop" any more, see resetMetroBlk) so the mini bar (tied to isPlaying())
            // drops away too, since it no longer describes anything the user can see here.
            if (!metroBlkCurrentSetup || metroBlkCurrentSetup.id !== id) {
                if (metroBlkPlayer.isPlaying()) metroBlkPlayer.pause();
                metroBlkMiniActive = false;
            }
            metroBlkCurrentSetup = fresh;
            switchView('metroBuilderView');
            // Selecting a setup from the list moves it to the top of the screen - not obviously a
            // "load" action on its own, so this confirms it actually happened.
            showSuccessToast(`Loaded "${fresh.name}"`);
        } catch (error) {
            showWarningToast('Error loading setup: ' + error.message);
        }
    }


    // --- Ordering: lead-in segments always sort before loop segments, whatever the user did while
    // dragging - this is what makes "lead-ins pinned to the front" true without needing to constrain
    // the drag gesture itself. Persists any correction needed, then returns the corrected list. ---
    async function normalizeMetroBlkOrder(segments) {
        const leadIns = segments.filter(s => s.isLeadIn).sort((a, b) => a.orderIndex - b.orderIndex);
        const loopBlocks = segments.filter(s => !s.isLeadIn).sort((a, b) => a.orderIndex - b.orderIndex);
        const ordered = [...leadIns, ...loopBlocks];
        const updates = ordered
            .map((s, idx) => (s.orderIndex === idx ? null : API.metronomeBlocks.segments.update(s.id, { orderIndex: idx })))
            .filter(Boolean);
        if (updates.length) await Promise.all(updates);
        return ordered.map((s, idx) => ({ ...s, orderIndex: idx }));
    }

    async function reloadMetroBlkSetup() {
        if (!metroBlkCurrentSetup) return;
        const fresh = await API.metronomeBlocks.setups.get(metroBlkCurrentSetup.id);
        fresh.segments = await normalizeMetroBlkOrder(fresh.segments);
        metroBlkCurrentSetup = fresh;
        renderMetroBlockTiles();
    }

    // --- Build panel: block tiles ---
    // `beatsPlayedInBlock` (metroBlkBeatsPlayedInBlock) is only meaningful for whichever block is
    // actually current - pass it for that one row only, so a repeating block shows "x of y bars"
    // (or "x of y beats" for a partial lead-in) as it plays; omit it for upcoming-row previews,
    // which just show the plain total since they haven't started.
    function metroBlkBlockLabel(block, beatsPlayedInBlock) {
        const prefix = block.isLeadIn ? 'Lead-in · ' : '';
        // A lead-in only ever plays once, so an "x of y beats" progress count is meaningless - only
        // a repeating block's bar count needs that.
        if (block.pickupBeats) {
            return `${prefix}${block.timeSignatureLabel} · ${block.bpm} bpm`;
        }
        const total = block.barCount;
        const countStr = beatsPlayedInBlock === undefined
            ? `${total} bar${total === 1 ? '' : 's'}`
            : `${Math.min(total, Math.floor(beatsPlayedInBlock / block.numerator) + 1)} of ${total} bar${total === 1 ? '' : 's'}`;
        return `${prefix}${block.timeSignatureLabel} · ${block.bpm} bpm · ${countStr}`;
    }

    function metroBlkTileHtml(s) {
        const countStr = s.pickupBeats
            ? `${s.pickupBeats} beat${s.pickupBeats === 1 ? '' : 's'}`
            : `${s.barCount} bar${s.barCount === 1 ? '' : 's'}`;
        return `<div class="metroBlk-tile${s.isLeadIn ? ' lead-in' : ''}" draggable="true" data-id="${s.id}" onclick="openMetroSegmentModal(${s.id})">
            ${s.isLeadIn ? '<div class="metroBlk-tile-badge">Lead-in</div>' : ''}
            <div class="metroBlk-tile-sig">${escapeHtml(s.timeSignatureLabel)}</div>
            <div class="metroBlk-tile-bpm">${s.bpm} bpm</div>
            <div class="metroBlk-tile-bars">${countStr}</div>
        </div>`;
    }

    // A lead-in no longer carries its own time signature/bpm (ML-35 follow-up - see the note on
    // openMetroLeadInModal) - it always inherits them from whichever segment is currently the
    // first regular (non-lead-in) block. Resolves that "effective" view for display/playback;
    // everything else about the lead-in (isLeadIn, barCount/pickupBeats) is unchanged. `segments`
    // is whichever array is authoritative for the caller's context - metroBlkCurrentSetup.segments
    // for the builder, metroBlkPlayQueue during playback.
    function metroBlkEffectiveBlock(block, segments) {
        if (!block || !block.isLeadIn) return block;
        const firstRegular = segments.find(s => !s.isLeadIn);
        if (!firstRegular) return block;
        return { ...block, bpm: firstRegular.bpm, numerator: firstRegular.numerator, denominator: firstRegular.denominator, timeSignatureLabel: firstRegular.timeSignatureLabel };
    }

    // The lead-in (at most one - see openMetroLeadInModal) lives in its own fixed slot, not mixed
    // into the reorderable grid below - see the ML-35 follow-up note there for why. It shows the
    // time signature/bpm it's actually inheriting from the first regular block (metroBlkEffectiveBlock),
    // even though those fields aren't independently editable on it any more.
    function metroBlkLeadInSlotHtml(leadIn) {
        if (!leadIn) {
            return `<button type="button" class="metroBlk-leadin-row metroBlk-leadin-row-add" aria-label="Add lead-in" onclick="openMetroLeadInModal()">
                <span class="metroBlk-leadin-plus">+</span><span>Lead-in</span>
            </button>`;
        }
        const eff = metroBlkEffectiveBlock(leadIn, metroBlkCurrentSetup.segments);
        const countStr = leadIn.pickupBeats
            ? `${leadIn.pickupBeats} beat${leadIn.pickupBeats === 1 ? '' : 's'}`
            : `${leadIn.barCount} bar${leadIn.barCount === 1 ? '' : 's'}`;
        return `<div class="metroBlk-leadin-row metroBlk-leadin-row-filled" onclick="openMetroLeadInModal(${leadIn.id})">
            <span class="metroBlk-tile-badge">Lead-in</span>
            <strong>${escapeHtml(eff.timeSignatureLabel)}</strong>
            <span>${eff.bpm} bpm</span>
            <span>${countStr}</span>
            ${leadIn.repeatLeadIn ? '<span class="material-symbols-outlined metroBlk-leadin-repeat-icon" aria-label="Repeats on every loop" title="Repeats on every loop">repeat</span>' : ''}
        </div>`;
    }

    function renderMetroBlockTiles() {
        const ui = document.getElementById('metroBlockTiles');
        const leadInSlot = document.getElementById('metroBlkLeadInSlot');
        if (!ui || !metroBlkCurrentSetup) return;
        const segs = metroBlkCurrentSetup.segments;
        const leadIn = segs.find(s => s.isLeadIn) || null;
        const loopBlocks = segs.filter(s => !s.isLeadIn);

        if (leadInSlot) leadInSlot.innerHTML = metroBlkLeadInSlotHtml(leadIn);
        ui.innerHTML = loopBlocks.map(metroBlkTileHtml).join('') +
            '<button class="metroBlk-add-tile" aria-label="Add block" onclick="openMetroSegmentModal()">+</button>';

        setupMetroBlkDragAndDrop(ui);
        // Keeps the play queue (and the "now + upcoming" preview above) in step with every edit,
        // not just the next time Play is pressed - the whole point of putting the player above the
        // builder is that it reflects the blocks below immediately.
        refreshMetroBlkQueueIfStale();
    }

    // Only ever touches regular (non-lead-in) tiles now - the lead-in lives outside this
    // container entirely, so there's no zone-mixing to reconcile any more.
    //
    // Two parallel implementations, split by input type rather than by browser/UA (ML-81 follow-up:
    // a first pass replaced native drag-and-drop with Pointer Events everywhere, which broke desktop
    // mouse dragging - native HTML5 DnD is the well-tested, known-good path there and there was no
    // real reason to move off it). Native draggable="true"/dragstart/dragover/dragend (restored below,
    // unchanged from before ML-81) handles the mouse; it has no real touch equivalent though - on a
    // phone a long-press only ever produced a ghost outline that never actually reordered anything -
    // so a second, Pointer-Events-based path (only ever armed for pointerType 'touch'/'pen', explicitly
    // skipping 'mouse' so the two never compete for the same gesture) covers that case instead.
    const METRO_BLK_DRAG_THRESHOLD_PX = 6;
    function setupMetroBlkDragAndDrop(container) {
        // --- Mouse: native HTML5 drag-and-drop ---
        let draggedEl = null;
        container.querySelectorAll('.metroBlk-tile').forEach(tile => {
            tile.addEventListener('dragstart', (e) => {
                draggedEl = tile;
                tile.classList.add('dragging');
                e.dataTransfer.effectAllowed = 'move';
            });
            tile.addEventListener('dragover', (e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                if (tile !== draggedEl) container.insertBefore(draggedEl, tile);
            });
            tile.addEventListener('dragend', () => {
                if (!draggedEl) return;
                draggedEl.classList.remove('dragging');
                draggedEl = null;
                persistMetroBlkOrderFromDom(container);
            });
        });

        // --- Touch/pen: Pointer Events ---
        let dragEl = null;
        let dragging = false;
        let startX = 0, startY = 0;

        function onPointerMove(e) {
            if (!dragEl) return;
            if (!dragging) {
                if (Math.abs(e.clientX - startX) < METRO_BLK_DRAG_THRESHOLD_PX && Math.abs(e.clientY - startY) < METRO_BLK_DRAG_THRESHOLD_PX) return;
                dragging = true;
                dragEl.classList.add('dragging');
            }
            e.preventDefault();
            const overTile = document.elementFromPoint(e.clientX, e.clientY)?.closest('.metroBlk-tile');
            if (overTile && overTile !== dragEl && container.contains(overTile)) container.insertBefore(dragEl, overTile);
        }

        function endDrag(e) {
            if (!dragEl) return;
            dragEl.releasePointerCapture?.(e.pointerId);
            document.removeEventListener('pointermove', onPointerMove);
            document.removeEventListener('pointerup', endDrag);
            document.removeEventListener('pointercancel', endDrag);
            const wasDragging = dragging;
            dragEl.classList.remove('dragging');
            dragEl = null;
            dragging = false;
            if (wasDragging) {
                persistMetroBlkOrderFromDom(container);
                // Read by the container's one click-guard listener (see below) - swallows the tap-to-
                // edit click that would otherwise follow this same gesture. Set here (after the drag
                // is actually over) rather than in onPointerMove: not every browser fires a `click` at
                // all after a drag that moved this far, so the click listener can't be trusted alone to
                // clear it again - the timeout is the fallback that guarantees a later, unrelated tap
                // never inherits a stuck flag from a drag whose click never came.
                container.dataset.suppressNextClick = '1';
                setTimeout(() => { delete container.dataset.suppressNextClick; }, 400);
            }
        }

        container.querySelectorAll('.metroBlk-tile').forEach(tile => {
            tile.addEventListener('pointerdown', (e) => {
                if (e.pointerType === 'mouse') return; // native dragstart/dragover/dragend own this gesture
                dragEl = tile;
                dragging = false;
                startX = e.clientX;
                startY = e.clientY;
                tile.setPointerCapture?.(e.pointerId);
                document.addEventListener('pointermove', onPointerMove, { passive: false });
                document.addEventListener('pointerup', endDrag);
                document.addEventListener('pointercancel', endDrag);
            });
        });

        // Added once, not on every render - `container` (#metroBlockTiles) itself is reused across
        // re-renders, only its tile children get replaced, so a listener added here every call would
        // otherwise pile up one per render.
        if (!container.dataset.dragClickGuardBound) {
            container.dataset.dragClickGuardBound = '1';
            container.addEventListener('click', (e) => {
                if (container.dataset.suppressNextClick === '1') {
                    delete container.dataset.suppressNextClick;
                    e.stopPropagation();
                    e.preventDefault();
                }
            }, true);
        }
    }

    async function persistMetroBlkOrderFromDom(container) {
        const ids = Array.from(container.querySelectorAll('.metroBlk-tile')).map(el => Number(el.dataset.id));
        const byId = new Map(metroBlkCurrentSetup.segments.map(s => [s.id, s]));
        try {
            await Promise.all(ids.map((id, idx) => {
                const current = byId.get(id);
                return current && current.orderIndex === idx ? null : API.metronomeBlocks.segments.update(id, { orderIndex: idx });
            }).filter(Boolean));
            await reloadMetroBlkSetup();
        } catch (error) {
            showWarningToast('Error updating order: ' + error.message);
            renderMetroBlockTiles();
        }
    }

    // --- Segment (block) edit modal ---
    // Whether the modal is currently editing THE lead-in (opened via openMetroLeadInModal) rather
    // than a regular block (openMetroSegmentModal) - controls which field groups show at all, see
    // syncMetroSegFieldVisibility.
    let metroSegEditingLeadIn = false;
    // "public:<id>" / "custom:<id>" of whichever time signature is currently chosen - the source of
    // truth now that the picker is a popup rather than a native <select> with its own .value.
    let metroSegTimeSigValue = null;

    function metroSegTimeSigLabelFor(value) {
        if (!value) return '';
        const [type, id] = value.split(':');
        const list = type === 'public' ? metroBlkTimeSigCache.public : metroBlkTimeSigCache.custom;
        const found = list.find(t => t.id === Number(id));
        return found ? found.label : '';
    }
    function renderMetroSegTimeSigBtn() {
        const el = document.getElementById('metroSegTimeSigBtnLabel');
        if (el) el.innerText = metroSegTimeSigLabelFor(metroSegTimeSigValue) || 'Choose…';
    }
    // Columns grouped by denominator, numerators increasing down each column (whatever's actually
    // in the catalog - not assumed to be a complete 1..N run). Custom signatures slot into the same
    // column as any public one sharing their denominator, tagged with the dashed .custom style.
    function renderMetroSegTimeSigPicker() {
        const el = document.getElementById('metroSegTimeSigColumns');
        if (!el) return;
        const all = [
            ...metroBlkTimeSigCache.public.map(t => ({ value: `public:${t.id}`, numerator: t.numerator, denominator: t.denominator, isCustom: false })),
            ...metroBlkTimeSigCache.custom.map(t => ({ value: `custom:${t.id}`, numerator: t.numerator, denominator: t.denominator, isCustom: true }))
        ];
        const byDenom = {};
        all.forEach(t => { (byDenom[t.denominator] = byDenom[t.denominator] || []).push(t); });
        const denoms = Object.keys(byDenom).map(Number).sort((a, b) => a - b);
        el.innerHTML = denoms.map(d => {
            const opts = byDenom[d].sort((a, b) => a.numerator - b.numerator);
            return `<div class="metroBlk-timesig-col">
                <div class="metroBlk-timesig-col-head">/${d}</div>
                ${opts.map(o => `<button type="button" class="metroBlk-timesig-opt${o.isCustom ? ' custom' : ''}${o.value === metroSegTimeSigValue ? ' selected' : ''}" data-value="${o.value}">${o.numerator}</button>`).join('')}
            </div>`;
        }).join('');
        el.querySelectorAll('.metroBlk-timesig-opt').forEach(btn => {
            btn.addEventListener('click', () => selectMetroSegTimeSig(btn.dataset.value));
        });
    }
    // Picking a real signature applies immediately and closes, same as the note-value picker - no
    // separate "apply" step. The [x] is the only way to close without changing anything.
    function selectMetroSegTimeSig(value) {
        metroSegTimeSigValue = value;
        renderMetroSegTimeSigBtn();
        refreshMetroSegBpmDisplay();
        document.getElementById('metroSegTimeSigModal').style.display = 'none';
    }
    document.getElementById('metroSegTimeSigBtn')?.addEventListener('click', () => {
        renderMetroSegTimeSigPicker();
        document.getElementById('metroSegCustomSigInputs').classList.add('hidden-group');
        renderMetroSegCustomSigManageList();
        document.getElementById('metroSegTimeSigModal').style.display = 'flex';
    });
    document.getElementById('metroSegTimeSigCustomToggle')?.addEventListener('click', () => {
        document.getElementById('metroSegCustomSigInputs').classList.toggle('hidden-group');
    });

    // "Your custom time signatures" - every one the account has, active or archived, with how many
    // blocks (across every setup) actually use it. Zero usage -> can delete outright; still in use
    // -> archive instead (stays valid for whatever already references it, just stops being offered
    // for a new block). Only shown at all once there's at least one.
    async function renderMetroSegCustomSigManageList() {
        const section = document.getElementById('metroSegCustomSigManageSection');
        const list = document.getElementById('metroSegCustomSigManageList');
        if (!section || !list) return;
        try {
            const custom = await API.metronomeBlocks.timeSignatures.listCustomWithUsage();
            section.classList.toggle('hidden-group', !custom.length);
            list.innerHTML = custom.map(t => {
                const usageText = t.usageCount === 0 ? 'Not used' : `Used in ${t.usageCount} block${t.usageCount === 1 ? '' : 's'}`;
                const archivedTag = t.active ? '' : ' &middot; archived';
                let actionHtml = '';
                if (t.usageCount === 0) {
                    actionHtml = `<button class="btn-icon-delete" aria-label="Delete ${escapeHtml(t.label)}" onclick="deleteMetroSegCustomTimeSig(${t.id})"><span class="material-symbols-outlined">delete</span></button>`;
                } else if (t.active) {
                    actionHtml = `<button class="btn-edit" style="width:auto; padding:6px 12px;" onclick="archiveMetroSegCustomTimeSig(${t.id})">Archive</button>`;
                }
                return `<div class="history-item" style="align-items:center;">
                    <div style="flex-grow:1;"><strong>${escapeHtml(t.label)}</strong>${archivedTag}<div style="font-size:0.85rem; color:#888;">${usageText}</div></div>
                    ${actionHtml}
                </div>`;
            }).join('');
        } catch (error) {
            showWarningToast('Error loading custom time signatures: ' + error.message);
        }
    }

    async function refreshMetroSegTimeSigEverywhere() {
        await loadMetroBlkTimeSignatures();
        renderMetroSegTimeSigPicker();
        renderMetroSegCustomSigManageList();
    }

    window.deleteMetroSegCustomTimeSig = function(id) {
        showConfirmModal('Delete time signature', 'Delete this custom time signature?', async () => {
            try {
                await API.metronomeBlocks.timeSignatures.deleteCustom(id);
                showSuccessToast('Deleted');
                await refreshMetroSegTimeSigEverywhere();
            } catch (error) {
                showWarningToast('Error: ' + error.message);
            }
        });
    }

    window.archiveMetroSegCustomTimeSig = function(id) {
        showConfirmModal('Archive time signature', 'Archive this time signature? It stays valid for blocks that already use it, but won’t be offered for new ones.', async () => {
            try {
                await API.metronomeBlocks.timeSignatures.archiveCustom(id);
                showSuccessToast('Archived');
                await refreshMetroSegTimeSigEverywhere();
            } catch (error) {
                showWarningToast('Error: ' + error.message);
            }
        }, false);
    }

    // Controls which field groups the shared modal shows - a regular block never sees the lead-in
    // length toggle; the lead-in never sees time signature/bpm at all (it inherits both from the
    // first regular block - see metroBlkEffectiveBlock).
    function syncMetroSegFieldVisibility() {
        const isPartial = metroSegEditingLeadIn && document.getElementById('metroSegLeadInPartial').checked;
        document.getElementById('metroSegLeadInKindGroup').classList.toggle('hidden-group', !metroSegEditingLeadIn);
        document.getElementById('metroSegRepeatLeadInGroup').classList.toggle('hidden-group', !metroSegEditingLeadIn);
        document.getElementById('metroSegQuietSecondsGroup').classList.toggle('hidden-group', !metroSegEditingLeadIn);
        document.getElementById('metroSegTimeSigGroup').classList.toggle('hidden-group', metroSegEditingLeadIn);
        document.getElementById('metroSegBpmGroup').classList.toggle('hidden-group', metroSegEditingLeadIn);
        document.getElementById('metroSegBarCountGroup').classList.toggle('hidden-group', isPartial);
        document.getElementById('metroSegPickupBeatsGroup').classList.toggle('hidden-group', !isPartial);
    }
    document.getElementById('metroSegLeadInWhole')?.addEventListener('change', syncMetroSegFieldVisibility);
    document.getElementById('metroSegLeadInPartial')?.addEventListener('change', syncMetroSegFieldVisibility);

    // --- Target BPM: stepper + slider (same pattern as the single-bar metronome's own target-speed
    // control - METRO_MIN_BPM/METRO_MAX_BPM/METRO_SLIDER_TIERS/metroBestFitTier are all already
    // generic, value-agnostic helpers from that tool, reused here rather than redefined). ---
    let metroSegBpm = 120;
    let metroSegBpmSliderMax = 200;

    function metroSegBpmStepTier(value) {
        const idx = METRO_SLIDER_TIERS.indexOf(metroSegBpmSliderMax);
        if (idx < METRO_SLIDER_TIERS.length - 1 && value >= METRO_SLIDER_TIERS[idx]) {
            metroSegBpmSliderMax = METRO_SLIDER_TIERS[idx + 1];
        } else if (idx > 0 && value < METRO_SLIDER_TIERS[idx - 1]) {
            metroSegBpmSliderMax = METRO_SLIDER_TIERS[idx - 1];
        }
    }
    // The slider/stepper/readout all operate on the DISPLAYED "note = bpm" number (e.g. the
    // crotchet-bpm), not the block's own raw beat-clicks-per-minute directly - see
    // metroSegNoteFraction/metroSegSelectedDenominator below for the conversion. metroSegBpm itself
    // stays the single source of truth for the actual tempo (and what gets saved).
    function metroSegDisplayedBpm() {
        return metroSegBpm / (metroSegNoteFraction() * metroSegSelectedDenominator());
    }
    function renderMetroSegBpmSlider() {
        const track = document.getElementById('metroSegBpmSliderTrack');
        if (!track) return;
        const displayed = Math.round(metroSegDisplayedBpm());
        const pct = ((displayed - METRO_MIN_BPM) / (metroSegBpmSliderMax - METRO_MIN_BPM)) * 100;
        document.getElementById('metroSegBpmSliderFill').style.width = `${pct}%`;
        const thumb = document.getElementById('metroSegBpmSliderThumb');
        thumb.style.left = `${pct}%`;
        thumb.setAttribute('aria-valuenow', displayed);
        thumb.setAttribute('aria-valuemax', metroSegBpmSliderMax);
        document.getElementById('metroSegBpmSliderMaxLbl').innerText = metroSegBpmSliderMax;
        document.getElementById('metroSegBpmValue').innerText = displayed;
    }
    // Sets the raw block bpm directly (loading an existing block, or after a note-value conversion)
    // and re-renders the display fresh against whatever note/time-signature is current.
    function setMetroSegBpm(rawValue) {
        metroSegBpm = Math.max(1, Math.round(rawValue));
        refreshMetroSegBpmDisplay();
    }
    // Re-renders the "note = bpm" display from the current metroSegBpm - call after the note-type
    // or time-signature selection changes, since either changes what the displayed number means
    // without the underlying tempo itself changing.
    function refreshMetroSegBpmDisplay() {
        metroSegBpmSliderMax = metroBestFitTier(Math.round(metroSegDisplayedBpm()));
        renderMetroSegBpmSlider();
    }
    // User-driven edits (stepper/slider) act on the DISPLAYED number and convert back to the raw
    // block bpm that's actually saved/played.
    function setMetroSegBpmFromDisplayed(displayedValue, opts = {}) {
        const clamped = Math.round(Math.min(METRO_MAX_BPM, Math.max(METRO_MIN_BPM, displayedValue)));
        if (opts.dragging) metroSegBpmStepTier(clamped); else metroSegBpmSliderMax = metroBestFitTier(clamped);
        metroSegBpm = Math.round(clamped * metroSegNoteFraction() * metroSegSelectedDenominator());
        renderMetroSegBpmSlider();
    }

    // --- Number of bars: same stepper+slider shape as BPM above, and the same tiered-expansion
    // idea (50 to start, growing to 200 - a repeat count past 200 is vanishingly unlikely, but
    // there's no hard ceiling beyond that either, just no bigger tier to expand into). A lead-in gets
    // its own, much smaller starting tier (ML-93) - it's realistically 1-3 bars, so a max-50 scale
    // made those first few bars hard to land on precisely; still extends to 10 then all the way to 50
    // for the rare case that needs it, same shape as the regular-block tiers just starting smaller. ---
    const METRO_SEG_BARS_MIN = 1;
    const METRO_SEG_BARS_TIERS = [50, 200];
    const METRO_SEG_LEADIN_BARS_TIERS = [5, 10, 50];
    function metroSegBarsTiers() { return metroSegEditingLeadIn ? METRO_SEG_LEADIN_BARS_TIERS : METRO_SEG_BARS_TIERS; }
    let metroSegBarCount = 1;
    let metroSegBarsSliderMax = METRO_SEG_BARS_TIERS[0];

    function metroSegBarsBestFitTier(value) {
        const tiers = metroSegBarsTiers();
        for (const t of tiers) if (value <= t) return t;
        return tiers[tiers.length - 1];
    }
    function metroSegBarsStepTier(value) {
        const tiers = metroSegBarsTiers();
        const idx = tiers.indexOf(metroSegBarsSliderMax);
        if (idx === -1) { metroSegBarsSliderMax = metroSegBarsBestFitTier(value); return; }
        if (idx < tiers.length - 1 && value >= tiers[idx]) {
            metroSegBarsSliderMax = tiers[idx + 1];
        } else if (idx > 0 && value < tiers[idx - 1]) {
            metroSegBarsSliderMax = tiers[idx - 1];
        }
    }
    function renderMetroSegBarsSlider() {
        const track = document.getElementById('metroSegBarsSliderTrack');
        if (!track) return;
        const pct = ((metroSegBarCount - METRO_SEG_BARS_MIN) / (metroSegBarsSliderMax - METRO_SEG_BARS_MIN)) * 100;
        document.getElementById('metroSegBarsSliderFill').style.width = `${pct}%`;
        const thumb = document.getElementById('metroSegBarsSliderThumb');
        thumb.style.left = `${pct}%`;
        thumb.setAttribute('aria-valuenow', metroSegBarCount);
        thumb.setAttribute('aria-valuemax', metroSegBarsSliderMax);
        document.getElementById('metroSegBarsSliderMaxLbl').innerText = metroSegBarsSliderMax;
        document.getElementById('metroSegBarCount').innerText = metroSegBarCount;
    }
    function setMetroSegBarCount(value, opts = {}) {
        metroSegBarCount = Math.max(METRO_SEG_BARS_MIN, Math.round(value));
        if (opts.dragging) metroSegBarsStepTier(metroSegBarCount); else metroSegBarsSliderMax = metroSegBarsBestFitTier(metroSegBarCount);
        renderMetroSegBarsSlider();
    }

    // Tap = +-1, hold = repeats, accelerating to +-10 per step after 15 taps' worth - same feel as
    // the single-bar metronome's own BPM stepper (setupMetroBpmStepper), generalised here to take
    // any step-applying callback so both the BPM and bar-count controls above can share it.
    function setupHoldStepper(btnId, direction, applyStep) {
        const btn = document.getElementById(btnId);
        if (!btn) return;
        const REPEAT_MS = 100;
        const INITIAL_DELAY_MS = 400;
        const ACCELERATE_AFTER = 15;
        let repeatTimer = null;
        let startTimer = null;
        let unitStepsTaken = 0;

        function step() {
            applyStep((unitStepsTaken >= ACCELERATE_AFTER ? 10 : 1) * direction);
            if (unitStepsTaken < ACCELERATE_AFTER) unitStepsTaken++;
        }
        function begin(e) {
            e.preventDefault();
            step();
            startTimer = setTimeout(() => { repeatTimer = setInterval(step, REPEAT_MS); }, INITIAL_DELAY_MS);
        }
        function end() {
            clearTimeout(startTimer);
            clearInterval(repeatTimer);
            unitStepsTaken = 0;
        }
        btn.addEventListener('pointerdown', begin);
        btn.addEventListener('pointerup', end);
        btn.addEventListener('pointerleave', end);
        btn.addEventListener('pointercancel', end);
    }
    setupHoldStepper('metroSegBpmMinus', -1, (amount) => setMetroSegBpmFromDisplayed(Math.round(metroSegDisplayedBpm()) + amount));
    setupHoldStepper('metroSegBpmPlus', 1, (amount) => setMetroSegBpmFromDisplayed(Math.round(metroSegDisplayedBpm()) + amount));
    setupHoldStepper('metroSegBarsMinus', -1, (amount) => setMetroSegBarCount(metroSegBarCount + amount));
    setupHoldStepper('metroSegBarsPlus', 1, (amount) => setMetroSegBarCount(metroSegBarCount + amount));

    setupSliderInteraction(document.getElementById('metroSegBpmSliderTrack'), document.getElementById('metroSegBpmSliderThumb'), {
        onDragRatio: (ratio) => setMetroSegBpmFromDisplayed(METRO_MIN_BPM + ratio * (metroSegBpmSliderMax - METRO_MIN_BPM), { dragging: true }),
        onArrowStep: (dir) => setMetroSegBpmFromDisplayed(Math.round(metroSegDisplayedBpm()) + dir, { dragging: true })
    });
    setupSliderInteraction(document.getElementById('metroSegBarsSliderTrack'), document.getElementById('metroSegBarsSliderThumb'), {
        onDragRatio: (ratio) => setMetroSegBarCount(METRO_SEG_BARS_MIN + ratio * (metroSegBarsSliderMax - METRO_SEG_BARS_MIN), { dragging: true }),
        onArrowStep: (dir) => setMetroSegBarCount(metroSegBarCount + dir, { dragging: true })
    });
    makeSliderReadoutEditable('metroSegBpmValue', () => Math.round(metroSegDisplayedBpm()), (v) => setMetroSegBpmFromDisplayed(v), { label: 'Beats per minute', min: METRO_MIN_BPM, max: METRO_MAX_BPM });
    makeSliderReadoutEditable('metroSegBarCount', () => metroSegBarCount, (v) => setMetroSegBarCount(v), { label: 'Number of bars', min: METRO_SEG_BARS_MIN });

    // --- Note-value icons (real vector glyphs, not unicode musical symbols - see the CSS comment
    // on .metroBlk-note-picker for why). Fractions match the single-bar metronome's own "Set from
    // music" note-type list exactly (public/app.js's #metroNoteType options). ---
    const METRO_NOTE_TYPES = [
        { key: 'quaver', label: 'Quaver', fraction: 0.125 },
        { key: 'crotchet', label: 'Crotchet', fraction: 0.25 },
        { key: 'dotted-crotchet', label: 'Dotted crotchet', fraction: 0.375 },
        { key: 'minim', label: 'Minim', fraction: 0.5 },
        { key: 'semibreve', label: 'Semibreve', fraction: 1 }
    ];
    // One shared viewBox/layout across all five so they line up in a row regardless of whether a
    // given note has a stem/flag/dot - notehead centre and stem position are fixed constants.
    function metroNoteIconSvg(key) {
        const head = '<ellipse cx="13" cy="44" rx="7.5" ry="5.2" transform="rotate(-20 13 44)"';
        const stem = '<rect x="19" y="6" width="2.6" height="38" fill="currentColor"/>';
        switch (key) {
            case 'semibreve':
                return '<svg viewBox="0 0 32 56" class="metroBlk-note-svg"><ellipse cx="16" cy="28" rx="10" ry="6" fill="none" stroke="currentColor" stroke-width="3"/></svg>';
            case 'minim':
                return `<svg viewBox="0 0 32 56" class="metroBlk-note-svg">${head} fill="none" stroke="currentColor" stroke-width="2.6"/>${stem}</svg>`;
            case 'dotted-crotchet':
                return `<svg viewBox="0 0 32 56" class="metroBlk-note-svg">${head} fill="currentColor"/>${stem}<circle cx="27" cy="42" r="2.2" fill="currentColor"/></svg>`;
            case 'quaver':
                return `<svg viewBox="0 0 32 56" class="metroBlk-note-svg">${head} fill="currentColor"/>${stem}<path d="M21.6 6 C30 10 29 20 21 26" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/></svg>`;
            default: // crotchet
                return `<svg viewBox="0 0 32 56" class="metroBlk-note-svg">${head} fill="currentColor"/>${stem}</svg>`;
        }
    }

    let metroSegNoteSelected = 'crotchet';
    function metroSegNoteFraction() {
        const t = METRO_NOTE_TYPES.find(x => x.key === metroSegNoteSelected);
        return t ? t.fraction : 0.25;
    }
    // The note whose fraction matches this denominator exactly (e.g. quaver for x/8) - picking it as
    // the default means the displayed "note = bpm" number equals the block's own raw bpm the first
    // time a block is opened, with no surprise rescale, while still leaving it fully changeable.
    function metroSegDefaultNoteForDenominator(denominator) {
        if (denominator === 8) return 'quaver';
        if (denominator === 2) return 'minim';
        if (denominator === 1) return 'semibreve';
        return 'crotchet';
    }
    function renderMetroSegNoteSelectBtn() {
        const btn = document.getElementById('metroSegNoteSelectBtn');
        if (!btn) return;
        btn.innerHTML = metroNoteIconSvg(metroSegNoteSelected);
        const label = METRO_NOTE_TYPES.find(t => t.key === metroSegNoteSelected)?.label || '';
        btn.setAttribute('aria-label', `Note value: ${label}. Tap to change.`);
    }
    function renderMetroSegNotePicker() {
        const el = document.getElementById('metroSegNotePicker');
        if (!el) return;
        el.innerHTML = METRO_NOTE_TYPES.map(t => `
            <button type="button" class="metroBlk-note-btn${t.key === metroSegNoteSelected ? ' selected' : ''}" data-note="${t.key}" aria-label="${t.label}" aria-pressed="${t.key === metroSegNoteSelected}">
                ${metroNoteIconSvg(t.key)}
            </button>
        `).join('');
        el.querySelectorAll('.metroBlk-note-btn').forEach(btn => {
            // Picking a note relabels the same tempo (refreshMetroSegBpmDisplay keeps metroSegBpm
            // fixed) and closes straight away - no separate "apply" step needed.
            btn.addEventListener('click', () => {
                metroSegNoteSelected = btn.dataset.note;
                refreshMetroSegBpmDisplay();
                renderMetroSegNoteSelectBtn();
                document.getElementById('metroSegNoteModal').style.display = 'none';
            });
        });
    }

    // Looks up the currently-chosen time signature's denominator from the cached picker data (not
    // the DB) - this only ever runs while the segment modal is open, where that cache is already
    // loaded.
    function metroSegSelectedDenominator() {
        if (!metroSegTimeSigValue) return 4;
        const [sigType, sigId] = metroSegTimeSigValue.split(':');
        const list = sigType === 'public' ? metroBlkTimeSigCache.public : metroBlkTimeSigCache.custom;
        const found = list.find(t => t.id === Number(sigId));
        return found ? found.denominator : 4;
    }

    document.getElementById('metroSegNoteSelectBtn')?.addEventListener('click', () => {
        renderMetroSegNotePicker();
        document.getElementById('metroSegNoteModal').style.display = 'flex';
    });

    window.openMetroSegmentModal = function(segId = null) {
        const seg = segId ? metroBlkCurrentSetup.segments.find(s => s.id === Number(segId)) : null;
        // A brand-new block defaults to whatever the last block - immediately before the "+" tile -
        // is set to, rather than a fixed 4/4 @ 120bpm: a new block is usually a variation on the one
        // right before it, not an unrelated fresh start.
        const regularBlocks = metroBlkCurrentSetup.segments.filter(s => !s.isLeadIn);
        const lastRegular = regularBlocks[regularBlocks.length - 1];
        metroSegEditingLeadIn = false;

        document.getElementById('metroSegEditId').value = segId || '';
        document.getElementById('metroSegmentModalTitle').innerText = seg ? 'Edit block' : 'Add block';
        document.getElementById('metroSegDeleteBtn').innerText = 'Delete block';
        document.getElementById('metroSegOtherActionsSection').classList.toggle('hidden-group', !seg);
        document.getElementById('metroSegLeadInWhole').checked = true;
        document.getElementById('metroSegLeadInPartial').checked = false;
        setMetroSegBarCount(seg ? seg.barCount : 1);
        document.getElementById('metroSegPickupBeats').value = '';

        // Falls back to the first catalog entry only when there's no last block to copy from (an
        // empty setup) - the picker has no "unset" option of its own.
        metroSegTimeSigValue = seg
            ? (seg.timeSignatureId ? `public:${seg.timeSignatureId}` : `custom:${seg.accountTimeSignatureId}`)
            : lastRegular
                ? (lastRegular.timeSignatureId ? `public:${lastRegular.timeSignatureId}` : `custom:${lastRegular.accountTimeSignatureId}`)
                : (metroBlkTimeSigCache.public[0] ? `public:${metroBlkTimeSigCache.public[0].id}` : null);
        renderMetroSegTimeSigBtn();
        document.getElementById('metroSegCustomSigInputs').classList.add('hidden-group');
        document.getElementById('metroSegCustomNumerator').value = '';
        document.getElementById('metroSegCustomDenominator').value = '';

        metroSegNoteSelected = metroSegDefaultNoteForDenominator(metroSegSelectedDenominator());
        renderMetroSegNoteSelectBtn();
        setMetroSegBpm(seg ? seg.bpm : (lastRegular ? lastRegular.bpm : 120));

        syncMetroSegFieldVisibility();
        document.getElementById('metroSegmentModal').style.display = 'flex';
    }

    // The lead-in editor (ML-35 follow-up): a lead-in is now a single fixed slot that always plays
    // first and inherits its time signature/bpm from the first regular block (metroBlkEffectiveBlock
    // resolves that at display/playback time), rather than being an independently-timed segment you
    // could reorder or chain multiple of. The only thing left to configure here is its own length.
    // Originally ML-35 allowed chaining several independently-timed lead-in segments; that's been
    // dropped in favour of this single, fixed-position slot - see the linked Jira comment.
    window.openMetroLeadInModal = function(segId = null) {
        const leadIn = segId ? metroBlkCurrentSetup.segments.find(s => s.id === Number(segId)) : null;
        const firstRegular = metroBlkCurrentSetup.segments.find(s => !s.isLeadIn);
        if (!firstRegular) return showWarningToast('Add a regular block first, so the lead-in has a time signature and tempo to match.');

        metroSegEditingLeadIn = true;
        document.getElementById('metroSegEditId').value = segId || '';
        document.getElementById('metroSegmentModalTitle').innerText = 'Lead-in';
        document.getElementById('metroSegDeleteBtn').innerText = 'Delete lead-in';
        document.getElementById('metroSegOtherActionsSection').classList.toggle('hidden-group', !leadIn);
        document.getElementById('metroSegLeadInWhole').checked = !leadIn || !leadIn.pickupBeats;
        document.getElementById('metroSegLeadInPartial').checked = !!(leadIn && leadIn.pickupBeats);
        document.getElementById('metroSegRepeatLeadInNo').checked = !leadIn || !leadIn.repeatLeadIn;
        document.getElementById('metroSegRepeatLeadInYes').checked = !!(leadIn && leadIn.repeatLeadIn);
        document.getElementById('metroSegQuietSeconds').value = leadIn ? (leadIn.quietSecondsBeforeLeadIn || 0) : 0;
        setMetroSegBarCount(leadIn ? leadIn.barCount : 1);
        document.getElementById('metroSegPickupBeats').value = leadIn && leadIn.pickupBeats ? leadIn.pickupBeats : '';

        syncMetroSegFieldVisibility();
        document.getElementById('metroSegmentModal').style.display = 'flex';
    }

    document.getElementById('metroSegCustomSigAddBtn')?.addEventListener('click', async () => {
        const numerator = Number(document.getElementById('metroSegCustomNumerator').value);
        const denominator = Number(document.getElementById('metroSegCustomDenominator').value);
        if (!numerator || !denominator) return showWarningToast('Enter both numbers.');
        try {
            const created = await API.metronomeBlocks.timeSignatures.createCustom(numerator, denominator);
            await loadMetroBlkTimeSignatures();
            selectMetroSegTimeSig(`custom:${created.id}`);
            document.getElementById('metroSegCustomNumerator').value = '';
            document.getElementById('metroSegCustomDenominator').value = '';
            showSuccessToast(`Added ${numerator}/${denominator}`);
        } catch (error) {
            showWarningToast('Error adding time signature: ' + error.message);
        }
    });

    document.getElementById('metroSegSaveBtn')?.addEventListener('click', async () => {
        const id = document.getElementById('metroSegEditId').value;
        const isPartial = metroSegEditingLeadIn && document.getElementById('metroSegLeadInPartial').checked;

        let data;
        if (metroSegEditingLeadIn) {
            const firstRegular = metroBlkCurrentSetup.segments.find(s => !s.isLeadIn);
            if (!firstRegular) return showWarningToast('Add a regular block first.');
            data = {
                isLeadIn: true,
                repeatLeadIn: document.getElementById('metroSegRepeatLeadInYes').checked,
                quietSecondsBeforeLeadIn: Math.max(0, Number(document.getElementById('metroSegQuietSeconds').value) || 0),
                bpm: firstRegular.bpm,
                timeSignatureId: firstRegular.timeSignatureId,
                accountTimeSignatureId: firstRegular.accountTimeSignatureId
            };
        } else {
            if (!metroSegTimeSigValue) return showWarningToast('Choose a time signature.');
            const [sigType, sigId] = metroSegTimeSigValue.split(':');
            data = {
                isLeadIn: false,
                bpm: metroSegBpm,
                timeSignatureId: sigType === 'public' ? Number(sigId) : null,
                accountTimeSignatureId: sigType === 'custom' ? Number(sigId) : null
            };
        }

        if (isPartial) {
            const pickupBeats = Number(document.getElementById('metroSegPickupBeats').value);
            if (!pickupBeats || pickupBeats <= 0) return showWarningToast('Enter how many beats to play.');
            data.pickupBeats = pickupBeats;
            data.barCount = 1;
        } else {
            data.barCount = metroSegBarCount;
            data.pickupBeats = null;
        }

        const btn = document.getElementById('metroSegSaveBtn');
        btn.innerText = 'Saving...';
        btn.disabled = true;
        try {
            if (id) await API.metronomeBlocks.segments.update(id, data);
            else await API.metronomeBlocks.segments.create(metroBlkCurrentSetup.id, data);
            document.getElementById('metroSegmentModal').style.display = 'none';
            await reloadMetroBlkSetup();
            showSuccessToast('Saved');
        } catch (error) {
            showWarningToast('Error: ' + error.message);
        } finally {
            btn.innerText = 'Save';
            btn.disabled = false;
        }
    });

    document.getElementById('metroSegDeleteBtn')?.addEventListener('click', () => {
        const id = document.getElementById('metroSegEditId').value;
        if (!id) return;
        showConfirmModal('Delete block', 'Delete this block?', async () => {
            try {
                await API.metronomeBlocks.segments.delete(id);
                document.getElementById('metroSegmentModal').style.display = 'none';
                await reloadMetroBlkSetup();
                showSuccessToast('Block deleted');
            } catch (error) {
                showWarningToast('Error: ' + error.message);
            }
        });
    });

    async function loadMetroBlkTimeSignatures() {
        try {
            metroBlkTimeSigCache = await API.metronomeBlocks.timeSignatures.list();
        } catch (error) {
            showWarningToast('Error loading time signatures: ' + error.message);
        }
    }

    // --- Sequencing ---
    // Tracks which `segments` array the play queue was last built from - `reloadMetroBlkSetup`
    // always produces a brand-new array (even a same-order reload), so comparing by reference is
    // enough to tell "the blocks changed since the queue was built" from "nothing changed, just
    // re-rendering" without needing a separate dirty flag.
    let metroBlkPlayQueueSourceSegments = null;

    // Called whenever the builder might have moved on from what's currently loaded into the player -
    // after every block edit/reorder, on entering the view, and as a last-resort check right before
    // Play. Deliberately skipped while actually playing (edits made in the background while a
    // sequence is sounding shouldn't yank the tempo/blocks out from under it); pausing or stopping
    // both count as safe points to pick up the latest blocks.
    function refreshMetroBlkQueueIfStale() {
        if (!metroBlkCurrentSetup || metroBlkPlayer.isPlaying()) return;
        if (metroBlkPlayQueueSourceSegments === metroBlkCurrentSetup.segments) return;
        buildMetroBlkPlayQueue();
        renderMetroBlkRows();
    }
    // Subdivide is a playback-only overlay (like speed%), not per-block data - one setting applies
    // across the whole sequence rather than being stored per segment. The lead-in never subdivides
    // regardless of that setting, though - it's too short for sub-beats to mean anything, and they'd
    // just be noise leading into the actual first beat.
    let metroBlkSubdivisionFactor = 1;

    function metroBlkEffectiveSubFactor(block) {
        return (block && block.isLeadIn) ? 1 : Math.max(1, metroBlkSubdivisionFactor);
    }

    function applyMetroBlkToPlayer(block) {
        metroBlkPlayer.setConductorBpm(block.bpm);
        metroBlkPlayer.setConductorBeatsPerBar(block.numerator); // denominator out of scope for ML-35
        metroBlkPlayer.setNotesPerBeat(1);
        metroBlkPlayer.setSubdivisionFactor(metroBlkEffectiveSubFactor(block));
        // A distinct, lower-pitched click while the lead-in plays, so it's obviously not "real" beat
        // 1 yet even before you've learned to listen for the count.
        metroBlkPlayer.setLowPitch(!!block.isLeadIn);
    }

    // A partial lead-in starts on the tail end of the bar (see greyOutSkippedDots) - everywhere a
    // block boundary would otherwise call resetToBarStart(), this picks the right starting beat
    // instead so the click and the dots agree on where "beat 1 of the lead-in" actually is. Scaled
    // by the subdivide factor since clickIndex counts sub-clicks, not conductor beats, once
    // subdivision is more than 1 (never for the lead-in itself - see metroBlkEffectiveSubFactor).
    function metroBlkRealignPlayer(block) {
        if (block.pickupBeats) metroBlkPlayer.setBeatIndex((block.numerator - block.pickupBeats) * metroBlkEffectiveSubFactor(block));
        else metroBlkPlayer.resetToBarStart();

        // Quiet space before the lead-in (re)starts (ML-92) - only meaningful when landing on the
        // lead-in itself. Two cases: already playing (a loop-back mid-sequence, repeatLeadIn on) can
        // push the next click back immediately via delayNextClick; not yet playing (the very first
        // realign, before playMetroBlk's own play() call exists) has no scheduled click to push back
        // yet, so the seconds are stashed and consumed by playMetroBlk's leadingSilenceSeconds instead.
        if (block.isLeadIn && block.quietSecondsBeforeLeadIn) {
            metroBlkQuietGapActive = true;
            if (metroBlkPlayer.isPlaying()) metroBlkPlayer.delayNextClick(block.quietSecondsBeforeLeadIn);
            else metroBlkPendingLeadInSilence = block.quietSecondsBeforeLeadIn;
        } else {
            metroBlkQuietGapActive = false;
            metroBlkPendingLeadInSilence = 0;
        }
    }

    function setMetroBlkSubdivision(v) {
        metroBlkSubdivisionFactor = v;
        document.getElementById('metroBlkSubdivideLbl').innerText = metroSubdivideLabel(v);
        // "/ beat" only means anything once there's an actual number of sub-beats to qualify.
        document.getElementById('metroBlkSubdivideUnit')?.classList.toggle('hidden-group', v <= 1);
        // Re-derive rather than setting v directly - if the lead-in is what's currently playing, it
        // stays un-subdivided regardless of what was just picked.
        const currentBlock = metroBlkPlayQueue.length ? metroBlkEffectiveBlock(metroBlkPlayQueue[metroBlkPlayIndex], metroBlkPlayQueue) : null;
        metroBlkPlayer.setSubdivisionFactor(currentBlock ? metroBlkEffectiveSubFactor(currentBlock) : v);
        renderMetroBlkRows();
    }

    function openMetroBlkSubdividePicker() {
        openMetroPicker({
            modalId: 'metroSubdivideModal', optionsId: 'metroSubdivideOptions',
            customEntryId: 'metroSubdivideCustomEntry', customValueId: 'metroSubdivideCustomValue',
            cancelBtnId: 'metroSubdivideCancelBtn', saveBtnId: 'metroSubdivideSaveBtn',
            values: [1, 2, 3, 4], currentValue: metroBlkSubdivisionFactor,
            labelFor: v => metroSubdivideLabel(v),
            customLabelFor: v => `${v} per beat`,
            customMin: 1, customMax: METRO_CUSTOM_MAX,
            customDefault: 5,
            onSave: (v) => setMetroBlkSubdivision(v)
        });
    }
    document.getElementById('metroBlkSubdivideBtn')?.addEventListener('click', openMetroBlkSubdividePicker);

    function buildMetroBlkPlayQueue() {
        metroBlkPlayQueue = metroBlkCurrentSetup.segments;
        metroBlkPlayQueueSourceSegments = metroBlkCurrentSetup.segments;
        // Skips past the lead-in on every loop-back by default (it played once already, right at the
        // very start) - unless it's been marked repeatLeadIn (ML-85), in which case the loop-back point
        // IS the lead-in itself, so it plays again before every repeat rather than only once.
        const leadIn = metroBlkPlayQueue.find(s => s.isLeadIn);
        metroBlkLoopBackIndex = (leadIn && leadIn.repeatLeadIn) ? 0 : metroBlkPlayQueue.filter(s => s.isLeadIn).length;
        metroBlkPlayIndex = 0;
        metroBlkBeatsPlayedInBlock = 0;
        metroBlkClicksPlayedInBlock = 0;
        if (metroBlkPlayQueue.length) {
            const block = metroBlkEffectiveBlock(metroBlkPlayQueue[0], metroBlkPlayQueue);
            applyMetroBlkToPlayer(block);
            metroBlkRealignPlayer(block);
        }
    }

    function advanceMetroBlk() {
        metroBlkPlayIndex++;
        if (metroBlkPlayIndex >= metroBlkPlayQueue.length) metroBlkPlayIndex = metroBlkLoopBackIndex;
        metroBlkBeatsPlayedInBlock = 0;
        metroBlkClicksPlayedInBlock = 0;
        const block = metroBlkEffectiveBlock(metroBlkPlayQueue[metroBlkPlayIndex], metroBlkPlayQueue);
        applyMetroBlkToPlayer(block);
        metroBlkRealignPlayer(block);
        // Deferred, not immediate: the final beat's flash (just triggered in onMetroBlkBeat, right
        // before this runs) would otherwise never get a chance to paint - renderMetroBlkRows tears
        // the dots down and rebuilds them synchronously in the same tick, before the browser draws
        // a frame with 'lit' applied. Waiting past flashTierDot's own 120ms removal timeout means the
        // flash has already been visible by the time the rebuild happens.
        setTimeout(renderMetroBlkRows, 130);
    }

    function onMetroBlkBeat(beatInfo) {
        // The quiet gap (ML-92 follow-up) ends the instant a real click actually fires - this is
        // always that first click, since nothing else calls onMetroBlkBeat while the gap is still
        // running (the scheduler itself is what's been silently delayed). Re-render before flashing so
        // the dots are back to their normal look for flashTierDot's 'lit' class to land on.
        if (metroBlkQuietGapActive) {
            metroBlkQuietGapActive = false;
            renderMetroBlkRows();
        }

        // One dot per base click now (main beats AND sub-beats, mirroring the single-bar tool's
        // metroNotesRow) - flash by the raw click-in-bar index, which lines up 1:1 with the dots
        // buildMetroDotRow actually created.
        flashTierDot('metroBlkRow0Dots', beatInfo.clickIndexInBar);
        flashTierDot('metroBlkMiniDots', beatInfo.clickIndexInBar);

        const block = metroBlkEffectiveBlock(metroBlkPlayQueue[metroBlkPlayIndex], metroBlkPlayQueue);
        if (!block) return;
        const subFactor = metroBlkEffectiveSubFactor(block);

        // Advancing has to wait for every click of the target's last beat, sub-beats included, not
        // just that beat's own main click - a 4/4 bar with subdivide on isn't actually finished the
        // instant beat 4 sounds, there's still beat 4's trailing sub-beat(s) to play before the bar
        // genuinely ends. Counting conductor beats alone (as before) advanced - and reconfigured the
        // player for the next block - one sub-beat too early, silently dropping that final click.
        metroBlkClicksPlayedInBlock++;
        const targetBeats = block.pickupBeats || (block.barCount * block.numerator);
        const targetClicks = targetBeats * subFactor;
        const isFinalClickOfBlock = metroBlkClicksPlayedInBlock >= targetClicks;

        if (beatInfo.isConductorBeat) {
            const totalBaseClicks = beatInfo.conductorBeatsPerBar * subFactor;
            const nextIndex = (beatInfo.conductorBeatIndex + 1) % beatInfo.conductorBeatsPerBar;
            // The row's dots are laid out over totalBaseClicks+1 slots (see renderMetroBlkRows) so
            // the track's one-slot extension past the last dot doesn't throw the whole row off-centre -
            // the scroll-follow math has to use that same basis or it drifts out of step with where the
            // dots actually are. The mini row shares this same basis now too (ML-94 - it's the same
            // "now" bar formatting, not a simplified stand-in).
            const trackUnit = 100 / (totalBaseClicks + 1);
            const trackLeftPct = (k) => k * trackUnit + trackUnit / 2;
            metroScrollFollow('metroBlkRow0Viewport', 'metroBlkRow0Content', trackLeftPct(beatInfo.conductorBeatIndex * subFactor), trackLeftPct(nextIndex * subFactor), beatInfo.secondsPerConductorBeat);
            metroScrollFollow('metroBlkMiniViewport', 'metroBlkMiniContent', trackLeftPct(beatInfo.conductorBeatIndex * subFactor), trackLeftPct(nextIndex * subFactor), beatInfo.secondsPerConductorBeat);

            metroBlkBeatsPlayedInBlock++;
            // Refreshes the "x of y" progress in place (label text only, no dot rebuild) - every beat
            // for a partial lead-in (pickupBeats is usually small), only at each bar boundary for a
            // repeating whole-bar block, so a long bar doesn't churn the label on every single beat.
            const justCompletedABar = !block.pickupBeats && metroBlkBeatsPlayedInBlock % block.numerator === 0;
            if (block.pickupBeats || justCompletedABar) {
                const freshLabel = metroBlkBlockLabel(block, metroBlkBeatsPlayedInBlock);
                const labelEl = document.getElementById('metroBlkRow0Label');
                if (labelEl) labelEl.innerText = freshLabel;
                const miniLabel = document.getElementById('metroBlkMiniLabel');
                if (miniLabel) miniLabel.innerText = freshLabel;
            }
        }

        if (isFinalClickOfBlock) advanceMetroBlk();
    }
    metroBlkPlayer.onBeat(onMetroBlkBeat);

    // --- Multi-row "now + upcoming" display ---
    // Takes the total dot count (beats * subdivide factor), not just the beat count - mirrors
    // metroTierGeometry's leftPct on the single-bar tool, now that subdivide is real here too.
    function metroBlkLeftPctFn(totalBaseClicks) {
        const unit = 100 / totalBaseClicks;
        return (k) => k * unit + unit / 2;
    }

    // Draws a line connecting the first dot to the last, reusing each dot's own already-computed
    // `left` (a padding-aware calc() from metroLeftStyle) rather than re-deriving the geometry -
    // keeps the track pinned exactly to the dots regardless of row width or edge padding.
    // Extends one further slot past the last dot (endLeftStyle, the same per-click spacing as
    // everywhere else in the row) with a small vertical tick, rather than stopping dead at the last
    // dot - that "click" of time between the last beat and looping back to the first still happens,
    // so the line shouldn't look like it just runs out.
    function connectMetroBlkDotsWithTrack(rowId, endLeftStyle) {
        const row = document.getElementById(rowId);
        if (!row) return;
        let track = row.querySelector('.metroBlk-row-track');
        if (!track) {
            track = document.createElement('div');
            track.className = 'metroBlk-row-track';
            row.insertBefore(track, row.firstChild);
        }
        let endTick = row.querySelector('.metroBlk-row-track-end');
        if (!endTick) {
            endTick = document.createElement('div');
            endTick.className = 'metroBlk-row-track-end';
            row.insertBefore(endTick, row.firstChild);
        }
        const dots = row.querySelectorAll('.metro-dot');
        if (dots.length < 2) { track.style.display = 'none'; endTick.style.display = 'none'; return; }
        track.style.display = 'block';
        endTick.style.display = 'block';
        track.style.left = dots[0].style.left;
        track.style.right = `calc(100% - (${endLeftStyle}))`;
        endTick.style.left = endLeftStyle;
    }

    // Wraps past the end of the queue back to metroBlkLoopBackIndex, matching playback's own loop-back
    // behaviour, so the "upcoming" preview rows always show what will genuinely play next - that's back
    // into the lead-in itself when it's marked repeatLeadIn (ML-85), not just the loop zone after it.
    function wrapMetroBlkIndex(i) {
        const n = metroBlkPlayQueue.length;
        if (i < n) return i;
        const loopLen = n - metroBlkLoopBackIndex;
        if (loopLen <= 0) return n - 1;
        return metroBlkLoopBackIndex + ((i - n) % loopLen);
    }

    // A partial lead-in plays the LAST pickupBeats beats of the bar, not the first - a pickup/
    // anacrusis leads into the downbeat that follows, so on a 4-beat bar with a 1-beat pickup it's
    // beat 4 that sounds, not beat 1. Those unused leading beats are never actually scheduled (see
    // metroBlkLeadInStartIndex/onMetroBlkBeat), so this just makes that visually obvious upfront
    // rather than the dot simply never happening to light up.
    function greyOutSkippedDots(rowId, block, subFactor) {
        if (!block || !block.pickupBeats) return;
        const skippedCount = (block.numerator - block.pickupBeats) * subFactor;
        document.querySelectorAll(`#${rowId} .metro-dot`).forEach((dot, idx) => {
            dot.classList.toggle('metroBlk-dot-skipped', idx < skippedCount);
        });
    }

    // Now + next only (no second "upcoming" row) - keeps the screen simpler without losing much,
    // since the next block is already visible before the current one finishes.
    function renderMetroBlkRows() {
        if (!metroBlkPlayQueue.length) return;
        for (let slot = 0; slot < 2; slot++) {
            const idx = wrapMetroBlkIndex(metroBlkPlayIndex + slot);
            const block = metroBlkEffectiveBlock(metroBlkPlayQueue[idx], metroBlkPlayQueue);
            const subFactor = metroBlkEffectiveSubFactor(block);
            const label = block ? metroBlkBlockLabel(block, slot === 0 ? metroBlkBeatsPlayedInBlock : undefined) : '';
            const labelEl = document.getElementById(`metroBlkRow${slot}Label`);
            if (labelEl) labelEl.innerText = label;

            const numerator = block ? block.numerator : 4;
            const totalBaseClicks = numerator * subFactor;
            // The row's line extends one slot past the last dot (connectMetroBlkDotsWithTrack) -
            // laying the dots out over totalBaseClicks+1 slots, not totalBaseClicks, reserves room for
            // that extension so the dots-plus-line group centers as a whole instead of the dots alone
            // centering and the line poking out past the row's right edge. The mini row now uses this
            // exact same "now" bar formatting (ML-94), not a simplified stand-in, so it shares the
            // same basis rather than its own separate one.
            const trackLeftPct = metroBlkLeftPctFn(totalBaseClicks + 1);
            const endLeftStyle = metroLeftStyle(trackLeftPct(totalBaseClicks));
            buildMetroDotRow(`metroBlkRow${slot}Dots`, totalBaseClicks, subFactor, false, trackLeftPct);
            metroApplyDisplayWidth(`metroBlkRow${slot}Viewport`, `metroBlkRow${slot}Content`, totalBaseClicks + 1);
            connectMetroBlkDotsWithTrack(`metroBlkRow${slot}Dots`, endLeftStyle);
            greyOutSkippedDots(`metroBlkRow${slot}Dots`, block, subFactor);
            if (!metroBlkPlayer.isPlaying()) resetMetroScrollPosition(`metroBlkRow${slot}Content`);
            // Only the CURRENT block (slot 0) can ever be mid-quiet-gap (ML-92 follow-up) - the upcoming
            // preview (slot 1) never is, whatever it turns out to be. Also requires isPlaying(): sitting
            // on a not-yet-started lead-in (paused, or never played this session) isn't "during the
            // quiet space" in any meaningful sense yet, so it shouldn't pre-emptively grey out before
            // there's actually a gap counting down.
            const inQuietGap = slot === 0 && metroBlkQuietGapActive && metroBlkPlayer.isPlaying() && block && block.isLeadIn;
            document.getElementById(`metroBlkRow${slot}Content`)?.classList.toggle('metroBlk-quiet-gap', inQuietGap);

            if (slot === 0) {
                buildMetroDotRow('metroBlkMiniDots', totalBaseClicks, subFactor, false, trackLeftPct);
                metroApplyDisplayWidth('metroBlkMiniViewport', 'metroBlkMiniContent', totalBaseClicks + 1);
                connectMetroBlkDotsWithTrack('metroBlkMiniDots', endLeftStyle);
                greyOutSkippedDots('metroBlkMiniDots', block, subFactor);
                if (!metroBlkPlayer.isPlaying()) resetMetroScrollPosition('metroBlkMiniContent');
                document.getElementById('metroBlkMiniContent')?.classList.toggle('metroBlk-quiet-gap', inQuietGap);
                const miniLabel = document.getElementById('metroBlkMiniLabel');
                if (miniLabel) miniLabel.innerText = label || '-';
            }
        }
    }

    window.addEventListener('resize', () => {
        const view = document.getElementById('metroBuilderView');
        if (view && view.style.display !== 'none') renderMetroBlkRows();
    });

    // --- Transport ---
    function updateMetroBlkPlayIcon() {
        const playing = metroBlkPlayer.isPlaying();
        const icon = document.getElementById('metroBlkPlayIcon');
        if (icon) icon.innerText = playing ? 'pause' : 'play_arrow';
        const miniIcon = document.getElementById('metroBlkMiniPlayIcon');
        if (miniIcon) miniIcon.innerText = playing ? 'pause' : 'play_arrow';
    }

    function playMetroBlk() {
        // Last-resort safety net - normally already fresh via renderMetroBlockTiles, but this
        // catches it regardless of how playMetroBlk got called (e.g. from the mini bar on another
        // screen, where the builder's own render never ran).
        refreshMetroBlkQueueIfStale();
        if (!metroBlkPlayQueue.length) return showWarningToast('Add at least one block first.');
        // Consumed once (ML-92) - a plain resume from pause doesn't go through metroBlkRealignPlayer
        // again, so this is already back to 0 in that case and no spurious silence gets injected into
        // an in-progress lead-in count.
        metroBlkPlayer.play(metroBlkPendingLeadInSilence);
        metroBlkPendingLeadInSilence = 0;
        metroBlkMiniActive = true;
        updateMetroBlkPlayIcon();
        updateMetroBlocksMiniBarVisibility(viewStack[viewStack.length - 1]);
        // isPlaying() is already true synchronously at this point (play() sets it before its own
        // internal async audio setup resolves) - re-render now so a quiet gap (ML-92 follow-up) shows
        // greyed out from the moment playback actually starts, not just once the first click lands.
        renderMetroBlkRows();
    }

    function pauseMetroBlk() {
        metroBlkPlayer.pause();
        refreshMetroBlkQueueIfStale();
        updateMetroBlkPlayIcon();
    }

    // Close (ML-87): pauses if playing and drops the "active this session" flag, so the mini bar
    // disappears - the only way to dismiss it from another screen without navigating back to the
    // builder first. Position is left exactly where it was (same as a plain pause) rather than reset
    // to the start - Reset already owns that, this is purely about visibility.
    function closeMetroBlkMiniBar() {
        if (metroBlkPlayer.isPlaying()) metroBlkPlayer.pause();
        metroBlkMiniActive = false;
        updateMetroBlkPlayIcon();
        updateMetroBlocksMiniBarVisibility(viewStack[viewStack.length - 1]);
    }

    // Jumps back to the first block WITHOUT stopping - if it's currently playing it just keeps
    // playing from the top; if paused, it stays paused sitting at the top. Pause is what actually
    // silences it now; this button is purely about position.
    function resetMetroBlk() {
        refreshMetroBlkQueueIfStale();
        metroBlkPlayIndex = 0;
        metroBlkBeatsPlayedInBlock = 0;
        metroBlkClicksPlayedInBlock = 0;
        if (metroBlkPlayQueue.length) {
            const block = metroBlkEffectiveBlock(metroBlkPlayQueue[0], metroBlkPlayQueue);
            applyMetroBlkToPlayer(block);
            metroBlkRealignPlayer(block);
        }
        renderMetroBlkRows();
    }

    document.getElementById('metroBlkPlayBtn')?.addEventListener('click', () => {
        if (metroBlkPlayer.isPlaying()) pauseMetroBlk(); else playMetroBlk();
    });
    document.getElementById('metroBlkResetBtn')?.addEventListener('click', resetMetroBlk);
    document.getElementById('metroBlkMiniPlayBtn')?.addEventListener('click', () => {
        if (metroBlkPlayer.isPlaying()) pauseMetroBlk(); else playMetroBlk();
    });
    document.getElementById('metroBlkMiniResetBtn')?.addEventListener('click', resetMetroBlk);
    // Jumps back to the full builder screen to adjust the block setup itself (ML-94) - the mini bar
    // only ever mirrors playback, it was never meant to be where blocks get edited.
    document.getElementById('metroBlkMiniSettingsBtn')?.addEventListener('click', () => switchView('metroBuilderView'));
    document.getElementById('metroBlkMiniCloseBtn')?.addEventListener('click', closeMetroBlkMiniBar);

    // --- Playback speed (independent of any block's own bpm - the player already applies this
    // percentage on top of whatever bpm is currently loaded, same mechanism as the single-bar tool). ---
    const METRO_BLK_SPEED_STEP = 10;
    const METRO_BLK_SPEED_MIN = 25;
    const METRO_BLK_SPEED_MAX = 200;
    let metroBlkSpeedPercent = 100;

    function renderMetroBlkSpeedReadout() {
        const el = document.getElementById('metroBlkSpeedPct');
        if (el) el.innerText = `${metroBlkSpeedPercent}%`;
    }
    function setMetroBlkSpeedPercent(p) {
        metroBlkSpeedPercent = Math.min(METRO_BLK_SPEED_MAX, Math.max(METRO_BLK_SPEED_MIN, p));
        metroBlkPlayer.setSpeedPercent(metroBlkSpeedPercent);
        renderMetroBlkSpeedReadout();
    }
    document.getElementById('metroBlkSpeedMinus')?.addEventListener('click', () => setMetroBlkSpeedPercent(metroBlkSpeedPercent - METRO_BLK_SPEED_STEP));
    document.getElementById('metroBlkSpeedPlus')?.addEventListener('click', () => setMetroBlkSpeedPercent(metroBlkSpeedPercent + METRO_BLK_SPEED_STEP));
    renderMetroBlkSpeedReadout();

    // Shown whenever the sequence is active (playing or paused, not stopped) and the builder/play
    // screen itself isn't on-screen - called from switchView exactly like the single-bar tool's
    // updateMetroMiniBarVisibility.
    function updateMetroBlocksMiniBarVisibility(viewName) {
        const bar = document.getElementById('metroBlocksMiniBar');
        if (bar) bar.classList.toggle('hidden-group', !metroBlkMiniActive || viewName === 'metroBuilderView');
    }

    // ========================================
    // TUNER
    // ========================================
    const NOTE_NAMES_SHARP = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    const NOTE_NAMES_FLAT = ['C', 'D♭', 'D', 'E♭', 'E', 'F', 'G♭', 'G', 'A♭', 'A', 'B♭', 'B'];
    const A4_FREQ = 440;
    const A4_MIDI = 69;

    // written = concert + offset semitones (mod 12) - the standard band transposition conventions
    // (Bb: clarinet/trumpet/tenor sax..., Eb: alto/bari sax..., F: horn). Octave isn't tracked, only
    // the pitch class, since that's all a tuner readout needs.
    const TUNER_TRANSPOSITIONS = { C: 0, Bb: 2, Eb: 9, F: 7 };
    const TUNER_ZONE_CENTS = 15; // "in tune" green-zone half-width
    const TUNER_INSTRUMENT_DEFAULT_KEY = 'tunerInstrumentDefault';
    const TUNER_USE_FLATS_KEY = 'tunerUseFlats';

    function tunerFreqToMidi(freq) { return A4_MIDI + 12 * Math.log2(freq / A4_FREQ); }

    // Just the note letter/accidental - no octave number, per the tuner's simplified readout.
    function tunerMidiToName(midi) {
        const rounded = Math.round(midi);
        const useFlats = localStorage.getItem(TUNER_USE_FLATS_KEY) === 'true';
        const names = useFlats ? NOTE_NAMES_FLAT : NOTE_NAMES_SHARP;
        return names[((rounded % 12) + 12) % 12];
    }

    // Autocorrelation-based pitch detection (ACF2+ style): far more stable than zero-crossing for a
    // single monophonic instrument close to the mic. Returns -1 when the signal is too quiet to trust.
    function tunerAutoCorrelate(buf, sampleRate) {
        const SIZE = buf.length;
        let rms = 0;
        for (let i = 0; i < SIZE; i++) rms += buf[i] * buf[i];
        rms = Math.sqrt(rms / SIZE);
        if (rms < 0.01) return -1;

        let r1 = 0, r2 = SIZE - 1;
        const threshold = 0.2;
        for (let i = 0; i < SIZE / 2; i++) { if (Math.abs(buf[i]) < threshold) { r1 = i; break; } }
        for (let i = 1; i < SIZE / 2; i++) { if (Math.abs(buf[SIZE - i]) < threshold) { r2 = SIZE - i; break; } }

        const trimmed = buf.slice(r1, r2);
        const newSize = trimmed.length;
        if (newSize < 2) return -1;
        const c = new Array(newSize).fill(0);
        for (let lag = 0; lag < newSize; lag++) {
            for (let i = 0; i < newSize - lag; i++) c[lag] += trimmed[i] * trimmed[i + lag];
        }

        let d = 0;
        while (d < newSize - 1 && c[d] > c[d + 1]) d++;
        let maxVal = -1, maxPos = -1;
        for (let i = d; i < newSize; i++) {
            if (c[i] > maxVal) { maxVal = c[i]; maxPos = i; }
        }
        if (maxPos <= 0) return -1;

        // Parabolic interpolation around the peak for sub-sample precision.
        let T0 = maxPos;
        const x1 = c[T0 - 1] || 0, x2 = c[T0], x3 = c[T0 + 1] || 0;
        const a = (x1 + x3 - 2 * x2) / 2;
        const b = (x3 - x1) / 2;
        if (a) T0 = T0 - b / (2 * a);

        return T0 > 0 ? sampleRate / T0 : -1;
    }

    // Standalone pitch-detection engine, structured the same way as the metronome player above
    // (own audio graph, own lifecycle, exposes start/stop/onPitch) so it can be dropped into another
    // view later as an add-in without rewriting the mic/analysis plumbing.
    function createTunerEngine() {
        let audioCtx = null;
        let analyser = null;
        let micStream = null;
        let dataArray = null;
        let rafId = null;
        const listeners = [];

        function tick() {
            analyser.getFloatTimeDomainData(dataArray);
            const freq = tunerAutoCorrelate(dataArray, audioCtx.sampleRate);
            listeners.forEach(cb => cb(freq));
            rafId = requestAnimationFrame(tick);
        }

        return {
            async start() {
                if (audioCtx) return true;
                try {
                    micStream = await navigator.mediaDevices.getUserMedia({
                        audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false }
                    });
                } catch (err) {
                    return false;
                }
                const Ctx = window.AudioContext || window.webkitAudioContext;
                audioCtx = new Ctx();
                const source = audioCtx.createMediaStreamSource(micStream);
                analyser = audioCtx.createAnalyser();
                analyser.fftSize = 2048;
                dataArray = new Float32Array(analyser.fftSize);
                source.connect(analyser);
                tick();
                return true;
            },
            stop() {
                if (rafId) cancelAnimationFrame(rafId);
                rafId = null;
                if (micStream) micStream.getTracks().forEach(t => t.stop());
                micStream = null;
                if (audioCtx) audioCtx.close();
                audioCtx = null;
                analyser = null;
            },
            isActive() { return !!audioCtx; },
            onPitch(cb) { listeners.push(cb); }
        };
    }

    const tunerEngine = createTunerEngine();

    function updateTunerInstrumentLabel() {
        const instrument = document.getElementById('tunerInstrumentSelect').value;
        document.getElementById('tunerInstrumentLabel').innerText =
            instrument === 'C' ? 'Concert pitch (C)' : `${instrument} instrument`;
    }

    function renderTunerIdle() {
        document.getElementById('tunerNoteDisplay').innerText = '–';
        document.getElementById('tunerConcertDisplay').innerText = '–';
        document.getElementById('tunerNeedle').style.left = '50%';
        document.getElementById('tunerNeedle').classList.remove('in-tune');
        document.getElementById('tunerCard').classList.remove('in-tune');
    }

    function renderTunerPitch(freq) {
        if (!tunerEngine.isActive()) return; // stray frame from just before stop()
        if (!freq || freq < 0) {
            // No signal right now (gap between notes, breath, etc). Deliberately leave the note
            // display, needle and in-tune highlight showing whatever was last detected, rather than
            // resetting to the idle state - that reset only happens once, when the tuner first opens.
            document.getElementById('tunerStatus').innerText = 'Listening...';
            return;
        }
        document.getElementById('tunerStatus').innerText = '';

        const concertMidi = tunerFreqToMidi(freq);
        const nearestConcertMidi = Math.round(concertMidi);
        const centsOff = (concertMidi - nearestConcertMidi) * 100;

        const instrument = document.getElementById('tunerInstrumentSelect').value;
        const offset = TUNER_TRANSPOSITIONS[instrument] || 0;
        const writtenMidi = nearestConcertMidi + offset;

        document.getElementById('tunerNoteDisplay').innerText = tunerMidiToName(writtenMidi);
        document.getElementById('tunerConcertDisplay').innerText = tunerMidiToName(nearestConcertMidi);

        const clampedCents = Math.max(-50, Math.min(50, centsOff));
        const inTune = Math.abs(centsOff) <= TUNER_ZONE_CENTS;
        document.getElementById('tunerNeedle').style.left = `${50 + clampedCents}%`;
        document.getElementById('tunerNeedle').classList.toggle('in-tune', inTune);
        document.getElementById('tunerCard').classList.toggle('in-tune', inTune);
    }

    tunerEngine.onPitch(renderTunerPitch);

    // Both instrument pickers (this one on the Tuner page, and the one in Settings) read/write the
    // same stored value, so whichever you last touched is what comes back next time - it genuinely
    // varies by instrument, so there's no separate "default" to fall back to.
    document.getElementById('tunerInstrumentSelect')?.addEventListener('change', (e) => {
        localStorage.setItem(TUNER_INSTRUMENT_DEFAULT_KEY, e.target.value);
        updateTunerInstrumentLabel();
    });
    document.getElementById('tunerInstrumentSetting')?.addEventListener('change', (e) => {
        localStorage.setItem(TUNER_INSTRUMENT_DEFAULT_KEY, e.target.value);
    });
    document.getElementById('tunerUseFlatsToggle')?.addEventListener('change', (e) => {
        localStorage.setItem(TUNER_USE_FLATS_KEY, e.target.checked ? 'true' : 'false');
    });
    document.getElementById('tunerRetryBtn')?.addEventListener('click', startTuner);

    async function startTuner() {
        // Restore whichever instrument was last picked (here or in Settings) rather than a fixed default.
        document.getElementById('tunerInstrumentSelect').value = localStorage.getItem(TUNER_INSTRUMENT_DEFAULT_KEY) || 'C';
        updateTunerInstrumentLabel();
        renderTunerIdle();

        document.getElementById('tunerRetryBtn').classList.add('hidden-group');
        document.getElementById('tunerStatus').innerText = 'Requesting microphone access...';

        const ok = await tunerEngine.start();
        if (!ok) {
            document.getElementById('tunerStatus').innerText = 'Microphone access is needed for the tuner. Check your browser/site permissions and try again.';
            document.getElementById('tunerRetryBtn').classList.remove('hidden-group');
            return;
        }
        document.getElementById('tunerStatus').innerText = 'Listening...';
    }

    function stopTuner() {
        tunerEngine.stop();
    }

    // --- Metronome Blocks mini tuner ---
    // Shares the tunerEngine singleton above rather than running a second mic session - only one of
    // the full Tuner view / this mini widget is ever visible at a time, but they're independent
    // renderers subscribed to the same onPitch feed. Scoped entirely to metroBuilderView: opening it
    // elsewhere isn't possible, and navigating away from the builder always closes it (see
    // updateMetroBlkMiniTunerVisibility), same lifecycle as the full Tuner view itself.
    let metroBlkMiniTunerActive = false;
    // Which instrument the mini tuner is currently reading as - seeded from the persisted Settings
    // default each time it opens, but changing it here (ML-84) only ever updates this in-memory copy,
    // never localStorage: it's a "just for this session" override, not a new default.
    let metroBlkMiniTunerInstrument = 'C';

    // One big note only, for whichever instrument is currently selected (ML-84) - showing concert AND
    // instrument readings side by side left nothing to actually read the note against without already
    // knowing which column was which, and the two-column box kept changing width as note names came
    // and go. The instrument picker underneath shows "Concert" for C, or the instrument's own name.
    function renderMetroBlkMiniTunerIdle() {
        document.getElementById('metroBlkMiniTunerNoteBtn').innerText = '–';
        document.getElementById('metroBlkMiniTunerNeedle').style.left = '50%';
        document.getElementById('metroBlkMiniTunerNeedle').classList.remove('in-tune');
        document.getElementById('metroBlkMiniTuner').classList.remove('in-tune');
    }

    function renderMetroBlkMiniTunerPitch(freq) {
        if (!metroBlkMiniTunerActive || !freq || freq < 0) return;
        const concertMidi = tunerFreqToMidi(freq);
        const nearestConcertMidi = Math.round(concertMidi);
        const centsOff = (concertMidi - nearestConcertMidi) * 100;
        const writtenMidi = nearestConcertMidi + (TUNER_TRANSPOSITIONS[metroBlkMiniTunerInstrument] || 0);

        document.getElementById('metroBlkMiniTunerNoteBtn').innerText = tunerMidiToName(writtenMidi);
        const clampedCents = Math.max(-50, Math.min(50, centsOff));
        const inTune = Math.abs(centsOff) <= TUNER_ZONE_CENTS;
        const needle = document.getElementById('metroBlkMiniTunerNeedle');
        needle.style.left = `${50 + clampedCents}%`;
        needle.classList.toggle('in-tune', inTune);
        document.getElementById('metroBlkMiniTuner').classList.toggle('in-tune', inTune);
    }
    tunerEngine.onPitch(renderMetroBlkMiniTunerPitch);

    const METRO_BLK_MINI_TUNER_INSTRUMENT_LABELS = { C: 'Concert', Bb: 'B♭', Eb: 'E♭', F: 'F' };

    // Keeps the small label under the note, and the popup's own "currently selected" highlight, in
    // sync with metroBlkMiniTunerInstrument - called on open and on every pick.
    function renderMetroBlkMiniTunerInstrumentBtn() {
        const label = METRO_BLK_MINI_TUNER_INSTRUMENT_LABELS[metroBlkMiniTunerInstrument] || metroBlkMiniTunerInstrument;
        document.getElementById('metroBlkMiniTunerInstrumentBtn').innerText = label;
        document.querySelectorAll('#metroBlkMiniTunerInstrumentOptions .metroBlk-timesig-opt').forEach(btn => {
            btn.classList.toggle('selected', btn.dataset.value === metroBlkMiniTunerInstrument);
        });
    }

    // Both the note itself and the small label under it open this same popup (ML-84 follow-up: the
    // note is a much bigger, easier-to-hit target than the label text alone) - one set of instrument
    // buttons, applying immediately on click, same interaction as the time-signature picker.
    function openMetroBlkMiniTunerInstrumentPicker() {
        renderMetroBlkMiniTunerInstrumentBtn();
        document.getElementById('metroBlkMiniTunerInstrumentModal').style.display = 'flex';
    }
    document.getElementById('metroBlkMiniTunerNoteBtn')?.addEventListener('click', openMetroBlkMiniTunerInstrumentPicker);
    document.getElementById('metroBlkMiniTunerInstrumentBtn')?.addEventListener('click', openMetroBlkMiniTunerInstrumentPicker);
    document.getElementById('metroBlkMiniTunerInstrumentOptions')?.addEventListener('click', (e) => {
        const btn = e.target.closest('.metroBlk-timesig-opt');
        if (!btn) return;
        metroBlkMiniTunerInstrument = btn.dataset.value;
        renderMetroBlkMiniTunerInstrumentBtn();
        document.getElementById('metroBlkMiniTunerInstrumentModal').style.display = 'none';
    });

    // Reflects the tuner's on/off state on the top-bar toggle (ML-91) - a filled circle rather than a
    // swapped icon glyph (see the CSS comment on .top-tuner-toggle for why).
    function renderTopTunerToggleState() {
        const btn = document.getElementById('topTunerToggleBtn');
        if (!btn) return;
        btn.classList.toggle('active', metroBlkMiniTunerActive);
        btn.setAttribute('aria-pressed', metroBlkMiniTunerActive ? 'true' : 'false');
        btn.setAttribute('aria-label', metroBlkMiniTunerActive ? 'Hide tuner' : 'Show tuner');
    }

    function openMetroBlkMiniTuner() {
        metroBlkMiniTunerInstrument = localStorage.getItem(TUNER_INSTRUMENT_DEFAULT_KEY) || 'C';
        renderMetroBlkMiniTunerInstrumentBtn();
        renderMetroBlkMiniTunerIdle();
        // .metroBlk-mini-tuner-open (not hidden-group) so opening/closing animates - see the CSS.
        document.getElementById('metroBlkMiniTuner').classList.add('metroBlk-mini-tuner-open');
    }

    async function startMetroBlkMiniTuner() {
        openMetroBlkMiniTuner();
        metroBlkMiniTunerActive = true;
        renderTopTunerToggleState();
        const ok = await tunerEngine.start();
        if (!ok) {
            showWarningToast('Microphone access is needed for the tuner.');
            closeMetroBlkMiniTuner();
        }
    }

    function closeMetroBlkMiniTuner() {
        metroBlkMiniTunerActive = false;
        renderTopTunerToggleState();
        document.getElementById('metroBlkMiniTuner').classList.remove('metroBlk-mini-tuner-open');
        stopTuner();
    }

    // One button toggling both directions (ML-91) - replaces the old separate show-button-in-the-
    // setup-header/close-X-on-the-tuner pair.
    document.getElementById('topTunerToggleBtn')?.addEventListener('click', () => {
        if (metroBlkMiniTunerActive) closeMetroBlkMiniTuner(); else startMetroBlkMiniTuner();
    });

    function updateMetroBlkMiniTunerVisibility(viewName) {
        if (viewName === 'metroBuilderView') return; // the toggle button owns visibility on this screen
        metroBlkMiniTunerActive = false;
        renderTopTunerToggleState();
        document.getElementById('metroBlkMiniTuner')?.classList.remove('metroBlk-mini-tuner-open');
    }

    // ========================================
    // WAKE LOCK (ML-59)
    // ========================================
    // Keeps the screen from sleeping while the timer or metronome is
    // actively running - both are meant to be glanced at/heard over several
    // minutes without touching the screen, so the OS's normal short sleep
    // timeout would otherwise kill the session. Re-synced (not just
    // acquired once) because the OS releases the lock on tab-hide, and on
    // some browsers on tab-return the lock needs to be re-requested rather
    // than resuming on its own.
    let wakeLock = null;

    async function acquireWakeLock() {
        if (wakeLock || !('wakeLock' in navigator)) return;
        try {
            wakeLock = await navigator.wakeLock.request('screen');
            wakeLock.addEventListener('release', () => { wakeLock = null; });
        } catch (err) {
            // Not fatal - e.g. permission denied or battery saver mode. The
            // screen can just sleep as normal in that case.
        }
    }

    function releaseWakeLockIfHeld() {
        if (wakeLock) wakeLock.release();
        wakeLock = null;
    }

    function isWakeLockNeeded() {
        return !!(timerState && timerState.running) || (typeof metroPlayer !== 'undefined' && metroPlayer.isPlaying());
    }

    function syncWakeLock() {
        if (isWakeLockNeeded()) acquireWakeLock(); else releaseWakeLockIfHeld();
    }

    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') syncWakeLock();
    });

    // ========================================
    // TIMER (ML-7)
    // ========================================
    // Practice timer: pick a target duration (same duration_options list as the
    // save-session screen, ML-7/ML-29), count down, and on finish offer to log it
    // as a practice session via the existing save-session screen. Runs on a plain
    // setInterval that's independent of which view is on screen - navigating away
    // just shrinks it to the mini-bar (see updateTimerMiniBarVisibility) rather
    // than stopping it. State lives in `timerState`: null when idle, otherwise
    // { targetSeconds, remainingSeconds, elapsedSeconds, running }.
    let timerState = null;
    let timerIntervalId = null;

    const TIMER_TODAY_SECONDS_KEY = 'timerTodaySeconds';
    const TIMER_TODAY_DATE_KEY = 'timerTodayDate';

    function timerTodayDateStr() {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    }

    // "Today" here is the timer tool's own live running total, separate from the
    // app's real session-history stats - it resets at local midnight and only
    // tracks time actually spent with the timer running.
    function getTimerTodaySeconds() {
        if (localStorage.getItem(TIMER_TODAY_DATE_KEY) !== timerTodayDateStr()) return 0;
        return Number(localStorage.getItem(TIMER_TODAY_SECONDS_KEY)) || 0;
    }

    function addTimerTodaySeconds(n) {
        const today = timerTodayDateStr();
        const current = localStorage.getItem(TIMER_TODAY_DATE_KEY) === today ? getTimerTodaySeconds() : 0;
        localStorage.setItem(TIMER_TODAY_DATE_KEY, today);
        localStorage.setItem(TIMER_TODAY_SECONDS_KEY, String(current + n));
    }

    function formatClock(totalSeconds) {
        const s = Math.max(0, Math.round(totalSeconds));
        const h = Math.floor(s / 3600);
        const m = Math.floor((s % 3600) / 60);
        const sec = s % 60;
        const mm = String(m).padStart(2, '0');
        const ss = String(sec).padStart(2, '0');
        return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
    }

    function updateTimerMiniBarVisibility(viewName) {
        const bar = document.getElementById('timerMiniBar');
        if (!bar) return;
        bar.classList.toggle('hidden-group', !timerState || viewName === 'timerView');
    }

    function updateTimerPlayIcons() {
        const running = !!(timerState && timerState.running);
        const label = running ? 'Pause' : 'Play';
        const icon = running ? 'pause' : 'play_arrow';
        const fullIcon = document.getElementById('timerPlayIcon');
        const fullBtn = document.getElementById('timerPlayBtn');
        if (fullIcon) fullIcon.innerText = icon;
        if (fullBtn) fullBtn.setAttribute('aria-label', label);
        const miniIcon = document.getElementById('timerMiniPlayIcon');
        const miniBtn = document.getElementById('timerMiniPlayBtn');
        if (miniIcon) miniIcon.innerText = icon;
        if (miniBtn) miniBtn.setAttribute('aria-label', label);
    }

    function updateTimerDisplays() {
        if (!timerState) return;
        const remainingEl = document.getElementById('timerRemainingDisplay');
        const elapsedEl = document.getElementById('timerElapsedDisplay');
        const todayEl = document.getElementById('timerTodayDisplay');
        if (remainingEl) remainingEl.innerText = formatClock(timerState.remainingSeconds);
        if (elapsedEl) elapsedEl.innerText = formatClock(timerState.elapsedSeconds);
        if (todayEl) todayEl.innerText = formatClock(getTimerTodaySeconds());

        const miniTimeEl = document.getElementById('timerMiniSessionTime');
        const miniRemainingEl = document.getElementById('timerMiniRemaining');
        if (miniTimeEl) miniTimeEl.innerText = formatClock(timerState.elapsedSeconds);
        if (miniRemainingEl) miniRemainingEl.innerText = formatClock(timerState.remainingSeconds);
    }

    // Syncs the full-screen Timer view to whatever timerState currently is -
    // called on entering the view, so navigating back mid-session shows the
    // running controls rather than resetting to the picker.
    function renderTimerScreen() {
        document.getElementById('timerSetupGroup')?.classList.toggle('hidden-group', !!timerState);
        document.getElementById('timerRunningGroup')?.classList.toggle('hidden-group', !timerState);
        if (timerState) {
            updateTimerDisplays();
            updateTimerPlayIcons();
        }
    }

    function timerTick() {
        if (!timerState || !timerState.running) return;
        timerState.elapsedSeconds++;
        timerState.remainingSeconds--;
        addTimerTodaySeconds(1);
        updateTimerDisplays();
        if (timerState.remainingSeconds <= 0) finishTimerSession();
    }

    function startTimerSession(targetSeconds) {
        timerState = { targetSeconds, remainingSeconds: targetSeconds, elapsedSeconds: 0, running: true };
        clearInterval(timerIntervalId);
        timerIntervalId = setInterval(timerTick, 1000);
        renderTimerScreen();
        updateTimerMiniBarVisibility('timerView');
        syncWakeLock();
    }

    function toggleTimerPlayPause() {
        if (!timerState) return;
        timerState.running = !timerState.running;
        updateTimerPlayIcons();
        syncWakeLock();
    }

    // Ends the current timer (whether the countdown ran out, or Stop/Close was
    // pressed early) and - if any real time was logged - offers to save it as a
    // practice session via the existing save-session screen, pre-filled.
    function finishTimerSession() {
        if (!timerState) return;
        clearInterval(timerIntervalId);
        timerIntervalId = null;
        const elapsedSeconds = timerState.elapsedSeconds;
        timerState = null;
        renderTimerScreen();
        updateTimerMiniBarVisibility(viewStack[viewStack.length - 1]);
        syncWakeLock();

        if (elapsedSeconds < 1) return;
        const minutes = Math.max(1, Math.round(elapsedSeconds / 60));
        showConfirmModal(
            'Session finished!',
            `Would you like to store this ${minutes} minute session as a practice session?`,
            () => { prefillEntryFormForTimer(minutes); switchView('entryForm'); },
            false
        );
    }

    // Pre-selects Practise + the timer's actual duration on the save-session
    // screen - falls back to the Custom entry if the timer's minutes don't match
    // one of the duration_options presets (ML-7).
    function prefillEntryFormForTimer(minutes) {
        document.querySelectorAll('input[name="category"]').forEach(r => { r.checked = (r.value === 'Practise'); });
        document.getElementById('whoGroup')?.classList.add('hidden-group');
        document.querySelectorAll('input[name="durationOption"]').forEach(r => { r.checked = false; });
        const customGroup = document.getElementById('customDurationGroup');
        const matchingRadio = document.getElementById(`dur-${minutes}`);
        if (matchingRadio) {
            matchingRadio.checked = true;
            customGroup?.classList.add('hidden-group');
        } else {
            const customRadio = document.getElementById('dur-custom');
            if (customRadio) customRadio.checked = true;
            customGroup?.classList.remove('hidden-group');
            const customInput = document.getElementById('duration');
            if (customInput) customInput.value = minutes;
        }
        document.getElementById('date').valueAsDate = new Date();
    }

    document.getElementById('timerDurationRadios')?.addEventListener('change', (e) => {
        if (e.target.name !== 'timerDurationOption') return;
        const customGroup = document.getElementById('timerCustomDurationGroup');
        if (e.target.value === 'custom') {
            customGroup.classList.remove('hidden-group');
            document.getElementById('timerCustomDuration')?.focus();
        } else {
            customGroup.classList.add('hidden-group');
        }
    });

    document.getElementById('timerStartBtn')?.addEventListener('click', () => {
        const radio = document.querySelector('input[name="timerDurationOption"]:checked')?.value;
        const mins = Number(radio === 'custom' ? document.getElementById('timerCustomDuration')?.value : radio);
        if (!mins || isNaN(mins) || mins <= 0) { showWarningToast('Pick a duration first!'); return; }
        startTimerSession(mins * 60);
    });

    document.getElementById('timerPlayBtn')?.addEventListener('click', toggleTimerPlayPause);
    document.getElementById('timerMiniPlayBtn')?.addEventListener('click', toggleTimerPlayPause);
    document.getElementById('timerStopBtn')?.addEventListener('click', finishTimerSession);
    document.getElementById('timerMiniCloseBtn')?.addEventListener('click', finishTimerSession);

    // Dark mode toggle
    document.getElementById('darkModeToggle')?.addEventListener('change', (e) => {
        if (e.target.checked) {
            document.body.classList.add('dark-mode');
            localStorage.setItem('darkMode', 'true');
        } else {
            document.body.classList.remove('dark-mode');
            localStorage.setItem('darkMode', 'false');
        }
    });

    // Initialize app on page load
    window.addEventListener('load', initializeApp);

    // Register service worker so the app can be installed (Add to Home
    // Screen / desktop install prompt on Chrome and Android require one).
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('sw.js').catch(err => {
                console.warn('Service worker registration failed:', err);
            });
        });
    }
