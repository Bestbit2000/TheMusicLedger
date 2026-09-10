// Ad-hoc (standalone) multi-bar metronome setups (Jira ML-35). Score-attached
// blocks are out of scope for this release - see docs/database-schema.md
// "Scores & metronome segments (Jira ML-35)".

import pool from '../config/db.js';

export function withStatus(status, message) {
  const err = new Error(message);
  err.status = status;
  return err;
}

export async function assertSetupOwnership(accountId, setupId) {
  const { rows } = await pool.query(
    'SELECT id FROM adhoc_metronome_setups WHERE id = $1 AND account_id = $2',
    [setupId, accountId]
  );
  if (!rows.length) throw withStatus(404, 'Setup not found');
}

// Only setups the user has explicitly kept ("Save for later") - scratch
// copies (saved_at still NULL) stay out of this list entirely.
// totalSeconds is one pass through the sequence (lead-in once, then every loop block once) -
// derivable from bar count/pickup beats, bpm and the time signature's numerator alone, so it's
// computed here rather than stored anywhere. A lead-in's own bpm/time-signature columns are
// vestigial (see metroBlkEffectiveBlock client-side) - its real bpm/numerator always come from the
// setup's first non-lead-in segment, hence the lateral join below instead of reading ms.bpm/
// ms.numerator directly for that one row.
export async function listAdhocSetups(accountId) {
  const { rows } = await pool.query(
    `SELECT s.id, s.name, s.created_at, s.saved_at,
            COUNT(ms.id) FILTER (WHERE NOT ms.is_lead_in) AS block_count,
            COUNT(ms.id) FILTER (WHERE ms.is_lead_in) > 0 AS has_lead_in,
            COALESCE(SUM(
              CASE WHEN ms.is_lead_in AND ms.pickup_beats IS NOT NULL THEN ms.pickup_beats * 60.0 / fr.bpm
                   WHEN ms.is_lead_in THEN ms.bar_count * fr.numerator * 60.0 / fr.bpm
                   WHEN ms.pickup_beats IS NOT NULL THEN ms.pickup_beats * 60.0 / ms.bpm
                   ELSE ms.bar_count * COALESCE(tso.numerator, ats.numerator) * 60.0 / ms.bpm END
            ), 0) AS total_seconds
     FROM adhoc_metronome_setups s
     LEFT JOIN metronome_segments ms ON ms.parent_adhoc_setup_id = s.id
     LEFT JOIN time_signature_options tso ON tso.id = ms.time_signature_id
     LEFT JOIN account_time_signatures ats ON ats.id = ms.account_time_signature_id
     LEFT JOIN LATERAL (
       SELECT fr.bpm, COALESCE(ftso.numerator, fats.numerator) AS numerator
       FROM metronome_segments fr
       LEFT JOIN time_signature_options ftso ON ftso.id = fr.time_signature_id
       LEFT JOIN account_time_signatures fats ON fats.id = fr.account_time_signature_id
       WHERE fr.parent_adhoc_setup_id = s.id AND fr.is_lead_in = false
       ORDER BY fr.order_index LIMIT 1
     ) fr ON true
     WHERE s.account_id = $1 AND s.saved_at IS NOT NULL
     GROUP BY s.id
     ORDER BY s.saved_at DESC`,
    [accountId]
  );
  return rows.map(r => ({
    id: Number(r.id),
    name: r.name,
    createdAt: r.created_at,
    savedAt: r.saved_at,
    blockCount: Number(r.block_count),
    hasLeadIn: r.has_lead_in,
    totalSeconds: Number(r.total_seconds)
  }));
}

// No name required - a setup starts as an unnamed scratch copy (saved_at
// NULL) so the user can start playing immediately; naming only happens via
// saveAdhocSetup below, when they actually want to keep it.
export async function createAdhocSetup(accountId, name) {
  const effectiveName = (name && name.trim()) || 'Untitled setup';
  const inserted = await pool.query(
    'INSERT INTO adhoc_metronome_setups (account_id, name) VALUES ($1, $2) RETURNING id, created_at',
    [accountId, effectiveName]
  );
  return { id: Number(inserted.rows[0].id), name: effectiveName, createdAt: inserted.rows[0].created_at, savedAt: null, blockCount: 0 };
}

// Renames an already-saved setup - does not touch saved_at. For a scratch
// setup's first save, use saveAdhocSetup instead.
export async function renameAdhocSetup(accountId, id, name) {
  const result = await pool.query(
    'UPDATE adhoc_metronome_setups SET name = $1 WHERE id = $2 AND account_id = $3',
    [name, id, accountId]
  );
  if (result.rowCount === 0) throw withStatus(404, 'Setup not found');
}

// "Save for later" - names a scratch setup and sets saved_at in one step,
// which is what makes it appear in listAdhocSetups from now on.
export async function saveAdhocSetup(accountId, id, name) {
  const result = await pool.query(
    'UPDATE adhoc_metronome_setups SET name = $1, saved_at = now() WHERE id = $2 AND account_id = $3',
    [name, id, accountId]
  );
  if (result.rowCount === 0) throw withStatus(404, 'Setup not found');
}

// Every fresh setup - whether the implicit scratch or a just-named "Add new
// set" - starts with this one block, so the tool is immediately playable
// with zero setup. 4/4 is guaranteed to exist in the system catalog
// (017_multibar_metronome.sql).
async function seedDefaultBlock(setupId) {
  const sig = await pool.query(
    "SELECT id FROM time_signature_options WHERE numerator = 4 AND denominator = 4 AND active = true LIMIT 1"
  );
  await pool.query(
    `INSERT INTO metronome_segments (parent_adhoc_setup_id, order_index, bar_count, bpm, is_lead_in, time_signature_id)
     VALUES ($1, 0, 1, 60, false, $2)`,
    [setupId, sig.rows[0].id]
  );
}

// The builder's landing state whenever no saved setup is selected. Reuses
// whatever scratch is already in progress (an account has at most one -
// nothing else ever writes a saved_at-NULL row) so a tweak made between
// visits isn't silently lost, rather than creating a fresh throwaway row
// on every visit.
export async function getOrCreateScratchSetup(accountId) {
  const { rows } = await pool.query(
    'SELECT id FROM adhoc_metronome_setups WHERE account_id = $1 AND saved_at IS NULL ORDER BY created_at DESC LIMIT 1',
    [accountId]
  );
  if (rows.length) return getAdhocSetupWithSegments(accountId, rows[0].id);

  const created = await createAdhocSetup(accountId, null);
  await seedDefaultBlock(created.id);
  return getAdhocSetupWithSegments(accountId, created.id);
}

// "+ Add new set": names a fresh setup, marks it saved straight away (so it
// shows in the list immediately, unlike a scratch), and seeds it with the
// same default block as the scratch above.
export async function createNamedAdhocSetup(accountId, name) {
  const created = await createAdhocSetup(accountId, name);
  await saveAdhocSetup(accountId, created.id, name);
  await seedDefaultBlock(created.id);
  return getAdhocSetupWithSegments(accountId, created.id);
}

// "Copy this setup" - a new, independently-editable setup seeded with all of the
// source's blocks (lead-in included) rather than the usual single default block,
// so it's a genuine starting point rather than a blank one. Saved immediately,
// same as createNamedAdhocSetup.
export async function duplicateAdhocSetup(accountId, sourceId, name) {
  const source = await getAdhocSetupWithSegments(accountId, sourceId);
  const created = await createAdhocSetup(accountId, name);
  await saveAdhocSetup(accountId, created.id, name);
  for (const seg of source.segments) {
    await pool.query(
      `INSERT INTO metronome_segments
         (parent_adhoc_setup_id, order_index, bar_count, bpm, is_lead_in, pickup_beats, time_signature_id, account_time_signature_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [created.id, seg.orderIndex, seg.barCount, seg.bpm, seg.isLeadIn, seg.pickupBeats,
        seg.timeSignatureId, seg.accountTimeSignatureId]
    );
  }
  return getAdhocSetupWithSegments(accountId, created.id);
}

export async function deleteAdhocSetup(accountId, id) {
  // Segments cascade via metronome_segments.parent_adhoc_setup_id ON DELETE CASCADE.
  const result = await pool.query(
    'DELETE FROM adhoc_metronome_setups WHERE id = $1 AND account_id = $2',
    [id, accountId]
  );
  if (result.rowCount === 0) throw withStatus(404, 'Setup not found');
}

export function toSegmentDto(row) {
  return {
    id: Number(row.id),
    orderIndex: row.order_index,
    barCount: row.bar_count,
    bpm: row.bpm,
    isLeadIn: row.is_lead_in,
    pickupBeats: row.pickup_beats,
    timeSignatureId: row.time_signature_id === null ? null : Number(row.time_signature_id),
    accountTimeSignatureId: row.account_time_signature_id === null ? null : Number(row.account_time_signature_id),
    numerator: row.numerator,
    denominator: row.denominator,
    timeSignatureLabel: row.public_label || `${row.numerator}/${row.denominator}`
  };
}

export async function getAdhocSetupWithSegments(accountId, id) {
  const setupResult = await pool.query(
    'SELECT id, name, created_at, saved_at FROM adhoc_metronome_setups WHERE id = $1 AND account_id = $2',
    [id, accountId]
  );
  if (!setupResult.rows.length) throw withStatus(404, 'Setup not found');

  const { rows } = await pool.query(
    `SELECT ms.id, ms.order_index, ms.bar_count, ms.bpm, ms.is_lead_in, ms.pickup_beats,
            ms.time_signature_id, ms.account_time_signature_id,
            COALESCE(tso.numerator, ats.numerator) AS numerator,
            COALESCE(tso.denominator, ats.denominator) AS denominator,
            tso.label AS public_label
     FROM metronome_segments ms
     LEFT JOIN time_signature_options tso ON tso.id = ms.time_signature_id
     LEFT JOIN account_time_signatures ats ON ats.id = ms.account_time_signature_id
     WHERE ms.parent_adhoc_setup_id = $1
     ORDER BY ms.order_index`,
    [id]
  );

  const setup = setupResult.rows[0];
  return {
    id: Number(setup.id),
    name: setup.name,
    createdAt: setup.created_at,
    savedAt: setup.saved_at,
    segments: rows.map(toSegmentDto)
  };
}
