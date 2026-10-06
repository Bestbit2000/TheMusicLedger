// ML-220: using the app with no internet, and syncing afterwards.
//
// Three jobs, all on the device (IndexedDB "music-ledger-offline"):
//   1. answers - the last answer the server gave to each read (GET), so the app can open and the tools
//      can run from what was last seen when there is no connection.
//   2. outbox  - what was logged offline (a session, a quiz round, a Level...), waiting to be sent. Only
//      the writes in QUEUE below wait like this: they are records of something done, so they can't clash
//      with a change made elsewhere. Everything else (editing a piece, bands, the account) needs a
//      connection and says so. Each waiting item has its own id, sent as X-Client-Write-Id, so the server
//      never counts one twice (server/services/clientWrites.js).
//   3. meta    - whose copy this is. A different member signing in on the device wipes all of it; signing
//      out wipes the answers (and, when the member chose to sign out, the outbox too).
//
// The rules (what waits, what is kept, the wording) are pure and tested in server/test/offline.test.js;
// app.js calls them from apiCall, the one function every server call goes through. If IndexedDB can't be
// used (a private window, storage blocked) every store function quietly does nothing and the app behaves
// as it did before: online only. Read docs/offline.md before changing any of it.
(function (root, factory) {
    const api = factory(root);
    if (typeof module === 'object' && module.exports) module.exports = api;
    root.Offline = api;
}(typeof self !== 'undefined' ? self : this, function (root) {
    'use strict';

    // ---------------------------------------------------------------- the rules (pure)

    const mins = (n) => `${Math.round(Number(n) || 0)} min`;
    // Writes that wait in the outbox when there is no connection: [method, path, what to call it]
    const QUEUE = [
        ['POST', /^\/api\/sessions$/, (b) => `Session: ${mins(b && b.duration)}`],
        ['POST', /^\/api\/practice\/sessions$/, (b) => `Practice session: ${mins(b && b.minutes)}`],
        ['POST', /^\/api\/theory\/attempts$/, () => 'Theory round'],
        ['POST', /^\/api\/drills\/[a-z0-9-]+\/attempts$/, () => 'Skills round'],
        ['POST', /^\/api\/levels\/chunks\/\d+$/, (b) => `Level ${b && b.level} on a piece`],
        ['POST', /^\/api\/practice\/scale-levels\/answer$/, () => 'Scale answer'],
        ['PUT', /^\/api\/practice\/scale-levels\/level$/, () => 'Scale Level'],
        ['POST', /^\/api\/practice\/skills\/result$/, () => 'Skill step'],
        ['POST', /^\/api\/range\/\d+\/goes$/, () => 'Range go'],
        ['POST', /^\/api\/metronome\/quick-play$/, () => 'Quick Play history'],
        ['PUT', /^\/api\/metronome\/history\/\d+$/, () => 'Quick Play history']
    ];
    // Writes that only keep the server in step with something running now (a timer, a session in
    // progress, a notification read). Offline they are dropped without a word: there is nothing to sync.
    const QUIET = [
        [/^(PUT|DELETE)$/, /^\/api\/timer\/active$/],
        [/^(PUT|DELETE)$/, /^\/api\/practice\/active$/],
        [/^POST$/, /^\/api\/notifications\//]
    ];
    // Reads never answered from the device: what is running right now, and anything private or one-off.
    const NO_COPY = [/^\/api\/timer\/active$/, /^\/api\/practice\/active$/, /^\/api\/notifications/, /^\/api\/notices\//, /^\/api\/account\/export/, /^\/api\/account\/two-step/, /^\/api\/invites/, /^\/api\/admin\//];

    const pathOf = (endpoint) => String(endpoint || '').split('?')[0];

    // What to do with a write when there is no connection: wait in the outbox ('queue', with its label),
    // drop it ('quiet'), or refuse it ('online' - it needs a connection).
    function classify(method, endpoint, body) {
        const m = String(method || 'GET').toUpperCase();
        const path = pathOf(endpoint);
        const q = QUEUE.find(([qm, re]) => qm === m && re.test(path));
        if (q) return { kind: 'queue', label: q[2](body || {}) };
        if (QUIET.some(([qm, re]) => qm.test(m) && re.test(path))) return { kind: 'quiet' };
        return { kind: 'online' };
    }
    // Is a read's answer kept on the device?
    const keeps = (endpoint) => !NO_COPY.some((re) => re.test(pathOf(endpoint)));

    const QUEUED_MESSAGE = 'Saved on this device. It will sync when you are back online.';
    const NEEDS_CONNECTION = 'You are offline. This needs a connection.';
    const NOT_ON_DEVICE = 'You are offline, and this has not been saved on this device yet.';

    // The bar under the top bar: whether it shows, and what it says.
    function status({ offline, waiting, failed }) {
        const w = Number(waiting) || 0;
        const f = Number(failed) || 0;
        const things = (n) => `${n} thing${n === 1 ? '' : 's'}`;
        if (!offline && !w && !f) return { show: false, text: '', button: '' };
        if (offline) return { show: true, text: w + f ? `Offline. ${things(w + f)} waiting to sync.` : 'Offline. What you log is kept on this device and synced later.', button: w + f ? 'See them' : '' };
        if (f && !w) return { show: true, text: `${things(f)} could not be synced.`, button: 'See why' };
        return { show: true, text: `${things(w + f)} waiting to sync.`, button: 'Sync now' };
    }

    // Send what is waiting, oldest first. send(item) answers 'sent', 'stop' (no connection, or signed
    // out - try again later, and nothing after it is tried: the order matters) or { failed: 'why' } (the
    // server refused it for good; it stays in the list for the member to see, and the rest carry on).
    async function runSync(items, send) {
        const out = { sent: [], failed: [], stopped: false };
        for (const item of items) {
            if (item.failed) continue; // already refused once: it waits for the member, not another try
            let answer;
            try { answer = await send(item); } catch (error) { answer = 'stop'; }
            if (answer === 'sent') out.sent.push(item.id);
            else if (answer && answer.failed) out.failed.push({ id: item.id, why: String(answer.failed) });
            else { out.stopped = true; break; }
        }
        return out;
    }

    function newId() {
        const c = root.crypto;
        if (c && typeof c.randomUUID === 'function') return c.randomUUID();
        const hex = Array.from({ length: 32 }, () => Math.floor(Math.random() * 16).toString(16));
        hex[12] = '4';
        hex[16] = '89ab'[Math.floor(Math.random() * 4)];
        return `${hex.slice(0, 8).join('')}-${hex.slice(8, 12).join('')}-${hex.slice(12, 16).join('')}-${hex.slice(16, 20).join('')}-${hex.slice(20).join('')}`;
    }

    // ---------------------------------------------------------------- the store (IndexedDB)

    const DB_NAME = 'music-ledger-offline';
    const STORES = ['answers', 'outbox', 'meta'];
    let dbPromise = null;
    function db() {
        if (dbPromise) return dbPromise;
        dbPromise = new Promise((resolve) => {
            try {
                if (!root.indexedDB) return resolve(null);
                const open = root.indexedDB.open(DB_NAME, 1);
                open.onupgradeneeded = () => {
                    open.result.createObjectStore('answers', { keyPath: 'key' });
                    open.result.createObjectStore('outbox', { keyPath: 'id' });
                    open.result.createObjectStore('meta', { keyPath: 'key' });
                };
                open.onsuccess = () => resolve(open.result);
                open.onerror = () => resolve(null);
                open.onblocked = () => resolve(null);
            } catch (error) { resolve(null); }
        });
        return dbPromise;
    }
    // One request in one transaction; resolves with its result, or `fallback` if the store can't be used.
    async function run(store, mode, work, fallback) {
        const d = await db();
        if (!d) return fallback;
        return new Promise((resolve) => {
            try {
                const tx = d.transaction(store, mode);
                const req = work(tx.objectStore(store));
                tx.oncomplete = () => resolve(req && 'result' in req ? req.result : undefined);
                tx.onerror = () => resolve(fallback);
                tx.onabort = () => resolve(fallback);
            } catch (error) { resolve(fallback); }
        });
    }
    const clear = (store) => run(store, 'readwrite', (s) => s.clear());

    // Whose copy is this? A different member's is wiped before anything is read from it.
    async function start(owner) {
        const who = String(owner || '');
        const meta = await run('meta', 'readonly', (s) => s.get('owner'), null);
        if (meta && meta.value !== who) await Promise.all(STORES.map(clear));
        await run('meta', 'readwrite', (s) => s.put({ key: 'owner', value: who }));
    }

    // ML-465: the member changed their email address on this device. The copy is still theirs - it is
    // handed to the new address rather than wiped as another member's would be.
    async function rename(from, to) {
        const meta = await run('meta', 'readonly', (s) => s.get('owner'), null);
        if (meta && meta.value === String(from || '')) await run('meta', 'readwrite', (s) => s.put({ key: 'owner', value: String(to || '') }));
    }

    const remember = (endpoint, json) => (keeps(endpoint) ? run('answers', 'readwrite', (s) => s.put({ key: String(endpoint), json, at: Date.now() })) : Promise.resolve());
    const recall = (endpoint) => (keeps(endpoint) ? run('answers', 'readonly', (s) => s.get(String(endpoint)), null) : Promise.resolve(null));

    async function enqueue({ endpoint, method, body, label }) {
        const item = { id: newId(), endpoint, method, body: body === undefined ? null : body, label, at: new Date().toISOString(), failed: null };
        const d = await db();
        if (!d) return null; // nowhere to keep it: the caller says it wasn't saved
        await run('outbox', 'readwrite', (s) => s.put(item));
        return item;
    }
    async function waiting() {
        const items = await run('outbox', 'readonly', (s) => s.getAll(), []);
        return (items || []).sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : 0));
    }
    const remove = (id) => run('outbox', 'readwrite', (s) => s.delete(id));
    async function markFailed(id, why) {
        const item = await run('outbox', 'readonly', (s) => s.get(id), null);
        if (item) await run('outbox', 'readwrite', (s) => s.put({ ...item, failed: String(why || 'The server refused it.') }));
    }

    // Signing out: the copy of the member's data goes, and so does anything the service worker kept.
    // The outbox goes too when the member chose to sign out (or deleted the account); after a sign-out
    // forced by an expired sign-in it stays, so what was logged offline is sent when they sign back in.
    async function wipe({ outbox = true } = {}) {
        await clear('answers');
        if (outbox) { await clear('outbox'); await clear('meta'); }
        try {
            if (root.caches) await Promise.all((await root.caches.keys()).map((name) => root.caches.delete(name)));
        } catch (error) { /* nothing kept there */ }
    }

    return {
        QUEUED_MESSAGE, NEEDS_CONNECTION, NOT_ON_DEVICE,
        classify, keeps, status, runSync, newId,
        start, rename, remember, recall, enqueue, waiting, remove, markFailed, wipe
    };
}));
