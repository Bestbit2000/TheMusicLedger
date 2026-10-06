// ML-472: a teacher belongs to the member who typed the name in (server/services/tutors.js) - against a
// real database, because the point is what one member can do to another's rows. Runs only when pointed
// at the dev branch:
//   node --env-file=../.env --test test/tutors.test.js      (from server/)
// Under plain `npm test` (no database) it is skipped. Everything it makes belongs to throwaway accounts,
// which it removes again (their teachers and lessons go with them).

import { test, after } from 'node:test';
import assert from 'node:assert/strict';

const onDev = process.env.NEON_BRANCH === 'dev' && !!process.env.DATABASE_URL;
process.env.DATABASE_URL ||= 'postgres://test@localhost/test';

const { default: pool } = await import('../config/db.js');
const { listTutors, getOrCreateTutor, renameTutor, isTutorUsedInHistory, archiveOrDeleteTutor, unarchiveTutor } = await import('../services/tutors.js');

const stamp = Date.now();
const accounts = [];
const one = async (sql, params) => (await pool.query(sql, params)).rows[0];
const account = async (name) => {
  const id = Number((await one(`INSERT INTO accounts (email, first_name, surname) VALUES ($1, $2, 'Test') RETURNING id`, [`ml472-${name}-${stamp}@themusicledger.local`, name])).id);
  accounts.push(id);
  return id;
};
const lesson = (accountId, tutorId) => pool.query(`INSERT INTO sessions (session_type, account_id, tutor_id, started_at, total_duration_minutes) VALUES ('lesson', $1, $2, now(), 30)`, [accountId, tutorId]);
const names = async (accountId) => (await listTutors(accountId)).map((t) => `${t.name}${t.archived ? ' (archived)' : ''}`);
const skip = !onDev && 'needs the dev database';

after(async () => {
  if (onDev) for (const id of accounts) await pool.query('DELETE FROM accounts WHERE id = $1', [id]).catch(() => {});
  await pool.end().catch(() => {});
});

test('each member has their own teachers: the same name is two rows, and each sees only theirs', { skip }, async () => {
  const anna = await account('anna');
  const ben = await account('ben');
  const annasSmith = await getOrCreateTutor(anna, 'Mrs Smith');
  const bensSmith = await getOrCreateTutor(ben, 'Mrs Smith');
  await getOrCreateTutor(ben, 'Mr Jones');
  assert.notEqual(Number(annasSmith), Number(bensSmith));
  assert.equal(Number(await getOrCreateTutor(anna, 'Mrs Smith')), Number(annasSmith), 'asking again gives the same row');
  assert.deepEqual(await names(anna), ['Mrs Smith']);
  assert.deepEqual(await names(ben), ['Mr Jones', 'Mrs Smith']);
});

test("one member can't rename, archive, delete or unarchive another's teacher", { skip }, async () => {
  const anna = await account('anna2');
  const ben = await account('ben2');
  const annasSmith = await getOrCreateTutor(anna, 'Mrs Smith');
  await getOrCreateTutor(ben, 'Mrs Smith');
  await getOrCreateTutor(anna, 'Mr Only-Annas');
  await lesson(anna, annasSmith);

  // Ben renames "Mrs Smith": his own changes, Anna's doesn't - nor does her lesson history
  await renameTutor(ben, 'Mrs Smith', 'Ms Smith-Brown');
  assert.deepEqual(await names(ben), ['Ms Smith-Brown']);
  assert.deepEqual(await names(anna), ['Mr Only-Annas', 'Mrs Smith']);
  // A name only Anna has is nothing to Ben: nothing changes, nothing is deleted, nothing is reported
  await renameTutor(ben, 'Mr Only-Annas', 'Hijacked');
  assert.equal(await archiveOrDeleteTutor(ben, 'Mr Only-Annas'), false);
  assert.equal(await isTutorUsedInHistory(ben, 'Mrs Smith'), false, "Anna's lessons don't count as Ben's");
  assert.deepEqual(await names(anna), ['Mr Only-Annas', 'Mrs Smith']);

  // Anna's own: used in a lesson, so it is archived, not deleted - and Ben can't bring it back
  assert.equal(await isTutorUsedInHistory(anna, 'Mrs Smith'), true);
  assert.equal(await archiveOrDeleteTutor(anna, 'Mrs Smith'), true);
  await unarchiveTutor(ben, 'Mrs Smith');
  assert.deepEqual(await names(anna), ['Mr Only-Annas', 'Mrs Smith (archived)']);
  await unarchiveTutor(anna, 'Mrs Smith');
  assert.equal(await archiveOrDeleteTutor(anna, 'Mr Only-Annas'), false); // never used: deleted
  assert.deepEqual(await names(anna), ['Mrs Smith']);
});

test('renaming to a name you already have is refused', { skip }, async () => {
  const anna = await account('anna3');
  await getOrCreateTutor(anna, 'Mrs Smith');
  await getOrCreateTutor(anna, 'Mr Jones');
  await assert.rejects(renameTutor(anna, 'Mr Jones', 'Mrs Smith'), (e) => e.status === 409);
  assert.deepEqual(await names(anna), ['Mr Jones', 'Mrs Smith']);
});

test('a teacher is a name only, and goes when the member does', { skip }, async () => {
  const { rows } = await pool.query(`SELECT column_name FROM information_schema.columns WHERE table_name = 'tutors' ORDER BY column_name`);
  assert.deepEqual(rows.map((r) => r.column_name), ['account_id', 'active', 'display_name', 'id']); // ML-467: assess before adding to this
  const cara = await account('cara');
  const id = await getOrCreateTutor(cara, 'Mrs Smith');
  await pool.query('DELETE FROM accounts WHERE id = $1', [cara]);
  assert.equal((await pool.query('SELECT 1 FROM tutors WHERE id = $1', [id])).rows.length, 0);
});
