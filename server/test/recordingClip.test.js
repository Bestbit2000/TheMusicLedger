// ML-312 (the rehearsal score, step A): the rules for where a recording or video starts and ends on a
// piece - public/flowJourney.js, the same file the app serves, loaded with vm. Pure, no DB.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const sandbox = { self: {} };
vm.runInNewContext(fs.readFileSync(new URL('../../public/flowJourney.js', import.meta.url), 'utf8'), sandbox);
const FJ = new Proxy(sandbox.self.FlowJourney, {
    get: (t, k) => (typeof t[k] === 'function' ? (...args) => JSON.parse(JSON.stringify(t[k](...args))) : t[k])
});

test('a clip is two whole numbers of milliseconds, and either end may be left open', () => {
    assert.deepEqual(FJ.cleanClip({ startMs: 12000.4, endMs: 220000.6 }), { ok: true, startMs: 12000, endMs: 220001 });
    assert.deepEqual(FJ.cleanClip({ startMs: 12000 }), { ok: true, startMs: 12000, endMs: null });
    assert.deepEqual(FJ.cleanClip({ endMs: 220000 }), { ok: true, startMs: null, endMs: 220000 });
    assert.deepEqual(FJ.cleanClip({}), { ok: true, startMs: null, endMs: null });
    assert.deepEqual(FJ.cleanClip(null), { ok: true, startMs: null, endMs: null });
    assert.deepEqual(FJ.cleanClip({ startMs: '', endMs: null }), { ok: true, startMs: null, endMs: null });
    assert.deepEqual(FJ.cleanClip({ startMs: '5000', endMs: '9000' }), { ok: true, startMs: 5000, endMs: 9000 });
});

test('a start of nothing is no start, and an end at or past the end of the recording is no end', () => {
    assert.deepEqual(FJ.cleanClip({ startMs: 0, endMs: 5000 }), { ok: true, startMs: null, endMs: 5000 });
    assert.deepEqual(FJ.cleanClip({ startMs: 2000, endMs: 60000 }, 60000), { ok: true, startMs: 2000, endMs: null });
    assert.deepEqual(FJ.cleanClip({ startMs: 2000, endMs: 90000 }, 60000), { ok: true, startMs: 2000, endMs: null });
    assert.deepEqual(FJ.cleanClip({ startMs: 2000, endMs: 59000 }, 60000), { ok: true, startMs: 2000, endMs: 59000 });
});

test('a clip that makes no sense is refused with a reason, never mended', () => {
    const refused = (clip, duration) => { const out = FJ.cleanClip(clip, duration); assert.equal(out.ok, false); assert.ok(out.message.length > 10); };
    refused({ startMs: -1 });
    refused({ startMs: 'soon' });
    refused({ endMs: 0 });
    refused({ endMs: -5 });
    refused({ startMs: 9000, endMs: 5000 });   // ends before it starts
    refused({ startMs: 5000, endMs: 5400 });   // shorter than a second
    refused({ endMs: 400 });                   // shorter than a second from the very start
    refused({ startMs: 70000 }, 60000);        // starts after the recording is over
    refused({ startMs: 13 * 60 * 60 * 1000 }); // longer than any recording
    assert.deepEqual(FJ.cleanClip({ startMs: 5000, endMs: 6000 }), { ok: true, startMs: 5000, endMs: 6000 }); // a second is enough
});

test('a nudge moves one end and keeps it in the recording and clear of the other end', () => {
    const clip = { startMs: 10000, endMs: 20000 };
    assert.deepEqual(FJ.nudgeClip(clip, 'start', -1000, 60000), { startMs: 9000, endMs: 20000 });
    assert.deepEqual(FJ.nudgeClip(clip, 'start', 1000, 60000), { startMs: 11000, endMs: 20000 });
    assert.deepEqual(FJ.nudgeClip(clip, 'end', 1000, 60000), { startMs: 10000, endMs: 21000 });
    assert.deepEqual(FJ.nudgeClip(clip, 'end', -1000, 60000), { startMs: 10000, endMs: 19000 });
    // not past the start of the recording - and at the very start there is no start mark
    assert.deepEqual(FJ.nudgeClip({ startMs: 500, endMs: 20000 }, 'start', -1000, 60000), { startMs: null, endMs: 20000 });
    // not into the other end: a second is always left between them
    assert.deepEqual(FJ.nudgeClip({ startMs: 19500, endMs: 20000 }, 'start', 1000, 60000), { startMs: 19000, endMs: 20000 });
    assert.deepEqual(FJ.nudgeClip({ startMs: 10000, endMs: 10500 }, 'end', -1000, 60000), { startMs: 10000, endMs: 11000 });
    // past the end of the recording is "to the end"
    assert.deepEqual(FJ.nudgeClip({ startMs: 10000, endMs: 59500 }, 'end', 1000, 60000), { startMs: 10000, endMs: null });
});

test('an open end is nudged from where it really is', () => {
    assert.deepEqual(FJ.nudgeClip({ startMs: null, endMs: null }, 'start', 1000, 60000), { startMs: 1000, endMs: null });
    assert.deepEqual(FJ.nudgeClip({ startMs: null, endMs: null }, 'end', -1000, 60000), { startMs: null, endMs: 59000 });
    // with no length known, an open end cannot be moved
    assert.deepEqual(FJ.nudgeClip({ startMs: 5000, endMs: null }, 'end', -1000, null), { startMs: 5000, endMs: null });
    assert.deepEqual(FJ.nudgeClip(null, 'start', 2000, null), { startMs: 2000, endMs: null });
});

test('times read as a player\'s clock does', () => {
    assert.equal(FJ.clockText(0), '0:00');
    assert.equal(FJ.clockText(999), '0:00');
    assert.equal(FJ.clockText(75300), '1:15');
    assert.equal(FJ.clockText(600000), '10:00');
    assert.equal(FJ.clockText(3723000), '1:02:03');
    assert.equal(FJ.clockText(null), '0:00');
});

test('what a clip says on its button', () => {
    assert.equal(FJ.clipLabel({ startMs: 12000, endMs: 220000 }), '0:12 to 3:40');
    assert.equal(FJ.clipLabel({ startMs: 12000, endMs: null }), 'From 0:12');
    assert.equal(FJ.clipLabel({ startMs: null, endMs: 220000 }), 'Up to 3:40');
    assert.equal(FJ.clipLabel({ startMs: null, endMs: null }), 'All of it');
    assert.equal(FJ.clipLabel(null), 'All of it');
    assert.equal(FJ.clipLabel({}), 'All of it');
});

test('a player keeps to its clip: it goes to the start, plays, and stops at the end', () => {
    const clip = { startMs: 10000, endMs: 20000 };
    assert.equal(FJ.clipAction(clip, 0, false), 'seek');       // before the start
    assert.equal(FJ.clipAction(clip, 0, true), 'seek');
    assert.equal(FJ.clipAction(clip, 9900, true), 'play');     // a hair early is the start
    assert.equal(FJ.clipAction(clip, 10000, true), 'play');
    assert.equal(FJ.clipAction(clip, 15000, true), 'play');
    assert.equal(FJ.clipAction(clip, 20000, true), 'stop');    // just reached the end while playing
    assert.equal(FJ.clipAction(clip, 20300, true), 'stop');
    assert.equal(FJ.clipAction(clip, 20000, false), 'seek');   // pressing play at the end starts again
    assert.equal(FJ.clipAction(clip, 45000, true), 'seek');    // dragged well past the end
    // open ends
    assert.equal(FJ.clipAction({ startMs: null, endMs: null }, 0, true), 'play');
    assert.equal(FJ.clipAction({ startMs: null, endMs: 20000 }, 0, true), 'play');
    assert.equal(FJ.clipAction({ startMs: 10000, endMs: null }, 999000, true), 'play');
    assert.equal(FJ.clipAction(null, 5000, true), 'play');
});
