// Time signature picker data for the multi-bar metronome (ML-35). Public
// catalog (time_signature_options, migration-seeded, never written to by the
// app) plus each account's own private custom signatures
// (account_time_signatures). See db/migrations/017_multibar_metronome.sql,
// db/migrations/019_timesig_extras.sql, and docs/database-schema.md for why
// these are two tables, not one, and how archiving works.

import pool from '../config/db.js';
import { withStatus } from './metronomeSetups.js';

// Only active custom signatures - this is what populates the "pick a signature
// for a block" grid. An archived one stays valid for whatever already
// references it (see getAdhocSetupWithSegments's own join, unaffected by this
// filter) but isn't offered for a new block. For the full list including
// archived ones, see listCustomTimeSignaturesWithUsage.
export async function listTimeSignatureOptions(accountId) {
  const [publicResult, customResult] = await Promise.all([
    pool.query(
      'SELECT id, numerator, denominator, label FROM time_signature_options WHERE active = true ORDER BY sort_order'
    ),
    pool.query(
      'SELECT id, numerator, denominator FROM account_time_signatures WHERE account_id = $1 AND active = true ORDER BY numerator, denominator',
      [accountId]
    )
  ]);

  return {
    public: publicResult.rows.map(r => ({ id: Number(r.id), numerator: r.numerator, denominator: r.denominator, label: r.label })),
    custom: customResult.rows.map(r => ({ id: Number(r.id), numerator: r.numerator, denominator: r.denominator, label: `${r.numerator}/${r.denominator}` }))
  };
}

// Idempotent given account_time_signatures' UNIQUE (account_id, numerator, denominator) -
// re-adding one that was archived reactivates it instead of leaving a second,
// unreachable-from-the-picker copy.
export async function createCustomTimeSignature(accountId, numerator, denominator) {
  const existing = await pool.query(
    'SELECT id, active FROM account_time_signatures WHERE account_id = $1 AND numerator = $2 AND denominator = $3',
    [accountId, numerator, denominator]
  );
  if (existing.rows.length) {
    const row = existing.rows[0];
    if (!row.active) await pool.query('UPDATE account_time_signatures SET active = true WHERE id = $1', [row.id]);
    return { id: Number(row.id), numerator, denominator };
  }

  const inserted = await pool.query(
    'INSERT INTO account_time_signatures (account_id, numerator, denominator) VALUES ($1, $2, $3) RETURNING id',
    [accountId, numerator, denominator]
  );
  return { id: Number(inserted.rows[0].id), numerator, denominator };
}

// Every custom signature the account has ever added, active or archived, with
// how many blocks (across every setup) actually reference it - what drives
// the picker's "Your custom time signatures" management list.
export async function listCustomTimeSignaturesWithUsage(accountId) {
  const { rows } = await pool.query(
    `SELECT ats.id, ats.numerator, ats.denominator, ats.active, COUNT(ms.id) AS usage_count
     FROM account_time_signatures ats
     LEFT JOIN metronome_segments ms ON ms.account_time_signature_id = ats.id
     WHERE ats.account_id = $1
     GROUP BY ats.id
     ORDER BY ats.numerator, ats.denominator`,
    [accountId]
  );
  return rows.map(r => ({
    id: Number(r.id),
    numerator: r.numerator,
    denominator: r.denominator,
    label: `${r.numerator}/${r.denominator}`,
    active: r.active,
    usageCount: Number(r.usage_count)
  }));
}

export async function setCustomTimeSignatureActive(accountId, id, active) {
  const result = await pool.query(
    'UPDATE account_time_signatures SET active = $1 WHERE id = $2 AND account_id = $3',
    [active, id, accountId]
  );
  if (result.rowCount === 0) throw withStatus(404, 'Time signature not found');
}

// Only ever allowed once nothing references it - archive it instead otherwise
// (setCustomTimeSignatureActive with active=false).
export async function deleteCustomTimeSignature(accountId, id) {
  const usage = await pool.query(
    `SELECT COUNT(*) AS c FROM metronome_segments ms
     JOIN account_time_signatures ats ON ats.id = ms.account_time_signature_id
     WHERE ats.id = $1 AND ats.account_id = $2`,
    [id, accountId]
  );
  if (Number(usage.rows[0].c) > 0) throw withStatus(400, 'This time signature is still used by some blocks - archive it instead.');

  const result = await pool.query('DELETE FROM account_time_signatures WHERE id = $1 AND account_id = $2', [id, accountId]);
  if (result.rowCount === 0) throw withStatus(404, 'Time signature not found');
}

// ---- Admin panel (ML-109) - the public catalog (time_signature_options), usage counted across
// every account's blocks, not just one account's own (unlike listCustomTimeSignaturesWithUsage
// above, which is deliberately scoped to the account making the request). ----

export async function listTimeSignatureOptionsForAdmin() {
  const { rows } = await pool.query(
    `SELECT tso.id, tso.numerator, tso.denominator, tso.label, tso.sort_order, tso.active,
            COUNT(ms.id) AS usage_count
     FROM time_signature_options tso
     LEFT JOIN metronome_segments ms ON ms.time_signature_id = tso.id
     GROUP BY tso.id
     ORDER BY tso.sort_order`
  );
  return rows.map(r => ({
    id: Number(r.id), numerator: r.numerator, denominator: r.denominator, label: r.label,
    sortOrder: r.sort_order, active: r.active, usageCount: Number(r.usage_count)
  }));
}

export async function createTimeSignatureOption(numerator, denominator, label) {
  const n = Number(numerator), d = Number(denominator);
  if (!Number.isInteger(n) || n <= 0 || !Number.isInteger(d) || d <= 0) {
    throw withStatus(400, 'Numerator and denominator must both be whole numbers greater than 0.');
  }
  try {
    const maxOrder = await pool.query('SELECT COALESCE(MAX(sort_order), 0) AS max FROM time_signature_options');
    const { rows } = await pool.query(
      `INSERT INTO time_signature_options (numerator, denominator, label, sort_order)
       VALUES ($1, $2, $3, $4) RETURNING id`,
      [n, d, label || `${n}/${d}`, Number(maxOrder.rows[0].max) + 1]
    );
    return { id: Number(rows[0].id) };
  } catch (error) {
    if (error.code === '23505') throw withStatus(409, `${n}/${d} is already in the list.`);
    throw error;
  }
}

export async function updateTimeSignatureOption(id, { numerator, denominator, label, sortOrder, active }) {
  const n = Number(numerator), d = Number(denominator);
  if (!Number.isInteger(n) || n <= 0 || !Number.isInteger(d) || d <= 0) {
    throw withStatus(400, 'Numerator and denominator must both be whole numbers greater than 0.');
  }
  try {
    const { rows } = await pool.query(
      `UPDATE time_signature_options SET numerator = $1, denominator = $2, label = $3, sort_order = $4, active = $5
       WHERE id = $6 RETURNING id`,
      [n, d, label || `${n}/${d}`, Number(sortOrder) || 0, !!active, id]
    );
    if (!rows.length) throw withStatus(404, 'Time signature not found');
  } catch (error) {
    if (error.code === '23505') throw withStatus(409, `${n}/${d} is already in the list.`);
    throw error;
  }
}

// Archived rather than deleted outright if any block anywhere still references it - same
// archive-if-used pattern as the rest of the app (archiveOrDeleteBand, deleteOrArchiveBandAdmin).
export async function deleteOrArchiveTimeSignatureOption(id) {
  const usage = await pool.query('SELECT COUNT(*) AS c FROM metronome_segments WHERE time_signature_id = $1', [id]);
  const inUse = Number(usage.rows[0].c) > 0;
  if (inUse) {
    await pool.query('UPDATE time_signature_options SET active = false WHERE id = $1', [id]);
  } else {
    const result = await pool.query('DELETE FROM time_signature_options WHERE id = $1', [id]);
    if (result.rowCount === 0) throw withStatus(404, 'Time signature not found');
  }
  return inUse;
}

// ---- Note values (ML-109) - read-only: metronome_segments.note_value is a fixed 5-value CHECK
// constraint (db/migrations/023_segment_note_value.sql), not a separate table, so there's nothing to
// add/edit/delete here - just the ticket's own "identify usage" ask, one row per known value
// (including ones with zero current usage) rather than only values that happen to appear already. ----

const NOTE_VALUE_LABELS = [
  ['quaver', 'Quaver'],
  ['crotchet', 'Crotchet'],
  ['dotted-crotchet', 'Dotted crotchet'],
  ['minim', 'Minim'],
  ['semibreve', 'Semibreve']
];

export async function listNoteValueUsage() {
  const { rows } = await pool.query(
    `SELECT note_value, COUNT(*) AS usage_count FROM metronome_segments
     WHERE note_value IS NOT NULL GROUP BY note_value`
  );
  const counts = new Map(rows.map(r => [r.note_value, Number(r.usage_count)]));
  return NOTE_VALUE_LABELS.map(([value, label]) => ({ value, label, usageCount: counts.get(value) || 0 }));
}
