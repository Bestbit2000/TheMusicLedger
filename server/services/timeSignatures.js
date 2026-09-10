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
