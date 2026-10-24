// ML-309: the instrument catalogue (instruments, db/migrations/059_instruments.sql - a meta table
// generated from band_instruments_master_catalog.json), the instruments each account plays
// (account_instruments, at most one main), and which instrument a practice session was on
// (sessions.instrument_id) - so practice time can be measured per instrument.
import pool from '../config/db.js';
import { withStatus } from './flows.js';
import { clefChoices, clefView, toMine } from './instrumentClef.js';

// Family order for pickers: brass first (most of the app's users play in brass bands), then the rest. By
// instruments.family_key (ML-609) - `family` is only the words shown.
const FAMILY_ORDER = ['brass', 'woodwind', 'percussion', 'keyboard', 'strings'];

function toInstrumentDto(r) {
  return {
    id: Number(r.id),
    code: r.code,
    name: r.name,
    pitchKey: r.pitch_key,
    transposition: r.sounding_transposition,
    clef: r.clef,
    theoryClef: r.theory_clef,
    family: r.family,
    // ML-609: what the app decides things by - never the words above
    familyKey: r.family_key,
    scaleLists: r.scale_lists || {},
    subfamily: r.subfamily,
    ensembles: r.ensembles || [],
    // ML-322: the instrument's typical written range (the Range tool's outer limit; null = doesn't apply)
    rangeLow: r.range_low || null,
    writtenToConcert: r.written_to_concert,
    rangeHigh: r.range_high || null,
    // ML-528: the clefs the instrument is read in, its own first (one for most; two or three for brass
    // that is a treble-clef part in a brass band and a bass-clef one in a wind band)
    clefChoices: clefChoices(r).map(c => c.clef)
  };
}

// ML-528: an instrument as this player reads it. With their own clef chosen (account_instruments.clef),
// theoryClef and writtenToConcert are that clef's, and every written pitch - the instrument's range and
// theirs - is moved into it, so each tool draws and compares the notes the player actually reads.
// ownClef is the instrument's own.
function toMyInstrumentDto(r) {
  const view = clefView(r, r.my_clef);
  const dto = toInstrumentDto(r);
  return {
    ...dto,
    theoryClef: view.clef,
    ownClef: r.theory_clef,
    writtenToConcert: view.writtenToConcert,
    rangeLow: toMine(view, dto.rangeLow),
    rangeHigh: toMine(view, dto.rangeHigh),
    isPrimary: r.is_primary,
    // bottomNote / topNote (ML-322): the notes this player can play comfortably now, or null.
    bottomNote: toMine(view, r.bottom_note),
    topNote: toMine(view, r.top_note)
  };
}

// ML-331: A-Z inside each family, by the instrument itself - the key in front ("B♭ ", "E♭ / D ",
// "EE♭ ") is left out of the sort, so B♭ Cornet sits under C and Soprano Cornet under S.
const KEY_PREFIX = /^[A-G]{1,2}[♭♯]?(?:\s*\/\s*[A-G]{1,2}[♭♯]?)*\s+(?=[A-Z])/u;
export function instrumentSortName(name) {
  return String(name || '').replace(KEY_PREFIX, '');
}
export function compareInstruments(a, b) {
  const fam = (f) => { const i = FAMILY_ORDER.indexOf(f); return i === -1 ? FAMILY_ORDER.length : i; };
  return fam(a.familyKey) - fam(b.familyKey)
    || String(a.familyKey || '').localeCompare(String(b.familyKey || ''))
    || instrumentSortName(a.name).localeCompare(instrumentSortName(b.name), 'en', { sensitivity: 'base' })
    || String(a.name).localeCompare(String(b.name), 'en');
}

export async function listInstruments() {
  const { rows } = await pool.query('SELECT * FROM instruments WHERE active');
  return rows.map(toInstrumentDto).sort(compareInstruments);
}

// The account's instruments, main one first.
export async function listAccountInstruments(accountId) {
  const { rows } = await pool.query(
    `SELECT i.*, ai.is_primary, ai.bottom_note, ai.top_note, ai.clef AS my_clef FROM account_instruments ai JOIN instruments i ON i.id = ai.instrument_id
     WHERE ai.account_id = $1 ORDER BY ai.is_primary DESC, ai.created_at, i.name`,
    [accountId]
  );
  return rows.map(toMyInstrumentDto);
}

// ML-528: the clef this player reads one of their instruments in. It has to be one the instrument is
// read in; choosing its own clef clears the choice.
export async function setAccountInstrumentClef(accountId, instrumentId, clef) {
  const { rows } = await pool.query(
    `SELECT i.* FROM account_instruments ai JOIN instruments i ON i.id = ai.instrument_id WHERE ai.account_id = $1 AND ai.instrument_id = $2`,
    [accountId, instrumentId]
  );
  if (!rows.length) throw withStatus(404, 'You don\'t play that instrument - add it in My instruments first.');
  const choices = clefChoices(rows[0]);
  if (!choices.some(c => c.clef === clef)) throw withStatus(400, `${rows[0].name} isn't read in that clef.`);
  await pool.query('UPDATE account_instruments SET clef = $3 WHERE account_id = $1 AND instrument_id = $2', [accountId, instrumentId, clef === choices[0].clef ? null : clef]);
  return listAccountInstruments(accountId);
}

// Replaces the whole list. primaryId must be one of them; with none given, the first becomes main.
export async function setAccountInstruments(accountId, instrumentIds, primaryId) {
  const ids = [...new Set((instrumentIds || []).map(Number).filter(Number.isInteger))];
  if (ids.length > 20) throw withStatus(400, 'Choose up to 20 instruments.');
  const main = ids.length ? (ids.includes(Number(primaryId)) ? Number(primaryId) : ids[0]) : null;
  if (ids.length) {
    const { rows } = await pool.query('SELECT id FROM instruments WHERE id = ANY($1::bigint[]) AND active', [ids]);
    if (rows.length !== ids.length) throw withStatus(400, 'Unknown instrument.');
  }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('DELETE FROM account_instruments WHERE account_id = $1 AND NOT (instrument_id = ANY($2::bigint[]))', [accountId, ids]);
    await client.query('UPDATE account_instruments SET is_primary = false WHERE account_id = $1', [accountId]);
    for (const id of ids) {
      await client.query(
        `INSERT INTO account_instruments (account_id, instrument_id, is_primary) VALUES ($1, $2, $3)
         ON CONFLICT (account_id, instrument_id) DO UPDATE SET is_primary = EXCLUDED.is_primary`,
        [accountId, id, id === main]
      );
    }
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
  return listAccountInstruments(accountId);
}

// The instrument a new/edited session is recorded against: the one asked for if the account plays it,
// otherwise the account's main instrument, otherwise none.
export async function resolveSessionInstrument(accountId, requestedId) {
  const { rows } = await pool.query(
    `SELECT instrument_id, is_primary FROM account_instruments WHERE account_id = $1`,
    [accountId]
  );
  const wanted = rows.find(r => Number(r.instrument_id) === Number(requestedId));
  if (wanted) return Number(wanted.instrument_id);
  const main = rows.find(r => r.is_primary);
  return main ? Number(main.instrument_id) : null;
}

// Admin -> Usage: practice by instrument. Only instruments someone plays or has logged time on.
export async function getInstrumentUsageStats() {
  const { rows } = await pool.query(
    `SELECT i.id, i.name, i.family,
            (SELECT COUNT(*) FROM account_instruments ai WHERE ai.instrument_id = i.id) AS players,
            (SELECT COUNT(*) FROM account_instruments ai WHERE ai.instrument_id = i.id AND ai.is_primary) AS main_players,
            COUNT(s.id) AS sessions,
            COALESCE(SUM(s.total_duration_minutes), 0) AS minutes
     FROM instruments i
     LEFT JOIN sessions s ON s.instrument_id = i.id
     GROUP BY i.id
     HAVING COUNT(s.id) > 0 OR EXISTS (SELECT 1 FROM account_instruments ai WHERE ai.instrument_id = i.id)
     ORDER BY minutes DESC, players DESC, i.name`
  );
  const { rows: totals } = await pool.query(
    `SELECT COUNT(*) FILTER (WHERE instrument_id IS NULL) AS untagged_sessions,
            COALESCE(SUM(total_duration_minutes) FILTER (WHERE instrument_id IS NULL), 0) AS untagged_minutes,
            (SELECT COUNT(DISTINCT account_id) FROM account_instruments) AS accounts_with_instruments,
            (SELECT COUNT(*) FROM accounts) AS accounts
     FROM sessions`
  );
  const t = totals[0];
  return {
    instruments: rows.map(r => ({
      id: Number(r.id), name: r.name, family: r.family, players: Number(r.players), mainPlayers: Number(r.main_players),
      sessions: Number(r.sessions), minutes: Number(r.minutes)
    })),
    untaggedSessions: Number(t.untagged_sessions),
    untaggedMinutes: Number(t.untagged_minutes),
    accountsWithInstruments: Number(t.accounts_with_instruments),
    accounts: Number(t.accounts)
  };
}
