// ML-204 Phase 2: reading MusicXML that ISN'T our own export - what "Create from file" and PDF/OMR
// import actually receive. Expected blocks are written out in full so any change in how a real
// file is interpreted shows up here as a deliberate diff.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { flowToMusicXml } from '../services/flowMusicXml.js';
import { musicXmlToFlow } from '../services/flowMusicXmlReader.js';
import { flowFixtures, fixtureBlocksAsDtos, fixtureFlow } from './fixtures/flowFixtures.js';
import { assertValidMusicXml } from './helpers/musicXmlSchema.js';

const read = (name) => fs.readFileSync(new URL(`./fixtures/musicxml-foreign/${name}`, import.meta.url), 'utf8');

// Just the fields that are set - keeps the expectations below readable.
function brief(block) {
  const out = {};
  for (const [k, v] of Object.entries(block)) {
    if (v === null || v === false || v === 0 || (Array.isArray(v) && !v.length)) continue;
    out[k] = k === 'timeSignature' ? `${v.numerator}/${v.denominator}` : v;
  }
  return out;
}
const ramp = (r) => ({ endMode: 'block_end', endBarOffset: null, endBeatOffset: null, targetMode: 'next_block', targetBpm: null, ...r });
const pause = (p) => ({ kind: 'fermata', holdBeats: 2, playbackMode: 'tone', ...p });
const base = (ts, bpm, noteValue) => ({ timeSignature: ts, bpm, noteValue });

test('the hand-written foreign fixtures are themselves valid MusicXML 4.0', async () => {
  for (const name of ['notation-app-style.musicxml', 'omr-style.musicxml']) await assertValidMusicXml(read(name), name);
});

test('notation-app style: multi-part, chords, pickup, words-only jumps, one-staff fermata, deduped marks', () => {
  const parsed = musicXmlToFlow(read('notation-app-style.musicxml'));
  assert.equal(parsed.ownFormat, false);
  assert.equal(parsed.title, 'Notation App Style');
  assert.equal(parsed.composer, 'Test Composer');
  assert.equal(parsed.arranger, 'Test Arranger');
  assert.deepEqual(parsed.warnings, []);
  const q = base('3/4', 120, 'crotchet');
  assert.deepEqual(parsed.blocks.map(brief), [
    // the pickup takes bar 1's tempo ("c. 120", no <sound tempo>)
    { ...q, barCount: 1, isLeadIn: true, pickupBeats: 1 },
    // rehearsal mark A printed on both parts - read once
    { ...q, barCount: 1, rehearsalMarks: [{ mark: 'A', barOffset: 0 }], isRepeatStart: true },
    // fermata on the piano part only, bar 2 of the block, beat 2
    { ...q, barCount: 2, isSegno: true, fermatas: [pause({ barOffset: 1, beatOffset: 2 })] },
    { ...q, barCount: 1, isRepeatEnd: true, repeatEndingNumbers: [1] },
    { ...q, barCount: 1, repeatEndingNumbers: [2] },
    // "To" + coda glyph, no <sound tocoda>
    { ...q, barCount: 1, gotoCoda: true },
    // "D.S. al Coda" as words only
    { ...q, barCount: 2, isSectionBoundary: true, gotoSegnoThenCoda: true },
    // "rit." on both parts -> one ramp; the stop's metronome mark is its target
    { ...q, barCount: 2, isFinalBarline: true, isCoda: true, ramps: [ramp({ startBarOffset: 0, startBeatOffset: 2, targetMode: 'custom', targetBpm: 80 })] }
  ]);
});

test('OMR style: playback-only jumps, bare <sound tempo>, composite metre, barline fermata, caesura, warnings', () => {
  const parsed = musicXmlToFlow(read('omr-style.musicxml'));
  assert.equal(parsed.title, null);
  assert.deepEqual(parsed.warnings, [
    'A tempo change partway through bar 3 was moved to the start of the next block.',
    "A repeat marked to play 11 times can't be represented (2-10 only) - left at the default."
  ]);
  assert.deepEqual(parsed.blocks.map(brief), [
    { ...base('4/4', 96, 'crotchet'), barCount: 2, fermatas: [pause({ barOffset: 1, beatOffset: 4 })] },
    { ...base('4/4', 96, 'crotchet'), barCount: 1, rehearsalMarks: [{ mark: 'B', barOffset: 0 }],
      fermatas: [pause({ kind: 'caesura', barOffset: 0, beatOffset: 3, playbackMode: 'silent' })] },
    // 3+3/8 with "dotted crotchet = 60" / <sound tempo="90">: stored bpm counts quavers
    { ...base('6/8', 180, 'dotted-crotchet'), barCount: 2, isRepeatEnd: true, isFine: true },
    // <sound dacapo> only, no To Coda anywhere -> plain D.C.
    { ...base('6/8', 180, 'dotted-crotchet'), barCount: 1, isFinalBarline: true, gotoStartDc: true }
  ]);
});

test('the existing demo score still imports the same way it did before the new reader', () => {
  const xml = fs.readFileSync(new URL('../../public/demo-scores/simple-test-tune.musicxml', import.meta.url), 'utf8');
  const parsed = musicXmlToFlow(xml);
  assert.equal(parsed.title, 'Simple Test Tune');
  assert.deepEqual(parsed.blocks.map(brief), [
    { ...base('4/4', 120, 'crotchet'), barCount: 4, isRepeatStart: true, isRepeatEnd: true },
    { ...base('4/4', 120, 'crotchet'), barCount: 1, rehearsalMarks: [{ mark: 'B', barOffset: 0 }] },
    { ...base('3/4', 120, 'crotchet'), barCount: 2 },
    { ...base('4/4', 140, 'crotchet'), barCount: 2, isFinalBarline: true }
  ]);
});

// Our own files with every extension stripped out - i.e. exactly what a notation app would keep if
// someone opened one of our exports, edited it, and saved it back. Everything standard MusicXML
// can express must survive; what's lost is only the app-only data (whole-bar lead-in, intro,
// fermata hold/playback, and block splits between otherwise-identical bars).
test('own exports with the extension data stripped still carry every standard marking', () => {
  const strip = (xml) => xml
    .replace(/<direction><direction-type><other-direction print-object="no">[^<]*<\/other-direction><\/direction-type><\/direction>/g, '')
    .replace(/<miscellaneous>.*?<\/miscellaneous>/s, '');
  const byTitle = (suffix) => flowFixtures.find(f => f.title.endsWith(suffix));
  const parse = (fixture) => musicXmlToFlow(strip(flowToMusicXml(fixtureFlow(fixture), fixtureBlocksAsDtos(fixture))));

  const a = parse(byTitle('A - repeats, voltas & metres'));
  assert.equal(a.ownFormat, false);
  assert.deepEqual(a.warnings, []);
  const c = base('4/4', 100, 'crotchet');
  assert.deepEqual(a.blocks.map(brief), [
    { ...c, barCount: 1, isLeadIn: true, pickupBeats: 2 },
    { ...c, barCount: 4, rehearsalMarks: [{ mark: 'A', barOffset: 0 }], isRepeatStart: true },
    { ...c, barCount: 4, rehearsalMarks: [{ mark: 'A2', barOffset: 0 }], isSectionBoundary: true },
    // the volta starts at bar 2 of the original block, so bar 1 joins the block before it
    { ...c, barCount: 5, rehearsalMarks: [{ mark: 'B', barOffset: 0 }], isRepeatStart: true },
    { ...c, barCount: 2, isRepeatEnd: true, repeatPlayCount: 3, repeatEndingNumbers: [1, 2] },
    { ...c, barCount: 2, isSectionBoundary: true, repeatEndingNumbers: [3] },
    { ...base('6/8', 180, 'dotted-crotchet'), barCount: 4, rehearsalMarks: [{ mark: 'C', barOffset: 0 }], isRepeatStart: true, isRepeatEnd: true },
    { ...base('11/16', 200, 'semiquaver'), barCount: 2 },
    { ...base('7/8', 210, 'quaver'), barCount: 2 },
    { ...base('3/4', 60, 'dotted-minim'), barCount: 2 },
    { ...base('2/2', 120, 'minim'), barCount: 1, isFinalBarline: true }
  ]);

  const e = parse(byTitle('E - pauses, tempo ramps, intro, D.C. al Fine'));
  const t = base('3/4', 90, 'crotchet');
  assert.deepEqual(e.blocks.map(brief), [
    // the whole-bar lead-in is app-only, so it merges into the first block
    { ...t, barCount: 9,
      fermatas: [pause({ barOffset: 4, beatOffset: 3 }), pause({ kind: 'caesura', barOffset: 6, beatOffset: 3, playbackMode: 'silent' })],
      // 'next_block' is app-only; the printed target is the next block's actual speed
      ramps: [ramp({ startBarOffset: 7, startBeatOffset: 1, targetMode: 'custom', targetBpm: 120 })] },
    { ...base('3/4', 120, 'crotchet'), barCount: 6, isFine: true,
      fermatas: [pause({ barOffset: 1, beatOffset: 1 }), pause({ barOffset: 4, beatOffset: 2 })],
      ramps: [
        ramp({ startBarOffset: 2, startBeatOffset: 2, endMode: 'specific', endBarOffset: 3, endBeatOffset: 3, targetMode: 'custom', targetBpm: 140 }),
        ramp({ startBarOffset: 4, startBeatOffset: 1, targetMode: 'custom', targetBpm: 80 })
      ] },
    { ...base('3/4', 80, 'crotchet'), barCount: 4, isFinalBarline: true, gotoStartDc: true }
  ]);

  for (const suffix of ['B - D.S. al Coda', 'C - D.S. al Fine', 'D - D.C. al Coda']) {
    const original = byTitle(suffix).blocks;
    const parsed = parse(byTitle(suffix)).blocks;
    // same total length and the same set of jump/sign/barline markings, however the bars group
    const flags = (blocks) => ['isSegno', 'isCoda', 'gotoCoda', 'gotoSegno', 'gotoSegnoThenCoda', 'gotoStartDc', 'gotoStartDcThenCoda', 'isFine', 'isSectionBoundary', 'isFinalBarline']
      .filter(k => blocks.some(b => b[k]));
    assert.equal(parsed.reduce((s, b) => s + b.barCount, 0), original.reduce((s, b) => s + b.barCount, 0), suffix);
    assert.deepEqual(flags(parsed), flags(original), suffix);
  }
});
