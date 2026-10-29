// ML-246: unit tests for a piece read from a photo or PDF - the rules in public/pieceRead.js (checking the
// model's answer, fitting it to a Quick entry outline, the high / medium / low rating) and the server call
// in server/services/pieceReader.js (with a stand-in for the gateway: no test calls a model).
// The reads below are what a fresh reader gave for the owner's own test pieces on 10 Oct 2026, cut down to
// what each test needs.
import { test, describe, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { PieceRead as rawPR, PieceOutline as rawPO, mediaTypeOf, parseAnswer, readPieceFromFiles, READ_SCHEMA, MAX_READ_FILES } from '../services/pieceReader.js';

// The rules run in a vm sandbox, so what they return is copied before deepEqual compares it.
const plain = (api) => new Proxy(api, { get: (t, k) => (typeof t[k] === 'function' ? (...args) => JSON.parse(JSON.stringify(t[k](...args))) : t[k]) });
const PR = plain(rawPR);
const PO = plain(rawPO);

// Lines of music from their first bars: lines([1, 6, 11], 14) is three lines ending on bar 14.
const lines = (firstBars, lastBar, anchored = true) => firstBars.map((firstBar, i) => ({ page: 1, firstBar, bars: (firstBars[i + 1] || lastBar + 1) - firstBar, anchored, sure: 'high' }));
const numbered = (bars) => bars.map(bar => ({ bar, label: String(bar) }));
// The last line listed bar by bar, as the reader gives it. A test piece gets one that agrees with its lines
// unless the test says otherwise (tail: [] is "the reader gave none").
const tailFor = (p) => { const last = p.systems[p.systems.length - 1]; return last ? Array.from({ length: last.bars }, (_, i) => ({ bar: last.firstBar + i, what: 'a bar' })) : []; };
const piece = (over) => { const p = basePiece(over); return over.tail ? p : { ...p, tail: tailFor(p) }; };
const basePiece = (over) => ({ numbersAt: 'start', tail: [], numberClashes: [], freeBars: [], title: 'A piece', movement: null, composer: null, arranger: null, publisher: null, part: null, systems: [], bars: 16, pickupBeats: null, endSeen: true, cropped: false, pagesMissing: false, time: [{ bar: 1, beats: 4, beatType: 4 }], speeds: [], ramps: [], marks: [], repeats: [], signs: [], pauses: [], special: [], doubts: [], ...over });
const read = (over) => PR.normalise({ pieces: [piece(over)] }).pieces[0];
const fitAndRate = (over) => { const r = read(over); const fitted = PR.fit(r); return { r, fitted, rating: PR.rate(r, fitted), built: PO.buildBlocks(fitted.o) }; };
const starts = (blocks) => blocks.map(b => b.from);

const mammaMia = {
  title: 'Mamma Mia!', arranger: 'Roy Phillippe', bars: 145, endSeen: false,
  systems: lines([1, 4, 8, 12, 16, 20, 24, 28, 37, 41, 45, 49, 53, 57, 61, 65, 69, 73, 78, 83, 94, 99, 103, 107, 111, 114, 117, 120, 123, 127, 130, 133, 136, 139, 142], 145),
  time: [{ bar: 1, beats: 4, beatType: 4 }, { bar: 76, beats: 2, beatType: 4 }, { bar: 77, beats: 4, beatType: 4 }],
  speeds: [{ bar: 1, bpm: null, note: null, text: 'Allegro', handwritten: false }, { bar: 41, bpm: null, note: null, text: 'Meno mosso', handwritten: false }, { bar: 73, bpm: null, note: null, text: 'Slowly', handwritten: false }, { bar: 101, bpm: null, note: null, text: 'Slower', handwritten: false }, { bar: 105, bpm: null, note: null, text: 'Slightly faster', handwritten: false }],
  ramps: [{ from: 104, to: 104, kind: 'slower', text: 'rit.' }],
  marks: numbered([9, 17, 25, 35, 41, 50, 59, 67, 78, 86, 94, 107, 119, 129, 135]),
  repeats: [{ from: 67, to: 70, times: 2, firstEndingFrom: null, lastEndingTo: null }, { from: 107, to: 110, times: 2, firstEndingFrom: null, lastEndingTo: null }, { from: 129, to: 132, times: 2, firstEndingFrom: 131, lastEndingTo: 134 }],
  pauses: [{ bar: 40, beat: 4, kind: 'pause' }]
};

const malvernThree = {
  title: 'A Malvern Suite', movement: 'Gloucester Market', composer: 'Philip Sparke', bars: 124,
  systems: lines([1, 8, 16, 22, 28, 35, 43, 52, 60, 67, 72, 80, 87, 93, 99, 105, 111, 117, 120], 124, false),
  time: [{ bar: 1, beats: 4, beatType: 4 }, { bar: 11, beats: 2, beatType: 4 }, { bar: 12, beats: 4, beatType: 4 }, { bar: 22, beats: 3, beatType: 4 }, { bar: 24, beats: 4, beatType: 4 }, { bar: 30, beats: 2, beatType: 4 }, { bar: 50, beats: 3, beatType: 4 }, { bar: 53, beats: 2, beatType: 4 }, { bar: 67, beats: 4, beatType: 4 }, { bar: 109, beats: 2, beatType: 4 }, { bar: 110, beats: 4, beatType: 4 }],
  speeds: [{ bar: 1, bpm: 132, note: 'crotchet', text: 'Allegro Giusto', handwritten: false }],
  marks: [['S', 14], ['T', 30], ['U', 50], ['V', 67], ['W', 79], ['X', 88], ['Y', 100], ['Z', 110]].map(([label, bar]) => ({ bar, label })),
  signs: [{ sign: 'segno', bar: 2 }, { sign: 'toCoda', bar: 27 }, { sign: 'dsCoda', bar: 119 }, { sign: 'coda', bar: 120 }],
  special: [{ from: 7, to: 7, text: 'Play on D.S. only' }]
};

describe('normalise - the answer is checked before it is used', () => {
  test('rows with a bar that is not in the piece are left out and counted', () => {
    const r = read({ bars: 20, marks: [{ bar: 5, label: 'A' }, { bar: 21, label: 'B' }, { bar: 0, label: 'C' }], pauses: [{ bar: 99, beat: 1, kind: 'pause' }] });
    assert.deepEqual(r.marks, [{ bar: 5, label: 'A' }]);
    assert.equal(r.dropped, 3);
  });
  test('text is trimmed and cut short; anything that is not text becomes empty', () => {
    const r = read({ title: `  A   title ${'x'.repeat(300)}`, composer: { toString: () => 'x' }, marks: [{ bar: 2, label: 'A very long label indeed' }] });
    assert.equal(r.title.length, 120);
    assert.equal(r.title.startsWith('A title'), true);
    assert.equal(r.composer, '');
    assert.equal(r.marks[0].label.length, 12);
  });
  test('a piece with no bar count, or more bars than a piece can have, is not a piece', () => {
    assert.deepEqual(PR.normalise({ pieces: [piece({ bars: 0 }), piece({ bars: 5000 }), piece({ bars: 'lots' }), null, 'x'] }).pieces, []);
    assert.deepEqual(PR.normalise(null).pieces, []);
    assert.deepEqual(PR.normalise({ pieces: 'no' }).pieces, []);
  });
  test('an unknown sign, note or level is dropped or put right', () => {
    const r = read({ signs: [{ sign: 'jump', bar: 3 }, { sign: 'fine', bar: 8 }], speeds: [{ bar: 1, bpm: 9999, note: 'breve', text: 'Fast', handwritten: 'yes' }], repeats: [{ from: 1, to: 4, times: 99, firstEndingFrom: 4, lastEndingTo: null }] });
    assert.deepEqual(r.signs, [{ sign: 'fine', bar: 8 }]);
    assert.deepEqual(r.speeds, [{ bar: 1, bpm: null, note: null, text: 'Fast', handwritten: false }]);
    assert.deepEqual(r.repeats, [{ from: 1, to: 4, times: 2, e1From: null, e2To: null }]);
  });
});

describe('speeds from words', () => {
  test('a word gives a starting point; the longer word wins over the one inside it', () => {
    assert.equal(PR.bpmForWords('Allegro').bpm, 132);
    assert.equal(PR.bpmForWords('Allegretto').bpm, 112);
    assert.equal(PR.bpmForWords('Larghetto').bpm, 63);
    assert.equal(PR.bpmForWords('Disco').bpm, 120);
    assert.equal(PR.bpmForWords('Dolce'), null);
  });
  test('slower, faster and Tempo I work from the speeds before', () => {
    assert.equal(PR.bpmForWords('Meno mosso', 132, 132).bpm, 116);
    assert.equal(PR.bpmForWords('Slightly faster', 100, 132).bpm, 112);
    assert.equal(PR.bpmForWords('Tempo I', 80, 132).bpm, 132);
    assert.equal(PR.bpmForWords('Piu mosso'), null);
  });
});

describe('fit - the read as a Quick entry outline', () => {
  test('Mamma Mia: the bars, time signatures, marks and repeats of the piece entered by hand', () => {
    const { fitted, built } = fitAndRate(mammaMia);
    const o = fitted.o;
    assert.equal(o.bars, 145);
    assert.equal(o.mainSig, '4/4');
    assert.deepEqual(o.time, { 76: '2/4' });
    assert.equal(o.markKind, 'numbers');
    assert.equal(o.marks.length, 15);
    assert.deepEqual(built.clashes, []);
    // Every block start of the hand-entered piece (Mamma Mia.musicxml) is there.
    [1, 9, 17, 25, 35, 41, 50, 59, 67, 71, 73, 76, 77, 78, 86, 94, 101, 107, 111, 119, 129, 133, 135].forEach(bar => assert.ok(starts(built.blocks).includes(bar), `a block starts at bar ${bar}`));
    const ending = built.blocks.find(b => b.from === 129);
    assert.equal(ending.isRepeatStart && ending.isRepeatEnd, true);
    assert.equal(ending.repeatEndingStartBar, 3);
    assert.deepEqual(built.blocks.find(b => b.from === 133).repeatEndingNumbers, [2]);
  });
  test('no number printed: the words give starting speeds, and each is listed', () => {
    const { fitted } = fitAndRate(mammaMia);
    assert.equal(fitted.o.mainBpm, 132);
    assert.deepEqual(fitted.o.speeds.map(s => [s.bar, s.bpm]), [[41, 116], [73, 66], [101, 58], [105, 65]]);
    assert.equal(fitted.notes.filter(n => n.kind === 'speed').length, 5);
    assert.ok(fitted.notes.every(n => n.kind !== 'speed' || n.level === 'info'));
  });
  test('a rit. is put in only when the speed it reaches is known', () => {
    const { fitted } = fitAndRate(mammaMia);
    assert.deepEqual(fitted.o.extras.filter(x => x.type === 'ramp'), [{ type: 'ramp', from: 104, to: 104, target: 'next' }]);
    const loose = fitAndRate({ bars: 20, ramps: [{ from: 10, to: 12, kind: 'slower', text: 'rall.' }] });
    assert.deepEqual(loose.fitted.o.extras, []);
    assert.equal(loose.fitted.notes.find(n => n.kind === 'ramp').level, 'info');
  });
  test('Malvern Suite, 3rd movement: the sign on bar 2, To Coda, D.S. al Coda and the Coda', () => {
    const { fitted, built } = fitAndRate(malvernThree);
    assert.equal(fitted.about.name, 'A Malvern Suite: Gloucester Market');
    assert.equal(fitted.o.markKind, 'text');
    assert.equal(fitted.o.mainBpm, 132);
    assert.equal(fitted.o.mainNote, 'crotchet');
    assert.deepEqual(built.clashes, []);
    assert.equal(built.blocks.find(b => b.from === 2).isSegno, true);
    assert.equal(built.blocks.find(b => b.to === 27).gotoCoda, true);
    assert.equal(built.blocks.find(b => b.to === 119).gotoSegnoThenCoda, true);
    assert.equal(built.blocks.find(b => b.from === 120).isCoda, true);
    assert.ok(fitted.notes.some(n => n.kind === 'special' && n.from === 7));
  });
  test('something that clashes is taken out and listed, so the outline always arrives ready to save', () => {
    const { fitted, built, rating } = fitAndRate({ bars: 20, systems: lines([1, 11], 20), repeats: [{ from: 5, to: 8, times: 2, firstEndingFrom: null, lastEndingTo: null }, { from: 5, to: 12, times: 2, firstEndingFrom: null, lastEndingTo: null }] });
    assert.deepEqual(built.clashes, []);
    assert.equal(fitted.o.extras.length, 1);
    assert.equal(fitted.notes.filter(n => n.kind === 'left-out').length, 1);
    assert.equal(rating.level, 'medium');
  });
  test('the time signatures used are listed, for the caller to turn into the account\'s own', () => {
    const { fitted } = fitAndRate({ bars: 12, time: [{ bar: 1, beats: 3, beatType: 4 }, { bar: 5, beats: 7, beatType: 8 }, { bar: 6, beats: 3, beatType: 4 }] });
    assert.deepEqual(fitted.sigs, [{ key: '3/4', beats: 3, beatType: 4 }, { key: '7/8', beats: 7, beatType: 8 }]);
    const keyed = PR.fit(read({ bars: 12, time: [{ bar: 1, beats: 3, beatType: 4 }, { bar: 5, beats: 7, beatType: 8 }] }), { sigKey: (b, t) => `custom:${b}${t}` });
    assert.equal(keyed.o.mainSig, 'custom:78');
    assert.equal(keyed.o.time[1], 'custom:34');
  });
});

describe('rate - how far to trust it', () => {
  test('high: bar numbers printed on every line, the lines add up, the end is seen (A Whole New World)', () => {
    const { rating, built } = fitAndRate({ bars: 39, systems: lines([1, 6, 11, 16, 21, 26, 31, 36], 39), marks: [['A', 9], ['B', 17], ['C', 25], ['D', 37]].map(([label, bar]) => ({ bar, label })), repeats: [{ from: 1, to: 34, times: 2, firstEndingFrom: 34, lastEndingTo: 35 }], speeds: [{ bar: 1, bpm: null, note: null, text: 'Ballad', handwritten: false }], pauses: [{ bar: 39, beat: 1, kind: 'pause' }] });
    assert.equal(rating.level, 'high');
    assert.deepEqual(rating.checks.map(c => [c.level, c.kind]), [['info', 'speed'], ['info', 'last-line']]);
    assert.deepEqual(built.clashes, []);
  });
  test('medium: nothing printed after the last boxed number (Shrek Dance Party - where the 2-bar miscount was)', () => {
    const { rating } = fitAndRate({ bars: 98, systems: lines([1, 5, 18, 23, 36, 41, 47, 52, 56, 61, 69, 77, 81, 85, 90, 95], 98, false), marks: numbered([5, 13, 23, 29, 39, 46, 54, 62, 66, 73, 79, 89]) });
    assert.equal(rating.level, 'medium');
    const check = rating.checks.find(c => c.kind === 'numbers');
    assert.deepEqual([check.from, check.to], [90, 98]);
  });
  test('medium: no bar numbers at all, or the final barline not seen', () => {
    assert.equal(fitAndRate(malvernThree).rating.checks.find(c => c.kind === 'numbers').from, 1);
    const mm = fitAndRate(mammaMia).rating;
    assert.equal(mm.level, 'medium');
    assert.ok(mm.checks.some(c => c.kind === 'end'));
    assert.ok(!mm.checks.some(c => c.kind === 'numbers'));
  });
  test('low: the lines do not add up, or the total disagrees - and only that', () => {
    assert.equal(fitAndRate({ bars: 20, systems: [{ page: 1, firstBar: 1, bars: 8, anchored: true, sure: 'high' }, { page: 1, firstBar: 11, bars: 10, anchored: true, sure: 'high' }] }).rating.level, 'low');
    assert.equal(fitAndRate({ bars: 24, systems: lines([1, 11], 20) }).rating.level, 'low');
    assert.equal(fitAndRate({ bars: 20, systems: lines([1, 11], 20), pagesMissing: true }).rating.level, 'medium');
    assert.equal(fitAndRate({ bars: 20, systems: lines([1, 11], 20), doubts: [{ from: 3, to: 3, level: 'low', note: 'A smudge.' }] }).rating.level, 'medium');
  });
  test('a speed to fill in is listed but does not lower the rating; the least sure comes first', () => {
    const { rating } = fitAndRate({ bars: 24, systems: lines([1, 11], 20), cropped: true });
    // ML-655: the last line that ends off the total is one question (how many bars?), offering both counts
    assert.deepEqual(rating.checks.map(c => c.level), ['low', 'medium', 'info']);
    const last = rating.checks.find(c => c.kind === 'last-line');
    assert.deepEqual(last.ask, { type: 'lineCount', from: 11, bars: 14, read: 14, at: 25, options: [10], place: { page: 1, line: 2, pages: 1 } });
    // a line is named by its place on the page, not its bars (owner, 29 Oct 2026)
    assert.match(last.text, /The last line \(line 2\) was counted 2 ways: 14 or 10 bars\. How many bars are on it\?/);
    assert.deepEqual(rating.checks.find(c => c.kind === 'cropped').ask, { type: 'page' });
    assert.equal(fitAndRate({ bars: 20, systems: lines([1, 11], 20) }).rating.level, 'high');
  });
  test('the last line: always named; not listed bar by bar is medium; listed and disagreeing is low', () => {
    const named = fitAndRate({ bars: 20, systems: lines([1, 11], 20) }).rating;
    assert.equal(named.level, 'high');
    const check = named.checks.find(c => c.kind === 'last-line');
    assert.deepEqual([check.level, check.from, check.to], ['info', 11, 20]);
    assert.equal(fitAndRate({ bars: 20, systems: lines([1, 11], 20), tail: [] }).rating.level, 'medium');
    // Frozen, 11 Oct 2026: the line count said 7 bars from 207, the page has 6. A tail of 6 from 207 ends on 212, not 213.
    const six = Array.from({ length: 6 }, (_, i) => ({ bar: 207 + i, what: 'a bar' }));
    const frozen = fitAndRate({ bars: 213, systems: lines([1, 207], 213), tail: six }).rating;
    assert.equal(frozen.level, 'low');
    assert.equal(frozen.checks.find(c => c.kind === 'last-line').level, 'low');
    // A tail may start earlier - at the first line after the last printed number - but on a line's first bar.
    const longer = Array.from({ length: 12 }, (_, i) => ({ bar: 9 + i, what: 'a bar' }));
    assert.equal(fitAndRate({ bars: 20, systems: lines([1, 9, 15], 20), tail: longer }).rating.level, 'high');
    assert.equal(fitAndRate({ bars: 20, systems: lines([1, 9, 15], 20), tail: longer.slice(1) }).rating.level, 'low');
  });
  test('a printed number on the wrong bar is low, whether the reader says so or the marks show it (Disney: "141" on bar 142)', () => {
    const told = fitAndRate({ bars: 160, systems: lines([1, 150], 160), marks: [{ bar: 142, label: '141' }], numberClashes: [{ printed: '141', bar: 142 }] });
    assert.equal(told.rating.level, 'low');
    assert.equal(told.rating.checks.filter(c => c.kind === 'number').length, 1);
    assert.equal(told.fitted.o.marks[0].label, '141');
    const shown = fitAndRate({ bars: 160, systems: lines([1, 150], 160), marks: [...numbered([9, 17, 25, 33]), { bar: 142, label: '141' }, { bar: 150, label: '149' }] });
    assert.deepEqual(shown.rating.checks.filter(c => c.kind === 'number').map(c => c.from), [142, 150]);
    assert.equal(shown.fitted.o.markKind, 'text');
    // Marks that are plainly not bar numbers (Abba Silver's 1 to 13) are left alone.
    const counted = fitAndRate({ bars: 141, systems: lines([1, 140], 141), marks: [1, 2, 3, 4].map((n, i) => ({ bar: 10 + i * 8, label: String(n) })) });
    assert.equal(counted.rating.checks.filter(c => c.kind === 'number').length, 0);
  });
  test('a bar with no set length is listed for a hand count (A Word on My Ear, bar 155)', () => {
    const { rating, r } = fitAndRate({ bars: 232, systems: lines([1, 224], 232), freeBars: [{ bar: 155, text: 'Senza Tempo' }, { bar: 999, text: 'x' }] });
    assert.deepEqual(r.freeBars, [{ bar: 155, text: 'Senza Tempo' }]);
    const check = rating.checks.find(c => c.kind === 'free-bar');
    assert.deepEqual([check.level, check.from], ['medium', 155]);
  });
  test('where the part prints its bar numbers is kept, and anything else is "none"', () => {
    assert.equal(read({ numbersAt: 'end' }).numbersAt, 'end');
    assert.equal(read({ numbersAt: 'sideways' }).numbersAt, 'none');
  });
  test('with no line-by-line count the total cannot be checked', () => {
    assert.equal(fitAndRate({ bars: 20 }).rating.level, 'medium');
  });
});

// ML-655: every check is a question, and `ask` says what its answers are (public/app.js turns it into the answer box)
describe('each check asks something that can be answered', () => {
  test('what was left out past the last bar is said by name, and asks whether the piece is longer', () => {
    const { rating } = fitAndRate({ bars: 20, systems: lines([1, 11], 20), marks: [{ bar: 25, label: 'C' }], pauses: [{ bar: 22, beat: 1, kind: 'pause' }] });
    const dropped = rating.checks.find(c => c.kind === 'dropped');
    assert.deepEqual(dropped.ask, { type: 'end', bars: 20, items: [{ bar: 25, what: 'rehearsal mark C' }, { bar: 22, what: 'a pause' }] });
    assert.match(dropped.text, /rehearsal mark C at bar 25, a pause at bar 22\. The piece was read as 20 bars\. Is it longer\?/);
  });
  test('a line hard to make out asks how many bars are on it; the bars after it follow the answer', () => {
    const sys = lines([1, 11, 21], 30);
    sys[1].sure = 'medium';
    const line = fitAndRate({ bars: 30, systems: sys }).rating.checks.find(c => c.kind === 'line');
    assert.deepEqual(line.ask, { type: 'lineCount', from: 11, bars: 10, read: 10, at: 21, options: [], place: { page: 1, line: 2, pages: 1 } });
    assert.match(line.text, /hard to make out on line 2\. It was read as 10 bars\. Is that right\?/);
  });
  test('a line that does not add up asks about the line before it, offering its own count', () => {
    const sys = lines([1, 11, 21], 30);
    sys[1].bars = 8; // counted 8, but the next line is numbered from 21
    const count = fitAndRate({ bars: 30, systems: sys }).rating.checks.find(c => c.kind === 'count');
    assert.deepEqual(count.ask, { type: 'lineCount', from: 11, bars: 10, read: 10, at: 21, options: [8], place: { page: 1, line: 2, pages: 1 } });
    assert.match(count.text, /^Line 2 was counted as 8 bars, but the line after it is numbered from bar 21\. How many bars are on line 2\?/);
    // with more than one page, the page is said too
    const two = lines([1, 11, 21], 30).map((l, i) => ({ ...l, page: i < 2 ? 1 : 2 }));
    two[2].sure = 'medium'; two.push({ page: 2, firstBar: 31, bars: 5, anchored: true, sure: 'high' });
    const onPage2 = fitAndRate({ bars: 35, systems: two }).rating.checks.find(c => c.kind === 'line');
    assert.match(onPage2.text, /on line 1 on page 2\./);
  });
  test('a printed number on the wrong bar asks which is right; a pickup, a free bar, a word not known and a missing time each ask their own', () => {
    const { rating } = fitAndRate({ bars: 20, systems: lines([1, 11], 20), numberClashes: [{ bar: 15, printed: 14 }], pickupBeats: 1, freeBars: [{ bar: 9, text: 'cadenza' }],
      speeds: [{ bar: 5, bpm: null, note: null, text: 'Con gioia', handwritten: false }], time: [] });
    const ask = (kind) => rating.checks.find(c => c.kind === kind).ask;
    assert.deepEqual(ask('number'), { type: 'printed', bar: 15, printed: 14 });
    assert.deepEqual(ask('pickup'), { type: 'pickup' });
    assert.deepEqual(ask('free-bar'), { type: 'beats', bar: 9 });
    assert.deepEqual(ask('time'), { type: 'mainTime' });
    assert.ok(rating.checks.some(c => c.kind === 'speed' && c.ask && c.ask.type === 'addSpeed' && c.ask.bar === 5));
  });
});

describe('the server call', () => {
  const pdf = Buffer.from('%PDF-1.7 the rest of a file');
  const jpeg = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(20)]);
  const answerWith = (content, extra = {}) => ({ ok: true, status: 200, json: async () => ({ choices: [{ message: { content }, finish_reason: 'stop' }], usage: { prompt_tokens: 1200, completion_tokens: 300 }, ...extra }) });
  const saved = { key: process.env.AI_GATEWAY_API_KEY, oidc: process.env.VERCEL_OIDC_TOKEN };
  afterEach(() => {
    for (const [name, value] of [['AI_GATEWAY_API_KEY', saved.key], ['VERCEL_OIDC_TOKEN', saved.oidc]]) { if (value === undefined) delete process.env[name]; else process.env[name] = value; }
  });

  test('a file is known by its first bytes', () => {
    assert.equal(mediaTypeOf(pdf), 'application/pdf');
    assert.equal(mediaTypeOf(jpeg), 'image/jpeg');
    assert.equal(mediaTypeOf(Buffer.from('<svg onload=alert(1)>....')), null);
    assert.equal(mediaTypeOf(Buffer.from('hi')), null);
  });
  test('the answer is read as JSON, with or without words round it', () => {
    assert.deepEqual(parseAnswer('{"pieces":[]}'), { pieces: [] });
    assert.deepEqual(parseAnswer('Here it is:\n{"pieces":[]}\nDone.'), { pieces: [] });
    assert.equal(parseAnswer('no'), null);
  });
  test('the schema asks for the line-by-line count before the total', () => {
    const keys = Object.keys(READ_SCHEMA.properties.pieces.items.properties);
    assert.ok(keys.indexOf('systems') < keys.indexOf('tail') && keys.indexOf('tail') < keys.indexOf('bars'));
    assert.deepEqual(READ_SCHEMA.properties.pieces.items.required, keys);
  });
  test('without a key it says so and calls nobody', async () => {
    delete process.env.AI_GATEWAY_API_KEY; delete process.env.VERCEL_OIDC_TOKEN;
    let called = false;
    await assert.rejects(readPieceFromFiles([pdf], { fetchImpl: async () => { called = true; } }), { status: 422 });
    assert.equal(called, false);
  });
  test('the pages go to the gateway with zero data retention asked for, and come back as outline and rating', async () => {
    process.env.AI_GATEWAY_API_KEY = 'test-key';
    let sent;
    const out = await readPieceFromFiles([pdf], { fetchImpl: async (url, init) => { sent = { url, init, body: JSON.parse(init.body) }; return answerWith(JSON.stringify({ pieces: [piece({ bars: 20, systems: lines([1, 11], 20) })] })); } });
    assert.equal(new URL(sent.url).hostname, 'ai-gateway.vercel.sh');
    assert.equal(sent.init.headers.Authorization, 'Bearer test-key');
    assert.equal(sent.body.providerOptions.gateway.zeroDataRetention, true);
    assert.equal(sent.body.messages[1].content[0].type, 'file');
    assert.equal(out.pieces.length, 1);
    assert.equal(out.pieces[0].outline.bars, 20);
    assert.equal(out.pieces[0].rating.level, 'high');
    assert.deepEqual(out.usage, { inputTokens: 1200, outputTokens: 300 });
  });
  test('photos go as pictures; a PDF and photos together, or something that is neither, is refused', async () => {
    process.env.AI_GATEWAY_API_KEY = 'test-key';
    let body;
    await readPieceFromFiles([jpeg, jpeg], { fetchImpl: async (url, init) => { body = JSON.parse(init.body); return answerWith(JSON.stringify({ pieces: [piece({})] })); } });
    assert.deepEqual(body.messages[1].content.map(p => p.type), ['image_url', 'image_url', 'text']);
    const never = async () => { throw new Error('should not be called'); };
    await assert.rejects(readPieceFromFiles([pdf, jpeg], { fetchImpl: never }), { status: 422 });
    await assert.rejects(readPieceFromFiles([Buffer.from('just some text here')], { fetchImpl: never }), { status: 422 });
    await assert.rejects(readPieceFromFiles(Array(MAX_READ_FILES + 1).fill(jpeg), { fetchImpl: never }), { status: 413 });
    await assert.rejects(readPieceFromFiles([], { fetchImpl: never }), { status: 422 });
  });
  test('a gateway error, a cut-off answer or an answer with no piece in it reaches the member as a plain message', async () => {
    process.env.AI_GATEWAY_API_KEY = 'test-key';
    await assert.rejects(readPieceFromFiles([pdf], { fetchImpl: async () => ({ ok: false, status: 401, text: async () => 'key sk-secret is wrong' }) }), (err) => err.status === 422 && !/secret/.test(err.message));
    await assert.rejects(readPieceFromFiles([pdf], { fetchImpl: async () => ({ ok: true, status: 200, json: async () => ({ choices: [{ message: { content: '{"pieces":[' }, finish_reason: 'length' }] }) }) }), { status: 422 });
    await assert.rejects(readPieceFromFiles([pdf], { fetchImpl: async () => answerWith('I could not find any music.') }), { status: 422 });
    await assert.rejects(readPieceFromFiles([pdf], { fetchImpl: async () => { throw new Error('network'); } }), { status: 422 });
  });
});

describe('the last line, with a multi-bar rest in it', () => {
  test('a rest of 20 bars is one entry of 20 bars (Tristan\'s Zebra) - not a disagreement', () => {
    const tail = [{ bar: 70, bars: 1, what: 'two dotted crotchets' }, { bar: 71, bars: 1, what: 'quavers' }, { bar: 72, bars: 1, what: 'crotchet' }, { bar: 73, bars: 20, what: '20-bar rest' }, { bar: 93, bars: 1, what: 'final bar' }];
    assert.equal(fitAndRate({ bars: 93, systems: lines([1, 70], 93), tail }).rating.level, 'high');
    assert.equal(fitAndRate({ bars: 93, systems: lines([1, 70], 93), tail: tail.slice(0, 4) }).rating.level, 'low');
  });
});

describe('compare - the read against the piece as saved', () => {
  const base = { bars: 40, mainSig: 'public:1', mainBpm: 120, markKind: 'numbers', marks: numbered([9, 17, 25]), time: { 20: 'public:2' }, speeds: [{ bar: 17, bpm: 100 }], extras: [{ type: 'repeat', from: 9, to: 16, times: 2 }, { type: 'pause', bar: 40, beat: 1, holdBeats: 2, kind: 'fermata' }] };
  test('nothing changed is "same"', () => {
    const c = PR.compare(base, JSON.parse(JSON.stringify(base)));
    assert.equal(c.same, true);
    assert.equal(c.changed, 0);
  });
  test('each kind of change is counted: bars, a bar\'s time, a mark, a speed, a repeat', () => {
    const saved = { ...base, bars: 41, time: { 20: 'public:2', 21: 'public:2' }, marks: numbered([9, 18, 25]), mainBpm: 132, extras: [{ type: 'repeatEndings', from: 9, to: 16, times: 2, e1From: 16, e2To: 17 }] };
    const c = PR.compare(base, saved);
    assert.deepEqual(c.bars, [40, 41]);
    assert.equal(c.timeBars, 1);
    assert.deepEqual(c.marks, { missed: ['18:18'], extra: ['17:17'] });
    assert.deepEqual(c.speeds, { missed: ['1:132'], extra: ['1:120'] });
    assert.equal(c.repeats.missed.length, 1);
    assert.deepEqual(c.pauses, { missed: [], extra: ['40'] });
    assert.equal(c.changed, 1 + 1 + 1 + 1 + 1 + 1);
    assert.equal(c.same, false);
  });
});

describe('the log and the test library (server/services/pieceReads.js)', async () => {
  process.env.DATABASE_URL ??= 'postgres://test:test@localhost:5432/test';
  const { checkedFiles, outlineWithKeys, summarise, costUsd, readUploadPrefix, testUploadPrefix } = await import('../services/pieceReads.js');
  const blob = (pathname) => ({ blobUrl: `https://abc123.public.blob.vercel-storage.com/${pathname}`, blobPathname: pathname });

  test('only this app\'s file store, in the folder the account was given', () => {
    assert.equal(checkedFiles([blob('piece-read/7/a.jpg')], readUploadPrefix(7)).length, 1);
    assert.throws(() => checkedFiles([blob('piece-read/8/a.jpg')], readUploadPrefix(7)), { status: 400 });
    assert.throws(() => checkedFiles([blob('piece-read/7/a.jpg')], testUploadPrefix(7)), { status: 400 });
    assert.throws(() => checkedFiles([{ blobUrl: 'https://evil.example/piece-read/7/a.jpg', blobPathname: 'piece-read/7/a.jpg' }], readUploadPrefix(7)), { status: 400 });
    assert.throws(() => checkedFiles([], readUploadPrefix(7)), { status: 400 });
    assert.throws(() => checkedFiles(Array(MAX_READ_FILES + 1).fill(blob('piece-read/7/a.jpg')), readUploadPrefix(7)), { status: 413 });
  });
  test('the read\'s time signatures become the app\'s keys; one the app can\'t have falls back and is reported', () => {
    const o = { bars: 10, mainSig: '4/4', time: { 5: '3/4', 6: '7/32' } };
    const keyed = outlineWithKeys(o, new Map([['4/4', 'public:1'], ['3/4', 'custom:9'], ['7/32', null]]));
    assert.deepEqual(keyed.o.time, { 5: 'custom:9' });
    assert.equal(keyed.o.mainSig, 'public:1');
    assert.deepEqual(keyed.lost, [6]);
  });
  test('the summary: what was saved unchanged and with the right bars, for each rating', () => {
    const piece = (rating, same, bars) => ({ rating, savedAt: 'x', changes: { same, bars } });
    const s = summarise([
      { status: 'read', seconds: 40, costUsd: 0.12, isTest: true, pieces: [piece('high', true, [10, 10]), piece('medium', false, [10, 11])] },
      { status: 'read', seconds: 60, costUsd: 0.16, isTest: false, pieces: [piece('high', false, [20, 20]), { rating: 'low', savedAt: null, changes: null }] },
      { status: 'failed', seconds: 0, costUsd: null, isTest: false, pieces: [] }
    ]);
    assert.deepEqual([s.reads, s.failed, s.pieces, s.saved, s.tests, s.seconds], [3, 1, 4, 3, 1, 50]);
    assert.deepEqual(s.byRating.find(r => r.level === 'high'), { level: 'high', saved: 2, same: 1, barsRight: 2 });
    assert.deepEqual(s.byRating.find(r => r.level === 'medium'), { level: 'medium', saved: 1, same: 0, barsRight: 0 });
    assert.ok(Math.abs(s.costPerRead - 0.14) < 1e-9);
  });
  test('the cost estimate is only given for a model whose price is known', () => {
    assert.ok(Math.abs(costUsd('anthropic/claude-opus-5.5', 10000, 4000) - 0.12) < 1e-9);
    assert.equal(costUsd('someone/else', 10000, 4000), null);
  });
});

describe('a piece in movements (ML-529)', () => {
  // Iceni Autumn's shape: one work, the bar numbers carrying on, the letters starting again at A.
  const suite = () => PR.normalise({ pieces: [
    piece({ title: 'Iceni Autumn', movement: 'Dawn', bars: 20, systems: lines([1, 11], 20), marks: [{ bar: 1, label: 'A' }, { bar: 11, label: 'B' }], speeds: [{ bar: 1, bpm: 96, note: 'crotchet', text: null, handwritten: false }] }),
    piece({ title: 'Iceni Autumn', movement: 'Harvest', bars: 36, systems: lines([21, 29], 36), time: [{ bar: 21, beats: 3, beatType: 4 }], marks: [{ bar: 21, label: 'A' }, { bar: 29, label: 'B' }], speeds: [{ bar: 21, bpm: 132, note: 'crotchet', text: null, handwritten: false }], repeats: [{ from: 21, to: 28, times: 2, firstEndingFrom: null, lastEndingTo: null }] }),
    piece({ title: 'ICENI AUTUMN', movement: 'Dusk', bars: 46, systems: lines([37], 46), marks: [{ bar: 37, label: 'A' }] })
  ] }).pieces;

  test('a movement whose bar numbers carry on is counted from bar 1 when read on its own', () => {
    const [, harvest] = suite();
    assert.equal(harvest.bars, 16);
    assert.equal(harvest.printedFrom, 21);
    assert.deepEqual(harvest.marks, [{ bar: 1, label: 'A' }, { bar: 9, label: 'B' }]);
    assert.deepEqual(harvest.repeats.map(r => [r.from, r.to]), [[1, 8]]);
    const fitted = PR.fit(harvest);
    assert.equal(fitted.o.bars, 16);
    assert.equal(fitted.o.mainSig, '3/4');
    assert.deepEqual(Object.keys(fitted.o.time), []);
    assert.equal(PR.rate(harvest, fitted).checks.filter(c => c.kind === 'count').length, 0);
  });
  test('a movement\'s printed number is taken off its name - the app numbers them itself', () => {
    const names = ['1) S.P.Q.R', 'II. Andante', '3: Boudicca - Battles and Requiem', 'Intermezzo'].map(movement => PR.normalise({ pieces: [piece({ movement })] }).pieces[0].movement);
    assert.deepEqual(names, ['S.P.Q.R', 'Andante', 'Boudicca - Battles and Requiem', 'Intermezzo']);
  });
  test('they look like one work: the same title, and named as movements', () => {
    assert.equal(PR.looksLikeOneWork(suite()), true);
    assert.equal(PR.looksLikeOneWork(suite().slice(0, 1)), false);
    assert.equal(PR.looksLikeOneWork([...suite().slice(0, 2), { ...suite()[2], title: 'Something else' }]), false);
    assert.equal(PR.looksLikeOneWork(suite().map(p => ({ ...p, movement: '' }))), false);
  });
  test('joined: one piece, the bars as printed, a movement at each start, the letters as printed', () => {
    const whole = PR.join(suite());
    assert.equal(whole.bars, 46);
    assert.deepEqual(whole.movements, [{ bar: 1, title: 'Dawn' }, { bar: 21, title: 'Harvest' }, { bar: 37, title: 'Dusk' }]);
    const fitted = PR.fit(whole);
    assert.equal(fitted.about.name, 'Iceni Autumn');
    assert.deepEqual(fitted.o.marks.map(m => `${m.bar}${m.label}`), ['1A', '11B', '21A', '29B', '37A']);
    const { blocks, clashes } = PO.buildBlocks(fitted.o);
    assert.deepEqual(clashes, []);
    assert.deepEqual(blocks.filter(b => b.movementStart).map(b => [b.from, b.movementTitle]), [[1, 'Dawn'], [21, 'Harvest'], [37, 'Dusk']]);
    assert.equal(blocks.find(b => b.from === 21).bpm, 132);
    const rating = PR.rate(whole, fitted);
    assert.equal(rating.checks.filter(c => c.level === 'low').length, 0);
    assert.ok(rating.checks.some(c => c.kind === 'speed' && /movement 3/.test(c.text)));
  });
  test('joined where a movement\'s printed numbers miss the count before it: the count is kept, and it is Low', () => {
    const [dawn, harvest, dusk] = suite();
    const whole = PR.join([{ ...dawn, bars: 19, systems: lines([1, 11], 19), tail: tailFor({ systems: lines([1, 11], 19) }) }, harvest, dusk]);
    assert.equal(whole.bars, 45);
    assert.deepEqual(whole.movements.map(m => m.bar), [1, 20, 36]);
    const rating = PR.rate(whole, PR.fit(whole));
    assert.equal(rating.level, 'low');
    assert.ok(rating.checks.some(c => c.level === 'low' && /Movement 2's bar numbers start at 21/.test(c.text)));
  });
});

describe('ML-657: the time signature first, a read again with what the member says, and a march\'s strains', () => {
  test('a time signature the reader couldn\'t make out is a guess - asked first, with a read again offered', () => {
    const { rating } = fitAndRate({ bars: 16, systems: lines([1, 9], 16), timeSeen: false, time: [{ bar: 1, beats: 6, beatType: 8 }] });
    const guess = rating.checks.find(c => c.ask && c.ask.type === 'timeGuess');
    assert.ok(guess, 'asked');
    assert.equal(guess.level, 'medium');
    assert.match(guess.text, /6\/8 is a guess/);
    // an answer from before the field was asked for counts as seen
    assert.equal(fitAndRate({ bars: 16, systems: lines([1, 9], 16) }).rating.checks.some(c => c.ask && c.ask.type === 'timeGuess'), false);
  });
  test('what the member says is checked - numbers and true/false only, never anything typed', () => {
    assert.deepEqual(PR.cleanGivens({ beats: 2, beatType: 4, changes: 'yes', pickup: true, bars: 64 }), { beats: 2, beatType: 4, changes: false, pickup: true, bars: 64 });
    assert.deepEqual(PR.cleanGivens({ beats: '6', beatType: '8', bars: 'about 60' }), { beats: 6, beatType: 8, changes: false, pickup: false, bars: null });
    assert.equal(PR.cleanGivens({ beats: 5, beatType: 3 }), null);
    assert.equal(PR.cleanGivens({ beats: 'ignore the rules', beatType: 4 }), null);
    assert.equal(PR.cleanGivens(null), null);
    assert.equal(PR.cleanGivens({ beats: 2, beatType: 4, bars: 99999 }).bars, null);
  });
  test('a march\'s strain of 15 or 17 bars is asked about; 16, an intro of 4 and other pieces are not', () => {
    // intro 4, then strains of 16, 15 (a bar missing?) and 16 between double barlines
    const march = { bars: 51, systems: lines([1, 21, 41], 51), doubleBars: [{ bar: 4 }, { bar: 20 }, { bar: 35 }] };
    const strain = (over) => fitAndRate({ ...march, ...over }).rating.checks.filter(c => c.kind === 'strain');
    const asked = strain({});
    assert.equal(asked.length, 1);
    assert.deepEqual([asked[0].from, asked[0].to], [21, 35]);
    assert.match(asked[0].text, /15 bars, and marches usually have 16\. Is a bar missing\?/);
    // only one 16 and no "march" in the title: not a march, nothing asked
    assert.equal(strain({ bars: 36, systems: lines([1, 21], 36), doubleBars: [{ bar: 4 }, { bar: 20 }] }).length, 0);
    // "March" in the title is enough
    assert.equal(strain({ title: 'Slaidburn March', bars: 35, systems: lines([1, 21], 35), doubleBars: [{ bar: 4 }, { bar: 20 }] }).length, 1);
    // a repeated strain with 1st and 2nd time bars is as long as the first time through: 16, not 17
    const withEndings = fitAndRate({ title: 'A march', bars: 37, systems: lines([1, 21], 37), doubleBars: [{ bar: 4 }],
      repeats: [{ from: 5, to: 20, times: 2, firstEndingFrom: 20, lastEndingTo: 21 }] }).rating.checks.filter(c => c.kind === 'strain');
    assert.deepEqual(withEndings.map(c => [c.from, c.to]), [], 'bars 5 to 21 are 17 on the page, 16 the first time through');
  });
  test('PR.strains splits the piece at double barlines, repeats and movements', () => {
    const r = read({ bars: 40, systems: lines([1, 21], 40), doubleBars: [{ bar: 8 }], repeats: [{ from: 9, to: 24, times: 2, firstEndingFrom: null, lastEndingTo: null }] });
    assert.deepEqual(PR.strains(r).map(s => [s.from, s.to, s.bars]), [[1, 8, 8], [9, 24, 16], [25, 40, 16]]);
  });
  test('a read again tells the reader what was said, and the count has to reach the bars given', async () => {
    const saved = process.env.AI_GATEWAY_API_KEY;
    process.env.AI_GATEWAY_API_KEY = 'test-key';
    try {
      let body;
      const answer = { ok: true, status: 200, json: async () => ({ choices: [{ message: { content: JSON.stringify({ pieces: [piece({ bars: 30, systems: lines([1, 16], 30), timeSeen: false, time: [{ bar: 1, beats: 2, beatType: 4 }] })] }) }, finish_reason: 'stop' }], usage: {} }) };
      const out = await readPieceFromFiles([Buffer.from('%PDF-1.7 a longer file')], { givens: { beats: 2, beatType: 4, changes: false, pickup: false, bars: 32 }, fetchImpl: async (url, init) => { body = JSON.parse(init.body); return answer; } });
      const said = body.messages[1].content.at(-1).text;
      assert.match(said, /It starts in 2\/4/);
      assert.match(said, /stays in 2\/4 throughout/);
      assert.match(said, /no pickup/);
      assert.match(said, /32 bars in all/);
      const checks = out.pieces[0].rating.checks;
      assert.equal(checks.some(c => c.ask && c.ask.type === 'timeGuess'), false, 'the member said the time - nothing to ask');
      assert.ok(checks.some(c => /You said it has 32 bars in all, but it was read as 30/.test(c.text)));
    } finally {
      if (saved === undefined) delete process.env.AI_GATEWAY_API_KEY; else process.env.AI_GATEWAY_API_KEY = saved;
    }
  });
});

describe('ML-657 part 3: what the quick look at the pages means', () => {
  test('a clean look stops nothing; a page on its side is turned, not stopped for', () => {
    const j = PR.judgePages({ pages: [{ page: 1, music: true, printedNumber: null, cutOff: [], readable: true, turned: 'left' }], beats: 2, beatType: 4, timeSure: true, lastPageEnds: true }, 1);
    assert.deepEqual(j.problems, []);
    assert.deepEqual(j.turns, [{ page: 1, quarters: 1 }]);
    assert.deepEqual(j.time, { beats: 2, beatType: 4 });
  });
  test('a missing page, a cut-off edge, an unreadable page and no end are each said, page by page', () => {
    const page = (n, over) => ({ page: n, music: true, printedNumber: n, cutOff: [], readable: true, turned: 'upright', ...over });
    const j = PR.judgePages({ pages: [page(1), page(2, { cutOff: ['right', 'right', 'nowhere'] }), page(3, { printedNumber: 4, readable: false })], beats: null, beatType: null, timeSure: false, lastPageEnds: false }, 3);
    assert.deepEqual(j.problems.map(p => p.kind), ['cut', 'unreadable', 'missing', 'end']);
    assert.match(j.problems[0].text, /Page 2's right edge is cut off/);
    const missing = j.problems.find(p => p.kind === 'missing');
    assert.match(missing.text, /Page 3 seems to be missing \(the pages are numbered 1, 2, 4\)/);
    assert.equal(missing.before, 3, 'it goes before the page numbered 4');
    assert.equal(j.time, null, 'no time signature read: the member is asked before the read');
  });
  test('a page that is not music is said, and nothing else about it', () => {
    const j = PR.judgePages({ pages: [{ page: 1, music: false, printedNumber: null, cutOff: ['top'], readable: false, turned: 'upright' }], timeSure: false, lastPageEnds: true }, 1);
    assert.deepEqual(j.problems.map(p => p.kind), ['notMusic']);
  });
  test('turned pages told to the reader are checked: real pages, a quarter, half or three quarters', () => {
    assert.deepEqual(PR.cleanTurns([{ page: 2, quarters: 1 }, { page: 0, quarters: 1 }, { page: 3, quarters: 4 }, { page: 'x', quarters: 2 }, { page: 4, quarters: 3 }]), [{ page: 2, quarters: 1 }, { page: 4, quarters: 3 }]);
    assert.deepEqual(PR.cleanTurns('nope'), []);
  });
});
