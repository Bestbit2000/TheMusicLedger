// ML-204 fixture flows: between them, every field the Flow block editor can set. Shared by the
// codec's unit tests (server/test/flowMusicXml.test.js) and by scripts/seed-flow-fixtures.mjs,
// which creates these same flows on dev/sandbox through the real service layer (same validation
// as the UI) so they can be exported, re-imported, and opened in the app.
//
// Jumps are split across several flows because a real piece only ever has one "ending" journey -
// D.S. al Coda, D.S. al Fine, D.C. al Coda and D.C. al Fine each get their own flow.
//
// Block shape = what createFlowBlock accepts, except the time signature is given as
// { numerator, denominator } (resolved to an id at seed time by resolveBlocksForAccount).
// Offsets: fermata/ramp/rehearsal-mark barOffset is 0-based; beatOffset, repeatEndingStartBar
// and intro bar offsets are 1-based - same as the block editor itself. Intro beat offsets are
// given explicitly as 1 - validateSegmentPayload always stores 1 alongside a set intro bar anyway.

export const FIXTURE_TITLE_PREFIX = 'ML-204 fixture';

const ts = (numerator, denominator) => ({ numerator, denominator });

export const flowFixtures = [
  {
    title: `${FIXTURE_TITLE_PREFIX} A - repeats, voltas & metres`,
    composer: 'Fixture Composer',
    arranger: 'Fixture Arranger',
    publisher: 'Fixture Publisher',
    description: 'Pickup lead-in, repeats with play counts, multi-number voltas (one starting mid-block), section barlines, rehearsal marks, compound/irregular/custom metres, dotted beat notes.',
    youtube: [{ url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', title: 'Fixture reference video' }],
    blocks: [
      { isLeadIn: true, pickupBeats: 2, barCount: 1, bpm: 100, timeSignature: ts(4, 4), repeatLeadIn: true, quietSecondsBeforeLeadIn: 2 },
      { barCount: 8, bpm: 100, noteValue: 'crotchet', timeSignature: ts(4, 4), isRepeatStart: true,
        rehearsalMarks: [{ mark: 'A', barOffset: 0 }, { mark: 'A2', barOffset: 4 }], isSectionBoundary: true },
      { barCount: 4, bpm: 100, noteValue: 'crotchet', timeSignature: ts(4, 4), isRepeatStart: true,
        rehearsalMarks: [{ mark: 'B', barOffset: 0 }] },
      { barCount: 3, bpm: 100, noteValue: 'crotchet', timeSignature: ts(4, 4), repeatEndingNumbers: [1, 2], repeatEndingStartBar: 2,
        isRepeatEnd: true, repeatPlayCount: 3 },
      { barCount: 2, bpm: 100, noteValue: 'crotchet', timeSignature: ts(4, 4), repeatEndingNumbers: [3], isSectionBoundary: true },
      { barCount: 4, bpm: 180, noteValue: 'dotted-crotchet', timeSignature: ts(6, 8), rehearsalMarks: [{ mark: 'C', barOffset: 0 }],
        isRepeatStart: true, isRepeatEnd: true },
      // 11/16 isn't in the public catalog - exercises the account's own custom time signatures.
      { barCount: 2, bpm: 200, noteValue: 'semiquaver', timeSignature: ts(11, 16) },
      { barCount: 2, bpm: 210, noteValue: 'quaver', timeSignature: ts(7, 8) },
      { barCount: 2, bpm: 60, noteValue: 'dotted-minim', timeSignature: ts(3, 4) },
      { barCount: 1, bpm: 120, noteValue: null, timeSignature: ts(2, 2), isFinalBarline: true }
    ]
  },
  {
    title: `${FIXTURE_TITLE_PREFIX} B - D.S. al Coda`,
    composer: 'Fixture Composer',
    blocks: [
      { barCount: 4, bpm: 112, noteValue: 'crotchet', timeSignature: ts(4, 4), rehearsalMarks: [{ mark: 'Intro', barOffset: 0 }] },
      { barCount: 4, bpm: 112, noteValue: 'crotchet', timeSignature: ts(4, 4), isSegno: true, rehearsalMarks: [{ mark: 'A', barOffset: 0 }] },
      { barCount: 2, bpm: 112, noteValue: 'crotchet', timeSignature: ts(4, 4), gotoCoda: true },
      { barCount: 4, bpm: 112, noteValue: 'crotchet', timeSignature: ts(4, 4), gotoSegnoThenCoda: true, isSectionBoundary: true },
      { barCount: 4, bpm: 112, noteValue: 'crotchet', timeSignature: ts(4, 4), isCoda: true, isFinalBarline: true }
    ]
  },
  {
    title: `${FIXTURE_TITLE_PREFIX} C - D.S. al Fine`,
    blocks: [
      { barCount: 2, bpm: 96, noteValue: 'crotchet', timeSignature: ts(3, 4) },
      { barCount: 4, bpm: 96, noteValue: 'crotchet', timeSignature: ts(3, 4), isSegno: true },
      { barCount: 4, bpm: 96, noteValue: 'crotchet', timeSignature: ts(3, 4), isFine: true },
      { barCount: 4, bpm: 96, noteValue: 'crotchet', timeSignature: ts(3, 4), gotoSegno: true, isFinalBarline: true }
    ]
  },
  {
    title: `${FIXTURE_TITLE_PREFIX} D - D.C. al Coda`,
    blocks: [
      { barCount: 4, bpm: 132, noteValue: 'minim', timeSignature: ts(2, 2) },
      { barCount: 2, bpm: 132, noteValue: 'minim', timeSignature: ts(2, 2), gotoCoda: true },
      { barCount: 4, bpm: 132, noteValue: 'minim', timeSignature: ts(2, 2), gotoStartDcThenCoda: true, isSectionBoundary: true },
      { barCount: 2, bpm: 132, noteValue: 'minim', timeSignature: ts(2, 2), isCoda: true, isFinalBarline: true }
    ]
  },
  {
    title: `${FIXTURE_TITLE_PREFIX} E - pauses, tempo ramps, intro, D.C. al Fine`,
    description: 'Whole-bar lead-in, fermatas in all three playback modes, a caesura, accel./rit. ramps (next-block and custom targets, block-end and mid-block ends), an intro spanning two blocks.',
    blocks: [
      { isLeadIn: true, barCount: 1, bpm: 90, timeSignature: ts(3, 4) },
      { barCount: 8, bpm: 90, noteValue: 'crotchet', timeSignature: ts(3, 4), introStartBarOffset: 1, introStartBeatOffset: 1,
        fermatas: [
          { kind: 'fermata', barOffset: 3, beatOffset: 3, holdBeats: 2, playbackMode: 'tone' },
          { kind: 'caesura', barOffset: 5, beatOffset: 3, holdBeats: 2 }
        ],
        ramps: [{ startBarOffset: 6, startBeatOffset: 1, endMode: 'block_end', targetMode: 'next_block' }] },
      { barCount: 6, bpm: 120, noteValue: 'crotchet', timeSignature: ts(3, 4), introEndBarOffset: 2, introEndBeatOffset: 1,
        fermatas: [
          { kind: 'fermata', barOffset: 1, beatOffset: 1, holdBeats: 3, playbackMode: 'silent' },
          { kind: 'fermata', barOffset: 4, beatOffset: 2, holdBeats: 4, playbackMode: 'count' }
        ],
        ramps: [
          { startBarOffset: 2, startBeatOffset: 2, endMode: 'specific', endBarOffset: 3, endBeatOffset: 3, targetMode: 'custom', targetBpm: 140 },
          { startBarOffset: 4, startBeatOffset: 1, endMode: 'block_end', targetMode: 'custom', targetBpm: 80 }
        ],
        isFine: true },
      { barCount: 4, bpm: 80, noteValue: 'crotchet', timeSignature: ts(3, 4), gotoStartDc: true, isFinalBarline: true }
    ]
  }
];

// The toSegmentDto shape (what listFlowBlocks returns and flowToMusicXml expects), for tests that
// run the codec without a DB.
export function fixtureBlocksAsDtos(fixture) {
  return fixture.blocks.map((b, i) => {
    const { timeSignature, ...rest } = b;
    return {
      id: i + 1, orderIndex: i, isLeadIn: false, repeatLeadIn: false, quietSecondsBeforeLeadIn: 0, pickupBeats: null,
      noteValue: null, rehearsalMark: null, isRepeatStart: false, isRepeatEnd: false, isSectionBoundary: false,
      isFinalBarline: false, repeatPlayCount: null, gotoCoda: false, gotoStartDc: false, isCoda: false, isSegno: false,
      gotoSegno: false, gotoSegnoThenCoda: false, gotoStartDcThenCoda: false, isFine: false,
      isFirstTimeBar: false, isSecondTimeBar: false, repeatEndingNumbers: [], repeatEndingStartBar: null,
      introStartBarOffset: null, introStartBeatOffset: null, introEndBarOffset: null, introEndBeatOffset: null,
      rampStartBarOffset: null, rampStartBeatOffset: null, rampDurationBars: null,
      fermatas: [], ramps: [], rehearsalMarks: [],
      ...rest,
      numerator: timeSignature.numerator, denominator: timeSignature.denominator
    };
  });
}

export function fixtureFlow(fixture) {
  return {
    title: fixture.title, composer: fixture.composer || null, arranger: fixture.arranger || null,
    publisher: fixture.publisher || null, description: fixture.description || null,
    recordings: (fixture.youtube || []).map(y => ({ type: 'youtube', title: y.title, youtubeVideoId: y.url.split('v=')[1] })),
    documents: []
  };
}
