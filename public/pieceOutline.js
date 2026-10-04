// ML-424: Quick piece entry. A piece entered as an OUTLINE - how many bars, where the rehearsal marks are,
// which bars are exceptions (a different time signature, a new speed) and the extras (repeats, pauses,
// speeding up, signs, intro) - all by the bar numbers printed on the music. This file turns that outline
// into the same blocks the bar-by-bar editor makes: a new block at every rehearsal mark, change of time
// signature, change of speed and repeat boundary, one rehearsal mark per block. Nothing here touches the
// screen or the server; app.js (the QUICK PIECE ENTRY section) draws the steps and saves the blocks.
// Rules and the reasoning: docs/quick-piece-entry.md. Tests: server/test/pieceOutline.test.js.
(function (root, factory) {
    const api = factory();
    if (typeof module === 'object' && module.exports) module.exports = api;
    else root.PieceOutline = api;
}(typeof self !== 'undefined' ? self : this, function () {
    const MAX_BARS = 2000;
    const SIGNS = {
        segno: { label: 'Segno (the sign)', at: 'start', flag: 'isSegno' },
        coda: { label: 'Coda', at: 'start', flag: 'isCoda' },
        toCoda: { label: 'To Coda', at: 'end', flag: 'gotoCoda' },
        ds: { label: 'D.S. (back to the sign)', at: 'end', flag: 'gotoSegno' },
        dsCoda: { label: 'D.S. al Coda', at: 'end', flag: 'gotoSegnoThenCoda' },
        dc: { label: 'D.C. (back to the start)', at: 'end', flag: 'gotoStartDc' },
        dcCoda: { label: 'D.C. al Coda', at: 'end', flag: 'gotoStartDcThenCoda' },
        fine: { label: 'Fine', at: 'end', flag: 'isFine' }
    };
    const EXTRA_KINDS = ['repeat', 'repeatEndings', 'pause', 'ramp', 'sign', 'intro'];

    const int = (v) => { const n = Number(v); return Number.isInteger(n) ? n : NaN; };
    const inPiece = (o, bar) => Number.isInteger(bar) && bar >= 1 && bar <= o.bars;

    // "7, 21 30; 38" -> the bar numbers, in order, once each. Spaces, commas, semicolons, full stops and new
    // lines all separate. bad: what wasn't a bar of this piece (a word, 0, a bar past the end).
    function parseBarList(text, totalBars) {
        const bars = [];
        const bad = [];
        String(text || '').split(/[\s,;.]+/).filter(Boolean).forEach(tok => {
            const n = /^\d+$/.test(tok) ? Number(tok) : NaN;
            if (Number.isInteger(n) && n >= 1 && (!totalBars || n <= totalBars)) { if (!bars.includes(n)) bars.push(n); }
            else bad.push(tok);
        });
        bars.sort((a, b) => a - b);
        return { bars, bad };
    }

    // The rehearsal marks as [{ bar, label }], in bar order, one per bar (the last one typed wins).
    function marksOf(o) {
        if (o.markKind === 'none') return [];
        const byBar = new Map();
        (o.marks || []).forEach(m => {
            const bar = int(m.bar);
            if (!inPiece(o, bar)) return;
            const label = o.markKind === 'numbers' ? String(bar) : String(m.label || '').trim();
            if (label) byBar.set(bar, label);
        });
        return [...byBar.entries()].sort((a, b) => a[0] - b[0]).map(([bar, label]) => ({ bar, label }));
    }

    // A bar's time signature: its own if it's an exception, else the main one.
    const sigAt = (o, bar) => (o.time && o.time[bar]) || o.mainSig;
    // The speed rows that count, in bar order: a bar in the piece and a real bpm; bar 1 is the main speed's.
    function speedRows(o) {
        const byBar = new Map();
        (o.speeds || []).forEach(s => {
            const bar = int(s.bar), bpm = int(s.bpm);
            if (inPiece(o, bar) && bar > 1 && bpm > 0) byBar.set(bar, { bar, bpm, noteValue: s.noteValue === undefined ? undefined : s.noteValue });
        });
        return [...byBar.values()].sort((a, b) => a.bar - b.bar);
    }
    // The speed in force at a bar: { bpm, noteValue }. A row's beat note carries on from the row above
    // unless it sets its own.
    function speedAt(o, bar) {
        let cur = { bpm: o.mainBpm, noteValue: o.mainNote || null };
        for (const s of speedRows(o)) {
            if (s.bar > bar) break;
            cur = { bpm: s.bpm, noteValue: s.noteValue === undefined ? cur.noteValue : s.noteValue };
        }
        return cur;
    }

    // The sections the bars are drawn in: one per rehearsal mark (plus the bars before the first), or the
    // whole piece as one when there are none. [{ from, to, label }] - label null for the unmarked start.
    function sections(o) {
        const marks = marksOf(o);
        if (!marks.length) return [{ from: 1, to: o.bars, label: null }];
        const out = [];
        if (marks[0].bar > 1) out.push({ from: 1, to: marks[0].bar - 1, label: null });
        marks.forEach((m, i) => out.push({ from: m.bar, to: (marks[i + 1] ? marks[i + 1].bar : o.bars + 1) - 1, label: m.label }));
        return out;
    }
    // The exceptions in words: [{ sig, bars }] - how many bars each other time signature has.
    function timeSummary(o) {
        const counts = new Map();
        Object.keys(o.time || {}).forEach(b => { const bar = Number(b); const sig = o.time[b]; if (inPiece(o, bar) && sig && sig !== o.mainSig) counts.set(sig, (counts.get(sig) || 0) + 1); });
        return [...counts.entries()].map(([sig, bars]) => ({ sig, bars }));
    }

    // --- The extras, checked on their own (bar numbers that make sense). Returns a message or null. ---
    function extraProblem(o, x) {
        const bars = (...list) => list.every(b => inPiece(o, b));
        if (x.type === 'repeat' || x.type === 'repeatEndings') {
            if (!bars(x.from, x.to)) return 'Its bars aren\'t in the piece.';
            if (x.to < x.from) return 'It ends before it starts.';
            if (!(int(x.times) >= 2)) return 'It has to be played at least 2 times.';
            if (x.type === 'repeatEndings') {
                if (!bars(x.e1From, x.e2To)) return 'An ending\'s bars aren\'t in the piece.';
                if (x.e1From < x.from || x.e1From > x.to) return 'The 1st ending has to be inside the repeat.';
                if (x.e2To <= x.to) return 'The 2nd ending comes after the repeat.';
            }
            return null;
        }
        if (x.type === 'pause') {
            if (!bars(x.bar)) return 'Its bar isn\'t in the piece.';
            if (!(int(x.beat) >= 1)) return 'Which beat is it on?';
            if (!(Number(x.holdBeats) > 0)) return 'How many beats is it held?';
            return null;
        }
        if (x.type === 'ramp') {
            if (!bars(x.from, x.to)) return 'Its bars aren\'t in the piece.';
            if (x.to < x.from) return 'It ends before it starts.';
            if (x.target !== 'next' && !(int(x.bpm) > 0)) return 'What speed does it reach?';
            return null;
        }
        if (x.type === 'sign') {
            if (!SIGNS[x.sign]) return 'Which sign is it?';
            if (!bars(x.bar)) return 'Its bar isn\'t in the piece.';
            return null;
        }
        if (x.type === 'intro') {
            if (!bars(x.from)) return 'Its bars aren\'t in the piece.';
            if (x.to != null && (!bars(x.to) || x.to < x.from)) return 'It ends before it starts.';
            return null;
        }
        return 'Not a kind of extra.';
    }

    const DEFAULTS = () => ({
        isLeadIn: false, repeatLeadIn: false, quietSecondsBeforeLeadIn: 0, pickupBeats: null,
        isRepeatStart: false, isRepeatEnd: false, isSectionBoundary: false, isFinalBarline: false, repeatPlayCount: null,
        repeatEndingNumbers: [], repeatEndingStartBar: null, isFirstTimeBar: false, isSecondTimeBar: false,
        introStartBarOffset: null, introStartBeatOffset: null, introEndBarOffset: null, introEndBeatOffset: null,
        rampStartBarOffset: null, rampStartBeatOffset: null, rampDurationBars: null,
        isSegno: false, isCoda: false, gotoSegno: false, gotoSegnoThenCoda: false, gotoCoda: false, gotoStartDc: false,
        gotoStartDcThenCoda: false, isFine: false,
        rehearsalMark: null, rehearsalMarks: [], fermatas: [], ramps: []
    });

    // The outline as blocks. Returns { blocks, clashes }:
    //   blocks  - in order, the count-in bar first when there is one. Each has `from`/`to` (its bars, null
    //             for the count-in), `sig` (the outline's own key for a time signature), barCount, bpm,
    //             noteValue and every flag the bar-by-bar editor sets.
    //   clashes - [{ extra: index into o.extras, message }] for extras that can't be made as asked.
    function buildBlocks(o) {
        const clashes = [];
        const extras = (o.extras || []).map((x, i) => ({ x, i }));
        const good = extras.filter(({ x, i }) => {
            const p = extraProblem(o, x);
            if (p) clashes.push({ extra: i, message: p });
            return !p;
        });

        // Where a new block starts.
        const cuts = new Set([1]);
        const cut = (bar) => { if (bar > 1 && bar <= o.bars) cuts.add(bar); };
        marksOf(o).forEach(m => cut(m.bar));
        for (let b = 2; b <= o.bars; b++) if (sigAt(o, b) !== sigAt(o, b - 1)) cut(b);
        speedRows(o).forEach(s => cut(s.bar));
        good.forEach(({ x }) => {
            if (x.type === 'repeat' || x.type === 'repeatEndings') { cut(x.from); cut(x.to + 1); }
            if (x.type === 'repeatEndings') cut(x.e2To + 1);
            if (x.type === 'sign') cut(SIGNS[x.sign].at === 'start' ? x.bar : x.bar + 1);
        });
        // A 1st ending starts part-way through the repeat's last block ("from bar N"). If something else
        // already splits those bars, it starts a block of its own instead.
        good.forEach(({ x }) => {
            if (x.type !== 'repeatEndings') return;
            for (let b = x.e1From + 1; b <= x.to; b++) if (cuts.has(b)) { cut(x.e1From); break; }
        });

        const starts = [...cuts].sort((a, b) => a - b);
        const marks = new Map(marksOf(o).map(m => [m.bar, m.label]));
        const blocks = starts.map((from, k) => {
            const to = (starts[k + 1] || o.bars + 1) - 1;
            const sp = speedAt(o, from);
            return { ...DEFAULTS(), id: `o${k + 1}`, from, to, barCount: to - from + 1, sig: sigAt(o, from), bpm: sp.bpm, noteValue: sp.noteValue || null, rehearsalMark: marks.get(from) || null };
        });
        const at = (bar) => blocks.find(b => bar >= b.from && bar <= b.to);
        const startingAt = (bar) => blocks.find(b => b.from === bar);
        const endingAt = (bar) => blocks.find(b => b.to === bar);

        good.forEach(({ x, i }) => {
            const clash = (message) => clashes.push({ extra: i, message });
            if (x.type === 'repeat' || x.type === 'repeatEndings') {
                const first = startingAt(x.from), last = endingAt(x.to);
                if (first.isRepeatStart || last.isRepeatEnd) return clash('Another repeat starts or ends on the same bar.');
                first.isRepeatStart = true;
                last.isRepeatEnd = true;
                last.repeatPlayCount = int(x.times);
                if (x.type === 'repeatEndings') {
                    const firstPasses = Array.from({ length: int(x.times) - 1 }, (_, k) => k + 1);
                    blocks.filter(b => b.to >= x.e1From && b.from <= x.to).forEach(b => {
                        b.repeatEndingNumbers = firstPasses.slice();
                        b.repeatEndingStartBar = Math.max(1, x.e1From - b.from + 1);
                    });
                    blocks.filter(b => b.from > x.to && b.to <= x.e2To).forEach(b => {
                        b.repeatEndingNumbers = [int(x.times)];
                        b.repeatEndingStartBar = 1;
                    });
                }
            } else if (x.type === 'pause') {
                const b = at(x.bar);
                b.fermatas.push({ kind: x.kind === 'caesura' ? 'caesura' : 'fermata', barOffset: x.bar - b.from, beatOffset: int(x.beat), holdBeats: Number(x.holdBeats), playbackMode: x.kind === 'caesura' ? 'silent' : (x.playbackMode === 'silent' ? 'silent' : 'tone') });
            } else if (x.type === 'ramp') {
                const b = at(x.from);
                if (x.to > b.to) return clash(`It can't run past bar ${b.to}, where the next section starts (a rehearsal mark or a change of time or speed).`);
                const toBlockEnd = x.to === b.to;
                const next = blocks[blocks.indexOf(b) + 1];
                if (x.target === 'next' && (!toBlockEnd || !next)) return clash(toBlockEnd ? 'There is no next speed after it.' : `"To the next speed" needs it to end on bar ${b.to}, just before the speed changes.`);
                b.ramps.push({
                    startBarOffset: x.from - b.from, startBeatOffset: int(x.startBeat) >= 1 ? int(x.startBeat) : 1,
                    endMode: toBlockEnd ? 'block_end' : 'specific', endBarOffset: toBlockEnd ? null : x.to + 1 - b.from, endBeatOffset: toBlockEnd ? null : 1,
                    targetMode: x.target === 'next' ? 'next_block' : 'custom', targetBpm: x.target === 'next' ? null : int(x.bpm)
                });
            } else if (x.type === 'sign') {
                const s = SIGNS[x.sign];
                const b = s.at === 'start' ? startingAt(x.bar) : endingAt(x.bar);
                if (b[s.flag]) return clash('That sign is already on this bar.');
                b[s.flag] = true;
            } else if (x.type === 'intro') {
                const b = at(x.from);
                if (blocks.some(k => k.introStartBarOffset != null)) return clash('The piece already has an intro.');
                b.introStartBarOffset = x.from - b.from + 1;
                b.introStartBeatOffset = 1;
                if (x.to != null) { const e = at(x.to); e.introEndBarOffset = x.to - e.from + 1; e.introEndBeatOffset = null; }
            }
        });

        if (o.leadIn) {
            const sp = speedAt(o, 1);
            blocks.unshift({ ...DEFAULTS(), id: 'o0', from: null, to: null, isLeadIn: true, barCount: 1, sig: sigAt(o, 1), bpm: sp.bpm, noteValue: sp.noteValue || null });
        }
        return { blocks, clashes };
    }

    // What Save will make, for the summary line.
    function summary(o) {
        const { blocks, clashes } = buildBlocks(o);
        return { bars: o.bars, marks: marksOf(o).length, speeds: speedRows(o).length + 1, exceptions: Object.keys(o.time || {}).filter(b => o.time[b] && o.time[b] !== o.mainSig && inPiece(o, Number(b))).length, extras: (o.extras || []).length, blocks: blocks.length, clashes: clashes.length };
    }

    // An extra in plain words: { title, sub }.
    function describeExtra(x) {
        const range = (a, b) => (a === b ? `bar ${a}` : `bars ${a} to ${b}`);
        if (x.type === 'repeat') return { title: `Repeat ${range(x.from, x.to)}`, sub: `Played ${x.times} times` };
        if (x.type === 'repeatEndings') return { title: `Repeat ${range(x.from, x.to)}, with endings`, sub: `1st ending ${range(x.e1From, x.to)} · 2nd ending ${range(x.to + 1, x.e2To)} · played ${x.times} times` };
        if (x.type === 'pause') return { title: `${x.kind === 'caesura' ? 'Break' : 'Pause'} in bar ${x.bar}`, sub: `On beat ${x.beat}, held for ${x.holdBeats} beat${Number(x.holdBeats) === 1 ? '' : 's'}${x.kind === 'caesura' ? '' : x.playbackMode === 'silent' ? ' · silent' : ' · with a tone'}` };
        if (x.type === 'ramp') return { title: `Speed up or slow down, ${range(x.from, x.to)}`, sub: x.target === 'next' ? 'To the next speed' : `To ${x.bpm} bpm` };
        if (x.type === 'sign') return { title: `${(SIGNS[x.sign] || {}).label || 'Sign'}`, sub: `${(SIGNS[x.sign] || {}).at === 'start' ? 'At the start of' : 'At the end of'} bar ${x.bar}` };
        if (x.type === 'intro') return { title: `Intro from bar ${x.from}`, sub: x.to != null ? `To the end of bar ${x.to}` : 'To the end of the piece' };
        return { title: 'Extra', sub: '' };
    }

    return { MAX_BARS, SIGNS, EXTRA_KINDS, parseBarList, marksOf, sigAt, speedRows, speedAt, sections, timeSummary, extraProblem, buildBlocks, summary, describeExtra };
}));
