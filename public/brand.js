// ML-484: which name the app goes by on screen. "The Music Ledger" is a working title; while a new name
// is tried out, a super admin picks one of three on Admin -> App name and everyone sees it - signed in or
// not. Only what is on screen follows it: the sign-in picture, the name and small mark at the top of Home
// and in the menu rail, and the browser tab. The privacy policy, the terms, emails and the installed app
// stay "The Music Ledger". docs/brand-trial.md.
//
// This runs as soon as the sign-in screen, the top bar and the menu are in the page. It shows the brand
// this device saw last straight away, asks the server which it is now (/api/brand - open, and it answers
// with one word), and puts it right if it has changed. Until the answer is known for the first time the
// picture, the mark and the name are held back (html:not([data-brand-ready]) in style.css), so nobody
// sees one name and then another. With no connection it is the last brand seen, or the default.
(function () {
    'use strict';
    const DEFAULT = 'music-ledger';
    const BRANDS = {
        'music-ledger': { name: 'The Music Ledger', splash: 'images/LedgeSplash.jpg' },
        'notably-better': { name: 'Notably Better', splash: 'images/brands/notably-better-splash.jpg' },
        fivetto: { name: 'Fivetto', splash: 'images/brands/fivetto-splash.jpg' }
    };
    const STORE = 'tml.brand';
    const root = document.documentElement;
    const $ = (id) => document.getElementById(id);
    const valid = (key) => (typeof key === 'string' && Object.prototype.hasOwnProperty.call(BRANDS, key) ? key : DEFAULT);
    const names = Object.keys(BRANDS).map((key) => BRANDS[key].name);
    let current = DEFAULT;

    function setSrc(el, src) { if (el && el.getAttribute('src') !== src) el.setAttribute('src', src); }
    function setHref(el, href) { if (el && el.getAttribute('href') !== href) el.setAttribute('href', href); }

    function apply(key) {
        const before = BRANDS[current].name;
        current = valid(key);
        const brand = BRANDS[current];
        root.dataset.brand = current;
        setHref($('brandTabIcon'), `images/brands/${current}-tab.svg`);
        setHref($('brandTabIconPng'), `images/brands/${current}-tab.png`);
        const splash = $('splashImage');
        if (splash) { setSrc(splash, brand.splash); splash.alt = brand.name; }
        setSrc($('railBrandMark'), `images/brands/${current}-mark.svg`);
        setSrc($('topBrandMark'), `images/brands/${current}-mark.svg`);
        const railName = $('railBrandName');
        if (railName) railName.textContent = brand.name;
        // The top bar shows the app's name on Home (on a phone); any other screen's title is left alone.
        const title = $('topTitle');
        if (title && names.includes(title.textContent.trim())) title.textContent = brand.name;
        // The tab: "<screen> - <name>", or the name alone.
        const tab = document.title;
        if (tab === before || names.includes(tab)) document.title = brand.name;
        else if (tab.endsWith(` - ${before}`)) document.title = `${tab.slice(0, -before.length)}${brand.name}`;
    }
    const ready = () => { root.dataset.brandReady = ''; };

    // A trial brand's sign-in picture that can't be fetched (never seen on this device, and no connection):
    // the picture every device has.
    $('splashImage')?.addEventListener('error', (e) => { setSrc(e.currentTarget, BRANDS[DEFAULT].splash); });

    let remembered = null;
    try { remembered = localStorage.getItem(STORE); } catch (e) { /* the default, until the server says */ }
    apply(remembered);
    if (remembered) ready();

    const known = (key) => {
        apply(key);
        try { localStorage.setItem(STORE, current); } catch (e) { /* asked again next time, that's all */ }
    };
    fetch('/api/brand', { cache: 'no-store' })
        .then((res) => (res.ok ? res.json() : Promise.reject(new Error('no answer'))))
        .then((data) => known(data && data.brand))
        .catch(() => { /* offline, or the server is busy: what this device last saw */ })
        .then(ready);
    setTimeout(ready, 2500); // never hold the screen back for a slow answer

    window.Brand = { name: () => BRANDS[current].name, key: () => current, known };
})();
