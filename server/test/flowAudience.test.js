// ML-441: "Who it's for" on a piece's edit screen (setFlowAudience, server/services/flows.js) - against a
// real database, because the rule is about who ends up holding the piece. Runs only when pointed at the dev
// branch:
//   node --env-file=../.env --env-file=.env --test test/flowAudience.test.js      (from server/)
// Under plain `npm test` (no database) it is skipped. Everything it makes belongs to throwaway accounts,
// which it removes again.

import { test, after } from 'node:test';
import assert from 'node:assert/strict';

const onDev = process.env.NEON_BRANCH === 'dev' && !!process.env.DATABASE_URL && !!process.env.SESSION_SECRET;
process.env.DATABASE_URL ||= 'postgres://test@localhost/test';

const { default: pool } = await import('../config/db.js');
const { setFlowAudience, duplicateFlow } = await import('../services/flows.js');

const stamp = Date.now();
const accounts = [];
const bands = [];
const one = async (sql, params) => (await pool.query(sql, params)).rows[0];
const account = async (name, level = 'standard_member') => {
  const id = Number((await one(`INSERT INTO accounts (email, first_name, surname, account_level) VALUES ($1, $2, 'Test', $3) RETURNING id`, [`ml441-${name}-${stamp}@themusicledger.local`, name, level])).id);
  accounts.push(id);
  return id;
};
const band = async (name, creator, members) => {
  const id = Number((await one(`INSERT INTO bands (name, created_by_account_id) VALUES ($1, $2) RETURNING id`, [`ML-441 ${name} ${stamp}`, creator])).id);
  bands.push(id);
  for (const m of members) await pool.query(`INSERT INTO band_members (band_id, account_id) VALUES ($1, $2)`, [id, m]);
  return id;
};
const row = (id) => one('SELECT owner_account_id, owner_band_id, added_by_account_id, is_public FROM scores WHERE id = $1', [id]);

after(async () => {
  if (onDev) {
    for (const id of accounts) await pool.query('DELETE FROM scores WHERE owner_account_id = $1 OR added_by_account_id = $1', [id]).catch(() => {});
    for (const id of bands) await pool.query('DELETE FROM bands WHERE id = $1', [id]).catch(() => {});
    for (const id of accounts) await pool.query('DELETE FROM accounts WHERE id = $1', [id]).catch(() => {});
  }
  await pool.end().catch(() => {});
});

test('a piece goes to a band, on to another band and back to just me - by the person who added it only', { skip: !onDev && 'needs the dev database' }, async () => {
  const me = await account('adder');
  const mate = await account('mate');
  const brass = await band('brass', me, [me, mate]);
  const wind = await band('wind', me, [me]);
  const notMine = await band('other', mate, [mate]);
  const piece = Number((await one(`INSERT INTO scores (title, owner_account_id) VALUES ('ML-441 piece', $1) RETURNING id`, [me])).id);

  // just me -> a band I'm in: the band holds it, and I'm the one who added it
  let dto = await setFlowAudience(me, piece, 'band', brass);
  assert.equal(dto.ownerBandId, brass);
  assert.equal(dto.canDelete, true);
  assert.deepEqual(await row(piece), { owner_account_id: null, owner_band_id: String(brass), added_by_account_id: String(me), is_public: false });

  // a band mate can copy it into their own library (their own piece, the band's untouched)
  const copy = await duplicateFlow(mate, piece); // the new piece's id
  assert.deepEqual(await row(copy), { owner_account_id: String(mate), owner_band_id: null, added_by_account_id: null, is_public: false });
  assert.equal(Number((await row(piece)).owner_band_id), brass);

  // a band mate can open it but not change who it's for
  await assert.rejects(() => setFlowAudience(mate, piece, 'me'), /Only the person who added this piece/);
  await assert.rejects(() => setFlowAudience(mate, piece, 'band', notMine), /Only the person who added this piece/);

  // not to a band I'm not in, and not to everyone
  await assert.rejects(() => setFlowAudience(me, piece, 'band', notMine), /not a member/);
  await assert.rejects(() => setFlowAudience(me, piece, 'public'), /super admin/);
  await assert.rejects(() => setFlowAudience(me, piece, 'nowhere'), /Choose who/);

  // band -> band in one step
  dto = await setFlowAudience(me, piece, 'band', wind);
  assert.equal(dto.ownerBandId, wind);
  assert.equal(Number((await row(piece)).added_by_account_id), me);

  // and back to just me
  dto = await setFlowAudience(me, piece, 'me');
  assert.equal(dto.ownerBandId, null);
  assert.deepEqual(await row(piece), { owner_account_id: String(me), owner_band_id: null, added_by_account_id: null, is_public: false });

  // someone else's own piece is not mine to move
  await assert.rejects(() => setFlowAudience(mate, piece, 'band', notMine));
});

test('everyone is a super admin\'s: public and back, and public straight to a band', { skip: !onDev && 'needs the dev database' }, async () => {
  const admin = await account('admin', 'super_admin');
  const club = await band('club', admin, [admin]);
  const piece = Number((await one(`INSERT INTO scores (title, owner_account_id) VALUES ('ML-441 public piece', $1) RETURNING id`, [admin])).id);

  let dto = await setFlowAudience(admin, piece, 'public');
  assert.equal(dto.isPublic, true);
  dto = await setFlowAudience(admin, piece, 'band', club);
  assert.equal(dto.isPublic, false);
  assert.equal(dto.ownerBandId, club);
  dto = await setFlowAudience(admin, piece, 'public');
  assert.deepEqual(await row(piece), { owner_account_id: String(admin), owner_band_id: null, added_by_account_id: null, is_public: true });
  dto = await setFlowAudience(admin, piece, 'me');
  assert.equal(dto.isPublic, false);
  assert.equal(dto.ownerAccountId, admin);
});
