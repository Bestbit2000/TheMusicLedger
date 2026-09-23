// ML-204: MusicXML -> Flow reader, the counterpart of flowToMusicXml (flowMusicXml.js). The one
// parser for every way a flow arrives as MusicXML: admin import between environments, "Create
// from file" (.musicxml/.mxl), and PDF/scan import (OMR/AI output is just more MusicXML).
// Pure - no DB access; blocks come back with { numerator, denominator } time signatures for
// resolveBlocksForAccount (scoreImport.js) to turn into ids.
//
// Two modes, picked automatically:
//  - Our own export (block-start markers present - see flowMusicXml.js's file comment): block
//    boundaries come from the markers, standard elements give every field they can express, and
//    each block's extension JSON restores the app-only rest. Lossless: every fixture in
//    server/test/fixtures/flowFixtures.js survives write -> read unchanged (the round-trip test).
//  - Anything else (MuseScore, Sibelius, Finale, OMR): the standard elements only, with fallbacks
//    for how real files actually encode things - jump instructions as bare <words> with no
//    <sound> playback attributes, "rit." with no dashes, fermatas on pitched notes in any part,
//    chords/voices/<backup>, metronome marks with no <sound tempo>. Bars are grouped into blocks
//    wherever something structural starts or ends (time/tempo change, repeat, volta, sign, jump,
//    rehearsal mark, double/final barline), so identical bars in between become one multi-bar
//    block - the same "fewest blocks" default Blocks Studio starts from. Anything that couldn't
//    be represented exactly is reported in `warnings` rather than silently dropped.
//
// Offsets follow the block editor's conventions (see flowFixtures.js): fermata/ramp/rehearsal
// barOffset 0-based, beatOffset/repeatEndingStartBar/intro bars 1-based.

import { XMLParser } from 'fast-xml-parser';
import { EXTENSION_PREFIX, FLOW_MUSICXML_FORMAT_VERSION, defaultNoteValueForDenominator } from './flowMusicXml.js';

// Local copy (not flows.js's) so this module stays DB-free - same { status, message } shape
// sendError already understands.
function withStatus(status, message) {
  const err = new Error(message);
  err.status = status;
  return err;
}

const EPS = 1e-6;
const DEFAULT_BPM = 100;

// Fraction of a whole note, per MusicXML <type>/<beat-unit> name.
const UNIT_FRACTION = { whole: 1, half: 0.5, quarter: 0.25, eighth: 0.125, '16th': 0.0625, '32nd': 0.03125 };
const FRACTION_TO_NOTE_VALUE = {
  0.0625: 'semiquaver', 0.125: 'quaver', 0.1875: 'dotted-quaver', 0.25: 'crotchet',
  0.375: 'dotted-crotchet', 0.5: 'minim', 0.75: 'dotted-minim', 1: 'semibreve'
};

// ---------- preserveOrder node helpers ----------
// Document order matters here (a direction's position relative to the notes around it is what
// puts a fermata or a ramp on the right beat), so the tree is parsed with preserveOrder: every
// node is { tagName: [children], ':@': { '@_attr': value } }, text is { '#text': value }.

function tagOf(node) { return Object.keys(node).find(k => k !== ':@'); }
function kids(node) { const v = node[tagOf(node)]; return Array.isArray(v) ? v : []; }
function attr(node, name) { return node[':@']?.[`@_${name}`]; }
function child(node, tag) { return kids(node).find(k => tagOf(k) === tag); }
function childrenOf(node, tag) { return kids(node).filter(k => tagOf(k) === tag); }
function textOf(node) {
  if (!node) return null;
  return kids(node).map(k => (k['#text'] !== undefined ? String(k['#text']) : textOf(k) || '')).join('').trim();
}
// First number in the text - tolerates "c. 120", "120-126", " 4 ".
function num(node) { const m = String(textOf(node) ?? '').match(/\d+(?:\.\d+)?/); return m ? parseFloat(m[0]) : NaN; }

// ---------- words -> instruction ----------

function classifyWords(raw) {
  const t = String(raw || '').toLowerCase().replace(/\s+/g, ' ').trim();
  const ds = /^(d\.?\s?s\.?|dal segno)/;
  const dc = /^(d\.?\s?c\.?|da capo)/;
  if (ds.test(t) && /al coda/.test(t)) return 'dsCoda';
  if (dc.test(t) && /al coda/.test(t)) return 'dcCoda';
  // "al Fine" is still a plain D.S./D.C. jump in the app (Fine is its own marker) - distinguished
  // only so the "bare D.S. in a piece with a To Coda means al Coda" rule below can't override it.
  if (ds.test(t) && /al fine/.test(t)) return 'dsFine';
  if (dc.test(t) && /al fine/.test(t)) return 'dcFine';
  if (ds.test(t)) return 'ds';
  if (dc.test(t)) return 'dc';
  if (/^to coda\b|^to$/.test(t)) return 'toCoda';
  if (/^fine\b/.test(t)) return 'fine';
  if (/^coda\b/.test(t)) return 'coda';
  // Gradual changes only - "più/meno mosso" are immediate tempo changes, not ramps.
  if (/^(accel|stringendo|string\.|poco a poco accel)/.test(t)) return 'accel';
  if (/^(rit|rall|allarg|poco a poco rit|poco rit|poco rall)/.test(t)) return 'rit';
  if (/^a tempo\b|^tempo primo|^tempo i\b/.test(t)) return 'aTempo';
  return null;
}

// ---------- part scanning ----------

// One part's measures as flat event lists, positions in quarter notes from the start of the
// measure (so parts with different <divisions> line up).
function scanPart(partNode, warnings) {
  let divisions = 1;
  let time = null;
  const measures = [];
  for (const m of childrenOf(partNode, 'measure')) {
    let pos = 0; let maxPos = 0; let lastNoteStart = 0;
    const out = {
      number: attr(m, 'number'), implicit: attr(m, 'implicit') === 'yes',
      timeChange: null, events: [], left: null, right: null, lengthQ: 0
    };
    for (const c of kids(m)) {
      const tag = tagOf(c);
      if (tag === 'attributes') {
        const d = child(c, 'divisions');
        if (d) divisions = num(d) || divisions;
        const t = child(c, 'time');
        if (t && child(t, 'beats') && child(t, 'beat-type')) {
          // Composite signatures ("3+2") add up; only the first <beats>/<beat-type> pair is read.
          const beats = String(textOf(child(t, 'beats'))).split('+').reduce((s, x) => s + (parseInt(x, 10) || 0), 0);
          const beatType = parseInt(textOf(child(t, 'beat-type')), 10);
          if (beats > 0 && beatType > 0) { time = { numerator: beats, denominator: beatType }; out.timeChange = time; }
        }
      } else if (tag === 'note') {
        if (child(c, 'grace')) continue;
        const dur = (num(child(c, 'duration')) || 0) / divisions;
        const start = child(c, 'chord') ? lastNoteStart : pos;
        if (!child(c, 'chord')) { lastNoteStart = pos; pos += dur; }
        for (const n of childrenOf(c, 'notations')) {
          if (child(n, 'fermata')) out.events.push({ kind: 'fermata', posQ: start });
          const art = child(n, 'articulations');
          if (art && child(art, 'caesura')) out.events.push({ kind: 'caesura', posQ: start });
        }
      } else if (tag === 'backup') {
        pos -= (num(child(c, 'duration')) || 0) / divisions;
      } else if (tag === 'forward') {
        pos += (num(child(c, 'duration')) || 0) / divisions;
      } else if (tag === 'direction' || tag === 'sound') {
        const offsetNode = tag === 'direction' ? child(c, 'offset') : null;
        const at = pos + (offsetNode ? (num(offsetNode) || 0) / divisions : 0);
        out.events.push({ kind: 'direction', posQ: at, ...readDirection(c, tag) });
      } else if (tag === 'barline') {
        const location = attr(c, 'location') || 'right';
        const bl = {
          style: textOf(child(c, 'bar-style')),
          repeat: child(c, 'repeat') ? { direction: attr(child(c, 'repeat'), 'direction'), times: attr(child(c, 'repeat'), 'times') } : null,
          ending: child(c, 'ending') ? { number: attr(child(c, 'ending'), 'number'), type: attr(child(c, 'ending'), 'type'), text: textOf(child(c, 'ending')) } : null,
          // A sign printed on a barline vs. its playback meaning (the attribute) - see analyseBars.
          segnoGlyph: !!child(c, 'segno'), segnoAttr: attr(c, 'segno') !== undefined,
          codaGlyph: !!child(c, 'coda'), codaAttr: attr(c, 'coda') !== undefined,
          fermata: !!child(c, 'fermata')
        };
        if (location === 'left') out.left = bl;
        else if (location === 'right') out.right = bl;
      }
      maxPos = Math.max(maxPos, pos);
    }
    out.lengthQ = maxPos;
    out.time = time;
    measures.push(out);
  }
  if (!time) warnings.push('No time signature found - assuming 4/4.');
  return measures;
}

function readDirection(node, tag) {
  const d = { words: [], rehearsals: [], segno: false, coda: false, metronome: null, dashes: [], other: [], sound: null };
  const sound = tag === 'sound' ? node : child(node, 'sound');
  if (sound) d.sound = pickSound(sound);
  if (tag === 'sound') return d;
  for (const dtNode of childrenOf(node, 'direction-type')) {
    for (const x of kids(dtNode)) {
      const t = tagOf(x);
      if (t === 'words') d.words.push(textOf(x));
      else if (t === 'rehearsal') d.rehearsals.push(textOf(x));
      else if (t === 'segno') d.segno = true;
      else if (t === 'coda') d.coda = true;
      else if (t === 'dashes') d.dashes.push({ type: attr(x, 'type'), number: attr(x, 'number') || '1' });
      else if (t === 'other-direction') d.other.push(textOf(x));
      else if (t === 'metronome') {
        const unit = textOf(child(x, 'beat-unit'));
        const pm = child(x, 'per-minute');
        if (unit && pm && UNIT_FRACTION[unit]) {
          d.metronome = { fraction: UNIT_FRACTION[unit] * (child(x, 'beat-unit-dot') ? 1.5 : 1), perMinute: num(pm) };
        }
      }
    }
  }
  return d;
}

function pickSound(s) {
  const a = (name) => attr(s, name);
  return {
    tempo: a('tempo') !== undefined ? parseFloat(a('tempo')) : null,
    dacapo: a('dacapo') === 'yes', dalsegno: a('dalsegno') !== undefined, tocoda: a('tocoda') !== undefined,
    segno: a('segno') !== undefined, coda: a('coda') !== undefined, fine: a('fine') !== undefined
  };
}

function parseEndingNumbers(ending) {
  const source = ending.number || ending.text || '';
  const nums = [...new Set((String(source).match(/\d+/g) || []).map(Number).filter(n => n >= 1 && n <= 10))].sort((a, b) => a - b);
  return nums.length ? nums : [1];
}

function readExtension(texts) {
  for (const t of texts) {
    if (t && t.startsWith(EXTENSION_PREFIX)) {
      try { return JSON.parse(t.slice(EXTENSION_PREFIX.length)); } catch { return null; }
    }
  }
  return null;
}

// ---------- bars ----------

// Everything a bar contributes, with positions turned into beats of that bar's own metre.
function analyseBars(structure, extraParts) {
  return structure.map((m, i) => {
    const { numerator, denominator } = m.time || { numerator: 4, denominator: 4 };
    const beatQ = 4 / denominator;
    const beatOf = (posQ) => Math.floor(posQ / beatQ + EPS) + 1;
    const fullQ = numerator * beatQ;
    // Structure (length, barlines, time) from the first part; markings from every part, since
    // real scores often put a fermata or a "rit." only on the staff it applies to.
    const events = [m, ...extraParts.map(p => p[i]).filter(Boolean)].flatMap(x => x.events);
    const bar = {
      index: i, numerator, denominator, beatQ, fullQ,
      lengthQ: m.lengthQ > EPS ? m.lengthQ : fullQ, implicit: m.implicit, timeChange: !!m.timeChange,
      left: m.left, right: m.right,
      ext: null, rehearsals: [], tempos: [], rampStarts: [], rampStops: [], pauses: [],
      segno: !!(m.left?.segnoGlyph || m.left?.segnoAttr), codaLanding: !!(m.left?.codaGlyph || m.left?.codaAttr), toCoda: false,
      // Signs on a RIGHT barline mark where the next bar starts (applied in musicXmlToFlow).
      nextSegno: !!(m.right?.segnoGlyph || m.right?.segnoAttr), nextCoda: !!m.right?.codaAttr,
      jumps: new Set(), fine: false
    };
    // A bare coda glyph on a right barline, with no playback attribute, could be either end of a
    // coda jump - it's decoration only as far as the file itself says, so it's not guessed at.
    if (m.right?.codaGlyph && !m.right?.codaAttr) bar.unplacedCoda = true;
    if (m.right?.fermata) bar.pauses.push({ kind: 'fermata', beat: numerator });
    const seen = new Set();
    const once = (key) => (seen.has(key) ? false : (seen.add(key), true));

    for (const e of events) {
      if (e.kind === 'fermata' || e.kind === 'caesura') {
        const beat = Math.min(beatOf(e.posQ), numerator);
        if (once(`${e.kind}:${beat}`)) bar.pauses.push({ kind: e.kind, beat });
        continue;
      }
      const ext = readExtension(e.other);
      if (ext && ext.block !== undefined) { bar.ext = ext; continue; }
      for (const r of e.rehearsals) if (r && once(`reh:${r}`)) bar.rehearsals.push(r);

      const words = e.words.map(classifyWords).filter(Boolean);
      const s = e.sound || {};
      const atEnd = e.posQ >= bar.lengthQ - EPS && bar.lengthQ > EPS;
      const isToCoda = s.tocoda || words.includes('toCoda') || (e.coda && atEnd && !s.coda);
      if (isToCoda) bar.toCoda = true;
      else if (e.coda || s.coda || words.includes('coda')) bar.codaLanding = true;
      if (e.segno || s.segno) bar.segno = true;
      if (s.fine || words.includes('fine')) bar.fine = true;
      for (const w of words) if (['ds', 'dc', 'dsCoda', 'dcCoda', 'dsFine', 'dcFine'].includes(w)) bar.jumps.add(w);
      if (s.dalsegno && !words.some(w => w.startsWith('ds'))) bar.jumps.add('ds');
      if (s.dacapo && !words.some(w => w.startsWith('dc'))) bar.jumps.add('dc');

      const starts = e.dashes.filter(x => x.type === 'start');
      const stops = e.dashes.filter(x => x.type === 'stop');
      // Deduped by beat - the same "rit." is often printed on every staff.
      for (const st of starts) if (once(`rampStart:${beatOf(e.posQ)}`)) bar.rampStarts.push({ number: st.number, posQ: e.posQ, beat: beatOf(e.posQ) });
      if (!starts.length && words.some(w => w === 'accel' || w === 'rit') && once(`rampStart:${beatOf(e.posQ)}`)) {
        bar.rampStarts.push({ number: null, posQ: e.posQ, beat: beatOf(e.posQ) });
      }
      const quarterTempo = s.tempo || (e.metronome ? e.metronome.perMinute * e.metronome.fraction * 4 : null);
      for (const sp of stops) if (once(`rampStop:${sp.number}:${e.posQ}`)) bar.rampStops.push({ number: sp.number, posQ: e.posQ, beat: beatOf(e.posQ), atEnd, quarterTempo });
      if (!stops.length && (quarterTempo || e.metronome)) {
        bar.tempos.push({ posQ: e.posQ, quarterTempo, noteFraction: e.metronome ? e.metronome.fraction : null });
      }
    }
    return bar;
  });
}

// ---------- blocks ----------

function startsBlock(bar, prev) {
  if (!prev) return true;
  if (bar.timeChange && (bar.numerator !== prev.numerator || bar.denominator !== prev.denominator)) return true;
  if (bar.tempos.some(t => t.posQ < EPS)) return true;
  if (bar.left?.repeat?.direction === 'forward') return true;
  if (bar.left?.ending?.type === 'start') return true;
  if (bar.segno || bar.codaLanding) return true;
  if (bar.rehearsals.length) return true;
  if (prev.implicit && prev.index === 0) return true;
  // The bar before ended something.
  const r = prev.right;
  if (r?.repeat?.direction === 'backward') return true;
  if (r?.ending && (r.ending.type === 'stop' || r.ending.type === 'discontinue')) return true;
  if (r?.style && r.style !== 'regular' && r.style !== 'dashed' && r.style !== 'dotted' && r.style !== 'none') return true;
  if (prev.jumps.size || prev.toCoda || prev.fine) return true;
  return false;
}

function toBpm(quarterTempo, denominator) {
  return Math.max(1, Math.round(quarterTempo * denominator / 4));
}
function noteValueFor(fraction) {
  if (!fraction) return null;
  if (FRACTION_TO_NOTE_VALUE[fraction]) return FRACTION_TO_NOTE_VALUE[fraction];
  // A dotted 16th/whole etc. has no app equivalent - fall back to the plain note.
  const plain = fraction / 1.5;
  return FRACTION_TO_NOTE_VALUE[plain] || null;
}

function buildBlocks(bars, ownFormat, warnings, flowHasToCoda) {
  // Block boundaries.
  const groups = [];
  bars.forEach((bar, i) => {
    const isStart = ownFormat ? !!bar.ext || i === 0 : startsBlock(bar, bars[i - 1]);
    if (isStart || !groups.length) groups.push([bar]);
    else groups[groups.length - 1].push(bar);
  });

  // Tempo carried bar to bar (ramp targets don't count - they're a ramp's destination, not a
  // new block speed).
  let quarterTempo = null;
  let noteFraction = null;
  let sawTempo = false;

  const blocks = groups.map((group, gi) => {
    const first = group[0];
    const last = group[group.length - 1];
    const ext = ownFormat ? (first.ext || {}) : {};
    const { numerator, denominator } = first;

    for (const t of first.tempos.filter(t => t.posQ < EPS)) {
      if (t.quarterTempo) { quarterTempo = t.quarterTempo; sawTempo = true; }
      if (t.noteFraction) noteFraction = t.noteFraction;
    }
    const block = {
      tempoMarked: quarterTempo !== null,
      barCount: group.length,
      bpm: toBpm(quarterTempo || DEFAULT_BPM, denominator),
      timeSignature: { numerator, denominator },
      noteValue: ext.noteValueUnset ? null : (noteValueFor(noteFraction) || defaultNoteValueForDenominator(denominator)),
      isLeadIn: false, repeatLeadIn: false, quietSecondsBeforeLeadIn: 0, pickupBeats: null,
      rehearsalMark: ext.rehearsalMark || null, rehearsalMarks: [],
      isRepeatStart: first.left?.repeat?.direction === 'forward',
      isRepeatEnd: last.right?.repeat?.direction === 'backward',
      repeatPlayCount: null,
      isSectionBoundary: false, isFinalBarline: false, isFine: group.some(b => b.fine),
      isSegno: group.some(b => b.segno), isCoda: group.some(b => b.codaLanding),
      gotoCoda: group.some(b => b.toCoda),
      gotoSegno: false, gotoSegnoThenCoda: false, gotoStartDc: false, gotoStartDcThenCoda: false,
      isFirstTimeBar: !!ext.isFirstTimeBar, isSecondTimeBar: !!ext.isSecondTimeBar,
      repeatEndingNumbers: [], repeatEndingStartBar: null,
      introStartBarOffset: ext.introStartBarOffset ?? null, introStartBeatOffset: ext.introStartBeatOffset ?? null,
      introEndBarOffset: ext.introEndBarOffset ?? null, introEndBeatOffset: ext.introEndBeatOffset ?? null,
      rampStartBarOffset: ext.rampStartBarOffset ?? null, rampStartBeatOffset: ext.rampStartBeatOffset ?? null,
      rampDurationBars: ext.rampDurationBars ?? null,
      fermatas: [], ramps: []
    };

    // Lead-in: a pickup bar (implicit / short first bar), or our own whole-bar lead-in marker.
    const isPickup = gi === 0 && group.length === 1 && (first.implicit || first.lengthQ < first.fullQ - EPS);
    if (ext.isLeadIn || (!ownFormat && isPickup)) {
      block.isLeadIn = true;
      block.repeatLeadIn = !!ext.repeatLeadIn;
      block.quietSecondsBeforeLeadIn = ext.quietSecondsBeforeLeadIn || 0;
      if (isPickup) {
        const beats = first.lengthQ / first.beatQ;
        block.pickupBeats = Math.max(1, Math.round(beats));
        if (Math.abs(beats - block.pickupBeats) > EPS) warnings.push(`The pickup bar is ${beats.toFixed(2)} beats long - rounded to ${block.pickupBeats}.`);
      }
    }

    if (block.isRepeatEnd && last.right.repeat.times) {
      const times = parseInt(last.right.repeat.times, 10);
      if (times >= 2 && times <= 10) block.repeatPlayCount = times;
      else warnings.push(`A repeat marked to play ${times} times can't be represented (2-10 only) - left at the default.`);
    }
    const style = last.right?.style;
    if (!block.isRepeatEnd && style === 'light-heavy') block.isFinalBarline = true;
    else if (!block.isRepeatEnd && !block.isFine && (style === 'light-light' || style === 'heavy-heavy' || style === 'heavy-light')) block.isSectionBoundary = true;

    // Jumps: the explicit "al Coda" wording wins; a bare D.S./D.C. in a flow that also has a To
    // Coda can only mean "al Coda" (it's what the To Coda is for).
    const jumps = new Set(group.flatMap(b => [...b.jumps]));
    if (jumps.has('dsCoda') || (jumps.has('ds') && flowHasToCoda)) block.gotoSegnoThenCoda = true;
    else if (jumps.has('ds') || jumps.has('dsFine')) block.gotoSegno = true;
    if (jumps.has('dcCoda') || (jumps.has('dc') && flowHasToCoda)) block.gotoStartDcThenCoda = true;
    else if (jumps.has('dc') || jumps.has('dcFine')) block.gotoStartDc = true;

    // Voltas.
    const endingBar = group.findIndex(b => b.left?.ending?.type === 'start');
    const endingNode = endingBar > -1 ? group[endingBar].left.ending : (last.right?.ending || null);
    if (endingNode && !ext.legacyEndingOnly) {
      block.repeatEndingNumbers = parseEndingNumbers(endingNode);
      if (endingBar > 0) block.repeatEndingStartBar = endingBar + 1;
    }
    if (ownFormat) block.repeatEndingStartBar = ext.repeatEndingStartBar ?? null;

    // Rehearsal marks.
    group.forEach((b, offset) => b.rehearsals.forEach(mark => block.rehearsalMarks.push({ mark, barOffset: offset })));
    if (ext.legacyRehearsalMarkPrinted) {
      const i = block.rehearsalMarks.findIndex(m => m.barOffset === 0 && m.mark === ext.rehearsalMark);
      if (i > -1) block.rehearsalMarks.splice(i, 1);
    }

    // Fermatas / caesuras - standard position, app-only hold/playback from the extension.
    const extPauses = [...(ext.fermatas || [])];
    group.forEach((b, offset) => b.pauses.forEach(p => {
      const match = extPauses.findIndex(f => f.kind === p.kind && f.barOffset === offset && f.beatOffset === p.beat);
      const extra = match > -1 ? extPauses.splice(match, 1)[0] : null;
      block.fermatas.push({
        kind: p.kind, barOffset: offset, beatOffset: p.beat,
        holdBeats: extra ? extra.holdBeats : 2,
        playbackMode: p.kind === 'caesura' ? 'silent' : (extra ? extra.playbackMode : 'tone')
      });
    }));
    // Anything left in the extension had no printed position (stale offsets past the block's end).
    block.fermatas.push(...extPauses);

    // Tempo ramps.
    const extRamps = [...(ext.ramps || [])];
    const openStops = group.flatMap((b, offset) => b.rampStops.map(s => ({ ...s, offset })));
    group.forEach((b, offset) => b.rampStarts.forEach(start => {
      const stopIdx = openStops.findIndex(s => (start.number === null || s.number === start.number)
        && (s.offset > offset || (s.offset === offset && s.posQ > start.posQ + EPS)));
      const stop = stopIdx > -1 ? openStops.splice(stopIdx, 1)[0] : null;
      const match = extRamps.findIndex(r => r.startBarOffset === offset && r.startBeatOffset === start.beat);
      const extra = match > -1 ? extRamps.splice(match, 1)[0] : null;
      const ramp = { startBarOffset: offset, startBeatOffset: start.beat, endMode: 'block_end', endBarOffset: null, endBeatOffset: null, targetMode: 'next_block', targetBpm: null };
      if (stop && !(stop.offset === group.length - 1 && stop.atEnd)) {
        ramp.endMode = 'specific';
        ramp.endBarOffset = stop.atEnd ? stop.offset + 1 : stop.offset;
        ramp.endBeatOffset = stop.atEnd ? 1 : stop.beat;
        if (ramp.endBarOffset >= group.length) { ramp.endMode = 'block_end'; ramp.endBarOffset = null; ramp.endBeatOffset = null; }
      }
      if (stop && stop.quarterTempo) { ramp.targetMode = 'custom'; ramp.targetBpm = toBpm(stop.quarterTempo, denominator); }
      if (extra) {
        ramp.endMode = extra.endMode;
        ramp.endBarOffset = extra.endMode === 'specific' ? extra.endBarOffset : null;
        ramp.endBeatOffset = extra.endMode === 'specific' ? extra.endBeatOffset : null;
        ramp.targetMode = extra.targetMode;
        ramp.targetBpm = extra.targetMode === 'custom' ? (ramp.targetBpm ?? extra.targetBpm) : null;
      }
      if (ramp.endMode === 'specific' && ramp.targetMode === 'next_block') {
        warnings.push(`A speed change in block ${gi + 1} ends mid-block with no target tempo - extended to the end of the block.`);
        ramp.endMode = 'block_end'; ramp.endBarOffset = null; ramp.endBeatOffset = null;
      }
      block.ramps.push(ramp);
    }));
    block.ramps.push(...extRamps.map(r => ({
      startBarOffset: r.startBarOffset, startBeatOffset: r.startBeatOffset, endMode: r.endMode,
      endBarOffset: r.endBarOffset ?? null, endBeatOffset: r.endBeatOffset ?? null,
      targetMode: r.targetMode, targetBpm: r.targetBpm ?? null
    })));

    // Mid-block tempo changes (not ramps) can't be represented - the block keeps its opening
    // tempo, and the new one applies from the next block.
    group.forEach((b, offset) => b.tempos.filter(t => !(offset === 0 && t.posQ < EPS)).forEach(t => {
      if (t.quarterTempo) {
        if (!ownFormat) warnings.push(`A tempo change partway through bar ${b.index + 1} was moved to the start of the next block.`);
        quarterTempo = t.quarterTempo; sawTempo = true;
      }
      if (t.noteFraction) noteFraction = t.noteFraction;
    }));
    return block;
  });

  if (!sawTempo && !ownFormat) warnings.push(`No tempo marking found - using ${DEFAULT_BPM} bpm.`);
  // Blocks before the first tempo marking (typically a pickup - the tempo is usually printed on
  // bar 1) take the first marked tempo rather than the default.
  const firstMarked = blocks.findIndex(b => b.tempoMarked);
  for (let i = 0; i < firstMarked; i++) {
    const b = blocks[i];
    b.bpm = Math.max(1, Math.round(blocks[firstMarked].bpm * b.timeSignature.denominator / blocks[firstMarked].timeSignature.denominator));
  }
  for (const b of blocks) delete b.tempoMarked;
  // A 'next_block' target on the very last block has nothing to resolve to.
  const lastBlock = blocks[blocks.length - 1];
  if (lastBlock && lastBlock.ramps.some(r => r.targetMode === 'next_block') && !ownFormat) {
    warnings.push('A speed change at the very end has no following tempo to reach - removed.');
    lastBlock.ramps = lastBlock.ramps.filter(r => r.targetMode !== 'next_block');
  }
  return blocks;
}

// ---------- main entry point ----------

/**
 * @param {string} xmlString  MusicXML (partwise), already unzipped if it came from an .mxl
 * @returns {{ title, composer, arranger, publisher, description, recordings, skippedMedia,
 *             blocks, warnings: string[], ownFormat: boolean }}
 */
export function musicXmlToFlow(xmlString) {
  const parser = new XMLParser({
    ignoreAttributes: false, attributeNamePrefix: '@_', preserveOrder: true,
    trimValues: true, parseTagValue: false, parseAttributeValue: false
  });
  let doc;
  try {
    doc = parser.parse(xmlString);
  } catch {
    throw withStatus(422, "That file doesn't look like valid MusicXML.");
  }
  const root = doc.find(n => tagOf(n) === 'score-partwise');
  if (!root) {
    if (doc.some(n => tagOf(n) === 'score-timewise')) throw withStatus(422, 'Only partwise MusicXML scores are supported right now - re-export the file as standard (partwise) MusicXML.');
    throw withStatus(422, "That file doesn't look like valid MusicXML.");
  }

  const warnings = [];
  const work = child(root, 'work');
  const identification = child(root, 'identification');
  const creators = identification ? childrenOf(identification, 'creator') : [];
  const creator = (type) => textOf(creators.find(c => attr(c, 'type') === type)) || null;
  const miscFields = identification && child(identification, 'miscellaneous')
    ? childrenOf(child(identification, 'miscellaneous'), 'miscellaneous-field') : [];
  let flowExt = {};
  const flowField = miscFields.find(f => attr(f, 'name') === `${EXTENSION_PREFIX}flow`);
  if (flowField) {
    try { flowExt = JSON.parse(textOf(flowField)); } catch { warnings.push('The file\'s TheMusicLedger flow details couldn\'t be read - imported without them.'); }
  }
  if (flowExt.formatVersion > FLOW_MUSICXML_FORMAT_VERSION) {
    warnings.push(`This file was exported by a newer version of TheMusicLedger (format ${flowExt.formatVersion}) - anything newer than format ${FLOW_MUSICXML_FORMAT_VERSION} is ignored.`);
  }

  const parts = childrenOf(root, 'part');
  if (!parts.length) throw withStatus(422, 'No parts found in this score.');
  const scanned = parts.map(p => scanPart(p, warnings));
  const structure = scanned[0];
  if (!structure.length) throw withStatus(422, 'This score has no measures to import.');

  const bars = analyseBars(structure, scanned.slice(1));
  bars.forEach((bar, i) => {
    if (bar.nextSegno && bars[i + 1]) bars[i + 1].segno = true;
    if (bar.nextCoda && bars[i + 1]) bars[i + 1].codaLanding = true;
    if (bar.unplacedCoda) warnings.push(`A coda sign on the barline after bar ${i + 1} has no jump information - ignored.`);
  });
  const ownFormat = bars.some(b => b.ext);
  const flowHasToCoda = bars.some(b => b.toCoda);
  const blocks = buildBlocks(bars, ownFormat, warnings, flowHasToCoda);

  return {
    title: (work && textOf(child(work, 'work-title'))) || textOf(child(root, 'movement-title')) || null,
    composer: creator('composer') || (!creators.length ? null : (creators.some(c => attr(c, 'type')) ? null : textOf(creators[0]))),
    arranger: creator('arranger'),
    publisher: flowExt.publisher || null,
    description: flowExt.description || null,
    recordings: Array.isArray(flowExt.recordings) ? flowExt.recordings.filter(r => r && r.type === 'youtube' && r.youtubeVideoId) : [],
    skippedMedia: flowExt.skippedMedia || { recordings: 0, documents: 0 },
    blocks,
    warnings: [...new Set(warnings)],
    ownFormat
  };
}
