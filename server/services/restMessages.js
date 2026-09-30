// ML-390: the 30-second rest between practice blocks shows one message - why we stop, a breathing
// exercise, loosening up, thinking like a musician, a fact, looking after yourself, or kind words. The
// messages live in rest_messages (087_stepped_sessions.sql) so a super admin can change them on
// Admin -> Rest messages without a release. Each player draws from their own shuffled deck
// (account_rest_decks), so every message is shown once before any comes round again; the rules are
// PracticePlan.drawRest (public/practicePlan.js), loaded here with vm like practiceLevels.js loads
// FlowJourney, so the server and the tests run the same code.
import fs from 'node:fs';
import vm from 'node:vm';
import pool from '../config/db.js';
import { withStatus } from './flows.js';

const sandbox = { self: {} };
vm.runInNewContext(fs.readFileSync(new URL('../../public/practicePlan.js', import.meta.url), 'utf8'), sandbox);
const PracticePlan = sandbox.self.PracticePlan;

export const REST_KINDS = ['why', 'breathe', 'body', 'think', 'fact', 'care', 'kind'];
export const REST_AUDIENCES = ['all', 'brass', 'wind'];

function toMessage(r) {
  return {
    id: Number(r.id), kind: r.kind, icon: r.icon, title: r.title, body: r.body, audience: r.audience,
    active: r.active, sortOrder: r.sort_order, updatedAt: r.updated_at,
  };
}

// Who a message is for, from the player's instruments: lip messages ('brass') go to brass players, breath
// and air ones ('wind') to brass and woodwind players. With no instruments set, everything (most players
// here are in a band).
async function audiencesFor(accountId, client = pool) {
  const { rows } = await client.query(
    `SELECT DISTINCT i.family FROM account_instruments ai JOIN instruments i ON i.id = ai.instrument_id WHERE ai.account_id = $1`,
    [accountId]);
  if (!rows.length) return REST_AUDIENCES;
  const fam = new Set(rows.map(r => r.family));
  const out = ['all'];
  if (fam.has('Brass')) out.push('brass');
  if (fam.has('Brass') || fam.has('Woodwind')) out.push('wind');
  return out;
}

// The next message for this player's rest, drawn from their deck (and the deck saved for next time).
// Returns { message } - null when there are no messages switched on.
export async function nextRestMessage(accountId) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const audiences = await audiencesFor(accountId, client);
    const { rows } = await client.query(
      'SELECT * FROM rest_messages WHERE active AND audience = ANY($1::text[]) ORDER BY sort_order, id', [audiences]);
    if (!rows.length) { await client.query('ROLLBACK'); return { message: null }; }
    const { rows: deckRows } = await client.query('SELECT * FROM account_rest_decks WHERE account_id = $1 FOR UPDATE', [accountId]);
    const deck = deckRows.length
      ? { remaining: deckRows[0].remaining.map(Number), lastKind: deckRows[0].last_kind, sinceBreath: Number(deckRows[0].since_breath) }
      : null;
    const drawn = PracticePlan.drawRest(rows.map(r => ({ id: Number(r.id), kind: r.kind })), deck);
    const next = drawn.deck;
    await client.query(
      `INSERT INTO account_rest_decks (account_id, remaining, last_kind, since_breath, updated_at)
       VALUES ($1, $2::bigint[], $3, $4, now())
       ON CONFLICT (account_id) DO UPDATE SET remaining = EXCLUDED.remaining, last_kind = EXCLUDED.last_kind,
         since_breath = EXCLUDED.since_breath, updated_at = now()`,
      [accountId, Array.from(next.remaining), next.lastKind, Math.min(32767, next.sinceBreath)]);
    await client.query('COMMIT');
    const picked = rows.find(r => Number(r.id) === drawn.id);
    return { message: picked ? toMessage(picked) : null };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

// ---- Admin -> Rest messages (super admins only - server/routes/admin.js) ----
export async function listRestMessages() {
  const { rows } = await pool.query('SELECT * FROM rest_messages ORDER BY sort_order, id');
  return rows.map(toMessage);
}

function validate(data) {
  const kind = String(data.kind || '');
  if (!REST_KINDS.includes(kind)) throw withStatus(400, 'Choose what kind of message it is.');
  const title = String(data.title || '').trim();
  const body = String(data.body || '').trim();
  if (!title || title.length > 80) throw withStatus(400, 'The title is 1-80 characters.');
  if (!body || body.length > 240) throw withStatus(400, 'The words are 1-240 characters - short enough to read in a few seconds.');
  const icon = String(data.icon || '').trim() || 'self_improvement';
  if (!/^[a-z0-9_]{1,40}$/.test(icon)) throw withStatus(400, 'The icon is a Material Symbols name, like self_improvement.');
  const audience = REST_AUDIENCES.includes(data.audience) ? data.audience : 'all';
  return { kind, title, body, icon, audience, active: data.active !== false };
}

export async function createRestMessage(data = {}) {
  const m = validate(data);
  const { rows } = await pool.query(
    `INSERT INTO rest_messages (kind, icon, title, body, audience, active, sort_order)
     VALUES ($1, $2, $3, $4, $5, $6, (SELECT COALESCE(MAX(sort_order), 0) + 10 FROM rest_messages)) RETURNING *`,
    [m.kind, m.icon, m.title, m.body, m.audience, m.active]);
  return toMessage(rows[0]);
}

export async function updateRestMessage(id, data = {}) {
  const m = validate(data);
  const { rows } = await pool.query(
    `UPDATE rest_messages SET kind = $2, icon = $3, title = $4, body = $5, audience = $6, active = $7, updated_at = now()
     WHERE id = $1 RETURNING *`,
    [id, m.kind, m.icon, m.title, m.body, m.audience, m.active]);
  if (!rows.length) throw withStatus(404, 'Message not found');
  return toMessage(rows[0]);
}

export async function setRestMessageActive(id, active) {
  const { rows } = await pool.query('UPDATE rest_messages SET active = $2, updated_at = now() WHERE id = $1 RETURNING *', [id, !!active]);
  if (!rows.length) throw withStatus(404, 'Message not found');
  return toMessage(rows[0]);
}

export async function deleteRestMessage(id) {
  const { rowCount } = await pool.query('DELETE FROM rest_messages WHERE id = $1', [id]);
  if (!rowCount) throw withStatus(404, 'Message not found');
  return { deleted: true };
}

// One place earlier (-1) or later (+1) in the list (only the admin list's order - players get a shuffle).
export async function moveRestMessage(id, dir) {
  const list = await listRestMessages();
  const i = list.findIndex(m => m.id === Number(id));
  if (i < 0) throw withStatus(404, 'Message not found');
  const j = i + (Number(dir) < 0 ? -1 : 1);
  if (j < 0 || j >= list.length) return list;
  [list[i], list[j]] = [list[j], list[i]];
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (let k = 0; k < list.length; k++) await client.query('UPDATE rest_messages SET sort_order = $2 WHERE id = $1', [list[k].id, (k + 1) * 10]);
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
  return listRestMessages();
}
