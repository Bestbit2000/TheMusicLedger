// ML-370 / ML-384: the range bar - your range drawn inside the instrument's, so you can see what's left to
// learn. One drawing for every place that shows a range, so they always match (specs/components/range-bar.md):
//   - See your range (Scales and Warm-ups): the full bar, with the instrument's ends and the key under it,
//   - the My range... pop-up (the range picker): the full bar, redrawn as you change your notes,
//   - My instruments: the slim bar ({ slim: true }) under each row's text - no names or key.
// Builds markup only (no DOM): loaded in the browser (window.RangeBar, after range.js) and, with vm, by
// server/test/rangeBar.test.js.
//
// ctx: MIDI numbers in one pitch world (the instrument's written pitch, or concert for the bass-clef
// grade lists): low / usualHigh the instrument's range, bottom / top yours. On brass and woodwind the bar
// runs on a 4th past the usual top, open-ended, with the usual top ticked (ML-370) - or ctx.stretch
// semitones when the caller already knows the outer limit (the range picker's instrument.outer).
(function (root, factory) {
    if (typeof module === 'object' && module.exports) module.exports = factory(require('./range.js'));
    else root.RangeBar = factory(root.PlayRange);
}(typeof self !== 'undefined' ? self : this, function (PlayRange) {
    'use strict';

    const esc = (s) => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
    const named = (m) => PlayRange.label(PlayRange.pitchOf(m, 'usual'));
    const n = (k) => `${k} note${k === 1 ? '' : 's'}`;

    // ctx from written pitches ('F#3'): an instrument's range (rangeLow / rangeHigh) and your notes.
    function ctxOf(inst, bottom, top) {
        const m = (p) => (p ? PlayRange.midiOf(p) : null);
        return { low: m(inst && inst.rangeLow), usualHigh: m(inst && inst.rangeHigh), bottom: m(bottom), top: m(top) };
    }

    // { html, text } - text is the "still to learn" line (empty for the slim bar). Nothing without the
    // instrument's range or your notes.
    function html(inst, ctx, { slim = false } = {}) {
        if (!inst || ctx.low == null || ctx.usualHigh == null || ctx.bottom == null || ctx.top == null) return { html: '', text: '' };
        const stretch = ctx.stretch != null ? ctx.stretch : (PlayRange.STRETCH_FAMILIES.includes(inst.family) ? PlayRange.STRETCH_ABOVE : 0);
        const lo = Math.min(ctx.low, ctx.bottom), usual = ctx.usualHigh, end = Math.max(usual + stretch, ctx.top);
        const pct = (m) => `${Math.round(((m - lo) / (end - lo)) * 1000) / 10}%`;
        // --rb-from / --rb-to / --rb-at: run-time positions, read by the .range-bar-* classes (ML-288)
        const part = (cls, from, to) => `<div class="range-bar-part ${cls}" style="--rb-from:${from};--rb-to:${to}"></div>`;
        const open = end > usual;
        const label = `Your range, ${named(ctx.bottom)} to ${named(ctx.top)}, inside the instrument's ${named(lo)} to ${named(usual)}${open ? ` - and up to ${named(end)} with experience` : ''}`;
        const bar = `<div class="range-bar${slim ? ' is-slim' : ''}" role="img" aria-label="${esc(label)}">`
            + part(`range-bar-potential${open ? ' is-open' : ''}`, '0%', pct(usual))
            + (open ? part('range-bar-stretch', pct(usual), '100%') : '')
            + part('range-bar-yours', pct(ctx.bottom), pct(ctx.top))
            + (open ? `<div class="range-bar-tick" style="--rb-at:${pct(usual)}"></div>` : '')
            + '</div>';
        if (slim) return { html: bar, text: '' };
        const full = bar
            + `<div class="range-bar-ends" aria-hidden="true"><span class="range-bar-end is-start">${named(lo)}</span>`
            + (open ? `<span class="range-bar-end is-at" style="--rb-at:${pct(usual)}">${named(usual)} usual top</span>` : `<span class="range-bar-end is-end">${named(usual)}</span>`)
            + '</div>'
            + '<ul class="range-bar-key" aria-hidden="true"><li><span class="range-bar-swatch is-yours"></span>Your range</li><li><span class="range-bar-swatch is-potential"></span>Potential range</li></ul>';
        const below = Math.max(0, ctx.bottom - ctx.low), above = usual - ctx.top;
        const parts = [below ? `${n(below)} below` : '', above > 0 ? `${n(above)} up to the usual top` : ''].filter(Boolean);
        let text = parts.length ? `Still to learn: ${parts.join(', ')}.` : 'You play the whole of the usual range.';
        if (above < 0) text += ` You're ${n(-above)} past the usual top${open ? ' - keep going if it\'s comfortable' : ''}.`;
        return { html: full, text };
    }

    return { html, ctxOf };
}));
