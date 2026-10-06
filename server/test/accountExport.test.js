// ML-430: "Download my information" (server/services/accountExport.js) - against a real database,
// like accountDeletion.test.js. Runs only when pointed at the dev branch:
//   node --env-file=../.env --env-file=.env --test test/accountExport.test.js      (from server/)
// Under plain `npm test` (no database) it is skipped. It only makes throwaway accounts, and removes them.

import { test, after } from 'node:test';
import assert from 'node:assert/strict';

const onDev = process.env.NEON_BRANCH === 'dev' && !!process.env.DATABASE_URL && !!process.env.SESSION_SECRET;
process.env.DATABASE_URL ||= 'postgres://test@localhost/test';

const { default: pool } = await import('../config/db.js');
const { exportMyAccount } = await import('../services/accountExport.js');

const stamp = Date.now();
const made = [];
const cleanup = [];
const one = async (sql, params) => (await pool.query(sql, params)).rows[0];

after(async () => {
  if (onDev) {
    for (const sql of cleanup.reverse()) await pool.query(sql).catch(() => {});
    for (const id of made) await pool.query('DELETE FROM accounts WHERE id = $1', [id]).catch(() => {});
  }
  await pool.end().catch(() => {});
});

test('the export holds everything of the member\'s, nothing of anyone else\'s, and no sign-in secrets', { skip: !onDev && 'needs the dev database' }, async () => {
  const email = `ml430-export-${stamp}@themusicledger.local`;
  const id = Number((await one(`INSERT INTO accounts (email, first_name, surname) VALUES ($1, 'Morag', 'Exporter') RETURNING id`, [email])).id);
  const other = Number((await one(`INSERT INTO accounts (email, first_name, surname) VALUES ($1, 'Someone', 'Else') RETURNING id`, [`ml430-export-other-${stamp}@themusicledger.local`])).id);
  made.push(id, other);

  // Mine: a piece with a recording, a session with a part, a drill result, feedback, a password
  const piece = Number((await one(`INSERT INTO scores (title, composer, owner_account_id) VALUES ('Export piece', 'A Composer', $1) RETURNING id`, [id])).id);
  await pool.query(`INSERT INTO score_recordings (score_id, type, title, youtube_video_id, order_index) VALUES ($1, 'youtube', 'A recording', 'dQw4w9WgXcQ', 0)`, [piece]);
  const session = Number((await one(`INSERT INTO sessions (session_type, account_id, started_at, total_duration_minutes) VALUES ('practice', $1, now(), 20) RETURNING id`, [id])).id);
  await pool.query(`INSERT INTO session_segments (session_id, segment_type, order_index) VALUES ($1, 'scales', 0)`, [session]);
  await pool.query(`INSERT INTO drill_attempts (account_id, tool, level, score, grade, details, started_at) VALUES ($1, 'ear', '2', 90, 5, '{}', now())`, [id]);
  await pool.query(`INSERT INTO feedback (account_id, message) VALUES ($1, 'My own note')`, [id]);
  await pool.query(`INSERT INTO account_passwords (account_id, password_hash) VALUES ($1, 'not-a-real-hash')`, [id]);

  // Someone else's, and a band we share (I started it)
  const theirSession = Number((await one(`INSERT INTO sessions (session_type, account_id, started_at, total_duration_minutes) VALUES ('practice', $1, now(), 99) RETURNING id`, [other])).id);
  await pool.query(`INSERT INTO feedback (account_id, message) VALUES ($1, 'Their private note')`, [other]);
  const band = Number((await one(`INSERT INTO bands (name, created_by_account_id, kind) VALUES ($1, $2, 'group') RETURNING id`, [`ML-430 export band ${stamp}`, id])).id);
  cleanup.push(`DELETE FROM bands WHERE id = ${band}`);
  await pool.query(`INSERT INTO band_members (band_id, account_id) VALUES ($1, $2), ($1, $3)`, [band, id, other]);

  const out = await exportMyAccount(id);
  const text = JSON.stringify(out);

  // Mine is there
  assert.equal(out.account.email, email);
  assert.equal(out.account.first_name, 'Morag');
  assert.equal(out.data.scores.length, 1);
  assert.equal(out.data.scores[0].title, 'Export piece');
  assert.equal(out.data.score_recordings.length, 1); // followed down from the piece
  assert.equal(out.data.sessions.length, 1);
  assert.equal(out.data.session_segments.length, 1); // followed down from the session
  assert.equal(out.data.drill_attempts.length, 1);
  assert.equal(out.data.feedback[0].message, 'My own note');
  assert.equal(out.data.bands.length, 1);
  assert.deepEqual(out.signIn, { hasPassword: true, twoStepOn: false });

  // Nobody else's
  assert.equal(out.data.band_members.length, 1);
  assert.equal(Number(out.data.band_members[0].account_id), id);
  assert.equal(out.data.sessions.some((s) => Number(s.id) === theirSession), false);
  assert.equal(text.includes('Their private note'), false);
  assert.equal(text.includes('ml430-export-other'), false);

  // No secrets
  assert.equal(out.data.account_passwords, undefined);
  assert.equal(text.includes('not-a-real-hash'), false);
  assert.equal('token_version' in out.account, false);
  for (const rows of Object.values(out.data)) for (const row of rows) for (const column of Object.keys(row)) assert.doesNotMatch(column, /hash|secret|token/i);
});

test('there is nothing to export for an account that isn\'t there', { skip: !onDev && 'needs the dev database' }, async () => {
  await assert.rejects(() => exportMyAccount(-1), /not found/i);
});
