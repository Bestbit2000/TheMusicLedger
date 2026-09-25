// ML-198: Admin -> Design. A read-only visual catalogue of the design system.
//
// - Foundations are built live from tokens.css (fetched and parsed on open), so a new or changed
//   token shows up here automatically.
// - Components are rendered with the real app classes from style.css/admin.css, grouped by type.
//   Each example is annotated with the spacing/radius/type/colour tokens it actually resolves to
//   (read from getComputedStyle), and anything that doesn't match a token is flagged with a warning.
// - Every spec in specs/components/ must have an entry below (`spec: '<file name>'`) - the design
//   gate (scripts/design-gate.mjs) fails the release otherwise. New component in a release =
//   new spec + new entry here.
(function () {
    'use strict';

    // ------------------------------------------------------------------ component catalogue
    // Each item: { spec, title, examples: [{ label, html, measure?, wide? }] }.
    // `measure` = selector(s) inside the example to annotate (default: the example's first element).
    // Positions/heights in style="" below are data-driven geometry (as the app sets from JS), not tokens.

    const dot = (cls, left, extra = '') => `<span class="metro-dot ${cls}" style="left:${left}%">${extra}</span>`;
    const tier = (dots) => `<div class="metro-tier">${dots}</div>`;
    // ML-206: the Bars tab's layout-switch icons (public/icons/layout-*.svg), inlined as in index.html.
    const layoutIcon1 = '<svg class="flow-layout-icon" viewBox="3154 825 1246 1246" aria-hidden="true" fill="currentColor"><path d="M3442.91 915.822 3442.91 916.152 3245.12 916.152 3245.12 1311.85 3442.91 1311.85 3442.91 1312.44 4216.92 1312.44 4216.92 1311.85 4308.88 1311.85 4308.88 916.152 4216.92 916.152 4216.92 915.822ZM3199.59 825 3533.68 825 3686.23 825 3867.77 825 4020.32 825 4354.41 825C4379.59 825 4400 845.418 4400 870.604L4400 1357.4C4400 1382.58 4379.59 1403 4354.41 1403L4020.32 1403 3867.77 1403 3686.23 1403 3533.68 1403 3199.59 1403C3174.41 1403 3154 1382.58 3154 1357.4L3154 870.604C3154 845.418 3174.41 825 3199.59 825Z" fill-rule="evenodd"/><path d="M3442.91 1583.82 3442.91 1584.15 3245.12 1584.15 3245.12 1979.85 3442.91 1979.85 3442.91 1980.44 4216.92 1980.44 4216.92 1979.85 4308.88 1979.85 4308.88 1584.15 4216.92 1584.15 4216.92 1583.82ZM3199.59 1493 3533.68 1493 3686.23 1493 3867.77 1493 4020.32 1493 4354.41 1493C4379.59 1493 4400 1513.42 4400 1538.6L4400 2025.4C4400 2050.58 4379.59 2071 4354.41 2071L4020.32 2071 3867.77 2071 3686.23 2071 3533.68 2071 3199.59 2071C3174.41 2071 3154 2050.58 3154 2025.4L3154 1538.6C3154 1513.42 3174.41 1493 3199.59 1493Z" fill-rule="evenodd"/></svg>';
    const layoutIcon2 = '<svg class="flow-layout-icon" viewBox="1627 825 1246 1246" aria-hidden="true" fill="currentColor"><path d="M1718.15 916.152 1718.15 1311.85 2113.85 1311.85 2113.85 916.152ZM1672.6 825 2159.4 825C2184.58 825 2205 845.418 2205 870.604L2205 1357.4C2205 1382.58 2184.58 1403 2159.4 1403L1672.6 1403C1647.42 1403 1627 1382.58 1627 1357.4L1627 870.604C1627 845.418 1647.42 825 1672.6 825Z" fill-rule="evenodd"/><path d="M2386.15 916.152 2386.15 1311.85 2781.85 1311.85 2781.85 916.152ZM2340.6 825 2827.4 825C2852.58 825 2873 845.418 2873 870.604L2873 1357.4C2873 1382.58 2852.58 1403 2827.4 1403L2340.6 1403C2315.42 1403 2295 1382.58 2295 1357.4L2295 870.604C2295 845.418 2315.42 825 2340.6 825Z" fill-rule="evenodd"/><path d="M2386.15 1584.15 2386.15 1979.85 2781.85 1979.85 2781.85 1584.15ZM2340.6 1493 2827.4 1493C2852.58 1493 2873 1513.42 2873 1538.6L2873 2025.4C2873 2050.58 2852.58 2071 2827.4 2071L2340.6 2071C2315.42 2071 2295 2050.58 2295 2025.4L2295 1538.6C2295 1513.42 2315.42 1493 2340.6 1493Z" fill-rule="evenodd"/><path d="M1718.15 1584.15 1718.15 1979.85 2113.85 1979.85 2113.85 1584.15ZM1672.6 1493 2159.4 1493C2184.58 1493 2205 1513.42 2205 1538.6L2205 2025.4C2205 2050.58 2184.58 2071 2159.4 2071L1672.6 2071C1647.42 2071 1627 2050.58 1627 2025.4L1627 1538.6C1627 1513.42 1647.42 1493 1672.6 1493Z" fill-rule="evenodd"/></svg>';
    const layoutIcon4 = '<svg class="flow-layout-icon" viewBox="81 822 1253 1253" aria-hidden="true" fill="currentColor"><path d="M103.673 825.5 308.327 825.5C318.916 825.5 327.5 834.084 327.5 844.672L327.5 1049.33C327.5 1059.92 318.916 1068.5 308.327 1068.5L103.673 1068.5C93.0839 1068.5 84.5001 1059.92 84.5001 1049.33L84.5001 844.672C84.5001 834.084 93.0839 825.5 103.673 825.5Z" fill-rule="evenodd"/><path d="M437.672 825.5 642.327 825.5C652.916 825.5 661.5 834.084 661.5 844.672L661.5 1049.33C661.5 1059.92 652.916 1068.5 642.327 1068.5L437.672 1068.5C427.084 1068.5 418.5 1059.92 418.5 1049.33L418.5 844.672C418.5 834.084 427.084 825.5 437.672 825.5Z" fill-rule="evenodd"/><path d="M772.673 825.5 977.327 825.5C987.916 825.5 996.5 834.084 996.5 844.672L996.5 1049.33C996.5 1059.92 987.916 1068.5 977.327 1068.5L772.673 1068.5C762.084 1068.5 753.5 1059.92 753.5 1049.33L753.5 844.672C753.5 834.084 762.084 825.5 772.673 825.5Z" fill-rule="evenodd"/><path d="M1106.67 825.5 1311.33 825.5C1321.92 825.5 1330.5 834.084 1330.5 844.672L1330.5 1049.33C1330.5 1059.92 1321.92 1068.5 1311.33 1068.5L1106.67 1068.5C1096.08 1068.5 1087.5 1059.92 1087.5 1049.33L1087.5 844.672C1087.5 834.084 1096.08 825.5 1106.67 825.5Z" fill-rule="evenodd"/><path d="M103.673 1160.5 308.327 1160.5C318.916 1160.5 327.5 1169.08 327.5 1179.67L327.5 1384.33C327.5 1394.92 318.916 1403.5 308.327 1403.5L103.673 1403.5C93.0839 1403.5 84.5001 1394.92 84.5001 1384.33L84.5001 1179.67C84.5001 1169.08 93.0839 1160.5 103.673 1160.5Z" fill-rule="evenodd"/><path d="M437.672 1160.5 642.327 1160.5C652.916 1160.5 661.5 1169.08 661.5 1179.67L661.5 1384.33C661.5 1394.92 652.916 1403.5 642.327 1403.5L437.672 1403.5C427.084 1403.5 418.5 1394.92 418.5 1384.33L418.5 1179.67C418.5 1169.08 427.084 1160.5 437.672 1160.5Z" fill-rule="evenodd"/><path d="M772.673 1160.5 977.327 1160.5C987.916 1160.5 996.5 1169.08 996.5 1179.67L996.5 1384.33C996.5 1394.92 987.916 1403.5 977.327 1403.5L772.673 1403.5C762.084 1403.5 753.5 1394.92 753.5 1384.33L753.5 1179.67C753.5 1169.08 762.084 1160.5 772.673 1160.5Z" fill-rule="evenodd"/><path d="M1106.67 1160.5 1311.33 1160.5C1321.92 1160.5 1330.5 1169.08 1330.5 1179.67L1330.5 1384.33C1330.5 1394.92 1321.92 1403.5 1311.33 1403.5L1106.67 1403.5C1096.08 1403.5 1087.5 1394.92 1087.5 1384.33L1087.5 1179.67C1087.5 1169.08 1096.08 1160.5 1106.67 1160.5Z" fill-rule="evenodd"/><path d="M103.673 1494.5 308.327 1494.5C318.916 1494.5 327.5 1503.08 327.5 1513.67L327.5 1718.33C327.5 1728.92 318.916 1737.5 308.327 1737.5L103.673 1737.5C93.0839 1737.5 84.5001 1728.92 84.5001 1718.33L84.5001 1513.67C84.5001 1503.08 93.0839 1494.5 103.673 1494.5Z" fill-rule="evenodd"/><path d="M437.672 1494.5 642.327 1494.5C652.916 1494.5 661.5 1503.08 661.5 1513.67L661.5 1718.33C661.5 1728.92 652.916 1737.5 642.327 1737.5L437.672 1737.5C427.084 1737.5 418.5 1728.92 418.5 1718.33L418.5 1513.67C418.5 1503.08 427.084 1494.5 437.672 1494.5Z" fill-rule="evenodd"/><path d="M772.673 1494.5 977.327 1494.5C987.916 1494.5 996.5 1503.08 996.5 1513.67L996.5 1718.33C996.5 1728.92 987.916 1737.5 977.327 1737.5L772.673 1737.5C762.084 1737.5 753.5 1728.92 753.5 1718.33L753.5 1513.67C753.5 1503.08 762.084 1494.5 772.673 1494.5Z" fill-rule="evenodd"/><path d="M1106.67 1494.5 1311.33 1494.5C1321.92 1494.5 1330.5 1503.08 1330.5 1513.67L1330.5 1718.33C1330.5 1728.92 1321.92 1737.5 1311.33 1737.5L1106.67 1737.5C1096.08 1737.5 1087.5 1728.92 1087.5 1718.33L1087.5 1513.67C1087.5 1503.08 1096.08 1494.5 1106.67 1494.5Z" fill-rule="evenodd"/><path d="M103.673 1828.5 308.327 1828.5C318.916 1828.5 327.5 1837.08 327.5 1847.67L327.5 2052.33C327.5 2062.92 318.916 2071.5 308.327 2071.5L103.673 2071.5C93.0839 2071.5 84.5001 2062.92 84.5001 2052.33L84.5001 1847.67C84.5001 1837.08 93.0839 1828.5 103.673 1828.5Z" fill-rule="evenodd"/><path d="M437.672 1828.5 642.327 1828.5C652.916 1828.5 661.5 1837.08 661.5 1847.67L661.5 2052.33C661.5 2062.92 652.916 2071.5 642.327 2071.5L437.672 2071.5C427.084 2071.5 418.5 2062.92 418.5 2052.33L418.5 1847.67C418.5 1837.08 427.084 1828.5 437.672 1828.5Z" fill-rule="evenodd"/><path d="M772.673 1828.5 977.327 1828.5C987.916 1828.5 996.5 1837.08 996.5 1847.67L996.5 2052.33C996.5 2062.92 987.916 2071.5 977.327 2071.5L772.673 2071.5C762.084 2071.5 753.5 2062.92 753.5 2052.33L753.5 1847.67C753.5 1837.08 762.084 1828.5 772.673 1828.5Z" fill-rule="evenodd"/><path d="M1106.67 1828.5 1311.33 1828.5C1321.92 1828.5 1330.5 1837.08 1330.5 1847.67L1330.5 2052.33C1330.5 2062.92 1321.92 2071.5 1311.33 2071.5L1106.67 2071.5C1096.08 2071.5 1087.5 2062.92 1087.5 2052.33L1087.5 1847.67C1087.5 1837.08 1096.08 1828.5 1106.67 1828.5Z" fill-rule="evenodd"/></svg>';
    const barTile = (head, bpm, bars) => `<button type="button" class="metroBlk-tile flow-bar-grid-tile">${head}<div class="metroBlk-tile-bpm">${bpm} bpm</div><div class="metroBlk-tile-bars">${bars} bars</div></button>`;
    const heatCol = (levels) => `<div class="heat-col">${levels.map(l => `<div class="heat-cell h-time-${l}"></div>`).join('')}</div>`;
    // ML-262: notation examples are drawn by the real renderer (public/notation.js, loaded before this
    // file), so this section doubles as the notation reference sheet. k scales SVG units to px.
    const NT = window.Notation;
    const nScale = (svg, k = 1.3) => svg.replace(/width="([\d.]+)" height="([\d.]+)"/, (m, w, h) => `width="${Math.round(w * k)}" height="${Math.round(h * k)}"`);
    const nRow = (svgs, k) => `<div class="flex-row gap-md" style="flex-wrap: wrap; align-items: flex-end;">${svgs.map(s => nScale(s, k)).join('')}</div>`;
    const nNotes = (pitches, extra) => ({ items: pitches.map(p => ({ type: 'note', pitch: p })), ...(extra || {}) });
    const notationExamples = NT ? [
        { label: 'Key signatures (standard order and positions): treble 3♯, 4♭, 7♯ · bass 3♯, 4♭, 7♭', wide: true, html: nRow([
            NT.staff({ clef: 'treble', keySignature: { type: 'sharp', count: 3 } }), NT.staff({ clef: 'treble', keySignature: { type: 'flat', count: 4 } }), NT.staff({ clef: 'treble', keySignature: { type: 'sharp', count: 7 } }),
            NT.staff({ clef: 'bass', keySignature: { type: 'sharp', count: 3 } }), NT.staff({ clef: 'bass', keySignature: { type: 'flat', count: 4 } }), NT.staff({ clef: 'bass', keySignature: { type: 'flat', count: 7 } })]), measure: '.notation' },
        { label: 'Ledger lines: the lowest and highest note of each Theory range - treble D4-G5, A3-C6, D3-G6, G2-D7; bass B0-F5', wide: true, html: nRow([
            ...[['D4', 'G5'], ['A3', 'C6'], ['D3', 'G6'], ['G2', 'D7']].map(p => NT.staff({ clef: 'treble', ...nNotes(p) })), NT.staff({ clef: 'bass', ...nNotes(['B0', 'F5']) })], 1), measure: '.notation' },
        { label: 'Written-out scales: D major, D♯ harmonic minor (double sharp), A melodic minor in the bass', wide: true, html: nRow([
            NT.staff(nNotes(['D4', 'E4', 'F#4', 'G4', 'A4', 'B4', 'C#5', 'D5'], { noteGap: 1.2 })), NT.staff(nNotes(['D#4', 'E#4', 'F#4', 'G#4', 'A#4', 'B4', 'Cx5', 'D#5'], { noteGap: 1.2 })), NT.staff({ clef: 'bass', ...nNotes(['A2', 'B2', 'C3', 'D3', 'E3', 'F#3', 'G#3', 'A3'], { noteGap: 1.2 }) })], 1), measure: '.notation' },
        { label: 'Symbols on a scrap of staff (no clef): fermata, breath mark, caesura, staccato, accent, tenuto', wide: true, html: nRow([
            NT.staff({ hideClef: true, items: [{ type: 'note', pitch: 'B4', above: 'fermataAbove' }] }),
            NT.staff({ hideClef: true, items: [{ type: 'note', pitch: 'G4' }, { type: 'mark', glyph: 'breathMarkComma', step: 9 }, { type: 'note', pitch: 'A4' }] }),
            NT.staff({ hideClef: true, items: [{ type: 'note', pitch: 'G4' }, { type: 'mark', glyph: 'caesura', step: 6 }, { type: 'note', pitch: 'A4' }] }),
            ...['articStaccatoBelow', 'articAccentBelow', 'articTenutoBelow'].map(g => NT.staff({ hideClef: true, items: ['F4', 'A4'].map(p => ({ type: 'note', pitch: p, head: 'noteQuarterUp', below: g })) }))]), measure: '.notation' },
        { label: 'Barlines and brackets: repeats with a 1st-time bar, intro brackets, final barline + Fine, crescendo', wide: true, html: nRow([
            NT.staff({ hideClef: true, items: [{ type: 'barline', glyph: 'repeatLeft' }, { type: 'note', pitch: 'G4' }, { type: 'note', pitch: 'A4' }, { type: 'barline', glyph: 'repeatRight' }], spans: [{ kind: 'volta', from: 1, to: 3, text: '1.' }] }),
            NT.staff({ hideClef: true, items: [{ type: 'note', pitch: 'G4' }, { type: 'note', pitch: 'A4' }, { type: 'barline', glyph: 'barlineSingle' }, { type: 'note', pitch: 'B4' }, { type: 'note', pitch: 'C5' }], spans: [{ kind: 'intro', from: 0, to: 4 }] }),
            NT.staff({ hideClef: true, items: [{ type: 'note', pitch: 'C5' }, { type: 'note', pitch: 'B4' }, { type: 'barline', glyph: 'barlineFinal' }, { type: 'text', text: 'Fine', italic: true, step: -4 }] }),
            NT.staff({ hideClef: true, items: [{ type: 'note', pitch: 'E4' }, { type: 'note', pitch: 'G4' }, { type: 'note', pitch: 'C5' }], spans: [{ kind: 'hairpin', from: 0, to: 2, dir: 'cresc' }] })]), measure: '.notation' },
        { label: 'Rhythm: note values (flags, a dotted minim), rests (semibreve rest hangs from the 4th line), time signatures, a tie and a slur', wide: true, html: nRow([
            NT.staff({ hideClef: true, noteGap: 1.4, items: [{ type: 'timeSig', top: 4, bottom: 4 }, ...['noteWhole', 'noteHalfUp', 'noteQuarterUp', 'note8thUp', 'note16thUp'].map(h => ({ type: 'note', pitch: 'A4', head: h === 'noteWhole' ? undefined : h })), { type: 'note', pitch: 'A4', head: 'noteHalfUp', dots: 1 }] }),
            NT.staff({ hideClef: true, noteGap: 1.4, items: [{ type: 'mark', glyph: 'restWhole', step: 6 }, ...['restHalf', 'restQuarter', 'rest8th', 'rest16th'].map(g => ({ type: 'mark', glyph: g, step: 4 })), { type: 'timeSig', glyph: 'timeSigCommon' }, { type: 'timeSig', glyph: 'timeSigCutCommon' }, { type: 'timeSig', top: 6, bottom: 8 }] }),
            NT.staff({ hideClef: true, items: ['G4', 'G4'].map(p => ({ type: 'note', pitch: p, head: 'noteQuarterUp' })), spans: [{ kind: 'tie', from: 0, to: 1 }] }),
            NT.staff({ hideClef: true, items: ['E4', 'F4', 'A4'].map(p => ({ type: 'note', pitch: p, head: 'noteQuarterUp' })), spans: [{ kind: 'slur', from: 0, to: 2 }] })]), measure: '.notation' },
        { label: 'Words printed in music: tempo words bold and upright (.notation-text-bold), expression words italic (.notation-text-italic)', wide: true, html: nRow([NT.textMark('Allegro', { bold: true }), NT.textMark('Andante', { bold: true }), NT.textMark('rit.', { italic: true }), NT.textMark('a tempo', { italic: true }), NT.textMark('legato', { italic: true })]), measure: '.notation-text-bold, .notation-text-italic' },
        { label: 'Single glyphs: clefs, accidentals, segno, coda, D.C., D.S., dynamics, hairpins, Fine', wide: true, html: nRow([
            ...['gClef', 'fClef', 'accidentalSharp', 'accidentalFlat', 'accidentalNatural', 'segno', 'coda', 'daCapo', 'dalSegno', 'dynamicPP', 'dynamicPiano', 'dynamicMP', 'dynamicMF', 'dynamicForte', 'dynamicFF', 'dynamicSforzato'].map(g => NT.symbol(g)),
            NT.hairpin('cresc'), NT.hairpin('dim'), NT.textMark('Fine', { italic: true })], 1), measure: '.notation, .notation-glyph' },
    ] : [];
    const theoryAnswer = (label, state) => `<button type="button" class="theory-answer${state ? ` theory-answer-${state}` : ''}">${state ? `<span class="material-symbols-outlined" aria-hidden="true">${state === 'right' ? 'check' : 'close'}</span>` : ''}${label}</button>`;
    const theoryGrade = (g, lg) => `<span class="theory-grade${lg ? ' theory-grade-lg' : ''}" role="img" aria-label="Grade ${g} of 5">${[1, 2, 3, 4, 5].map(i => `<span class="theory-grade-dot${i <= g ? ' theory-grade-dot-on' : ''}"></span>`).join('')}</span>`;

    const GROUPS = [
        {
            title: 'Actions',
            items: [
                { spec: 'button', title: 'Buttons', examples: [
                    { label: 'Primary (.btn-submit)', html: '<button class="btn-submit" type="button">Save session</button>' },
                    { label: 'Primary, large (.btn-large)', html: '<button class="btn-large" type="button">Start a challenge</button>' },
                    { label: 'Navigation (.btn-nav)', html: '<button class="btn-nav" type="button">View stats <span class="btn-nav-arrow">›</span></button>' },
                    { label: 'Secondary / cancel (.btn-nav.btn-cancel) next to a primary', html: '<div class="flex-row gap-md"><button class="btn-nav btn-cancel" type="button">Cancel</button><button class="btn-submit" type="button">Save</button></div>', measure: '.flex-row, .btn-cancel' },
                    { label: 'Tertiary (.btn-text) and destructive tertiary (.btn-text-danger)', html: '<div><button class="btn-text" type="button">Show more options</button><button class="btn-text btn-text-danger" type="button">Delete this flow</button></div>', measure: '.btn-text' },
                    { label: 'Inline row actions (.btn-edit / .btn-delete)', html: '<div class="flex-row gap-sm"><button class="btn-edit" type="button">Edit</button><button class="btn-delete" type="button">Delete</button></div>', measure: '.btn-edit, .btn-delete' },
                    { label: 'Disabled', html: '<button class="btn-submit" type="button" disabled>Save session</button>' },
                ] },
                { spec: 'icon-button', title: 'Icon buttons', examples: [
                    { label: 'Row actions: edit / copy / delete (circle)', html: '<div class="flex-row gap-md"><button class="btn-icon-edit" type="button" aria-label="Edit"><span class="material-symbols-outlined">edit</span></button><button class="btn-icon-copy" type="button" aria-label="Copy"><span class="material-symbols-outlined">content_copy</span></button><button class="btn-icon-delete" type="button" aria-label="Delete"><span class="material-symbols-outlined">delete</span></button></div>', measure: '.flex-row, .btn-icon-edit' },
                    { label: 'More menu (.list-item-menu-btn)', html: '<button class="list-item-menu-btn" type="button" aria-label="More" aria-haspopup="menu" aria-expanded="false"><span class="material-symbols-outlined">more_vert</span></button>' },
                    { label: 'Transport (square, .metro-transport-btn)', html: '<div class="metro-transport-row"><button class="metro-transport-btn metro-play-btn" type="button" aria-label="Play"><span class="material-symbols-outlined">play_arrow</span></button><button class="metro-transport-btn metro-stop-btn" type="button" aria-label="Stop"><span class="material-symbols-outlined">stop</span></button></div>', measure: '.metro-transport-row, .metro-play-btn' },
                    { label: 'Modal close (.modal-close-x)', html: '<div class="admin-design-relative"><button class="modal-close-x" type="button" aria-label="Close">✕</button></div>', measure: '.modal-close-x' },
                ] },
                { spec: 'tool-icon-button', title: 'Tool icon buttons', examples: [
                    { label: 'Home screen tool row', html: '<div class="tool-icon-row"><button class="tool-icon-btn" type="button"><span class="material-symbols-outlined">timer</span><span class="tool-icon-label">Timer</span></button><button class="tool-icon-btn" type="button"><span class="material-symbols-outlined">graphic_eq</span><span class="tool-icon-label">Tuner</span></button><button class="tool-icon-btn" type="button"><span class="material-symbols-outlined">library_music</span><span class="tool-icon-label">Flow</span></button><button class="tool-icon-btn" type="button"><span class="material-symbols-outlined">avg_pace</span><span class="tool-icon-label">Metronome</span></button>' + (NT ? `<button class="tool-icon-btn" type="button">${NT.symbol('gClef').replace('class="notation"', 'class="notation tool-icon-svg"')}<span class="tool-icon-label">Theory</span></button>` : '') + '</div>', measure: '.tool-icon-row, .tool-icon-btn' },
                ] },
            ],
        },
        {
            title: 'Inputs',
            items: [
                { spec: 'form-field', title: 'Form fields', examples: [
                    { label: 'Text input with label, required marker and help text', html: '<div class="form-group"><label>Piece <span class="flow-required">*</span></label><input type="text" value="Clarinet Concerto, 2nd mvt" aria-label="Piece"><span class="flow-help-text">As it appears on the score.</span></div>', measure: '.form-group, label, input' },
                    { label: 'Select', html: '<div class="form-group"><label>Time period</label><select aria-label="Time period"><option>All time</option><option>This month</option></select></div>', measure: 'select' },
                    { label: 'Textarea', html: '<div class="form-group"><label>Notes</label><textarea rows="3" aria-label="Notes">Slow practice at 60 bpm.</textarea></div>', measure: 'textarea' },
                ] },
                { spec: 'toggle-switch', title: 'Toggle switch', examples: [
                    { label: 'Settings rows (.setting-row, .setting-row-grouped) and read-only info rows (.info-row) - display surfaces; only the switch is tappable (ML-286)', html: '<div class="flex-col"><div class="setting-row setting-row-grouped"><span id="dsSetRowA">Dark mode</span><label class="toggle-switch"><input type="checkbox" checked aria-labelledby="dsSetRowA"><span class="toggle-slider"></span></label></div><div class="setting-row"><span id="dsSetRowB">Show Hz</span><label class="toggle-switch"><input type="checkbox" aria-labelledby="dsSetRowB"><span class="toggle-slider"></span></label></div><div class="info-row"><span>Email</span><strong>you@example.com</strong></div><div class="info-row info-row-end"><span>Member since</span><strong>9/9/2026</strong></div></div>', measure: '.setting-row, .setting-row-grouped, .info-row' },
                    { label: 'Off and on', html: '<div class="flex-col gap-md"><div class="tuner-display-toggle-row"><span id="toggle17Label">Show pitch graph</span><label class="toggle-switch"><input type="checkbox" aria-labelledby="toggle17Label"><span class="toggle-slider"></span></label></div><div class="tuner-display-toggle-row"><span id="toggle16Label">Show dynamics</span><label class="toggle-switch"><input type="checkbox" checked aria-labelledby="toggle16Label"><span class="toggle-slider"></span></label></div></div>', measure: '.tuner-display-toggle-row' },
                ] },
                { spec: 'radio-group', title: 'Radio group', examples: [
                    { label: 'Standard (one selected)', html: '<div class="radio-group"><input type="radio" id="dsR1" name="dsR" checked><label for="dsR1">Practise</label><input type="radio" id="dsR2" name="dsR"><label for="dsR2">Rehearsal</label><input type="radio" id="dsR3" name="dsR"><label for="dsR3">Lesson</label><input type="radio" id="dsR4" name="dsR"><label for="dsR4">Performance</label></div>', measure: '.radio-group, label' },
                    { label: 'Compact (.radio-group.compact)', html: '<div class="radio-group compact"><input type="radio" id="dsC1" name="dsC"><label for="dsC1">15m</label><input type="radio" id="dsC2" name="dsC" checked><label for="dsC2">30m</label><input type="radio" id="dsC3" name="dsC"><label for="dsC3">45m</label><input type="radio" id="dsC4" name="dsC"><label for="dsC4">60m</label></div>', measure: 'label' },
                ] },
                { spec: 'slider', title: 'Slider', examples: [
                    { label: 'Slider with scale', html: '<div class="slider-wrap"><div class="slider-track"><div class="slider-fill" style="width:45%"></div><div class="slider-thumb" style="left:45%" tabindex="0" role="slider" aria-label="Tempo (example)" aria-valuemin="40" aria-valuemax="240" aria-valuenow="130"></div></div><div class="slider-scale"><span>40</span><span>240</span></div></div>', measure: '.slider-track, .slider-thumb, .slider-scale' },
                ] },
                { spec: 'filter-strip', title: 'Filter strip', examples: [
                    { label: 'Category pills (selected ones take their category colour)', html: '<div class="filter-strip"><div class="filter-strip-icon"><span class="material-symbols-outlined">tune</span><span class="filter-strip-badge">2</span></div><div class="filter-strip-pills"><button class="filter-pill" type="button">All <span class="filter-pill-count">24</span></button><button class="filter-pill active" type="button" style="--filter-pill-accent: var(--cat-practise)">Practise <span class="filter-pill-count">18</span></button><button class="filter-pill active" type="button" style="--filter-pill-accent: var(--cat-lesson)">Lesson <span class="filter-pill-count">6</span></button><button class="filter-pill" type="button">Rehearsal</button></div></div>', measure: '.filter-strip, .filter-pill.active' },
                ] },
                { spec: 'selectable-tile', title: 'Selectable tiles', examples: [
                    { label: 'Picker tiles (.flow-picker-tile) - one selected', html: '<div class="flow-tile-grid" style="grid-template-columns: repeat(4, 1fr)"><button class="flow-picker-tile selected" type="button"><strong>4/4</strong><span class="flow-picker-tile-label">Common</span></button><button class="flow-picker-tile" type="button"><strong>3/4</strong><span class="flow-picker-tile-label">Waltz</span></button><button class="flow-picker-tile" type="button"><strong>6/8</strong><span class="flow-picker-tile-label">Compound</span></button><button class="flow-picker-tile" type="button"><strong>5/4</strong><span class="flow-picker-tile-label">Odd</span></button></div>', measure: '.flow-tile-grid, .flow-picker-tile.selected, .flow-picker-tile:not(.selected)' },
                    { label: 'Choice list (.flow-choice-option)', html: '<div><div class="flow-choice-option selected">Repeat the whole flow <span class="material-symbols-outlined">check</span></div><div class="flow-choice-option">Play once</div></div>', measure: '.flow-choice-option' },
                    { label: 'Tap tiles (.metroSeg-tap-btn) and row tiles (.metroSeg-row-tile)', html: '<div class="flex-col gap-md"><div class="flex-row gap-sm"><button class="metroSeg-tap-btn selected" type="button"><strong>2</strong><span>bars</span></button><button class="metroSeg-tap-btn" type="button"><strong>4</strong><span>bars</span></button></div><button class="metroSeg-row-tile selected" type="button"><span class="metroSeg-row-tile-glyph">♩</span><span class="metroSeg-row-tile-text"><strong>Crotchet</strong><span>Quarter note</span></span></button></div>', measure: '.metroSeg-tap-btn, .metroSeg-row-tile' },
                ] },
            ],
        },
        {
            title: 'Navigation',
            items: [
                { spec: 'top-bar', title: 'Top bar', examples: [
                    { label: 'With back button, timer pill (running) and burger with unread dot', html: '<div class="admin-design-static"><div class="top-bar-sticky-group"><div class="top-bar"><button class="top-btn-back" type="button">&lt;</button><div class="top-bar-title">Metronome</div><button class="top-bar-timer-pill top-bar-timer-pill-running" type="button" aria-haspopup="dialog" aria-expanded="false"><span class="material-symbols-outlined top-bar-timer-pill-icon">timer</span><span class="top-bar-timer-pill-time">12:04</span></button><button class="top-btn admin-design-relative" type="button" aria-label="Menu">☰<span class="notif-dot"></span></button></div></div></div>', measure: '.top-bar, .top-bar-timer-pill' },
                ] },
                { spec: 'dropdown-menu', title: 'Dropdown menu', examples: [
                    { label: 'The ☰ navigation menu (ML-259): icon rows, section titles, lines between groups (not rows), the tools row, the current screen marked (Streaks), meta text on the right, the signed-in email under Log out', html: `<div class="admin-design-static"><div class="dropdown-menu nav-menu show" id="adminDesignNavMenu" style="position: static;">${[
                        ['home', 'Home'], ['notifications', 'Notifications', '<span class="notif-count">2</span>']].map(([i, t, x]) => `<button type="button" class="dropdown-item nav-item"><span class="material-symbols-outlined nav-item-icon" aria-hidden="true">${i}</span><span class="nav-item-text">${t}</span>${x || ''}</button>`).join('')
                    }<div class="nav-divider" role="separator"></div><div class="nav-section-title">Tools</div><div class="nav-tools" role="group" aria-label="Tools">${[['avg_pace', 'Metronome'], ['grid_view', 'Flow'], ['graphic_eq', 'Tuner'], ['timer', 'Timer'], ['music_note', 'Theory']].map(([i, t]) => `<button type="button" class="nav-tool"><span class="material-symbols-outlined" aria-hidden="true">${i}</span><span class="nav-tool-label">${t}</span></button>`).join('')}</div><div class="nav-divider" role="separator"></div><div class="nav-section-title">Progress</div><button type="button" class="dropdown-item nav-item"><span class="material-symbols-outlined nav-item-icon" aria-hidden="true">bar_chart</span><span class="nav-item-text">Stats</span></button><button type="button" class="dropdown-item nav-item" aria-current="page"><span class="material-symbols-outlined nav-item-icon" aria-hidden="true">local_fire_department</span><span class="nav-item-text">Streaks</span></button><div class="nav-divider" role="separator"></div><div class="nav-section-title">You</div><button type="button" class="dropdown-item nav-item"><span class="material-symbols-outlined nav-item-icon" aria-hidden="true">person</span><span class="nav-item-text">My account</span><span class="nav-item-meta">Andrew</span></button><div class="nav-divider" role="separator"></div><button type="button" class="dropdown-item nav-item"><span class="material-symbols-outlined nav-item-icon" aria-hidden="true">info</span><span class="nav-item-text">About</span><span class="nav-item-meta">v0.27.0</span></button><div class="nav-divider" role="separator"></div><button type="button" class="dropdown-item nav-item"><span class="material-symbols-outlined nav-item-icon" aria-hidden="true">logout</span><span class="nav-item-text">Log out<span class="nav-item-sub">you@example.com</span></span></button></div></div>`, measure: '.nav-item, .nav-item[aria-current], .nav-section-title, .nav-tool, .nav-item-meta, .nav-item-sub, .nav-divider' },
                    { label: 'Burger menu (with unread count and a destructive item)', html: '<div class="admin-design-static"><div class="dropdown-menu show"><a class="dropdown-item">Home</a><a class="dropdown-item">Notifications <span class="notif-count">2</span></a><a class="dropdown-item">Settings</a><a class="dropdown-item account-band-menu-delete">Leave band</a></div></div>', measure: '.dropdown-menu, .dropdown-item' },
                ] },
                { spec: 'tabs', title: 'Tabs', examples: [
                    { label: 'Segmented (.flow-edit-tabs) - app', html: '<div class="flow-edit-tabs"><button class="flow-edit-tab active" type="button">Details</button><button class="flow-edit-tab" type="button">Blocks <span class="flow-edit-tab-count">4</span></button><button class="flow-edit-tab" type="button">Media</button></div>', measure: '.flow-edit-tabs, .flow-edit-tab.active' },
                    { label: 'Underline (.admin-subtabs) - admin', wide: true, html: '<div class="admin-subtabs"><button class="admin-subtab-item active" type="button">All</button><button class="admin-subtab-item" type="button">Under review</button><button class="admin-subtab-item" type="button">Planned</button></div>', measure: '.admin-subtab-item.active' },
                    { label: 'Sidebar (.admin-nav-item): active, normal, disabled', wide: true, html: '<div class="admin-design-sidebar"><button class="admin-nav-item active" type="button">Features</button><button class="admin-nav-item" type="button">Accounts</button><button class="admin-nav-item" type="button" disabled>Billing</button></div>', measure: '.admin-nav-item.active' },
                ] },
            ],
        },
        {
            title: 'Data display',
            items: [
                { spec: 'card', title: 'Cards', examples: [
                    { label: 'Flow card (.flow-card)', html: '<div class="flow-card"><div class="flow-card-header"><span class="flow-card-label">Recordings</span><span class="flow-pill">3</span></div><span class="text-muted">Audio and video attached to this flow.</span></div>', measure: '.flow-card, .flow-card-header' },
                    { label: 'Play card (.play-card) - Quick play', html: '<div class="play-card"><div class="play-piece">Clarinet Concerto</div><div class="play-ref">2nd movement, bars 1-32</div><div class="play-meta"><span>♩ = 72</span><span>3/4</span></div><div class="play-stats">Played 4 times</div></div>', measure: '.play-card, .play-stats' },
                    { label: 'Highlighted note (.about-running-note)', html: '<div class="about-running-note">You are running version 0.25.0.</div>' },
                ] },
                { spec: 'stat-card', title: 'Stat cards', examples: [
                    { label: 'Clickable card (.stat-card.clickable, tappable surface) next to a display card (.stat-card, page surface)', html: '<div class="dashboard-grid"><div class="stat-card clickable"><div class="label">Total time</div><div class="value">12h 30m</div></div><div class="stat-card"><div class="label">Current practise streak</div><div class="value">5 <span class="sess-count">days</span></div></div></div>', measure: '.dashboard-grid, .stat-card.clickable, .stat-card:not(.clickable)' },
                    { label: 'Home Progress grid: one .dashboard-grid for all four cards, so both rows are the same height (grid-auto-rows: 1fr) and the gap is --space-3 both ways, the same as .tool-icon-row', html: '<div class="dashboard-grid"><button type="button" class="stat-card clickable"><span class="label">Total time</span><span class="value">711h 55m</span></button><button type="button" class="stat-card clickable"><span class="label">Total sessions</span><span class="value">883</span></button><button type="button" class="stat-card clickable"><span class="label">Current practise streak</span><span class="value">0 days</span></button><button type="button" class="stat-card clickable"><span class="label">Current playing streak</span><span class="value">0 days</span></button></div>', measure: '.dashboard-grid' },
                    { label: 'Admin stat tile (.admin-stat-tile)', wide: true, html: '<div class="admin-stat-tiles"><div class="admin-stat-tile"><div class="admin-stat-tile-label">Active accounts</div><div class="admin-stat-tile-value">42</div><div class="admin-stat-tile-sub">+3 this week</div></div></div>', measure: '.admin-stat-tile' },
                ] },
                { spec: 'list-row', title: 'List rows', examples: [
                    { label: 'Display rows (session history): page surface, only the ⋮ menu is tappable', html: '<div><div class="history-item" style="border-left-color: var(--cat-practise)"><div class="history-details"><strong style="color: var(--cat-practise)">Practise</strong> 3 Sep 2026 | 25 mins</div><button type="button" class="list-item-menu-btn" aria-label="Options" aria-haspopup="menu" aria-expanded="false"><span class="material-symbols-outlined">more_vert</span></button></div><div class="history-item" style="border-left-color: var(--cat-lesson)"><div class="history-details"><strong style="color: var(--cat-lesson)">Lesson</strong> 1 Sep 2026 | 45 mins</div><button type="button" class="list-item-menu-btn" aria-label="Options" aria-haspopup="menu" aria-expanded="false"><span class="material-symbols-outlined">more_vert</span></button></div></div>', measure: '.history-item' },
                    { label: 'Tappable rows (.history-item.clickable - Flow library, saved setups, Quick-play history; or a <button> row - challenges)', html: '<div><div class="history-item clickable"><div class="history-details"><strong>Clarinet Concerto</strong><span class="text-muted">32 bars · Personal</span></div><button type="button" class="list-item-menu-btn" aria-label="Options" aria-haspopup="menu" aria-expanded="false"><span class="material-symbols-outlined">more_vert</span></button></div><button type="button" class="history-item" style="border-left-color: var(--cat-practise)"><div class="history-details"><strong>30-day scales challenge</strong><span class="text-muted">12 of 30 days</span></div></button></div>', measure: '.history-item.clickable, button.history-item' },
                    { label: 'Draggable row with handle', html: '<div class="draggable-item"><span class="drag-handle material-symbols-outlined">drag_indicator</span><div class="history-item"><div class="history-details"><strong>Long tones</strong></div></div></div>', measure: '.drag-handle' },
                ] },
                { spec: 'pill-badge', title: 'Pills and badges', examples: [
                    { label: 'Neutral tag, unread count, accent count', html: '<div class="flex-row gap-md"><span class="flow-pill">Band</span><span class="notif-count">3</span><span class="admin-design-relative admin-design-badge-host"><span class="filter-strip-badge">2</span></span><span class="metroSeg-count-badge">4 bars</span></div>', measure: '.flow-pill, .notif-count, .metroSeg-count-badge' },
                    { label: 'Admin status badges (.admin-badge)', wide: true, html: '<div class="flex-row gap-sm"><span class="admin-badge pass">Pass</span><span class="admin-badge fail">Fail</span><span class="admin-badge skipped">Skipped</span><span class="admin-badge never">Never run</span><span class="admin-chip">flows</span></div>', measure: '.admin-badge.pass, .admin-chip' },
                    { label: 'Admin feedback / notification status chips', wide: true, html: '<div class="flex-row gap-sm"><span class="admin-feedback-badge status-under_review">Under review</span><span class="admin-feedback-badge status-planned">Planned</span><span class="admin-feedback-badge status-in_progress">In progress</span><span class="admin-feedback-badge status-not_progressing">Not progressing</span><span class="admin-feedback-badge status-resolved">Resolved</span><span class="admin-feedback-badge cat">Bug</span></div>', measure: '.status-under_review' },
                ] },
                { spec: 'charts', title: 'Charts', examples: [
                    { label: 'Section title (.section-title)', html: '<div class="section-title">Daily time</div>' },
                    { label: 'Heatmap cells, intensity 0-4, and legend', html: `<div><div class="heatmap-container">${[[0, 1, 2, 0, 3, 4, 1], [2, 0, 1, 4, 3, 2, 0], [1, 1, 0, 2, 4, 3, 2], [0, 3, 2, 1, 0, 1, 4]].map(heatCol).join('')}</div><div class="heatmap-legend">Less <div class="heat-cell h-time-0"></div><div class="heat-cell h-time-1"></div><div class="heat-cell h-time-2"></div><div class="heat-cell h-time-3"></div><div class="heat-cell h-time-4"></div> More</div></div>`, measure: '.heatmap-container, .heat-cell, .heatmap-legend' },
                    { label: 'Bar colours: hours / days / sessions / streak (all gold, ML-235) / category (only for a chart split by session type)', html: `<div class="admin-design-bars">${[['--chart-hours', 70], ['--chart-days', 45], ['--chart-sessions', 85], ['--chart-streak', 60], ['--cat-rehearsal', 30], ['--cat-performance', 55]].map(([t, h]) => `<div class="chart-bar" style="height:${h}%; background: var(${t})"></div>`).join('')}</div>`, measure: '.chart-bar' },
                    { label: 'Projected month (ML-186), with its Actual / Projected key (.chart-legend): the current month\'s hollow outline bar (.chart-bar-projection, border in the chart\'s own colour) stacked on the real bar (.chart-bar-under-projection) - "at this rate" by month end', html: `<div class="admin-design-bars">${[70, 85, 60].map(h => `<div class="chart-bar" style="height:${h}%; background: var(--chart-hours)"></div>`).join('')}<div class="chart-bar-container" style="height:100%; min-width:0; width: var(--space-7); margin:0; cursor:default"><div class="chart-bar-projection" style="height:30%; border-color: var(--chart-hours)"></div><div class="chart-bar chart-bar-under-projection" style="height:45%; background: var(--chart-hours)"></div></div></div><div class="chart-legend"><span class="chart-legend-item"><span class="chart-legend-swatch" style="background: var(--chart-hours);"></span>Actual</span><span class="chart-legend-item"><span class="chart-legend-swatch chart-legend-swatch-projected" style="border-color: var(--chart-hours);"></span>Projected</span></div>`, measure: '.chart-bar-projection, .chart-legend, .chart-legend-swatch-projected' },
                ] },
            ],
        },
        {
            title: 'Feedback and overlays',
            items: [
                { spec: 'modal', title: 'Modal', examples: [
                    { label: 'Destructive confirmation (shown in place, not over the page)', html: '<div class="admin-design-static"><div class="modal" role="dialog" aria-modal="true" aria-label="Delete session? (example)"><div class="modal-content"><button class="modal-close-x" type="button" aria-label="Close">✕</button><h2>Delete session?</h2><p>This can\'t be undone.</p><div class="flex-row gap-md"><button class="btn-nav btn-cancel" type="button">Cancel</button><button class="btn-submit" type="button" style="background: var(--danger-color)">Delete</button></div></div></div></div>', measure: '.modal, .modal-content, .modal-content h2' },
                ] },
                { spec: 'toast', title: 'Toasts', examples: [
                    { label: 'Success / undo / warning / info', html: '<div class="admin-design-static flex-col gap-md"><div class="toast success" role="status">Session saved</div><div class="toast undo" role="status">Session deleted <button type="button">Undo</button></div><div class="toast warning" role="status">Pick a category first</div><div class="toast info" role="status">Update available <button type="button">X</button></div></div>', measure: '.toast.success, .toast.warning, .toast.info, .toast button' },
                ] },
                { spec: 'anchored-popup', title: 'Anchored popup', examples: [
                    { label: 'Tapped chart bar / heatmap cell', html: '<div class="admin-design-static"><div class="anchored-popup">Tue 4 Sep · 2 sessions</div></div>', measure: '.anchored-popup' },
                ] },
                { spec: 'notification-centre', title: 'Notification centre', examples: [
                    { label: 'Unread item, read item, update-available card', html: '<div><button class="notification-item unread" type="button"><div class="notification-head"><span class="notification-unread-dot"></span><strong>New: Flow import</strong></div><div class="notification-date">23 Sep 2026</div><p class="notification-body">You can now import a Flow straight from a MusicXML file.</p></button><button class="notification-item" type="button"><div class="notification-head"><strong>Welcome to The Music Ledger</strong></div><div class="notification-date">1 Sep 2026</div></button><div class="notification-item notification-update"><div class="notification-head"><strong>Update available</strong></div><p class="notification-body">Reload to get the latest version.</p><button class="btn-submit" type="button">Reload</button></div></div>', measure: '.notification-item.unread, .notification-head, .notification-unread-dot' },
                ] },
            ],
        },
        {
            title: 'System specific',
            note: 'One-off visuals that belong to a single tool rather than the shared component set.',
            items: [
                { spec: 'metronome', title: 'Metronome', examples: [
                    { label: 'Beat dots: accent (downbeat), plain, lit (current beat), accent + lit', html: `<div class="metro-display"><div class="metro-display-viewport admin-design-dots">${tier(dot('metro-dot-note accent', 8) + dot('metro-dot-note', 36) + dot('metro-dot-note lit', 64) + dot('metro-dot-note accent lit', 92))}${tier(dot('metro-dot-sub', 22) + dot('metro-dot-sub lit', 50) + dot('metro-dot-sub', 78))}</div></div>`, measure: '.metro-dot-note.accent, .metro-dot-note.lit, .metro-dot-sub' },
                    { label: 'Fermata glow: holding (pulsing, with beats-left count) and done (static gold)', html: `<div class="metro-display"><div class="metro-display-viewport admin-design-dots">${tier(dot('metro-dot-note', 10) + dot('metro-dot-note fermata-holding', 40, '<span class="metro-dot-count">3</span>') + dot('metro-dot-note fermata-done', 70))}</div></div>`, measure: '.fermata-holding, .fermata-done' },
                    { label: 'Value boxes (.metroBlk-ctrl-value-btn) - Flow tile look, no dropdown caret (ML-205)', html: '<div class="flex-row gap-md"><button class="metroBlk-ctrl-value-btn" type="button" aria-haspopup="dialog" aria-expanded="false"><strong>0</strong><span class="metroBlk-ctrl-value-label">sub beats</span></button><button class="metroBlk-ctrl-value-btn" type="button" aria-haspopup="dialog" aria-expanded="false"><strong>100%</strong><span class="metroBlk-ctrl-value-label">play speed</span></button><button class="metroBlk-ctrl-value-btn" type="button" aria-haspopup="dialog" aria-expanded="false"><strong>4/4</strong><span class="metroBlk-ctrl-value-label">time</span></button></div>', measure: '.flex-row, .metroBlk-ctrl-value-btn, .metroBlk-ctrl-value-label' },
                    { label: 'Transport, tempo stepper and speed controls', html: '<div class="flex-col gap-md"><div class="metro-transport-row"><button class="metro-transport-btn metro-play-btn" type="button" aria-label="Play"><span class="material-symbols-outlined">play_arrow</span></button><button class="metro-transport-btn metro-stop-btn" type="button" aria-label="Stop"><span class="material-symbols-outlined">stop</span></button><button class="metro-transport-btn metro-play-btn" type="button" aria-label="Play (disabled)" disabled><span class="material-symbols-outlined">play_arrow</span></button></div></div>', measure: '.metro-transport-row, .metro-transport-btn[disabled]' },
                    { label: 'Mini bar (docked under the top bar while running elsewhere)', html: '<div class="metro-mini-bar"><div class="metro-mini-controls"><button class="metro-mini-ctrl-btn" type="button"><strong>100</strong><span class="metro-mini-ctrl-unit">bpm</span></button><button class="metro-mini-ctrl-btn" type="button"><strong>4/4</strong><span class="metro-mini-ctrl-unit">time</span></button><button class="metro-mini-ctrl-btn" type="button" aria-label="Stop"><span class="material-symbols-outlined">stop</span></button></div></div>', measure: '.metro-mini-bar, .metro-mini-ctrl-btn' },
                ] },
                { spec: 'tuner', title: 'Tuner', examples: [
                    { label: 'Card states: idle / out of tune (gold) / in tune (green wash)', html: ['', 'out-of-tune', 'in-tune'].map((s, i) => `<div class="tuner-card ${s}"><div class="tuner-note-row"><span class="tuner-note">${['–', 'A', 'A'][i]}</span><span class="tuner-note-octave">${['', '4', '4'][i]}</span></div><div class="tuner-bar-wrap"><div class="tuner-bar-track"><div class="tuner-bar-zone"></div><div class="tuner-bar-center-mark"></div><div class="tuner-bar-needle ${s === 'in-tune' ? 'in-tune' : ''}" style="left:${[50, 22, 52][i]}%"></div></div><div class="tuner-bar-scale"><span>-50</span><span>0</span><span>+50</span></div></div><div class="tuner-status">${['Play a note', 'Too flat', 'In tune'][i]}</div></div>`).join(''), measure: '.tuner-card.in-tune, .tuner-note, .tuner-bar-track, .tuner-bar-needle.in-tune' },
                ] },
                { spec: 'notation', title: 'Notation (Bravura)', examples: notationExamples },
                { spec: 'theory-quiz', title: 'Theory quiz', examples: [
                    { label: 'Quiz list row (.theory-quiz-row on a clickable list row): Bravura icon, title, last grade', html: `<div><p class="theory-intro">Short quizzes to learn music theory.</p><button type="button" class="history-item clickable theory-quiz-row"><span class="theory-quiz-icon">${NT ? nScale(NT.symbol('noteheadWhole'), 0.8) : ''}</span><span class="history-details"><strong>Note names</strong>Last grade 4 · yesterday</span>${theoryGrade(4)}</button><button type="button" class="history-item clickable theory-quiz-row"><span class="theory-quiz-icon">${NT ? nScale(NT.symbol('segno'), 0.8) : ''}</span><span class="history-details"><strong>Symbol meanings</strong>Not tried yet</span></button></div>`, measure: '.theory-quiz-row, .theory-quiz-icon, .theory-grade-dot-on' },
                    { label: 'Question: clock and tally, countdown, staff, a wrong answer (tapped: red + cross; right one: green + tick; "Not quite" line), 7 note buttons 4 across', html: `<div><div class="theory-status"><span>0:42</span><span>14 right · 1 wrong</span></div><div class="theory-countdown"><div class="theory-countdown-fill" style="transform: scaleX(0.7)"></div></div><p class="theory-question">Which note is this?</p><div class="theory-prompt">${NT ? nScale(NT.staff({ clef: 'treble', items: [{ type: 'note', pitch: 'A5' }], stepRange: [-5, 13] }), 1.6) : ''}</div><p class="theory-feedback">Not quite: it's A</p><div class="theory-answers theory-answers-notes">${['C', 'D', 'E', 'F'].map(n => theoryAnswer(n)).join('')}${theoryAnswer('G', 'wrong')}${theoryAnswer('A', 'right')}${theoryAnswer('B')}</div></div>`, measure: '.theory-status, .theory-countdown-fill, .theory-question, .theory-feedback, .theory-answer, .theory-answer-right, .theory-answer-wrong' },
                    { label: 'Symbol answers (.theory-answers-symbols): each button draws its symbol and is named by it', html: `<div><p class="theory-meaning">Go back to the sign</p><div class="theory-answers theory-answers-symbols">${NT ? ['segno', 'coda', 'dalSegno', 'daCapo'].map(g => `<button type="button" class="theory-answer" aria-label="${g}">${NT.symbol(g)}</button>`).join('') : ''}</div></div>`, measure: '.theory-meaning, .theory-answers-symbols .theory-answer' },
                    { label: 'Results: large grade, best line, trend of the last rounds (8 fixed slots, stats bar-chart pieces)', html: `<div><p class="theory-results-options">Note names · Treble · 2 ledger lines · None · 60 s</p><div class="theory-grade-block">${theoryGrade(4, true)}<p class="theory-best-line">Grade 4 of 5 · new personal best (was 72)</p></div><div class="theory-trend"><div class="theory-trend-bars">${[45, 52, 60, 58, 72, 80].map((s, i, a) => `<div class="chart-bar-container"><div class="chart-bar" style="height:${s}%; background: var(--chart-hours);"></div><span class="chart-x-label">${i === a.length - 1 ? 'Now' : s}</span></div>`).join('')}</div></div></div>`, measure: '.theory-grade-lg .theory-grade-dot, .theory-best-line, .theory-trend-bars' },
                ] },
                { spec: 'flow-editor', title: 'Flow editor', examples: [
                    { label: 'Featured blocks card (.flow-blocks-card) with a pill and help text', html: '<div class="flow-card flow-blocks-card"><div class="flow-card-header"><span class="flow-card-label">Blocks</span><span class="flow-pill">4 blocks</span></div><span class="flow-help-text">Drag a block to reorder it.</span></div>', measure: '.flow-blocks-card, .flow-help-text' },
                    { label: 'Media icons: audio, YouTube, document', html: '<div class="flex-row gap-md"><span class="flow-media-icon type-audio material-symbols-outlined">music_note</span><span class="flow-media-icon type-youtube material-symbols-outlined">smart_display</span><span class="flow-doc-icon">PDF</span></div>', measure: '.flow-media-icon.type-audio, .flow-doc-icon' },
                    { label: 'Flow action buttons (.flow-action-btn) - icon + label tiles used only inside the Flow editor', html: '<div class="flex-col"><div class="flow-action-row"><button class="flow-action-btn" type="button"><span class="material-symbols-outlined">edit</span> Edit details</button><button class="flow-action-btn" type="button"><span class="material-symbols-outlined">ios_share</span> Export</button></div><button class="flow-action-btn flow-action-btn-wide" type="button"><span class="material-symbols-outlined">upload</span> Upload mp3 / mp4 audio</button></div>', measure: '.flow-action-row, .flow-action-btn' },
                    { label: 'Bars tab toolbar (.flow-bars-toolbar): summary + 1 / 2 / 4-column switch (.flow-layout-toggle, .flow-layout-btn[aria-pressed]) - ML-206, ML-208', html: '<div class="flow-bars-toolbar"><span class="flow-studio-summary">24 bars &bull; ~1m 10s total</span><div class="flow-layout-toggle" role="group" aria-label="Bar layout"><button type="button" class="flow-layout-btn" aria-pressed="false" aria-label="1 column">' + layoutIcon1 + '</button><button type="button" class="flow-layout-btn" aria-pressed="true" aria-label="2 columns">' + layoutIcon2 + '</button><button type="button" class="flow-layout-btn" aria-pressed="false" aria-label="4 columns">' + layoutIcon4 + '</button></div></div>', measure: '.flow-layout-toggle, .flow-layout-btn[aria-pressed="true"]' },
                    { label: '2-column layout (.flow-bar-grid-2, .flow-bar-detail-tile) - ML-208: fixed header, a middle that never stretches and an always-present strip, so headers, time signatures and dividers line up across a row. Second tile needs updating (.flow-bar-detail-tile-warning): mark + range only, large Update, blank strip', html: '<div class="flow-bar-grid-2"><button type="button" class="flow-bar-grid-tile flow-bar-detail-tile"><span class="flow-bar-detail-head"><span class="flow-bar-detail-sign"><span class="flow-sign-svg-inline">𝄋</span></span><span class="flow-bar-detail-mark">A</span><span class="flow-bar-detail-name">Bars 1–8</span></span><span class="flow-bar-detail-mid"><span class="flow-bar-detail-edge"><svg viewBox="0 0 32 56" class="flow-bar-detail-barline"><line x1="10" y1="6" x2="10" y2="50" stroke="currentColor" stroke-width="5"/><line x1="18" y1="6" x2="18" y2="50" stroke="currentColor" stroke-width="2"/><circle cx="26" cy="20" r="2.4" fill="currentColor"/><circle cx="26" cy="36" r="2.4" fill="currentColor"/></svg></span><span class="flow-bar-detail-meter"><span class="flow-bar-detail-time">4/4</span><span class="flow-bar-detail-bpm">100 bpm</span></span><span class="flow-bar-detail-edge"><svg viewBox="0 0 32 56" class="flow-bar-detail-barline"><circle cx="6" cy="20" r="2.4" fill="currentColor"/><circle cx="6" cy="36" r="2.4" fill="currentColor"/><line x1="14" y1="6" x2="14" y2="50" stroke="currentColor" stroke-width="2"/><line x1="22" y1="6" x2="22" y2="50" stroke="currentColor" stroke-width="5"/></svg><span class="flow-bar-detail-count">3x</span></span></span><span class="flow-bar-detail-strip"><span class="flow-volta-bracket"><span class="flow-volta-bracket-numbers">1.</span></span><span class="flow-bar-detail-chip"><span class="flow-sign-svg-inline">𝄐</span><span class="flow-bar-detail-times">×2</span></span><span class="flow-bar-detail-chip">rit.<svg viewBox="0 0 24 24" class="flow-bar-detail-ramp" fill="none"><path d="M4 6L18 18" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/><path d="M10 18H18V10" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg></span></span></button><button type="button" class="flow-bar-grid-tile flow-bar-detail-tile flow-bar-detail-tile-warning"><span class="flow-bar-detail-head"><span class="flow-bar-detail-mark">B</span><span class="flow-bar-detail-name">Bars 9–12</span></span><span class="flow-bar-detail-mid flow-bar-detail-mid-warning"><svg viewBox="0 0 24 24" class="flow-bar-detail-warning-icon" fill="none"><path d="M12 4L22 20H2L12 4Z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><line x1="12" y1="10" x2="12" y2="15" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><circle cx="12" cy="18" r="1.2" fill="currentColor"/></svg><span class="flow-bar-detail-warning-text">Update</span></span><span class="flow-bar-detail-strip"></span></button><button type="button" class="flow-bar-grid-tile flow-bar-detail-tile"><span class="flow-bar-detail-head"><span class="flow-bar-detail-name">Bars 13–16</span></span><span class="flow-bar-detail-mid"><span class="flow-bar-detail-edge"><svg viewBox="0 0 32 56" class="flow-bar-detail-barline"><line x1="16" y1="6" x2="16" y2="50" stroke="var(--label-color)" stroke-width="3" stroke-linecap="round"/></svg></span><span class="flow-bar-detail-meter"><span class="flow-bar-detail-time">3/4</span><span class="flow-bar-detail-bpm">120 bpm</span></span><span class="flow-bar-detail-edge"><svg viewBox="0 0 32 56" class="flow-bar-detail-barline"><line x1="16" y1="6" x2="16" y2="50" stroke="var(--label-color)" stroke-width="3" stroke-linecap="round"/></svg></span></span><span class="flow-bar-detail-strip"></span></button></div>', measure: '.flow-bar-detail-head, .flow-bar-detail-time, .flow-bar-detail-strip, .flow-bar-detail-tile-warning' },
                    { label: 'Play Flow, 2 columns (ML-209): the same tile, with its own 1 / 2 / 4-column switch (.flow-play-layout-bar). Tap jumps playback to the bar; the bar sounding has the Play gold edge (.flow-bar-detail-tile.metroBlk-tile-active)', html: '<div><div class="flow-bars-toolbar flow-play-layout-bar"><div class="flow-layout-toggle" role="group" aria-label="Bar layout"><button type="button" class="flow-layout-btn" aria-pressed="false" aria-label="1 column">' + layoutIcon1 + '</button><button type="button" class="flow-layout-btn" aria-pressed="true" aria-label="2 columns">' + layoutIcon2 + '</button><button type="button" class="flow-layout-btn" aria-pressed="false" aria-label="4 columns">' + layoutIcon4 + '</button></div></div><div class="flow-bar-grid-2"><button type="button" class="flow-bar-detail-tile"><span class="flow-bar-detail-head"><span class="flow-bar-detail-name">Bars 1–8</span></span><span class="flow-bar-detail-mid"><span class="flow-bar-detail-edge"><svg viewBox="0 0 32 56" class="flow-bar-detail-barline"><line x1="16" y1="6" x2="16" y2="50" stroke="var(--label-color)" stroke-width="3" stroke-linecap="round"/></svg></span><span class="flow-bar-detail-meter"><span class="flow-bar-detail-time">4/4</span><span class="flow-bar-detail-bpm">100 bpm</span></span><span class="flow-bar-detail-edge"><svg viewBox="0 0 32 56" class="flow-bar-detail-barline"><line x1="16" y1="6" x2="16" y2="50" stroke="var(--label-color)" stroke-width="3" stroke-linecap="round"/></svg></span></span><span class="flow-bar-detail-strip"></span></button><button type="button" class="flow-bar-detail-tile metroBlk-tile-active" aria-current="true"><span class="flow-bar-detail-head"><span class="flow-bar-detail-name">Bars 9–12</span></span><span class="flow-bar-detail-mid"><span class="flow-bar-detail-edge"><svg viewBox="0 0 32 56" class="flow-bar-detail-barline"><line x1="16" y1="6" x2="16" y2="50" stroke="var(--label-color)" stroke-width="3" stroke-linecap="round"/></svg></span><span class="flow-bar-detail-meter"><span class="flow-bar-detail-time">3/4</span><span class="flow-bar-detail-bpm">120 bpm</span></span><span class="flow-bar-detail-edge"><svg viewBox="0 0 32 56" class="flow-bar-detail-barline"><line x1="16" y1="6" x2="16" y2="50" stroke="var(--label-color)" stroke-width="3" stroke-linecap="round"/></svg></span></span><span class="flow-bar-detail-strip"></span></button></div></div>', measure: '.flow-play-layout-bar, .flow-bar-detail-tile.metroBlk-tile-active' },
                    { label: 'Play Flow, 1 column (ML-207, .flow-bar-list-1 / .flow-bar-full-tile): read-only, all 12 settings where they sit on a score - top of the bar: sign left, pauses centre, alternate ending + jump right; the bar: barlines, time signature, beat unit = bpm; under the bar: intro, ramps. Shown playing (gold edge)', wide: true, html: '<div class="flow-bar-list-1"><button type="button" class="flow-bar-full-tile metroBlk-tile-active" aria-current="true"><span class="flow-bar-full-head"><span class="flow-bar-detail-mark">A</span><span class="flow-bar-detail-name">Bars 1–8</span><span class="flow-bar-full-bars">8 bars</span></span><span class="flow-bar-full-row flow-bar-full-top"><span class="flow-bar-full-zone"><span class="flow-bar-full-sign"><span class="flow-sign-svg-inline">𝄋</span></span></span><span class="flow-bar-full-zone flow-bar-full-zone-mid"><span class="flow-bar-detail-chip"><span class="flow-sign-svg-inline">𝄐</span><span class="flow-bar-detail-times">×2</span></span></span><span class="flow-bar-full-zone flow-bar-full-zone-end"><span class="flow-volta-bracket"><span class="flow-volta-bracket-numbers">1.</span></span><span class="flow-bar-detail-chip">D.S.</span></span></span><span class="flow-bar-full-mid"><span class="flow-bar-detail-edge"><svg viewBox="0 0 32 56" class="flow-bar-detail-barline"><line x1="10" y1="6" x2="10" y2="50" stroke="currentColor" stroke-width="5"/><line x1="18" y1="6" x2="18" y2="50" stroke="currentColor" stroke-width="2"/><circle cx="26" cy="20" r="2.4" fill="currentColor"/><circle cx="26" cy="36" r="2.4" fill="currentColor"/></svg></span><span class="flow-bar-full-meter"><span class="flow-bar-full-time">4/4</span><span class="flow-bar-full-tempo"><span class="flow-bar-full-note" role="img" aria-label="Crotchet"><svg viewBox="0 0 32 56" class="metroBlk-note-svg"><ellipse cx="13" cy="44" rx="7.5" ry="5.2" transform="rotate(-20 13 44)" fill="currentColor"/><rect x="19" y="6" width="2.6" height="38" fill="currentColor"/></svg></span><span class="flow-bar-full-eq">=</span><span class="flow-bar-full-bpm">100</span><span class="flow-bar-full-unit">bpm</span></span></span><span class="flow-bar-detail-edge flow-bar-full-edge-end"><svg viewBox="0 0 32 56" class="flow-bar-detail-barline"><circle cx="6" cy="20" r="2.4" fill="currentColor"/><circle cx="6" cy="36" r="2.4" fill="currentColor"/><line x1="14" y1="6" x2="14" y2="50" stroke="currentColor" stroke-width="2"/><line x1="22" y1="6" x2="22" y2="50" stroke="currentColor" stroke-width="5"/></svg><span class="flow-bar-full-count">3x</span></span></span><span class="flow-bar-full-row flow-bar-full-bottom"><span class="flow-intro-bracket"><span class="flow-intro-bracket-text">Intro 1–2</span></span><span class="flow-bar-detail-chip">rit.<svg viewBox="0 0 24 24" class="flow-bar-detail-ramp" fill="none"><path d="M4 6L18 18" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/><path d="M10 18H18V10" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg></span></span></button></div>', measure: '.flow-bar-full-head, .flow-bar-full-top, .flow-bar-full-time, .flow-bar-full-bpm, .flow-bar-full-bottom' },
                    { label: 'Consistency review (ML-248, #flowCheckModal): problems grouped "Won\'t play as written" / "Worth checking" (.flow-check-group-title, .flow-check-list, .flow-check-item - tap one to go to its bar), and a bar outlined because of one (.flow-block-has-issue)', html: '<div class="flex-col gap-md"><div><h3 class="flow-check-group-title">Won\'t play as written</h3><ul class="flow-check-list"><li><button type="button" class="flow-check-item">Bars 9–12 says D.S. (back to the sign), but there\'s no segno sign anywhere.</button></li></ul><h3 class="flow-check-group-title">Worth checking</h3><ul class="flow-check-list"><li><button type="button" class="flow-check-item">Bar 13 never plays - check the repeats, endings, jumps and final barline around it.</button></li></ul></div><div class="metroBlk-tile-strip"><button type="button" class="metroBlk-tile flow-bar-grid-tile"><div class="metroBlk-tile-sig">1</div><div class="metroBlk-tile-bpm">120 bpm</div><div class="metroBlk-tile-bars">8 bars</div></button><button type="button" class="metroBlk-tile flow-bar-grid-tile flow-block-has-issue"><div class="metroBlk-tile-sig">9</div><div class="metroBlk-tile-bpm">120 bpm</div><div class="metroBlk-tile-bars">4 bars</div></button></div></div>', measure: '.flow-check-item, .flow-check-group-title, .flow-block-has-issue' },
                    { label: '4-column layout: each bar is the Play Flow tile as a <button> (.flow-bar-grid-tile); the second is held mid-drag (.flow-bar-grid-tile-held)', html: '<div class="metroBlk-tile-strip">' + barTile('<div class="metroBlk-tile-mark-box">A</div>', 100, 8) + barTile('<div class="metroBlk-tile-sig">9</div>', 120, 8).replace('flow-bar-grid-tile"', 'flow-bar-grid-tile flow-bar-grid-tile-held"') + barTile('<div class="metroBlk-tile-mark-box">B</div>', 120, 4) + barTile('<div class="metroBlk-tile-sig">21</div>', 90, 2) + '</div>', measure: '.flow-bar-grid-tile, .flow-bar-grid-tile-held' },
                    { label: 'Bar popup header (.flow-bar-popup-header) and actions (.flow-bar-popup-actions / .flow-bar-popup-action): first bar, so ‹ and Move earlier show the disabled style (no fill, --input-border, --label-color text)', html: '<div class="flow-bar-popup"><div class="flow-bar-popup-header"><button type="button" class="flow-bar-popup-icon-btn" aria-label="Previous bar" disabled><span class="material-symbols-outlined">chevron_left</span></button><button type="button" class="flow-block-mark-box">A</button><div class="flow-bar-popup-title"><span class="flow-block-name">Bars 1–8</span><span class="flow-bar-popup-pos">1 of 6</span></div><button type="button" class="flow-bar-popup-icon-btn" aria-label="Next bar"><span class="material-symbols-outlined">chevron_right</span></button><button type="button" class="flow-bar-popup-icon-btn flow-bar-popup-close" aria-label="Close"><span class="material-symbols-outlined">close</span></button></div><div class="flow-tile-grid flow-tile-grid-3-centered flow-bar-popup-actions"><button type="button" class="flow-bar-popup-action" disabled>Move earlier</button><button type="button" class="flow-bar-popup-action">Duplicate</button><button type="button" class="flow-bar-popup-action">Move later</button></div><button type="button" class="btn-text btn-text-danger flow-bar-popup-delete">Delete this bar</button></div>', measure: '.flow-bar-popup-header, .flow-bar-popup-pos, .flow-bar-popup-action, .flow-bar-popup-action:disabled' },
                    { label: 'Warning tile (.flow-tile-warning)', html: '<div class="flow-tile-grid" style="grid-template-columns: repeat(3, 1fr)"><div class="flow-tile">Bar 1</div><div class="flow-tile flow-tile-warning">Bar 2</div><div class="flow-tile">Bar 3</div></div>', measure: '.flow-tile-warning' },
                ] },
                { spec: 'splash-screen', title: 'Splash screen', examples: [
                    { label: 'Login splash (always dark, in either theme)', html: '<div class="admin-design-static"><div class="splash-screen"><div class="splash-content"><h1 class="splash-title">The Music Ledger</h1><p class="splash-subtitle">Track your practice</p><button class="splash-login-btn" type="button">Sign in with Google</button></div></div></div>', measure: '.splash-title, .splash-login-btn' },
                ] },
                { spec: 'admin-shell', title: 'Admin panel', examples: [
                    { label: 'Phone-width menu head row (.admin-sidebar-head, .admin-sidebar-current, .admin-nav-toggle) - 700px and below; the ☰ opens the section list (.admin-nav-items)', wide: true, html: '<div class="admin-design-static"><div class="admin-sidebar-head" style="display: flex; align-items: center; justify-content: space-between;"><div class="admin-sidebar-title" style="padding: 0;">Admin<span class="admin-sidebar-current" style="display: inline;">Features</span></div><button type="button" class="admin-nav-toggle" style="display: flex;" aria-expanded="false" aria-label="Show admin sections"><span class="material-symbols-outlined" aria-hidden="true">menu</span></button></div></div>', measure: '.admin-nav-toggle, .admin-sidebar-current' },
                    { label: 'Data table (.admin-stat-table)', wide: true, html: '<div class="admin-stat-table-wrap"><table class="admin-stat-table"><thead><tr><th>Account</th><th>Sessions</th><th>Minutes</th></tr></thead><tbody><tr><td>Andrew</td><td>24</td><td>610</td></tr><tr class="admin-stat-row-excluded"><td>Test account</td><td>3</td><td>45</td></tr></tbody></table></div>', measure: '.admin-stat-table th, .admin-stat-table td' },
                    { label: 'Intro text and link', wide: true, html: '<div><p class="admin-intro">Each release runs the back-test suite against the dev branch.</p><a class="admin-link">View test cases →</a></div>', measure: '.admin-intro, .admin-link' },
                    { label: 'Status badges (.admin-badge pass / warn / fail / info / never)', html: '<div class="flex-row gap-sm"><span class="admin-badge pass">Pass</span><span class="admin-badge warn">Warn</span><span class="admin-badge fail">Fail</span><span class="admin-badge info">Info</span><span class="admin-badge never">Not run</span></div>', measure: '.admin-badge.warn, .admin-badge.info' },
                    { label: 'Security check row with evidence disclosure (.admin-security-head, .admin-security-details, .admin-security-evidence)', wide: true, html: '<div class="admin-feature"><div class="admin-test-case"><div class="admin-security-head"><div class="admin-test-case-title">Container hardening rules</div><span class="admin-badge warn">Warn</span></div><div class="admin-test-case-meta">Automated · 23/09/2026 · upstream a6325864</div><p class="admin-run-notes">6 of 9 rules not met</p><details class="admin-security-details" open><summary>Evidence and how to re-run</summary><ul class="admin-security-evidence"><li>OK - Runs as a non-root user: USER omr</li><li>WARN - All Linux capabilities dropped: no cap_drop</li></ul></details></div></div>', measure: '.admin-security-details summary, .admin-security-evidence' },
                    { label: 'Toolbar with a run button (.admin-security-toolbar)', wide: true, html: '<div class="admin-security-toolbar"><button class="btn-submit no-margin" type="button">Run automated checks now</button><span class="admin-test-case-meta">Done - results updated below.</span></div>', measure: '.admin-security-toolbar .btn-submit' },
                ] },
            ],
        },
        {
            title: 'Utilities and states',
            items: [
                { spec: 'utilities-and-states', title: 'Utilities and state modifiers', examples: [
                    { label: '.flex-row + .gap-sm / .gap-md, .text-muted', html: '<div class="flex-col gap-md"><div class="flex-row gap-sm"><span class="flow-pill">gap-sm</span><span class="flow-pill">gap-sm</span></div><div class="flex-row gap-md"><span class="flow-pill">gap-md</span><span class="flow-pill">gap-md</span></div><span class="text-muted">Muted supporting text</span></div>', measure: '.flex-row.gap-sm, .flex-row.gap-md, .text-muted' },
                    { label: 'The same component in different states: .selected, .active, .lit, .unread', html: '<div class="flex-col gap-md"><div class="flex-row gap-sm"><button class="flow-picker-tile" type="button"><strong>Default</strong></button><button class="flow-picker-tile selected" type="button"><strong>.selected</strong></button></div><div class="flex-row gap-sm"><button class="filter-pill" type="button">Default</button><button class="filter-pill active" type="button">.active</button></div></div>' },
                ] },
            ],
        },
    ];

    // ------------------------------------------------------------------ token parsing / reverse lookup

    let TOKENS = null; // [{ group, rows: [{ name, comment }] }]
    const probe = document.createElement('span');

    async function loadTokens() {
        const text = await (await fetch('tokens.css', { cache: 'no-store' })).text();
        const root = text.slice(text.indexOf(':root {'), text.indexOf('body.dark-mode {'));
        const l2 = root.slice(root.indexOf('LAYER 2'));
        const groups = [];
        let current = null;
        for (const line of l2.split('\n')) {
            const h = line.match(/^\s*\/\*\s*([A-Z][^*]*?)\s*\*\/\s*$/);
            if (h && !/LAYER/.test(h[1])) { current = { group: h[1].replace(/ - .*/, ''), rows: [] }; groups.push(current); continue; }
            const m = line.match(/^\s*(--[\w-]+)\s*:\s*[^;]+;\s*(?:\/\*\s*(.*?)\s*\*\/)?/);
            if (m && current) current.rows.push({ name: m[1], comment: m[2] || '' });
        }
        return groups;
    }

    // Read from <body>: dark mode remaps the aliases on body.dark-mode, not on :root.
    const tokenValue = (name) => getComputedStyle(document.body).getPropertyValue(name).trim();
    function asColor(v) {
        // A detached element has no computed style - keep the probe in the document (hidden).
        if (!probe.isConnected) { probe.hidden = true; document.body.appendChild(probe); }
        probe.style.color = '';
        probe.style.color = v;
        if (!probe.style.color) return null;
        return getComputedStyle(probe).color;
    }
    const toPx = (v) => { const n = parseFloat(v); return /rem$/.test(v) ? n * 16 : n; };

    // Rebuilt on every render/theme switch - dark mode resolves the same alias to a different value.
    function buildLookup() {
        const all = TOKENS.flatMap(g => g.rows.map(r => r.name));
        const lookup = { color: new Map(), space: new Map(), radius: new Map(), font: new Map(), weight: new Map(), shadow: new Map() };
        const put = (map, key, name) => { if (!map.has(key)) map.set(key, name); };
        for (const name of all) {
            const v = tokenValue(name);
            if (/^--space-/.test(name)) put(lookup.space, toPx(v), name);
            else if (/^--radius-/.test(name) && !/%/.test(v)) put(lookup.radius, toPx(v), name);
            else if (/^--font-(2xs|xs|sm|base|md|lg|xl|2xl|3xl)$/.test(name)) put(lookup.font, Math.round(toPx(v) * 100) / 100, name);
            else if (/^--icon-/.test(name)) put(lookup.font, toPx(v), name);
            else if (/^--font-weight-/.test(name)) put(lookup.weight, String(parseInt(v, 10)), name);
            else if (/^--(shadow|focus)/.test(name)) { probe.style.boxShadow = v; put(lookup.shadow, getComputedStyle(probe).boxShadow, name); probe.style.boxShadow = ''; }
            else { const c = asColor(v); if (c) { if (!lookup.color.has(c)) lookup.color.set(c, []); lookup.color.get(c).push(name); } }
        }
        return lookup;
    }

    // ------------------------------------------------------------------ annotations

    function describe(el, lookup) {
        const cs = getComputedStyle(el);
        const chips = [];
        const len = (px, map, what) => {
            if (px === 0) return null;
            if (Math.abs(px) === 1) return `${px}px nudge`; // deliberate border-overlap nudge (token-audit-ignore'd)
            if (px < 0) { const pos = len(-px, map, what); return pos && !/⚠/.test(pos) ? '-' + pos : `⚠ ${px}px, no ${what} token`; }
            const name = map.get(Math.round(px * 100) / 100) || map.get(px);
            return name ? `${name.replace(/^--/, '')} (${Math.round(px * 10) / 10})` : `⚠ ${Math.round(px * 10) / 10}px, no ${what} token`;
        };
        const sides = (prefix) => ['Top', 'Right', 'Bottom', 'Left'].map(s => parseFloat(cs[prefix + s]) || 0);
        const fourSides = (vals, label) => {
            if (vals.every(v => v === 0)) return;
            const [t, r, b, l] = vals.map(v => len(v, lookup.space, 'spacing') || '0');
            const txt = t === r && r === b && b === l ? t : t === b && r === l ? `${t} / ${r}` : `${t} / ${r} / ${b} / ${l}`;
            chips.push([label, txt, /⚠/.test(txt)]);
        };
        fourSides(sides('padding'), 'padding');
        if (/flex|grid/.test(cs.display)) {
            const g = parseFloat(cs.rowGap) || parseFloat(cs.columnGap) || 0;
            if (g) { const t = len(g, lookup.space, 'spacing'); chips.push(['gap', t, /⚠/.test(t)]); }
        }
        fourSides(sides('margin'), 'margin');
        const rad = parseFloat(cs.borderTopLeftRadius);
        if (rad) {
            const pct = /%/.test(cs.borderTopLeftRadius) || rad >= Math.min(el.offsetWidth, el.offsetHeight) / 2 - 0.5;
            const t = pct ? (rad >= 999 || /%/.test(cs.borderTopLeftRadius) ? 'radius-pill / radius-circle' : len(rad, lookup.radius, 'radius')) : len(rad, lookup.radius, 'radius');
            chips.push(['radius', t, /⚠/.test(t)]);
        }
        // Type only matters where the element itself holds text (not an icon-only button or a dot).
        const hasText = el.matches('input, select, textarea') || [...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim());
        const fs = parseFloat(cs.fontSize);
        const fsName = lookup.font.get(Math.round(fs * 100) / 100);
        if (hasText) chips.push(['font', fsName ? `${fsName.replace(/^--/, '')} (${Math.round(fs * 10) / 10})` : `${Math.round(fs * 10) / 10}px (inherited/relative)`, false]);
        const w = lookup.weight.get(String(parseInt(cs.fontWeight, 10)));
        if (w && cs.fontWeight !== '400') chips.push(['weight', w.replace(/^--/, ''), false]);
        const ROLE = { text: /text|label|color$/, bg: /bg|surface|action$|color$|tint|overlay|highlight/, border: /border|action$|color$/ };
        const colorName = (c, role) => { const names = lookup.color.get(c); if (!names) return null; return names.find(n => ROLE[role].test(n) && !/^--(heat|cat|chart)-/.test(n)) || names[0]; };
        const bg = cs.backgroundColor;
        // color(...) = a color-mix() wash computed from a token (e.g. .filter-pill.active) - not a raw value.
        if (bg && bg !== 'rgba(0, 0, 0, 0)') { const mixed = bg.startsWith('color('); chips.push(['bg', colorName(bg, 'bg')?.replace(/^--/, '') || (mixed ? 'mixed from a token (color-mix)' : `⚠ ${bg}`), !colorName(bg, 'bg') && !mixed]); }
        if (hasText || el.querySelector('.material-symbols-outlined')) chips.push(['text', colorName(cs.color, 'text')?.replace(/^--/, '') || `⚠ ${cs.color}`, !colorName(cs.color, 'text')]);
        if (parseFloat(cs.borderLeftWidth) || parseFloat(cs.borderTopWidth)) {
            const bc = parseFloat(cs.borderTopWidth) ? cs.borderTopColor : cs.borderLeftColor;
            if (bc !== 'rgba(0, 0, 0, 0)') chips.push(['border', colorName(bc, 'border')?.replace(/^--/, '') || `⚠ ${bc}`, !colorName(bc, 'border')]);
        }
        if (cs.boxShadow && cs.boxShadow !== 'none' && !cs.animationName.includes('glow')) {
            const s = lookup.shadow.get(cs.boxShadow);
            chips.push(['shadow', s ? s.replace(/^--/, '') : '⚠ untokenised shadow', !s]);
        }
        if (cs.animationName && cs.animationName !== 'none') chips.push(['animation', `${cs.animationName} ${cs.animationDuration}`, false]);
        // ML-210: touch target - the visible box, or the invisible ::before hit area if it's bigger.
        if (el.matches('button, a[href], input, select, textarea, [role="button"], [role="slider"]')) {
            const r = el.getBoundingClientRect(), b = getComputedStyle(el, '::before');
            const hw = b.content !== 'none' ? parseFloat(b.width) || 0 : 0, hh = b.content !== 'none' ? parseFloat(b.height) || 0 : 0;
            const w = Math.round(Math.max(r.width, hw)), h = Math.round(Math.max(r.height, hh));
            const small = w < 44 || h < 44;
            chips.push(['target', `${w}×${h}${hw > r.width ? ' (hit area)' : ''}${small ? ' - under 44' : ''}`, small]);
        }
        return chips;
    }

    function annotate(root, lookup) {
        root.querySelectorAll('.admin-design-example').forEach(ex => {
            const stage = ex.querySelector('.admin-design-stage');
            const out = ex.querySelector('.admin-design-annotations');
            const sel = ex.dataset.measure;
            // One element per selector in `measure` (the first match), so each variant gets one annotation.
            const els = sel ? [...new Set(sel.split(',').map(s => stage.querySelector(s.trim())).filter(Boolean))] : [stage.firstElementChild];
            out.innerHTML = els.filter(Boolean).slice(0, 6).map(el => {
                el.classList.add('admin-design-measured');
                const name = el.tagName.toLowerCase() + (el.className && typeof el.className === 'string' ? '.' + el.className.replace('admin-design-measured', '').trim().split(/\s+/).join('.') : '');
                const chips = describe(el, lookup).map(([k, v, bad]) => `<span class="admin-design-chip${bad ? ' admin-design-chip-warn' : ''}"><b>${k}</b> ${v}</span>`).join('');
                return `<div class="admin-design-annotation"><code>${name}</code>${chips}</div>`;
            }).join('');
        });
    }

    // ------------------------------------------------------------------ foundations

    function foundationsHtml() {
        const rows = (re) => TOKENS.flatMap(g => g.rows).filter(r => re.test(r.name));
        const colourGroups = TOKENS.map(g => ({ group: g.group, rows: g.rows.filter(r => asColor(tokenValue(r.name))) })).filter(g => g.rows.length);
        const swatch = (r) => `<div class="admin-design-swatch"><div class="admin-design-swatch-color" style="background: var(${r.name})"></div><div class="admin-design-swatch-label"><code>${r.name}</code><span class="admin-design-token-value" data-token="${r.name}"></span><small>${r.comment}</small></div></div>`;
        const table = (list, cell) => `<div class="admin-stat-table-wrap"><table class="admin-stat-table admin-design-table"><tbody>${list.map(r => `<tr><td><code>${r.name}</code></td><td class="admin-design-token-value" data-token="${r.name}"></td><td>${cell ? cell(r) : ''}</td><td>${r.comment}</td></tr>`).join('')}</tbody></table></div>`;
        return `
            <h3 class="admin-design-subhead">Colour</h3>
            ${colourGroups.map(g => `<h4 class="admin-design-minihead">${g.group}</h4><div class="admin-design-swatches">${g.rows.map(swatch).join('')}</div>`).join('')}
            <h3 class="admin-design-subhead">Typography</h3>
            ${table(rows(/^--font-(2xs|xs|sm|base|md|lg|xl|2xl|3xl)$/), r => `<span style="font-size: var(${r.name})">The quick brown fox</span>`)}
            ${table(rows(/^--font-weight-/), r => `<span style="font-weight: var(${r.name})">The quick brown fox</span>`)}
            ${table(rows(/^--font-(sans|mono|music)$/), r => `<span style="font-family: var(${r.name})">Aa 𝄋 𝄌 0123</span>`)}
            ${table(rows(/^--line-height-/), r => `<span class="admin-design-leading" style="line-height: var(${r.name})">Two lines of text<br>to show the leading</span>`)}
            ${table(rows(/^--icon-/), r => `<span class="material-symbols-outlined" style="font-size: var(${r.name})">music_note</span>`)}
            <h3 class="admin-design-subhead">Spacing</h3>
            ${table(rows(/^--space-/), r => `<span class="admin-design-space-bar" style="width: var(${r.name})"></span>`)}
            <h3 class="admin-design-subhead">Radius</h3>
            <div class="admin-design-swatches">${rows(/^--radius-/).map(r => `<div class="admin-design-shape" style="border-radius: var(${r.name})"><code>${r.name}</code><span class="admin-design-token-value" data-token="${r.name}"></span></div>`).join('')}</div>
            <h3 class="admin-design-subhead">Elevation</h3>
            <div class="admin-design-swatches">${rows(/^--(shadow|focus)/).map(r => `<div class="admin-design-shadow" style="box-shadow: var(${r.name})"><code>${r.name}</code><small>${r.comment}</small></div>`).join('')}</div>
            ${table(rows(/^--z-/))}
            <h3 class="admin-design-subhead">Motion</h3>
            <p class="admin-intro">Hover (or tap) a row to play its duration.</p>
            ${table(rows(/^--duration-/), r => `<span class="admin-design-motion-track"><span class="admin-design-motion-dot" style="transition-duration: var(${r.name})"></span></span>`)}
            <h3 class="admin-design-subhead">Layout</h3>
            ${table(rows(/^--(app-max-width|touch-target|bottom-bar-)/))}`;
    }

    // ------------------------------------------------------------------ render

    const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

    function sectionHtml(item) {
        return `<div class="admin-design-section" id="design-${item.spec}" data-spec="${item.spec}">
            <div class="admin-design-section-head"><h3>${item.title}</h3><code>specs/components/${item.spec}.md</code></div>
            ${item.examples.map(ex => `<div class="admin-design-example" data-measure="${esc(ex.measure || '')}">
                <div class="admin-design-example-label">${ex.label}</div>
                <div class="admin-design-stage${ex.wide ? ' admin-design-stage-wide' : ''}">${ex.html}</div>
                <div class="admin-design-annotations"></div>
            </div>`).join('')}
        </div>`;
    }

    function render(container) {
        const nav = GROUPS.map(g => `<a class="admin-link admin-design-jump" href="#design-group-${g.title.replace(/\W+/g, '-')}">${g.title}</a>`).join('');
        container.innerHTML = `
            <div class="admin-design-toolbar">
                <div class="flow-edit-tabs admin-design-theme">
                    <button class="flow-edit-tab" data-theme="light" type="button">Light</button>
                    <button class="flow-edit-tab" data-theme="dark" type="button">Dark</button>
                </div>
                <label class="admin-design-toggle"><span>Show touch targets</span><span class="toggle-switch"><input type="checkbox" id="designShowTargets"><span class="toggle-slider"></span></span></label>
                <label class="admin-design-toggle"><span>Preview focus rings</span><span class="toggle-switch"><input type="checkbox" id="designShowFocus"><span class="toggle-slider"></span></span></label>
                <label class="admin-design-toggle"><span>Show spacing outlines</span><span class="toggle-switch"><input type="checkbox" id="designShowSpacing"><span class="toggle-slider"></span></span></label>
            </div>
            <div class="admin-design-jumps"><a class="admin-link admin-design-jump" href="#design-group-Foundations">Foundations</a>${nav}</div>
            <h2 class="admin-design-group" id="design-group-Foundations">Foundations</h2>
            <p class="admin-intro">Built live from <code>public/tokens.css</code> - every Layer 2 token, its current value in this theme, and when to use it.</p>
            ${foundationsHtml()}
            ${GROUPS.map(g => `<h2 class="admin-design-group" id="design-group-${g.title.replace(/\W+/g, '-')}">${g.title}</h2>${g.note ? `<p class="admin-intro">${g.note}</p>` : ''}${g.items.map(sectionHtml).join('')}`).join('')}`;

        const refresh = () => {
            const lookup = buildLookup();
            container.querySelectorAll('.admin-design-token-value').forEach(el => { el.textContent = tokenValue(el.dataset.token); });
            annotate(container, lookup);
            container.querySelectorAll('.admin-design-theme .flow-edit-tab').forEach(b => b.classList.toggle('active', (b.dataset.theme === 'dark') === document.body.classList.contains('dark-mode')));
        };
        container.querySelectorAll('.admin-design-theme .flow-edit-tab').forEach(b => b.addEventListener('click', () => {
            // Preview only - the admin panel's saved theme preference is left untouched.
            document.body.classList.toggle('dark-mode', b.dataset.theme === 'dark');
            refresh();
        }));
        container.querySelector('#designShowTargets').addEventListener('change', (e) => container.classList.toggle('admin-design-show-targets', e.target.checked));
        container.querySelector('#designShowFocus').addEventListener('change', (e) => container.classList.toggle('admin-design-show-focus', e.target.checked));
        container.querySelector('#designShowSpacing').addEventListener('change', (e) => container.classList.toggle('admin-design-show-spacing', e.target.checked));
        // Everything here is a specimen - stop clicks doing anything (links, radios still toggle visually).
        container.querySelectorAll('.admin-design-stage a, .admin-design-stage form').forEach(el => el.addEventListener('click', e => e.preventDefault()));
        refresh();
    }

    let rendered = false;
    async function open() {
        const container = document.getElementById('designCatalogue');
        if (!container || rendered) return;
        rendered = true;
        try {
            TOKENS = await loadTokens();
            render(container);
        } catch (err) {
            rendered = false;
            container.innerHTML = `<p>Couldn't load the design system: ${esc(String(err.message || err))}</p>`;
        }
    }

    document.addEventListener('DOMContentLoaded', () => {
        document.querySelector('.admin-nav-item[data-section="design"]')?.addEventListener('click', open);
    });
})();
