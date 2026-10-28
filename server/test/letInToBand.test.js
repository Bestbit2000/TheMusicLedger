// ML-646: Admin -> Waiting list's Let in puts someone straight into the band they asked to join - only a band the
// owner organises - and they are in it at their first sign-in; someone with an account is added at once. Band
// invitations count against a day's and a quarter's allowance. Against the dev database (email goes to
// email_outbox there), with throwaway rows:
//   node --env-file=../.env --test test/letInToBand.test.js      (from server/)
import { test, after } from 'node:test';
import assert from 'node:assert/strict';

const onDev = process.env.NEON_BRANCH === 'dev' && !!process.env.DATABASE_URL;
process.env.DATABASE_URL ||= 'postgres://test@localhost/test';
process.env.SESSION_SECRET ||= 'test-secret-for-letInToBand';
const skip = !onDev && 'needs the dev database';
const stamp = Date.now();
const accounts = [];
const bands = [];
let pool;
if (onDev) ({ default: pool } = await import('../config/db.js'));
const one = async (sql, params) => (await pool.query(sql, params)).rows[0];
const address = (name) => `ml646-${name}-${stamp}@themusicledger.local`;
const account = async (name, level = 'super_admin') => {
  const id = Number((await one(`INSERT INTO accounts (email, first_name, surname, account_level, organiser_adult_confirmed_on) VALUES ($1, $2, 'Test', $3, CURRENT_DATE) RETURNING id`, [address(name), name, level])).id);
  accounts.push(id);
  return id;
};
const request = async (name, directoryBandId) => Number((await one(
  `INSERT INTO join_requests (first_name, last_name, email, directory_band_id, age_confirmed) VALUES ($1, 'Test', $2, $3, true) RETURNING id`,
  [name, address(name), directoryBandId])).id);

after(async () => {
  if (!onDev) return;
  await pool.query(`DELETE FROM join_requests WHERE email LIKE $1`, [`ml646-%-${stamp}@%`]).catch(() => {});
  await pool.query(`DELETE FROM band_invites WHERE email LIKE $1`, [`ml646-%-${stamp}@%`]).catch(() => {});
  await pool.query(`DELETE FROM auth_email_links WHERE email LIKE $1`, [`ml646-%-${stamp}@%`]).catch(() => {});
  await pool.query(`DELETE FROM email_outbox WHERE to_email LIKE $1`, [`ml646-%-${stamp}@%`]).catch(() => {});
  const made = (await pool.query(`SELECT id FROM accounts WHERE email LIKE $1`, [`ml646-%-${stamp}@%`])).rows.map((r) => Number(r.id));
  const all = [...new Set([...accounts, ...made])];
  await pool.query(`DELETE FROM notifications WHERE id IN (SELECT notification_id FROM notification_recipients WHERE account_id = ANY($1))`, [all]).catch(() => {});
  await pool.query(`DELETE FROM bands WHERE created_by_account_id = ANY($1) OR id = ANY($2)`, [all, bands]).catch(() => {});
  for (const id of all) await pool.query('DELETE FROM accounts WHERE id = $1', [id]).catch(() => {});
  await pool.end().catch(() => {});
});

test('ML-646: Let in with the band - one email, in the band at first sign-in; Add to band - in at once; never a band you don\'t organise', { skip }, async () => {
  const b = await import('../services/bands.js');
  const { letInJoinRequest, listJoinRequests } = await import('../services/joinRequests.js');
  const { getOrCreateAccount } = await import('../services/accounts.js');
  const owner = await account('owner');
  const other = await account('other');
  const directory = Number((await one(`INSERT INTO bands (name, kind, town, created_by_account_id) VALUES ($1, 'directory', 'Cobham', $2) RETURNING id`, [`ML-646 Band ${stamp}`, owner])).id);
  bands.push(directory);
  // the owner's shared space for that band, and someone else's band
  const label = Number((await one(`INSERT INTO bands (name, created_by_account_id, kind, directory_band_id) VALUES ($1, $2, 'label', $3) RETURNING id`, [`ML-646 Band ${stamp}`, owner, directory])).id);
  await b.setUpSharing(owner, label);
  const space = Number((await one('SELECT shared_band_id FROM bands WHERE id = $1', [label])).shared_band_id);
  const otherLabel = Number((await one(`INSERT INTO bands (name, created_by_account_id, kind) VALUES ($1, $2, 'label') RETURNING id`, [`ML-646 Other ${stamp}`, other])).id);
  await b.setUpSharing(other, otherLabel);
  const otherSpace = Number((await one('SELECT shared_band_id FROM bands WHERE id = $1', [otherLabel])).shared_band_id);

  // The list offers the owner's band, already picked for someone who asked for it
  const newcomerReq = await request('newcomer', directory);
  const listed = await listJoinRequests(owner);
  assert.ok(listed.myBands.some((g) => g.id === space));
  assert.deepEqual(listed.requests.find((r) => r.id === newcomerReq).myBandIds, [space]);
  assert.ok(listed.allowance.left > 0);

  // Not a band you organise: refused, nothing sent
  await assert.rejects(letInJoinRequest(newcomerReq, owner, 'https://notablybetter.com', { bands: [otherSpace] }), (e) => e.status === 403);

  // Let in with the band: one email (the invitation that says the band), and a place kept, not a band email
  const before = (await b.bandInviteAllowance(owner)).usedToday;
  await letInJoinRequest(newcomerReq, owner, 'https://notablybetter.com', { bands: [space], level: 'play' });
  const mails = (await pool.query('SELECT subject, body_text FROM email_outbox WHERE to_email = $1', [address('newcomer')])).rows;
  assert.equal(mails.length, 1, 'one email');
  assert.match(mails[0].body_text, new RegExp(`in ML-646 Band ${stamp} as soon as you sign in`));
  assert.match(mails[0].body_text, /band-invite=1/);
  const kept = await one('SELECT role, from_request FROM band_invites WHERE band_id = $1 AND email = $2', [space, address('newcomer')]);
  assert.equal(kept.from_request, true);
  assert.equal(kept.role, 'player');
  assert.equal((await b.bandInviteAllowance(owner)).usedToday, before + 1, 'it counts as a band invitation');

  // First sign-in: in the band, as Can play, and told
  const newcomer = Number(await getOrCreateAccount(address('newcomer'), 'newcomer', 'Test'));
  accounts.push(newcomer);
  const member = await one('SELECT role FROM band_members WHERE band_id = $1 AND account_id = $2', [space, newcomer]);
  assert.equal(member?.role, 'player');
  assert.equal((await pool.query('SELECT 1 FROM band_invites WHERE band_id = $1 AND email = $2', [space, address('newcomer')])).rows.length, 0, 'the place is taken up');

  // Someone with an account already: added at once, no app invitation
  const existing = await account('existing', 'standard_member');
  const existingReq = await request('existing', directory);
  const out = await letInJoinRequest(existingReq, owner, 'https://notablybetter.com', { bands: [space], level: 'change' });
  assert.equal(out.joined, 1);
  assert.equal((await one('SELECT role FROM band_members WHERE band_id = $1 AND account_id = $2', [space, existing]))?.role, 'member');
  assert.equal((await pool.query('SELECT 1 FROM auth_email_links WHERE lower(email) = lower($1)', [address('existing')])).rows.length, 0, 'no app invitation');
  // ...and with no band picked, an account already there is refused (nothing to do)
  const again = await request('existing2', directory);
  await account('existing2', 'standard_member');
  await assert.rejects(letInJoinRequest(again, owner, 'https://notablybetter.com', { bands: [] }), (e) => e.status === 409);
});

test('ML-646: Let in everyone asking for a band, and the allowance stops it when used up', { skip }, async () => {
  const b = await import('../services/bands.js');
  const { letInAllForBand } = await import('../services/joinRequests.js');
  const owner = await account('owner2');
  const directory = Number((await one(`INSERT INTO bands (name, kind, town, created_by_account_id) VALUES ($1, 'directory', 'Cobham', $2) RETURNING id`, [`ML-646 All ${stamp}`, owner])).id);
  bands.push(directory);
  const label = Number((await one(`INSERT INTO bands (name, created_by_account_id, kind, directory_band_id) VALUES ($1, $2, 'label', $3) RETURNING id`, [`ML-646 All ${stamp}`, owner, directory])).id);
  await b.setUpSharing(owner, label);
  const space = Number((await one('SELECT shared_band_id FROM bands WHERE id = $1', [label])).shared_band_id);
  for (const n of ['a1', 'a2', 'a3']) await request(n, directory);
  const out = await letInAllForBand(space, owner, 'https://notablybetter.com', 'play');
  assert.equal(out.letIn, 3);
  assert.deepEqual(out.notLetIn, []);
  assert.equal((await pool.query('SELECT 1 FROM band_invites WHERE band_id = $1 AND from_request', [space])).rows.length, 3);

  // Used up for the day: the next is refused with the reason
  const a = await b.bandInviteAllowance(owner);
  await pool.query(`INSERT INTO band_invite_sends (account_id, band_id) SELECT $1, $2 FROM generate_series(1, $3)`, [owner, space, a.perDay - a.usedToday]);
  await request('a4', directory);
  const more = await letInAllForBand(space, owner, 'https://notablybetter.com', 'play');
  assert.equal(more.letIn, 0);
  assert.match(more.notLetIn[0], /band invitation/);
});
