// ML-242: the front door (/) is the public page; the app is at /app. Loaded first in the public page's
// <head>, before anything draws, so someone it moves on never sees the page flash:
//  - a sign-in hand-back or "account closed" after the "#" (#authToken=..., #closed) - from a sign-in that
//    began before the move; the part after the "#" never reaches the server, so it is forwarded here;
//  - a member already signed in on this device who arrives from outside - typed the address, a bookmark, or
//    an app installed on a phone before the move (an iPhone keeps opening the old address for ever).
// A visitor stays, and so does a member who followed a link from our own pages (Pricing, the policies) -
// they came to read it. Nothing is sent anywhere; this only reads whether the device holds a sign-in.
// It also forwards a link made for the app before the move (?invite=, ?reset=, ?flow=...): on Vercel the front
// door is answered straight from public/index.html, so the server's own forwarding never runs there. The list
// is APP_LINK_KEYS in server/utils/appPath.js - keep the two in step (server/test/appPath.test.js checks).
(function () {
    var APP_LINK_KEYS = ['invite', 'reset', 'band-invite', 'change-email', 'flow', 'flowMode', 'preview', 'authToken'];
    var hash = location.hash || '';
    var toApp = function () { location.replace('/app' + location.search + hash); };
    if (/^#(authToken=|closed)/.test(hash)) { toApp(); return; }
    var params = new URLSearchParams(location.search);
    if (APP_LINK_KEYS.some(function (key) { return params.has(key); })) { toApp(); return; }
    var signedIn = false;
    try { signedIn = !!localStorage.getItem('authToken'); } catch (e) { signedIn = false; }
    if (!signedIn) return;
    var installed = (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) || window.navigator.standalone === true;
    var fromOurPages = document.referrer.indexOf(location.origin + '/') === 0;
    if (installed || !fromOurPages) toApp();
})();
