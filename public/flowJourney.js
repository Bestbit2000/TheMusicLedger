// ML-193: the Flow "journey" engine - what a Flow's bars actually play, in order, and at what tempo.
//
// Pure logic, no DOM or audio: loaded in the browser (window.FlowJourney, before app.js) and in Node
// (server/test/flowJourney.test.js), so the exact code Play Flow runs is what the unit tests check.
//
// It turns the Bars tab's 12 settings into a play order:
//   - repeats (start/end, play count) with pass numbers           (ML-138)
//   - alternate endings, incl. ones starting mid-block ("from bar N") (ML-249)
//   - the intro bar range, played once before bar 1               (ML-252)
//   - segno/coda signs and D.S./D.C./To Coda/al Coda/al Fine jumps, Fine and the final barline,
//     and stopping at the end of the piece                        (ML-250)
//   - tempo ramps, beat by beat                                    (ML-251)
//   - written-beat positions (fermata/caesura/ramp beats) mapped to metronome clicks (ML-255)
// and checks a Flow for settings that don't make sense together  (ML-248).
//
// Conventions (same as the block editor and server/services/flowBlocks.js):
//   - blocks are the regular blocks in written order (the lead-in is passed separately)
//   - bar offsets are 0-based for fermatas/ramps, 1-based for intro bars and repeatEndingStartBar
//   - beat offsets are 1-based WRITTEN beats (the time signature's numerator: "beat 4 of 6" in 6/8)
//   - bpm is in the block's own beat unit (what the metronome's conductor beat plays at)
(function (root, factory) {
    if (typeof module === 'object' && module.exports) module.exports = factory();
    else root.FlowJourney = factory();
}(typeof self !== 'undefined' ? self : this, function () {
    'use strict';

    // --- Metre: conducted ("macro") beats per bar and how many written notes each one holds. The
    // single source for the metronome engine too (app.js reads METER_TABLE from here). ---
    const METER_TABLE = {
        '2/2': { macroBeatsPerBar: 2, subdivisionFactor: 2 },
        '3/2': { macroBeatsPerBar: 3, subdivisionFactor: 2 },
        '4/2': { macroBeatsPerBar: 4, subdivisionFactor: 2 },
        '1/4': { macroBeatsPerBar: 1, subdivisionFactor: 2 },
        '2/4': { macroBeatsPerBar: 2, subdivisionFactor: 2 },
        '3/4': { macroBeatsPerBar: 3, subdivisionFactor: 2 },
        '4/4': { macroBeatsPerBar: 4, subdivisionFactor: 2 },
        '6/4': { macroBeatsPerBar: 2, subdivisionFactor: 3 },
        '8/4': { macroBeatsPerBar: 4, subdivisionFactor: 2 },
        '1/8': { macroBeatsPerBar: 1, subdivisionFactor: 2 },
        '2/8': { macroBeatsPerBar: 2, subdivisionFactor: 2 },
        '3/8': { macroBeatsPerBar: 3, subdivisionFactor: 2 },
        '4/8': { macroBeatsPerBar: 4, subdivisionFactor: 2 },
        '6/8': { macroBeatsPerBar: 2, subdivisionFactor: 3 },
        '9/8': { macroBeatsPerBar: 3, subdivisionFactor: 3 },
        '12/8': { macroBeatsPerBar: 4, subdivisionFactor: 3 },
        '3/16': { macroBeatsPerBar: 3, subdivisionFactor: 2 }
    };
    // macroBeatsPerBar null = not in the table: conducted in the raw numerator.
    const METER_FALLBACK = { macroBeatsPerBar: null, subdivisionFactor: 2 };

    function meterInfo(block) {
        const row = METER_TABLE[`${block.numerator}/${block.denominator}`] || METER_FALLBACK;
        return { macroBeatsPerBar: row.macroBeatsPerBar ?? block.numerator, subdivisionFactor: row.subdivisionFactor };
    }
    const writtenBeatsPerBar = (block) => Math.max(1, block.numerator || 4);
    const barCountOf = (block) => Math.max(1, block.barCount || 1);

    // A written beat (1-based, "beat 4 of 6") -> the 0-based click within its bar, for a bar that the
    // metronome plays as clicksPerBar clicks. Exact whenever clicksPerBar is a multiple of the written
    // beats (sub-beats on); otherwise lands on the click that contains that beat (ML-255).
    function writtenBeatToClick(block, writtenBeat, clicksPerBar) {
        const w = writtenBeatsPerBar(block);
        const beat = Math.min(w, Math.max(1, writtenBeat || 1));
        return Math.floor(((beat - 1) * clicksPerBar) / w);
    }

    const hasVoltas = (b) => !!(b && Array.isArray(b.repeatEndingNumbers) && b.repeatEndingNumbers.length);
    const hasDsDc = (b) => !!(b && (b.gotoSegno || b.gotoSegnoThenCoda || b.gotoStartDc || b.gotoStartDcThenCoda));
    const isAlCoda = (b) => !!(b && (b.gotoSegnoThenCoda || b.gotoStartDcThenCoda));
    const isDs = (b) => !!(b && (b.gotoSegno || b.gotoSegnoThenCoda));
    const hasIntroStart = (b) => b && b.introStartBarOffset !== null && b.introStartBarOffset !== undefined;
    const hasIntroEnd = (b) => b && b.introEndBarOffset !== null && b.introEndBarOffset !== undefined;

    // The run of consecutive alternate-ending blocks that block i belongs to ([start, end] indices).
    function voltaGroup(blocks, i) {
        let s = i, e = i;
        while (s > 0 && hasVoltas(blocks[s - 1])) s--;
        while (e < blocks.length - 1 && hasVoltas(blocks[e + 1])) e++;
        return [s, e];
    }
    // The highest pass number any ending in that run is for - "the last time through".
    function finalPassOfGroup(blocks, i) {
        const [s, e] = voltaGroup(blocks, i);
        let max = 1;
        for (let k = s; k <= e; k++) (blocks[k].repeatEndingNumbers || []).forEach(n => { if (n > max) max = n; });
        return max;
    }
    // Bars of an ending block that play whatever the pass: the ones before "from bar N".
    function preEndingBars(block) {
        const from = block.repeatEndingStartBar ? Math.max(1, Math.min(barCountOf(block), block.repeatEndingStartBar)) : 1;
        return from - 1;
    }

    // Where a closing repeat at index e goes back to: the nearest repeat start at or before it (a block
    // can repeat itself), not looking past an earlier repeat's own end - except one in the same run of
    // endings (a "1." and "2." that both repeat belong to one region). None found: the region's start.
    function repeatStartFor(blocks, e) {
        const [gs] = hasVoltas(blocks[e]) ? voltaGroup(blocks, e) : [e];
        let low = 0;
        for (let k = gs - 1; k >= 0; k--) {
            if (blocks[k].isRepeatEnd) { low = k + 1; break; }
        }
        for (let k = e; k >= low; k--) {
            if (blocks[k].isRepeatStart) return k;
        }
        return low;
    }

    function firstIndex(blocks, pred, from = 0) {
        for (let k = from; k < blocks.length; k++) if (pred(blocks[k])) return k;
        return -1;
    }

    const LOOP_GUARD_BARS = 20000;

    // The whole journey, bar by bar. Each step:
    //   { kind: 'leadIn'|'intro'|'main', blockIndex (-1 for the lead-in), blockId, bar (0-based in its
    //     block), pass (1-based pass of the enclosing repeat), via }
    // via marks the first bar after a jump: 'repeat' (back to a repeat start), 'ds', 'dc', 'coda',
    // 'start' (bar 1 after an intro). Returns { steps, end } where end is how it finished:
    // 'end' (ran off the last block), 'fine', 'finalBarline', or 'loopGuard' (a runaway journey -
    // checkFlow reports it; playback still stops).
    function buildJourney(blocks, opts) {
        const leadIn = opts && opts.leadIn;
        const steps = [];
        const push = (s) => { steps.push(s); return steps.length < LOOP_GUARD_BARS; };
        const n = blocks.length;

        if (leadIn) {
            const leadBars = leadIn.pickupBeats ? 1 : barCountOf(leadIn);
            for (let bar = 0; bar < leadBars; bar++) push({ kind: 'leadIn', blockIndex: -1, blockId: leadIn.id, bar, pass: 1, via: null });
        }
        if (!n) return { steps, end: 'end' };

        // --- Intro (ML-252): from its start bar straight through to its end bar (or the end of the
        // piece / the first final barline), no repeats or jumps, final endings only. ---
        const si = firstIndex(blocks, hasIntroStart);
        let hadIntro = false;
        if (si !== -1) {
            const startBar = Math.max(0, Math.min(barCountOf(blocks[si]), blocks[si].introStartBarOffset) - 1);
            let ei = -1, endBar = -1;
            for (let k = si; k < n; k++) {
                if (!hasIntroEnd(blocks[k])) continue;
                const eb = Math.max(0, Math.min(barCountOf(blocks[k]), blocks[k].introEndBarOffset) - 1);
                if (k > si || eb >= startBar) { ei = k; endBar = eb; break; }
            }
            for (let k = si; k < n; k++) {
                const b = blocks[k];
                const from = k === si ? startBar : 0;
                let to = (k === ei) ? endBar : barCountOf(b) - 1;
                if (hasVoltas(b) && !b.repeatEndingNumbers.includes(finalPassOfGroup(blocks, k))) to = Math.min(to, preEndingBars(b) - 1);
                for (let bar = from; bar <= to; bar++) push({ kind: 'intro', blockIndex: k, blockId: b.id, bar, pass: 1, via: null });
                hadIntro = true;
                if (k === ei || b.isFinalBarline) break;
            }
        }

        // --- Main journey ---
        let i = 0;
        let pass = 1;
        let via = hadIntro ? 'start' : null;
        let afterJump = false;   // a D.S./D.C. has been taken: no more repeats, final endings only
        let alCoda = false;      // ...and it was an "al Coda" one: To Coda is now live
        const jumpsTaken = new Set();
        let end = 'end';

        while (i < n) {
            const b = blocks[i];
            let include = true;
            if (hasVoltas(b)) {
                const want = afterJump ? finalPassOfGroup(blocks, i) : pass;
                include = b.repeatEndingNumbers.includes(want);
            }
            const lastBar = include ? barCountOf(b) - 1 : preEndingBars(b) - 1;
            for (let bar = 0; bar <= lastBar; bar++) {
                if (!push({ kind: 'main', blockIndex: i, blockId: b.id, bar, pass, via })) return { steps, end: 'loopGuard' };
                via = null;
            }

            // An ending that isn't played this pass skips its own end-of-block instructions too.
            if (!include) { i = advance(i); continue; }

            // End-of-block instructions, in the order a player meets them.
            if (!afterJump && b.isRepeatEnd && pass < (b.repeatPlayCount || 2)) {
                pass++;
                i = repeatStartFor(blocks, i);
                via = 'repeat';
                continue;
            }
            if (afterJump && alCoda && b.gotoCoda) {
                let c = firstIndex(blocks, x => x.isCoda, i + 1);
                if (c === -1) c = firstIndex(blocks, x => x.isCoda);
                if (c !== -1 && c !== i) { i = c; pass = 1; via = 'coda'; alCoda = false; continue; }
            }
            if (hasDsDc(b) && !jumpsTaken.has(i)) {
                const target = isDs(b) ? firstIndex(blocks, x => x.isSegno) : 0;
                if (target !== -1) {
                    jumpsTaken.add(i);
                    afterJump = true;
                    alCoda = isAlCoda(b);
                    i = target; pass = 1; via = isDs(b) ? 'ds' : 'dc';
                    continue;
                }
            }
            if (afterJump && b.isFine) { end = 'fine'; break; }
            if (b.isFinalBarline) { end = 'finalBarline'; break; }
            i = advance(i);
        }
        return { steps, end };

        // Moving forward (not jumping): a new repeat region starts over at pass 1 - at a repeat start,
        // or once a region's endings (or its closing repeat) are behind us.
        function advance(from) {
            const next = from + 1;
            if (next < n) {
                const prev = blocks[from];
                const nb = blocks[next];
                if (nb.isRepeatStart || (!hasVoltas(nb) && (hasVoltas(prev) || prev.isRepeatEnd))) pass = 1;
            }
            return next;
        }
    }

    // Consecutive bars of the same block, same pass, with no jump between them, merged into one
    // passage { kind, blockIndex, blockId, fromBar, toBar, pass, via } - what the metronome plays in
    // one go (it only needs reconfiguring between passages).
    function passagesOf(steps) {
        const out = [];
        steps.forEach(s => {
            const last = out[out.length - 1];
            if (last && !s.via && last.kind === s.kind && last.blockIndex === s.blockIndex && last.pass === s.pass && s.bar === last.toBar + 1) {
                last.toBar = s.bar;
            } else {
                out.push({ kind: s.kind, blockIndex: s.blockIndex, blockId: s.blockId, fromBar: s.bar, toBar: s.bar, pass: s.pass, via: s.via });
            }
        });
        return out;
    }

    // --- Tempo (ML-251) ---
    // A block's ramps as absolute written-beat spans from the block's start, in play order.
    function rampSpans(blocks, i) {
        const b = blocks[i];
        const w = writtenBeatsPerBar(b);
        const blockEnd = barCountOf(b) * w;
        const next = blocks[i + 1];
        return (b.ramps || [])
            .map(r => {
                const s = (r.startBarOffset || 0) * w + ((r.startBeatOffset || 1) - 1);
                const e = r.endMode === 'specific' ? (r.endBarOffset || 0) * w + ((r.endBeatOffset || 1) - 1) : blockEnd;
                const target = r.targetMode === 'custom' ? Number(r.targetBpm) : (next ? Number(next.bpm) : null);
                return { s, e: Math.max(s, e), target };
            })
            .filter(r => Number.isFinite(r.target))
            .sort((a, b2) => a.s - b2.s);
    }
    // bpm at a written-beat position (0-based, may be fractional) from the start of block i. Each ramp
    // moves linearly from whatever the tempo is when it starts to its target, then holds.
    function tempoAt(blocks, i, pos) {
        const b = blocks[i];
        let bpm = Number(b.bpm);
        for (const r of rampSpans(blocks, i)) {
            if (pos < r.s) return bpm;
            if (pos >= r.e) { bpm = r.target; continue; }
            return bpm + (r.target - bpm) * ((pos - r.s) / (r.e - r.s));
        }
        return bpm;
    }

    // --- Per-bar marks for the dot row: fermatas and caesuras in bar `bar` of a block, as clicks. ---
    function pausesInBar(block, bar, clicksPerBar) {
        return (block.fermatas || [])
            .filter(f => (f.barOffset || 0) === bar)
            .map(f => ({ kind: f.kind === 'caesura' ? 'caesura' : 'fermata', click: writtenBeatToClick(block, f.beatOffset, clicksPerBar), holdBeats: f.holdBeats || 1 }));
    }

    // --- Stale settings (a block shortened after a setting was made) - the same four checks that turn
    // a card tile red; app.js's flowRepeatBarInvalid/flowIntroInvalid/flowPauseInvalid/flowRampInvalid
    // call these. ---
    function repeatBarInvalid(b) { return !!(b.repeatEndingStartBar && b.barCount && b.repeatEndingStartBar > b.barCount); }
    function introInvalid(b) {
        const maxBar = b.barCount || 1;
        return (hasIntroStart(b) && b.introStartBarOffset > maxBar) || (hasIntroEnd(b) && b.introEndBarOffset > maxBar);
    }
    function pauseInvalid(b) {
        const maxBar = b.barCount || 1;
        return (b.fermatas || []).some(f => ((f.barOffset || 0) + 1) > maxBar);
    }
    function rampInvalid(b, nextBlock) {
        const maxBar = b.barCount || 1;
        return (b.ramps || []).some(r => {
            if (((r.startBarOffset || 0) + 1) > maxBar) return true;
            if (r.endMode === 'specific' && ((r.endBarOffset || 0) + 1) > maxBar) return true;
            if (r.targetMode === 'next_block' && !nextBlock) return true;
            return false;
        });
    }

    // "Bars 9–12" / "Bar 9" for block i, counting from bar 1 of the first regular block.
    function barRangeLabel(blocks, i) {
        let start = 1;
        for (let k = 0; k < i; k++) start += barCountOf(blocks[k]);
        const end = start + barCountOf(blocks[i]) - 1;
        return start === end ? `Bar ${start}` : `Bars ${start}–${end}`;
    }

    // --- ML-248: settings that don't make sense together. Each issue:
    //   { code, severity: 'error'|'warning', blockIds: [...], message }
    // Errors mean the Flow won't play the way it's written; warnings mean something will be ignored or
    // never reached. ---
    function checkFlow(blocks, opts) {
        const issues = [];
        const n = blocks.length;
        const label = (k) => barRangeLabel(blocks, k);
        const add = (code, severity, idxs, message) => issues.push({ code, severity, blockIds: idxs.map(k => blocks[k].id), message });
        const idxWhere = (pred) => blocks.map((b, k) => (pred(b) ? k : -1)).filter(k => k !== -1);

        // Stale settings.
        blocks.forEach((b, k) => {
            const what = [];
            if (repeatBarInvalid(b)) what.push('alternate ending');
            if (introInvalid(b)) what.push('intro');
            if (pauseInvalid(b)) what.push('pause');
            if (rampInvalid(b, blocks[k + 1])) what.push('ramp');
            if (what.length) add('stale-setting', 'error', [k], `${label(k)}: the ${what.join(', ')} setting points past the end of this block, or at a next block that isn't there. Update it.`);
        });

        // Repeats.
        blocks.forEach((b, k) => {
            if (!b.isRepeatStart) return;
            let found = false;
            for (let j = k; j < n; j++) {
                if (j > k && blocks[j].isRepeatStart) break;
                if (blocks[j].isRepeatEnd) { found = true; break; }
            }
            if (!found) add('repeat-start-no-end', 'error', [k], `${label(k)} starts a repeat, but there's no end repeat after it.`);
        });
        blocks.forEach((b, k) => {
            if (!b.isRepeatEnd) return;
            const [gs] = hasVoltas(b) ? voltaGroup(blocks, k) : [k];
            let earlierEnd = -1;
            for (let j = gs - 1; j >= 0; j--) if (blocks[j].isRepeatEnd) { earlierEnd = j; break; }
            if (earlierEnd === -1) return; // back to the start of the piece - fine
            let hasStart = false;
            for (let j = k; j > earlierEnd; j--) if (blocks[j].isRepeatStart) { hasStart = true; break; }
            if (!hasStart) add('repeat-end-no-start', 'error', [k], `${label(k)} ends a repeat with no start repeat before it. After an earlier repeat, it's unclear where it goes back to - add a start repeat.`);
        });

        // Alternate endings.
        const seenGroups = new Set();
        blocks.forEach((b, k) => {
            if (!hasVoltas(b)) return;
            const [gs, ge] = voltaGroup(blocks, k);
            if (seenGroups.has(gs)) return;
            seenGroups.add(gs);
            const group = [];
            for (let j = gs; j <= ge; j++) group.push(j);
            const ends = group.filter(j => blocks[j].isRepeatEnd);
            const endBefore = gs > 0 && blocks[gs - 1].isRepeatEnd;
            if (!ends.length && !endBefore) {
                add('ending-no-repeat', 'error', group, `${group.map(label).join(', ')}: alternate ending with no repeat to go back through. Add an end repeat to the first ending.`);
                return;
            }
            const passes = Math.max(...(ends.length ? ends : [gs - 1]).map(j => blocks[j].repeatPlayCount || 2));
            const counts = {};
            group.forEach(j => blocks[j].repeatEndingNumbers.forEach(p => { counts[p] = (counts[p] || 0) + 1; }));
            group.forEach(j => {
                const never = blocks[j].repeatEndingNumbers.filter(p => p > passes);
                if (never.length) add('ending-never-plays', 'error', [j], `${label(j)}: ending ${never.join(', ')} never plays - the repeat only plays ${passes} time${passes === 1 ? '' : 's'}.`);
            });
            const missing = [];
            for (let p = 1; p <= passes; p++) if (!counts[p]) missing.push(p);
            if (missing.length) add('ending-pass-missing', 'warning', group, `${group.map(label).join(', ')}: no ending for time ${missing.join(', ')} through - nothing from these endings plays then.`);
            const doubled = Object.keys(counts).filter(p => counts[p] > 1);
            if (doubled.length) add('ending-pass-twice', 'warning', group, `${group.map(label).join(', ')}: more than one ending is marked for time ${doubled.join(', ')} - they'll all play.`);
        });

        // Signs and jumps.
        const segnos = idxWhere(b => b.isSegno);
        const codas = idxWhere(b => b.isCoda);
        const dsdc = idxWhere(hasDsDc);
        const toCodas = idxWhere(b => b.gotoCoda);
        const fines = idxWhere(b => b.isFine);
        if (segnos.length > 1) add('two-segnos', 'error', segnos, `There's more than one segno (${segnos.map(label).join(', ')}) - a D.S. can only go back to one.`);
        if (codas.length > 1) add('two-codas', 'error', codas, `There's more than one coda (${codas.map(label).join(', ')}) - To Coda can only go to one.`);
        if (dsdc.length > 1) add('two-jumps', 'error', dsdc, `There's more than one D.S./D.C. (${dsdc.map(label).join(', ')}) - a piece only takes one.`);
        dsdc.forEach(k => {
            const b = blocks[k];
            if (isDs(b) && !segnos.length) add('ds-no-segno', 'error', [k], `${label(k)} says D.S. (back to the sign), but there's no segno sign anywhere.`);
            else if (isDs(b) && segnos[0] > k) add('segno-after-ds', 'warning', [k, segnos[0]], `${label(k)}'s D.S. jumps forward: the segno is at ${label(segnos[0])}, after it.`);
            const target = isDs(b) ? (segnos[0] ?? -1) : 0;
            if (isAlCoda(b)) {
                if (!toCodas.length) add('al-coda-no-to-coda', 'error', [k], `${label(k)} says al Coda, but no bar says To Coda.`);
                if (!codas.length) add('al-coda-no-coda', 'error', [k], `${label(k)} says al Coda, but there's no coda sign to go to.`);
                else if (codas[0] <= k) add('coda-before-jump', 'warning', [codas[0]], `The coda (${label(codas[0])}) comes before the ${isDs(b) ? 'D.S.' : 'D.C.'} at ${label(k)} - it's normally after it.`);
                toCodas.forEach(t => {
                    if (target !== -1 && (t < target || t > k)) add('to-coda-unreachable', 'warning', [t], `${label(t)}'s To Coda is never reached after the jump (it's outside ${label(target)} to ${label(k)}).`);
                });
            } else if (fines.length) {
                fines.forEach(f => {
                    if (target !== -1 && (f < target || f > k)) add('fine-unreachable', 'warning', [f], `${label(f)}'s Fine is never reached after the ${isDs(b) ? 'D.S.' : 'D.C.'} at ${label(k)}.`);
                });
            }
        });
        if (toCodas.length && !codas.length && !dsdc.some(k => isAlCoda(blocks[k]))) add('to-coda-no-coda', 'error', toCodas, `${toCodas.map(label).join(', ')} says To Coda, but there's no coda sign to go to.`);
        else if (toCodas.length && !dsdc.some(k => isAlCoda(blocks[k]))) add('to-coda-unused', 'warning', toCodas, `${toCodas.map(label).join(', ')} says To Coda, but there's no D.S./D.C. al Coda, so it's ignored.`);
        if (fines.length && !dsdc.some(k => !isAlCoda(blocks[k]))) add('fine-unused', 'warning', fines, `${fines.map(label).join(', ')} is marked Fine, but Fine only ends the piece after a D.S. or D.C. - there isn't one, so it's ignored.`);
        if (fines.length > 1) add('two-fines', 'warning', fines, `There's more than one Fine (${fines.map(label).join(', ')}) - the piece ends at the first one reached after the jump.`);

        // Intro.
        const introStarts = idxWhere(hasIntroStart);
        const introEnds = idxWhere(hasIntroEnd);
        if (introStarts.length > 1) add('two-intro-starts', 'error', introStarts, `The intro starts in more than one place (${introStarts.map(label).join(', ')}).`);
        if (introEnds.length && !introStarts.length) add('intro-end-no-start', 'error', introEnds, `${introEnds.map(label).join(', ')} ends the intro, but no bar starts it.`);
        if (introStarts.length && introEnds.length) {
            const s = introStarts[0];
            const valid = introEnds.filter(k => k > s || (k === s && blocks[k].introEndBarOffset >= blocks[s].introStartBarOffset));
            if (!valid.length) add('intro-end-before-start', 'error', [...introEnds, s], `The intro's end (${introEnds.map(label).join(', ')}) comes before its start (${label(s)}).`);
            else if (introEnds.length > 1) add('two-intro-ends', 'warning', introEnds, `The intro has more than one end (${introEnds.map(label).join(', ')}) - it stops at the first after its start.`);
        }

        // A ramp whose chosen end comes before its start (the editor doesn't stop it).
        blocks.forEach((b, k) => {
            const w = writtenBeatsPerBar(b);
            const backwards = (b.ramps || []).some(r => r.endMode === 'specific'
                && (r.endBarOffset || 0) * w + ((r.endBeatOffset || 1) - 1) < (r.startBarOffset || 0) * w + ((r.startBeatOffset || 1) - 1));
            if (backwards) add('ramp-ends-before-start', 'warning', [k], `${label(k)}: a tempo ramp ends before it starts - it'll jump straight to its target tempo.`);
        });
        // Ramps overlapping within a block.
        blocks.forEach((b, k) => {
            const spans = rampSpans(blocks, k);
            for (let j = 1; j < spans.length; j++) {
                if (spans[j].s < spans[j - 1].e) { add('ramps-overlap', 'warning', [k], `${label(k)}: two tempo ramps overlap - the later one starts before the earlier one has finished.`); break; }
            }
        });

        // The journey itself: runaway, and bars that never play.
        const journey = buildJourney(blocks, opts);
        if (journey.end === 'loopGuard') add('never-ends', 'error', [], `This Flow's repeats and jumps never reach an end.`);
        const played = new Set(journey.steps.filter(s => s.blockIndex >= 0).map(s => s.blockIndex));
        const unplayed = blocks.map((b, k) => k).filter(k => !played.has(k));
        if (unplayed.length) add('never-plays', 'warning', unplayed, `${unplayed.map(label).join(', ')} never play${unplayed.length === 1 && !/^Bars/.test(label(unplayed[0])) ? 's' : ''} - check the repeats, endings, jumps and final barline around ${unplayed.length === 1 ? 'it' : 'them'}.`);

        return issues;
    }

    return {
        METER_TABLE, meterInfo, writtenBeatsPerBar, writtenBeatToClick,
        buildJourney, passagesOf, tempoAt, rampSpans, pausesInBar,
        repeatBarInvalid, introInvalid, pauseInvalid, rampInvalid,
        barRangeLabel, checkFlow
    };
}));
