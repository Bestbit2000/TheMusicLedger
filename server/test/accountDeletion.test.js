// ML-430: "Delete my account" (server/services/accountDeletion.js) - against a real database, because
// what matters is what the database is left holding. Runs only when pointed at the dev branch:
//   node --env-file=../.env --test test/accountDeletion.test.js      (from server/)
// Under plain `npm test` (no database) it is skipped. Every row it makes belongs to throwaway
// accounts, which it removes again.

import { test, after } from 'node:test';
import assert from 'node:assert/strict';

const onDev = process.env.NEON_BRANCH === 'dev' && !!process.env.DATABASE_URL && !!process.env.SESSION_SECRET;
process.env.DATABASE_URL ||= 'postgres://test@localhost/test';

const { default: pool } = await import('../config/db.js');
const { deleteMyAccount, anonymisedEmail } = await import('../services/accountDeletion.js');
const { getOrCreateAccount, listAccountsForAdmin } = await import('../services/accounts.js');
const { currentTokenVersion, forgetTokenVersion, deletedEmailHash } = await import('../services/tokenVersions.js');

const stamp = Date.now();
const email = `ml430-delete-${stamp}@themusicledger.local`;
const made = [];
const one = async (sql, params) => (await pool.query(sql, params)).rows[0];
const count = async (table, col, id) => Number((await one(`SELECT count(*) AS n FROM ${table} WHERE ${col} = $1`, [id])).n);

after(async () => {
  if (onDev) {
    for (const id of made) await pool.query('DELETE FROM accounts WHERE id = $1', [id]).catch(() => {});
    await pool.query('DELETE FROM deleted_account_markers WHERE email_hash = $1', [deletedEmailHash(email)]).catch(() => {});
  }
  await pool.end().catch(() => {});
});

test('deleting an account scrubs it, deletes what the member made, keeps the statistics and signs every device out', { skip: !onDev && 'needs the dev database' }, async () => {
  // A member with a bit of everything
  const id = Number((await one(`INSERT INTO accounts (email, first_name, surname, display_name, token_version) VALUES ($1, 'Morag', 'Testerson', 'Mo', 3) RETURNING id`, [email])).id);
  made.push(id);
  const other = Number((await one(`INSERT INTO accounts (email, first_name, surname) VALUES ($1, 'Other', 'Member') RETURNING id`, [`ml430-other-${stamp}@themusicledger.local`])).id);
  made.push(other);
  const band = Number((await one(`INSERT INTO bands (name, created_by_account_id, kind) VALUES ($1, $2, 'group') RETURNING id`, [`ML-430 test band ${stamp}`, id])).id);
  await pool.query(`INSERT INTO band_members (band_id, account_id) VALUES ($1, $2), ($1, $3)`, [band, id, other]);
  const mine = Number((await one(`INSERT INTO scores (title, owner_account_id) VALUES ('My own piece', $1) RETURNING id`, [id])).id);
  const bandPiece = Number((await one(`INSERT INTO scores (title, owner_band_id, added_by_account_id) VALUES ('A band piece', $1, $2) RETURNING id`, [band, id])).id);
  const session = Number((await one(`INSERT INTO sessions (session_type, account_id, started_at, total_duration_minutes) VALUES ('practice', $1, now(), 25) RETURNING id`, [id])).id);
  await pool.query(`INSERT INTO session_segments (session_id, segment_type, order_index, score_id) VALUES ($1, 'performance', 0, $2)`, [session, mine]);
  await pool.query(`INSERT INTO drill_attempts (account_id, tool, level, score, grade, details, started_at) VALUES ($1, 'tapTempo', '1', 80, 4, '{}', now())`, [id]);
  await pool.query(`INSERT INTO feedback (account_id, message) VALUES ($1, 'A note from Morag')`, [id]);
  await pool.query(`INSERT INTO practice_lists (name, owner_account_id) VALUES ('Concert', $1)`, [id]);

  const result = await deleteMyAccount(id);
  assert.equal(result.deleted, true);

  // Scrubbed: nothing that says who it was
  const row = await one('SELECT * FROM accounts WHERE id = $1', [id]);
  assert.equal(row.email, anonymisedEmail(id));
  assert.equal(`${row.first_name} ${row.surname}`, 'Deleted account');
  assert.equal(row.display_name, null);
  assert.equal(row.avatar, null);
  assert.equal(row.account_level, 'standard_member');
  assert.ok(row.deleted_at);
  assert.equal(await count('accounts', 'email', email), 0);

  // Deleted: what the member made
  assert.equal(await count('scores', 'id', mine), 0);
  assert.equal(await count('feedback', 'account_id', id), 0);
  assert.equal(await count('practice_lists', 'owner_account_id', id), 0);
  assert.equal(await count('band_members', 'account_id', id), 0);

  // Kept: the statistics, with nobody's name on them; the band and its piece carry on for the others
  assert.equal(await count('sessions', 'account_id', id), 1);
  assert.equal(Number((await one('SELECT count(*) AS n FROM session_segments WHERE session_id = $1 AND score_id IS NULL', [session])).n), 1);
  assert.equal(await count('drill_attempts', 'account_id', id), 1);
  assert.equal(await count('bands', 'id', band), 1);
  assert.equal(await count('band_members', 'band_id', band), 1);
  const piece = await one('SELECT added_by_account_id FROM scores WHERE id = $1', [bandPiece]);
  assert.equal(piece.added_by_account_id, null);

  // Not in the admin's list of accounts any more
  assert.equal((await listAccountsForAdmin()).some((a) => a.id === id), false);

  // Signed out everywhere: a token from before (number 3) no longer passes for that email
  forgetTokenVersion(email);
  assert.equal(await currentTokenVersion(email), 4);

  // The same email can start again - a new, empty account that keeps old sign-ins out
  forgetTokenVersion(email);
  const again = await getOrCreateAccount(email, 'Morag', 'Testerson');
  made.push(again);
  assert.notEqual(again, id);
  assert.equal(Number((await one('SELECT token_version FROM accounts WHERE id = $1', [again])).token_version), 4);
  assert.equal(await count('deleted_account_markers', 'email_hash', deletedEmailHash(email)), 0);
  assert.equal(await count('sessions', 'account_id', again), 0);

  // It can't be done twice, and the band is left standing when its creator's row is finally removed by this test
  await assert.rejects(() => deleteMyAccount(id), /already been deleted/);
  await pool.query('DELETE FROM scores WHERE id = $1', [bandPiece]);
  await pool.query('DELETE FROM bands WHERE id = $1', [band]);
});

test('a super admin account is not deleted by the button', { skip: !onDev && 'needs the dev database' }, async () => {
  const id = Number((await one(`INSERT INTO accounts (email, first_name, surname, account_level) VALUES ($1, 'Admin', 'Test', 'super_admin') RETURNING id`, [`ml430-admin-${stamp}@themusicledger.local`])).id);
  made.push(id);
  await assert.rejects(() => deleteMyAccount(id), /super admin/);
  assert.equal((await one('SELECT deleted_at FROM accounts WHERE id = $1', [id])).deleted_at, null);
});

// ML-514: a super admin deletes an account for a member who asks. The ordinary deletion, then an email
// to say so (on dev that is a row in email_outbox). Never their own account, never a super admin's.
test('a super admin can delete an account for a member: the ordinary deletion, then an email to say so', { skip: !onDev && 'needs the dev database' }, async () => {
  const { deleteAccountAsAdmin, deletedForYouEmail } = await import('../services/accountDeletion.js');
  const adminEmail = `ml514-admin-${stamp}@themusicledger.local`;
  const admin = Number((await one(`INSERT INTO accounts (email, first_name, surname, account_level) VALUES ($1, 'Ada', 'Admin', 'super_admin') RETURNING id`, [adminEmail])).id);
  made.push(admin);
  const other = Number((await one(`INSERT INTO accounts (email, first_name, surname, account_level) VALUES ($1, 'Otto', 'Owner', 'super_admin') RETURNING id`, [`ml514-other-admin-${stamp}@themusicledger.local`])).id);
  made.push(other);
  const memberEmail = `ml514-member-${stamp}@example.com`; // an address that could be emailed (it lands in the outbox here)
  const member = Number((await one(`INSERT INTO accounts (email, first_name, surname) VALUES ($1, 'Mina', 'Member') RETURNING id`, [memberEmail])).id);
  made.push(member);
  const local = Number((await one(`INSERT INTO accounts (email, first_name, surname) VALUES ($1, 'Local', 'Dev') RETURNING id`, [`ml514-local-${stamp}@themusicledger.local`])).id);
  made.push(local);
  const outbox = async (to) => (await pool.query('SELECT subject, body_text FROM email_outbox WHERE to_email = $1', [to])).rows;

  // not their own, not another super admin's, and not one that isn't there
  await assert.rejects(deleteAccountAsAdmin(admin, admin), (e) => e.status === 400);
  await assert.rejects(deleteAccountAsAdmin(admin, other), (e) => e.status === 403);
  await assert.rejects(deleteAccountAsAdmin(admin, 0), (e) => e.status === 404);
  await assert.rejects(deleteAccountAsAdmin(admin, 'abc'), (e) => e.status === 404);
  assert.equal((await one('SELECT deleted_at FROM accounts WHERE id = $1', [other])).deleted_at, null);

  // a member: gone exactly as their own button would do it, and told
  const done = await deleteAccountAsAdmin(admin, member);
  assert.equal(done.email, memberEmail);
  assert.equal(done.emailed, false); // this site only keeps its emails
  const row = await one('SELECT email, first_name, surname, deleted_at FROM accounts WHERE id = $1', [member]);
  assert.equal(row.email, anonymisedEmail(member));
  assert.equal(`${row.first_name} ${row.surname}`, 'Deleted account');
  assert.ok(row.deleted_at);
  const sent = await outbox(memberEmail);
  assert.equal(sent.length, 1);
  assert.equal(sent[0].subject, 'Your Notably Better account has been deleted');
  assert.match(sent[0].body_text, /^Hello Mina,\n/);
  assert.match(sent[0].body_text, /If you did not ask for this, please tell us: hello@notablybetter\.com\./);
  assert.deepEqual(deletedForYouEmail('').text.split('\n')[0], 'Hello,');
  // twice is refused, and sends nothing more
  await assert.rejects(deleteAccountAsAdmin(admin, member), (e) => e.status === 404);
  assert.equal((await outbox(memberEmail)).length, 1);

  // a local test address is deleted too, with no email attempted
  const quiet = await deleteAccountAsAdmin(admin, local);
  assert.equal(quiet.emailed, false);
  assert.equal((await outbox(quiet.email)).length, 0);
  assert.ok((await one('SELECT deleted_at FROM accounts WHERE id = $1', [local])).deleted_at);

  await pool.query('DELETE FROM email_outbox WHERE to_email = $1', [memberEmail]);
  for (const e of [memberEmail, quiet.email]) await pool.query('DELETE FROM deleted_account_markers WHERE email_hash = $1', [deletedEmailHash(e)]);
});
