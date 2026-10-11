// ML-246: a piece read from a photo or a PDF. A model looks at the page and answers with what is printed -
// how many bars, the time signatures, speeds, rehearsal marks, repeats, signs and pauses, by the bar numbers
// on the music (server/services/pieceReader.js asks it). This file is the rules for what happens to that
// answer, with no screen and no server in it:
//   normalise - the answer is somebody else's text, so every field is checked and trimmed before it is used;
//   fit       - the read as a Quick entry outline (public/pieceOutline.js), which makes the blocks as ever;
//   rate      - how far to trust it: high, medium or low, with the list of places to look.
// The rating is worked out here from checks (do the lines add up, are bar numbers printed, was anything
// left out), not taken on the model's word. Rules and reasoning: docs/piece-from-photo.md.
// Tests: server/test/pieceRead.test.js.
(function (root, factory) {
    const api = factory(root);
    if (typeof module === 'object' && module.exports) module.exports = api;
    else root.PieceRead = api;
}(typeof self !== 'undefined' ? self : this, function (root) {
    const MAX_PIECES = 12;
    const MAX_ROWS = 400;
    const NOTE_VALUES = ['semiquaver', 'quaver', 'dotted-quaver', 'crotchet', 'dotted-crotchet', 'minim', 'dotted-minim', 'semibreve'];
    const SIGN_KEYS = ['segno', 'coda', 'toCoda', 'ds', 'dsCoda', 'dc', 'dcCoda', 'fine'];
    const LEVELS = ['high', 'medium', 'low'];
    // A stretch this long with no printed bar number in it is worth a look: the one miscount in the trial
    // (Shrek Dance Party, 2 bars) was in the 9 bars after the last boxed number.
    const UNANCHORED_BARS = 8;
    const DEFAULT_BPM = 100;

    const outlineRules = () => root.PieceOutline;

    // ---------- normalise ----------
    const str = (v, max) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, max || 120) : '');
    const whole = (v) => { const n = Number(v); return Number.isInteger(n) ? n : null; };
    const level = (v) => (LEVELS.includes(v) ? v : 'medium');
    const rows = (v) => (Array.isArray(v) ? v.slice(0, MAX_ROWS).filter(r => r && typeof r === 'object') : []);

    function normalisePiece(p, maxBars) {
        const bars = whole(p.bars);
        if (!(bars >= 1 && bars <= maxBars)) return null;
        let dropped = 0;
        const bar = (v) => { const n = whole(v); if (n !== null && n >= 1 && n <= bars) return n; return null; };
        const keep = (list, make) => rows(list).map(r => { const made = make(r); if (!made) dropped++; return made; }).filter(Boolean);
        const byBar = (a, b) => a.bar - b.bar;

        const systems = rows(p.systems).map(s => ({ page: whole(s.page) || 1, firstBar: whole(s.firstBar), bars: whole(s.bars), anchored: s.anchored === true, sure: level(s.sure) }))
            .filter(s => s.firstBar !== null && s.bars !== null && s.bars >= 1);
        const time = keep(p.time, r => {
            const b = bar(r.bar), beats = whole(r.beats), beatType = whole(r.beatType);
            return b && beats >= 1 && beats <= 32 && [1, 2, 4, 8, 16, 32].includes(beatType) ? { bar: b, beats, beatType } : null;
        }).sort(byBar);
        const speeds = keep(p.speeds, r => {
            const b = bar(r.bar), bpm = whole(r.bpm);
            if (!b) return null;
            return { bar: b, bpm: bpm >= 10 && bpm <= 400 ? bpm : null, note: NOTE_VALUES.includes(r.note) ? r.note : null, text: str(r.text, 60), handwritten: r.handwritten === true };
        }).sort(byBar);
        const marks = keep(p.marks, r => { const b = bar(r.bar), label = str(r.label, 12); return b && label ? { bar: b, label } : null; }).sort(byBar);
        const repeats = keep(p.repeats, r => {
            const from = bar(r.from), to = bar(r.to), times = whole(r.times);
            if (!from || !to || to < from) return null;
            const e1From = bar(r.firstEndingFrom), e2To = bar(r.lastEndingTo);
            return { from, to, times: times >= 2 && times <= 20 ? times : 2, e1From: e1From && e2To ? e1From : null, e2To: e1From && e2To ? e2To : null };
        }).sort((a, b) => a.from - b.from);
        const signs = keep(p.signs, r => { const b = bar(r.bar); return b && SIGN_KEYS.includes(r.sign) ? { sign: r.sign, bar: b } : null; });
        const pauses = keep(p.pauses, r => {
            const b = bar(r.bar), beat = whole(r.beat);
            return b ? { bar: b, beat: beat >= 1 && beat <= 32 ? beat : 1, kind: r.kind === 'break' ? 'break' : 'pause' } : null;
        }).sort(byBar);
        const ramps = keep(p.ramps, r => {
            const from = bar(r.from), to = bar(r.to);
            return from && to && to >= from ? { from, to, kind: r.kind === 'faster' ? 'faster' : 'slower', text: str(r.text, 40) } : null;
        }).sort((a, b) => a.from - b.from);
        const special = keep(p.special, r => { const from = bar(r.from), to = bar(r.to) || from; return from && str(r.text) ? { from, to: Math.max(from, to), text: str(r.text, 80) } : null; });
        const doubts = rows(p.doubts).map(r => { const from = bar(r.from), to = bar(r.to) || from; return { from, to: from ? Math.max(from, to) : null, level: level(r.level), note: str(r.note, 140) }; }).filter(d => d.note);

        // The bars of the last line (and of any line after the last printed number), one by one.
        const tail = rows(p.tail).map(r => ({ bar: whole(r.bar), bars: whole(r.bars) >= 1 ? whole(r.bars) : 1, what: str(r.what, 60) })).filter(t => t.bar !== null).sort(byBar);
        const clashes = keep(p.numberClashes, r => { const b = bar(r.bar), printed = str(String(r.printed == null ? '' : r.printed), 12); return b && printed ? { bar: b, printed } : null; });
        const freeBars = keep(p.freeBars, r => { const b = bar(r.bar); return b ? { bar: b, text: str(r.text, 60) } : null; }).sort(byBar);
        const pickup = Number(p.pickupBeats);
        return {
            title: str(p.title), movement: str(p.movement), composer: str(p.composer), arranger: str(p.arranger), publisher: str(p.publisher), part: str(p.part, 60),
            bars, systems, tail, clashes, freeBars, time, speeds, marks, repeats, signs, pauses, ramps, special, doubts, dropped,
            numbersAt: ['start', 'end', 'none'].includes(p.numbersAt) ? p.numbersAt : 'none',
            pickupBeats: pickup > 0 && pickup < 32 ? pickup : null,
            endSeen: p.endSeen === true, cropped: p.cropped === true, pagesMissing: p.pagesMissing === true
        };
    }

    // The model's answer, made safe to use: { pieces: [...] }. A piece with no bar count is left out.
    function normalise(raw, maxBars) {
        const limit = maxBars || (outlineRules() ? outlineRules().MAX_BARS : 2000);
        const list = raw && Array.isArray(raw.pieces) ? raw.pieces : [];
        return { pieces: list.slice(0, MAX_PIECES).filter(p => p && typeof p === 'object').map(p => normalisePiece(p, limit)).filter(Boolean) };
    }

    // ---------- speeds from words ----------
    // A part often prints a word and no number. These are starting points for the player to change, picked
    // from the middle of each word's usual range - never shown as if they were printed.
    const TEMPO_WORDS = [
        [/prestissimo/, 190], [/presto/, 176], [/vivace|vivo/, 160], [/allegretto/, 112], [/allegro/, 132],
        [/moderato|moderately|moderate/, 108], [/andantino/, 84], [/andante/, 76], [/larghetto/, 63], [/largo/, 50],
        [/adagio/, 66], [/lento|grave/, 52], [/maestoso|majestic/, 88], [/march|marcia/, 112],
        [/brisk|lively|bright|driving|fast/, 132], [/disco|rock|funk|swing/, 120], [/ballad/, 72],
        [/broad|gently|tenderly|flowing/, 72], [/slowly|slow/, 66]
    ];
    const SLOWER = /meno mosso|slower|piu lento|più lento|ritenuto/;
    const FASTER = /piu mosso|più mosso|faster|move ahead|animando|animato|con moto/;
    const BACK_TO_FIRST = /tempo i\b|tempo 1|tempo primo/;

    // A speed for a printed word: { bpm, from } or null. prev is the speed before it, first the opening one.
    function bpmForWords(text, prev, first) {
        const t = String(text || '').toLowerCase();
        if (!t) return null;
        if (BACK_TO_FIRST.test(t) && first) return { bpm: first, from: 'first' };
        if (SLOWER.test(t) && prev) return { bpm: Math.round(prev * 0.88), from: 'slower' };
        if (FASTER.test(t) && prev) return { bpm: Math.round(prev * 1.12), from: 'faster' };
        const hit = TEMPO_WORDS.find(([re]) => re.test(t));
        return hit ? { bpm: hit[1], from: 'word' } : null;
    }

    // ---------- fit: the read as a Quick entry outline ----------
    const range = (a, b) => (a === b || b == null ? `bar ${a}` : `bars ${a} to ${b}`);

    // Returns { about, o, sigs, notes }:
    //   about - name, composer, arranger, publisher for Quick entry's first step;
    //   o     - the outline, ready for PieceOutline.buildBlocks with nothing clashing;
    //   sigs  - each time signature used, { key, beats, beatType }, so the caller can turn a key into the
    //           app's own (`public:<id>` / `custom:<id>`) - opts.sigKey(beats, beatType) names them;
    //   notes - what was guessed or left out, as checks for rate().
    function fit(piece, opts) {
        const sigKey = (opts && opts.sigKey) || ((beats, beatType) => `${beats}/${beatType}`);
        const notes = [];
        const note = (lvl, kind, from, to, text) => notes.push({ level: lvl, kind, from: from || null, to: to || from || null, text });

        // Time: the signature most bars are in is the main one; the rest are exceptions, bar by bar.
        const timeRows = piece.time.length && piece.time[0].bar === 1 ? piece.time : [{ bar: 1, beats: 4, beatType: 4 }, ...piece.time];
        if (!piece.time.length || piece.time[0].bar !== 1) note('medium', 'time', 1, 1, 'No time signature was read at the start: 4/4 was put in.');
        const sigs = new Map();
        const perBar = [];
        let cur = null;
        for (let b = 1, i = 0; b <= piece.bars; b++) {
            while (i < timeRows.length && timeRows[i].bar <= b) cur = timeRows[i++];
            const key = sigKey(cur.beats, cur.beatType);
            if (!sigs.has(key)) sigs.set(key, { key, beats: cur.beats, beatType: cur.beatType, bars: 0 });
            sigs.get(key).bars++;
            perBar.push(key);
        }
        const mainSig = [...sigs.values()].sort((a, b) => b.bars - a.bars)[0].key;
        const time = {};
        perBar.forEach((key, i) => { if (key !== mainSig) time[i + 1] = key; });

        // Speeds: a printed number is used as it is; a pencilled one or a word gives a starting point.
        const speeds = [];
        let mainBpm = null, mainNote = null, prev = null;
        piece.speeds.forEach(s => {
            let bpm = s.bpm, how = s.bpm ? (s.handwritten ? 'pencil' : 'printed') : null;
            if (!bpm) { const g = bpmForWords(s.text, prev, mainBpm); if (g) { bpm = g.bpm; how = 'word'; } }
            if (!bpm) { note('info', 'speed', s.bar, s.bar, `"${s.text || 'A change of speed'}" at bar ${s.bar}: no number is printed, so no change of speed was put in.`); return; }
            if (how === 'word') note('info', 'speed', s.bar, s.bar, `No number is printed at bar ${s.bar}: ${bpm} is a starting point for "${s.text}".`);
            if (how === 'pencil') note('info', 'speed', s.bar, s.bar, `${bpm} at bar ${s.bar} is written in by hand, not printed.`);
            if (s.bar === 1) { mainBpm = bpm; mainNote = s.note; } else speeds.push(s.note ? { bar: s.bar, bpm, noteValue: s.note } : { bar: s.bar, bpm });
            prev = bpm;
        });
        if (!mainBpm) { mainBpm = DEFAULT_BPM; note('info', 'speed', 1, 1, `No speed is printed at the start: ${DEFAULT_BPM} was put in.`); }

        const numbered = piece.marks.length > 0 && piece.marks.every(m => m.label === String(m.bar));
        const extras = [];
        piece.repeats.forEach(r => extras.push(r.e1From ? { type: 'repeatEndings', from: r.from, to: r.to, times: r.times, e1From: r.e1From, e2To: r.e2To } : { type: 'repeat', from: r.from, to: r.to, times: r.times }));
        piece.signs.forEach(s => extras.push({ type: 'sign', sign: s.sign, bar: s.bar }));
        piece.pauses.forEach(p => extras.push({ type: 'pause', bar: p.bar, beat: p.beat, holdBeats: 2, kind: p.kind === 'break' ? 'caesura' : 'fermata' }));
        // A rall. or accel. is only put in when the speed it leads to is known: a new speed on the next bar.
        const speedBars = new Set(speeds.map(s => s.bar));
        piece.ramps.forEach(r => {
            if (speedBars.has(r.to + 1)) extras.push({ type: 'ramp', from: r.from, to: r.to, target: 'next' });
            else note('info', 'ramp', r.from, r.to, `"${r.text || (r.kind === 'faster' ? 'accel.' : 'rall.')}" at ${range(r.from, r.to)} was not put in: the speed it reaches isn't printed.`);
        });

        const o = { bars: piece.bars, leadIn: false, mainSig, mainBpm, mainNote: mainNote || null, markKind: !piece.marks.length ? 'none' : (numbered ? 'numbers' : 'text'), marks: piece.marks.map(m => ({ bar: m.bar, label: m.label })), time, speeds, extras };

        // Quick entry won't save an outline with a clash in it, so anything that clashes is taken out and
        // listed instead - the piece always arrives ready to save.
        const PO = outlineRules();
        if (PO) {
            for (let pass = 0; pass < 20; pass++) {
                const clashes = PO.buildBlocks(o).clashes;
                if (!clashes.length) break;
                [...new Set(clashes.map(c => c.extra))].sort((a, b) => b - a).forEach(i => {
                    const x = o.extras[i], said = PO.describeExtra(x), why = clashes.find(c => c.extra === i).message;
                    note('medium', 'left-out', x.from || x.bar, x.to || x.bar, `${said.title} was read but not put in. ${why}`);
                    o.extras.splice(i, 1);
                });
            }
        }

        if (piece.pickupBeats) note('info', 'pickup', 1, 1, `There is a pickup of ${piece.pickupBeats} beat${piece.pickupBeats === 1 ? '' : 's'} before bar 1. It was not put in.`);
        piece.freeBars.forEach(f => note('medium', 'free-bar', f.bar, f.bar, `Bar ${f.bar} has no set length${f.text ? ` ("${f.text}")` : ''}: count its beats and set it by hand.`));
        piece.special.forEach(s => note('medium', 'special', s.from, s.to, `${range(s.from, s.to)}: "${s.text}" is printed. The app plays these bars every time.`));

        const name = [piece.title, piece.movement].filter(Boolean).join(': ');
        return { about: { name, composer: piece.composer, arranger: piece.arranger, publisher: piece.publisher }, o, sigs: [...sigs.values()].map(s => ({ key: s.key, beats: s.beats, beatType: s.beatType })), notes };
    }

    // ---------- rate ----------
    // { level: 'high' | 'medium' | 'low', checks: [{ level, kind, from, to, text }] } - the checks in the
    // order to look at them (the least sure first, then by bar). 'info' checks (a speed to fill in) are
    // listed and don't lower the rating: it says how far to trust the bars and the order of play.
    function rate(piece, fitted) {
        const checks = [];
        const add = (lvl, kind, from, to, text) => checks.push({ level: lvl, kind, from: from || null, to: to || from || null, text });
        const sys = piece.systems;

        if (piece.dropped) add('medium', 'dropped', null, null, `${piece.dropped} thing${piece.dropped === 1 ? '' : 's'} read from the page had a bar number that isn't in the piece, and ${piece.dropped === 1 ? 'was' : 'were'} left out.`);

        if (!sys.length) add('medium', 'count', 1, piece.bars, 'The bars were not counted line by line, so the total could not be checked.');
        else {
            // Do the lines add up? Each starts where the one before stopped, and the last ends on the last bar.
            sys.forEach((s, i) => {
                const expected = i === 0 ? 1 : sys[i - 1].firstBar + sys[i - 1].bars;
                if (s.firstBar !== expected) add('low', 'count', Math.min(expected, s.firstBar), Math.max(expected, s.firstBar), `The count doesn't add up around bar ${Math.min(expected, s.firstBar)}: a line starts at bar ${s.firstBar} where bar ${expected} was expected.`);
            });
            const last = sys[sys.length - 1];
            if (last.firstBar + last.bars - 1 !== piece.bars) add('low', 'count', last.firstBar, piece.bars, `The last line ends on bar ${last.firstBar + last.bars - 1}, but the piece was read as ${piece.bars} bars.`);

            // A printed bar number (at the start of a line, or a numbered mark) proves the count up to that
            // bar, and the rest of its own line is a handful of bars in plain sight. So the bars nothing
            // checks are the lines after the last line with a printed number on it.
            const anchors = [...sys.filter(s => s.anchored).map(s => s.firstBar), ...piece.marks.filter(m => m.label === String(m.bar)).map(m => m.bar)];
            if (!anchors.length) add('medium', 'numbers', 1, piece.bars, 'No bar numbers are printed, so every bar was counted by eye. Check the total.');
            else {
                const lastAnchor = Math.max(...anchors);
                const line = sys.find(s => lastAnchor >= s.firstBar && lastAnchor < s.firstBar + s.bars);
                const checkedTo = line ? line.firstBar + line.bars - 1 : lastAnchor;
                if (piece.bars - checkedTo >= UNANCHORED_BARS) add('medium', 'numbers', checkedTo + 1, piece.bars, `${range(checkedTo + 1, piece.bars)}: no printed bar number after bar ${lastAnchor} to check the count against.`);
            }
            // One line for all of them: a cropped scan can make every line a little unsure.
            const unsure = sys.filter(s => s.sure !== 'high');
            if (unsure.length) add('medium', 'line', unsure[0].firstBar, unsure[unsure.length - 1].firstBar + unsure[unsure.length - 1].bars - 1, `The barlines were hard to make out on ${unsure.length === 1 ? 'one line' : `${unsure.length} lines`}: bars ${unsure.slice(0, 6).map(s => `${s.firstBar}-${s.firstBar + s.bars - 1}`).join(', ')}${unsure.length > 6 ? ' and more' : ''}.`);
        }

        // The last line. In the owner's check of 20 pieces (11 Oct 2026) six of the reader's seven wrong totals
        // were a miscount on the final line - bars of very different widths, and no later printed number to
        // catch it. So the reader lists those bars one by one (the tail), the list has to agree with the
        // line count, and the last line is always named as a place to look, whatever the rating.
        if (sys.length) {
            const lastLine = sys[sys.length - 1];
            const tail = piece.tail;
            if (!tail.length) add('medium', 'last-line', lastLine.firstBar, piece.bars, `The last line (${range(lastLine.firstBar, piece.bars)}) was not counted bar by bar. Check it.`);
            else {
                // An entry is one bar, or a multi-bar rest of `bars` bars.
                const runs = tail.every((t, i) => i === 0 || t.bar === tail[i - 1].bar + tail[i - 1].bars);
                const tailEnd = tail[tail.length - 1].bar + tail[tail.length - 1].bars - 1;
                const tailBars = tail.reduce((n, t) => n + t.bars, 0);
                const startsOnALine = sys.some(s => s.firstBar === tail[0].bar);
                if (!runs || !startsOnALine || tailEnd !== piece.bars || tail[0].bar > lastLine.firstBar) add('low', 'last-line', Math.min(tail[0].bar, lastLine.firstBar), piece.bars, `The last line was counted two ways and they disagree: ${tailBars} bars listed from bar ${tail[0].bar}, but the piece was read as ending on bar ${piece.bars}.`);
                else add('info', 'last-line', lastLine.firstBar, piece.bars, `Check the last line: ${range(lastLine.firstBar, piece.bars)} (${piece.bars - lastLine.firstBar + 1} bars). It is where a miscount is most likely.`);
            }
        }
        // A printed bar number that isn't on the bar it names: a misprint (The Wonderful World of Disney has
        // "141" on bar 142) or a miscount. The count is kept, and it can't be settled without a look.
        const clashAt = new Map(piece.clashes.map(c => [c.bar, c.printed]));
        const numeric = piece.marks.filter(m => /^\d+$/.test(m.label));
        if (numeric.length >= 3 && numeric.filter(m => m.label === String(m.bar)).length >= numeric.length * 0.6) numeric.filter(m => m.label !== String(m.bar)).forEach(m => { if (!clashAt.has(m.bar)) clashAt.set(m.bar, m.label); });
        clashAt.forEach((printed, b) => add('low', 'number', b, b, `"${printed}" is printed on what was counted as bar ${b}. Either the music is misprinted or a bar was miscounted before it: check the bars before bar ${b}.`));
        if (piece.cropped) add('medium', 'cropped', null, null, 'An edge of a page is cut off.');
        if (!piece.endSeen || piece.pagesMissing) add('medium', 'end', piece.bars, piece.bars, `The final barline wasn't seen. Check that bar ${piece.bars} is the last and that no page is missing.`);
        // The reader's own doubts never make a read "low": in the trial every model called something low on
        // reads that were right. Low is kept for what the sums above prove.
        piece.doubts.forEach(d => add(d.level === 'high' ? 'info' : 'medium', 'doubt', d.from, d.to, d.note));
        ((fitted && fitted.notes) || []).forEach(n => checks.push(n));

        // One line per place: a second check on the same bars at the same level adds nothing to look at.
        const seen = new Set();
        const order = { low: 0, medium: 1, info: 2 };
        const list = checks.filter(c => { const k = `${c.level}|${c.kind}|${c.from}|${c.to}`; if (seen.has(k)) return false; seen.add(k); return true; })
            .sort((a, b) => order[a.level] - order[b.level] || (a.from || 0) - (b.from || 0));
        const overall = list.some(c => c.level === 'low') ? 'low' : (list.some(c => c.level === 'medium') ? 'medium' : 'high');
        return { level: overall, checks: list };
    }

    // ---------- compare: the outline as read against the outline as saved ----------
    // What the member changed before saving, as plain counts - the measure of "right first time". Both are
    // Quick entry outlines with the same time signature keys. Returns
    //   { bars: [read, saved], timeBars, marks: { missed, extra }, speeds: {..}, repeats: {..}, signs: {..},
    //     pauses: {..}, changed, same }
    // missed: in the saved piece and not in the read; extra: in the read and taken out. timeBars: how many
    // bars are in a different time signature. changed: everything added up (a different bar count is 1).
    function compare(readO, savedO) {
        const PO = outlineRules();
        const side = (o) => {
            const x = (type) => (o.extras || []).filter(e => e.type === type || (type === 'repeat' && e.type === 'repeatEndings'));
            return {
                marks: PO.marksOf(o).map(m => `${m.bar}:${m.label}`),
                speeds: [`1:${o.mainBpm}`, ...PO.speedRows(o).map(s => `${s.bar}:${s.bpm}`)],
                repeats: x('repeat').map(e => `${e.from}-${e.to}x${e.times || 2}${e.type === 'repeatEndings' ? ` endings ${e.e1From}/${e.e2To}` : ''}`),
                signs: x('sign').map(e => `${e.sign}@${e.bar}`),
                pauses: x('pause').map(e => `${e.bar}`)
            };
        };
        const a = side(readO), b = side(savedO);
        const diff = (k) => ({ missed: b[k].filter(v => !a[k].includes(v)), extra: a[k].filter(v => !b[k].includes(v)) });
        let timeBars = 0;
        for (let bar = 1; bar <= Math.min(readO.bars, savedO.bars); bar++) if (PO.sigAt(readO, bar) !== PO.sigAt(savedO, bar)) timeBars++;
        const out = { bars: [readO.bars, savedO.bars], timeBars, marks: diff('marks'), speeds: diff('speeds'), repeats: diff('repeats'), signs: diff('signs'), pauses: diff('pauses') };
        out.changed = (readO.bars === savedO.bars ? 0 : 1) + timeBars + ['marks', 'speeds', 'repeats', 'signs', 'pauses'].reduce((n, k) => n + Math.max(out[k].missed.length, out[k].extra.length), 0);
        out.same = out.changed === 0;
        return out;
    }

    return { NOTE_VALUES, SIGN_KEYS, UNANCHORED_BARS, DEFAULT_BPM, normalise, bpmForWords, fit, rate, compare };
}));
