// ML-648: someone made a band leader is told - a notice in the app and an email saying what a band leader can do
// (only what is switched on for them); taken away, a notice only; never when an organiser changes it for
// themselves. Against the dev database (email goes to email_outbox there), with throwaway accounts:
//   node --env-file=../.env --test test/bandLeaderTold.test.js      (from server/)
import { test, after } from 'node:test';
import assert from 'node:assert/strict';

const onDev = process.env.NEON_BRANCH === 'dev' && !!process.env.DATABASE_URL;
process.env.DATABASE_URL ||= 'postgres://test@localhost/test';
const skip = !onDev && 'needs the dev database';
const stamp = Date.now();
const accounts = [];
let pool;
if (onDev) ({ default: pool } = await import('../config/db.js'));
const one = async (sql, params) => (await pool.query(sql, params)).rows[0];
const address = (name) => `ml648-${name}-${stamp}@themusicledger.local`;
const account = async (name) => {
  // super admin: every feature is on for them, as a new one is Super admin only until switched on
  const id = Number((await one(`INSERT INTO accounts (email, first_name, surname, account_level, organiser_adult_confirmed_on) VALUES ($1, $2, 'Test', 'super_admin', CURRENT_DATE) RETURNING id`, [address(name), name])).id);
  accounts.push(id);
  return id;
};
const notices = async (id) => (await pool.query(
  `SELECT n.title FROM notifications n JOIN notification_recipients r ON r.notification_id = n.id WHERE r.account_id = $1 AND n.kind = 'band_leader' ORDER BY n.id`, [id])).rows.map((r) => r.title);
const emails = async (name) => (await pool.query(`SELECT subject, body_text FROM email_outbox WHERE to_email = $1 ORDER BY id`, [address(name)])).rows;

after(async () => {
  if (!onDev) return;
  await pool.query(`DELETE FROM notifications WHERE id IN (SELECT notification_id FROM notification_recipients WHERE account_id = ANY($1))`, [accounts]).catch(() => {});
  await pool.query(`DELETE FROM email_outbox WHERE to_email LIKE $1`, [`ml648-%-${stamp}@%`]).catch(() => {});
  await pool.query(`DELETE FROM bands WHERE created_by_account_id = ANY($1)`, [accounts]).catch(() => {});
  for (const id of accounts) await pool.query('DELETE FROM accounts WHERE id = $1', [id]).catch(() => {});
  await pool.end().catch(() => {});
});

test('ML-648: made a band leader - a notice and an email once; taken away - a notice only; yourself - nothing', { skip }, async () => {
  const bands = await import('../services/bands.js');
  const organiser = await account('organiser');
  const leader = await account('leader');
  const label = Number((await one(`INSERT INTO bands (name, created_by_account_id, kind) VALUES ($1, $2, 'label') RETURNING id`, [`ML-648 Band ${stamp}`, organiser])).id);
  await bands.setUpSharing(organiser, label);
  const bandId = Number((await one('SELECT shared_band_id FROM bands WHERE id = $1', [label])).shared_band_id);
  await pool.query(`INSERT INTO band_members (band_id, account_id, role) VALUES ($1, $2, 'player')`, [bandId, leader]);
  const band = `ML-648 Band ${stamp}`;

  await bands.setBandLeader(organiser, bandId, leader, true, 'https://notablybetter.com');
  assert.deepEqual(await notices(leader), [`You're now a band leader of ${band}`]);
  const sent = await emails('leader');
  assert.equal(sent.length, 1);
  assert.equal(sent[0].subject, `You're now a band leader of ${band}`);
  assert.match(sent[0].body_text, /organiser Test has just made you a band leader/);
  assert.match(sent[0].body_text, /Band summary:/, 'the summary is switched on for a super admin');
  assert.match(sent[0].body_text, /never shows who/);
  assert.match(sent[0].body_text, /players switch it on, if they want to, on the band's Members page/);
  assert.match(sent[0].body_text, /Band notices:/);

  // Made band leader again: nothing new
  await bands.setBandLeader(organiser, bandId, leader, true, 'https://notablybetter.com');
  assert.equal((await notices(leader)).length, 1);
  assert.equal((await emails('leader')).length, 1);

  // Taken away: a notice, no email
  await bands.setBandLeader(organiser, bandId, leader, false, 'https://notablybetter.com');
  assert.deepEqual(await notices(leader), [`You're now a band leader of ${band}`, `You're no longer a band leader of ${band}`]);
  assert.equal((await emails('leader')).length, 1);

  // An organiser making themselves band leader isn't told
  await bands.setBandLeader(organiser, bandId, organiser, true, 'https://notablybetter.com');
  assert.equal((await notices(organiser)).length, 0);
  assert.equal((await emails('organiser')).length, 0);
});

test('ML-648: the email only says what is switched on - with neither on, there is none', async () => {
  const { buildEmail } = await import('../services/emailWording.js');
  const { EMAILS, BAND_SUMMARY_WORDS } = await import('../services/emailCatalogue.js');
  const e = EMAILS.band_leader_made;
  const only = buildEmail('band_leader_made', e.builtIn, { 'first name': 'Bert', 'made by': 'Sue', band: 'Cobham Band', 'band summary': BAND_SUMMARY_WORDS, 'band notices': '', url: 'https://notablybetter.com/app' });
  assert.match(only.text, /Band summary:/);
  assert.doesNotMatch(only.text, /Band notices:/);
  assert.doesNotMatch(only.html, /<p>\s*<\/p>/, 'no empty paragraph where the notices line was');
});
