// Blocks within an ad-hoc multi-bar metronome setup (Jira ML-35). Every
// invariant the DB enforces with a CHECK constraint (017_multibar_metronome.sql)
// is re-validated here first so a violation comes back as a clear 400 instead
// of a raw constraint-violation 500.

import pool from '../config/db.js';
import { withStatus, assertSetupOwnership, toSegmentDto } from './metronomeSetups.js';

// Mirrors the note_value CHECK constraint (023_segment_note_value.sql).
const NOTE_VALUES = ['quaver', 'crotchet', 'dotted-crotchet', 'minim', 'semibreve'];

// Normalizes + validates the fields that make up a segment row. Mirrors the
// DB constraints:
//  - exactly one of timeSignatureId / accountTimeSignatureId
//  - a lead-in with a partial bar (pickupBeats set) is always bar_count = 1 -
//    never combined with a genuine multi-bar count on the same row
//  - a non-lead-in, or a whole-bar lead-in, never carries pickupBeats
//  - noteValue is one of NOTE_VALUES or null
function validateSegmentPayload(data) {
  const isLeadIn = !!data.isLeadIn;
  const hasPublicSig = data.timeSignatureId !== null && data.timeSignatureId !== undefined;
  const hasCustomSig = data.accountTimeSignatureId !== null && data.accountTimeSignatureId !== undefined;

  if (hasPublicSig === hasCustomSig) {
    throw withStatus(400, 'Choose exactly one time signature (public or custom).');
  }

  const bpm = Number(data.bpm);
  if (!Number.isInteger(bpm) || bpm <= 0) throw withStatus(400, 'bpm must be a positive integer.');

  let barCount = Number(data.barCount);
  let pickupBeats = data.pickupBeats === null || data.pickupBeats === undefined ? null : Number(data.pickupBeats);

  if (!isLeadIn && pickupBeats !== null) {
    throw withStatus(400, 'pickupBeats only applies to a lead-in block.');
  }

  if (pickupBeats !== null) {
    if (!Number.isInteger(pickupBeats) || pickupBeats <= 0) throw withStatus(400, 'pickupBeats must be a positive integer.');
    barCount = 1; // a partial-bar lead-in is always exactly one (partial) bar - never combined with a whole-bar count
  } else if (!Number.isInteger(barCount) || barCount < 1) {
    throw withStatus(400, 'barCount must be a positive integer.');
  }

  const quietSecondsBeforeLeadIn = data.quietSecondsBeforeLeadIn === null || data.quietSecondsBeforeLeadIn === undefined
    ? 0 : Number(data.quietSecondsBeforeLeadIn);
  if (!Number.isInteger(quietSecondsBeforeLeadIn) || quietSecondsBeforeLeadIn < 0) {
    throw withStatus(400, 'quietSecondsBeforeLeadIn must be a non-negative integer.');
  }

  const noteValue = data.noteValue === undefined ? null : data.noteValue;
  if (noteValue !== null && !NOTE_VALUES.includes(noteValue)) {
    throw withStatus(400, 'noteValue must be one of ' + NOTE_VALUES.join(', ') + ', or null.');
  }

  return {
    barCount,
    bpm,
    isLeadIn,
    repeatLeadIn: !!data.repeatLeadIn,
    quietSecondsBeforeLeadIn,
    pickupBeats,
    timeSignatureId: hasPublicSig ? Number(data.timeSignatureId) : null,
    accountTimeSignatureId: hasCustomSig ? Number(data.accountTimeSignatureId) : null,
    noteValue
  };
}

// A setup has at most one lead-in (ML-35 follow-up: it's a single fixed slot the frontend always
// plays first and inherits timing from the first regular block, not an independently-orderable
// segment you can chain several of) - defence in depth alongside the frontend only ever offering
// one "+ Lead-in" tile.
async function assertNoOtherLeadIn(setupId, excludeSegmentId) {
  const { rows } = await pool.query(
    'SELECT id FROM metronome_segments WHERE parent_adhoc_setup_id = $1 AND is_lead_in = true AND id != COALESCE($2, -1)',
    [setupId, excludeSegmentId]
  );
  if (rows.length) throw withStatus(400, 'This setup already has a lead-in.');
}

export async function createSegment(accountId, setupId, data) {
  await assertSetupOwnership(accountId, setupId);
  const normalized = validateSegmentPayload(data);
  if (normalized.isLeadIn) await assertNoOtherLeadIn(setupId, null);

  const maxResult = await pool.query(
    'SELECT COALESCE(MAX(order_index), -1) AS max FROM metronome_segments WHERE parent_adhoc_setup_id = $1',
    [setupId]
  );
  const orderIndex = Number(maxResult.rows[0].max) + 1;

  const inserted = await pool.query(
    `INSERT INTO metronome_segments
       (parent_adhoc_setup_id, order_index, bar_count, bpm, is_lead_in, repeat_lead_in, quiet_seconds_before_lead_in, pickup_beats, time_signature_id, account_time_signature_id, note_value)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING id`,
    [setupId, orderIndex, normalized.barCount, normalized.bpm, normalized.isLeadIn, normalized.repeatLeadIn,
      normalized.quietSecondsBeforeLeadIn, normalized.pickupBeats, normalized.timeSignatureId, normalized.accountTimeSignatureId, normalized.noteValue]
  );

  return getSegmentDtoById(inserted.rows[0].id);
}

// Re-fetches a single segment joined to whichever time-signature table it
// points at, so callers get back a fully-resolved label/numerator/denominator
// rather than the bare FK id they just wrote.
async function getSegmentDtoById(segmentId) {
  const { rows } = await pool.query(
    `SELECT ms.id, ms.order_index, ms.bar_count, ms.bpm, ms.is_lead_in, ms.repeat_lead_in, ms.quiet_seconds_before_lead_in, ms.pickup_beats,
            ms.time_signature_id, ms.account_time_signature_id, ms.note_value,
            COALESCE(tso.numerator, ats.numerator) AS numerator,
            COALESCE(tso.denominator, ats.denominator) AS denominator,
            tso.label AS public_label
     FROM metronome_segments ms
     LEFT JOIN time_signature_options tso ON tso.id = ms.time_signature_id
     LEFT JOIN account_time_signatures ats ON ats.id = ms.account_time_signature_id
     WHERE ms.id = $1`,
    [segmentId]
  );
  return toSegmentDto(rows[0]);
}

async function getSegmentForAccount(accountId, segmentId) {
  const { rows } = await pool.query(
    `SELECT ms.parent_adhoc_setup_id, ms.order_index, ms.bar_count, ms.bpm, ms.is_lead_in, ms.repeat_lead_in, ms.quiet_seconds_before_lead_in, ms.pickup_beats,
            ms.time_signature_id, ms.account_time_signature_id, ms.note_value
     FROM metronome_segments ms
     JOIN adhoc_metronome_setups a ON a.id = ms.parent_adhoc_setup_id
     WHERE ms.id = $1 AND a.account_id = $2`,
    [segmentId, accountId]
  );
  if (!rows.length) throw withStatus(404, 'Segment not found');
  const row = rows[0];
  return {
    setupId: row.parent_adhoc_setup_id,
    orderIndex: row.order_index,
    barCount: row.bar_count,
    bpm: row.bpm,
    isLeadIn: row.is_lead_in,
    repeatLeadIn: row.repeat_lead_in,
    quietSecondsBeforeLeadIn: row.quiet_seconds_before_lead_in,
    pickupBeats: row.pickup_beats,
    timeSignatureId: row.time_signature_id === null ? null : Number(row.time_signature_id),
    accountTimeSignatureId: row.account_time_signature_id === null ? null : Number(row.account_time_signature_id),
    noteValue: row.note_value
  };
}

// Partial update: fetches the current row, merges only the fields the caller
// sent, then re-validates the WHOLE resulting row - the exactly-one-time-
// signature and lead-in/pickup rules can't be checked field-by-field.
export async function updateSegment(accountId, segmentId, data) {
  const current = await getSegmentForAccount(accountId, segmentId);

  const merged = {
    barCount: data.barCount !== undefined ? data.barCount : current.barCount,
    bpm: data.bpm !== undefined ? data.bpm : current.bpm,
    isLeadIn: data.isLeadIn !== undefined ? data.isLeadIn : current.isLeadIn,
    repeatLeadIn: data.repeatLeadIn !== undefined ? data.repeatLeadIn : current.repeatLeadIn,
    quietSecondsBeforeLeadIn: data.quietSecondsBeforeLeadIn !== undefined ? data.quietSecondsBeforeLeadIn : current.quietSecondsBeforeLeadIn,
    pickupBeats: data.pickupBeats !== undefined ? data.pickupBeats : current.pickupBeats,
    timeSignatureId: data.timeSignatureId !== undefined ? data.timeSignatureId : current.timeSignatureId,
    accountTimeSignatureId: data.accountTimeSignatureId !== undefined ? data.accountTimeSignatureId : current.accountTimeSignatureId,
    noteValue: data.noteValue !== undefined ? data.noteValue : current.noteValue
  };
  // Switching which time-signature table a segment points at clears the
  // other FK, unless the caller explicitly set both (their problem then -
  // validateSegmentPayload will reject it).
  if (data.timeSignatureId !== undefined && data.accountTimeSignatureId === undefined) merged.accountTimeSignatureId = null;
  if (data.accountTimeSignatureId !== undefined && data.timeSignatureId === undefined) merged.timeSignatureId = null;

  const normalized = validateSegmentPayload(merged);
  if (normalized.isLeadIn && !current.isLeadIn) await assertNoOtherLeadIn(current.setupId, segmentId);
  const orderIndex = data.orderIndex !== undefined ? Number(data.orderIndex) : current.orderIndex;

  await pool.query(
    `UPDATE metronome_segments
     SET order_index = $1, bar_count = $2, bpm = $3, is_lead_in = $4, repeat_lead_in = $5, quiet_seconds_before_lead_in = $6, pickup_beats = $7,
         time_signature_id = $8, account_time_signature_id = $9, note_value = $10
     WHERE id = $11`,
    [orderIndex, normalized.barCount, normalized.bpm, normalized.isLeadIn, normalized.repeatLeadIn,
      normalized.quietSecondsBeforeLeadIn, normalized.pickupBeats, normalized.timeSignatureId, normalized.accountTimeSignatureId, normalized.noteValue, segmentId]
  );

  return getSegmentDtoById(segmentId);
}

export async function deleteSegment(accountId, segmentId) {
  const result = await pool.query(
    `DELETE FROM metronome_segments ms
     USING adhoc_metronome_setups a
     WHERE ms.parent_adhoc_setup_id = a.id AND ms.id = $1 AND a.account_id = $2`,
    [segmentId, accountId]
  );
  if (result.rowCount === 0) throw withStatus(404, 'Segment not found');
}
