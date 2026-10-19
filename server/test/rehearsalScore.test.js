// ML-488 (the rehearsal score, step C): the piece's bars mapped onto a recording - the sums in
// public/flowJourney.js, the same file the app serves, loaded with vm. Pure, no DB.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const sandbox = { self: {} };
vm.runInNewContext(fs.readFileSync(new URL('../../public/flowJourney.js', import.meta.url), 'utf8'), sandbox);
const FJ = new Proxy(sandbox.self.FlowJourney, {
    get: (t, k) => (typeof t[k] === 'function' ? (...args) => JSON.parse(JSON.stringify(t[k](...args))) : t[k])
});

let nextId = 1;
function blk(name, o = {}) {
    return {
        id: nextId++, name, numerator: 4, denominator: 4, barCount: 1, bpm: 120, noteValue: 'crotchet',
        isRepeatStart: false, isRepeatEnd: false, repeatPlayCount: null, isSectionBoundary: false, isFinalBarline: false,
        isSegno: false, isCoda: false, gotoSegno: false, gotoSegnoThenCoda: false, gotoCoda: false, gotoStartDc: false,
        gotoStartDcThenCoda: false, isFine: false, repeatEndingNumbers: [], repeatEndingStartBar: null,
        introStartBarOffset: null, introEndBarOffset: null, fermatas: [], ramps: [],
        ...o
    };
}
// 4/4 at 120 = 2 seconds a bar; at 60 = 4 seconds a bar.
const eight = () => [blk('A', { barCount: 8 })];
const starts = (map) => map.places.map(p => p.startMs);
const mark = (places, place, atMs) => ({ place, number: places[place].number, pass: places[place].pass, atMs });

describe('places: every bar the piece plays, in the order it plays them', () => {
    test('a plain piece: one place a bar, each with its length and where it falls', () => {
        const places = FJ.journeyPlaces(eight(), {});
        assert.equal(places.length, 8);
        assert.deepEqual(places.map(p => p.number), [1, 2, 3, 4, 5, 6, 7, 8]);
        assert.deepEqual(places.map(p => p.seconds), [2, 2, 2, 2, 2, 2, 2, 2]);
        assert.deepEqual(places.map(p => p.at), [0, 2, 4, 6, 8, 10, 12, 14]);
    });

    test('a repeat gives a bar two places, and each says which time through it is', () => {
        const blocks = [blk('A', { barCount: 2, isRepeatStart: true, isRepeatEnd: true }), blk('B', { barCount: 1 })];
        const places = FJ.journeyPlaces(blocks, {});
        assert.deepEqual(places.map(p => [p.number, p.pass]), [[1, 1], [2, 1], [1, 2], [2, 2], [3, 1]]);
        assert.equal(FJ.placeLabel(places, 0), 'Bar 1 (1st time)');
        assert.equal(FJ.placeLabel(places, 2), 'Bar 1 (2nd time)');
        assert.equal(FJ.placeLabel(places, 4), 'Bar 3');
        assert.equal(FJ.placeLabel(places, 99), '');
    });

    test('the lead-in bar is not a place: it is the metronome\'s count-in, not the music', () => {
        const leadIn = blk('lead', { barCount: 1 });
        const places = FJ.journeyPlaces(eight(), { leadIn });
        assert.equal(places.length, 8);
        assert.equal(places[0].number, 1);
        assert.equal(places[0].at, 0);
    });

    test('speeds and pauses change how long a bar lasts', () => {
        const blocks = [blk('A', { barCount: 2 }), blk('B', { barCount: 1, bpm: 60 }), blk('C', { barCount: 1, fermatas: [{ kind: 'fermata', barOffset: 0, beatOffset: 4, holdBeats: 3 }] })];
        const places = FJ.journeyPlaces(blocks, {});
        assert.deepEqual(places.map(p => p.seconds), [2, 2, 4, 3]); // the held beat is 2 beats longer: 1 second more
        assert.deepEqual(places.map(p => p.at), [0, 2, 4, 8]);
    });
});

describe('the map: where each bar is in the recording', () => {
    test('with nothing marked, bar 1 is at the very start and the piece runs at its own speeds', () => {
        const map = FJ.recordingMap(eight(), {}, [], null);
        assert.deepEqual(starts(map), [0, 2000, 4000, 6000, 8000, 10000, 12000, 14000]);
        assert.equal(map.totalMs, 16000);
        assert.deepEqual(map.marks, []);
    });

    test('the start mark is where bar 1 begins', () => {
        const map = FJ.recordingMap(eight(), {}, [], { startMs: 12000, endMs: null });
        assert.deepEqual(starts(map).slice(0, 3), [12000, 14000, 16000]);
        assert.equal(map.totalMs, 28000);
    });

    test('a start and an end mark fit the whole piece between them: a band that plays slower is stretched', () => {
        // The piece says 16 seconds; the band took 20 - every bar is a quarter longer
        const map = FJ.recordingMap(eight(), {}, [], { startMs: 10000, endMs: 30000 });
        assert.deepEqual(starts(map), [10000, 12500, 15000, 17500, 20000, 22500, 25000, 27500]);
        assert.equal(map.places[7].endMs, 30000);
    });

    test('a mark pins a bar, and the bars either side are stretched or squeezed to meet it', () => {
        const places = FJ.journeyPlaces(eight(), {});
        // Bar 5 (place 4) should be at 8s by the piece; the band got there at 10s
        const map = FJ.recordingMap(eight(), {}, [mark(places, 4, 10000)], null);
        assert.deepEqual(starts(map).slice(0, 5), [0, 2500, 5000, 7500, 10000]);
        // after the last mark it carries on as slow as the stretch before it
        assert.deepEqual(starts(map).slice(5), [12500, 15000, 17500]);
        assert.equal(map.marks.length, 1);
    });

    test('bars keep their proportions inside a stretch: a slow bar stays longer than a fast one', () => {
        const blocks = [blk('A', { barCount: 2 }), blk('B', { barCount: 1, bpm: 60 }), blk('C', { barCount: 1 })]; // 2 + 2 + 4 + 2 seconds
        const places = FJ.journeyPlaces(blocks, {});
        // bar 4 (place 3) is at 8s by the piece; marked at 16s - everything before it takes twice as long
        const map = FJ.recordingMap(blocks, {}, [mark(places, 3, 16000)], null);
        assert.deepEqual(starts(map), [0, 4000, 8000, 16000]);
        assert.deepEqual(map.places.map(p => p.endMs - p.startMs), [4000, 4000, 8000, 4000]);
    });

    test('two marks: each stretch is fitted on its own, and beyond the ends the nearest stretch carries on', () => {
        const places = FJ.journeyPlaces(eight(), {});
        // bar 3 (4s by the piece) at 5s, bar 7 (12s by the piece) at 11s: between them 8s of music took 6s
        const map = FJ.recordingMap(eight(), {}, [mark(places, 2, 5000), mark(places, 6, 11000)], null);
        assert.deepEqual(starts(map), [0, 2500, 5000, 6500, 8000, 9500, 11000, 12500]);
        assert.equal(map.totalMs, 14000);
    });

    test('a mark on bar 1 wins over the start mark', () => {
        const places = FJ.journeyPlaces(eight(), {});
        const map = FJ.recordingMap(eight(), {}, [mark(places, 0, 3000)], { startMs: 1000, endMs: null });
        assert.equal(map.places[0].startMs, 3000);
        assert.equal(map.places[1].startMs, 5000);
    });

    test('a start mark that is later than the first bar mark is ignored - the bar mark is the surer of the two', () => {
        const places = FJ.journeyPlaces(eight(), {});
        const map = FJ.recordingMap(eight(), {}, [mark(places, 2, 5000)], { startMs: 9000, endMs: null });
        // bar 3 at 5s, at the piece's own speed: bar 1 at 1s
        assert.deepEqual(starts(map).slice(0, 3), [1000, 3000, 5000]);
    });

    test('nothing in the map is ever before the start of the recording', () => {
        const places = FJ.journeyPlaces(eight(), {});
        const map = FJ.recordingMap(eight(), {}, [mark(places, 4, 2000)], null); // bar 5 at 2s: the band started before the recording did
        assert.ok(map.places.every(p => p.startMs >= 0 && p.endMs >= 0));
        assert.equal(map.places[4].startMs, 2000);
    });

    test('a repeat is mapped in the order it is played', () => {
        const blocks = [blk('A', { barCount: 2, isRepeatStart: true, isRepeatEnd: true }), blk('B', { barCount: 1 })];
        const map = FJ.recordingMap(blocks, {}, [], { startMs: 1000, endMs: null });
        assert.deepEqual(map.places.map(p => [p.number, p.pass, p.startMs]), [[1, 1, 1000], [2, 1, 3000], [1, 2, 5000], [2, 2, 7000], [3, 1, 9000]]);
    });

    test('a piece with no bars has no map', () => {
        assert.equal(FJ.recordingMap([], {}, [], null), null);
    });
});

describe('marks that can and can\'t be used', () => {
    test('marks are put in order, and one that would make the recording run backwards is dropped', () => {
        const places = FJ.journeyPlaces(eight(), {});
        const used = FJ.usableMarks(places, [mark(places, 6, 12000), mark(places, 2, 4000), mark(places, 4, 3000)]);
        assert.deepEqual(used.map(m => [m.place, m.atMs]), [[2, 4000], [6, 12000]]);
    });

    test('a mark is dropped when the piece has changed under it, or it was never in the piece', () => {
        const places = FJ.journeyPlaces(eight(), {});
        const stale = { place: 3, number: 9, pass: 1, atMs: 5000 };      // place 3 is bar 4 now, not bar 9
        const wrongPass = { place: 3, number: 4, pass: 2, atMs: 5000 };  // bar 4 is no longer in a repeat
        const outside = { place: 40, number: 41, pass: 1, atMs: 5000 };
        const notATime = { place: 1, number: 2, pass: 1, atMs: 'soon' };
        const negative = { place: 1, number: 2, pass: 1, atMs: -5 };
        assert.deepEqual(FJ.usableMarks(places, [stale, wrongPass, outside, notATime, negative, mark(places, 5, 9000)]).map(m => m.place), [5]);
        assert.deepEqual(FJ.usableMarks(places, null), []);
    });

    test('two marks on the same place: the first is kept', () => {
        const places = FJ.journeyPlaces(eight(), {});
        assert.deepEqual(FJ.usableMarks(places, [mark(places, 2, 4000), mark(places, 2, 6000)]).map(m => m.atMs), [4000]);
    });
});

describe('where the recording is, and repeating bars on it', () => {
    test('which bar is playing at a time in the recording', () => {
        const map = FJ.recordingMap(eight(), {}, [], { startMs: 10000, endMs: null });
        assert.equal(FJ.placeAt(map, 0), -1);       // the conductor is still talking
        assert.equal(FJ.placeAt(map, 9999), -1);
        assert.equal(FJ.placeAt(map, 10000), 0);
        assert.equal(FJ.placeAt(map, 11999), 0);
        assert.equal(FJ.placeAt(map, 12000), 1);
        assert.equal(FJ.placeAt(map, 25999), 7);
        assert.equal(FJ.placeAt(map, 26000), -1);   // the piece is over
        assert.equal(FJ.placeAt(null, 5000), -1);
    });

    test('repeat bars: the stretch of the recording those bars are', () => {
        const map = FJ.recordingMap(eight(), {}, [], { startMs: 10000, endMs: null });
        assert.deepEqual(FJ.mapLoop(map, 3, 4, 0), { ok: true, startMs: 14000, endMs: 18000, fromPlace: 2, toPlace: 3 });
        // a lead of half a second starts it early, so a map that is a touch out still catches the first note
        assert.equal(FJ.mapLoop(map, 3, 4, 500).startMs, 13500);
        // ...but never earlier than the bar before
        assert.equal(FJ.mapLoop(map, 3, 4, 5000).startMs, 12000);
        // from bar 1 it may reach back before the piece, but not before the recording
        assert.equal(FJ.mapLoop(map, 1, 2, 500).startMs, 9500);
        assert.equal(FJ.mapLoop(FJ.recordingMap(eight(), {}, [], null), 1, 2, 500).startMs, 0);
        assert.deepEqual(FJ.mapLoop(map, 1, 1, 0), { ok: true, startMs: 10000, endMs: 12000, fromPlace: 0, toPlace: 0 });
    });

    test('repeat bars follows the piece\'s order, as the metronome\'s repeat does', () => {
        const blocks = [blk('A', { barCount: 2, isRepeatStart: true, isRepeatEnd: true }), blk('B', { barCount: 1 })];
        const map = FJ.recordingMap(blocks, {}, [], null);
        // bars 2 to 1: the end of the first time through, round to the start of the second
        assert.deepEqual(FJ.mapLoop(map, 2, 1, 0), { ok: true, startMs: 2000, endMs: 6000, fromPlace: 1, toPlace: 2 });
        // bars 1 to 3 starts at the first time bar 1 plays
        assert.deepEqual(FJ.mapLoop(map, 1, 3, 0), { ok: true, startMs: 0, endMs: 10000, fromPlace: 0, toPlace: 4 });
    });

    test('bars that can\'t be repeated say why', () => {
        const map = FJ.recordingMap(eight(), {}, [], null);
        assert.deepEqual(FJ.mapLoop(map, 6, 2, 0), { ok: false, reason: 'endNotReached' });
        assert.deepEqual(FJ.mapLoop(map, 12, 14, 0), { ok: false, reason: 'startNeverPlays' });
        assert.deepEqual(FJ.mapLoop(null, 1, 2, 0), { ok: false, reason: 'noMap' });
    });
});

describe('a recording of one movement (ML-531)', () => {
    // Dawn: bars 1-4 · Harvest: bars 5-8, with a repeat of 5-6 · Dusk: bar 9
    const suite = () => [blk('A', { barCount: 4 }), blk('B', { barCount: 2, movementStart: true, isRepeatStart: true, isRepeatEnd: true }), blk('C', { barCount: 2 }), blk('D', { movementStart: true })];
    test('its places are that movement only, place 0 its first bar', () => {
        const places = FJ.journeyPlaces(suite(), { movement: 2 });
        assert.deepEqual(places.map(p => p.number), [5, 6, 5, 6, 7, 8]);
        assert.deepEqual(places.map(p => p.pass), [1, 1, 2, 2, 1, 1]);
        assert.equal(places[0].at, 0);
        assert.equal(FJ.journeyPlaces(suite(), {}).length, 4 + 6 + 1); // the whole piece, as before
    });
    test('its start mark is the movement\'s first bar, and repeat bars work in it by bar number', () => {
        const map = FJ.recordingMap(suite(), { movement: 2 }, [], { startMs: 30000, endMs: null });
        assert.equal(map.places[0].number, 5);
        assert.equal(map.places[0].startMs, 30000);
        assert.equal(map.places[1].startMs, 32000);
        const loop = FJ.mapLoop(map, 7, 8, 0);
        assert.equal(loop.ok, true);
        assert.equal(loop.startMs, 30000 + 4 * 2000);
        assert.equal(FJ.mapLoop(map, 2, 3, 0).reason, 'startNeverPlays'); // bars of another movement aren't in it
    });
    test('marks made on the whole piece don\'t fit a movement\'s recording, and are left out', () => {
        const whole = FJ.journeyPlaces(suite(), {});
        const marks = [mark(whole, 4, 9000)]; // bar 5, place 4 of the whole piece
        assert.equal(FJ.usableMarks(FJ.journeyPlaces(suite(), { movement: 2 }), marks).length, 0);
        const mv = FJ.journeyPlaces(suite(), { movement: 2 });
        assert.equal(FJ.usableMarks(mv, [mark(mv, 0, 9000)]).length, 1);
    });
});

describe('matching the piece\'s speeds to a recording (ML-533)', () => {
    // two 8-bar blocks of 4/4 at 120 - two seconds a bar
    const two = () => [blk('A', { barCount: 8 }), blk('B', { barCount: 8 })];
    test('a block the band played slower gets a slower speed; the marks are then hit to a fraction of a second', () => {
        const blocks = two();
        const places = FJ.journeyPlaces(blocks, {});
        // bar 1 at 0 s, bar 9 at 18 s (A took 18 s, not 16), the end of B at 34 s
        const out = FJ.matchSpeeds(blocks, {}, [mark(places, 0, 0), mark(places, 8, 18000)], { startMs: null, endMs: 34000 });
        assert.equal(out.ok, true);
        assert.deepEqual(out.changes.map(c => [c.fromBar, c.toBar, c.oldBpm, c.newBpm]), [[1, 8, 120, 107]]);
        assert.equal(out.blocks[1].bpm, 120);
        assert.ok(out.maxErrorSeconds < 0.1);
        assert.deepEqual(out.inside, []);
    });
    test('the rounding is carried on, so the error doesn\'t build up', () => {
        const blocks = [blk('A', { barCount: 4 }), blk('B', { barCount: 4 }), blk('C', { barCount: 4 }), blk('D', { barCount: 4 })];
        const places = FJ.journeyPlaces(blocks, {});
        // every block 1.25% slow: 8.1 s instead of 8 s
        const ms = [0, 8100, 16200, 24300];
        const out = FJ.matchSpeeds(blocks, {}, ms.map((t, k) => mark(places, k * 4, t)), { startMs: null, endMs: 32400 });
        assert.ok(out.maxErrorSeconds < 0.1, `max error ${out.maxErrorSeconds}`);
        assert.ok(out.blocks.every(b => Number.isInteger(b.bpm)));
    });
    test('a mark inside a block is listed - it is hit only roughly', () => {
        const blocks = two();
        const places = FJ.journeyPlaces(blocks, {});
        const out = FJ.matchSpeeds(blocks, {}, [mark(places, 0, 0), mark(places, 4, 9000)], { startMs: null, endMs: null });
        assert.deepEqual(out.inside.map(m => [m.number, m.pass]), [[5, 1]]);
        assert.ok(out.inside[0].errorSeconds >= 0);
    });
    test('a ramp to a set speed is scaled with its block; with no bar marked there is nothing to match', () => {
        const blocks = [blk('A', { barCount: 8, ramps: [{ startBarOffset: 4, startBeatOffset: 1, endMode: 'block_end', targetMode: 'custom', targetBpm: 100 }] }), blk('B', { barCount: 8 })];
        const places = FJ.journeyPlaces(blocks, {});
        const out = FJ.matchSpeeds(blocks, {}, [mark(places, 0, 0), mark(places, 8, 20000)], { startMs: null, endMs: null });
        const a = out.blocks[0];
        assert.ok(a.bpm < 120);
        assert.equal(a.ramps[0].targetBpm, Math.round(100 * a.bpm / 120));
        assert.equal(FJ.matchSpeeds(two(), {}, [], { startMs: 1000, endMs: null }).reason, 'noMarks');
    });
});
