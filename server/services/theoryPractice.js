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

const MAX_BLOCK_ANSWERS = 100;     // far beyond a 30 s round at any human speed
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
    repeats: row.repeats,
    blockScores: row.block_scores,
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

// ML-418: a practice session's Theory block - the last Level of every quiz at every Theory grade played
// ({ "noteNames|1": 4, ... }; a round with the quiz's own options is grade 0).
export async function getTheoryLevels(accountId) {
  const { rows } = await pool.query(
    `SELECT DISTINCT ON (quiz_id, theory_grade) quiz_id, theory_grade, grade FROM (
       SELECT quiz_id, COALESCE(NULLIF(options->>'grade', '')::int, 0) AS theory_grade, grade, started_at, id
         FROM theory_quiz_attempts WHERE account_id = $1) a
      ORDER BY quiz_id, theory_grade, started_at DESC, id DESC`,
    [accountId]
  );
  return { levels: Object.fromEntries(rows.map(r => [`${r.quiz_id}|${r.theory_grade}`, Number(r.grade)])) };
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

// ML-396 the options screen's "What I've played": one row per set of options (settings key) played in
// this quiz, newest first - its last round (the Level shown is the last, not the best) and how many
// rounds it has had.
export async function getTheoryPlayed(accountId, quizId) {
  if (typeof quizId !== 'string' || !quizId || quizId.length > 40) throw withStatus(400, 'Missing quizId.');
  const { rows } = await pool.query(
    `SELECT * FROM (
       SELECT DISTINCT ON (settings_key) *, COUNT(*) OVER (PARTITION BY settings_key) AS rounds
       FROM theory_quiz_attempts WHERE account_id = $1 AND quiz_id = $2
       ORDER BY settings_key, started_at DESC, id DESC
     ) last ORDER BY started_at DESC, id DESC`,
    [accountId, quizId]
  );
  return { sets: rows.map(r => ({ ...toDto(r), rounds: Number(r.rounds) })) };
}

// ML-269 Smart learn: the questions this account is still learning (weight above 0), for the engine to
// deal first. `enabled` false (feature off) means a plain shuffle and nothing recorded.
//  - weights: what rounds deal by - the stored weight plus the review boost for anything not asked for
//    a week or more (Theory.effectiveWeight), only those above 0.
//  - weak: the "Your weak spots" list - only what's been got wrong (miss_weight above 0, ML-399: a
//    question that's only slow, or only due a review, isn't a weak spot), weakest first, with lifetime
//    right/wrong counts. Its weight here is the miss weight - what a weak spots round deals by.
export async function getTheoryWeights(accountId) {
  if (!(await isFeatureEnabled('theory_smart_learn'))) return { enabled: false, weights: {}, weak: [] };
  const { rows } = await pool.query(
    `SELECT question_id, weight, miss_weight, wrong_count, right_count, updated_at,
            EXTRACT(EPOCH FROM (now() - updated_at)) / 86400 AS days_since
     FROM theory_question_weights WHERE account_id = $1`,
    [accountId]
  );
  const weights = {};
  for (const r of rows) {
    const w = Theory.effectiveWeight(r.weight, Number(r.days_since));
    if (w > 0) weights[r.question_id] = w;
  }
  const weak = rows.filter(r => r.miss_weight > 0 && Theory.itemFromId(r.question_id))
    .sort((a, b) => b.miss_weight - a.miss_weight || b.wrong_count - a.wrong_count)
    .map(r => ({ id: r.question_id, weight: r.miss_weight, wrong: r.wrong_count, right: r.right_count, lastSeen: r.updated_at }));
  return { enabled: true, weights, weak };
}

// Applies a finished round's answers, in order, to the weights - the engine's applyAnswer: wrong +2, a
// quick right -1, and (ML-399) a right answer well over the player's own usual speed in that round +1,
// up to 4 (hesitationMarks). Inside the round's own transaction. Returns what THIS round gave SmartLearn
// to bring back (ML-407): { learning, missed (got wrong in it), slower (right, but slow or only close) }.
// A question that was right this round but still carries weight from an earlier one isn't counted - a
// perfect round brings nothing back "from this round", whatever is left over from before.
// marks (optional): the hesitation mark per answer, for a tool that works them out its own way (Pitch,
// Tempo - server/services/drills.js); Theory's are the engine's hesitationMarks.
// What a round's questions - each { weight (after the round), wrong, slow (counts in this round) } - gave
// SmartLearn to bring back. Only questions still carrying weight count, and only for what happened in
// this round: wrong in it = missed; right but slow = slower.
export function smartLearnSummary(states) {
  const left = states.filter(s => s.weight > 0);
  const missed = left.filter(s => s.wrong > 0).length;
  const slower = left.filter(s => !s.wrong && s.slow > 0).length;
  return { learning: missed + slower, missed, slower };
}

export async function applySmartLearn(client, accountId, answers, marks) {
  const ids = [...new Set(answers.map(a => a.questionId))];
  const { rows } = await client.query(
    'SELECT question_id, weight, miss_weight FROM theory_question_weights WHERE account_id = $1 AND question_id = ANY($2)',
    [accountId, ids]
  );
  const state = new Map(ids.map(id => [id, { weight: 0, miss: 0, right: 0, wrong: 0, slow: 0 }]));
  for (const r of rows) Object.assign(state.get(r.question_id), { weight: r.weight, miss: r.miss_weight });
  marks = marks || plain(Theory.hesitationMarks(answers));
  answers.forEach((a, i) => {
    const s = state.get(a.questionId);
    Object.assign(s, plain(Theory.applyAnswer(s, a.correct, marks[i])));
    if (a.correct) s.right++; else s.wrong++;
    if (a.correct && marks[i] === 'slow') s.slow++;
  });
  const values = [];
  const params = [accountId];
  [...state.entries()].forEach(([id, s], i) => {
    const o = 2 + i * 5;
    values.push(`($1, $${o}, $${o + 1}, $${o + 2}, $${o + 3}, $${o + 4})`);
    params.push(id, s.weight, s.miss, s.wrong, s.right);
  });
  await client.query(
    `INSERT INTO theory_question_weights (account_id, question_id, weight, miss_weight, wrong_count, right_count)
     VALUES ${values.join(', ')}
     ON CONFLICT (account_id, question_id) DO UPDATE SET
       weight = EXCLUDED.weight,
       miss_weight = EXCLUDED.miss_weight,
       wrong_count = theory_question_weights.wrong_count + EXCLUDED.wrong_count,
       right_count = theory_question_weights.right_count + EXCLUDED.right_count,
       updated_at = now()`,
    params
  );
  return smartLearnSummary([...state.values()]);
}

export async function saveTheoryAttempt(accountId, body) {
  const b = body || {};
  const quizIds = [...plain(Theory.QUIZZES).map(q => q.id), Theory.WEAK_SPOTS.id];
  if (!quizIds.includes(b.quizId)) throw withStatus(400, 'Unknown quiz.');
  const round = plain(Theory.ROUNDS).find(r => r.value === b.roundType);
  if (!round) throw withStatus(400, 'Unknown round type.');
  // ML-354: the round done 1-5 times; each answer says which time (block), and each block its time.
  const repeats = Number(b.repeats ?? 1);
  if (!plain(Theory.REPEATS).includes(repeats)) throw withStatus(400, 'Repeat 1 to 5 times.');
  // The round is scored from its answers: a timed round weighs each one by its question type's par
  // time (Mixed rounds mix types), so right/wrong counts alone aren't enough.
  if (!Array.isArray(b.answers) || b.answers.length > MAX_BLOCK_ANSWERS * repeats) throw withStatus(400, 'Missing answers.');
  const answers = b.answers.map(a => ({
    questionId: String(a && a.questionId || '').slice(0, 80),
    answerId: String(a && a.answerId || '').slice(0, 40),
    correct: !!(a && a.correct),
    ms: Math.max(0, Math.min(3600000, Math.round(Number(a && a.ms) || 0))),
    block: Number((a && a.block) ?? 1)
  }));
  if (answers.some(a => !a.questionId || !a.answerId)) throw withStatus(400, 'Every answer needs a question and an answer.');
  if (answers.some(a => !Number.isInteger(a.block) || a.block < 1 || a.block > repeats)) throw withStatus(400, 'An answer is in a round that isn\'t there.');
  if (answers.some((a, i) => i && a.block < answers[i - 1].block)) throw withStatus(400, 'Answers go round by round.');
  for (let k = 1; k <= repeats; k++) {
    const n = answers.filter(a => a.block === k).length;
    if (round.questions && n !== round.questions) throw withStatus(400, `A ${round.questions}-question round has ${round.questions} answers.`);
    if (n > MAX_BLOCK_ANSWERS) throw withStatus(400, 'Too many answers.');
  }
  const blockMs = Array.isArray(b.blockMs) ? b.blockMs.map(Number) : [];
  if (blockMs.length !== repeats || blockMs.some(ms => !Number.isInteger(ms) || ms < 0 || ms > 60 * 60 * 1000)) throw withStatus(400, 'Invalid duration.');
  const startedAt = new Date(b.startedAt);
  if (Number.isNaN(startedAt.getTime())) throw withStatus(400, 'Invalid start time.');
  const naming = b.naming === 'solfege' ? 'solfege' : 'letters';

  // ML-309: a Theory grade only counts while theory_grades is on - otherwise it's the custom options.
  const gradesOn = await isFeatureEnabled('theory_grades');
  // ML-309 C: the grade-only quizzes (Intervals, Chords) have no custom options to fall back on.
  if (!gradesOn && plain(Theory.quiz(b.quizId)).gradeOnly) throw withStatus(400, 'This quiz needs Theory grades.');
  const options = plain(Theory.normaliseOptions(b.quizId, gradesOn ? b.options : { ...(b.options || {}), grade: 0 }));
  const settingsKey = Theory.settingsKey(b.quizId, options, round.value);
  // The best block is the result, and its time is the attempt's duration (for a fixed round, the
  // tie-break between equal scores - BEST_ORDER).
  const { right, wrong, score, grade, ms: durationMs, blockScores } = plain(Theory.scoreBlocks(round.value, answers, repeats, blockMs));
  const smartLearn = await isFeatureEnabled('theory_smart_learn');
  let learning = null; // SmartLearn: { learning, missed, slower } - this round's questions still being learned

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const before = await historyFor(client, accountId, settingsKey);
    const { rows } = await client.query(
      `INSERT INTO theory_quiz_attempts
         (account_id, quiz_id, round_type, repeats, block_scores, options, settings_key, naming, right_count, wrong_count, score, grade, duration_ms, started_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14) RETURNING *`,
      [accountId, b.quizId, round.value, repeats, blockScores, JSON.stringify(options), settingsKey, naming, right, wrong, score, grade, durationMs, startedAt]
    );
    const attempt = toDto(rows[0]);
    const clean = answers.map((a, i) => ({ seq: i + 1, q: a.questionId, a: a.answerId, c: a.correct, ms: a.ms, block: a.block }));
    if (clean.length) {
      const values = [];
      const params = [attempt.id];
      clean.forEach((a, i) => {
        const o = 2 + i * 6;
        values.push(`($1, $${o}, $${o + 1}, $${o + 2}, $${o + 3}, $${o + 4}, $${o + 5})`);
        params.push(a.seq, a.q, a.a, a.c, a.ms, a.block);
      });
      await client.query(`INSERT INTO theory_quiz_answers (attempt_id, seq, question_id, answer_id, correct, ms, block) VALUES ${values.join(', ')}`, params);
      if (smartLearn) learning = await applySmartLearn(client, accountId, answers);
    }
    const after = await historyFor(client, accountId, settingsKey);
    await client.query('COMMIT');
    return {
      attempt,
      // A new best only when it beats one there already - the very first round is just "first".
      smartLearn: smartLearn ? (learning || { learning: null }) : null,
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
