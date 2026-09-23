// ML-204: a Flow <-> MusicXML codec - the one file format for moving flows between environments
// (admin export/import) AND for create-from-file / PDF->MusicXML (scoreImport.js). This file is
// pure (no DB access) so it can be unit-tested directly - see server/test/flowMusicXml.test.js,
// and server/services/flowTransfer.js for loading a flow from the DB to feed into it.
//
// The design (docs/flow-musicxml.md has the full field-by-field map):
//  - Everything that HAS a standard MusicXML equivalent is written as standard MusicXML, so the
//    file opens meaningfully in MuseScore/Sibelius/etc: every bar is a gap (a whole-bar rest, or
//    one rest per beat where a fermata/caesura/tempo ramp needs a beat position), with real
//    repeats, voltas, barlines, rehearsal marks, segno/coda, D.C./D.S./To Coda/Fine (as both the
//    printed words and the <sound> playback attributes), fermatas, caesuras, accel./rit. dashes
//    and metronome marks.
//  - App-only data (block boundaries, lead-in settings, intro offsets, fermata hold/playback mode,
//    ramp end/target modes, legacy columns) rides along in the two extension slots MusicXML
//    provides for exactly this, which other software ignores:
//      * whole-flow: <identification><miscellaneous><miscellaneous-field name="musicledger:...">
//      * per-block: a hidden <direction><direction-type><other-direction print-object="no">
//        on the block's first bar, whose text is "musicledger:" + JSON.
//    The standard elements stay the source of truth for anything they can express - the
//    extension only ever carries what they can't.
//
// Blocks are the shape toSegmentDto (metronomeSetups.js) produces - numerator/denominator already
// resolved - so what listFlowBlocks returns can be passed straight in.

export const FLOW_MUSICXML_FORMAT_VERSION = 1;
export const EXTENSION_PREFIX = 'musicledger:';

// Divisions per quarter note. 8 gives an integer duration for every beat unit down to a 32nd
// (the smallest time-signature denominator the app could plausibly be given).
const DIVISIONS = 8;

// Mirrors METRO_NOTE_TYPES (public/app.js) - fraction of a whole note.
const NOTE_VALUE_FRACTION = {
  semiquaver: 0.0625, quaver: 0.125, 'dotted-quaver': 0.1875, crotchet: 0.25,
  'dotted-crotchet': 0.375, minim: 0.5, 'dotted-minim': 0.75, semibreve: 1
};
const NOTE_VALUE_TO_BEAT_UNIT = {
  semiquaver: ['16th', false], quaver: ['eighth', false], 'dotted-quaver': ['eighth', true],
  crotchet: ['quarter', false], 'dotted-crotchet': ['quarter', true], minim: ['half', false],
  'dotted-minim': ['half', true], semibreve: ['whole', false]
};
const DENOMINATOR_TO_TYPE = { 1: 'whole', 2: 'half', 4: 'quarter', 8: 'eighth', 16: '16th', 32: '32nd' };

// Same default the block editor itself falls back to when a block has no noteValue yet
// (metroSegDefaultNoteForDenominator, public/app.js).
export function defaultNoteValueForDenominator(denominator) {
  if (denominator === 16) return 'semiquaver';
  if (denominator === 8) return 'quaver';
  if (denominator === 2) return 'minim';
  if (denominator === 1) return 'semibreve';
  return 'crotchet';
}

// A block's stored bpm counts the time signature's own denominator note (the displayed "note =
// bpm" label is a rescale of it by noteValue - setMetroSegBpmFromDisplayed, public/app.js).
// MusicXML's <sound tempo> is always quarter notes per minute; <metronome> shows the block's own
// "note = bpm" label exactly as the app displays it.
export function quarterTempo(bpm, denominator) {
  return roundTempo(bpm * 4 / denominator);
}
export function displayedBpm(bpm, denominator, noteValue) {
  return roundTempo(bpm / (NOTE_VALUE_FRACTION[noteValue] * denominator));
}
function roundTempo(n) { return Math.round(n * 1000) / 1000; }

function beatDuration(denominator) { return DIVISIONS * 4 / denominator; }
function measureDuration(numerator, denominator) { return numerator * beatDuration(denominator); }

function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function hasValue(v) { return v !== null && v !== undefined; }

// ---------- per-block derived layout ----------

function repeatEndingNumbersFor(b) {
  if (b.repeatEndingNumbers && b.repeatEndingNumbers.length) return b.repeatEndingNumbers;
  // Legacy 1st/2nd-time flags (ad-hoc tool era) still print as a real volta - the extension keeps
  // the flags themselves so they round-trip as flags, not as repeatEndingNumbers.
  const legacy = [];
  if (b.isFirstTimeBar) legacy.push(1);
  if (b.isSecondTimeBar) legacy.push(2);
  return legacy;
}

function rampTargetBpm(ramp, block, nextBlock) {
  if (ramp.targetMode === 'custom') return Number(ramp.targetBpm);
  if (!nextBlock) return null;
  // A 'next_block' target lands on the next block's own speed - converted into THIS block's
  // denominator units so it compares like-for-like with block.bpm.
  return Number(nextBlock.bpm) * block.denominator / nextBlock.denominator;
}

function rampWords(from, to) {
  if (to === null || to === from) return 'a tempo';
  return to > from ? 'accel.' : 'rit.';
}

// Everything app-only about a block - see the file-level comment. Anything that's null/false/
// empty is left out entirely, so a plain block's extension is just {"block": n}.
function blockExtension(b, index) {
  const ext = { block: index };
  if (b.isLeadIn) {
    ext.isLeadIn = true;
    if (b.repeatLeadIn) ext.repeatLeadIn = true;
    if (b.quietSecondsBeforeLeadIn) ext.quietSecondsBeforeLeadIn = b.quietSecondsBeforeLeadIn;
  }
  if (!b.noteValue) ext.noteValueUnset = true;
  if (b.rehearsalMark) ext.rehearsalMark = b.rehearsalMark;
  if (b.isFirstTimeBar) ext.isFirstTimeBar = true;
  if (b.isSecondTimeBar) ext.isSecondTimeBar = true;
  if (hasValue(b.repeatEndingStartBar)) ext.repeatEndingStartBar = b.repeatEndingStartBar;
  for (const k of ['introStartBarOffset', 'introStartBeatOffset', 'introEndBarOffset', 'introEndBeatOffset',
    'rampStartBarOffset', 'rampStartBeatOffset', 'rampDurationBars']) {
    if (hasValue(b[k])) ext[k] = b[k];
  }
  if (b.fermatas && b.fermatas.length) {
    // Same defaults validateSegmentPayload applies - a caesura is always 'silent'.
    ext.fermatas = b.fermatas.map(f => ({
      kind: f.kind || 'fermata', barOffset: f.barOffset || 0, beatOffset: f.beatOffset,
      holdBeats: f.holdBeats, playbackMode: f.kind === 'caesura' ? 'silent' : (f.playbackMode || 'tone')
    }));
  }
  if (b.ramps && b.ramps.length) {
    ext.ramps = b.ramps.map(r => ({
      startBarOffset: r.startBarOffset || 0, startBeatOffset: r.startBeatOffset,
      endMode: r.endMode || 'block_end',
      ...(r.endMode === 'specific' ? { endBarOffset: r.endBarOffset, endBeatOffset: r.endBeatOffset } : {}),
      targetMode: r.targetMode || 'custom',
      ...(r.targetMode === 'custom' || !r.targetMode ? { targetBpm: r.targetBpm } : {})
    }));
  }
  return ext;
}

// ---------- XML fragments ----------

function directionXml(inner, { placement, sound } = {}) {
  const p = placement ? ` placement="${placement}"` : '';
  const s = sound ? `<sound ${Object.entries(sound).map(([k, v]) => `${k}="${esc(v)}"`).join(' ')}/>` : '';
  return `<direction${p}>${inner}${s}</direction>`;
}
function dt(inner) { return `<direction-type>${inner}</direction-type>`; }
function wordsXml(text) { return dt(`<words>${esc(text)}</words>`); }

function restXml(duration, { measureRest = false, type = null, notations = '' } = {}) {
  const rest = measureRest ? '<rest measure="yes"/>' : '<rest/>';
  const typeXml = type ? `<type>${type}</type>` : '';
  return `<note>${rest}<duration>${duration}</duration><voice>1</voice>${typeXml}${notations ? `<notations>${notations}</notations>` : ''}</note>`;
}

// ---------- main entry point ----------

/**
 * @param {object} flow   { title, composer, arranger, publisher, description, recordings: [...] }
 * @param {object[]} blocks  in play order, toSegmentDto shape
 * @param {object} [opts] { appVersion, encodingDate (YYYY-MM-DD) }
 * @returns {string} a complete MusicXML 4.0 partwise document
 */
export function flowToMusicXml(flow, blocks, opts = {}) {
  const encodingDate = opts.encodingDate || new Date().toISOString().slice(0, 10);
  const recordings = flow.recordings || [];
  const youtube = recordings.filter(r => r.type === 'youtube' && r.youtubeVideoId)
    .map(r => ({ type: 'youtube', youtubeVideoId: r.youtubeVideoId, title: r.title || null }));

  const flowExt = {
    formatVersion: FLOW_MUSICXML_FORMAT_VERSION,
    ...(flow.publisher ? { publisher: flow.publisher } : {}),
    ...(flow.description ? { description: flow.description } : {}),
    ...(youtube.length ? { recordings: youtube } : {}),
    // Uploaded mp3/mp4 and document files aren't carried (ML-204) - counted so the importer can
    // say so rather than silently dropping them.
    skippedMedia: {
      recordings: recordings.length - youtube.length,
      documents: (flow.documents || []).length
    }
  };

  const out = [];
  out.push('<?xml version="1.0" encoding="UTF-8" standalone="no"?>');
  out.push('<!DOCTYPE score-partwise PUBLIC "-//Recordare//DTD MusicXML 4.0 Partwise//EN" "http://www.musicxml.org/dtds/partwise.dtd">');
  out.push('<score-partwise version="4.0">');
  out.push(`<work><work-title>${esc(flow.title || 'Untitled flow')}</work-title></work>`);
  out.push('<identification>');
  if (flow.composer) out.push(`<creator type="composer">${esc(flow.composer)}</creator>`);
  if (flow.arranger) out.push(`<creator type="arranger">${esc(flow.arranger)}</creator>`);
  out.push(`<encoding><software>TheMusicLedger${opts.appVersion ? ' ' + esc(opts.appVersion) : ''}</software><encoding-date>${encodingDate}</encoding-date></encoding>`);
  out.push('<miscellaneous>');
  out.push(`<miscellaneous-field name="${EXTENSION_PREFIX}flow">${esc(JSON.stringify(flowExt))}</miscellaneous-field>`);
  out.push('</miscellaneous>');
  out.push('</identification>');
  out.push('<part-list><score-part id="P1"><part-name print-object="no">Flow</part-name></score-part></part-list>');
  out.push('<part id="P1">');

  let measureNumber = blocks.length && blocks[0].isLeadIn && blocks[0].pickupBeats ? 0 : 1;
  let lastTime = null;
  let lastTempoKey = null;
  let isFirstMeasure = true;

  blocks.forEach((b, blockIndex) => {
    const nextBlock = blocks[blockIndex + 1] || null;
    const { numerator, denominator } = b;
    const noteValue = b.noteValue || defaultNoteValueForDenominator(denominator);
    const isPickup = !!(b.isLeadIn && b.pickupBeats);
    const barCount = isPickup ? 1 : b.barCount;
    const beatDur = beatDuration(denominator);
    const beatType = DENOMINATOR_TO_TYPE[denominator] || null;

    const endingNumbers = repeatEndingNumbersFor(b);
    // repeatEndingStartBar is 1-based and deliberately not bounded against barCount (a shortened
    // block leaves it stale - flowRepeatBarInvalid). A stale one prints from the block's first
    // bar; the extension still carries the raw value.
    const rawEndingStart = hasValue(b.repeatEndingStartBar) ? b.repeatEndingStartBar - 1 : 0;
    const endingStartBar = rawEndingStart >= 0 && rawEndingStart < barCount ? rawEndingStart : 0;

    const rehearsalByBar = new Map();
    const addMark = (bar, mark) => {
      if (bar < 0 || bar >= barCount) return;
      if (!rehearsalByBar.has(bar)) rehearsalByBar.set(bar, []);
      rehearsalByBar.get(bar).push(mark);
    };
    for (const m of b.rehearsalMarks || []) addMark(m.barOffset || 0, m.mark);
    // The legacy single-column mark only prints if the newer list doesn't already carry it.
    if (b.rehearsalMark && !(b.rehearsalMarks || []).some(m => m.mark === b.rehearsalMark)) addMark(0, b.rehearsalMark);

    // Beat-positioned events, keyed "bar:beat" (bar 0-based, beat 1-based). Anything whose offsets
    // fall outside the block (stale after a shortening) is left to the extension alone.
    const inRange = (bar, beat) => bar >= 0 && bar < barCount && beat >= 1 && beat <= (isPickup ? b.pickupBeats : numerator);
    const beatEvents = new Map();
    const eventAt = (bar, beat) => {
      const key = `${bar}:${beat}`;
      if (!beatEvents.has(key)) beatEvents.set(key, { before: [], notations: [] });
      return beatEvents.get(key);
    };
    const splitBars = new Set();
    for (const f of b.fermatas || []) {
      const bar = f.barOffset || 0;
      if (!inRange(bar, f.beatOffset)) continue;
      eventAt(bar, f.beatOffset).notations.push(f.kind === 'caesura'
        ? '<articulations><caesura/></articulations>'
        : '<fermata type="upright"/>');
      splitBars.add(bar);
    }
    const endOfBlockDirections = [];
    (b.ramps || []).forEach((r, i) => {
      const number = (i % 16) + 1;
      const startBar = r.startBarOffset || 0;
      const target = rampTargetBpm(r, b, nextBlock);
      if (inRange(startBar, r.startBeatOffset)) {
        eventAt(startBar, r.startBeatOffset).before.push(directionXml(
          wordsXml(rampWords(Number(b.bpm), target)) + dt(`<dashes type="start" number="${number}"/>`),
          { placement: 'above' }
        ));
        if (r.startBeatOffset > 1) splitBars.add(startBar);
      }
      const stop = directionXml(dt(`<dashes type="stop" number="${number}"/>`),
        target === null ? {} : { sound: { tempo: quarterTempo(target, denominator) } });
      if (r.endMode === 'specific') {
        if (inRange(r.endBarOffset, r.endBeatOffset)) {
          eventAt(r.endBarOffset, r.endBeatOffset).before.push(stop);
          if (r.endBeatOffset > 1) splitBars.add(r.endBarOffset);
        }
      } else {
        endOfBlockDirections.push(stop);
      }
    });

    for (let bar = 0; bar < barCount; bar++) {
      const isBlockStart = bar === 0;
      const isBlockEnd = bar === barCount - 1;
      const parts = [];

      const implicit = isPickup ? ' implicit="yes"' : '';
      parts.push(`<measure number="${measureNumber}"${implicit}>`);

      // Left barline: forward repeat and/or a volta starting here.
      const leftBits = [];
      if (endingNumbers.length && bar === endingStartBar) {
        leftBits.push(`<ending number="${endingNumbers.join(', ')}" type="start">${endingNumbers.join(', ')}.</ending>`);
      }
      if (isBlockStart && b.isRepeatStart) leftBits.push('<repeat direction="forward"/>');
      if (leftBits.length) {
        const style = isBlockStart && b.isRepeatStart ? '<bar-style>heavy-light</bar-style>' : '';
        parts.push(`<barline location="left">${style}${leftBits.join('')}</barline>`);
      }

      // Attributes: full set on the very first bar, then only a time signature when it changes.
      const timeKey = `${numerator}/${denominator}`;
      if (isFirstMeasure) {
        parts.push(`<attributes><divisions>${DIVISIONS}</divisions><key><fifths>0</fifths></key>`
          + `<time><beats>${numerator}</beats><beat-type>${denominator}</beat-type></time>`
          + '<clef><sign>percussion</sign></clef><staff-details><staff-lines>1</staff-lines></staff-details></attributes>');
        lastTime = timeKey;
      } else if (isBlockStart && timeKey !== lastTime) {
        parts.push(`<attributes><time><beats>${numerator}</beats><beat-type>${denominator}</beat-type></time></attributes>`);
        lastTime = timeKey;
      }

      if (isBlockStart) {
        parts.push(directionXml(dt(`<other-direction print-object="no">${esc(EXTENSION_PREFIX + JSON.stringify(blockExtension(b, blockIndex)))}</other-direction>`)));
        if (b.isSegno) parts.push(directionXml(dt('<segno/>'), { placement: 'above', sound: { segno: 'segno' } }));
        if (b.isCoda) parts.push(directionXml(dt('<coda/>'), { placement: 'above', sound: { coda: 'coda' } }));
        const tempoKey = `${b.bpm}/${denominator}/${noteValue}`;
        if (tempoKey !== lastTempoKey) {
          const [beatUnit, dotted] = NOTE_VALUE_TO_BEAT_UNIT[noteValue];
          parts.push(directionXml(
            dt(`<metronome><beat-unit>${beatUnit}</beat-unit>${dotted ? '<beat-unit-dot/>' : ''}<per-minute>${displayedBpm(b.bpm, denominator, noteValue)}</per-minute></metronome>`),
            { placement: 'above', sound: { tempo: quarterTempo(b.bpm, denominator) } }
          ));
          lastTempoKey = tempoKey;
        }
      }
      for (const mark of rehearsalByBar.get(bar) || []) {
        parts.push(directionXml(dt(`<rehearsal>${esc(mark)}</rehearsal>`), { placement: 'above' }));
      }

      // Notes: rests only - a Flow has no pitches. A pickup always splits into beats (its length
      // isn't a whole bar), and so does any bar with a fermata/caesura or a ramp starting/ending
      // after beat 1, so the event sits on its own beat; everything else is one whole-bar rest,
      // with any beat-1 directions simply placed in front of it.
      const beatsInBar = isPickup ? b.pickupBeats : numerator;
      if (isPickup || splitBars.has(bar)) {
        for (let beat = 1; beat <= beatsInBar; beat++) {
          const ev = beatEvents.get(`${bar}:${beat}`);
          if (ev) parts.push(...ev.before);
          parts.push(restXml(beatDur, { type: beatType, notations: ev ? ev.notations.join('') : '' }));
        }
      } else {
        const ev = beatEvents.get(`${bar}:1`);
        if (ev) parts.push(...ev.before);
        parts.push(restXml(measureDuration(numerator, denominator), { measureRest: true }));
      }

      if (isBlockEnd) {
        parts.push(...endOfBlockDirections);
        // Jumps sit at the end of their block, where real notation prints them. Only one of these
        // five is ever set per block (the Jump picker is single-choice), but each is written
        // independently in case older data combines them.
        if (b.gotoCoda) parts.push(directionXml(wordsXml('To Coda'), { placement: 'above', sound: { tocoda: 'coda' } }));
        if (b.gotoSegnoThenCoda) parts.push(directionXml(wordsXml('D.S. al Coda'), { placement: 'below', sound: { dalsegno: 'segno' } }));
        if (b.gotoStartDcThenCoda) parts.push(directionXml(wordsXml('D.C. al Coda'), { placement: 'below', sound: { dacapo: 'yes' } }));
        if (b.gotoSegno) parts.push(directionXml(wordsXml('D.S.'), { placement: 'below', sound: { dalsegno: 'segno' } }));
        if (b.gotoStartDc) parts.push(directionXml(wordsXml('D.C.'), { placement: 'below', sound: { dacapo: 'yes' } }));
        if (b.isFine) parts.push(directionXml(wordsXml('Fine'), { placement: 'below', sound: { fine: 'yes' } }));

        const rightBits = [];
        let style = null;
        if (b.isRepeatEnd) style = 'light-heavy';
        else if (b.isFinalBarline) style = 'light-heavy';
        else if (b.isSectionBoundary || b.isFine) style = 'light-light';
        if (endingNumbers.length) {
          // A volta that ends in a repeat closes its bracket; the last-time ending is left open.
          rightBits.push(`<ending number="${endingNumbers.join(', ')}" type="${b.isRepeatEnd ? 'stop' : 'discontinue'}"/>`);
        }
        if (b.isRepeatEnd) {
          const times = b.repeatPlayCount && b.repeatPlayCount !== 2 ? ` times="${b.repeatPlayCount}"` : '';
          rightBits.push(`<repeat direction="backward"${times}/>`);
        }
        if (style || rightBits.length) {
          parts.push(`<barline location="right">${style ? `<bar-style>${style}</bar-style>` : ''}${rightBits.join('')}</barline>`);
        }
      }

      parts.push('</measure>');
      out.push(parts.join(''));
      measureNumber++;
      isFirstMeasure = false;
    }
  });

  out.push('</part>');
  out.push('</score-partwise>');
  return out.join('\n') + '\n';
}

// "My Flow: Part 1/2" -> "My Flow - Part 1-2.musicxml" - safe on Windows/macOS and inside a zip.
export function musicXmlFileName(title, id) {
  const base = String(title || `flow-${id}`).replace(/[\\/:*?"<>|]+/g, '-').replace(/\s+/g, ' ').trim().slice(0, 80);
  return `${base || `flow-${id}`}.musicxml`;
}
