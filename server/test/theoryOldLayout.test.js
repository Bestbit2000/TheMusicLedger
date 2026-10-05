// ML-438: rounds played on a quiz's old layout (theory_quiz_attempts.old_layout) count as a set of options'
// history and best only until a round is played on the new layout with those options - then only the new ones
// do (server/services/theoryPractice.js, CURRENT_LAYOUT). Against a real database. Runs only when pointed at
// the dev branch:
//   node --env-file=../.env --env-file=.env --test test/theoryOldLayout.test.js      (from server/)
// Under plain `npm test` (no database) it is skipped. Its rows belong to a throwaway account, removed again.

import { test, after } from 'node:test';
import assert from 'node:assert/strict';

const onDev = process.env.NEON_BRANCH === 'dev' && !!process.env.DATABASE_URL && !!process.env.SESSION_SECRET;
process.env.DATABASE_URL ||= 'postgres://test@localhost/test';

const { default: pool } = await import('../config/db.js');
const { getTheoryHistory, getTheoryPlayed, saveTheoryAttempt } = await import('../services/theoryPractice.js');

const stamp = Date.now();
let account = null;
after(async () => {
  if (onDev && account) await pool.query('DELETE FROM accounts WHERE id = $1', [account]).catch(() => {});
  await pool.end().catch(() => {});
});

test('old-layout Keys rounds count until a new one is played with the same options, then only the new ones', { skip: !onDev && 'needs the dev database' }, async () => {
  account = Number((await pool.query(`INSERT INTO accounts (email, first_name, surname) VALUES ($1, 'Keys', 'Test') RETURNING id`, [`ml438-${stamp}@themusicledger.local`])).rows[0].id);
  const options = { show: 'keySignatures', clefs: ['treble'], upTo: 3, keyTypes: 'both', modes: 'major' };
  const answers = (n) => Array.from({ length: n }, () => ({ questionId: 'keySignature:treble:G major', answerId: 'G', correct: true, ms: 2000, block: 1 }));
  const round = (n) => saveTheoryAttempt(account, { quizId: 'keys', roundType: 't30', repeats: 1, options, blockMs: [30000], startedAt: new Date().toISOString(), answers: answers(n) });

  // two rounds from before the change: a strong one and a weaker one
  const first = await round(12);
  await round(6);
  const key = first.attempt.settingsKey;
  await pool.query('UPDATE theory_quiz_attempts SET old_layout = true WHERE account_id = $1', [account]);

  // until a new round is played they are still the history and the best
  let h = await getTheoryHistory(account, key);
  assert.equal(h.recent.length, 2);
  assert.equal(h.best.score, 100);
  assert.equal((await getTheoryPlayed(account, 'keys')).sets[0].rounds, 2);

  // the first round on the new layout is measured against nothing, and takes over
  const now = await round(3);
  assert.equal(now.isFirst, true);
  h = await getTheoryHistory(account, key);
  assert.deepEqual(h.recent.map(a => a.id), [now.attempt.id]);
  assert.equal(h.best.id, now.attempt.id);
  assert.equal((await getTheoryPlayed(account, 'keys')).sets[0].rounds, 1);

  // nothing was deleted
  assert.equal(Number((await pool.query('SELECT count(*) AS n FROM theory_quiz_attempts WHERE account_id = $1', [account])).rows[0].n), 3);
});
