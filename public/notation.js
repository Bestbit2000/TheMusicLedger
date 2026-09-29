// ML-262: the app's one notation renderer - every note, clef, key signature and music symbol the app
// draws goes through here, so it always looks like real printed music.
//
// Glyphs come from Bravura (Steinberg's SMuFL reference font, SIL OFL 1.1, public/fonts/), never from
// hand-drawn paths or Unicode music characters (those depend on the phone's own fonts). Only the
// things every notation program draws as lines are lines here: staff lines, ledger lines, stems-free
// brackets (1st/2nd time bars, intro brackets) and hairpins - at Bravura's own engraving thicknesses.
//
// Pure string building, no DOM: loaded in the browser (window.Notation, before app.js) and in Node by
// server/test/notation.test.js. Output is an SVG string in "staff space" units (S = 10 user units per
// staff space, glyphs at 4 staff spaces = 1 em, as SMuFL defines), drawn in currentColor so it follows
// the theme. The .notation-glyph class (style.css) sets the font; callers size the <svg> with CSS.
//
// Pitches are strings: letter + optional accidental (#, b, ♯, ♭, x, bb) + octave, e.g. 'C4', 'F#5',
// 'Bb3'. Octave numbers are scientific pitch (middle C = C4).
(function (root, factory) {
    if (typeof module === 'object' && module.exports) module.exports = factory();
    else root.Notation = factory();
}(typeof self !== 'undefined' ? self : this, function () {
    'use strict';

    const S = 10;                 // user units per staff space
    const FONT_SIZE = 4 * S;      // SMuFL: 1 em = 4 staff spaces
    const TIME_SIG_DIGIT_SCALE = 0.8; // ML-294: time-signature digits, so the top and bottom don't merge on a phone
    // Bravura's engravingDefaults (staff spaces).
    const ENGRAVING = { staffLine: 0.13, ledgerLine: 0.16, ledgerExtension: 0.4, bracketLine: 0.16, hairpin: 0.16, tieEnd: 0.1, tieMid: 0.22,
        // ML-306 (rhythm groups): stems and beams, as every notation program draws them.
        stemThickness: 0.12, beamThickness: 0.5, beamSpacing: 0.25, stemLength: 3.5, tupletBracket: 0.16 };

    // SMuFL name -> [codepoint, advance width, top, bottom] (staff spaces, measured from the font;
    // top/bottom are relative to the glyph's baseline, up positive).
    const GLYPHS = {
        gClef: ['E050', 2.684, 4.4, -2.7],
        fClef: ['E062', 2.736, 1.1, -2.6],
        cClef: ['E05C', 2.796, 2.1, -2.1],
        noteheadWhole: ['E0A2', 1.688, 0.5, -0.5],
        noteheadHalf: ['E0A3', 1.18, 0.5, -0.5],
        noteheadBlack: ['E0A4', 1.18, 0.5, -0.5],
        noteWhole: ['E1D2', 1.836, 0.6, -0.6],
        noteHalfUp: ['E1D3', 1.364, 3.5, -0.6],
        noteHalfDown: ['E1D4', 1.364, 0.6, -3.5], // ML-294 (measured like the rest)
        noteQuarterUp: ['E1D5', 1.328, 3.5, -0.6],
        noteQuarterDown: ['E1D6', 1.328, 0.6, -3.5],
        note8thUp: ['E1D7', 2.264, 3.5, -0.6],
        note8thDown: ['E1D8', 1.328, 0.6, -3.6], // ML-294
        note16thUp: ['E1D9', 2.324, 3.5, -0.6],
        // ML-309 (Theory grades) - measured from the font like the rest.
        note32ndUp: ['E1DB', 2.252, 4.1, -0.6],
        noteDoubleWhole: ['E1D0', 2.62, 0.7, -0.7],
        augmentationDot: ['E1E7', 0.4, 0.2, -0.2],
        accidentalFlat: ['E260', 0.904, 1.8, -0.7],
        accidentalNatural: ['E261', 0.672, 1.4, -1.4],
        accidentalSharp: ['E262', 0.996, 1.4, -1.4],
        accidentalDoubleSharp: ['E263', 1, 0.6, -0.5],
        accidentalDoubleFlat: ['E264', 1.652, 1.8, -0.7],
        barlineSingle: ['E030', 0.144, 4, 0],
        barlineDouble: ['E031', 0.576, 4, 0],
        barlineFinal: ['E032', 0.916, 4, 0],
        repeatLeft: ['E040', 1.472, 4, 0],
        repeatRight: ['E041', 1.468, 4, 0],
        segno: ['E047', 2.228, 3.1, -0.1],
        coda: ['E048', 3.816, 3.6, -0.7],
        dalSegno: ['E045', 4.328, 1.8, -0.1],
        daCapo: ['E046', 4.332, 1.8, -0.1],
        fermataAbove: ['E4C0', 2.42, 1.4, -0.1],
        breathMarkComma: ['E4CE', 0.612, 1, 0],
        caesura: ['E4D1', 1.54, 2.2, 0],
        articAccentAbove: ['E4A0', 1.356, 1, 0],
        articAccentBelow: ['E4A1', 1.356, 0, -1],
        articStaccatoAbove: ['E4A2', 0.336, 0.4, 0],
        articStaccatoBelow: ['E4A3', 0.336, 0, -0.4],
        articTenutoAbove: ['E4A4', 1.352, 0.2, 0],
        articTenutoBelow: ['E4A5', 1.352, 0, -0.2],
        dynamicPiano: ['E520', 1.46, 1.1, -0.6],
        dynamicForte: ['E522', 1.456, 1.8, -0.6],
        dynamicPP: ['E52B', 2.908, 1.1, -0.6],
        dynamicMP: ['E52C', 3.304, 1.1, -0.6],
        dynamicMF: ['E52D', 3.188, 1.8, -0.7],
        dynamicFF: ['E52F', 2.436, 1.8, -0.6],
        dynamicSforzato: ['E539', 2.928, 1.8, -0.6],
        restWhole: ['E4E3', 1.132, 0.1, -0.6],
        restHalf: ['E4E4', 1.132, 0.6, 0],
        restQuarter: ['E4E5', 1.08, 1.5, -1.5],
        rest8th: ['E4E6', 1, 0.7, -1],
        rest16th: ['E4E7', 1.28, 0.8, -2],
        rest32nd: ['E4E8', 1.452, 1.8, -2],
        ornamentTrill: ['E566', 2.084, 1.6, -0.1],
        ornamentTurn: ['E567', 1.84, 0.9, 0],
        ornamentShortTrill: ['E56C', 2.92, 1, 0],
        ornamentMordent: ['E56D', 2.916, 1.3, -0.3],
        graceNoteAcciaccaturaStemUp: ['E560', 1.428, 2.1, -0.4],
        graceNoteAppoggiaturaStemUp: ['E562', 1.292, 2.1, -0.4],
        timeSigCommon: ['E08A', 1.696, 1.1, -1],
        timeSigCutCommon: ['E08B', 1.668, 1.5, -1.5],
        timeSig0: ['E080', 1.88, 1, -1],
        timeSig1: ['E081', 1.336, 1, -1],
        timeSig2: ['E082', 1.784, 1.1, -1.1],
        timeSig3: ['E083', 1.684, 1, -1],
        timeSig4: ['E084', 1.88, 1, -1],
        timeSig5: ['E085', 1.612, 1, -1],
        timeSig6: ['E086', 1.736, 1, -1],
        timeSig7: ['E087', 1.764, 1, -1],
        timeSig8: ['E088', 1.744, 1.1, -1.1],
        timeSig9: ['E089', 1.736, 1, -1],
        // ML-306 (rhythm groups) - measured from the font like the rest.
        flag8thUp: ['E240', 1.056, 0.1, -3.3],
        flag16thUp: ['E242', 1.116, 0, -3.3],
        tuplet3: ['E883', 1.184, 1.5, -0.1],
    };
    const ACCIDENTAL_GLYPH = { '-2': 'accidentalDoubleFlat', '-1': 'accidentalFlat', 0: 'accidentalNatural', 1: 'accidentalSharp', 2: 'accidentalDoubleSharp' };

    function glyphChar(name) {
        const g = GLYPHS[name];
        if (!g) throw new Error(`Unknown notation glyph: ${name}`);
        return String.fromCharCode(parseInt(g[0], 16));
    }
    function metrics(name) {
        const g = GLYPHS[name];
        if (!g) throw new Error(`Unknown notation glyph: ${name}`);
        return { advance: g[1], top: g[2], bottom: g[3] };
    }

    // --- Pitch ---
    const LETTERS = 'CDEFGAB';
    function parsePitch(p) {
        const m = /^([A-Ga-g])(#|♯|x|b|♭|bb|n|♮)?(-?\d+)$/.exec(String(p).trim());
        if (!m) throw new Error(`Not a pitch: ${p}`);
        const alter = { '#': 1, '♯': 1, x: 2, b: -1, '♭': -1, bb: -2, n: 0, '♮': 0 }[m[2]] ?? 0;
        return { letter: m[1].toUpperCase(), alter, octave: Number(m[3]), explicitNatural: m[2] === 'n' || m[2] === '♮' };
    }
    // Diatonic index: C0 = 0, D0 = 1 ... one per letter, so staff positions are simple differences.
    function diatonic(p) {
        const q = typeof p === 'string' ? parsePitch(p) : p;
        return q.octave * 7 + LETTERS.indexOf(q.letter);
    }

    // --- Clefs. Steps count up from the bottom staff line (0) in half staff spaces: 8 is the top line.
    // Key-signature positions are the standard ones printed in every edition - nothing else in this
    // file is clef-specific. Alto and tenor (ML-309, Theory Grades 4 and 5) are the C clef centred on the
    // middle / 4th line; tenor's sharps start low (F# on the 2nd line), as printed. ---
    const CLEFS = {
        treble: { glyph: 'gClef', glyphStep: 2, bottomLine: diatonic('E4'), sharps: [8, 5, 9, 6, 3, 7, 4], flats: [4, 7, 3, 6, 2, 5, 1] },
        bass: { glyph: 'fClef', glyphStep: 6, bottomLine: diatonic('G2'), sharps: [6, 3, 7, 4, 1, 5, 2], flats: [2, 5, 1, 4, 0, 3, -1] },
        alto: { glyph: 'cClef', glyphStep: 4, bottomLine: diatonic('F3'), sharps: [7, 4, 8, 5, 2, 6, 3], flats: [3, 6, 2, 5, 1, 4, 0] },
        tenor: { glyph: 'cClef', glyphStep: 6, bottomLine: diatonic('D3'), sharps: [2, 6, 3, 7, 4, 8, 5], flats: [5, 8, 4, 7, 3, 6, 2] },
    };
    function clefInfo(clef) {
        const c = CLEFS[clef];
        if (!c) throw new Error(`Unknown clef: ${clef}`);
        return c;
    }
    function staffStep(pitch, clef) { return diatonic(pitch) - clefInfo(clef).bottomLine; }
    function pitchAtStep(step, clef) {
        const d = clefInfo(clef).bottomLine + step;
        return LETTERS[((d % 7) + 7) % 7] + Math.floor(d / 7);
    }
    // Ledger lines a note at this step needs, as steps (even numbers outside 0..8).
    function ledgerSteps(step) {
        const out = [];
        for (let s = -2; s >= step; s -= 2) out.push(s);
        for (let s = 10; s <= step; s += 2) out.push(s);
        return out;
    }
    function keySignatureSteps(clef, type, count) {
        if (!count) return [];
        const c = clefInfo(clef);
        const list = type === 'flat' ? c.flats : c.sharps;
        if (count < 0 || count > 7) throw new Error(`Key signatures have 0-7 accidentals, not ${count}`);
        return list.slice(0, count);
    }

    // --- SVG building ---
    const r = (v) => Math.round(v * 100) / 100;
    const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    function glyphEl(name, x, y, cls, scale = 1) {
        return `<text class="notation-glyph${cls ? ' ' + esc(cls) : ''}" x="${r(x)}" y="${r(y)}" font-size="${r(FONT_SIZE * scale)}">${glyphChar(name)}</text>`;
    }
    function lineEl(x1, y1, x2, y2, thickness) {
        return `<line x1="${r(x1)}" y1="${r(y1)}" x2="${r(x2)}" y2="${r(y2)}" stroke="currentColor" stroke-width="${r(thickness * S)}"/>`;
    }
    function svgWrap(width, height, body, label, extra = '') {
        const a11y = label ? `role="img" aria-label="${esc(label)}"` : 'aria-hidden="true" focusable="false"';
        return `<svg class="notation" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${r(width)} ${r(height)}" width="${r(width)}" height="${r(height)}" fill="currentColor" ${a11y}${extra}>${body}</svg>`;
    }

    // A staff with a clef, optional key signature and a row of items. Items, in order:
    //   { type: 'note', pitch, head?: 'noteheadWhole'|..., accidental?: true|false (default: shown when
    //     the pitch has one), above?: glyph, below?: glyph, dots?: 1, cls?: 'class names' }
    //     cls (ML-9) goes on the note's own glyphs (accidental and head/stem), so a caller can colour one
    //     note - the Scales tool's playing note - without redrawing.
    //   { type: 'chord', notes: [{ pitch, accidental? }], head? } (ML-309 C) stemless noteheads on one
    //     column - a harmonic interval, a triad. The upper note of a 2nd sits to the right, touching, and
    //     accidentals stack in columns to the left (top one nearest) wherever they'd collide, as engraved.
    //   { type: 'group', pitch?, notes: [{ v, len, dots?, rest?, word?, cls? }], tuplet?, beatLen? } (ML-306)
    //     a beat or two of rhythm, spaced by time: v is the written value in crotchets (4 semibreve, 2
    //     minim, 1 crotchet, 0.5 quaver, 0.25 semiquaver), len the time it takes (a triplet quaver is
    //     v 0.5, len 1/3). Stems up; quavers and shorter within one beat (beatLen, default 1 - 1.5 in
    //     compound time) are beamed, a lone one is flagged; a semiquaver next to a longer note gets a
    //     part beam pointing at it. tuplet: 3 prints the number over the beam (with a bracket if the
    //     notes aren't all beamed). word: a syllable under the note. Rests sit in the middle of the
    //     staff. opts.beatWidth (staff spaces per crotchet beat, default 5) spaces the notes.
    //   { type: 'barline', glyph: 'barlineSingle'|'barlineDouble'|'barlineFinal'|'repeatLeft'|'repeatRight' }
    //   { type: 'mark', glyph, step }        a breath mark, caesura or rest at a staff position (rests:
    //                                        whole rest step 6 - hangs from the 4th line - the rest step 4)
    //   { type: 'timeSig', top, bottom } or { type: 'timeSig', glyph: 'timeSigCommon'|'timeSigCutCommon' }
    //   { type: 'text', text, step, italic } right-aligned under/over the previous item (Fine)
    //   { type: 'space', width, grow? }      in staff spaces; grow also takes a note's share of the spacing
    // spans (drawn over the items, from/to are item indexes, inclusive):
    //   { kind: 'volta', from, to, text }    1st/2nd time bar bracket
    //   { kind: 'intro', from, to }          hymn/carol intro corner brackets
    //   { kind: 'hairpin', from, to, dir: 'cresc'|'dim' }
    //   { kind: 'tie' | 'slur', from, to }  under stem-up noteheads, over the top when a stem points down
    //                                        (from/to must be notes); openStart / openEnd: a slur carried
    //                                        over a line break - it comes in from the row's start / runs to its end
    // stepRange [lo, hi] fixes the drawn height (at least that much; allow a step past the lowest/highest
    // note for its notehead), so a run of questions doesn't jump
    // about as notes go above or below the staff. hideClef leaves the clef off (pitches still sit where
    // that clef puts them) - for a symbol shown on a scrap of staff, where a visible clef would be a
    // second symbol competing for attention. justify (ML-9, in staff spaces) spreads the items out to
    // that width - more space between notes - as a printed exercise fills its line; a row that's
    // already wider is left alone. Returns the SVG string.
    function staff(opts) {
        const first = staffLayout(opts);
        if (!opts.justify || first.width >= opts.justify * S) return first.svg;
        const items = opts.items || [];
        const lastIsBarline = items.length && items[items.length - 1].type === 'barline';
        const gaps = items.filter(it => it.type === 'note' || it.type === 'chord' || it.type === 'timeSig' || it.type === 'mark' || (it.type === 'space' && it.grow)).length - (lastIsBarline ? 0 : 1);
        if (gaps < 1) return first.svg;
        const noteGap = (opts.noteGap ?? 1.6) + (opts.justify * S - first.width) / S / gaps;
        return staffLayout({ ...opts, noteGap }).svg;
    }
    function staffLayout(opts) {
        const clef = opts.clef || 'treble';
        const c = clefInfo(clef);
        const items = opts.items || [];
        const noteGap = (opts.noteGap ?? 1.6) * S;
        let lo = 0, hi = 8;
        const grow = (a, b) => { lo = Math.min(lo, a, b); hi = Math.max(hi, a, b); };
        const parts = []; // [fn(yOf)] - drawn once the vertical range is known
        const positions = [];

        let x = 0.6 * S;
        if (!opts.hideClef) {
            const cm = metrics(c.glyph);
            const clefX = x;
            parts.push((y) => glyphEl(c.glyph, clefX, y(c.glyphStep)));
            grow(c.glyphStep + cm.top * 2, c.glyphStep + cm.bottom * 2);
            x += cm.advance * S + 0.8 * S;
        }

        const ks = opts.keySignature;
        if (ks && ks.count) {
            const name = ks.type === 'flat' ? 'accidentalFlat' : 'accidentalSharp';
            const m = metrics(name);
            for (const st of keySignatureSteps(clef, ks.type, ks.count)) {
                const ax = x;
                parts.push((y) => glyphEl(name, ax, y(st)));
                grow(st + m.top * 2, st + m.bottom * 2);
                x += m.advance * S + 0.25 * S;
            }
            x += 0.8 * S;
        } else {
            x += 0.4 * S;
        }

        items.forEach((it, i) => {
            const start = x;
            if (it.type === 'note') {
                const p = parsePitch(it.pitch);
                const st = diatonic(p) - c.bottomLine;
                const showAcc = it.accidental ?? (p.alter !== 0 || p.explicitNatural);
                if (showAcc) {
                    const name = ACCIDENTAL_GLYPH[p.alter];
                    if (!name) throw new Error(`No single accidental glyph for ${it.pitch}`);
                    const m = metrics(name);
                    const ax = x;
                    parts.push((y) => glyphEl(name, ax, y(st), it.cls));
                    grow(st + m.top * 2, st + m.bottom * 2);
                    x += m.advance * S + 0.3 * S;
                }
                const head = it.head || 'noteheadWhole';
                const hm = metrics(head);
                const hx = x, hw = hm.advance * S;
                // Marks centre on the notehead itself - a stemmed note's advance also covers its stem.
                const headW = (/^note(Half|Quarter|8th|16th)/.test(head) ? metrics('noteheadBlack').advance : hm.advance) * S;
                const ext = ENGRAVING.ledgerExtension * S;
                for (const ls of ledgerSteps(st)) parts.push((y) => lineEl(hx - ext, y(ls), hx + hw + ext, y(ls), ENGRAVING.ledgerLine));
                parts.push((y) => glyphEl(head, hx, y(st), it.cls));
                grow(st + hm.top * 2, st + hm.bottom * 2);
                // Articulations/fermatas centred on the notehead, clear of the staff.
                if (it.above) {
                    const m = metrics(it.above);
                    const base = Math.max(st + 2, it.above === 'fermataAbove' ? 9 : st + 2);
                    parts.push((y) => glyphEl(it.above, hx + (headW - m.advance * S) / 2, y(base)));
                    grow(base, base + m.top * 2);
                }
                if (it.below) {
                    // Centred in the nearest space below the notehead (never on a staff line), as engraved.
                    const m = metrics(it.below);
                    let target = st - 2;
                    if (target % 2 === 0 && target >= 0 && target <= 8) target -= 1;
                    const base = target - (m.top + m.bottom); // glyph centre (in steps) onto the target
                    parts.push((y) => glyphEl(it.below, hx + (headW - m.advance * S) / 2, y(base)));
                    grow(base + m.top * 2, base + m.bottom * 2);
                }
                x += hw;
                // Augmentation dots sit in a space: a note on a line puts its dot in the space above.
                for (let d = 0; d < (it.dots || 0); d++) {
                    const dotStep = st % 2 === 0 ? st + 1 : st;
                    const dx = x + 0.35 * S;
                    parts.push((y) => glyphEl('augmentationDot', dx, y(dotStep)));
                    x = dx + metrics('augmentationDot').advance * S;
                }
                positions.push({ start, end: x, step: st, headX: hx, headW, stem: /Down$/.test(head) ? 'down' : /Up$/.test(head) ? 'up' : null });
                x += noteGap;
            } else if (it.type === 'chord') {
                const heads = (it.notes || []).map(nt => {
                    const p = parsePitch(nt.pitch);
                    return { p, st: diatonic(p) - c.bottomLine, showAcc: nt.accidental ?? (p.alter !== 0 || p.explicitNatural) };
                }).sort((a, b) => a.st - b.st);
                if (!heads.length) throw new Error('A chord needs notes');
                // A 2nd: the upper note moves to the right of the column (the next one up stays put).
                heads.forEach((h, i) => { h.offset = i > 0 && h.st - heads[i - 1].st === 1 && !heads[i - 1].offset; });
                // Accidentals, top first: each goes in the first column (nearest the notes) where it's at
                // least a 7th (6 steps) from every accidental already there.
                const columns = [];
                for (const h of heads.filter(x => x.showAcc).reverse()) {
                    const name = ACCIDENTAL_GLYPH[h.p.alter];
                    if (!name) throw new Error(`No single accidental glyph for ${h.p.letter}${h.p.alter}`);
                    h.acc = name;
                    let col = columns.find(cl => cl.every(o => Math.abs(o.st - h.st) >= 6));
                    if (!col) { col = []; columns.push(col); }
                    col.push(h);
                }
                const colW = columns.map(cl => Math.max(...cl.map(h => metrics(h.acc).advance)) * S + 0.2 * S);
                columns.forEach((cl, ci) => {
                    const cx = x + colW.slice(ci + 1).reduce((a, b) => a + b, 0); // column 0 is the rightmost
                    for (const h of cl) {
                        const m = metrics(h.acc);
                        parts.push((y) => glyphEl(h.acc, cx, y(h.st), it.cls));
                        grow(h.st + m.top * 2, h.st + m.bottom * 2);
                    }
                });
                x += colW.reduce((a, b) => a + b, 0) + (columns.length ? 0.1 * S : 0);
                const head = it.head || 'noteheadWhole';
                const hm = metrics(head);
                const hx = x, hw = hm.advance * S;
                const anyOffset = heads.some(h => h.offset);
                const ext = ENGRAVING.ledgerExtension * S;
                const ledgers = new Set(heads.flatMap(h => ledgerSteps(h.st)));
                for (const ls of ledgers) parts.push((y) => lineEl(hx - ext, y(ls), hx + hw * (anyOffset ? 2 : 1) + ext, y(ls), ENGRAVING.ledgerLine));
                for (const h of heads) {
                    const at = hx + (h.offset ? hw : 0);
                    parts.push((y) => glyphEl(head, at, y(h.st), it.cls));
                    grow(h.st + hm.top * 2, h.st + hm.bottom * 2);
                }
                x += hw * (anyOffset ? 2 : 1);
                positions.push({ start, end: x, step: heads[0].st, headX: hx, headW: hw });
                x += noteGap;
            } else if (it.type === 'group') {
                const unit = (opts.beatWidth ?? 5) * S;
                const st = diatonic(parsePitch(it.pitch || 'A4')) - c.bottomLine;
                const beatLen = it.beatLen || 1;
                const stemW = ENGRAVING.stemThickness * S;
                const headW = metrics('noteheadBlack').advance * S;
                const stemTopStep = st + ENGRAVING.stemLength * 2;
                const REST = { 4: ['restWhole', 6], 2: ['restHalf', 4], 1: ['restQuarter', 4], 0.5: ['rest8th', 4], 0.25: ['rest16th', 4] };
                // Spaced by time, but never tighter than a notehead (and its dot, and its word) plus a gap -
                // so four semiquavers widen their beat rather than overlap, as an engraver spaces them.
                let off = 0, gx = x;
                const placed = (it.notes || []).map((nt) => {
                    const p = { ...nt, x: gx, start: off };
                    const need = headW + 0.9 * S + (nt.dots ? 0.7 * S : 0);
                    const wordNeed = nt.word ? String(nt.word).length * 0.8 * S + 0.6 * S : 0;
                    off += nt.len;
                    gx += Math.max(nt.len * unit, need, wordNeed);
                    return p;
                });
                const groupEnd = gx;
                // Rests, heads, stems and dots.
                for (const p of placed) {
                    if (p.rest) {
                        const [glyph, rs] = REST[p.v] || REST[0.5];
                        const m = metrics(glyph);
                        parts.push((y) => glyphEl(glyph, p.x, y(rs), p.cls));
                        grow(rs + m.top * 2, rs + m.bottom * 2);
                        for (let d = 0; d < (p.dots || 0); d++) { const dx = p.x + m.advance * S + 0.3 * S + d * 0.6 * S; parts.push((y) => glyphEl('augmentationDot', dx, y(5))); }
                        continue;
                    }
                    const head = p.v >= 4 ? 'noteheadWhole' : p.v >= 2 ? 'noteheadHalf' : 'noteheadBlack';
                    const hm = metrics(head);
                    p.headW = hm.advance * S;
                    p.stemX = p.x + p.headW - stemW / 2;
                    for (const ls of ledgerSteps(st)) parts.push((y) => lineEl(p.x - ENGRAVING.ledgerExtension * S, y(ls), p.x + p.headW + ENGRAVING.ledgerExtension * S, y(ls), ENGRAVING.ledgerLine));
                    parts.push((y) => glyphEl(head, p.x, y(st), p.cls));
                    grow(st + hm.top * 2, st + hm.bottom * 2);
                    const dotStep = st % 2 === 0 ? st + 1 : st;
                    for (let d = 0; d < (p.dots || 0); d++) { const dx = p.x + p.headW + 0.35 * S + d * 0.6 * S; parts.push((y) => glyphEl('augmentationDot', dx, y(dotStep), p.cls)); }
                    if (p.v < 4) parts.push((y) => lineEl(p.stemX, y(st) - 0.2 * S, p.stemX, y(stemTopStep), ENGRAVING.stemThickness));
                    if (p.word) {
                        const cx = p.x + p.headW / 2;
                        parts.push((y) => `<text class="notation-text" x="${r(cx)}" y="${r(y(-4))}" font-size="${r(1.5 * S)}" text-anchor="middle">${esc(p.word)}</text>`);
                        grow(-6, -4);
                    }
                }
                grow(stemTopStep, stemTopStep + 1);
                // Beams: runs of quavers-or-shorter, next to each other, inside one beat. A lone one is flagged.
                const beamable = (p) => !p.rest && p.v <= 0.5;
                const beatOf = (p) => Math.floor((p.start + 1e-6) / beatLen);
                const runs = [];
                placed.forEach((p, i) => {
                    const prev = placed[i - 1];
                    if (!beamable(p)) return;
                    if (prev && beamable(prev) && beatOf(prev) === beatOf(p) && runs.length && runs[runs.length - 1].includes(prev)) runs[runs.length - 1].push(p);
                    else runs.push([p]);
                });
                const beamPath = (x1, x2, topStep, down) => (y) => {
                    const t = y(topStep) + down, b = t + ENGRAVING.beamThickness * S;
                    return `<path d="M${r(x1)} ${r(t)} L${r(x2)} ${r(t)} L${r(x2)} ${r(b)} L${r(x1)} ${r(b)} Z"/>`;
                };
                const level2 = (ENGRAVING.beamThickness + ENGRAVING.beamSpacing) * S;
                let allBeamed = runs.length === 1 && placed.filter(p => !p.rest).every(p => runs[0].includes(p));
                for (const run of runs) {
                    if (run.length === 1) {
                        const p = run[0];
                        const flag = p.v <= 0.25 ? 'flag16thUp' : 'flag8thUp';
                        parts.push((y) => glyphEl(flag, p.stemX - stemW / 2, y(stemTopStep), p.cls));
                        continue;
                    }
                    const first = run[0], last = run[run.length - 1];
                    parts.push(beamPath(first.stemX - stemW / 2, last.stemX + stemW / 2, stemTopStep, 0));
                    // Second beam for semiquavers: one beam over each run of them, a part beam for a lone one
                    // (pointing back at the note before when it's last, otherwise on to the next).
                    let k = 0;
                    while (k < run.length) {
                        if (run[k].v > 0.25) { k++; continue; }
                        let e = k;
                        while (e + 1 < run.length && run[e + 1].v <= 0.25) e++;
                        const a1 = run[k], a2 = run[e];
                        if (e > k) parts.push(beamPath(a1.stemX - stemW / 2, a2.stemX + stemW / 2, stemTopStep, level2));
                        else {
                            const stub = Math.min(1.2 * S, unit * 0.25), toLeft = e === run.length - 1;
                            parts.push(beamPath(toLeft ? a1.stemX - stub : a1.stemX - stemW / 2, toLeft ? a1.stemX + stemW / 2 : a1.stemX + stub, stemTopStep, level2));
                        }
                        k = e + 1;
                    }
                }
                // The tuplet number, over the middle of the group; a bracket when the notes aren't one beam.
                if (it.tuplet) {
                    const m = metrics('tuplet' + it.tuplet);
                    const numStep = stemTopStep + 2;
                    const mid = (x + groupEnd) / 2;
                    parts.push((y) => glyphEl('tuplet' + it.tuplet, mid - m.advance * S / 2, y(numStep)));
                    grow(numStep, numStep + m.top * 2);
                    if (!allBeamed) {
                        const bx1 = x, bx2 = groupEnd - 0.4 * S, gap = m.advance * S * 0.7, arm = 0.8 * S;
                        parts.push((y) => lineEl(bx1, y(numStep + 1) + arm, bx1, y(numStep + 1), ENGRAVING.tupletBracket) + lineEl(bx1, y(numStep + 1), mid - gap, y(numStep + 1), ENGRAVING.tupletBracket)
                            + lineEl(mid + gap, y(numStep + 1), bx2, y(numStep + 1), ENGRAVING.tupletBracket) + lineEl(bx2, y(numStep + 1), bx2, y(numStep + 1) + arm, ENGRAVING.tupletBracket));
                    }
                }
                x = groupEnd;
                positions.push({ start, end: x, notes: placed.map(p => ({ x: p.x, rest: !!p.rest })) });
            } else if (it.type === 'timeSig') {
                // Digits centred on the 4th and 2nd lines' spaces (steps 6 and 2), as printed; C / ¢ on the middle line.
                // ML-294: the digits are drawn at 80% (TIME_SIG_DIGIT_SCALE) - full size, the two meet on the
                // middle line and read as one shape on a phone; smaller, each stays centred in its half with a
                // clear gap between them. Each glyph is centred on its baseline, so scaling keeps it in place.
                // A number of two or more digits (12/8, ML-309) is its digit glyphs side by side.
                const k = it.glyph ? 1 : TIME_SIG_DIGIT_SCALE;
                const rows = it.glyph ? [[[it.glyph], 4]] : [[String(it.top).split('').map(d => 'timeSig' + d), 6], [String(it.bottom).split('').map(d => 'timeSig' + d), 2]];
                const rowW = (gs) => gs.reduce((sum, g) => sum + metrics(g).advance, 0) * S * k;
                const w = Math.max(...rows.map(([gs]) => rowW(gs)));
                const tx = x;
                for (const [gs, st] of rows) {
                    let gx = tx + (w - rowW(gs)) / 2;
                    for (const g of gs) {
                        const at = gx;
                        parts.push((y) => glyphEl(g, at, y(st), null, k));
                        gx += metrics(g).advance * S * k;
                    }
                }
                x += w;
                positions.push({ start, end: x });
                x += noteGap;
            } else if (it.type === 'barline') {
                const m = metrics(it.glyph);
                const bx = x;
                parts.push((y) => glyphEl(it.glyph, bx, y(0)));
                x += m.advance * S;
                positions.push({ start, end: x });
                x += (it.gapAfter ?? 1.2) * S;
            } else if (it.type === 'mark') {
                const m = metrics(it.glyph);
                const mx = x, st = it.step;
                parts.push((y) => glyphEl(it.glyph, mx, y(st), it.cls));
                grow(st + m.top * 2, st + m.bottom * 2);
                x += m.advance * S;
                positions.push({ start, end: x });
                x += noteGap;
            } else if (it.type === 'text') {
                const prev = positions[positions.length - 1];
                const tx = prev ? prev.end : x;
                const st = it.step ?? -4;
                parts.push((y) => `<text class="notation-text${it.italic ? ' notation-text-italic' : ''}" x="${r(tx)}" y="${r(y(st))}" font-size="${r(1.6 * S)}" text-anchor="end">${esc(it.text)}</text>`);
                grow(st, st + 3);
                positions.push({ start: tx, end: tx });
            } else if (it.type === 'space') {
                // grow (ML-294): also takes a note's share of the spacing, so justify spreads it too - a
                // whole-bar rest with one in front sits in the middle of its bar.
                x += (it.width ?? 1) * S + (it.grow ? noteGap : 0);
                positions.push({ start, end: x });
            } else {
                throw new Error(`Unknown staff item type: ${it.type}`);
            }
        });

        // Staff lines stop at a final barline; otherwise run a little past the last item.
        const last = items[items.length - 1];
        const lastBarline = last && last.type === 'barline';
        let width = lastBarline ? positions[positions.length - 1].end : Math.max(x - noteGap + 0.8 * S, x);
        if (!items.length) width = x + 0.4 * S;
        width = Math.max(width, (opts.minWidth || 0) * S);

        for (const sp of opts.spans || []) {
            const a = positions[sp.from], b = positions[sp.to];
            if (!a || !b) throw new Error(`Span ${sp.kind} refers to a missing item`);
            if (sp.kind === 'volta' || sp.kind === 'intro') {
                const st = Math.max(hi + 1, 12);
                const hook = 1.5 * S;
                if (sp.kind === 'volta') {
                    parts.push((y) => lineEl(a.start, y(st), b.end, y(st), ENGRAVING.bracketLine) + lineEl(a.start, y(st), a.start, y(st) + hook, ENGRAVING.bracketLine)
                        + `<text class="notation-text" x="${r(a.start + 0.4 * S)}" y="${r(y(st) + 1.5 * S)}" font-size="${r(1.4 * S)}">${esc(sp.text || '1.')}</text>`);
                    grow(st, st + 1);
                } else {
                    const arm = 1 * S;
                    parts.push((y) => lineEl(a.start, y(st), a.start + arm, y(st), ENGRAVING.bracketLine) + lineEl(a.start, y(st), a.start, y(st) + arm, ENGRAVING.bracketLine)
                        + lineEl(b.end - arm, y(st), b.end, y(st), ENGRAVING.bracketLine) + lineEl(b.end, y(st), b.end, y(st) + arm, ENGRAVING.bracketLine));
                    grow(st, st + 1);
                }
            } else if (sp.kind === 'tie' || sp.kind === 'slur') {
                if (a.step === undefined || b.step === undefined) throw new Error(sp.kind + ' must join two notes');
                // A filled crescent, thin at the ends, thickest mid-way. On the notehead side, as engraved:
                // under stem-up notes, and over the top as soon as any stem in it points down (ML-357 - a
                // lip slur's high notes), clearing the stem ends of any stem-up notes and every note between.
                const inSpan = positions.slice(sp.from, sp.to + 1).filter(p => p.step !== undefined);
                if (inSpan.some(p => p.stem === 'down')) {
                    const depth = (sp.kind === 'tie' ? 0.9 : 1.4) * S;
                    const clear = (p) => p.step + (p.stem === 'up' ? ENGRAVING.stemLength * 2 + 0.5 : 1.5);
                    const topStep = Math.max(...inSpan.map(clear));
                    parts.push((y) => {
                        const x1 = sp.openStart ? Math.max(0, a.start - 2 * S) : a.headX + a.headW * 0.5, x2 = sp.openEnd ? width - 0.3 * S : b.headX + b.headW * 0.5;
                        const y1 = y(clear(sp.openStart ? b : a)), y2 = y(clear(sp.openEnd ? a : b));
                        const yt = Math.min(y1, y2, y(topStep));
                        const w = x2 - x1, t = (ENGRAVING.tieMid - ENGRAVING.tieEnd) * S * 1.33;
                        const c1x = x1 + w * 0.25, c2x = x2 - w * 0.25, cy = yt - depth * 1.33;
                        return '<path d="M' + r(x1) + ' ' + r(y1) + ' C' + r(c1x) + ' ' + r(cy) + ' ' + r(c2x) + ' ' + r(cy) + ' ' + r(x2) + ' ' + r(y2)
                            + ' C' + r(c2x) + ' ' + r(cy + t) + ' ' + r(c1x) + ' ' + r(cy + t) + ' ' + r(x1) + ' ' + r(y1) + ' Z" stroke="currentColor" stroke-width="' + r(ENGRAVING.tieEnd * S) + '"/>';
                    });
                    grow(topStep, topStep + 5);
                    continue;
                }
                const lowStep = Math.min(...inSpan.map(p => p.step));
                const depth = (sp.kind === 'tie' ? 0.9 : 1.4) * S;
                parts.push((y) => {
                    const x1 = sp.openStart ? Math.max(0, a.start - 2 * S) : a.headX + a.headW * 0.5, x2 = sp.openEnd ? width - 0.3 * S : b.headX + b.headW * 0.5;
                    const y1 = y((sp.openStart ? b : a).step) + 0.75 * S, y2 = y((sp.openEnd ? a : b).step) + 0.75 * S;
                    const yb = Math.max(y1, y2, y(lowStep) + 0.75 * S);
                    const w = x2 - x1, t = (ENGRAVING.tieMid - ENGRAVING.tieEnd) * S * 1.33;
                    const c1x = x1 + w * 0.25, c2x = x2 - w * 0.25, cy = yb + depth * 1.33;
                    return '<path d="M' + r(x1) + ' ' + r(y1) + ' C' + r(c1x) + ' ' + r(cy) + ' ' + r(c2x) + ' ' + r(cy) + ' ' + r(x2) + ' ' + r(y2)
                        + ' C' + r(c2x) + ' ' + r(cy - t) + ' ' + r(c1x) + ' ' + r(cy - t) + ' ' + r(x1) + ' ' + r(y1) + ' Z" stroke="currentColor" stroke-width="' + r(ENGRAVING.tieEnd * S) + '"/>';
                });
                grow(lowStep - 5, lowStep);
            } else if (sp.kind === 'hairpin') {
                const st = Math.min(lo - 2, -4);
                const open = 0.9 * S;
                parts.push((y) => {
                    const mid = y(st);
                    const [xWide, xPoint] = sp.dir === 'dim' ? [a.start, b.end] : [b.end, a.start];
                    return lineEl(xPoint, mid, xWide, mid - open, ENGRAVING.hairpin) + lineEl(xPoint, mid, xWide, mid + open, ENGRAVING.hairpin);
                });
                grow(st - 2, st + 2);
            } else {
                throw new Error(`Unknown span kind: ${sp.kind}`);
            }
        }

        if (opts.stepRange) { lo = Math.min(lo, opts.stepRange[0]); hi = Math.max(hi, opts.stepRange[1]); }
        const pad = 0.5 * S;
        const yOf = (st) => pad + (hi - st) * S / 2;
        const height = (hi - lo) * S / 2 + 2 * pad;
        let body = '';
        for (let i = 0; i <= 8; i += 2) body += lineEl(0, yOf(i), width, yOf(i), ENGRAVING.staffLine);
        body += parts.map((f) => f(yOf)).join('');
        // tappable (ML-322, the range picker): the staff step at the top edge and the padding, so a tap's
        // height can be turned back into a staff step (step = hi - (y - pad) / (S / 2), y in SVG units).
        const extra = opts.tappable ? ` data-step-hi="${hi}" data-step-pad="${pad}"` : '';
        return { svg: svgWrap(width, height, body, opts.label, extra), width };
    }

    // One glyph on its own, trimmed to its own box (dynamics, segno, coda, D.C./D.S., clefs...).
    function symbol(name, opts = {}) {
        const m = metrics(name);
        const pad = 0.4 * S;
        const width = m.advance * S + 2 * pad;
        const height = (m.top - m.bottom) * S + 2 * pad;
        return svgWrap(width, height, glyphEl(name, pad, pad + m.top * S), opts.label);
    }

    // Hairpins and text marks every notation program draws as lines/text rather than a glyph.
    function hairpin(dir, opts = {}) {
        const w = 6 * S, h = 2 * S, pad = 0.4 * S;
        const mid = pad + h / 2;
        const [xWide, xPoint] = dir === 'dim' ? [pad, pad + w] : [pad + w, pad];
        const body = lineEl(xPoint, mid, xWide, mid - h / 2, ENGRAVING.hairpin) + lineEl(xPoint, mid, xWide, mid + h / 2, ENGRAVING.hairpin);
        return svgWrap(w + 2 * pad, h + 2 * pad, body, opts.label);
    }
    // A metronome mark, "♩ = 108" (ML-297): a Bravura crotchet (smaller than on a staff, as printed
    // over the music) then "= 108" in the tempo-word style.
    const TEMPO_NOTE_SCALE = 0.7;
    function tempoMark(bpm, opts = {}) {
        const m = metrics('noteQuarterUp');
        const k = TEMPO_NOTE_SCALE, pad = 0.4 * S, fs = 1.8 * S;
        const text = `= ${bpm}`;
        const noteW = m.advance * S * k, gap = 0.5 * S, textW = text.length * 1.05 * S;
        const base = pad + m.top * S * k;
        const body = glyphEl('noteQuarterUp', pad, base, null, k) +
            `<text class="notation-text notation-text-bold" x="${r(pad + noteW + gap)}" y="${r(base)}" font-size="${r(fs)}">${esc(text)}</text>`;
        return svgWrap(pad * 2 + noteW + gap + textW, base + (-m.bottom * S * k) + pad, body, opts.label);
    }
    function textMark(text, opts = {}) {
        const w = Math.max(3, text.length * 1.1) * S, h = 2.4 * S;
        // Expression words (legato, rit., Fine) print italic; tempo words (Allegro) bold and upright.
        const cls = opts.italic ? ' notation-text-italic' : opts.bold ? ' notation-text-bold' : '';
        const body = `<text class="notation-text${cls}" x="${r(w / 2)}" y="${r(h * 0.72)}" font-size="${r(1.8 * S)}" text-anchor="middle">${esc(text)}</text>`;
        return svgWrap(w, h, body, opts.label);
    }

    return {
        S, GLYPHS, CLEFS, ENGRAVING,
        glyphChar, metrics, parsePitch, diatonic, staffStep, pitchAtStep, ledgerSteps, keySignatureSteps,
        staff, symbol, hairpin, textMark, tempoMark
    };
}));
