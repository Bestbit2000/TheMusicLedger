// ML-198: Admin -> Design. A read-only visual catalogue of the design system.
//
// - Foundations are built live from tokens.css (fetched and parsed on open), so a new or changed
//   token shows up here automatically.
// - Components are rendered with the real app classes from style.css/admin.css, grouped by type.
//   Each example is annotated with the spacing/radius/type/colour tokens it actually resolves to
//   (read from getComputedStyle), and anything that doesn't match a token is flagged with a warning.
// - Every spec in specs/components/ must have an entry below (`spec: '<file name>'`) - the design
//   gate (scripts/design-gate.mjs) fails the release otherwise. New component in a release =
//   new spec + new entry here.
(function () {
    'use strict';

    // ------------------------------------------------------------------ component catalogue
    // Each item: { spec, title, examples: [{ label, html, measure?, wide? }] }.
    // `measure` = selector(s) inside the example to annotate (default: the example's first element).
    // Positions/heights in style="" below are data-driven geometry (as the app sets from JS), not tokens.

    const dot = (cls, left, extra = '') => `<span class="metro-dot ${cls}" style="left:${left}%">${extra}</span>`;
    const tier = (dots) => `<div class="metro-tier">${dots}</div>`;
    const heatCol = (levels) => `<div class="heat-col">${levels.map(l => `<div class="heat-cell h-time-${l}"></div>`).join('')}</div>`;

    const GROUPS = [
        {
            title: 'Actions',
            items: [
                { spec: 'button', title: 'Buttons', examples: [
                    { label: 'Primary (.btn-submit)', html: '<button class="btn-submit" type="button">Save session</button>' },
                    { label: 'Primary, large (.btn-large)', html: '<button class="btn-large" type="button">Start a challenge</button>' },
                    { label: 'Navigation (.btn-nav)', html: '<button class="btn-nav" type="button">View stats <span class="btn-nav-arrow">›</span></button>' },
                    { label: 'Secondary / cancel (.btn-nav.btn-cancel) next to a primary', html: '<div class="flex-row gap-md"><button class="btn-nav btn-cancel" type="button">Cancel</button><button class="btn-submit" type="button">Save</button></div>', measure: '.flex-row, .btn-cancel' },
                    { label: 'Tertiary (.btn-text) and destructive tertiary (.btn-text-danger)', html: '<div><button class="btn-text" type="button">Show more options</button><button class="btn-text btn-text-danger" type="button">Delete this flow</button></div>', measure: '.btn-text' },
                    { label: 'Inline row actions (.btn-edit / .btn-delete)', html: '<div class="flex-row gap-sm"><button class="btn-edit" type="button">Edit</button><button class="btn-delete" type="button">Delete</button></div>', measure: '.btn-edit, .btn-delete' },
                    { label: 'Disabled', html: '<button class="btn-submit" type="button" disabled>Save session</button>' },
                ] },
                { spec: 'icon-button', title: 'Icon buttons', examples: [
                    { label: 'Row actions: edit / copy / delete (circle)', html: '<div class="flex-row gap-md"><button class="btn-icon-edit" type="button" aria-label="Edit"><span class="material-symbols-outlined">edit</span></button><button class="btn-icon-copy" type="button" aria-label="Copy"><span class="material-symbols-outlined">content_copy</span></button><button class="btn-icon-delete" type="button" aria-label="Delete"><span class="material-symbols-outlined">delete</span></button></div>', measure: '.flex-row, .btn-icon-edit' },
                    { label: 'More menu (.list-item-menu-btn)', html: '<button class="list-item-menu-btn" type="button" aria-label="More" aria-haspopup="menu" aria-expanded="false"><span class="material-symbols-outlined">more_vert</span></button>' },
                    { label: 'Transport (square, .metro-transport-btn)', html: '<div class="metro-transport-row"><button class="metro-transport-btn metro-play-btn" type="button" aria-label="Play"><span class="material-symbols-outlined">play_arrow</span></button><button class="metro-transport-btn metro-stop-btn" type="button" aria-label="Stop"><span class="material-symbols-outlined">stop</span></button></div>', measure: '.metro-transport-row, .metro-play-btn' },
                    { label: 'Modal close (.modal-close-x)', html: '<div class="admin-design-relative"><button class="modal-close-x" type="button" aria-label="Close">✕</button></div>', measure: '.modal-close-x' },
                ] },
                { spec: 'tool-icon-button', title: 'Tool icon buttons', examples: [
                    { label: 'Home screen tool row', html: '<div class="tool-icon-row"><button class="tool-icon-btn" type="button"><span class="material-symbols-outlined">timer</span><span class="tool-icon-label">Timer</span></button><button class="tool-icon-btn" type="button"><span class="material-symbols-outlined">graphic_eq</span><span class="tool-icon-label">Tuner</span></button><button class="tool-icon-btn" type="button"><span class="material-symbols-outlined">library_music</span><span class="tool-icon-label">Flow</span></button><button class="tool-icon-btn" type="button"><span class="material-symbols-outlined">avg_pace</span><span class="tool-icon-label">Metronome</span></button></div>', measure: '.tool-icon-row, .tool-icon-btn' },
                ] },
            ],
        },
        {
            title: 'Inputs',
            items: [
                { spec: 'form-field', title: 'Form fields', examples: [
                    { label: 'Text input with label, required marker and help text', html: '<div class="form-group"><label>Piece <span class="flow-required">*</span></label><input type="text" value="Clarinet Concerto, 2nd mvt" aria-label="Piece"><span class="flow-help-text">As it appears on the score.</span></div>', measure: '.form-group, label, input' },
                    { label: 'Select', html: '<div class="form-group"><label>Time period</label><select aria-label="Time period"><option>All time</option><option>This month</option></select></div>', measure: 'select' },
                    { label: 'Textarea', html: '<div class="form-group"><label>Notes</label><textarea rows="3" aria-label="Notes">Slow practice at 60 bpm.</textarea></div>', measure: 'textarea' },
                ] },
                { spec: 'toggle-switch', title: 'Toggle switch', examples: [
                    { label: 'Off and on', html: '<div class="flex-col gap-md"><div class="tuner-display-toggle-row"><span id="toggle17Label">Show pitch graph</span><label class="toggle-switch"><input type="checkbox" aria-labelledby="toggle17Label"><span class="toggle-slider"></span></label></div><div class="tuner-display-toggle-row"><span id="toggle16Label">Show dynamics</span><label class="toggle-switch"><input type="checkbox" checked aria-labelledby="toggle16Label"><span class="toggle-slider"></span></label></div></div>', measure: '.tuner-display-toggle-row' },
                ] },
                { spec: 'radio-group', title: 'Radio group', examples: [
                    { label: 'Standard (one selected)', html: '<div class="radio-group"><input type="radio" id="dsR1" name="dsR" checked><label for="dsR1">Practise</label><input type="radio" id="dsR2" name="dsR"><label for="dsR2">Rehearsal</label><input type="radio" id="dsR3" name="dsR"><label for="dsR3">Lesson</label><input type="radio" id="dsR4" name="dsR"><label for="dsR4">Performance</label></div>', measure: '.radio-group, label' },
                    { label: 'Compact (.radio-group.compact)', html: '<div class="radio-group compact"><input type="radio" id="dsC1" name="dsC"><label for="dsC1">15m</label><input type="radio" id="dsC2" name="dsC" checked><label for="dsC2">30m</label><input type="radio" id="dsC3" name="dsC"><label for="dsC3">45m</label><input type="radio" id="dsC4" name="dsC"><label for="dsC4">60m</label></div>', measure: 'label' },
                ] },
                { spec: 'slider', title: 'Slider', examples: [
                    { label: 'Slider with scale', html: '<div class="slider-wrap"><div class="slider-track"><div class="slider-fill" style="width:45%"></div><div class="slider-thumb" style="left:45%" tabindex="0" role="slider" aria-label="Tempo (example)" aria-valuemin="40" aria-valuemax="240" aria-valuenow="130"></div></div><div class="slider-scale"><span>40</span><span>240</span></div></div>', measure: '.slider-track, .slider-thumb, .slider-scale' },
                ] },
                { spec: 'filter-strip', title: 'Filter strip', examples: [
                    { label: 'Category pills (selected ones take their category colour)', html: '<div class="filter-strip"><div class="filter-strip-icon"><span class="material-symbols-outlined">tune</span><span class="filter-strip-badge">2</span></div><div class="filter-strip-pills"><button class="filter-pill" type="button">All <span class="filter-pill-count">24</span></button><button class="filter-pill active" type="button" style="--filter-pill-accent: var(--cat-practise)">Practise <span class="filter-pill-count">18</span></button><button class="filter-pill active" type="button" style="--filter-pill-accent: var(--cat-lesson)">Lesson <span class="filter-pill-count">6</span></button><button class="filter-pill" type="button">Rehearsal</button></div></div>', measure: '.filter-strip, .filter-pill.active' },
                ] },
                { spec: 'selectable-tile', title: 'Selectable tiles', examples: [
                    { label: 'Picker tiles (.flow-picker-tile) - one selected', html: '<div class="flow-tile-grid" style="grid-template-columns: repeat(4, 1fr)"><button class="flow-picker-tile selected" type="button"><strong>4/4</strong><span class="flow-picker-tile-label">Common</span></button><button class="flow-picker-tile" type="button"><strong>3/4</strong><span class="flow-picker-tile-label">Waltz</span></button><button class="flow-picker-tile" type="button"><strong>6/8</strong><span class="flow-picker-tile-label">Compound</span></button><button class="flow-picker-tile" type="button"><strong>5/4</strong><span class="flow-picker-tile-label">Odd</span></button></div>', measure: '.flow-tile-grid, .flow-picker-tile.selected, .flow-picker-tile:not(.selected)' },
                    { label: 'Choice list (.flow-choice-option)', html: '<div><div class="flow-choice-option selected">Repeat the whole flow <span class="material-symbols-outlined">check</span></div><div class="flow-choice-option">Play once</div></div>', measure: '.flow-choice-option' },
                    { label: 'Tap tiles (.metroSeg-tap-btn) and row tiles (.metroSeg-row-tile)', html: '<div class="flex-col gap-md"><div class="flex-row gap-sm"><button class="metroSeg-tap-btn selected" type="button"><strong>2</strong><span>bars</span></button><button class="metroSeg-tap-btn" type="button"><strong>4</strong><span>bars</span></button></div><button class="metroSeg-row-tile selected" type="button"><span class="metroSeg-row-tile-glyph">♩</span><span class="metroSeg-row-tile-text"><strong>Crotchet</strong><span>Quarter note</span></span></button></div>', measure: '.metroSeg-tap-btn, .metroSeg-row-tile' },
                ] },
            ],
        },
        {
            title: 'Navigation',
            items: [
                { spec: 'top-bar', title: 'Top bar', examples: [
                    { label: 'With back button, timer pill (running) and burger with unread dot', html: '<div class="admin-design-static"><div class="top-bar-sticky-group"><div class="top-bar"><button class="top-btn-back" type="button">&lt;</button><div class="top-bar-title">Metronome</div><button class="top-bar-timer-pill top-bar-timer-pill-running" type="button" aria-haspopup="dialog" aria-expanded="false"><span class="material-symbols-outlined top-bar-timer-pill-icon">timer</span><span class="top-bar-timer-pill-time">12:04</span></button><button class="top-btn admin-design-relative" type="button" aria-label="Menu">☰<span class="notif-dot"></span></button></div></div></div>', measure: '.top-bar, .top-bar-timer-pill' },
                ] },
                { spec: 'dropdown-menu', title: 'Dropdown menu', examples: [
                    { label: 'Burger menu (with unread count and a destructive item)', html: '<div class="admin-design-static"><div class="dropdown-menu show"><a class="dropdown-item">Home</a><a class="dropdown-item">Notifications <span class="notif-count">2</span></a><a class="dropdown-item">Settings</a><a class="dropdown-item account-band-menu-delete">Leave band</a></div></div>', measure: '.dropdown-menu, .dropdown-item' },
                ] },
                { spec: 'tabs', title: 'Tabs', examples: [
                    { label: 'Segmented (.flow-edit-tabs) - app', html: '<div class="flow-edit-tabs"><button class="flow-edit-tab active" type="button">Details</button><button class="flow-edit-tab" type="button">Blocks <span class="flow-edit-tab-count">4</span></button><button class="flow-edit-tab" type="button">Media</button></div>', measure: '.flow-edit-tabs, .flow-edit-tab.active' },
                    { label: 'Underline (.admin-subtabs) - admin', wide: true, html: '<div class="admin-subtabs"><button class="admin-subtab-item active" type="button">All</button><button class="admin-subtab-item" type="button">Under review</button><button class="admin-subtab-item" type="button">Planned</button></div>', measure: '.admin-subtab-item.active' },
                    { label: 'Sidebar (.admin-nav-item): active, normal, disabled', wide: true, html: '<div class="admin-design-sidebar"><button class="admin-nav-item active" type="button">Features</button><button class="admin-nav-item" type="button">Accounts</button><button class="admin-nav-item" type="button" disabled>Billing</button></div>', measure: '.admin-nav-item.active' },
                ] },
            ],
        },
        {
            title: 'Data display',
            items: [
                { spec: 'card', title: 'Cards', examples: [
                    { label: 'Flow card (.flow-card)', html: '<div class="flow-card"><div class="flow-card-header"><span class="flow-card-label">Recordings</span><span class="flow-pill">3</span></div><span class="text-muted">Audio and video attached to this flow.</span></div>', measure: '.flow-card, .flow-card-header' },
                    { label: 'Play card (.play-card) - Quick play', html: '<div class="play-card"><div class="play-piece">Clarinet Concerto</div><div class="play-ref">2nd movement, bars 1-32</div><div class="play-meta"><span>♩ = 72</span><span>3/4</span></div><div class="play-stats">Played 4 times</div></div>', measure: '.play-card, .play-stats' },
                    { label: 'Highlighted note (.about-running-note)', html: '<div class="about-running-note">You are running version 0.25.0.</div>' },
                ] },
                { spec: 'stat-card', title: 'Stat cards', examples: [
                    { label: 'Clickable card (.stat-card.clickable, tappable surface) next to a display card (.stat-card, page surface)', html: '<div class="dashboard-grid"><div class="stat-card clickable"><div class="label">Total time</div><div class="value">12h 30m</div></div><div class="stat-card"><div class="label">Current practise streak</div><div class="value">5 <span class="sess-count">days</span></div></div></div>', measure: '.dashboard-grid, .stat-card.clickable, .stat-card:not(.clickable)' },
                    { label: 'Admin stat tile (.admin-stat-tile)', wide: true, html: '<div class="admin-stat-tiles"><div class="admin-stat-tile"><div class="admin-stat-tile-label">Active accounts</div><div class="admin-stat-tile-value">42</div><div class="admin-stat-tile-sub">+3 this week</div></div></div>', measure: '.admin-stat-tile' },
                ] },
                { spec: 'list-row', title: 'List rows', examples: [
                    { label: 'Display rows (session history): page surface, only the ⋮ menu is tappable', html: '<div><div class="history-item" style="border-left-color: var(--cat-practise)"><div class="history-details"><strong style="color: var(--cat-practise)">Practise</strong> 3 Sep 2026 | 25 mins</div><button type="button" class="list-item-menu-btn" aria-label="Options" aria-haspopup="menu" aria-expanded="false"><span class="material-symbols-outlined">more_vert</span></button></div><div class="history-item" style="border-left-color: var(--cat-lesson)"><div class="history-details"><strong style="color: var(--cat-lesson)">Lesson</strong> 1 Sep 2026 | 45 mins</div><button type="button" class="list-item-menu-btn" aria-label="Options" aria-haspopup="menu" aria-expanded="false"><span class="material-symbols-outlined">more_vert</span></button></div></div>', measure: '.history-item' },
                    { label: 'Tappable rows (.history-item.clickable - Flow library, saved setups, Quick-play history; or a <button> row - challenges)', html: '<div><div class="history-item clickable"><div class="history-details"><strong>Clarinet Concerto</strong><span class="text-muted">32 bars · Personal</span></div><button type="button" class="list-item-menu-btn" aria-label="Options" aria-haspopup="menu" aria-expanded="false"><span class="material-symbols-outlined">more_vert</span></button></div><button type="button" class="history-item" style="border-left-color: var(--cat-practise)"><div class="history-details"><strong>30-day scales challenge</strong><span class="text-muted">12 of 30 days</span></div></button></div>', measure: '.history-item.clickable, button.history-item' },
                    { label: 'Draggable row with handle', html: '<div class="draggable-item"><span class="drag-handle material-symbols-outlined">drag_indicator</span><div class="history-item"><div class="history-details"><strong>Long tones</strong></div></div></div>', measure: '.drag-handle' },
                ] },
                { spec: 'pill-badge', title: 'Pills and badges', examples: [
                    { label: 'Neutral tag, unread count, accent count', html: '<div class="flex-row gap-md"><span class="flow-pill">Band</span><span class="notif-count">3</span><span class="admin-design-relative admin-design-badge-host"><span class="filter-strip-badge">2</span></span><span class="metroSeg-count-badge">4 bars</span></div>', measure: '.flow-pill, .notif-count, .metroSeg-count-badge' },
                    { label: 'Admin status badges (.admin-badge)', wide: true, html: '<div class="flex-row gap-sm"><span class="admin-badge pass">Pass</span><span class="admin-badge fail">Fail</span><span class="admin-badge skipped">Skipped</span><span class="admin-badge never">Never run</span><span class="admin-chip">flows</span></div>', measure: '.admin-badge.pass, .admin-chip' },
                    { label: 'Admin feedback / notification status chips', wide: true, html: '<div class="flex-row gap-sm"><span class="admin-feedback-badge status-under_review">Under review</span><span class="admin-feedback-badge status-planned">Planned</span><span class="admin-feedback-badge status-in_progress">In progress</span><span class="admin-feedback-badge status-not_progressing">Not progressing</span><span class="admin-feedback-badge status-resolved">Resolved</span><span class="admin-feedback-badge cat">Bug</span></div>', measure: '.status-under_review' },
                ] },
                { spec: 'charts', title: 'Charts', examples: [
                    { label: 'Section title (.section-title)', html: '<div class="section-title">Daily time</div>' },
                    { label: 'Heatmap cells, intensity 0-4, and legend', html: `<div><div class="heatmap-container">${[[0, 1, 2, 0, 3, 4, 1], [2, 0, 1, 4, 3, 2, 0], [1, 1, 0, 2, 4, 3, 2], [0, 3, 2, 1, 0, 1, 4]].map(heatCol).join('')}</div><div class="heatmap-legend">Less <div class="heat-cell h-time-0"></div><div class="heat-cell h-time-1"></div><div class="heat-cell h-time-2"></div><div class="heat-cell h-time-3"></div><div class="heat-cell h-time-4"></div> More</div></div>`, measure: '.heatmap-container, .heat-cell, .heatmap-legend' },
                    { label: 'Bar colours: hours / days / sessions / category', html: `<div class="admin-design-bars">${[['--chart-hours', 70], ['--chart-days', 45], ['--chart-sessions', 85], ['--cat-rehearsal', 30], ['--cat-performance', 55]].map(([t, h]) => `<div class="chart-bar" style="height:${h}%; background: var(${t})"></div>`).join('')}</div>`, measure: '.chart-bar' },
                ] },
            ],
        },
        {
            title: 'Feedback and overlays',
            items: [
                { spec: 'modal', title: 'Modal', examples: [
                    { label: 'Destructive confirmation (shown in place, not over the page)', html: '<div class="admin-design-static"><div class="modal" role="dialog" aria-modal="true" aria-label="Delete session? (example)"><div class="modal-content"><button class="modal-close-x" type="button" aria-label="Close">✕</button><h2>Delete session?</h2><p>This can\'t be undone.</p><div class="flex-row gap-md"><button class="btn-nav btn-cancel" type="button">Cancel</button><button class="btn-submit" type="button" style="background: var(--danger-color)">Delete</button></div></div></div></div>', measure: '.modal, .modal-content, .modal-content h2' },
                ] },
                { spec: 'toast', title: 'Toasts', examples: [
                    { label: 'Success / undo / warning / info', html: '<div class="admin-design-static flex-col gap-md"><div class="toast success" role="status">Session saved</div><div class="toast undo" role="status">Session deleted <button type="button">Undo</button></div><div class="toast warning" role="status">Pick a category first</div><div class="toast info" role="status">Update available <button type="button">X</button></div></div>', measure: '.toast.success, .toast.warning, .toast.info, .toast button' },
                ] },
                { spec: 'anchored-popup', title: 'Anchored popup', examples: [
                    { label: 'Tapped chart bar / heatmap cell', html: '<div class="admin-design-static"><div class="anchored-popup">Tue 4 Sep · 2 sessions</div></div>', measure: '.anchored-popup' },
                ] },
                { spec: 'notification-centre', title: 'Notification centre', examples: [
                    { label: 'Unread item, read item, update-available card', html: '<div><button class="notification-item unread" type="button"><div class="notification-head"><span class="notification-unread-dot"></span><strong>New: Flow import</strong></div><div class="notification-date">23 Sep 2026</div><p class="notification-body">You can now import a Flow straight from a MusicXML file.</p></button><button class="notification-item" type="button"><div class="notification-head"><strong>Welcome to The Music Ledger</strong></div><div class="notification-date">1 Sep 2026</div></button><div class="notification-item notification-update"><div class="notification-head"><strong>Update available</strong></div><p class="notification-body">Reload to get the latest version.</p><button class="btn-submit" type="button">Reload</button></div></div>', measure: '.notification-item.unread, .notification-head, .notification-unread-dot' },
                ] },
            ],
        },
        {
            title: 'System specific',
            note: 'One-off visuals that belong to a single tool rather than the shared component set.',
            items: [
                { spec: 'metronome', title: 'Metronome', examples: [
                    { label: 'Beat dots: accent (downbeat), plain, lit (current beat), accent + lit', html: `<div class="metro-display"><div class="metro-display-viewport admin-design-dots">${tier(dot('metro-dot-note accent', 8) + dot('metro-dot-note', 36) + dot('metro-dot-note lit', 64) + dot('metro-dot-note accent lit', 92))}${tier(dot('metro-dot-sub', 22) + dot('metro-dot-sub lit', 50) + dot('metro-dot-sub', 78))}</div></div>`, measure: '.metro-dot-note.accent, .metro-dot-note.lit, .metro-dot-sub' },
                    { label: 'Fermata glow: holding (pulsing, with beats-left count) and done (static gold)', html: `<div class="metro-display"><div class="metro-display-viewport admin-design-dots">${tier(dot('metro-dot-note', 10) + dot('metro-dot-note fermata-holding', 40, '<span class="metro-dot-count">3</span>') + dot('metro-dot-note fermata-done', 70))}</div></div>`, measure: '.fermata-holding, .fermata-done' },
                    { label: 'Value boxes (.metroBlk-ctrl-value-btn) - Flow tile look, no dropdown caret (ML-205)', html: '<div class="flex-row gap-md"><button class="metroBlk-ctrl-value-btn" type="button" aria-haspopup="dialog" aria-expanded="false"><strong>0</strong><span class="metroBlk-ctrl-value-label">sub beats</span></button><button class="metroBlk-ctrl-value-btn" type="button" aria-haspopup="dialog" aria-expanded="false"><strong>100%</strong><span class="metroBlk-ctrl-value-label">play speed</span></button><button class="metroBlk-ctrl-value-btn" type="button" aria-haspopup="dialog" aria-expanded="false"><strong>4/4</strong><span class="metroBlk-ctrl-value-label">time</span></button></div>', measure: '.flex-row, .metroBlk-ctrl-value-btn, .metroBlk-ctrl-value-label' },
                    { label: 'Transport, tempo stepper and speed controls', html: '<div class="flex-col gap-md"><div class="metro-transport-row"><button class="metro-transport-btn metro-play-btn" type="button" aria-label="Play"><span class="material-symbols-outlined">play_arrow</span></button><button class="metro-transport-btn metro-stop-btn" type="button" aria-label="Stop"><span class="material-symbols-outlined">stop</span></button><button class="metro-transport-btn metro-play-btn" type="button" aria-label="Play (disabled)" disabled><span class="material-symbols-outlined">play_arrow</span></button></div></div>', measure: '.metro-transport-row, .metro-transport-btn[disabled]' },
                    { label: 'Mini bar (docked under the top bar while running elsewhere)', html: '<div class="metro-mini-bar"><div class="metro-mini-controls"><button class="metro-mini-ctrl-btn" type="button"><strong>100</strong><span class="metro-mini-ctrl-unit">bpm</span></button><button class="metro-mini-ctrl-btn" type="button"><strong>4/4</strong><span class="metro-mini-ctrl-unit">time</span></button><button class="metro-mini-ctrl-btn" type="button" aria-label="Stop"><span class="material-symbols-outlined">stop</span></button></div></div>', measure: '.metro-mini-bar, .metro-mini-ctrl-btn' },
                ] },
                { spec: 'tuner', title: 'Tuner', examples: [
                    { label: 'Card states: idle / out of tune (gold) / in tune (green wash)', html: ['', 'out-of-tune', 'in-tune'].map((s, i) => `<div class="tuner-card ${s}"><div class="tuner-note-row"><span class="tuner-note">${['–', 'A', 'A'][i]}</span><span class="tuner-note-octave">${['', '4', '4'][i]}</span></div><div class="tuner-bar-wrap"><div class="tuner-bar-track"><div class="tuner-bar-zone"></div><div class="tuner-bar-center-mark"></div><div class="tuner-bar-needle ${s === 'in-tune' ? 'in-tune' : ''}" style="left:${[50, 22, 52][i]}%"></div></div><div class="tuner-bar-scale"><span>-50</span><span>0</span><span>+50</span></div></div><div class="tuner-status">${['Play a note', 'Too flat', 'In tune'][i]}</div></div>`).join(''), measure: '.tuner-card.in-tune, .tuner-note, .tuner-bar-track, .tuner-bar-needle.in-tune' },
                ] },
                { spec: 'flow-editor', title: 'Flow editor', examples: [
                    { label: 'Featured blocks card (.flow-blocks-card) with a pill and help text', html: '<div class="flow-card flow-blocks-card"><div class="flow-card-header"><span class="flow-card-label">Blocks</span><span class="flow-pill">4 blocks</span></div><span class="flow-help-text">Drag a block to reorder it.</span></div>', measure: '.flow-blocks-card, .flow-help-text' },
                    { label: 'Media icons: audio, YouTube, document', html: '<div class="flex-row gap-md"><span class="flow-media-icon type-audio material-symbols-outlined">music_note</span><span class="flow-media-icon type-youtube material-symbols-outlined">smart_display</span><span class="flow-doc-icon">PDF</span></div>', measure: '.flow-media-icon.type-audio, .flow-doc-icon' },
                    { label: 'Flow action buttons (.flow-action-btn) - icon + label tiles used only inside the Flow editor', html: '<div class="flex-col"><div class="flow-action-row"><button class="flow-action-btn" type="button"><span class="material-symbols-outlined">edit</span> Edit details</button><button class="flow-action-btn" type="button"><span class="material-symbols-outlined">ios_share</span> Export</button></div><button class="flow-action-btn flow-action-btn-wide" type="button"><span class="material-symbols-outlined">upload</span> Upload mp3 / mp4 audio</button></div>', measure: '.flow-action-row, .flow-action-btn' },
                    { label: 'Warning tile (.flow-tile-warning)', html: '<div class="flow-tile-grid" style="grid-template-columns: repeat(3, 1fr)"><div class="flow-tile">Bar 1</div><div class="flow-tile flow-tile-warning">Bar 2</div><div class="flow-tile">Bar 3</div></div>', measure: '.flow-tile-warning' },
                ] },
                { spec: 'splash-screen', title: 'Splash screen', examples: [
                    { label: 'Login splash (always dark, in either theme)', html: '<div class="admin-design-static"><div class="splash-screen"><div class="splash-content"><h1 class="splash-title">The Music Ledger</h1><p class="splash-subtitle">Track your practice</p><button class="splash-login-btn" type="button">Sign in with Google</button></div></div></div>', measure: '.splash-title, .splash-login-btn' },
                ] },
                { spec: 'admin-shell', title: 'Admin panel', examples: [
                    { label: 'Data table (.admin-stat-table)', wide: true, html: '<div class="admin-stat-table-wrap"><table class="admin-stat-table"><thead><tr><th>Account</th><th>Sessions</th><th>Minutes</th></tr></thead><tbody><tr><td>Andrew</td><td>24</td><td>610</td></tr><tr class="admin-stat-row-excluded"><td>Test account</td><td>3</td><td>45</td></tr></tbody></table></div>', measure: '.admin-stat-table th, .admin-stat-table td' },
                    { label: 'Intro text and link', wide: true, html: '<div><p class="admin-intro">Each release runs the back-test suite against the dev branch.</p><a class="admin-link">View test cases →</a></div>', measure: '.admin-intro, .admin-link' },
                    { label: 'Status badges (.admin-badge pass / warn / fail / info / never)', html: '<div class="flex-row gap-sm"><span class="admin-badge pass">Pass</span><span class="admin-badge warn">Warn</span><span class="admin-badge fail">Fail</span><span class="admin-badge info">Info</span><span class="admin-badge never">Not run</span></div>', measure: '.admin-badge.warn, .admin-badge.info' },
                    { label: 'Security check row with evidence disclosure (.admin-security-head, .admin-security-details, .admin-security-evidence)', wide: true, html: '<div class="admin-feature"><div class="admin-test-case"><div class="admin-security-head"><div class="admin-test-case-title">Container hardening rules</div><span class="admin-badge warn">Warn</span></div><div class="admin-test-case-meta">Automated · 23/09/2026 · upstream a6325864</div><p class="admin-run-notes">6 of 9 rules not met</p><details class="admin-security-details" open><summary>Evidence and how to re-run</summary><ul class="admin-security-evidence"><li>OK - Runs as a non-root user: USER omr</li><li>WARN - All Linux capabilities dropped: no cap_drop</li></ul></details></div></div>', measure: '.admin-security-details summary, .admin-security-evidence' },
                    { label: 'Toolbar with a run button (.admin-security-toolbar)', wide: true, html: '<div class="admin-security-toolbar"><button class="btn-submit no-margin" type="button">Run automated checks now</button><span class="admin-test-case-meta">Done - results updated below.</span></div>', measure: '.admin-security-toolbar .btn-submit' },
                ] },
            ],
        },
        {
            title: 'Utilities and states',
            items: [
                { spec: 'utilities-and-states', title: 'Utilities and state modifiers', examples: [
                    { label: '.flex-row + .gap-sm / .gap-md, .text-muted', html: '<div class="flex-col gap-md"><div class="flex-row gap-sm"><span class="flow-pill">gap-sm</span><span class="flow-pill">gap-sm</span></div><div class="flex-row gap-md"><span class="flow-pill">gap-md</span><span class="flow-pill">gap-md</span></div><span class="text-muted">Muted supporting text</span></div>', measure: '.flex-row.gap-sm, .flex-row.gap-md, .text-muted' },
                    { label: 'The same component in different states: .selected, .active, .lit, .unread', html: '<div class="flex-col gap-md"><div class="flex-row gap-sm"><button class="flow-picker-tile" type="button"><strong>Default</strong></button><button class="flow-picker-tile selected" type="button"><strong>.selected</strong></button></div><div class="flex-row gap-sm"><button class="filter-pill" type="button">Default</button><button class="filter-pill active" type="button">.active</button></div></div>' },
                ] },
            ],
        },
    ];

    // ------------------------------------------------------------------ token parsing / reverse lookup

    let TOKENS = null; // [{ group, rows: [{ name, comment }] }]
    const probe = document.createElement('span');

    async function loadTokens() {
        const text = await (await fetch('tokens.css', { cache: 'no-store' })).text();
        const root = text.slice(text.indexOf(':root {'), text.indexOf('body.dark-mode {'));
        const l2 = root.slice(root.indexOf('LAYER 2'));
        const groups = [];
        let current = null;
        for (const line of l2.split('\n')) {
            const h = line.match(/^\s*\/\*\s*([A-Z][^*]*?)\s*\*\/\s*$/);
            if (h && !/LAYER/.test(h[1])) { current = { group: h[1].replace(/ - .*/, ''), rows: [] }; groups.push(current); continue; }
            const m = line.match(/^\s*(--[\w-]+)\s*:\s*[^;]+;\s*(?:\/\*\s*(.*?)\s*\*\/)?/);
            if (m && current) current.rows.push({ name: m[1], comment: m[2] || '' });
        }
        return groups;
    }

    // Read from <body>: dark mode remaps the aliases on body.dark-mode, not on :root.
    const tokenValue = (name) => getComputedStyle(document.body).getPropertyValue(name).trim();
    function asColor(v) {
        // A detached element has no computed style - keep the probe in the document (hidden).
        if (!probe.isConnected) { probe.hidden = true; document.body.appendChild(probe); }
        probe.style.color = '';
        probe.style.color = v;
        if (!probe.style.color) return null;
        return getComputedStyle(probe).color;
    }
    const toPx = (v) => { const n = parseFloat(v); return /rem$/.test(v) ? n * 16 : n; };

    // Rebuilt on every render/theme switch - dark mode resolves the same alias to a different value.
    function buildLookup() {
        const all = TOKENS.flatMap(g => g.rows.map(r => r.name));
        const lookup = { color: new Map(), space: new Map(), radius: new Map(), font: new Map(), weight: new Map(), shadow: new Map() };
        const put = (map, key, name) => { if (!map.has(key)) map.set(key, name); };
        for (const name of all) {
            const v = tokenValue(name);
            if (/^--space-/.test(name)) put(lookup.space, toPx(v), name);
            else if (/^--radius-/.test(name) && !/%/.test(v)) put(lookup.radius, toPx(v), name);
            else if (/^--font-(2xs|xs|sm|base|md|lg|xl|2xl|3xl)$/.test(name)) put(lookup.font, Math.round(toPx(v) * 100) / 100, name);
            else if (/^--icon-/.test(name)) put(lookup.font, toPx(v), name);
            else if (/^--font-weight-/.test(name)) put(lookup.weight, String(parseInt(v, 10)), name);
            else if (/^--(shadow|focus)/.test(name)) { probe.style.boxShadow = v; put(lookup.shadow, getComputedStyle(probe).boxShadow, name); probe.style.boxShadow = ''; }
            else { const c = asColor(v); if (c) { if (!lookup.color.has(c)) lookup.color.set(c, []); lookup.color.get(c).push(name); } }
        }
        return lookup;
    }

    // ------------------------------------------------------------------ annotations

    function describe(el, lookup) {
        const cs = getComputedStyle(el);
        const chips = [];
        const len = (px, map, what) => {
            if (px === 0) return null;
            if (Math.abs(px) === 1) return `${px}px nudge`; // deliberate border-overlap nudge (token-audit-ignore'd)
            if (px < 0) { const pos = len(-px, map, what); return pos && !/⚠/.test(pos) ? '-' + pos : `⚠ ${px}px, no ${what} token`; }
            const name = map.get(Math.round(px * 100) / 100) || map.get(px);
            return name ? `${name.replace(/^--/, '')} (${Math.round(px * 10) / 10})` : `⚠ ${Math.round(px * 10) / 10}px, no ${what} token`;
        };
        const sides = (prefix) => ['Top', 'Right', 'Bottom', 'Left'].map(s => parseFloat(cs[prefix + s]) || 0);
        const fourSides = (vals, label) => {
            if (vals.every(v => v === 0)) return;
            const [t, r, b, l] = vals.map(v => len(v, lookup.space, 'spacing') || '0');
            const txt = t === r && r === b && b === l ? t : t === b && r === l ? `${t} / ${r}` : `${t} / ${r} / ${b} / ${l}`;
            chips.push([label, txt, /⚠/.test(txt)]);
        };
        fourSides(sides('padding'), 'padding');
        if (/flex|grid/.test(cs.display)) {
            const g = parseFloat(cs.rowGap) || parseFloat(cs.columnGap) || 0;
            if (g) { const t = len(g, lookup.space, 'spacing'); chips.push(['gap', t, /⚠/.test(t)]); }
        }
        fourSides(sides('margin'), 'margin');
        const rad = parseFloat(cs.borderTopLeftRadius);
        if (rad) {
            const pct = /%/.test(cs.borderTopLeftRadius) || rad >= Math.min(el.offsetWidth, el.offsetHeight) / 2 - 0.5;
            const t = pct ? (rad >= 999 || /%/.test(cs.borderTopLeftRadius) ? 'radius-pill / radius-circle' : len(rad, lookup.radius, 'radius')) : len(rad, lookup.radius, 'radius');
            chips.push(['radius', t, /⚠/.test(t)]);
        }
        // Type only matters where the element itself holds text (not an icon-only button or a dot).
        const hasText = el.matches('input, select, textarea') || [...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim());
        const fs = parseFloat(cs.fontSize);
        const fsName = lookup.font.get(Math.round(fs * 100) / 100);
        if (hasText) chips.push(['font', fsName ? `${fsName.replace(/^--/, '')} (${Math.round(fs * 10) / 10})` : `${Math.round(fs * 10) / 10}px (inherited/relative)`, false]);
        const w = lookup.weight.get(String(parseInt(cs.fontWeight, 10)));
        if (w && cs.fontWeight !== '400') chips.push(['weight', w.replace(/^--/, ''), false]);
        const ROLE = { text: /text|label|color$/, bg: /bg|surface|action$|color$|tint|overlay|highlight/, border: /border|action$|color$/ };
        const colorName = (c, role) => { const names = lookup.color.get(c); if (!names) return null; return names.find(n => ROLE[role].test(n) && !/^--(heat|cat|chart)-/.test(n)) || names[0]; };
        const bg = cs.backgroundColor;
        // color(...) = a color-mix() wash computed from a token (e.g. .filter-pill.active) - not a raw value.
        if (bg && bg !== 'rgba(0, 0, 0, 0)') { const mixed = bg.startsWith('color('); chips.push(['bg', colorName(bg, 'bg')?.replace(/^--/, '') || (mixed ? 'mixed from a token (color-mix)' : `⚠ ${bg}`), !colorName(bg, 'bg') && !mixed]); }
        if (hasText || el.querySelector('.material-symbols-outlined')) chips.push(['text', colorName(cs.color, 'text')?.replace(/^--/, '') || `⚠ ${cs.color}`, !colorName(cs.color, 'text')]);
        if (parseFloat(cs.borderLeftWidth) || parseFloat(cs.borderTopWidth)) {
            const bc = parseFloat(cs.borderTopWidth) ? cs.borderTopColor : cs.borderLeftColor;
            if (bc !== 'rgba(0, 0, 0, 0)') chips.push(['border', colorName(bc, 'border')?.replace(/^--/, '') || `⚠ ${bc}`, !colorName(bc, 'border')]);
        }
        if (cs.boxShadow && cs.boxShadow !== 'none' && !cs.animationName.includes('glow')) {
            const s = lookup.shadow.get(cs.boxShadow);
            chips.push(['shadow', s ? s.replace(/^--/, '') : '⚠ untokenised shadow', !s]);
        }
        if (cs.animationName && cs.animationName !== 'none') chips.push(['animation', `${cs.animationName} ${cs.animationDuration}`, false]);
        // ML-210: touch target - the visible box, or the invisible ::before hit area if it's bigger.
        if (el.matches('button, a[href], input, select, textarea, [role="button"], [role="slider"]')) {
            const r = el.getBoundingClientRect(), b = getComputedStyle(el, '::before');
            const hw = b.content !== 'none' ? parseFloat(b.width) || 0 : 0, hh = b.content !== 'none' ? parseFloat(b.height) || 0 : 0;
            const w = Math.round(Math.max(r.width, hw)), h = Math.round(Math.max(r.height, hh));
            const small = w < 44 || h < 44;
            chips.push(['target', `${w}×${h}${hw > r.width ? ' (hit area)' : ''}${small ? ' - under 44' : ''}`, small]);
        }
        return chips;
    }

    function annotate(root, lookup) {
        root.querySelectorAll('.admin-design-example').forEach(ex => {
            const stage = ex.querySelector('.admin-design-stage');
            const out = ex.querySelector('.admin-design-annotations');
            const sel = ex.dataset.measure;
            // One element per selector in `measure` (the first match), so each variant gets one annotation.
            const els = sel ? [...new Set(sel.split(',').map(s => stage.querySelector(s.trim())).filter(Boolean))] : [stage.firstElementChild];
            out.innerHTML = els.filter(Boolean).slice(0, 6).map(el => {
                el.classList.add('admin-design-measured');
                const name = el.tagName.toLowerCase() + (el.className && typeof el.className === 'string' ? '.' + el.className.replace('admin-design-measured', '').trim().split(/\s+/).join('.') : '');
                const chips = describe(el, lookup).map(([k, v, bad]) => `<span class="admin-design-chip${bad ? ' admin-design-chip-warn' : ''}"><b>${k}</b> ${v}</span>`).join('');
                return `<div class="admin-design-annotation"><code>${name}</code>${chips}</div>`;
            }).join('');
        });
    }

    // ------------------------------------------------------------------ foundations

    function foundationsHtml() {
        const rows = (re) => TOKENS.flatMap(g => g.rows).filter(r => re.test(r.name));
        const colourGroups = TOKENS.map(g => ({ group: g.group, rows: g.rows.filter(r => asColor(tokenValue(r.name))) })).filter(g => g.rows.length);
        const swatch = (r) => `<div class="admin-design-swatch"><div class="admin-design-swatch-color" style="background: var(${r.name})"></div><div class="admin-design-swatch-label"><code>${r.name}</code><span class="admin-design-token-value" data-token="${r.name}"></span><small>${r.comment}</small></div></div>`;
        const table = (list, cell) => `<div class="admin-stat-table-wrap"><table class="admin-stat-table admin-design-table"><tbody>${list.map(r => `<tr><td><code>${r.name}</code></td><td class="admin-design-token-value" data-token="${r.name}"></td><td>${cell ? cell(r) : ''}</td><td>${r.comment}</td></tr>`).join('')}</tbody></table></div>`;
        return `
            <h3 class="admin-design-subhead">Colour</h3>
            ${colourGroups.map(g => `<h4 class="admin-design-minihead">${g.group}</h4><div class="admin-design-swatches">${g.rows.map(swatch).join('')}</div>`).join('')}
            <h3 class="admin-design-subhead">Typography</h3>
            ${table(rows(/^--font-(2xs|xs|sm|base|md|lg|xl|2xl|3xl)$/), r => `<span style="font-size: var(${r.name})">The quick brown fox</span>`)}
            ${table(rows(/^--font-weight-/), r => `<span style="font-weight: var(${r.name})">The quick brown fox</span>`)}
            ${table(rows(/^--font-(sans|mono|music)$/), r => `<span style="font-family: var(${r.name})">Aa 𝄋 𝄌 0123</span>`)}
            ${table(rows(/^--line-height-/), r => `<span class="admin-design-leading" style="line-height: var(${r.name})">Two lines of text<br>to show the leading</span>`)}
            ${table(rows(/^--icon-/), r => `<span class="material-symbols-outlined" style="font-size: var(${r.name})">music_note</span>`)}
            <h3 class="admin-design-subhead">Spacing</h3>
            ${table(rows(/^--space-/), r => `<span class="admin-design-space-bar" style="width: var(${r.name})"></span>`)}
            <h3 class="admin-design-subhead">Radius</h3>
            <div class="admin-design-swatches">${rows(/^--radius-/).map(r => `<div class="admin-design-shape" style="border-radius: var(${r.name})"><code>${r.name}</code><span class="admin-design-token-value" data-token="${r.name}"></span></div>`).join('')}</div>
            <h3 class="admin-design-subhead">Elevation</h3>
            <div class="admin-design-swatches">${rows(/^--(shadow|focus)/).map(r => `<div class="admin-design-shadow" style="box-shadow: var(${r.name})"><code>${r.name}</code><small>${r.comment}</small></div>`).join('')}</div>
            ${table(rows(/^--z-/))}
            <h3 class="admin-design-subhead">Motion</h3>
            <p class="admin-intro">Hover (or tap) a row to play its duration.</p>
            ${table(rows(/^--duration-/), r => `<span class="admin-design-motion-track"><span class="admin-design-motion-dot" style="transition-duration: var(${r.name})"></span></span>`)}
            <h3 class="admin-design-subhead">Layout</h3>
            ${table(rows(/^--(app-max-width|touch-target|bottom-bar-)/))}`;
    }

    // ------------------------------------------------------------------ render

    const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

    function sectionHtml(item) {
        return `<div class="admin-design-section" id="design-${item.spec}" data-spec="${item.spec}">
            <div class="admin-design-section-head"><h3>${item.title}</h3><code>specs/components/${item.spec}.md</code></div>
            ${item.examples.map(ex => `<div class="admin-design-example" data-measure="${esc(ex.measure || '')}">
                <div class="admin-design-example-label">${ex.label}</div>
                <div class="admin-design-stage${ex.wide ? ' admin-design-stage-wide' : ''}">${ex.html}</div>
                <div class="admin-design-annotations"></div>
            </div>`).join('')}
        </div>`;
    }

    function render(container) {
        const nav = GROUPS.map(g => `<a class="admin-link admin-design-jump" href="#design-group-${g.title.replace(/\W+/g, '-')}">${g.title}</a>`).join('');
        container.innerHTML = `
            <div class="admin-design-toolbar">
                <div class="flow-edit-tabs admin-design-theme">
                    <button class="flow-edit-tab" data-theme="light" type="button">Light</button>
                    <button class="flow-edit-tab" data-theme="dark" type="button">Dark</button>
                </div>
                <label class="admin-design-toggle"><span>Show touch targets</span><span class="toggle-switch"><input type="checkbox" id="designShowTargets"><span class="toggle-slider"></span></span></label>
                <label class="admin-design-toggle"><span>Preview focus rings</span><span class="toggle-switch"><input type="checkbox" id="designShowFocus"><span class="toggle-slider"></span></span></label>
                <label class="admin-design-toggle"><span>Show spacing outlines</span><span class="toggle-switch"><input type="checkbox" id="designShowSpacing"><span class="toggle-slider"></span></span></label>
            </div>
            <div class="admin-design-jumps"><a class="admin-link admin-design-jump" href="#design-group-Foundations">Foundations</a>${nav}</div>
            <h2 class="admin-design-group" id="design-group-Foundations">Foundations</h2>
            <p class="admin-intro">Built live from <code>public/tokens.css</code> - every Layer 2 token, its current value in this theme, and when to use it.</p>
            ${foundationsHtml()}
            ${GROUPS.map(g => `<h2 class="admin-design-group" id="design-group-${g.title.replace(/\W+/g, '-')}">${g.title}</h2>${g.note ? `<p class="admin-intro">${g.note}</p>` : ''}${g.items.map(sectionHtml).join('')}`).join('')}`;

        const refresh = () => {
            const lookup = buildLookup();
            container.querySelectorAll('.admin-design-token-value').forEach(el => { el.textContent = tokenValue(el.dataset.token); });
            annotate(container, lookup);
            container.querySelectorAll('.admin-design-theme .flow-edit-tab').forEach(b => b.classList.toggle('active', (b.dataset.theme === 'dark') === document.body.classList.contains('dark-mode')));
        };
        container.querySelectorAll('.admin-design-theme .flow-edit-tab').forEach(b => b.addEventListener('click', () => {
            // Preview only - the admin panel's saved theme preference is left untouched.
            document.body.classList.toggle('dark-mode', b.dataset.theme === 'dark');
            refresh();
        }));
        container.querySelector('#designShowTargets').addEventListener('change', (e) => container.classList.toggle('admin-design-show-targets', e.target.checked));
        container.querySelector('#designShowFocus').addEventListener('change', (e) => container.classList.toggle('admin-design-show-focus', e.target.checked));
        container.querySelector('#designShowSpacing').addEventListener('change', (e) => container.classList.toggle('admin-design-show-spacing', e.target.checked));
        // Everything here is a specimen - stop clicks doing anything (links, radios still toggle visually).
        container.querySelectorAll('.admin-design-stage a, .admin-design-stage form').forEach(el => el.addEventListener('click', e => e.preventDefault()));
        refresh();
    }

    let rendered = false;
    async function open() {
        const container = document.getElementById('designCatalogue');
        if (!container || rendered) return;
        rendered = true;
        try {
            TOKENS = await loadTokens();
            render(container);
        } catch (err) {
            rendered = false;
            container.innerHTML = `<p>Couldn't load the design system: ${esc(String(err.message || err))}</p>`;
        }
    }

    document.addEventListener('DOMContentLoaded', () => {
        document.querySelector('.admin-nav-item[data-section="design"]')?.addEventListener('click', open);
    });
})();
