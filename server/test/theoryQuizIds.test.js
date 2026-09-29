// Every Theory quiz can be saved: the newest migration's theory_quiz_attempts.quiz_id CHECK must list
// every quiz in public/theoryEngine.js (plus Your weak spots). Intervals and Chords shipped in 0.31.0
// without it and couldn't save a round anywhere until migration 076.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const root = new URL('../../', import.meta.url);
const sandbox = { self: {} };
for (const f of ['notation.js', 'theoryEngine.js']) vm.runInNewContext(fs.readFileSync(new URL(`public/${f}`, root), 'utf8'), sandbox);
const T = sandbox.self.TheoryEngine;

test('the quiz_id check allows every quiz the engine has', () => {
  const dir = new URL('db/migrations/', root);
  let latest = null;
  for (const file of fs.readdirSync(dir).filter(f => f.endsWith('.sql')).sort()) {
    const sql = fs.readFileSync(new URL(file, dir), 'utf8');
    const m = [...sql.matchAll(/quiz_id\s+TEXT[^,]*CHECK\s*\(quiz_id IN \(([^)]*)\)\)|theory_quiz_attempts_quiz_id_check\s+CHECK\s*\(quiz_id IN \(([^)]*)\)\)/g)].pop();
    if (m) latest = { file, ids: (m[1] || m[2]).match(/'([^']+)'/g).map(s => s.slice(1, -1)) };
  }
  assert.ok(latest, 'no quiz_id check found in the migrations');
  const engineIds = [...T.QUIZZES.map(q => q.id), T.WEAK_SPOTS.id];
  const missing = engineIds.filter(id => !latest.ids.includes(id));
  assert.deepEqual(missing, [], `${latest.file}'s quiz_id check is missing ${missing.join(', ')} - add a migration that widens it`);
});
