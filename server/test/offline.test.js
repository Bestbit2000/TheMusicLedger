// ML-220: the rules for working offline (public/offline.js) - what waits, what is kept, what the bar
// says, and the order things are sent in. Pure: loaded with vm, like practicePlan.test.js. Plus the
// server's "is this time believable" rule.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const sandbox = { self: {} };
vm.runInNewContext(fs.readFileSync(new URL('../../public/offline.js', import.meta.url), 'utf8'), sandbox);
const O = sandbox.self.Offline;
const plain = (v) => JSON.parse(JSON.stringify(v));

describe('what happens to a write with no connection', () => {
    test('something logged waits to sync, with words for the list', () => {
        assert.deepEqual(plain(O.classify('POST', '/api/sessions', { duration: 30 })), { kind: 'queue', label: 'Session: 30 min' });
        assert.deepEqual(plain(O.classify('POST', '/api/practice/sessions', { minutes: 25 })), { kind: 'queue', label: 'Practice session: 25 min' });
        assert.equal(O.classify('POST', '/api/theory/attempts', {}).label, 'Theory round');
        assert.equal(O.classify('POST', '/api/drills/tap-tempo/attempts', {}).kind, 'queue');
        assert.equal(O.classify('POST', '/api/levels/chunks/41', { level: 3 }).label, 'Level 3 on a piece');
        assert.equal(O.classify('POST', '/api/practice/scale-levels/answer', {}).kind, 'queue');
        assert.equal(O.classify('PUT', '/api/practice/scale-levels/level', {}).kind, 'queue');
        assert.equal(O.classify('POST', '/api/range/7/goes', {}).kind, 'queue');
        assert.equal(O.classify('POST', '/api/metronome/quick-play', {}).kind, 'queue');
    });

    test('editing needs a connection: pieces, bands, the account, practice lists, a changed or deleted session', () => {
        for (const [m, e] of [['POST', '/api/flows'], ['PUT', '/api/flows/9'], ['PUT', '/api/flows/9/blocks/all'], ['PUT', '/api/flows/9/levels'], ['DELETE', '/api/flows/9'],
            ['POST', '/api/account/bands'], ['PUT', '/api/account'], ['DELETE', '/api/account'], ['POST', '/api/practice/lists'], ['PUT', '/api/sessions/4'], ['DELETE', '/api/sessions/4'],
            ['POST', '/api/range/7/move'], ['PUT', '/api/range/7'], ['POST', '/api/invites'], ['POST', '/api/feedback']]) {
            assert.equal(O.classify(m, e, {}).kind, 'online', `${m} ${e}`);
        }
    });

    test('keeping the server in step with a running timer or session is dropped quietly', () => {
        assert.equal(O.classify('PUT', '/api/timer/active', {}).kind, 'quiet');
        assert.equal(O.classify('DELETE', '/api/practice/active').kind, 'quiet');
        assert.equal(O.classify('POST', '/api/notifications/3/read').kind, 'quiet');
    });

    test('the address is matched without its query, and the method must match', () => {
        assert.equal(O.classify('POST', '/api/sessions?x=1', { duration: 5 }).kind, 'queue');
        assert.equal(O.classify('GET', '/api/sessions').kind, 'online');
        assert.equal(O.classify('post', '/api/sessions', { duration: 5 }).kind, 'queue');
    });
});

describe('which reads are kept on the device', () => {
    test('the member\'s own data is kept', () => {
        for (const e of ['/api/sessions', '/api/flows', '/api/flows/9/levels', '/api/dropdown-options', '/api/account', '/api/theory/attempts?settingsKey=a']) assert.equal(O.keeps(e), true, e);
    });
    test('what is running now, notifications, the data export and admin answers are not', () => {
        for (const e of ['/api/timer/active', '/api/practice/active', '/api/notifications', '/api/account/export', '/api/account/two-step/setup', '/api/admin/accounts']) assert.equal(O.keeps(e), false, e);
    });
});

describe('what the bar says', () => {
    test('online with nothing waiting: hidden', () => {
        assert.equal(O.status({ offline: false, waiting: 0, failed: 0 }).show, false);
    });
    test('offline', () => {
        assert.deepEqual(plain(O.status({ offline: true, waiting: 0, failed: 0 })), { show: true, text: 'Offline. What you log is kept on this device and synced later.', button: '' });
        assert.deepEqual(plain(O.status({ offline: true, waiting: 1, failed: 0 })), { show: true, text: 'Offline. 1 thing waiting to sync.', button: 'See them' });
        assert.equal(O.status({ offline: true, waiting: 2, failed: 1 }).text, 'Offline. 3 things waiting to sync.');
    });
    test('back online', () => {
        assert.deepEqual(plain(O.status({ offline: false, waiting: 3, failed: 0 })), { show: true, text: '3 things waiting to sync.', button: 'Sync now' });
        assert.deepEqual(plain(O.status({ offline: false, waiting: 0, failed: 1 })), { show: true, text: '1 thing could not be synced.', button: 'See why' });
        assert.equal(O.status({ offline: false, waiting: 1, failed: 1 }).button, 'Sync now');
    });
});

describe('sending what is waiting', () => {
    const items = [{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd' }];

    test('oldest first, and everything sent is reported', async () => {
        const order = [];
        const out = await O.runSync(items, async (i) => { order.push(i.id); return 'sent'; });
        assert.deepEqual(order, ['a', 'b', 'c', 'd']);
        assert.deepEqual(plain(out), { sent: ['a', 'b', 'c', 'd'], failed: [], stopped: false });
    });

    test('no connection stops there: nothing after it is tried, so the order is kept', async () => {
        const tried = [];
        const out = await O.runSync(items, async (i) => { tried.push(i.id); return i.id === 'b' ? 'stop' : 'sent'; });
        assert.deepEqual(tried, ['a', 'b']);
        assert.deepEqual(plain(out), { sent: ['a'], failed: [], stopped: true });
    });

    test('one the server refuses is kept with the reason, and the rest carry on', async () => {
        const out = await O.runSync(items, async (i) => (i.id === 'b' ? { failed: 'That piece is not there any more.' } : 'sent'));
        assert.deepEqual(plain(out), { sent: ['a', 'c', 'd'], failed: [{ id: 'b', why: 'That piece is not there any more.' }], stopped: false });
    });

    test('one already refused is not tried again, and a send that throws counts as no connection', async () => {
        const tried = [];
        const out = await O.runSync([{ id: 'a', failed: 'refused before' }, { id: 'b' }, { id: 'c' }], async (i) => { tried.push(i.id); throw new Error('network'); });
        assert.deepEqual(tried, ['b']);
        assert.equal(out.stopped, true);
    });
});

describe('ids', () => {
    test('each waiting item gets an id of its own, in the shape the server accepts', () => {
        const ids = new Set(Array.from({ length: 200 }, () => O.newId()));
        assert.equal(ids.size, 200);
        for (const id of ids) assert.match(id, /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    });
});
