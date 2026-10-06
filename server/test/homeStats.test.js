// ML-387: Home's "My stats" - the Stats page's cards match what the server accepts, the defaults are real
// stats, and how many fit is the home_stats limit (Standard 2, everyone else 4), not a number in the code.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const html = fs.readFileSync(new URL('../../public/index.html', import.meta.url), 'utf8');
const accounts = fs.readFileSync(new URL('../services/accounts.js', import.meta.url), 'utf8');
const app = fs.readFileSync(new URL('../../public/app.js', import.meta.url), 'utf8');
const serverIds = JSON.parse(/HOME_STAT_IDS = (\[[^\]]*\])/.exec(accounts)[1].replace(/'/g, '"'));
const statsView = html.slice(html.indexOf('<div id="statsHomeView"'), html.indexOf('<div id="toolResultsView"'));
const pageIds = [...statsView.matchAll(/data-stat="([a-z_]+)"/g)].map(m => m[1]);

test('every stat on the Stats page is one the server accepts, and the other way round', () => {
    assert.equal(new Set(pageIds).size, pageIds.length);
    assert.equal([...pageIds].sort().join(), [...serverIds].sort().join());
});

test('each stat card opens its full page', () => {
    const cards = [...statsView.matchAll(/<button[^>]*data-stat="([a-z_]+)"[^>]*>/g)];
    assert.equal(cards.length, serverIds.length);
    for (const [tag, id] of cards) assert.match(tag, /data-act="view" data-arg="[A-Za-z]+"/, `${id} opens a page`); // ML-474: no onclick in the page
});

test('the default Home stats are real stats: practice time this week and the current streak', () => {
    const defaults = JSON.parse(/HOME_STATS_DEFAULT = (\[[^\]]*\])/.exec(app)[1].replace(/'/g, '"'));
    assert.deepEqual(defaults, ['time_week', 'streak_current']);
    assert.ok(defaults.every(id => serverIds.includes(id)));
});

test('how many fit on Home is the home_stats limit, seeded Standard 2 and everyone else 4', () => {
    assert.match(app, /appData\.limits\?\.home_stats/);
    const sql = fs.readFileSync(new URL('../../db/migrations/086_home_stats.sql', import.meta.url), 'utf8');
    const seeded = Object.fromEntries([...sql.matchAll(/\('([a-z_]+)', (\d+)\)/g)].map(m => [m[1], Number(m[2])]));
    assert.deepEqual(seeded, { standard_member: 2, premium_member: 4, beta_tester: 4, teacher: 4, band_admin: 4, super_admin: 4 });
});

test('the server keeps only known stats, once each', async () => {
    process.env.DATABASE_URL ||= 'postgres://test@localhost/test';
    const { normaliseHomeStats } = await import('../services/accounts.js');
    assert.deepEqual(normaliseHomeStats(['time_week', 'concert', 'time_week']), ['time_week', 'concert']);
    assert.equal(normaliseHomeStats(null), null);
    assert.throws(() => normaliseHomeStats(['nope']), /Unknown stat/);
    assert.throws(() => normaliseHomeStats('time_week'), /must be a list/);
});
