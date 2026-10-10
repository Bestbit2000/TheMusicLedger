// ML-502: warning a member and closing their account (server/services/accountClosing.js) - against a
// real database, because what matters is who can still sign in afterwards. Runs only when pointed at
// the dev branch:
//   node --env-file=../.env --test test/accountClosing.test.js      (from server/)
// Under plain `npm test` (no database) it is skipped. Every row it makes belongs to throwaway accounts,
// which it removes again.

import { test, after } from 'node:test';
import assert from 'node:assert/strict';

const onDev = process.env.NEON_BRANCH === 'dev' && !!process.env.DATABASE_URL && !!process.env.SESSION_SECRET;
process.env.DATABASE_URL ||= 'postgres://test@localhost/test';

const { default: pool } = await import('../config/db.js');
const { warnAccount, closeAccount, reopenAccount, accountRecord, unblockEmail, blockedWithoutAccount, ACTION_REASONS } = await import('../services/accountClosing.js');
const { deleteMyAccount } = await import('../services/accountDeletion.js');
const { getOrCreateAccount, listAccountsForAdmin } = await import('../services/accounts.js');
const { tokenIsCurrent, emailIsShutOut, currentTokenVersion, forgetTokenVersion, deletedEmailHash } = await import('../services/tokenVersions.js');

const stamp = Date.now();
const email = `ml502-member-${stamp}@themusicledger.local`;
const made = [];
const one = async (sql, params) => (await pool.query(sql, params)).rows[0];
const newAccount = async (address, level = 'standard_member') => {
  const id = Number((await one(`INSERT INTO accounts (email, first_name, surname, account_level) VALUES ($1, 'Test', 'Member', $2) RETURNING id`, [address, level])).id);
  made.push(id);
  return id;
};

after(async () => {
  if (onDev) {
    await pool.query(`DELETE FROM notifications WHERE id IN (SELECT notification_id FROM notification_recipients WHERE account_id = ANY($1))`, [made]).catch(() => {});
    for (const id of made) await pool.query('DELETE FROM accounts WHERE id = $1', [id]).catch(() => {});
    await pool.query('DELETE FROM blocked_emails WHERE email_hash = $1', [deletedEmailHash(email)]).catch(() => {});
    await pool.query('DELETE FROM deleted_account_markers WHERE email_hash = $1', [deletedEmailHash(email)]).catch(() => {});
  }
  await pool.end().catch(() => {});
});

test('a warning is kept on the record and shown to the member; nothing else changes', { skip: !onDev && 'needs the dev database' }, async () => {
  const admin = await newAccount(`ml502-admin-${stamp}@themusicledger.local`, 'super_admin');
  const member = await newAccount(email);

  // who it can't be done to, and what must be said
  await assert.rejects(warnAccount(admin, admin, { reason: 'shared', message: 'x' }), (e) => e.status === 400);
  await assert.rejects(warnAccount(member, admin, { reason: 'shared', message: 'x' }), (e) => e.status === 403); // a super admin's account
  await assert.rejects(warnAccount(admin, 0, { reason: 'shared', message: 'x' }), (e) => e.status === 404);
  await assert.rejects(warnAccount(admin, member, { reason: 'nonsense', message: 'x' }), (e) => e.status === 400);
  await assert.rejects(warnAccount(admin, member, { reason: 'shared', message: '  ' }), (e) => e.status === 400);

  const done = await warnAccount(admin, member, { reason: 'shared', message: 'Please keep to the terms.' });
  assert.deepEqual(done, { email, emailed: false }); // a .local address is never emailed
  const { record, reasons } = await accountRecord(member);
  assert.deepEqual(reasons, ACTION_REASONS);
  assert.deepEqual(record.map((r) => [r.kind, r.reason, r.message, r.by]), [['warning', 'shared', 'Please keep to the terms.', 'Test Member']]);
  // the member sees it in the app: an urgent notification that only they get
  const told = await pool.query(
    `SELECT n.title, n.body, n.urgent FROM notifications n JOIN notification_recipients r ON r.notification_id = n.id WHERE r.account_id = $1`, [member]);
  assert.deepEqual(told.rows.map((n) => [n.title, n.body, n.urgent]), [['A warning about your account', 'Please keep to the terms.', true]]);
  // still open: they can sign in, and the admin list counts the warning
  const token = { userId: email, tv: await currentTokenVersion(email) };
  assert.equal(await tokenIsCurrent(token), true);
  assert.equal(await emailIsShutOut(email), false);
  const row = (await listAccountsForAdmin()).find((a) => a.id === member);
  assert.deepEqual([row.warnings, row.closedAt], [1, null]);
});

test('closing an account signs it out and keeps it out; reopening lets it back; the block outlives a deletion', { skip: !onDev && 'needs the dev database' }, async () => {
  const admin = made[0];
  const member = made[1];
  const before = { userId: email, tv: await currentTokenVersion(email) };
  assert.equal(await tokenIsCurrent(before), true);
  const blockedBefore = await blockedWithoutAccount();

  await assert.rejects(closeAccount(admin, admin, { reason: 'repeated', message: 'x' }), (e) => e.status === 400);
  await closeAccount(admin, member, { reason: 'repeated', message: 'Your account is closed.' });
  await assert.rejects(closeAccount(admin, member, { reason: 'repeated', message: 'again' }), (e) => e.status === 400);
  await assert.rejects(warnAccount(admin, member, { reason: 'shared', message: 'x' }), (e) => e.status === 400); // nobody to warn

  // every token is refused - the one from before, and one signed with the account's number as it is now
  assert.equal(await emailIsShutOut(email), true);
  assert.equal(await tokenIsCurrent(before), false);
  assert.equal(await tokenIsCurrent({ userId: email, tv: await currentTokenVersion(email) }), false);
  assert.equal(await tokenIsCurrent({ userId: email.toUpperCase(), tv: 999999 }), false);
  // nothing was deleted, and the admin list shows it closed
  const row = (await listAccountsForAdmin()).find((a) => a.id === member);
  assert.ok(row.closedAt);
  assert.equal(row.email, email);
  assert.equal(await blockedWithoutAccount(), blockedBefore); // its entry belongs to a closed account, not a deleted one
  await assert.rejects(unblockEmail(email), (e) => e.status === 400); // reopen it on its row instead

  // reopened: back in with a fresh sign-in; the sign-in from before the closing stays out
  await assert.rejects(reopenAccount(admin, admin), (e) => e.status === 400);
  await reopenAccount(admin, member);
  await assert.rejects(reopenAccount(admin, member), (e) => e.status === 400);
  assert.equal(await emailIsShutOut(email), false);
  assert.equal(await tokenIsCurrent(before), false);
  assert.equal(await tokenIsCurrent({ userId: email, tv: await currentTokenVersion(email) }), true);
  assert.deepEqual((await accountRecord(member)).record.map((r) => r.kind), ['reopened', 'closed', 'warning']);

  // closed again, then deleted: the record goes with the account, but the address stays blocked
  await closeAccount(admin, member, { reason: 'repeated', message: 'Closed for good.' });
  await deleteMyAccount(member);
  assert.equal((await accountRecord(member)).record.length, 0);
  assert.equal((await one('SELECT closed_at FROM accounts WHERE id = $1', [member])).closed_at, null);
  assert.equal(await blockedWithoutAccount(), blockedBefore + 1);
  assert.equal(await emailIsShutOut(email), true);
  // no token starts a new account under that address
  assert.equal(await tokenIsCurrent({ userId: email, tv: 999999 }), false);
  assert.equal((await pool.query('SELECT 1 FROM accounts WHERE email = $1', [email])).rows.length, 0);

  // the owner takes it off the list: the address can sign up again, as a new member
  await assert.rejects(unblockEmail('not an address'), (e) => e.status === 400);
  await unblockEmail(email.toUpperCase());
  await assert.rejects(unblockEmail(email), (e) => e.status === 404);
  assert.equal(await emailIsShutOut(email), false);
  forgetTokenVersion(email);
  const fresh = await getOrCreateAccount(email, 'Back', 'Again', {}, await currentTokenVersion(email));
  made.push(fresh);
  assert.notEqual(fresh, member);
});
