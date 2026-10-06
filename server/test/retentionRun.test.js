// ML-464: a retention run (server/services/retention.js) against a real database - what matters is
// what happens to the accounts and what is emailed. Runs only when pointed at the dev branch:
//   node --env-file=../.env --env-file=.env --test test/retentionRun.test.js      (from server/)
// Under plain `npm test` (no database) it is skipped. It uses a rule of its own and touches only its
// own throwaway accounts (the `only` option), so the saved rule and every other account are left alone.

import { test, after } from 'node:test';
import assert from 'node:assert/strict';

const onDev = process.env.NEON_BRANCH === 'dev' && !!process.env.DATABASE_URL && !!process.env.SESSION_SECRET;
process.env.DATABASE_URL ||= 'postgres://test@localhost/test';
process.env.MAIL_PROVIDER = 'log'; // emails go to the outbox table, never to anyone

const { default: pool } = await import('../config/db.js');
const { runRetention, COUNTS_FROM } = await import('../services/retention.js');
const { touchLastSeen } = await import('../services/accounts.js');
const { deletedEmailHash } = await import('../services/tokenVersions.js');

const stamp = Date.now();
const RULE = { enabled: true, unit: 'hours', first: 1, second: 2, remove: 3 };
const made = [];
const emails = [];
const one = async (sql, params) => (await pool.query(sql, params)).rows[0];
async function account(tag, over = {}) {
  const email = `ml464-${tag}-${stamp}@themusicledger.local`;
  const row = await one(
    `INSERT INTO accounts (email, first_name, surname, account_level, created_at, last_seen_on, retention_stage, retention_stage_at)
     VALUES ($1, 'Test', $2, $3, $4, $5, $6, $7) RETURNING id`,
    [email, tag, over.level || 'standard_member', over.createdAt || '2026-10-06T00:00:00Z', over.lastSeenOn || null, over.stage || 0, over.stageAt || null]);
  made.push(Number(row.id)); emails.push(email);
  return { id: Number(row.id), email };
}
const state = (id) => one('SELECT retention_stage, retention_stage_at, deleted_at, email, first_name FROM accounts WHERE id = $1', [id]);
const sentTo = async (email) => (await pool.query('SELECT subject FROM email_outbox WHERE to_email = $1 ORDER BY id', [email])).rows.map((r) => r.subject);

after(async () => {
  if (onDev) {
    for (const id of made) await pool.query('DELETE FROM accounts WHERE id = $1', [id]).catch(() => {});
    for (const e of emails) {
      await pool.query('DELETE FROM email_outbox WHERE to_email = $1', [e]).catch(() => {});
      await pool.query('DELETE FROM deleted_account_markers WHERE email_hash = $1', [deletedEmailHash(e)]).catch(() => {});
    }
  }
  await pool.end().catch(() => {});
});

test('a run takes each due account one step: first email, second email, deletion - and leaves the rest', { skip: !onDev && 'needs the dev database' }, async () => {
  const now = new Date(new Date(COUNTS_FROM).getTime() + 10 * 3600000); // ten hours after counting began
  const hoursAgo = (h) => new Date(now.getTime() - h * 3600000);
  const fresh = await account('fresh');                                                  // unused 10 hours: first email
  const warned = await account('warned', { stage: 1, stageAt: hoursAgo(2) });           // first went 2 hours ago: second email
  const tooSoon = await account('toosoon', { stage: 1, stageAt: hoursAgo(0.5) });       // first went half an hour ago: nothing yet
  const last = await account('last', { stage: 2, stageAt: hoursAgo(2) });               // second went 2 hours ago: deleted
  const admin = await account('admin', { level: 'super_admin' });                        // never touched
  const only = made.slice();

  const out = await runRetention({ now, rule: RULE, only, appUrl: 'https://example.test' });
  assert.equal(out.ran, true);
  assert.deepEqual([out.firstEmails, out.secondEmails, out.deleted, out.problems.length], [1, 1, 1, 0]);

  assert.equal((await state(fresh.id)).retention_stage, 1);
  assert.deepEqual(await sentTo(fresh.email), ['Your Music Ledger account has not been used for a while']);
  assert.equal((await state(warned.id)).retention_stage, 2);
  assert.deepEqual(await sentTo(warned.email), ['Last reminder: your Music Ledger account will be deleted soon']);
  assert.equal((await state(tooSoon.id)).retention_stage, 1);
  assert.deepEqual(await sentTo(tooSoon.email), []);

  const gone = await state(last.id);
  assert.ok(gone.deleted_at, 'the account is deleted');
  assert.equal(gone.first_name, 'Deleted');
  assert.match(gone.email, /@deleted\.invalid$/);
  assert.deepEqual(await sentTo(last.email), ['Your Music Ledger account has been deleted']);

  assert.equal((await state(admin.id)).retention_stage, 0);
  assert.deepEqual(await sentTo(admin.email), []);
});

test('a second run straight away does nothing more: no step is taken twice, and none early', { skip: !onDev && 'needs the dev database' }, async () => {
  const now = new Date(new Date(COUNTS_FROM).getTime() + 10 * 3600000 + 60000);
  const before = await Promise.all(made.map((id) => state(id)));
  // stage_at in the first test was "now" of that run, so a minute later nobody has waited their hour
  const out = await runRetention({ now, rule: RULE, only: made.slice() });
  // "toosoon" was warned half an hour before the first run: still inside its hour
  assert.deepEqual([out.firstEmails, out.secondEmails, out.deleted], [0, 0, 0]);
  const after_ = await Promise.all(made.map((id) => state(id)));
  assert.deepEqual(after_.map((s) => s.retention_stage), before.map((s) => s.retention_stage));
});

test('switched off, a run does nothing at all', { skip: !onDev && 'needs the dev database' }, async () => {
  const out = await runRetention({ now: new Date('2040-01-01T00:00:00Z'), rule: { ...RULE, enabled: false }, only: made.slice() });
  assert.equal(out.ran, false);
  assert.match(out.why, /switched off/);
});

test('using the app again forgets the warning', { skip: !onDev && 'needs the dev database' }, async () => {
  const back = await account('back', { stage: 2, stageAt: '2026-10-06T05:00:00Z', lastSeenOn: '2026-10-01' });
  touchLastSeen(back.id);
  for (let i = 0; i < 40 && (await state(back.id)).retention_stage !== 0; i += 1) await new Promise((r) => setTimeout(r, 100));
  const s = await state(back.id);
  assert.equal(s.retention_stage, 0);
  assert.equal(s.retention_stage_at, null);
});
