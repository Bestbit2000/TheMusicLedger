// The app's own files, kept on the device so it opens with no connection. Network first: a newer file
// always wins when there is a connection; the kept copy is only the fallback.
//
// ML-220: answers from the server (/api/, /auth/) are NOT kept here. They used to be, which left one
// member's data on the device after sign-out, where the next person to sign in could be shown it. The
// copy of a member's data for offline use is kept by public/offline.js instead - it belongs to one
// member and is wiped at sign-out. Bumping CACHE_NAME drops the old cache, answers and all.
const CACHE_NAME = 'music-ledger-v2';
const APP_SHELL = ['/', '/index.html', '/tokens.css', '/style.css', '/display-prefs.js', '/brand.js', '/images/brands/music-ledger-mark.svg', '/images/brands/notably-better-mark.svg', '/images/brands/fivetto-mark.svg', '/flowJourney.js', '/practicePlan.js', '/pieceOutline.js', '/notation.js', '/range.js', '/rangeBar.js', '/avatars.js', '/homeGreeting.js', '/theoryEngine.js', '/scaleGrades.js', '/warmups.js', '/drills.js', '/rhythm.js', '/fonts/bravura.woff2', '/fonts/inter-latin.woff2', '/fonts/material-symbols-outlined.woff2', '/offline.js', '/app.js', '/a11y.js'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(names.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n)))
    )
  );
  self.clients.claim();
});

const isServerAnswer = (url) => url.origin !== self.location.origin || url.pathname.startsWith('/api/') || url.pathname.startsWith('/auth/');

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  if (isServerAnswer(new URL(event.request.url))) return; // straight to the network, nothing kept

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        }
        return response;
      })
      // No connection: the kept copy. A page address that was never kept (a link with ?flow=...) gets the app itself.
      .catch(() => caches.match(event.request, { ignoreSearch: event.request.mode === 'navigate' }).then((kept) => kept || (event.request.mode === 'navigate' ? caches.match('/index.html') : Response.error())))
  );
});
