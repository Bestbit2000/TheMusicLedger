// The emails that go with an invitation - against a real database, with MAIL_PROVIDER=log so every
// email lands in email_outbox and none is sent:
//   - ML-473: an invitation into a band emails the address once (not again when only the level changes);
//   - ML-479: where emails are only kept (here), the answer says so - never "emailed"; and an account
//     with no name can neither invite nor join until it has one;
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
const { emailOutcome, sentOrHeld } = await import('../services/mail.js');

// What a site that only keeps its emails answers (this one, with MAIL_PROVIDER=log)
const HELD = { emailed: false, notSentHere: true };

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
// ML-478: adding a band from the directory is private; a shared space is a separate, deliberate step.
// These tests are about the space, so this does both.
const startBandGroup = async (accountId, directoryBandId) => bands.setUpSharing(accountId, await bands.addBandFromDirectory(accountId, directoryBandId));

test('whether an email really went: only a site that sends them says "emailed" (ML-479)', () => {
  assert.deepEqual(emailOutcome('log'), HELD);
  assert.deepEqual(emailOutcome('smtp'), { emailed: true });
  assert.deepEqual(emailOutcome('resend'), { emailed: true });
  assert.equal(sentOrHeld('sent', 'held', 'log'), 'held');
  assert.equal(sentOrHeld('sent', 'held', 'smtp'), 'sent');
  // With nothing passed it follows the setting, and no setting at all means "kept, not sent"
  const keep = process.env.MAIL_PROVIDER;
  try {
    delete process.env.MAIL_PROVIDER;
    assert.deepEqual(emailOutcome(), HELD);
    process.env.MAIL_PROVIDER = 'SMTP';
    assert.deepEqual(emailOutcome(), { emailed: true });
  } finally {
    if (keep === undefined) delete process.env.MAIL_PROVIDER; else process.env.MAIL_PROVIDER = keep;
  }
});

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
  const space = await startBandGroup(anna, entry);
  // Someone who already has an account: the email's link is only the front door - they sign in as they do
  const member = address('member');
  accounts.push(Number((await one(`INSERT INTO accounts (email, first_name, surname) VALUES ($1, 'Has', 'Account') RETURNING id`, [member])).id));
  assert.deepEqual(await bands.inviteToBand(anna, space, member, 'play', 'https://app.example/'), HELD); // written to the outbox, sent to nobody
  let sent = await outbox(member);
  assert.equal(sent.length, 1);
  assert.equal(sent[0].subject, `anna Test has invited you to join ML-473 Mail Band ${stamp}`);
  assert.match(sent[0].body_text, new RegExp(`sign in with this email address \\(${member.replace(/[.+]/g, '\\$&')}\\)`));
  assert.match(sent[0].body_text, /Open The Music Ledger: https:\/\/app\.example\/\?band-invite=1\n/); // nothing about who or which band in the link
  assert.match(sent[0].body_text, /waits for 30 days/);

  // Changing what they may do is not a second email; "send again" is, and gives it another 30 days
  assert.deepEqual(await bands.inviteToBand(anna, space, member, 'change', 'https://app.example'), { emailed: false });
  assert.equal((await outbox(member)).length, 1);
  assert.equal((await bands.listBandMembers(anna, space)).invites[0].level, 'change');
  await pool.query(`UPDATE band_invites SET created_at = now() - interval '20 days' WHERE band_id = $1`, [space]);
  assert.deepEqual(await bands.inviteToBand(anna, space, member, 'change', 'https://app.example', { resend: true }), HELD);
  assert.equal((await outbox(member)).length, 2);
  assert.ok(Date.now() - new Date((await bands.listBandMembers(anna, space)).invites[0].sentAt).getTime() < 60000);

  // Someone with no account at all: where email-and-password login is on, the link lets them choose a
  // password (no Google account needed) and still lands them on My bands; where it is off, the front door
  const newcomer = address('newcomer');
  assert.deepEqual(await bands.inviteToBand(anna, space, newcomer, 'play', 'https://app.example'), HELD);
  sent = await outbox(newcomer);
  assert.equal(sent.length, 1);
  if (await auth.passwordLoginEnabled()) {
    assert.match(sent[0].body_text, /You don't have an account yet\. Choose a password to make one/);
    const link = /Choose a password: (https:\/\/app\.example\/\?invite=([\w-]+)&band-invite=1)\n/.exec(sent[0].body_text);
    assert.ok(link, 'the link chooses a password and comes back to My bands');
    assert.deepEqual(await auth.describeLink(link[2], 'invite', '127.0.0.1'), { email: newcomer, firstName: null });
    // It is nobody's own invite: not on the organiser's list, not one of their five a day
    assert.deepEqual(await auth.listMyInvites(anna), []);
    assert.equal(await auth.invitesSentToday(anna), 0);
    await pool.query('DELETE FROM auth_email_links WHERE lower(email) = $1', [newcomer]);
  } else {
    assert.match(sent[0].body_text, /Open The Music Ledger: https:\/\/app\.example\/\?band-invite=1\n/);
  }
});

test('an account with no name can neither invite nor join until it has one - and is never "A member" in an email (ML-479)', { skip }, async () => {
  const needsName = (e) => e.status === 409 && e.reason === 'needs-name';
  const nameless = async (name) => {
    const id = Number((await one(`INSERT INTO accounts (email, first_name, surname) VALUES ($1, '', '') RETURNING id`, [address(name)])).id);
    accounts.push(id);
    return id;
  };
  const olga = await nameless('olga');
  const entry = Number((await one(`INSERT INTO bands (name, website, created_by_account_id, kind) VALUES ($1, $2, $3, 'directory') RETURNING id`, [`ML-479 Name Band ${stamp}`, `https://ml479-name-${stamp}.example`, olga])).id);
  made.push(entry);
  const space = await startBandGroup(olga, entry);
  const joiner = address('joiner');
  const jo = Number((await one(`INSERT INTO accounts (email, first_name, surname) VALUES ($1, '', '') RETURNING id`, [joiner])).id);
  accounts.push(jo);

  // No name: no invitation is made and nothing is written to send
  await assert.rejects(bands.inviteToBand(olga, space, joiner, 'play', 'https://app.example'), needsName);
  assert.equal((await bands.listBandMembers(olga, space)).openInvites, 0);
  assert.equal((await outbox(joiner)).length, 0);

  // A display name is enough, and it is what the email says - in the subject and the first line
  await pool.query(`UPDATE accounts SET display_name = 'Olga' WHERE id = $1`, [olga]);
  assert.deepEqual(await bands.inviteToBand(olga, space, joiner, 'play', 'https://app.example'), HELD);
  const sent = await outbox(joiner);
  assert.equal(sent[0].subject, `Olga has invited you to join ML-479 Name Band ${stamp}`);
  assert.match(sent[0].body_text, /\nOlga has invited you to join /);
  assert.ok(!/A member/.test(sent[0].subject + sent[0].body_text));

  // Sending it again needs the name too (it is a fresh email); changing what it allows does not
  await pool.query('UPDATE accounts SET display_name = NULL WHERE id = $1', [olga]);
  await assert.rejects(bands.inviteToBand(olga, space, joiner, 'play', 'https://app.example', { resend: true }), needsName);
  assert.deepEqual(await bands.inviteToBand(olga, space, joiner, 'change', 'https://app.example'), { emailed: false });
  assert.equal((await outbox(joiner)).length, 1);

  // The person invited has no name either: the invitation waits, and joining asks for a name first
  const [invite] = await bands.listMyBandInvites(jo);
  await assert.rejects(bands.acceptBandInvite(jo, invite.id), needsName);
  assert.equal((await bands.listMyBandInvites(jo)).length, 1, 'the invitation is still waiting');
  assert.equal((await bands.listBandMembers(olga, space)).members.length, 1);
  await pool.query(`UPDATE accounts SET first_name = 'Jo' WHERE id = $1`, [jo]);
  assert.equal(await bands.acceptBandInvite(jo, invite.id), space);
  assert.deepEqual((await bands.listBandMembers(jo, space)).members.map((m) => m.name).sort(), ['A member', 'Jo']); // Olga, from before the rule, has no name again
  await pool.query('DELETE FROM auth_email_links WHERE lower(email) = $1', [joiner]);
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
