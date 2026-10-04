// ML-391: Scales Levels - each scale's Level (1-5, then learnt) for an account on an instrument, and
// every answer. What the Levels mean, which scales a block takes and what an answer does are
// PracticePlan.scale* (public/practicePlan.js), loaded here with vm like restMessages.js, so the server,
// the browser and the tests run the same rules. See db/migrations/096_scale_levels.sql.
import fs from 'node:fs';
import vm from 'node:vm';
import pool from '../config/db.js';
import { withStatus } from './flows.js';
import { isFeatureEnabled } from './features.js';

const sandbox = { self: {} };
vm.runInNewContext(fs.readFileSync(new URL('../../public/practicePlan.js', import.meta.url), 'utf8'), sandbox);
const PracticePlan = sandbox.self.PracticePlan;

// kind|key|form|octaves|pattern (PracticePlan.scaleKey) - a pattern can carry printed notes ("extended:D4:F#5:F#3")
const KEY = /^[a-z0-9]+\|[A-G][#♯b♭]? (major|minor)\|[a-z]+\|[0-9.]+\|[A-Za-z0-9:#♯b♭]*$/;
const DAY = /^\d{4}-\d{2}-\d{2}$/;

export async function assertScaleLevelsEnabled() {
  if (!(await isFeatureEnabled('scales_levels'))) throw withStatus(403, "This feature isn't available right now.");
}

function toRecord(r) {
  return {
    level: Number(r.level),
    learnt: !!r.learnt_at,
    lastPlayed: r.last_played_at ? new Date(r.last_played_at).toISOString() : null,
    lastUpOn: r.last_up_on || null
  };
}
function cleanKey(key) {
  const k = String(key ?? '');
  if (k.length > 120 || !KEY.test(k)) throw withStatus(400, 'Unknown scale.');
  return k;
}
// The instrument must be one of the account's own (My instruments).
async function cleanInstrument(accountId, instrumentId) {
  const id = Number(instrumentId);
  if (!Number.isInteger(id) || id <= 0) throw withStatus(400, 'Choose an instrument first.');
  const { rows } = await pool.query('SELECT 1 FROM account_instruments WHERE account_id = $1 AND instrument_id = $2', [accountId, id]);
  if (!rows.length) throw withStatus(400, 'That instrument is not one of yours.');
  return id;
}

// { records: { scaleKey: { level, learnt, lastPlayed, lastUpOn } } } - a scale with no record is at Level 1.
export async function getScaleLevels(accountId, instrumentId) {
  const id = await cleanInstrument(accountId, instrumentId);
  const { rows } = await pool.query(
    `SELECT scale_key, level, learnt_at, last_played_at, to_char(last_up_on, 'YYYY-MM-DD') AS last_up_on
       FROM scale_levels WHERE account_id = $1 AND instrument_id = $2`, [accountId, id]);
  return { instrumentId: id, records: Object.fromEntries(rows.map(r => [r.scale_key, toRecord(r)])) };
}

async function readRecord(client, accountId, instrumentId, key) {
  const { rows } = await client.query(
    `SELECT level, learnt_at, last_played_at, to_char(last_up_on, 'YYYY-MM-DD') AS last_up_on
       FROM scale_levels WHERE account_id = $1 AND instrument_id = $2 AND scale_key = $3 FOR UPDATE`, [accountId, instrumentId, key]);
  return rows.length ? toRecord(rows[0]) : null;
}
async function writeRecord(client, accountId, instrumentId, key, rec) {
  await client.query(
    `INSERT INTO scale_levels (account_id, instrument_id, scale_key, level, learnt_at, last_played_at, last_up_on)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (account_id, instrument_id, scale_key)
     DO UPDATE SET level = EXCLUDED.level, learnt_at = EXCLUDED.learnt_at, last_played_at = EXCLUDED.last_played_at,
                   last_up_on = EXCLUDED.last_up_on, updated_at = now()`,
    [accountId, instrumentId, key, rec.level, rec.learnt ? (rec.learntAt || new Date().toISOString()) : null, rec.lastPlayed, rec.lastUpOn]);
}

// Got it / Not yet for one scale. today is the player's own day ('YYYY-MM-DD') - "one Level up a day"
// goes by their calendar, not the server's. Returns { record, outcome } (PracticePlan.scaleAnswer).
export async function answerScale(accountId, { instrumentId, key, gotIt, today } = {}) {
  const id = await cleanInstrument(accountId, instrumentId);
  const k = cleanKey(key);
  if (typeof gotIt !== 'boolean') throw withStatus(400, 'Got it, or not yet?');
  const day = DAY.test(String(today || '')) ? String(today) : new Date().toISOString().slice(0, 10);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const before = await readRecord(client, accountId, id, k);
    const { record, outcome } = PracticePlan.scaleAnswer(before, gotIt, day, new Date().toISOString());
    await writeRecord(client, accountId, id, k, record);
    await client.query(
      `INSERT INTO scale_level_results (account_id, instrument_id, scale_key, level, got_it, outcome, level_after) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [accountId, id, k, before ? before.level : 1, gotIt, outcome, record.level]);
    await client.query('COMMIT');
    return { key: k, record: { level: record.level, learnt: !!record.learnt, lastPlayed: record.lastPlayed, lastUpOn: record.lastUpOn }, outcome };
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

// A Level set by hand (you know this one already, or it has got too hard). It isn't learnt any more, and
// it can still go up today.
export async function setScaleLevel(accountId, { instrumentId, key, level } = {}) {
  const id = await cleanInstrument(accountId, instrumentId);
  const k = cleanKey(key);
  const lv = Number(level);
  if (!Number.isInteger(lv) || lv < 1 || lv > PracticePlan.SCALE_TOP_LEVEL) throw withStatus(400, 'A Level is 1 to 5.');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const before = await readRecord(client, accountId, id, k);
    const record = { level: lv, learnt: false, lastPlayed: before ? before.lastPlayed : null, lastUpOn: null };
    await writeRecord(client, accountId, id, k, record);
    await client.query(
      `INSERT INTO scale_level_results (account_id, instrument_id, scale_key, level, got_it, outcome, level_after) VALUES ($1, $2, $3, $4, NULL, 'set', $5)`,
      [accountId, id, k, before ? before.level : 1, lv]);
    await client.query('COMMIT');
    return { key: k, record, outcome: 'set' };
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}
