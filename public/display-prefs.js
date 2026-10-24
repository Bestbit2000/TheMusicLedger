// ML-356: display and reading preferences, applied before the page draws - loaded as the first thing in
// <body>, so dark mode, the reading font, background colour and text size are right from the first
// frame (no flash). They're saved on the account (accounts.display_prefs); this reads the copy app.js
// keeps on the device (localStorage tml.display), falling back to the old per-device darkMode. The
// attributes it sets are what tokens.css switches on. See docs/display-and-reading.md.
(function () {
    var prefs = {};
    try {
        prefs = JSON.parse(localStorage.getItem('tml.display') || '{}') || {};
        if (prefs.darkMode === undefined && localStorage.getItem('darkMode') === 'true') prefs.darkMode = true;
    } catch (e) { prefs = {}; }
    // ML-603: Reduce motion is on when the member switched it on, or when the device asks for less motion -
    // one attribute (data-motion="reduce") that style.css and app.js both follow. It changes with the device.
    var deviceMotion = null;
    try { deviceMotion = window.matchMedia('(prefers-reduced-motion: reduce)'); } catch (e) { /* none */ }
    var current = prefs;
    window.applyDisplayPrefs = function (p) {
        var root = document.documentElement;
        var set = function (name, value, standard) {
            if (value && value !== standard) root.setAttribute('data-' + name, value); else root.removeAttribute('data-' + name);
        };
        current = p;
        set('font', p.font, 'standard');
        set('bg', p.background, 'standard');
        set('text', p.textSize, 'standard');
        set('reading', p.dyslexia ? 'on' : '', '');
        set('motion', p.reduceMotion || (deviceMotion && deviceMotion.matches) ? 'reduce' : '', '');
        if (document.body) document.body.classList.toggle('dark-mode', !!p.darkMode);
    };
    if (deviceMotion && deviceMotion.addEventListener) deviceMotion.addEventListener('change', function () { window.applyDisplayPrefs(current); });
    window.applyDisplayPrefs(prefs);
})();
