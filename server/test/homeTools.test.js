// ML-378: the All tools page and Home's "My tools" - the tiles' ids match what the server accepts, the
// routine runs in the order it's practised, and the default favourites are real tools.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const html = fs.readFileSync(new URL('../../public/index.html', import.meta.url), 'utf8');
const accounts = fs.readFileSync(new URL('../services/accounts.js', import.meta.url), 'utf8');
const app = fs.readFileSync(new URL('../../public/app.js', import.meta.url), 'utf8');
const serverIds = JSON.parse(/HOME_TOOL_IDS = (\[[^\]]*\])/.exec(accounts)[1].replace(/'/g, '"'));
const pageIds = [...html.matchAll(/data-tool="([a-z-]+)"/g)].map(m => m[1]);

test('every tool on the All tools page is one the server accepts, and the other way round', () => {
    assert.equal(pageIds.length, 12);
    assert.equal([...pageIds].sort().join(), [...serverIds].sort().join());
});

test('the tiles live on the All tools page, not on Home', () => {
    const main = html.slice(html.indexOf('<div id="mainView">'), html.indexOf('<div id="toolsView"'));
    assert.doesNotMatch(main, /data-tool="/);
    assert.match(main, /id="homeToolsRow"/);
});

test('the routine is in the order it is practised: Warm-ups, Scales, Rehearse', () => {
    const routine = html.slice(html.indexOf('id="toolGroup-routine"'), html.indexOf('id="toolGroup-ear"'));
    assert.deepEqual([...routine.matchAll(/data-tool="([a-z-]+)"/g)].map(m => m[1]), ['warmups', 'scales', 'rehearse']);
});

test('the default Home tools are real tools, four of them', () => {
    const defaults = JSON.parse(/HOME_TOOLS_DEFAULT = (\[[^\]]*\])/.exec(app)[1].replace(/'/g, '"'));
    assert.deepEqual(defaults, ['metronome', 'tuner', 'timer', 'warmups']);
    assert.ok(defaults.every(id => serverIds.includes(id)));
});
