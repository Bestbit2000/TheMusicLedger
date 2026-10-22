// ML-578: a piece from a MuseScore file. The score here is home-made, written the way MuseScore 4 writes its
// .mscx, so it can live in the repository (the owner's own test files are someone else's music and are run by
// hand - docs/flow-musicxml.md, "MuseScore files").
import test from 'node:test';
import assert from 'node:assert/strict';
import JSZip from 'jszip';
import { museScoreToFlow } from '../services/museScoreReader.js';

// musicXmlImport.js imports the DB pool, which refuses to load without a connection string. Nothing
// here queries it, so any well-formed value will do.
process.env.DATABASE_URL ??= 'postgres://test:test@localhost:5432/test';
const { extractScoreText, importMusicXmlFile } = await import('../services/musicXmlImport.js');

const rest = (type = 'quarter') => `<Rest><durationType>${type}</durationType></Rest>`;
const measureRest = (d) => `<Rest><durationType>measure</durationType><duration>${d}</duration></Rest>`;
const timeSig = (n, d) => `<TimeSig><sigN>${n}</sigN><sigD>${d}</sigD></TimeSig>`;
const tempo = (perSecond, text) => `<Tempo><tempo>${perSecond}</tempo><followText>1</followText><text>${text}</text></Tempo>`;
const measure = (inner, { attrs = '', before = '' } = {}) => `<Measure${attrs}>${before}<voice>${inner}</voice></Measure>`;

// Eight bars, two staves:
//  1 a crotchet pickup (len 1/4), 4/4, crotchet = 120
//  2 start repeat, letter A
//  3 first-time bar, end repeat
//  4 second-time bar (open), a double barline
//  5 3/4, crotchet = 90, the sign, a rit. from beat 2 to the end of bar 6
//  6 To Coda (a fermata on beat 1 on the second staff only)
//  7 crotchet = 60, a fermata on beat 3, D.S. al Coda
//  8 the Coda, a caesura after beat 1, the final barline
function staff1() {
  return [
    `<VBox><Text><style>title</style><text>Home-made March<br/><b><font size="17"/>1. Allegro</b></text></Text><Text><style>composer</style><text>A. Tester</text></Text></VBox>`,
    measure(timeSig(4, 4) + tempo(2, 'Allegro <sym>metNoteQuarterUp</sym><font face="Edwin"/> = 120') + rest(), { attrs: ' len="1/4"', before: '<irregular>1</irregular>' }),
    measure(`<RehearsalMark><text>A</text></RehearsalMark>${measureRest('4/4')}`, { before: '<startRepeat/>' }),
    measure(`<Spanner type="Volta"><Volta><endHookType>1</endHookType><beginText>1.</beginText><endings>1</endings></Volta><next><location><measures>1</measures></location></next></Spanner>${measureRest('4/4')}`, { before: '<endRepeat>2</endRepeat>' }),
    measure(`<Spanner type="Volta"><prev><location><measures>-1</measures></location></prev></Spanner><Spanner type="Volta"><Volta><endHookType>0</endHookType><beginText>2.</beginText><endings>2</endings></Volta><next><location><measures>1</measures></location></next></Spanner>${measureRest('4/4')}<BarLine><subtype>double</subtype></BarLine>`),
    measure(`<Spanner type="Volta"><prev><location><measures>-1</measures></location></prev></Spanner>${timeSig(3, 4)}<Marker><style>repeat-left</style><text><sym>segno</sym></text><label>segno</label></Marker>${tempo(1.5, '<sym>metNoteQuarterUp</sym> = 90')}${rest()}<Spanner type="GradualTempoChange"><GradualTempoChange><tempoChangeType>ritardando</tempoChangeType><beginText>rit.</beginText></GradualTempoChange><next><location><measures>2</measures><fractions>-1/4</fractions></location></next></Spanner>${rest('half')}`),
    measure(`${measureRest('3/4')}<Marker><style>repeat-right</style><text>To Coda</text><label>coda</label></Marker>`),
    measure(`<Spanner type="GradualTempoChange"><prev><location><measures>-2</measures><fractions>1/4</fractions></location></prev></Spanner>${tempo(1, '<sym>metNoteQuarterUp</sym> = 60')}${rest()}${rest()}<Fermata><subtype>fermataAbove</subtype></Fermata>${rest()}<Jump><text>D.S. al Coda</text><jumpTo>segno</jumpTo><playUntil>coda</playUntil><continueAt>codab</continueAt></Jump>`),
    measure(`<Marker><style>repeat-left</style><text><sym>coda</sym></text><label>codab</label></Marker><Chord><durationType>quarter</durationType><Note><pitch>60</pitch></Note></Chord><Breath><symbol>caesura</symbol></Breath>${rest()}${rest()}<BarLine><subtype>end</subtype></BarLine>`)
  ].join('');
}
function staff2() {
  return [
    measure(rest(), { attrs: ' len="1/4"', before: '<irregular>1</irregular>' }),
    measure(measureRest('4/4')), measure(measureRest('4/4')), measure(measureRest('4/4')), measure(measureRest('3/4')),
    measure(`<Fermata><subtype>fermataAbove</subtype></Fermata>${measureRest('3/4')}`),
    // a tuplet (three quavers in the time of two) and a dotted crotchet still add up to the bar
    measure(`<Tuplet><normalNotes>2</normalNotes><actualNotes>3</actualNotes><baseNote>eighth</baseNote></Tuplet>${rest('eighth')}${rest('eighth')}${rest('eighth')}<endTuplet/><Rest><dots>1</dots><durationType>quarter</durationType></Rest>${rest('eighth')}`),
    measure(measureRest('3/4'))
  ].join('');
}
const score = (version = '4.70') => `<?xml version="1.0" encoding="UTF-8"?>
<museScore version="${version}">
  <programVersion>4.7.5</programVersion>
  <Score>
    <metaTag name="composer">Composer / arranger</metaTag>
    <metaTag name="workTitle">Untitled score</metaTag>
    <Part id="1"><Staff id="1"><StaffType group="pitched"/></Staff><trackName>Cornet</trackName></Part>
    <Part id="2"><Staff id="2"><StaffType group="pitched"/></Staff><trackName>Horn</trackName></Part>
    <Staff id="1">${staff1()}</Staff>
    <Staff id="2">${staff2()}</Staff>
  </Score>
</museScore>`;

test('ML-578: a MuseScore 4 score becomes blocks the way MusicXML does', () => {
  const r = museScoreToFlow(score());
  assert.equal(r.title, 'Home-made March - 1. Allegro');
  assert.equal(r.composer, 'A. Tester'); // the title box, not MuseScore's "Composer / arranger" placeholder
  assert.deepEqual(r.warnings, []);
  const b = r.blocks;
  assert.deepEqual(b.map(x => x.barCount), [1, 1, 1, 1, 2, 1, 1]);
  assert.equal(b.reduce((s, x) => s + x.barCount, 0), 8);
  assert.deepEqual(b.map(x => `${x.timeSignature.numerator}/${x.timeSignature.denominator}`), ['4/4', '4/4', '4/4', '4/4', '3/4', '3/4', '3/4']);
  assert.deepEqual(b.map(x => x.bpm), [120, 120, 120, 120, 90, 60, 60]);

  assert.equal(b[0].isLeadIn, true); // the pickup
  assert.equal(b[1].isRepeatStart, true);
  assert.deepEqual(b[1].rehearsalMarks, [{ mark: 'A', barOffset: 0 }]);
  assert.equal(b[2].isRepeatEnd, true);
  assert.deepEqual(b[2].repeatEndingNumbers, [1]);
  assert.deepEqual(b[3].repeatEndingNumbers, [2]);
  assert.equal(b[3].isSectionBoundary, true); // the double barline

  assert.equal(b[4].isSegno, true);
  assert.equal(b[4].gotoCoda, true);
  assert.deepEqual(b[4].ramps.map(x => [x.startBarOffset, x.startBeatOffset, x.endMode, x.targetMode]), [[0, 2, 'block_end', 'next_block']]);
  assert.deepEqual(b[4].fermatas.map(x => [x.kind, x.barOffset, x.beatOffset]), [['fermata', 1, 1]]); // from the second staff

  assert.deepEqual(b[5].fermatas.map(x => [x.kind, x.barOffset, x.beatOffset]), [['fermata', 0, 3]]);
  assert.equal(b[5].gotoSegnoThenCoda, true); // D.S. al Coda

  assert.equal(b[6].isCoda, true);
  assert.equal(b[6].isFinalBarline, true);
  assert.deepEqual(b[6].fermatas.map(x => [x.kind, x.barOffset, x.beatOffset]), [['caesura', 0, 1]]);
});

test('ML-578: a file from an older or newer MuseScore is refused in plain words', () => {
  assert.throws(() => museScoreToFlow(score('3.02')), (e) => e.status === 422 && /MuseScore 3\. Open it in MuseScore 4/.test(e.message));
  assert.throws(() => museScoreToFlow(score('5.0')), (e) => e.status === 422 && /MuseScore 5, newer than this app can read/.test(e.message));
  assert.throws(() => museScoreToFlow('<museScore version="4.70"><Score></Score></museScore>'), (e) => e.status === 422 && /no bars/.test(e.message));
  assert.throws(() => museScoreToFlow('not xml <<<'), (e) => e.status === 422);
});

async function mscz(entries) {
  const zip = new JSZip();
  for (const [name, text] of Object.entries(entries)) zip.file(name, text);
  return zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
}

test('ML-578: a .mscz is unzipped to its score - not a part (Excerpts/), not the style file', async () => {
  const buffer = await mscz({
    'score_style.mss': '<museScore version="4.70"><Style/></museScore>',
    'Excerpts/0_Cornet/0_Cornet.mscx': score('5.0'), // would be refused if it were read
    'Home-made March.mscx': score(),
    'META-INF/container.xml': '<container><rootfiles><rootfile full-path="score_style.mss"/><rootfile full-path="Home-made March.mscx"/></rootfiles></container>'
  });
  const { kind, text } = await extractScoreText(buffer);
  assert.equal(kind, 'musescore');
  assert.equal(museScoreToFlow(text).blocks.length, 7);
  // An .mxl is still MusicXML
  const mxl = await mscz({ 'META-INF/container.xml': '<container><rootfiles><rootfile full-path="s.musicxml"/></rootfiles></container>', 's.musicxml': '<score-partwise/>' });
  assert.equal((await extractScoreText(mxl)).kind, 'musicxml');
});

test('ML-578: a damaged file is refused, and a MuseScore file only with its switch on', async () => {
  const damaged = Buffer.concat([Buffer.from('PK'), Buffer.alloc(200, 7)]);
  await assert.rejects(extractScoreText(damaged), (e) => e.status === 422 && /damaged or password-protected/.test(e.message));
  const buffer = await mscz({ 'Home-made March.mscx': score() });
  // password-protected: the "encrypted" bit set in the entry's local header and its central directory record
  const locked = Buffer.from(buffer);
  locked[6] |= 1;
  locked[locked.indexOf(Buffer.from([0x50, 0x4b, 0x01, 0x02])) + 8] |= 1;
  await assert.rejects(extractScoreText(locked), (e) => e.status === 422 && /password-protected/.test(e.message));
  // Refused before anything is read or saved
  await assert.rejects(importMusicXmlFile(1, buffer, { musicxml: true, musescore: false }), (e) => e.status === 403 && /MuseScore/.test(e.message));
  await assert.rejects(importMusicXmlFile(1, Buffer.from('<score-partwise/>'), { musicxml: false, musescore: true }), (e) => e.status === 403);
});
