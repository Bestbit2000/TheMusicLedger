// ML-498: a band's notice to its members, and ML-499: email copies of urgent and important notices. The rules are
// tested without a database; who can send, who gets one, the limits and the email copies are tested against the
// dev database (as bandLevelsSummary.test.js is), with throwaway accounts it removes again:
//   node --env-file=../.env --test test/bandNotices.test.js      (from server/)

import { test, after } from 'node:test';
import assert from 'node:assert/strict';

const onDev = process.env.NEON_BRANCH === 'dev' && !!process.env.DATABASE_URL;
process.env.DATABASE_URL ||= 'postgres://test@localhost/test';

const { canSendBandNotice, checkBandNotice, bandNoticeAllowance, fromWords } = await import('../services/bandNotices.js');
const { emailCopyAllowed, noticeEmailWords } = await import('../services/noticeEmails.js');

test('ML-498: an organiser, a member who can change music or the band leader can send - a player cannot', () => {
  assert.equal(canSendBandNotice('admin', false), true);
  assert.equal(canSendBandNotice('owner', false), true, "'owner' is the older word for organiser");
  assert.equal(canSendBandNotice('member', false), true, 'change music');
  assert.equal(canSendBandNotice('player', true), true, 'the band leader');
  assert.equal(canSendBandNotice('player', false), false);
});

test('ML-498: a title up to 120 characters and a message up to 1000, both needed', () => {
  assert.deepEqual(checkBandNotice({ title: '  Rehearsal moved  ', body: ' Thursday this week. ' }), { title: 'Rehearsal moved', body: 'Thursday this week.' });
  assert.throws(() => checkBandNotice({ title: '', body: 'x' }), (e) => e.status === 400);
  assert.throws(() => checkBandNotice({ title: 'x', body: '   ' }), (e) => e.status === 400);
  assert.throws(() => checkBandNotice({ title: 'x'.repeat(121), body: 'x' }), (e) => e.status === 400);
  assert.throws(() => checkBandNotice({ title: 'x', body: 'x'.repeat(1001) }), (e) => e.status === 400);
  assert.doesNotThrow(() => checkBandNotice({ title: 'x'.repeat(120), body: 'x'.repeat(1000) }));
});

test('ML-498: 3 a day and 10 a week per band, and when the next one can go', () => {
  const now = new Date('2026-10-23T12:00:00Z');
  const ago = (hours) => new Date(now.getTime() - hours * 3600 * 1000);
  const max = { perDay: 3, perWeek: 10 };
  assert.equal(bandNoticeAllowance([], max, now).leftToday, 3);
  assert.equal(bandNoticeAllowance([ago(1), ago(30)], max, now).leftToday, 2, 'one in the last 24 hours');
  // three today: none left until the oldest of them is 24 hours old
  const day = bandNoticeAllowance([ago(1), ago(2), ago(5)], max, now);
  assert.equal(day.leftToday, 0);
  assert.equal(day.nextAt.toISOString(), new Date(ago(5).getTime() + 24 * 3600 * 1000).toISOString());
  // ten this week, none today: the week's limit holds until the oldest of the ten is 7 days old
  const week = Array.from({ length: 10 }, (_, i) => ago(30 + i * 12));
  const w = bandNoticeAllowance(week, max, now);
  assert.equal(w.leftToday, 0);
  assert.equal(w.leftThisWeek, 0);
  assert.equal(w.nextAt.toISOString(), new Date(ago(30 + 9 * 12).getTime() + 7 * 24 * 3600 * 1000).toISOString());
  // nine this week: one left, even though the day has room for three
  assert.equal(bandNoticeAllowance(week.slice(0, 9), max, now).leftToday, 1);
  // older than a week doesn't count
  assert.equal(bandNoticeAllowance([ago(24 * 8)], max, now).leftThisWeek, 10);
});

test('ML-498: the member sees who sent it and which band', () => {
  assert.equal(fromWords('Sam Smith', 'The Cobham Band'), 'From Sam Smith, The Cobham Band');
  assert.equal(fromWords(null, null), 'From someone in the band, your band');
});

test('ML-499: an email copy is only for an urgent or important notice', () => {
  assert.equal(emailCopyAllowed({ urgent: true }), true);
  assert.equal(emailCopyAllowed({ important: true }), true);
  assert.equal(emailCopyAllowed({}), false);
});

test("ML-499: the email is the notice's own words, why they are getting it, and a way into the app", () => {
  const urgent = noticeEmailWords({ title: 'The app is down tonight', body: 'From 8 to 9.\n\nSorry for the trouble.', important: false }, 'https://notablybetter.com/');
  assert.equal(urgent.subject, 'The app is down tonight');
  assert.match(urgent.text, /^From 8 to 9\.\n\nSorry for the trouble\./);
  assert.match(urgent.text, /urgent notice/);
  assert.match(urgent.text, /Settings, Notifications/, 'says how to stop them');
  assert.match(urgent.text, /Open Notably Better: https:\/\/notablybetter\.com\/app\n/);
  assert.ok(!/privacy\.html/.test(urgent.text));
  const important = noticeEmailWords({ title: 'How we use your information', body: 'Something changed.', important: true, policyLink: true }, 'https://notablybetter.com');
  assert.match(important.text, /how your information is used/);
  assert.ok(!/To stop email copies/.test(important.text), 'an important one has no way to stop it');
  assert.match(important.text, /https:\/\/notablybetter\.com\/privacy\.html/);
  // the words are escaped in the HTML
  assert.ok(!noticeEmailWords({ title: 't', body: '<b>hi</b>' }, 'https://x.example').html.includes('<b>hi</b>'));
});

// ---------- against the dev database ----------
const skip = !onDev && 'needs the dev database';
const stamp = Date.now();
const accounts = [];
let pool;
if (onDev) ({ default: pool } = await import('../config/db.js'));
const one = async (sql, params) => (await pool.query(sql, params)).rows[0];
const account = async (name, level = 'super_admin', extra = {}) => {
  // super admins have every feature, as a new feature is Super admin only until it is switched on
  const id = Number((await one(
    `INSERT INTO accounts (email, first_name, surname, account_level, organiser_adult_confirmed_on) VALUES ($1, $2, 'Test', $3, $4) RETURNING id`,
    [`ml498-${name}-${stamp}@${extra.domain || 'themusicledger.local'}`, name, level, extra.adult === false ? null : new Date()])).id);
  accounts.push(id);
  return id;
};

after(async () => {
  if (!onDev) return;
  await pool.query(`DELETE FROM notifications WHERE created_by_account_id = ANY($1) OR id IN (SELECT notification_id FROM notification_recipients WHERE account_id = ANY($1))`, [accounts]).catch(() => {});
  await pool.query(`DELETE FROM email_outbox WHERE to_email LIKE $1`, [`ml498-%-${stamp}@%`]).catch(() => {});
  await pool.query(`DELETE FROM content_reports WHERE reported_by_account_id = ANY($1)`, [accounts]).catch(() => {});
  await pool.query(`DELETE FROM bands WHERE created_by_account_id = ANY($1)`, [accounts]).catch(() => {});
  for (const id of accounts) await pool.query('DELETE FROM accounts WHERE id = $1', [id]).catch(() => {});
  await pool.end().catch(() => {});
});

test('ML-498: who can send, who gets it, the limit, the switch, Report, and deletion takes it', { skip }, async () => {
  const bands = await import('../services/bands.js');
  const { sendBandNotice, bandNoticesForMember } = await import('../services/bandNotices.js');
  const { listNotificationsForAccount, listNotificationsForAdmin } = await import('../services/notifications.js');
  const { setNoticePreference } = await import('../services/autoNotices.js');
  const { createReport } = await import('../services/contentReports.js');
  const { deleteMyAccount } = await import('../services/accountDeletion.js');

  const organiser = await account('organiser');
  const music = await account('music');
  const player = await account('player');
  const quiet = await account('quiet');
  const standard = await account('standard', 'standard_member'); // band notices are Super admin only for now
  const young = await account('young', 'super_admin', { adult: false });
  const label = Number((await one(`INSERT INTO bands (name, created_by_account_id, kind) VALUES ($1, $2, 'label') RETURNING id`, [`ML-498 Band ${stamp}`, organiser])).id);
  await bands.setUpSharing(organiser, label);
  const bandId = Number((await one('SELECT shared_band_id FROM bands WHERE id = $1', [label])).shared_band_id);
  await pool.query(`INSERT INTO band_members (band_id, account_id, role) VALUES ($1, $2, 'member'), ($1, $3, 'player'), ($1, $4, 'player'), ($1, $5, 'player'), ($1, $6, 'member')`,
    [bandId, music, player, quiet, standard, young]);

  // A player can't send, and isn't told anything about it
  assert.deepEqual(await bandNoticesForMember(player, bandId), { canSend: false });
  await assert.rejects(sendBandNotice(player, bandId, { title: 'Hi', body: 'x' }), (e) => e.status === 403);
  // Someone outside the band: as if it isn't there
  const outsider = await account('outsider');
  await assert.rejects(sendBandNotice(outsider, bandId, { title: 'Hi', body: 'x' }), (e) => e.status === 404);
  // Someone who hasn't said they are an adult is asked first
  await assert.rejects(sendBandNotice(young, bandId, { title: 'Hi', body: 'x' }), (e) => e.reason === 'needs-adult');

  // quiet switched band notices off
  await setNoticePreference(quiet, 'band_notice', false);
  const sent = await sendBandNotice(music, bandId, { title: 'Rehearsal moved', body: 'Thursday this week, 7.30.' });
  assert.equal(sent.sentTo, 3, 'organiser, player and young - not the sender, not quiet, not a Standard member yet');
  assert.equal(sent.leftToday, 2);

  const forPlayer = (await listNotificationsForAccount(player)).notifications.find((n) => n.title === 'Rehearsal moved');
  assert.ok(forPlayer, 'the player gets it');
  assert.equal(forPlayer.from, `From music Test, ML-498 Band ${stamp}`);
  assert.equal(forPlayer.urgent, false, 'never urgent');
  for (const who of [quiet, standard, music, outsider]) {
    assert.ok(!(await listNotificationsForAccount(who)).notifications.some((n) => n.title === 'Rehearsal moved'), `account ${who} does not get it`);
  }
  // The owner sees it on Admin -> Notifications, with who sent it
  const forAdmin = (await listNotificationsForAdmin()).notifications.find((n) => n.id === forPlayer.id);
  assert.equal(forAdmin.kind, 'band_notice');
  assert.equal(forAdmin.from, forPlayer.from);

  // Reported by someone who got it; not by someone who didn't
  assert.deepEqual(await createReport(player, { kind: 'notice', id: forPlayer.id, note: '' }), { reported: true });
  await assert.rejects(createReport(quiet, { kind: 'notice', id: forPlayer.id }), (e) => e.status === 404);

  // 3 a day: two more, then refused
  await sendBandNotice(organiser, bandId, { title: 'Two', body: 'x' });
  await sendBandNotice(organiser, bandId, { title: 'Three', body: 'x' });
  await assert.rejects(sendBandNotice(organiser, bandId, { title: 'Four', body: 'x' }), (e) => e.status === 429);
  assert.equal((await bandNoticesForMember(organiser, bandId)).leftToday, 0);

  // Deleting the sender's account deletes the notices they sent (a super admin can't be deleted by the button;
  // deletion needs SESSION_SECRET for its marker, as accountDeletion.test.js does)
  if (process.env.SESSION_SECRET) {
    await pool.query(`UPDATE accounts SET account_level = 'standard_member' WHERE id = $1`, [music]);
    await deleteMyAccount(music);
    assert.equal((await one(`SELECT COUNT(*)::int AS n FROM notifications WHERE id = $1`, [forPlayer.id])).n, 0);
  }
});

test('ML-499: an email copy goes to the people it is for, less those who switched it off - an important one to all', { skip }, async () => {
  const { createNotification } = await import('../services/notifications.js');
  const { emailCopyPreview } = await import('../services/noticeEmails.js');
  const { setNoticePreference } = await import('../services/autoNotices.js');
  // addresses that can be emailed (on dev nothing leaves: each is kept in email_outbox)
  const admin = await account('admin');
  const a = await account('a', 'super_admin', { domain: 'ml498.example' });
  const off = await account('off', 'super_admin', { domain: 'ml498.example' });
  const local = await account('nomail', 'super_admin', { domain: 'example.test' }); // an address that can't be emailed
  const standard = await account('standard2', 'standard_member', { domain: 'ml498.example' }); // notice_emails is Super admin only for now
  await setNoticePreference(off, 'email_urgent', false);
  const who = { audience: 'accounts', accountIds: [a, off, local, standard].map(String) };

  assert.equal((await emailCopyPreview({ ...who, urgent: true })).count, 1, 'only a: off switched it off, nomail cannot be emailed, standard has no feature');
  assert.equal((await emailCopyPreview({ ...who, important: true })).count, 2, 'an important one goes to off as well');

  // Not urgent or important: refused
  await assert.rejects(createNotification(admin, { title: 'Plain', body: 'x', ...who, emailCopy: true }), (e) => e.status === 400);
  // Published later: refused
  await assert.rejects(createNotification(admin, { title: 'Later', body: 'x', urgent: true, publishAt: new Date(Date.now() + 3600e3).toISOString(), ...who, emailCopy: true }), (e) => e.status === 400);

  const n = await createNotification(admin, { title: `Urgent ${stamp}`, body: 'Line one.\n\nLine two.', urgent: true, ...who, emailCopy: true }, { origin: 'https://app.example' });
  assert.equal(n.emailCopy, true);
  assert.equal(n.emailedCount, 1);
  const mail = await pool.query(`SELECT to_email, subject, body_text FROM email_outbox WHERE subject = $1`, [`Urgent ${stamp}`]);
  assert.deepEqual(mail.rows.map((r) => r.to_email), [`ml498-a-${stamp}@ml498.example`]);
  assert.match(mail.rows[0].body_text, /^Line one\.\n\nLine two\./);
  assert.match(mail.rows[0].body_text, /https:\/\/app\.example\/app/);

  // An edit never sends it again
  const { updateNotification } = await import('../services/notifications.js');
  await updateNotification(n.id, { title: `Urgent ${stamp}`, body: 'Changed.', urgent: true });
  assert.equal((await pool.query(`SELECT 1 FROM email_outbox WHERE subject = $1`, [`Urgent ${stamp}`])).rows.length, 1);
});
