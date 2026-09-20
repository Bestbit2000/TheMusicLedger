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
                if (window.posthog) window.posthog.identify(userId);
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
            if (window.posthog) window.posthog.reset();
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
    if (auth.isAuthenticated && window.posthog) window.posthog.identify(auth.userId);

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
                // Optional token param (ML-161), same reason as dropdownOptions/sessions.get above -
                // this is now also fired from initializeApp's own startup sequence (prefetched
                // alongside those), which needs the pinned startupToken threaded through rather than
                // relying on live auth.token (see the ML-48 comment in apiCall).
                list: (token) => apiCall('/api/time-signatures', 'GET', null, token),
                createCustom: (numerator, denominator) => apiCall('/api/time-signatures/custom', 'POST', { numerator, denominator }),
                listCustomWithUsage: () => apiCall('/api/time-signatures/custom'),
                archiveCustom: (id) => apiCall(`/api/time-signatures/custom/${id}`, 'PUT', { active: false }),
                deleteCustom: (id) => apiCall(`/api/time-signatures/custom/${id}`, 'DELETE')
            },
            playbackSpeeds: {
                list: () => apiCall('/api/metronome/playback-speeds')
            },
            setups: {
                list: () => apiCall('/api/metronome/setups'),
                get: (id) => apiCall(`/api/metronome/setups/${id}`),
                getScratch: () => apiCall('/api/metronome/setups/scratch'),
                createNamed: (name) => apiCall('/api/metronome/setups/named', 'POST', { name }),
                duplicate: (id, name) => apiCall(`/api/metronome/setups/${id}/duplicate`, 'POST', { name }),
                save: (id, name) => apiCall(`/api/metronome/setups/${id}/save`, 'POST', { name }),
                rename: (id, name) => apiCall(`/api/metronome/setups/${id}`, 'PUT', { name }),
                delete: (id) => apiCall(`/api/metronome/setups/${id}`, 'DELETE'),
                setFavorite: (id, isFavorite) => apiCall(`/api/metronome/setups/${id}/favorite`, 'PUT', { isFavorite })
            },
            segments: {
                create: (setupId, data) => apiCall(`/api/metronome/setups/${setupId}/segments`, 'POST', data),
                update: (segId, data) => apiCall(`/api/metronome/segments/${segId}`, 'PUT', data),
                delete: (segId) => apiCall(`/api/metronome/segments/${segId}`, 'DELETE')
            },
            quickPlay: {
                save: (name, blocks) => apiCall('/api/metronome/quick-play', 'POST', { name, blocks }),
                history: () => apiCall('/api/metronome/history'),
                overwriteHistory: (id, blocks) => apiCall(`/api/metronome/history/${id}`, 'PUT', { blocks }),
                duplicateHistory: (id, name) => apiCall(`/api/metronome/history/${id}/duplicate`, 'POST', { name })
            }
        },
        // ML-179: score-backed "Flows" - see docs/database-schema.md's "Flow" vs "Score" naming
        // note. Recordings/documents live in Vercel Blob, not Postgres - the upload-token/*
        // endpoints authorize a direct browser-to-Blob upload (window.vercelBlobUpload, loaded via
        // the module script in index.html), and the plain recordings/documents endpoints just
        // record the resulting URL once that upload has actually finished.
        flows: {
            list: () => apiCall('/api/flows'),
            create: (data) => apiCall('/api/flows', 'POST', data),
            get: (id) => apiCall(`/api/flows/${id}`),
            update: (id, data) => apiCall(`/api/flows/${id}`, 'PUT', data),
            moveToBand: (id, bandId) => apiCall(`/api/flows/${id}/move-to-band`, 'PUT', { bandId }),
            removeFromBand: (id) => apiCall(`/api/flows/${id}/remove-from-band`, 'PUT'),
            publish: (id) => apiCall(`/api/flows/${id}/publish`, 'PUT'),
            unpublish: (id) => apiCall(`/api/flows/${id}/unpublish`, 'PUT'),
            delete: (id) => apiCall(`/api/flows/${id}`, 'DELETE'),
            duplicate: (id) => apiCall(`/api/flows/${id}/duplicate`, 'POST'),
            recordings: {
                addUploaded: (flowId, data) => apiCall(`/api/flows/${flowId}/recordings`, 'POST', data),
                addYouTube: (flowId, data) => apiCall(`/api/flows/${flowId}/recordings/youtube`, 'POST', data),
                delete: (flowId, recordingId) => apiCall(`/api/flows/${flowId}/recordings/${recordingId}`, 'DELETE')
            },
            documents: {
                add: (flowId, data) => apiCall(`/api/flows/${flowId}/documents`, 'POST', data),
                delete: (flowId, documentId) => apiCall(`/api/flows/${flowId}/documents/${documentId}`, 'DELETE')
            },
            // ML-179 Phase 2 - score-backed blocks (parent_score_id), same shape as
            // metronomeBlocks.segments above.
            blocks: {
                list: (flowId) => apiCall(`/api/flows/${flowId}/blocks`),
                create: (flowId, data) => apiCall(`/api/flows/${flowId}/blocks`, 'POST', data),
                update: (blockId, data) => apiCall(`/api/flows/blocks/${blockId}`, 'PUT', data),
                delete: (blockId) => apiCall(`/api/flows/blocks/${blockId}`, 'DELETE'),
                duplicate: (blockId) => apiCall(`/api/flows/blocks/${blockId}/duplicate`, 'POST'),
                reorder: (flowId, orderedIds) => apiCall(`/api/flows/${flowId}/blocks/reorder`, 'PUT', { orderedIds })
            }
        },
        account: {
            get: () => apiCall('/api/account'),
            update: (data) => apiCall('/api/account', 'PUT', data),
            getBands: () => apiCall('/api/account/bands'),
            addBand: (name, website) => apiCall('/api/account/bands', 'POST', { name, website }),
            joinBand: (id) => apiCall(`/api/account/bands/${id}/join`, 'POST'),
            leaveBand: (id) => apiCall(`/api/account/bands/${id}`, 'DELETE'),
            deleteBandFull: (id) => apiCall(`/api/account/bands/${id}/full`, 'DELETE')
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

    // Every historical streak run of consecutive days present in dateSet - length plus the date it
    // ended (ML-160 needs the end date; the histogram below only ever needed the lengths, so this
    // replaces calculateAllStreaks entirely rather than duplicating the same walk twice).
    function calculateAllStreaksWithEnd(dateSet) {
        const sorted = Array.from(dateSet).sort();
        const streaks = [];
        let current = 0;
        let prevDateStr = null;
        sorted.forEach(dStr => {
            if (prevDateStr && dateStrAddDays(prevDateStr, 1) === dStr) {
                current++;
            } else {
                if (current > 0) streaks.push({ length: current, endDateStr: prevDateStr });
                current = 1;
            }
            prevDateStr = dStr;
        });
        if (current > 0) streaks.push({ length: current, endDateStr: prevDateStr });
        return streaks;
    }

    // Longest run on record - on a tie, the most recent one (streaksWithEnd is already date-ordered,
    // so ">=" while walking forward keeps overwriting with the later tie) reads as more relevant than
    // an old one from way back.
    function longestStreak(streaksWithEnd) {
        let best = null;
        for (const s of streaksWithEnd) {
            if (!best || s.length >= best.length) best = s;
        }
        return best;
    }

    function getStreakData() {
        const practiseDates = new Set();
        const playingDates = new Set();
        rawData.forEach(d => {
            playingDates.add(d.dateStr);
            if (d.category === 'Practise') practiseDates.add(d.dateStr);
        });
        const practiseStreaksWithEnd = calculateAllStreaksWithEnd(practiseDates);
        const playingStreaksWithEnd = calculateAllStreaksWithEnd(playingDates);
        return {
            currentPractise: calculateCurrentStreak(practiseDates),
            currentPlaying: calculateCurrentStreak(playingDates),
            practiseStreaks: practiseStreaksWithEnd.map(s => s.length),
            playingStreaks: playingStreaksWithEnd.map(s => s.length),
            longestPractise: longestStreak(practiseStreaksWithEnd),
            longestPlaying: longestStreak(playingStreaksWithEnd)
        };
    }

    function dayLabel(n) { return `${n} day${n === 1 ? '' : 's'}`; }

    // Same "d Mon yyyy" shape as formatReleaseDate above, just against a streak's own endDateStr.
    function formatStreakEndDate(dateStr) {
        const mNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
        const d = parseDateSafely(dateStr);
        return `${d.getDate()} ${mNames[d.getMonth()]} ${d.getFullYear()}`;
    }

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

            // ML-160: longest streak on record, plus the date it ended - null (no streak data at all
            // yet) leaves both fields at "0 days"/blank rather than throwing on a missing endDateStr.
            const elLongP = document.getElementById('streakLongestPractise');
            const elLongPl = document.getElementById('streakLongestPlaying');
            const elLongPDate = document.getElementById('streakLongestPractiseDate');
            const elLongPlDate = document.getElementById('streakLongestPlayingDate');
            if (elLongP) elLongP.innerText = dayLabel(data.longestPractise?.length || 0);
            if (elLongPl) elLongPl.innerText = dayLabel(data.longestPlaying?.length || 0);
            if (elLongPDate) elLongPDate.innerText = data.longestPractise ? `ended ${formatStreakEndDate(data.longestPractise.endDateStr)}` : '';
            if (elLongPlDate) elLongPlDate.innerText = data.longestPlaying ? `ended ${formatStreakEndDate(data.longestPlaying.endDateStr)}` : '';

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
            // Anchored to the bar itself, not barCont (which spans the container's full height
            // regardless of the bar's actual height) - otherwise the popup lands up at the top of the
            // chart instead of next to the bar that was actually clicked. `bar` is only assigned below,
            // but the closure reads it live and this only ever runs later, on click.
            barCont.addEventListener('click', () => {
                showAnchoredPopup(bar, `${dayLabel(len)} streak: ${val} time${val === 1 ? '' : 's'}`);
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

        // ML-161: fire this now, unawaited, so it runs in the background alongside the startup
        // fetches below - by the time the user actually navigates to the Metronome page, this has
        // almost always already resolved, so its first render no longer has to wait on it (see the
        // quickPlayView switch and metroBlkTimeSigReadyPromise's own comment above). Threads
        // startupToken through same as loadAppData/fetchDataAndRender just below - this fires in the
        // same early-startup window their own pinned-token comment (see apiCall, ML-48) warns about.
        metroBlkTimeSigReadyPromise = loadMetroBlkTimeSignatures(startupToken);

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
            document.getElementById('fermataPlaybackModeSetting').value = localStorage.getItem(FERMATA_PLAYBACK_MODE_KEY) || 'tone';
            syncAdminLinkVisibility();
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
    // ML-184: "Open ended" is a 4th choice, timer-only (isTimerVariant) - it has no minutes of its
    // own (open-ended counts up until Stop, see startTimerSession/timerTick), so it doesn't belong on
    // the save-session screen's own copy of this list, which is always a fixed past duration.
    // isTimerVariant also swaps the Custom label to "Custom…" - the ellipsis flags that picking it
    // isn't the end of the action (a number input still needs filling in), same convention the burger
    // menu's own "Tools…"/"Progress…" already use for "this opens something else first". Left as
    // plain "Custom" on the save-session screen, which wasn't asked to change.
    // Open ended is placed BEFORE Custom (not after) specifically so Custom stays the very last radio
    // in the grid - the custom-minutes input box is a separate form-group that always renders
    // directly below the whole grid, not below whichever button happens to be last, so keeping Custom
    // last is what keeps that input visually next to the button that reveals it.
    function renderDurationOptionsInto(containerId, idPrefix, radioName, isTimerVariant) {
        const container = document.getElementById(containerId);
        if (!container) return;
        const optionsHtml = (appData.durations || []).map(mins =>
            `<input type="radio" id="${idPrefix}-${mins}" name="${radioName}" value="${mins}"><label for="${idPrefix}-${mins}">${mins}</label>`
        ).join('');
        const openEndedHtml = isTimerVariant
            ? `<input type="radio" id="${idPrefix}-open-ended" name="${radioName}" value="open-ended"><label for="${idPrefix}-open-ended">Open ended</label>`
            : '';
        const customLabel = isTimerVariant ? 'Custom&hellip;' : 'Custom';
        container.innerHTML = optionsHtml + openEndedHtml +
            `<input type="radio" id="${idPrefix}-custom" name="${radioName}" value="custom"><label for="${idPrefix}-custom">${customLabel}</label>`;
    }

    function renderDurationRadios() {
        renderDurationOptionsInto('durationRadios', 'dur', 'durationOption');
        renderDurationOptionsInto('timerDurationRadios', 'timerDur', 'timerDurationOption', true);
        renderDurationOptionsInto('timerPickerDurationRadios', 'timerPickerDur', 'timerPickerDurationOption', true);
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
    // ML-135: Tools/Progress are staged sub-screens of the same dropdown (see the HTML comment above
    // #burgerDropdown) rather than a hover flyout - resetBurgerMenu always puts it back at the main
    // level before it opens, so leaving it mid-submenu one time doesn't strand it there next time.
    function resetBurgerMenu() {
        document.getElementById('burgerMenuTools')?.classList.add('hidden-group');
        document.getElementById('burgerMenuProgress')?.classList.add('hidden-group');
        document.getElementById('burgerMenuMain')?.classList.remove('hidden-group');
    }
    window.openBurgerSubmenu = function(id, e) {
        // Without this, the click bubbles up to the document-level listener just below (which closes
        // the whole dropdown on any outside click) and undoes the submenu switch in the same tick.
        e?.stopPropagation();
        document.getElementById('burgerMenuMain')?.classList.add('hidden-group');
        document.getElementById('burgerMenuTools')?.classList.add('hidden-group');
        document.getElementById('burgerMenuProgress')?.classList.add('hidden-group');
        document.getElementById(id)?.classList.remove('hidden-group');
    }
    window.closeBurgerSubmenu = function(e) {
        e?.stopPropagation();
        resetBurgerMenu();
    }
    // ML-162: every popup menu on the metronome pages (this burger menu, Blocks' per-tile 3-dot menu,
    // Quick Play's per-bar 3-dot menu, the mini tuner's 3-dot menu) stops propagation on its own
    // opening click so the document-level "click outside closes it" listener below doesn't instantly
    // re-close what it just opened. That stopPropagation also stops the click reaching every OTHER
    // menu's own document-level listener, so opening one left any other menu that was already open
    // stuck on screen instead of being replaced. Each open handler now closes all of these explicitly
    // first, rather than relying on document-level bubbling to do it.
    function closeAllMetroPopupMenus() {
        document.getElementById('burgerDropdown')?.classList.remove('show');
        document.getElementById('metroBlkTileMenu')?.classList.remove('show');
        document.getElementById('qpBarMenu')?.classList.remove('show');
        document.getElementById('qpHistoryItemMenu')?.classList.remove('show');
    }
    document.getElementById('navBurgerMenuBtn')?.addEventListener('click', (e) => {
        e.stopPropagation();
        const dropdown = document.getElementById('burgerDropdown');
        const opening = !dropdown.classList.contains('show');
        closeAllMetroPopupMenus();
        if (opening) {
            dropdown.classList.add('show');
            resetBurgerMenu();
        }
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
    // actionLabel overrides the default Delete/Confirm text - e.g. "Leave" for leaving a band, which
    // isn't a delete at all (the band itself isn't removed, just this account's own membership) and
    // shouldn't read as one.
    function showConfirmModal(title, msg, callback, isDanger=true, actionLabel=null, cancelLabel='Cancel') {
        document.getElementById('confirmTitle').innerText = title;
        document.getElementById('confirmMessage').innerText = msg;
        const btn = document.getElementById('confirmActionBtn');
        btn.style.background = isDanger ? 'var(--danger-color)' : 'var(--primary-action)';
        btn.innerText = actionLabel || (isDanger ? 'Delete' : 'Confirm');
        document.getElementById('confirmCancelBtn').innerText = cancelLabel;
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
        const cb = promptCallback;
        if (cb) cb(val);
        // A callback that itself calls showPromptModal again (chaining a second prompt, e.g. the
        // fermata "which bar" -> "which beat" -> "hold for how many beats" sequence) reassigns
        // promptCallback to the new step before returning here - closing unconditionally would
        // have immediately torn that new prompt back down again. Only close if the callback left
        // it pointing at the same place (a validation failure re-shows the same prompt without
        // reassigning, which also correctly stays open here).
        if (promptCallback === cb) closePromptModal();
    });

    // ========================================
    // VIEW NAVIGATION
    // ========================================
    const views = ['mainView', 'historyView', 'streakStatsView', 'statsView', 'entryForm', 'accountView', 'settingsView', 'aboutView', 'manageChallengesView', 'challengeSelectView', 'challengePlayView', 'challengeSummaryView', 'editChallengeView', 'quickPlayView', 'metroBuilderView', 'flowDetailsHubView', 'flowPlayView', 'tunerView', 'timerView'];
    let viewStack = ['mainView'];
    // Which tab flowDetailsHubView should open on next - set by a caller just before switchView,
    // read/cleared by that view's own switchView case. null means the default (Details).
    let flowEditRequestedTab = null;
    // 'create' only for the brand-new flow createAndOpenFlow just created; every other entry point
    // (openFlow, the Play Flow 3-dot menu) is editing a flow that already exists, so sets this to
    // 'edit'. Drives the top bar title, the sticky bar's layout (Next-chain vs Cancel/Save/Delete),
    // and whether Details/Media/Blocks edits autosave immediately or stage as a local draft (see
    // flowEditSnapshot below) - a real Cancel only makes sense once there's something to cancel
    // back to, which a brand-new flow doesn't have yet.
    let flowEditMode = 'create';
    // Snapshot of everything editable, taken once on entering Edit mode (loadAndRenderFlowDetailsHub)
    // - null in Create mode, where there's nothing to stage/revert. Cancel needs no revert logic at
    // all: every Edit-mode mutation below stays purely local (no API calls) until Save, so Cancel is
    // just leaving - same "stage locally, sync in one batch on Save" pattern as metroBuilderView's
    // own metroBlkEditSnapshot/saveMetroBlkEdit.
    let flowEditSnapshot = null;

    const viewAliasMap = {
        'main': 'mainView', 'history': 'historyView', 'stats': 'statsView', 'addForm': 'entryForm',
        'settings': 'settingsView', 'challengesList': 'manageChallengesView',
        'challengeSelect': 'challengeSelectView', 'challengePlay': 'challengePlayView',
        'challengeSummary': 'challengeSummaryView', 'editChallenge': 'editChallengeView',
        'quickPlay': 'quickPlayView', 'tuner': 'tunerView', 'timer': 'timerView'
    };

    window.switchView = function(viewName, isBack = false) {
        if (viewAliasMap[viewName]) viewName = viewAliasMap[viewName];

        // Leaving the Blocks builder mid-edit (ML-97) discards the draft rather than stranding it -
        // there's no other hook for back-button/menu navigation away from the view.
        if (viewStack[viewStack.length - 1] === 'metroBuilderView' && viewName !== 'metroBuilderView' && metroBlkEditMode) {
            cancelMetroBlkEdit();
        }

        // Quick Play has no mini bar (unlike the single-bar tool it replaced/Metronome Blocks) - it's
        // always fully editable, so there's nothing sensible to keep "playing in the background"
        // without a visible transport. Leaving the view just pauses it in place.
        if (viewStack[viewStack.length - 1] === 'quickPlayView' && viewName !== 'quickPlayView' && qpPlayer.isPlaying()) {
            qpPlayer.pause();
            updateQPPlayIcon();
        }

        // Same reasoning as Quick Play above - Play Flow has no mini bar either, so leaving it just
        // pauses in place rather than continuing in the background. Covers the whole media
        // carousel now (ML-166), not just the metronome - whichever slide was playing.
        if (viewStack[viewStack.length - 1] === 'flowPlayView' && viewName !== 'flowPlayView') {
            pauseAllFlowMedia();
        }

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

        if (viewName === 'historyView') { document.getElementById('topTitle').innerText = 'Session history'; renderHistoryList(rawData); }
        if (viewName === 'streakStatsView') { document.getElementById('topTitle').innerText = 'Streaks'; renderStreakStats(); }
        if (viewName === 'statsView') { document.getElementById('topTitle').innerText = 'Detailed stats'; scrollStatsToRight(); }
        if (viewName === 'entryForm') { document.getElementById('topTitle').innerText = 'Add record'; }
        if (viewName === 'accountView') { document.getElementById('topTitle').innerText = 'My account'; loadAccountView(); }
        if (viewName === 'settingsView') {
            document.getElementById('topTitle').innerText = 'Settings';
            // Re-sync from storage in case the instrument was last changed on the Tuner page itself.
            document.getElementById('tunerInstrumentSetting').value = localStorage.getItem(TUNER_INSTRUMENT_DEFAULT_KEY) || 'C';
            document.getElementById('tunerUseFlatsToggle').checked = localStorage.getItem(TUNER_USE_FLATS_KEY) === 'true';
            document.getElementById('fermataPlaybackModeSetting').value = localStorage.getItem(FERMATA_PLAYBACK_MODE_KEY) || 'tone';
        }
        if (viewName === 'aboutView') { document.getElementById('topTitle').innerText = 'About'; renderAboutView(); }
        if (viewName === 'manageChallengesView') { document.getElementById('topTitle').innerText = 'Manage challenges'; renderChallengesList(); }
        if (viewName === 'challengeSelectView') { document.getElementById('topTitle').innerText = 'Select challenge'; renderChallengeSelect(); }
        if (viewName === 'challengePlayView') { document.getElementById('topTitle').innerText = 'Practise'; }
        if (viewName === 'challengeSummaryView') { document.getElementById('topTitle').innerText = 'Session complete'; topBackBtn.classList.add('hidden-btn'); }
        if (viewName === 'editChallengeView') { document.getElementById('topTitle').innerText = 'Edit challenge'; }
        if (viewName === 'quickPlayView') {
            document.getElementById('topTitle').innerText = 'Metronome';
            qpPlayer.prewarm();
            loadQuickPlayPlaybackSpeeds();
            if (qpBlocks.length) {
                // Already seeded from an earlier visit this session - no need to wait on the time
                // signature catalog again before rendering.
                renderQuickPlayRows();
            } else {
                // First visit this session: the default block's time signature comes from this catalog
                // (unlike Blocks' own scratch setup, which gets it from the server), so it has to be
                // loaded before seeding, or the first block would show "Choose..." until some unrelated
                // re-render happened to run afterwards. Chains onto the startup prefetch (ML-161)
                // instead of firing a second request, so this is normally already resolved by now.
                (metroBlkTimeSigReadyPromise || loadMetroBlkTimeSignatures()).then(() => {
                    initQuickPlayBlocksIfNeeded();
                    renderQuickPlayRows();
                });
            }
        }

        if (viewName === 'metroBuilderView') {
            // No title text here any more (ML-91) - the tuner toggle takes that spot in the top bar
            // instead, and the view is unambiguous from its content anyway.
            document.getElementById('topTitle').innerText = '';
            metroBlkPlayer.prewarm();
            loadMetroBlkTimeSignatures();
            loadMetroBlkPlaybackSpeeds();
            // ML-179: this entry screen's "Load from library" list is Flows now, not ad-hoc setups -
            // loadMetroBlkSetups/renderMetroBlkSetupsList/openMetroBlkSetup are left in place, unused,
            // same "superseded, not removed" precedent as elsewhere in this codebase.
            loadFlowsList();
            // ML-103: only resume straight into the editor when a setup is already active this
            // session (created/opened via the entry screen, or navigated back to without using
            // "Change flow" to back out) - otherwise show the entry screen instead of silently
            // auto-loading a scratch, so "new or open?" is always an explicit choice.
            if (metroBlkCurrentSetup) {
                renderMetroBlkSetupHeader();
                // Also refreshes the play queue/preview above if it's gone stale, and lands an
                // unsaved setup straight into Edit Mode rather than Play Mode (ML-97 follow-up).
                metroBlkEnterAppropriateMode();
                metroBlkShowEditorScreen();
            } else {
                metroBlkShowEntryScreen();
            }
        }

        // ML-179: currentFlowDetail is already fetched by openFlow/createAndOpenFlow before this
        // view is ever switched to - no fetch happens here, just rendering from what's already loaded
        // (same "load first, switch second" order as metroBuilderView's own setup loading above).
        // Details/Media/Blocks are tabs within this one view now (Jira tab restructure), not separate
        // views - flowEditRequestedTab lets a caller (the Play Flow 3-dot menu) land on a specific
        // tab; every other entry point falls back to Details.
        if (viewName === 'flowDetailsHubView') {
            document.getElementById('topTitle').innerText = flowEditMode === 'create' ? 'Create flow' : 'Edit flow';
            setFlowEditTab(flowEditRequestedTab || 'details');
            flowEditRequestedTab = null;
            loadAndRenderFlowDetailsHub();
        }
        if (viewName === 'flowPlayView') {
            document.getElementById('topTitle').innerText = 'Play flow';
            document.getElementById('flowPlayTitleLabel').innerText = currentFlowDetail?.title || 'Flow';
            flowPlayer.prewarm();
            loadFlowPlaybackSpeeds();
            // currentFlowBlocks/flowLeadInBlock were just re-fetched by goToFlowPlayView (or by
            // returning here after editing in the Blocks tab) - rebuild the queue fresh every entry,
            // same "don't trust it's still current" caution as refreshMetroBlkQueueIfStale.
            buildFlowPlayQueue();
            renderFlowPlaybackRow();
            // Same freshness reasoning as buildFlowPlayQueue above, for the media carousel
            // (ML-166) - currentFlowDetail.recordings was just re-fetched too.
            buildFlowMediaSlides();
            renderFlowMediaCarousel();
        }
        // Same persistence rule as the single-bar tool's mini bar (ML-64) - only visibility changes.
        updateMetroBlocksMiniBarVisibility(viewName);
        // The mini tuner widget is a single shared element (one mic session, one renderer - see
        // "Metronome Blocks mini tuner" below) physically relocated into whichever of Flow/Metronome
        // is the active view, rather than a copy living in each - moved before either view's own
        // dispatch above runs, so it's already in place if that view's setup code expects it there.
        if (viewName === 'metroBuilderView' || viewName === 'quickPlayView') {
            const hostView = document.getElementById(viewName);
            const tuner = document.getElementById('metroBlkMiniTuner');
            if (hostView && tuner && tuner.parentElement !== hostView) hostView.insertBefore(tuner, hostView.firstChild);
        }
        // Scoped to Flow/Metronome (unlike the timer/metronome mini-bars, it doesn't persist
        // elsewhere) - leaving both always closes it.
        updateMetroBlkMiniTunerVisibility(viewName);
        // The toggle that owns the tuner's on/off state (ML-91) only exists on these two screens.
        document.getElementById('topTunerToggleBtn')?.classList.toggle('hidden-group', viewName !== 'metroBuilderView' && viewName !== 'quickPlayView');

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
            // The full page already shows everything the inline box does - avoid duplicating it.
            closeTimerInlineBox();
        }
        // The timer itself is NOT stopped when navigating away (ML-7: "shrink to a
        // bar") - only the top-bar indicator's visibility changes.
        updateTopTimerIndicator(viewName);
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

        // ML-176: the Detailed stats screen's own inline filter strip - counts are session counts
        // for this same timeframe, same as the stat cards above, so they never shift just because a
        // pill got toggled off.
        renderFilterStrip('statsFilterPills', 'statsFilterBadge', {
            Practise: catStats['Practise'].s, Rehearsal: catStats['Rehearsal'].s,
            Lesson: catStats['Lesson'].s, Performance: catStats['Performance'].s
        }, totalSess, onFilterStripToggle);
    }

    // ML-176: replaces the old "Filter history/stats (All)" button + blocking checkbox modal on
    // both screens with an inline, 1-tap chip track - see docs on renderFilterStrip below. Order
    // matches the ticket's own wireframe (All, then Practise/Rehearsal/Lesson/Performance).
    const FILTER_CATEGORIES = ['Practise', 'Rehearsal', 'Lesson', 'Performance'];

    // Shared design-system renderer (see styleguide.html) for any screen's inline filter strip: the
    // leading icon's active-count badge plus the All/category pill track. counts/totalCount are
    // whatever the caller has already scoped (current month for History, current timeframe for
    // Stats) - toggling a pill never changes those counts, only which rows/totals elsewhere on the
    // page are currently shown, via onToggle. Re-run on every relevant re-render (not just once)
    // since it also has to reflect activeFilters changing.
    function renderFilterStrip(pillsId, badgeId, counts, totalCount, onToggle) {
        const pillsEl = document.getElementById(pillsId);
        if (!pillsEl) return;
        const activeCount = FILTER_CATEGORIES.filter(c => activeFilters[c]).length;

        const badgeEl = document.getElementById(badgeId);
        if (badgeEl) {
            badgeEl.innerText = activeCount;
            badgeEl.classList.toggle('hidden-group', activeCount === FILTER_CATEGORIES.length);
        }

        const allActive = activeCount === FILTER_CATEGORIES.length;
        pillsEl.innerHTML = `
            <button type="button" class="filter-pill${allActive ? ' active' : ''}" data-filter-all>All <span class="filter-pill-count">${totalCount}</span></button>
            ${FILTER_CATEGORIES.map(cat => `
                <button type="button" class="filter-pill${activeFilters[cat] ? ' active' : ''}" data-filter-cat="${cat}" style="${activeFilters[cat] ? `--filter-pill-accent:${colorMap[cat]}` : ''}">${cat} <span class="filter-pill-count">${counts[cat] || 0}</span></button>
            `).join('')}
        `;
        pillsEl.querySelector('[data-filter-all]').addEventListener('click', () => {
            FILTER_CATEGORIES.forEach(c => activeFilters[c] = true);
            onToggle();
        });
        pillsEl.querySelectorAll('[data-filter-cat]').forEach(btn => {
            btn.addEventListener('click', () => {
                activeFilters[btn.dataset.filterCat] = !activeFilters[btn.dataset.filterCat];
                onToggle();
            });
        });
    }

    // activeFilters is shared across both screens (as it already was pre-ML-176), so a toggle on
    // either one re-renders both - otherwise the screen you're not looking at would show a stale
    // pill highlight/badge next time you open it.
    function onFilterStripToggle() {
        renderStatsBoxes();
        renderFilteredVisuals();
    }

    function renderHistoryFilterStrip(monthDataAll) {
        const counts = { Practise: 0, Rehearsal: 0, Lesson: 0, Performance: 0 };
        monthDataAll.forEach(d => { if (counts[d.category] !== undefined) counts[d.category]++; });
        renderFilterStrip('historyFilterPills', 'historyFilterBadge', counts, monthDataAll.length, onFilterStripToggle);
    }

    // A mouse has no touch-swipe/trackpad-scroll equivalent for reaching an overflowing pill, so
    // desktop users otherwise have no way to see anything past the visible edge (the scrollbar is
    // deliberately hidden - see .filter-strip-pills in style.css). Wired once, directly on the
    // container itself (not the pills, which get torn down and rebuilt on every renderFilterStrip
    // call) - only actual drags (past a small pixel threshold) swallow the following click, so a
    // plain tap still toggles the pill exactly as before.
    function enableDragScroll(el) {
        let isDown = false, dragged = false, startX = 0, startScrollLeft = 0;
        el.addEventListener('mousedown', (e) => {
            isDown = true;
            dragged = false;
            startX = e.clientX;
            startScrollLeft = el.scrollLeft;
        });
        window.addEventListener('mousemove', (e) => {
            if (!isDown) return;
            const dx = e.clientX - startX;
            if (Math.abs(dx) > 5) {
                dragged = true;
                el.classList.add('dragging');
            }
            el.scrollLeft = startScrollLeft - dx;
        });
        window.addEventListener('mouseup', () => {
            isDown = false;
            el.classList.remove('dragging');
        });
        // Capture phase so this runs before the pill buttons' own (bubble-phase) click listeners -
        // stopping it here means a dragged-past pill never also registers as tapped.
        el.addEventListener('click', (e) => {
            if (dragged) {
                e.preventDefault();
                e.stopPropagation();
                dragged = false;
            }
        }, true);
    }
    document.querySelectorAll('.filter-strip-pills').forEach(enableDragScroll);

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
            renderHistoryList(rawData);
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
                    showAnchoredPopup(this, `${fDate}: ${type==='time' ? Math.round(val)+' mins' : Math.round(val)+' sess'}`);
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
            // Anchored to the bar itself (assigned below, read lazily on click), not barCont - barCont
            // spans the container's full height regardless of the bar's actual height, which otherwise
            // lands the popup at the top of the chart instead of next to the bar that was clicked.
            barCont.addEventListener('click', function() {
                let [y, m] = k.split('-');
                let mNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
                showAnchoredPopup(bar, `${mNames[parseInt(m, 10)-1]} ${y}: ${vStr}`);
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

    // ML-176: takes the full, unfiltered rawData (every call site used to pre-filter by
    // activeFilters before calling this - moved in here instead, since the filter strip's own
    // per-category pill counts need this month's full category breakdown, not just whichever
    // categories happen to still be active).
    function renderHistoryList(allData) {
        try {
            const y = currentHistDate.getFullYear();
            const m = currentHistDate.getMonth();
            const mNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
            const monthDisplay = document.getElementById('currentMonthDisplay');
            if(monthDisplay) monthDisplay.innerText = `${mNames[m]} ${y}`;

            const list = document.getElementById('historyList');
            if(!list) return;
            list.innerHTML = '';

            const monthDataAll = allData.filter(d => {
                let dObj = parseDateSafely(d.dateStr);
                return dObj.getFullYear()===y && dObj.getMonth()===m;
            });
            renderHistoryFilterStrip(monthDataAll);
            const monthData = monthDataAll.filter(d => activeFilters[d.category]);

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
                div.dataset.historyRow = item.row;
                div.dataset.historyCat = item.category;

                let dObj = parseDateSafely(item.dateStr);
                let mNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

                div.innerHTML = `
                    <div class="history-details">
                        <strong style="color: ${colorMap[item.category]}">${item.category} ${item.who ? '('+item.who+')' : ''}</strong>
                        ${dObj.getDate() || '?'} ${mNames[dObj.getMonth()] || '?'} ${dObj.getFullYear() || '?'} | ${Math.round(item.duration)} mins
                    </div>
                    <button type="button" class="list-item-menu-btn" data-session-history-menu-btn aria-label="Options for ${item.category} entry"><span class="material-symbols-outlined">more_vert</span></button>
                `;
                list.appendChild(div);
            });
            list.querySelectorAll('[data-session-history-menu-btn]').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const row = btn.closest('.history-item').dataset.historyRow;
                    const cat = btn.closest('.history-item').dataset.historyCat;
                    openSessionHistoryItemMenu(e.currentTarget, row, cat);
                });
            });
            const historySummary = document.getElementById('historySummary');
            if(historySummary) historySummary.innerText = `${formatMins(totalMins)} (${monthData.length})`;
        } catch (err) {
            const historyList = document.getElementById('historyList');
            if(historyList) historyList.innerHTML = `<div style="color:var(--danger-color); text-align:center; padding: 20px;">Error rendering history:<br>${err.message}</div>`;
            showWarningToast("History error: " + err.message);
        }
    }

    // --- TEACHERS (ML-135: relocated into My Account from the retired Manage Lists page - the
    // "Organisations" list that used to sit alongside it here is gone entirely, per that ticket;
    // appData.organisations still loads at startup (loadAppData) for the Lesson category's own "who"
    // dropdown, it just has no management UI of its own any more.) ---
    document.getElementById('showArchivedTeachers')?.addEventListener('change', renderTeacherList);

    // The Teachers list needs usedInHistory (which dropdown-options doesn't compute, to keep the
    // common app-load path cheap) so the edit modal can label its action button correctly before the
    // user opens it.
    async function loadTeacherList() {
        try {
            const data = await API.settings.getListsWithUsage();
            appData.organisations = data.organisations;
            appData.teachers = data.teachers;
            renderTeacherList();
        } catch (error) {
            showWarningToast('Error loading teachers: ' + error.message);
        }
    }

    function renderTeacherList() {
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
                await loadTeacherList();
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
            await loadTeacherList();
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
                await loadTeacherList();
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

    // ========================================
    // ACCOUNT (ML-77) - name/email/level/signup date + real band membership
    // (server/services/bands.js's shared directory, distinct from the private
    // per-account Teachers list above - see loadTeacherList).
    // ========================================
    const ACCOUNT_LEVEL_LABELS = {
        super_admin: 'Super admin', band_admin: 'Band admin', premium_member: 'Premium member',
        standard_member: 'Standard member', beta_tester: 'Beta tester'
    };
    let accountBandsData = { allBands: [], myBands: [] };

    // Also used at startup (see initializeApp) to show/hide the burger menu's
    // Administration link - admin.html itself gates to Super admin too, this
    // just avoids dangling the link in front of an account that would only
    // bounce off its "not authorized" notice.
    // ML-179: cached here (this already fetches the account level at startup)
    // rather than a second fetch just for the Flow Hub's own super-admin-only
    // menu items (renderFlowHubMenu) to check against.
    let currentAccountIsSuperAdmin = false;
    async function syncAdminLinkVisibility() {
        try {
            const profile = await API.account.get();
            currentAccountIsSuperAdmin = profile.accountLevel === 'super_admin';
            document.getElementById('adminNavLink')?.classList.toggle('hidden-group', !currentAccountIsSuperAdmin);
        } catch { /* not fatal - link just stays hidden */ }
    }

    function renderAccountBandsList() {
        const container = document.getElementById('accountBandsList');
        if (!container) return;
        if (!accountBandsData.myBands.length) {
            container.innerHTML = '<div class="text-muted">You haven\'t joined any bands yet.</div>';
        } else {
            container.innerHTML = accountBandsData.myBands.map(b => `
                <div class="history-item">
                    <span>${b.displayName}</span>
                    <button class="btn-icon-edit" data-band-menu-id="${b.id}" aria-label="Options for ${b.displayName}"><span class="material-symbols-outlined">more_vert</span></button>
                </div>
            `).join('');
            container.querySelectorAll('[data-band-menu-id]').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    openAccountBandMenu(e, btn.dataset.bandMenuId);
                });
            });
        }

        const picker = document.getElementById('accountBandPicker');
        if (picker) {
            const myBandIds = new Set(accountBandsData.myBands.map(b => b.id));
            const joinable = accountBandsData.allBands.filter(b => !myBandIds.has(b.id));
            picker.innerHTML = '<option value="">Choose a band to join&hellip;</option>' +
                joinable.map(b => `<option value="${b.id}">${b.displayName}</option>`).join('');
        }
    }

    // One shared floating menu for every band row (ML-89 follow-up), repositioned against whichever
    // row's own button opened it - same pattern as Metronome Blocks' per-tile menu
    // (openMetroBlkTileMenu). Leaving only removes this account's own membership - the band itself, and
    // everyone else's membership in it, is untouched, so it's never framed as a delete. Delete itself
    // is only offered (canDelete, from getAccountBands) when this account is the band's sole member
    // with no session history anywhere - otherwise deleting it would pull it out from under someone/
    // something else.
    let accountBandMenuTargetId = null;
    function openAccountBandMenu(e, bandId) {
        const menu = document.getElementById('accountBandMenu');
        if (!menu) return;
        accountBandMenuTargetId = bandId;
        const band = accountBandsData.myBands.find(b => String(b.id) === String(bandId));
        document.getElementById('accountBandMenuDelete')?.classList.toggle('hidden-group', !band?.canDelete);

        const btnRect = e.currentTarget.getBoundingClientRect();
        menu.classList.add('show');
        const menuWidth = menu.offsetWidth;
        const menuHeight = menu.offsetHeight;
        let left = btnRect.right - menuWidth;
        left = Math.max(8, Math.min(left, window.innerWidth - menuWidth - 8));
        let top = btnRect.bottom + 4;
        top = Math.min(top, window.innerHeight - menuHeight - 8);
        menu.style.left = `${left}px`;
        menu.style.top = `${top}px`;
    }
    function closeAccountBandMenu() {
        document.getElementById('accountBandMenu')?.classList.remove('show');
    }
    document.addEventListener('click', closeAccountBandMenu);
    document.getElementById('accountBandMenuLeave')?.addEventListener('click', (e) => {
        e.stopPropagation();
        const bandId = accountBandMenuTargetId;
        closeAccountBandMenu();
        const band = accountBandsData.myBands.find(b => String(b.id) === String(bandId));
        showConfirmModal('Leave band', `Leave "${band?.displayName || 'this band'}"? Anyone else in it will keep their own membership.`, async () => {
            try {
                await API.account.leaveBand(bandId);
                await loadAccountBands();
                showSuccessToast('Left band');
            } catch (error) {
                showWarningToast('Error leaving band: ' + error.message);
            }
        }, false, 'Leave');
    });
    document.getElementById('accountBandMenuDelete')?.addEventListener('click', (e) => {
        e.stopPropagation();
        const bandId = accountBandMenuTargetId;
        closeAccountBandMenu();
        const band = accountBandsData.myBands.find(b => String(b.id) === String(bandId));
        showConfirmModal('Delete band', `Delete "${band?.displayName || 'this band'}" completely? You're the only member and it has no history, so this removes it from the shared directory entirely - not just your own membership.`, async () => {
            try {
                await API.account.deleteBandFull(bandId);
                await loadAccountBands();
                showSuccessToast('Band deleted');
            } catch (error) {
                showWarningToast('Error deleting band: ' + error.message);
            }
        }, true);
    });

    async function loadAccountBands() {
        try {
            accountBandsData = await API.account.getBands();
            renderAccountBandsList();
        } catch (error) {
            showWarningToast('Error loading bands: ' + error.message);
        }
    }

    async function loadAccountView() {
        try {
            const profile = await API.account.get();
            document.getElementById('accountFirstNameInput').value = profile.firstName || '';
            document.getElementById('accountSurnameInput').value = profile.surname || '';
            document.getElementById('accountEmailReadout').innerText = profile.email;
            document.getElementById('accountLevelReadout').innerText = ACCOUNT_LEVEL_LABELS[profile.accountLevel] || profile.accountLevel;
            document.getElementById('accountJoinedReadout').innerText = profile.createdAt ? new Date(profile.createdAt).toLocaleDateString() : '-';
        } catch (error) {
            showWarningToast('Error loading account: ' + error.message);
        }
        await Promise.all([loadAccountBands(), loadTeacherList()]);
    }

    document.getElementById('accountSaveNameBtn')?.addEventListener('click', async () => {
        const firstName = document.getElementById('accountFirstNameInput').value.trim();
        const surname = document.getElementById('accountSurnameInput').value.trim();
        try {
            await API.account.update({ firstName, surname });
            showSuccessToast('Account updated');
        } catch (error) {
            showWarningToast('Error updating account: ' + error.message);
        }
    });

    document.getElementById('accountJoinBandBtn')?.addEventListener('click', async () => {
        const picker = document.getElementById('accountBandPicker');
        const bandId = picker?.value;
        if (!bandId) { showWarningToast('Choose a band first.'); return; }
        try {
            await API.account.joinBand(bandId);
            await loadAccountBands();
            showSuccessToast('Joined band');
        } catch (error) {
            showWarningToast('Error joining band: ' + error.message);
        }
    });

    document.getElementById('accountAddBandToggleBtn')?.addEventListener('click', () => {
        document.getElementById('accountAddBandSection')?.classList.toggle('hidden-group');
    });

    document.getElementById('accountAddBandBtn')?.addEventListener('click', async () => {
        const nameInput = document.getElementById('accountNewBandNameInput');
        const websiteInput = document.getElementById('accountNewBandWebsiteInput');
        const name = nameInput.value.trim();
        const website = websiteInput.value.trim();
        if (!name || !website) { showWarningToast('Band name and website are both required.'); return; }
        showInfoToast('Checking website...');
        try {
            await API.account.addBand(name, website);
            nameInput.value = '';
            websiteInput.value = '';
            document.getElementById('accountAddBandSection')?.classList.add('hidden-group');
            await loadAccountBands();
            showSuccessToast('Band added - you\'ve been joined to it');
        } catch (error) {
            showWarningToast('Error adding band: ' + error.message);
        }
    });

    document.getElementById('prevMonthBtn')?.addEventListener('click', () => {
        currentHistDate.setMonth(currentHistDate.getMonth() - 1);
        renderHistoryList(rawData);
    });
    document.getElementById('nextMonthBtn')?.addEventListener('click', () => {
        currentHistDate.setMonth(currentHistDate.getMonth() + 1);
        renderHistoryList(rawData);
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

        document.getElementById('editModal').style.display = 'flex';
    }

    // ML-175: one shared floating menu for every session history row (Edit/Delete), same
    // pattern/markup as Quick Play's own history menu (openQpHistoryItemMenu) - a single reusable
    // menu repositioned against whichever row's button was tapped, rather than one per row.
    let sessionHistoryMenuTarget = null;
    function openSessionHistoryItemMenu(btnEl, row, cat) {
        const menu = document.getElementById('sessionHistoryItemMenu');
        if (!menu) return;
        sessionHistoryMenuTarget = { row, cat };

        const btnRect = btnEl.getBoundingClientRect();
        menu.classList.add('show');
        const menuWidth = menu.offsetWidth;
        const menuHeight = menu.offsetHeight;
        let left = btnRect.right - menuWidth;
        left = Math.max(8, Math.min(left, window.innerWidth - menuWidth - 8));
        let top = btnRect.bottom + 4;
        top = Math.min(top, window.innerHeight - menuHeight - 8);
        menu.style.left = `${left}px`;
        menu.style.top = `${top}px`;
    }
    function closeSessionHistoryItemMenu() {
        document.getElementById('sessionHistoryItemMenu')?.classList.remove('show');
    }
    document.addEventListener('click', closeSessionHistoryItemMenu);
    document.getElementById('sessionHistoryItemEdit')?.addEventListener('click', (e) => {
        e.stopPropagation();
        const target = sessionHistoryMenuTarget;
        closeSessionHistoryItemMenu();
        if (!target) return;
        openEdit(Number(target.row), target.cat);
    });
    document.getElementById('sessionHistoryItemDelete')?.addEventListener('click', (e) => {
        e.stopPropagation();
        const target = sessionHistoryMenuTarget;
        closeSessionHistoryItemMenu();
        if (!target) return;
        const session = rawData.find(s => s.row === Number(target.row));
        if (!session) return showWarningToast('Session not found');
        deleteHistory(Number(target.row), target.cat, session.duration, session.who || '', session.dateStr);
    });

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
    // How long each toast type stays up before auto-dismissing - the one place to change a toast's
    // lifetime, since the countdown bar's own animation and the actual dismiss timer both read from
    // here rather than a duration hardcoded into each show*Toast call.
    const TOAST_DURATIONS_MS = { success: 4000, warning: 5000, info: 4000, undo: 3000 };

    // Per-toast-id pending dismiss timer, so opening the same toast again (or closing it early)
    // cancels whatever auto-dismiss was already scheduled instead of stacking another one.
    const toastDismissTimers = {};

    // Drives the visual auto-dismiss bar (see .toast-countdown-bar): snaps it back to full width with
    // no transition, forces that to actually paint (the rAF), then transitions it to 0 width over
    // durationMs - the shrink itself IS the countdown, no ticking number to keep in sync separately.
    // Returns the matching dismiss timer so callers can track/clear it alongside the bar.
    function startToastCountdownBar(barId, durationMs, onComplete) {
        const bar = document.getElementById(barId);
        if (bar) {
            bar.style.transition = 'none';
            bar.style.width = '100%';
            void bar.offsetWidth; // force the 100% state to actually commit before animating away from it
            bar.style.transition = `width ${durationMs}ms linear`;
            bar.style.width = '0%';
        }
        return setTimeout(onComplete, durationMs);
    }

    function showSuccessToast(msg, cat, sessionId) {
        closeToast('toastWarning');
        closeToast('toastInfo');
        const t = document.getElementById('toastSuccess');
        if(!t) return;
        const msgEl = document.getElementById('toastMsg');
        if(msgEl) msgEl.innerText = msg;
        clearTimeout(toastDismissTimers.toastSuccess);
        const undoBtn = document.getElementById('toastUndoBtn');
        if (cat && sessionId) {
            if (undoBtn) {
                undoBtn.style.display = '';
                undoBtn.onclick = async () => {
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
            }
        } else if (undoBtn) {
            undoBtn.style.display = 'none';
        }
        // display has to flip to visible BEFORE the bar's width dance starts, not after - a transition
        // begun while the toast is still display:none never actually animates (there's nothing
        // rendered yet for the browser to animate from), it just snaps straight to the end state the
        // instant display:flex reveals it.
        t.style.display = 'flex';
        toastDismissTimers.toastSuccess = startToastCountdownBar('toastSuccessBar', TOAST_DURATIONS_MS.success, () => closeToast('toastSuccess'));
    }

    function showWarningToast(msg) {
        closeToast('toastSuccess');
        closeToast('toastInfo');
        const t = document.getElementById('toastWarning');
        if(!t) return;
        const msgEl = document.getElementById('toastWarningMsg');
        if(msgEl) msgEl.innerText = msg;
        clearTimeout(toastDismissTimers.toastWarning);
        t.style.display = 'flex';
        toastDismissTimers.toastWarning = startToastCountdownBar('toastWarningBar', TOAST_DURATIONS_MS.warning, () => closeToast('toastWarning'));
    }

    function showInfoToast(msg) {
        const t = document.getElementById('toastInfo');
        if(!t) return;
        const msgEl = document.getElementById('toastInfoMsg');
        if(msgEl) msgEl.innerText = msg;
        clearTimeout(toastDismissTimers.toastInfo);
        t.style.display = 'flex';
        toastDismissTimers.toastInfo = startToastCountdownBar('toastInfoBar', TOAST_DURATIONS_MS.info, () => closeToast('toastInfo'));
    }

    // Generic "X happened [Undo]" toast (e.g. Quick Play's bar delete/move) - separate from
    // toastSuccess's own session-delete-undo special case above, since the undo action there is
    // hardcoded to API.sessions.delete. onUndo is whatever the caller needs to reverse; closing the
    // toast (by timeout or the X) without pressing Undo just lets the action stand.
    function showUndoToast(msg, onUndo) {
        closeToast('toastSuccess');
        closeToast('toastWarning');
        closeToast('toastInfo');
        const t = document.getElementById('toastUndo');
        if (!t) return;
        const msgEl = document.getElementById('toastUndoMsg');
        if (msgEl) msgEl.innerText = msg;
        clearTimeout(toastDismissTimers.toastUndo);
        const btn = document.getElementById('toastUndoActionBtn');
        if (btn) btn.onclick = () => {
            clearTimeout(toastDismissTimers.toastUndo);
            closeToast('toastUndo');
            onUndo();
        };
        t.style.display = 'flex';
        toastDismissTimers.toastUndo = startToastCountdownBar('toastUndoBar', TOAST_DURATIONS_MS.undo, () => closeToast('toastUndo'));
    }

    function closeToast(id) {
        const t = document.getElementById(id);
        if(t) t.style.display = 'none';
        clearTimeout(toastDismissTimers[id]);
    }
    window.closeToast = closeToast;

    // ML-75: a small popup anchored right next to the bar/heatmap square that was just clicked,
    // showing that one square's/bar's own value in context - replaces the old showInfoToast (bottom
    // of the screen, no anchoring) at those click sites specifically. position:fixed + getBoundingClientRect
    // so it's placed correctly regardless of whichever scrollable container (chart-scroll-area,
    // heatmap-wrapper) the anchor sits inside.
    let anchoredPopupEl = null;
    // Also clears any dismiss listener left over from a previous popup - without this, opening a
    // second popup (which calls this first) leaves the earlier popup's own "next click" listener still
    // pending, and since that listener is what THIS click's own bubble phase then triggers, the new
    // popup got destroyed the instant it was created (visible as "the popup only ever shows once").
    function hideAnchoredPopup() {
        if (anchoredPopupEl) { anchoredPopupEl.remove(); anchoredPopupEl = null; }
        document.removeEventListener('click', hideAnchoredPopup);
        window.removeEventListener('scroll', hideAnchoredPopup, true);
    }
    function showAnchoredPopup(anchorEl, text) {
        hideAnchoredPopup();
        const popup = document.createElement('div');
        popup.className = 'anchored-popup';
        popup.innerText = text;
        document.body.appendChild(popup);

        const anchorRect = anchorEl.getBoundingClientRect();
        const popupRect = popup.getBoundingClientRect();
        let left = anchorRect.left + anchorRect.width / 2 - popupRect.width / 2;
        left = Math.max(4, Math.min(left, window.innerWidth - popupRect.width - 4));
        let top = anchorRect.top - popupRect.height - 8;
        if (top < 4) top = anchorRect.bottom + 8; // not enough room above - show it below instead
        top = Math.max(4, Math.min(top, window.innerHeight - popupRect.height - 4));
        popup.style.left = `${left}px`;
        popup.style.top = `${top}px`;
        anchoredPopupEl = popup;

        // Dismissed by the next click anywhere, or a scroll of the page/chart underneath it - the
        // listeners are registered a tick later so the very click that opened the popup doesn't also
        // close it immediately.
        setTimeout(() => {
            document.addEventListener('click', hideAnchoredPopup, { once: true });
            window.addEventListener('scroll', hideAnchoredPopup, { once: true, capture: true });
        }, 0);
    }

    // ========================================
    // METRONOME ENGINE + SHARED HELPERS
    // Generic, value-agnostic pieces reused by every metronome-family tool below (Quick Play,
    // Metronome Blocks/Flow, and Blocks' own headphone-calibration loop) - the audio engine itself
    // (createMetronomePlayer), tempo-slider tier math (METRO_MIN_BPM/MAX_BPM/SLIDER_TIERS,
    // metroBestFitTier), dot-row rendering/scrolling (buildMetroDotRow, flashTierDot,
    // metroApplyDisplayWidth, metroLeftStyle, metroScrollFollow, resetMetroScrollPosition), and the
    // slider/stepper-readout interaction helpers just below. The single-bar Metronome tool that
    // originally lived here has been replaced by Quick Play (see that section further down) - nothing
    // tool-specific remains in this section any more, only what's actually shared.
    // ========================================
    const METRO_MIN_BPM = 15;
    const METRO_MAX_BPM = 500;
    const METRO_SLIDER_TIERS = [200, 350, 500];

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

        // --- ML-130: fermata (held-beat pause) playback. A block's fermata positions are fully known
        // before it starts playing (see setFermataSchedule, called once per block by the Flow/Metronome
        // Blocks glue that owns block/bar structure - this engine itself has no concept of either),
        // so held-beat decisions are entirely deterministic from the scheduler's own raw clickIndex -
        // no async coordination with the deferred beatListener callbacks needed. triggerClick values
        // are in the SAME numbering the scheduler already uses for clickIndex (raw base-click count
        // since the block/bar was last realigned via resetToBarStart/setBeatIndex). ---
        let fermataSchedule = []; // [{ triggerClick, holdBeats, holdClicks }]
        let fermataMode = 'tone'; // 'tone' | 'silent' | 'count' - mirrors FERMATA_PLAYBACK_MODE_KEY's 3 values
        let activeFermata = null; // { holdBeats, holdClicks, clicksRemaining } while a hold is in progress
        let fermataPendingEndKind = null; // set for exactly one click right after a hold finishes - 'tone-end' (fade the sustained tone) or 'normal' (silent/count modes have nothing extra to do)
        let fermataToneOsc = null;
        let fermataToneGain = null;
        const FERMATA_TONE_FREQ = 440;
        const FERMATA_TONE_LEVEL = 0.65; // of the normal click peak - masterGain already applies overall volume/mute, same as every other sound here
        const FERMATA_COUNT_THROUGH_FREQ = 330;
        // Prep cue - deliberately not the same 1760Hz 'tick' as a normal bar-start accent (that would
        // read as "a new bar/beat 1 just happened", not "the hold is about to end"). Triangle instead
        // of the normal clicks' square wave for a rounder, more clearly distinct texture, not just a
        // different pitch.
        const FERMATA_PREP_CUE_FREQ = 1200;

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
        // Factored out of playClick so the fermata "Count Through" mode's pitch-shifted click and
        // the prep cue (ML-130) can reuse the same short percussive envelope at a different
        // frequency/waveform, rather than duplicating the oscillator/gain boilerplate.
        function fireOscillatorBlip(freq, peak, dur, time, waveform = 'square') {
            const osc = audioCtx.createOscillator();
            const g = audioCtx.createGain();
            osc.type = waveform; // square: brighter/more harmonic-rich, reads as louder at the same peak and cuts through a lossy Bluetooth link better - the normal clicks' choice, not the prep cue's (see fireFermataPrepCue)
            osc.frequency.setValueAtTime(freq, time);
            g.gain.setValueAtTime(0.0001, time);
            g.gain.exponentialRampToValueAtTime(peak, time + 0.002);
            g.gain.exponentialRampToValueAtTime(0.0001, time + dur);
            osc.connect(g);
            g.connect(masterGain);
            osc.start(time);
            osc.stop(time + dur + 0.01);
        }
        function playClick(kind, time) {
            const freq = (kind === 'tick' ? 1760 : 650) * (lowPitch ? 0.5 : 1);
            const peak = kind === 'tick' ? 2.0 : 1.1; // pushed past 0dBFS - the limiter above tames it
            const dur = kind === 'tick' ? 0.035 : 0.045;
            fireOscillatorBlip(freq, peak, dur, time);
        }
        // A fermata hold's prep cue, one beat before resumption - genuinely distinct from either
        // normal click (not just a re-use of 'tick'), so it can't be mistaken for a bar-start accent
        // arriving early. Triangle wave (rounder than the normal clicks' square) at a pitch between
        // the two, held a touch longer, so it stands apart on both timbre and pitch.
        function fireFermataPrepCue(time) {
            fireOscillatorBlip(FERMATA_PREP_CUE_FREQ, 1.8, 0.05, time, 'triangle');
        }

        // --- ML-130 fermata audio primitives ---
        // "Tone + Cue": a single persistent oscillator/gain held across every click of the hold
        // (not recreated per click, unlike the one-shot playClick blips) - started here on the
        // hold's first click, warm sine at FERMATA_TONE_FREQ with a 10ms attack ramp to avoid
        // popping, at 65% of a normal click's level.
        function startFermataTone(time) {
            stopFermataToneImmediately();
            fermataToneOsc = audioCtx.createOscillator();
            fermataToneGain = audioCtx.createGain();
            fermataToneOsc.type = 'sine';
            fermataToneOsc.frequency.setValueAtTime(FERMATA_TONE_FREQ, time);
            fermataToneGain.gain.setValueAtTime(0.0001, time);
            fermataToneGain.gain.linearRampToValueAtTime(FERMATA_TONE_LEVEL, time + 0.01);
            fermataToneOsc.connect(fermataToneGain);
            fermataToneGain.connect(masterGain);
            fermataToneOsc.start(time);
        }
        // One beat before resumption: attenuate the sustained tone -6dB and layer the standard
        // accented click on top as a preparatory cue.
        function duckFermataTone(time) {
            if (!fermataToneGain) return;
            fermataToneGain.gain.linearRampToValueAtTime(FERMATA_TONE_LEVEL * 0.501, time);
        }
        // Fades the tone out over 5ms exactly at the resuming beat's own time, then lets that beat's
        // normal click proceed - called from applyFermataAudio, not scheduler() directly.
        function endFermataTone(time) {
            if (!fermataToneOsc) return;
            fermataToneGain.gain.linearRampToValueAtTime(0.0001, time + 0.005);
            fermataToneOsc.stop(time + 0.01);
            fermataToneOsc = null;
            fermataToneGain = null;
        }
        // Hard-stops any sustaining tone immediately (no fade) - used when pause()/stop() or a fresh
        // setFermataSchedule cuts playback off mid-hold, where there's no "next click" left to fade
        // gracefully into.
        function stopFermataToneImmediately() {
            if (!fermataToneOsc) return;
            try {
                fermataToneGain.gain.cancelScheduledValues(audioCtx.currentTime);
                fermataToneGain.gain.setValueAtTime(0.0001, audioCtx.currentTime);
                fermataToneOsc.stop(audioCtx.currentTime + 0.01);
            } catch (error) { /* already stopped */ }
            fermataToneOsc = null;
            fermataToneGain = null;
        }

        // Decides what THIS click (raw base-click index idx, matching clickIndex's own numbering)
        // should do, given the block's static fermataSchedule - called synchronously from inside
        // scheduler()'s own loop, before the click's audio is committed, so (unlike reacting from the
        // deferred beatListener callback) it can actually swap out a fermata's own trigger click for
        // the sustained-tone start rather than always playing that beat's normal sound first.
        // freezePosition: true for every click that's part of an in-progress hold (including its own
        // first and last) - the scheduler skips incrementing clickIndex for these, so idxInBar/the
        // beat-dot position genuinely stays put on the fermata's own beat for the whole hold, the same
        // way a real fermata suspends the beat rather than just re-colouring several beats in a row.
        function resolveFermataPulse(idx) {
            if (fermataPendingEndKind !== null) {
                const kind = fermataPendingEndKind;
                fermataPendingEndKind = null;
                return { kind, holding: false, freezePosition: false };
            }
            if (!activeFermata) {
                const match = fermataSchedule.find(f => f.triggerClick === idx);
                if (!match || match.holdClicks < 1) return { kind: 'normal', holding: false, freezePosition: false };
                activeFermata = { holdBeats: match.holdBeats, holdClicks: match.holdClicks, clicksRemaining: match.holdClicks };
            }
            const isFirst = activeFermata.clicksRemaining === activeFermata.holdClicks;
            const isLast = activeFermata.clicksRemaining === 1;
            const remaining = activeFermata.clicksRemaining;
            const holdBeats = activeFermata.holdBeats;
            activeFermata.clicksRemaining--;
            if (activeFermata.clicksRemaining <= 0) {
                activeFermata = null;
                fermataPendingEndKind = fermataMode === 'tone' ? 'tone-end' : 'normal';
            }
            let kind;
            if (fermataMode === 'silent') kind = isLast ? 'prep-cue' : 'silent';
            else if (fermataMode === 'count') kind = 'count-through';
            else kind = isFirst ? 'tone-start' : (isLast ? 'tone-end-with-cue' : 'tone-continue');
            return { kind, holding: true, remaining, holdBeats, isFirst, isLast, freezePosition: true };
        }

        // Carries out whatever resolveFermataPulse decided, in place of (or alongside) the click's own
        // otherwise-normal sound.
        function applyFermataAudio(result, normalKind, time) {
            switch (result.kind) {
                case 'normal': playClick(normalKind, time); break;
                // The beat's own normal click marks the exact instant the fermata begins (so it's
                // heard as a real note onset, not a silent gap that a tone just fades into), then the
                // sustained tone swells in underneath/alongside it.
                case 'tone-start': playClick(normalKind, time); startFermataTone(time); break;
                case 'tone-continue': break; // already sustaining - nothing new to trigger
                case 'tone-end-with-cue': duckFermataTone(time); fireFermataPrepCue(time); break;
                case 'tone-end': endFermataTone(time); playClick(normalKind, time); break; // the resuming beat still sounds normally
                case 'silent': break;
                case 'prep-cue': fireFermataPrepCue(time); break;
                case 'count-through': fireOscillatorBlip(FERMATA_COUNT_THROUGH_FREQ, 1.1, 0.045, time); break;
            }
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
            // anywhere in the new grid instead of at its start (ML-61). ML-130: also abandons any
            // fermata hold in progress (same cleanup as resetToBarStart/setBeatIndex) - a shape change
            // this abrupt has no meaningful "resume the hold" story, and leaving a Tone+Cue drone
            // sustaining forever with nothing left to ever fade it out would be a real bug.
            if (lastTotalPerBar !== null && totalPerBar !== lastTotalPerBar) {
                clickIndex = 0;
                stopFermataToneImmediately();
                activeFermata = null;
                fermataPendingEndKind = null;
            }
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
                // ML-130: resolved against clickIndex (raw, pre-freeze) - the fermata's own hold
                // occupies exactly this click position for as many pulses as it needs (freezePosition
                // below), so idx never itself changes mid-hold; resolveFermataPulse's own internal
                // clicksRemaining is what actually advances the hold along.
                const fermataResult = resolveFermataPulse(clickIndex);
                applyFermataAudio(fermataResult, kind, nextClickTime);

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
                        secondsPerConductorBeat,
                        fermataHold: fermataResult.holding
                            ? { remaining: fermataResult.remaining, holdBeats: fermataResult.holdBeats, isFirst: fermataResult.isFirst, isLast: fermataResult.isLast }
                            : null
                    }));
                }, delayMs);

                nextClickTime += secondsPerBaseClick();
                // A held pulse repeats the SAME beat/bar position rather than advancing to the next -
                // clickIndex only moves on once the hold (and its one dedicated "ending" pulse for
                // Tone+Cue's fade-out) has fully played out. See onFlowBeat/onMetroBlkBeat's matching
                // "don't count a repeat pulse as a new beat" gate on the UI side.
                if (!fermataResult.freezePosition) clickIndex++;
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
            // from this exact point in the bar rather than restarting it. Any fermata hold in
            // progress is abandoned (not resumed) - a sustained Tone+Cue drone left running while
            // "paused" would be its own bug, and the hold's remaining count has no clean meaning
            // once playback stops moving through time anyway.
            pause() {
                playing = false;
                clearTimeout(schedulerId);
                stopFermataToneImmediately();
                activeFermata = null;
                fermataPendingEndKind = null;
            },
            // Halts playback AND resets position back to the start of the bar.
            stop() {
                playing = false;
                clearTimeout(schedulerId);
                clickIndex = 0;
                stopFermataToneImmediately();
                activeFermata = null;
                fermataPendingEndKind = null;
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
            // ML-130: also abandons any in-progress fermata hold - a block boundary always brings its
            // own fresh setFermataSchedule call right after this, so a stale hold from the block just
            // left behind must not bleed into the new one's click positions.
            resetToBarStart() { clickIndex = 0; lastTotalPerBar = null; stopFermataToneImmediately(); activeFermata = null; fermataPendingEndKind = null; },
            // Same idea as resetToBarStart, but to an arbitrary beat within the bar - used to start a
            // partial lead-in on its actual first beat (the tail end of the bar, not index 0).
            setBeatIndex(n) { clickIndex = n; lastTotalPerBar = null; stopFermataToneImmediately(); activeFermata = null; fermataPendingEndKind = null; },
            // Pushes the next scheduled click back by this many seconds of silence, without touching
            // clickIndex - the click that eventually fires still lands on whatever beat resetToBarStart/
            // setBeatIndex already aligned to. The mid-playback counterpart to play()'s own
            // leadingSilenceSeconds argument (ML-92): used when a loop-back lands back on the lead-in
            // while already playing, where there's no play() call to pass the delay through.
            delayNextClick(seconds) {
                if (!seconds || !audioCtx) return;
                nextClickTime = Math.max(nextClickTime, audioCtx.currentTime) + seconds;
            },
            // A single, unscheduled click at the current volume - ML-148's live audio feedback while
            // adjusting volume with the metronome stopped, where there'd otherwise be no sound at all
            // to judge the level by. Deliberately bypasses the scheduler/clickIndex entirely (fires
            // immediately, doesn't touch playing state or bar position) since it's just a level check,
            // not a real beat.
            playTestClick() { ensureAudio().then(() => playClick('tick', audioCtx.currentTime)); },
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
            onBeat(cb) { beatListeners.push(cb); },
            // ML-130: call once per block (right after resetToBarStart/setBeatIndex, before/while it
            // plays) with that block's fermata trigger positions and the user's global playback-mode
            // setting. An empty list is the normal case for any block with no fermatas - Metronome
            // Blocks has no UI to create one yet, so it always passes [] today, but calls this the
            // same way Flow does, so the engine is exercised identically on both and needs no changes
            // whenever Metronome Blocks does grow that UI. Always abandons any hold already in
            // progress (a fresh schedule always means a new block has just started).
            setFermataSchedule(list, mode) {
                fermataSchedule = Array.isArray(list) ? list : [];
                fermataMode = mode || 'tone';
                stopFermataToneImmediately();
                activeFermata = null;
                fermataPendingEndKind = null;
            }
        };
    }

    // Headphone-delay compensation is the one setting genuinely shared across every metronome-family
    // tool (Quick Play, Metronome Blocks, and its calibration loop) since it's about the physical
    // output device, not any one tool's own timing model - see
    // setMetroLatencyMs/metroBlkPlayerRef/metroBlkCalibPlayerRef below. qpPlayerRef is filled in the
    // same way once Quick Play's own player exists further down. Every other
    // per-tool setting (bpm, volume, sub-beats, play speed) lives in that tool's own state instead.
    const metroState = {
        latencyMs: 0 // extra delay applied to the visual beat/baton only, to compensate for Bluetooth output lag
    };
    const METRO_LATENCY_KEY = 'metroLatencyMs';
    const METRO_LATENCY_STEP = 10;
    const METRO_LATENCY_MAX = 500;
    // ML-102: headphone delay is about the physical output device, not any one tool, so Metronome
    // Blocks' player and its headphone-calibration test loop share this same latency value rather than
    // keeping their own - these start null and get filled in once those players exist further down
    // (createMetronomePlayer calls that happen after this point in the module), letting
    // setMetroLatencyMs push to them too without caring which tool is currently open.
    let metroBlkPlayerRef = null;
    let metroBlkCalibPlayerRef = null;
    let qpPlayerRef = null;
    let flowPlayerRef = null;

    // Smallest tier that comfortably fits a value - used for direct/programmatic bpm changes.
    function metroBestFitTier(value) {
        for (const t of METRO_SLIDER_TIERS) if (value <= t) return t;
        return METRO_SLIDER_TIERS[METRO_SLIDER_TIERS.length - 1];
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

    // --- ML-130: fermata playback visuals - shared by Flow's own row (renderFlowPlaybackRow/
    // onFlowBeat) and Metronome Blocks' (renderMetroBlkRows/onMetroBlkBeat, both its main and mini
    // rows). Metronome Blocks has no UI to create a fermata yet, so block.fermatas is always []
    // there today - these all no-op cleanly on an empty list, the same way createMetronomePlayer's
    // own setFermataSchedule does, rather than needing a separate "does this tool support fermatas"
    // branch anywhere. ---

    // Turns a block's stored fermatas into the player's setFermataSchedule shape - triggerClick uses
    // the exact same raw base-click numbering the scheduler's own clickIndex does (bar-relative
    // beatOffset/barOffset scaled by beatsPerBar and the sub-beat factor), so a fermata lands on
    // precisely the beat it was placed on regardless of subdivision. Caesura entries are skipped
    // entirely for now - a separate follow-up, not implemented here.
    function buildFermataSchedule(block, subFactor) {
        if (!block || !block.fermatas || !block.fermatas.length) return [];
        const beatsPerBar = metroBlkBeatsPerBarFor(block);
        return block.fermatas
            .filter(f => f.kind !== 'caesura')
            .map(f => ({
                triggerClick: ((f.barOffset || 0) * beatsPerBar + (f.beatOffset - 1)) * subFactor,
                holdBeats: f.holdBeats,
                holdClicks: f.holdBeats * subFactor
            }));
    }
    function fermataPlaybackModeSetting() {
        return localStorage.getItem(FERMATA_PLAYBACK_MODE_KEY) || 'tone';
    }
    // 0-based bar-within-block, derived the same way metroBlkBlockLabel's own "X of Y" text is -
    // used by renderFlowPlaybackRow/renderMetroBlkRows to know which bar's fermata marker(s) (if any)
    // to show on a full row rebuild, which can happen well after bar 0 (sub-beats/play-speed changes
    // mid-block re-render the row from wherever playback currently sits, not just on block entry).
    function metroBlkCurrentBarIndex(block, beatsPlayedInBlock) {
        if (!block || block.pickupBeats) return 0;
        const beatsPerBar = metroBlkBeatsPerBarFor(block);
        return Math.min((block.barCount || 1) - 1, Math.floor((beatsPlayedInBlock || 0) / beatsPerBar));
    }

    // Persistent "holding" visual (glow + a live countdown numeral) - distinct from flashTierDot's own
    // 120ms flash, which still fires every pulse alongside this via the caller. Once a hold ends, the
    // dot doesn't snap straight back to looking plain - it settles into a static "fermata-done" gold
    // fill (no glow, no countdown) for the rest of the bar, cleared by renderFermataMarkers at the
    // next bar boundary (same lifecycle as the glyph marker above it), so there's still a clear "a
    // fermata happened here" record after the hold itself finishes rather than it vanishing the
    // instant playback moves on.
    function updateFermataDotState(rowId, beatInfo) {
        const row = document.getElementById(rowId);
        if (!row) return;
        row.querySelectorAll('.metro-dot.fermata-holding').forEach(dot => {
            const stillHolding = beatInfo.fermataHold && Number(dot.dataset.index) === beatInfo.clickIndexInBar;
            if (!stillHolding) {
                dot.classList.remove('fermata-holding');
                dot.querySelector('.metro-dot-count')?.remove();
                dot.classList.add('fermata-done');
            }
        });
        if (!beatInfo.fermataHold) return;
        const dot = row.querySelector(`.metro-dot[data-index="${beatInfo.clickIndexInBar}"]`);
        if (!dot) return;
        dot.classList.remove('fermata-done');
        dot.classList.add('fermata-holding');
        let countEl = dot.querySelector('.metro-dot-count');
        if (!countEl) {
            countEl = document.createElement('span');
            countEl.className = 'metro-dot-count';
            dot.appendChild(countEl);
        }
        countEl.textContent = String(beatInfo.fermataHold.remaining);
    }

    // The small fermata glyph shown above a beat's dot - visible for the whole time that beat's own
    // BAR is the one currently playing (not just during the active hold), and pans with the dots
    // since it's a sibling of them in the same scrolling row. currentBarIndex is 0-based, matching
    // block.fermatas' own barOffset. The row's own viewport (rowId with "Dots" swapped for
    // "Viewport" - true of every dot row in this app: flowPlayRowDots/flowPlayRowViewport,
    // metroBlkRow0Dots/metroBlkRow0Viewport, metroBlkMiniDots/metroBlkMiniViewport) clips overflow,
    // so it only gets extra top padding (metro-has-fermata-marker) while a marker actually needs the
    // room - permanently reserving that space on every row, fermata or not, would nudge every
    // metronome-family screen down a little for a feature most blocks never use.
    function renderFermataMarkers(rowId, block, currentBarIndex, subFactor) {
        const row = document.getElementById(rowId);
        if (!row) return;
        row.querySelectorAll('.metro-fermata-marker').forEach(el => el.remove());
        // A new bar's own dots are the same reused DOM elements a previous bar's fermata may have left
        // in the static "fermata-done" state (updateFermataDotState) - clear that here too, at the
        // same bar-boundary this already refreshes the marker on, rather than leaving a stale gold
        // dot from an earlier bar.
        row.querySelectorAll('.metro-dot.fermata-done').forEach(dot => dot.classList.remove('fermata-done'));
        const viewport = document.getElementById(rowId.replace(/Dots$/, 'Viewport'));
        const matches = (block?.fermatas || []).filter(f => f.kind !== 'caesura' && (f.barOffset || 0) === currentBarIndex);
        viewport?.classList.toggle('metro-has-fermata-marker', matches.length > 0);
        matches.forEach(f => {
            const dot = row.querySelector(`.metro-dot[data-index="${(f.beatOffset - 1) * subFactor}"]`);
            if (!dot) return;
            const marker = document.createElement('span');
            marker.className = 'metro-fermata-marker';
            marker.style.left = dot.style.left;
            marker.innerHTML = flowPauseIconSvg('fermata', false);
            row.appendChild(marker);
        });
    }

    // --- Slider (shared design-system component) drag + keyboard interaction ---
    // Value-agnostic: reports a 0-1 ratio for drags/clicks along the track, and a +-1 step for arrow
    // keys, leaving whatever the value actually means to the caller. Used by both the target-speed
    // BPM slider (3-stage rescaling track) and the plain 0-100 volume slider.
    // onRelease (ML-148) fires once whenever a single value has just been "settled" on - letting go
    // of the thumb after a drag, a direct tap/click on the track, or an arrow-key step - as opposed
    // to onDragRatio, which fires continuously while actually dragging. Volume's own live audio
    // feedback uses this to guarantee a confirmation click on release even if the drag itself was
    // rate-limited; every other slider simply doesn't pass it and behaves exactly as before.
    function setupSliderInteraction(track, thumb, { onDragRatio, onArrowStep, onRelease }) {
        if (!track || !thumb) return;

        function ratioFromClientX(clientX) {
            const rect = track.getBoundingClientRect();
            return Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
        }

        function onMove(e) { onDragRatio(ratioFromClientX(e.clientX)); }
        function onUp() {
            document.removeEventListener('pointermove', onMove);
            document.removeEventListener('pointerup', onUp);
            onRelease?.();
        }

        thumb.addEventListener('pointerdown', (e) => {
            e.preventDefault();
            document.addEventListener('pointermove', onMove);
            document.addEventListener('pointerup', onUp);
        });

        track.addEventListener('pointerdown', (e) => {
            if (e.target === thumb) return;
            onDragRatio(ratioFromClientX(e.clientX));
            onRelease?.();
        });

        if (onArrowStep) {
            thumb.addEventListener('keydown', (e) => {
                if (e.key === 'ArrowRight' || e.key === 'ArrowUp') { onArrowStep(1); onRelease?.(); }
                if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') { onArrowStep(-1); onRelease?.(); }
            });
        }
    }

    // Design system: any slider's numeric readout doubles as a tap target - clicking/tapping it
    // swaps in a real number input (pre-filled, focused, selected) so a value can be typed directly
    // instead of only dragging or stepping to it. Committing (blur or Enter) calls setValue and
    // restores the original display element in place; Escape cancels without calling it. Swaps the
    // SAME element back in (never destroyed, just detached while editing) so nothing else needs to
    // know the DOM changed - existing render functions keep working via the same id once restored.
    function makeSliderReadoutEditable(displayElOrId, getValue, setValue, opts = {}) {
        const displayEl = typeof displayElOrId === 'string' ? document.getElementById(displayElOrId) : displayElOrId;
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

    // ML-148: shared by every volume slider (Quick Play, Blocks) - a single click of audible feedback
    // at whatever volume was just set, so dragging with the metronome stopped isn't silent. Throttled
    // to at most once every 130ms while continuously dragging (per the ticket's 120-150ms range) so a
    // fast drag doesn't fire an overlapping flood of clicks; `force` bypasses that throttle for the
    // moments that must always produce a click regardless of recent throttle state - letting go of the
    // thumb, a +/- tap, committing a typed number, and the mute toggle.
    let lastVolumeTestClickAt = 0;
    const VOLUME_TEST_CLICK_THROTTLE_MS = 130;
    function playVolumeTestClick(player, force = false) {
        if (!player || player.isPlaying()) return; // already audible live, no test click needed
        const now = performance.now();
        if (!force && now - lastVolumeTestClickAt < VOLUME_TEST_CLICK_THROTTLE_MS) return;
        lastVolumeTestClickAt = now;
        player.playTestClick();
    }

    const METRO_CUSTOM_MAX = 50;

    // --- Headphone delay compensation (ML-102: shared across every metronome-family tool - it's
    // about the physical output device, not any one tool's own timing model - see
    // metroBlkPlayerRef/metroBlkCalibPlayerRef above) ---
    function renderMetroLatencyReadout() {
        const blkReadout = document.getElementById('metroBlkCalibLatencyMs');
        if (blkReadout) blkReadout.innerText = `${metroState.latencyMs} ms`;
    }
    function setMetroLatencyMs(ms) {
        metroState.latencyMs = Math.min(METRO_LATENCY_MAX, Math.max(0, ms));
        metroBlkPlayerRef?.setVisualLatencyMs(metroState.latencyMs);
        metroBlkCalibPlayerRef?.setVisualLatencyMs(metroState.latencyMs);
        qpPlayerRef?.setVisualLatencyMs(metroState.latencyMs);
        flowPlayerRef?.setVisualLatencyMs(metroState.latencyMs);
        localStorage.setItem(METRO_LATENCY_KEY, String(metroState.latencyMs));
        renderMetroLatencyReadout();
    }
    // Initial paint
    setMetroLatencyMs(parseInt(localStorage.getItem(METRO_LATENCY_KEY), 10) || 0);

    // ========================================
    // METRONOME BLOCKS (Jira ML-35) - the multi-bar sequencer tool, front-page name "Flow". Ad-hoc/
    // standalone only, see docs/database-schema.md "Scores & metronome
    // segments (Jira ML-35)". A separate tool with its own player instance (a second,
    // independent createMetronomePlayer() instance) - reuses the generic dot/
    // scroll helpers above (buildMetroDotRow, metroApplyDisplayWidth, flashTierDot,
    // metroScrollFollow, resetMetroScrollPosition - all already parametrised
    // by element id) rather than rebuilding them.
    // ========================================
    function escapeHtml(str) {
        return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    let metroBlkSetups = [];
    let metroBlkCurrentSetup = null; // { id, name, segments: [...] }, loaded when entering the builder
    let metroBlkTimeSigCache = { public: [], custom: [] };
    // ML-161: the promise from the one-off prefetch fired at startup (see initializeApp) - Quick
    // Play's first-ever render this session chains onto this instead of firing its own request, so
    // the DB round trip happens quietly during the app's initial load screen rather than as a visible
    // delay in the bar circles/bar 1 details when the Metronome page is opened. Every other caller
    // (creating a custom time signature, the Blocks builder, etc.) still calls loadMetroBlkTimeSignatures()
    // directly for a real refetch - this is only consulted at that one first-render gate.
    let metroBlkTimeSigReadyPromise = null;

    // --- Macro beats (ML-95): the big/accented playback circles follow the meter's own conductor
    // pulse (macroBeatsPerBar), not the raw time-signature numerator - a 9/8 block shows/clicks 3
    // large circles (one per dotted crotchet), not 9. subdivisionFactor is how many base clicks make
    // up one macro beat once sub-beats are showing (3 quavers per dotted-crotchet pulse for a compound
    // meter, 2 for a simple one). Simple/compound meters only -
    // irregular ones (5/8, 7/8, 10/8, 11/8, 5/4, 7/4, 5/16, 7/16) have unequal-length beats the
    // scheduler can't express yet (every conductor beat assumes the same wall-clock duration) and keep
    // today's behaviour via METRO_BLK_METER_FALLBACK - tracked as a follow-up, not built here.
    const METRO_BLK_METER_TABLE = {
        '2/2': { macroBeatsPerBar: 2, subdivisionFactor: 2 },
        '3/2': { macroBeatsPerBar: 3, subdivisionFactor: 2 },
        '4/2': { macroBeatsPerBar: 4, subdivisionFactor: 2 },
        '1/4': { macroBeatsPerBar: 1, subdivisionFactor: 2 },
        '2/4': { macroBeatsPerBar: 2, subdivisionFactor: 2 },
        '3/4': { macroBeatsPerBar: 3, subdivisionFactor: 2 },
        '4/4': { macroBeatsPerBar: 4, subdivisionFactor: 2 },
        '6/4': { macroBeatsPerBar: 2, subdivisionFactor: 3 },
        '8/4': { macroBeatsPerBar: 4, subdivisionFactor: 2 },
        '1/8': { macroBeatsPerBar: 1, subdivisionFactor: 2 },
        '2/8': { macroBeatsPerBar: 2, subdivisionFactor: 2 },
        '3/8': { macroBeatsPerBar: 3, subdivisionFactor: 2 },
        '4/8': { macroBeatsPerBar: 4, subdivisionFactor: 2 },
        '6/8': { macroBeatsPerBar: 2, subdivisionFactor: 3 },
        '9/8': { macroBeatsPerBar: 3, subdivisionFactor: 3 },
        '12/8': { macroBeatsPerBar: 4, subdivisionFactor: 3 },
        '3/16': { macroBeatsPerBar: 3, subdivisionFactor: 2 }
    };
    // macroBeatsPerBar null here means "not in the table" - resolved to the block's own raw
    // numerator below, i.e. exactly today's un-grouped behaviour.
    const METRO_BLK_METER_FALLBACK = { macroBeatsPerBar: null, subdivisionFactor: 2 };

    // Resolves a regular block's own macro-beat info; null for a lead-in (it never gets macro
    // grouping - see metroBlkBeatsPerBarFor/metroBlkSubFactorFor, both branch on isLeadIn instead of
    // relying on this returning null to signal it).
    function metroBlkMeterInfo(block) {
        if (!block || block.isLeadIn) return null;
        const row = METRO_BLK_METER_TABLE[`${block.numerator}/${block.denominator}`] || METRO_BLK_METER_FALLBACK;
        return { macroBeatsPerBar: row.macroBeatsPerBar ?? block.numerator, subdivisionFactor: row.subdivisionFactor };
    }

    // "Beats per bar" for progress/bar-boundary purposes - macroBeatsPerBar for a regular block,
    // the raw numerator for a lead-in (untouched by ML-95 - a lead-in is always a short fragment,
    // never subdivided or macro-grouped, see metroBlkRealignPlayer).
    function metroBlkBeatsPerBarFor(block) {
        return block.isLeadIn ? block.numerator : metroBlkMeterInfo(block).macroBeatsPerBar;
    }

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
    // Seconds of quiet space (ML-92) queued up by the most recent metroBlkRealignPlayer call, waiting
    // to be consumed by the next playMetroBlk() - see the comment there and on metroBlkRealignPlayer.
    let metroBlkPendingLeadInSilence = 0;
    // True for the duration of that quiet space - nothing is actually sounding yet, so the row's dots
    // show fully greyed out (see renderMetroBlkRows/.metroBlk-quiet-gap) rather than looking ready to
    // play. Cleared the instant the lead-in's real first click arrives (onMetroBlkBeat).
    let metroBlkQuietGapActive = false;
    // ML-138: how many times each isRepeatEnd block has already sent playback back to its repeat
    // start, keyed by segment id - independent repeat regions each track their own count, so more
    // than one repeated section can exist in the same sequence. Cleared on every fresh start (Reset/
    // buildMetroBlkPlayQueue) and whenever the whole sequence wraps back around (advanceMetroBlk), so
    // each fresh pass through the piece can repeat its sections again.
    let metroBlkRepeatCounts = {};
    // ML-139: an intro's pickup-style start offset is a one-time effect - only the jump made right
    // after Reset (or the very first load) is allowed to apply it (see jumpMetroBlkToStart). Every
    // other jump (normal advance, a repeat jump-back, a manual tap) sets this true so the intro's own
    // block plays out in full like any other bar once the intro chance has passed for this session.
    let metroBlkIntroConsumed = true;

    const metroBlkPlayer = createMetronomePlayer();
    metroBlkPlayerRef = metroBlkPlayer;
    metroBlkPlayer.setVisualLatencyMs(metroState.latencyMs);

    // --- Play Mode / Edit Mode (ML-97) ---
    // Play Mode (default) is the performance state: tapping a block jumps playback to it, nothing is
    // editable. Edit Mode (entered via the pencil/save icon next to the setup name) unlocks add/
    // reorder/delete and stages every change locally rather than autosaving it - metroBlkEditSnapshot
    // is a deep clone of { name, segments } taken the moment editing starts, restored verbatim by
    // Cancel with no server calls at all. Save is the only thing that writes any of it to the server,
    // in one batch (see saveMetroBlkEdit).
    let metroBlkEditMode = false;
    let metroBlkEditSnapshot = null;
    // Segments created while editing don't exist on the server yet, so they get a string id
    // (`typeof id === 'string'`) instead of a real numeric one until saveMetroBlkEdit creates them.
    let metroBlkTempSegCounter = 0;

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

    // Exact-match check against every name already shown in the "Saved setups" list (ML-91 follow-up,
    // pending ML-96 for the manual test) - the backend doesn't enforce uniqueness, but two setups with
    // the same name in that one short list is confusing enough to catch client-side before it happens.
    // excludeId lets a rename pass when the name isn't actually changing.
    function metroBlkNameIsTaken(name, excludeId) {
        return metroBlkSetups.some(s => s.id !== excludeId && s.name === name);
    }

    function renderMetroBlkSetupsList() {
        const ui = document.getElementById('metroBlkSetupsList');
        if (!ui) return;
        if (!metroBlkSetups.length) { ui.innerHTML = '<p>No saved setups yet - go back and choose "Create your own" to make one.</p>'; return; }
        ui.innerHTML = metroBlkSetups.map(s => `
            <div class="history-item" style="align-items:center;">
                <div style="flex-grow:1; cursor:pointer;" onclick="openMetroBlkSetup(${s.id})">
                    <strong>${escapeHtml(s.name)}</strong>
                    <div style="font-size:0.85rem; color:#666;">${s.blockCount} block${s.blockCount === 1 ? '' : 's'}${s.hasLeadIn ? ' + lead-in' : ''} &middot; ${formatMetroBlkDuration(s.totalSeconds)}</div>
                </div>
                <div class="metroBlk-setup-row-actions">
                    <button class="btn-icon-copy" aria-label="Copy" onclick="duplicateMetroBlkSetup(${s.id})"><span class="material-symbols-outlined">content_copy</span></button>
                    <button class="btn-icon-delete" aria-label="Delete setup" onclick="deleteMetroBlkSetup(${s.id})"><span class="material-symbols-outlined">delete</span></button>
                </div>
            </div>
        `).join('');
    }

    // An unsaved setup (a fresh scratch, or one navigated away from before saving) always lands in
    // Edit Mode, not Play Mode (ML-97 follow-up) - there's nothing meaningful to "play" or jump
    // around in until it's actually been named and has blocks worth performing, so landing on it
    // goes straight to configuring instead. A saved setup lands in Play Mode as before.
    // Renders tiles itself either way, so callers just need metroBlkCurrentSetup set first.
    function metroBlkEnterAppropriateMode() {
        if (metroBlkCurrentSetup && !metroBlkCurrentSetup.savedAt) {
            enterMetroBlkEditMode(); // renders tiles itself too
        } else {
            metroBlkEditMode = false;
            metroBlkEditSnapshot = null;
            renderMetroBlkEditUI();
            renderMetroBlockTiles();
        }
    }

    // The builder always has something loaded - a real saved setup, or the account's one
    // scratch (see server-side getOrCreateScratchSetup) seeded with a default 4/4 @ 120bpm
    // block so the tool is immediately playable with zero naming friction. Nothing is actually
    // written to the server until saveMetroBlkEdit runs (ML-97) - metroBlkEnterAppropriateMode
    // just lands the (unsaved) scratch straight into Edit Mode to configure it.
    async function loadMetroBlkDefaultSetup() {
        try {
            const fresh = await API.metronomeBlocks.setups.getScratch();
            fresh.segments = await normalizeMetroBlkOrder(fresh.segments);
            metroBlkCurrentSetup = fresh;
            renderMetroBlkSetupHeader();
            metroBlkEnterAppropriateMode();
            metroBlkShowEditorScreen();
        } catch (error) {
            showWarningToast('Error loading setup: ' + error.message);
        }
    }

    // ML-103: Flow's entry screen (create vs load) replaces the old silent auto-resolve into an
    // editor - see the switchView('metroBuilderView') branch above for when each is shown.
    function metroBlkShowEntryScreen() {
        document.getElementById('metroBlkEntryScreen')?.classList.remove('hidden-group');
        document.getElementById('metroBlkEditorScreen')?.classList.add('hidden-group');
        // Always reset back to the two-choice state, rather than leaving the library list expanded
        // from a previous visit.
        document.getElementById('metroBlkEntryLibrary')?.classList.add('hidden-group');
        document.querySelector('.metroBlk-entry-choices')?.classList.remove('hidden-group');
        document.getElementById('metroBlkEntryTitle').innerText = 'Flow';
    }

    // Shared by metroBlkEntryLoadBtn's own click and every other "jump straight to the library"
    // entry point (Play Flow's 3-dot menu) - reveals the list and swaps the section-title to say
    // so, rather than the generic "Flow" the two-choice screen shows.
    function showFlowLibraryList() {
        document.querySelector('.metroBlk-entry-choices')?.classList.add('hidden-group');
        document.getElementById('metroBlkEntryLibrary')?.classList.remove('hidden-group');
        document.getElementById('metroBlkEntryTitle').innerText = 'Flow library';
    }
    function metroBlkShowEditorScreen() {
        document.getElementById('metroBlkEntryScreen')?.classList.add('hidden-group');
        document.getElementById('metroBlkEditorScreen')?.classList.remove('hidden-group');
    }
    // ML-179: "Create your own" now creates a score-backed Flow (Flow Details Hub) instead of
    // jumping straight into the ad-hoc scratch builder - loadMetroBlkDefaultSetup is unreachable
    // from here now (its only other caller, deleteMetroBlkSetup, is itself unreachable the same
    // way - see the loadFlowsList comment above). Left in place per this file's usual precedent.
    document.getElementById('metroBlkEntryCreateBtn')?.addEventListener('click', () => {
        createAndOpenFlow();
    });
    document.getElementById('metroBlkEntryLoadBtn')?.addEventListener('click', showFlowLibraryList);
    // "Change flow": backs out to the entry screen from either Play or Edit Mode. In Edit Mode this
    // discards with no confirmation dialog, same as the existing Cancel button (cancelMetroBlkEdit) -
    // not a new UX pattern. Clears metroBlkCurrentSetup so a later plain nav-to-Flow asks again
    // instead of silently resuming (see the switchView branch above).
    document.getElementById('metroBlkChangeFlowBtn')?.addEventListener('click', () => {
        if (metroBlkEditMode) cancelMetroBlkEdit();
        metroBlkCurrentSetup = null;
        metroBlkShowEntryScreen();
    });

    // ========================================
    // FLOWS (Jira ML-179 Phase 1) - Flow Details Hub. See docs/database-schema.md's
    // "Flow" vs "Score" naming note (the table is `scores`, everything here says
    // "Flow") and the entry-screen rewiring above (loadFlowsList/createAndOpenFlow
    // now what "Create your own"/"Load from library" actually do).
    // ========================================
    let currentFlowId = null;
    let currentFlowDetail = null;
    let flowsListCache = [];

    async function loadFlowsList() {
        const ui = document.getElementById('metroBlkSetupsList');
        if (ui) ui.innerHTML = 'Loading...';
        try {
            flowsListCache = await API.flows.list();
            renderFlowsList();
        } catch (error) {
            showWarningToast('Error loading flows: ' + error.message);
        }
    }

    function flowOwnershipLabel(flow) {
        if (flow.isPublic) return 'Public';
        if (flow.ownerBandId) return 'Band';
        return 'Personal';
    }

    // Reuses the exact list container/row shape the old ad-hoc "Load from library" screen used
    // (#metroBlkSetupsList, .history-item) - just populated with Flows and opening openFlow instead
    // of openMetroBlkSetup. Duplicate/Delete are personal-flows-only for now (band/public sharing
    // makes "delete" a much bigger question - who's allowed to - that's a deliberate follow-up, not
    // an oversight), same "list-item-menu-btn + one shared floating menu" pattern as session history.
    function renderFlowsList() {
        const ui = document.getElementById('metroBlkSetupsList');
        if (!ui) return;
        if (!flowsListCache.length) { ui.innerHTML = '<p>No flows yet - go back and choose "Create your own" to make one.</p>'; return; }
        ui.innerHTML = flowsListCache.map(f => `
            <div class="history-item" data-flow-library-id="${f.id}">
                <div style="flex-grow:1; cursor:pointer;" onclick="openFlow(${f.id})">
                    <strong>${escapeHtml(f.title)}</strong>
                    <div style="font-size:0.85rem; color:#666;">${f.blockCount} bar${f.blockCount === 1 ? '' : 's'} &bull; ${flowOwnershipLabel(f)}</div>
                </div>
                ${flowOwnershipLabel(f) === 'Personal' ? `<button type="button" class="list-item-menu-btn" data-flow-library-menu-btn aria-label="Options for ${escapeHtml(f.title)}"><span class="material-symbols-outlined">more_vert</span></button>` : ''}
            </div>
        `).join('');
        ui.querySelectorAll('[data-flow-library-menu-btn]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const id = Number(btn.closest('[data-flow-library-id]').dataset.flowLibraryId);
                openFlowLibraryItemMenu(e.currentTarget, id);
            });
        });
    }

    let flowLibraryMenuTargetId = null;
    function openFlowLibraryItemMenu(btnEl, id) {
        flowLibraryMenuTargetId = id;
        const menu = document.getElementById('flowLibraryItemMenu');
        if (!menu) return;
        menu.classList.add('show');
        const btnRect = btnEl.getBoundingClientRect();
        const menuWidth = menu.offsetWidth;
        const menuHeight = menu.offsetHeight;
        let left = btnRect.right - menuWidth;
        left = Math.max(8, Math.min(left, window.innerWidth - menuWidth - 8));
        let top = btnRect.bottom + 4;
        top = Math.min(top, window.innerHeight - menuHeight - 8);
        menu.style.left = `${left}px`;
        menu.style.top = `${top}px`;
    }
    function closeFlowLibraryItemMenu() {
        document.getElementById('flowLibraryItemMenu')?.classList.remove('show');
    }
    document.addEventListener('click', closeFlowLibraryItemMenu);

    // Lands on the Details tab regardless of whether this flow already has bars (unlike openFlow's
    // own tap-the-row behaviour, which sends a non-empty flow straight to Play Flow) - the whole
    // point of this menu item is to edit, not play, so it always opens the Hub first (flowEditRequestedTab,
    // same mechanism Play Flow's own 3-dot menu uses), leaving Media/Blocks a tab tap away.
    document.getElementById('flowLibraryItemMenuEdit')?.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = flowLibraryMenuTargetId;
        closeFlowLibraryItemMenu();
        if (id === null) return;
        currentFlowId = id;
        flowEditMode = 'edit';
        flowEditRequestedTab = 'details';
        switchView('flowDetailsHubView');
    });
    document.getElementById('flowLibraryItemMenuDuplicate')?.addEventListener('click', async (e) => {
        e.stopPropagation();
        const id = flowLibraryMenuTargetId;
        closeFlowLibraryItemMenu();
        try {
            await API.flows.duplicate(id);
            await loadFlowsList();
            showSuccessToast('Flow duplicated');
        } catch (error) {
            showWarningToast('Error duplicating flow: ' + error.message);
        }
    });
    document.getElementById('flowLibraryItemMenuDelete')?.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = flowLibraryMenuTargetId;
        closeFlowLibraryItemMenu();
        showConfirmModal('Delete flow', "Delete this flow and all its bars, recordings, and documents? This can't be undone.", async () => {
            try {
                await API.flows.delete(id);
                await loadFlowsList();
                showSuccessToast('Flow deleted');
            } catch (error) {
                showWarningToast('Error deleting flow: ' + error.message);
            }
        }, true);
    });

    // Fetches the flow's metadata + full block list together and lands on Play Flow - shared by
    // "Load from library" (below) and the Hub's own "Play flow" button/3-dot menu. currentFlowDetail
    // is refetched here rather than trusted from wherever it was last loaded, same "don't trust it's
    // still current" caution as loadAndRenderFlowDetailsHub's own fetch.
    async function goToFlowPlayView(id) {
        try {
            const [detail, blocks] = await Promise.all([API.flows.get(id), API.flows.blocks.list(id)]);
            currentFlowDetail = detail;
            flowLeadInBlock = blocks.find(b => b.isLeadIn) || null;
            currentFlowBlocks = blocks.filter(b => !b.isLeadIn);
            switchView('flowPlayView');
        } catch (error) {
            showWarningToast('Error loading flow: ' + error.message);
        }
    }

    // Only sets which flow is open before deciding where to land - switchView's own flowDetailsHubView/
    // flowPlayView cases are what actually fetch and render, so returning here via the back button
    // (goBack -> switchView(..., true), never through openFlow/createAndOpenFlow again) still picks up
    // whatever changed there instead of showing a stale snapshot.
    // Selecting an existing flow from the library lands straight on Play Flow - the whole point of
    // loading one is to play already-built content. Only a flow with nothing to play yet
    // (blockCount === 0) falls back to the Hub, the same destination "Create your own" always uses
    // for a brand new flow (see createAndOpenFlow below).
    window.openFlow = function(id) {
        currentFlowId = id;
        flowEditMode = 'edit';
        const listEntry = flowsListCache.find(f => f.id === id);
        if (listEntry && listEntry.blockCount > 0) {
            goToFlowPlayView(id);
        } else {
            switchView('flowDetailsHubView');
        }
    };

    // No name required up front - personal-by-default, same no-friction feel as the old
    // loadMetroBlkDefaultSetup's scratch setup.
    async function createAndOpenFlow() {
        try {
            const created = await API.flows.create({});
            currentFlowId = created.id;
            flowEditMode = 'create';
            switchView('flowDetailsHubView');
        } catch (error) {
            showWarningToast('Error creating flow: ' + error.message);
        }
    }

    function formatFlowDate(dateStr) {
        if (!dateStr) return '–';
        const d = new Date(dateStr);
        const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
        return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
    }

    // --- Edit Flow tabs (Details/Media/Blocks) ---
    // Just show/hide panels + active-tab styling - no data fetching here, so it's safe to call
    // before loadAndRenderFlowDetailsHub's own fetch resolves (switchView's flowDetailsHubView case
    // does exactly that, so the right panel is visible immediately even while the network request
    // is still in flight).
    let flowEditActiveTab = 'details';
    function setFlowEditTab(tab) {
        flowEditActiveTab = tab;
        document.getElementById('flowEditTabDetailsBtn')?.classList.toggle('active', tab === 'details');
        document.getElementById('flowEditTabMediaBtn')?.classList.toggle('active', tab === 'media');
        document.getElementById('flowEditTabBlocksBtn')?.classList.toggle('active', tab === 'blocks');
        document.getElementById('flowEditTabDetailsBtn')?.setAttribute('aria-selected', String(tab === 'details'));
        document.getElementById('flowEditTabMediaBtn')?.setAttribute('aria-selected', String(tab === 'media'));
        document.getElementById('flowEditTabBlocksBtn')?.setAttribute('aria-selected', String(tab === 'blocks'));
        const detailsPanel = document.getElementById('flowEditDetailsTab');
        const mediaPanel = document.getElementById('flowEditMediaTab');
        const blocksPanel = document.getElementById('flowEditBlocksTab');
        if (detailsPanel) detailsPanel.style.display = tab === 'details' ? 'block' : 'none';
        if (mediaPanel) mediaPanel.style.display = tab === 'media' ? 'block' : 'none';
        if (blocksPanel) blocksPanel.style.display = tab === 'blocks' ? 'block' : 'none';
        updateFlowEditStickyBar();
    }
    // Guards leaving the Details tab (via a tab click or the sticky bar button) on an empty flow
    // name - same "required" rule the field itself already enforces on blur (wireFlowMetadataField),
    // just also blocking navigation so an empty name doesn't silently carry through to Media/Blocks.
    // Only meaningful for Create mode's guided chain - Edit mode has no chain to gate (tabs are
    // freely switchable there; the name is validated once, at Save time - see saveFlowEdit).
    function flowNameRequiredToLeaveDetails() {
        if (flowEditMode === 'edit' || flowEditActiveTab !== 'details') return true;
        const nameEl = document.getElementById('flowTitleInput');
        if (nameEl && nameEl.value.trim()) return true;
        showWarningToast('Enter a flow name first.');
        nameEl?.focus();
        return false;
    }
    // One pinned sticky bottom bar shared across all 3 tabs (index.html) instead of a separate
    // in-flow button at the end of each tab's own content. Its contents swap by *mode*, not just by
    // tab: Create mode is the guided Details->Bars->Media chain - one primary button shared across
    // all 3 tabs (label/action swaps with the active tab), plus a secondary "Add media" button that
    // only appears on the Bars tab, alongside the primary "Open player", as a second optional path
    // straight from Bars to Media. Edit mode replaces both of those with a fixed Cancel/Save row +
    // Delete link, shown identically regardless of which tab is active. Re-run on every
    // setFlowEditTab call, and separately from renderFlowBlocksStudio whenever Create mode's
    // "nothing to play yet" gate might have changed (a bar added/removed while already on the Bars
    // tab, not just on arrival).
    function updateFlowEditStickyBar() {
        const createBarActions = document.getElementById('flowEditCreateBarActions');
        const primaryBtn = document.getElementById('flowEditStickyActionBtn');
        const secondaryBtn = document.getElementById('flowEditStickySecondaryBtn');
        const saveBarActions = document.getElementById('flowEditSaveBarActions');
        const deleteLink = document.getElementById('flowDeleteLink');
        if (!createBarActions || !primaryBtn || !secondaryBtn || !saveBarActions || !deleteLink) return;

        if (flowEditMode === 'edit') {
            createBarActions.classList.add('hidden-group');
            saveBarActions.classList.remove('hidden-group');
            deleteLink.classList.remove('hidden-group');
            return;
        }

        createBarActions.classList.remove('hidden-group');
        saveBarActions.classList.add('hidden-group');
        deleteLink.classList.add('hidden-group');
        if (flowEditActiveTab === 'details') {
            secondaryBtn.classList.add('hidden-group');
            primaryBtn.innerHTML = 'Add bars <span class="btn-nav-arrow">&gt;</span>';
            primaryBtn.classList.remove('hidden-group');
        } else if (flowEditActiveTab === 'blocks') {
            secondaryBtn.classList.remove('hidden-group');
            primaryBtn.innerHTML = 'Open player <span class="btn-nav-arrow">&gt;</span>';
            // Same "nothing to play yet" gate as before - a lead-in alone still isn't playable.
            primaryBtn.classList.toggle('hidden-group', currentFlowBlocks.length === 0);
        } else {
            secondaryBtn.classList.add('hidden-group');
            primaryBtn.innerHTML = 'Open player <span class="btn-nav-arrow">&gt;</span>';
            primaryBtn.classList.toggle('hidden-group', currentFlowBlocks.length === 0);
        }
    }
    document.getElementById('flowEditTabDetailsBtn')?.addEventListener('click', () => setFlowEditTab('details'));
    document.getElementById('flowEditTabMediaBtn')?.addEventListener('click', () => { if (flowNameRequiredToLeaveDetails()) setFlowEditTab('media'); });
    document.getElementById('flowEditTabBlocksBtn')?.addEventListener('click', () => { if (flowNameRequiredToLeaveDetails()) setFlowEditTab('blocks'); });
    document.getElementById('flowEditStickySecondaryBtn')?.addEventListener('click', () => setFlowEditTab('media'));
    document.getElementById('flowEditStickyActionBtn')?.addEventListener('click', () => {
        if (flowEditActiveTab === 'details') {
            if (flowNameRequiredToLeaveDetails()) setFlowEditTab('blocks');
        } else if (currentFlowId) {
            switchView('flowPlayView');
        }
    });
    // Cancel needs no *server* revert - in Edit mode nothing is written to the server until Save
    // (see the Details/Media/Blocks sections below). But the in-memory currentFlowDetail/
    // currentFlowBlocks/flowLeadInBlock were mutated directly while staging the draft (same objects
    // other views read from without refetching - e.g. flowPlayView's own switchView case rebuilds
    // its queue straight off currentFlowBlocks), so those still need restoring from the snapshot
    // before leaving, or a cancelled add/edit would still show up wherever you land next. Exactly
    // the same restore cancelMetroBlkEdit does for metroBlkCurrentSetup.name/segments.
    document.getElementById('flowEditCancelBtn')?.addEventListener('click', () => {
        if (flowEditSnapshot && currentFlowDetail) {
            currentFlowDetail.title = flowEditSnapshot.title;
            currentFlowDetail.composer = flowEditSnapshot.composer;
            currentFlowDetail.arranger = flowEditSnapshot.arranger;
            currentFlowDetail.publisher = flowEditSnapshot.publisher;
            currentFlowDetail.description = flowEditSnapshot.description;
            currentFlowDetail.recordings = flowEditSnapshot.recordings;
            currentFlowDetail.documents = flowEditSnapshot.documents;
            flowLeadInBlock = flowEditSnapshot.leadIn;
            currentFlowBlocks = flowEditSnapshot.blocks;
        }
        flowEditSnapshot = null;
        goBack();
    });

    // Media's tab count is recordings (audio + YouTube) plus documents together - Blocks' is the
    // playable block count (lead-in excluded, same convention as everywhere else it's counted).
    function updateFlowEditTabCounts() {
        const recordings = currentFlowDetail?.recordings || [];
        const documents = currentFlowDetail?.documents || [];
        const mediaCountEl = document.getElementById('flowEditTabMediaCount');
        if (mediaCountEl) mediaCountEl.innerText = `(${recordings.length + documents.length})`;
        const blocksCountEl = document.getElementById('flowEditTabBlocksCount');
        if (blocksCountEl) blocksCountEl.innerText = `(${currentFlowBlocks.length})`;
    }

    // The single entry point into Edit Flow - see openFlow's own comment for why fetching lives here
    // rather than at each caller. Fetches the flow's metadata AND its block list together (unlike the
    // old separate Hub/Blocks Studio views) since Blocks is just a tab away now, not a fresh navigation.
    async function loadAndRenderFlowDetailsHub() {
        if (!currentFlowId) return;
        try {
            const [detail, blocks] = await Promise.all([API.flows.get(currentFlowId), API.flows.blocks.list(currentFlowId)]);
            currentFlowDetail = detail;
            flowLeadInBlock = blocks.find(b => b.isLeadIn) || null;
            currentFlowBlocks = blocks.filter(b => !b.isLeadIn);
            // Edit mode only - Create mode has no Cancel to revert to, so nothing to stage. Shallow
            // clone per item (not a deep JSON clone) is enough: every mutation below reassigns
            // fields/arrays rather than mutating one in place, so the snapshot's own references never
            // get touched by later edits - same reasoning metroBuilderView's own
            // enterMetroBlkEditMode/metroBlkEditSnapshot relies on.
            flowEditSnapshot = flowEditMode === 'edit' ? {
                title: currentFlowDetail.title, composer: currentFlowDetail.composer, arranger: currentFlowDetail.arranger,
                publisher: currentFlowDetail.publisher, description: currentFlowDetail.description,
                recordings: (currentFlowDetail.recordings || []).map(r => ({ ...r })),
                documents: (currentFlowDetail.documents || []).map(d => ({ ...d })),
                leadIn: flowLeadInBlock ? { ...flowLeadInBlock } : null,
                blocks: currentFlowBlocks.map(b => ({ ...b }))
            } : null;
            renderFlowDetailsHub();
            renderFlowBlocksStudio();
        } catch (error) {
            showWarningToast('Error loading flow: ' + error.message);
        }
    }

    function renderFlowDetailsHub() {
        const f = currentFlowDetail;
        if (!f) return;
        // A brand new flow already arrives with a real, ready-to-keep name (the server computes a
        // unique "Untitled"/"Untitled 1"/... via getUniqueDefaultFlowName) - shown verbatim, not
        // blanked out, so there's something sensible here even if the user never touches this field.
        document.getElementById('flowTitleInput').value = f.title || '';
        document.getElementById('flowComposerInput').value = f.composer || '';
        document.getElementById('flowArrangerInput').value = f.arranger || '';
        document.getElementById('flowPublisherInput').value = f.publisher || '';
        document.getElementById('flowDescriptionInput').value = f.description || '';
        document.getElementById('flowUploadedPill').innerText = `Created: ${formatFlowDate(f.createdAt)}`;

        renderFlowRecordingsList();
        renderFlowDocumentsList();
        updateFlowEditTabCounts();
    }

    // On-blur save (no separate Save button for this card in Create mode - see the plan's own note
    // on why) - skips the request entirely when the value hasn't actually changed. In Edit mode,
    // this only ever updates currentFlowDetail locally (no API call) - saveFlowEdit sends every
    // field in one PATCH when Save is pressed; Cancel just never calls it, so nothing here needs
    // reverting on Cancel either.
    function wireFlowMetadataField(inputId, field, required) {
        const el = document.getElementById(inputId);
        if (!el) return;
        el.addEventListener('blur', async () => {
            if (!currentFlowId) return;
            const value = el.value;
            if (required && !value.trim()) {
                showWarningToast('Flow name is required.');
                el.value = currentFlowDetail?.[field] || '';
                return;
            }
            if (currentFlowDetail && currentFlowDetail[field] === value) return;
            if (flowEditMode === 'edit') {
                if (currentFlowDetail) currentFlowDetail[field] = value;
                return;
            }
            try {
                currentFlowDetail = await API.flows.update(currentFlowId, { [field]: value });
            } catch (error) {
                showWarningToast('Error saving flow: ' + error.message);
            }
        });
    }
    wireFlowMetadataField('flowTitleInput', 'title', true);
    wireFlowMetadataField('flowComposerInput', 'composer');
    wireFlowMetadataField('flowArrangerInput', 'arranger');
    wireFlowMetadataField('flowPublisherInput', 'publisher');
    wireFlowMetadataField('flowDescriptionInput', 'description');

    // --- Delete flow - a plain text link (Details tab, below Next), not the old 3-dot dropdown item.
    // Move to a band/Remove from band/Publish/Unpublish used to live in that same dropdown - they're
    // dropped for now, pending a follow-up that wires them to the Visibility card instead (see its
    // own comment in index.html); the API methods themselves (API.flows.moveToBand etc.) are
    // untouched, just nothing in this view calls them at the moment. ---
    document.getElementById('flowDeleteLink')?.addEventListener('click', () => {
        if (!currentFlowId) return;
        showConfirmModal('Delete flow', `Delete "${currentFlowDetail?.title || 'this flow'}" and all its bars, recordings, and documents? This can't be undone.`, async () => {
            try {
                await API.flows.delete(currentFlowId);
                currentFlowId = null;
                currentFlowDetail = null;
                showSuccessToast('Flow deleted');
                goBack();
            } catch (error) {
                showWarningToast('Error deleting flow: ' + error.message);
            }
        }, true);
    });

    // Edit mode's local-only recording/document rows get a string temp id (`tmp1`, `tmp2`, ...)
    // instead of a real numeric one until saveFlowEdit creates them for real - same convention as
    // flowTempBlockCounter below.
    let flowTempMediaCounter = 0;
    // Recording adds normally resolve youtubeVideoId server-side (addYouTube just takes the raw
    // url) - Edit mode stages the row locally instead, so this does that same parse client-side
    // for preview purposes only. Handles the common watch/short/embed URL shapes.
    function flowParseYouTubeId(url) {
        const match = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{11})/);
        return match ? match[1] : '';
    }

    // --- Audio tracks / Video links cards (one "recordings" list from the API, split into two
    // cards by type - see the Media tab's own layout note in index.html) ---
    function flowMediaItemHtml(r, isYoutube) {
        const isVideo = !isYoutube && (r.mimeType || '').startsWith('video/');
        const icon = isYoutube ? 'smart_display' : (isVideo ? 'movie' : 'music_note');
        const meta = isYoutube ? 'YouTube video' : (r.mimeType || 'Audio/video file');
        // Inline player per row (native <audio>/<video> controls for an upload, an embedded
        // YouTube iframe for a link) rather than an "open in a new tab" button - the point of
        // this card is quick playback while looking at the rest of the flow, not a detour to
        // another tab/app for a "small set of controls" you'd get there anyway.
        let playerHtml;
        if (isYoutube) {
            playerHtml = `<div class="flow-media-player-video"><iframe src="https://www.youtube.com/embed/${encodeURIComponent(r.youtubeVideoId)}" title="${escapeHtml(r.title)}" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe></div>`;
        } else if (isVideo) {
            playerHtml = `<div class="flow-media-player-video"><video controls preload="metadata" src="${escapeHtml(r.blobUrl)}"></video></div>`;
        } else {
            playerHtml = `<audio class="flow-media-player-audio" controls preload="metadata" src="${escapeHtml(r.blobUrl)}"></audio>`;
        }
        return `
            <div class="history-item flow-media-item">
                <div class="flow-media-item-top">
                    <div class="history-details">
                        <span class="flow-media-icon ${isYoutube ? 'type-youtube' : 'type-audio'}"><span class="material-symbols-outlined" style="font-size:18px;">${icon}</span></span>
                        <div><strong>${escapeHtml(r.title)}</strong><span>${escapeHtml(meta)}</span></div>
                    </div>
                    <button type="button" class="flow-delete-btn" onclick="deleteFlowRecording('${r.id}')" aria-label="Delete ${escapeHtml(r.title)}"><span class="material-symbols-outlined">delete</span></button>
                </div>
                ${playerHtml}
            </div>
        `;
    }
    function renderFlowRecordingsList() {
        const recordings = currentFlowDetail?.recordings || [];
        const audioTracks = recordings.filter(r => r.type !== 'youtube');
        const videoLinks = recordings.filter(r => r.type === 'youtube');

        const audioList = document.getElementById('flowAudioTracksList');
        const audioCountPill = document.getElementById('flowAudioTracksCountPill');
        if (audioCountPill) audioCountPill.innerText = `${audioTracks.length} file${audioTracks.length === 1 ? '' : 's'}`;
        if (audioList) audioList.innerHTML = audioTracks.length ? audioTracks.map(r => flowMediaItemHtml(r, false)).join('') : '<p class="text-muted">No audio uploaded yet.</p>';

        const videoList = document.getElementById('flowVideoLinksList');
        const videoCountPill = document.getElementById('flowVideoLinksCountPill');
        if (videoCountPill) videoCountPill.innerText = `${videoLinks.length} linked`;
        if (videoList) videoList.innerHTML = videoLinks.length ? videoLinks.map(r => flowMediaItemHtml(r, true)).join('') : '<p class="text-muted">No video linked yet.</p>';

        updateFlowEditTabCounts();
    }

    window.deleteFlowRecording = function(recordingId) {
        if (!currentFlowId) return;
        showConfirmModal('Delete recording', 'Remove this recording from the flow?', async () => {
            // recordingId arrives as a string (quoted in the onclick so a temp id like "tmp3" isn't
            // a broken bare identifier) - String() both sides so a real numeric id still matches.
            if (flowEditMode === 'edit') {
                currentFlowDetail.recordings = (currentFlowDetail.recordings || []).filter(r => String(r.id) !== String(recordingId));
                renderFlowRecordingsList();
                return;
            }
            try {
                currentFlowDetail = await API.flows.recordings.delete(currentFlowId, recordingId);
                renderFlowRecordingsList();
            } catch (error) {
                showWarningToast('Error deleting recording: ' + error.message);
            }
        }, true);
    };

    document.getElementById('flowUploadRecordingBtn')?.addEventListener('click', () => {
        document.getElementById('flowRecordingFileInput')?.click();
    });
    document.getElementById('flowRecordingFileInput')?.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        e.target.value = '';
        if (!file || !currentFlowId) return;
        const progressBox = document.getElementById('flowRecordingUploadProgress');
        const nameEl = document.getElementById('flowRecordingUploadName');
        const percentEl = document.getElementById('flowRecordingUploadPercent');
        const fillEl = document.getElementById('flowRecordingUploadFill');
        nameEl.innerText = file.name;
        percentEl.innerText = '0%';
        fillEl.style.width = '0%';
        progressBox.classList.remove('hidden-group');
        try {
            // Goes straight from this browser to Blob storage (window.vercelBlobUpload, loaded via
            // the module script in index.html) - never through our own server, which is why the
            // separate confirm call below exists (see the upload-token route's own comment for why
            // it can't just rely on Blob's onUploadCompleted webhook).
            const blob = await window.vercelBlobUpload(`flows/${currentFlowId}/recordings/${file.name}`, file, {
                access: 'public',
                // Token travels as a query param, not the usual Authorization header - upload()
                // makes its own internal fetch() with a hardcoded header set (see
                // requireAuthFromQueryOrHeader's own comment in server/middleware/auth.js).
                handleUploadUrl: `${API_BASE_URL}/api/flows/${currentFlowId}/recordings/upload-token?token=${encodeURIComponent(auth.token)}`,
                onUploadProgress: (progress) => {
                    const pct = Math.round(progress.percentage);
                    percentEl.innerText = `${pct}%`;
                    fillEl.style.width = `${pct}%`;
                }
            });
            // The blob upload itself always happens immediately either way (it's just getting the
            // file into storage) - only "attach it to the flow" is staged in Edit mode.
            const uploaded = { blobUrl: blob.url, blobPathname: blob.pathname, fileName: file.name, fileSizeBytes: file.size, mimeType: blob.contentType || file.type };
            if (flowEditMode === 'edit') {
                currentFlowDetail.recordings = [...(currentFlowDetail.recordings || []), { id: `tmp${++flowTempMediaCounter}`, type: 'upload', title: file.name, ...uploaded }];
            } else {
                currentFlowDetail = await API.flows.recordings.addUploaded(currentFlowId, uploaded);
            }
            renderFlowRecordingsList();
            showSuccessToast('Recording uploaded');
        } catch (error) {
            showWarningToast('Error uploading recording: ' + error.message);
        } finally {
            progressBox.classList.add('hidden-group');
        }
    });

    document.getElementById('flowAddYouTubeBtn')?.addEventListener('click', () => {
        document.getElementById('flowYouTubeUrlInput').value = '';
        document.getElementById('flowYouTubeTitleInput').value = '';
        document.getElementById('flowYouTubeModal').style.display = 'flex';
    });
    document.getElementById('flowYouTubeSaveBtn')?.addEventListener('click', async () => {
        const url = document.getElementById('flowYouTubeUrlInput').value.trim();
        const title = document.getElementById('flowYouTubeTitleInput').value.trim();
        if (!url) return showWarningToast('YouTube link required.');
        if (!currentFlowId) return;
        try {
            if (flowEditMode === 'edit') {
                const youtubeVideoId = flowParseYouTubeId(url);
                if (!youtubeVideoId) return showWarningToast("Couldn't recognize that as a YouTube link.");
                currentFlowDetail.recordings = [...(currentFlowDetail.recordings || []), {
                    id: `tmp${++flowTempMediaCounter}`, type: 'youtube', title: title || 'YouTube video', sourceUrl: url, youtubeVideoId
                }];
            } else {
                currentFlowDetail = await API.flows.recordings.addYouTube(currentFlowId, { url, title });
            }
            document.getElementById('flowYouTubeModal').style.display = 'none';
            renderFlowRecordingsList();
            showSuccessToast('YouTube video added');
        } catch (error) {
            showWarningToast('Error adding YouTube video: ' + error.message);
        }
    });

    // --- Documents & scores card ---
    function renderFlowDocumentsList() {
        const list = document.getElementById('flowDocumentsList');
        const countPill = document.getElementById('flowDocumentsCountPill');
        const documents = currentFlowDetail?.documents || [];
        if (countPill) countPill.innerText = `${documents.length} file${documents.length === 1 ? '' : 's'}`;
        if (list) {
            list.innerHTML = documents.length ? documents.map(d => {
                const ext = (d.fileName.split('.').pop() || '?').toUpperCase();
                const sizeText = d.fileSizeBytes ? `${(d.fileSizeBytes / (1024 * 1024)).toFixed(1)} MB` : '';
                return `
                    <div class="history-item flow-doc-item">
                        <div class="history-details">
                            <span class="flow-doc-icon">${escapeHtml(ext.slice(0, 4))}</span>
                            <div><strong>${escapeHtml(d.fileName)}</strong><span>${sizeText}</span></div>
                        </div>
                        <div class="flow-doc-item-actions">
                            <button type="button" class="list-item-menu-btn" onclick="window.open('${d.blobUrl}', '_blank')" aria-label="View ${escapeHtml(d.fileName)}"><span class="material-symbols-outlined">visibility</span></button>
                            <button type="button" class="flow-delete-btn" onclick="deleteFlowDocument('${d.id}')" aria-label="Delete ${escapeHtml(d.fileName)}"><span class="material-symbols-outlined">delete</span></button>
                        </div>
                    </div>
                `;
            }).join('') : '<p class="text-muted">No documents uploaded yet.</p>';
        }
        updateFlowEditTabCounts();
    }

    window.deleteFlowDocument = function(documentId) {
        if (!currentFlowId) return;
        showConfirmModal('Delete document', 'Remove this document from the flow?', async () => {
            if (flowEditMode === 'edit') {
                currentFlowDetail.documents = (currentFlowDetail.documents || []).filter(d => String(d.id) !== String(documentId));
                renderFlowDocumentsList();
                return;
            }
            try {
                currentFlowDetail = await API.flows.documents.delete(currentFlowId, documentId);
                renderFlowDocumentsList();
            } catch (error) {
                showWarningToast('Error deleting document: ' + error.message);
            }
        }, true);
    };

    document.getElementById('flowUploadDocumentBtn')?.addEventListener('click', () => {
        document.getElementById('flowDocumentFileInput')?.click();
    });
    document.getElementById('flowDocumentFileInput')?.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        e.target.value = '';
        if (!file || !currentFlowId) return;
        const progressBox = document.getElementById('flowDocumentUploadProgress');
        const nameEl = document.getElementById('flowDocumentUploadName');
        const percentEl = document.getElementById('flowDocumentUploadPercent');
        const fillEl = document.getElementById('flowDocumentUploadFill');
        nameEl.innerText = file.name;
        percentEl.innerText = '0%';
        fillEl.style.width = '0%';
        progressBox.classList.remove('hidden-group');
        try {
            const blob = await window.vercelBlobUpload(`flows/${currentFlowId}/documents/${file.name}`, file, {
                access: 'public',
                // See the recordings upload handler above for why the token is a query param here.
                handleUploadUrl: `${API_BASE_URL}/api/flows/${currentFlowId}/documents/upload-token?token=${encodeURIComponent(auth.token)}`,
                onUploadProgress: (progress) => {
                    const pct = Math.round(progress.percentage);
                    percentEl.innerText = `${pct}%`;
                    fillEl.style.width = `${pct}%`;
                }
            });
            const uploaded = { blobUrl: blob.url, blobPathname: blob.pathname, fileName: file.name, fileSizeBytes: file.size, mimeType: blob.contentType || file.type };
            if (flowEditMode === 'edit') {
                currentFlowDetail.documents = [...(currentFlowDetail.documents || []), { id: `tmp${++flowTempMediaCounter}`, ...uploaded }];
            } else {
                currentFlowDetail = await API.flows.documents.add(currentFlowId, uploaded);
            }
            renderFlowDocumentsList();
            showSuccessToast('Document uploaded');
        } catch (error) {
            showWarningToast('Error uploading document: ' + error.message);
        } finally {
            progressBox.classList.add('hidden-group');
        }
    });

    // ========================================
    // BLOCKS STUDIO (Jira ML-179 Phase 2) - Full density view for score-backed Flow blocks
    // (parent_score_id on metronome_segments). The 2-col/4-col compact density views, and a
    // separate tap-to-open Block Inspector Modal for them, are a deferred follow-up - Full
    // already shows every one of the 12 parameters directly editable inline on each block's own
    // card (per the ticket's own Full-view spec), so there's nothing a modal would add here.
    // Create mode: every tile edit applies immediately (updateFlowBlock already merges partial
    // changes safely and re-validates the whole row), same as always. Edit mode: every mutation
    // below (flowUpdateBlock, create/delete/duplicate/reorder, lead-in create/delete) instead
    // stages locally with zero API calls, synced in one batch by saveFlowEdit - same
    // "stage-then-sync" pattern as metroBuilderView's own Edit Mode (metroBlkEditMode/
    // saveMetroBlkEdit), so Cancel needs no revert logic at all.
    // ========================================
    let currentFlowBlocks = [];
    let flowLeadInBlock = null;
    let flowBlockMenuTargetId = null;
    let flowFermataTargetBlockId = null;
    // Which block (if any) currently has its swipe-to-delete underlay revealed - at most one at a
    // time, same as Quick Play's own qpOpenSwipeIndex. Tracked by id rather than a DOM reference
    // since renderFlowBlocksList throws every node away on each render, which resets this to null too.
    let flowOpenSwipeBlockId = null;
    // Edit mode's locally-staged blocks get a string temp id (`tmp1`, `tmp2`, ...) instead of a
    // real numeric one until saveFlowEdit creates them for real.
    let flowTempBlockCounter = 0;

    // Every optional block field, at its natural falsy/null default - exactly what a fresh
    // server-created row already looks like. Spread first so `data` (the caller's actual values)
    // always wins for whatever it sets.
    function flowDefaultBlockFields() {
        return {
            isRepeatStart: false, isRepeatEnd: false, isSectionBoundary: false, isFinalBarline: false, repeatPlayCount: null,
            repeatEndingNumbers: [], repeatEndingStartBar: null, isFirstTimeBar: false, isSecondTimeBar: false,
            introStartBarOffset: null, introStartBeatOffset: null, introEndBarOffset: null, introEndBeatOffset: null,
            rampStartBarOffset: null, rampStartBeatOffset: null, rampDurationBars: null,
            isSegno: false, isCoda: false, gotoSegno: false, gotoSegnoThenCoda: false, gotoCoda: false, gotoStartDc: false,
            gotoStartDcThenCoda: false, isFine: false,
            rehearsalMark: null, rehearsalMarks: [], fermatas: [], ramps: [],
            pickupBeats: null, repeatLeadIn: false, quietSecondsBeforeLeadIn: 0, noteValue: null
        };
    }
    // Resolves the display fields (timeSignatureLabel/numerator/denominator) a locally-staged block
    // needs for rendering, off its raw timeSignatureId/accountTimeSignatureId - mirrors what the
    // server's own getBlockDtoById does via SQL join, done client-side since Edit mode stages block
    // changes locally instead of round-tripping to the server for every one. Shared by
    // buildLocalFlowBlockDto (a fresh block) and flowUpdateBlock's edit-mode branch (an existing one
    // whose time signature just changed) - both need the same re-resolution, or a picked signature
    // stays invisible/inert until the whole card rebuilds from a fresh server fetch.
    function flowResolveTimeSigFields(timeSignatureId, accountTimeSignatureId) {
        const list = timeSignatureId != null ? metroBlkTimeSigCache.public : metroBlkTimeSigCache.custom;
        const sig = list.find(t => t.id === (timeSignatureId ?? accountTimeSignatureId));
        return { timeSignatureLabel: sig ? sig.label : '', numerator: sig ? sig.numerator : 4, denominator: sig ? sig.denominator : 4 };
    }
    function buildLocalFlowBlockDto(data, existingId) {
        return {
            ...flowDefaultBlockFields(), ...data,
            id: existingId ?? `tmp${++flowTempBlockCounter}`,
            ...flowResolveTimeSigFields(data.timeSignatureId, data.accountTimeSignatureId)
        };
    }
    // Exactly the fields the block create/update API accepts, off a local (possibly draft) block
    // object - shared by saveFlowEdit's create and update calls. Field list mirrors
    // updateFlowBlock's own mergeKeys (server/services/flowBlocks.js) plus fermatas/rehearsalMarks.
    function flowBlockPayload(b) {
        return {
            barCount: b.barCount, bpm: b.bpm, isLeadIn: !!b.isLeadIn, repeatLeadIn: !!b.repeatLeadIn,
            quietSecondsBeforeLeadIn: b.quietSecondsBeforeLeadIn || 0, pickupBeats: b.pickupBeats,
            timeSignatureId: b.timeSignatureId, accountTimeSignatureId: b.accountTimeSignatureId, noteValue: b.noteValue,
            rehearsalMark: b.rehearsalMark, isRepeatStart: !!b.isRepeatStart, isRepeatEnd: !!b.isRepeatEnd,
            isSectionBoundary: !!b.isSectionBoundary, isFinalBarline: !!b.isFinalBarline, repeatPlayCount: b.repeatPlayCount,
            gotoCoda: !!b.gotoCoda, gotoStartDc: !!b.gotoStartDc, isCoda: !!b.isCoda, isSegno: !!b.isSegno,
            gotoSegno: !!b.gotoSegno, gotoSegnoThenCoda: !!b.gotoSegnoThenCoda,
            gotoStartDcThenCoda: !!b.gotoStartDcThenCoda, isFine: !!b.isFine,
            isFirstTimeBar: !!b.isFirstTimeBar, isSecondTimeBar: !!b.isSecondTimeBar,
            repeatEndingNumbers: b.repeatEndingNumbers || [], repeatEndingStartBar: b.repeatEndingStartBar ?? null,
            introStartBarOffset: b.introStartBarOffset, introStartBeatOffset: b.introStartBeatOffset,
            introEndBarOffset: b.introEndBarOffset, introEndBeatOffset: b.introEndBeatOffset,
            rampStartBarOffset: b.rampStartBarOffset, rampStartBeatOffset: b.rampStartBeatOffset, rampDurationBars: b.rampDurationBars,
            fermatas: b.fermatas || [], ramps: b.ramps || [], rehearsalMarks: b.rehearsalMarks || []
        };
    }
    // A block id read off a DOM dataset is always a string - numify it only when it's a real,
    // purely-numeric id, so a temp id (e.g. "tmp3") passes through unchanged and still compares
    // correctly (===) against b.id (a string for a draft block, a Number for a real one).
    function flowBlockIdFromDataset(raw) {
        return /^\d+$/.test(raw) ? Number(raw) : raw;
    }

    const FLOW_NOTE_VALUES = [
        { value: 'semibreve', label: 'Semibreve' },
        { value: 'minim', label: 'Minim' },
        { value: 'crotchet', label: 'Crotchet' },
        { value: 'dotted-crotchet', label: 'Dotted crotchet' },
        { value: 'quaver', label: 'Quaver' }
    ];
    const FLOW_NOTE_ABBREV = { semibreve: 'o', minim: 'h', crotchet: 'q', 'dotted-crotchet': 'q.', quaver: 'e' };

    function flowFindBlockById(id) {
        if (flowLeadInBlock && flowLeadInBlock.id === id) return flowLeadInBlock;
        return currentFlowBlocks.find(b => b.id === id);
    }

    // Approximate - a real value would need to account for tempo ramps mid-block; fine for a
    // rough "~Xm Ys total" estimate, same spirit as the ad-hoc side's own formatMetroBlkDuration.
    function flowTotalRuntimeSeconds(blocks) {
        return blocks.reduce((total, b) => total + (b.bpm && b.numerator ? (b.barCount * b.numerator * 60) / b.bpm : 0), 0);
    }

    // "Block 1"/"Block 2" never actually identified anything - the written bar range does. Lead-in
    // is excluded from the count (it isn't numbered), same convention as Play Flow's own tile
    // headline (flowStartingBarNumber's logic, inlined here since a card needs the range's end too,
    // not just its start). Recomputed on every render, so a drag reorder updates it for free.
    function flowBlockBarRange(index) {
        let start = 1;
        for (let i = 0; i < index; i++) start += currentFlowBlocks[i].barCount || 0;
        const barCount = currentFlowBlocks[index] ? (currentFlowBlocks[index].barCount || 1) : 1;
        return { start, end: start + barCount - 1 };
    }
    function flowBarRangeLabel(index) {
        const { start, end } = flowBlockBarRange(index);
        return start === end ? `Bar ${start}` : `Bars ${start} to ${end}`;
    }

    function renderFlowBlocksStudio() {
        const all = flowLeadInBlock ? [flowLeadInBlock, ...currentFlowBlocks] : currentFlowBlocks;
        const totalBars = all.reduce((sum, b) => sum + (b.barCount || 0), 0);
        const totalSeconds = flowTotalRuntimeSeconds(all);
        const mins = Math.floor(totalSeconds / 60);
        const secs = Math.round(totalSeconds % 60);
        document.getElementById('flowStudioSummaryText').innerText = `${totalBars} bar${totalBars === 1 ? '' : 's'} • ~${mins}m ${secs}s total`;
        // The sticky bar's "Use flow" state (hidden-group when there's nothing to play yet) depends
        // on currentFlowBlocks, which just changed - refresh it here too, not only on tab switch.
        updateFlowEditStickyBar();
        renderFlowLeadIn();
        renderFlowBlocksList();
        updateFlowEditTabCounts();
    }

    async function flowUpdateBlock(blockId, data) {
        // Edit mode: merge the partial update straight onto the local object (same "merge only
        // what's present" shape the server's own updateFlowBlock does) - no API call until Save.
        if (flowEditMode === 'edit') {
            const target = flowFindBlockById(blockId);
            if (!target) return;
            Object.assign(target, data);
            // Time signature is stored as an id but displayed via derived fields resolved from the
            // catalog (flowResolveTimeSigFields) - without this, picking a signature (a preset, or a
            // custom one just created) leaves the tile showing whatever was there before, since
            // Object.assign only touched timeSignatureId/accountTimeSignatureId, not the label/
            // numerator/denominator the card actually renders.
            if (data.timeSignatureId !== undefined || data.accountTimeSignatureId !== undefined) {
                Object.assign(target, flowResolveTimeSigFields(target.timeSignatureId, target.accountTimeSignatureId));
            }
            renderFlowBlocksStudio();
            return;
        }
        try {
            const updated = await API.flows.blocks.update(blockId, data);
            if (flowLeadInBlock && flowLeadInBlock.id === blockId) {
                flowLeadInBlock = updated;
            } else {
                currentFlowBlocks = currentFlowBlocks.map(b => b.id === blockId ? updated : b);
            }
            renderFlowBlocksStudio();
        } catch (error) {
            showWarningToast('Error updating bar: ' + error.message);
        }
    }

    // --- Lead-in: pinned, no drag handle, 3-tile row (bars/loop repeat/seconds rest). ---
    function renderFlowLeadIn() {
        const card = document.getElementById('flowLeadInCard');
        const addBtn = document.getElementById('flowAddLeadInBtn');
        if (!card || !addBtn) return;
        if (!flowLeadInBlock) {
            card.classList.add('hidden-group');
            addBtn.classList.remove('hidden-group');
            return;
        }
        card.classList.remove('hidden-group');
        addBtn.classList.add('hidden-group');
        const b = flowLeadInBlock;
        const tiles = document.getElementById('flowLeadInTiles');
        tiles.innerHTML = `
            <button type="button" class="flow-tile" data-lead-tile="bars"><span class="flow-tile-value">${b.barCount}</span><span class="flow-tile-label">bars</span></button>
            <button type="button" class="flow-tile" data-lead-tile="loopRepeat"><span class="flow-tile-value">${b.repeatLeadIn ? 'On' : 'Off'}</span><span class="flow-tile-label">loop repeat</span></button>
            <button type="button" class="flow-tile" data-lead-tile="secondsRest"><span class="flow-tile-value">${b.quietSecondsBeforeLeadIn}</span><span class="flow-tile-label">seconds rest</span></button>
        `;
        tiles.querySelectorAll('[data-lead-tile]').forEach(btn => {
            btn.addEventListener('click', () => handleFlowLeadInTileClick(btn.dataset.leadTile));
        });
    }

    function handleFlowLeadInTileClick(tileKey) {
        const b = flowLeadInBlock;
        if (!b) return;
        if (tileKey === 'bars') {
            showPromptModal('Lead-in bars', String(b.barCount), (val) => {
                const n = Number(val);
                if (!Number.isInteger(n) || n < 1) return showWarningToast('Enter a whole number of 1 or more.');
                flowUpdateBlock(b.id, { barCount: n });
            });
        } else if (tileKey === 'loopRepeat') {
            flowUpdateBlock(b.id, { repeatLeadIn: !b.repeatLeadIn });
        } else if (tileKey === 'secondsRest') {
            showPromptModal('Seconds of rest before the lead-in', String(b.quietSecondsBeforeLeadIn), (val) => {
                const n = Number(val);
                if (!Number.isInteger(n) || n < 0) return showWarningToast('Enter a non-negative whole number.');
                flowUpdateBlock(b.id, { quietSecondsBeforeLeadIn: n });
            });
        }
    }

    document.getElementById('flowLeadInMenuBtn')?.addEventListener('click', (e) => {
        e.stopPropagation();
        document.getElementById('flowLeadInMenu')?.classList.toggle('show');
    });
    function closeFlowLeadInMenu() {
        document.getElementById('flowLeadInMenu')?.classList.remove('show');
    }
    document.addEventListener('click', closeFlowLeadInMenu);
    document.getElementById('flowLeadInMenuDelete')?.addEventListener('click', (e) => {
        e.stopPropagation();
        closeFlowLeadInMenu();
        if (!flowLeadInBlock) return;
        showConfirmModal('Delete lead-in', 'Remove the lead-in?', async () => {
            if (flowEditMode === 'edit') {
                flowLeadInBlock = null;
                renderFlowBlocksStudio();
                return;
            }
            try {
                await API.flows.blocks.delete(flowLeadInBlock.id);
                flowLeadInBlock = null;
                renderFlowBlocksStudio();
            } catch (error) {
                showWarningToast('Error deleting lead-in: ' + error.message);
            }
        }, true);
    });

    document.getElementById('flowAddLeadInBtn')?.addEventListener('click', async () => {
        if (!currentFlowId) return;
        const firstBlock = currentFlowBlocks[0];
        const data = {
            barCount: 2,
            bpm: firstBlock ? firstBlock.bpm : 120,
            timeSignatureId: firstBlock ? firstBlock.timeSignatureId : (metroBlkTimeSigCache.public[0] ? metroBlkTimeSigCache.public[0].id : null),
            accountTimeSignatureId: firstBlock ? firstBlock.accountTimeSignatureId : null,
            isLeadIn: true
        };
        if (flowEditMode === 'edit') {
            flowLeadInBlock = buildLocalFlowBlockDto(data);
            renderFlowBlocksStudio();
            return;
        }
        try {
            flowLeadInBlock = await API.flows.blocks.create(currentFlowId, data);
            renderFlowBlocksStudio();
        } catch (error) {
            showWarningToast('Error adding lead-in: ' + error.message);
        }
    });

    // --- Musical symbol glyphs (segno/coda) - the real Unicode Musical Symbols characters (U+1D10B
    // Segno, U+1D10C Coda), rendered in Noto Music (loaded in index.html) rather than hand-drawn SVG -
    // a properly designed notation glyph beats an approximation, and Noto Music actually covers these
    // two codepoints (most fonts don't, which is why a webfont is loaded for them specifically instead
    // of trusting whatever's on the system). Plain currentColor-inheriting text, so it themes/sizes
    // itself for free wherever it's dropped - no separate light/dark or selected-state handling
    // needed. `inline` sizes it to sit inline with text (the jump tile's "D.<segno>"/"al <coda>"
    // labels); otherwise it's the picker's own larger glyph size. ---
    function flowSignIconSvg(kind, inline) {
        const cls = inline ? 'flow-sign-svg-inline' : 'flow-sign-svg';
        if (kind === 'segno') return `<span class="${cls}">\u{1D10B}</span>`;
        // Noto Music draws the coda glyph's own ink noticeably smaller within its character box than
        // segno's, even at an identical font-size - flow-sign-svg-coda bumps it back up to read as
        // the same visual size as segno alongside it.
        if (kind === 'coda') return `<span class="${cls} flow-sign-svg-coda">\u{1D10C}</span>`;
        return '';
    }
    // Fermata/caesura glyphs - same real-Unicode-Musical-Symbols-via-Noto-Music approach as segno/coda
    // above (U+1D110 fermata, U+1D113 caesura - the actual "//" break mark), reusing the same
    // .flow-sign-svg(-inline) classes since they're generic Noto Music glyph renderers, not
    // sign-specific despite the name.
    function flowPauseIconSvg(kind, inline) {
        const cls = inline ? 'flow-sign-svg-inline' : 'flow-sign-svg';
        if (kind === 'fermata') return `<span class="${cls}">\u{1D110}</span>`;
        if (kind === 'caesura') return `<span class="${cls}">\u{1D113}</span>`;
        return '';
    }

    // Barline glyphs - same hand-drawn SVG approach as flowSignIconSvg above, real notation rather
    // than standing in with "|"/"|:" characters. `muted` (plain barline only, used by the pickers
    // below) draws it in the same label colour as an unset tile, deliberately lighter/less bold than
    // the other options it sits next to.
    function flowBarlineIconSvg(kind, cls, muted) {
        const c = cls ? ` class="${cls}"` : '';
        if (kind === 'repeatStart') {
            // Thick line on the outside (left - the very start of the repeated section), thin line
            // just inside it, dots facing further right into the section that repeats.
            return `<svg viewBox="0 0 32 56"${c}><line x1="10" y1="6" x2="10" y2="50" stroke="currentColor" stroke-width="5"/><line x1="18" y1="6" x2="18" y2="50" stroke="currentColor" stroke-width="2"/><circle cx="26" cy="20" r="2.4" fill="currentColor"/><circle cx="26" cy="36" r="2.4" fill="currentColor"/></svg>`;
        }
        if (kind === 'repeatEnd') {
            // Mirror of repeatStart - dots face left into the section that just played, thin line
            // then the thick line on the outside (right - the far edge of the repeated section).
            return `<svg viewBox="0 0 32 56"${c}><circle cx="6" cy="20" r="2.4" fill="currentColor"/><circle cx="6" cy="36" r="2.4" fill="currentColor"/><line x1="14" y1="6" x2="14" y2="50" stroke="currentColor" stroke-width="2"/><line x1="22" y1="6" x2="22" y2="50" stroke="currentColor" stroke-width="5"/></svg>`;
        }
        if (kind === 'fine') {
            // The final barline (end of the piece) - a thin line followed by a thick line, no dots.
            return `<svg viewBox="0 0 32 56"${c}><line x1="12" y1="6" x2="12" y2="50" stroke="currentColor" stroke-width="2"/><line x1="20" y1="6" x2="20" y2="50" stroke="currentColor" stroke-width="5"/></svg>`;
        }
        if (kind === 'section') {
            // A plain double barline (a mid-piece section boundary) - two thin lines, same weight,
            // distinct from "fine" above where the second line is heavy.
            return `<svg viewBox="0 0 32 56"${c}><line x1="12" y1="6" x2="12" y2="50" stroke="currentColor" stroke-width="2"/><line x1="20" y1="6" x2="20" y2="50" stroke="currentColor" stroke-width="2"/></svg>`;
        }
        const color = muted ? 'var(--label-color)' : 'currentColor';
        return `<svg viewBox="0 0 32 56"${c}><line x1="16" y1="6" x2="16" y2="50" stroke="${color}" stroke-width="3" stroke-linecap="round"/></svg>`;
    }

    // --- Reorderable blocks: label helpers (each mirrors a small slice of the schema - see
    // docs/database-schema.md's "Journey/repeat wiring" note for what each column means). Repeats/
    // intro and Changes/jumps tiles deliberately stay standard-input coloured regardless of value -
    // no gold-filled state - unlike Core's own tiles, which never had one either. ---
    function flowStartLabel(b) { return flowBarlineIconSvg(b.isRepeatStart ? 'repeatStart' : 'plain'); }
    // 2x is the implicit default (same as picking "Repeat" with no count at all) - never shown, in
    // the picker or here, so the card matches exactly what was selected there.
    function flowRepeatCountLabel(n) { return n === 2 ? '' : `${n}x`; }
    function flowEndLabel(b) {
        if (b.isRepeatEnd) {
            const icon = flowBarlineIconSvg('repeatEnd');
            // Same smaller, vertically-centered-with-the-icon count as the End of bar picker's own
            // tiles (.flow-picker-tile-count) - not full tile-value size/baseline.
            const countLabel = flowRepeatCountLabel(b.repeatPlayCount || 2);
            return countLabel
                ? `<span class="flow-barline-value-row">${icon}<span class="flow-barline-value-count">${countLabel}</span></span>`
                : icon;
        }
        if (b.isFinalBarline) return flowBarlineIconSvg('fine');
        // Fine reuses Section's plain double-bar glyph plus a "Fine" tag, same .flow-barline-value-row/
        // -count pattern isRepeatEnd's own count uses above - not a distinct barline shape of its own.
        if (b.isFine) return `<span class="flow-barline-value-row">${flowBarlineIconSvg('section')}<span class="flow-barline-value-count">Fine</span></span>`;
        if (b.isSectionBoundary) return flowBarlineIconSvg('section');
        return flowBarlineIconSvg('plain');
    }
    // Generic status glyph (Repeat bar/volta's stale start-bar warning today, reusable wherever else
    // a value needs flagging as "needs fixing" rather than silently wrong or silently clamped).
    function flowWarningIconSvg(cls) {
        const c = cls ? ` class="${cls}"` : '';
        return `<svg viewBox="0 0 24 24"${c} fill="none"><path d="M12 4L22 20H2L12 4Z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><line x1="12" y1="10" x2="12" y2="15" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><circle cx="12" cy="18" r="1.2" fill="currentColor"/></svg>`;
    }
    // Tempo ramp glyph - a rising diagonal (accelerando) by default, mirrored into a falling one
    // (ritardando) when the direction is known - same hand-drawn-SVG approach as
    // flowBarlineIconSvg/flowWarningIconSvg above. 'flat' (the target bpm resolves to exactly the
    // current one - unusual, but not itself invalid) gets a plain rightward arrow instead of either.
    function flowRampIconSvg(direction, cls) {
        const c = cls ? ` class="${cls}"` : '';
        if (direction === 'down') {
            return `<svg viewBox="0 0 24 24"${c} fill="none"><path d="M4 6L18 18" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/><path d="M10 18H18V10" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
        }
        if (direction === 'flat') {
            return `<svg viewBox="0 0 24 24"${c} fill="none"><path d="M3 12H17" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/><path d="M12 7L19 12L12 17" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
        }
        return `<svg viewBox="0 0 24 24"${c} fill="none"><path d="M4 18L18 6" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/><path d="M10 6H18V14" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
    }
    // Resolves whether a ramp speeds up, slows down, or holds - null only when the target itself
    // can't be resolved yet (a 'next_block' target with no next block - always caught by
    // flowRampInvalid before this is reached, so callers can treat null as "can't happen" in
    // practice, not a case they need their own fallback for).
    function flowRampDirection(r, block, nextBlock) {
        const fromBpm = Number(block.bpm);
        const toBpm = r.targetMode === 'custom' ? Number(r.targetBpm) : (nextBlock ? Number(nextBlock.bpm) : null);
        if (toBpm === null || !Number.isFinite(toBpm) || !Number.isFinite(fromBpm)) return null;
        if (toBpm > fromBpm) return 'up';
        if (toBpm < fromBpm) return 'down';
        return 'flat';
    }
    // "1-3,5&7-9." - consecutive runs collapse to a range ([1,2,3] -> "1-3", a lone number stays
    // bare), commas between all but the last two tokens, "&" joining the final pair, and a single
    // full stop at the very end (not one per number/range) - squashed up, no spaces.
    function flowFormatRepeatPasses(nums) {
        const sorted = [...nums].sort((a, b) => a - b);
        if (!sorted.length) return '';
        const tokens = [];
        let rangeStart = sorted[0];
        let rangeEnd = sorted[0];
        for (let i = 1; i < sorted.length; i++) {
            if (sorted[i] === rangeEnd + 1) { rangeEnd = sorted[i]; continue; }
            tokens.push(rangeStart === rangeEnd ? `${rangeStart}` : `${rangeStart}-${rangeEnd}`);
            rangeStart = rangeEnd = sorted[i];
        }
        tokens.push(rangeStart === rangeEnd ? `${rangeStart}` : `${rangeStart}-${rangeEnd}`);
        const joined = tokens.length <= 1 ? (tokens[0] || '') : `${tokens.slice(0, -1).join(',')}&${tokens[tokens.length - 1]}`;
        return `${joined}.`;
    }
    // Repeat-ending numbers (ML-179 follow-up, db/migrations/034_repeat_ending_numbers.sql) - a
    // superset of the old binary 1st/2nd pair, e.g. [1,3,5] for "plays on passes 1, 3 and 5 only".
    // Empty state is a plain "+" (matching flowBlockMarkEmpty's own muted-tile language) rather than
    // the word "None" every other tile's empty state uses - this tile opens straight into a form,
    // not a list of named options, so "+" reads as "add one" instead.
    // Start/end bars aren't DB-bounded against bar count (db/migrations/037_volta_start_bar.sql) - if
    // the block is shortened after one's set, it's left stranded outside the block. Rather than a
    // small inline warning icon next to otherwise-stale content, the whole tile flags this: a big
    // triangle + "Update" replaces the tile's normal value, and .flow-tile-warning reddens the tile
    // itself (flowBlockCardHtml) - same treatment for the alt-ending tile and the intro tile.
    function flowRepeatBarInvalid(b) {
        return !!(b.repeatEndingStartBar && b.barCount && b.repeatEndingStartBar > b.barCount);
    }
    function flowIntroInvalid(b) {
        const maxBar = b.barCount || 1;
        const startBad = b.introStartBarOffset !== null && b.introStartBarOffset !== undefined && b.introStartBarOffset > maxBar;
        const endBad = b.introEndBarOffset !== null && b.introEndBarOffset !== undefined && b.introEndBarOffset > maxBar;
        return startBad || endBad;
    }
    function flowPauseInvalid(b) {
        const maxBar = b.barCount || 1;
        return (b.fermatas || []).some(f => ((f.barOffset || 0) + 1) > maxBar);
    }
    function flowTileUpdateWarning() {
        return `<span class="flow-tile-value-warning">${flowWarningIconSvg('flow-tile-warning-icon')}<span class="flow-tile-value-warning-text">Update</span></span>`;
    }
    function flowRepeatBarLabel(b) {
        if (flowRepeatBarInvalid(b)) return flowTileUpdateWarning();
        const nums = b.repeatEndingNumbers || [];
        if (!nums.length) return '<span class="flow-tile-value-empty">+</span>';
        const text = escapeHtml(flowFormatRepeatPasses(nums));
        // Real volta-bracket notation (the corner drawn by .flow-volta-bracket::before in CSS) - a
        // line above the figures with a downward tick immediately to their left, running alongside
        // them - not just plain text, same "hand-drawn real notation" language as flowBarlineIconSvg.
        const bracket = `<span class="flow-volta-bracket"><span class="flow-volta-bracket-numbers">${text}</span></span>`;
        const fromBar = b.repeatEndingStartBar
            ? `<span class="flow-volta-from-bar">from bar ${b.repeatEndingStartBar}</span>`
            : '';
        return `${bracket}${fromBar}`;
    }
    function flowIntroLabel(b) {
        if (flowIntroInvalid(b)) return flowTileUpdateWarning();
        const hasStart = b.introStartBarOffset !== null && b.introStartBarOffset !== undefined;
        const hasEnd = b.introEndBarOffset !== null && b.introEndBarOffset !== undefined;
        if (!hasStart && !hasEnd) return '<span class="flow-tile-value-empty">+</span>';
        const spansMultiple = hasStart && hasEnd && b.introStartBarOffset !== b.introEndBarOffset;
        const text = spansMultiple ? `Bars ${b.introStartBarOffset}-${b.introEndBarOffset}`
            : hasStart ? `Bar ${b.introStartBarOffset}`
            : `Bar ${b.introEndBarOffset}`;
        // Real-notation cue bracket (the corner drawn by .flow-intro-bracket's ::before/::after in
        // CSS) - a tall tick to the left of the text and a line underneath, same "hand-drawn real
        // notation" language as flowBarlineIconSvg/the volta bracket. The right-hand tick only shows
        // once an end bar is actually set ("End intro early?" on) - left open when it isn't, since
        // that reads more clearly as "runs through to the end of the section" than any text would.
        const openEndClass = hasEnd ? '' : ' flow-intro-bracket-open-end';
        return `<span class="flow-intro-bracket${openEndClass}"><span class="flow-intro-bracket-text">${text}</span></span>`;
    }
    // A block can carry more than one ramp (b.ramps, metronome_segment_ramps) - same "stale until
    // fixed, flagged rather than silently wrong" precedent as flowPauseInvalid/flowIntroInvalid.
    // Stale start/end bars mean the block shrank after the ramp was set; a "next block" target with
    // no next block (this is the last block in the flow) can't resolve to anything, per the user's
    // own request that this be surfaced before Saving rather than silently ignored at playback time.
    function flowRampInvalid(b, nextBlock) {
        const maxBar = b.barCount || 1;
        return (b.ramps || []).some(r => {
            if (((r.startBarOffset || 0) + 1) > maxBar) return true;
            if (r.endMode === 'specific' && ((r.endBarOffset || 0) + 1) > maxBar) return true;
            if (r.targetMode === 'next_block' && !nextBlock) return true;
            return false;
        });
    }
    function flowChangeLabel(b, nextBlock) {
        if (flowRampInvalid(b, nextBlock)) return flowTileUpdateWarning();
        const ramps = b.ramps || [];
        if (!ramps.length) return '<span class="flow-tile-value-empty">+</span>';
        // A block can mix speed-ups and slow-downs, so this tallies by direction rather than just
        // showing one combined count - up first, then down, then flat (equal bpm, unusual but not
        // invalid), each only shown when the block actually has one. flow-ramp-tile-icon shrinks the
        // icon down from .flow-tile-value svg's default 1.6em (tuned for the taller/narrower barline
        // glyphs) - up to three icon+count groups need to fit in the same tile now.
        const counts = { up: 0, down: 0, flat: 0 };
        ramps.forEach(r => { counts[flowRampDirection(r, b, nextBlock) || 'flat']++; });
        const groups = ['up', 'down', 'flat']
            .filter(dir => counts[dir])
            .map(dir => `${flowRampIconSvg(dir, 'flow-ramp-tile-icon')}<span class="flow-barline-value-count">×${counts[dir]}</span>`)
            .join('');
        return `<span class="flow-barline-value-row flow-ramp-tile-row">${groups}</span>`;
    }
    function flowSignLabel(b) {
        if (b.isSegno) return flowSignIconSvg('segno');
        if (b.isCoda) return flowSignIconSvg('coda');
        return '<span class="flow-tile-value-empty">+</span>';
    }
    // "D.S. al <coda>"/"To <coda>" - the real coda symbol at the same size as the surrounding text
    // (flowSignIconSvg's inline variant), but "D.S."/"D.C." spelled with a plain letter S/C rather
    // than the segno symbol - these are jump instructions, not a claim that the segno sign itself is
    // printed on this bar (that's the separate "sign" tile/flowSignLabel, openFlowSignPicker).
    function flowJumpLabel(b) {
        // .flow-tile-value is flex-direction:column, so raw sibling text+glyph content becomes two
        // separate flex items and stacks onto two lines instead of flowing inline - wrapping them
        // together in one .flow-barline-value-row (already inline-flex, row direction) keeps text and
        // glyph on a single line, same fix flowEndLabel's own icon+count pairing already relies on.
        if (b.gotoSegnoThenCoda) return `<span class="flow-barline-value-row">D.S. al ${flowSignIconSvg('coda', true)}</span>`;
        if (b.gotoStartDcThenCoda) return `<span class="flow-barline-value-row">D.C. al ${flowSignIconSvg('coda', true)}</span>`;
        if (b.gotoCoda) return `<span class="flow-barline-value-row">To ${flowSignIconSvg('coda', true)}</span>`;
        if (b.gotoSegno) return 'D.S.';
        if (b.gotoStartDc) return 'D.C.';
        return '<span class="flow-tile-value-empty">+</span>';
    }
    function flowPauseLabel(b) {
        if (flowPauseInvalid(b)) return flowTileUpdateWarning();
        const pauses = b.fermatas || [];
        const fermataCount = pauses.filter(p => (p.kind || 'fermata') === 'fermata').length;
        const caesuraCount = pauses.filter(p => p.kind === 'caesura').length;
        if (!fermataCount && !caesuraCount) return '<span class="flow-tile-value-empty">+</span>';
        // Wrapped in one .flow-barline-value-row so the fermata group and caesura group (each itself
        // an icon+count pair) flow side by side on one line rather than stacking - .flow-tile-value's
        // flex-direction:column would otherwise turn each into its own flex item, same bug already
        // fixed once for flowJumpLabel/flowEndLabel.
        let inner = '';
        if (fermataCount) inner += `${flowPauseIconSvg('fermata', true)}<span class="flow-barline-value-count">×${fermataCount}</span>`;
        if (caesuraCount) inner += `${flowPauseIconSvg('caesura', true)}<span class="flow-barline-value-count">×${caesuraCount}</span>`;
        return `<span class="flow-barline-value-row">${inner}</span>`;
    }

    function flowBlockCardHtml(b, idx, nextBlock) {
        const timeSig = b.timeSignatureLabel || `${b.numerator}/${b.denominator}`;
        const markBox = b.rehearsalMark
            ? `<button type="button" class="flow-block-mark-box" data-block-tile="rehearsalMark">${escapeHtml(b.rehearsalMark)}</button>`
            : `<button type="button" class="flow-block-mark-empty" data-block-tile="rehearsalMark" aria-label="Add rehearsal mark">+</button>`;
        // Grab handle/delete-underlay only render once there's more than one block to reorder/delete -
        // same "hide, don't just no-op" precedent as the 3-dot menu's own Move up/down/Delete
        // (openFlowBlockMenu) and Quick Play's own qp-bar-grab-handle/qp-block-delete-underlay.
        const canReorderOrDelete = currentFlowBlocks.length > 1;
        const grabHandle = canReorderOrDelete
            ? `<button type="button" class="flow-block-grab-handle" data-block-grab-handle aria-label="Drag to reorder ${flowBarRangeLabel(idx)}"><span class="material-symbols-outlined">drag_indicator</span></button>`
            : '';
        const deleteUnderlay = canReorderOrDelete
            ? `<div class="flow-block-delete-underlay" data-block-delete-btn aria-label="Delete ${flowBarRangeLabel(idx)}">
                <span class="material-symbols-outlined">delete</span>
                <span>Delete</span>
            </div>`
            : '';
        // .flow-block-box is a plain clipping wrapper (delete underlay behind, the actual card in
        // front and sliding) - same split as Quick Play's own qp-block-box/qp-block-surface
        // (wireQpBarSwipe), which this mirrors so scrolling from anywhere on a bar card works exactly
        // the same way here as it does there (see wireFlowBlockSwipe/wireFlowBlockGrabHandle below).
        return `
            <div class="flow-block-box" data-block-index="${idx}" data-block-id="${b.id}">
                ${deleteUnderlay}
                <div class="flow-block-card">
                <div class="flow-block-card-header">
                    <div class="flow-block-card-title">
                        ${grabHandle}
                        ${markBox}
                        <span class="flow-block-name">${flowBarRangeLabel(idx)}</span>
                    </div>
                    <button type="button" class="list-item-menu-btn" data-block-menu-btn aria-label="${flowBarRangeLabel(idx)} options"><span class="material-symbols-outlined">more_vert</span></button>
                </div>
                <div class="flow-tile-section">
                    <span class="flow-tile-section-label">Core</span>
                    <div class="flow-tile-grid flow-tile-grid-4">
                        <button type="button" class="flow-tile" data-block-tile="time"><span class="flow-tile-value">${escapeHtml(timeSig)}</span><span class="flow-tile-label">time</span></button>
                        <button type="button" class="flow-tile" data-block-tile="beatUnit"><span class="flow-tile-value">${metroNoteIconSvg(b.noteValue || 'crotchet')}</span><span class="flow-tile-label">beat note</span></button>
                        <button type="button" class="flow-tile" data-block-tile="bpm"><span class="flow-tile-value">${b.bpm}</span><span class="flow-tile-label">bpm</span></button>
                        <button type="button" class="flow-tile" data-block-tile="bars"><span class="flow-tile-value">${b.barCount}</span><span class="flow-tile-label">bars</span></button>
                    </div>
                </div>
                <div class="flow-tile-section">
                    <div class="flow-tile-section-split-labels flow-tile-section-split-labels-3-1">
                        <span class="flow-tile-section-label">Repeats</span>
                        <span class="flow-tile-section-label">Intro</span>
                    </div>
                    <div class="flow-tile-grid flow-tile-grid-4">
                        <button type="button" class="flow-tile" data-block-tile="start"><span class="flow-tile-value">${flowStartLabel(b)}</span><span class="flow-tile-label">start</span></button>
                        <button type="button" class="flow-tile" data-block-tile="end"><span class="flow-tile-value">${flowEndLabel(b)}</span><span class="flow-tile-label">end</span></button>
                        <button type="button" class="flow-tile${flowRepeatBarInvalid(b) ? ' flow-tile-warning' : ''}" data-block-tile="repeatBar"><span class="flow-tile-value">${flowRepeatBarLabel(b)}</span><span class="flow-tile-label">alt ending</span></button>
                        <button type="button" class="flow-tile${flowIntroInvalid(b) ? ' flow-tile-warning' : ''}" data-block-tile="intro"><span class="flow-tile-value">${flowIntroLabel(b)}</span><span class="flow-tile-label">bar range</span></button>
                    </div>
                </div>
                <div class="flow-tile-section">
                    <div class="flow-tile-section-split-labels">
                        <span class="flow-tile-section-label">Tempo</span>
                        <span class="flow-tile-section-label">Jumps</span>
                    </div>
                    <div class="flow-tile-grid flow-tile-grid-4">
                        <button type="button" class="flow-tile${flowPauseInvalid(b) ? ' flow-tile-warning' : ''}" data-block-tile="pause"><span class="flow-tile-value">${flowPauseLabel(b)}</span><span class="flow-tile-label">pause</span></button>
                        <button type="button" class="flow-tile${flowRampInvalid(b, nextBlock) ? ' flow-tile-warning' : ''}" data-block-tile="change"><span class="flow-tile-value">${flowChangeLabel(b, nextBlock)}</span><span class="flow-tile-label">ramp</span></button>
                        <button type="button" class="flow-tile" data-block-tile="sign"><span class="flow-tile-value">${flowSignLabel(b)}</span><span class="flow-tile-label">sign</span></button>
                        <button type="button" class="flow-tile" data-block-tile="jump"><span class="flow-tile-value">${flowJumpLabel(b)}</span><span class="flow-tile-label">jump</span></button>
                    </div>
                </div>
                </div>
            </div>
        `;
    }

    function renderFlowBlocksList() {
        const container = document.getElementById('flowBlocksList');
        if (!container) return;
        if (!currentFlowBlocks.length) {
            container.innerHTML = '<p class="text-muted" style="text-align:center; padding: 20px;">No bars yet - add your first one below.</p>';
            return;
        }
        container.innerHTML = currentFlowBlocks.map((b, idx) => flowBlockCardHtml(b, idx, currentFlowBlocks[idx + 1])).join('');

        // Same gesture split as Quick Play's own bar boxes (wireQpBarGrabHandle/wireQpBarSwipe) -
        // reordering is scoped strictly to the grab handle, deleting to a horizontal swipe that only
        // intercepts the gesture once it's confirmed horizontal, and neither touches the page's own
        // vertical scroll otherwise (see .flow-block-box's touch-action:pan-y in style.css). Replaces
        // the old whole-card HTML5 draggable="true", whose touch-action:none on the entire card blocked
        // native scroll from ever starting on a bar card at all.
        container.querySelectorAll('.flow-block-box').forEach((boxEl) => {
            const blockId = flowBlockIdFromDataset(boxEl.dataset.blockId);
            wireFlowBlockGrabHandle(boxEl.querySelector('[data-block-grab-handle]'), boxEl, blockId);
            wireFlowBlockSwipe(boxEl, blockId);
        });

        container.querySelectorAll('[data-block-tile]').forEach(btn => {
            const blockId = flowBlockIdFromDataset(btn.closest('.flow-block-box').dataset.blockId);
            btn.addEventListener('click', () => handleFlowBlockTileClick(blockId, btn.dataset.blockTile));
        });
        container.querySelectorAll('[data-block-menu-btn]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                openFlowBlockMenu(e.currentTarget, flowBlockIdFromDataset(btn.closest('.flow-block-box').dataset.blockId));
            });
        });
    }

    // --- Block card reorder/delete gestures - directly mirrors Quick Play's own bar-box gestures
    // (wireQpBarGrabHandle/wireQpBarSwipe): reordering is a single-step move (same as the 3-dot
    // menu's own Move up/down), scoped strictly to the small grab handle so it never competes with
    // the page's vertical scroll; deleting is a horizontal swipe that only ever intercepts the
    // gesture once it's confirmed horizontal (>30px horizontal travel while vertical travel is still
    // under 15px) - a clearly-vertical drag before that point is left alone entirely so the browser's
    // own touch-action:pan-y scroll handles it, same reasoning as Quick Play's own. ---
    // Raw position swap (no bounds checking) - the one place the actual array mutation for a move
    // happens, animated via flowAnimateBlocksChange (FLIP) so the displaced block visibly slides into
    // its new spot instead of the re-render just snapping it there - same "swap, don't just rebuild"
    // shape as Quick Play's own qpSwapBarPositions.
    function flowSwapBlockPositions(i, j) {
        const movedId = currentFlowBlocks[i].id;
        flowAnimateBlocksChange(() => {
            [currentFlowBlocks[i], currentFlowBlocks[j]] = [currentFlowBlocks[j], currentFlowBlocks[i]];
        }, { raiseUid: movedId });
        flowPersistBlockOrder();
    }
    function flowMoveBlockUp(blockId) {
        const idx = currentFlowBlocks.findIndex(b => b.id === blockId);
        if (idx <= 0) return;
        flowSwapBlockPositions(idx, idx - 1);
    }
    function flowMoveBlockDown(blockId) {
        const idx = currentFlowBlocks.findIndex(b => b.id === blockId);
        if (idx < 0 || idx >= currentFlowBlocks.length - 1) return;
        flowSwapBlockPositions(idx, idx + 1);
    }
    // Same confirm-before-delete flow the 3-dot menu's own Delete item already used - shared so the
    // swipe-revealed delete button below behaves identically, not a lighter no-confirm shortcut.
    function flowDeleteBlockConfirm(blockId) {
        showConfirmModal('Delete bar', "Delete this bar? This can't be undone.", async () => {
            if (flowEditMode === 'edit') {
                currentFlowBlocks = currentFlowBlocks.filter(b => b.id !== blockId);
                renderFlowBlocksStudio();
                return;
            }
            try {
                await API.flows.blocks.delete(blockId);
                currentFlowBlocks = currentFlowBlocks.filter(b => b.id !== blockId);
                renderFlowBlocksStudio(); // not just renderFlowBlocksList - the total bars/runtime summary needs refreshing too
            } catch (error) {
                showWarningToast('Error deleting bar: ' + error.message);
            }
        }, true);
    }

    const FLOW_BLOCK_REORDER_THRESHOLD_PX = 40;
    const FLOW_BLOCK_SWIPE_LOCK_X_PX = 30;
    const FLOW_BLOCK_SWIPE_LOCK_Y_MAX_PX = 15;
    const FLOW_BLOCK_SWIPE_OPEN_PX = 96; // keep in sync with .flow-block-delete-underlay's width in style.css
    const FLOW_BLOCK_SWIPE_SNAP_THRESHOLD_PX = 48;
    const FLOW_BLOCK_SWIPE_EXCLUDE_SELECTOR = 'button, input, [role="slider"], [role="button"], .slider-track, .slider-thumb';

    function flowBlockSurfaceFor(blockId) {
        return document.querySelector(`.flow-block-box[data-block-id="${blockId}"] .flow-block-card`);
    }
    function flowSetSwipeOffset(blockId, offset, animate) {
        const surface = flowBlockSurfaceFor(blockId);
        if (!surface) return;
        surface.style.transition = animate ? 'transform 0.2s ease' : 'none';
        surface.style.transform = offset ? `translateX(${offset}px)` : '';
    }
    function flowCloseOpenSwipe(animate = true) {
        if (flowOpenSwipeBlockId === null) return;
        flowSetSwipeOffset(flowOpenSwipeBlockId, 0, animate);
        flowOpenSwipeBlockId = null;
    }
    // Tapping anywhere outside an open card snaps it back - a document-level listener rather than a
    // per-card blur/outside-click check, same pattern as closeQpBarMenu/qpOpenSwipeIndex's own.
    document.addEventListener('pointerdown', (e) => {
        if (flowOpenSwipeBlockId === null) return;
        const openBoxEl = document.querySelector(`.flow-block-box[data-block-id="${flowOpenSwipeBlockId}"]`);
        if (openBoxEl && !openBoxEl.contains(e.target)) flowCloseOpenSwipe();
    });

    // Vertical reordering, scoped strictly to the grab handle. Single-step swap
    // (flowMoveBlockUp/Down), same as the menu's own Move up/down - this is about where the gesture
    // is allowed to start, not a full drag-to-arbitrary-position sortable list. wireVerticalDragHandle
    // (shared with Quick Play's own wireQpBarGrabHandle) owns the actual gesture/animation handoff.
    function wireFlowBlockGrabHandle(handleEl, boxEl, blockId) {
        wireVerticalDragHandle(handleEl, boxEl, FLOW_BLOCK_REORDER_THRESHOLD_PX,
            () => flowMoveBlockUp(blockId), () => flowMoveBlockDown(blockId), '.flow-block-card');
    }

    // Horizontal swipe-to-reveal delete. Doesn't touch anything (no transform, no preventDefault)
    // until the gesture actually locks into "this is a horizontal swipe" - a clearly-vertical drag
    // before that point is treated as a scroll attempt and left alone entirely.
    function wireFlowBlockSwipe(boxEl, blockId) {
        const surfaceEl = boxEl.querySelector('.flow-block-card');
        let startX = 0, startY = 0, tracking = false, locked = false, abandoned = false;

        function currentBaseOffset() { return flowOpenSwipeBlockId === blockId ? -FLOW_BLOCK_SWIPE_OPEN_PX : 0; }

        function onMove(e) {
            if (!tracking || abandoned) return;
            const dx = e.clientX - startX;
            const dy = e.clientY - startY;
            if (!locked) {
                if (Math.abs(dx) > FLOW_BLOCK_SWIPE_LOCK_X_PX && Math.abs(dy) < FLOW_BLOCK_SWIPE_LOCK_Y_MAX_PX) {
                    locked = true;
                    // Only one card open at a time - starting a fresh swipe elsewhere closes any other.
                    if (flowOpenSwipeBlockId !== null && flowOpenSwipeBlockId !== blockId) flowCloseOpenSwipe(false);
                } else if (Math.abs(dy) >= FLOW_BLOCK_SWIPE_LOCK_Y_MAX_PX) {
                    abandoned = true; // a scroll, not a swipe - stop tracking, never transform
                    return;
                } else {
                    return; // not enough travel yet either way
                }
            }
            e.preventDefault();
            const offset = Math.min(0, Math.max(-FLOW_BLOCK_SWIPE_OPEN_PX, currentBaseOffset() + dx));
            surfaceEl.style.transition = 'none';
            surfaceEl.style.transform = `translateX(${offset}px)`;
        }
        function onUp(e) {
            if (!tracking) return;
            tracking = false;
            document.removeEventListener('pointermove', onMove);
            document.removeEventListener('pointerup', onUp);
            if (!locked) return;
            const dx = e.clientX - startX;
            const finalOffset = Math.min(0, Math.max(-FLOW_BLOCK_SWIPE_OPEN_PX, currentBaseOffset() + dx));
            if (Math.abs(finalOffset) > FLOW_BLOCK_SWIPE_SNAP_THRESHOLD_PX) {
                flowSetSwipeOffset(blockId, -FLOW_BLOCK_SWIPE_OPEN_PX, true);
                flowOpenSwipeBlockId = blockId;
            } else {
                flowSetSwipeOffset(blockId, 0, true);
                if (flowOpenSwipeBlockId === blockId) flowOpenSwipeBlockId = null;
            }
        }
        boxEl.addEventListener('pointerdown', (e) => {
            if (e.target.closest(FLOW_BLOCK_SWIPE_EXCLUDE_SELECTOR)) return;
            startX = e.clientX;
            startY = e.clientY;
            tracking = true;
            locked = false;
            abandoned = false;
            document.addEventListener('pointermove', onMove);
            document.addEventListener('pointerup', onUp);
        });
        boxEl.querySelector('[data-block-delete-btn]')?.addEventListener('click', (e) => {
            e.stopPropagation();
            flowOpenSwipeBlockId = null;
            flowDeleteBlockConfirm(blockId);
        });
    }

    // --- Generic choice-list modal - every discrete-option tile shares this one modal rather
    // than each getting its own bespoke picker. An option can pass `html` instead of `label` for
    // cases that need more than plain escaped text (the jump tile's inline segno/coda glyphs). ---
    function openFlowChoiceModal(title, options, onSelect) {
        document.getElementById('flowChoiceTitle').innerText = title;
        const inlineExtra = document.getElementById('flowChoiceInlineExtra');
        inlineExtra.classList.add('hidden-group');
        inlineExtra.innerHTML = '';
        const container = document.getElementById('flowChoiceOptions');
        container.innerHTML = options.map((opt, i) => `
            <div class="flow-choice-option${opt.selected ? ' selected' : ''}" data-choice-idx="${i}">
                ${opt.html ? opt.html : `<span>${escapeHtml(opt.label)}</span>`}
                ${opt.selected && !opt.html ? '<span class="material-symbols-outlined">check</span>' : ''}
            </div>
        `).join('');
        container.querySelectorAll('[data-choice-idx]').forEach(el => {
            el.addEventListener('click', () => {
                document.getElementById('flowChoiceModal').style.display = 'none';
                onSelect(options[Number(el.dataset.choiceIdx)]);
            });
        });
        document.getElementById('flowChoiceModal').style.display = 'flex';
    }
    function closeFlowChoiceModal() {
        document.getElementById('flowChoiceModal').style.display = 'none';
    }

    // --- Repeat bar / volta - which repeat pass(es) (1-9) this bar plays on, multi-select rather
    // than the old binary 1st/2nd pair (some pieces use a section on passes 1, 3, 5 and a different
    // one on 2, 4 - see db/migrations/034_repeat_ending_numbers.sql), plus which bar (within this
    // block) a multi-bar ending starts at (037_volta_start_bar.sql). Own modal/state, own Save -
    // never written until committed, same reasoning as every other picker here. The toggle is
    // presentation only (hides/shows the fields below); what actually gets saved is derived from it
    // on Save, not stored as its own field. ---
    let flowRepeatBarTargetId = null;
    let flowRepeatBarDraft = null; // { on, startBar, maxBar, numbers: Set }

    function renderFlowRepeatBarModal() {
        const draft = flowRepeatBarDraft;
        if (!draft) return;
        document.getElementById('flowRepeatBarToggle').checked = draft.on;
        document.getElementById('flowRepeatBarFields').classList.toggle('hidden-group', !draft.on);
        // Both halves are required together once the volta's switched on - a start bar with no
        // repeat pass (or vice versa) isn't a usable alternate ending.
        document.getElementById('flowRepeatBarSaveBtn').disabled = draft.on && draft.numbers.size === 0;
        if (!draft.on) return;

        const invalid = draft.startBar > draft.maxBar;
        const valueEl = document.getElementById('flowRepeatBarStartValue');
        valueEl.classList.toggle('flow-bar-readout-invalid', invalid);
        // "of Y" is this block's own bar count - shows how far the ending could run without leaving
        // the block, not just the raw start-bar number on its own.
        const startText = `Bar ${draft.startBar} of ${draft.maxBar}`;
        valueEl.innerHTML = invalid ? `${flowWarningIconSvg('flow-warning-icon')}${startText}` : startText;

        const grid = document.getElementById('flowRepeatBarPassesGrid');
        grid.innerHTML = Array.from({ length: 9 }, (_, i) => i + 1).map(n => `
            <button type="button" class="flow-multiselect-num${draft.numbers.has(n) ? ' selected' : ''}" data-pass="${n}">${n}</button>
        `).join('');
        grid.querySelectorAll('[data-pass]').forEach(btn => {
            btn.addEventListener('click', () => {
                const n = Number(btn.dataset.pass);
                if (draft.numbers.has(n)) draft.numbers.delete(n); else draft.numbers.add(n);
                renderFlowRepeatBarModal();
            });
        });
    }
    function openFlowRepeatBarPicker(blockId) {
        const b = flowFindBlockById(blockId);
        if (!b) return;
        flowRepeatBarTargetId = blockId;
        const idx = currentFlowBlocks.findIndex(x => x.id === blockId);
        document.getElementById('flowRepeatBarPill').innerText = idx === -1 ? '' : flowBarRangeLabel(idx);
        flowRepeatBarDraft = {
            on: !!(b.repeatEndingNumbers && b.repeatEndingNumbers.length),
            startBar: b.repeatEndingStartBar || 1,
            maxBar: Math.max(1, b.barCount || 1),
            numbers: new Set(b.repeatEndingNumbers || [])
        };
        renderFlowRepeatBarModal();
        document.getElementById('flowRepeatBarModal').style.display = 'flex';
    }
    function closeFlowRepeatBarModal() {
        document.getElementById('flowRepeatBarModal').style.display = 'none';
        flowRepeatBarTargetId = null;
        flowRepeatBarDraft = null;
    }
    document.getElementById('flowRepeatBarToggle')?.addEventListener('change', (e) => {
        if (!flowRepeatBarDraft) return;
        flowRepeatBarDraft.on = e.target.checked;
        renderFlowRepeatBarModal();
    });
    setupHoldStepper(document.getElementById('flowRepeatBarStartMinus'), -1, (amount) => {
        if (!flowRepeatBarDraft) return;
        flowRepeatBarDraft.startBar = Math.max(1, flowRepeatBarDraft.startBar + amount);
        renderFlowRepeatBarModal();
    });
    setupHoldStepper(document.getElementById('flowRepeatBarStartPlus'), 1, (amount) => {
        if (!flowRepeatBarDraft) return;
        flowRepeatBarDraft.startBar = Math.max(1, Math.min(flowRepeatBarDraft.maxBar, flowRepeatBarDraft.startBar + amount));
        renderFlowRepeatBarModal();
    });
    document.getElementById('flowRepeatBarCloseBtn')?.addEventListener('click', closeFlowRepeatBarModal);
    document.getElementById('flowRepeatBarCancelBtn')?.addEventListener('click', closeFlowRepeatBarModal);
    document.getElementById('flowRepeatBarSaveBtn')?.addEventListener('click', () => {
        if (!flowRepeatBarDraft || flowRepeatBarTargetId === null) return closeFlowRepeatBarModal();
        const draft = flowRepeatBarDraft;
        const targetId = flowRepeatBarTargetId;
        const numbers = draft.on ? Array.from(draft.numbers).sort((a, b) => a - b) : [];
        closeFlowRepeatBarModal();
        flowUpdateBlock(targetId, {
            repeatEndingNumbers: numbers,
            repeatEndingStartBar: draft.on ? draft.startBar : null,
            isFirstTimeBar: false, isSecondTimeBar: false
        });
    });

    // --- Intro picker (#flowIntroModal) - which bar (within this block) the intro starts at, and
    // optionally which bar it finishes at if it ends before the block's own final bar. Reuses
    // introStartBarOffset/introEndBarOffset (shared columns with the ad-hoc Metronome Blocks tool -
    // see metroSegIntroCard elsewhere in this file) as plain 1-based bar-within-block numbers; the
    // beat-offset half of those columns is a pickup-beat concept that tool uses and this picker
    // doesn't touch - validateSegmentPayload (metronomeSegments.js) defaults it to beat 1 server-side
    // whenever a bar offset is set. End is gated behind Start (can't end early without
    // an intro to end) and bounded so it can never sit before the start bar. Never written until
    // committed, same "own modal, own draft" pattern as every other picker here. ---
    let flowIntroTargetId = null;
    let flowIntroDraft = null; // { startOn, startBar, endOn, endBar, maxBar }

    function renderFlowIntroModal() {
        const draft = flowIntroDraft;
        if (!draft) return;
        document.getElementById('flowIntroStartToggle').checked = draft.startOn;
        document.getElementById('flowIntroStartFields').classList.toggle('hidden-group', !draft.startOn);
        const startInvalid = draft.startOn && draft.startBar > draft.maxBar;
        const startValueEl = document.getElementById('flowIntroStartValue');
        startValueEl.classList.toggle('flow-bar-readout-invalid', startInvalid);
        const startText = `Bar ${draft.startBar} of ${draft.maxBar}`;
        startValueEl.innerHTML = startInvalid ? `${flowWarningIconSvg('flow-warning-icon')}${startText}` : startText;

        const endToggle = document.getElementById('flowIntroEndToggle');
        endToggle.checked = draft.endOn;
        endToggle.disabled = !draft.startOn;
        document.getElementById('flowIntroEndToggleRow').classList.toggle('flow-toggle-row-disabled', !draft.startOn);
        document.getElementById('flowIntroEndToggleHelp').innerText = !draft.startOn ? 'Enable start intro first'
            : draft.endOn ? '' : `Default plays through to final bar (Bar ${draft.maxBar})`;
        document.getElementById('flowIntroEndFields').classList.toggle('hidden-group', !(draft.startOn && draft.endOn));
        if (draft.startOn && draft.endOn) {
            const endInvalid = draft.endBar > draft.maxBar;
            const endValueEl = document.getElementById('flowIntroEndValue');
            endValueEl.classList.toggle('flow-bar-readout-invalid', endInvalid);
            const endText = `Bar ${draft.endBar} of ${draft.maxBar}`;
            endValueEl.innerHTML = endInvalid ? `${flowWarningIconSvg('flow-warning-icon')}${endText}` : endText;
        }
    }
    function openFlowIntroPicker(blockId) {
        const b = flowFindBlockById(blockId);
        if (!b) return;
        flowIntroTargetId = blockId;
        const idx = currentFlowBlocks.findIndex(x => x.id === blockId);
        document.getElementById('flowIntroPill').innerText = idx === -1 ? '' : flowBarRangeLabel(idx);
        const maxBar = Math.max(1, b.barCount || 1);
        const startOn = b.introStartBarOffset !== null && b.introStartBarOffset !== undefined;
        const endOn = startOn && b.introEndBarOffset !== null && b.introEndBarOffset !== undefined;
        // Not clamped to maxBar here - a stale value (the block shortened after this was set) shows
        // as-is, flagged red by renderFlowIntroModal, same as the alt-ending picker's own start bar.
        flowIntroDraft = {
            startOn,
            startBar: startOn ? Math.max(1, b.introStartBarOffset) : 1,
            endOn,
            endBar: endOn ? Math.max(1, b.introEndBarOffset) : maxBar,
            maxBar
        };
        renderFlowIntroModal();
        document.getElementById('flowIntroModal').style.display = 'flex';
    }
    function closeFlowIntroModal() {
        document.getElementById('flowIntroModal').style.display = 'none';
        flowIntroTargetId = null;
        flowIntroDraft = null;
    }
    document.getElementById('flowIntroStartToggle')?.addEventListener('change', (e) => {
        if (!flowIntroDraft) return;
        flowIntroDraft.startOn = e.target.checked;
        if (!flowIntroDraft.startOn) flowIntroDraft.endOn = false;
        renderFlowIntroModal();
    });
    document.getElementById('flowIntroEndToggle')?.addEventListener('change', (e) => {
        if (!flowIntroDraft || !flowIntroDraft.startOn) return;
        flowIntroDraft.endOn = e.target.checked;
        if (flowIntroDraft.endOn) flowIntroDraft.endBar = Math.max(flowIntroDraft.endBar, flowIntroDraft.startBar);
        renderFlowIntroModal();
    });
    setupHoldStepper(document.getElementById('flowIntroStartMinus'), -1, (amount) => {
        if (!flowIntroDraft) return;
        flowIntroDraft.startBar = Math.max(1, flowIntroDraft.startBar + amount);
        if (flowIntroDraft.endOn) flowIntroDraft.endBar = Math.max(flowIntroDraft.endBar, flowIntroDraft.startBar);
        renderFlowIntroModal();
    });
    setupHoldStepper(document.getElementById('flowIntroStartPlus'), 1, (amount) => {
        if (!flowIntroDraft) return;
        flowIntroDraft.startBar = Math.max(1, Math.min(flowIntroDraft.maxBar, flowIntroDraft.startBar + amount));
        if (flowIntroDraft.endOn) flowIntroDraft.endBar = Math.max(flowIntroDraft.endBar, flowIntroDraft.startBar);
        renderFlowIntroModal();
    });
    setupHoldStepper(document.getElementById('flowIntroEndMinus'), -1, (amount) => {
        if (!flowIntroDraft) return;
        flowIntroDraft.endBar = Math.max(flowIntroDraft.startBar, flowIntroDraft.endBar + amount);
        renderFlowIntroModal();
    });
    setupHoldStepper(document.getElementById('flowIntroEndPlus'), 1, (amount) => {
        if (!flowIntroDraft) return;
        flowIntroDraft.endBar = Math.max(flowIntroDraft.startBar, Math.min(flowIntroDraft.maxBar, flowIntroDraft.endBar + amount));
        renderFlowIntroModal();
    });
    document.getElementById('flowIntroCloseBtn')?.addEventListener('click', closeFlowIntroModal);
    document.getElementById('flowIntroCancelBtn')?.addEventListener('click', closeFlowIntroModal);
    document.getElementById('flowIntroSaveBtn')?.addEventListener('click', () => {
        if (!flowIntroDraft || flowIntroTargetId === null) return closeFlowIntroModal();
        const draft = flowIntroDraft;
        const targetId = flowIntroTargetId;
        closeFlowIntroModal();
        flowUpdateBlock(targetId, {
            introStartBarOffset: draft.startOn ? draft.startBar : null,
            introEndBarOffset: draft.startOn && draft.endOn ? draft.endBar : null
        });
    });

    // --- Time signature / beat unit pickers - literally the same shared modals Quick Play's own
    // per-block pickers reuse (qpOpenTimeSigPicker/qpOpenNotePicker), not a Flow-only copy - per the
    // request, the same popup/images/functionality, just wired to update a Flow block instead of a
    // qpBlocks entry. Flow's own timeSignatureId/accountTimeSignatureId split is translated to/from
    // the shared modal's "public:<id>"/"custom:<id>" string shape (same parse qpBlockTimeSig uses). ---
    function flowTimeSigValueFor(b) {
        if (b.timeSignatureId) return `public:${b.timeSignatureId}`;
        if (b.accountTimeSignatureId) return `custom:${b.accountTimeSignatureId}`;
        return null;
    }
    function flowOpenTimeSigPicker(blockId) {
        const b = flowFindBlockById(blockId);
        if (!b) return;
        metroSegTimeSigValue = flowTimeSigValueFor(b);
        metroSegTimeSigOnSelect = (value) => {
            const [type, id] = value.split(':');
            flowUpdateBlock(blockId, type === 'public'
                ? { timeSignatureId: Number(id), accountTimeSignatureId: null }
                : { timeSignatureId: null, accountTimeSignatureId: Number(id) });
        };
        renderMetroSegTimeSigPicker();
        document.getElementById('metroSegTimeSigModal').style.display = 'flex';
    }
    function flowOpenNotePicker(blockId) {
        const b = flowFindBlockById(blockId);
        if (!b) return;
        const el = document.getElementById('metroSegNotePicker');
        if (!el) return;
        el.innerHTML = METRO_NOTE_TYPES.map(t => `
            <button type="button" class="metroBlk-note-btn${t.key === b.noteValue ? ' selected' : ''}" data-note="${t.key}" aria-label="${t.label}" aria-pressed="${t.key === b.noteValue}">
                ${metroNoteIconSvg(t.key)}
            </button>
        `).join('');
        el.querySelectorAll('.metroBlk-note-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                flowUpdateBlock(blockId, { noteValue: btn.dataset.note });
                document.getElementById('metroSegNoteModal').style.display = 'none';
            }, { once: true });
        });
        document.getElementById('metroSegNoteModal').style.display = 'flex';
    }

    // Start-of-bar picker - same "Beat unit" modal format (title/help text/close-x, a row of
    // .metroBlk-note-btn icon cards) as flowOpenNotePicker above, just its own modal/picker element
    // and two barline options (flowBarlineIconSvg) instead of five note-duration ones.
    function flowOpenBarStartPicker(blockId) {
        const b = flowFindBlockById(blockId);
        if (!b) return;
        const el = document.getElementById('flowBarStartPicker');
        if (!el) return;
        const options = [
            { key: 'plain', label: 'Plain barline', selected: !b.isRepeatStart, apply: { isRepeatStart: false } },
            { key: 'repeatStart', label: 'Repeat start', selected: !!b.isRepeatStart, apply: { isRepeatStart: true } }
        ];
        el.innerHTML = options.map(o => `
            <button type="button" class="metroBlk-note-btn${o.selected ? ' selected' : ''}" data-start-option="${o.key}" aria-label="${o.label}" aria-pressed="${o.selected}">
                ${flowBarlineIconSvg(o.key, 'metroBlk-note-svg', o.key === 'plain')}
            </button>
        `).join('');
        el.querySelectorAll('[data-start-option]').forEach(btn => {
            btn.addEventListener('click', () => {
                const opt = options.find(o => o.key === btn.dataset.startOption);
                flowUpdateBlock(blockId, opt.apply);
                document.getElementById('flowBarStartModal').style.display = 'none';
            }, { once: true });
        });
        document.getElementById('flowBarStartModal').style.display = 'flex';
    }

    // Shared option-card markup for the End-of-bar picker below - icon (+ a repeat count next to
    // it, when it has one - never stacked above, so the card's height doesn't change either way)
    // and a caption underneath.
    function flowBarlinePickerTileHtml(o) {
        return `
            <button type="button" class="flow-picker-tile${o.selected ? ' selected' : ''}" aria-label="${escapeHtml(o.caption)}${o.countLabel ? ' ' + o.countLabel : ''}" aria-pressed="${o.selected}">
                <span class="flow-picker-tile-icon-row">
                    ${flowBarlineIconSvg(o.kind, 'metroBlk-note-svg')}
                    ${o.countLabel ? `<span class="flow-picker-tile-count">${escapeHtml(o.countLabel)}</span>` : ''}
                </span>
                <span class="flow-picker-tile-label">${escapeHtml(o.caption)}</span>
            </button>
        `;
    }

    // End-of-bar picker - "Structure" (Normal/Section/Fine/Final, mutually exclusive with a repeat
    // end) plus "Repeats" (a direct 2x-9x grid - tapping one both marks this a repeat end and sets
    // its count in one step, replacing the old two-step "pick Repeat end, then drag a count slider"
    // flow). The 2x tile shows no count of its own - it's the implicit default, same as how neither
    // Normal/Section/Fine/Final ever show one of their own. Fine reuses Section's plain double-bar
    // glyph (a Fine mark isn't a different-shaped barline, just a plain one with "Fine" printed by
    // it) with a "Fine" tag alongside it, same .flow-picker-tile-count slot the Repeats grid's own
    // "2x"/"3x" labels use.
    function flowOpenBarEndPicker(blockId) {
        const b = flowFindBlockById(blockId);
        if (!b) return;
        const structureOptions = [
            { kind: 'plain', caption: 'Normal', selected: !b.isRepeatEnd && !b.isSectionBoundary && !b.isFinalBarline && !b.isFine,
                apply: { isRepeatEnd: false, isSectionBoundary: false, isFinalBarline: false, isFine: false, repeatPlayCount: null } },
            { kind: 'section', caption: 'Section', selected: !b.isRepeatEnd && b.isSectionBoundary,
                apply: { isRepeatEnd: false, isSectionBoundary: true, isFinalBarline: false, isFine: false, repeatPlayCount: null } },
            { kind: 'section', caption: 'Fine', countLabel: 'Fine', selected: !b.isRepeatEnd && b.isFine,
                apply: { isRepeatEnd: false, isSectionBoundary: false, isFinalBarline: false, isFine: true, repeatPlayCount: null } },
            { kind: 'fine', caption: 'Final', selected: !b.isRepeatEnd && b.isFinalBarline,
                apply: { isRepeatEnd: false, isSectionBoundary: false, isFinalBarline: true, isFine: false, repeatPlayCount: null } }
        ];
        const repeatOptions = Array.from({ length: 8 }, (_, i) => i + 2).map(n => ({
            kind: 'repeatEnd', caption: 'Repeat', countLabel: flowRepeatCountLabel(n),
            selected: b.isRepeatEnd && (b.repeatPlayCount || 2) === n,
            apply: { isRepeatEnd: true, isSectionBoundary: false, isFinalBarline: false, isFine: false, repeatPlayCount: n }
        }));
        function render(elId, options) {
            const el = document.getElementById(elId);
            if (!el) return;
            el.innerHTML = options.map(flowBarlinePickerTileHtml).join('');
            el.querySelectorAll('.flow-picker-tile').forEach((btn, i) => {
                btn.addEventListener('click', () => {
                    flowUpdateBlock(blockId, options[i].apply);
                    document.getElementById('flowBarEndModal').style.display = 'none';
                }, { once: true });
            });
        }
        render('flowBarEndStructureGrid', structureOptions);
        render('flowBarEndRepeatsGrid', repeatOptions);
        document.getElementById('flowBarEndModal').style.display = 'flex';
    }

    // --- Shared "tap a glyph tile to select & close, no Save/Cancel" picker shape, used by both the
    // Jump sign picker (#flowSignModal - None/Segno/Coda) and the Jump instruction picker
    // (#flowJumpModal - None plus 5 D.S./D.C./Coda combinations). Its own tile builder (rather than
    // reusing flowBarlinePickerTileHtml above) because these tiles carry a single centered icon/glyph
    // (no repeat count row) plus a caption under every option. "None" is obvious enough on its own -
    // it's the big icon-row text instead, no caption underneath (ariaLabel covers the button's
    // accessible name when caption is blank). ---
    function flowGlyphPickerTileHtml(o) {
        const ariaLabel = o.ariaLabel || o.caption;
        return `
            <button type="button" class="flow-picker-tile${o.selected ? ' selected' : ''}" aria-label="${escapeHtml(ariaLabel)}" aria-pressed="${o.selected}">
                <span class="flow-picker-tile-icon-row">${o.icon || ''}</span>
                <span class="flow-picker-tile-label">${escapeHtml(o.caption)}</span>
            </button>
        `;
    }
    function openFlowGlyphPicker(modalId, gridId, options, onSelect) {
        const grid = document.getElementById(gridId);
        grid.innerHTML = options.map(flowGlyphPickerTileHtml).join('');
        grid.querySelectorAll('.flow-picker-tile').forEach((btn, i) => {
            btn.addEventListener('click', () => {
                onSelect(options[i]);
                document.getElementById(modalId).style.display = 'none';
            }, { once: true });
        });
        document.getElementById(modalId).style.display = 'flex';
    }
    function openFlowSignPicker(blockId) {
        const b = flowFindBlockById(blockId);
        if (!b) return;
        const options = [
            { icon: 'None', caption: '', ariaLabel: 'None', selected: !b.isSegno && !b.isCoda, apply: { isSegno: false, isCoda: false } },
            { icon: flowSignIconSvg('segno'), caption: 'Segno', selected: b.isSegno, apply: { isSegno: true, isCoda: false } },
            { icon: flowSignIconSvg('coda'), caption: 'Coda', selected: b.isCoda, apply: { isSegno: false, isCoda: true } }
        ];
        openFlowGlyphPicker('flowSignModal', 'flowSignOptions', options, (opt) => flowUpdateBlock(blockId, opt.apply));
    }
    document.getElementById('flowSignCloseBtn')?.addEventListener('click', () => {
        document.getElementById('flowSignModal').style.display = 'none';
    });

    // --- Jump instruction picker (#flowJumpModal) - None, then the 5 core jump instructions, a clean
    // 2x3 grid (.flow-tile-grid-3-centered). All 5 flags are mutually exclusive - every option clears
    // the other 4 alongside setting its own. Marking THIS bar as the Fine stopping point itself is a
    // separate concern, not a jump instruction - that's the End-of-bar Structure picker's own "Fine"
    // tile (isFine), not this one. Captions are the plain-English action (not the notation the icon
    // above already spells out), matching what each instruction actually does on playback:
    // - D.S. al Coda: jump to the Segno, play until a "To Coda" bar, then jump to the Coda.
    // - D.C. al Coda: jump to bar 1, play until a "To Coda" bar, then jump to the Coda.
    // - To Coda: the mid-piece exit ramp a D.S./D.C. al Coda jumps to on replay.
    // - D.S. al Fine: jump to the Segno, play through to the bar marked Fine.
    // - D.C. al Fine: jump to bar 1, play through to the bar marked Fine. ---
    function openFlowJumpPicker(blockId) {
        const b = flowFindBlockById(blockId);
        if (!b) return;
        const clear = { gotoSegno: false, gotoSegnoThenCoda: false, gotoCoda: false, gotoStartDc: false, gotoStartDcThenCoda: false };
        const options = [
            { icon: 'None', caption: '', ariaLabel: 'None',
                selected: !b.gotoSegno && !b.gotoSegnoThenCoda && !b.gotoCoda && !b.gotoStartDc && !b.gotoStartDcThenCoda,
                apply: { ...clear } },
            { icon: `D.S. al ${flowSignIconSvg('coda', true)}`, caption: 'Segno to Coda',
                selected: b.gotoSegnoThenCoda, apply: { ...clear, gotoSegnoThenCoda: true } },
            { icon: `D.C. al ${flowSignIconSvg('coda', true)}`, caption: 'Start to Coda',
                selected: b.gotoStartDcThenCoda, apply: { ...clear, gotoStartDcThenCoda: true } },
            { icon: `To ${flowSignIconSvg('coda', true)}`, caption: 'Jump to Coda',
                selected: b.gotoCoda, apply: { ...clear, gotoCoda: true } },
            { icon: 'D.S.', caption: 'Segno to Fine',
                selected: b.gotoSegno, apply: { ...clear, gotoSegno: true } },
            { icon: 'D.C.', caption: 'Start to Fine',
                selected: b.gotoStartDc, apply: { ...clear, gotoStartDc: true } }
        ];
        openFlowGlyphPicker('flowJumpModal', 'flowJumpOptions', options, (opt) => flowUpdateBlock(blockId, opt.apply));
    }
    document.getElementById('flowJumpCloseBtn')?.addEventListener('click', () => {
        document.getElementById('flowJumpModal').style.display = 'none';
    });

    // --- BPM popup - same tiered-slider mechanic as the ad-hoc/Quick Play BPM controls
    // (METRO_MIN_BPM/METRO_MAX_BPM/METRO_SLIDER_TIERS, metroBestFitTier, setupSliderInteraction/
    // makeSliderReadoutEditable - all already value-agnostic), own copy of the small stepping state
    // machine per this file's usual "own copy per feature" precedent, just presented as its own
    // single-field popup rather than embedded inline on a card. ---
    let flowBpmModalTargetId = null;
    let flowBpmOnApply = null;
    let flowBpmSliderMax = METRO_SLIDER_TIERS[0];
    let flowBpmTierChangeCooldownUntil = 0;
    // The value the block actually had when this popup opened - only committed to the server (and
    // re-rendered onto the card behind the modal) once on close, not on every slider tick. Dragging
    // around and landing back here, or just opening and closing without touching anything, writes
    // nothing at all.
    let flowBpmOriginalValue = null;
    function flowBpmStepTier(value) {
        const now = Date.now();
        if (now < flowBpmTierChangeCooldownUntil) return;
        const idx = METRO_SLIDER_TIERS.indexOf(flowBpmSliderMax);
        if (idx < METRO_SLIDER_TIERS.length - 1 && value >= METRO_SLIDER_TIERS[idx]) {
            flowBpmSliderMax = METRO_SLIDER_TIERS[idx + 1];
            flowBpmTierChangeCooldownUntil = now + 350;
        } else if (idx > 0 && value < METRO_SLIDER_TIERS[idx - 1]) {
            flowBpmSliderMax = METRO_SLIDER_TIERS[idx - 1];
            flowBpmTierChangeCooldownUntil = now + 350;
        }
    }
    function renderFlowBpmSlider(value) {
        const pct = ((value - METRO_MIN_BPM) / (flowBpmSliderMax - METRO_MIN_BPM)) * 100;
        document.getElementById('flowBpmSliderFill').style.width = `${pct}%`;
        const thumb = document.getElementById('flowBpmSliderThumb');
        thumb.style.left = `${pct}%`;
        thumb.setAttribute('aria-valuenow', value);
        thumb.setAttribute('aria-valuemax', flowBpmSliderMax);
        document.getElementById('flowBpmSliderMaxLbl').innerText = flowBpmSliderMax;
        document.getElementById('flowBpmPopupValue').innerText = value;
    }
    function setFlowBpmFromDisplayed(value, opts = {}) {
        const clamped = Math.round(Math.min(METRO_MAX_BPM, Math.max(METRO_MIN_BPM, value)));
        if (opts.dragging) flowBpmStepTier(clamped); else flowBpmSliderMax = metroBestFitTier(clamped);
        renderFlowBpmSlider(clamped);
    }
    // opts.value/opts.onApply let a caller other than the block's own bpm tile reuse this same
    // popup (the Tempo ramps modal's "Set custom tempo" row, flowRampCustomTempoBtn) - defaults to
    // exactly the original blockId-only behaviour when neither is passed.
    function flowOpenBpmModal(blockId, opts = {}) {
        const value = opts.value !== undefined ? opts.value : flowFindBlockById(blockId)?.bpm;
        if (value === undefined || value === null) return;
        flowBpmModalTargetId = blockId;
        flowBpmOnApply = opts.onApply || null;
        flowBpmOriginalValue = value;
        flowBpmSliderMax = metroBestFitTier(value);
        renderFlowBpmSlider(value);
        document.getElementById('flowBpmModal').style.display = 'flex';
    }
    setupHoldStepper(document.getElementById('flowBpmMinus'), -1, (amount) => setFlowBpmFromDisplayed(Number(document.getElementById('flowBpmPopupValue').innerText) + amount, { dragging: true }));
    setupHoldStepper(document.getElementById('flowBpmPlus'), 1, (amount) => setFlowBpmFromDisplayed(Number(document.getElementById('flowBpmPopupValue').innerText) + amount, { dragging: true }));
    setupSliderInteraction(document.getElementById('flowBpmSliderTrack'), document.getElementById('flowBpmSliderThumb'), {
        onDragRatio: (ratio) => setFlowBpmFromDisplayed(METRO_MIN_BPM + ratio * (flowBpmSliderMax - METRO_MIN_BPM), { dragging: true }),
        onArrowStep: (dir) => setFlowBpmFromDisplayed(Number(document.getElementById('flowBpmPopupValue').innerText) + dir, { dragging: true })
    });
    makeSliderReadoutEditable('flowBpmPopupValue', () => Number(document.getElementById('flowBpmPopupValue').innerText), (v) => setFlowBpmFromDisplayed(v), { label: 'Tempo', min: METRO_MIN_BPM, max: METRO_MAX_BPM });
    // Commits once here, on close, whatever the popup ended up showing - not on every drag tick.
    // If it's unchanged from what the block already had (opened and closed without touching it,
    // or dragged back to the start), there's nothing to write.
    function closeFlowBpmModal() {
        document.getElementById('flowBpmModal').style.display = 'none';
        const finalValue = Number(document.getElementById('flowBpmPopupValue').innerText);
        if (finalValue === flowBpmOriginalValue) return;
        if (flowBpmOnApply) flowBpmOnApply(finalValue);
        else if (flowBpmModalTargetId) flowUpdateBlock(flowBpmModalTargetId, { bpm: finalValue });
    }
    document.getElementById('flowBpmCloseBtn')?.addEventListener('click', closeFlowBpmModal);
    document.getElementById('flowBpmModal')?.addEventListener('click', (e) => { if (e.target === e.currentTarget) closeFlowBpmModal(); });

    // --- Bar count popup - same tiered-slider mechanic as BPM's own above, its own tier list
    // (50/250/500) per the request rather than reusing METRO_SLIDER_TIERS. ---
    const FLOW_BARS_MIN = 1;
    const FLOW_BARS_MAX = 500;
    const FLOW_BARS_TIERS = [50, 250, 500];
    let flowBarsModalTargetId = null;
    let flowBarsSliderMax = FLOW_BARS_TIERS[0];
    let flowBarsTierChangeCooldownUntil = 0;
    let flowBarsOriginalValue = null;
    function flowBarsStepTier(value) {
        const now = Date.now();
        if (now < flowBarsTierChangeCooldownUntil) return;
        const idx = FLOW_BARS_TIERS.indexOf(flowBarsSliderMax);
        if (idx < FLOW_BARS_TIERS.length - 1 && value >= FLOW_BARS_TIERS[idx]) {
            flowBarsSliderMax = FLOW_BARS_TIERS[idx + 1];
            flowBarsTierChangeCooldownUntil = now + 350;
        } else if (idx > 0 && value < FLOW_BARS_TIERS[idx - 1]) {
            flowBarsSliderMax = FLOW_BARS_TIERS[idx - 1];
            flowBarsTierChangeCooldownUntil = now + 350;
        }
    }
    function flowBarsBestFitTier(value) {
        return FLOW_BARS_TIERS.find(t => value <= t) || FLOW_BARS_TIERS[FLOW_BARS_TIERS.length - 1];
    }
    function renderFlowBarsSlider(value) {
        const pct = ((value - FLOW_BARS_MIN) / (flowBarsSliderMax - FLOW_BARS_MIN)) * 100;
        document.getElementById('flowBarsSliderFill').style.width = `${pct}%`;
        const thumb = document.getElementById('flowBarsSliderThumb');
        thumb.style.left = `${pct}%`;
        thumb.setAttribute('aria-valuenow', value);
        thumb.setAttribute('aria-valuemax', flowBarsSliderMax);
        document.getElementById('flowBarsSliderMaxLbl').innerText = flowBarsSliderMax;
        document.getElementById('flowBarsPopupValue').innerText = value;
    }
    function setFlowBarsFromDisplayed(value, opts = {}) {
        const clamped = Math.round(Math.min(FLOW_BARS_MAX, Math.max(FLOW_BARS_MIN, value)));
        if (opts.dragging) flowBarsStepTier(clamped); else flowBarsSliderMax = flowBarsBestFitTier(clamped);
        renderFlowBarsSlider(clamped);
    }
    function flowOpenBarsModal(blockId) {
        const b = flowFindBlockById(blockId);
        if (!b) return;
        flowBarsModalTargetId = blockId;
        flowBarsOriginalValue = b.barCount;
        flowBarsSliderMax = flowBarsBestFitTier(b.barCount);
        renderFlowBarsSlider(b.barCount);
        document.getElementById('flowBarsModal').style.display = 'flex';
    }
    setupHoldStepper(document.getElementById('flowBarsMinus'), -1, (amount) => setFlowBarsFromDisplayed(Number(document.getElementById('flowBarsPopupValue').innerText) + amount, { dragging: true }));
    setupHoldStepper(document.getElementById('flowBarsPlus'), 1, (amount) => setFlowBarsFromDisplayed(Number(document.getElementById('flowBarsPopupValue').innerText) + amount, { dragging: true }));
    setupSliderInteraction(document.getElementById('flowBarsSliderTrack'), document.getElementById('flowBarsSliderThumb'), {
        onDragRatio: (ratio) => setFlowBarsFromDisplayed(FLOW_BARS_MIN + ratio * (flowBarsSliderMax - FLOW_BARS_MIN), { dragging: true }),
        onArrowStep: (dir) => setFlowBarsFromDisplayed(Number(document.getElementById('flowBarsPopupValue').innerText) + dir, { dragging: true })
    });
    makeSliderReadoutEditable('flowBarsPopupValue', () => Number(document.getElementById('flowBarsPopupValue').innerText), (v) => setFlowBarsFromDisplayed(v), { label: 'Number of bars', min: FLOW_BARS_MIN, max: FLOW_BARS_MAX });
    function closeFlowBarsModal() {
        document.getElementById('flowBarsModal').style.display = 'none';
        const finalValue = Number(document.getElementById('flowBarsPopupValue').innerText);
        if (flowBarsModalTargetId && finalValue !== flowBarsOriginalValue) flowUpdateBlock(flowBarsModalTargetId, { barCount: finalValue });
    }
    document.getElementById('flowBarsCloseBtn')?.addEventListener('click', closeFlowBarsModal);
    document.getElementById('flowBarsModal')?.addEventListener('click', (e) => { if (e.target === e.currentTarget) closeFlowBarsModal(); });

    // --- Tile tap dispatch - one branch per Block Inspector tile (see flowBlockCardHtml above). ---
    function handleFlowBlockTileClick(blockId, tileKey) {
        const b = flowFindBlockById(blockId);
        if (!b) return;

        if (tileKey === 'rehearsalMark') {
            showPromptModal('Rehearsal mark', b.rehearsalMark || '', (val) => {
                flowUpdateBlock(blockId, { rehearsalMark: val.trim() || null });
            });
            return;
        }

        if (tileKey === 'time') {
            flowOpenTimeSigPicker(blockId);
            return;
        }

        if (tileKey === 'beatUnit') {
            flowOpenNotePicker(blockId);
            return;
        }

        if (tileKey === 'bpm') {
            flowOpenBpmModal(blockId);
            return;
        }

        if (tileKey === 'bars') {
            flowOpenBarsModal(blockId);
            return;
        }

        if (tileKey === 'start') {
            flowOpenBarStartPicker(blockId);
            return;
        }

        if (tileKey === 'end') {
            flowOpenBarEndPicker(blockId);
            return;
        }

        if (tileKey === 'repeatBar') {
            openFlowRepeatBarPicker(blockId);
            return;
        }

        if (tileKey === 'intro') {
            openFlowIntroPicker(blockId);
            return;
        }

        if (tileKey === 'change') {
            openFlowRampModal(blockId);
            return;
        }

        if (tileKey === 'sign') {
            openFlowSignPicker(blockId);
            return;
        }

        if (tileKey === 'jump') {
            openFlowJumpPicker(blockId);
            return;
        }

        if (tileKey === 'pause') {
            openFlowFermataModal(blockId);
        }
    }

    // --- Pauses list (#flowFermataModal) - fermata (held beat) and caesura (silent break) entries
    // for this block, each on its own bar/beat within it. The one Block Inspector tile that's a
    // list, not a single value, so it gets its own small modal rather than fitting the generic
    // choice-list shape. List edits (add/remove/replace) write immediately via flowUpdateBlock, same
    // as before; only the "Add new pause" fields below are a local draft, reset after each
    // insert/save. Existing entries have no id of their own (child rows, full-replace-on-save, see
    // replaceFermatas server-side) - identified by object reference within b.fermatas instead, same
    // as the row delete already relied on before Edit existed. ---
    let flowFermataDraft = null; // { kind: 'fermata'|'caesura', bar, beat, duration, maxBar, maxBeat }
    let flowFermataEditTarget = null; // the b.fermatas entry currently being edited, or null when adding new
    let flowFermataRowMenuTarget = null;
    // Collapsed by default once the block has at least one pause (the list + a "+ Add pause" button
    // is the scannable view then) - open by default when it has none, so a user who opened this
    // modal specifically to add one isn't made to tap an extra button on an empty screen first.
    // Always forced open while editing/adding (openFlowFermataModal/the row menu/openFormBtn set it).
    let flowFermataFormOpen = true;

    // Time-delivered order - earliest bar, then earliest beat within it - regardless of the order
    // entries were added in.
    function flowPauseSorted(fermatas) {
        return [...fermatas].sort((a, b) => (a.barOffset || 0) - (b.barOffset || 0) || a.beatOffset - b.beatOffset);
    }
    function renderFlowFermataList() {
        const b = flowFindBlockById(flowFermataTargetBlockId);
        const list = document.getElementById('flowFermataList');
        if (!b || !list) return;
        const fermatas = b.fermatas || [];
        // A round-trip through the server (non-edit-mode) replaces b.fermatas with fresh objects -
        // if the entry an in-progress edit pointed at no longer exists by reference, drop back to
        // "add new" rather than silently discarding the edit on Save (renderFlowFermataAddSection
        // reflects this back into the label/button text).
        if (flowFermataEditTarget && !fermatas.includes(flowFermataEditTarget)) {
            flowFermataEditTarget = null;
        }
        // "Current pauses" header (+ count) only makes sense once there's something to count - the
        // empty-block state shows nothing here at all, just the form (no placeholder text either).
        document.getElementById('flowFermataListHeader')?.classList.toggle('hidden-group', !fermatas.length);
        const countBadge = document.getElementById('flowFermataCountBadge');
        if (countBadge) countBadge.innerText = String(fermatas.length);
        if (!fermatas.length) {
            list.innerHTML = '';
            return;
        }
        const maxBar = Math.max(1, b.barCount || 1);
        const sorted = flowPauseSorted(fermatas);
        // A fresh render throws every row away - any swipe left open on the previous render is
        // already gone with it, same as Quick Play's own qpOpenSwipeIndex/Flow block's own
        // flowOpenSwipeBlockId reset on their own re-renders.
        flowOpenSwipePauseIndex = null;
        list.innerHTML = sorted.map((f, i) => {
            const kind = f.kind || 'fermata';
            const durationTag = `${kind === 'caesura' ? 'Silence' : 'Hold'} ${f.holdBeats} beat${f.holdBeats === 1 ? '' : 's'}`;
            // Flags a pause left stranded on a bar that no longer exists after the block was
            // shortened - same "show the stale value in red with a warning icon" treatment as the
            // Intro/Alt ending pickers' own stepper readouts, rather than hiding or clamping it.
            const invalid = ((f.barOffset || 0) + 1) > maxBar;
            // .flow-fermata-box is the same clipping-wrapper-with-delete-underlay-behind shape as
            // Flow's own block cards/Quick Play's bar boxes (wireFlowBlockSwipe/wireQpBarSwipe) - the
            // row itself (.flow-fermata-row) is what slides, the 3-dot menu keeps offering Edit/Delete
            // too, this is just a second way to reach the same delete.
            return `
                <div class="flow-fermata-box" data-pause-index="${i}">
                    <div class="flow-fermata-delete-underlay" data-pause-swipe-delete aria-label="Delete pause">
                        <span class="material-symbols-outlined">delete</span>
                        <span>Delete</span>
                    </div>
                    <div class="flow-fermata-row">
                        <span class="flow-fermata-row-text${invalid ? ' flow-fermata-row-text-invalid' : ''}">
                            ${invalid ? flowWarningIconSvg('flow-warning-icon') : flowPauseIconSvg(kind, true)}
                            <span>Bar ${(f.barOffset || 0) + 1}, beat ${f.beatOffset} &middot; <span class="flow-fermata-row-tag">${durationTag}</span></span>
                        </span>
                        <button type="button" class="list-item-menu-btn" data-pause-menu aria-label="Pause options"><span class="material-symbols-outlined">more_vert</span></button>
                    </div>
                </div>
            `;
        }).join('');
        list.querySelectorAll('[data-pause-menu]').forEach((btn, i) => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                openFlowFermataRowMenu(btn, sorted[i]);
            });
        });
        list.querySelectorAll('.flow-fermata-box').forEach((boxEl, i) => {
            const target = sorted[i];
            wireFlowPauseSwipe(boxEl, i, async () => {
                await flowUpdateBlock(b.id, { fermatas: fermatas.filter(x => x !== target) });
                renderFlowFermataList();
            });
        });
    }
    // --- Pause row swipe-to-delete - same shape as wireFlowBlockSwipe/wireQpBarSwipe (only intercepts
    // once the gesture is confirmed horizontal, so the page's own vertical scroll is untouched), just
    // without the reorder half those two also have (pauses aren't reorderable). Tracked by index
    // within the current render's sorted list, not object identity - renderFlowFermataList already
    // resets flowOpenSwipePauseIndex to null on every re-render, so a stale index never lingers. ---
    let flowOpenSwipePauseIndex = null;
    const FLOW_PAUSE_SWIPE_LOCK_X_PX = 30;
    const FLOW_PAUSE_SWIPE_LOCK_Y_MAX_PX = 15;
    const FLOW_PAUSE_SWIPE_OPEN_PX = 96; // keep in sync with .flow-fermata-delete-underlay's width in style.css
    const FLOW_PAUSE_SWIPE_SNAP_THRESHOLD_PX = 48;
    const FLOW_PAUSE_SWIPE_EXCLUDE_SELECTOR = 'button, input, [role="slider"], [role="button"]';
    function flowPauseSurfaceFor(index) {
        return document.querySelector(`#flowFermataList [data-pause-index="${index}"] .flow-fermata-row`);
    }
    function flowSetPauseSwipeOffset(index, offset, animate) {
        const surface = flowPauseSurfaceFor(index);
        if (!surface) return;
        surface.style.transition = animate ? 'transform 0.2s ease' : 'none';
        surface.style.transform = offset ? `translateX(${offset}px)` : '';
    }
    function flowCloseOpenPauseSwipe(animate = true) {
        if (flowOpenSwipePauseIndex === null) return;
        flowSetPauseSwipeOffset(flowOpenSwipePauseIndex, 0, animate);
        flowOpenSwipePauseIndex = null;
    }
    document.addEventListener('pointerdown', (e) => {
        if (flowOpenSwipePauseIndex === null) return;
        const openBoxEl = document.querySelector(`#flowFermataList [data-pause-index="${flowOpenSwipePauseIndex}"]`);
        if (openBoxEl && !openBoxEl.contains(e.target)) flowCloseOpenPauseSwipe();
    });
    function wireFlowPauseSwipe(boxEl, index, onDelete) {
        const surfaceEl = boxEl.querySelector('.flow-fermata-row');
        let startX = 0, startY = 0, tracking = false, locked = false, abandoned = false;
        function currentBaseOffset() { return flowOpenSwipePauseIndex === index ? -FLOW_PAUSE_SWIPE_OPEN_PX : 0; }
        function onMove(e) {
            if (!tracking || abandoned) return;
            const dx = e.clientX - startX;
            const dy = e.clientY - startY;
            if (!locked) {
                if (Math.abs(dx) > FLOW_PAUSE_SWIPE_LOCK_X_PX && Math.abs(dy) < FLOW_PAUSE_SWIPE_LOCK_Y_MAX_PX) {
                    locked = true;
                    if (flowOpenSwipePauseIndex !== null && flowOpenSwipePauseIndex !== index) flowCloseOpenPauseSwipe(false);
                } else if (Math.abs(dy) >= FLOW_PAUSE_SWIPE_LOCK_Y_MAX_PX) {
                    abandoned = true;
                    return;
                } else {
                    return;
                }
            }
            e.preventDefault();
            const offset = Math.min(0, Math.max(-FLOW_PAUSE_SWIPE_OPEN_PX, currentBaseOffset() + dx));
            surfaceEl.style.transition = 'none';
            surfaceEl.style.transform = `translateX(${offset}px)`;
        }
        function onUp(e) {
            if (!tracking) return;
            tracking = false;
            document.removeEventListener('pointermove', onMove);
            document.removeEventListener('pointerup', onUp);
            if (!locked) return;
            const dx = e.clientX - startX;
            const finalOffset = Math.min(0, Math.max(-FLOW_PAUSE_SWIPE_OPEN_PX, currentBaseOffset() + dx));
            if (Math.abs(finalOffset) > FLOW_PAUSE_SWIPE_SNAP_THRESHOLD_PX) {
                flowSetPauseSwipeOffset(index, -FLOW_PAUSE_SWIPE_OPEN_PX, true);
                flowOpenSwipePauseIndex = index;
            } else {
                flowSetPauseSwipeOffset(index, 0, true);
                if (flowOpenSwipePauseIndex === index) flowOpenSwipePauseIndex = null;
            }
        }
        boxEl.addEventListener('pointerdown', (e) => {
            if (e.target.closest(FLOW_PAUSE_SWIPE_EXCLUDE_SELECTOR)) return;
            startX = e.clientX;
            startY = e.clientY;
            tracking = true;
            locked = false;
            abandoned = false;
            document.addEventListener('pointermove', onMove);
            document.addEventListener('pointerup', onUp);
        });
        boxEl.querySelector('[data-pause-swipe-delete]')?.addEventListener('click', (e) => {
            e.stopPropagation();
            flowOpenSwipePauseIndex = null;
            onDelete();
        });
    }
    // Shows/hides the form vs. the "+ Add pause" button - separate from renderFlowFermataAddSection
    // (which fills in the form's own content) since the two toggle independently: closing the form
    // doesn't touch the draft, and re-rendering the draft doesn't touch open/closed state.
    function renderFlowFermataFormState() {
        document.getElementById('flowFermataAddBox')?.classList.toggle('hidden-group', !flowFermataFormOpen);
        document.getElementById('flowFermataOpenFormBtn')?.classList.toggle('hidden-group', flowFermataFormOpen);
    }
    function renderFlowFermataAddSection() {
        const draft = flowFermataDraft;
        if (!draft) return;
        const b = flowFindBlockById(flowFermataTargetBlockId);
        const editing = !!flowFermataEditTarget;
        const hasPauses = !!(b && b.fermatas && b.fermatas.length);
        // Leads with the plain-English effect ("Hold note"/"Silent pause"), the musical term
        // ("Fermata"/"Caesura") second and smaller - most users recognise the symbol, not the term.
        document.getElementById('flowFermataKindGrid').innerHTML = [
            { key: 'fermata', title: 'Hold note', sub: 'Fermata' },
            { key: 'caesura', title: 'Silent pause', sub: 'Caesura' }
        ].map(o => `
            <button type="button" class="flow-pause-kind-btn${draft.kind === o.key ? ' selected' : ''}" data-pause-kind="${o.key}">
                ${flowPauseIconSvg(o.key)}
                <span class="flow-pause-kind-title">${o.title}</span>
                <span class="flow-pause-kind-sub">${o.sub}</span>
            </button>
        `).join('');
        document.getElementById('flowFermataKindGrid').querySelectorAll('[data-pause-kind]').forEach(btn => {
            btn.addEventListener('click', () => {
                draft.kind = btn.dataset.pauseKind;
                renderFlowFermataAddSection();
            });
        });
        // Editing a pause already stranded on a bar the block no longer has (see the row list's own
        // flow-fermata-row-text-invalid) carries the same red flag into the form - the warning icon
        // sits to the left of the minus button (flowFermataBarWarning), not inside the readout, so
        // it reads as "this whole row needs fixing" while still letting the stepper walk the value
        // back down into range (not clamped, same "flag, don't clamp" rule as everywhere else).
        const barInvalid = draft.bar > draft.maxBar;
        const barValueEl = document.getElementById('flowFermataBarValue');
        barValueEl.classList.toggle('flow-bar-readout-invalid', barInvalid);
        barValueEl.innerText = `Bar ${draft.bar} of ${draft.maxBar}`;
        document.getElementById('flowFermataBarWarning').innerHTML = barInvalid ? flowWarningIconSvg('flow-warning-icon') : '';
        document.getElementById('flowFermataBeatValue').innerText = `Beat ${draft.beat} of ${draft.maxBeat}`;
        document.getElementById('flowFermataDurationValue').innerText = `${draft.duration} beat${draft.duration === 1 ? '' : 's'}`;
        document.getElementById('flowFermataBeatLabel').innerText = draft.kind === 'caesura' ? 'After beat' : 'On beat';
        document.getElementById('flowFermataDurationLabel').innerText = draft.kind === 'caesura' ? 'Silence duration' : 'Hold duration';
        // No caption at all on the empty-block form (nothing to distinguish it from) - "Add another
        // pause"/"Edit pause" once the block already has at least one, matching how this form was
        // reached (the +Add another pause button vs. a row's Edit menu item).
        const addBoxLabel = document.getElementById('flowFermataAddBoxLabel');
        addBoxLabel.classList.toggle('hidden-group', !hasPauses);
        addBoxLabel.innerText = editing ? 'Edit pause' : 'Add another pause';
        // Three distinct button copies: the very first pause on an empty block ("+ Insert pause into
        // block"), an additional one once the list is already populated ("+ Add pause"), and editing
        // an existing one ("Update pause") - matches how each of those states was reached.
        document.getElementById('flowFermataAddBtn').innerText = editing ? 'Update pause' : (hasPauses ? '+ Add pause' : '+ Insert pause into block');
        // Only meaningful when there's a collapsed list view to cancel back to - the empty-block
        // form has nowhere to collapse to, so no Cancel there.
        document.getElementById('flowFermataCancelEditBtn').classList.toggle('hidden-group', !hasPauses);
    }
    function flowFermataResetDraft(kind) {
        const b = flowFindBlockById(flowFermataTargetBlockId);
        flowFermataDraft = {
            kind: kind || 'fermata', bar: 1, beat: 1, duration: 2,
            maxBar: Math.max(1, (b && b.barCount) || 1), maxBeat: Math.max(1, (b && b.numerator) || 4)
        };
    }
    function openFlowFermataModal(blockId) {
        const b = flowFindBlockById(blockId);
        if (!b) return;
        flowFermataTargetBlockId = blockId;
        const idx = currentFlowBlocks.findIndex(x => x.id === blockId);
        document.getElementById('flowFermataPill').innerText = idx === -1 ? '' : flowBarRangeLabel(idx);
        flowFermataEditTarget = null;
        flowFermataResetDraft();
        flowFermataFormOpen = !(b.fermatas && b.fermatas.length);
        renderFlowFermataList();
        renderFlowFermataAddSection();
        renderFlowFermataFormState();
        document.getElementById('flowFermataModal').style.display = 'flex';
    }
    function closeFlowFermataModal() {
        document.getElementById('flowFermataModal').style.display = 'none';
        flowFermataTargetBlockId = null;
        flowFermataDraft = null;
        flowFermataEditTarget = null;
    }
    document.getElementById('flowFermataOpenFormBtn')?.addEventListener('click', () => {
        flowFermataEditTarget = null;
        flowFermataResetDraft();
        flowFermataFormOpen = true;
        renderFlowFermataAddSection();
        renderFlowFermataFormState();
    });
    // --- Per-row options menu (Edit/Delete) - same shared floating dropdown-menu + measure-then-
    // clamp positioning as openFlowBlockMenu/openQpHistoryItemMenu. ---
    function openFlowFermataRowMenu(btnEl, target) {
        flowFermataRowMenuTarget = target;
        const menu = document.getElementById('flowFermataRowMenu');
        menu.classList.add('show');
        const btnRect = btnEl.getBoundingClientRect();
        const menuWidth = menu.offsetWidth;
        const menuHeight = menu.offsetHeight;
        let left = btnRect.right - menuWidth;
        left = Math.max(8, Math.min(left, window.innerWidth - menuWidth - 8));
        let top = btnRect.bottom + 4;
        top = Math.min(top, window.innerHeight - menuHeight - 8);
        menu.style.left = `${left}px`;
        menu.style.top = `${top}px`;
    }
    function closeFlowFermataRowMenu() {
        document.getElementById('flowFermataRowMenu')?.classList.remove('show');
    }
    document.addEventListener('click', closeFlowFermataRowMenu);
    document.getElementById('flowFermataRowMenuEdit')?.addEventListener('click', (e) => {
        e.stopPropagation();
        const target = flowFermataRowMenuTarget;
        closeFlowFermataRowMenu();
        if (!target) return;
        flowFermataEditTarget = target;
        const kind = target.kind || 'fermata';
        flowFermataResetDraft(kind);
        flowFermataDraft.bar = (target.barOffset || 0) + 1;
        flowFermataDraft.beat = target.beatOffset;
        flowFermataDraft.duration = target.holdBeats;
        flowFermataFormOpen = true;
        renderFlowFermataAddSection();
        renderFlowFermataFormState();
    });
    document.getElementById('flowFermataRowMenuDelete')?.addEventListener('click', async (e) => {
        e.stopPropagation();
        const target = flowFermataRowMenuTarget;
        closeFlowFermataRowMenu();
        const b = flowFindBlockById(flowFermataTargetBlockId);
        if (!b || !target) return;
        if (flowFermataEditTarget === target) {
            flowFermataEditTarget = null;
            flowFermataResetDraft(flowFermataDraft ? flowFermataDraft.kind : undefined);
        }
        const remaining = (b.fermatas || []).filter(f => f !== target);
        await flowUpdateBlock(b.id, { fermatas: remaining });
        // Back to the empty-state "form always open" behaviour once the last pause is gone.
        if (!remaining.length) flowFermataFormOpen = true;
        renderFlowFermataList();
        renderFlowFermataAddSection();
        renderFlowFermataFormState();
    });
    document.getElementById('flowFermataCancelEditBtn')?.addEventListener('click', () => {
        flowFermataEditTarget = null;
        flowFermataResetDraft(flowFermataDraft ? flowFermataDraft.kind : undefined);
        flowFermataFormOpen = false;
        renderFlowFermataAddSection();
        renderFlowFermataFormState();
    });
    setupHoldStepper(document.getElementById('flowFermataBarMinus'), -1, (amount) => {
        if (!flowFermataDraft) return;
        flowFermataDraft.bar = Math.max(1, flowFermataDraft.bar + amount);
        renderFlowFermataAddSection();
    });
    setupHoldStepper(document.getElementById('flowFermataBarPlus'), 1, (amount) => {
        if (!flowFermataDraft) return;
        flowFermataDraft.bar = Math.max(1, Math.min(flowFermataDraft.maxBar, flowFermataDraft.bar + amount));
        renderFlowFermataAddSection();
    });
    setupHoldStepper(document.getElementById('flowFermataBeatMinus'), -1, (amount) => {
        if (!flowFermataDraft) return;
        flowFermataDraft.beat = Math.max(1, flowFermataDraft.beat + amount);
        renderFlowFermataAddSection();
    });
    setupHoldStepper(document.getElementById('flowFermataBeatPlus'), 1, (amount) => {
        if (!flowFermataDraft) return;
        flowFermataDraft.beat = Math.max(1, Math.min(flowFermataDraft.maxBeat, flowFermataDraft.beat + amount));
        renderFlowFermataAddSection();
    });
    setupHoldStepper(document.getElementById('flowFermataDurationMinus'), -1, (amount) => {
        if (!flowFermataDraft) return;
        flowFermataDraft.duration = Math.max(2, flowFermataDraft.duration + amount);
        renderFlowFermataAddSection();
    });
    setupHoldStepper(document.getElementById('flowFermataDurationPlus'), 1, (amount) => {
        if (!flowFermataDraft) return;
        flowFermataDraft.duration = Math.max(2, Math.min(4, flowFermataDraft.duration + amount));
        renderFlowFermataAddSection();
    });
    document.getElementById('flowFermataAddBtn')?.addEventListener('click', async () => {
        const b = flowFindBlockById(flowFermataTargetBlockId);
        if (!b || !flowFermataDraft) return;
        const draft = flowFermataDraft;
        const entry = {
            kind: draft.kind, barOffset: draft.bar - 1, beatOffset: draft.beat, holdBeats: draft.duration,
            playbackMode: draft.kind === 'caesura' ? 'silent' : 'tone'
        };
        const existing = b.fermatas || [];
        const fermatas = flowFermataEditTarget
            ? existing.map(f => f === flowFermataEditTarget ? entry : f)
            : [...existing, entry];
        await flowUpdateBlock(b.id, { fermatas });
        flowFermataEditTarget = null;
        flowFermataResetDraft(draft.kind);
        // Collapse back to the list + "+ Add pause" button - fermatas is never empty at this point
        // (an entry was just inserted/updated into it), so this always lands in the populated state.
        flowFermataFormOpen = false;
        renderFlowFermataList();
        renderFlowFermataAddSection();
        renderFlowFermataFormState();
    });
    document.getElementById('flowFermataCloseBtn')?.addEventListener('click', closeFlowFermataModal);

    // --- Tempo ramps list (#flowRampModal) - same shape as the Pauses list directly above (list +
    // count once populated, "+ Add another ramp" collapses the form, row Edit/Delete via the 3-dot
    // menu plus swipe-to-delete), one ramp entry being { startBarOffset, startBeatOffset, endMode:
    // 'block_end'|'specific', endBarOffset, endBeatOffset, targetMode: 'next_block'|'custom',
    // targetBpm } (metronome_segment_ramps - a block can hold more than one, ML-179 follow-up).
    // List edits write immediately via flowUpdateBlock, same as Pauses; only the form below is a
    // local draft, reset after each insert/save. ---
    let flowRampDraft = null; // { bar, beat, endMode, endBar, endBeat, targetMode, targetBpm, maxBar, maxBeat }
    let flowRampEditTarget = null; // the b.ramps entry currently being edited, or null when adding new
    let flowRampRowMenuTarget = null;
    let flowRampTargetBlockId = null;
    let flowRampFormOpen = true;

    // The block right after the one this modal is open for, in sequence - what a 'next_block'
    // target mode actually resolves to (and, if undefined, why that target mode is flagged invalid).
    function flowRampNextBlock() {
        const idx = currentFlowBlocks.findIndex(x => x.id === flowRampTargetBlockId);
        return idx === -1 ? undefined : currentFlowBlocks[idx + 1];
    }
    function flowRampSorted(ramps) {
        return [...ramps].sort((a, b) => (a.startBarOffset || 0) - (b.startBarOffset || 0) || a.startBeatOffset - b.startBeatOffset);
    }
    function flowRampEndLabel(r) {
        return r.endMode === 'specific' ? `Bar ${(r.endBarOffset || 0) + 1}, beat ${r.endBeatOffset}` : 'End of block';
    }
    function flowRampTargetLabel(r, nextBlock) {
        if (r.targetMode === 'custom') return `${r.targetBpm} bpm`;
        return nextBlock ? `${nextBlock.bpm} bpm` : 'next block';
    }
    function flowRampRowInvalid(r, maxBar, nextBlock) {
        if (((r.startBarOffset || 0) + 1) > maxBar) return true;
        if (r.endMode === 'specific' && ((r.endBarOffset || 0) + 1) > maxBar) return true;
        if (r.targetMode === 'next_block' && !nextBlock) return true;
        return false;
    }
    function renderFlowRampList() {
        const b = flowFindBlockById(flowRampTargetBlockId);
        const list = document.getElementById('flowRampList');
        if (!b || !list) return;
        const ramps = b.ramps || [];
        if (flowRampEditTarget && !ramps.includes(flowRampEditTarget)) {
            flowRampEditTarget = null;
        }
        document.getElementById('flowRampListHeader')?.classList.toggle('hidden-group', !ramps.length);
        const countBadge = document.getElementById('flowRampCountBadge');
        if (countBadge) countBadge.innerText = String(ramps.length);
        if (!ramps.length) {
            list.innerHTML = '';
            return;
        }
        const maxBar = Math.max(1, b.barCount || 1);
        const nextBlock = flowRampNextBlock();
        const sorted = flowRampSorted(ramps);
        flowOpenSwipeRampIndex = null;
        list.innerHTML = sorted.map((r, i) => {
            const invalid = flowRampRowInvalid(r, maxBar, nextBlock);
            return `
                <div class="flow-ramp-box" data-ramp-index="${i}">
                    <div class="flow-ramp-delete-underlay" data-ramp-swipe-delete aria-label="Delete ramp">
                        <span class="material-symbols-outlined">delete</span>
                        <span>Delete</span>
                    </div>
                    <div class="flow-ramp-row">
                        <span class="flow-ramp-row-text${invalid ? ' flow-ramp-row-text-invalid' : ''}">
                            <span class="flow-ramp-row-icon${invalid ? ' invalid' : ''}">${invalid ? flowWarningIconSvg() : flowRampIconSvg(flowRampDirection(r, b, nextBlock))}</span>
                            <span class="flow-ramp-row-lines">
                                <span class="flow-ramp-row-title">Bar ${(r.startBarOffset || 0) + 1}, beat ${r.startBeatOffset} &rarr; ${flowRampEndLabel(r)}</span>
                                <span class="flow-ramp-row-tag">Tempo change &middot; To ${flowRampTargetLabel(r, nextBlock)}</span>
                            </span>
                        </span>
                        <button type="button" class="list-item-menu-btn" data-ramp-menu aria-label="Ramp options"><span class="material-symbols-outlined">more_vert</span></button>
                    </div>
                </div>
            `;
        }).join('');
        list.querySelectorAll('[data-ramp-menu]').forEach((btn, i) => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                openFlowRampRowMenu(btn, sorted[i]);
            });
        });
        list.querySelectorAll('.flow-ramp-box').forEach((boxEl, i) => {
            const target = sorted[i];
            wireFlowRampSwipe(boxEl, i, async () => {
                await flowUpdateBlock(b.id, { ramps: ramps.filter(x => x !== target) });
                renderFlowRampList();
            });
        });
    }
    // --- Ramp row swipe-to-delete - own copy of wireFlowPauseSwipe's own shape (which is itself its
    // own copy of wireFlowBlockSwipe/wireQpBarSwipe, minus their reorder half - see that function's
    // own comment for why this isn't shared code). ---
    let flowOpenSwipeRampIndex = null;
    const FLOW_RAMP_SWIPE_LOCK_X_PX = 30;
    const FLOW_RAMP_SWIPE_LOCK_Y_MAX_PX = 15;
    const FLOW_RAMP_SWIPE_OPEN_PX = 96; // keep in sync with .flow-ramp-delete-underlay's width in style.css
    const FLOW_RAMP_SWIPE_SNAP_THRESHOLD_PX = 48;
    const FLOW_RAMP_SWIPE_EXCLUDE_SELECTOR = 'button, input, [role="slider"], [role="button"]';
    function flowRampSurfaceFor(index) {
        return document.querySelector(`#flowRampList [data-ramp-index="${index}"] .flow-ramp-row`);
    }
    function flowSetRampSwipeOffset(index, offset, animate) {
        const surface = flowRampSurfaceFor(index);
        if (!surface) return;
        surface.style.transition = animate ? 'transform 0.2s ease' : 'none';
        surface.style.transform = offset ? `translateX(${offset}px)` : '';
    }
    function flowCloseOpenRampSwipe(animate = true) {
        if (flowOpenSwipeRampIndex === null) return;
        flowSetRampSwipeOffset(flowOpenSwipeRampIndex, 0, animate);
        flowOpenSwipeRampIndex = null;
    }
    document.addEventListener('pointerdown', (e) => {
        if (flowOpenSwipeRampIndex === null) return;
        const openBoxEl = document.querySelector(`#flowRampList [data-ramp-index="${flowOpenSwipeRampIndex}"]`);
        if (openBoxEl && !openBoxEl.contains(e.target)) flowCloseOpenRampSwipe();
    });
    function wireFlowRampSwipe(boxEl, index, onDelete) {
        const surfaceEl = boxEl.querySelector('.flow-ramp-row');
        let startX = 0, startY = 0, tracking = false, locked = false, abandoned = false;
        function currentBaseOffset() { return flowOpenSwipeRampIndex === index ? -FLOW_RAMP_SWIPE_OPEN_PX : 0; }
        function onMove(e) {
            if (!tracking || abandoned) return;
            const dx = e.clientX - startX;
            const dy = e.clientY - startY;
            if (!locked) {
                if (Math.abs(dx) > FLOW_RAMP_SWIPE_LOCK_X_PX && Math.abs(dy) < FLOW_RAMP_SWIPE_LOCK_Y_MAX_PX) {
                    locked = true;
                    if (flowOpenSwipeRampIndex !== null && flowOpenSwipeRampIndex !== index) flowCloseOpenRampSwipe(false);
                } else if (Math.abs(dy) >= FLOW_RAMP_SWIPE_LOCK_Y_MAX_PX) {
                    abandoned = true;
                    return;
                } else {
                    return;
                }
            }
            e.preventDefault();
            const offset = Math.min(0, Math.max(-FLOW_RAMP_SWIPE_OPEN_PX, currentBaseOffset() + dx));
            surfaceEl.style.transition = 'none';
            surfaceEl.style.transform = `translateX(${offset}px)`;
        }
        function onUp(e) {
            if (!tracking) return;
            tracking = false;
            document.removeEventListener('pointermove', onMove);
            document.removeEventListener('pointerup', onUp);
            if (!locked) return;
            const dx = e.clientX - startX;
            const finalOffset = Math.min(0, Math.max(-FLOW_RAMP_SWIPE_OPEN_PX, currentBaseOffset() + dx));
            if (Math.abs(finalOffset) > FLOW_RAMP_SWIPE_SNAP_THRESHOLD_PX) {
                flowSetRampSwipeOffset(index, -FLOW_RAMP_SWIPE_OPEN_PX, true);
                flowOpenSwipeRampIndex = index;
            } else {
                flowSetRampSwipeOffset(index, 0, true);
                if (flowOpenSwipeRampIndex === index) flowOpenSwipeRampIndex = null;
            }
        }
        boxEl.addEventListener('pointerdown', (e) => {
            if (e.target.closest(FLOW_RAMP_SWIPE_EXCLUDE_SELECTOR)) return;
            startX = e.clientX;
            startY = e.clientY;
            tracking = true;
            locked = false;
            abandoned = false;
            document.addEventListener('pointermove', onMove);
            document.addEventListener('pointerup', onUp);
        });
        boxEl.querySelector('[data-ramp-swipe-delete]')?.addEventListener('click', (e) => {
            e.stopPropagation();
            flowOpenSwipeRampIndex = null;
            onDelete();
        });
    }
    function renderFlowRampFormState() {
        document.getElementById('flowRampAddBox')?.classList.toggle('hidden-group', !flowRampFormOpen);
        document.getElementById('flowRampOpenFormBtn')?.classList.toggle('hidden-group', flowRampFormOpen);
    }
    function renderFlowRampAddSection() {
        const draft = flowRampDraft;
        if (!draft) return;
        const editing = !!flowRampEditTarget;
        const b = flowFindBlockById(flowRampTargetBlockId);
        const hasRamps = !!(b && b.ramps && b.ramps.length);
        const nextBlock = flowRampNextBlock();

        const barInvalid = draft.bar > draft.maxBar;
        const barValueEl = document.getElementById('flowRampBarValue');
        barValueEl.classList.toggle('flow-bar-readout-invalid', barInvalid);
        barValueEl.innerText = `Bar ${draft.bar} of ${draft.maxBar}`;
        document.getElementById('flowRampBeatValue').innerText = `Beat ${draft.beat} of ${draft.maxBeat}`;

        document.querySelectorAll('#flowRampEndModeToggle [data-ramp-end-mode]').forEach(btn => {
            btn.classList.toggle('selected', btn.dataset.rampEndMode === draft.endMode);
        });
        const specific = draft.endMode === 'specific';
        document.getElementById('flowRampEndBarCard')?.classList.toggle('hidden-group', !specific);
        document.getElementById('flowRampEndBeatCard')?.classList.toggle('hidden-group', !specific);
        if (specific) {
            const endBarInvalid = draft.endBar > draft.maxBar;
            const endBarValueEl = document.getElementById('flowRampEndBarValue');
            endBarValueEl.classList.toggle('flow-bar-readout-invalid', endBarInvalid);
            endBarValueEl.innerText = `Bar ${draft.endBar} of ${draft.maxBar}`;
            document.getElementById('flowRampEndBarWarning').innerHTML = endBarInvalid ? flowWarningIconSvg('flow-warning-icon') : '';
            document.getElementById('flowRampEndBeatValue').innerText = `Beat ${draft.endBeat} of ${draft.maxBeat}`;
            // A ramp landing at a specific mid-block beat can't defer to "whatever the next block's
            // bpm turns out to be" - same forced-value rule validateSegmentPayload enforces server-side.
            if (draft.targetMode === 'next_block') draft.targetMode = 'custom';
        }

        document.getElementById('flowRampTargetSubtitle').innerText = specific ? 'Only custom bpm allowed before block end' : 'Final tempo to reach';
        document.getElementById('flowRampTargetGrid').innerHTML = [
            { key: 'next_block', title: 'Next block', sub: nextBlock ? `${nextBlock.bpm} bpm` : 'No next block', disabled: specific || !nextBlock },
            { key: 'custom', title: 'Custom bpm', sub: `${draft.targetBpm} bpm` }
        ].map(o => `
            <button type="button" class="flow-pause-kind-btn${draft.targetMode === o.key ? ' selected' : ''}" data-ramp-target="${o.key}"${o.disabled ? ' disabled' : ''}>
                <span class="flow-pause-kind-title">${o.title}</span>
                <span class="flow-pause-kind-sub">${o.sub}</span>
            </button>
        `).join('');
        document.querySelectorAll('#flowRampTargetGrid [data-ramp-target]:not(:disabled)').forEach(btn => {
            btn.addEventListener('click', () => {
                draft.targetMode = btn.dataset.rampTarget;
                renderFlowRampAddSection();
            });
        });

        const showCustomTempo = draft.targetMode === 'custom';
        document.getElementById('flowRampCustomTempoCard')?.classList.toggle('hidden-group', !showCustomTempo);
        document.getElementById('flowRampCustomTempoValue').innerText = draft.targetBpm;

        const addBoxLabel = document.getElementById('flowRampAddBoxLabel');
        addBoxLabel.classList.toggle('hidden-group', !hasRamps);
        addBoxLabel.innerText = editing ? 'Edit ramp' : 'Add another ramp';
        document.getElementById('flowRampAddBtn').innerText = editing ? 'Update ramp' : (hasRamps ? '+ Add ramp' : '+ Insert ramp into block');
        document.getElementById('flowRampCancelEditBtn').classList.toggle('hidden-group', !hasRamps);
    }
    function flowRampResetDraft() {
        const b = flowFindBlockById(flowRampTargetBlockId);
        const nextBlock = flowRampNextBlock();
        flowRampDraft = {
            bar: 1, beat: 1,
            endMode: 'block_end', endBar: 1, endBeat: 1,
            // "Next block" is the more useful default when there is one (matches the old single-ramp
            // field's own implicit "lands on the next segment's bpm" behaviour) - falls back to
            // custom when there isn't, since "next block" would have nothing to resolve to.
            targetMode: nextBlock ? 'next_block' : 'custom',
            targetBpm: (b && b.bpm) || 120,
            maxBar: Math.max(1, (b && b.barCount) || 1), maxBeat: Math.max(1, (b && b.numerator) || 4)
        };
    }
    function openFlowRampModal(blockId) {
        const b = flowFindBlockById(blockId);
        if (!b) return;
        flowRampTargetBlockId = blockId;
        const idx = currentFlowBlocks.findIndex(x => x.id === blockId);
        document.getElementById('flowRampPill').innerText = idx === -1 ? '' : flowBarRangeLabel(idx);
        flowRampEditTarget = null;
        flowRampResetDraft();
        flowRampFormOpen = !(b.ramps && b.ramps.length);
        renderFlowRampList();
        renderFlowRampAddSection();
        renderFlowRampFormState();
        document.getElementById('flowRampModal').style.display = 'flex';
    }
    function closeFlowRampModal() {
        document.getElementById('flowRampModal').style.display = 'none';
        flowRampTargetBlockId = null;
        flowRampDraft = null;
        flowRampEditTarget = null;
    }
    document.getElementById('flowRampOpenFormBtn')?.addEventListener('click', () => {
        flowRampEditTarget = null;
        flowRampResetDraft();
        flowRampFormOpen = true;
        renderFlowRampAddSection();
        renderFlowRampFormState();
    });
    function openFlowRampRowMenu(btnEl, target) {
        flowRampRowMenuTarget = target;
        const menu = document.getElementById('flowRampRowMenu');
        menu.classList.add('show');
        const btnRect = btnEl.getBoundingClientRect();
        const menuWidth = menu.offsetWidth;
        const menuHeight = menu.offsetHeight;
        let left = btnRect.right - menuWidth;
        left = Math.max(8, Math.min(left, window.innerWidth - menuWidth - 8));
        let top = btnRect.bottom + 4;
        top = Math.min(top, window.innerHeight - menuHeight - 8);
        menu.style.left = `${left}px`;
        menu.style.top = `${top}px`;
    }
    function closeFlowRampRowMenu() {
        document.getElementById('flowRampRowMenu')?.classList.remove('show');
    }
    document.addEventListener('click', closeFlowRampRowMenu);
    document.getElementById('flowRampRowMenuEdit')?.addEventListener('click', (e) => {
        e.stopPropagation();
        const target = flowRampRowMenuTarget;
        closeFlowRampRowMenu();
        if (!target) return;
        flowRampEditTarget = target;
        flowRampResetDraft();
        flowRampDraft.bar = (target.startBarOffset || 0) + 1;
        flowRampDraft.beat = target.startBeatOffset;
        flowRampDraft.endMode = target.endMode;
        flowRampDraft.endBar = (target.endBarOffset || 0) + 1;
        flowRampDraft.endBeat = target.endBeatOffset || 1;
        flowRampDraft.targetMode = target.targetMode;
        flowRampDraft.targetBpm = target.targetBpm || flowRampDraft.targetBpm;
        flowRampFormOpen = true;
        renderFlowRampAddSection();
        renderFlowRampFormState();
    });
    document.getElementById('flowRampRowMenuDelete')?.addEventListener('click', async (e) => {
        e.stopPropagation();
        const target = flowRampRowMenuTarget;
        closeFlowRampRowMenu();
        const b = flowFindBlockById(flowRampTargetBlockId);
        if (!b || !target) return;
        if (flowRampEditTarget === target) {
            flowRampEditTarget = null;
            flowRampResetDraft();
        }
        const remaining = (b.ramps || []).filter(r => r !== target);
        await flowUpdateBlock(b.id, { ramps: remaining });
        // Back to the empty-state "form always open" behaviour once the last ramp is gone.
        if (!remaining.length) flowRampFormOpen = true;
        renderFlowRampList();
        renderFlowRampAddSection();
        renderFlowRampFormState();
    });
    document.getElementById('flowRampCancelEditBtn')?.addEventListener('click', () => {
        flowRampEditTarget = null;
        flowRampResetDraft();
        flowRampFormOpen = false;
        renderFlowRampAddSection();
        renderFlowRampFormState();
    });
    setupHoldStepper(document.getElementById('flowRampBarMinus'), -1, (amount) => {
        if (!flowRampDraft) return;
        flowRampDraft.bar = Math.max(1, flowRampDraft.bar + amount);
        renderFlowRampAddSection();
    });
    setupHoldStepper(document.getElementById('flowRampBarPlus'), 1, (amount) => {
        if (!flowRampDraft) return;
        flowRampDraft.bar = Math.max(1, Math.min(flowRampDraft.maxBar, flowRampDraft.bar + amount));
        renderFlowRampAddSection();
    });
    setupHoldStepper(document.getElementById('flowRampBeatMinus'), -1, (amount) => {
        if (!flowRampDraft) return;
        flowRampDraft.beat = Math.max(1, flowRampDraft.beat + amount);
        renderFlowRampAddSection();
    });
    setupHoldStepper(document.getElementById('flowRampBeatPlus'), 1, (amount) => {
        if (!flowRampDraft) return;
        flowRampDraft.beat = Math.max(1, Math.min(flowRampDraft.maxBeat, flowRampDraft.beat + amount));
        renderFlowRampAddSection();
    });
    setupHoldStepper(document.getElementById('flowRampEndBarMinus'), -1, (amount) => {
        if (!flowRampDraft) return;
        flowRampDraft.endBar = Math.max(1, flowRampDraft.endBar + amount);
        renderFlowRampAddSection();
    });
    setupHoldStepper(document.getElementById('flowRampEndBarPlus'), 1, (amount) => {
        if (!flowRampDraft) return;
        flowRampDraft.endBar = Math.max(1, Math.min(flowRampDraft.maxBar, flowRampDraft.endBar + amount));
        renderFlowRampAddSection();
    });
    setupHoldStepper(document.getElementById('flowRampEndBeatMinus'), -1, (amount) => {
        if (!flowRampDraft) return;
        flowRampDraft.endBeat = Math.max(1, flowRampDraft.endBeat + amount);
        renderFlowRampAddSection();
    });
    setupHoldStepper(document.getElementById('flowRampEndBeatPlus'), 1, (amount) => {
        if (!flowRampDraft) return;
        flowRampDraft.endBeat = Math.max(1, Math.min(flowRampDraft.maxBeat, flowRampDraft.endBeat + amount));
        renderFlowRampAddSection();
    });
    document.querySelectorAll('#flowRampEndModeToggle [data-ramp-end-mode]').forEach(btn => {
        btn.addEventListener('click', () => {
            if (!flowRampDraft) return;
            flowRampDraft.endMode = btn.dataset.rampEndMode;
            renderFlowRampAddSection();
        });
    });
    document.getElementById('flowRampCustomTempoBtn')?.addEventListener('click', () => {
        if (!flowRampDraft) return;
        flowOpenBpmModal(null, {
            value: flowRampDraft.targetBpm,
            onApply: (v) => {
                flowRampDraft.targetBpm = v;
                renderFlowRampAddSection();
            }
        });
    });
    document.getElementById('flowRampAddBtn')?.addEventListener('click', async () => {
        const b = flowFindBlockById(flowRampTargetBlockId);
        if (!b || !flowRampDraft) return;
        const draft = flowRampDraft;
        const entry = {
            startBarOffset: draft.bar - 1, startBeatOffset: draft.beat,
            endMode: draft.endMode,
            endBarOffset: draft.endMode === 'specific' ? draft.endBar - 1 : null,
            endBeatOffset: draft.endMode === 'specific' ? draft.endBeat : null,
            targetMode: draft.targetMode,
            targetBpm: draft.targetMode === 'custom' ? draft.targetBpm : null
        };
        const existing = b.ramps || [];
        const ramps = flowRampEditTarget
            ? existing.map(r => r === flowRampEditTarget ? entry : r)
            : [...existing, entry];
        await flowUpdateBlock(b.id, { ramps });
        flowRampEditTarget = null;
        flowRampResetDraft();
        // Collapse back to the list + "+ Add ramp" button - ramps is never empty at this point (an
        // entry was just inserted/updated into it), so this always lands in the populated state.
        flowRampFormOpen = false;
        renderFlowRampList();
        renderFlowRampAddSection();
        renderFlowRampFormState();
    });
    document.getElementById('flowRampCloseBtn')?.addEventListener('click', closeFlowRampModal);

    // --- Per-block options menu (Duplicate/Move up/Move down/Delete) - same shared floating
    // dropdown-menu + measure-then-clamp positioning as openMetroBlkTileMenu/openQpBarMenu. ---
    function openFlowBlockMenu(btnEl, blockId) {
        flowBlockMenuTargetId = blockId;
        const idx = currentFlowBlocks.findIndex(b => b.id === blockId);
        document.getElementById('flowBlockMenuMoveUp')?.classList.toggle('hidden-group', idx <= 0);
        document.getElementById('flowBlockMenuMoveDown')?.classList.toggle('hidden-group', idx < 0 || idx >= currentFlowBlocks.length - 1);
        // A flow always has to keep at least one block (matches "Create your own" always seeding
        // one) - same "hide, don't just no-op" precedent as Quick Play's own qpBarMenuDelete.
        document.getElementById('flowBlockMenuDelete')?.classList.toggle('hidden-group', currentFlowBlocks.length <= 1);
        const menu = document.getElementById('flowBlockMenu');
        menu.classList.add('show');
        const btnRect = btnEl.getBoundingClientRect();
        const menuWidth = menu.offsetWidth;
        const menuHeight = menu.offsetHeight;
        let left = btnRect.right - menuWidth;
        left = Math.max(8, Math.min(left, window.innerWidth - menuWidth - 8));
        let top = btnRect.bottom + 4;
        top = Math.min(top, window.innerHeight - menuHeight - 8);
        menu.style.left = `${left}px`;
        menu.style.top = `${top}px`;
    }
    function closeFlowBlockMenu() {
        document.getElementById('flowBlockMenu')?.classList.remove('show');
    }
    document.addEventListener('click', closeFlowBlockMenu);

    document.getElementById('flowBlockMenuDuplicate')?.addEventListener('click', async (e) => {
        e.stopPropagation();
        const blockId = flowBlockMenuTargetId;
        closeFlowBlockMenu();
        const idx = currentFlowBlocks.findIndex(b => b.id === blockId);
        if (idx < 0) return;
        if (flowEditMode === 'edit') {
            const source = currentFlowBlocks[idx];
            const dup = { ...source, id: `tmp${++flowTempBlockCounter}`, fermatas: [...(source.fermatas || [])], rehearsalMarks: [...(source.rehearsalMarks || [])] };
            currentFlowBlocks.splice(idx + 1, 0, dup);
            renderFlowBlocksStudio();
            return;
        }
        try {
            const dup = await API.flows.blocks.duplicate(blockId);
            currentFlowBlocks.splice(idx + 1, 0, dup);
            renderFlowBlocksStudio(); // not just renderFlowBlocksList - the total bars/runtime summary needs refreshing too
        } catch (error) {
            showWarningToast('Error duplicating bar: ' + error.message);
        }
    });

    async function flowPersistBlockOrder() {
        // Edit mode: the local splice already happened at each call site - saveFlowEdit does one
        // reorder call with the final order when Save is pressed.
        if (flowEditMode === 'edit') return;
        try {
            await API.flows.blocks.reorder(currentFlowId, currentFlowBlocks.map(b => b.id));
        } catch (error) {
            showWarningToast('Error saving order: ' + error.message);
        }
    }

    document.getElementById('flowBlockMenuMoveUp')?.addEventListener('click', (e) => {
        e.stopPropagation();
        const blockId = flowBlockMenuTargetId;
        closeFlowBlockMenu();
        flowMoveBlockUp(blockId);
    });

    document.getElementById('flowBlockMenuMoveDown')?.addEventListener('click', (e) => {
        e.stopPropagation();
        const blockId = flowBlockMenuTargetId;
        closeFlowBlockMenu();
        flowMoveBlockDown(blockId);
    });

    document.getElementById('flowBlockMenuDelete')?.addEventListener('click', (e) => {
        e.stopPropagation();
        const blockId = flowBlockMenuTargetId;
        closeFlowBlockMenu();
        flowDeleteBlockConfirm(blockId);
    });

    document.getElementById('flowAddBlockBtn')?.addEventListener('click', async () => {
        if (!currentFlowId) return;
        const lastBlock = currentFlowBlocks[currentFlowBlocks.length - 1];
        const data = {
            barCount: lastBlock ? lastBlock.barCount : 4,
            bpm: lastBlock ? lastBlock.bpm : 120,
            timeSignatureId: lastBlock && lastBlock.timeSignatureId ? lastBlock.timeSignatureId : (metroBlkTimeSigCache.public[0] ? metroBlkTimeSigCache.public[0].id : null),
            accountTimeSignatureId: lastBlock ? lastBlock.accountTimeSignatureId : null
        };
        if (flowEditMode === 'edit') {
            currentFlowBlocks.push(buildLocalFlowBlockDto(data));
            renderFlowBlocksStudio();
            return;
        }
        try {
            const newBlock = await API.flows.blocks.create(currentFlowId, data);
            currentFlowBlocks.push(newBlock);
            renderFlowBlocksStudio(); // not just renderFlowBlocksList - the total bars/runtime summary needs refreshing too
        } catch (error) {
            showWarningToast('Error adding bar: ' + error.message);
        }
    });

    // "Use flow" (Blocks tab's own state of the shared sticky bar button) is wired above, next to
    // the rest of the Edit Flow tab logic - currentFlowBlocks/flowLeadInBlock are already current
    // (this is the screen editing them directly), no need for goToFlowPlayView's own refetch.

    // --- Save (Edit mode only) - commits everything staged since loadAndRenderFlowDetailsHub's own
    // snapshot in one batch: Details (one PATCH), Media (diff recordings/documents against the
    // snapshot by id - delete what's gone, add what's new), then Blocks (diff the combined lead-in
    // + blocks list against the snapshot by id - delete/create/update, then one reorder call).
    // Mirrors saveMetroBlkEdit's own diff-and-sync shape. Leaves the draft/Edit mode intact on
    // error so nothing already staged is lost - the user can retry Save or explicitly Cancel. ---
    // curRecordings/curDocuments are passed in rather than read fresh off currentFlowDetail here -
    // by the time this runs, currentFlowDetail has already been reassigned to the Details PATCH's
    // response (saveFlowEdit), which reflects the server's pre-save state and would silently drop
    // whatever was staged locally (bug: a YouTube link added in Edit mode, then Save, never
    // actually reached the server - saveFlowMediaEdits saw an empty list and had nothing to sync).
    async function saveFlowMediaEdits(curRecordings, curDocuments) {
        const snapRecordings = flowEditSnapshot.recordings;
        const snapDocuments = flowEditSnapshot.documents;

        const deletedRecordingIds = snapRecordings.filter(r => !curRecordings.some(cr => cr.id === r.id)).map(r => r.id);
        const deletedDocumentIds = snapDocuments.filter(d => !curDocuments.some(cd => cd.id === d.id)).map(d => d.id);
        await Promise.all([
            ...deletedRecordingIds.map(id => API.flows.recordings.delete(currentFlowId, id)),
            ...deletedDocumentIds.map(id => API.flows.documents.delete(currentFlowId, id))
        ]);

        const newRecordings = curRecordings.filter(r => typeof r.id === 'string');
        const newDocuments = curDocuments.filter(d => typeof d.id === 'string');
        for (const r of newRecordings) {
            if (r.type === 'youtube') await API.flows.recordings.addYouTube(currentFlowId, { url: r.sourceUrl, title: r.title });
            else await API.flows.recordings.addUploaded(currentFlowId, { blobUrl: r.blobUrl, blobPathname: r.blobPathname, fileName: r.fileName, fileSizeBytes: r.fileSizeBytes, mimeType: r.mimeType });
        }
        for (const d of newDocuments) {
            await API.flows.documents.add(currentFlowId, { blobUrl: d.blobUrl, blobPathname: d.blobPathname, fileName: d.fileName, fileSizeBytes: d.fileSizeBytes, mimeType: d.mimeType });
        }
    }

    async function saveFlowBlockEdits() {
        const snapshotAll = flowEditSnapshot.leadIn ? [flowEditSnapshot.leadIn, ...flowEditSnapshot.blocks] : flowEditSnapshot.blocks;
        const currentAll = flowLeadInBlock ? [flowLeadInBlock, ...currentFlowBlocks] : currentFlowBlocks;
        const currentRealIds = new Set(currentAll.filter(b => typeof b.id !== 'string').map(b => b.id));
        const deletedIds = snapshotAll.filter(b => !currentRealIds.has(b.id)).map(b => b.id);
        if (deletedIds.length) await Promise.all(deletedIds.map(id => API.flows.blocks.delete(id)));

        // Sequential, not Promise.all - lead-in first, then in display order, so the reorder call
        // right after has every real id to work with.
        for (const b of currentAll) {
            if (typeof b.id === 'string') {
                const created = await API.flows.blocks.create(currentFlowId, flowBlockPayload(b));
                b.id = created.id;
            }
        }

        // Every surviving/created entry, unconditionally - harmless no-op if a given block actually
        // didn't change, same as saveMetroBlkEdit's own segment update pass.
        await Promise.all(currentAll.map(b => API.flows.blocks.update(b.id, flowBlockPayload(b))));

        if (currentFlowBlocks.length) await API.flows.blocks.reorder(currentFlowId, currentFlowBlocks.map(b => b.id));
    }

    async function saveFlowEdit() {
        if (!currentFlowId || !flowEditSnapshot) return;
        const nameEl = document.getElementById('flowTitleInput');
        if (!nameEl?.value.trim()) {
            showWarningToast('Flow name is required.');
            setFlowEditTab('details');
            nameEl?.focus();
            return;
        }
        const btn = document.getElementById('flowEditSaveBtn');
        if (btn) { btn.disabled = true; btn.innerText = 'Saving...'; }
        // Captured before the Details PATCH below reassigns currentFlowDetail - see
        // saveFlowMediaEdits's own comment on why reading them fresh off currentFlowDetail there
        // would silently miss whatever's staged.
        const stagedRecordings = currentFlowDetail.recordings || [];
        const stagedDocuments = currentFlowDetail.documents || [];
        try {
            currentFlowDetail = await API.flows.update(currentFlowId, {
                title: nameEl.value.trim(),
                composer: document.getElementById('flowComposerInput').value,
                arranger: document.getElementById('flowArrangerInput').value,
                publisher: document.getElementById('flowPublisherInput').value,
                description: document.getElementById('flowDescriptionInput').value
            });
            await saveFlowMediaEdits(stagedRecordings, stagedDocuments);
            await saveFlowBlockEdits();
            // Refreshed once more at the end - the Details PATCH's own response (above) predates
            // the media/block syncing that just happened, so it's stale by now (missing real ids
            // for anything just created). Whatever view goBack() lands on next (e.g. Play Flow's
            // media carousel) reads currentFlowDetail/currentFlowBlocks directly, not a fetch of
            // its own, so this has to be the true final state.
            const [freshDetail, freshBlocks] = await Promise.all([API.flows.get(currentFlowId), API.flows.blocks.list(currentFlowId)]);
            currentFlowDetail = freshDetail;
            flowLeadInBlock = freshBlocks.find(b => b.isLeadIn) || null;
            currentFlowBlocks = freshBlocks.filter(b => !b.isLeadIn);
            flowEditSnapshot = null;
            showSuccessToast('Flow saved');
            goBack();
        } catch (error) {
            showWarningToast('Error saving flow: ' + error.message);
        } finally {
            if (btn) { btn.disabled = false; btn.innerText = 'Save'; }
        }
    }
    document.getElementById('flowEditSaveBtn')?.addEventListener('click', saveFlowEdit);

    // ========================================
    // PLAY FLOW (Jira ML-179 follow-up) - the actual playback screen, requested separately from
    // Blocks Studio (which is edit-only). Reuses the exact same now-playing dot-display/transport
    // mechanism as Quick Play/Metronome Blocks (own player instance, own element ids - same
    // reasoning as those two already having their own rather than sharing one), now including
    // sub-beats/speed%/volume (own state/modals, "ported" from Quick Play's own - see the index.html
    // comment above flowSubdivideModal). Still deliberately simplified vs. the Metronome Blocks engine
    // it's modeled on: no intro-pickup-start-offset handling on the very first jump - flagged as a
    // follow-up if wanted, not silently dropped. Repeats (isRepeatStart/isRepeatEnd/repeatPlayCount)
    // are NOT simplified away, though - see advanceFlow/flowRepeatStartIndexFor below - this screen
    // just has no control to create one, same as it never gets a control to create a lead-in.
    // ========================================
    const flowPlayer = createMetronomePlayer();
    flowPlayerRef = flowPlayer;
    flowPlayer.setVisualLatencyMs(metroState.latencyMs);
    let flowPlayQueue = [];
    let flowPlayIndex = 0;
    let flowLoopBackIndex = 0;
    let flowBeatsPlayedInBlock = 0;
    let flowClicksPlayedInBlock = 0;
    let flowPendingLeadInSilence = 0;
    let flowQuietGapActive = false;
    let flowRepeatCounts = {};

    function flowFirstRegularIndex() {
        const idx = flowPlayQueue.findIndex(s => !s.isLeadIn);
        return idx === -1 ? 0 : idx;
    }

    // Sub-beats mode is a playback-only overlay, same idea as Quick Play's own qpSubBeatsMode/
    // qpSubdivideOverride - one setting applies across the whole sequence, not stored per block. The
    // lead-in never subdivides, same as Metronome Blocks' own metroBlkSubFactorFor.
    let flowSubBeatsMode = 'off';
    let flowSubdivideOverride = null;
    function flowShouldSubdivide(block) {
        const info = metroBlkMeterInfo(block);
        if (!info) return false; // lead-in
        return flowSubBeatsMode !== 'off';
    }
    function flowSubFactorFor(block) {
        if (!block || block.isLeadIn || !flowShouldSubdivide(block)) return 1;
        if (flowSubBeatsMode === 'fixed' && flowSubdivideOverride) return flowSubdivideOverride;
        return metroBlkMeterInfo(block).subdivisionFactor;
    }

    function flowApplyToPlayer(block) {
        flowPlayer.setConductorBpm(block.bpm);
        flowPlayer.setConductorBeatsPerBar(metroBlkBeatsPerBarFor(block));
        flowPlayer.setNotesPerBeat(block.isLeadIn ? 1 : flowSubFactorFor(block));
        flowPlayer.setSubdivisionFactor(1);
        flowPlayer.setLowPitch(!!block.isLeadIn);
    }

    // Mirrors metroBlkRealignPlayer (app.js, Metronome Blocks) minus the intro-pickup-start-offset
    // branch - lead-in quiet-gap and partial-bar pickup handling are both still faithfully copied.
    // The pickup beat index is scaled by the sub-beat factor (clickIndex counts sub-clicks, not
    // conductor beats, once subdivision is more than 1) - same reasoning as metroBlkRealignPlayer's.
    function flowRealignPlayer(block) {
        if (block.pickupBeats) flowPlayer.setBeatIndex((block.numerator - block.pickupBeats) * flowSubFactorFor(block));
        else flowPlayer.resetToBarStart();

        if (block.isLeadIn && block.quietSecondsBeforeLeadIn) {
            flowQuietGapActive = true;
            if (flowPlayer.isPlaying()) flowPlayer.delayNextClick(block.quietSecondsBeforeLeadIn);
            else flowPendingLeadInSilence = block.quietSecondsBeforeLeadIn;
        } else {
            flowQuietGapActive = false;
            flowPendingLeadInSilence = 0;
        }
    }

    function jumpFlowToIndex(index) {
        flowPlayIndex = index;
        flowBeatsPlayedInBlock = 0;
        flowClicksPlayedInBlock = 0;
        if (!flowPlayQueue.length) return;
        const block = metroBlkEffectiveBlock(flowPlayQueue[index], flowPlayQueue);
        flowApplyToPlayer(block);
        flowRealignPlayer(block);
        // ML-130: fermata positions are static per block, so the whole schedule is handed over once
        // here rather than resolved click-by-click.
        flowPlayer.setFermataSchedule(buildFermataSchedule(block, flowSubFactorFor(block)), fermataPlaybackModeSetting());
    }

    function flowStartIndex() {
        return (flowPlayQueue.length && flowPlayQueue[0].isLeadIn) ? 0 : flowFirstRegularIndex();
    }

    function jumpFlowToStart() {
        jumpFlowToIndex(flowStartIndex());
    }

    // currentFlowBlocks/flowLeadInBlock are the same arrays Blocks Studio edits directly - rebuilt
    // fresh every time this view is entered (see the switchView case) rather than cached, so an
    // edit made there is never stale here.
    function buildFlowPlayQueue() {
        flowPlayQueue = flowLeadInBlock ? [flowLeadInBlock, ...currentFlowBlocks] : currentFlowBlocks.slice();
        flowLoopBackIndex = (flowLeadInBlock && flowLeadInBlock.repeatLeadIn) ? 0 : flowFirstRegularIndex();
        flowRepeatCounts = {};
        jumpFlowToStart();
    }

    window.jumpFlowToPlayIndex = function(id) {
        const index = flowPlayQueue.findIndex(s => s.id === id);
        if (index === -1) return;
        jumpFlowToIndex(index);
        renderFlowPlaybackRow();
    };

    function flowRepeatStartIndexFor(endIndex) {
        const firstIdx = flowFirstRegularIndex();
        for (let i = endIndex - 1; i >= firstIdx; i--) {
            if (flowPlayQueue[i].isRepeatStart) return i;
        }
        return firstIdx;
    }

    function advanceFlow() {
        const finishedIndex = flowPlayIndex;
        const finishedBlock = flowPlayQueue[finishedIndex];
        if (finishedBlock && finishedBlock.isRepeatEnd) {
            const timesSoFar = flowRepeatCounts[finishedBlock.id] || 0;
            const totalPlays = finishedBlock.repeatPlayCount || 2;
            if (timesSoFar < totalPlays - 1) {
                flowRepeatCounts[finishedBlock.id] = timesSoFar + 1;
                jumpFlowToIndex(flowRepeatStartIndexFor(finishedIndex));
                setTimeout(renderFlowPlaybackRow, 130);
                return;
            }
            delete flowRepeatCounts[finishedBlock.id];
        }
        let next = finishedIndex + 1;
        if (next >= flowPlayQueue.length) {
            flowRepeatCounts = {};
            next = flowLoopBackIndex;
        }
        jumpFlowToIndex(next);
        // Deferred, same reason as advanceMetroBlk's own comment - lets the final beat's flash
        // actually paint before the dot row is torn down and rebuilt.
        setTimeout(renderFlowPlaybackRow, 130);
    }

    function onFlowBeat(beatInfo) {
        if (flowQuietGapActive) {
            flowQuietGapActive = false;
            renderFlowPlaybackRow();
        }
        const block = metroBlkEffectiveBlock(flowPlayQueue[flowPlayIndex], flowPlayQueue);
        if (!block) return;

        const subFactor = flowSubFactorFor(block);
        flashTierDot('flowPlayRowDots', beatInfo.clickIndexInBar);
        updateFermataDotState('flowPlayRowDots', beatInfo);

        // ML-130: every pulse of a fermata hold except its own first one is a repeat of the SAME
        // beat (the player froze clickIndex for the whole hold - see resolveFermataPulse), not a new
        // beat - it must not count towards "a beat/bar has now played" bookkeeping below, or the
        // block would advance early and "Bar X of Y" would overcount.
        const isFermataRepeat = !!(beatInfo.fermataHold && !beatInfo.fermataHold.isFirst);
        if (isFermataRepeat) return;

        // Advancing has to wait for every click of the target's last beat, sub-beats included, not
        // just that beat's own main click - same reasoning as onMetroBlkBeat's own targetClicks.
        flowClicksPlayedInBlock++;
        const targetBeats = block.pickupBeats || (block.barCount * metroBlkBeatsPerBarFor(block));
        const targetClicks = targetBeats * subFactor;
        const isFinalClickOfBlock = flowClicksPlayedInBlock >= targetClicks;

        if (beatInfo.isConductorBeat) {
            const totalBaseClicks = beatInfo.conductorBeatsPerBar * subFactor;
            const nextIndex = (beatInfo.conductorBeatIndex + 1) % beatInfo.conductorBeatsPerBar;
            const trackUnit = 100 / (totalBaseClicks + 1);
            const trackLeftPct = (k) => k * trackUnit + trackUnit / 2;
            metroScrollFollow('flowPlayRowViewport', 'flowPlayRowContent', trackLeftPct(beatInfo.conductorBeatIndex * subFactor), trackLeftPct(nextIndex * subFactor), beatInfo.secondsPerConductorBeat);

            flowBeatsPlayedInBlock++;
            const justCompletedABar = !block.pickupBeats && flowBeatsPlayedInBlock % metroBlkBeatsPerBarFor(block) === 0;
            if (block.pickupBeats || justCompletedABar) {
                const labelEl = document.getElementById('flowPlayRowLabel');
                if (labelEl) labelEl.innerHTML = metroBlkBlockLabel(block, flowBeatsPlayedInBlock); // ML-130: label carries a real fermata glyph now, not plain text
            }
            // ML-130: a new bar just started (or this is a partial lead-in, which has no "bars" of its
            // own to speak of) - refresh which fermata glyph(s), if any, sit above this bar's own dots.
            if (justCompletedABar && !block.pickupBeats) {
                const newBarIndex = Math.floor(flowBeatsPlayedInBlock / metroBlkBeatsPerBarFor(block));
                renderFermataMarkers('flowPlayRowDots', block, newBarIndex, subFactor);
            }
        }

        if (isFinalClickOfBlock) advanceFlow();
    }
    flowPlayer.onBeat(onFlowBeat);

    // ========================================
    // ML-166: swipeable media carousel (Metronome + one slide per attached audio track/video
    // link). Slide 0 is always the metronome (the view's own always-present markup, index.html) -
    // audio/video slides are built fresh from currentFlowDetail.recordings every time Play Flow
    // loads (buildFlowMediaSlides, called from switchView's flowPlayView case, same "don't trust
    // it's stale" reasoning as buildFlowPlayQueue). Dots + swipe chrome only ever render when
    // there's more than the one metronome slide (renderFlowMediaDots) - a media-less flow looks
    // exactly like it always has.
    // ========================================
    let flowMediaSlides = [{ type: 'metronome' }];
    let flowMediaActiveIndex = 0;
    let flowYtPlayers = {}; // recording id -> YT.Player, video slides only
    let flowYtApiPromise = null;

    // Same path data as the Home screen's own "Metronome" tool icon (public/icons/quick-play.svg) -
    // used instead of a generic Material Symbol wherever this carousel represents the metronome
    // slide (the dots row, and the decorative wrap-around preview below).
    const FLOW_METRONOME_ICON_SVG = '<svg viewBox="0 0 883 1025" preserveAspectRatio="xMidYMid meet" aria-hidden="true" fill="currentColor"><g transform="translate(-2956 -1363)"><path d="M3299.02 1831.86 3528.57 1965.12 3299.02 2098.38ZM3329.89 1454.01 3064.12 2264.42 3731.24 2264.42 3465.47 1454.01ZM3297.05 1363 3499.94 1363C3518.77 1363 3534.93 1374.46 3541.83 1390.79L3544.05 1401.79 3839 2301.17 3837.74 2301.58 3839 2309.93C3839 2328.77 3827.55 2344.95 3811.23 2351.86L3795.05 2355.12 3795.05 2355.43 3793.53 2355.43 3793.53 2355.43 3793.53 2355.43 3702.53 2355.43 3701.57 2360.21C3694.67 2376.54 3678.51 2388 3659.68 2388 3640.84 2388 3624.68 2376.54 3617.78 2360.21L3616.82 2355.43 3186.33 2355.43 3185.37 2360.21C3178.47 2376.54 3162.31 2388 3143.47 2388 3124.64 2388 3108.48 2376.54 3101.58 2360.21L3100.62 2355.43 3008.1 2355.43 3008.1 2354.09 3001.47 2355.43C2976.36 2355.43 2956 2335.06 2956 2309.93L2957.68 2301.6 2956.37 2301.17 3254.77 1391.26 3255.04 1391.35 3255.16 1390.79C3262.06 1374.46 3278.22 1363 3297.05 1363Z" fill-rule="evenodd"/></g></svg>';

    function buildFlowMediaSlides() {
        Object.values(flowYtPlayers).forEach(player => { try { player.destroy(); } catch (error) { /* already gone */ } });
        flowYtPlayers = {};
        const recordings = currentFlowDetail?.recordings || [];
        const audioTracks = recordings.filter(r => r.type !== 'youtube');
        const videoLinks = recordings.filter(r => r.type === 'youtube');
        flowMediaSlides = [
            { type: 'metronome' },
            ...audioTracks.map(r => ({ type: 'audio', data: r })),
            ...videoLinks.map(r => ({ type: 'video', data: r }))
        ];
        flowMediaActiveIndex = 0;
    }

    function flowMediaSlideKey(slide) {
        return slide.type === 'metronome' ? 'metronome' : `${slide.type}-${slide.data.id}`;
    }

    // Loads the YouTube IFrame API script exactly once, only when a flow actually has a video
    // attached - most flows don't, no reason to pull in third-party JS for them. Chains onto
    // whatever onYouTubeIframeAPIReady already exists (there isn't one elsewhere in this app
    // today, but this is the polite way to add a global callback regardless).
    function ensureFlowYtApi() {
        if (flowYtApiPromise) return flowYtApiPromise;
        flowYtApiPromise = new Promise((resolve) => {
            if (window.YT && window.YT.Player) { resolve(window.YT); return; }
            const prevCallback = window.onYouTubeIframeAPIReady;
            window.onYouTubeIframeAPIReady = () => {
                if (typeof prevCallback === 'function') prevCallback();
                resolve(window.YT);
            };
            if (!document.getElementById('youtubeIframeApiScript')) {
                const script = document.createElement('script');
                script.id = 'youtubeIframeApiScript';
                script.src = 'https://www.youtube.com/iframe_api';
                document.head.appendChild(script);
            }
        });
        return flowYtApiPromise;
    }

    function flowMediaSlideHtml(slide) {
        if (slide.type === 'audio') {
            const r = slide.data;
            return `
                <div class="flow-media-slide" data-slide-key="${flowMediaSlideKey(slide)}">
                    <div class="metroBlk-row">
                        <div class="flow-media-slide-header">
                            <span class="flow-media-icon type-audio"><span class="material-symbols-outlined" style="font-size:18px;">music_note</span></span>
                            <div><strong>${escapeHtml(r.title)}</strong><span>${escapeHtml(r.mimeType || 'Audio file')}</span></div>
                        </div>
                        <audio class="flow-media-player-audio" controls preload="metadata" src="${escapeHtml(r.blobUrl)}" data-flow-media-key="${flowMediaSlideKey(slide)}"></audio>
                    </div>
                </div>
            `;
        }
        if (slide.type === 'video') {
            const r = slide.data;
            const origin = encodeURIComponent(location.origin);
            return `
                <div class="flow-media-slide" data-slide-key="${flowMediaSlideKey(slide)}">
                    <div class="metroBlk-row">
                        <div class="flow-media-slide-header">
                            <span class="flow-media-icon type-youtube"><span class="material-symbols-outlined" style="font-size:18px;">smart_display</span></span>
                            <div><strong>${escapeHtml(r.title)}</strong><span>YouTube video</span></div>
                        </div>
                        <div class="flow-media-player-video"><iframe id="flowYtFrame-${r.id}" src="https://www.youtube-nocookie.com/embed/${encodeURIComponent(r.youtubeVideoId)}?enablejsapi=1&amp;origin=${origin}" title="${escapeHtml(r.title)}" allow="accelerometer; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe></div>
                    </div>
                </div>
            `;
        }
        return '';
    }

    // Non-interactive stand-in for a slide (header only - icon/title/subtitle, no player) used to
    // pad either end of the track so wrap-around swiping has something to animate into. Deliberately
    // not a clone of the real slide's DOM: the real metronome slide's transport controls and a real
    // video slide's YT iframe both rely on singular ids (flowPlayBtn, flowYtFrame-<id>, ...) that a
    // true clone would duplicate. These previews are only ever on screen for the tail end of a single
    // swipe gesture before goToFlowMediaSlide snaps the track back onto the real slide in its place.
    function flowMediaSlidePreviewHtml(slide) {
        let iconHtml, title, subtitle;
        if (slide.type === 'metronome') {
            iconHtml = `<span class="flow-media-icon type-metronome">${FLOW_METRONOME_ICON_SVG}</span>`;
            title = 'Metronome';
            subtitle = '';
        } else {
            const r = slide.data;
            iconHtml = slide.type === 'audio'
                ? '<span class="flow-media-icon type-audio"><span class="material-symbols-outlined" style="font-size:18px;">music_note</span></span>'
                : '<span class="flow-media-icon type-youtube"><span class="material-symbols-outlined" style="font-size:18px;">smart_display</span></span>';
            title = r.title;
            subtitle = slide.type === 'audio' ? (r.mimeType || 'Audio file') : 'YouTube video';
        }
        return `
            <div class="flow-media-slide flow-media-slide-preview" data-clone="true" aria-hidden="true">
                <div class="metroBlk-row">
                    <div class="flow-media-slide-header">
                        ${iconHtml}
                        <div><strong>${escapeHtml(title)}</strong>${subtitle ? `<span>${escapeHtml(subtitle)}</span>` : ''}</div>
                    </div>
                </div>
            </div>
        `;
    }

    // "Exclusive Playback" (ticket's own term) - called whenever any one source starts, whether
    // that's the metronome's own Play button, an <audio> element's native play event, or a
    // YT.Player moving into the PLAYING state. sourceKey is 'metronome', or flowMediaSlideKey's
    // own 'audio-<id>'/'video-<id>' shape for whichever one just started.
    function stopAllFlowMediaExcept(sourceKey) {
        if (sourceKey !== 'metronome' && flowPlayer.isPlaying()) pauseFlow();
        document.querySelectorAll('#flowMediaTrack audio[data-flow-media-key]').forEach(el => {
            if (el.dataset.flowMediaKey !== sourceKey && !el.paused) el.pause();
        });
        Object.entries(flowYtPlayers).forEach(([id, player]) => {
            if (`video-${id}` === sourceKey || !player || typeof player.pauseVideo !== 'function') return;
            try {
                if (player.getPlayerState && player.getPlayerState() === window.YT.PlayerState.PLAYING) player.pauseVideo();
            } catch (error) { /* not ready yet - nothing playing to stop */ }
        });
    }

    // Pauses whatever's active on one specific slide - used both when swiping/tapping away from it
    // (the ticket's "swiping away... pause or mute the outgoing media") and when leaving Play Flow
    // entirely (see switchView's own flowPlayView leave-check, pauseAllFlowMedia below).
    function pauseFlowMediaSlide(slide) {
        if (!slide) return;
        if (slide.type === 'metronome') {
            if (flowPlayer.isPlaying()) pauseFlow();
        } else if (slide.type === 'audio') {
            const el = document.querySelector(`audio[data-flow-media-key="${flowMediaSlideKey(slide)}"]`);
            if (el && !el.paused) el.pause();
        } else if (slide.type === 'video') {
            const player = flowYtPlayers[slide.data.id];
            if (player && typeof player.pauseVideo === 'function') {
                try { player.pauseVideo(); } catch (error) { /* not ready yet */ }
            }
        }
    }
    function pauseAllFlowMedia() {
        flowMediaSlides.forEach(pauseFlowMediaSlide);
    }

    // When there's more than one slide, renderFlowMediaCarousel pads the track with one preview
    // slide on each end (a clone of the last slide up front, a clone of the first slide at the
    // back - see flowMediaSlidePreviewHtml) so wrap-around swiping has something to animate into.
    // That shifts every real slide's track position (data-track-slot) one place to the right - this
    // is the shift amount, 0 when there's only the metronome slide and no padding was added.
    function flowMediaTrackOffset() {
        return flowMediaSlides.length > 1 ? 1 : 0;
    }

    // Pixels, not a percentage transform - .flow-media-slide's flex:0 0 100% makes the track's own
    // rendered width N-times the viewport's (that's what makes it overflow rather than shrink to
    // fit), so translateX(-slot*100%) would resolve against that N-times width, not the viewport -
    // wrong distance for anything past the first slide. `slot` defaults to the active slide's own
    // track position, but a wrap transition passes the padding slide's position explicitly.
    function applyFlowMediaTrackPosition(slot) {
        const viewport = document.getElementById('flowMediaViewport');
        const track = document.getElementById('flowMediaTrack');
        if (!viewport || !track) return;
        if (slot === undefined) slot = flowMediaActiveIndex + flowMediaTrackOffset();
        const width = viewport.getBoundingClientRect().width;
        track.style.transform = `translateX(-${slot * width}px)`;
    }

    function updateFlowMediaViewportHeight() {
        const viewport = document.getElementById('flowMediaViewport');
        const track = document.getElementById('flowMediaTrack');
        if (!viewport || !track) return;
        const activeEl = track.children[flowMediaActiveIndex + flowMediaTrackOffset()];
        if (activeEl) viewport.style.height = `${activeEl.scrollHeight}px`;
    }

    function renderFlowMediaDots() {
        const dotsEl = document.getElementById('flowMediaDots');
        if (!dotsEl) return;
        if (flowMediaSlides.length <= 1) {
            dotsEl.classList.add('hidden-group');
            dotsEl.innerHTML = '';
            return;
        }
        dotsEl.classList.remove('hidden-group');
        dotsEl.innerHTML = flowMediaSlides.map((slide, i) => {
            const iconHtml = slide.type === 'metronome' ? FLOW_METRONOME_ICON_SVG : `<span class="material-symbols-outlined">${slide.type === 'audio' ? 'music_note' : 'smart_display'}</span>`;
            const label = slide.type === 'metronome' ? 'Metronome' : `${slide.type === 'audio' ? 'Audio' : 'Video'} - ${slide.data.title}`;
            return `<button type="button" class="flow-media-dot${i === flowMediaActiveIndex ? ' active' : ''}" data-slide-index="${i}" aria-label="${escapeHtml(label)}">${iconHtml}</button>`;
        }).join('');
        dotsEl.querySelectorAll('[data-slide-index]').forEach(btn => {
            btn.addEventListener('click', () => goToFlowMediaSlide(Number(btn.dataset.slideIndex)));
        });
    }

    // Index sync (ticket's own term) - the active carousel slide and its indicator dot always
    // move together, whichever one triggered the change (dot tap, swipe, or a no-op call that just
    // needs to snap the track back to where it already was). Wraps round at either end, so
    // continuing to swipe past the last slide lands back on the first (and vice versa) - `rawIndex`
    // arriving as exactly -1 or exactly flowMediaSlides.length (one step past either end, only ever
    // sent by the swipe handler below) is what triggers the wrap-through-the-padding-slide
    // animation rather than a plain cut to the target slide.
    function goToFlowMediaSlide(rawIndex) {
        const count = flowMediaSlides.length;
        const targetIndex = ((rawIndex % count) + count) % count;
        const offset = flowMediaTrackOffset();
        const isForwardWrap = offset && rawIndex === count;
        const isBackwardWrap = offset && rawIndex === -1;
        if (targetIndex === flowMediaActiveIndex && !isForwardWrap && !isBackwardWrap) {
            applyFlowMediaTrackPosition();
            return;
        }
        pauseFlowMediaSlide(flowMediaSlides[flowMediaActiveIndex]);
        const track = document.getElementById('flowMediaTrack');
        flowMediaActiveIndex = targetIndex;
        const realSlot = flowMediaActiveIndex + offset;
        if ((isForwardWrap || isBackwardWrap) && track) {
            // Animate on into the padding slide at the far end (the "coming in" slide the user
            // just swiped toward), then hop back onto the real slide sitting in its place with the
            // transition switched off for that one frame - to the eye it's one continuous slide.
            applyFlowMediaTrackPosition(isForwardWrap ? count + offset : 0);
            track.addEventListener('transitionend', function onFlowMediaWrapEnd(e) {
                if (e.propertyName && e.propertyName !== 'transform') return;
                track.removeEventListener('transitionend', onFlowMediaWrapEnd);
                track.style.transition = 'none';
                applyFlowMediaTrackPosition(realSlot);
                void track.offsetWidth; // force reflow so the transition below doesn't apply to this jump
                track.style.transition = '';
            }, { once: true });
        } else {
            applyFlowMediaTrackPosition();
        }
        updateFlowMediaViewportHeight();
        document.querySelectorAll('#flowMediaDots .flow-media-dot').forEach((btn, i) => {
            btn.classList.toggle('active', i === flowMediaActiveIndex);
        });
    }

    // Horizontal swipe on the carousel viewport - same lock/abandon technique as Quick Play's own
    // swipe-to-delete (wireQpBarSwipe): nothing transforms until the gesture actually commits to
    // "this is a horizontal swipe" (enough X travel while Y travel stays small), a clearly-vertical
    // drag before that point is left alone entirely so touch-action:pan-y can still scroll the page.
    const FLOW_MEDIA_SWIPE_LOCK_X_PX = 10;
    const FLOW_MEDIA_SWIPE_LOCK_Y_MAX_PX = 15;
    const FLOW_MEDIA_SWIPE_COMMIT_RATIO = 0.2;
    function wireFlowMediaSwipe() {
        const viewport = document.getElementById('flowMediaViewport');
        const track = document.getElementById('flowMediaTrack');
        if (!viewport || !track) return;
        let startX = 0, startY = 0, tracking = false, locked = false, abandoned = false, baseOffsetPx = 0;

        function onMove(e) {
            if (!tracking || abandoned) return;
            const dx = e.clientX - startX;
            const dy = e.clientY - startY;
            if (!locked) {
                if (Math.abs(dx) > FLOW_MEDIA_SWIPE_LOCK_X_PX && Math.abs(dy) < FLOW_MEDIA_SWIPE_LOCK_Y_MAX_PX) {
                    locked = true;
                    track.style.transition = 'none';
                } else if (Math.abs(dy) >= FLOW_MEDIA_SWIPE_LOCK_Y_MAX_PX) {
                    abandoned = true;
                    return;
                } else {
                    return;
                }
            }
            e.preventDefault();
            const width = viewport.getBoundingClientRect().width;
            // Bounds include the padding slides at each end (flowMediaTrackOffset) so the drag can
            // continue past the last/first real slide onto whichever preview is coming in next.
            const slotOffset = flowMediaTrackOffset();
            const rightmostSlot = flowMediaSlides.length - 1 + 2 * slotOffset;
            const min = -rightmostSlot * width;
            const posPx = Math.min(0, Math.max(min, baseOffsetPx + dx));
            track.style.transform = `translateX(${posPx}px)`;
        }
        function onUp(e) {
            if (!tracking) return;
            tracking = false;
            document.removeEventListener('pointermove', onMove);
            document.removeEventListener('pointerup', onUp);
            track.style.transition = '';
            if (!locked) return;
            const dx = e.clientX - startX;
            const width = viewport.getBoundingClientRect().width;
            if (Math.abs(dx) > width * FLOW_MEDIA_SWIPE_COMMIT_RATIO) {
                goToFlowMediaSlide(flowMediaActiveIndex + (dx < 0 ? 1 : -1));
            } else {
                goToFlowMediaSlide(flowMediaActiveIndex);
            }
        }
        viewport.addEventListener('pointerdown', (e) => {
            if (e.target.closest('audio, iframe, button, input')) return;
            startX = e.clientX;
            startY = e.clientY;
            baseOffsetPx = -(flowMediaActiveIndex + flowMediaTrackOffset()) * viewport.getBoundingClientRect().width;
            tracking = true;
            locked = false;
            abandoned = false;
            document.addEventListener('pointermove', onMove);
            document.addEventListener('pointerup', onUp);
        });
    }
    let flowMediaSwipeWired = false;

    // Renders the carousel for the flow that's just loaded (buildFlowMediaSlides already ran) -
    // appends fresh audio/video slide markup after the always-present metronome slide, pads either
    // end with a wrap-around preview slide (see flowMediaSlidePreviewHtml), wires the YT players
    // for any video slides, and (re)measures the active slide's height.
    function renderFlowMediaCarousel() {
        const track = document.getElementById('flowMediaTrack');
        if (!track) return;
        // The metronome slide is the view's own static markup, kept by data-slide-type rather than
        // by position - a previous render may have left a wrap-around preview clone in front of it
        // (also data-slide-type="metronome", so excluded here by its own data-clone marker).
        const metronomeEl = track.querySelector('.flow-media-slide[data-slide-type="metronome"]:not([data-clone])');
        Array.from(track.children).forEach(child => { if (child !== metronomeEl) track.removeChild(child); });
        flowMediaSlides.slice(1).forEach(slide => {
            track.insertAdjacentHTML('beforeend', flowMediaSlideHtml(slide));
        });
        if (flowMediaSlides.length > 1) {
            track.insertAdjacentHTML('afterbegin', flowMediaSlidePreviewHtml(flowMediaSlides[flowMediaSlides.length - 1]));
            track.insertAdjacentHTML('beforeend', flowMediaSlidePreviewHtml(flowMediaSlides[0]));
        }

        track.querySelectorAll('audio[data-flow-media-key]').forEach(el => {
            el.addEventListener('play', () => stopAllFlowMediaExcept(el.dataset.flowMediaKey));
        });

        const videoSlides = flowMediaSlides.filter(s => s.type === 'video');
        if (videoSlides.length) {
            ensureFlowYtApi().then((YT) => {
                videoSlides.forEach(slide => {
                    const id = slide.data.id;
                    const frameEl = document.getElementById(`flowYtFrame-${id}`);
                    if (!frameEl || flowYtPlayers[id]) return;
                    flowYtPlayers[id] = new YT.Player(frameEl, {
                        events: {
                            onStateChange: (e) => {
                                if (e.data === YT.PlayerState.PLAYING) stopAllFlowMediaExcept(`video-${id}`);
                            }
                        }
                    });
                });
            });
        }

        applyFlowMediaTrackPosition();
        renderFlowMediaDots();
        updateFlowMediaViewportHeight();

        if (!flowMediaSwipeWired) {
            wireFlowMediaSwipe();
            flowMediaSwipeWired = true;
        }
    }

    function renderFlowPlaybackTiles() {
        const leadInSlot = document.getElementById('flowPlayLeadInSlot');
        const tilesUi = document.getElementById('flowPlayTiles');
        const currentId = flowPlayQueue[flowPlayIndex] ? flowPlayQueue[flowPlayIndex].id : null;
        if (leadInSlot) {
            if (flowLeadInBlock) {
                const b = flowLeadInBlock;
                const countStr = `${b.barCount} bar${b.barCount === 1 ? '' : 's'}`;
                const repeatStr = b.repeatLeadIn ? ', repeating' : ', first time only';
                leadInSlot.innerHTML = `<div class="metroBlk-leadin-row metroBlk-leadin-row-filled${b.id === currentId ? ' metroBlk-tile-active' : ''}" onclick="jumpFlowToPlayIndex(${b.id})">
                    <span class="metroBlk-tile-badge">Lead-in</span><span>${countStr}${repeatStr}</span>
                </div>`;
            } else {
                leadInSlot.innerHTML = '';
            }
        }
        if (tilesUi) {
            // Time signature/tempo alone didn't identify a block at a glance - every block now leads
            // with whichever of the two actually distinguishes it: its rehearsal mark in a square box,
            // or (when there isn't one) its starting bar number within the flow, plain, no box. bpm and
            // bar count drop down to supporting lines below, smallest last, same as before.
            let startBar = 1;
            tilesUi.innerHTML = currentFlowBlocks.map(s => {
                const headline = s.rehearsalMark
                    ? `<div class="metroBlk-tile-mark-box">${escapeHtml(s.rehearsalMark)}</div>`
                    : `<div class="metroBlk-tile-sig">${startBar}</div>`;
                startBar += s.barCount || 0;
                return `<div class="metroBlk-tile${s.id === currentId ? ' metroBlk-tile-active' : ''}" onclick="jumpFlowToPlayIndex(${s.id})">
                    ${headline}
                    <div class="metroBlk-tile-bpm">${s.bpm} bpm</div>
                    <div class="metroBlk-tile-bars">${s.barCount} bar${s.barCount === 1 ? '' : 's'}</div>
                </div>`;
            }).join('');
        }
    }

    function renderFlowPlaybackRow() {
        if (!flowPlayQueue.length) {
            renderFlowPlaybackTiles();
            return;
        }
        const block = metroBlkEffectiveBlock(flowPlayQueue[flowPlayIndex], flowPlayQueue);
        const subFactor = flowSubFactorFor(block);
        const labelEl = document.getElementById('flowPlayRowLabel');
        if (labelEl) labelEl.innerHTML = block ? metroBlkBlockLabel(block, flowBeatsPlayedInBlock) : ''; // ML-130: label carries a real fermata glyph now, not plain text

        const beatsPerBar = block ? metroBlkBeatsPerBarFor(block) : 4;
        const totalBaseClicks = beatsPerBar * subFactor;
        const trackLeftPct = metroBlkLeftPctFn(totalBaseClicks + 1);
        const endLeftStyle = metroLeftStyle(trackLeftPct(totalBaseClicks));
        buildMetroDotRow('flowPlayRowDots', totalBaseClicks, subFactor, false, trackLeftPct);
        metroApplyDisplayWidth('flowPlayRowViewport', 'flowPlayRowContent', totalBaseClicks + 1);
        connectMetroBlkDotsWithTrack('flowPlayRowDots', endLeftStyle);
        greyOutSkippedDots('flowPlayRowDots', block, subFactor);
        // ML-130: NOT always bar 0 - a sub-beats/play-speed change mid-block re-renders this row from
        // wherever playback currently sits (flowSubdivideSaveBtn/setFlowSpeedPercent), not just on a
        // fresh block entry, so this has to derive the real current bar rather than assume the start.
        renderFermataMarkers('flowPlayRowDots', block, metroBlkCurrentBarIndex(block, flowBeatsPlayedInBlock), subFactor);
        if (!flowPlayer.isPlaying()) resetMetroScrollPosition('flowPlayRowContent');
        const inQuietGap = flowQuietGapActive && flowPlayer.isPlaying() && block && block.isLeadIn;
        document.getElementById('flowPlayRowContent')?.classList.toggle('metroBlk-quiet-gap', inQuietGap);

        renderFlowSubdivideLabel();
        renderFlowPlaybackTiles();
    }

    function updateFlowPlayIcon() {
        const el = document.getElementById('flowPlayIcon');
        if (el) el.innerText = flowPlayer.isPlaying() ? 'pause' : 'play_arrow';
    }

    function playFlow() {
        if (!flowPlayQueue.length) return;
        // ML-166 "Exclusive Playback" - starting the metronome stops any audio/video slide.
        stopAllFlowMediaExcept('metronome');
        flowPlayer.play(flowPendingLeadInSilence);
        flowPendingLeadInSilence = 0;
        updateFlowPlayIcon();
        renderFlowPlaybackRow();
    }
    function pauseFlow() {
        flowPlayer.pause();
        updateFlowPlayIcon();
    }
    function resetFlow() {
        jumpFlowToStart();
        renderFlowPlaybackRow();
    }
    setupPlayButtonHoldReset('flowPlayBtn', () => { if (flowPlayer.isPlaying()) pauseFlow(); else playFlow(); }, resetFlow);
    document.getElementById('flowResetBtn')?.addEventListener('click', resetFlow);

    // --- Sub-beats popup ("ported" from Quick Play's own qpSubdivideModal - own state, own modal,
    // same reasoning as flowPlayer being its own player instance) ---
    const FLOW_SUBDIVIDE_MIN = 2;
    const FLOW_SUBDIVIDE_MAX = 16;
    let flowSubdividePopupValue = FLOW_SUBDIVIDE_MIN;

    function flowSubdivideCurrentBlock() {
        return flowPlayQueue.length ? metroBlkEffectiveBlock(flowPlayQueue[flowPlayIndex], flowPlayQueue) : null;
    }
    function renderFlowSubdivideLabel() {
        const block = flowSubdivideCurrentBlock();
        const lbl = document.getElementById('flowSubdivideLbl');
        if (lbl) lbl.innerText = metroBlkSubdivideDisplayValue(block ? flowSubFactorFor(block) : 1);
        const unitLbl = document.getElementById('flowSubdivideUnitLbl');
        if (unitLbl) unitLbl.innerText = flowSubBeatsMode === 'auto' ? 'auto sub beats' : 'sub beats';
    }
    function renderFlowSubdividePopupSlider() {
        const pct = ((flowSubdividePopupValue - FLOW_SUBDIVIDE_MIN) / (FLOW_SUBDIVIDE_MAX - FLOW_SUBDIVIDE_MIN)) * 100;
        document.getElementById('flowSubdivideSliderFill').style.width = `${pct}%`;
        const thumb = document.getElementById('flowSubdivideSliderThumb');
        thumb.style.left = `${pct}%`;
        thumb.setAttribute('aria-valuenow', flowSubdividePopupValue);
        thumb.setAttribute('aria-valuemax', FLOW_SUBDIVIDE_MAX);
        document.getElementById('flowSubdivideSliderMaxLbl').innerText = FLOW_SUBDIVIDE_MAX;
        document.getElementById('flowSubdividePopupValue').innerText = flowSubdividePopupValue;
    }
    function setFlowSubdividePopupValue(v) {
        flowSubdividePopupValue = Math.min(FLOW_SUBDIVIDE_MAX, Math.max(FLOW_SUBDIVIDE_MIN, Math.round(v)));
        renderFlowSubdividePopupSlider();
    }
    setupHoldStepper(document.getElementById('flowSubdivideMinus'), -1, (amount) => setFlowSubdividePopupValue(flowSubdividePopupValue + amount));
    setupHoldStepper(document.getElementById('flowSubdividePlus'), 1, (amount) => setFlowSubdividePopupValue(flowSubdividePopupValue + amount));
    setupSliderInteraction(document.getElementById('flowSubdivideSliderTrack'), document.getElementById('flowSubdivideSliderThumb'), {
        onDragRatio: (ratio) => setFlowSubdividePopupValue(FLOW_SUBDIVIDE_MIN + ratio * (FLOW_SUBDIVIDE_MAX - FLOW_SUBDIVIDE_MIN)),
        onArrowStep: (dir) => setFlowSubdividePopupValue(flowSubdividePopupValue + dir)
    });
    makeSliderReadoutEditable('flowSubdividePopupValue', () => flowSubdividePopupValue, (v) => setFlowSubdividePopupValue(v), { label: 'Sub beats', min: FLOW_SUBDIVIDE_MIN, max: FLOW_SUBDIVIDE_MAX });

    document.getElementById('flowSubdivideBtn')?.addEventListener('click', () => {
        document.getElementById('flowSubdivideOff').checked = flowSubBeatsMode === 'off';
        document.getElementById('flowSubdivideAuto').checked = flowSubBeatsMode === 'auto';
        document.getElementById('flowSubdivideFixed').checked = flowSubBeatsMode === 'fixed';
        document.getElementById('flowSubdivideBpmBox').classList.toggle('hidden-group', flowSubBeatsMode !== 'fixed');
        setFlowSubdividePopupValue(flowSubdivideOverride || FLOW_SUBDIVIDE_MIN);
        document.getElementById('flowSubdivideModal').style.display = 'flex';
    });
    document.querySelectorAll('input[name="flowSubdivideOnOff"]').forEach(radio => {
        radio.addEventListener('change', () => {
            document.getElementById('flowSubdivideBpmBox').classList.toggle('hidden-group', radio.value !== 'fixed');
        });
    });
    document.getElementById('flowSubdivideCancelBtn')?.addEventListener('click', () => {
        document.getElementById('flowSubdivideModal').style.display = 'none';
    });
    document.getElementById('flowSubdivideSaveBtn')?.addEventListener('click', () => {
        flowSubBeatsMode = document.querySelector('input[name="flowSubdivideOnOff"]:checked')?.value || 'off';
        flowSubdivideOverride = flowSubBeatsMode === 'fixed' ? flowSubdividePopupValue : null;
        document.getElementById('flowSubdivideModal').style.display = 'none';
        const block = flowSubdivideCurrentBlock();
        if (block) flowApplyToPlayer(block);
        renderFlowPlaybackRow();
    });

    // --- Play speed popup ("ported" from Quick Play's own - own state, admin-managed preset list) ---
    let flowSpeedPercent = 100;
    function renderFlowSpeedLabel() {
        document.getElementById('flowSpeedLbl').innerText = `${flowSpeedPercent}%`;
    }
    function setFlowSpeedPercent(p) {
        flowSpeedPercent = Math.min(1000, Math.max(1, p));
        flowPlayer.setSpeedPercent(flowSpeedPercent);
        renderFlowSpeedLabel();
        const block = flowSubdivideCurrentBlock();
        if (block) flowApplyToPlayer(block);
        renderFlowPlaybackRow();
    }
    async function loadFlowPlaybackSpeeds() {
        try {
            const speeds = await API.metronomeBlocks.playbackSpeeds.list();
            const container = document.getElementById('flowSpeedOptions');
            if (container) container.innerHTML = speeds.map(p => `<button type="button" class="metroBlk-timesig-opt" data-value="${p}">${p}%</button>`).join('');
            document.querySelectorAll('#flowSpeedOptions .metroBlk-timesig-opt').forEach(btn => {
                btn.classList.toggle('selected', Number(btn.dataset.value) === flowSpeedPercent);
            });
        } catch (error) {
            showWarningToast('Error loading playback speeds: ' + error.message);
        }
    }
    document.getElementById('flowSpeedBtn')?.addEventListener('click', () => {
        document.querySelectorAll('#flowSpeedOptions .metroBlk-timesig-opt').forEach(btn => {
            btn.classList.toggle('selected', Number(btn.dataset.value) === flowSpeedPercent);
        });
        document.getElementById('flowSpeedModal').style.display = 'flex';
    });
    document.getElementById('flowSpeedOptions')?.addEventListener('click', (e) => {
        const btn = e.target.closest('.metroBlk-timesig-opt');
        if (!btn) return;
        setFlowSpeedPercent(Number(btn.dataset.value));
        document.getElementById('flowSpeedModal').style.display = 'none';
    });
    renderFlowSpeedLabel();

    // --- Volume ("ported" from Quick Play's own - own state, no calibration section, headphone
    // delay is the one shared setting via metroState.latencyMs/flowPlayerRef). Mute is just volume 0,
    // flowVolumeBeforeMute remembers the last non-zero value so unmuting restores it. ---
    let flowVolume = 80;
    let flowVolumeBeforeMute = 80;
    function renderFlowVolumeSlider() {
        const fill = document.getElementById('flowVolumeFill');
        const thumb = document.getElementById('flowVolumeThumb');
        if (!fill || !thumb) return;
        fill.style.width = `${flowVolume}%`;
        thumb.style.left = `${flowVolume}%`;
        thumb.setAttribute('aria-valuenow', flowVolume);
        const valueEl = document.getElementById('flowVolumeValue');
        if (valueEl) valueEl.innerText = `${flowVolume}%`;
        const muted = flowVolume === 0;
        document.getElementById('flowMuteIcon').innerText = muted ? 'volume_off' : 'volume_up';
        document.getElementById('flowMuteBtn')?.setAttribute('aria-pressed', String(muted));
        document.getElementById('flowVolumeRow')?.classList.toggle('is-muted', muted);
    }
    function setFlowVolume(v, force = false) {
        flowVolume = Math.round(Math.min(100, Math.max(0, v)));
        if (flowVolume > 0) flowVolumeBeforeMute = flowVolume;
        flowPlayer.setVolume(flowVolume / 100);
        renderFlowVolumeSlider();
        playVolumeTestClick(flowPlayer, force);
    }
    setupSliderInteraction(document.getElementById('flowVolumeTrack'), document.getElementById('flowVolumeThumb'), {
        onDragRatio: (ratio) => setFlowVolume(ratio * 100),
        onArrowStep: (dir) => setFlowVolume(flowVolume + dir * 5),
        onRelease: () => playVolumeTestClick(flowPlayer, true)
    });
    setupHoldStepper('flowVolumeMinus', -1, (amount) => setFlowVolume(flowVolume + amount, true));
    setupHoldStepper('flowVolumePlus', 1, (amount) => setFlowVolume(flowVolume + amount, true));
    makeSliderReadoutEditable('flowVolumeValue', () => flowVolume, (v) => setFlowVolume(v, true), { label: 'Volume', min: 0, max: 100 });
    document.getElementById('flowMuteBtn')?.addEventListener('click', () => {
        setFlowVolume(flowVolume > 0 ? 0 : (flowVolumeBeforeMute || 80), true);
    });
    document.getElementById('flowVolumeBtn')?.addEventListener('click', () => {
        renderFlowVolumeSlider();
        document.getElementById('flowVolumeModal').style.display = 'flex';
    });
    function closeFlowVolumePopup() {
        document.getElementById('flowVolumeModal').style.display = 'none';
    }
    document.getElementById('flowVolumeCloseBtn')?.addEventListener('click', closeFlowVolumePopup);
    document.getElementById('flowVolumeModal')?.addEventListener('click', (e) => {
        if (e.target === e.currentTarget) closeFlowVolumePopup();
    });
    renderFlowVolumeSlider();

    // --- Play Flow's own 3-dot menu (Edit details / Edit flow) - replaces Quick Play's static
    // "Bars" title's Show history/Create flow links. Bare .dropdown-menu, same "only ever one
    // instance on screen" precedent as elsewhere in the app (e.g. the burger menu). Both items land
    // on the same Edit Flow view (Details/Media/Blocks tabs) now, just on a different starting tab -
    // see flowEditRequestedTab. ---
    function closeFlowPlayMenu() {
        document.getElementById('flowPlayMenu')?.classList.remove('show');
    }
    document.addEventListener('click', closeFlowPlayMenu);
    document.getElementById('flowPlayMenuBtn')?.addEventListener('click', (e) => {
        e.stopPropagation();
        document.getElementById('flowPlayMenu')?.classList.toggle('show');
    });
    document.getElementById('flowPlayMenuEditDetails')?.addEventListener('click', (e) => {
        e.stopPropagation();
        closeFlowPlayMenu();
        if (!currentFlowId) return;
        flowEditRequestedTab = 'details';
        flowEditMode = 'edit';
        switchView('flowDetailsHubView');
    });
    document.getElementById('flowPlayMenuEditFlow')?.addEventListener('click', (e) => {
        e.stopPropagation();
        closeFlowPlayMenu();
        if (!currentFlowId) return;
        flowEditRequestedTab = 'blocks';
        flowEditMode = 'edit';
        switchView('flowDetailsHubView');
    });
    // Lands straight on the library list, not the create/load choice screen.
    document.getElementById('flowPlayMenuLoadLibrary')?.addEventListener('click', (e) => {
        e.stopPropagation();
        closeFlowPlayMenu();
        switchView('metroBuilderView');
        showFlowLibraryList();
    });
    document.getElementById('flowPlayMenuCreateNew')?.addEventListener('click', (e) => {
        e.stopPropagation();
        closeFlowPlayMenu();
        createAndOpenFlow();
    });

    // Play Mode only - Edit Mode swaps this whole area for the inline name input instead (see
    // renderMetroBlkEditUI). An unsaved setup never actually reaches Play Mode any more (it lands
    // straight in Edit Mode instead - see metroBlkEnterAppropriateMode), so this is always a real,
    // already-saved name with a plain pencil next to it - no more save-vs-edit glyph switch.
    function renderMetroBlkSetupHeader() {
        const nameEl = document.getElementById('metroBlkSetupName');
        const nameBtn = document.getElementById('metroBlkRenameBtn');
        const icon = document.getElementById('metroBlkRenameIcon');
        if (!nameEl || !metroBlkCurrentSetup) return;
        nameEl.innerText = metroBlkCurrentSetup.name || 'New timing';
        if (icon) icon.innerText = 'edit';
        nameBtn?.setAttribute('aria-label', 'Rename setup');
    }

    // --- Play Mode / Edit Mode lifecycle (ML-97) ---
    // Toggles every mode-dependent bit of UI in one place: the header (name text vs input, icon
    // visibility), the help text, the bottom edit bar, and the view's own bottom padding (so the
    // fixed bar never overlaps the last tile). renderMetroBlockTiles is a separate call, not
    // folded in here, since entering/leaving edit mode is only one of several reasons tiles
    // re-render.
    function renderMetroBlkEditUI() {
        document.getElementById('metroBlkRenameBtn')?.classList.toggle('hidden-group', metroBlkEditMode);
        const input = document.getElementById('metroBlkSetupNameInput');
        if (input) {
            input.classList.toggle('hidden-group', !metroBlkEditMode);
            input.classList.remove('metroBlk-field-invalid');
            // Unsaved scratch: prefilled with "New timing" - a real, immediately-saveable default -
            // rather than the server's own internal placeholder ("Untitled setup"), which was never a
            // name the user actually chose. Already saved: prefilled with the actual name, ready to
            // edit in place.
            if (metroBlkEditMode) input.value = metroBlkCurrentSetup?.savedAt ? (metroBlkCurrentSetup.name || '') : 'New timing';
        }
        document.getElementById('metroBlockTiles')?.classList.remove('metroBlk-field-invalid');
        const helpText = document.getElementById('metroBlkHelpText');
        if (helpText) helpText.innerText = metroBlkEditMode ? 'Tap a block to edit it, or drag to reorder.' : 'Tap a block to jump to it.';
        document.getElementById('metroBlkEditBar')?.classList.toggle('hidden-group', !metroBlkEditMode);
        document.getElementById('metroBuilderView')?.classList.toggle('metroBlk-editing', metroBlkEditMode);
        // Play/Reset/sub-beats/speed are fully disabled while editing too (follow-up, stricter than
        // the original "Play auto-saves first" behaviour) - one unambiguous way out of Edit Mode
        // (Cancel or Save on the bottom bar) rather than a second path that quietly saves as a side
        // effect of pressing Play. Volume (metroBlkVolumeBtn) is deliberately left enabled - it
        // doesn't touch playback or the draft, so there's no reason to block it.
        ['metroBlkPlayBtn', 'metroBlkResetBtn', 'metroBlkSubdivideBtn', 'metroBlkSpeedBtn'].forEach(id => {
            const btn = document.getElementById(id);
            if (btn) btn.disabled = metroBlkEditMode;
        });
    }

    // Entry point for both an unsaved scratch (nothing to name yet) and an already-saved setup
    // (renaming) - Edit Mode's inline input + bottom Save button handle naming either way now, so
    // there's no separate popup-based "Save this setup"/"Rename setup" flow any more.
    function enterMetroBlkEditMode() {
        if (!metroBlkCurrentSetup) return;
        if (metroBlkPlayer.isPlaying()) pauseMetroBlk();
        metroBlkEditSnapshot = {
            name: metroBlkCurrentSetup.name,
            segments: metroBlkCurrentSetup.segments.map(s => ({ ...s }))
        };
        metroBlkEditMode = true;
        renderMetroBlkEditUI();
        renderMetroBlockTiles();
        document.getElementById('metroBlkSetupNameInput')?.focus();
    }
    document.getElementById('metroBlkRenameBtn')?.addEventListener('click', enterMetroBlkEditMode);

    // Throws away every local change made since enterMetroBlkEditMode and restores the exact
    // pre-edit state - no server calls, since nothing was written while editing (see
    // saveMetroBlkEdit for where writes actually happen).
    function cancelMetroBlkEdit() {
        if (!metroBlkEditSnapshot) { metroBlkEditMode = false; renderMetroBlkEditUI(); return; }
        metroBlkCurrentSetup.name = metroBlkEditSnapshot.name;
        metroBlkCurrentSetup.segments = metroBlkEditSnapshot.segments;
        metroBlkEditSnapshot = null;
        metroBlkEditMode = false;
        renderMetroBlkEditUI();
        renderMetroBlkSetupHeader();
        renderMetroBlockTiles();
    }
    document.getElementById('metroBlkEditCancelBtn')?.addEventListener('click', cancelMetroBlkEdit);

    // Picks exactly the fields the segment API accepts off a local (possibly draft) segment
    // object - shared by the create and update calls saveMetroBlkEdit makes below.
    function metroBlkSegPayload(seg) {
        return {
            isLeadIn: !!seg.isLeadIn,
            bpm: seg.bpm,
            timeSignatureId: seg.timeSignatureId,
            accountTimeSignatureId: seg.accountTimeSignatureId,
            barCount: seg.barCount,
            pickupBeats: seg.pickupBeats,
            repeatLeadIn: !!seg.repeatLeadIn,
            quietSecondsBeforeLeadIn: seg.quietSecondsBeforeLeadIn || 0,
            // Bug fix (ML-35 follow-up): which note value the Target BPM display was last set with -
            // previously not persisted at all, so re-opening a saved block to edit it always reset to
            // a denominator-based default instead of what was actually chosen (see openMetroSegmentModal).
            noteValue: seg.noteValue || null,
            // ML-103: navigation/articulation markup - never set on a lead-in (openMetroSegmentModal's
            // Save handler never populates these fields there), so this just carries over whatever
            // buildLocalSegmentDto left on the object either way.
            isRepeatStart: !!seg.isRepeatStart,
            isRepeatEnd: !!seg.isRepeatEnd,
            repeatPlayCount: seg.repeatPlayCount || null,
            isSectionBoundary: !!seg.isSectionBoundary,
            rehearsalMarks: Array.isArray(seg.rehearsalMarks) ? seg.rehearsalMarks : [],
            isCoda: !!seg.isCoda,
            isSegno: !!seg.isSegno,
            gotoCoda: !!seg.gotoCoda,
            gotoSegno: !!seg.gotoSegno,
            gotoSegnoThenCoda: !!seg.gotoSegnoThenCoda,
            gotoStartDc: !!seg.gotoStartDc,
            isFirstTimeBar: !!seg.isFirstTimeBar,
            isSecondTimeBar: !!seg.isSecondTimeBar,
            introStartBarOffset: seg.introStartBarOffset === undefined ? null : seg.introStartBarOffset,
            introStartBeatOffset: seg.introStartBeatOffset === undefined ? null : seg.introStartBeatOffset,
            introEndBarOffset: seg.introEndBarOffset === undefined ? null : seg.introEndBarOffset,
            introEndBeatOffset: seg.introEndBeatOffset === undefined ? null : seg.introEndBeatOffset,
            rampStartBarOffset: seg.rampStartBarOffset === undefined ? null : seg.rampStartBarOffset,
            rampStartBeatOffset: seg.rampStartBeatOffset === undefined ? null : seg.rampStartBeatOffset,
            rampDurationBars: seg.rampDurationBars === undefined ? null : seg.rampDurationBars,
            fermatas: Array.isArray(seg.fermatas) ? seg.fermatas : []
        };
    }

    // Commits everything staged since enterMetroBlkEditMode in one batch: the name (first save or
    // rename), then segment deletions/creations/reindex-updates diffed against
    // metroBlkEditSnapshot. Leaves Edit Mode active on error so the draft isn't lost - the user can
    // retry Save or explicitly Cancel.
    // Checks every blocking condition at once rather than stopping at the first one - the user
    // gets one toast listing everything wrong and every field highlighted together, not a fresh
    // complaint each time they fix one thing.
    function metroBlkEditValidationProblems() {
        const nameInput = document.getElementById('metroBlkSetupNameInput');
        const name = (nameInput?.value || '').trim();
        const tilesEl = document.getElementById('metroBlockTiles');
        const hasBlock = metroBlkCurrentSetup.segments.some(s => !s.isLeadIn);

        const problems = [];
        if (!name) problems.push('Please enter a name to save this.');
        if (!hasBlock) problems.push('Please add at least one block to save this.');
        nameInput?.classList.toggle('metroBlk-field-invalid', !name);
        tilesEl?.classList.toggle('metroBlk-field-invalid', !hasBlock);
        return { problems, name, hasBlock };
    }
    // Clears a field's invalid highlight the moment the user starts fixing it, rather than making
    // them re-submit before seeing it go away.
    document.getElementById('metroBlkSetupNameInput')?.addEventListener('input', function() {
        if (this.value.trim()) this.classList.remove('metroBlk-field-invalid');
    });

    async function saveMetroBlkEdit() {
        if (!metroBlkCurrentSetup || !metroBlkEditSnapshot) return;
        const nameInput = document.getElementById('metroBlkSetupNameInput');
        const { problems, name } = metroBlkEditValidationProblems();
        if (problems.length) {
            showWarningToast(problems.join('\n'));
            if (!name) nameInput?.focus();
            else document.getElementById('metroBlockTiles')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
            return;
        }
        const wasSaved = !!metroBlkCurrentSetup.savedAt;
        if (metroBlkNameIsTaken(name, wasSaved ? metroBlkCurrentSetup.id : undefined)) {
            nameInput?.classList.add('metroBlk-field-invalid');
            nameInput?.focus();
            return showWarningToast('This name is already taken');
        }

        const btn = document.getElementById('metroBlkEditSaveBtn');
        if (btn) { btn.disabled = true; btn.innerText = 'Saving...'; }
        try {
            if (!wasSaved) {
                await API.metronomeBlocks.setups.save(metroBlkCurrentSetup.id, name);
                metroBlkCurrentSetup.savedAt = new Date().toISOString();
            } else if (name !== metroBlkEditSnapshot.name) {
                await API.metronomeBlocks.setups.rename(metroBlkCurrentSetup.id, name);
            }
            metroBlkCurrentSetup.name = name;

            const snapshotIds = new Set(metroBlkEditSnapshot.segments.map(s => s.id));
            const currentSegs = metroBlkCurrentSetup.segments;
            const currentRealIds = new Set(currentSegs.filter(s => typeof s.id !== 'string').map(s => s.id));
            const deletedIds = [...snapshotIds].filter(id => !currentRealIds.has(id));
            if (deletedIds.length) await Promise.all(deletedIds.map(id => API.metronomeBlocks.segments.delete(id)));

            // Sequential, not Promise.all - creation order has to match display order so the
            // reindex pass right after gives each new segment the right orderIndex.
            for (const seg of currentSegs) {
                if (typeof seg.id === 'string') {
                    const created = await API.metronomeBlocks.segments.create(metroBlkCurrentSetup.id, metroBlkSegPayload(seg));
                    seg.id = created.id;
                }
            }

            await Promise.all(currentSegs.map((seg, idx) =>
                API.metronomeBlocks.segments.update(seg.id, { ...metroBlkSegPayload(seg), orderIndex: idx })
            ));

            metroBlkCurrentSetup.segments = [...currentSegs];
            metroBlkEditSnapshot = null;
            metroBlkEditMode = false;
            renderMetroBlkEditUI();
            renderMetroBlkSetupHeader();
            renderMetroBlockTiles();
            await loadMetroBlkSetups();
            showSuccessToast('Saved');
        } catch (error) {
            showWarningToast('Error: ' + error.message);
        } finally {
            if (btn) { btn.disabled = false; btn.innerText = 'Save'; }
        }
    }
    document.getElementById('metroBlkEditSaveBtn')?.addEventListener('click', saveMetroBlkEdit);
    document.getElementById('metroBlkSetupNameInput')?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); saveMetroBlkEdit(); }
    });

    // ML-103: the old "+ Add new" button (a second, name-prompt-first "new setup" path alongside
    // the implicit scratch-on-visit) is retired - "Create your own" on the entry screen is now the
    // one, single way to start a new setup (metroBlkEntryCreateBtn above). createNamedAdhocSetup
    // stays in the backend/API client unused rather than deleted, in case a genuinely separate
    // "start a second new one without touching my in-progress scratch" need comes up later.

    // "Copy this setup" - a new setup seeded with all of this one's blocks, as a starting point for
    // a variant. Loads straight into the builder afterwards, same as "+ Add new set".
    window.duplicateMetroBlkSetup = function(id) {
        const setup = metroBlkSetups.find(s => s.id === id);
        showPromptModal('Name the copy', setup ? `${setup.name} copy` : '', async (name) => {
            if (!name || !name.trim()) return;
            if (metroBlkNameIsTaken(name.trim())) { showWarningToast('This name is already taken'); return; }
            try {
                const created = await API.metronomeBlocks.setups.duplicate(id, name.trim());
                created.segments = await normalizeMetroBlkOrder(created.segments);
                if (metroBlkPlayer.isPlaying()) metroBlkPlayer.pause();
                metroBlkEditMode = false; // see the matching comment in openMetroBlkSetup
                metroBlkEditSnapshot = null;
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
            }
            // Loading a different setup while mid-edit on another one would otherwise leave
            // metroBlkEditMode stuck true with a snapshot pointing at the setup just replaced -
            // switchView's own leaving-the-view auto-cancel (ML-97) doesn't fire here since we're
            // staying on metroBuilderView, just swapping which setup it shows.
            metroBlkEditMode = false;
            metroBlkEditSnapshot = null;
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

    // --- Build panel: block tiles ---
    // `beatsPlayedInBlock` (metroBlkBeatsPlayedInBlock) is only meaningful for whichever block is
    // actually current - pass it for that one row only, so a repeating block shows "x of y bars"
    // (or "x of y beats" for a partial lead-in) as it plays; omit it for upcoming-row previews,
    // which just show the plain total since they haven't started.
    // ML-172: bar identification leads now (which block/lead-in this is matters more at a glance than
    // the time signature/tempo that follow it), then time signature, then bpm - same reorder as
    // qpBlockLabel's own.
    // ML-130: the fermata glyph (+ ×N once there's more than one) appended to the "now playing"
    // label - counted across the WHOLE block, not just whichever bar is currently playing, since the
    // fermatas themselves are block-scoped data (two different bars of the same block can each carry
    // one, and that's still just "this block has 2"). Caesura is a separate follow-up, not counted
    // here yet. Returns '' (not undefined) when the block has none, so callers can always just
    // concatenate it straight onto the rest of the label.
    function metroBlkFermataLabelSuffix(block) {
        const count = (block.fermatas || []).filter(f => f.kind !== 'caesura').length;
        if (!count) return '';
        return ` · ${flowPauseIconSvg('fermata', true)}${count > 1 ? `×${count}` : ''}`;
    }
    // Returns HTML (the fermata suffix embeds a real glyph span, not plain text) - every caller must
    // assign this via innerHTML, not innerText.
    function metroBlkBlockLabel(block, beatsPlayedInBlock) {
        const prefix = block.isLeadIn ? 'Lead-in · ' : '';
        const fermataSuffix = metroBlkFermataLabelSuffix(block);
        // A lead-in only ever plays once, so an "x of y beats" progress count is meaningless - only
        // a repeating block's bar count needs that. (Already identification-first as-is here - a
        // partial-bar lead-in has no count to reorder around.)
        if (block.pickupBeats) {
            return `${prefix}${block.timeSignatureLabel} · ${block.bpm} bpm${fermataSuffix}`;
        }
        const total = block.barCount;
        const countStr = beatsPlayedInBlock === undefined
            ? `${total} bar${total === 1 ? '' : 's'}`
            : `${Math.min(total, Math.floor(beatsPlayedInBlock / metroBlkBeatsPerBarFor(block)) + 1)} of ${total} bar${total === 1 ? '' : 's'}`;
        return `${prefix}${countStr} · ${block.timeSignatureLabel} · ${block.bpm} bpm${fermataSuffix}`;
    }

    // Segment ids are either a real number (persisted) or a temp string like "tmp3" (staged, not
    // yet created on the server - see metroBlkTempSegCounter) - this renders either as a literal
    // safe to splice into an inline onclick="" attribute (single-quoted for strings, since temp
    // ids never contain a quote themselves).
    function metroBlkIdArg(id) {
        return typeof id === 'string' ? `'${id}'` : id;
    }

    // Play Mode (default): tapping a tile jumps playback to it (jumpMetroBlkToPlayIndex),
    // nothing is draggable, no per-tile menu. Edit Mode: tapping opens the segment editor as
    // before, tiles are draggable, and a 3-dot menu offers Copy to end / Copy here / Delete
    // (ML-97, ML-100). data-id is always present either way - Play Mode's active-block highlight
    // (renderMetroBlkActiveTileHighlight) depends on it too.
    function metroBlkTileHtml(s) {
        const countStr = s.pickupBeats
            ? `${s.pickupBeats} beat${s.pickupBeats === 1 ? '' : 's'}`
            : `${s.barCount} bar${s.barCount === 1 ? '' : 's'}`;
        const idArg = metroBlkIdArg(s.id);
        const onclick = metroBlkEditMode ? `openMetroSegmentModal(${idArg})` : `jumpMetroBlkToPlayIndex(${idArg})`;
        const menuBtn = metroBlkEditMode
            ? `<button type="button" class="metroBlk-tile-menu-btn" aria-label="Block options" onclick="event.stopPropagation(); openMetroBlkTileMenu(event, ${idArg})"><span class="material-symbols-outlined">more_vert</span></button>`
            : '';
        return `<div class="metroBlk-tile${s.isLeadIn ? ' lead-in' : ''}" draggable="${metroBlkEditMode}" data-id="${escapeHtml(String(s.id))}" onclick="${onclick}">
            ${menuBtn}
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
    // into the reorderable grid below - see the ML-35 follow-up note there for why. Neither the time
    // signature nor the tempo is shown here (ML-91 follow-up) - both are just inherited from the
    // first regular block (metroBlkEffectiveBlock) and aren't independently editable on the lead-in,
    // so repeating them was pure redundancy; the bar/beat count, quiet-gap and repeat settings that
    // ARE specific to the lead-in take that space instead. The repeat icon (looked like an independent
    // clickable control rather than a description of the whole row) is now plain text, always present,
    // so "plays once" is stated as clearly as "repeats" rather than being the unlabelled default.
    // Edit Mode only for the empty "+ Lead-in" add-state (Play Mode has nothing to add) - a filled
    // lead-in still shows in both, just gated the same way a regular tile is: tap opens the editor
    // while editing, jumps playback to it otherwise (ML-97).
    function metroBlkLeadInSlotHtml(leadIn) {
        if (!leadIn) {
            if (!metroBlkEditMode) return '';
            return `<button type="button" class="metroBlk-leadin-row metroBlk-leadin-row-add" aria-label="Add lead-in" onclick="openMetroLeadInModal()">
                <span class="metroBlk-leadin-plus">+</span><span>Lead-in</span>
            </button>`;
        }
        const countStr = leadIn.pickupBeats
            ? `${leadIn.pickupBeats} beat${leadIn.pickupBeats === 1 ? '' : 's'}`
            : `${leadIn.barCount} bar${leadIn.barCount === 1 ? '' : 's'}`;
        const quietSecs = leadIn.quietSecondsBeforeLeadIn || 0;
        const afterStr = quietSecs > 0 ? `, after ${quietSecs} second${quietSecs === 1 ? '' : 's'}` : '';
        const repeatStr = leadIn.repeatLeadIn ? ', repeating' : ', first time only';
        const idArg = metroBlkIdArg(leadIn.id);
        const onclick = metroBlkEditMode ? `openMetroLeadInModal(${idArg})` : `jumpMetroBlkToPlayIndex(${idArg})`;
        return `<div class="metroBlk-leadin-row metroBlk-leadin-row-filled" data-id="${escapeHtml(String(leadIn.id))}" onclick="${onclick}">
            <span class="metroBlk-tile-badge">Lead-in</span>
            <span>${countStr}${afterStr}${repeatStr}</span>
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
        // The "+" add-block tile only makes sense in Edit Mode (ML-97) - Play Mode has nothing to add.
        const addTile = metroBlkEditMode ? '<button class="metroBlk-add-tile" aria-label="Add block" onclick="openMetroSegmentModal()">+</button>' : '';
        ui.innerHTML = loopBlocks.map(metroBlkTileHtml).join('') + addTile;

        // Dragging to reorder is Edit-Mode-only now too - no listeners bound at all in Play Mode.
        if (metroBlkEditMode) setupMetroBlkDragAndDrop(ui);
        // Keeps the play queue (and the "now playing" preview above) in step with every edit, not
        // just the next time Play is pressed - the whole point of putting the player above the
        // builder is that it reflects the blocks below immediately.
        refreshMetroBlkQueueIfStale();
        renderMetroBlkActiveTileHighlight();
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

    // Reordering is staged like every other edit (ML-97) - just rebuilds the local segments array to
    // match the DOM's now-final tile order (already correct visually, the drag itself moved the
    // elements) and leaves it there; orderIndex only gets (re)computed for real at saveMetroBlkEdit,
    // not tracked locally in the meantime. No network call, no reload - matches el.dataset.id as a
    // plain string so a staged/temp id (not yet a real number) reorders correctly too.
    function persistMetroBlkOrderFromDom(container) {
        const domIds = Array.from(container.querySelectorAll('.metroBlk-tile')).map(el => el.dataset.id);
        const byStrId = new Map(metroBlkCurrentSetup.segments.map(s => [String(s.id), s]));
        const reordered = domIds.map(id => byStrId.get(id)).filter(Boolean);
        const leadIn = metroBlkCurrentSetup.segments.find(s => s.isLeadIn);
        metroBlkCurrentSetup.segments = leadIn ? [leadIn, ...reordered] : reordered;
    }

    // --- Segment (block) edit modal ---
    // Whether the modal is currently editing THE lead-in (opened via openMetroLeadInModal) rather
    // than a regular block (openMetroSegmentModal) - controls which field groups show at all, see
    // syncMetroSegFieldVisibility.
    let metroSegEditingLeadIn = false;
    // "public:<id>" / "custom:<id>" of whichever time signature is currently chosen - the source of
    // truth now that the picker is a popup rather than a native <select> with its own .value. Shared
    // by both Blocks' own segment editor and Quick Play's per-block editors (only one picker can ever
    // be open at once) - whoever opens the modal sets this to their own current value first so
    // renderMetroSegTimeSigPicker highlights the right option.
    let metroSegTimeSigValue = null;
    // Which caller currently owns the picker - set right before the modal opens, so one shared modal
    // can serve both Blocks (updates its own segment fields) and Quick Play (updates one block's own
    // state) without this file hardcoding either caller's update logic.
    let metroSegTimeSigOnSelect = null;

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
    // ML-153: three fixed preset grids (Simple/Compound/Asymmetric) instead of one column per
    // denominator - grouped by time_signature_options.family (db/migrations/030_time_signature_
    // family.sql), which is NULL for every catalog entry that isn't one of these 12 presets (those
    // stay reachable only via the custom builder below, same as before). The order within each
    // family is fixed to match the design exactly - family alone doesn't imply an order, and the
    // catalog's own sort_order (oldest-added-first) doesn't happen to match it. A family with zero
    // members (shouldn't happen given the migration, but if the catalog is ever edited down to
    // nothing) just renders no grid rather than an empty heading.
    const METRO_SEG_TIMESIG_FAMILY_LABELS = { simple: 'Simple', compound: 'Compound', asymmetric: 'Asymmetric' };
    const METRO_SEG_TIMESIG_FAMILY_ORDER = {
        simple: ['2/4', '3/4', '4/4', '2/2'],
        compound: ['6/8', '9/8', '12/8', '3/8'],
        asymmetric: ['5/4', '7/4', '5/8', '7/8']
    };
    function renderMetroSegTimeSigPicker() {
        const el = document.getElementById('metroSegTimeSigFamilies');
        if (!el) return;
        el.innerHTML = Object.keys(METRO_SEG_TIMESIG_FAMILY_LABELS).map(family => {
            const order = METRO_SEG_TIMESIG_FAMILY_ORDER[family];
            const members = metroBlkTimeSigCache.public
                .filter(t => t.family === family)
                .sort((a, b) => order.indexOf(a.label) - order.indexOf(b.label));
            if (!members.length) return '';
            return `<div class="metroSeg-timesig-family">
                <div class="flow-tile-section-label">${METRO_SEG_TIMESIG_FAMILY_LABELS[family]}</div>
                <div class="metroSeg-timesig-family-grid">
                    ${members.map(t => {
                        const value = `public:${t.id}`;
                        return `<button type="button" class="metroBlk-timesig-opt${value === metroSegTimeSigValue ? ' selected' : ''}" data-value="${value}">${escapeHtml(t.label)}</button>`;
                    }).join('')}
                </div>
            </div>`;
        }).join('');
        el.querySelectorAll('.metroBlk-timesig-opt').forEach(btn => {
            btn.addEventListener('click', () => selectMetroSegTimeSig(btn.dataset.value));
        });
        renderMetroSegTimeSigChips();
    }
    // Saved custom quick chips - tapping the label selects & closes immediately, same as a preset.
    // Only shown once there's at least one (metroSegTimeSigChipsRow starts hidden-group in the HTML).
    // The small × (stopPropagation'd so it never also triggers select) is this compact popup's only
    // way to get an unwanted signature out of the way now that the old "Your custom time signatures"
    // full management list (with separate Delete/Archive actions) is gone. It archives rather than
    // hard-deletes, so the row stays in account_time_signatures (still valid for any block already
    // using it) - just hidden from the chip row instead of destroyed. A true delete is still possible
    // via window.deleteMetroSegCustomTimeSig if ever needed, just not exposed from this compact UI.
    function renderMetroSegTimeSigChips() {
        const row = document.getElementById('metroSegTimeSigChipsRow');
        const chips = document.getElementById('metroSegTimeSigChips');
        if (!row || !chips) return;
        const custom = metroBlkTimeSigCache.custom;
        row.classList.toggle('hidden-group', !custom.length);
        chips.innerHTML = custom.map(t => `
            <span class="metroSeg-timesig-chip">
                <button type="button" class="metroSeg-timesig-chip-select" data-value="custom:${t.id}">${escapeHtml(t.label)}</button>
                <button type="button" class="metroSeg-timesig-chip-remove" data-remove-id="${t.id}" aria-label="Archive ${escapeHtml(t.label)}">&times;</button>
            </span>`).join('');
        chips.querySelectorAll('.metroSeg-timesig-chip-select').forEach(btn => {
            btn.addEventListener('click', () => selectMetroSegTimeSig(btn.dataset.value));
        });
        chips.querySelectorAll('.metroSeg-timesig-chip-remove').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                archiveMetroSegCustomTimeSig(Number(btn.dataset.removeId));
            });
        });
    }
    // Picking a real signature applies immediately and closes, same as the note-value picker - no
    // separate "apply" step. The [x]/Done are the only ways to close without changing anything.
    function selectMetroSegTimeSig(value) {
        metroSegTimeSigValue = value;
        metroSegTimeSigOnSelect?.(value);
        document.getElementById('metroSegTimeSigModal').style.display = 'none';
    }
    document.getElementById('metroSegTimeSigBtn')?.addEventListener('click', () => {
        metroSegTimeSigOnSelect = () => {
            renderMetroSegTimeSigBtn();
            refreshMetroSegBpmDisplay();
        };
        renderMetroSegTimeSigPicker();
        document.getElementById('metroSegTimeSigModal').style.display = 'flex';
    });
    // ML-148-style scrim dismissal - tapping the dark backdrop outside the card closes it, same as
    // Done/[x] (every change already applies live, there's no separate "save" step to lose).
    document.getElementById('metroSegTimeSigModal')?.addEventListener('click', (e) => {
        if (e.target === e.currentTarget) e.currentTarget.style.display = 'none';
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
        // ML-103: time signature/beat unit/BPM now share one qp-style card (metroSegStandardBox) -
        // bar count/pickup beats deliberately stayed outside it, see the HTML comment there.
        document.getElementById('metroSegStandardBox').classList.toggle('hidden-group', metroSegEditingLeadIn);

        // ML-103 follow-up: "Multiple bars" is a regular-block-only toggleable card (see
        // metroSegApplyBarsSection); the lead-in still needs a bar-count stepper (its own Length
        // radios above already cover the 1-bar/partial-beat choice, not an on/off), so it reuses the
        // same card forced always-expanded with no toggle interaction, retitled, and hidden entirely
        // instead when editing a partial-beat lead-in (pickupBeats applies there instead).
        document.getElementById('metroSegBarsCard').classList.toggle('hidden-group', isPartial);
        document.querySelector('#metroSegBarsHeader .toggle-switch').classList.toggle('hidden-group', metroSegEditingLeadIn);
        document.getElementById('metroSegBarsHeader').style.pointerEvents = metroSegEditingLeadIn ? 'none' : '';
        document.querySelector('#metroSegBarsCard .metroSeg-card-title').innerText = metroSegEditingLeadIn ? 'Number of bars' : 'Multiple bars';
        if (metroSegEditingLeadIn) document.getElementById('metroSegBarsExpand').classList.add('is-expanded');

        document.getElementById('metroSegPickupBeatsGroup').classList.toggle('hidden-group', !isPartial);
        // ML-103: navigation/articulation markup is never meaningful on the lead-in (see
        // openMetroLeadInModal/metroBlkSegPayload).
        document.getElementById('metroSegNavigationSections').classList.toggle('hidden-group', metroSegEditingLeadIn);
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
    // ML-103 follow-up: a regular block's bar count only has a visible stepper at all once "Multiple
    // bars" is switched on (metroSegApplyBarsSection), and a "multiple bars" block that's actually
    // just 1 bar is a contradiction - so the floor is 2 there, same as the attached reference. The
    // lead-in has no such toggle (its own length radios cover the 1-bar case) and keeps the original
    // floor of 1.
    function metroSegBarsMin() { return metroSegEditingLeadIn ? 1 : 2; }
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
        const min = metroSegBarsMin();
        const pct = ((metroSegBarCount - min) / (metroSegBarsSliderMax - min)) * 100;
        document.getElementById('metroSegBarsSliderFill').style.width = `${pct}%`;
        const thumb = document.getElementById('metroSegBarsSliderThumb');
        thumb.style.left = `${pct}%`;
        thumb.setAttribute('aria-valuemin', min);
        thumb.setAttribute('aria-valuenow', metroSegBarCount);
        thumb.setAttribute('aria-valuemax', metroSegBarsSliderMax);
        const minLbl = document.getElementById('metroSegBarsSliderMinLbl');
        if (minLbl) minLbl.innerText = min;
        document.getElementById('metroSegBarsSliderMaxLbl').innerText = metroSegBarsSliderMax;
        document.getElementById('metroSegBarCount').innerText = metroSegBarCount;
    }
    function setMetroSegBarCount(value, opts = {}) {
        metroSegBarCount = Math.max(metroSegBarsMin(), Math.round(value));
        if (opts.dragging) metroSegBarsStepTier(metroSegBarCount); else metroSegBarsSliderMax = metroSegBarsBestFitTier(metroSegBarCount);
        renderMetroSegBarsSlider();
    }

    // Tap = +-1, hold = repeats, accelerating to +-10 per step after 15 taps' worth - same feel as
    // the single-bar metronome's own BPM stepper (setupMetroBpmStepper), generalised here to take
    // any step-applying callback so both the BPM and bar-count controls above can share it.
    function setupHoldStepper(btnOrId, direction, applyStep) {
        const btn = typeof btnOrId === 'string' ? document.getElementById(btnOrId) : btnOrId;
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

    // Generic press-and-hold-to-reset behaviour for a Play/Pause button: a normal tap calls
    // onToggle(), a press held past holdMs calls onReset() instead and suppresses the click that
    // follows on release (so lifting off doesn't also toggle play/pause). Shared by every metronome-
    // family tool's own Play button (Quick Play, Blocks/Flow) rather than each tool wiring this up
    // itself - the one place this interaction's timing/behaviour lives, so it only needs changing
    // here to change it everywhere it's used.
    function setupPlayButtonHoldReset(btnOrId, onToggle, onReset, holdMs = 600) {
        const btn = typeof btnOrId === 'string' ? document.getElementById(btnOrId) : btnOrId;
        if (!btn) return;
        let holdTimer = null;
        let didHold = false;

        function begin(e) {
            e.preventDefault();
            didHold = false;
            holdTimer = setTimeout(() => {
                didHold = true;
                onReset();
            }, holdMs);
        }
        function cancelHold() {
            clearTimeout(holdTimer);
        }
        btn.addEventListener('pointerdown', begin);
        btn.addEventListener('pointerup', cancelHold);
        btn.addEventListener('pointerleave', cancelHold);
        btn.addEventListener('pointercancel', cancelHold);
        btn.addEventListener('click', () => {
            if (didHold) { didHold = false; return; }
            onToggle();
        });
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
        onDragRatio: (ratio) => setMetroSegBarCount(metroSegBarsMin() + ratio * (metroSegBarsSliderMax - metroSegBarsMin()), { dragging: true }),
        onArrowStep: (dir) => setMetroSegBarCount(metroSegBarCount + dir, { dragging: true })
    });
    makeSliderReadoutEditable('metroSegBpmValue', () => Math.round(metroSegDisplayedBpm()), (v) => setMetroSegBpmFromDisplayed(v), { label: 'Beats per minute', min: METRO_MIN_BPM, max: METRO_MAX_BPM });
    makeSliderReadoutEditable('metroSegBarCount', () => metroSegBarCount, (v) => setMetroSegBarCount(v), { label: 'Number of bars', min: metroSegBarsMin() });

    // --- Note-value icons (real vector glyphs, not unicode musical symbols - see the CSS comment
    // on .metroBlk-note-picker for why). Shared with Quick Play's own per-block note picker
    // (qpOpenNotePicker) - same eight note values throughout the app, shortest to longest. Fraction
    // is of a semibreve (quaver = 1/8 = 0.125, etc.) - see metroSegNoteFraction. ---
    const METRO_NOTE_TYPES = [
        { key: 'semiquaver', label: 'Semiquaver', fraction: 0.0625 },
        { key: 'quaver', label: 'Quaver', fraction: 0.125 },
        { key: 'dotted-quaver', label: 'Dotted quaver', fraction: 0.1875 },
        { key: 'crotchet', label: 'Crotchet', fraction: 0.25 },
        { key: 'dotted-crotchet', label: 'Dotted crotchet', fraction: 0.375 },
        { key: 'minim', label: 'Minim', fraction: 0.5 },
        { key: 'dotted-minim', label: 'Dotted minim', fraction: 0.75 },
        { key: 'semibreve', label: 'Semibreve', fraction: 1 }
    ];
    // One shared viewBox/layout across all eight so they line up in a row regardless of whether a
    // given note has a stem/flag(s)/dot - notehead centre and stem position are fixed constants.
    function metroNoteIconSvg(key) {
        const head = '<ellipse cx="13" cy="44" rx="7.5" ry="5.2" transform="rotate(-20 13 44)"';
        const stem = '<rect x="19" y="6" width="2.6" height="38" fill="currentColor"/>';
        const flag = '<path d="M21.6 6 C30 10 29 20 21 26" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/>';
        const flagLow = '<path d="M21.6 16 C30 20 29 30 21 36" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/>';
        const dot = '<circle cx="27" cy="42" r="2.2" fill="currentColor"/>';
        switch (key) {
            case 'semibreve':
                return '<svg viewBox="0 0 32 56" class="metroBlk-note-svg"><ellipse cx="16" cy="28" rx="10" ry="6" fill="none" stroke="currentColor" stroke-width="3"/></svg>';
            case 'dotted-minim':
                return `<svg viewBox="0 0 32 56" class="metroBlk-note-svg">${head} fill="none" stroke="currentColor" stroke-width="2.6"/>${stem}${dot}</svg>`;
            case 'minim':
                return `<svg viewBox="0 0 32 56" class="metroBlk-note-svg">${head} fill="none" stroke="currentColor" stroke-width="2.6"/>${stem}</svg>`;
            case 'dotted-crotchet':
                return `<svg viewBox="0 0 32 56" class="metroBlk-note-svg">${head} fill="currentColor"/>${stem}${dot}</svg>`;
            case 'dotted-quaver':
                return `<svg viewBox="0 0 32 56" class="metroBlk-note-svg">${head} fill="currentColor"/>${stem}${flag}${dot}</svg>`;
            case 'quaver':
                return `<svg viewBox="0 0 32 56" class="metroBlk-note-svg">${head} fill="currentColor"/>${stem}${flag}</svg>`;
            case 'semiquaver':
                return `<svg viewBox="0 0 32 56" class="metroBlk-note-svg">${head} fill="currentColor"/>${stem}${flag}${flagLow}</svg>`;
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
        if (denominator === 16) return 'semiquaver';
        if (denominator === 8) return 'quaver';
        if (denominator === 2) return 'minim';
        if (denominator === 1) return 'semibreve';
        return 'crotchet';
    }
    function renderMetroSegNoteSelectBtn() {
        const btn = document.getElementById('metroSegNoteSelectBtn');
        const icon = document.getElementById('metroSegNoteBtnIcon');
        if (!btn || !icon) return;
        // ML-103: the button now also carries a static "beat unit" caption (qp-style card, see
        // index.html) - only the icon span's own content gets replaced, not the whole button.
        icon.innerHTML = metroNoteIconSvg(metroSegNoteSelected);
        const label = METRO_NOTE_TYPES.find(t => t.key === metroSegNoteSelected)?.label || '';
        btn.setAttribute('aria-label', `Beat note: ${label}. Tap to change.`);
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
    // ML-103 follow-up: the Speed change/Introduction/Fermata pickers cycle/list "beat N of the
    // bar" - driven by the block's own numerator rather than the attached reference's hardcoded
    // "of 4", since a block's time signature isn't always 4 beats to the bar.
    function metroSegSelectedNumerator() {
        if (!metroSegTimeSigValue) return 4;
        const [sigType, sigId] = metroSegTimeSigValue.split(':');
        const list = sigType === 'public' ? metroBlkTimeSigCache.public : metroBlkTimeSigCache.custom;
        const found = list.find(t => t.id === Number(sigId));
        return found ? found.numerator : 4;
    }

    document.getElementById('metroSegNoteSelectBtn')?.addEventListener('click', () => {
        renderMetroSegNotePicker();
        document.getElementById('metroSegNoteModal').style.display = 'flex';
    });

    // --- ML-103 follow-up: block editor reworked into expandable cards (Standard/Multiple bars/
    // Repeats/Landmarks/Speed change/Introduction/Jumps/Articulation), per the attached reference
    // (expandable_metronome_sections.html). One flat variable per field still, same convention as
    // metroSegBpm/metroSegTimeSigValue above - openMetroSegmentModal populates all of them, each
    // popup/tile edits its own, the Save handler reads them all back. Never populated/read for the
    // lead-in (see syncMetroSegFieldVisibility/metroBlkSegPayload) - none of this applies there.
    //
    // Every card past Standard has a master on/off (.toggle-switch) that both gates whether that
    // topic applies to the block AND expands/collapses the card - switching one off clears its own
    // fields back to "not used" (see the metroSeg*SectionApply functions below), switching it back
    // on starts fresh rather than restoring what was cleared, so state stays simple and predictable.
    let metroSegBarsOn = false;
    let metroSegRepeatsOn = false;
    let metroSegLandmarksOn = false;
    let metroSegSpeedOn = false;
    let metroSegIntroOn = false;
    let metroSegJumpsOn = false;
    let metroSegArticulationOn = false;

    let metroSegIsRepeatStart = false;
    let metroSegIsRepeatEnd = false;
    let metroSegRepeatPlayCount = null;
    let metroSegEnding = 'none'; // 'none' | 'first' | 'second' | 'combined'

    let metroSegIsSectionBoundary = false;
    let metroSegRehearsalMarks = []; // [{mark, barOffset}]
    let metroSegRehearsalEditIndex = -1; // -1 = adding a new one, else index into metroSegRehearsalMarks

    let metroSegRampStartBeatOffset = 1; // bar offset is always 0 (bar 1 of the block) - see the intro note below
    let metroSegRampDurationBars = 1;

    // Start and end are independent (an intro can span more than one block - a block might carry
    // just the start, just the end, both, or neither), each with its own on/off + beat. The card's
    // own metroSegIntroOn above is just expand/collapse + "off clears both" - see
    // metroSegApplyIntroSection.
    let metroSegIntroStartOn = false;
    let metroSegIntroStartBeatOffset = 1;
    let metroSegIntroEndOn = false;
    let metroSegIntroEndBeatOffset = 1;
    let metroSegIntroModalTarget = 'start'; // 'start' | 'end'

    let metroSegIsCoda = false;
    let metroSegIsSegno = false;
    let metroSegGotoCoda = false;
    let metroSegGotoSegno = false;
    let metroSegGotoSegnoThenCoda = false;
    let metroSegGotoStartDc = false;

    let metroSegFermatas = []; // [{barOffset, beatOffset, holdBeats, playbackMode}]
    let metroSegFermataEditIndex = -1;

    // Real notation, not a generic icon-font glyph (per the original ML-103 ask) - the coda/segno
    // marks are hand-built SVG (Unicode musical symbols have unreliable font support and risk
    // showing as tofu boxes); the repeat/double-barline marks use styled text ("‖:"/":‖") matching
    // the attached reference's own rendering, which is simpler and still literal notation rather
    // than a generic icon. currentColor so each picks up its container's colour, .selected included.
    const METRO_SEG_ICON_CODA = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><ellipse cx="12" cy="12" rx="7" ry="5.5"/><line x1="12" y1="3" x2="12" y2="21"/><line x1="3" y1="12" x2="21" y2="12"/></svg>';
    const METRO_SEG_ICON_SEGNO = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><line x1="6" y1="18" x2="18" y2="6"/><circle cx="9" cy="8" r="1.3" fill="currentColor" stroke="none"/><circle cx="15" cy="16" r="1.3" fill="currentColor" stroke="none"/><path d="M15.5 6.5C14.5 5 12.8 4.5 11 5C8.8 5.6 8.5 7.8 10 9C12 10.6 15 11.2 15 14C15 17 12 18.5 9.5 18C7.5 17.5 6.8 16 6.5 15" fill="none"/></svg>';

    // --- Card expand/collapse + master on/off (metroSeg*SectionApply): each wires a .toggle-switch
    // + its card header to a getter/setter for that section's own "on" variable, an onOff callback
    // that resets the section's fields, and returns an `apply(on)` function openMetroSegmentModal
    // calls directly to set initial state (no synthetic click needed). ---
    // `apply(on, isInitialLoad)` - isInitialLoad (set by openMetroSegmentModal, populating state from
    // an already-saved block) skips onApply's reset-to-default/clear-fields side effect, since that
    // would otherwise stomp the real loaded values with a fresh-toggle default the moment the modal
    // opens; a genuine user click on the switch/header always passes it interactively (undefined).
    function metroSegWireSection(toggleId, headerId, expandId, isOnFn, setOnFn, onApply) {
        const checkbox = document.getElementById(toggleId);
        const header = document.getElementById(headerId);
        const expand = document.getElementById(expandId);
        function apply(on, isInitialLoad) {
            setOnFn(on);
            checkbox.checked = on;
            expand.classList.toggle('is-expanded', on);
            if (!isInitialLoad) onApply(on);
            renderMetroSegNavigationSummary();
        }
        checkbox.addEventListener('click', (e) => { e.stopPropagation(); apply(checkbox.checked); });
        header.addEventListener('click', () => apply(!isOnFn()));
        return apply;
    }

    const metroSegApplyBarsSection = metroSegWireSection('metroSegBarsToggle', 'metroSegBarsHeader', 'metroSegBarsExpand',
        () => metroSegBarsOn, (v) => { metroSegBarsOn = v; },
        (on) => { setMetroSegBarCount(on ? 2 : 1); });

    const metroSegApplyRepeatsSection = metroSegWireSection('metroSegRepeatsToggle', 'metroSegRepeatsHeader', 'metroSegRepeatsExpand',
        () => metroSegRepeatsOn, (v) => { metroSegRepeatsOn = v; },
        (on) => { if (!on) { metroSegIsRepeatStart = false; metroSegIsRepeatEnd = false; metroSegRepeatPlayCount = null; metroSegEnding = 'none'; } });

    const metroSegApplyLandmarksSection = metroSegWireSection('metroSegLandmarksToggle', 'metroSegLandmarksHeader', 'metroSegLandmarksExpand',
        () => metroSegLandmarksOn, (v) => { metroSegLandmarksOn = v; },
        (on) => { if (!on) { metroSegIsSectionBoundary = false; metroSegRehearsalMarks = []; renderMetroSegRehearsalList(); } });

    const metroSegApplySpeedSection = metroSegWireSection('metroSegSpeedToggle', 'metroSegSpeedHeader', 'metroSegSpeedExpand',
        () => metroSegSpeedOn, (v) => { metroSegSpeedOn = v; },
        (on) => { metroSegRampStartBeatOffset = 1; metroSegRampDurationBars = 1; renderMetroSegSpeedCard(); });

    const metroSegApplyIntroSection = metroSegWireSection('metroSegIntroToggle', 'metroSegIntroHeader', 'metroSegIntroExpand',
        () => metroSegIntroOn, (v) => { metroSegIntroOn = v; },
        (on) => { if (!on) { metroSegIntroStartOn = false; metroSegIntroEndOn = false; } });

    const metroSegApplyJumpsSection = metroSegWireSection('metroSegJumpsToggle', 'metroSegJumpsHeader', 'metroSegJumpsExpand',
        () => metroSegJumpsOn, (v) => { metroSegJumpsOn = v; },
        (on) => { if (!on) { metroSegIsCoda = false; metroSegIsSegno = false; metroSegGotoCoda = false; metroSegGotoSegno = false; metroSegGotoSegnoThenCoda = false; metroSegGotoStartDc = false; } });

    const metroSegApplyArticulationSection = metroSegWireSection('metroSegArticulationToggle', 'metroSegArticulationHeader', 'metroSegArticulationExpand',
        () => metroSegArticulationOn, (v) => { metroSegArticulationOn = v; },
        (on) => { if (!on) { metroSegFermatas = []; renderMetroSegFermataList(); } });

    // Reflects every metroSeg* navigation variable into its card/tile - called once when the modal
    // opens and again after every popup/tile interaction.
    function renderMetroSegNavigationSummary() {
        document.getElementById('metroSegStartRepeatBtn').classList.toggle('selected', metroSegIsRepeatStart);
        document.getElementById('metroSegEndRepeatBtn').classList.toggle('selected', metroSegIsRepeatEnd);
        document.getElementById('metroSegEndRepeatLabel').innerText = metroSegIsRepeatEnd
            ? `End repeat (${metroSegRepeatPlayCount || 2}x)` : 'End repeat (off)';

        const endingLabels = { none: 'None', first: '1.', second: '2.', combined: '1. 2.' };
        document.getElementById('metroSegEndingValue').innerText = endingLabels[metroSegEnding];
        document.getElementById('metroSegEndingBtn').classList.toggle('selected', metroSegEnding !== 'none');

        document.getElementById('metroSegBoundaryBtn').classList.toggle('selected', metroSegIsSectionBoundary);
        document.getElementById('metroSegRehearsalCountBadge').innerText = `${metroSegRehearsalMarks.length} ${metroSegRehearsalMarks.length === 1 ? 'mark' : 'marks'}`;

        renderMetroSegSpeedCard();

        document.getElementById('metroSegSegnoIcon').innerHTML = METRO_SEG_ICON_SEGNO;
        document.getElementById('metroSegSegnoBtn').classList.toggle('selected', metroSegIsSegno);
        document.getElementById('metroSegCodaIcon').innerHTML = METRO_SEG_ICON_CODA;
        document.getElementById('metroSegCodaBtn').classList.toggle('selected', metroSegIsCoda);
        document.getElementById('metroSegGotoSegnoBtn').classList.toggle('selected', metroSegGotoSegno);
        document.getElementById('metroSegGotoSegnoThenCodaBtn').classList.toggle('selected', metroSegGotoSegnoThenCoda);
        document.getElementById('metroSegGotoCodaIcon').innerHTML = METRO_SEG_ICON_CODA;
        document.getElementById('metroSegGotoCodaBtn').classList.toggle('selected', metroSegGotoCoda);
        document.getElementById('metroSegGotoStartBtn').classList.toggle('selected', metroSegGotoStartDc);

        const numerator = metroSegSelectedNumerator();
        document.getElementById('metroSegStartIntroBadge').innerText = metroSegIntroStartOn ? `${metroSegIntroStartBeatOffset}/${numerator}` : 'None';
        document.getElementById('metroSegStartIntroSub').innerText = !metroSegIntroStartOn ? 'Not used in this block'
            : metroSegIntroStartBeatOffset === 1 ? `Downbeat (1 of ${numerator})` : `Pickup beat ${metroSegIntroStartBeatOffset} of ${numerator}`;
        document.getElementById('metroSegStartIntroBtn').classList.toggle('selected', metroSegIntroStartOn);
        document.getElementById('metroSegEndIntroBadge').innerText = metroSegIntroEndOn ? 'Bar 1' : 'None';
        document.getElementById('metroSegEndIntroSub').innerText = metroSegIntroEndOn
            ? `Finishes beat ${metroSegIntroEndBeatOffset} of ${numerator}` : 'Not used in this block';
        document.getElementById('metroSegEndIntroBtn').classList.toggle('selected', metroSegIntroEndOn);

        renderMetroSegFermataList();
    }

    // --- Repeats: Start repeat is a plain direct toggle; End repeat opens the quick-pick count
    // modal (turning it on always needs a count); 1st/2nd time opens the volta modal. ---
    document.getElementById('metroSegStartRepeatBtn')?.addEventListener('click', () => {
        metroSegIsRepeatStart = !metroSegIsRepeatStart;
        renderMetroSegNavigationSummary();
    });
    document.getElementById('metroSegEndRepeatBtn')?.addEventListener('click', () => {
        // Highlights 2x as the suggested default on a block with no end repeat set yet, rather than
        // "None" - nothing is actually applied until a quick-pick option is tapped, this just points
        // at the common case (per the "repeat count defaults to 2" instruction).
        document.querySelectorAll('#metroSegRepeatCountOptions .metroSeg-quickpick-opt').forEach(btn => {
            const val = Number(btn.dataset.value);
            btn.classList.toggle('selected', metroSegIsRepeatEnd ? val === (metroSegRepeatPlayCount || 2) : val === 2);
        });
        document.getElementById('metroSegRepeatCountModal').style.display = 'flex';
    });
    document.getElementById('metroSegRepeatCountOptions')?.addEventListener('click', (e) => {
        const btn = e.target.closest('.metroSeg-quickpick-opt');
        if (!btn) return;
        const val = Number(btn.dataset.value);
        metroSegIsRepeatEnd = val > 0;
        metroSegRepeatPlayCount = val > 0 ? val : null;
        document.getElementById('metroSegRepeatCountModal').style.display = 'none';
        renderMetroSegNavigationSummary();
    });

    document.getElementById('metroSegEndingBtn')?.addEventListener('click', () => {
        document.querySelectorAll('#metroSegEndingOptions .metroSeg-option-row').forEach(btn => {
            btn.classList.toggle('selected', btn.dataset.value === metroSegEnding);
        });
        document.getElementById('metroSegEndingModal').style.display = 'flex';
    });
    document.getElementById('metroSegEndingOptions')?.addEventListener('click', (e) => {
        const btn = e.target.closest('.metroSeg-option-row');
        if (!btn) return;
        metroSegEnding = btn.dataset.value;
        document.getElementById('metroSegEndingModal').style.display = 'none';
        renderMetroSegNavigationSummary();
    });

    // --- Landmarks: Double barline is a plain direct toggle; rehearsal marks are a small add/edit/
    // remove list, each with its own bar position (dynamic, up to metroSegBarCount). ---
    document.getElementById('metroSegBoundaryBtn')?.addEventListener('click', () => {
        metroSegIsSectionBoundary = !metroSegIsSectionBoundary;
        renderMetroSegNavigationSummary();
    });

    function metroSegPopulateBarSelect(selectEl, selectedOffset) {
        selectEl.innerHTML = '';
        for (let i = 0; i < metroSegBarCount; i++) {
            const opt = document.createElement('option');
            opt.value = String(i);
            opt.textContent = i === 0 ? 'At start (bar 1)' : `After ${i} bar${i === 1 ? '' : 's'} (bar ${i + 1})`;
            if (i === selectedOffset) opt.selected = true;
            selectEl.appendChild(opt);
        }
    }

    // One pencil-only edit affordance per row (no separate delete icon here - same "simplify the
    // list, put delete behind the edit popup instead" ask as the fermata list below) - reuses
    // .metroSeg-icon-btn, the same "plain icon, no circle behind it" recipe .qp-bar-menu-btn's
    // corner menu button already uses elsewhere in the app.
    function renderMetroSegRehearsalList() {
        const ui = document.getElementById('metroSegRehearsalList');
        if (!ui) return;
        if (!metroSegRehearsalMarks.length) { ui.innerHTML = '<p class="metro-help-text">No rehearsal marks yet.</p>'; return; }
        ui.innerHTML = metroSegRehearsalMarks.map((m, i) => `
            <div class="history-item metroSeg-list-row">
                <span class="metroSeg-list-row-badge">${escapeHtml(m.mark)}</span>
                <div style="flex-grow:1;">
                    <strong>${m.barOffset === 0 ? 'At start (bar 1)' : `After ${m.barOffset} bar${m.barOffset === 1 ? '' : 's'} (bar ${m.barOffset + 1})`}</strong>
                </div>
                <button type="button" class="metroSeg-icon-btn" aria-label="Edit rehearsal mark" onclick="openMetroSegRehearsalModal(${i})"><span class="material-symbols-outlined">edit</span></button>
            </div>
        `).join('');
    }
    window.removeMetroSegRehearsalMark = function(index) {
        metroSegRehearsalMarks = metroSegRehearsalMarks.filter((_, i) => i !== index);
        renderMetroSegRehearsalList();
        renderMetroSegNavigationSummary();
    };
    window.openMetroSegRehearsalModal = function(index) {
        metroSegRehearsalEditIndex = index;
        const existing = index >= 0 ? metroSegRehearsalMarks[index] : null;
        document.getElementById('metroSegRehearsalModalTitle').innerText = existing ? 'Edit rehearsal mark' : 'Add rehearsal mark';
        document.getElementById('metroSegRehearsalMarkInput').value = existing ? existing.mark : String.fromCharCode(65 + metroSegRehearsalMarks.length % 26);
        metroSegPopulateBarSelect(document.getElementById('metroSegRehearsalBarSelect'), existing ? existing.barOffset : 0);
        document.getElementById('metroSegRehearsalDeleteSection').classList.toggle('hidden-group', index < 0);
        document.getElementById('metroSegRehearsalModal').style.display = 'flex';
    };
    document.getElementById('metroSegRehearsalAddBtn')?.addEventListener('click', () => openMetroSegRehearsalModal(-1));
    document.getElementById('metroSegRehearsalSaveBtn')?.addEventListener('click', () => {
        const mark = document.getElementById('metroSegRehearsalMarkInput').value.trim().toUpperCase();
        if (!mark) return showWarningToast('Enter a rehearsal mark.');
        const barOffset = Number(document.getElementById('metroSegRehearsalBarSelect').value) || 0;
        const entry = { mark, barOffset };
        if (metroSegRehearsalEditIndex >= 0) {
            metroSegRehearsalMarks = metroSegRehearsalMarks.map((m, i) => i === metroSegRehearsalEditIndex ? entry : m);
        } else {
            metroSegRehearsalMarks = [...metroSegRehearsalMarks, entry];
        }
        metroSegRehearsalMarks.sort((a, b) => a.barOffset - b.barOffset);
        document.getElementById('metroSegRehearsalModal').style.display = 'none';
        renderMetroSegRehearsalList();
        renderMetroSegNavigationSummary();
    });
    document.getElementById('metroSegRehearsalDeleteBtn')?.addEventListener('click', () => {
        if (metroSegRehearsalEditIndex >= 0) removeMetroSegRehearsalMark(metroSegRehearsalEditIndex);
        document.getElementById('metroSegRehearsalModal').style.display = 'none';
    });

    // --- Speed change: no popup - "Change at beat"/"Over duration" cycle inline on the card itself,
    // matching the attached reference. Beat cycles 1..numerator, duration cycles 1..8 (a UI cap -
    // the backend itself doesn't cap rampDurationBars, matching repeat count's same UI-cap reasoning
    // below). ---
    function renderMetroSegSpeedCard() {
        const numerator = metroSegSelectedNumerator();
        document.getElementById('metroSegSpeedBeatVal').innerText = `Beat ${metroSegRampStartBeatOffset} of ${numerator}`;
        document.getElementById('metroSegSpeedBarsVal').innerText = `${metroSegRampDurationBars} bar${metroSegRampDurationBars === 1 ? '' : 's'}`;
    }
    document.getElementById('metroSegSpeedBeatNextBtn')?.addEventListener('click', () => {
        const numerator = metroSegSelectedNumerator();
        metroSegRampStartBeatOffset = metroSegRampStartBeatOffset >= numerator ? 1 : metroSegRampStartBeatOffset + 1;
        renderMetroSegSpeedCard();
    });
    document.getElementById('metroSegSpeedBarsNextBtn')?.addEventListener('click', () => {
        metroSegRampDurationBars = metroSegRampDurationBars >= 8 ? 1 : metroSegRampDurationBars + 1;
        renderMetroSegSpeedCard();
    });

    // --- Introduction: Start/End tiles share one popup (metroSegIntroModalTarget), each
    // independently either "None" or a beat (always bar 1 of the block, no bar picker - matching
    // the attached reference) - an intro can span more than one block, so a block might be just the
    // start, just the end, both, or neither. Tapping an option applies and closes immediately, same
    // as the other quick-pick popups (Ending, Repeat count). ---
    function metroSegBeatTilesHtml(count, selected, cls) {
        let html = '';
        for (let b = 1; b <= count; b++) {
            html += `<button type="button" class="${cls}${b === selected ? ' selected' : ''}" data-value="${b}">Beat ${b}</button>`;
        }
        return html;
    }
    function metroSegIntroTilesHtml(numerator, on, beat) {
        let html = `<button type="button" class="metroSeg-tap-btn${!on ? ' selected' : ''}" data-value="none"><strong>None</strong></button>`;
        for (let b = 1; b <= numerator; b++) {
            html += `<button type="button" class="metroSeg-tap-btn${on && b === beat ? ' selected' : ''}" data-value="${b}">Beat ${b}</button>`;
        }
        return html;
    }
    window.openMetroSegIntroModal = function(target) {
        metroSegIntroModalTarget = target;
        const numerator = metroSegSelectedNumerator();
        const on = target === 'start' ? metroSegIntroStartOn : metroSegIntroEndOn;
        const beat = target === 'start' ? metroSegIntroStartBeatOffset : metroSegIntroEndBeatOffset;
        document.getElementById('metroSegIntroModalTitle').innerText = target === 'start' ? 'Start intro (pickup)' : 'End intro boundary';
        document.getElementById('metroSegIntroModalHelp').innerText = !on ? 'Not used in this block'
            : target === 'start' ? `Pickup starts on beat ${beat} of ${numerator}` : `Intro ends on beat ${beat} of ${numerator}`;
        document.getElementById('metroSegIntroBeatOptions').innerHTML = metroSegIntroTilesHtml(numerator, on, beat);
        document.getElementById('metroSegIntroModal').style.display = 'flex';
    };
    document.getElementById('metroSegStartIntroBtn')?.addEventListener('click', () => openMetroSegIntroModal('start'));
    document.getElementById('metroSegEndIntroBtn')?.addEventListener('click', () => openMetroSegIntroModal('end'));
    document.getElementById('metroSegIntroBeatOptions')?.addEventListener('click', (e) => {
        const btn = e.target.closest('.metroSeg-tap-btn');
        if (!btn) return;
        const val = btn.dataset.value;
        if (metroSegIntroModalTarget === 'start') {
            metroSegIntroStartOn = val !== 'none';
            if (metroSegIntroStartOn) metroSegIntroStartBeatOffset = Number(val);
        } else {
            metroSegIntroEndOn = val !== 'none';
            if (metroSegIntroEndOn) metroSegIntroEndBeatOffset = Number(val);
        }
        document.getElementById('metroSegIntroModal').style.display = 'none';
        renderMetroSegNavigationSummary();
    });

    // --- Jumps: every tile is a plain direct toggle (target signs + jump instructions). ---
    function metroSegWireBoolTile(btnId, getFn, setFn) {
        document.getElementById(btnId)?.addEventListener('click', () => {
            setFn(!getFn());
            renderMetroSegNavigationSummary();
        });
    }
    metroSegWireBoolTile('metroSegSegnoBtn', () => metroSegIsSegno, (v) => { metroSegIsSegno = v; });
    metroSegWireBoolTile('metroSegCodaBtn', () => metroSegIsCoda, (v) => { metroSegIsCoda = v; });
    metroSegWireBoolTile('metroSegGotoSegnoBtn', () => metroSegGotoSegno, (v) => { metroSegGotoSegno = v; });
    metroSegWireBoolTile('metroSegGotoSegnoThenCodaBtn', () => metroSegGotoSegnoThenCoda, (v) => { metroSegGotoSegnoThenCoda = v; });
    metroSegWireBoolTile('metroSegGotoCodaBtn', () => metroSegGotoCoda, (v) => { metroSegGotoCoda = v; });
    metroSegWireBoolTile('metroSegGotoStartBtn', () => metroSegGotoStartDc, (v) => { metroSegGotoStartDc = v; });

    // --- Articulation: fermata add/edit/remove list, each with beat and hold length (1-4). Bar
    // picker only shown when the block spans more than one bar, same as before. Playback mode
    // (tone/silent/count) used to live per-fermata here, but it's a user playback preference, not
    // something that varies block to block - moved to Settings (fermataPlaybackModeSetting)
    // instead, so it no longer appears on this list or its edit popup. One pencil-only edit
    // affordance per row (no separate delete icon - delete moved into the edit popup). ---
    function renderMetroSegFermataList() {
        const ui = document.getElementById('metroSegFermataList');
        const badge = document.getElementById('metroSegFermataCountBadge');
        if (badge) badge.innerText = `${metroSegFermatas.length} ${metroSegFermatas.length === 1 ? 'hold' : 'holds'}`;
        if (!ui) return;
        if (!metroSegFermatas.length) { ui.innerHTML = '<p class="metro-help-text">No fermatas yet.</p>'; return; }
        ui.innerHTML = metroSegFermatas.map((f, i) => `
            <div class="history-item metroSeg-list-row">
                <span class="metroSeg-list-row-badge">&#119136;</span>
                <div style="flex-grow:1;">
                    <strong>${metroSegBarCount > 1 ? `Bar ${f.barOffset + 1}, beat` : 'On beat'} ${f.beatOffset}</strong>
                    <span style="font-size:0.75rem; margin-left:6px; color:var(--primary-action);">Hold ${f.holdBeats} beat${f.holdBeats === 1 ? '' : 's'}</span>
                </div>
                <button type="button" class="metroSeg-icon-btn" aria-label="Edit fermata" onclick="openMetroSegFermataModal(${i})"><span class="material-symbols-outlined">edit</span></button>
            </div>
        `).join('');
    }
    window.removeMetroSegFermata = function(index) {
        metroSegFermatas = metroSegFermatas.filter((_, i) => i !== index);
        renderMetroSegFermataList();
        renderMetroSegNavigationSummary();
    };
    window.openMetroSegFermataModal = function(index) {
        metroSegFermataEditIndex = index;
        const existing = index >= 0 ? metroSegFermatas[index] : null;
        document.getElementById('metroSegFermataModalTitle').innerText = existing ? 'Edit fermata hold' : 'Add another fermata';
        const barGroup = document.getElementById('metroSegFermataBarGroup');
        barGroup.classList.toggle('hidden-group', metroSegBarCount <= 1);
        if (metroSegBarCount > 1) metroSegPopulateBarSelect(document.getElementById('metroSegFermataBarSelect'), existing ? existing.barOffset : 0);
        const beat = existing ? existing.beatOffset : 1;
        document.getElementById('metroSegFermataBeatOptions').innerHTML = metroSegBeatTilesHtml(metroSegSelectedNumerator(), beat, 'metroSeg-tap-btn');
        const hold = existing ? existing.holdBeats : 2;
        document.querySelectorAll('#metroSegFermataHoldOptions .metroSeg-tap-btn').forEach(b => b.classList.toggle('selected', Number(b.dataset.value) === hold));
        document.getElementById('metroSegFermataDeleteSection').classList.toggle('hidden-group', index < 0);
        document.getElementById('metroSegFermataModal').style.display = 'flex';
    };
    document.getElementById('metroSegFermataAddOpenBtn')?.addEventListener('click', () => openMetroSegFermataModal(-1));
    document.getElementById('metroSegFermataBeatOptions')?.addEventListener('click', (e) => {
        const btn = e.target.closest('.metroSeg-tap-btn');
        if (!btn) return;
        document.querySelectorAll('#metroSegFermataBeatOptions .metroSeg-tap-btn').forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
    });
    document.getElementById('metroSegFermataHoldOptions')?.addEventListener('click', (e) => {
        const btn = e.target.closest('.metroSeg-tap-btn');
        if (!btn) return;
        document.querySelectorAll('#metroSegFermataHoldOptions .metroSeg-tap-btn').forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
    });
    document.getElementById('metroSegFermataSaveBtn')?.addEventListener('click', () => {
        const barSelect = document.getElementById('metroSegFermataBarSelect');
        const barOffset = metroSegBarCount > 1 ? Number(barSelect.value) || 0 : 0;
        const beatBtn = document.querySelector('#metroSegFermataBeatOptions .metroSeg-tap-btn.selected');
        const beatOffset = beatBtn ? Number(beatBtn.dataset.value) : 1;
        const holdBtn = document.querySelector('#metroSegFermataHoldOptions .metroSeg-tap-btn.selected');
        const holdBeats = holdBtn ? Number(holdBtn.dataset.value) : 2;
        const entry = { barOffset, beatOffset, holdBeats };
        if (metroSegFermataEditIndex >= 0) {
            metroSegFermatas = metroSegFermatas.map((f, i) => i === metroSegFermataEditIndex ? entry : f);
        } else {
            metroSegFermatas = [...metroSegFermatas, entry];
        }
        metroSegFermatas.sort((a, b) => a.barOffset - b.barOffset || a.beatOffset - b.beatOffset);
        document.getElementById('metroSegFermataModal').style.display = 'none';
        renderMetroSegFermataList();
        renderMetroSegNavigationSummary();
    });
    document.getElementById('metroSegFermataDeleteBtn')?.addEventListener('click', () => {
        if (metroSegFermataEditIndex >= 0) removeMetroSegFermata(metroSegFermataEditIndex);
        document.getElementById('metroSegFermataModal').style.display = 'none';
    });

    window.openMetroSegmentModal = function(segId = null) {
        // No Number() coercion - segId can be a real numeric id or a staged/temp string id
        // (ML-97, e.g. "tmp3") depending on whether this block has been saved to the server yet.
        const seg = segId !== null ? metroBlkCurrentSetup.segments.find(s => s.id === segId) : null;
        // A brand-new block defaults to whatever the last block - immediately before the "+" tile -
        // is set to, rather than a fixed 4/4 @ 120bpm: a new block is usually a variation on the one
        // right before it, not an unrelated fresh start.
        const regularBlocks = metroBlkCurrentSetup.segments.filter(s => !s.isLeadIn);
        const lastRegular = regularBlocks[regularBlocks.length - 1];
        metroSegEditingLeadIn = false;

        document.getElementById('metroSegEditId').value = segId || '';
        // "Block N" (ML-103) rather than "Edit/Add block" - a new block takes the next free number,
        // same position it'll actually land in once saved (metroBlkCurrentSetup.segments is appended
        // to, never reordered, by the Save handler below).
        const blockNumber = seg ? regularBlocks.indexOf(seg) + 1 : regularBlocks.length + 1;
        document.getElementById('metroSegmentModalTitle').innerText = `Block ${blockNumber}`;
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
        document.getElementById('metroSegCustomNumerator').value = '4';
        document.getElementById('metroSegCustomDenominator').value = '4';

        // Bug fix: an existing block's own last-chosen note value (persisted since ML-35 follow-up)
        // takes priority over the denominator-based default - re-opening a saved block used to
        // always reset to that default, silently discarding whatever was actually picked before.
        metroSegNoteSelected = (seg && seg.noteValue) ? seg.noteValue : metroSegDefaultNoteForDenominator(metroSegSelectedDenominator());
        renderMetroSegNoteSelectBtn();
        setMetroSegBpm(seg ? seg.bpm : (lastRegular ? lastRegular.bpm : 120));

        // ML-103: navigation/articulation markup - never carried over from lastRegular the way
        // time signature/bpm are above, since a new block starting a fresh repeat/coda/etc is the
        // much more common case than copying one block's journey markup onto the next.
        metroSegIsRepeatStart = seg ? !!seg.isRepeatStart : false;
        metroSegIsRepeatEnd = seg ? !!seg.isRepeatEnd : false;
        metroSegRepeatPlayCount = seg ? (seg.repeatPlayCount || null) : null;
        metroSegEnding = seg && seg.isFirstTimeBar && seg.isSecondTimeBar ? 'combined'
            : seg && seg.isFirstTimeBar ? 'first' : (seg && seg.isSecondTimeBar ? 'second' : 'none');

        metroSegIsSectionBoundary = seg ? !!seg.isSectionBoundary : false;
        metroSegRehearsalMarks = seg && Array.isArray(seg.rehearsalMarks) ? seg.rehearsalMarks.map(m => ({ ...m })) : [];

        metroSegRampStartBeatOffset = seg && seg.rampStartBeatOffset ? seg.rampStartBeatOffset : 1;
        metroSegRampDurationBars = seg && seg.rampDurationBars ? seg.rampDurationBars : 1;

        metroSegIntroStartOn = !!(seg && seg.introStartBeatOffset !== null && seg.introStartBeatOffset !== undefined);
        metroSegIntroStartBeatOffset = seg && seg.introStartBeatOffset ? seg.introStartBeatOffset : 1;
        metroSegIntroEndOn = !!(seg && seg.introEndBeatOffset !== null && seg.introEndBeatOffset !== undefined);
        metroSegIntroEndBeatOffset = seg && seg.introEndBeatOffset ? seg.introEndBeatOffset : metroSegSelectedNumerator();

        metroSegIsCoda = seg ? !!seg.isCoda : false;
        metroSegIsSegno = seg ? !!seg.isSegno : false;
        metroSegGotoCoda = seg ? !!seg.gotoCoda : false;
        metroSegGotoSegno = seg ? !!seg.gotoSegno : false;
        metroSegGotoSegnoThenCoda = seg ? !!seg.gotoSegnoThenCoda : false;
        metroSegGotoStartDc = seg ? !!seg.gotoStartDc : false;

        metroSegFermatas = seg && Array.isArray(seg.fermatas) ? seg.fermatas.map(f => ({ ...f })) : [];

        // Master on/off per card - isInitialLoad (true) so this only syncs the switch/expand UI to
        // what was actually saved, without also running each section's reset-to-default side effect.
        metroSegApplyBarsSection(seg ? seg.barCount > 1 : false, true);
        metroSegApplyRepeatsSection(!!(seg && (seg.isRepeatStart || seg.isRepeatEnd || seg.isFirstTimeBar || seg.isSecondTimeBar)), true);
        metroSegApplyLandmarksSection(!!(seg && (seg.isSectionBoundary || (seg.rehearsalMarks && seg.rehearsalMarks.length))), true);
        metroSegApplySpeedSection(!!(seg && seg.rampStartBeatOffset), true);
        metroSegApplyIntroSection(!!(seg && (seg.introStartBeatOffset || seg.introEndBeatOffset)), true);
        metroSegApplyJumpsSection(!!(seg && (seg.isCoda || seg.isSegno || seg.gotoCoda || seg.gotoSegno || seg.gotoSegnoThenCoda || seg.gotoStartDc)), true);
        metroSegApplyArticulationSection(!!(seg && seg.fermatas && seg.fermatas.length), true);
        renderMetroSegRehearsalList();
        renderMetroSegNavigationSummary();

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
        // No Number() coercion here either - see the matching comment on openMetroSegmentModal.
        const leadIn = segId !== null ? metroBlkCurrentSetup.segments.find(s => s.id === segId) : null;
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
        // Denominator is a <select> locked to 2/4/8/16 (ML-153 - a beat value has to actually be a
        // musical note power of two), so it can't itself be out of range - only beats needs checking.
        const denominator = Number(document.getElementById('metroSegCustomDenominator').value);
        if (!numerator || numerator < 1 || numerator > 32) return showWarningToast('Beats must be between 1 and 32.');
        try {
            const created = await API.metronomeBlocks.timeSignatures.createCustom(numerator, denominator);
            await loadMetroBlkTimeSignatures();
            selectMetroSegTimeSig(`custom:${created.id}`);
            document.getElementById('metroSegCustomNumerator').value = '4';
            document.getElementById('metroSegCustomDenominator').value = '4';
            showSuccessToast(`Added ${numerator}/${denominator}`);
        } catch (error) {
            showWarningToast('Error adding time signature: ' + error.message);
        }
    });

    // Resolves the display fields (timeSignatureLabel/numerator/denominator) a local segment needs
    // for rendering, off the raw fields the segment editor collects - mirrors what the server's own
    // getSegmentDtoById does via SQL join, done client-side since Edit Mode (ML-97) stages segment
    // edits locally instead of round-tripping to the server for every change. `existingId` keeps an
    // edited segment's real/temp id; omitted, a fresh temp id is minted for a brand-new block.
    function buildLocalSegmentDto(data, existingId) {
        const list = data.timeSignatureId !== null ? metroBlkTimeSigCache.public : metroBlkTimeSigCache.custom;
        const sigId = data.timeSignatureId !== null ? data.timeSignatureId : data.accountTimeSignatureId;
        const sig = list.find(t => t.id === sigId);
        return {
            ...data,
            id: existingId !== undefined ? existingId : `tmp${++metroBlkTempSegCounter}`,
            timeSignatureLabel: sig ? sig.label : '',
            numerator: sig ? sig.numerator : 4,
            denominator: sig ? sig.denominator : 4
        };
    }

    document.getElementById('metroSegSaveBtn')?.addEventListener('click', () => {
        const id = document.getElementById('metroSegEditId').value || null;
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
                accountTimeSignatureId: firstRegular.accountTimeSignatureId,
                noteValue: null // never independently meaningful on a lead-in - see metroBlkEffectiveBlock
            };
        } else {
            if (!metroSegTimeSigValue) return showWarningToast('Choose a time signature.');
            const [sigType, sigId] = metroSegTimeSigValue.split(':');
            data = {
                isLeadIn: false,
                bpm: metroSegBpm,
                timeSignatureId: sigType === 'public' ? Number(sigId) : null,
                accountTimeSignatureId: sigType === 'custom' ? Number(sigId) : null,
                // Bug fix: this used to be discarded entirely - nothing captured which note value
                // the Target BPM display was set with, so re-opening this block to edit it later
                // always reset to a denominator-based default (metroSegDefaultNoteForDenominator)
                // instead of remembering the actual choice.
                noteValue: metroSegNoteSelected
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

        // ML-103: navigation/articulation markup - never meaningful on the lead-in, so `data` simply
        // never gets these fields there (metroBlkSegPayload/buildLocalSegmentDto then carry them as
        // undefined, same as noteValue already does for a lead-in above). Each card's own master
        // toggle (metroSegRepeatsOn etc.) gates whether its fields are actually sent "on" - even if
        // the underlying variables still hold a stale value from before the card was switched off.
        if (!metroSegEditingLeadIn) {
            data.isRepeatStart = metroSegRepeatsOn && metroSegIsRepeatStart;
            data.isRepeatEnd = metroSegRepeatsOn && metroSegIsRepeatEnd;
            data.repeatPlayCount = (metroSegRepeatsOn && metroSegIsRepeatEnd) ? metroSegRepeatPlayCount : null;
            const ending = metroSegRepeatsOn ? metroSegEnding : 'none';
            data.isFirstTimeBar = ending === 'first' || ending === 'combined';
            data.isSecondTimeBar = ending === 'second' || ending === 'combined';

            data.isSectionBoundary = metroSegLandmarksOn && metroSegIsSectionBoundary;
            data.rehearsalMarks = metroSegLandmarksOn ? metroSegRehearsalMarks : [];

            data.isCoda = metroSegJumpsOn && metroSegIsCoda;
            data.isSegno = metroSegJumpsOn && metroSegIsSegno;
            data.gotoCoda = metroSegJumpsOn && metroSegGotoCoda;
            data.gotoSegno = metroSegJumpsOn && metroSegGotoSegno;
            data.gotoSegnoThenCoda = metroSegJumpsOn && metroSegGotoSegnoThenCoda;
            data.gotoStartDc = metroSegJumpsOn && metroSegGotoStartDc;

            // Start and end are independent (see the Introduction card's own comment) - each only
            // sent when its own tile is actually set, not gated by one shared flag any more.
            data.introStartBarOffset = metroSegIntroStartOn ? 0 : null;
            data.introStartBeatOffset = metroSegIntroStartOn ? metroSegIntroStartBeatOffset : null;
            data.introEndBarOffset = metroSegIntroEndOn ? 0 : null;
            data.introEndBeatOffset = metroSegIntroEndOn ? metroSegIntroEndBeatOffset : null;

            const speedSet = metroSegSpeedOn;
            data.rampStartBarOffset = speedSet ? 0 : null;
            data.rampStartBeatOffset = speedSet ? metroSegRampStartBeatOffset : null;
            data.rampDurationBars = speedSet ? metroSegRampDurationBars : null;

            data.fermatas = metroSegArticulationOn ? metroSegFermatas : [];
        }

        // Staged locally (ML-97), matched against the hidden field's string id (real numeric id or
        // a temp one, either way stringified) - nothing hits the server until saveMetroBlkEdit. A
        // brand-new lead-in goes at the front of the array, not the end - buildMetroBlkPlayQueue
        // assumes lead-in(s) sort first (same invariant persistMetroBlkOrderFromDom/
        // normalizeMetroBlkOrder already maintain), and this is the one path that stages a new
        // segment without going through either of those.
        const existing = id ? metroBlkCurrentSetup.segments.find(s => String(s.id) === id) : null;
        if (existing) {
            metroBlkCurrentSetup.segments = metroBlkCurrentSetup.segments.map(s => s === existing ? buildLocalSegmentDto(data, existing.id) : s);
        } else {
            const dto = buildLocalSegmentDto(data);
            metroBlkCurrentSetup.segments = dto.isLeadIn ? [dto, ...metroBlkCurrentSetup.segments] : [...metroBlkCurrentSetup.segments, dto];
        }
        document.getElementById('metroSegmentModal').style.display = 'none';
        renderMetroBlockTiles();
    });

    document.getElementById('metroSegDeleteBtn')?.addEventListener('click', () => {
        const id = document.getElementById('metroSegEditId').value;
        if (!id) return;
        showConfirmModal('Delete block', 'Delete this block?', () => {
            metroBlkCurrentSetup.segments = metroBlkCurrentSetup.segments.filter(s => String(s.id) !== id);
            document.getElementById('metroSegmentModal').style.display = 'none';
            renderMetroBlockTiles();
        });
    });

    // The 3-dot per-tile menu (ML-97/ML-100, Edit Mode only): Copy to end, Copy here, and Delete -
    // one shared floating menu element rather than one per tile (tiles re-render on every edit, so
    // a single reusable menu repositioned against whichever button was tapped avoids rebuilding menu
    // DOM/listeners on every render). metroBlkTileMenuTargetId is which segment it's currently for.
    let metroBlkTileMenuTargetId = null;
    // Bug fix: right-anchoring the menu to the button's right edge (no clamping) pushed it mostly
    // off-screen to the left whenever the button itself sat near the viewport's left edge - which is
    // most tiles, any time the viewport is only about as wide as .container itself (~500px, common in
    // an embedded/constrained preview pane rather than a truly wide window). Measures the menu's real
    // size first (shown off-screen momentarily, same tick - no visible flicker) then clamps both axes
    // so it always lands fully inside the viewport regardless of which tile/column it was opened from.
    window.openMetroBlkTileMenu = function(e, id) {
        const menu = document.getElementById('metroBlkTileMenu');
        if (!menu) return;
        closeAllMetroPopupMenus();
        metroBlkTileMenuTargetId = id;
        const btnRect = e.currentTarget.getBoundingClientRect();
        menu.style.right = 'auto';
        menu.classList.add('show');
        const menuWidth = menu.offsetWidth;
        const menuHeight = menu.offsetHeight;
        let left = btnRect.right - menuWidth;
        left = Math.max(8, Math.min(left, window.innerWidth - menuWidth - 8));
        let top = btnRect.bottom + 4;
        top = Math.min(top, window.innerHeight - menuHeight - 8);
        menu.style.left = `${left}px`;
        menu.style.top = `${top}px`;
    };
    function closeMetroBlkTileMenu() {
        document.getElementById('metroBlkTileMenu')?.classList.remove('show');
    }
    // Closes on any click outside the menu - matches the burger menu's own pattern (closeMenu above).
    // The menu's own item clicks stopPropagation so they don't immediately re-close themselves via
    // this same listener before their own handler runs.
    document.addEventListener('click', closeMetroBlkTileMenu);

    // Duplicates the target segment with a fresh temp id (ML-100) - 'end' appends after every other
    // loop block (the lead-in, if any, is always pinned first already - see buildMetroBlkPlayQueue -
    // so pushing to the array's end can never land the copy before it); 'here' inserts immediately
    // after the source block instead, between it and whatever was next.
    window.copyMetroBlkTile = function(mode) {
        const id = metroBlkTileMenuTargetId;
        closeMetroBlkTileMenu();
        const segs = metroBlkCurrentSetup.segments;
        const source = segs.find(s => s.id === id);
        if (!source) return;
        const copy = { ...source, id: `tmp${++metroBlkTempSegCounter}` };
        if (mode === 'end') {
            metroBlkCurrentSetup.segments = [...segs, copy];
        } else {
            const idx = segs.findIndex(s => s.id === id);
            const newSegs = [...segs];
            newSegs.splice(idx + 1, 0, copy);
            metroBlkCurrentSetup.segments = newSegs;
        }
        renderMetroBlockTiles();
    };
    document.getElementById('metroBlkTileMenuCopyEnd')?.addEventListener('click', (e) => { e.stopPropagation(); copyMetroBlkTile('end'); });
    document.getElementById('metroBlkTileMenuCopyHere')?.addEventListener('click', (e) => { e.stopPropagation(); copyMetroBlkTile('here'); });
    document.getElementById('metroBlkTileMenuDelete')?.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = metroBlkTileMenuTargetId;
        closeMetroBlkTileMenu();
        const seg = metroBlkCurrentSetup.segments.find(s => s.id === id);
        showConfirmModal(seg?.isLeadIn ? 'Delete lead-in' : 'Delete block', 'Delete this block?', () => {
            metroBlkCurrentSetup.segments = metroBlkCurrentSetup.segments.filter(s => s.id !== id);
            renderMetroBlockTiles();
        });
    });

    async function loadMetroBlkTimeSignatures(token) {
        try {
            metroBlkTimeSigCache = await API.metronomeBlocks.timeSignatures.list(token);
        } catch (error) {
            showWarningToast('Error loading time signatures: ' + error.message);
        }
    }

    // --- Sequencing ---
    // Tracks which `segments` array the play queue was last built from - every local edit (Edit
    // Mode's staged mutations included, ML-97) always produces a brand-new array rather than
    // mutating in place, so comparing by reference is enough to tell "the blocks changed since the
    // queue was built" from "nothing changed, just re-rendering" without needing a separate dirty
    // flag.
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
    // Sub-beats mode is a playback-only overlay (like speed%), not per-block data - one setting
    // applies across the whole sequence rather than being stored per segment. The lead-in never
    // subdivides or macro-groups regardless of this setting, though - it's too short for sub-beats to
    // mean anything, and they'd just be noise leading into the actual first beat.
    // ML-95: Off/Auto/Fixed, replacing the old plain Off/On - ML-106: Auto always shows sub-beats,
    // using whichever count the meter itself calls for (metroBlkMeterInfo) - it no longer waits for
    // the tempo to drop below a threshold first, only the count adapts, not whether they show at all.
    // metroBlkSubdivideOverride is only consulted in 'fixed' mode, where the user can still drag the
    // slider to something other than the meter's own metric default (session-wide, like the old
    // slider value was - not stored per block).
    let metroBlkSubBeatsMode = 'off';
    let metroBlkSubdivideOverride = null;

    function metroBlkShouldSubdivide(block) {
        const info = metroBlkMeterInfo(block);
        if (!info) return false; // lead-in
        return metroBlkSubBeatsMode !== 'off';
    }

    // The actual multiplier fed to the engine/renderer - replaces the old metroBlkEffectiveSubFactor.
    // 1 (no subdivision) for a lead-in or whenever metroBlkShouldSubdivide says no; otherwise the
    // meter's own subdivisionFactor, or the user's manual override while in 'fixed' mode.
    function metroBlkSubFactorFor(block) {
        if (!block || block.isLeadIn || !metroBlkShouldSubdivide(block)) return 1;
        if (metroBlkSubBeatsMode === 'fixed' && metroBlkSubdivideOverride) return metroBlkSubdivideOverride;
        return metroBlkMeterInfo(block).subdivisionFactor;
    }

    function applyMetroBlkToPlayer(block) {
        metroBlkPlayer.setConductorBpm(block.bpm);
        metroBlkPlayer.setConductorBeatsPerBar(metroBlkBeatsPerBarFor(block));
        metroBlkPlayer.setNotesPerBeat(block.isLeadIn ? 1 : metroBlkSubFactorFor(block));
        // The engine's own separate "practice subdivision" tier is retired for Blocks (ML-95) - there's
        // only one subdivision concept now (the data-driven one above), not two stacked layers.
        metroBlkPlayer.setSubdivisionFactor(1);
        // A distinct, lower-pitched click while the lead-in plays, so it's obviously not "real" beat
        // 1 yet even before you've learned to listen for the count.
        metroBlkPlayer.setLowPitch(!!block.isLeadIn);
    }

    // A partial lead-in starts on the tail end of the bar (see greyOutSkippedDots) - everywhere a
    // block boundary would otherwise call resetToBarStart(), this picks the right starting beat
    // instead so the click and the dots agree on where "beat 1 of the lead-in" actually is. Scaled
    // by the subdivide factor since clickIndex counts sub-clicks, not conductor beats, once
    // subdivision is more than 1 (never for the lead-in itself - see metroBlkSubFactorFor).
    function metroBlkRealignPlayer(block, useIntroStart) {
        if (block.pickupBeats) metroBlkPlayer.setBeatIndex((block.numerator - block.pickupBeats) * metroBlkSubFactorFor(block));
        else if (useIntroStart) metroBlkPlayer.setBeatIndex((block.introStartBeatOffset - 1) * metroBlkSubFactorFor(block));
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

    // A factor of 1 means "no subdivision" - shown as "0" (not "1") so the collapsed button and popup
    // both read as "0 sub beats" rather than a plain "1" that doesn't obviously mean off.
    function metroBlkSubdivideDisplayValue(v) { return v <= 1 ? '0' : String(v); }

    // Whichever block the transport/popup should currently reflect - null if nothing's loaded yet.
    function metroBlkSubdivideCurrentBlock() {
        return metroBlkPlayQueue.length ? metroBlkEffectiveBlock(metroBlkPlayQueue[metroBlkPlayIndex], metroBlkPlayQueue) : null;
    }

    // The collapsed button always reflects metroBlkSubFactorFor's live decision for whichever block
    // is current - 0 for Off (or a lead-in), the meter's own metric default for Auto-and-slow-enough,
    // 0 for Auto-but-too-fast, the override-or-metric-default for On. Called from renderMetroBlkRows
    // too so it live-updates as playback advances between blocks/speed changes, not just on Save.
    function renderMetroBlkSubdivideLabels() {
        const block = metroBlkSubdivideCurrentBlock();
        const display = metroBlkSubdivideDisplayValue(block ? metroBlkSubFactorFor(block) : 1);
        const lbl = document.getElementById('metroBlkSubdivideLbl');
        if (lbl) lbl.innerText = display;
        const miniLbl = document.getElementById('metroBlkMiniSubdivideLbl');
        if (miniLbl) miniLbl.innerText = display;
        // ML-165: Off and Fixed both just say "sub beats" - only Auto (whose count comes from the
        // time signature, not something the user set) gets called out, so it's clear at a glance
        // which one is actually driving the number shown.
        const unitText = metroBlkSubBeatsMode === 'auto' ? 'auto sub beats' : 'sub beats';
        const unitLbl = document.getElementById('metroBlkSubdivideUnitLbl');
        if (unitLbl) unitLbl.innerText = unitText;
        const miniUnitLbl = document.getElementById('metroBlkMiniSubdivideUnitLbl');
        if (miniUnitLbl) miniUnitLbl.innerText = unitText;
    }

    // Commits the popup's mode (+ override, 'fixed' only) and re-pushes the live player state for
    // whichever block is currently loaded - mirrors the old setMetroBlkSubdivision's "if the lead-in
    // is what's playing, it stays un-subdivided regardless" via metroBlkSubFactorFor's own isLeadIn
    // branch.
    function setMetroBlkSubBeatsMode(mode, overrideValue) {
        metroBlkSubBeatsMode = mode;
        metroBlkSubdivideOverride = mode === 'fixed' ? overrideValue : null;
        const block = metroBlkSubdivideCurrentBlock();
        if (block) metroBlkPlayer.setNotesPerBeat(block.isLeadIn ? 1 : metroBlkSubFactorFor(block));
        renderMetroBlkSubdivideLabels();
        renderMetroBlkRows();
    }

    // --- Sub beats popup (ML-91 follow-up: was a button-grid picker shared with the single-bar tool's
    // own subdivide modal - "2 per beat" plus a redundant "/ beat" unit label read as "2 per beat per
    // beat". Now a dedicated slider popup, 2 to the same METRO_CUSTOM_MAX ceiling the old Custom entry
    // allowed, with just the number and "sub beats" underneath - both the collapsed button and this
    // popup share that same big-number-small-label format. A later follow-up restored +/- steppers
    // next to the number, since the slider alone lost the old picker's quick, repeatable jumps, and
    // gave the slider the same tiered-expansion "stretch" as the segment editor's own bpm/bar-count
    // sliders (metroSegBpmSliderMax et al above) - starts at a tight 16 so everyday values are easy
    // to land on, growing to the full METRO_CUSTOM_MAX ceiling only once actually dragged that far.
    // ML-95: Off/On became Off/Auto/On - Auto's count is entirely metric-driven (metroBlkMeterInfo),
    // never something the user sets directly, so this box is only ever shown for Fixed (renamed from
    // "On" per ML-106, since Auto is no longer conditional either) - fully editable there, defaulting
    // to the metric default but overridable (metroBlkSubdivideOverride, session-wide, same shape the
    // old "last used value" was) - the slider/stepper mechanics below are otherwise unchanged from the
    // ML-99 round. Still bottoms out at 2, not 1 - reaching "off" is the radio's job, not something you
    // drag down to any more.) ---
    const METRO_BLK_SUBDIVIDE_MIN = 2;
    const METRO_BLK_SUBDIVIDE_TIERS = [16, METRO_CUSTOM_MAX];
    let metroBlkSubdividePopupValue = 2; // staged - only committed (as an override) on Save, and only in 'fixed' mode
    let metroBlkSubdivideSliderMax = METRO_BLK_SUBDIVIDE_TIERS[0];

    function metroBlkSubdivideBestFitTier(value) {
        for (const t of METRO_BLK_SUBDIVIDE_TIERS) if (value <= t) return t;
        return METRO_BLK_SUBDIVIDE_TIERS[METRO_BLK_SUBDIVIDE_TIERS.length - 1];
    }
    function metroBlkSubdivideStepTier(value) {
        const idx = METRO_BLK_SUBDIVIDE_TIERS.indexOf(metroBlkSubdivideSliderMax);
        if (idx < METRO_BLK_SUBDIVIDE_TIERS.length - 1 && value >= METRO_BLK_SUBDIVIDE_TIERS[idx]) {
            metroBlkSubdivideSliderMax = METRO_BLK_SUBDIVIDE_TIERS[idx + 1];
        } else if (idx > 0 && value < METRO_BLK_SUBDIVIDE_TIERS[idx - 1]) {
            metroBlkSubdivideSliderMax = METRO_BLK_SUBDIVIDE_TIERS[idx - 1];
        }
    }
    function renderMetroBlkSubdividePopup() {
        document.getElementById('metroBlkSubdividePopupValue').innerText = metroBlkSubdivideDisplayValue(metroBlkSubdividePopupValue);
        const pct = ((metroBlkSubdividePopupValue - METRO_BLK_SUBDIVIDE_MIN) / (metroBlkSubdivideSliderMax - METRO_BLK_SUBDIVIDE_MIN)) * 100;
        document.getElementById('metroBlkSubdivideSliderFill').style.width = `${pct}%`;
        const thumb = document.getElementById('metroBlkSubdivideSliderThumb');
        thumb.style.left = `${pct}%`;
        thumb.setAttribute('aria-valuenow', metroBlkSubdividePopupValue);
        thumb.setAttribute('aria-valuemax', metroBlkSubdivideSliderMax);
        document.getElementById('metroBlkSubdivideSliderMaxLbl').innerText = metroBlkSubdivideSliderMax;
    }
    function setMetroBlkSubdividePopupValue(v, opts = {}) {
        metroBlkSubdividePopupValue = Math.min(METRO_CUSTOM_MAX, Math.max(METRO_BLK_SUBDIVIDE_MIN, Math.round(v)));
        if (opts.dragging) metroBlkSubdivideStepTier(metroBlkSubdividePopupValue);
        else metroBlkSubdivideSliderMax = metroBlkSubdivideBestFitTier(metroBlkSubdividePopupValue);
        renderMetroBlkSubdividePopup();
    }
    setupSliderInteraction(document.getElementById('metroBlkSubdivideSliderTrack'), document.getElementById('metroBlkSubdivideSliderThumb'), {
        onDragRatio: (ratio) => setMetroBlkSubdividePopupValue(METRO_BLK_SUBDIVIDE_MIN + ratio * (metroBlkSubdivideSliderMax - METRO_BLK_SUBDIVIDE_MIN), { dragging: true }),
        onArrowStep: (dir) => setMetroBlkSubdividePopupValue(metroBlkSubdividePopupValue + dir, { dragging: true })
    });
    makeSliderReadoutEditable('metroBlkSubdividePopupValue', () => metroBlkSubdividePopupValue, (v) => setMetroBlkSubdividePopupValue(v),
        { label: 'Sub beats', min: METRO_BLK_SUBDIVIDE_MIN, max: METRO_CUSTOM_MAX });
    setupHoldStepper('metroBlkSubdivideMinus', -1, (amount) => setMetroBlkSubdividePopupValue(metroBlkSubdividePopupValue + amount));
    setupHoldStepper('metroBlkSubdividePlus', 1, (amount) => setMetroBlkSubdividePopupValue(metroBlkSubdividePopupValue + amount));

    // Shows the count box only for Fixed - Off has nothing to configure, and Auto's count is entirely
    // metric-driven (not user-set), so showing a locked/greyed-out box for it was never actually
    // relevant to anything the user could do (feedback: remove it there too, not just for Off).
    function renderMetroBlkSubdivideOnOffUI(mode) {
        const box = document.getElementById('metroBlkSubdivideBpmBox');
        if (!box) return;
        box.classList.toggle('hidden-group', mode !== 'fixed');
    }
    // The metric default (this popup's fallback whenever there's no block-specific one to show -
    // e.g. nothing loaded yet, or the current block is a lead-in) - a plausible generic value, never
    // actually used to drive playback.
    function metroBlkSubdivideMetricDefault() {
        const block = metroBlkSubdivideCurrentBlock();
        const info = block ? metroBlkMeterInfo(block) : null;
        return info ? info.subdivisionFactor : METRO_BLK_SUBDIVIDE_MIN;
    }
    document.getElementById('metroBlkSubdivideOff')?.addEventListener('change', () => {
        renderMetroBlkSubdivideOnOffUI('off');
    });
    document.getElementById('metroBlkSubdivideAuto')?.addEventListener('change', () => {
        renderMetroBlkSubdivideOnOffUI('auto');
        setMetroBlkSubdividePopupValue(metroBlkSubdivideMetricDefault());
    });
    document.getElementById('metroBlkSubdivideFixed')?.addEventListener('change', () => {
        renderMetroBlkSubdivideOnOffUI('fixed');
        setMetroBlkSubdividePopupValue(metroBlkSubdivideOverride || metroBlkSubdivideMetricDefault());
    });

    // One popup, opened from either the full view's button or the mini bar's (ML-94 follow-up
    // replication) - both just seed the same staged state from whatever's currently committed, for
    // whichever block is currently loaded (the metric default can differ block to block).
    function openMetroBlkSubdividePopup() {
        const mode = metroBlkSubBeatsMode;
        document.getElementById('metroBlkSubdivideOff').checked = mode === 'off';
        document.getElementById('metroBlkSubdivideAuto').checked = mode === 'auto';
        document.getElementById('metroBlkSubdivideFixed').checked = mode === 'fixed';
        renderMetroBlkSubdivideOnOffUI(mode);
        if (mode === 'fixed') setMetroBlkSubdividePopupValue(metroBlkSubdivideOverride || metroBlkSubdivideMetricDefault());
        else setMetroBlkSubdividePopupValue(metroBlkSubdivideMetricDefault());
        document.getElementById('metroBlkSubdivideModal').style.display = 'flex';
    }
    document.getElementById('metroBlkSubdivideBtn')?.addEventListener('click', openMetroBlkSubdividePopup);
    document.getElementById('metroBlkMiniSubdivideBtn')?.addEventListener('click', openMetroBlkSubdividePopup);
    document.getElementById('metroBlkSubdivideCancelBtn')?.addEventListener('click', () => {
        document.getElementById('metroBlkSubdivideModal').style.display = 'none';
    });
    document.getElementById('metroBlkSubdivideSaveBtn')?.addEventListener('click', () => {
        const mode = document.querySelector('input[name="metroBlkSubdivideOnOff"]:checked')?.value || 'off';
        // Only a genuine override (the user actually moved it away from the metric default) is worth
        // remembering - saving with the default still showing shouldn't lock in a redundant override.
        const overrideValue = (mode === 'fixed' && metroBlkSubdividePopupValue !== metroBlkSubdivideMetricDefault())
            ? metroBlkSubdividePopupValue : null;
        setMetroBlkSubBeatsMode(mode, overrideValue);
        document.getElementById('metroBlkSubdivideModal').style.display = 'none';
    });

    // First non-lead-in segment's index - the default "start of the actual piece" position, used as
    // both the plain loop-back target and the fallback repeat-start point (ML-138) when a closing
    // repeat has no earlier opening repeat of its own to go back to.
    function metroBlkFirstRegularIndex() {
        const idx = metroBlkPlayQueue.findIndex(s => !s.isLeadIn);
        return idx === -1 ? 0 : idx;
    }

    // The segment (if any) carrying an intro pickup start (ML-139) - never a lead-in, see the
    // Introduction card's own comment above openMetroSegIntroModal.
    function metroBlkIntroStartIndex() {
        return metroBlkPlayQueue.findIndex(s => !s.isLeadIn && s.introStartBeatOffset != null);
    }

    // Where a fresh play-through actually begins: the lead-in if there is one (it always comes
    // first regardless of an intro), else the intro-start block if one is configured, else the
    // plain first regular block.
    function metroBlkStartIndex() {
        if (metroBlkPlayQueue.length && metroBlkPlayQueue[0].isLeadIn) return 0;
        const introIdx = metroBlkIntroStartIndex();
        return introIdx !== -1 ? introIdx : metroBlkFirstRegularIndex();
    }

    // Repositions playback to a specific queue index without changing play/pause state - resets the
    // per-block counters and pushes the resolved block's settings into the player. Shared by
    // buildMetroBlkPlayQueue/resetMetroBlk (via jumpMetroBlkToStart), advanceMetroBlk's own
    // step/repeat-jump-back, and jumpMetroBlkToPlayIndex (ML-97 tap-to-jump in Play Mode).
    function jumpMetroBlkToIndex(index) {
        metroBlkPlayIndex = index;
        metroBlkBeatsPlayedInBlock = 0;
        metroBlkClicksPlayedInBlock = 0;
        if (!metroBlkPlayQueue.length) return;
        const block = metroBlkEffectiveBlock(metroBlkPlayQueue[index], metroBlkPlayQueue);
        // ML-139: the intro's pickup start offset only ever applies once, on the specific jump
        // jumpMetroBlkToStart just armed by clearing metroBlkIntroConsumed - every other jump (this
        // call included, right after using it) leaves it consumed so the block plays out in full on
        // any later pass through the sequence.
        const useIntroStart = !metroBlkIntroConsumed && !block.pickupBeats && block.introStartBeatOffset > 1;
        applyMetroBlkToPlayer(block);
        metroBlkRealignPlayer(block, useIntroStart);
        // ML-130: same shared engine/schedule shape as Flow's own jumpFlowToIndex - block.fermatas is
        // always [] here today (no UI to create one on an ad-hoc segment yet), so this is a no-op in
        // practice, but the wiring is real and needs no changes whenever that UI is added.
        metroBlkPlayer.setFermataSchedule(buildFermataSchedule(block, metroBlkSubFactorFor(block)), fermataPlaybackModeSetting());
        if (useIntroStart) {
            const skippedBeats = block.introStartBeatOffset - 1;
            metroBlkBeatsPlayedInBlock = skippedBeats;
            metroBlkClicksPlayedInBlock = skippedBeats * metroBlkSubFactorFor(block);
        }
        metroBlkIntroConsumed = true;
    }

    // Repositions to the very start of a fresh play-through (ML-139) - the one place that re-arms the
    // intro's pickup start offset, consumed by the jumpMetroBlkToIndex call this makes. Shared by
    // buildMetroBlkPlayQueue (a fresh queue/first load) and resetMetroBlk (the explicit Reset).
    function jumpMetroBlkToStart() {
        metroBlkIntroConsumed = false;
        jumpMetroBlkToIndex(metroBlkStartIndex());
    }

    function buildMetroBlkPlayQueue() {
        metroBlkPlayQueue = metroBlkCurrentSetup.segments;
        metroBlkPlayQueueSourceSegments = metroBlkCurrentSetup.segments;
        // Skips past the lead-in on every loop-back by default (it played once already, right at the
        // very start) - unless it's been marked repeatLeadIn (ML-85), in which case the loop-back point
        // IS the lead-in itself, so it plays again before every repeat rather than only once.
        const leadIn = metroBlkPlayQueue.find(s => s.isLeadIn);
        metroBlkLoopBackIndex = (leadIn && leadIn.repeatLeadIn) ? 0 : metroBlkFirstRegularIndex();
        metroBlkRepeatCounts = {};
        jumpMetroBlkToStart();
    }

    // Play Mode's tap-to-jump (ML-97): repositions to the tapped block without starting or stopping
    // playback - mirrors Reset's own "position only" behaviour rather than force-starting, since
    // that's the one existing precedent for this kind of jump in this tool.
    window.jumpMetroBlkToPlayIndex = function(id) {
        const index = metroBlkPlayQueue.findIndex(s => s.id === id);
        if (index === -1) return;
        jumpMetroBlkToIndex(index);
        renderMetroBlkRows();
    };

    // The repeat-start index a closing repeat at `endIndex` should jump back to (ML-138): the nearest
    // earlier block explicitly marked isRepeatStart, or - "the very first bar of the playing counts
    // as an opening repeat" per the ticket - the plain first regular block if there isn't one.
    function metroBlkRepeatStartIndexFor(endIndex) {
        const firstIdx = metroBlkFirstRegularIndex();
        for (let i = endIndex - 1; i >= firstIdx; i--) {
            if (metroBlkPlayQueue[i].isRepeatStart) return i;
        }
        return firstIdx;
    }

    function advanceMetroBlk() {
        const finishedIndex = metroBlkPlayIndex;
        const finishedBlock = metroBlkPlayQueue[finishedIndex];
        // ML-138: a closing repeat sends playback back rather than advancing, until it's played
        // repeatPlayCount times in total (default 2, matching the segment editor's own quick-pick
        // default) - independent repeat regions each track their own count (metroBlkRepeatCounts),
        // so more than one repeated section can exist in the same sequence.
        if (finishedBlock && finishedBlock.isRepeatEnd) {
            const timesSoFar = metroBlkRepeatCounts[finishedBlock.id] || 0;
            const totalPlays = finishedBlock.repeatPlayCount || 2;
            if (timesSoFar < totalPlays - 1) {
                metroBlkRepeatCounts[finishedBlock.id] = timesSoFar + 1;
                jumpMetroBlkToIndex(metroBlkRepeatStartIndexFor(finishedIndex));
                setTimeout(renderMetroBlkRows, 130);
                return;
            }
            delete metroBlkRepeatCounts[finishedBlock.id];
        }
        let next = finishedIndex + 1;
        if (next >= metroBlkPlayQueue.length) {
            // A fresh pass through the whole sequence - every repeat region gets to fire again.
            metroBlkRepeatCounts = {};
            next = metroBlkLoopBackIndex;
        }
        jumpMetroBlkToIndex(next);
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

        const block = metroBlkEffectiveBlock(metroBlkPlayQueue[metroBlkPlayIndex], metroBlkPlayQueue);
        if (!block) return;
        const subFactor = metroBlkSubFactorFor(block);

        // One dot per base click now (main beats AND sub-beats) - flash by the raw click-in-bar
        // index, which lines up 1:1 with the dots buildMetroDotRow actually created. ML-95 used to
        // drop this flash for Auto-mode sub-beats
        // above 200 subdivided BPM as a performance guardrail - written back when Auto only ever
        // subdivided at slow tempos in the first place, so it was a rare edge case. ML-106 made Auto
        // subdivide unconditionally, which meant this same threshold now silently dropped the flash at
        // completely ordinary tempos (120 bpm x 2 = 240, already over it) - the click sound still
        // played, just with no visible dot, reported as "auto sub-beats aren't showing as highlighted"
        // (ML-111). Removed - Auto now animates every click exactly like Fixed mode already did.
        flashTierDot('metroBlkRow0Dots', beatInfo.clickIndexInBar);
        flashTierDot('metroBlkMiniDots', beatInfo.clickIndexInBar);
        updateFermataDotState('metroBlkRow0Dots', beatInfo);
        updateFermataDotState('metroBlkMiniDots', beatInfo);

        // ML-130: see onFlowBeat's matching comment - a repeat pulse within a fermata hold isn't a new
        // beat, and must not count towards block-advancement/bar-label bookkeeping below.
        const isFermataRepeat = !!(beatInfo.fermataHold && !beatInfo.fermataHold.isFirst);
        if (isFermataRepeat) return;

        // Advancing has to wait for every click of the target's last beat, sub-beats included, not
        // just that beat's own main click - a 4/4 bar with subdivide on isn't actually finished the
        // instant beat 4 sounds, there's still beat 4's trailing sub-beat(s) to play before the bar
        // genuinely ends. Counting conductor beats alone (as before) advanced - and reconfigured the
        // player for the next block - one sub-beat too early, silently dropping that final click.
        // metroBlkBeatsPerBarFor: macro beats for a regular block (ML-95), still the raw numerator
        // for a whole-bar lead-in (untouched) - pickupBeats itself is always raw-numerator regardless.
        metroBlkClicksPlayedInBlock++;
        const targetBeats = block.pickupBeats || (block.barCount * metroBlkBeatsPerBarFor(block));
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
            const justCompletedABar = !block.pickupBeats && metroBlkBeatsPlayedInBlock % metroBlkBeatsPerBarFor(block) === 0;
            if (block.pickupBeats || justCompletedABar) {
                const freshLabel = metroBlkBlockLabel(block, metroBlkBeatsPlayedInBlock);
                const labelEl = document.getElementById('metroBlkRow0Label');
                if (labelEl) labelEl.innerHTML = freshLabel; // ML-130: label carries a real fermata glyph now, not plain text
                const miniLabel = document.getElementById('metroBlkMiniLabel');
                if (miniLabel) miniLabel.innerHTML = freshLabel;
            }
            // ML-130: a new bar just started - refresh which fermata glyph(s), if any, sit above this
            // bar's own dots (always none today - see buildFermataSchedule's own comment - but kept in
            // step with Flow's identical marker-refresh call for whenever that changes).
            if (justCompletedABar && !block.pickupBeats) {
                const newBarIndex = Math.floor(metroBlkBeatsPlayedInBlock / metroBlkBeatsPerBarFor(block));
                renderFermataMarkers('metroBlkRow0Dots', block, newBarIndex, subFactor);
                renderFermataMarkers('metroBlkMiniDots', block, newBarIndex, subFactor);
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
    // Now-playing row only (ML-98) - the "coming next" preview row this used to also build is gone;
    // Play Mode's active-tile highlight (renderMetroBlkActiveTileHighlight, called at the end here)
    // shows where things are in the whole sequence instead.
    function renderMetroBlkRows() {
        if (!metroBlkPlayQueue.length) return;
        const block = metroBlkEffectiveBlock(metroBlkPlayQueue[metroBlkPlayIndex], metroBlkPlayQueue);
        const subFactor = metroBlkSubFactorFor(block);
        const label = block ? metroBlkBlockLabel(block, metroBlkBeatsPlayedInBlock) : '';
        const labelEl = document.getElementById('metroBlkRow0Label');
        if (labelEl) labelEl.innerHTML = label; // ML-130: label carries a real fermata glyph now, not plain text

        // ML-95: macro beats, not the raw time-signature numerator - a 9/8 block lays out 3 big-dot
        // groups (each subFactor clicks wide when subdividing), not 9.
        const beatsPerBar = block ? metroBlkBeatsPerBarFor(block) : 4;
        const totalBaseClicks = beatsPerBar * subFactor;
        // The row's line extends one slot past the last dot (connectMetroBlkDotsWithTrack) -
        // laying the dots out over totalBaseClicks+1 slots, not totalBaseClicks, reserves room for
        // that extension so the dots-plus-line group centers as a whole instead of the dots alone
        // centering and the line poking out past the row's right edge. The mini row now uses this
        // exact same "now" bar formatting (ML-94), not a simplified stand-in, so it shares the
        // same basis rather than its own separate one.
        const trackLeftPct = metroBlkLeftPctFn(totalBaseClicks + 1);
        const endLeftStyle = metroLeftStyle(trackLeftPct(totalBaseClicks));
        buildMetroDotRow('metroBlkRow0Dots', totalBaseClicks, subFactor, false, trackLeftPct);
        metroApplyDisplayWidth('metroBlkRow0Viewport', 'metroBlkRow0Content', totalBaseClicks + 1);
        connectMetroBlkDotsWithTrack('metroBlkRow0Dots', endLeftStyle);
        greyOutSkippedDots('metroBlkRow0Dots', block, subFactor);
        // ML-130: NOT always bar 0 - the window resize listener calls this from wherever playback
        // currently sits, not just on a fresh block entry.
        const fermataBarIndex = metroBlkCurrentBarIndex(block, metroBlkBeatsPlayedInBlock);
        renderFermataMarkers('metroBlkRow0Dots', block, fermataBarIndex, subFactor);
        if (!metroBlkPlayer.isPlaying()) resetMetroScrollPosition('metroBlkRow0Content');
        // Requires isPlaying(): sitting on a not-yet-started lead-in (paused, or never played this
        // session) isn't "during the quiet space" in any meaningful sense yet, so it shouldn't
        // pre-emptively grey out before there's actually a gap counting down.
        const inQuietGap = metroBlkQuietGapActive && metroBlkPlayer.isPlaying() && block && block.isLeadIn;
        document.getElementById('metroBlkRow0Content')?.classList.toggle('metroBlk-quiet-gap', inQuietGap);

        buildMetroDotRow('metroBlkMiniDots', totalBaseClicks, subFactor, false, trackLeftPct);
        metroApplyDisplayWidth('metroBlkMiniViewport', 'metroBlkMiniContent', totalBaseClicks + 1);
        connectMetroBlkDotsWithTrack('metroBlkMiniDots', endLeftStyle);
        greyOutSkippedDots('metroBlkMiniDots', block, subFactor);
        renderFermataMarkers('metroBlkMiniDots', block, fermataBarIndex, subFactor);
        if (!metroBlkPlayer.isPlaying()) resetMetroScrollPosition('metroBlkMiniContent');
        document.getElementById('metroBlkMiniContent')?.classList.toggle('metroBlk-quiet-gap', inQuietGap);
        const miniLabel = document.getElementById('metroBlkMiniLabel');
        if (miniLabel) miniLabel.innerHTML = label || '-'; // ML-130: label carries a real fermata glyph now, not plain text

        renderMetroBlkActiveTileHighlight();
        // Keeps the collapsed sub-beats button live (ML-95) - Auto's decision depends on this
        // specific block's own bpm/meter and the current play speed, both of which can change
        // without the sub-beats popup itself ever being touched.
        renderMetroBlkSubdivideLabels();
    }

    // Play Mode's visual replacement for the old "coming next" row (ML-98): whichever block is
    // actually sounding right now gets .metroBlk-tile-active (bold gold border). Cheap - no
    // innerHTML rebuild, just toggles a class on whichever [data-id] already matches - so it can run
    // on every beat/advance, not just on a full renderMetroBlockTiles. Skipped entirely while editing,
    // since nothing is "playing" in any meaningful sense then.
    function renderMetroBlkActiveTileHighlight() {
        if (metroBlkEditMode) return;
        const activeId = metroBlkPlayQueue[metroBlkPlayIndex]?.id;
        document.querySelectorAll('#metroBlockTiles [data-id], #metroBlkLeadInSlot [data-id]').forEach(el => {
            el.classList.toggle('metroBlk-tile-active', activeId !== undefined && el.dataset.id === String(activeId));
        });
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

    // Close (ML-87): pauses if playing (which by itself drops the mini bar the moment isPlaying()
    // is next checked) - the only way to dismiss it from another screen immediately, rather than
    // waiting for the next navigation to notice it's no longer playing. Position is left exactly
    // where it was (same as a plain pause) rather than reset to the start - Reset already owns that.
    function closeMetroBlkMiniBar() {
        if (metroBlkPlayer.isPlaying()) metroBlkPlayer.pause();
        updateMetroBlkPlayIcon();
        updateMetroBlocksMiniBarVisibility(viewStack[viewStack.length - 1]);
    }

    // Jumps back to the first block WITHOUT stopping - if it's currently playing it just keeps
    // playing from the top; if paused, it stays paused sitting at the top. Pause is what actually
    // silences it now; this button is purely about position.
    function resetMetroBlk() {
        refreshMetroBlkQueueIfStale();
        metroBlkRepeatCounts = {};
        jumpMetroBlkToStart();
        renderMetroBlkRows();
    }

    // ML-139: press-and-hold on Play still works as a shortcut (setupPlayButtonHoldReset - its own
    // e.preventDefault() on pointerdown plus the button's user-select:none, see style.css, is what
    // actually stops the hold from just selecting the label text), but it's no longer the only way to
    // reset - a plain, always-visible Reset button sits to its right in the grid now too. The button's
    // own `disabled` while editing (renderMetroBlkEditUI, ML-97 follow-up) already blocks both during
    // Edit Mode, so neither callback needs its own edit-mode guard.
    setupPlayButtonHoldReset('metroBlkPlayBtn',
        () => { if (metroBlkPlayer.isPlaying()) pauseMetroBlk(); else playMetroBlk(); },
        resetMetroBlk
    );
    document.getElementById('metroBlkResetBtn')?.addEventListener('click', resetMetroBlk);
    document.getElementById('metroBlkMiniPlayBtn')?.addEventListener('click', () => {
        if (metroBlkPlayer.isPlaying()) pauseMetroBlk(); else playMetroBlk();
    });
    document.getElementById('metroBlkMiniResetBtn')?.addEventListener('click', resetMetroBlk);
    // Jumps back to the full builder screen to adjust the block setup itself (ML-94) - the mini bar
    // only ever mirrors playback, it was never meant to be where blocks get edited.
    document.getElementById('metroBlkMiniSettingsBtn')?.addEventListener('click', () => switchView('metroBuilderView'));
    document.getElementById('metroBlkMiniCloseBtn')?.addEventListener('click', closeMetroBlkMiniBar);

    // ML-146: Volume lives as a plain icon in the "now playing" box's own header now (superseding
    // ML-139's 3-dot menu approach) - same spot/shape as Quick Play's own qpVolumeBtn.
    document.getElementById('metroBlkVolumeBtn')?.addEventListener('click', openMetroBlkVolumePopup);

    // --- Playback speed popup (ML-91 follow-up: was -/+ steppers sat next to a bare "100%" readout;
    // a slider replacement lost that quick repeatable jump, and a typed exact value doesn't matter
    // when only round preset percentages are ever useful in practice - now a button grid of presets,
    // same immediate-apply-and-close pattern as the time-signature/instrument pickers, independent of
    // any block's own bpm since the player applies this percentage on top of whatever bpm is loaded,
    // same mechanism as the single-bar tool. ML-109: the preset list itself is admin-managed
    // (loadMetroBlkPlaybackSpeeds) rather than a fixed 30-150 hardcoded set, so the only remaining
    // clamp here is a basic sanity bound, not a business-logic range. ---
    let metroBlkSpeedPercent = 100;

    function renderMetroBlkSpeedLabels() {
        document.getElementById('metroBlkSpeedLbl').innerText = `${metroBlkSpeedPercent}%`;
        document.getElementById('metroBlkMiniSpeedLbl').innerText = `${metroBlkSpeedPercent}%`;
    }
    function setMetroBlkSpeedPercent(p) {
        metroBlkSpeedPercent = Math.min(1000, Math.max(1, p));
        metroBlkPlayer.setSpeedPercent(metroBlkSpeedPercent);
        renderMetroBlkSpeedLabels();
        // ML-95 Auto mode depends on effective bpm (Target BPM * Play Speed%) - a speed change alone,
        // even while paused, can cross the threshold and needs to re-derive/re-render immediately
        // rather than waiting for the next click or an unrelated re-render to notice.
        const block = metroBlkSubdivideCurrentBlock();
        if (block) applyMetroBlkToPlayer(block);
        renderMetroBlkRows();
    }

    // Populates the popup's button grid from the admin-managed list (ML-109) - called whenever the
    // Blocks builder view opens, same as loadMetroBlkTimeSignatures, so the buttons are already there
    // by the time the user actually taps the Play speed control.
    async function loadMetroBlkPlaybackSpeeds() {
        try {
            const speeds = await API.metronomeBlocks.playbackSpeeds.list();
            const container = document.getElementById('metroBlkSpeedOptions');
            if (container) {
                container.innerHTML = speeds.map(p => `<button type="button" class="metroBlk-timesig-opt" data-value="${p}">${p}%</button>`).join('');
            }
            renderMetroBlkSpeedOptions();
        } catch (error) {
            showWarningToast('Error loading playback speeds: ' + error.message);
        }
    }

    function renderMetroBlkSpeedOptions() {
        document.querySelectorAll('#metroBlkSpeedOptions .metroBlk-timesig-opt').forEach(btn => {
            btn.classList.toggle('selected', Number(btn.dataset.value) === metroBlkSpeedPercent);
        });
    }
    function openMetroBlkSpeedPopup() {
        renderMetroBlkSpeedOptions();
        document.getElementById('metroBlkSpeedModal').style.display = 'flex';
    }
    document.getElementById('metroBlkSpeedBtn')?.addEventListener('click', openMetroBlkSpeedPopup);
    document.getElementById('metroBlkMiniSpeedBtn')?.addEventListener('click', openMetroBlkSpeedPopup);
    document.getElementById('metroBlkSpeedOptions')?.addEventListener('click', (e) => {
        const btn = e.target.closest('.metroBlk-timesig-opt');
        if (!btn) return;
        setMetroBlkSpeedPercent(Number(btn.dataset.value));
        document.getElementById('metroBlkSpeedModal').style.display = 'none';
    });
    renderMetroBlkSpeedLabels();

    // --- Volume (ML-102, reworked ML-148) - mirrors Quick Play's own qpVolume/setQpVolume below, own
    // in-memory-only state, not persisted (only headphone delay persists to localStorage). Mute isn't
    // a separate engine-level flag any more (ML-148) - it's just volume 0, with
    // metroBlkVolumeBeforeMute remembering the last non-zero value so unmuting (or dragging back up)
    // restores exactly where it was. ---
    let metroBlkVolume = 80;
    let metroBlkVolumeBeforeMute = 80;

    function renderMetroBlkVolumeSlider() {
        const fill = document.getElementById('metroBlkVolumeFill');
        const thumb = document.getElementById('metroBlkVolumeThumb');
        if (!fill || !thumb) return;
        fill.style.width = `${metroBlkVolume}%`;
        thumb.style.left = `${metroBlkVolume}%`;
        thumb.setAttribute('aria-valuenow', metroBlkVolume);
        const valueEl = document.getElementById('metroBlkVolumeValue');
        if (valueEl) valueEl.innerText = `${metroBlkVolume}%`;
        const muted = metroBlkVolume === 0;
        document.getElementById('metroBlkMuteIcon').innerText = muted ? 'volume_off' : 'volume_up';
        document.getElementById('metroBlkMuteBtn')?.setAttribute('aria-pressed', String(muted));
        document.getElementById('metroBlkVolumeRow')?.classList.toggle('is-muted', muted);
    }
    // `force` (ML-148) bypasses the test-click throttle - see playVolumeTestClick - for the specific
    // gestures that must always produce a confirmation click (release, +/- tap, typed-number commit,
    // mute toggle), as opposed to the continuous stream of calls a live drag makes.
    function setMetroBlkVolume(v, force = false) {
        metroBlkVolume = Math.round(Math.min(100, Math.max(0, v)));
        if (metroBlkVolume > 0) metroBlkVolumeBeforeMute = metroBlkVolume;
        metroBlkPlayer.setVolume(metroBlkVolume / 100);
        renderMetroBlkVolumeSlider();
        playVolumeTestClick(metroBlkPlayer, force);
    }
    setupSliderInteraction(document.getElementById('metroBlkVolumeTrack'), document.getElementById('metroBlkVolumeThumb'), {
        onDragRatio: (ratio) => setMetroBlkVolume(ratio * 100),
        onArrowStep: (dir) => setMetroBlkVolume(metroBlkVolume + dir * 5),
        onRelease: () => playVolumeTestClick(metroBlkPlayer, true)
    });
    setupHoldStepper('metroBlkVolumeMinus', -1, (amount) => setMetroBlkVolume(metroBlkVolume + amount, true));
    setupHoldStepper('metroBlkVolumePlus', 1, (amount) => setMetroBlkVolume(metroBlkVolume + amount, true));
    makeSliderReadoutEditable('metroBlkVolumeValue', () => metroBlkVolume, (v) => setMetroBlkVolume(v, true), { label: 'Volume', min: 0, max: 100 });
    document.getElementById('metroBlkMuteBtn')?.addEventListener('click', () => {
        setMetroBlkVolume(metroBlkVolume > 0 ? 0 : (metroBlkVolumeBeforeMute || 80), true);
    });
    renderMetroBlkVolumeSlider();

    // --- Headphone calibration (ML-102) - a fixed 4-beat, 100 bpm, no-subdivide test loop on its own
    // dedicated player (metroBlkCalibPlayerRef, set up above near metroBlkPlayerRef) rather than
    // borrowing metroBlkPlayer, so testing the delay never disturbs whatever setup is actually loaded.
    // Shares the same latency value as everything else via setMetroLatencyMs, so dragging +/- while
    // this loop plays lets you hear/see the effect immediately.
    const metroBlkCalibPlayer = createMetronomePlayer();
    metroBlkCalibPlayerRef = metroBlkCalibPlayer;
    metroBlkCalibPlayer.setConductorBpm(100);
    metroBlkCalibPlayer.setConductorBeatsPerBar(4);
    metroBlkCalibPlayer.setNotesPerBeat(1);
    metroBlkCalibPlayer.setSubdivisionFactor(1);
    metroBlkCalibPlayer.setVisualLatencyMs(metroState.latencyMs);
    buildMetroDotRow('metroBlkCalibDots', 4, 1, false, (k) => (k / 4) * 100);
    metroBlkCalibPlayer.onBeat((beatInfo) => flashTierDot('metroBlkCalibDots', beatInfo.clickIndexInBar));

    function setMetroBlkCalibPlaying(playing) {
        const icon = document.getElementById('metroBlkCalibPlayIcon');
        if (playing) { metroBlkCalibPlayer.play(); if (icon) icon.innerText = 'pause'; }
        else { metroBlkCalibPlayer.pause(); if (icon) icon.innerText = 'play_arrow'; }
    }
    document.getElementById('metroBlkCalibPlayBtn')?.addEventListener('click', () => {
        setMetroBlkCalibPlaying(!metroBlkCalibPlayer.isPlaying());
    });
    // "Show/Hide headphone calibration" (ML-102) - collapsing it also stops the test loop, so it never
    // keeps clicking away unnoticed behind the collapsed section.
    document.getElementById('metroBlkCalibToggleBtn')?.addEventListener('click', (e) => {
        const section = document.getElementById('metroBlkCalibSection');
        if (!section) return;
        const nowHidden = section.classList.toggle('hidden-group');
        e.currentTarget.innerText = nowHidden ? 'Show headphone calibration' : 'Hide headphone calibration';
        if (nowHidden) setMetroBlkCalibPlaying(false);
    });
    document.getElementById('metroBlkCalibLatencyMinusBtn')?.addEventListener('click', () => setMetroLatencyMs(metroState.latencyMs - METRO_LATENCY_STEP));
    document.getElementById('metroBlkCalibLatencyPlusBtn')?.addEventListener('click', () => setMetroLatencyMs(metroState.latencyMs + METRO_LATENCY_STEP));
    document.getElementById('metroBlkCalibLatencyResetBtn')?.addEventListener('click', () => setMetroLatencyMs(0));

    function openMetroBlkVolumePopup() {
        renderMetroBlkVolumeSlider();
        document.getElementById('metroBlkVolumeModal').style.display = 'flex';
    }
    function closeMetroBlkVolumePopup() {
        setMetroBlkCalibPlaying(false);
        document.getElementById('metroBlkVolumeModal').style.display = 'none';
    }
    document.getElementById('metroBlkVolumeCloseBtn')?.addEventListener('click', closeMetroBlkVolumePopup);
    // ML-148: tapping the dark scrim outside the card dismisses it too - every change already
    // applies live (there's no separate "save" step), so this is purely a faster way to close.
    // e.target === e.currentTarget excludes clicks that started inside .modal-content and merely
    // bubbled up to the scrim.
    document.getElementById('metroBlkVolumeModal')?.addEventListener('click', (e) => {
        if (e.target === e.currentTarget) closeMetroBlkVolumePopup();
    });

    // Shown only when actually playing at the moment a view change happens - not a "session active"
    // flag remembered across navigations, just isPlaying() re-checked fresh on every switchView.
    function updateMetroBlocksMiniBarVisibility(viewName) {
        const bar = document.getElementById('metroBlocksMiniBar');
        if (bar) bar.classList.toggle('hidden-group', !metroBlkPlayer.isPlaying() || viewName === 'metroBuilderView');
    }

    // ========================================
    // QUICK PLAY - front page tool, replaces the old single-bar Metronome page. A simplified,
    // always-editable variant of Metronome Blocks/Flow above: no name, no lead-in, no saved-setups
    // library - every block's full detail entry is shown inline and stacked (createQuickPlayBlockEditor)
    // rather than a tile you tap to open an edit modal. Own player instance (qpPlayer) and own
    // sub-beats/play-speed/volume state, same reasoning as Blocks having its own rather than sharing
    // the old single-bar tool's - see the METRONOME ENGINE section up top for what IS shared (the
    // audio engine factory, dot/scroll helpers, slider/stepper interaction helpers). Every Play press
    // (from a stopped/reset state, not a pause resume) writes the current blocks in as one history row
    // via POST /api/metronome/quick-play - see saveQuickPlayHistory.
    // ========================================
    const qpPlayer = createMetronomePlayer();
    qpPlayerRef = qpPlayer;
    qpPlayer.setVisualLatencyMs(metroState.latencyMs);

    // One block: { timeSigValue, bpm, noteSelected, barCount }, same shape/meaning as a Blocks segment
    // minus everything lead-in-only (isLeadIn/pickupBeats/repeatLeadIn/quietSecondsBeforeLeadIn don't
    // exist here - Quick Play has no lead-in concept at all).
    let qpBlocks = [];
    // Resets to false on any edit (add/remove/change a block) or Reset - Play only writes history the
    // moment it actually (re)starts playback from a stopped state, not on every pause/resume toggle.
    let qpSavedThisRun = false;

    // Specifically 4/4 (the metronome's own stated default), not just whichever public signature
    // happens to sort first in the catalog - falls back to that only if 4/4 is somehow missing.
    function qpDefaultTimeSigValue() {
        const list = metroBlkTimeSigCache?.public || [];
        const fourFour = list.find(t => t.numerator === 4 && t.denominator === 4);
        const fallback = fourFour || list[0];
        return fallback ? `public:${fallback.id}` : null;
    }

    // Every block gets a stable id of its own, separate from its position in qpBlocks - add/move/
    // duplicate/delete all rebuild the DOM from scratch (renderQuickPlayBlocks), so the only way to
    // tell "this is the same bar, just somewhere else now" from "a different bar is now at this
    // index" for the FLIP animations below is to match on this rather than array index.
    let qpUidCounter = 0;
    function qpNewBlock(overrides = {}) {
        return { _uid: ++qpUidCounter, timeSigValue: qpDefaultTimeSigValue(), bpm: 100, noteSelected: 'crotchet', barCount: 1, ...overrides };
    }

    // The builder's landing state - seeded once per page load (not per visit), same spirit as Blocks'
    // scratch setup always having at least one block so the tool is immediately playable. Unlike
    // Blocks, nothing is persisted server-side until Play is actually pressed, so there's no server
    // round-trip needed just to open the page.
    function initQuickPlayBlocksIfNeeded() {
        if (qpBlocks.length) return;
        qpBlocks = [qpNewBlock()];
        renderQuickPlayBlocks();
        jumpQpToIndex(0);
    }

    function qpMarkUnsaved() {
        qpSavedThisRun = false;
        // ML-34 follow-up: every edit call site already routes through here, so this is the one place
        // that needs to know "something changed since Load" - flips on the "- edited" tag/undo icon
        // next to the loaded name. Guarded so it doesn't needlessly re-render on every single edit
        // once it's already showing.
        if (qpLoadedHistoryId !== null && !qpLoadedHistoryEdited) {
            qpLoadedHistoryEdited = true;
            renderQpLoadedHistoryLabel();
        }
    }

    // --- Per-block inline editor (time signature / note+BPM stepper+slider / bar-count stepper+slider) ---
    // Originally reused the Blocks segment-edit modal's own field markup; ML-103 later went the other
    // way and restyled that modal's own Standard fields (public/index.html's #metroSegStandardBox) to
    // match THIS card's qp-bar-fields-grid/qp-timesig-cell/qp-notelen-cell/qp-bpm-cell layout instead,
    // since it reads more cleanly - the two still don't share DOM/state (see below), just the same
    // classes now. Built fresh per block instance rather than a singleton modal's own DOM/state
    // (metroSegBpm etc.) - several of these are visible on screen at once, which that modal was never
    // designed for. Reuses the genuinely value-agnostic pieces directly: METRO_SLIDER_TIERS/
    // metroBestFitTier/METRO_MIN_BPM/METRO_MAX_BPM, setupSliderInteraction (already takes elements, not
    // ids), setupHoldStepper/makeSliderReadoutEditable (generalised below to take an element OR an id),
    // metroNoteIconSvg/METRO_NOTE_TYPES/metroSegDefaultNoteForDenominator, and metroBlkTimeSigCache for
    // the shared time-signature modal.
    function qpBlockNoteFraction(noteKey) {
        const t = METRO_NOTE_TYPES.find(x => x.key === noteKey);
        return t ? t.fraction : 0.25;
    }
    // Resolves a block's own numerator/denominator from whichever catalog its timeSigValue points
    // into - same lookup shape as metroSegSelectedDenominator/metroSegTimeSigLabelFor, just against
    // this block's own stored value instead of the segment modal's single in-flight one.
    function qpBlockTimeSig(block) {
        if (!block.timeSigValue) return { numerator: 4, denominator: 4 };
        const [sigType, sigId] = block.timeSigValue.split(':');
        const list = sigType === 'public' ? metroBlkTimeSigCache.public : metroBlkTimeSigCache.custom;
        const found = list.find(t => t.id === Number(sigId));
        return found ? { numerator: found.numerator, denominator: found.denominator } : { numerator: 4, denominator: 4 };
    }
    function qpBlockDenominator(block) { return qpBlockTimeSig(block).denominator; }
    function qpBlockTimeSigLabel(block) { return metroSegTimeSigLabelFor(block.timeSigValue) || 'Choose…'; }

    // Always exactly 1 bar per block, no repeat - that's a Flow-only concept (its own bar-count
    // stepper/slider). Title is computed from position ("Bar N"), not stored, so move/duplicate/
    // delete never need to renumber anything - the next render just reads it off the new index.
    // ML-145: the outer .qp-block-box is just a clipping wrapper now (see the matching style.css
    // comment) - the delete underlay sits behind, the actual card content lives in .qp-block-surface,
    // which is what wireQpBarSwipe slides. The grab handle only renders once there's more than one bar
    // to reorder (matches the 3-dot menu's own Move up/down, which hide for the same reason).
    function qpBlockBoxHtml(block, index) {
        const grabHandle = qpBlocks.length > 1
            ? `<button type="button" class="qp-bar-grab-handle" data-qp-grab-handle aria-label="Drag to reorder Bar ${index + 1}"><span class="material-symbols-outlined">drag_indicator</span></button>`
            : '';
        // ML-80: Bar 1 is the only bar that can never actually be deleted on its own (qpDeleteBar
        // no-ops once qpBlocks.length <= 1) - swiping it used to reveal a Delete button that did
        // nothing when tapped. In that exact state, the underlay becomes "Reset" (qpResetAllBars)
        // instead, so the gesture has a real effect; with more than one bar, Bar 1 deletes normally.
        const isDeadEndDelete = index === 0 && qpBlocks.length <= 1;
        const deleteUnderlay = isDeadEndDelete
            ? `<div class="qp-block-delete-underlay" data-qp-reset-all-btn aria-label="Delete all and reset">
                <span class="material-symbols-outlined">restart_alt</span>
                <span>Reset</span>
            </div>`
            : `<div class="qp-block-delete-underlay" data-qp-delete-btn aria-label="Delete Bar ${index + 1}">
                <span class="material-symbols-outlined">delete</span>
                <span>Delete</span>
            </div>`;
        return `<div class="qp-block-box" data-qp-block-index="${index}" data-qp-uid="${block._uid}">
            ${deleteUnderlay}
            <div class="qp-block-surface">
                <div class="qp-block-header">
                    <div class="qp-block-header-left">
                        ${grabHandle}
                        <span class="qp-block-title">Bar ${index + 1}</span>
                    </div>
                    <button type="button" class="qp-bar-menu-btn" data-qp-menu-btn aria-label="Bar ${index + 1} options"><span class="material-symbols-outlined">more_vert</span></button>
                </div>
                <div class="qp-bar-fields-grid">
                    <button type="button" class="metroBlk-ctrl-value-btn qp-timesig-cell" data-qp-timesig-btn aria-label="Time signature - tap to change">
                        <strong>${escapeHtml(qpBlockTimeSigLabel(block))}</strong>
                        <span class="metroBlk-ctrl-value-label">time</span>
                    </button>
                    <button type="button" class="metroBlk-ctrl-value-btn qp-notelen-cell" data-qp-note-btn aria-label="Beat note - tap to change">
                        <span class="qp-note-btn-icon">${metroNoteIconSvg(block.noteSelected)}</span>
                        <span class="metroBlk-ctrl-value-label">beat note</span>
                    </button>
                    <div class="metroBlk-bpm-box qp-bpm-cell">
                        <div class="metro-speed-row no-margin qp-bpm-speed-row">
                            <button class="metro-bpm-step" type="button" data-qp-bpm-minus aria-label="Decrease beats per minute">&minus;</button>
                            <div class="metro-speed-readout">
                                <div data-qp-bpm-value>120</div>
                                <div class="metro-speed-sub">bpm</div>
                            </div>
                            <button class="metro-bpm-step" type="button" data-qp-bpm-plus aria-label="Increase beats per minute">+</button>
                        </div>
                        <div class="slider-wrap no-margin">
                            <div class="slider-track" data-qp-bpm-slider-track>
                                <div class="slider-fill" data-qp-bpm-slider-fill></div>
                                <div class="slider-thumb" data-qp-bpm-slider-thumb tabindex="0" role="slider" aria-label="Beats per minute" aria-valuemin="${METRO_MIN_BPM}" aria-valuenow="120"></div>
                            </div>
                            <div class="slider-scale"><span>${METRO_MIN_BPM}</span><span data-qp-bpm-slider-max-lbl>200</span></div>
                        </div>
                    </div>
                </div>
            </div>
        </div>`;
    }

    // Wires one block box's interactive controls, reading/writing straight into qpBlocks[index] -
    // called once per box right after it's inserted into the DOM (renderQuickPlayBlocks).
    function wireQpBlockBox(boxEl, index) {
        const block = qpBlocks[index];
        let bpmSliderMax = metroBestFitTier(Math.round(block.bpm / (qpBlockNoteFraction(block.noteSelected) * qpBlockDenominator(block))));

        const bpmValueEl = boxEl.querySelector('[data-qp-bpm-value]');
        const bpmTrack = boxEl.querySelector('[data-qp-bpm-slider-track]');
        const bpmFill = boxEl.querySelector('[data-qp-bpm-slider-fill]');
        const bpmThumb = boxEl.querySelector('[data-qp-bpm-slider-thumb]');
        const bpmMaxLbl = boxEl.querySelector('[data-qp-bpm-slider-max-lbl]');

        function displayedBpm() {
            return qpBlocks[index].bpm / (qpBlockNoteFraction(qpBlocks[index].noteSelected) * qpBlockDenominator(qpBlocks[index]));
        }
        function renderBpmSlider() {
            const displayed = Math.round(displayedBpm());
            const pct = ((displayed - METRO_MIN_BPM) / (bpmSliderMax - METRO_MIN_BPM)) * 100;
            bpmFill.style.width = `${pct}%`;
            bpmThumb.style.left = `${pct}%`;
            bpmThumb.setAttribute('aria-valuenow', displayed);
            bpmThumb.setAttribute('aria-valuemax', bpmSliderMax);
            bpmMaxLbl.innerText = bpmSliderMax;
            bpmValueEl.innerText = displayed;
        }
        function refreshBpmDisplay() {
            bpmSliderMax = metroBestFitTier(Math.round(displayedBpm()));
            renderBpmSlider();
        }
        // Holding the thumb at the track's edge keeps re-evaluating this on every pointermove even
        // without the pointer actually moving further - ratio stays ~1 (or ~0) but bpmSliderMax has
        // just grown (or shrunk), so the very next event re-hits the same edge-of-tier check against
        // the new tier and expands again, cascading straight through every tier in one continuous
        // hold instead of needing a further drag per tier. A short cooldown after each tier change
        // forces a beat between expansions so 350 is actually reachable/visible before 500 can happen.
        let bpmTierChangeCooldownUntil = 0;
        function bpmStepTier(value) {
            const now = Date.now();
            if (now < bpmTierChangeCooldownUntil) return;
            const idx = METRO_SLIDER_TIERS.indexOf(bpmSliderMax);
            if (idx < METRO_SLIDER_TIERS.length - 1 && value >= METRO_SLIDER_TIERS[idx]) {
                bpmSliderMax = METRO_SLIDER_TIERS[idx + 1];
                bpmTierChangeCooldownUntil = now + 350;
            } else if (idx > 0 && value < METRO_SLIDER_TIERS[idx - 1]) {
                bpmSliderMax = METRO_SLIDER_TIERS[idx - 1];
                bpmTierChangeCooldownUntil = now + 350;
            }
        }
        function setBpmFromDisplayed(displayedValue, opts = {}) {
            const clamped = Math.round(Math.min(METRO_MAX_BPM, Math.max(METRO_MIN_BPM, displayedValue)));
            if (opts.dragging) bpmStepTier(clamped); else bpmSliderMax = metroBestFitTier(clamped);
            qpBlocks[index].bpm = Math.round(clamped * qpBlockNoteFraction(qpBlocks[index].noteSelected) * qpBlockDenominator(qpBlocks[index]));
            renderBpmSlider();
            qpMarkUnsaved();
            renderQuickPlayRows();
        }

        setupHoldStepper(boxEl.querySelector('[data-qp-bpm-minus]'), -1, (amount) => setBpmFromDisplayed(Math.round(displayedBpm()) + amount));
        setupHoldStepper(boxEl.querySelector('[data-qp-bpm-plus]'), 1, (amount) => setBpmFromDisplayed(Math.round(displayedBpm()) + amount));
        setupSliderInteraction(bpmTrack, bpmThumb, {
            onDragRatio: (ratio) => setBpmFromDisplayed(METRO_MIN_BPM + ratio * (bpmSliderMax - METRO_MIN_BPM), { dragging: true }),
            onArrowStep: (dir) => setBpmFromDisplayed(Math.round(displayedBpm()) + dir, { dragging: true })
        });
        makeSliderReadoutEditable(bpmValueEl, () => Math.round(displayedBpm()), (v) => setBpmFromDisplayed(v), { label: 'Beats per minute', min: METRO_MIN_BPM, max: METRO_MAX_BPM });

        // The note button's icon lives in its own inner span (not the button's whole innerHTML) so
        // qpOpenNotePicker's anchor swap only replaces the glyph, leaving the "note length" label
        // below it untouched.
        boxEl.querySelector('[data-qp-note-btn]')?.addEventListener('click', (e) => {
            const iconEl = e.currentTarget.querySelector('.qp-note-btn-icon');
            qpOpenNotePicker(iconEl, index, () => { refreshBpmDisplay(); renderBpmSlider(); renderQuickPlayRows(); });
        });
        boxEl.querySelector('[data-qp-timesig-btn]')?.addEventListener('click', () => {
            qpOpenTimeSigPicker(index, () => {
                boxEl.querySelector('[data-qp-timesig-btn] strong').innerText = qpBlockTimeSigLabel(qpBlocks[index]);
                refreshBpmDisplay();
                renderBpmSlider();
                renderQuickPlayRows();
            });
        });
        boxEl.querySelector('[data-qp-menu-btn]')?.addEventListener('click', (e) => {
            e.stopPropagation();
            openQpBarMenu(e.currentTarget, index);
        });
        wireQpBarGrabHandle(boxEl.querySelector('[data-qp-grab-handle]'), boxEl, index);
        wireQpBarSwipe(boxEl, index);

        renderBpmSlider();
    }

    // Shared note-value picker modal (#metroSegNoteModal) - same reasoning as the time-signature modal
    // below: one popup, only ever open for one block at a time, so it's fine to reuse directly rather
    // than duplicate. onPicked runs after qpBlocks[index].noteSelected is updated, so the caller can
    // refresh its own displayed "note = bpm" readout.
    function qpOpenNotePicker(anchorBtn, index, onPicked) {
        const el = document.getElementById('metroSegNotePicker');
        if (!el) return;
        el.innerHTML = METRO_NOTE_TYPES.map(t => `
            <button type="button" class="metroBlk-note-btn${t.key === qpBlocks[index].noteSelected ? ' selected' : ''}" data-note="${t.key}" aria-label="${t.label}" aria-pressed="${t.key === qpBlocks[index].noteSelected}">
                ${metroNoteIconSvg(t.key)}
            </button>
        `).join('');
        el.querySelectorAll('.metroBlk-note-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                qpBlocks[index].noteSelected = btn.dataset.note;
                anchorBtn.innerHTML = metroNoteIconSvg(btn.dataset.note);
                document.getElementById('metroSegNoteModal').style.display = 'none';
                qpMarkUnsaved();
                onPicked();
            }, { once: true });
        });
        document.getElementById('metroSegNoteModal').style.display = 'flex';
    }

    // Shared time-signature modal (#metroSegTimeSigModal) - see metroSegTimeSigOnSelect above for how
    // one modal serves both Blocks' segment editor and this.
    function qpOpenTimeSigPicker(index, onPicked) {
        metroSegTimeSigValue = qpBlocks[index].timeSigValue;
        metroSegTimeSigOnSelect = (value) => {
            qpBlocks[index].timeSigValue = value;
            qpMarkUnsaved();
            onPicked();
        };
        renderMetroSegTimeSigPicker();
        document.getElementById('metroSegTimeSigModal').style.display = 'flex';
    }

    function renderQuickPlayBlocks() {
        const container = document.getElementById('qpBlocks');
        if (!container) return;
        qpOpenSwipeIndex = null; // a full rebuild throws every node away - any open swipe is stale
        container.innerHTML = qpBlocks.map((b, i) => qpBlockBoxHtml(b, i)).join('');
        container.querySelectorAll('[data-qp-block-index]').forEach(boxEl => {
            wireQpBlockBox(boxEl, Number(boxEl.dataset.qpBlockIndex));
        });
    }

    // Generic grab-handle-driven vertical reorder gesture, shared by Quick Play's own bar boxes
    // (wireQpBarGrabHandle) and Flow's block cards (wireFlowBlockGrabHandle). Picking up the handle
    // live-follows the pointer with a translateY on the whole box, and gives the card (surfaceSelector,
    // a child of boxEl) a gold, thicker border (.drag-reorder-highlight) for the duration - clear
    // "this is the one moving" feedback the whole gesture through. Releasing past the threshold
    // deliberately leaves both the transform and the highlight in place (NOT reset here) and calls
    // onMoveUp/onMoveDown - whichever animated swap that triggers (qpSwapBarPositions/
    // flowSwapBlockPositions, both built on animateFlipReorder below) captures the box's current,
    // already-dragged position as its FLIP "before" state (so the box continues smoothly on to its new
    // slot instead of snapping back to its original position first - the bug this replaced) and
    // re-applies the highlight to the freshly re-rendered element until the settle animation actually
    // finishes, so the border reads as one continuous highlight across the whole gesture rather than
    // flickering off between the live-drag and settle phases. Releasing short of the threshold springs
    // back (and clears the highlight) instead, since nothing moved.
    function wireVerticalDragHandle(handleEl, boxEl, thresholdPx, onMoveUp, onMoveDown, surfaceSelector) {
        if (!handleEl) return;
        let startY = 0, dragging = false;
        function onMove(e) {
            if (!dragging) return;
            boxEl.style.transform = `translateY(${e.clientY - startY}px)`;
        }
        function onUp(e) {
            if (!dragging) return;
            dragging = false;
            document.removeEventListener('pointermove', onMove);
            document.removeEventListener('pointerup', onUp);
            const dy = e.clientY - startY;
            if (Math.abs(dy) > thresholdPx) {
                if (dy < 0) onMoveUp(); else onMoveDown();
            } else {
                boxEl.style.transition = 'transform 0.2s ease';
                boxEl.style.transform = '';
                boxEl.querySelector(surfaceSelector)?.classList.remove('drag-reorder-highlight');
            }
        }
        handleEl.addEventListener('pointerdown', (e) => {
            e.preventDefault();
            e.stopPropagation();
            boxEl.querySelector(surfaceSelector)?.classList.add('drag-reorder-highlight');
            startY = e.clientY;
            dragging = true;
            boxEl.style.transition = 'none';
            document.addEventListener('pointermove', onMove);
            document.addEventListener('pointerup', onUp);
        });
    }

    // FLIP (First-Last-Invert-Play): measures every item's current on-screen position before a
    // structural change, lets `rerender` rebuild the DOM as normal (titles/bar numbers are
    // position-derived off the underlying array, so a full rebuild is the simplest way to keep them
    // correct), then animates each surviving item from its old position to its new one. Matched by
    // `itemAttr` (e.g. `data-qp-uid`/`data-block-id`), not DOM node identity or array index - the
    // rebuild throws every node away, and index alone can't tell "this item moved" from "a different
    // item is now sitting at this index". An item with no "before" entry is brand new (add/duplicate)
    // and fades in instead of sliding, since there's no old position for it to slide from. raiseUid
    // optionally lifts one item's z-index for the duration, so on a move it visibly passes over the
    // item it's swapping with rather than both just sliding past each other flat - also re-applies the
    // gold-border drag-reorder-highlight (wireVerticalDragHandle) to that same raised element, on the
    // freshly re-rendered node, clearing it once its settle transition actually finishes - so the
    // border reads as one continuous highlight across the live-drag and settle phases rather than
    // flickering off in between. Shared by Quick Play's own bar boxes (qpAnimateBlocksChange) and
    // Flow's block cards (flowAnimateBlocksChange) - same technique, one implementation, rather than
    // two copies drifting apart.
    function animateFlipReorder({ containerId, itemAttr, mutate, rerender, raiseUid, animatingClass, surfaceSelector }) {
        const container = document.getElementById(containerId);
        const before = new Map();
        if (container) {
            container.querySelectorAll(`[${itemAttr}]`).forEach(el => {
                before.set(el.getAttribute(itemAttr), el.getBoundingClientRect());
            });
        }
        mutate();
        rerender();
        if (!container) return;
        const afterEls = [...container.querySelectorAll(`[${itemAttr}]`)];
        afterEls.forEach(el => {
            const uid = el.getAttribute(itemAttr);
            const prev = before.get(uid);
            if (raiseUid !== undefined && String(raiseUid) === uid) {
                el.style.zIndex = '2';
                el.querySelector(surfaceSelector)?.classList.add('drag-reorder-highlight');
            }
            if (prev) {
                const now = el.getBoundingClientRect();
                const dx = prev.left - now.left;
                const dy = prev.top - now.top;
                if (dx || dy) el.style.transform = `translate(${dx}px, ${dy}px)`;
            } else {
                el.style.opacity = '0';
            }
        });
        // Two nested rAFs, not one - a single frame can still coalesce with the "before" styles just
        // written above on some browsers and jump straight to the end state with no visible motion.
        // The first rAF waits for that initial (inverted) frame to actually paint; only the second
        // one swaps in the transition + real values.
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                afterEls.forEach(el => {
                    el.classList.add(animatingClass);
                    el.style.transform = '';
                    el.style.opacity = '';
                    el.addEventListener('transitionend', () => {
                        el.classList.remove(animatingClass);
                        el.style.zIndex = '';
                        el.querySelector(surfaceSelector)?.classList.remove('drag-reorder-highlight');
                    }, { once: true });
                });
            });
        });
    }
    function qpAnimateBlocksChange(mutate, { raiseUid } = {}) {
        animateFlipReorder({
            containerId: 'qpBlocks', itemAttr: 'data-qp-uid', mutate,
            rerender: renderQuickPlayBlocks, raiseUid, animatingClass: 'qp-block-animating',
            surfaceSelector: '.qp-block-surface'
        });
    }
    // data-block-id is already on every .flow-block-box (flowBlockCardHtml) for the swipe/grab-handle
    // wiring - reused here as the same stable identity FLIP needs, no extra markup required.
    function flowAnimateBlocksChange(mutate, { raiseUid } = {}) {
        animateFlipReorder({
            containerId: 'flowBlocksList', itemAttr: 'data-block-id', mutate,
            rerender: renderFlowBlocksList, raiseUid, animatingClass: 'flow-block-animating',
            surfaceSelector: '.flow-block-card'
        });
    }

    // Raw position swap (no toast, no bounds checking) - the one place the actual array mutation for
    // a move happens, so qpMoveBarUp/Down (which add the undo toast) and their own undo callbacks
    // (which must NOT show a second toast) can both go through the same animated swap.
    function qpSwapBarPositions(i, j) {
        const movedUid = qpBlocks[i]._uid;
        qpAnimateBlocksChange(() => {
            [qpBlocks[i], qpBlocks[j]] = [qpBlocks[j], qpBlocks[i]];
        }, { raiseUid: movedUid });
        qpMarkUnsaved();
        qpSyncAfterBlocksChanged();
    }

    // Menu and swipe (wireQpBarSwipe) both call these directly, so there's exactly one place each
    // action's behaviour (and its undo toast) is implemented.
    function qpMoveBarUp(index) {
        if (index <= 0) return;
        qpSwapBarPositions(index, index - 1);
        showUndoToast(`Bar ${index + 1} moved up`, () => qpSwapBarPositions(index - 1, index));
    }
    function qpMoveBarDown(index) {
        if (index >= qpBlocks.length - 1) return;
        qpSwapBarPositions(index, index + 1);
        showUndoToast(`Bar ${index + 1} moved down`, () => qpSwapBarPositions(index + 1, index));
    }

    // Exit animation (fly off to the left, the standard swipe-to-delete direction) before the actual
    // removal - qpAnimateBlocksChange then handles the remaining bars sliding up to close the gap,
    // same as any other structural change. Offers an undo toast that re-inserts the exact removed
    // block back at its original index.
    function qpDeleteBar(index) {
        if (qpBlocks.length <= 1) return;
        const container = document.getElementById('qpBlocks');
        const el = container?.querySelector(`[data-qp-block-index="${index}"]`);
        const removedBlock = qpBlocks[index];
        const barNumber = index + 1;
        const finish = () => {
            qpMarkUnsaved();
            qpAnimateBlocksChange(() => { qpBlocks.splice(index, 1); });
            qpSyncAfterBlocksChanged();
            showUndoToast(`Bar ${barNumber} deleted`, () => {
                qpMarkUnsaved();
                qpAnimateBlocksChange(() => { qpBlocks.splice(index, 0, removedBlock); });
                qpSyncAfterBlocksChanged();
            });
        };
        if (!el) { finish(); return; }
        el.classList.add('qp-block-animating');
        el.style.transform = 'translateX(-100%)';
        el.style.opacity = '0';
        el.addEventListener('transitionend', finish, { once: true });
    }

    // ML-80: "back to where you were if you first landed" - clears every bar and reduces the setup
    // back to the one default 4/4 block, same as initQuickPlayBlocksIfNeeded's own starting state.
    // Reachable from Bar 1's own 3-dot menu (always) and Bar 1's swipe-left underlay (only when it's
    // the sole remaining bar - see qpBlockBoxHtml).
    function qpResetAllBars() {
        showConfirmModal('Delete all and reset', 'Delete every bar and start again with a single default bar (4/4, 100bpm)?', () => {
            qpOpenSwipeIndex = null;
            qpLoadedHistoryId = null;
            qpLoadedHistoryName = null;
            qpLoadedHistoryEdited = false;
            qpLoadedHistorySnapshot = null;
            renderQpLoadedHistoryLabel();
            qpAnimateBlocksChange(() => { qpBlocks = [qpNewBlock()]; });
            qpMarkUnsaved();
            qpSyncAfterBlocksChanged();
        });
    }

    // ML-145: replaces the old free 2-axis drag-anywhere-on-the-box gesture, which called
    // e.preventDefault() on every pointerdown regardless of direction and so blocked native page
    // scroll from ever starting on a bar card at all. Two independent, purpose-built gestures now:
    // wireQpBarGrabHandle owns vertical reordering, scoped strictly to the small handle
    // (touch-action:none there only, see style.css); wireQpBarSwipe owns horizontal swipe-to-reveal
    // delete, and only intercepts the gesture at all once it's confirmed horizontal (see the lock
    // check below) - anything more vertical than that is left untouched so touch-action:pan-y on
    // .qp-block-box lets the browser's own scroll handle it.
    const QP_REORDER_THRESHOLD_PX = 40;
    const QP_SWIPE_LOCK_X_PX = 30;
    const QP_SWIPE_LOCK_Y_MAX_PX = 15;
    const QP_SWIPE_OPEN_PX = 96; // keep in sync with .qp-block-delete-underlay's width in style.css
    const QP_SWIPE_SNAP_THRESHOLD_PX = 48;
    const QP_SWIPE_EXCLUDE_SELECTOR = 'button, input, [role="slider"], [role="button"], .slider-track, .slider-thumb';

    // Which bar (if any) is currently swiped open, revealing its delete underlay - at most one at a
    // time, matching the ticket's "tapping outside an open card... snaps it back". Tracked by index
    // rather than a DOM reference since a re-render (renderQuickPlayBlocks) throws every node away;
    // that same re-render resets this to null (stale DOM either way).
    let qpOpenSwipeIndex = null;
    function qpSwipeSurfaceFor(index) {
        return document.querySelector(`#qpBlocks [data-qp-block-index="${index}"] .qp-block-surface`);
    }
    function qpSetSwipeOffset(index, offset, animate) {
        const surface = qpSwipeSurfaceFor(index);
        if (!surface) return;
        surface.style.transition = animate ? 'transform 0.2s ease' : 'none';
        surface.style.transform = offset ? `translateX(${offset}px)` : '';
    }
    function qpCloseOpenSwipe(animate = true) {
        if (qpOpenSwipeIndex === null) return;
        qpSetSwipeOffset(qpOpenSwipeIndex, 0, animate);
        qpOpenSwipeIndex = null;
    }
    // "Tapping anywhere outside an open card... snaps the card back" - a document-level listener
    // rather than a per-card blur/outside-click check, same pattern as closeQpBarMenu below.
    document.addEventListener('pointerdown', (e) => {
        if (qpOpenSwipeIndex === null) return;
        const openBoxEl = document.querySelector(`#qpBlocks [data-qp-block-index="${qpOpenSwipeIndex}"]`);
        if (openBoxEl && !openBoxEl.contains(e.target)) qpCloseOpenSwipe();
    });

    // Vertical reordering, scoped strictly to the grab handle (only rendered once there are 2+ bars -
    // see qpBlockBoxHtml). Single-step swap (qpMoveBarUp/Down), same as the menu's own Move up/down -
    // this refactor is about where the gesture is allowed to start, not building a full drag-to-
    // arbitrary-position sortable list. wireVerticalDragHandle (shared with Flow's own
    // wireFlowBlockGrabHandle) owns the actual gesture/animation handoff.
    function wireQpBarGrabHandle(handleEl, boxEl, index) {
        wireVerticalDragHandle(handleEl, boxEl, QP_REORDER_THRESHOLD_PX,
            () => qpMoveBarUp(index), () => qpMoveBarDown(index), '.qp-block-surface');
    }

    // Horizontal swipe-to-reveal delete. Doesn't touch anything (no transform, no preventDefault)
    // until the gesture actually locks into "this is a horizontal swipe" (>30px horizontal travel
    // while vertical travel is still <15px) - a clearly-vertical drag before that point is treated as
    // a scroll attempt and left alone entirely, letting touch-action:pan-y do its job.
    function wireQpBarSwipe(boxEl, index) {
        const surfaceEl = boxEl.querySelector('.qp-block-surface');
        let startX = 0, startY = 0, tracking = false, locked = false, abandoned = false;

        function currentBaseOffset() { return qpOpenSwipeIndex === index ? -QP_SWIPE_OPEN_PX : 0; }

        function onMove(e) {
            if (!tracking || abandoned) return;
            const dx = e.clientX - startX;
            const dy = e.clientY - startY;
            if (!locked) {
                if (Math.abs(dx) > QP_SWIPE_LOCK_X_PX && Math.abs(dy) < QP_SWIPE_LOCK_Y_MAX_PX) {
                    locked = true;
                    // Only one card open at a time - starting a fresh swipe elsewhere closes any other.
                    if (qpOpenSwipeIndex !== null && qpOpenSwipeIndex !== index) qpCloseOpenSwipe(false);
                } else if (Math.abs(dy) >= QP_SWIPE_LOCK_Y_MAX_PX) {
                    abandoned = true; // a scroll, not a swipe - stop tracking, never transform
                    return;
                } else {
                    return; // not enough travel yet either way
                }
            }
            e.preventDefault();
            const offset = Math.min(0, Math.max(-QP_SWIPE_OPEN_PX, currentBaseOffset() + dx));
            surfaceEl.style.transition = 'none';
            surfaceEl.style.transform = `translateX(${offset}px)`;
        }
        function onUp(e) {
            if (!tracking) return;
            tracking = false;
            document.removeEventListener('pointermove', onMove);
            document.removeEventListener('pointerup', onUp);
            if (!locked) return;
            const dx = e.clientX - startX;
            const finalOffset = Math.min(0, Math.max(-QP_SWIPE_OPEN_PX, currentBaseOffset() + dx));
            if (Math.abs(finalOffset) > QP_SWIPE_SNAP_THRESHOLD_PX) {
                qpSetSwipeOffset(index, -QP_SWIPE_OPEN_PX, true);
                qpOpenSwipeIndex = index;
            } else {
                qpSetSwipeOffset(index, 0, true);
                if (qpOpenSwipeIndex === index) qpOpenSwipeIndex = null;
            }
        }
        boxEl.addEventListener('pointerdown', (e) => {
            if (e.target.closest(QP_SWIPE_EXCLUDE_SELECTOR)) return;
            startX = e.clientX;
            startY = e.clientY;
            tracking = true;
            locked = false;
            abandoned = false;
            document.addEventListener('pointermove', onMove);
            document.addEventListener('pointerup', onUp);
        });
        // Tapping the revealed delete button deletes - swiping left never deletes on its own on
        // release, only opens the reveal (per the ticket: "Swiping left must not delete immediately").
        boxEl.querySelector('[data-qp-delete-btn]')?.addEventListener('click', (e) => {
            e.stopPropagation();
            qpOpenSwipeIndex = null;
            qpDeleteBar(index);
        });
        // ML-80: the dead-end-delete swap above (qpBlockBoxHtml) renders this instead of the normal
        // delete button when Bar 1 is the only bar.
        boxEl.querySelector('[data-qp-reset-all-btn]')?.addEventListener('click', (e) => {
            e.stopPropagation();
            qpOpenSwipeIndex = null;
            qpResetAllBars();
        });
    }

    document.getElementById('qpAddBlockBtn')?.addEventListener('click', () => {
        const last = qpBlocks[qpBlocks.length - 1];
        qpAnimateBlocksChange(() => {
            qpBlocks.push(last ? { ...last, _uid: ++qpUidCounter } : qpNewBlock());
        });
        // ML-154 follow-up: scrolls to the "+ Add bar" button itself, not just the new bar box above
        // it - scrolling only the box left the button that landed it there just out of view below the
        // fold, defeating the point if you wanted to add another straight after.
        document.getElementById('qpAddBlockBtn')?.scrollIntoView({ behavior: 'smooth', block: 'end' });
        qpMarkUnsaved();
        qpSyncAfterBlocksChanged();
    });

    // --- Per-bar options menu (Move up/down, Duplicate, Delete) - one shared floating menu
    // repositioned against whichever bar's 3-dot button was tapped, same pattern as Blocks' own
    // openMetroBlkTileMenu. Move up/down/Delete are hidden (not just disabled) when they don't apply -
    // with only one bar, index 0 is simultaneously "first" and "last" and the list "can't shrink
    // further", so all three hide on their own and only Duplicate is left, matching the request
    // exactly without a separate one-bar special case. ---
    let qpBarMenuTargetIndex = null;

    window.openQpBarMenu = function(btnEl, index) {
        const menu = document.getElementById('qpBarMenu');
        if (!menu) return;
        closeAllMetroPopupMenus();
        qpBarMenuTargetIndex = index;
        const total = qpBlocks.length;
        document.getElementById('qpBarMenuMoveUp')?.classList.toggle('hidden-group', index === 0);
        document.getElementById('qpBarMenuMoveDown')?.classList.toggle('hidden-group', index === total - 1);
        document.getElementById('qpBarMenuDelete')?.classList.toggle('hidden-group', total <= 1);
        // ML-80: only ever offered from Bar 1's own menu, regardless of how many bars exist.
        document.getElementById('qpBarMenuResetAll')?.classList.toggle('hidden-group', index !== 0);

        const btnRect = btnEl.getBoundingClientRect();
        menu.style.right = 'auto';
        menu.classList.add('show');
        const menuWidth = menu.offsetWidth;
        const menuHeight = menu.offsetHeight;
        let left = btnRect.right - menuWidth;
        left = Math.max(8, Math.min(left, window.innerWidth - menuWidth - 8));
        let top = btnRect.bottom + 4;
        top = Math.min(top, window.innerHeight - menuHeight - 8);
        menu.style.left = `${left}px`;
        menu.style.top = `${top}px`;
    };
    function closeQpBarMenu() {
        document.getElementById('qpBarMenu')?.classList.remove('show');
    }
    document.addEventListener('click', closeQpBarMenu);

    document.getElementById('qpBarMenuMoveUp')?.addEventListener('click', (e) => {
        e.stopPropagation();
        const i = qpBarMenuTargetIndex;
        closeQpBarMenu();
        if (i !== null) qpMoveBarUp(i);
    });
    document.getElementById('qpBarMenuMoveDown')?.addEventListener('click', (e) => {
        e.stopPropagation();
        const i = qpBarMenuTargetIndex;
        closeQpBarMenu();
        if (i !== null) qpMoveBarDown(i);
    });
    // Puts an exact copy at the END of the list, not right after the source (per the request) -
    // regardless of where the source bar sits.
    document.getElementById('qpBarMenuDuplicate')?.addEventListener('click', (e) => {
        e.stopPropagation();
        const i = qpBarMenuTargetIndex;
        closeQpBarMenu();
        const source = i === null ? null : qpBlocks[i];
        if (!source) return;
        qpAnimateBlocksChange(() => {
            qpBlocks.push({ ...source, _uid: ++qpUidCounter });
        });
        qpMarkUnsaved();
        qpSyncAfterBlocksChanged();
    });
    document.getElementById('qpBarMenuDelete')?.addEventListener('click', (e) => {
        e.stopPropagation();
        const i = qpBarMenuTargetIndex;
        closeQpBarMenu();
        if (i !== null) qpDeleteBar(i);
    });
    document.getElementById('qpBarMenuResetAll')?.addEventListener('click', (e) => {
        e.stopPropagation();
        closeQpBarMenu();
        qpResetAllBars();
    });

    // --- Playback (mirrors Blocks' jumpMetroBlkToIndex/advanceMetroBlk - simpler here since there's
    // no lead-in to special-case, and no separate play-queue array either: qpBlocks IS the queue,
    // read live, so an edit to a block's fields (bpm/time signature/bar count) is reflected
    // immediately without any separate "rebuild the queue" step - see qpSyncAfterBlocksChanged for
    // the one thing that DOES need explicit handling: keeping qpPlayIndex in range after an add/
    // delete changes how many blocks there are.) ---
    let qpPlayIndex = 0;
    let qpClicksPlayedInBlock = 0;

    // Reuses Blocks' own meter table (metroBlkMeterInfo/METRO_BLK_METER_TABLE) rather than
    // reinventing it - it's already generic over any { numerator, denominator }, not tied to
    // metroBlkCurrentSetup's own segment shape.
    function qpMeterInfo(block) {
        return metroBlkMeterInfo({ ...qpBlockTimeSig(block), isLeadIn: false });
    }
    function qpBeatsPerBarFor(block) {
        return qpMeterInfo(block).macroBeatsPerBar;
    }
    // Sub-beats mode is a playback-only overlay, same idea as Blocks' own metroBlkSubBeatsMode/
    // metroBlkSubdivideOverride - one setting applies across the whole sequence, not stored per block.
    let qpSubBeatsMode = 'off';
    let qpSubdivideOverride = null;
    function qpSubFactorFor(block) {
        if (!block || qpSubBeatsMode === 'off') return 1;
        if (qpSubBeatsMode === 'fixed' && qpSubdivideOverride) return qpSubdivideOverride;
        return qpMeterInfo(block).subdivisionFactor;
    }

    // "Bar X of Y" here means which bar in the whole list is current (qpPlayIndex/qpBlocks.length) -
    // not a within-block repeat count like Blocks' own "x of y bars" (every Quick Play bar is always
    // exactly 1 bar, no repeat, so that reading was always trivially "1 of 1" and never actually told
    // you anything). Word-first ("Bar 1 of 4") rather than number-first ("1 of 4 bar") to match the
    // block boxes' own "Bar N" heading - if Flow ever wants an equivalent for its own setups, "Block X
    // of Y" would sit alongside this same way.
    // ML-172: bar identification leads now - knowing "which bar am I on" matters more at a glance
    // than the time signature/tempo that follow it.
    function qpBlockLabel(block) {
        return `Bar ${qpPlayIndex + 1} of ${qpBlocks.length} · ${qpBlockTimeSigLabel(block)} · ${block.bpm} bpm`;
    }

    function applyQpBlockToPlayer(block) {
        qpPlayer.setConductorBpm(block.bpm);
        qpPlayer.setConductorBeatsPerBar(qpBeatsPerBarFor(block));
        qpPlayer.setNotesPerBeat(qpSubFactorFor(block));
        qpPlayer.setSubdivisionFactor(1);
        qpPlayer.setLowPitch(false);
    }

    function jumpQpToIndex(index) {
        qpPlayIndex = index;
        qpClicksPlayedInBlock = 0;
        if (!qpBlocks.length) return;
        const block = qpBlocks[index];
        applyQpBlockToPlayer(block);
        qpPlayer.resetToBarStart();
    }

    // The only thing an add/delete needs beyond re-rendering: qpPlayIndex has to stay a valid index
    // into the (now different-length) qpBlocks array. Skipped entirely while playing, same reasoning
    // as Blocks' refreshMetroBlkQueueIfStale - an edit made in the background while a sequence is
    // sounding shouldn't yank the current block out from under it.
    function qpSyncAfterBlocksChanged() {
        qpPlayIndex = Math.min(qpPlayIndex, qpBlocks.length - 1);
        if (!qpPlayer.isPlaying()) jumpQpToIndex(qpPlayIndex);
        renderQuickPlayRows();
    }

    function advanceQp() {
        let next = qpPlayIndex + 1;
        if (next >= qpBlocks.length) next = 0;
        jumpQpToIndex(next);
        setTimeout(renderQuickPlayRows, 130);
    }

    // No mid-block label refresh needed any more - "Bar X of Y" only ever changes at a block
    // boundary (qpPlayIndex advancing), which advanceQp's own renderQuickPlayRows call already
    // covers. Every Quick Play block is exactly 1 bar, so there's no in-between "2 of 4 bars" state
    // to track within a single block the way Blocks' own repeat count needs.
    function onQpBeat(beatInfo) {
        const block = qpBlocks[qpPlayIndex];
        if (!block) return;
        const subFactor = qpSubFactorFor(block);
        flashTierDot('qpRow0Dots', beatInfo.clickIndexInBar);

        // ML-155: pan the row to keep the current beat in view once there are too many circles to fit
        // (same "camera clamp" metroScrollFollow does for Blocks' own row, onMetroBlkBeat above) - this
        // was wired up for Blocks but never ported to Quick Play, so the lit dot just marched off the
        // right edge with nothing bringing it back into view. Same totalBaseClicks+1 basis renderQuickPlayRows
        // lays the dots out on, so the math can't drift out of step with where they actually are.
        if (beatInfo.isConductorBeat) {
            const totalBaseClicks = beatInfo.conductorBeatsPerBar * subFactor;
            const nextIndex = (beatInfo.conductorBeatIndex + 1) % beatInfo.conductorBeatsPerBar;
            const trackUnit = 100 / (totalBaseClicks + 1);
            const trackLeftPct = (k) => k * trackUnit + trackUnit / 2;
            metroScrollFollow('qpRow0Viewport', 'qpRow0Content', trackLeftPct(beatInfo.conductorBeatIndex * subFactor), trackLeftPct(nextIndex * subFactor), beatInfo.secondsPerConductorBeat);
        }

        qpClicksPlayedInBlock++;
        const targetClicks = block.barCount * qpBeatsPerBarFor(block) * subFactor;
        const isFinalClickOfBlock = qpClicksPlayedInBlock >= targetClicks;
        if (isFinalClickOfBlock) advanceQp();
    }
    qpPlayer.onBeat(onQpBeat);

    function renderQuickPlayRows() {
        if (!qpBlocks.length) return;
        const block = qpBlocks[qpPlayIndex];
        const subFactor = qpSubFactorFor(block);
        const label = block ? qpBlockLabel(block) : '';
        const labelEl = document.getElementById('qpRow0Label');
        if (labelEl) labelEl.innerText = label;

        const beatsPerBar = block ? qpBeatsPerBarFor(block) : 4;
        const totalBaseClicks = beatsPerBar * subFactor;
        // Laid out over totalBaseClicks+1 slots, not totalBaseClicks - reserves room for the
        // connecting line's own one-slot extension past the last dot (connectMetroBlkDotsWithTrack),
        // same reasoning as Blocks' own renderMetroBlkRows.
        const trackLeftPct = (k) => k * (100 / (totalBaseClicks + 1)) + (100 / (totalBaseClicks + 1)) / 2;
        const endLeftStyle = metroLeftStyle(trackLeftPct(totalBaseClicks));
        buildMetroDotRow('qpRow0Dots', totalBaseClicks, subFactor, false, trackLeftPct);
        metroApplyDisplayWidth('qpRow0Viewport', 'qpRow0Content', totalBaseClicks + 1);
        connectMetroBlkDotsWithTrack('qpRow0Dots', endLeftStyle);
        if (!qpPlayer.isPlaying()) resetMetroScrollPosition('qpRow0Content');

        renderQpSubdivideLabel();
        renderQpActiveBoxHighlight();
    }

    // Highlights whichever bar box is actually sounding right now, only while playing (not on a
    // plain pause/stop) - cheap, no rebuild, just toggles a class on whichever box already matches
    // qpPlayIndex, same idea as Blocks' own renderMetroBlkActiveTileHighlight.
    function renderQpActiveBoxHighlight() {
        const playing = qpPlayer.isPlaying();
        document.querySelectorAll('#qpBlocks [data-qp-block-index]').forEach(el => {
            el.classList.toggle('qp-block-playing', playing && Number(el.dataset.qpBlockIndex) === qpPlayIndex);
        });
    }

    window.addEventListener('resize', () => {
        const view = document.getElementById('quickPlayView');
        if (view && view.style.display !== 'none') renderQuickPlayRows();
    });

    // --- Transport ---
    function updateQPPlayIcon() {
        const icon = document.getElementById('qpPlayIcon');
        if (icon) icon.innerText = qpPlayer.isPlaying() ? 'pause' : 'play_arrow';
    }

    // Builds a local "YYYY-MM-DD HH:MM:SS" timestamp (wall-clock local time, not UTC) - used as the
    // history row's name in place of a chosen one, per the request ("date and time, local, including
    // seconds").
    function qpLocalTimestamp() {
        const d = new Date();
        const pad = (n) => String(n).padStart(2, '0');
        return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
    }

    // Which history row (if any) is currently loaded into Quick Play - null means "nothing loaded,
    // a fresh Play writes a brand new history entry" (the original behaviour). Set by the Load button
    // below, cleared by qpClearLoadedHistory (the X next to the loaded name) and qpResetAllBars.
    let qpLoadedHistoryId = null;
    let qpLoadedHistoryName = null;
    // Whether qpBlocks has changed since it was loaded (qpMarkUnsaved flips this on) - drives the
    // "- edited" tag and its undo icon.
    let qpLoadedHistoryEdited = false;
    // A plain-data snapshot of the blocks exactly as loaded (no _uid - qpRevertToLoadedHistory
    // assigns fresh ones) - kept around for the whole time something's loaded, regardless of any
    // auto-save/overwrite that happens in between, so "revert" always means "back to what was
    // actually loaded", not "back to whatever's currently on the server".
    let qpLoadedHistorySnapshot = null;

    // Shows the loaded entry's name under the "Bars" title, with the "- edited"/undo pair and the X
    // that clears it - hidden entirely whenever nothing is loaded.
    function renderQpLoadedHistoryLabel() {
        const row = document.getElementById('qpLoadedHistoryRow');
        if (!row) return;
        row.classList.toggle('hidden-group', qpLoadedHistoryId === null);
        const nameEl = document.getElementById('qpLoadedHistoryName');
        if (nameEl && qpLoadedHistoryName !== null) nameEl.innerText = qpFormatHistoryLabel(qpLoadedHistoryName);
        document.getElementById('qpLoadedHistoryEditedTag')?.classList.toggle('hidden-group', !qpLoadedHistoryEdited);
        document.getElementById('qpLoadedHistoryUndoBtn')?.classList.toggle('hidden-group', !qpLoadedHistoryEdited);
    }

    // Reverts to exactly what was loaded (qpLoadedHistorySnapshot), even if an auto-save already
    // overwrote the history row itself with edited bars in the meantime - the next Play re-saves this
    // reverted state back over that (qpSavedThisRun reset, same as any other change).
    function qpRevertToLoadedHistory() {
        if (!qpLoadedHistorySnapshot) return;
        qpAnimateBlocksChange(() => {
            qpBlocks = qpLoadedHistorySnapshot.map(b => ({ ...b, _uid: ++qpUidCounter }));
        });
        qpLoadedHistoryEdited = false;
        qpSavedThisRun = false;
        renderQpLoadedHistoryLabel();
        qpSyncAfterBlocksChanged();
    }
    document.getElementById('qpLoadedHistoryUndoBtn')?.addEventListener('click', qpRevertToLoadedHistory);

    function qpBlocksPayload() {
        return qpBlocks.map(b => ({
            barCount: b.barCount,
            bpm: b.bpm,
            noteValue: b.noteSelected,
            timeSignatureId: b.timeSigValue?.startsWith('public:') ? Number(b.timeSigValue.split(':')[1]) : null,
            accountTimeSignatureId: b.timeSigValue?.startsWith('custom:') ? Number(b.timeSigValue.split(':')[1]) : null
        }));
    }

    // Writes the current blocks in as one history row - fire-and-forget (a failed write must never
    // block playback actually starting). Runs once per "fresh" play (see qpSavedThisRun), not on every
    // pause/resume toggle. Once a history row is loaded (qpLoadedHistoryId), this overwrites that same
    // row's bars instead of creating a new entry every time - "override the saved version", per the
    // request - until it's cleared (qpClearLoadedHistory) or the bars are reset (qpResetAllBars).
    async function saveQuickPlayHistory() {
        try {
            if (qpLoadedHistoryId !== null) {
                await API.metronomeBlocks.quickPlay.overwriteHistory(qpLoadedHistoryId, qpBlocksPayload());
            } else {
                await API.metronomeBlocks.quickPlay.save(qpLocalTimestamp(), qpBlocksPayload());
            }
        } catch (error) {
            showWarningToast('Error saving play history: ' + error.message);
        }
    }

    // --- ML-163: "Save to flow" - turns the current bar-by-bar qpBlocks into a Flow's multi-bar
    // blocks. Quick Play has no merge concept of its own (every qpBlocks entry is exactly one bar),
    // so this confirms how consecutive identical bars (same timeSigValue/noteSelected/bpm) will
    // combine before a Flow (and its blocks) actually get created - see the modal's own HTML comment.
    // qpMergeBlocks is the editable working state once the modal's open; qpBlocks itself is never
    // touched by any of this. ---
    let qpMergeBlocks = [];
    let qpMergeFlatMode = false;
    // Which pending (freshly split-out) block's Merge above/below choice is currently showing - at
    // most one at a time, closed again by qpMergeToggleMenu or whenever the list re-renders after an
    // edit elsewhere.
    let qpMergeOpenMenuKey = null;
    let qpMergeKeyCounter = 0;

    function qpBarsMatch(a, b) {
        return a.timeSigValue === b.timeSigValue && a.noteSelected === b.noteSelected && a.bpm === b.bpm;
    }
    // bpm is stored raw (same meaning as a segment's own bpm column - see qpBlocksPayload above); the
    // number shown to the user throughout the rest of Quick Play is that raw value re-expressed per
    // the block's own beat unit, so this screen matches rather than showing an unfamiliar figure.
    function qpMergeDisplayedBpm(bar) {
        return Math.round(bar.bpm / (qpBlockNoteFraction(bar.noteSelected) * qpBlockDenominator(bar)));
    }
    function qpMergeBarFieldsHtml(bar) {
        const noteType = METRO_NOTE_TYPES.find(t => t.key === bar.noteSelected);
        return `<span>${escapeHtml(metroSegTimeSigLabelFor(bar.timeSigValue) || '—')}</span>` +
            `<span>${escapeHtml(noteType ? noteType.label : '')}</span>` +
            `<span>${qpMergeDisplayedBpm(bar)} bpm</span>`;
    }

    // Default grouping: greedily merges each bar into the previous block whenever it matches, which
    // is the "minimise the number of blocks" default per the request - every group starts as a single
    // real block, never "pending" (that flag only ever applies to a block created by splitting one
    // apart below).
    function qpComputeDefaultMergeBlocks() {
        const result = [];
        qpBlocks.forEach((b, i) => {
            const bar = { timeSigValue: b.timeSigValue, noteSelected: b.noteSelected, bpm: b.bpm, barNumber: i + 1 };
            const last = result[result.length - 1];
            if (last && qpBarsMatch(last.bars[last.bars.length - 1], bar)) {
                last.bars.push(bar);
            } else {
                result.push({ key: ++qpMergeKeyCounter, bars: [bar], pending: false });
            }
        });
        return result;
    }

    function openQpMergeBarsModal() {
        qpMergeBlocks = qpComputeDefaultMergeBlocks();
        qpMergeFlatMode = !qpMergeBlocks.some(g => g.bars.length > 1);
        qpMergeOpenMenuKey = null;
        renderQpMergeBarsModal();
        document.getElementById('qpMergeBarsModal').style.display = 'flex';
    }

    // Peels one specific bar out of a multi-bar block into a new block of its own, right where it
    // was - "as it leaves the bar", not just the group as a whole, so any bar in the middle of a
    // block can be split out, not only the first/last. Whatever's left on either side stays merged
    // (it was already identical to itself). The new block starts "pending" - its own connector
    // becomes the Merge above/below choice (qpMergeToggleMenu/qpMergeInto) rather than a plain arrow.
    function qpMergeSplitBar(groupKey, barIndex) {
        const gi = qpMergeBlocks.findIndex(g => g.key === groupKey);
        if (gi === -1) return;
        const group = qpMergeBlocks[gi];
        const bar = group.bars[barIndex];
        if (!bar) return;
        const leftBars = group.bars.slice(0, barIndex);
        const rightBars = group.bars.slice(barIndex + 1);
        const newGroups = [];
        if (leftBars.length) newGroups.push({ key: ++qpMergeKeyCounter, bars: leftBars, pending: false });
        newGroups.push({ key: ++qpMergeKeyCounter, bars: [bar], pending: true });
        if (rightBars.length) newGroups.push({ key: ++qpMergeKeyCounter, bars: rightBars, pending: false });
        qpMergeBlocks.splice(gi, 1, ...newGroups);
        qpMergeOpenMenuKey = null;
        renderQpMergeBarsModal();
    }

    function qpMergeToggleMenu(groupKey) {
        qpMergeOpenMenuKey = qpMergeOpenMenuKey === groupKey ? null : groupKey;
        renderQpMergeBarsModal();
    }

    // Always an explicit tap on one specific direction - never auto-picked, even when only one of
    // "above"/"below" is actually possible, so re-merging is always a deliberate choice rather than
    // something that just happens on its own.
    function qpMergeInto(groupKey, direction) {
        const gi = qpMergeBlocks.findIndex(g => g.key === groupKey);
        if (gi === -1) return;
        const group = qpMergeBlocks[gi];
        const bar = group.bars[0];
        if (direction === 'above') {
            const target = qpMergeBlocks[gi - 1];
            if (!target || !qpBarsMatch(target.bars[target.bars.length - 1], bar)) return;
            target.bars.push(bar);
        } else {
            const target = qpMergeBlocks[gi + 1];
            if (!target || !qpBarsMatch(target.bars[0], bar)) return;
            target.bars.unshift(bar);
        }
        qpMergeBlocks.splice(gi, 1);
        qpMergeOpenMenuKey = null;
        renderQpMergeBarsModal();
    }

    function renderQpMergeGroupHtml(group, gi) {
        const isMultiBar = group.bars.length > 1;
        const barsHtml = group.bars.map((bar, bi) => `
            <div class="qp-merge-bar-row">
                <span class="qp-merge-bar-num">Bar ${bar.barNumber}</span>
                <span class="qp-merge-bar-fields">${qpMergeBarFieldsHtml(bar)}</span>
                ${isMultiBar ? `<button type="button" class="qp-merge-split-btn" data-qp-merge-split data-group-key="${group.key}" data-bar-index="${bi}" aria-label="Bar ${bar.barNumber} merges into Block ${gi + 1} - tap to split into its own block"><span class="material-symbols-outlined">link</span></button>` : ''}
            </div>
        `).join('');

        let connector;
        if (group.pending) {
            const above = qpMergeBlocks[gi - 1];
            const below = qpMergeBlocks[gi + 1];
            const canAbove = !!(above && qpBarsMatch(above.bars[above.bars.length - 1], group.bars[0]));
            const canBelow = !!(below && qpBarsMatch(below.bars[0], group.bars[0]));
            const menuOpen = qpMergeOpenMenuKey === group.key;
            connector = `<button type="button" class="qp-merge-branch-btn" data-qp-merge-toggle-menu data-group-key="${group.key}" aria-label="Bar ${group.bars[0].barNumber} is its own block - tap for merge options"><span class="material-symbols-outlined">call_split</span></button>` +
                (menuOpen ? `<div class="qp-merge-menu">
                    <button type="button" class="qp-merge-menu-btn" data-qp-merge-into data-group-key="${group.key}" data-direction="above" ${canAbove ? '' : 'disabled title="Different time signature, beat note or tempo"'}>Merge above</button>
                    <button type="button" class="qp-merge-menu-btn" data-qp-merge-into data-group-key="${group.key}" data-direction="below" ${canBelow ? '' : 'disabled title="Different time signature, beat note or tempo"'}>Merge below</button>
                </div>` : '');
        } else {
            connector = '<span class="material-symbols-outlined qp-merge-arrow" aria-hidden="true">arrow_forward</span>';
        }

        const repBar = group.bars[0];
        return `<div class="qp-merge-group">
            <div class="qp-merge-bars">${barsHtml}</div>
            <div class="qp-merge-connector">${connector}</div>
            <div class="qp-merge-block">
                <div class="qp-merge-block-head"><span>Block ${gi + 1}</span><span class="qp-merge-block-badge">${group.bars.length} ${group.bars.length === 1 ? 'bar' : 'bars'}</span></div>
                <div class="qp-merge-block-fields">${qpMergeBarFieldsHtml(repBar)}</div>
            </div>
        </div>`;
    }

    function wireQpMergeGroupControls() {
        const list = document.getElementById('qpMergeBarsList');
        list.querySelectorAll('[data-qp-merge-split]').forEach(btn => {
            btn.addEventListener('click', () => qpMergeSplitBar(Number(btn.dataset.groupKey), Number(btn.dataset.barIndex)));
        });
        list.querySelectorAll('[data-qp-merge-toggle-menu]').forEach(btn => {
            btn.addEventListener('click', () => qpMergeToggleMenu(Number(btn.dataset.groupKey)));
        });
        list.querySelectorAll('[data-qp-merge-into]').forEach(btn => {
            if (btn.disabled) return;
            btn.addEventListener('click', () => qpMergeInto(Number(btn.dataset.groupKey), btn.dataset.direction));
        });
    }

    function renderQpMergeBarsModal() {
        const subtitle = document.getElementById('qpMergeBarsSubtitle');
        const list = document.getElementById('qpMergeBarsList');

        if (qpMergeFlatMode) {
            const n = qpBlocks.length;
            subtitle.textContent = `Every bar is different, so nothing can merge - ${n} bar${n === 1 ? '' : 's'} will become ${n} block${n === 1 ? '' : 's'}.`;
            list.innerHTML = qpBlocks.map((b, i) => `
                <div class="qp-merge-flat-row">
                    <span class="qp-merge-bar-num">Bar ${i + 1}</span>
                    <span class="qp-merge-bar-fields">${qpMergeBarFieldsHtml({ timeSigValue: b.timeSigValue, noteSelected: b.noteSelected, bpm: b.bpm })}</span>
                </div>
            `).join('');
            return;
        }

        const blockCount = qpMergeBlocks.length;
        subtitle.textContent = `${qpBlocks.length} bars will become ${blockCount} block${blockCount === 1 ? '' : 's'}.`;
        list.innerHTML = qpMergeBlocks.map((group, gi) => renderQpMergeGroupHtml(group, gi)).join('');
        wireQpMergeGroupControls();
    }

    // Creates the flow, then adds one block per current group/bar in order - sequential, not
    // Promise.all, since each block's order_index is assigned server-side as "current max + 1"
    // (createFlowBlock) and would race if these ran in parallel.
    async function qpMergeSaveToFlow() {
        const saveBtn = document.getElementById('qpMergeBarsSaveBtn');
        saveBtn.disabled = true;
        try {
            const flow = await API.flows.create({});
            // POST /flows always seeds one default starter block (ML-179 follow-up, "never a truly
            // empty flow") - fine for "Create your own", but here the merged bars ARE the content, so
            // that placeholder has to go before adding them, not sit stranded ahead of Block 1.
            const seededBlocks = await API.flows.blocks.list(flow.id);
            for (const seeded of seededBlocks) await API.flows.blocks.delete(seeded.id);
            const groups = qpMergeFlatMode
                ? qpBlocks.map(b => ({ bars: [{ timeSigValue: b.timeSigValue, noteSelected: b.noteSelected, bpm: b.bpm }] }))
                : qpMergeBlocks;
            for (const group of groups) {
                const bar = group.bars[0];
                await API.flows.blocks.create(flow.id, {
                    barCount: group.bars.length,
                    bpm: bar.bpm,
                    noteValue: bar.noteSelected,
                    timeSignatureId: bar.timeSigValue?.startsWith('public:') ? Number(bar.timeSigValue.split(':')[1]) : null,
                    accountTimeSignatureId: bar.timeSigValue?.startsWith('custom:') ? Number(bar.timeSigValue.split(':')[1]) : null
                });
            }
            document.getElementById('qpMergeBarsModal').style.display = 'none';
            if (document.getElementById('qpMergeGoToFlowsToggle').checked) {
                currentFlowId = flow.id;
                flowEditMode = 'edit';
                await goToFlowPlayView(flow.id);
            } else {
                showSuccessToast(`Saved to "${flow.title}"`);
            }
        } catch (error) {
            showWarningToast('Error saving to flow: ' + error.message);
        } finally {
            saveBtn.disabled = false;
        }
    }

    document.getElementById('qpSaveToFlowBtn')?.addEventListener('click', openQpMergeBarsModal);
    document.getElementById('qpMergeBarsCancelBtn')?.addEventListener('click', () => {
        document.getElementById('qpMergeBarsModal').style.display = 'none';
    });
    document.getElementById('qpMergeBarsSaveBtn')?.addEventListener('click', qpMergeSaveToFlow);

    // --- ML-34: "Show history" - browse/rename/favourite/delete past history rows and load one
    // back into qpBlocks. qpLocalTimestamp's stored format ("YYYY-MM-DD HH:MM:SS") is kept as-is
    // (an earlier, deliberate choice - see its own comment above) - this only reformats it for
    // display, so a still-default-named row reads as "17 Sep 2026 14:32" here without touching what's
    // actually stored or renamed rows (which show exactly what the user typed).
    function qpFormatHistoryLabel(name) {
        const d = new Date(String(name).replace(' ', 'T'));
        if (isNaN(d.getTime())) return name;
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const pad = (n) => String(n).padStart(2, '0');
        return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
    }

    // ML-34 follow-up: "Duplicate" names itself "<name> (copy)", or "<name> (copy 2)"/"(copy 3)"/...
    // if that's already taken - e.g. duplicating a favourite more than once. Always computed off the
    // original's own base name (stripping any existing "(copy...)" suffix first), not the source
    // being duplicated, so duplicating a copy chains "(copy)", "(copy 2)", "(copy 3)" rather than
    // compounding into "(copy) (copy)".
    function qpBaseHistoryName(name) {
        return String(name).replace(/\s*\(copy(?:\s+\d+)?\)\s*$/i, '');
    }
    function qpNextDuplicateName(name) {
        const base = qpBaseHistoryName(name);
        const existing = new Set(qpHistoryData.map(r => r.name));
        if (!existing.has(`${base} (copy)`)) return `${base} (copy)`;
        let n = 2;
        while (existing.has(`${base} (copy ${n})`)) n++;
        return `${base} (copy ${n})`;
    }

    let qpHistoryData = [];
    let qpHistoryFilter = 'all';
    let qpHistorySelectedId = null;
    let qpHistoryMenuTargetId = null;

    async function loadQpHistory() {
        const list = document.getElementById('qpHistoryList');
        if (list) list.innerHTML = 'Loading…';
        try {
            qpHistoryData = await API.metronomeBlocks.quickPlay.history();
            renderQpHistoryList();
        } catch (error) {
            showWarningToast('Error loading history: ' + error.message);
        }
    }

    function renderQpHistoryList() {
        const list = document.getElementById('qpHistoryList');
        if (!list) return;
        const rows = qpHistoryFilter === 'favorites' ? qpHistoryData.filter(r => r.isFavorite) : qpHistoryData;
        if (!rows.length) {
            list.innerHTML = `<p class="text-muted">${qpHistoryFilter === 'favorites' ? 'No favourites yet.' : 'No history yet - play something for a couple of seconds and it\'ll show up here.'}</p>`;
        } else {
            list.innerHTML = rows.map(r => `
                <div class="history-item qp-history-item${r.id === qpHistorySelectedId ? ' qp-history-item-selected' : ''}" data-qp-history-id="${r.id}">
                    <div class="qp-history-item-body" data-qp-history-select>
                        ${r.isFavorite ? '<span class="material-symbols-outlined qp-history-star" aria-hidden="true">star</span>' : ''}
                        <div>
                            <strong>${escapeHtml(qpFormatHistoryLabel(r.name))}</strong>
                            <div style="font-size:0.85rem; color:#666;">${r.blockCount} bar${r.blockCount === 1 ? '' : 's'}</div>
                        </div>
                    </div>
                    <button type="button" class="list-item-menu-btn" data-qp-history-menu-btn aria-label="Options for ${escapeHtml(qpFormatHistoryLabel(r.name))}"><span class="material-symbols-outlined">more_vert</span></button>
                </div>
            `).join('');
        }
        list.querySelectorAll('[data-qp-history-select]').forEach(el => {
            el.addEventListener('click', () => {
                const id = Number(el.closest('.qp-history-item').dataset.qpHistoryId);
                qpHistorySelectedId = qpHistorySelectedId === id ? null : id;
                renderQpHistoryList();
            });
        });
        list.querySelectorAll('[data-qp-history-menu-btn]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const id = Number(btn.closest('.qp-history-item').dataset.qpHistoryId);
                openQpHistoryItemMenu(e.currentTarget, id);
            });
        });
        const loadBtn = document.getElementById('qpHistoryLoadBtn');
        if (loadBtn) loadBtn.disabled = qpHistorySelectedId === null || !rows.some(r => r.id === qpHistorySelectedId);
    }

    function openQpHistoryItemMenu(btnEl, id) {
        const menu = document.getElementById('qpHistoryItemMenu');
        if (!menu) return;
        closeAllMetroPopupMenus();
        qpHistoryMenuTargetId = id;
        const entry = qpHistoryData.find(r => r.id === id);
        const favBtn = document.getElementById('qpHistoryItemFavoriteToggle');
        if (favBtn) favBtn.innerText = entry?.isFavorite ? 'Remove from favourites' : 'Set as favourite';

        const btnRect = btnEl.getBoundingClientRect();
        menu.style.right = 'auto';
        menu.classList.add('show');
        const menuWidth = menu.offsetWidth;
        const menuHeight = menu.offsetHeight;
        let left = btnRect.right - menuWidth;
        left = Math.max(8, Math.min(left, window.innerWidth - menuWidth - 8));
        let top = btnRect.bottom + 4;
        top = Math.min(top, window.innerHeight - menuHeight - 8);
        menu.style.left = `${left}px`;
        menu.style.top = `${top}px`;
    }
    function closeQpHistoryItemMenu() {
        document.getElementById('qpHistoryItemMenu')?.classList.remove('show');
    }
    document.addEventListener('click', closeQpHistoryItemMenu);

    document.getElementById('qpHistoryItemRename')?.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = qpHistoryMenuTargetId;
        closeQpHistoryItemMenu();
        const entry = qpHistoryData.find(r => r.id === id);
        if (!entry) return;
        showPromptModal('Rename', qpFormatHistoryLabel(entry.name), async (newName) => {
            if (!newName) return;
            try {
                await API.metronomeBlocks.setups.rename(id, newName);
                await loadQpHistory();
            } catch (error) {
                showWarningToast('Error renaming: ' + error.message);
            }
        });
    });
    document.getElementById('qpHistoryItemFavoriteToggle')?.addEventListener('click', async (e) => {
        e.stopPropagation();
        const id = qpHistoryMenuTargetId;
        closeQpHistoryItemMenu();
        const entry = qpHistoryData.find(r => r.id === id);
        if (!entry) return;
        try {
            await API.metronomeBlocks.setups.setFavorite(id, !entry.isFavorite);
            await loadQpHistory();
        } catch (error) {
            showWarningToast('Error updating favourite: ' + error.message);
        }
    });
    document.getElementById('qpHistoryItemDelete')?.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = qpHistoryMenuTargetId;
        closeQpHistoryItemMenu();
        const entry = qpHistoryData.find(r => r.id === id);
        if (!entry) return;
        showConfirmModal('Delete history entry', `Delete "${qpFormatHistoryLabel(entry.name)}" from history?`, async () => {
            try {
                await API.metronomeBlocks.setups.delete(id);
                if (qpHistorySelectedId === id) qpHistorySelectedId = null;
                await loadQpHistory();
            } catch (error) {
                showWarningToast('Error deleting: ' + error.message);
            }
        });
    });
    // ML-34 follow-up: most useful on a favourite - keeps it pristine while you iterate on a variant.
    document.getElementById('qpHistoryItemDuplicate')?.addEventListener('click', async (e) => {
        e.stopPropagation();
        const id = qpHistoryMenuTargetId;
        closeQpHistoryItemMenu();
        const entry = qpHistoryData.find(r => r.id === id);
        if (!entry) return;
        try {
            const created = await API.metronomeBlocks.quickPlay.duplicateHistory(id, qpNextDuplicateName(entry.name));
            qpHistorySelectedId = created.id;
            await loadQpHistory();
            showSuccessToast('Duplicated');
        } catch (error) {
            showWarningToast('Error duplicating: ' + error.message);
        }
    });

    document.querySelectorAll('#qpHistoryFilterRadios input[type="radio"]').forEach(r => {
        r.addEventListener('change', (e) => {
            qpHistoryFilter = e.target.value;
            renderQpHistoryList();
        });
    });

    function openQpHistoryModal() {
        qpHistorySelectedId = null;
        qpHistoryFilter = 'all';
        document.getElementById('qpHistoryFilterAll').checked = true;
        document.getElementById('qpHistoryModal').style.display = 'flex';
        loadQpHistory();
    }
    document.getElementById('qpShowHistoryBtn')?.addEventListener('click', openQpHistoryModal);
    document.getElementById('qpHistoryCloseBtn')?.addEventListener('click', () => {
        document.getElementById('qpHistoryModal').style.display = 'none';
    });

    // Maps a saved setup's full segment DTOs (server shape - see toSegmentDto) back into qpBlocks'
    // own flatter { timeSigValue, bpm, noteSelected, barCount } shape (qpNewBlock). Quick Play has no
    // lead-in concept, but a history row never has one anyway (createQuickPlaySetup always inserts
    // is_lead_in = false) - the filter is just defensive.
    function qpBlocksFromSegments(segments) {
        return segments.filter(s => !s.isLeadIn).map(s => ({
            _uid: ++qpUidCounter,
            timeSigValue: s.timeSignatureId ? `public:${s.timeSignatureId}` : (s.accountTimeSignatureId ? `custom:${s.accountTimeSignatureId}` : qpDefaultTimeSigValue()),
            bpm: s.bpm,
            noteSelected: s.noteValue || 'crotchet',
            barCount: s.barCount || 1
        }));
    }

    document.getElementById('qpHistoryLoadBtn')?.addEventListener('click', async () => {
        const id = qpHistorySelectedId;
        if (id === null) return;
        try {
            const setup = await API.metronomeBlocks.setups.get(id);
            const blocks = qpBlocksFromSegments(setup.segments);
            if (!blocks.length) return showWarningToast('That history entry has no bars to load.');
            qpBlocks = blocks;
            qpLoadedHistoryId = setup.id;
            qpLoadedHistoryName = setup.name;
            qpLoadedHistoryEdited = false;
            qpLoadedHistorySnapshot = blocks.map(b => ({ timeSigValue: b.timeSigValue, bpm: b.bpm, noteSelected: b.noteSelected, barCount: b.barCount }));
            renderQpLoadedHistoryLabel();
            // Not qpMarkUnsaved() - loading isn't itself an edit, it just needs the same "next Play
            // writes fresh" reset qpMarkUnsaved would otherwise also give it.
            qpSavedThisRun = false;
            qpSyncAfterBlocksChanged();
            renderQuickPlayBlocks();
            document.getElementById('qpHistoryModal').style.display = 'none';
            showSuccessToast('Loaded from history');
        } catch (error) {
            showWarningToast('Error loading history entry: ' + error.message);
        }
    });

    // The X next to the loaded name (ML-34 follow-up) - unlinks from that history row and resets to
    // the same single-default-bar starting point as qpResetAllBars, but with no confirmation: nothing
    // is destroyed (the loaded entry is untouched in history, and the in-progress bars weren't
    // themselves ever saved anywhere), it's just clearing what's currently loaded. qpMarkUnsaved
    // already means the usual 2-second-played gate applies again before anything new is written.
    function qpClearLoadedHistory() {
        qpLoadedHistoryId = null;
        qpLoadedHistoryName = null;
        qpLoadedHistoryEdited = false;
        qpLoadedHistorySnapshot = null;
        renderQpLoadedHistoryLabel();
        qpAnimateBlocksChange(() => { qpBlocks = [qpNewBlock()]; });
        qpMarkUnsaved();
        qpSyncAfterBlocksChanged();
    }
    document.getElementById('qpLoadedHistoryClearBtn')?.addEventListener('click', qpClearLoadedHistory);

    // ML-34: only actually written to history once played continuously for a couple of seconds - a
    // Play immediately followed by Stop/Pause shouldn't leave a "nothing really happened" row behind.
    // Not cleared on pause: if it fires while paused, the isPlaying() check below just skips (no
    // save, no reschedule) and the next fresh Play press starts a new one (qpHistorySaveTimer is null
    // again by then) - simpler than tracking accumulated play time across pauses.
    let qpHistorySaveTimer = null;
    function playQuickPlay() {
        if (!qpBlocks.length) return showWarningToast('Add at least one time block first.');
        // Pushes whatever's currently in qpBlocks[qpPlayIndex] into the engine fresh - covers the case
        // where that block's own bpm/time-signature was edited while paused/stopped (fields are read
        // live everywhere else, but the engine's own internal tempo/beatsPerBar only updates when
        // explicitly told to). Doesn't touch position, so this is always safe to call, resume included.
        applyQpBlockToPlayer(qpBlocks[qpPlayIndex]);
        if (!qpSavedThisRun && !qpHistorySaveTimer) {
            qpHistorySaveTimer = setTimeout(() => {
                qpHistorySaveTimer = null;
                if (qpPlayer.isPlaying() && !qpSavedThisRun) {
                    qpSavedThisRun = true;
                    saveQuickPlayHistory();
                }
            }, 2000);
        }
        qpPlayer.play();
        updateQPPlayIcon();
        syncWakeLock();
        renderQuickPlayRows();
    }

    function pauseQuickPlay() {
        qpPlayer.pause();
        updateQPPlayIcon();
        syncWakeLock();
        renderQpActiveBoxHighlight();
    }

    function resetQuickPlay() {
        jumpQpToIndex(0);
        qpMarkUnsaved();
        renderQuickPlayRows();
    }

    // ML-146: a plain Reset button sits next to Play now (matching Blocks' own transport row) -
    // press-and-hold on Play still works too, via the same shared setupPlayButtonHoldReset Blocks'
    // own Play button uses (see the METRONOME ENGINE section).
    setupPlayButtonHoldReset('qpPlayBtn',
        () => { if (qpPlayer.isPlaying()) pauseQuickPlay(); else playQuickPlay(); },
        resetQuickPlay
    );
    document.getElementById('qpResetBtn')?.addEventListener('click', resetQuickPlay);

    // --- Sub-beats popup (ported from Blocks' own metroBlkSubdivideModal - own state, own modal, same
    // reasoning as qpPlayer being its own player instance) ---
    // Fixed 2-16 range, no tiered expansion (unlike the BPM slider above) - sub beats past 16 has no
    // real musical meaning here, so the slider just hard-caps rather than growing into a wider range.
    const QP_SUBDIVIDE_MIN = 2;
    const QP_SUBDIVIDE_MAX = 16;
    let qpSubdividePopupValue = QP_SUBDIVIDE_MIN;

    function renderQpSubdivideLabel() {
        const block = qpBlocks[qpPlayIndex];
        const display = block ? (qpSubFactorFor(block) <= 1 ? '0' : String(qpSubFactorFor(block))) : '0';
        const lbl = document.getElementById('qpSubdivideLbl');
        if (lbl) lbl.innerText = display;
        // ML-165: same "call out Auto specifically" treatment as Blocks' own renderMetroBlkSubdivideLabels.
        const unitLbl = document.getElementById('qpSubdivideUnitLbl');
        if (unitLbl) unitLbl.innerText = qpSubBeatsMode === 'auto' ? 'auto sub beats' : 'sub beats';
    }

    function renderQpSubdividePopupSlider() {
        const pct = ((qpSubdividePopupValue - QP_SUBDIVIDE_MIN) / (QP_SUBDIVIDE_MAX - QP_SUBDIVIDE_MIN)) * 100;
        document.getElementById('qpSubdivideSliderFill').style.width = `${pct}%`;
        const thumb = document.getElementById('qpSubdivideSliderThumb');
        thumb.style.left = `${pct}%`;
        thumb.setAttribute('aria-valuenow', qpSubdividePopupValue);
        thumb.setAttribute('aria-valuemax', QP_SUBDIVIDE_MAX);
        document.getElementById('qpSubdivideSliderMaxLbl').innerText = QP_SUBDIVIDE_MAX;
        document.getElementById('qpSubdividePopupValue').innerText = qpSubdividePopupValue;
    }
    function setQpSubdividePopupValue(v) {
        qpSubdividePopupValue = Math.min(QP_SUBDIVIDE_MAX, Math.max(QP_SUBDIVIDE_MIN, Math.round(v)));
        renderQpSubdividePopupSlider();
    }
    setupHoldStepper(document.getElementById('qpSubdivideMinus'), -1, (amount) => setQpSubdividePopupValue(qpSubdividePopupValue + amount));
    setupHoldStepper(document.getElementById('qpSubdividePlus'), 1, (amount) => setQpSubdividePopupValue(qpSubdividePopupValue + amount));
    setupSliderInteraction(document.getElementById('qpSubdivideSliderTrack'), document.getElementById('qpSubdivideSliderThumb'), {
        onDragRatio: (ratio) => setQpSubdividePopupValue(QP_SUBDIVIDE_MIN + ratio * (QP_SUBDIVIDE_MAX - QP_SUBDIVIDE_MIN)),
        onArrowStep: (dir) => setQpSubdividePopupValue(qpSubdividePopupValue + dir)
    });
    makeSliderReadoutEditable('qpSubdividePopupValue', () => qpSubdividePopupValue, (v) => setQpSubdividePopupValue(v), { label: 'Sub beats', min: QP_SUBDIVIDE_MIN, max: QP_SUBDIVIDE_MAX });

    document.getElementById('qpSubdivideBtn')?.addEventListener('click', () => {
        document.getElementById('qpSubdivideOff').checked = qpSubBeatsMode === 'off';
        document.getElementById('qpSubdivideAuto').checked = qpSubBeatsMode === 'auto';
        document.getElementById('qpSubdivideFixed').checked = qpSubBeatsMode === 'fixed';
        document.getElementById('qpSubdivideBpmBox').classList.toggle('hidden-group', qpSubBeatsMode !== 'fixed');
        setQpSubdividePopupValue(qpSubdivideOverride || QP_SUBDIVIDE_MIN);
        document.getElementById('qpSubdivideModal').style.display = 'flex';
    });
    document.querySelectorAll('input[name="qpSubdivideOnOff"]').forEach(radio => {
        radio.addEventListener('change', () => {
            document.getElementById('qpSubdivideBpmBox').classList.toggle('hidden-group', radio.value !== 'fixed');
        });
    });
    document.getElementById('qpSubdivideCancelBtn')?.addEventListener('click', () => {
        document.getElementById('qpSubdivideModal').style.display = 'none';
    });
    document.getElementById('qpSubdivideSaveBtn')?.addEventListener('click', () => {
        qpSubBeatsMode = document.querySelector('input[name="qpSubdivideOnOff"]:checked')?.value || 'off';
        qpSubdivideOverride = qpSubBeatsMode === 'fixed' ? qpSubdividePopupValue : null;
        document.getElementById('qpSubdivideModal').style.display = 'none';
        const block = qpBlocks[qpPlayIndex];
        if (block) applyQpBlockToPlayer(block);
        renderQuickPlayRows();
    });

    // --- Play speed popup (ported from Blocks' - own state, own modal, admin-managed preset list) ---
    let qpSpeedPercent = 100;
    function renderQpSpeedLabel() {
        document.getElementById('qpSpeedLbl').innerText = `${qpSpeedPercent}%`;
    }
    function setQpSpeedPercent(p) {
        qpSpeedPercent = Math.min(1000, Math.max(1, p));
        qpPlayer.setSpeedPercent(qpSpeedPercent);
        renderQpSpeedLabel();
        const block = qpBlocks[qpPlayIndex];
        if (block) applyQpBlockToPlayer(block);
        renderQuickPlayRows();
    }
    async function loadQuickPlayPlaybackSpeeds() {
        try {
            const speeds = await API.metronomeBlocks.playbackSpeeds.list();
            const container = document.getElementById('qpSpeedOptions');
            if (container) container.innerHTML = speeds.map(p => `<button type="button" class="metroBlk-timesig-opt" data-value="${p}">${p}%</button>`).join('');
            document.querySelectorAll('#qpSpeedOptions .metroBlk-timesig-opt').forEach(btn => {
                btn.classList.toggle('selected', Number(btn.dataset.value) === qpSpeedPercent);
            });
        } catch (error) {
            showWarningToast('Error loading playback speeds: ' + error.message);
        }
    }
    document.getElementById('qpSpeedBtn')?.addEventListener('click', () => {
        document.querySelectorAll('#qpSpeedOptions .metroBlk-timesig-opt').forEach(btn => {
            btn.classList.toggle('selected', Number(btn.dataset.value) === qpSpeedPercent);
        });
        document.getElementById('qpSpeedModal').style.display = 'flex';
    });
    document.getElementById('qpSpeedOptions')?.addEventListener('click', (e) => {
        const btn = e.target.closest('.metroBlk-timesig-opt');
        if (!btn) return;
        setQpSpeedPercent(Number(btn.dataset.value));
        document.getElementById('qpSpeedModal').style.display = 'none';
    });
    renderQpSpeedLabel();

    // --- Volume (ported from Blocks' - own state, no calibration section, headphone delay is the one
    // shared setting via metroState.latencyMs/qpPlayerRef). Mute is just volume 0 (ML-148) -
    // qpVolumeBeforeMute remembers the last non-zero value so unmuting restores it. ---
    let qpVolume = 80;
    let qpVolumeBeforeMute = 80;
    function renderQpVolumeSlider() {
        const fill = document.getElementById('qpVolumeFill');
        const thumb = document.getElementById('qpVolumeThumb');
        if (!fill || !thumb) return;
        fill.style.width = `${qpVolume}%`;
        thumb.style.left = `${qpVolume}%`;
        thumb.setAttribute('aria-valuenow', qpVolume);
        const valueEl = document.getElementById('qpVolumeValue');
        if (valueEl) valueEl.innerText = `${qpVolume}%`;
        const muted = qpVolume === 0;
        document.getElementById('qpMuteIcon').innerText = muted ? 'volume_off' : 'volume_up';
        document.getElementById('qpMuteBtn')?.setAttribute('aria-pressed', String(muted));
        document.getElementById('qpVolumeRow')?.classList.toggle('is-muted', muted);
    }
    // `force` (ML-148) bypasses the test-click throttle - see playVolumeTestClick.
    function setQpVolume(v, force = false) {
        qpVolume = Math.round(Math.min(100, Math.max(0, v)));
        if (qpVolume > 0) qpVolumeBeforeMute = qpVolume;
        qpPlayer.setVolume(qpVolume / 100);
        renderQpVolumeSlider();
        playVolumeTestClick(qpPlayer, force);
    }
    setupSliderInteraction(document.getElementById('qpVolumeTrack'), document.getElementById('qpVolumeThumb'), {
        onDragRatio: (ratio) => setQpVolume(ratio * 100),
        onArrowStep: (dir) => setQpVolume(qpVolume + dir * 5),
        onRelease: () => playVolumeTestClick(qpPlayer, true)
    });
    setupHoldStepper('qpVolumeMinus', -1, (amount) => setQpVolume(qpVolume + amount, true));
    setupHoldStepper('qpVolumePlus', 1, (amount) => setQpVolume(qpVolume + amount, true));
    makeSliderReadoutEditable('qpVolumeValue', () => qpVolume, (v) => setQpVolume(v, true), { label: 'Volume', min: 0, max: 100 });
    document.getElementById('qpMuteBtn')?.addEventListener('click', () => {
        setQpVolume(qpVolume > 0 ? 0 : (qpVolumeBeforeMute || 80), true);
    });
    document.getElementById('qpVolumeBtn')?.addEventListener('click', () => {
        renderQpVolumeSlider();
        document.getElementById('qpVolumeModal').style.display = 'flex';
    });
    function closeQpVolumePopup() {
        document.getElementById('qpVolumeModal').style.display = 'none';
    }
    document.getElementById('qpVolumeCloseBtn')?.addEventListener('click', closeQpVolumePopup);
    // ML-148: tapping the dark scrim outside the card dismisses it too - see the matching Blocks
    // comment on metroBlkVolumeModal.
    document.getElementById('qpVolumeModal')?.addEventListener('click', (e) => {
        if (e.target === e.currentTarget) closeQpVolumePopup();
    });
    renderQpVolumeSlider();

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
    // ML-103 follow-up: how a fermata sustained hold sounds (tone/silent/count) - a playback
    // preference, not per-block, so it lives here rather than in the block editor. Same
    // localStorage-only pattern as the tuner defaults above (device-local, no account sync) -
    // nothing in the metronome player reads this yet (fermata playback itself isn't wired into the
    // audio engine), this is just where a future playback engine should look.
    const FERMATA_PLAYBACK_MODE_KEY = 'fermataPlaybackMode';

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
    document.getElementById('fermataPlaybackModeSetting')?.addEventListener('change', (e) => {
        localStorage.setItem(FERMATA_PLAYBACK_MODE_KEY, e.target.value);
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

    // --- Flow/Metronome mini tuner ---
    // Shares the tunerEngine singleton above rather than running a second mic session - only one of
    // the full Tuner view / this mini widget is ever visible at a time, but they're independent
    // renderers subscribed to the same onPitch feed. One shared widget element, physically moved
    // into whichever of Flow (metroBuilderView) or Metronome (quickPlayView) is the active view (see
    // switchView) rather than a copy per screen - opening it elsewhere isn't possible, and navigating
    // away from both always closes it (see updateMetroBlkMiniTunerVisibility), same lifecycle as the
    // full Tuner view itself.
    let metroBlkMiniTunerActive = false;
    // Which instrument the mini tuner is currently reading as - seeded from the persisted Settings
    // default each time it opens, but changing it here (ML-84) only ever updates this in-memory copy,
    // never localStorage: it's a "just for this session" override, not a new default.
    let metroBlkMiniTunerInstrument = 'C';

    // One big note only, for whichever instrument is currently selected (ML-84) - showing concert AND
    // instrument readings side by side left nothing to actually read the note against without already
    // knowing which column was which, and the two-column box kept changing width as note names came
    // and go.
    function renderMetroBlkMiniTunerIdle() {
        document.getElementById('metroBlkMiniTunerNote').innerText = '–';
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

        document.getElementById('metroBlkMiniTunerNote').innerText = tunerMidiToName(writtenMidi);
        const clampedCents = Math.max(-50, Math.min(50, centsOff));
        const inTune = Math.abs(centsOff) <= TUNER_ZONE_CENTS;
        const needle = document.getElementById('metroBlkMiniTunerNeedle');
        needle.style.left = `${50 + clampedCents}%`;
        needle.classList.toggle('in-tune', inTune);
        document.getElementById('metroBlkMiniTuner').classList.toggle('in-tune', inTune);
    }
    tunerEngine.onPitch(renderMetroBlkMiniTunerPitch);

    // Short codes now, matching the picker's own button style elsewhere (B♭/E♭/F instruments,
    // C for concert pitch) - the full-name text row underneath the bar is gone (removed for height),
    // so this button is the only place the current instrument shows at all.
    const METRO_BLK_MINI_TUNER_INSTRUMENT_LABELS = { C: 'C', Bb: 'B♭', Eb: 'E♭', F: 'F' };

    // Keeps the instrument button's own text, and the popup's own "currently selected" highlight, in
    // sync with metroBlkMiniTunerInstrument - called on open and on every pick.
    function renderMetroBlkMiniTunerInstrumentBtn() {
        const label = METRO_BLK_MINI_TUNER_INSTRUMENT_LABELS[metroBlkMiniTunerInstrument] || metroBlkMiniTunerInstrument;
        document.getElementById('metroBlkMiniTunerInstrumentBtnLbl').innerText = label;
        document.querySelectorAll('#metroBlkMiniTunerInstrumentOptions .metroBlk-timesig-opt').forEach(btn => {
            btn.classList.toggle('selected', btn.dataset.value === metroBlkMiniTunerInstrument);
        });
    }

    // The instrument button opens this popup directly now (no more 3-dot menu in between - Close is
    // its own dedicated icon button beside it instead, see metroBlkMiniTunerCloseBtn below).
    function openMetroBlkMiniTunerInstrumentPicker() {
        renderMetroBlkMiniTunerInstrumentBtn();
        document.getElementById('metroBlkMiniTunerInstrumentModal').style.display = 'flex';
    }
    document.getElementById('metroBlkMiniTunerInstrumentBtn')?.addEventListener('click', openMetroBlkMiniTunerInstrumentPicker);
    document.getElementById('metroBlkMiniTunerInstrumentOptions')?.addEventListener('click', (e) => {
        const btn = e.target.closest('.metroBlk-timesig-opt');
        if (!btn) return;
        metroBlkMiniTunerInstrument = btn.dataset.value;
        renderMetroBlkMiniTunerInstrumentBtn();
        document.getElementById('metroBlkMiniTunerInstrumentModal').style.display = 'none';
    });
    document.getElementById('metroBlkMiniTunerCloseBtn')?.addEventListener('click', closeMetroBlkMiniTuner);

    // Shows/hides the top-bar toggle - visible only on a tuner-capable view (Flow/Metronome) AND only
    // while the tuner is currently closed (it disappears once open; Settings/Close live in the
    // widget's own 3-dot menu instead, so there's no second way to close it via this button). Reads
    // the current view fresh off viewStack rather than taking a parameter, so every caller (switchView,
    // starting/closing the tuner) can just call this one function instead of duplicating the check.
    function renderTopTunerToggleState() {
        const btn = document.getElementById('topTunerToggleBtn');
        if (!btn) return;
        const currentView = viewStack[viewStack.length - 1];
        const onTunerCapableView = currentView === 'metroBuilderView' || currentView === 'quickPlayView';
        btn.classList.toggle('hidden-group', !onTunerCapableView || metroBlkMiniTunerActive);
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

    // Only ever opens it now - closing happens via the tuner widget's own 3-dot menu instead (this
    // button is hidden the whole time the tuner's open, so it was never reachable to close it anyway).
    document.getElementById('topTunerToggleBtn')?.addEventListener('click', startMetroBlkMiniTuner);

    function updateMetroBlkMiniTunerVisibility(viewName) {
        if (viewName !== 'metroBuilderView' && viewName !== 'quickPlayView') {
            metroBlkMiniTunerActive = false;
            document.getElementById('metroBlkMiniTuner')?.classList.remove('metroBlk-mini-tuner-open');
        }
        renderTopTunerToggleState();
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
        return !!(timerState && timerState.running) || (typeof qpPlayer !== 'undefined' && qpPlayer.isPlaying());
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
    // just shrinks it to the top-bar indicator (see updateTopTimerIndicator) rather
    // than stopping it. State lives in `timerState`: null when idle, otherwise
    // { targetSeconds, remainingSeconds, elapsedSeconds, running, openEnded }.
    // ML-184: "Open ended" (targetSeconds/remainingSeconds both null, openEnded true) counts up
    // instead of down and never finishes itself - timerTick just keeps banking elapsedSeconds until
    // Stop is pressed. Every display that normally reads "remaining .../left" reads elapsed/"done"
    // instead while openEnded is set - see updateTimerDisplays.
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

    // ML-129 follow-up: the timer's collapsed top-bar state is exactly one of three things - nothing,
    // the idle icon (next to the tuner toggle, no timer running/paused yet), or the running pill
    // (also next to the tuner toggle, sized to its own content - it no longer replaces the title) -
    // and never any of them while the inline popup itself is open, or the Timer screen itself is the
    // active view (that page already shows everything).
    let timerInlineBoxOpen = false;
    function updateTopTimerIndicator(viewName) {
        const onTimerView = viewName === 'timerView';
        const showPill = !!timerState && !timerInlineBoxOpen && !onTimerView;
        const showIcon = !timerState && !timerInlineBoxOpen && !onTimerView;
        document.getElementById('topTimerPill')?.classList.toggle('hidden-group', !showPill);
        document.getElementById('topTimerIconBtn')?.classList.toggle('hidden-group', !showIcon);
    }

    function updateTimerPlayIcons() {
        const running = !!(timerState && timerState.running);
        const label = running ? 'Pause' : 'Play';
        const icon = running ? 'pause' : 'play_arrow';
        const fullIcon = document.getElementById('timerPlayIcon');
        const fullBtn = document.getElementById('timerPlayBtn');
        if (fullIcon) fullIcon.innerText = icon;
        if (fullBtn) fullBtn.setAttribute('aria-label', label);
        // The inline box's Play cell doubles as "Start" until a session actually exists.
        const inlineIcon = document.getElementById('timerInlinePlayIcon');
        const inlineLbl = document.getElementById('timerInlinePlayLbl');
        const inlineBtn = document.getElementById('timerInlinePlayBtn');
        if (inlineIcon) inlineIcon.innerText = timerState ? icon : 'play_arrow';
        if (inlineLbl) inlineLbl.innerText = timerState ? (running ? 'pause' : 'play') : 'start';
        if (inlineBtn) inlineBtn.setAttribute('aria-label', timerState ? label : 'Start');
        // Soft amber glow while actually running (not paused) - visually confirms time is
        // accumulating without an extra banner.
        document.getElementById('topTimerPill')?.classList.toggle('top-bar-timer-pill-running', running);
    }

    // ML-184: every "remaining .../left" slot shows elapsed/"done" instead once openEnded - there's no
    // countdown to be remaining from. primarySeconds is whichever of the two that slot actually means
    // right now. Open-ended also hides the standalone top card entirely (renderTimerScreen) rather
    // than showing that same elapsed figure a second time - "This session" below takes over as the
    // one combined display, relabelled "Time done" here to match.
    function updateTimerDisplays() {
        if (!timerState) return;
        const openEnded = timerState.openEnded;
        const primarySeconds = openEnded ? timerState.elapsedSeconds : timerState.remainingSeconds;
        const remainingEl = document.getElementById('timerRemainingDisplay');
        const elapsedEl = document.getElementById('timerElapsedDisplay');
        const todayEl = document.getElementById('timerTodayDisplay');
        if (remainingEl) remainingEl.innerText = formatClock(primarySeconds);
        if (elapsedEl) elapsedEl.innerText = formatClock(timerState.elapsedSeconds);
        if (todayEl) todayEl.innerText = formatClock(getTimerTodaySeconds());
        const remainingLabelEl = document.getElementById('timerRemainingLabel');
        if (remainingLabelEl) remainingLabelEl.innerText = openEnded ? 'Time done' : 'Time left in session';
        const elapsedLabelEl = document.getElementById('timerElapsedLabel');
        if (elapsedLabelEl) elapsedLabelEl.innerText = openEnded ? 'Time done' : 'This session';

        // The pill only has room for one figure, per the request ("has the time remaining") -
        // elapsed/"today" stay full-screen-only (timerElapsedDisplay/timerTodayDisplay above).
        const pillRemainingEl = document.getElementById('topTimerPillRemaining');
        if (pillRemainingEl) pillRemainingEl.innerText = formatClock(primarySeconds);
        const pillLeftLbl = document.getElementById('topTimerPillLeftLbl');
        if (pillLeftLbl) pillLeftLbl.innerText = openEnded ? 'done' : 'left';
        const inlineRemainingEl = document.getElementById('timerInlineRemainingLbl');
        if (inlineRemainingEl) inlineRemainingEl.innerText = formatClock(primarySeconds);
        const inlineLeftLbl = document.getElementById('timerInlineLeftLbl');
        if (inlineLeftLbl) inlineLeftLbl.innerText = openEnded ? 'done' : 'left';
    }

    // --- Inline box (ML-129 follow-up) - opened by tapping either the running pill or the idle
    // icon, stays open across navigation (it lives in .top-bar-sticky-group, same as the metronome
    // mini-bars), and keeps the timer counting down regardless of whether it's open or closed. ---

    // Staged duration, only meaningful while idle - Start reads this, the picker modal sets it.
    let timerPickedMinutes = null;

    function renderTimerInlineBox() {
        const running = !!timerState;
        document.getElementById('timerInlinePickBtn')?.classList.toggle('hidden-group', running);
        document.getElementById('timerInlineTimeDisplay')?.classList.toggle('hidden-group', !running);
        // Just the number now (no "min" suffix) - "XX min." was overflowing the fixed-width cell,
        // same reason the label underneath now says "minutes" instead of "duration".
        const pickLbl = document.getElementById('timerInlinePickLbl');
        if (pickLbl) pickLbl.innerText = timerPickedMinutes === 'open-ended' ? 'Open' : (timerPickedMinutes ? String(timerPickedMinutes) : 'Pick');
        const stopBtn = document.getElementById('timerInlineStopBtn');
        if (stopBtn) stopBtn.disabled = !running;
        updateTimerPlayIcons();
        if (running) updateTimerDisplays();
    }

    function openTimerInlineBox() {
        timerInlineBoxOpen = true;
        document.getElementById('timerInlineBox').style.display = 'flex';
        updateTopTimerIndicator(viewStack[viewStack.length - 1]);
        renderTimerInlineBox();
    }
    // Never stops the timer itself - just hides the popup again, same as the request ("This can be
    // kept open, and the timer will keep going... you can continue to use the screen as normal").
    function closeTimerInlineBox() {
        timerInlineBoxOpen = false;
        document.getElementById('timerInlineBox').style.display = 'none';
        updateTopTimerIndicator(viewStack[viewStack.length - 1]);
    }
    document.getElementById('topTimerPill')?.addEventListener('click', openTimerInlineBox);
    document.getElementById('topTimerIconBtn')?.addEventListener('click', openTimerInlineBox);
    document.getElementById('timerInlineCloseBtn')?.addEventListener('click', closeTimerInlineBox);
    // Tapping the backdrop (not the popup card itself) closes it too, per the request - the countdown
    // keeps going in the top pill either way.
    document.getElementById('timerInlineBox')?.addEventListener('click', (e) => {
        if (e.target.id === 'timerInlineBox') closeTimerInlineBox();
    });

    document.getElementById('timerInlinePlayBtn')?.addEventListener('click', () => {
        if (!timerState) {
            if (!timerPickedMinutes) { showWarningToast('Pick a duration first!'); return; }
            startTimerSession(timerPickedMinutes === 'open-ended' ? null : timerPickedMinutes * 60);
        } else {
            toggleTimerPlayPause();
        }
        renderTimerInlineBox();
    });
    document.getElementById('timerInlineStopBtn')?.addEventListener('click', finishTimerSession);

    // --- Duration picker modal (ML-129 follow-up) - only reachable from the inline box's "pick
    // duration" cell while idle. Its own copy of the duration radios (timerPickerDur* ids, populated
    // by renderDurationRadios above) rather than sharing timerDurationRadios' DOM nodes with the full
    // Timer page, so each stays independently usable regardless of which one is on screen. ---
    document.getElementById('timerInlinePickBtn')?.addEventListener('click', () => {
        document.querySelectorAll('input[name="timerPickerDurationOption"]').forEach(r => { r.checked = false; });
        document.getElementById('timerPickerCustomDurationGroup')?.classList.add('hidden-group');
        if (timerPickedMinutes) {
            const matching = document.getElementById(`timerPickerDur-${timerPickedMinutes}`);
            if (matching) {
                matching.checked = true;
            } else {
                const customRadio = document.getElementById('timerPickerDur-custom');
                if (customRadio) customRadio.checked = true;
                document.getElementById('timerPickerCustomDurationGroup')?.classList.remove('hidden-group');
                const customInput = document.getElementById('timerPickerCustomDuration');
                if (customInput) customInput.value = timerPickedMinutes;
            }
        }
        document.getElementById('timerDurationPickerModal').style.display = 'flex';
    });
    document.getElementById('timerPickerDurationRadios')?.addEventListener('change', (e) => {
        if (e.target.name !== 'timerPickerDurationOption') return;
        const customGroup = document.getElementById('timerPickerCustomDurationGroup');
        if (e.target.value === 'custom') {
            customGroup.classList.remove('hidden-group');
            document.getElementById('timerPickerCustomDuration')?.focus();
        } else {
            customGroup.classList.add('hidden-group');
        }
    });
    function closeTimerDurationPickerModal() {
        document.getElementById('timerDurationPickerModal').style.display = 'none';
    }
    document.getElementById('timerDurationPickerXBtn')?.addEventListener('click', closeTimerDurationPickerModal);
    document.getElementById('timerDurationPickerCancelBtn')?.addEventListener('click', closeTimerDurationPickerModal);
    document.getElementById('timerDurationPickerSaveBtn')?.addEventListener('click', () => {
        const radio = document.querySelector('input[name="timerPickerDurationOption"]:checked')?.value;
        if (radio === 'open-ended') {
            timerPickedMinutes = 'open-ended';
            closeTimerDurationPickerModal();
            renderTimerInlineBox();
            return;
        }
        const mins = Number(radio === 'custom' ? document.getElementById('timerPickerCustomDuration')?.value : radio);
        if (!mins || isNaN(mins) || mins <= 0) { showWarningToast('Pick a duration first!'); return; }
        timerPickedMinutes = mins;
        closeTimerDurationPickerModal();
        renderTimerInlineBox();
    });

    // Syncs the full-screen Timer view to whatever timerState currently is -
    // called on entering the view, so navigating back mid-session shows the
    // running controls rather than resetting to the picker.
    function renderTimerScreen() {
        document.getElementById('timerSetupGroup')?.classList.toggle('hidden-group', !!timerState);
        document.getElementById('timerRunningGroup')?.classList.toggle('hidden-group', !timerState);
        if (timerState) {
            // ML-184 follow-up: see the card's own HTML comment - open-ended combines into "This
            // session" below instead of showing the same elapsed figure twice.
            document.getElementById('timerRemainingCard')?.classList.toggle('hidden-group', !!timerState.openEnded);
            updateTimerDisplays();
            updateTimerPlayIcons();
        }
    }

    function timerTick() {
        if (!timerState || !timerState.running) return;
        timerState.elapsedSeconds++;
        addTimerTodaySeconds(1);
        // ML-184: open-ended never runs out on its own - just keep banking elapsed time until Stop.
        if (timerState.openEnded) {
            updateTimerDisplays();
            return;
        }
        timerState.remainingSeconds--;
        updateTimerDisplays();
        if (timerState.remainingSeconds <= 0) finishTimerSession();
    }

    // targetSeconds is null for an open-ended session (ML-184) - no countdown, so remainingSeconds
    // stays null too and is never read while openEnded (see timerTick/updateTimerDisplays).
    function startTimerSession(targetSeconds) {
        const openEnded = targetSeconds === null;
        timerState = { targetSeconds, remainingSeconds: openEnded ? null : targetSeconds, elapsedSeconds: 0, running: true, openEnded };
        clearInterval(timerIntervalId);
        timerIntervalId = setInterval(timerTick, 1000);
        renderTimerScreen();
        // Not hardcoded to 'timerView' any more - this can now also be reached from the inline box
        // while on some other screen entirely, so the indicator has to reflect whichever view is
        // actually active (it stays hidden regardless while the box itself is open).
        updateTopTimerIndicator(viewStack[viewStack.length - 1]);
        syncWakeLock();
    }

    function toggleTimerPlayPause() {
        if (!timerState) return;
        timerState.running = !timerState.running;
        updateTimerPlayIcons();
        syncWakeLock();
    }

    // ML-185: carries the elapsed time (and enough of the original session's shape to resume it)
    // from finishTimerSession into the "session finished" popup's own button handlers below, so
    // "Just another 5 minutes" can rebuild timerState from exactly where it left off.
    let timerPendingFinish = null;

    // Ends the current timer (whether the countdown ran out, or Stop/Close was
    // pressed early) and - if any real time was logged - offers to save it as a
    // practice session via the existing save-session screen, pre-filled.
    function finishTimerSession() {
        if (!timerState) return;
        clearInterval(timerIntervalId);
        timerIntervalId = null;
        const { elapsedSeconds, openEnded, targetSeconds } = timerState;
        timerState = null;
        renderTimerScreen();
        // Also closes the inline box if it was open - nothing left for it to control once the
        // session has actually ended (recomputes the top-bar indicator either way).
        closeTimerInlineBox();
        syncWakeLock();

        if (elapsedSeconds < 1) return;
        timerPendingFinish = { elapsedSeconds, openEnded, targetSeconds };
        openTimerFinishedModal();
    }

    function openTimerFinishedModal() {
        const minutes = Math.max(1, Math.round(timerPendingFinish.elapsedSeconds / 60));
        document.getElementById('timerFinishedMessage').innerText = `Would you like to store this ${minutes} minute session as a practice session?`;
        document.getElementById('timerFinishedModal').style.display = 'flex';
    }
    function closeTimerFinishedModal() {
        document.getElementById('timerFinishedModal').style.display = 'none';
    }
    document.getElementById('timerFinishedYesBtn')?.addEventListener('click', () => {
        if (!timerPendingFinish) return closeTimerFinishedModal();
        const minutes = Math.max(1, Math.round(timerPendingFinish.elapsedSeconds / 60));
        timerPendingFinish = null;
        closeTimerFinishedModal();
        prefillEntryFormForTimer(minutes);
        switchView('entryForm');
    });
    document.getElementById('timerFinishedNoBtn')?.addEventListener('click', () => {
        timerPendingFinish = null;
        closeTimerFinishedModal();
    });
    // ML-185's "snooze" button - resumes from exactly the elapsed time already banked (not a fresh
    // 0:00), so however many times this gets pressed in a row, the total offered for saving next
    // keeps growing by 5 minutes each time rather than resetting. A countdown session gets 5 more
    // minutes added to its target and remaining; an open-ended one just keeps counting up (there was
    // never a target to extend).
    document.getElementById('timerFinishedExtendBtn')?.addEventListener('click', () => {
        if (!timerPendingFinish) return closeTimerFinishedModal();
        const { elapsedSeconds, openEnded, targetSeconds } = timerPendingFinish;
        timerPendingFinish = null;
        closeTimerFinishedModal();
        timerState = {
            targetSeconds: openEnded ? null : (targetSeconds || 0) + 300,
            remainingSeconds: openEnded ? null : 300,
            elapsedSeconds,
            running: true,
            openEnded
        };
        clearInterval(timerIntervalId);
        timerIntervalId = setInterval(timerTick, 1000);
        renderTimerScreen();
        updateTopTimerIndicator(viewStack[viewStack.length - 1]);
        syncWakeLock();
    });

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
        if (radio === 'open-ended') { startTimerSession(null); return; }
        const mins = Number(radio === 'custom' ? document.getElementById('timerCustomDuration')?.value : radio);
        if (!mins || isNaN(mins) || mins <= 0) { showWarningToast('Pick a duration first!'); return; }
        startTimerSession(mins * 60);
    });

    document.getElementById('timerPlayBtn')?.addEventListener('click', toggleTimerPlayPause);
    document.getElementById('timerStopBtn')?.addEventListener('click', finishTimerSession);

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
