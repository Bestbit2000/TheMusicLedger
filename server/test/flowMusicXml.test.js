// ML-204 Phase 1: flowToMusicXml writer tests. Pure - no DB. Run with `npm test` (in server/) or
// `node --test server/test/` from the repo root.
//
// Phase 2 adds the reader (musicXmlToFlow) and a full round-trip test (every fixture block ->
// MusicXML -> blocks, compared field by field); until then these check the writer's output
// directly against what each fixture should produce.

import { test } from 'node:test';
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { XMLParser, XMLValidator } from 'fast-xml-parser';
import {
  flowToMusicXml, quarterTempo, displayedBpm, musicXmlFileName, EXTENSION_PREFIX, FLOW_MUSICXML_FORMAT_VERSION
} from '../services/flowMusicXml.js';
import { flowFixtures, fixtureBlocksAsDtos, fixtureFlow } from './fixtures/flowFixtures.js';

const ARRAY_TAGS = new Set(['measure', 'direction', 'direction-type', 'note', 'barline', 'creator', 'miscellaneous-field']);
const parser = new XMLParser({
  ignoreAttributes: false, attributeNamePrefix: '@_', trimValues: true,
  isArray: (name) => ARRAY_TAGS.has(name)
});

function render(fixture) {
  const xml = flowToMusicXml(fixtureFlow(fixture), fixtureBlocksAsDtos(fixture), { appVersion: 'test', encodingDate: '2026-09-23' });
  const valid = XMLValidator.validate(xml);
  assert.equal(valid, true, `not well-formed XML: ${JSON.stringify(valid)}`);
  const score = parser.parse(xml)['score-partwise'];
  return { xml, score, measures: score.part.measure };
}
const byTitle = (suffix) => flowFixtures.find(f => f.title.endsWith(suffix));

function extensionOf(measure) {
  for (const d of measure.direction || []) {
    for (const t of d['direction-type']) {
      const other = t['other-direction'];
      const text = typeof other === 'string' ? other : other?.['#text'];
      if (text && text.startsWith(EXTENSION_PREFIX)) return JSON.parse(text.slice(EXTENSION_PREFIX.length));
    }
  }
  return null;
}
function directionTypes(measure) { return (measure.direction || []).flatMap(d => d['direction-type']); }
function wordsIn(measure) { return directionTypes(measure).map(t => t.words).filter(Boolean); }
function sounds(measure) { return (measure.direction || []).map(d => d.sound).filter(Boolean); }
function barline(measure, location) { return (measure.barline || []).find(b => b['@_location'] === location); }

test('every fixture renders to well-formed MusicXML with one measure per bar', () => {
  for (const fixture of flowFixtures) {
    const { measures } = render(fixture);
    const expected = fixture.blocks.reduce((sum, b) => sum + (b.isLeadIn && b.pickupBeats ? 1 : b.barCount), 0);
    assert.equal(measures.length, expected, fixture.title);
  }
});

test('each block starts with exactly one extension marker, numbered in order', () => {
  for (const fixture of flowFixtures) {
    const { measures } = render(fixture);
    const markers = measures.map(extensionOf).filter(Boolean);
    assert.deepEqual(markers.map(m => m.block), fixture.blocks.map((_, i) => i), fixture.title);
  }
});

test('flow metadata: title/composer/arranger standard, publisher/description/YouTube in the extension', () => {
  const { score } = render(byTitle('A - repeats, voltas & metres'));
  assert.equal(score.work['work-title'], byTitle('A - repeats, voltas & metres').title);
  const creators = Object.fromEntries(score.identification.creator.map(c => [c['@_type'], c['#text']]));
  assert.deepEqual(creators, { composer: 'Fixture Composer', arranger: 'Fixture Arranger' });
  const field = score.identification.miscellaneous['miscellaneous-field'].find(f => f['@_name'] === `${EXTENSION_PREFIX}flow`);
  const ext = JSON.parse(field['#text']);
  assert.equal(ext.formatVersion, FLOW_MUSICXML_FORMAT_VERSION);
  assert.equal(ext.publisher, 'Fixture Publisher');
  assert.match(ext.description, /Pickup lead-in/);
  assert.deepEqual(ext.recordings, [{ type: 'youtube', youtubeVideoId: 'dQw4w9WgXcQ', title: 'Fixture reference video' }]);
});

test('pickup lead-in is an implicit bar 0 of per-beat rests, with lead-in settings in the extension', () => {
  const { measures } = render(byTitle('A - repeats, voltas & metres'));
  const pickup = measures[0];
  assert.equal(pickup['@_number'], '0');
  assert.equal(pickup['@_implicit'], 'yes');
  assert.equal(pickup.note.length, 2);
  assert.deepEqual(extensionOf(pickup), { block: 0, isLeadIn: true, repeatLeadIn: true, quietSecondsBeforeLeadIn: 2, noteValueUnset: true });
  assert.equal(measures[1]['@_number'], '1');
});

test('whole-bar lead-in is a normal bar flagged only by the extension', () => {
  const { measures } = render(byTitle('E - pauses, tempo ramps, intro, D.C. al Fine'));
  assert.equal(measures[0]['@_implicit'], undefined);
  assert.equal(measures[0].note.length, 1);
  assert.equal(measures[0].note[0].rest['@_measure'], 'yes');
  assert.equal(extensionOf(measures[0]).isLeadIn, true);
});

test('repeats, play counts, voltas (incl. mid-block start and multi-number) and barline styles', () => {
  const { measures } = render(byTitle('A - repeats, voltas & metres'));
  // measures: 0 pickup | 1-8 block1 | 9-12 block2 | 13-15 block3 | 16-17 block4 | 18-21 block5 ...
  assert.equal(barline(measures[1], 'left').repeat['@_direction'], 'forward');
  assert.equal(barline(measures[8], 'right')['bar-style'], 'light-light');
  // block 3's volta starts at its bar 2 (repeatEndingStartBar), not its first bar
  assert.equal(barline(measures[13], 'left'), undefined);
  const voltaStart = barline(measures[14], 'left').ending;
  assert.equal(voltaStart['@_number'], '1, 2');
  assert.equal(voltaStart['@_type'], 'start');
  const block3End = barline(measures[15], 'right');
  assert.equal(block3End.ending['@_type'], 'stop');
  assert.equal(block3End.repeat['@_direction'], 'backward');
  assert.equal(block3End.repeat['@_times'], '3');
  assert.equal(barline(measures[16], 'left').ending['@_number'], '3');
  assert.equal(barline(measures[17], 'right').ending['@_type'], 'discontinue');
  // a 2x repeat (the default) doesn't print a times attribute
  assert.equal(barline(measures[21], 'right').repeat['@_times'], undefined);
  const last = measures[measures.length - 1];
  assert.equal(barline(last, 'right')['bar-style'], 'light-heavy');
});

test('rehearsal marks land on their own bar offsets', () => {
  const { measures } = render(byTitle('A - repeats, voltas & metres'));
  const marks = measures.map(m => directionTypes(m).map(t => t.rehearsal).filter(Boolean));
  assert.deepEqual(marks[1], ['A']);
  assert.deepEqual(marks[5], ['A2']);
  assert.deepEqual(marks[9], ['B']);
  assert.deepEqual(marks[18], ['C']);
});

test('tempo: stored bpm counts the denominator note; metronome shows the block\'s own beat-note label', () => {
  assert.equal(quarterTempo(180, 8), 90);
  assert.equal(displayedBpm(180, 8, 'dotted-crotchet'), 60);
  assert.equal(displayedBpm(200, 16, 'semiquaver'), 200);
  const { measures } = render(byTitle('A - repeats, voltas & metres'));
  const sixEight = measures[18];
  assert.deepEqual(sixEight.attributes.time, { beats: 6, 'beat-type': 8 });
  const metro = directionTypes(sixEight).find(t => t.metronome).metronome;
  assert.equal(metro['beat-unit'], 'quarter');
  assert.equal(metro['beat-unit-dot'], '');
  assert.equal(metro['per-minute'], 60);
  assert.equal(sounds(sixEight)[0]['@_tempo'], '90');
  // an unchanged tempo isn't restated on the next block
  assert.equal(directionTypes(measures[9]).some(t => t.metronome), false);
});

test('D.S. al Coda: segno and coda signs on their blocks, jumps with playback attributes at block ends', () => {
  const { measures } = render(byTitle('B - D.S. al Coda'));
  assert.ok(directionTypes(measures[4]).some(t => t.segno !== undefined));
  assert.equal(sounds(measures[4]).find(s => s['@_segno'])['@_segno'], 'segno');
  assert.deepEqual(wordsIn(measures[9]), ['To Coda']);
  assert.equal(sounds(measures[9]).find(s => s['@_tocoda'])['@_tocoda'], 'coda');
  assert.deepEqual(wordsIn(measures[13]), ['D.S. al Coda']);
  assert.equal(sounds(measures[13]).find(s => s['@_dalsegno'])['@_dalsegno'], 'segno');
  assert.ok(directionTypes(measures[14]).some(t => t.coda !== undefined));
});

test('D.S. al Fine, D.C. al Coda and D.C. al Fine', () => {
  const c = render(byTitle('C - D.S. al Fine')).measures;
  assert.deepEqual(wordsIn(c[9]), ['Fine']);
  assert.equal(sounds(c[9]).find(s => s['@_fine'])['@_fine'], 'yes');
  assert.equal(barline(c[9], 'right')['bar-style'], 'light-light');
  assert.deepEqual(wordsIn(c[13]), ['D.S.']);

  const d = render(byTitle('D - D.C. al Coda')).measures;
  assert.deepEqual(wordsIn(d[5]), ['To Coda']);
  assert.deepEqual(wordsIn(d[9]), ['D.C. al Coda']);
  assert.equal(sounds(d[9]).find(s => s['@_dacapo'])['@_dacapo'], 'yes');

  const e = render(byTitle('E - pauses, tempo ramps, intro, D.C. al Fine')).measures;
  assert.deepEqual(wordsIn(e[e.length - 1]), ['D.C.']);
});

test('fermatas and caesuras sit on their beat; hold length and playback mode ride in the extension', () => {
  const { measures } = render(byTitle('E - pauses, tempo ramps, intro, D.C. al Fine'));
  // measures: 0 lead-in | 1-8 block1 | 9-14 block2 | 15-18 block3
  const fermataBar = measures[1 + 3];
  assert.equal(fermataBar.note.length, 3);
  assert.ok(fermataBar.note[2].notations.fermata !== undefined);
  assert.equal(fermataBar.note[0].notations, undefined);
  const caesuraBar = measures[1 + 5];
  assert.ok(caesuraBar.note[2].notations.articulations.caesura !== undefined);
  // a caesura is always silent (validateSegmentPayload forces it), even when the input omits it
  assert.equal(extensionOf(measures[1]).fermatas[1].playbackMode, 'silent');
  const ext = extensionOf(measures[9]);
  assert.deepEqual(ext.fermatas, [
    { kind: 'fermata', barOffset: 1, beatOffset: 1, holdBeats: 3, playbackMode: 'silent' },
    { kind: 'fermata', barOffset: 4, beatOffset: 2, holdBeats: 4, playbackMode: 'count' }
  ]);
  assert.equal(extensionOf(measures[1]).introStartBarOffset, 1);
  assert.equal(ext.introEndBarOffset, 2);
});

test('tempo ramps: accel./rit. words with dashes, stop carries the target tempo', () => {
  const { measures } = render(byTitle('E - pauses, tempo ramps, intro, D.C. al Fine'));
  // block 1 ramp: bar offset 6 beat 1 -> block end, target = next block (120 > 90: accel.)
  assert.deepEqual(wordsIn(measures[1 + 6]), ['accel.']);
  const block1Stop = sounds(measures[8]).find(s => s['@_tempo']);
  assert.equal(block1Stop['@_tempo'], '120');
  // block 2 ramp 1: bar offset 2 beat 2 -> bar offset 3 beat 3, custom 140 (accel.)
  const b2 = measures[9 + 2];
  assert.equal(b2.note.length, 3);
  assert.deepEqual(wordsIn(b2), ['accel.']);
  const stopBar = measures[9 + 3];
  assert.equal(sounds(stopBar).find(s => s['@_tempo'])['@_tempo'], '140');
  // block 2 ramp 2: custom 80 from 120 -> rit.
  assert.deepEqual(wordsIn(measures[9 + 4]), ['rit.']);
  const ext = extensionOf(measures[9]);
  assert.deepEqual(ext.ramps[0], { startBarOffset: 2, startBeatOffset: 2, endMode: 'specific', endBarOffset: 3, endBeatOffset: 3, targetMode: 'custom', targetBpm: 140 });
  assert.deepEqual(extensionOf(measures[1]).ramps[0], { startBarOffset: 6, startBeatOffset: 1, endMode: 'block_end', targetMode: 'next_block' });
});

test('special characters in titles and marks are escaped', () => {
  const fixture = { title: 'Rock & Roll <live> "encore"', blocks: [{ barCount: 1, bpm: 100, timeSignature: { numerator: 4, denominator: 4 }, rehearsalMarks: [{ mark: 'A&B', barOffset: 0 }] }] };
  const { score, measures } = render(fixture);
  assert.equal(score.work['work-title'], 'Rock & Roll <live> "encore"');
  assert.deepEqual(directionTypes(measures[0]).map(t => t.rehearsal).filter(Boolean), ['A&B']);
});

// The committed files in fixtures/musicxml/ were exported from the fixture flows as seeded on dev
// (scripts/seed-flow-fixtures.mjs, then scripts/export-flow-musicxml.mjs --fixtures) - so this also
// proves the DB path (service validation -> listFlowBlocks -> writer) produces exactly what the
// fixture definitions do. A deliberate writer change means re-exporting them.
test('committed fixture .musicxml files match a fresh render', () => {
  const stripEncoding = (s) => s.replace(/<encoding>.*?<\/encoding>/, '');
  for (const fixture of flowFixtures) {
    const file = new URL(`./fixtures/musicxml/${musicXmlFileName(fixture.title)}`, import.meta.url);
    const committed = fs.readFileSync(file, 'utf8');
    const fresh = flowToMusicXml(fixtureFlow(fixture), fixtureBlocksAsDtos(fixture));
    assert.equal(stripEncoding(fresh), stripEncoding(committed), fixture.title);
  }
});
