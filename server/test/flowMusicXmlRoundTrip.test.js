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
