    const API_BASE_URL = 'http://localhost:3000';

    // ========================================
    // AUTHENTICATION & TOKEN MANAGEMENT
    // ========================================
    class AuthManager {
        constructor() {
            this.token = localStorage.getItem('firebaseToken');
            this.userId = localStorage.getItem('userId');
            this.isAuthenticated = !!this.token;
        }

        async login() {
            const authUrl = `${API_BASE_URL}/auth/login`;
            window.location.href = authUrl;
        }

        async handleCallback() {
            const params = new URLSearchParams(window.location.search);
            const token = params.get('firebaseToken');
            const userId = params.get('userId');

            if (token && userId) {
                localStorage.setItem('firebaseToken', token);
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
            localStorage.removeItem('firebaseToken');
            localStorage.removeItem('userId');
            this.token = null;
            this.userId = null;
            this.isAuthenticated = false;
            window.location.href = `${API_BASE_URL}/auth/logout`;
        }

        getAuthHeader() {
            return this.token ? { 'Authorization': `Bearer ${this.token}` } : {};
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

        if (body && (method === 'POST' || method === 'PUT')) {
            options.body = JSON.stringify(body);
        }

        const response = await fetch(`${API_BASE_URL}${endpoint}`, options);

        if (!response.ok) {
            const error = await response.json().catch(() => ({}));
            throw new Error(error.error || `API error: ${response.status}`);
        }

        return await response.json();
    }

    // API endpoint wrappers
    const API = {
        sessions: {
            get: () => apiCall('/api/sessions'),
            create: (data) => apiCall('/api/sessions', 'POST', data),
            update: (id, data) => apiCall(`/api/sessions/${id}`, 'PUT', data),
            delete: (id) => apiCall(`/api/sessions/${id}`, 'DELETE')
        },
        challenges: {
            get: () => apiCall('/api/challenges'),
            create: (data) => apiCall('/api/challenges', 'POST', data),
            update: (id, data) => apiCall(`/api/challenges/${id}`, 'PUT', data),
            delete: (id) => apiCall(`/api/challenges/${id}`, 'DELETE')
        },
        settings: {
            get: () => apiCall('/api/settings'),
            addOrganisation: (name) => apiCall('/api/settings/organisations', 'POST', { name }),
            addTeacher: (name) => apiCall('/api/settings/teachers', 'POST', { name }),
            deleteOrganisation: (name) => apiCall(`/api/settings/organisations/${encodeURIComponent(name)}`, 'DELETE'),
            deleteTeacher: (name) => apiCall(`/api/settings/teachers/${encodeURIComponent(name)}`, 'DELETE')
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

    async function initializeApp() {
        // Check if coming back from OAuth callback
        if (await auth.handleCallback()) {
            console.log('OAuth callback processed');
        }

        // Check authentication
        if (!auth.isAuthenticated) {
            showWarningToast('Please log in');
            displayLoginScreen();
            return;
        }

        try {
            await loadAppData();
            fetchDataAndRender();
            document.getElementById('date').valueAsDate = new Date();
            if (localStorage.getItem('darkMode') === 'true') {
                document.body.classList.add('dark-mode');
                document.getElementById('darkModeToggle').checked = true;
            }
        } catch (error) {
            showWarningToast('Failed to initialize app: ' + error.message);
            displayLoginScreen();
        }
    }

    function displayLoginScreen() {
        document.getElementById('mainContainer').style.display = 'none';
        document.getElementById('loginScreen').style.display = 'flex';
    }

    function displayMainApp() {
        document.getElementById('loginScreen').style.display = 'none';
        document.getElementById('mainContainer').style.display = 'block';
    }

    document.getElementById('loginBtn')?.addEventListener('click', () => auth.login());
    document.getElementById('logoutBtn')?.addEventListener('click', () => auth.logout());

    async function loadAppData() {
        try {
            appData = await API.settings.get();
            populateWhoDropdowns();
        } catch (error) {
            console.warn('Failed to load settings:', error);
            appData = { organisations: [], teachers: [] };
        }
    }

    function populateWhoDropdowns() {
        const cWho = document.getElementById('cWho');
        if (!cWho) return;
        cWho.innerHTML = '<option value="">None</option>';
        appData.organisations.forEach(org => {
            let safeOrg = String(org).replace(/'/g, "\\'").replace(/"/g, "&quot;");
            cWho.innerHTML += `<option value="${safeOrg}">${org}</option>`;
        });
    }

    function fetchDataAndRender() {
        Promise.all([
            API.sessions.get().then(data => { rawData = data; renderAllViews(); }),
            loadChallenges()
        ]).catch(err => showWarningToast('Error loading data: ' + err.message));
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
    const views = ['mainView', 'historyView', 'statsView', 'entryForm', 'manageListsView', 'settingsView', 'manageChallengesView', 'challengeSelectView', 'challengePlayView', 'challengeSummaryView', 'editChallengeView'];
    let viewStack = ['mainView'];

    const viewAliasMap = {
        'main': 'mainView', 'history': 'historyView', 'stats': 'statsView', 'addForm': 'entryForm',
        'lists': 'manageListsView', 'settings': 'settingsView', 'challengesList': 'manageChallengesView',
        'challengeSelect': 'challengeSelectView', 'challengePlay': 'challengePlayView',
        'challengeSummary': 'challengeSummaryView', 'editChallenge': 'editChallengeView'
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
        if (viewName === 'statsView') { document.getElementById('topTitle').innerText = 'Detailed stats'; scrollStatsToRight(); }
        if (viewName === 'entryForm') { document.getElementById('topTitle').innerText = 'Add record'; document.getElementById('duration').focus(); }
        if (viewName === 'manageListsView') { document.getElementById('topTitle').innerText = 'Manage lists'; renderManageLists(); }
        if (viewName === 'settingsView') { document.getElementById('topTitle').innerText = 'Settings'; }
        if (viewName === 'manageChallengesView') { document.getElementById('topTitle').innerText = 'Manage challenges'; renderChallengesList(); }
        if (viewName === 'challengeSelectView') { document.getElementById('topTitle').innerText = 'Select challenge'; renderChallengeSelect(); }
        if (viewName === 'challengePlayView') { document.getElementById('topTitle').innerText = 'Practise'; }
        if (viewName === 'challengeSummaryView') { document.getElementById('topTitle').innerText = 'Session complete'; topBackBtn.classList.add('hidden-btn'); }
        if (viewName === 'editChallengeView') { document.getElementById('topTitle').innerText = 'Edit challenge'; }
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
                if(c.status === 'Complete') groups[c.id].complete++;
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
                if(c.status !== 'Complete') groups[c.id].incomplete++;
            });

            Object.values(groups).forEach(g => {
                if (g.incomplete > 0) {
                    const typeIcon = g.type === 'Performance' ? '🎭' : '🛠️';
                    const typeColor = g.type === 'Performance' ? 'var(--cat-performance)' : 'var(--cat-lesson)';
                    ui.innerHTML += `<button class="history-item" style="border-left-color: ${typeColor}; padding-left:5px; width:100%; text-align:left; cursor:pointer;" onclick="startChallenge('${g.id}')">
                        <div><strong>${typeIcon} ${g.name}</strong></div>
                        <div style="font-size:0.85rem; color:#666;">${g.incomplete} incomplete tasks</div>
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
                    await API.challenges.update(editChallengeMeta.id, { name: newName });
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

    window.deleteEntireChallenge = function() {
        const items = allChallenges.filter(c => c.id == editChallengeMeta.id);
        const count = items.length;
        showConfirmModal('Delete challenge', `Are you sure? This will remove the challenge and all ${count} tasks.`, async () => {
            showInfoToast("Deleting challenge...");
            try {
                await API.challenges.delete(editChallengeMeta.id);
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

            let completeCount = items.filter(i => i.status === 'Complete').length;
            let totalTime = items.reduce((sum, i) => sum + (i.timeSpent || 0), 0);
            if(ecStats) ecStats.innerText = `${completeCount} / ${items.length} tasks complete | ${formatMins(totalTime)} total time`;

            let showCompleted = document.getElementById('toggleShowCompletedItems')?.checked;
            ecItemsList.innerHTML = '';

            items.forEach(item => {
                if(!showCompleted && item.status === 'Complete') return;
                let refStr = item.ref || '';
                if (item.barFrom || item.barTo) refStr += ` (Bars ${item.barFrom || '?'} - ${item.barTo || '?'})`;
                let safePiece = String(item.piece).replace(/'/g, "\\'").replace(/"/g, "&quot;");

                ecItemsList.innerHTML += `
                <div class="history-item draggable-item" draggable="true" data-id="${item.id}" style="align-items:center; border-left: 4px solid ${item.status === 'Complete' ? 'var(--success-color)' : 'var(--primary-action)'}; padding-left:5px;">
                    <span class="drag-handle" title="Drag to reorder">☰</span>
                    <div style="flex-grow:1;">
                        <div style="display:flex; justify-content:space-between; width:100%;">
                            <strong>${item.piece}</strong>
                            <span style="font-size:0.85rem; color:#888;">${item.status}</span>
                        </div>
                        <div style="font-size:0.85rem; color:#666; margin-bottom:10px;">${refStr} ${item.bpm ? '| '+item.bpm+' bpm' : ''}</div>
                        <div style="display:flex; gap:5px; width:100%;">
                            <button class="btn-edit" style="flex:1" onclick="openItemDetailModal('${item.id}')">Edit</button>
                            <button class="btn-delete" style="flex:1" onclick="deleteChallengeItem('${item.id}', '${safePiece}')">Delete</button>
                        </div>
                    </div>
                </div>`;
            });
            setupDragAndDrop(ecItemsList, 'item');
        } catch(err) { showWarningToast("Error loading challenge editor: " + err.message); }
    }

    window.openItemDetailModal = function(id = null) {
        const modal = document.getElementById('itemDetailModal');
        const title = document.getElementById('itemModalTitle');
        document.getElementById('itemEditId').value = id || '';
        if(id) {
            title.innerText = "Edit task";
            const item = allChallenges.find(c => c.id == id);
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
        const id = document.getElementById('itemEditId').value;
        const piece = document.getElementById('iPiece')?.value;
        if(!piece) return showWarningToast("Task piece name is required!");

        const ref = document.getElementById('iRef')?.value;
        const bf = document.getElementById('iBarFrom')?.value;
        const bt = document.getElementById('iBarTo')?.value;
        const bpm = document.getElementById('iBPM')?.value;

        const btn = document.getElementById('saveItemBtn');
        btn.innerText = "Saving...";
        btn.disabled = true;

        try {
            if (id) {
                await API.challenges.update(editChallengeMeta.id, {
                    items: [{
                        id,
                        piece,
                        ref: ref || '',
                        barFrom: bf || '',
                        barTo: bt || '',
                        bpm: bpm || ''
                    }]
                });
            } else {
                await API.challenges.update(editChallengeMeta.id, {
                    items: [{
                        piece,
                        ref: ref || '',
                        barFrom: bf || '',
                        barTo: bt || '',
                        bpm: bpm || ''
                    }]
                });
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

    window.deleteChallengeItem = function(id, pieceName) {
        showConfirmModal('Delete task', `Delete "${pieceName}"?`, async () => {
            showInfoToast("Deleting...");
            try {
                await API.challenges.update(editChallengeMeta.id, { deleteItem: id });
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
        activeChallengeItems = allChallenges.filter(c => c.id == id && c.status !== 'Complete');
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
    }

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
            await API.challenges.update(item.id, {
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
            const dObj = parseDateSafely(d.date);
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
                let opts = (cat === 'Lesson') ? appData.teachers : appData.organisations;
                opts.forEach(item => {
                    let safeItem = String(item).replace(/'/g, "\\'").replace(/"/g, "&quot;");
                    whoSelect.innerHTML += `<option value="${safeItem}">${item}</option>`;
                });
            }
        }
    });

    document.getElementById('submitBtn')?.addEventListener('click', async () => {
        const cat = document.querySelector('input[name="category"]:checked')?.value;
        const dur = document.getElementById('duration')?.value;
        const dStr = document.getElementById('date')?.value;
        const who = !document.getElementById('whoGroup')?.classList.contains('hidden-group') ? document.getElementById('who')?.value : '';

        if (!dur) { showWarningToast('Duration required!'); return; }

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
                const dateKey = new Date(d.date).toISOString().split('T')[0];
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
            let minDateObj = rawData.length > 0 ? parseDateSafely(rawData[rawData.length-1].date) : today;
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

            let minDate = parseDateSafely(rawData[rawData.length-1].date);
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
                const dateStr = new Date(d.date).toISOString().split('T')[0];
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
                let dObj = parseDateSafely(d.date);
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

                let dObj = parseDateSafely(item.date);
                let safeWho = String(item.who || '').replace(/'/g, "\\'").replace(/"/g, "&quot;");
                let mNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

                div.innerHTML = `
                    <div class="history-details">
                        <strong style="color: ${colorMap[item.category]}">${item.category} ${item.who ? '('+item.who+')' : ''}</strong>
                        ${dObj.getDate() || '?'} ${mNames[dObj.getMonth()] || '?'} ${dObj.getFullYear() || '?'} | ${Math.round(item.duration)} mins
                    </div>
                    <div style="display:flex; gap: 5px;">
                        <button class="btn-edit" onclick="openEdit('${item.id}', '${item.category}')">Edit</button>
                        <button class="btn-delete" onclick="deleteHistory('${item.id}', '${item.category}', '${item.duration}', '${safeWho}')">Delete</button>
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
    function renderManageLists() {
        const orgList = document.getElementById('orgList');
        if(orgList) {
            orgList.innerHTML = '';
            appData.organisations.forEach(org => {
                let safeOrg = String(org).replace(/'/g, "\\'").replace(/"/g, "&quot;");
                orgList.innerHTML += `<div class="history-item"><span>${org}</span><div style="display:flex; gap:5px;"><button class="btn-edit" onclick="editListItem('organisations', '${safeOrg}')">Edit</button><button class="btn-delete" onclick="deleteListItem('organisations', '${safeOrg}')">Delete</button></div></div>`;
            });
        }

        const teacherList = document.getElementById('teacherList');
        if(teacherList) {
            teacherList.innerHTML = '';
            appData.teachers.forEach(t => {
                let safeT = String(t).replace(/'/g, "\\'").replace(/"/g, "&quot;");
                teacherList.innerHTML += `<div class="history-item"><span>${t}</span><div style="display:flex; gap:5px;"><button class="btn-edit" onclick="editListItem('teachers', '${safeT}')">Edit</button><button class="btn-delete" onclick="deleteListItem('teachers', '${safeT}')">Delete</button></div></div>`;
            });
        }
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
                appData = await API.settings.get();
                input.value = '';
                renderManageLists();
                showSuccessToast('Added successfully');
            } catch (error) {
                showWarningToast("Error adding item: " + error.message);
            }
        }
    }

    window.editListItem = function(type, oldName) {
        showPromptModal(`Rename ${oldName}`, oldName, async (newName) => {
            if (newName && newName !== oldName) {
                showInfoToast('Updating...');
                try {
                    // Delete old and add new
                    if (type === 'teachers') {
                        await API.settings.deleteTeacher(oldName);
                        await API.settings.addTeacher(newName);
                    } else {
                        await API.settings.deleteOrganisation(oldName);
                        await API.settings.addOrganisation(newName);
                    }
                    appData = await API.settings.get();
                    renderManageLists();
                    fetchDataAndRender();
                    showSuccessToast('Name updated');
                } catch (error) {
                    showWarningToast("Error updating name: " + error.message);
                }
            }
        });
    }

    window.deleteListItem = function(type, name) {
        showConfirmModal('Delete item', `Are you sure you want to delete ${name}?`, async () => {
            showInfoToast('Deleting...');
            try {
                if (type === 'teachers') {
                    await API.settings.deleteTeacher(name);
                } else {
                    await API.settings.deleteOrganisation(name);
                }
                appData = await API.settings.get();
                renderManageLists();
                showSuccessToast('Deleted successfully');
            } catch (error) {
                showWarningToast("Error deleting item: " + error.message);
            }
        });
    }

    document.getElementById('prevMonthBtn')?.addEventListener('click', () => {
        currentHistDate.setMonth(currentHistDate.getMonth() - 1);
        renderHistoryList(rawData.filter(d=>activeFilters[d.category]));
    });
    document.getElementById('nextMonthBtn')?.addEventListener('click', () => {
        currentHistDate.setMonth(currentHistDate.getMonth() + 1);
        renderHistoryList(rawData.filter(d=>activeFilters[d.category]));
    });

    window.deleteHistory = function(id, cat, dur, who) {
        let mNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
        let detailStr = `${cat} for ${dur} mins`;
        if (who) detailStr += ` with ${who}`;
        showConfirmModal('Delete entry', `Are you sure you want to delete this entry?\n\n${detailStr}`, async () => {
            showInfoToast('Deleting...');
            try {
                await API.sessions.delete(id);
                showSuccessToast('Entry deleted');
                fetchDataAndRender();
            } catch (error) {
                showWarningToast("Delete error: " + error.message);
            }
        });
    }

    window.openEdit = async function(id, cat) {
        const session = rawData.find(s => s.id === id);
        if (!session) return showWarningToast('Session not found');

        document.getElementById('editCat').value = cat;
        document.getElementById('editId').value = id;
        document.getElementById('editDate').value = new Date(session.date).toISOString().split('T')[0];
        document.getElementById('editDuration').value = session.duration;

        const group = document.getElementById('editWhoGroup');
        const sel = document.getElementById('editWho');
        if(!sel) return;
        sel.innerHTML = '';

        if (cat === 'Practise') {
            group.classList.add('hidden-group');
        } else {
            group.classList.remove('hidden-group');
            let opts = (cat === 'Lesson') ? appData.teachers : appData.organisations;
            opts.forEach(item => {
                let safeItem = String(item).replace(/'/g, "\\'").replace(/"/g, "&quot;");
                sel.innerHTML += `<option value="${safeItem}">${item}</option>`;
            });
            if(session.who) sel.value = session.who;
        }
        document.getElementById('editModal').style.display = 'flex';
    }

    document.getElementById('saveEditBtn')?.addEventListener('click', async () => {
        const id = document.getElementById('editId').value;
        const cat = document.getElementById('editCat').value;
        const dur = document.getElementById('editDuration').value;
        const dStr = document.getElementById('editDate').value;
        const who = !document.getElementById('editWhoGroup')?.classList.contains('hidden-group') ? document.getElementById('editWho')?.value : '';

        if(!dur) return showWarningToast('Duration required!');

        const btn = document.getElementById('saveEditBtn');
        btn.innerText = 'Updating...';
        btn.disabled = true;

        try {
            await API.sessions.update(id, {
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
