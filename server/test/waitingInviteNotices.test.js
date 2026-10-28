// ML-649: a band invitation sent before the address had an account made no notice - nobody was there to get it.
// Now the notice is made when the account is made (or its address changes), and by the daily job's catch-up.
// Against the dev database, with throwaway accounts it removes again:
//   node --env-file=../.env --test test/waitingInviteNotices.test.js      (from server/)
import { test, after } from 'node:test';
import assert from 'node:assert/strict';

const onDev = process.env.NEON_BRANCH === 'dev' && !!process.env.DATABASE_URL;
process.env.DATABASE_URL ||= 'postgres://test@localhost/test';
process.env.SESSION_SECRET ||= 'test-secret-for-waitingInviteNotices';
const skip = !onDev && 'needs the dev database';
const stamp = Date.now();
const accounts = [];
const bandsMade = [];
let pool;
if (onDev) ({ default: pool } = await import('../config/db.js'));
const one = async (sql, params) => (await pool.query(sql, params)).rows[0];
const address = (name) => `ml649-${name}-${stamp}@themusicledger.local`;
const account = async (name) => {
  // super admin: automatic notices are on for every type in production, but a fresh dev may have them Super admin only
  const id = Number((await one(`INSERT INTO accounts (email, first_name, surname, account_level) VALUES ($1, $2, 'Test', 'super_admin') RETURNING id`, [address(name), name])).id);
  accounts.push(id);
  return id;
};
const noticesFor = async (accountId) => (await pool.query(
  `SELECT n.title, n.group_key, n.expires_at FROM notifications n JOIN notification_recipients r ON r.notification_id = n.id
    WHERE r.account_id = $1 AND n.kind = 'band_invite' AND n.withdrawn_at IS NULL ORDER BY n.id`, [accountId])).rows;

after(async () => {
  if (!onDev) return;
  await pool.query(`DELETE FROM notifications WHERE id IN (SELECT notification_id FROM notification_recipients WHERE account_id = ANY($1))`, [accounts]).catch(() => {});
  await pool.query(`DELETE FROM band_invites WHERE email LIKE $1`, [`ml649-%-${stamp}@%`]).catch(() => {});
  await pool.query(`DELETE FROM bands WHERE id = ANY($1)`, [bandsMade]).catch(() => {});
  await pool.query(`DELETE FROM notice_preferences WHERE account_id = ANY($1)`, [accounts]).catch(() => {});
  for (const id of accounts) await pool.query('DELETE FROM accounts WHERE id = $1', [id]).catch(() => {});
  await pool.end().catch(() => {});
});

test('ML-649: an invitation sent before sign-up gets its notice once the account is made, once only, and goes with the invitation', { skip }, async () => {
  const { noticeWaitingBandInvites, noticeAllWaitingBandInvites, setNoticePreference } = await import('../services/autoNotices.js');
  const host = await account('host');
  const band = Number((await one(`INSERT INTO bands (name, created_by_account_id, kind) VALUES ($1, $2, 'group') RETURNING id`, [`ML-649 Band ${stamp}`, host])).id);
  bandsMade.push(band);
  // Invited a week ago, before they had an account
  await pool.query(`INSERT INTO band_invites (band_id, email, invited_by_account_id, role, created_at) VALUES ($1, $2, $3, 'player', now() - interval '7 days')`, [band, address('newcomer'), host]);
  // ...and an invitation past its 30 days, which makes no notice
  const old = Number((await one(`INSERT INTO bands (name, created_by_account_id, kind) VALUES ($1, $2, 'group') RETURNING id`, [`ML-649 Old ${stamp}`, host])).id);
  bandsMade.push(old);
  await pool.query(`INSERT INTO band_invites (band_id, email, invited_by_account_id, role, created_at) VALUES ($1, $2, $3, 'player', now() - interval '31 days')`, [old, address('newcomer'), host]);

  const newcomer = await account('newcomer');
  assert.equal((await noticesFor(newcomer)).length, 0, 'nothing yet - the account was made by hand here');
  await noticeWaitingBandInvites(newcomer);
  const made = await noticesFor(newcomer);
  assert.equal(made.length, 1, 'the waiting invitation, not the one past 30 days');
  assert.equal(made[0].title, `You're invited to join ML-649 Band ${stamp}`);
  // it goes when the invitation would: 30 days from when it was sent, so about 23 days from now
  const daysLeft = (new Date(made[0].expires_at) - Date.now()) / 86400000;
  assert.ok(daysLeft > 22 && daysLeft < 24, `goes in ${daysLeft.toFixed(1)} days`);

  // Again, and the daily catch-up: still one
  await noticeWaitingBandInvites(newcomer);
  await noticeAllWaitingBandInvites();
  assert.equal((await noticesFor(newcomer)).length, 1);

  // Someone who switched "Invitations to a band" off gets none, even from the catch-up
  await pool.query(`INSERT INTO band_invites (band_id, email, invited_by_account_id, role) VALUES ($1, $2, $3, 'player')`, [band, address('quiet'), host]);
  const quiet = await account('quiet');
  await setNoticePreference(quiet, 'band_invite', false).catch(() => {}); // only a choice while the feature is on
  await noticeAllWaitingBandInvites();
  const quietOnes = await noticesFor(quiet);
  const choiceOn = (await one('SELECT 1 AS on FROM notice_preferences WHERE account_id = $1 AND kind = $2', [quiet, 'band_invite'])) !== undefined;
  if (choiceOn) assert.equal(quietOnes.length, 0);
});

test('ML-649: the daily catch-up finds someone who signed up after being invited', { skip }, async () => {
  const { noticeAllWaitingBandInvites } = await import('../services/autoNotices.js');
  const host = await account('host2');
  const band = Number((await one(`INSERT INTO bands (name, created_by_account_id, kind) VALUES ($1, $2, 'group') RETURNING id`, [`ML-649 Catch-up ${stamp}`, host])).id);
  bandsMade.push(band);
  await pool.query(`INSERT INTO band_invites (band_id, email, invited_by_account_id, role) VALUES ($1, $2, $3, 'player')`, [band, address('later'), host]);
  const later = await account('later');
  assert.ok(await noticeAllWaitingBandInvites() >= 1);
  assert.equal((await noticesFor(later)).length, 1);
});

test('ML-649: a new account made at sign-in gets the notice straight away (Google and invite links share this)', { skip }, async () => {
  const { getOrCreateAccount } = await import('../services/accounts.js');
  const host = await account('host3');
  const band = Number((await one(`INSERT INTO bands (name, created_by_account_id, kind) VALUES ($1, $2, 'group') RETURNING id`, [`ML-649 Sign-in ${stamp}`, host])).id);
  bandsMade.push(band);
  await pool.query(`INSERT INTO band_invites (band_id, email, invited_by_account_id, role) VALUES ($1, $2, $3, 'player')`, [band, address('google'), host]);
  const id = Number(await getOrCreateAccount(address('google'), 'Goo', 'Gle'));
  accounts.push(id);
  // A new account is a Standard member: it gets the notice when automatic notices are on for Standard here
  const { isFeatureEnabled } = await import('../services/features.js');
  const on = await isFeatureEnabled('auto_notices', 'standard_member') && await isFeatureEnabled('notifications', 'standard_member');
  assert.equal((await noticesFor(id)).length, on ? 1 : 0);
});
