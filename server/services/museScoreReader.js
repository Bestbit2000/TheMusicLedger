// ML-578: MuseScore -> Flow reader. A .mscz is a zip holding MuseScore's own XML (.mscx), as an .mxl holds
// MusicXML; musicXmlImport.js unzips it (with the same zip-bomb cap) and hands the .mscx text here.
//
// MuseScore's format isn't published and changes between versions, so only MuseScore 4 files are read; an
// older or newer file is refused with a plain message (export MusicXML from MuseScore instead). The reader
// builds, for every staff, the same per-bar lists the MusicXML reader's scanPart builds - bar lengths,
// time signatures, barlines, repeats, first/second-time bars and the markings in each bar with their
// position in quarter notes - and hands them to measuresToBlocks (flowMusicXmlReader.js). So from there on a
// MuseScore file becomes blocks in exactly the way a MusicXML file does: the same block boundaries, speeds,
// ramps, jumps, pauses and warnings. Pure - no DB access. Notes are only counted for their length.
//
// Every staff's bars are read together, as the MusicXML reader reads every part: the bars and the system
// marks (speeds, letters, repeats, signs) are the same for every part of a MuseScore score, and a fermata or
// a "rit." printed on one staff only still counts. The parts ("Excerpts" in the file) aren't read.
//
// What MuseScore 4 writes, as far as it matters here:
//  - <Score> holds the parts, then one <Staff> per staff, each a list of <Measure>s. A <Measure> may have
//    len="1/4" (a short bar - a pickup) and <irregular> (not counted), <startRepeat/>, <endRepeat>n</endRepeat>,
//    and a <Marker> (segno, coda, To Coda, Fine) or a <Jump> (D.C., D.S.). Its <voice>s hold, in order:
//    <Chord>/<Rest> (a duration each), <location> (moves the position), <TimeSig>, <Tempo> (<tempo> in beats a
//    second, quarter notes), <RehearsalMark>, <StaffText>/<SystemText>/<Expression>, <Fermata>, <Breath>,
//    <BarLine>, <Tuplet>...<endTuplet/>, and <Spanner>s: a span starts where its side with <next> is and ends
//    where its side with <prev> is (a rit./accel. is type GradualTempoChange, a first/second-time bar Volta).
//  - Fractions ("3/8") are in whole notes; positions here are in quarter notes, as in the MusicXML reader.

import { XMLParser } from 'fast-xml-parser';
import { tagOf, kids, attr, child, childrenOf, textOf, measuresToBlocks } from './flowMusicXmlReader.js';

function withStatus(status, message) {
  const err = new Error(message);
  err.status = status;
  return err;
}

const EPS = 1e-6;
export const MUSESCORE_VERSION = 4; // the major version read

// Length of each <durationType>, in whole notes.
const DURATION_WHOLE = { long: 4, breve: 2, whole: 1, half: 0.5, quarter: 0.25, eighth: 0.125, '16th': 1 / 16, '32nd': 1 / 32, '64th': 1 / 64, '128th': 1 / 128 };
const GRACE_TAGS = ['acciaccatura', 'appoggiatura', 'grace4', 'grace8', 'grace16', 'grace32', 'grace8after', 'grace16after', 'grace32after'];
// The note in a speed marking (<sym>metNoteQuarterUp</sym> = 69), as a fraction of a whole note.
const MET_NOTE = { metNoteWhole: 1, metNoteHalfUp: 0.5, metNoteQuarterUp: 0.25, metNote8thUp: 0.125, metNote16thUp: 0.0625, metNote32ndUp: 0.03125 };
// MuseScore's own placeholder text in a new score's title box - not a real title or composer.
const PLACEHOLDERS = new Set(['untitled score', 'title', 'subtitle', 'composer', 'composer / arranger', 'lyricist', 'arranger']);
// <BarLine><subtype> -> MusicXML's bar-style, which is what measuresToBlocks reads.
const BAR_STYLE = { normal: 'regular', double: 'light-light', end: 'light-heavy', 'reverse-end': 'heavy-light', heavy: 'heavy', 'double-heavy': 'heavy-heavy', dashed: 'dashed', dotted: 'dotted' };

// "3/8" -> 0.375 (whole notes)
function fraction(text) {
  const m = String(text ?? '').trim().match(/^(-?\d+)\/(\d+)$/);
  if (m) return Number(m[2]) ? Number(m[1]) / Number(m[2]) : 0;
  const n = parseFloat(text);
  return Number.isFinite(n) ? n : 0;
}

// A MuseScore text with its formatting: <br/> is a new line, <sym> a symbol (left out), anything else is
// formatting around text.
function plainText(node) {
  if (!node) return '';
  return kids(node).map(k => {
    if (k['#text'] !== undefined) return /^\s*\n\s*$/.test(String(k['#text'])) ? '' : String(k['#text']); // (not the file's own indenting)
    const t = tagOf(k);
    if (t === 'br') return '\n';
    if (t === 'sym') return '';
    return plainText(k);
  }).join('');
}
const oneLine = (s) => s.split('\n').map(x => x.replace(/\s+/g, ' ').trim()).filter(Boolean).join(' - ');
const syms = (node) => (node ? kids(node).flatMap(k => (tagOf(k) === 'sym' ? [textOf(k)] : syms(k))) : []);

// One marking at a position, in the shape the MusicXML reader's scanPart gives its directions.
function direction(posQ, extra) {
  return { kind: 'direction', posQ, words: [], rehearsals: [], segno: false, coda: false, metronome: null, dashes: [], other: [], sound: null, ...extra };
}
const noSound = { tempo: null, dacapo: false, dalsegno: false, tocoda: false, segno: false, coda: false, fine: false };
const side = () => ({ style: null, repeat: null, ending: null, segnoGlyph: false, segnoAttr: false, codaGlyph: false, codaAttr: false, fermata: false });

// A <Marker>: where it goes and what it means. MuseScore's labels: "segno"/"varsegno" the sign, "codab"/
// "varcoda"/"codetta" the Coda the jump lands on, "coda"/"tocodasym" To Coda, "fine" Fine.
function markerEvents(node, lengthQ) {
  const label = String(textOf(child(node, 'label')) || textOf(child(node, 'subtype')) || '').toLowerCase();
  const text = oneLine(plainText(child(node, 'text'))).toLowerCase();
  if (label === 'segno' || label === 'varsegno') return [direction(0, { segno: true })];
  if (label === 'codab' || label === 'varcoda' || label === 'codetta') return [direction(0, { coda: true, sound: { ...noSound, coda: true } })];
  if (label === 'fine' || (!label && /^fine\b/.test(text))) return [direction(lengthQ, { words: ['Fine'] })];
  if (label === 'coda' || label === 'tocoda' || label === 'tocodasym' || (!label && /^to coda\b/.test(text))) return [direction(lengthQ, { words: ['To Coda'] })];
  return [];
}

// A <Jump>: D.C. goes back to the start, D.S. to the sign; "al Coda" when it continues at a Coda, "al Fine"
// when it plays to the Fine. Placed at the end of its bar, as the MusicXML reader expects a jump.
function jumpEvent(node, lengthQ) {
  const to = String(textOf(child(node, 'jumpTo')) || '').toLowerCase();
  const until = String(textOf(child(node, 'playUntil')) || '').toLowerCase();
  const at = String(textOf(child(node, 'continueAt')) || '').toLowerCase();
  const text = oneLine(plainText(child(node, 'text')));
  let words = text;
  if (to) {
    words = to === 'start' ? 'D.C.' : 'D.S.';
    if (at) words += ' al Coda';
    else if (until === 'fine') words += ' al Fine';
  }
  return words ? [direction(lengthQ, { words: [words] })] : [];
}

// One staff's bars, in scanPart's shape (flowMusicXmlReader.js).
function scanStaff(staffNode, warnings, sawTime) {
  let time = null;
  const measures = [];
  const spans = { GradualTempoChange: [], Volta: [], n: 0 }; // open on this staff, in the order they started
  for (const m of childrenOf(staffNode, 'Measure')) {
    const voices = childrenOf(m, 'voice');
    // A time signature is written at the start of the bar it changes in.
    let timeChange = null;
    for (const v of voices) {
      const ts = child(v, 'TimeSig');
      const n = parseInt(textOf(child(ts || {}, 'sigN')), 10);
      const d = parseInt(textOf(child(ts || {}, 'sigD')), 10);
      if (ts && n > 0 && d > 0) { timeChange = { numerator: n, denominator: d }; break; }
    }
    if (timeChange) { time = timeChange; sawTime.value = true; }
    const t = time || { numerator: 4, denominator: 4 };
    const len = attr(m, 'len');
    const lengthQ = len ? fraction(len) * 4 : t.numerator * 4 / t.denominator;
    const out = {
      number: String(measures.length + 1), implicit: textOf(child(m, 'irregular')) === '1',
      timeChange, events: [], left: null, right: null, lengthQ, time
    };
    const left = () => (out.left = out.left || side());
    const right = () => (out.right = out.right || side());
    if (child(m, 'startRepeat')) left().repeat = { direction: 'forward' };
    const endRepeat = child(m, 'endRepeat');
    if (endRepeat) {
      const times = parseInt(textOf(endRepeat), 10);
      right().repeat = { direction: 'backward', times: Number.isFinite(times) && times !== 2 ? String(times) : undefined };
    }
    // Markers and jumps belong to the bar (MuseScore 4 writes them on the measure; inside a voice is read too).
    const barItem = (c) => {
      const tag = tagOf(c);
      if (tag === 'Marker') out.events.push(...markerEvents(c, lengthQ));
      else if (tag === 'Jump') out.events.push(...jumpEvent(c, lengthQ));
    };
    kids(m).forEach(barItem);

    for (const v of voices) {
      let pos = 0;
      let lastChordStart = 0;
      const tuplets = []; // ratios of the tuplets open at this point
      for (const c of kids(v)) {
        const tag = tagOf(c);
        if (tag === 'location') {
          pos += fraction(textOf(child(c, 'fractions'))) * 4;
        } else if (tag === 'Chord' || tag === 'Rest') {
          const type = textOf(child(c, 'durationType'));
          if (tag === 'Chord' && kids(c).some(k => GRACE_TAGS.includes(tagOf(k)))) continue;
          let dur;
          if (type === 'measure') dur = (child(c, 'duration') ? fraction(textOf(child(c, 'duration'))) * 4 : lengthQ);
          else {
            const dots = parseInt(textOf(child(c, 'dots')), 10) || 0;
            dur = (DURATION_WHOLE[type] || 0) * 4 * (2 - 1 / 2 ** dots);
            for (const r of tuplets) dur *= r;
          }
          lastChordStart = pos;
          pos += dur;
        } else if (tag === 'Tuplet') {
          const normal = parseInt(textOf(child(c, 'normalNotes')), 10);
          const actual = parseInt(textOf(child(c, 'actualNotes')), 10);
          tuplets.push(normal > 0 && actual > 0 ? normal / actual : 1);
        } else if (tag === 'endTuplet') {
          tuplets.pop();
        } else if (tag === 'Tempo') {
          const perSecond = parseFloat(textOf(child(c, 'tempo')));
          const quarterTempo = perSecond > 0 ? Math.round(perSecond * 60 * 1000) / 1000 : null;
          const textNode = child(c, 'text');
          const s = syms(textNode);
          const note = s.map(x => MET_NOTE[x]).find(Boolean);
          const fractionOfWhole = note ? note * (s.includes('metAugmentationDot') ? 1.5 : 1) : null;
          const words = oneLine(plainText(textNode)).replace(/\s*=\s*[\d.]*\s*$/, '').trim();
          out.events.push(direction(pos, {
            words: words ? [words] : [],
            metronome: fractionOfWhole && quarterTempo ? { fraction: fractionOfWhole, perMinute: quarterTempo / (fractionOfWhole * 4) } : null,
            sound: quarterTempo ? { ...noSound, tempo: quarterTempo } : null
          }));
        } else if (tag === 'RehearsalMark') {
          const mark = oneLine(plainText(child(c, 'text')));
          if (mark) out.events.push(direction(pos, { rehearsals: [mark] }));
        } else if (tag === 'StaffText' || tag === 'SystemText' || tag === 'Expression') {
          const words = oneLine(plainText(child(c, 'text')));
          if (words) out.events.push(direction(pos, { words: [words] }));
        } else if (tag === 'Fermata') {
          if (pos >= lengthQ - EPS) right().fermata = true;
          else out.events.push({ kind: 'fermata', posQ: pos });
        } else if (tag === 'Breath') {
          if (/caesura/i.test(String(textOf(child(c, 'symbol')) || ''))) out.events.push({ kind: 'caesura', posQ: lastChordStart });
        } else if (tag === 'BarLine') {
          const style = BAR_STYLE[String(textOf(child(c, 'subtype')) || '').toLowerCase()];
          if (style && pos >= lengthQ - EPS) right().style = style;
        } else if (tag === 'Spanner') {
          spanner(c, pos, { out, measures, spans, left, right });
        } else barItem(c);
      }
    }
    measures.push(out);
  }
  return measures;
}

// A rit./accel. or a first/second-time bar: its start, or its end - a side with <prev> ends the oldest one of
// its type still open on the staff.
function spanner(node, pos, { out, measures, spans, left, right }) {
  const type = attr(node, 'type');
  if (type !== 'GradualTempoChange' && type !== 'Volta') return;
  const body = child(node, type);
  if (body && child(node, 'next')) {
    // The start of the span.
    const number = `ms${++spans.n}`;
    if (type === 'GradualTempoChange') {
      const kind = String(textOf(child(body, 'tempoChangeType')) || '').toLowerCase();
      const words = oneLine(plainText(child(body, 'beginText'))) || (/accel|string/.test(kind) ? 'accel.' : 'rit.');
      out.events.push(direction(pos, { words: [words], dashes: [{ type: 'start', number }] }));
      spans.GradualTempoChange.push({ number });
    } else {
      const endings = String(textOf(child(body, 'endings')) || textOf(child(body, 'text')) || '1');
      left().ending = { number: endings, type: 'start', text: endings };
      spans.Volta.push({ number: endings, closed: textOf(child(body, 'endHookType')) !== '0' });
    }
    return;
  }
  if (!child(node, 'prev')) return;
  const span = spans[type].shift();
  if (!span) return;
  // A span that ends at the very start of a bar ends at the end of the bar before.
  const atBarStart = pos < EPS && measures.length > 0;
  const bar = atBarStart ? measures[measures.length - 1] : out;
  if (type === 'GradualTempoChange') {
    bar.events.push(direction(atBarStart ? bar.lengthQ : pos, { dashes: [{ type: 'stop', number: span.number }] }));
  } else {
    const r = atBarStart ? (bar.right = bar.right || side()) : right();
    r.ending = { number: span.number, type: span.closed ? 'stop' : 'discontinue', text: span.number };
  }
}

/**
 * @param {string} xmlString  a MuseScore .mscx, already out of its .mscz
 * @returns {{ title, composer, arranger, publisher, description, recordings, skippedMedia,
 *             blocks, warnings: string[], ownFormat: boolean }} - musicXmlToFlow's shape
 */
export function museScoreToFlow(xmlString) {
  const parser = new XMLParser({
    ignoreAttributes: false, attributeNamePrefix: '@_', preserveOrder: true,
    trimValues: false, parseTagValue: false, parseAttributeValue: false
  });
  let doc;
  try {
    doc = parser.parse(xmlString);
  } catch {
    throw withStatus(422, "That MuseScore file couldn't be read - it may be damaged.");
  }
  const root = doc.find(n => tagOf(n) === 'museScore');
  if (!root) throw withStatus(422, "That MuseScore file couldn't be read - it may be damaged.");
  const version = String(attr(root, 'version') || '');
  const major = parseInt(version, 10);
  if (!(major >= MUSESCORE_VERSION)) {
    throw withStatus(422, `That file was saved by MuseScore ${major || 'an old version'}. Open it in MuseScore 4 and save it again, or export it from MuseScore as MusicXML - then import that.`);
  }
  if (major > MUSESCORE_VERSION) {
    throw withStatus(422, `That file was saved by MuseScore ${major}, newer than this app can read yet. Export it from MuseScore as MusicXML and import that instead.`);
  }
  const score = child(root, 'Score');
  const staves = score ? childrenOf(score, 'Staff').filter(s => child(s, 'Measure')) : [];
  if (!staves.length) throw withStatus(422, 'This score has no bars to import.');

  const warnings = [];
  const sawTime = { value: false };
  const scanned = staves.map(s => scanStaff(s, warnings, sawTime));
  if (!sawTime.value) warnings.push('No time signature found - assuming 4/4.');
  const { blocks } = measuresToBlocks(scanned, warnings);

  // The title box at the top of the first staff, else the score's properties - not MuseScore's placeholders.
  const real = (s) => (s && !PLACEHOLDERS.has(s.toLowerCase()) ? s : null);
  const box = child(staves[0], 'VBox');
  const boxText = (style) => {
    const t = (box ? childrenOf(box, 'Text') : []).find(x => textOf(child(x, 'style')) === style);
    return t ? real(oneLine(plainText(child(t, 'text')))) : null;
  };
  const meta = (name) => real(oneLine(plainText(childrenOf(score, 'metaTag').find(x => attr(x, 'name') === name))));
  return {
    title: (boxText('title') || meta('workTitle') || meta('movementTitle') || '').slice(0, 120) || null,
    composer: boxText('composer') || meta('composer'),
    arranger: meta('arranger'),
    publisher: null, description: null, recordings: [], skippedMedia: { recordings: 0, documents: 0 },
    blocks,
    warnings: [...new Set(warnings)],
    ownFormat: false
  };
}
