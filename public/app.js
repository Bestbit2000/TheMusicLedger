    const API_BASE_URL = window.location.hostname === 'localhost'
        ? 'http://localhost:3000'
        : `https://${window.location.hostname}`;

    // ========================================
    // AUTHENTICATION & TOKEN MANAGEMENT
    // ========================================
    class AuthManager {
        constructor() {
            this.token = localStorage.getItem('authToken');
            this.userId = localStorage.getItem('userId');
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
    async function apiCall(endpoint, method = 'GET', body = null) {
        if (!auth.isAuthenticated) {
            showWarningToast('Not authenticated. Please login.');
            throw new Error('Not authenticated');
        }

        const options = {
            method,
            headers: {
                'Content-Type': 'application/json',
                ...auth.getAuthHeader()
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
            throw new Error(error.error || `API error: ${response.status}`);
        }

        return await response.json();
    }

    // API endpoint wrappers
    const API = {
        dropdownOptions: () => apiCall('/api/dropdown-options'),
        sessions: {
            get: () => apiCall('/api/sessions'),
            create: (data) => apiCall('/api/sessions', 'POST', data),
            update: (row, data) => apiCall(`/api/sessions/${row}`, 'PUT', data),
            delete: (row, category) => apiCall(`/api/sessions/${row}`, 'DELETE', { category })
        },
        challenges: {
            get: () => apiCall('/api/challenges'),
            create: (data) => apiCall('/api/challenges', 'POST', data),
            update: (row, data) => apiCall(`/api/challenges/${row}`, 'PUT', data),
            delete: (row) => apiCall(`/api/challenges/${row}`, 'DELETE'),
            close: (id) => apiCall(`/api/challenges/${id}/close`, 'PUT'),
            updateGroup: (id, data) => apiCall(`/api/challenges/group/${id}`, 'PUT', data),
            deleteGroup: (id) => apiCall(`/api/challenges/group/${id}`, 'DELETE'),
            addItem: (groupId, data) => apiCall(`/api/challenges/group/${groupId}/items`, 'POST', data)
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
    let appData = { organisations: [], teachers: [] };
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

            let lbl = document.createElement('span');
            lbl.className = 'chart-x-label';
            lbl.innerText = len;
            barCont.appendChild(lbl);

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

        try {
            await loadAppData();
            await fetchDataAndRender();
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

    async function loadAppData() {
        try {
            appData = await API.dropdownOptions();
            populateWhoDropdowns();
        } catch (error) {
            console.warn('Failed to load settings:', error);
            appData = { organisations: [], teachers: [] };
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

    function fetchDataAndRender() {
        return Promise.all([
            API.sessions.get().then(data => { rawData = data; renderAllViews(); }),
            loadChallenges()
        ]).then(() => {
            displayMainApp();
        }).catch(err => {
            showWarningToast('Error loading data: ' + err.message);
            displayLoginScreen();
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
    const views = ['mainView', 'historyView', 'streakStatsView', 'statsView', 'entryForm', 'manageListsView', 'settingsView', 'aboutView', 'manageChallengesView', 'challengeSelectView', 'challengePlayView', 'challengeSummaryView', 'editChallengeView', 'metronomeView', 'tunerView'];
    let viewStack = ['mainView'];

    const viewAliasMap = {
        'main': 'mainView', 'history': 'historyView', 'stats': 'statsView', 'addForm': 'entryForm',
        'lists': 'manageListsView', 'settings': 'settingsView', 'challengesList': 'manageChallengesView',
        'challengeSelect': 'challengeSelectView', 'challengePlay': 'challengePlayView',
        'challengeSummary': 'challengeSummaryView', 'editChallenge': 'editChallengeView',
        'metronome': 'metronomeView', 'tuner': 'tunerView'
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
        else { stopMetronome(); }

        if (viewName === 'tunerView') {
            document.getElementById('topTitle').innerText = 'Tuner';
            startTuner();
        }
        else { stopTuner(); }
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

    async function loadChallenges() {
        try {
            allChallenges = await API.challenges.get();
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
                <div class="history-item draggable-item" draggable="true" data-id="${item.id}" style="align-items:center; border-left: 4px solid ${borderColor}; padding-left:5px;">
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
                masterGain.connect(audioCtx.destination);
            }
            return audioCtx.state === 'suspended' ? audioCtx.resume() : Promise.resolve();
        }

        function playClick(kind, time) {
            const freq = kind === 'tick' ? 1600 : (kind === 'tock' ? 1000 : 650);
            const peak = kind === 'bom' ? 0.55 : 1;
            const dur = kind === 'bom' ? 0.045 : 0.035;
            const osc = audioCtx.createOscillator();
            const g = audioCtx.createGain();
            osc.type = 'triangle';
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

            while (nextClickTime < audioCtx.currentTime + SCHEDULE_AHEAD_S) {
                const idxInBar = clickIndex % totalPerBar;
                let kind, conductorBeatIndex, noteIndex, isConductorBeat, isNoteBoundary;
                if (zeroBar) {
                    kind = 'tock';
                    conductorBeatIndex = 0;
                    noteIndex = 0;
                    isConductorBeat = true;
                    isNoteBoundary = true;
                } else {
                    isConductorBeat = (idxInBar % groupSize) === 0;
                    isNoteBoundary = (idxInBar % Math.max(1, subdivisionFactor)) === 0;
                    kind = !isConductorBeat ? 'bom' : (idxInBar === 0 ? 'tick' : 'tock');
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
            // it) - use stop() first if you want a fresh bar from the beginning.
            play() {
                if (playing) return;
                playing = true;
                ensureAudio().then(() => {
                    if (!playing) return; // paused/stopped again before the context finished resuming
                    nextClickTime = audioCtx.currentTime + 0.05;
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
            isPlaying() { return playing; },
            setConductorBpm(v) { conductorBpm = v; },
            setConductorBeatsPerBar(n) { conductorBeatsPerBar = n; },
            setNotesPerBeat(n) { notesPerBeat = n; },
            setSubdivisionFactor(n) { subdivisionFactor = n; },
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
        n = Math.min(METRO_CUSTOM_MAX, Math.max(1, Math.round(n)));
        if (metroState.conductInLinked) {
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

    // Conduct in = how many of those notes the conductor actually beats/accents (<= beats per bar).
    // An explicit pick here is a deliberate divergence from beats-per-bar, so it breaks the link.
    function setMetroConductIn(conductIn) {
        metroState.conductInLinked = false;
        conductIn = Math.min(metroState.beatsPerBar, Math.max(1, conductIn));
        metroState.notesPerBeat = Math.max(1, Math.round(metroState.beatsPerBar / conductIn));
        metroSyncConductorBpm();
        pushMetroSettingsToPlayer();
        renderMetroTiers();
        renderMetroConductInLabel();
    }

    // Turns the beats-per-bar <-> conductor-beats link on, syncing conduct-in to the current
    // beats-per-bar immediately - a live connection from then on, until an explicit conductor-beats
    // pick (setMetroConductIn above) breaks it again.
    function setMetroConductInLinked(linked) {
        metroState.conductInLinked = linked;
        if (linked) {
            metroState.notesPerBeat = 1;
            metroSyncConductorBpm();
            pushMetroSettingsToPlayer();
            renderMetroTiers();
            renderMetroConductInLabel();
        }
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

    function renderMetroConductInLabel() {
        const lbl = document.getElementById('metroConductInLbl');
        if (lbl) lbl.innerText = Math.round(metroConductIn());
        const icon = document.getElementById('metroConductInLinkIcon');
        // Material Symbols icons can't rely on the native hidden attribute: Google's font stylesheet
        // declares .material-symbols-outlined { display: inline-block } which (being a real author
        // declaration, not a UA default) overrides [hidden] outright. hidden-group's !important wins.
        if (icon) icon.classList.toggle('hidden-group', !metroState.conductInLinked);
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
    }

    function renderMetroSpeedReadout() {
        document.getElementById('metroSpeedPct').innerText = `${metroSpeedPercent()}%`;
        document.getElementById('metroSpeedBpm').innerText = `${Math.round(metroEffectiveBpm())} bpm`;
        const { minLevel, maxLevel } = metroSpeedLevelBounds();
        document.getElementById('metroSlowerBtn').disabled = metroState.speedLevel <= minLevel;
        document.getElementById('metroFasterBtn').disabled = metroState.speedLevel >= maxLevel;
    }

    // Smallest dot (the subdivide tier, 10px) plus its breathing room - the per-click width used once
    // there are too many clicks to comfortably fit the screen at all, and the display has to switch
    // from "stretch to fit" to "fixed size, scroll to follow" instead.
    const METRO_SLOT_PX = 16;

    // Fixed pixel clearance reserved at each end of the click grid, so the largest dot (the accent/
    // conduct note, ~16px radius including its border and lit-state scale) never gets clipped by
    // metro-display-viewport's overflow:hidden at click index 0 or the last click. A pure percentage
    // inset (half a "unit") isn't enough once totalBaseClicks is large, since a unit shrinks well
    // below the dot's radius - see metroLeftStyle.
    const METRO_EDGE_PAD_PX = 16;

    // Sizes the scrollable content track: if beatsPerBar x subdivisionFactor clicks fit within the
    // viewport at METRO_SLOT_PX each (plus the edge padding reserved on each side), it stays 100%
    // (stretches to fit, today's behaviour, no scroll needed). Otherwise it's pinned to its true
    // full-size pixel width, wider than the viewport, and flashMetroBeat's scroll-follow logic takes
    // over to keep the baton in view as it plays.
    function metroApplyDisplayWidth(totalBaseClicks) {
        const viewport = document.getElementById('metroDisplayViewport');
        const content = document.getElementById('metroDisplayContent');
        if (!viewport || !content) return;
        const viewportWidthPx = viewport.getBoundingClientRect().width;
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

    function renderMetroTierRow(rowId, count, dotClass, baseClickIndexFor, extraClassFor) {
        const row = document.getElementById(rowId);
        if (!row) return;
        const { leftPct } = metroTierGeometry();
        row.innerHTML = '';
        for (let i = 0; i < count; i++) {
            const dot = document.createElement('div');
            dot.className = `metro-dot ${dotClass}` + (extraClassFor ? extraClassFor(i) : '');
            dot.dataset.index = i;
            dot.style.left = metroLeftStyle(leftPct(baseClickIndexFor(i)));
            row.appendChild(dot);
        }
    }

    function renderMetroTiers() {
        const { beatsPerBar, notesPerBeat, subFactor, totalBaseClicks } = metroTierGeometry();
        metroApplyDisplayWidth(totalBaseClicks);

        // One row, one dot per note - the notes the conductor actually beats ("conduct", the subset
        // spaced notesPerBeat apart) are just styled bigger within this same row, no separate row.
        renderMetroTierRow('metroNotesRow', beatsPerBar, 'metro-dot-note', i => i * subFactor, i => {
            const isConduct = (i % notesPerBeat) === 0;
            return (isConduct ? ' conduct' : ' bom-note') + (i === 0 ? ' accent' : '');
        });

        const subRow = document.getElementById('metroSubdivideRow');
        if (subFactor > 1) {
            subRow.classList.remove('hidden-group');
            renderMetroTierRow('metroSubdivideRow', beatsPerBar * subFactor, 'metro-dot-sub', k => k);
        } else {
            subRow.classList.add('hidden-group');
            subRow.innerHTML = '';
        }

        renderMetroBatonMarks();
        resetMetroBatonPosition();
    }

    // Static marks at every conductor beat's landing spot, always visible and never moving, so the
    // whole bar's beat pattern is visible in advance rather than only revealing the next single stop.
    function renderMetroBatonMarks() {
        const track = document.getElementById('metroBatonTrack');
        if (!track) return;
        track.querySelectorAll('.metro-baton-mark').forEach(el => el.remove());
        const { notesPerBeat, subFactor, leftPct } = metroTierGeometry();
        const conductIn = Math.round(metroConductIn());
        const groupSize = notesPerBeat * subFactor;
        for (let i = 0; i < conductIn; i++) {
            const mark = document.createElement('div');
            mark.className = 'metro-baton-mark';
            mark.style.left = metroLeftStyle(leftPct(i * groupSize));
            track.appendChild(mark);
        }
    }

    function resetMetroBatonPosition() {
        const { leftPct } = metroTierGeometry();
        const baton = document.getElementById('metroBaton');
        if (baton) { baton.style.transitionDuration = '0s'; baton.style.left = metroLeftStyle(leftPct(0)); }
        const content = document.getElementById('metroDisplayContent');
        if (content) { content.style.transitionDuration = '0s'; content.style.transform = 'translateX(0px)'; }
    }

    // When there are too many clicks to fit, keeps the baton in view: the content track stays put
    // (scroll offset 0) until the baton would pass the viewport's centre, then the SAME instant-snap-
    // then-glide technique used for the baton itself is applied to the content's own translateX, so it
    // scrolls in lockstep and the baton reads as pinned near the centre while the beats scroll past
    // underneath it. Once the tail end of the content reaches the viewport's right edge, the clamp
    // holds the scroll there and the baton resumes moving (rather than the camera trying to scroll
    // past content that doesn't exist) - the classic side-scroller camera clamp.
    function metroScrollFollow(arrivedPct, nextPct, durationSeconds) {
        const content = document.getElementById('metroDisplayContent');
        const viewport = document.getElementById('metroDisplayViewport');
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
        if (beatInfo.isNoteBoundary) flashTierDot('metroNotesRow', beatInfo.noteIndex);
        flashTierDot('metroSubdivideRow', beatInfo.clickIndexInBar);

        // The baton only moves/lands on conductor beats - it glides smoothly over exactly one
        // conductor beat's duration so it visibly arrives right as that beat sounds, then
        // immediately starts gliding on toward the next one. It always travels rightward: when the
        // next stop wraps back to beat 0, the target is pushed a further 100% along (off the right
        // edge, clipped by the track's overflow:hidden) instead of sliding the "left" value back down
        // - then the very next arrival snap (no transition) repositions it at the true, on-screen
        // spot, so it reads as "exits right, reappears at the left" rather than a reverse sweep.
        if (!beatInfo.isConductorBeat) return;
        const { notesPerBeat, subFactor, leftPct } = metroTierGeometry();
        const groupSize = notesPerBeat * subFactor;
        const baton = document.getElementById('metroBaton');
        const nextIndex = (beatInfo.conductorBeatIndex + 1) % beatInfo.conductorBeatsPerBar;
        const wrapped = nextIndex <= beatInfo.conductorBeatIndex;
        const arrivedPct = leftPct(beatInfo.conductorBeatIndex * groupSize);
        const nextPct = leftPct(nextIndex * groupSize) + (wrapped ? 100 : 0);

        if (baton) {
            baton.style.transitionDuration = '0s';
            baton.style.left = metroLeftStyle(arrivedPct);
            if (beatInfo.kind === 'tick') {
                baton.classList.add('accent-pulse');
                setTimeout(() => baton.classList.remove('accent-pulse'), 120);
            }
            // Force a synchronous style flush so the instant snap above is actually committed before
            // the transition-duration change below takes effect - requestAnimationFrame would do this
            // too, but rAF is throttled/paused on a backgrounded tab, which would silently stall the
            // glide for anyone who locks their phone or switches apps mid-practice.
            void baton.offsetWidth;
            baton.style.transitionDuration = `${beatInfo.secondsPerConductorBeat}s`;
            baton.style.left = metroLeftStyle(nextPct);
        }
        metroScrollFollow(arrivedPct, nextPct, beatInfo.secondsPerConductorBeat);
    }
    metroPlayer.onBeat(flashMetroBeat);

    function updateMetroPlayIcon() {
        const icon = document.getElementById('metroPlayIcon');
        const btn = document.getElementById('metroPlayBtn');
        const playing = metroPlayer.isPlaying();
        if (icon) icon.innerText = playing ? 'pause' : 'play_arrow';
        if (btn) btn.setAttribute('aria-label', playing ? 'Pause' : 'Play');
    }

    // Resumes from wherever it was left (position 0 the first time, or wherever pauseMetronome() left
    // it) - use stopMetronome() first for a fresh bar from the beginning.
    function playMetronome() {
        pushMetroSettingsToPlayer();
        metroPlayer.play();
        updateMetroPlayIcon();
    }

    // Halts playback without resetting position - playMetronome() will pick back up from here.
    function pauseMetronome() {
        metroPlayer.pause();
        updateMetroPlayIcon();
    }

    // Halts playback AND resets the baton/beat position back to the start of the bar.
    function stopMetronome() {
        metroPlayer.stop();
        updateMetroPlayIcon();
        resetMetroBatonPosition();
    }

    document.getElementById('metroPlayBtn')?.addEventListener('click', () => {
        if (metroPlayer.isPlaying()) pauseMetronome(); else playMetronome();
    });
    document.getElementById('metroStopBtn')?.addEventListener('click', stopMetronome);

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

    setupSliderInteraction(document.getElementById('metroSliderTrack'), document.getElementById('metroSliderThumb'), {
        onDragRatio: (ratio) => setMetroNotesBpm(METRO_MIN_BPM + ratio * (metroState.sliderMax - METRO_MIN_BPM), { resetSpeed: true, dragging: true }),
        onArrowStep: (dir) => setMetroNotesBpm(metroState.notesBpm + dir, { resetSpeed: true, dragging: true })
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

    // --- Beats per bar popup ---
    document.getElementById('metroBeatsBtn')?.addEventListener('click', () => {
        openMetroPicker({
            modalId: 'metroBeatsModal', optionsId: 'metroBeatsOptions',
            customEntryId: 'metroBeatsCustomEntry', customValueId: 'metroBeatsCustomValue',
            cancelBtnId: 'metroBeatsCancelBtn', saveBtnId: 'metroBeatsSaveBtn',
            values: [1, 2, 3, 4, 5, 6, 7, 8, 9, 12], currentValue: metroState.beatsPerBar,
            customMin: 1, customMax: METRO_CUSTOM_MAX,
            customDefault: 10, // not already one of the presets above, so Custom starts somewhere new
            onSave: (v) => setMetroBeatsPerBar(v)
        });
    });

    // Whole-number divisors of n, ascending - the only conductor-beats counts that evenly group a bar
    // of n notes. Offering (or letting Custom land on) a non-divisor is what silently rounded back to
    // n itself before, which looked exactly like the link had never actually broken.
    // --- Conductor beats popup (Link to beats per bar / divisors of beatsPerBar / Custom) ---
    document.getElementById('metroConductInBtn')?.addEventListener('click', () => {
        const current = Math.round(metroConductIn());
        const divisors = metroDivisorsOf(metroState.beatsPerBar);
        openMetroPicker({
            modalId: 'metroConductInModal', optionsId: 'metroConductInOptions',
            customEntryId: 'metroConductInCustomEntry', customValueId: 'metroConductInCustomValue',
            cancelBtnId: 'metroConductInCancelBtn', saveBtnId: 'metroConductInSaveBtn',
            values: divisors, currentValue: current, labelFor: v => String(v),
            customMin: divisors[0], customMax: divisors[divisors.length - 1],
            customStep: (value, dir) => {
                const idx = divisors.indexOf(value);
                if (dir > 0) return divisors[Math.min(divisors.length - 1, (idx === -1 ? 0 : idx) + 1)];
                return divisors[Math.max(0, (idx === -1 ? divisors.length - 1 : idx) - 1)];
            },
            onSave: (v) => setMetroConductIn(v),
            startAsExtra: metroState.conductInLinked,
            extraOption: { label: 'Link to beats per bar', icon: 'link', onPick: () => setMetroConductInLinked(true) }
        });
    });

    // --- Subdivide popup (Off/2/3/4 plus Custom - "N per beat" throughout, presets and custom alike) ---
    document.getElementById('metroSubdivideBtn')?.addEventListener('click', () => {
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
    });

    // --- Speed override (practice slower/faster than target, target itself untouched) ---
    document.getElementById('metroSlowerBtn')?.addEventListener('click', () => {
        const { minLevel } = metroSpeedLevelBounds();
        if (metroState.speedLevel > minLevel) metroState.speedLevel--;
        pushMetroSettingsToPlayer();
        renderMetroSpeedReadout();
    });
    document.getElementById('metroFasterBtn')?.addEventListener('click', () => {
        const { maxLevel } = metroSpeedLevelBounds();
        if (metroState.speedLevel < maxLevel) metroState.speedLevel++;
        pushMetroSettingsToPlayer();
        renderMetroSpeedReadout();
    });
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
