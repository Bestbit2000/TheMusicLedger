// ML-265 (ML-260): saving Theory practice rounds, and the history/personal bests the screens show.
// Tables: db/migrations/052_theory_quiz.sql.
//
// The score and grade are recomputed here with the same engine the screen runs (public/theoryEngine.js,
// loaded with vm like the unit tests do - it's a browser script, and this package is ESM), so a stored
// grade always follows the confirmed scoring rules whatever the client sent.

import fs from 'node:fs';
import vm from 'node:vm';
import pool from '../config/db.js';
import { withStatus } from './flows.js';
import { isFeatureEnabled } from './features.js';

const sandbox = { self: {} };
for (const f of ['notation.js', 'theoryEngine.js']) {
  vm.runInNewContext(fs.readFileSync(new URL(`../../public/${f}`, import.meta.url), 'utf8'), sandbox);
}
const Theory = sandbox.self.TheoryEngine;
const plain = (v) => JSON.parse(JSON.stringify(v));

const MAX_ANSWERS = 200;           // far beyond a 60 s round at any human speed
const HISTORY_LENGTH = 8;          // rounds shown in the results screen's trend

function toDto(row) {
  return {
    id: Number(row.id),
    quizId: row.quiz_id,
    roundType: row.round_type,
    options: row.options,
    settingsKey: row.settings_key,
    right: row.right_count,
    wrong: row.wrong_count,
    score: row.score,
    grade: row.grade,
    durationMs: row.duration_ms,
    startedAt: row.started_at
  };
}

// Best = highest score; ties go to the quicker round (fixed rounds), then the earlier one.
const BEST_ORDER = 'score DESC, duration_ms ASC, started_at ASC';

async function historyFor(client, accountId, settingsKey) {
  const [recent, best] = await Promise.all([
    client.query(
      `SELECT * FROM theory_quiz_attempts WHERE account_id = $1 AND settings_key = $2
       ORDER BY started_at DESC, id DESC LIMIT ${HISTORY_LENGTH}`,
      [accountId, settingsKey]
    ),
    client.query(
      `SELECT * FROM theory_quiz_attempts WHERE account_id = $1 AND settings_key = $2
       ORDER BY ${BEST_ORDER} LIMIT 1`,
      [accountId, settingsKey]
    )
  ]);
  return { recent: recent.rows.map(toDto).reverse(), best: best.rows[0] ? toDto(best.rows[0]) : null };
}

export async function getTheoryHistory(accountId, settingsKey) {
  if (typeof settingsKey !== 'string' || !settingsKey || settingsKey.length > 300) throw withStatus(400, 'Missing settingsKey.');
  return historyFor(pool, accountId, settingsKey);
}

// The quiz list: each quiz's most recent round (grade + when), or nothing if never tried.
export async function getTheorySummary(accountId) {
  const { rows } = await pool.query(
    `SELECT DISTINCT ON (quiz_id) * FROM theory_quiz_attempts WHERE account_id = $1
     ORDER BY quiz_id, started_at DESC, id DESC`,
    [accountId]
  );
  const byQuiz = {};
  for (const r of rows) byQuiz[r.quiz_id] = toDto(r);
  return { quizzes: byQuiz };
}

// ML-269 Smart learn: the questions this account is still learning (weight above 0), for the engine to
// deal first. `enabled` false (feature off) means a plain shuffle and nothing recorded.
//  - weights: what rounds deal by - the stored weight plus the review boost for anything not asked for
//    a week or more (Theory.effectiveWeight), only those above 0.
//  - weak: the "Your weak spots" list - stored weight above 0 only (a review boost isn't a weak spot),
//    weakest first, with lifetime right/wrong counts.
export async function getTheoryWeights(accountId) {
  if (!(await isFeatureEnabled('theory_smart_learn'))) return { enabled: false, weights: {}, weak: [] };
  const { rows } = await pool.query(
    `SELECT question_id, weight, wrong_count, right_count, updated_at,
            EXTRACT(EPOCH FROM (now() - updated_at)) / 86400 AS days_since
     FROM theory_question_weights WHERE account_id = $1`,
    [accountId]
  );
  const weights = {};
  for (const r of rows) {
    const w = Theory.effectiveWeight(r.weight, Number(r.days_since));
    if (w > 0) weights[r.question_id] = w;
  }
  const weak = rows.filter(r => r.weight > 0 && Theory.itemFromId(r.question_id))
    .sort((a, b) => b.weight - a.weight || b.wrong_count - a.wrong_count)
    .map(r => ({ id: r.question_id, weight: r.weight, wrong: r.wrong_count, right: r.right_count, lastSeen: r.updated_at }));
  return { enabled: true, weights, weak };
}

// Applies a finished round's answers, in order, to the weights (wrong +2, right -1, 0-10 - the engine's
// nextWeight, so client and server can't disagree). Inside the round's own transaction.
async function applySmartLearn(client, accountId, answers) {
  const ids = [...new Set(answers.map(a => a.questionId))];
  const { rows } = await client.query(
    'SELECT question_id, weight FROM theory_question_weights WHERE account_id = $1 AND question_id = ANY($2)',
    [accountId, ids]
  );
  const state = new Map(ids.map(id => [id, { weight: 0, right: 0, wrong: 0 }]));
  for (const r of rows) state.get(r.question_id).weight = r.weight;
  for (const a of answers) {
    const s = state.get(a.questionId);
    s.weight = Theory.nextWeight(s.weight, a.correct, a); // a slow right answer (over 2x par) leaves it be
    if (a.correct) s.right++; else s.wrong++;
  }
  const values = [];
  const params = [accountId];
  [...state.entries()].forEach(([id, s], i) => {
    const o = 2 + i * 4;
    values.push(`($1, $${o}, $${o + 1}, $${o + 2}, $${o + 3})`);
    params.push(id, s.weight, s.wrong, s.right);
  });
  await client.query(
    `INSERT INTO theory_question_weights (account_id, question_id, weight, wrong_count, right_count)
     VALUES ${values.join(', ')}
     ON CONFLICT (account_id, question_id) DO UPDATE SET
       weight = EXCLUDED.weight,
       wrong_count = theory_question_weights.wrong_count + EXCLUDED.wrong_count,
       right_count = theory_question_weights.right_count + EXCLUDED.right_count,
       updated_at = now()`,
    params
  );
  return [...state.values()].filter(s => s.weight > 0).length;
}

export async function saveTheoryAttempt(accountId, body) {
  const b = body || {};
  const quizIds = [...plain(Theory.QUIZZES).map(q => q.id), Theory.WEAK_SPOTS.id];
  if (!quizIds.includes(b.quizId)) throw withStatus(400, 'Unknown quiz.');
  const round = plain(Theory.ROUNDS).find(r => r.value === b.roundType);
  if (!round) throw withStatus(400, 'Unknown round type.');
  // The round is scored from its answers: a timed round weighs each one by its question type's par
  // time (Mixed rounds mix types), so right/wrong counts alone aren't enough.
  if (!Array.isArray(b.answers) || b.answers.length > MAX_ANSWERS) throw withStatus(400, 'Missing answers.');
  const answers = b.answers.map(a => ({
    questionId: String(a && a.questionId || '').slice(0, 80),
    answerId: String(a && a.answerId || '').slice(0, 40),
    correct: !!(a && a.correct),
    ms: Math.max(0, Math.min(3600000, Math.round(Number(a && a.ms) || 0)))
  }));
  if (answers.some(a => !a.questionId || !a.answerId)) throw withStatus(400, 'Every answer needs a question and an answer.');
  if (round.questions && answers.length !== round.questions) throw withStatus(400, `A ${round.questions}-question round has ${round.questions} answers.`);
  const durationMs = Number(b.durationMs);
  if (!Number.isInteger(durationMs) || durationMs < 0 || durationMs > 60 * 60 * 1000) throw withStatus(400, 'Invalid duration.');
  const startedAt = new Date(b.startedAt);
  if (Number.isNaN(startedAt.getTime())) throw withStatus(400, 'Invalid start time.');
  const naming = b.naming === 'solfege' ? 'solfege' : 'letters';

  const options = plain(Theory.normaliseOptions(b.quizId, b.options));
  const settingsKey = Theory.settingsKey(b.quizId, options, round.value);
  const { right, wrong, score, grade } = plain(Theory.scoreRound(round.value, answers));
  const smartLearn = await isFeatureEnabled('theory_smart_learn');
  let learning = null; // Smart learn: how many of this round's questions are still being learned

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const before = await historyFor(client, accountId, settingsKey);
    const { rows } = await client.query(
      `INSERT INTO theory_quiz_attempts
         (account_id, quiz_id, round_type, options, settings_key, naming, right_count, wrong_count, score, grade, duration_ms, started_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING *`,
      [accountId, b.quizId, round.value, JSON.stringify(options), settingsKey, naming, right, wrong, score, grade, durationMs, startedAt]
    );
    const attempt = toDto(rows[0]);
    const clean = answers.map((a, i) => ({ seq: i + 1, q: a.questionId, a: a.answerId, c: a.correct, ms: a.ms }));
    if (clean.length) {
      const values = [];
      const params = [attempt.id];
      clean.forEach((a, i) => {
        const o = 2 + i * 5;
        values.push(`($1, $${o}, $${o + 1}, $${o + 2}, $${o + 3}, $${o + 4})`);
        params.push(a.seq, a.q, a.a, a.c, a.ms);
      });
      await client.query(`INSERT INTO theory_quiz_answers (attempt_id, seq, question_id, answer_id, correct, ms) VALUES ${values.join(', ')}`, params);
      if (smartLearn) learning = await applySmartLearn(client, accountId, answers);
    }
    const after = await historyFor(client, accountId, settingsKey);
    await client.query('COMMIT');
    return {
      attempt,
      // A new best only when it beats one there already - the very first round is just "first".
      smartLearn: smartLearn ? { learning } : null,
      isFirst: !before.best,
      isNewBest: !!before.best && after.best && after.best.id === attempt.id,
      previousBest: before.best,
      ...after
    };
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    throw e;
  } finally {
    client.release();
  }
}
