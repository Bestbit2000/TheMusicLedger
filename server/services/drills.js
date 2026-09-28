// ML-298 / ML-295 / ML-296: saving the drill tools' rounds (Tap tempo, Gap trainer, Ear), and the
// history and personal bests their screens show. Table: db/migrations/057_drills.sql.
//
// The score and grade are recomputed here from the round's raw details (the taps, or the notes and
// answers) with the same engine the app runs (public/drills.js, loaded with vm like theoryPractice.js
// loads theoryEngine.js), so a stored score always follows the rules whatever the client sent.
import fs from 'node:fs';
import vm from 'node:vm';
import pool from '../config/db.js';
import { withStatus } from './flows.js';
import { isFeatureEnabled } from './features.js';

const sandbox = { self: {} };
for (const f of ['notation.js', 'theoryEngine.js', 'drills.js', 'rhythm.js']) {
  vm.runInNewContext(fs.readFileSync(new URL(`../../public/${f}`, import.meta.url), 'utf8'), sandbox);
}
const Drills = sandbox.self.Drills;
const Rhythm = sandbox.self.Rhythm; // ML-306: the Rhythm tool's rounds are drill rounds too
const plain = (v) => JSON.parse(JSON.stringify(v));

const FEATURE = { tapTempo: 'tap_tempo', gapTrainer: 'gap_trainer', ear: 'ear_training', rhythm: 'rhythm_trainer' };
const HISTORY_LENGTH = 8;
const MAX_DETAILS_BYTES = 20000;

export async function assertDrillEnabled(tool) {
  if (!FEATURE[tool]) throw withStatus(400, 'Unknown drill.');
  if (!(await isFeatureEnabled(FEATURE[tool]))) throw withStatus(403, "This feature isn't available right now.");
}

function toDto(row) {
  return {
    id: Number(row.id),
    tool: row.tool,
    level: row.level,
    score: row.score,
    grade: row.grade,
    durationMs: row.duration_ms,
    startedAt: row.started_at
  };
}

async function historyFor(client, accountId, tool, level) {
  const [recent, best] = await Promise.all([
    client.query(
      `SELECT * FROM drill_attempts WHERE account_id = $1 AND tool = $2 AND level = $3
       ORDER BY started_at DESC, id DESC LIMIT ${HISTORY_LENGTH}`,
      [accountId, tool, level]
    ),
    client.query(
      `SELECT * FROM drill_attempts WHERE account_id = $1 AND tool = $2 AND level = $3
       ORDER BY score DESC, started_at ASC LIMIT 1`,
      [accountId, tool, level]
    )
  ]);
  return { recent: recent.rows.map(toDto).reverse(), best: best.rows[0] ? toDto(best.rows[0]) : null };
}

export async function getDrillHistory(accountId, tool, level) {
  if (typeof level !== 'string' || !level || level.length > 60) throw withStatus(400, 'Missing level.');
  return historyFor(pool, accountId, tool, level);
}

// A tool's levels: each one's last round and best score (for "New" pills and the level list).
export async function getDrillSummary(accountId, tool) {
  const { rows } = await pool.query(
    `SELECT level, MAX(score) AS best, COUNT(*)::int AS rounds,
            (ARRAY_AGG(grade ORDER BY started_at DESC, id DESC))[1] AS last_grade,
            MAX(started_at) AS last_at
     FROM drill_attempts WHERE account_id = $1 AND tool = $2 GROUP BY level`,
    [accountId, tool]
  );
  const levels = {};
  for (const r of rows) levels[r.level] = { best: Number(r.best), rounds: r.rounds, lastGrade: r.last_grade, lastAt: r.last_at };
  return { levels };
}

// body: { tool, level, startedAt, durationMs, details }. Re-scored here; returns the saved round, the
// score breakdown, and the level's history (with whether this was a new best).
export async function saveDrillAttempt(accountId, body) {
  const { tool, level, startedAt, durationMs, details } = body || {};
  if (!FEATURE[tool]) throw withStatus(400, 'Unknown drill.');
  const started = new Date(startedAt);
  if (Number.isNaN(started.getTime())) throw withStatus(400, 'Missing startedAt.');
  if (details === undefined || JSON.stringify(details).length > MAX_DETAILS_BYTES) throw withStatus(400, 'Bad details.');
  let result;
  try {
    result = plain(tool === 'rhythm' ? Rhythm.scoreRound(level, plain(details)) : Drills.scoreRound(tool, level, plain(details)));
  } catch (e) {
    throw withStatus(400, e.message || 'Bad round.');
  }
  const client = await pool.connect();
  try {
    const before = await client.query(
      'SELECT MAX(score) AS best FROM drill_attempts WHERE account_id = $1 AND tool = $2 AND level = $3',
      [accountId, tool, level]
    );
    const prevBest = before.rows[0].best === null ? null : Number(before.rows[0].best);
    const { rows } = await client.query(
      `INSERT INTO drill_attempts (account_id, tool, level, score, grade, details, duration_ms, started_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [accountId, tool, level, result.score, result.grade, JSON.stringify(details),
        Number.isFinite(durationMs) && durationMs >= 0 ? Math.round(durationMs) : null, started.toISOString()]
    );
    const history = await historyFor(client, accountId, tool, level);
    const rhythmLevels = tool === 'rhythm' ? await raiseRhythmLevels(client, accountId, plain(Rhythm.levelsFromRound(level, plain(details), result))) : undefined;
    return { attempt: toDto(rows[0]), result, previousBest: prevBest, newBest: prevBest === null || result.score > prevBest, ...history, rhythmLevels };
  } finally {
    client.release();
  }
}

// ---- ML-306: each rhythm's speed Level (never goes down) and the player's own word for it.
// earned: [{ pattern, level }] from Rhythm.levelsFromRound. Returns the rhythms whose Level went up.
async function raiseRhythmLevels(client, accountId, earned) {
  const up = [];
  for (const e of earned.filter(x => x.level > 0)) {
    const { rows } = await client.query(
      `INSERT INTO rhythm_pattern_levels (account_id, pattern_id, level) VALUES ($1, $2, $3)
       ON CONFLICT (account_id, pattern_id) DO UPDATE SET level = GREATEST(rhythm_pattern_levels.level, EXCLUDED.level), updated_at = now()
       RETURNING level`,
      [accountId, e.pattern, e.level]
    );
    up.push({ pattern: e.pattern, level: rows[0].level });
  }
  return up;
}

export async function getRhythmLevels(accountId) {
  const { rows } = await pool.query('SELECT pattern_id, level, word FROM rhythm_pattern_levels WHERE account_id = $1', [accountId]);
  const patterns = {};
  for (const r of rows) patterns[r.pattern_id] = { level: r.level, word: r.word };
  return { patterns };
}

export async function setRhythmWord(accountId, patternId, word) {
  try { Rhythm.pattern(patternId); } catch (e) { throw withStatus(400, 'Unknown rhythm.'); }
  const w = word === null || word === undefined ? '' : String(word).trim();
  if (w.length > 40) throw withStatus(400, 'Keep your word to 40 letters.');
  await pool.query(
    `INSERT INTO rhythm_pattern_levels (account_id, pattern_id, word) VALUES ($1, $2, $3)
     ON CONFLICT (account_id, pattern_id) DO UPDATE SET word = EXCLUDED.word, updated_at = now()`,
    [accountId, patternId, w || null]
  );
  return getRhythmLevels(accountId);
}
