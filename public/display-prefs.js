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

// ML-650: icons are words the icon font turns into pictures. While the font is still on its way, data-icons="loading"
// on <html> keeps each icon blank (style.css) instead of showing its name; if it hasn't come after 10 seconds (a
// very slow line, an old browser, Safari's Lockdown Mode), "none" keeps them blank for good. Usually it is already
// here from the cache and nothing is set.
(function () {
    var root = document.documentElement;
    var ICONS = '24px "Material Symbols Outlined"';
    try {
        if (!document.fonts || document.fonts.check(ICONS)) return;
    } catch (e) { return; }
    root.setAttribute('data-icons', 'loading');
    var done = false;
    var giveUp = setTimeout(function () { if (!done) root.setAttribute('data-icons', 'none'); }, 10000);
    document.fonts.load(ICONS).then(function () {
        done = true;
        clearTimeout(giveUp);
        if (document.fonts.check(ICONS)) root.removeAttribute('data-icons');
        else root.setAttribute('data-icons', 'none');
    }, function () { done = true; clearTimeout(giveUp); root.setAttribute('data-icons', 'none'); });
})();
