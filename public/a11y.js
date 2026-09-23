// ML-210 (phase 3, ML-215): shared accessibility behaviour for the app and the admin panel.
// Loaded after app.js/admin.js. Everything here is generic - it keys off markup conventions rather
// than individual screens, so new modals/menus/buttons get it for free:
//
//   - Enter/Space activate any role="button" element that isn't a real <button>
//   - .modal (role="dialog"): focus moves into it on open, Tab is trapped inside it, Escape closes it,
//     and focus returns to whatever opened it
//   - .dropdown-menu: Escape closes it, arrow keys move between items, focus returns to the opener
//   - aria-expanded is kept in sync on any [aria-haspopup] trigger while its popup is open
//   - a row holding a single toggle switch flips it when tapped anywhere (ML-211)
//
// See specs/foundations/accessibility.md.
(function () {
    'use strict';

    const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
    const isShown = (el) => el && getComputedStyle(el).display !== 'none' && getComputedStyle(el).visibility !== 'hidden';
    const visible = (el) => !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length) && getComputedStyle(el).visibility !== 'hidden';
    const focusables = (root) => [...root.querySelectorAll(FOCUSABLE)].filter(visible);
    const setExpanded = (el, open) => { if (el && el.hasAttribute && el.hasAttribute('aria-haspopup')) el.setAttribute('aria-expanded', String(open)); };

    // What the user last pressed/focused outside a popup - the popup's "opener" when it appears.
    // (Safari doesn't focus buttons on click, so document.activeElement alone isn't enough.)
    let lastTrigger = null;
    let keyboardMode = false;
    document.addEventListener('pointerdown', (e) => { // a11y: only records what was pressed, activates nothing
        keyboardMode = false;
        const t = e.target.closest && e.target.closest(FOCUSABLE + ', [role="button"]');
        if (t && !t.closest('.modal, .dropdown-menu')) lastTrigger = t;
    }, true);
    document.addEventListener('keydown', () => { keyboardMode = true; }, true);
    document.addEventListener('focusin', (e) => { if (!e.target.closest('.modal, .dropdown-menu')) lastTrigger = e.target; }, true);
    const openerNow = (popup) => {
        const a = document.activeElement;
        return (a && a !== document.body && !popup.contains(a)) ? a : lastTrigger;
    };
    const restoreFocus = (popup, opener) => {
        const a = document.activeElement;
        if (opener && document.contains(opener) && visible(opener) && (!a || a === document.body || popup.contains(a))) opener.focus({ preventScroll: true });
    };

    // ------------------------------------------------------------------ role="button"
    document.addEventListener('keydown', (e) => {
        const t = e.target;
        if (!(t instanceof HTMLElement) || t.matches('button, a, input, select, textarea')) return;
        if (t.getAttribute('role') === 'button' && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); t.click(); }
    });

    // ------------------------------------------------------------------ dialogs
    const dialogStack = []; // [{ modal, opener }]
    function onModalOpen(modal) {
        const opener = openerNow(modal);
        dialogStack.push({ modal, opener });
        setExpanded(opener, true);
        // Focus the dialog itself (announces its label) rather than its first field - on a phone that
        // would pop the keyboard up over every modal that happens to contain an input.
        setTimeout(() => {
            if (modal.contains(document.activeElement)) return;
            const target = modal.querySelector('.modal-content') || modal;
            if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1');
            target.focus({ preventScroll: true });
        }, 0);
    }
    function onModalClose(modal) {
        const i = dialogStack.findIndex(d => d.modal === modal);
        if (i < 0) return;
        const [{ opener }] = dialogStack.splice(i, 1);
        setExpanded(opener, false);
        restoreFocus(modal, opener);
    }
    function watchModal(modal) {
        if (modal.dataset.a11yWatched) return;
        modal.dataset.a11yWatched = '1';
        let open = isShown(modal);
        new MutationObserver(() => {
            const now = isShown(modal);
            if (now === open) return;
            open = now;
            now ? onModalOpen(modal) : onModalClose(modal);
        }).observe(modal, { attributes: true, attributeFilter: ['style', 'class'] });
    }
    function closeModal(modal) {
        // Use the dialog's own close control so its cleanup code runs; hide it directly only as a fallback.
        const btns = [...modal.querySelectorAll('button')].filter(visible);
        const close = modal.querySelector('.modal-close-x, [data-modal-close]') || btns.find(b => /^(cancel|close|done|not now|back|no)$/i.test(b.textContent.trim()));
        if (close) close.click(); else modal.style.display = 'none';
    }

    // ------------------------------------------------------------------ dropdown menus
    const menuOpeners = new Map();
    function watchMenu(menu) {
        if (menu.dataset.a11yWatched) return;
        menu.dataset.a11yWatched = '1';
        let open = menu.classList.contains('show');
        new MutationObserver(() => {
            const now = menu.classList.contains('show');
            if (now === open) return;
            open = now;
            if (now) {
                const opener = openerNow(menu);
                menuOpeners.set(menu, opener);
                setExpanded(opener, true);
                if (keyboardMode) setTimeout(() => { const first = focusables(menu)[0]; if (first) first.focus({ preventScroll: true }); }, 0);
            } else {
                const opener = menuOpeners.get(menu);
                setExpanded(opener, false);
                restoreFocus(menu, opener);
            }
        }).observe(menu, { attributes: true, attributeFilter: ['class'] });
    }

    // ------------------------------------------------------------------ keyboard: Escape, Tab trap, menu arrows
    document.addEventListener('keydown', (e) => {
        const openMenu = [...document.querySelectorAll('.dropdown-menu.show')].pop();
        if (e.key === 'Escape') {
            if (openMenu) { e.preventDefault(); openMenu.classList.remove('show'); return; }
            const top = dialogStack.filter(d => isShown(d.modal)).pop();
            if (top) { e.preventDefault(); closeModal(top.modal); }
            return;
        }
        if (openMenu && (e.key === 'ArrowDown' || e.key === 'ArrowUp') && openMenu.contains(document.activeElement)) {
            const items = focusables(openMenu);
            const i = items.indexOf(document.activeElement);
            const next = items[(i + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length];
            if (next) { e.preventDefault(); next.focus(); }
            return;
        }
        if (e.key === 'Tab') {
            const top = dialogStack.filter(d => isShown(d.modal)).pop();
            if (!top) return;
            const items = focusables(top.modal);
            if (!items.length) { e.preventDefault(); return; }
            const first = items[0], last = items[items.length - 1];
            const a = document.activeElement;
            if (!top.modal.contains(a)) { e.preventDefault(); first.focus(); }
            else if (e.shiftKey && (a === first || a === top.modal.querySelector('.modal-content'))) { e.preventDefault(); last.focus(); }
            else if (!e.shiftKey && a === last) { e.preventDefault(); first.focus(); }
        }
    });

    // ------------------------------------------------------------------ whole-row toggles (ML-211)
    // A row that directly holds one .toggle-switch is a tappable surface, so a tap anywhere on it flips
    // the switch - not only on the small switch itself. Taps on the switch or any other control in the
    // row keep their own behaviour, and rows that are themselves buttons (collapsible card headers)
    // are left alone, so nothing ever fires twice.
    document.addEventListener('click', (e) => {
        const t = e.target;
        if (!(t instanceof Element) || t.closest('.toggle-switch, button, a[href], input, select, textarea, [role="button"], label[for]')) return;
        const row = t.closest(':has(> .toggle-switch)');
        if (!row || row.matches('button, [role="button"]') || row.querySelectorAll(':scope > .toggle-switch').length !== 1) return;
        const input = row.querySelector(':scope > .toggle-switch input[type="checkbox"]');
        if (input && !input.disabled) input.click();
    });

    // ------------------------------------------------------------------ toggle state from icons
    // Play/pause and mute buttons show their state by swapping a Material Symbols icon, from many
    // places in app.js. Mirror that into aria-pressed here so a screen reader hears the state too:
    // pause icon = playing (pressed), volume_off = muted (pressed, on buttons that declare aria-pressed).
    const ICON_STATE = { play_arrow: false, pause: true };
    const MUTE_STATE = { volume_up: false, volume_off: true };
    function syncIconButton(icon) {
        const btn = icon.closest('button');
        if (!btn) return;
        const name = icon.textContent.trim();
        if (name in ICON_STATE) btn.setAttribute('aria-pressed', String(ICON_STATE[name]));
        else if (name in MUTE_STATE && btn.hasAttribute('aria-pressed')) btn.setAttribute('aria-pressed', String(MUTE_STATE[name]));
    }
    function watchIcons() {
        document.querySelectorAll('button .material-symbols-outlined').forEach(syncIconButton);
        new MutationObserver((muts) => {
            for (const m of muts) {
                const el = m.target.nodeType === 3 ? m.target.parentElement : m.target;
                const icon = el && el.closest && el.closest('button .material-symbols-outlined');
                if (icon) syncIconButton(icon);
                else if (m.type === 'childList') m.addedNodes.forEach(n => n.querySelectorAll && n.querySelectorAll('button .material-symbols-outlined').forEach(syncIconButton));
            }
        }).observe(document.body, { subtree: true, childList: true, characterData: true });
    }

    function init() {
        watchIcons();
        document.querySelectorAll('.modal').forEach(watchModal);
        document.querySelectorAll('.dropdown-menu').forEach(watchMenu);
        // Modals/menus added later (rare) get picked up too.
        new MutationObserver((muts) => {
            for (const m of muts) for (const n of m.addedNodes) {
                if (!(n instanceof HTMLElement)) continue;
                if (n.matches('.modal')) watchModal(n);
                if (n.matches('.dropdown-menu')) watchMenu(n);
                n.querySelectorAll && n.querySelectorAll('.modal').forEach(watchModal);
                n.querySelectorAll && n.querySelectorAll('.dropdown-menu').forEach(watchMenu);
            }
        }).observe(document.body, { childList: true, subtree: true });
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
