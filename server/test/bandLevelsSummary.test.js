// ML-581: the band leader's summary - never anyone by name or on their own (product value 2). The sums are tested
// without a database; who may see it, whose Levels count and that the answer holds nobody are tested against the
// dev database (as bandGroups.test.js is), with throwaway accounts it removes again:
//   node --env-file=../.env --test test/bandLevelsSummary.test.js      (from server/)

import { test, after } from 'node:test';
import assert from 'node:assert/strict';

const onDev = process.env.NEON_BRANCH === 'dev' && !!process.env.DATABASE_URL;
process.env.DATABASE_URL ||= 'postgres://test@localhost/test';

const { summariseLevels, bandLevelsSummary, MIN_PLAYERS } = await import('../services/bandLevelsSummary.js');

test('ML-581: nothing is shown until 3 players have shared Levels on the piece', () => {
  assert.equal(MIN_PLAYERS, 3);
  const two = [[1, 2, 3], [2, 3, 4]];
  assert.deepEqual(summariseLevels(two, 3), { enough: false, bars: [], piece: null, mostWork: [] });
  // A player with no Levels on the piece doesn't count towards the 3
  assert.equal(summariseLevels([...two, [null, null, null]], 3).enough, false);
});

test('ML-581: each bar and the piece - the average, and the lowest to highest', () => {
  const r = summariseLevels([
    [1, 2, 5, null],
    [2, 2, 4, null],
    [3, 2, 5, 3]
  ], 4);
  assert.equal(r.enough, true);
  assert.deepEqual(r.bars[0], { avg: 2, lo: 1, hi: 3 });
  assert.deepEqual(r.bars[1], { avg: 2, lo: 2, hi: 2 });
  assert.deepEqual(r.bars[2], { avg: 4.7, lo: 4, hi: 5 });
  assert.equal(r.bars[3], null, 'a bar only one player has a Level on is left blank');
  // each player's piece Level is their average: 2.7, 2.7, 3.25
  assert.deepEqual(r.piece, { avg: 2.9, lo: 2.7, hi: 3.3 });
});

test('ML-581: the bars needing the most work are runs of the lowest bars, lowest first, at most 3', () => {
  const p = (xs) => xs;
  const players = [p([4, 1, 1, 4, 2, 4, 1]), p([4, 1, 2, 4, 2, 4, 2]), p([4, 2, 1, 4, 1, 4, 1])];
  const r = summariseLevels(players, 7);
  // averages: 4, 1.3, 1.3, 4, 1.7, 4, 1.3 - within half a Level of 1.3: bars 2-3, 5, 7
  assert.deepEqual(r.mostWork, [{ from: 2, to: 3, avg: 1.3 }, { from: 7, to: 7, avg: 1.3 }, { from: 5, to: 5, avg: 1.7 }]);
  // every bar at full speed: nothing to list
  assert.deepEqual(summariseLevels([[5, 5], [5, 5], [5, 5]], 2).mostWork, []);
});

// ---------- against the dev database ----------
const skip = !onDev && 'needs the dev database';
const stamp = Date.now();
const accounts = [];
let pool;
if (onDev) ({ default: pool } = await import('../config/db.js'));
const one = async (sql, params) => (await pool.query(sql, params)).rows[0];

after(async () => {
  if (!onDev) return;
  await pool.query(`DELETE FROM scores WHERE owner_account_id = ANY($1) OR added_by_account_id = ANY($1)`, [accounts]).catch(() => {});
  await pool.query(`DELETE FROM bands WHERE created_by_account_id = ANY($1)`, [accounts]).catch(() => {});
  for (const id of accounts) await pool.query('DELETE FROM accounts WHERE id = $1', [id]).catch(() => {});
  await pool.end().catch(() => {});
});

test('ML-581: only the band leader sees it, only sharing players count, and the answer holds nobody', { skip }, async () => {
  const bands = await import('../services/bands.js');
  const flows = await import('../services/flows.js');
  const account = async (name) => {
    const id = Number((await one(`INSERT INTO accounts (email, first_name, surname, organiser_adult_confirmed_on) VALUES ($1, $2, 'Test', CURRENT_DATE) RETURNING id`, [`ml581-${name}-${stamp}@themusicledger.local`, name])).id);
    accounts.push(id);
    return id;
  };
  const organiser = await account('organiser');
  const leader = await account('leader');
  const [a, b, c, quiet] = [await account('a'), await account('b'), await account('c'), await account('quiet')];
  const label = Number((await one(`INSERT INTO bands (name, created_by_account_id, kind) VALUES ($1, $2, 'label') RETURNING id`, [`ML-581 Band ${stamp}`, organiser])).id);
  await bands.setUpSharing(organiser, label);
  const bandId = Number((await one('SELECT shared_band_id FROM bands WHERE id = $1', [label])).shared_band_id);
  for (const id of [leader, a, b, c, quiet]) await pool.query(`INSERT INTO band_members (band_id, account_id, role) VALUES ($1, $2, 'player')`, [bandId, id]);

  const piece = await flows.createFlow(organiser, { name: `ML-581 piece ${stamp}`, bandId });
  const { createFlowBlock } = await import('../services/flowBlocks.js');
  await createFlowBlock(organiser, piece.id, { bpm: 100, barCount: 4, timeSignatureId: 1, accountTimeSignatureId: null, noteValue: 'crotchet' });
  const levels = async (who, perBar) => {
    for (const [i, level] of perBar.entries()) {
      await pool.query(`INSERT INTO piece_chunks (account_id, score_id, kind, start_bar, end_bar, level, bars_total_at_setup) VALUES ($1, $2, 'chunk', $3, $3, $4, 4)`, [who, piece.id, i + 1, level]);
    }
  };
  await levels(a, [1, 2, 3, 4]);
  await levels(b, [1, 2, 3, 4]);
  await levels(c, [3, 2, 3, 4]);
  await levels(quiet, [5, 5, 5, 5]); // never switched it on - must not count

  // Not a band leader: refused - an organiser included
  await assert.rejects(bandLevelsSummary(organiser, piece.id), (e) => e.status === 403);
  await bands.setBandLeader(organiser, bandId, leader, true);
  // A player can't make themselves the band leader
  await assert.rejects(bands.setBandLeader(a, bandId, a, true), (e) => e.status === 403);

  // Nobody has switched it on yet
  assert.equal((await bandLevelsSummary(leader, piece.id)).enough, false);
  await bands.setSharesLevels(a, bandId, true);
  await bands.setSharesLevels(b, bandId, true);
  assert.equal((await bandLevelsSummary(leader, piece.id)).enough, false, 'two is not enough');
  await bands.setSharesLevels(c, bandId, true);

  const summary = await bandLevelsSummary(leader, piece.id);
  assert.equal(summary.enough, true);
  assert.deepEqual(summary.bars[0], { avg: 1.7, lo: 1, hi: 3 }); // quiet's 5s are not in it
  assert.deepEqual(summary.mostWork[0], { from: 1, to: 2, avg: 1.9 });
  // Nobody in it: no account id, name or email anywhere in the answer, and no count of players
  const text = JSON.stringify(summary);
  for (const id of [organiser, leader, a, b, c, quiet]) assert.ok(!new RegExp(`\\b${id}\\b`).test(text), `account ${id} is not in the answer`);
  assert.ok(!/ml581-|organiser|"name"|"account|"players"|"count"/i.test(text), text);

  // Members see who the band leader is; only your own sharing is in your answer - not even an organiser sees others'
  const asOrganiser = await bands.listBandMembers(organiser, bandId);
  assert.equal(asOrganiser.members.find((m) => m.accountId === leader).isBandLeader, true);
  assert.equal(asOrganiser.yourSharesLevels, false);
  assert.ok(!JSON.stringify(asOrganiser.members).includes('shares'), 'no member row says whether they share');
  assert.equal((await bands.listBandMembers(a, bandId)).yourSharesLevels, true);

  // Switching it off takes them out again
  await bands.setSharesLevels(c, bandId, false);
  assert.equal((await bandLevelsSummary(leader, piece.id)).enough, false);
});
