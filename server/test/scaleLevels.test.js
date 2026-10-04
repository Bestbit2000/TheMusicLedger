// ML-391: Scales Levels - the rules in public/practicePlan.js. The five Levels, ABRSM's guide speeds,
// which scales a block takes ("everyone up together"), what an answer does (one Level up a day, learnt at
// Level 5, a learnt one coming back), and where the whole list stands.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

// Loaded with vm, like practicePlan.test.js; results come back as plain JSON so they compare across realms.
const sandbox = { self: {} };
vm.runInNewContext(fs.readFileSync(new URL('../../public/practicePlan.js', import.meta.url), 'utf8'), sandbox);
const plain = (v) => (v === undefined ? v : JSON.parse(JSON.stringify(v)));
const P = new Proxy(sandbox.self.PracticePlan, { get: (t, k) => (typeof t[k] === 'function' ? (...args) => plain(t[k](...args)) : plain(t[k])) });

const item = (type, keyId, form = 'major', grades = [2], extra = {}) => {
    const it = { type, keyId, form, octaves: 1, pattern: null, grades, ...extra };
    return { ...it, key: P.scaleKey(it) };
};
const DAY = 86400000;
const NOW = Date.parse('2026-10-04T10:00:00Z');
const ago = (days) => new Date(NOW - days * DAY).toISOString();

test('the five Levels: notes slowly, notes faster, just the key, just the name, the name at full speed', () => {
    assert.deepEqual(P.SCALE_LEVELS.map(l => [l.level, l.detail, l.percent]), [[1, 'notes', 60], [2, 'notes', 80], [3, 'key', 80], [4, 'name', 80], [5, 'name', 100]]);
    assert.equal(P.scaleLevelSpec(0).level, 1);
    assert.equal(P.scaleLevelSpec(9).level, 5);
});

test('full speed is ABRSM\'s guide speed for the grade: brass, trombone and woodwind scales', () => {
    assert.deepEqual(P.SCALE_SPEEDS.brass.scale.bpm, [50, 56, 63, 72, 80, 104, 112, 126]);
    assert.deepEqual(P.SCALE_SPEEDS.trombone.scale.bpm, [44, 48, 56, 63, 72, 96, 108, 120]);
    assert.deepEqual(P.SCALE_SPEEDS.woodwind.scale.bpm, [50, 56, 63, 72, 84, 96, 112, 132]);
    assert.equal(P.scaleSpeedFamily('trombone-bass-clef', 'brass'), 'trombone');
    assert.equal(P.scaleSpeedFamily('bass-trombone', 'brass'), 'trombone');
    assert.equal(P.scaleSpeedFamily('baritone-euphonium-treble', 'brass'), 'brass');
    assert.equal(P.scaleSpeedFamily('flute', 'woodwind'), 'woodwind');
});

test('a Grade 2 brass scale: every note clicked at 67 then 90, and two notes a beat at 56 for Level 5', () => {
    const d = item('scale', 'D minor', 'harmonic');
    assert.deepEqual(P.scaleSpeed(d, 1, 'brass', [1, 2]), { bpm: 67, npb: 1, notesPerMinute: 67, grade: 2 });
    for (const level of [2, 3, 4]) assert.deepEqual(P.scaleSpeed(d, level, 'brass', [1, 2]), { bpm: 90, npb: 1, notesPerMinute: 90, grade: 2 });
    assert.deepEqual(P.scaleSpeed(d, 5, 'brass', [1, 2]), { bpm: 56, npb: 2, notesPerMinute: 112, grade: 2 });
});

test('arpeggios go in threes; 7ths and thirds have their own rows; a missing grade takes the nearest', () => {
    const arp = item('arpeggio', 'D major');
    assert.deepEqual(P.scaleSpeed(arp, 5, 'brass', [2]), { bpm: 24, npb: 3, notesPerMinute: 72, grade: 2 }); // a quaver = 72, in threes
    assert.equal(P.scaleSpeed(arp, 1, 'brass', [2]).bpm, 43); // 60% of 72 notes a minute, a click each
    assert.deepEqual(P.scaleSpeed(item('arpeggio', 'D major', 'major', [6]), 5, 'brass', [6]), { bpm: 40, npb: 3, notesPerMinute: 120, grade: 6 });
    assert.equal(P.scaleSpeedRow(item('dom7', 'C major')), 'seventh');
    assert.equal(P.scaleSpeedRow(item('dim7', 'G major')), 'seventh');
    assert.equal(P.scaleSpeedRow(item('arpeggio', 'D major', 'major', [7], { pattern: 'extended:D4:F#5:F#3' })), 'seventh');
    assert.equal(P.scaleSpeedRow(item('thirds', 'B♭ major')), 'thirds');
    assert.equal(P.scaleSpeedRow(item('chromatic', 'D major')), 'scale');
    assert.equal(P.scaleSpeed(item('dom7', 'C major', 'major', [4]), 5, 'woodwind', [4]).bpm, 54);
    assert.equal(P.scaleSpeed(item('dom7', 'C major', 'major', []), 5, 'brass', [2]).bpm, 46); // not asked for at Grade 2: Grade 4's
});

test('the grade a speed comes from: the highest ticked grade that asks for the scale', () => {
    const shared = item('scale', 'A minor', 'harmonic', [1, 2]);
    assert.equal(P.scaleGrade(shared, [1, 2]), 2);
    assert.equal(P.scaleGrade(shared, [1]), 1);
    assert.equal(P.scaleGrade(item('scale', 'C major', 'major', [1]), [1, 2]), 1);
    assert.equal(P.scaleGrade(item('scale', 'F# major', 'major', []), [3, 'else']), 3); // Everything else
    assert.equal(P.scaleGrade(item('scale', 'F# major', 'major', []), ['else']), 1);
});

test('one id for a scale, whatever grade asks for it', () => {
    assert.equal(P.scaleKey({ type: 'scale', keyId: 'A minor', form: 'harmonic', octaves: 1, pattern: null }), 'scale|A minor|harmonic|1|');
    assert.equal(P.scaleKey({ kind: 'scale', keyId: 'A minor', form: 'harmonic', octaves: 1 }), 'scale|A minor|harmonic|1|');
    assert.notEqual(P.scaleKey(item('scale', 'A minor', 'harmonic')), P.scaleKey(item('scale', 'A minor', 'melodic')));
});

const LIST = [item('scale', 'D major'), item('scale', 'B♭ major'), item('arpeggio', 'D major'), item('scale', 'D minor', 'harmonic'), item('scale', 'D minor', 'melodic')];
const keys = (q) => q.map(x => x.keyId + ' ' + (x.type === 'arpeggio' ? 'arp' : x.form));

test('a block takes the lowest Level first, then the one played longest ago: everyone up together', () => {
    // Nothing played: the list's own order
    assert.deepEqual(keys(P.scalePool(LIST, {}, NOW)).slice(0, 3), ['D major major', 'B♭ major major', 'D major arp']);
    const records = {
        [LIST[0].key]: { level: 2, lastPlayed: ago(1) },
        [LIST[1].key]: { level: 2, lastPlayed: ago(3) },
        [LIST[2].key]: { level: 1, lastPlayed: ago(1) },
        [LIST[3].key]: { level: 1, lastPlayed: ago(2) }
        // LIST[4]: never played, Level 1
    };
    assert.deepEqual(keys(P.scalePool(LIST, records, NOW)), ['D minor melodic', 'D minor harmonic', 'D major arp', 'B♭ major major', 'D major major']);
    // Ones already played in this block are left out
    assert.deepEqual(keys(P.scalePool(LIST, records, NOW, [LIST[4].key, LIST[3].key])), ['D major arp', 'B♭ major major', 'D major major']);
});

test('a learnt scale leaves the queue and comes back as the third after two weeks', () => {
    const records = { [LIST[0].key]: { level: 5, learnt: true, lastPlayed: ago(3) } };
    assert.ok(!P.scalePool(LIST, records, NOW).some(x => x.key === LIST[0].key));
    const due = { [LIST[0].key]: { level: 5, learnt: true, lastPlayed: ago(15) } };
    const q = P.scalePool(LIST, due, NOW);
    assert.equal(q[2].key, LIST[0].key);
    assert.equal(q[2].revisit, true);
    assert.equal(q.filter(x => x.revisit).length, 1);
    // Every scale learnt, none due: nothing to play
    const all = Object.fromEntries(LIST.map(x => [x.key, { level: 5, learnt: true, lastPlayed: ago(2) }]));
    assert.deepEqual(P.scalePool(LIST, all, NOW), []);
});

test('Got it moves a scale up one Level, once a day; at Level 5 it is learnt', () => {
    const at = ago(0);
    let r = P.scaleAnswer(undefined, true, '2026-10-04', at);
    assert.equal(r.outcome, 'up');
    assert.deepEqual(r.record, { level: 2, learnt: false, lastPlayed: at, lastUpOn: '2026-10-04' });
    // Again the same day: played, but held
    r = P.scaleAnswer(r.record, true, '2026-10-04', at);
    assert.equal(r.outcome, 'held');
    assert.equal(r.record.level, 2);
    // The next day it moves again
    r = P.scaleAnswer(r.record, true, '2026-10-05', at);
    assert.deepEqual([r.outcome, r.record.level], ['up', 3]);
    // Not yet: it stays
    r = P.scaleAnswer(r.record, false, '2026-10-06', at);
    assert.deepEqual([r.outcome, r.record.level, r.record.lastUpOn], ['stay', 3, '2026-10-05']);
    // Level 5, got it: learnt
    r = P.scaleAnswer({ level: 5, lastUpOn: '2026-10-01' }, true, '2026-10-06', at);
    assert.deepEqual([r.outcome, r.record.level, r.record.learnt], ['learnt', 5, true]);
});

test('a learnt scale that comes back: still got it keeps the star, not yet puts it back to Level 4', () => {
    const learnt = { level: 5, learnt: true, lastPlayed: ago(20), lastUpOn: '2026-09-10' };
    const kept = P.scaleAnswer(learnt, true, '2026-10-04', ago(0));
    assert.deepEqual([kept.outcome, kept.record.learnt, kept.record.lastPlayed], ['kept', true, ago(0)]);
    const back = P.scaleAnswer(learnt, false, '2026-10-04', ago(0));
    assert.deepEqual([back.outcome, back.record.learnt, back.record.level], ['back', false, 4]);
});

test('where the list stands: how many at each Level, learnt, and the next goal', () => {
    const records = {
        [LIST[0].key]: { level: 5, learnt: true },
        [LIST[1].key]: { level: 2 },
        [LIST[2].key]: { level: 2 },
        [LIST[3].key]: { level: 1 }
    };
    assert.deepEqual(P.scaleProgress(LIST, records), { counts: [2, 2, 0, 0, 0], learnt: 1, total: 5, low: 1, toGo: 2 });
    const all = Object.fromEntries(LIST.map(x => [x.key, { level: 5, learnt: true }]));
    assert.deepEqual(P.scaleProgress(LIST, all), { counts: [0, 0, 0, 0, 0], learnt: 5, total: 5, low: null, toGo: 0 });
});
