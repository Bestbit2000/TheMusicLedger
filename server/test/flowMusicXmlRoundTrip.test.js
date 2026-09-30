// ML-204 Phase 2: our own exports must round-trip losslessly - every fixture block -> MusicXML ->
// musicXmlToFlow -> blocks, compared after both sides go through validateSegmentPayload (the same
// normalisation every real save goes through), so "equal" means "would be stored identically".

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { flowToMusicXml } from '../services/flowMusicXml.js';
import { musicXmlToFlow } from '../services/flowMusicXmlReader.js';
import { flowFixtures, fixtureBlocksAsDtos, fixtureFlow } from './fixtures/flowFixtures.js';

// metronomeSegments.js pulls in the DB pool at import time; pg.Pool never connects until a query
// runs, so a placeholder URL is enough to load validateSegmentPayload without touching a database.
process.env.DATABASE_URL ||= 'postgresql://unit-test@localhost/none';
const { validateSegmentPayload } = await import('../services/metronomeSegments.js');

// Time signatures are compared as numerator/denominator (ids differ per branch/account), so a
// placeholder id stands in for the validation step.
function normalise(block) {
  const { timeSignature, ...rest } = block;
  return { timeSignature, ...validateSegmentPayload({ ...rest, timeSignatureId: 1, accountTimeSignatureId: null }) };
}

for (const fixture of flowFixtures) {
  test(`round-trip: ${fixture.title}`, () => {
    const xml = flowToMusicXml(fixtureFlow(fixture), fixtureBlocksAsDtos(fixture));
    const parsed = musicXmlToFlow(xml);
    assert.equal(parsed.ownFormat, true);
    assert.deepEqual(parsed.warnings, []);
    assert.equal(parsed.title, fixture.title);
    assert.equal(parsed.composer, fixture.composer || null);
    assert.equal(parsed.arranger, fixture.arranger || null);
    assert.equal(parsed.publisher, fixture.publisher || null);
    assert.equal(parsed.description, fixture.description || null);
    assert.deepEqual(parsed.recordings, fixtureFlow(fixture).recordings.map(r => ({ type: 'youtube', youtubeVideoId: r.youtubeVideoId, title: r.title })));
    assert.equal(parsed.blocks.length, fixture.blocks.length);
    parsed.blocks.forEach((block, i) => {
      assert.deepEqual(normalise(block), normalise(fixture.blocks[i]), `block ${i}`);
    });
  });
}

// ML-365: pauses between beats - a 2/2 bar counted in crotchets with a caesura after the 1st crotchet (1.5)
// and a fermata on the 4th (2.5). Standard notation gets crotchet rests with the pause on its own rest; the
// positions come back exactly, and a validation rejects anything off the quarter-beat grid.
test('round-trip: pauses between beats (2/2 counted in crotchets)', () => {
  const block = {
    barCount: 2, bpm: 80, noteValue: 'crotchet', timeSignature: { numerator: 2, denominator: 2 },
    fermatas: [
      { kind: 'caesura', barOffset: 0, beatOffset: 1.5, holdBeats: 2 },
      { kind: 'fermata', barOffset: 1, beatOffset: 2.5, holdBeats: 2, playbackMode: 'tone' }
    ], ramps: [], rehearsalMarks: []
  };
  const fixture = { title: 'Pauses between beats', blocks: [block] };
  const xml = flowToMusicXml(fixtureFlow(fixture), fixtureBlocksAsDtos(fixture));
  const firstBar = xml.slice(xml.indexOf('<measure number="1"'), xml.indexOf('</measure>') + 10);
  assert.equal((firstBar.match(/<type>quarter<\/type>/g) || []).length, 4, 'four crotchet rests');
  assert.match(firstBar, /<note>(?:(?!<\/note>)[\s\S])*<caesura\/>/);
  const parsed = musicXmlToFlow(xml);
  assert.deepEqual(parsed.warnings, []);
  assert.deepEqual(parsed.blocks[0].fermatas.map(f => f.beatOffset), [1.5, 2.5]);
  assert.deepEqual(normalise(parsed.blocks[0]), normalise(block));
  assert.throws(() => validateSegmentPayload({ ...block, timeSignatureId: 1, accountTimeSignatureId: null, fermatas: [{ kind: 'fermata', barOffset: 0, beatOffset: 1.3, holdBeats: 2 }] }), /quarter-beat steps/);
});

test('round-trip: legacy columns (single rehearsal mark, 1st/2nd-time flags, single ramp) and stale offsets', () => {
  const ts = { numerator: 4, denominator: 4 };
  const fixture = {
    title: 'Legacy',
    blocks: [
      { barCount: 2, bpm: 100, noteValue: 'crotchet', timeSignature: ts, rehearsalMark: 'Old', isRepeatStart: true },
      { barCount: 2, bpm: 100, noteValue: 'crotchet', timeSignature: ts, isFirstTimeBar: true, isRepeatEnd: true, repeatPlayCount: 2,
        rampStartBarOffset: 0, rampStartBeatOffset: 2, rampDurationBars: 1 },
      { barCount: 2, bpm: 100, noteValue: 'crotchet', timeSignature: ts, isSecondTimeBar: true, rehearsalMark: 'B',
        rehearsalMarks: [{ mark: 'B', barOffset: 0 }],
        // Stale: past the end of a 2-bar block (the block was shortened after these were set).
        repeatEndingNumbers: [2], repeatEndingStartBar: 5,
        fermatas: [{ kind: 'fermata', barOffset: 4, beatOffset: 1, holdBeats: 3, playbackMode: 'count' }],
        ramps: [{ startBarOffset: 3, startBeatOffset: 1, endMode: 'block_end', targetMode: 'custom', targetBpm: 90 }] },
      { barCount: 1, bpm: 90, noteValue: 'crotchet', timeSignature: ts, isFinalBarline: true }
    ]
  };
  const parsed = musicXmlToFlow(flowToMusicXml(fixtureFlow(fixture), fixtureBlocksAsDtos(fixture)));
  parsed.blocks.forEach((block, i) => assert.deepEqual(normalise(block), normalise(fixture.blocks[i]), `block ${i}`));
});
