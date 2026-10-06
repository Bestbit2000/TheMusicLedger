// ML-465: changing the email address an account uses (server/services/emailChange.js) - against a real
// database with MAIL_PROVIDER=log, so every email lands in email_outbox and none is sent.
// Runs only when pointed at the dev branch:
//   node --env-file=../.env --env-file=.env --test test/emailChange.test.js      (from server/)
// Under plain `npm test` it is skipped, apart from the pure checks at the top. Everything it makes
// belongs to throwaway addresses, which it removes again.

import { test, after } from 'node:test';
import assert from 'node:assert/strict';

const onDev = process.env.NEON_BRANCH === 'dev' && !!process.env.DATABASE_URL && (process.env.MAIL_PROVIDER || 'log') === 'log';
process.env.DATABASE_URL ||= 'postgres://test@localhost/test';
process.env.SESSION_SECRET ||= 'test-secret-for-emailChange';

const { default: pool } = await import('../config/db.js');
const change = await import('../services/emailChange.js');
const accountsService = await import('../services/accounts.js');
const { tokenIsCurrent, forgetTokenVersion } = await import('../services/tokenVersions.js');
const { hashPassword } = await import('../services/passwords.js');
const { signToken } = await import('../utils/authToken.js');

const stamp = Date.now();
const addresses = [];
const address = (name) => { const a = `ml465-${name}-${stamp}@themusicledger.local`; addresses.push(a); return a; };
const one = async (sql, params) => (await pool.query(sql, params)).rows[0];
const account = async (name, password = null) => {
  const email = address(name);
  const id = Number((await one(`INSERT INTO accounts (email, first_name, surname) VALUES ($1, $2, 'Test') RETURNING id`, [email, name])).id);
  if (password) await pool.query('INSERT INTO account_passwords (account_id, password_hash) VALUES ($1, $2)', [id, await hashPassword(password)]);
  return { id, email };
};
const outbox = async (to) => (await pool.query('SELECT subject, body_text FROM email_outbox WHERE to_email = $1 ORDER BY id', [to])).rows;
const linkFrom = (body) => /\?change-email=([\w-]+)/.exec(body)[1];
const status = (code) => (e) => e.status === code;
const skip = !onDev && 'needs the dev database, with emails written to the outbox';
const ORIGIN = 'https://app.example';

after(async () => {
  if (onDev) {
    await pool.query(`DELETE FROM auth_rate_events WHERE kind = 'call:change-email' AND key IN (SELECT id::text FROM accounts WHERE lower(email) = ANY($1))`, [addresses]).catch(() => {});
    await pool.query('DELETE FROM email_outbox WHERE to_email = ANY($1)', [addresses]).catch(() => {});
    await pool.query('DELETE FROM auth_email_links WHERE lower(email) = ANY($1)', [addresses]).catch(() => {});
    await pool.query('DELETE FROM band_invites WHERE lower(email) = ANY($1)', [addresses]).catch(() => {});
    await pool.query(`DELETE FROM bands WHERE created_by_account_id IN (SELECT id FROM accounts WHERE lower(email) = ANY($1))`, [addresses]).catch(() => {});
    await pool.query('DELETE FROM accounts WHERE lower(email) = ANY($1)', [addresses]).catch(() => {});
    const { deletedEmailHash } = await import('../services/tokenVersions.js');
    await pool.query('DELETE FROM deleted_account_markers WHERE email_hash = ANY($1)', [addresses.map((a) => deletedEmailHash(a))]).catch(() => {});
  }
  await pool.end().catch(() => {});
});

test('an address is shown with most of its name hidden', () => {
  assert.equal(change.maskEmail('andrew.storey@gmail.com'), 'an***@gmail.com');
  assert.equal(change.maskEmail('al@example.org'), 'a***@example.org');
  assert.equal(change.maskEmail('a@example.org'), 'a***@example.org');
  assert.equal(change.maskEmail('not an address'), '***');
});

test('asking: the link goes to the new address, and nothing changes until it is used', { skip }, async () => {
  const sam = await account('sam');
  const to = address('sam-new');
  const sent = await change.requestEmailChange(sam.id, `  ${to.toUpperCase()} `, null, ORIGIN);
  assert.deepEqual(sent, { sentTo: to, minutes: 60, emailed: false, notSentHere: true }); // dev keeps its emails (ML-479)
  // Nothing has changed yet
  assert.equal((await one('SELECT email FROM accounts WHERE id = $1', [sam.id])).email, sam.email);
  assert.equal((await outbox(sam.email)).length, 0);
  // The new address has the link; the old address is shown mostly hidden (the new one may have been mistyped)
  const [mail] = await outbox(to);
  assert.equal(mail.subject, 'Confirm your new email address for The Music Ledger');
  assert.match(mail.body_text, /Confirm my new email address: https:\/\/app\.example\/\?change-email=[\w-]+\n/);
  assert.ok(mail.body_text.includes(change.maskEmail(sam.email)));
  assert.ok(!mail.body_text.includes(sam.email));
  assert.match(mail.body_text, /works once, for 60 minutes/);
  // The screen the link opens says what it will do
  assert.deepEqual(await change.describeEmailChange(linkFrom(mail.body_text)), { from: change.maskEmail(sam.email), to });
  // Asking again replaces the first link
  await change.requestEmailChange(sam.id, to, null, ORIGIN);
  await assert.rejects(change.describeEmailChange(linkFrom(mail.body_text)), status(404));
});

test('what is refused when asking', { skip }, async () => {
  const pat = await account('pat', 'correct horse battery');
  const other = await account('other');
  await assert.rejects(change.requestEmailChange(pat.id, 'not an address', 'correct horse battery', ORIGIN), status(400));
  await assert.rejects(change.requestEmailChange(pat.id, pat.email.toUpperCase(), 'correct horse battery', ORIGIN), status(400)); // the one it has
  await assert.rejects(change.requestEmailChange(pat.id, other.email, 'correct horse battery', ORIGIN), status(409)); // someone else's
  // Someone who signs in with a password has to give it, and it has to be right
  await assert.rejects(change.requestEmailChange(pat.id, address('pat-new'), '', ORIGIN), status(400));
  await assert.rejects(change.requestEmailChange(pat.id, address('pat-new2'), 'wrong password', ORIGIN), status(401));
  assert.equal((await pool.query(`SELECT 1 FROM auth_email_links WHERE for_account_id = $1`, [pat.id])).rows.length, 0, 'no link was made');
  await assert.rejects(change.requestEmailChange(999999999, address('nobody-new'), null, ORIGIN), status(404));
  await assert.rejects(change.describeEmailChange('made-up-secret'), status(404));
  await assert.rejects(change.confirmEmailChange('made-up-secret', ORIGIN), status(404));
});

test('confirming: the address changes, every device is signed out, invitations follow, and the old address is told', { skip }, async () => {
  const kim = await account('kim', 'correct horse battery');
  const to = address('kim-new');
  // Kim runs a band and has invited someone; and has an invitation waiting at her old address
  const host = await account('host');
  const band = Number((await one(`INSERT INTO bands (name, created_by_account_id, kind) VALUES ($1, $2, 'group') RETURNING id`, [`ML-465 Band ${stamp}`, host.id])).id);
  await pool.query(`INSERT INTO band_members (band_id, account_id, role) VALUES ($1, $2, 'admin')`, [band, host.id]);
  await pool.query(`INSERT INTO band_invites (band_id, email, invited_by_account_id, role) VALUES ($1, $2, $3, 'player')`, [band, kim.email, host.id]);
  // ...and a password reset link is waiting for the old address
  await pool.query(`INSERT INTO auth_email_links (purpose, token_hash, email, expires_at) VALUES ('reset', $1, $2, now() + interval '1 hour')`, [`ml465-reset-${stamp}`, kim.email]);

  const before = await one('SELECT token_version FROM accounts WHERE id = $1', [kim.id]);
  const oldToken = { userId: kim.email, tv: Number(before.token_version) };
  assert.equal(await tokenIsCurrent(oldToken), true);

  await change.requestEmailChange(kim.id, to, 'correct horse battery', ORIGIN);
  const secret = linkFrom((await outbox(to))[0].body_text);
  const done = await change.confirmEmailChange(secret, ORIGIN, signToken({ userId: kim.email, tv: oldToken.tv }));
  assert.deepEqual(done, { email: to, wasThisDevice: true });

  // The same account, under the new address, with a higher token number
  const row = await one('SELECT id, email, token_version FROM accounts WHERE id = $1', [kim.id]);
  assert.equal(row.email, to);
  assert.equal(Number(row.token_version), oldToken.tv + 1);
  assert.equal((await pool.query('SELECT 1 FROM accounts WHERE lower(email) = $1', [kim.email])).rows.length, 0);
  // Signed out everywhere: a token that names the old address is refused...
  forgetTokenVersion(kim.email);
  assert.equal(await tokenIsCurrent(oldToken), false);
  // ...and can't start a new, empty account under it - even on a server that hasn't heard yet
  await assert.rejects(accountsService.getOrCreateAccount(kim.email, 'kim', 'Test', {}, oldToken.tv), status(401));
  assert.equal((await pool.query('SELECT 1 FROM accounts WHERE lower(email) = $1', [kim.email])).rows.length, 0);
  // A new sign-in with the new address is the same account
  assert.equal(Number(await accountsService.getOrCreateAccount(to, 'kim', 'Test', {}, Number(row.token_version))), kim.id);
  // Her password still works with the new address (it hangs off the account, not the address)
  assert.equal((await pool.query('SELECT 1 FROM account_passwords WHERE account_id = $1', [kim.id])).rows.length, 1);

  // The invitation followed her; the reset link and the change link are spent
  assert.deepEqual((await pool.query('SELECT email FROM band_invites WHERE band_id = $1', [band])).rows.map((r) => r.email), [to]);
  assert.equal((await pool.query(`SELECT 1 FROM auth_email_links WHERE used_at IS NULL AND (lower(email) = ANY($1) OR for_account_id = $2)`, [[kim.email, to], kim.id])).rows.length, 0);
  await assert.rejects(change.confirmEmailChange(secret, ORIGIN), status(404)); // once only
  // The old address is told, with the new one mostly hidden
  const told = await outbox(kim.email);
  assert.equal(told.length, 1);
  assert.equal(told[0].subject, 'Your Music Ledger email address has changed');
  assert.ok(told[0].body_text.includes(change.maskEmail(to)));
  assert.ok(!told[0].body_text.includes(to));
  assert.match(told[0].body_text, /signed out everywhere/);
});

test('a device that was not signed in as the account is not told it was; an expired link does nothing', { skip }, async () => {
  const lee = await account('lee');
  const to = address('lee-new');
  await change.requestEmailChange(lee.id, to, null, ORIGIN);
  const secret = linkFrom((await outbox(to))[0].body_text);
  // Out of time: nothing happens
  await pool.query(`UPDATE auth_email_links SET expires_at = now() - interval '1 minute' WHERE for_account_id = $1`, [lee.id]);
  await assert.rejects(change.confirmEmailChange(secret, ORIGIN), status(404));
  assert.equal((await one('SELECT email FROM accounts WHERE id = $1', [lee.id])).email, lee.email);
  // In time, from a device signed in as someone else (or nobody)
  await pool.query(`UPDATE auth_email_links SET expires_at = now() + interval '10 minutes' WHERE for_account_id = $1`, [lee.id]);
  const done = await change.confirmEmailChange(secret, ORIGIN, signToken({ userId: 'someone-else@example.com', tv: 0 }));
  assert.deepEqual(done, { email: to, wasThisDevice: false });
});

test('the new address was taken while the link waited: nothing changes', { skip }, async () => {
  const max = await account('max');
  const to = address('max-new');
  await change.requestEmailChange(max.id, to, null, ORIGIN);
  const secret = linkFrom((await outbox(to))[0].body_text);
  await pool.query(`INSERT INTO accounts (email, first_name, surname) VALUES ($1, 'Squatter', 'Test')`, [to]);
  await assert.rejects(change.confirmEmailChange(secret, ORIGIN), status(409));
  assert.equal((await one('SELECT email FROM accounts WHERE id = $1', [max.id])).email, max.email);
});

test('a super admin can start it for someone who has lost the old address - the link still goes to the new one', { skip }, async () => {
  const admin = await account('admin');
  const jo = await account('jo', 'correct horse battery');
  const to = address('jo-new');
  const sent = await change.adminRequestEmailChange(admin.id, jo.id, to, ORIGIN); // no password asked: the inbox proves it
  assert.equal(sent.sentTo, to);
  const [mail] = await outbox(to);
  assert.match(mail.body_text, /The Music Ledger team has been asked to change the email address on your account/);
  assert.equal((await one('SELECT email FROM accounts WHERE id = $1', [jo.id])).email, jo.email, 'nothing changes until the link is used');
  assert.deepEqual(await change.confirmEmailChange(linkFrom(mail.body_text), ORIGIN), { email: to, wasThisDevice: false });
  assert.equal((await one('SELECT email FROM accounts WHERE id = $1', [jo.id])).email, to);
  await assert.rejects(change.adminRequestEmailChange(admin.id, jo.id, admin.email, ORIGIN), status(409));
});
