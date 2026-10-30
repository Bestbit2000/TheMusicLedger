// ML-595: the filter rules every list's Filter button uses (public/filters.js), loaded with vm. Pure, no DB.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const sandbox = { self: {} };
vm.runInNewContext(fs.readFileSync(new URL('../../public/filters.js', import.meta.url), 'utf8'), sandbox);
const F = sandbox.self.Filters;
const plain = (v) => JSON.parse(JSON.stringify(v));

test('ML-666: pieces go A to Z, and a The at the start does not count', () => {
  const titled = ['The Christmas Song', 'Bugler\'s Holiday', 'the Arrival', 'Zadok', 'Piece 10', 'Piece 2', 'Theme from Z', 'The', ''].map((title) => ({ title }));
  assert.deepEqual(plain(titled.slice().sort(F.byTitle).map((p) => p.title)),
    ['', 'the Arrival', 'Bugler\'s Holiday', 'The Christmas Song', 'Piece 2', 'Piece 10', 'The', 'Theme from Z', 'Zadok']);
});

const pieces = [
    { id: 1, whose: 'mine', recordings: 1, prepared: false },
    { id: 2, whose: 'mine', recordings: 0, prepared: true },
    { id: 3, whose: 'band:7', recordings: 2, prepared: false },
    { id: 4, whose: 'public', recordings: 0, prepared: false }
];
const groups = [
    { key: 'whose', label: 'Whose', options: [{ value: 'mine', label: 'Mine' }, { value: 'band:7', label: 'Wind band' }, { value: 'public', label: 'Public' }] },
    { key: 'has', label: 'Has', options: [{ value: 'recording', label: 'A recording' }] },
    { key: 'prepared', label: 'Prepared', single: true, options: [{ value: 'yes', label: 'Prepared' }, { value: 'no', label: 'Not prepared yet' }] },
    { key: 'archived', label: 'Archived', apply: false, options: [{ value: 'yes', label: 'Archived pieces' }] }
];
const match = (p, key, v) => (key === 'whose' ? p.whose === v : key === 'has' ? p.recordings > 0 : key === 'prepared' ? p.prepared === (v === 'yes') : false);
const ids = (list) => list.map(p => p.id);

describe('filtering a list (ML-595)', () => {
    test('nothing ticked shows everything', () => {
        assert.deepEqual(ids(F.apply(pieces, groups, {}, match)), [1, 2, 3, 4]);
        assert.equal(F.activeCount(groups, {}), 0);
    });

    test('within a group any choice will do; across groups every group must match', () => {
        assert.deepEqual(ids(F.apply(pieces, groups, { whose: ['mine', 'band:7'] }, match)), [1, 2, 3]);
        assert.deepEqual(ids(F.apply(pieces, groups, { whose: ['mine', 'band:7'], has: ['recording'] }, match)), [1, 3]);
        assert.deepEqual(ids(F.apply(pieces, groups, { whose: ['mine'], has: ['recording'], prepared: ['no'] }, match)), [1]);
    });

    test('a choice counts what it would show, with the other groups as they are', () => {
        const state = { has: ['recording'] };
        assert.equal(F.count(pieces, groups, state, match, 'whose', 'mine'), 1);
        assert.equal(F.count(pieces, groups, state, match, 'whose', 'public'), 0);
        // its own group's other choices don't narrow it
        assert.equal(F.count(pieces, groups, { whose: ['public'] }, match, 'whose', 'mine'), 2);
    });

    test('the button counts the filters on, and each one is a chip in the pop-up\'s order', () => {
        const state = { prepared: ['no'], whose: ['public', 'mine'], archived: ['yes'] };
        assert.equal(F.activeCount(groups, state), 4);
        assert.deepEqual(plain(F.chips(groups, state)).map(c => c.label), ['Mine', 'Public', 'Not prepared yet', 'Archived pieces']);
    });

    test('a group the screen handles itself is shown and counted, but does not narrow the list', () => {
        assert.deepEqual(ids(F.apply(pieces, groups, { archived: ['yes'] }, match)), [1, 2, 3, 4]);
    });

    test('ticking and unticking; a single-choice group holds one', () => {
        let s = F.toggle({}, groups, 'whose', 'mine');
        s = F.toggle(s, groups, 'whose', 'public');
        assert.deepEqual(plain(s), { whose: ['mine', 'public'] });
        s = F.toggle(s, groups, 'whose', 'mine');
        assert.deepEqual(plain(s), { whose: ['public'] });
        s = F.toggle(s, groups, 'prepared', 'yes');
        s = F.toggle(s, groups, 'prepared', 'no');
        assert.deepEqual(plain(s.prepared), ['no']);
    });

    test('a choice no longer offered (a band left) is dropped', () => {
        assert.deepEqual(plain(F.clean(groups, { whose: ['band:99', 'mine'], has: [] })), { whose: ['mine'] });
        assert.equal(F.activeCount(groups, { whose: ['band:99'] }), 0);
    });
});
