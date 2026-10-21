// ML-570: archive (or bring back) several pieces at once - each piece goes through setFlowArchived's own checks,
// one that is refused is reported and the rest still happen. Against a real database, because the point is
// whose pieces a member can tidy away. Runs only when pointed at the dev branch:
//   node --env-file=../.env --test test/bulkArchive.test.js      (from server/)
// Under plain `npm test` (no database) the database tests are skipped. Everything it makes belongs to throwaway
// accounts, which it removes again.

import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const onDev = process.env.NEON_BRANCH === 'dev' && !!process.env.DATABASE_URL;
process.env.DATABASE_URL ||= 'postgres://test@localhost/test';

const { default: pool } = await import('../config/db.js');
const flows = await import('../services/flows.js');

const stamp = Date.now();
const accounts = [];
const one = async (sql, params) => (await pool.query(sql, params)).rows[0];
const account = async (name) => {
  const id = Number((await one(`INSERT INTO accounts (email, first_name, surname) VALUES ($1, $2, 'Test') RETURNING id`, [`ml570-${name}-${stamp}@themusicledger.local`, name])).id);
  accounts.push(id);
  return id;
};
const archivedIds = async (accountId) => (await flows.listFlows(accountId)).filter((f) => f.archived).map((f) => f.id).sort((a, b) => a - b);
const skip = !onDev && 'needs the dev database';

after(async () => {
  if (onDev) {
    await pool.query('DELETE FROM archived_scores WHERE account_id = ANY($1)', [accounts]).catch(() => {});
    await pool.query('DELETE FROM scores WHERE owner_account_id = ANY($1)', [accounts]).catch(() => {});
    for (const id of accounts) await pool.query('DELETE FROM accounts WHERE id = $1', [id]).catch(() => {});
  }
  await pool.end().catch(() => {});
});

test('several pieces archived in one go, and brought back again', { skip }, async () => {
  const anna = await account('anna');
  const ids = [];
  for (const name of ['Old march', 'Old hymn', 'Keep this one']) ids.push((await flows.createFlow(anna, { name: `${name} ${stamp}` })).id);
  const [march, hymn, keep] = ids.map(Number);

  const out = await flows.setFlowsArchived(anna, [{ id: march }, { id: hymn }], { archived: true });
  assert.deepEqual(out.done.map((d) => d.id).sort((a, b) => a - b), [march, hymn].sort((a, b) => a - b));
  assert.deepEqual(out.failed, []);
  assert.deepEqual(await archivedIds(anna), [march, hymn].sort((a, b) => a - b));
  assert.ok(!(await archivedIds(anna)).includes(keep));

  // Undo: the same pieces the other way
  await flows.setFlowsArchived(anna, [{ id: march }, { id: hymn }], { archived: false });
  assert.deepEqual(await archivedIds(anna), []);
});

test("one that is refused is reported, and the rest still happen - never another member's piece", { skip }, async () => {
  const anna = await account('anna2');
  const ben = await account('ben2');
  const annas = Number((await flows.createFlow(anna, { name: `Anna's piece ${stamp}` })).id);
  const bens = Number((await flows.createFlow(ben, { name: `Ben's piece ${stamp}` })).id);

  const out = await flows.setFlowsArchived(anna, [{ id: bens }, { id: annas }, { id: 'x' }], { archived: true });
  assert.deepEqual(out.done.map((d) => d.id), [annas]);
  assert.deepEqual(out.failed.map((f) => f.id), [bens, 'x']);
  assert.deepEqual(await archivedIds(ben), []); // Ben's piece is untouched, for Ben
  // and Anna can't archive it for everyone either
  const forAll = await flows.setFlowsArchived(anna, [{ id: bens, forAll: true }], { archived: true });
  assert.equal(forAll.done.length, 0);
  assert.equal((await one('SELECT archived_at FROM scores WHERE id = $1', [bens])).archived_at, null);
});

test('nothing chosen, or too many, is refused before anything happens', async () => {
  await assert.rejects(flows.setFlowsArchived(1, [], { archived: true }), (e) => e.status === 400);
  await assert.rejects(flows.setFlowsArchived(1, undefined, { archived: true }), (e) => e.status === 400);
  const many = Array.from({ length: flows.MAX_BULK_ARCHIVE + 1 }, (_, i) => ({ id: i + 1 }));
  await assert.rejects(flows.setFlowsArchived(1, many, { archived: true }), (e) => e.status === 400);
});

test('the route is signed in, and comes before /flows/:id so "archive" is never read as a piece', () => {
  const api = fs.readFileSync(new URL('../routes/api.js', import.meta.url), 'utf8');
  const route = api.indexOf("router.put('/flows/archive', requireAuth, resolveAccount,");
  assert.ok(route > 0, 'PUT /flows/archive with requireAuth and resolveAccount');
  assert.ok(route < api.indexOf("router.put('/flows/:id',"), 'before PUT /flows/:id');
});
