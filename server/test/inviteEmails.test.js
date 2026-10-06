// The emails that go with an invitation - against a real database, with MAIL_PROVIDER=log so every
// email lands in email_outbox and none is sent:
//   - ML-473: an invitation into a band emails the address once (not again when only the level changes);
//   - ML-402 follow-up: an invite to the app whose link ran out stays on your list, and "Send again" makes
//     a fresh link and a fresh email.
// Runs only when pointed at the dev branch:
//   node --env-file=../.env --env-file=.env --test test/inviteEmails.test.js      (from server/)
// Under plain `npm test` (no database) it is skipped. Everything it makes belongs to throwaway accounts and
// addresses, which it removes again.

import { test, after } from 'node:test';
import assert from 'node:assert/strict';

const onDev = process.env.NEON_BRANCH === 'dev' && !!process.env.DATABASE_URL && (process.env.MAIL_PROVIDER || 'log') === 'log';
process.env.DATABASE_URL ||= 'postgres://test@localhost/test';

const { default: pool } = await import('../config/db.js');
const bands = await import('../services/bands.js');
const auth = await import('../services/passwordAuth.js');

const stamp = Date.now();
const accounts = [];
const made = [];
const addresses = [];
const one = async (sql, params) => (await pool.query(sql, params)).rows[0];
const address = (name) => { const a = `ml473-mail-${name}-${stamp}@themusicledger.local`; addresses.push(a); return a; };
const account = async (name) => {
  const id = Number((await one(`INSERT INTO accounts (email, first_name, surname) VALUES ($1, $2, 'Test') RETURNING id`, [address(name), name])).id);
  accounts.push(id);
  return id;
};
const outbox = async (to) => (await pool.query('SELECT subject, body_text FROM email_outbox WHERE to_email = $1 ORDER BY id', [to])).rows;
const skip = !onDev && 'needs the dev database, with emails written to the outbox';

after(async () => {
  if (onDev) {
    await pool.query('DELETE FROM email_outbox WHERE to_email = ANY($1)', [addresses]).catch(() => {});
    await pool.query('DELETE FROM auth_email_links WHERE created_by_account_id = ANY($1)', [accounts]).catch(() => {});
    await pool.query(`DELETE FROM bands WHERE created_by_account_id = ANY($1) OR id = ANY($2)`, [accounts, made]).catch(() => {});
    for (const id of accounts) await pool.query('DELETE FROM accounts WHERE id = $1', [id]).catch(() => {});
  }
  await pool.end().catch(() => {});
});

test('an invitation into a band emails the address once: who, which band, and only the front door as its link', { skip }, async () => {
  const anna = await account('anna');
  const entry = Number((await one(`INSERT INTO bands (name, website, created_by_account_id, kind) VALUES ($1, $2, $3, 'directory') RETURNING id`, [`ML-473 Mail Band ${stamp}`, `https://ml473-mail-${stamp}.example`, anna])).id);
  made.push(entry);
  const space = await bands.startBandGroup(anna, entry);
  const to = address('invited');

  assert.deepEqual(await bands.inviteToBand(anna, space, to, 'play', 'https://app.example/'), { emailed: true });
  const sent = await outbox(to);
  assert.equal(sent.length, 1);
  assert.equal(sent[0].subject, `anna Test has invited you to join ML-473 Mail Band ${stamp}`);
  assert.match(sent[0].body_text, new RegExp(`sign in with this email address \\(${to.replace(/[.+]/g, '\\$&')}\\)`));
  assert.match(sent[0].body_text, /Open The Music Ledger: https:\/\/app\.example\/\?band-invite=1\n/); // nothing about who or which band in the link
  assert.match(sent[0].body_text, /waits for 30 days/);

  // Changing what they may do is not a second email
  assert.deepEqual(await bands.inviteToBand(anna, space, to, 'change', 'https://app.example'), { emailed: false });
  assert.equal((await outbox(to)).length, 1);
  assert.equal((await bands.listBandMembers(anna, space)).invites[0].level, 'change');
});

test('an invite to the app whose link ran out stays on your list, and Send again makes a fresh link and email', { skip }, async (t) => {
  const anna = await account('anna2');
  const to = address('late');
  try {
    await auth.createInvite({ email: to, firstName: 'Late', surname: 'Comer', accountLevel: 'standard_member', createdBy: anna, origin: 'https://app.example' });
  } catch (error) {
    if (error.status === 404) { t.skip('email-and-password login is not switched on here'); return; }
    throw error;
  }
  await pool.query(`UPDATE auth_email_links SET expires_at = now() - interval '2 days' WHERE created_by_account_id = $1`, [anna]);
  const before = await auth.listMyInvites(anna);
  assert.deepEqual(before.map((i) => [i.email, i.expired]), [[to, true]]);

  const ben = await account('ben2');
  await assert.rejects(auth.resendMyInvite(ben, before[0].id, 'https://app.example'), (e) => e.status === 404); // not theirs
  await auth.resendMyInvite(anna, before[0].id, 'https://app.example');
  const after_ = await auth.listMyInvites(anna);
  assert.deepEqual(after_.map((i) => [i.email, i.firstName, i.expired]), [[to, 'Late', false]]); // one live invite, the old one replaced
  assert.notEqual(after_[0].id, before[0].id);
  assert.equal((await outbox(to)).length, 2);
  assert.equal(await auth.invitesSentToday(anna), 2); // sending again counts as one of today's
});
