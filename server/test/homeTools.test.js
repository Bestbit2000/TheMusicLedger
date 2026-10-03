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
    assert.equal(pageIds.length, 11); // ML-406: Pitch, Tempo, Pulse and Rhythm are one Skills tile
    assert.equal([...pageIds].sort().join(), [...serverIds].sort().join());
});

test('the tiles live on the All tools page, not on Home', () => {
    const main = html.slice(html.indexOf('<div id="mainView">'), html.indexOf('<div id="toolsView"'));
    assert.doesNotMatch(main, /data-tool="/);
    assert.match(main, /id="homeToolsRow"/);
});

test('the routine is in the order it is practised: Warm-ups, Scales, Add a piece, Rehearse', () => {
    const routine = html.slice(html.indexOf('id="toolGroup-routine"'), html.indexOf('id="toolGroup-learn"'));
    assert.deepEqual([...routine.matchAll(/data-tool="([a-z-]+)"/g)].map(m => m[1]), ['warmups', 'scales', 'add-piece', 'prepare', 'rehearse']); // ML-400 / ML-401: add, prepare, then rehearse
});

// ML-388: how many fit comes from the home_tools limit (Admin -> Feature access), not a number in the code.
test('how many tools fit on Home is the home_tools limit, seeded Standard 4 and everyone else 8', () => {
    assert.doesNotMatch(app, /HOME_TOOLS_MAX\b/);
    assert.match(app, /appData\.limits\?\.home_tools/);
    const sql = fs.readFileSync(new URL('../../db/migrations/085_home_tools_limit.sql', import.meta.url), 'utf8');
    const seeded = Object.fromEntries([...sql.matchAll(/\('([a-z_]+)', (\d+)\)/g)].map(m => [m[1], Number(m[2])]));
    assert.deepEqual(seeded, { standard_member: 4, premium_member: 8, beta_tester: 8, teacher: 8, band_admin: 8, super_admin: 8 });
});

test('the default Home tools are real tools, four of them', () => {
    const defaults = JSON.parse(/HOME_TOOLS_DEFAULT = (\[[^\]]*\])/.exec(app)[1].replace(/'/g, '"'));
    assert.deepEqual(defaults, ['metronome', 'tuner', 'timer', 'rehearse']); // Everyday + Rehearse (four or fewer tools on: all of them)
    assert.ok(defaults.every(id => serverIds.includes(id)));
});

// ML-406: one Learn group - Theory, Skills, Range - and Skills lists the four drill tools.
test('Learn holds Theory, Skills and Range, and the four drill tools have no tile of their own', () => {
    const learn = html.slice(html.indexOf('id="toolGroup-learn"'), html.indexOf('class="tools-done-bar"'));
    assert.deepEqual([...learn.matchAll(/data-tool="([a-z-]+)"/g)].map(m => m[1]), ['theory', 'skills', 'range']);
    for (const id of ['pitch', 'tempo', 'pulse', 'rhythm']) assert.ok(!pageIds.includes(id) && !serverIds.includes(id));
    assert.match(html, /id="skillsHubView"/);
});
