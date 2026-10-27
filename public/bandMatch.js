// ML-625: "Did you mean...?" for a band typed in rather than picked from the band directory. Someone asking to join
// typed "Cobham" and never picked "Cobham Brass Band (Cobham)" from the list, so the request wasn't tied to the
// band. These are the bands a typed name most likely means - by spelling alone, no AI: capitals, punctuation and
// accents don't count, nor words every band has ("band", "brass", "concert", "the"...), a word can be the start
// of a longer one ("Cob" - Cobham) or a slip of a letter or two ("Cobam"), and the town counts as much as the name.
// Pure logic, no DOM: loaded on the public page (window.BandMatch, before join.js), by the server for Admin ->
// Waiting list's "Match to a band" (server/services/joinRequests.js, with vm), and in Node by
// server/test/bandMatch.test.js. docs/waiting-list.md, "Did you mean".
(function (root, factory) {
    if (typeof module === 'object' && module.exports) module.exports = factory();
    else root.BandMatch = factory();
}(typeof self !== 'undefined' ? self : this, function () {
    'use strict';

    // Words that say what kind of band it is, not which - left out on both sides
    const COMMON = new Set(['the', 'and', 'of', 'band', 'bands', 'brass', 'silver', 'concert', 'wind', 'winds', 'orchestra', 'symphonic', 'symphony', 'ensemble', 'music', 'musical', 'society', 'community', 'district']);
    const MAX = 5; // never a long list to read through

    function words(text) {
        return String(text || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
            .replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, ' ').trim().split(' ').filter(w => w && !COMMON.has(w));
    }

    // Letters changed, added or left out to get from one word to the other
    function distance(a, b) {
        let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
        for (let i = 1; i <= a.length; i++) {
            const row = [i];
            for (let j = 1; j <= b.length; j++) row[j] = Math.min(prev[j] + 1, row[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
            prev = row;
        }
        return prev[b.length];
    }

    // How well one typed word matches one of the band's words: 1 the same, 0.9 the start of it, 0.8 a slip
    // (one letter in a word of 4 or more, two in a word of 7 or more), else 0
    function wordScore(typed, theirs) {
        if (typed === theirs) return 1;
        if (typed.length >= 3 && theirs.startsWith(typed)) return 0.9;
        const allowed = typed.length >= 7 ? 2 : typed.length >= 4 ? 1 : 0;
        return allowed && Math.abs(typed.length - theirs.length) <= allowed && distance(typed, theirs) <= allowed ? 0.8 : 0;
    }

    // A directory band as the form offers it, "Name (Town)", into its words
    function labelWords(label) {
        const m = String(label).match(/^(.*?)\s*\(([^()]*)\)\s*$/);
        return words(m ? `${m[1]} ${m[2]}` : label);
    }

    // True when the typed name already is one of the bands (as the server matches it: the name or "Name (Town)")
    function isExact(typed, labels) {
        const t = String(typed || '').trim().toLowerCase();
        return !!t && labels.some(l => l.toLowerCase() === t || l.replace(/\s*\([^()]*\)\s*$/, '').toLowerCase() === t);
    }

    // The bands a typed name most likely means, best first - none when it already is one, or nothing is close.
    // At least half the words typed have to match one of the band's words ("Cobham Silver" - The Cobham Band): the
    // person can always say "None of these", and the closest come first.
    function suggest(typed, labels) {
        if (isExact(typed, labels)) return [];
        const mine = words(typed);
        if (!mine.length) return [];
        const need = Math.ceil(mine.length / 2);
        const found = [];
        labels.forEach((label, i) => {
            const theirs = labelWords(label);
            if (!theirs.length) return;
            let matched = 0, score = 0;
            mine.forEach(w => {
                const best = Math.max(0, ...theirs.map(t => wordScore(w, t)));
                if (best) { matched++; score += best; }
            });
            if (matched >= need) found.push({ label, score: score / mine.length, extra: theirs.length - matched, i });
        });
        return found.sort((a, b) => b.score - a.score || a.extra - b.extra || a.i - b.i).slice(0, MAX).map(f => f.label);
    }

    return { suggest, isExact, words, MAX };
}));
