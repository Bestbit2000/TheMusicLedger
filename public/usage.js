// ML-22: usage counts - how much each tool and each button is used, counted, never who.
// Loaded in the browser (window.Usage, before app.js), by the server (the list of uses it accepts,
// server/services/usageCounts.js) and by scripts/usage-buttons.mjs (the same naming rule for buttons).
// What counts as a use is docs/usage-stats.md - change it there first.
//
// Three kinds of count, each a number per item per day, on its own or in a practice session:
//   'use'  - a tool set going (started) and getting to its natural end (finished): USES below
//   'tap'  - a button pressed, by where it was pressed and the button's own name - never its words
//   'view' - a screen opened
// Each also says when it was this member's first time today with the item, so the server can add one to
// "members" - kept as a number only. The device remembers which items it has said that for today
// (localStorage 'tml.usageSeen', removed at sign-out).
(function (root, factory) {
    if (typeof module === 'object' && module.exports) module.exports = factory();
    else root.Usage = factory();
}(typeof self !== 'undefined' ? self : this, function () {
    'use strict';

    // Every use counted by the app itself (the rest come from rows the app already keeps - docs/usage-stats.md).
    // finishAfter: the use is finished once it has run this long (ms) without being stopped.
    const USES = {
        metronome: { finishAfter: 30000 },     // Quick Play: Play pressed / 30 seconds played
        tuner: {},                             // microphone on / a note heard
        'tuning-fork': { finishAfter: 5000 },  // a note played / 5 seconds sounded
        timer: {},                             // Start pressed / ran to the end
        warmups: {},                           // Play pressed / played to the end
        scales: {},                            // Play pressed / played to the end, or Got it / Not yet
        rehearse: { finishAfter: 60000 },      // a piece's Play pressed / played to the end or for 1 minute
        recording: { finishAfter: 30000 },     // a recording or video played with the bars / 30 seconds
        session: {},                           // a practice session started / every block played, or time up
        'session-rest': {},                    // the 30-second rest shown / it ran out (not skipped)
        'block:warmup': {}, 'block:scales': {}, 'block:skills': {}, 'block:rehearsal': {}, 'block:theory': {}, 'block:prepare': {},
        'plan:standard': {}, 'plan:concert': {}, 'plan:own': {},
        prepare: {},                           // a piece's path opened / a step done
        setup: {}                              // set-up begun / finished rather than left
    };
    const SAME_USE_MS = 60000; // Play, Stop, Play again within a minute is one use
    const KINDS = ['use', 'tap', 'view'];
    const PLACES = ['own', 'session'];
    // A tap's or a screen's name: letters, digits and a few signs - never typed text
    const ITEM = /^[A-Za-z0-9 _:#()=.\/>-]{1,160}$/;

    // The name a button is counted by, from its attributes in order ([[name, value], ...]) - its id, its
    // data-act (with a data-arg that is a word), its first other data-* attribute (with a value that is a
    // word), or - for a button with none of those - its data-count. A run of digits becomes N, so every row
    // of a list is one button. null: no name.
    const word = (v) => /^[a-zA-Z_-]+$/.test(v || '');
    const digits = (s) => String(s).replace(/\d+/g, 'N');
    const SKIP = ['data-modal-x', 'data-tooltip', 'data-count'];
    function buttonName(attrs, isCloseX) {
        const get = (n) => { const a = attrs.find(([k]) => k === n); return a ? a[1] : null; };
        const id = get('id');
        if (id && !id.includes('${')) return `#${digits(id)}`;
        const act = get('data-act');
        if (act) { const arg = get('data-arg'); return word(arg) ? `${act}(${arg})` : act; }
        const data = attrs.find(([k]) => k.startsWith('data-') && !SKIP.includes(k));
        if (data) return `${data[0]}${word(data[1]) ? `=${data[1]}` : ''}`;
        const own = get('data-count');
        if (own) return own;
        if (isCloseX) return 'close (X)';
        return null;
    }
    // An option's own key as a word for data-option (a tile's value: 'treble', 'both', 'repeat')
    const optionKey = (v) => String(v === undefined || v === null ? '' : v).toLowerCase().replace(/[^a-z]+/g, '-').replace(/^-+|-+$/g, '') || 'option';
    // A button on the page
    const nameOf = (el) => buttonName([...el.attributes].map((a) => [a.name, a.value]), el.classList.contains('modal-close-x'));

    // Pop-ups many tools share are counted with the screen behind them, so a choice on Scales and one on
    // Warm-ups are two numbers
    const SHARED = ['flowChoiceModal', 'confirmModal', 'promptModal', 'editModal', 'listItemModal'];

    // ---- the browser side: counts gathered on the device and sent every 30 seconds
    let cfg = null;      // { send(rows), place(), screen(), who() }
    const counts = new Map(); // `${kind}|${item}|${place}` -> { k, i, p, s, f, m }
    const live = new Map();   // use item -> { at, finished, timer, stopped }
    let flushTimer = null;

    function seenToday(key) {
        if (!cfg) return true;
        const day = new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/London' });
        const who = cfg.who();
        let seen = null;
        try { seen = JSON.parse(localStorage.getItem('tml.usageSeen') || 'null'); } catch (e) { seen = null; }
        if (!seen || seen.day !== day || seen.who !== who) seen = { day, who, keys: [] };
        if (seen.keys.includes(key)) return true;
        if (seen.keys.length < 3000) seen.keys.push(key);
        try { localStorage.setItem('tml.usageSeen', JSON.stringify(seen)); } catch (e) { /* full or blocked - counted again */ }
        return false;
    }
    function add(kind, item, field) {
        if (!cfg || !ITEM.test(item)) return;
        const p = cfg.place();
        const key = `${kind}|${item}|${p}`;
        const row = counts.get(key) || { k: kind, i: item, p, s: 0, f: 0, m: 0 };
        row[field] += 1;
        if (field === 's' && !seenToday(key)) row.m += 1;
        counts.set(key, row);
        if (!flushTimer) flushTimer = setTimeout(flush, 30000);
    }
    async function flush() {
        clearTimeout(flushTimer);
        flushTimer = null;
        if (!cfg || !counts.size) return;
        const rows = [...counts.values()];
        counts.clear();
        try { await cfg.send(rows); }
        catch (e) {
            // no connection (or the server is busy): put them back for next time - lost only if the app closes
            rows.forEach((r) => { const key = `${r.k}|${r.i}|${r.p}`; const x = counts.get(key); counts.set(key, x ? { ...x, s: x.s + r.s, f: x.f + r.f, m: x.m + r.m } : r); });
            if (!flushTimer) flushTimer = setTimeout(flush, 60000);
        }
    }

    // A tool set going. A second start within a minute of the last stop is the same use.
    function begin(item) {
        if (!USES[item]) return;
        const u = live.get(item);
        const now = Date.now();
        if (u && (!u.stopped || now - u.stopped < SAME_USE_MS)) {
            u.stopped = 0;
            if (!u.finished && USES[item].finishAfter && !u.timer) u.timer = setTimeout(() => finish(item), Math.max(0, USES[item].finishAfter - (u.ran || 0)));
            u.at = now;
            return;
        }
        const fresh = { at: now, ran: 0, finished: false, stopped: 0, timer: null };
        if (USES[item].finishAfter) fresh.timer = setTimeout(() => finish(item), USES[item].finishAfter);
        live.set(item, fresh);
        add('use', item, 's');
    }
    // Paused or stopped: a use that finishes after a time waits for the next Play
    function end(item) {
        const u = live.get(item);
        if (!u || u.stopped) return;
        u.ran += Date.now() - u.at;
        u.stopped = Date.now();
        clearTimeout(u.timer);
        u.timer = null;
    }
    // Got to its natural end - once per use
    function finish(item) {
        const u = live.get(item);
        if (!u || u.finished) return;
        u.finished = true;
        clearTimeout(u.timer);
        u.timer = null;
        add('use', item, 'f');
    }
    // Something that is only ever started (a plan picked)
    function mark(item) { if (USES[item]) add('use', item, 's'); }
    function tap(el) {
        if (!cfg) return;
        const name = nameOf(el);
        if (!name) return;
        const modal = el.closest('.modal');
        const view = el.closest('[id$="View"]');
        const screen = cfg.screen();
        const where = modal ? (SHARED.includes(modal.id) ? `${screen}>${modal.id}` : modal.id) : view ? view.id : screen;
        add('tap', digits(`${where} ${name}`).slice(0, 160), 's');
    }
    function view(id) { if (/^[a-zA-Z0-9]+View$/.test(id || '')) add('view', id, 's'); }

    function start(options) {
        cfg = options;
        if (typeof document === 'undefined') return;
        // Every button, as it is pressed - before the button's own code runs, so a button that changes the
        // screen is still counted where it was
        document.addEventListener('click', (e) => { const b = e.target.closest && e.target.closest('button'); if (b && !b.disabled) tap(b); }, true);
        document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flush(); });
    }
    function forget() { try { localStorage.removeItem('tml.usageSeen'); } catch (e) { /* nothing kept */ } counts.clear(); live.clear(); }

    return { USES, KINDS, PLACES, ITEM, SHARED, buttonName, optionKey, start, begin, end, finish, mark, view, flush, forget };
}));
