// ML-179 Phase 2: score-backed Flow blocks (parent_score_id on metronome_segments). Mirrors the
// ad-hoc CRUD orchestration in metronomeSegments.js almost exactly, reusing its shared
// validation/column/child-table helpers (already parent-agnostic) rather than duplicating them -
// only the ownership check (assertFlowAccess's personal/band/admin-public model, not a simple
// account_id column match) and which parent-id column gets written actually differ.

import pool from '../config/db.js';
import { withStatus, assertFlowAccess } from './flows.js';
import { toSegmentDto } from './metronomeSetups.js';
import {
  SEGMENT_COLUMNS, segmentColumnValues, validateSegmentPayload,
  replaceFermatas, replaceRehearsalMarks, replaceRamps, withTransaction,
  getFermatasForSegmentIds, getRehearsalMarksForSegmentIds, getRampsForSegmentIds
} from './metronomeSegments.js';

// Same "at most one lead-in" rule as the ad-hoc side's own assertNoOtherLeadIn, scoped to
// parent_score_id instead of parent_adhoc_setup_id.
async function assertNoOtherLeadIn(scoreId, excludeSegmentId) {
  const { rows } = await pool.query(
    'SELECT id FROM metronome_segments WHERE parent_score_id = $1 AND is_lead_in = true AND id != COALESCE($2, -1)',
    [scoreId, excludeSegmentId]
  );
  if (rows.length) throw withStatus(400, 'This flow already has a lead-in block.');
}

async function getBlockDtoById(segmentId) {
  const { rows } = await pool.query(
    `SELECT ms.id, ms.order_index, ms.bar_count, ms.bpm, ms.is_lead_in, ms.repeat_lead_in, ms.quiet_seconds_before_lead_in, ms.pickup_beats,
            ms.time_signature_id, ms.account_time_signature_id, ms.note_value,
            ms.rehearsal_mark, ms.is_repeat_start, ms.is_repeat_end, ms.is_section_boundary, ms.is_final_barline, ms.repeat_play_count,
            ms.goto_coda, ms.goto_start_dc, ms.is_coda, ms.is_segno, ms.goto_segno, ms.goto_segno_then_coda,
            ms.goto_start_dc_then_coda, ms.is_fine,
            ms.is_first_time_bar, ms.is_second_time_bar, ms.repeat_ending_numbers, ms.repeat_ending_start_bar,
            ms.intro_start_bar_offset, ms.intro_start_beat_offset, ms.intro_end_bar_offset, ms.intro_end_beat_offset,
            ms.ramp_start_bar_offset, ms.ramp_start_beat_offset, ms.ramp_duration_bars,
            COALESCE(tso.numerator, ats.numerator) AS numerator,
            COALESCE(tso.denominator, ats.denominator) AS denominator,
            tso.label AS public_label
     FROM metronome_segments ms
     LEFT JOIN time_signature_options tso ON tso.id = ms.time_signature_id
     LEFT JOIN account_time_signatures ats ON ats.id = ms.account_time_signature_id
     WHERE ms.id = $1`,
    [segmentId]
  );
  const fermatas = await getFermatasForSegmentIds([segmentId]);
  const ramps = await getRampsForSegmentIds([segmentId]);
  const rehearsalMarks = await getRehearsalMarksForSegmentIds([segmentId]);
  return toSegmentDto(rows[0], fermatas[String(segmentId)] || [], rehearsalMarks[String(segmentId)] || [], ramps[String(segmentId)] || []);
}

// Ownership-scoped fetch: reads the block's own parent_score_id first, then defers to
// assertFlowAccess for the actual personal/band/admin-public check (404s if not accessible) -
// unlike the ad-hoc side's single JOIN-based query, Flow ownership isn't a plain account_id
// column match, so it can't be folded into one WHERE clause the same way.
async function getBlockForFlow(accountId, segmentId) {
  const { rows } = await pool.query(
    `SELECT ms.parent_score_id, ms.order_index, ms.bar_count, ms.bpm, ms.is_lead_in, ms.repeat_lead_in, ms.quiet_seconds_before_lead_in, ms.pickup_beats,
            ms.time_signature_id, ms.account_time_signature_id, ms.note_value,
            ms.rehearsal_mark, ms.is_repeat_start, ms.is_repeat_end, ms.is_section_boundary, ms.is_final_barline, ms.repeat_play_count,
            ms.goto_coda, ms.goto_start_dc, ms.is_coda, ms.is_segno, ms.goto_segno, ms.goto_segno_then_coda,
            ms.goto_start_dc_then_coda, ms.is_fine,
            ms.is_first_time_bar, ms.is_second_time_bar, ms.repeat_ending_numbers, ms.repeat_ending_start_bar,
            ms.intro_start_bar_offset, ms.intro_start_beat_offset, ms.intro_end_bar_offset, ms.intro_end_beat_offset,
            ms.ramp_start_bar_offset, ms.ramp_start_beat_offset, ms.ramp_duration_bars
     FROM metronome_segments ms
     WHERE ms.id = $1 AND ms.parent_score_id IS NOT NULL`,
    [segmentId]
  );
  if (!rows.length) throw withStatus(404, 'Block not found');
  const row = rows[0];
  await assertFlowAccess(accountId, row.parent_score_id);
  const fermatas = await getFermatasForSegmentIds([segmentId]);
  const ramps = await getRampsForSegmentIds([segmentId]);
  const rehearsalMarks = await getRehearsalMarksForSegmentIds([segmentId]);
  return {
    scoreId: Number(row.parent_score_id),
    orderIndex: row.order_index,
    barCount: row.bar_count,
    bpm: row.bpm,
    isLeadIn: row.is_lead_in,
    repeatLeadIn: row.repeat_lead_in,
    quietSecondsBeforeLeadIn: row.quiet_seconds_before_lead_in,
    pickupBeats: row.pickup_beats,
    timeSignatureId: row.time_signature_id === null ? null : Number(row.time_signature_id),
    accountTimeSignatureId: row.account_time_signature_id === null ? null : Number(row.account_time_signature_id),
    noteValue: row.note_value,
    rehearsalMark: row.rehearsal_mark,
    isRepeatStart: row.is_repeat_start,
    isRepeatEnd: row.is_repeat_end,
    isSectionBoundary: row.is_section_boundary,
    isFinalBarline: row.is_final_barline,
    repeatPlayCount: row.repeat_play_count,
    gotoCoda: row.goto_coda,
    gotoStartDc: row.goto_start_dc,
    isCoda: row.is_coda,
    isSegno: row.is_segno,
    gotoSegno: row.goto_segno,
    gotoSegnoThenCoda: row.goto_segno_then_coda,
    gotoStartDcThenCoda: row.goto_start_dc_then_coda,
    isFine: row.is_fine,
    isFirstTimeBar: row.is_first_time_bar,
    isSecondTimeBar: row.is_second_time_bar,
    repeatEndingNumbers: row.repeat_ending_numbers || [],
    repeatEndingStartBar: row.repeat_ending_start_bar,
    introStartBarOffset: row.intro_start_bar_offset,
    introStartBeatOffset: row.intro_start_beat_offset,
    introEndBarOffset: row.intro_end_bar_offset,
    introEndBeatOffset: row.intro_end_beat_offset,
    rampStartBarOffset: row.ramp_start_bar_offset,
    rampStartBeatOffset: row.ramp_start_beat_offset,
    rampDurationBars: row.ramp_duration_bars,
    fermatas: fermatas[String(segmentId)] || [],
    ramps: ramps[String(segmentId)] || [],
    rehearsalMarks: rehearsalMarks[String(segmentId)] || []
  };
}

// Every block for a flow, in order - the Blocks Studio list/Block Inspector's data source.
export async function listFlowBlocks(accountId, scoreId) {
  await assertFlowAccess(accountId, scoreId);
  const { rows } = await pool.query(
    `SELECT ms.id, ms.order_index, ms.bar_count, ms.bpm, ms.is_lead_in, ms.repeat_lead_in, ms.quiet_seconds_before_lead_in, ms.pickup_beats,
            ms.time_signature_id, ms.account_time_signature_id, ms.note_value,
            ms.rehearsal_mark, ms.is_repeat_start, ms.is_repeat_end, ms.is_section_boundary, ms.is_final_barline, ms.repeat_play_count,
            ms.goto_coda, ms.goto_start_dc, ms.is_coda, ms.is_segno, ms.goto_segno, ms.goto_segno_then_coda,
            ms.goto_start_dc_then_coda, ms.is_fine,
            ms.is_first_time_bar, ms.is_second_time_bar, ms.repeat_ending_numbers, ms.repeat_ending_start_bar,
            ms.intro_start_bar_offset, ms.intro_start_beat_offset, ms.intro_end_bar_offset, ms.intro_end_beat_offset,
            ms.ramp_start_bar_offset, ms.ramp_start_beat_offset, ms.ramp_duration_bars,
            COALESCE(tso.numerator, ats.numerator) AS numerator,
            COALESCE(tso.denominator, ats.denominator) AS denominator,
            tso.label AS public_label
     FROM metronome_segments ms
     LEFT JOIN time_signature_options tso ON tso.id = ms.time_signature_id
     LEFT JOIN account_time_signatures ats ON ats.id = ms.account_time_signature_id
     WHERE ms.parent_score_id = $1
     ORDER BY ms.order_index`,
    [scoreId]
  );
  if (!rows.length) return [];
  const ids = rows.map(r => r.id);
  const [fermatas, rehearsalMarks, ramps] = await Promise.all([
    getFermatasForSegmentIds(ids),
    getRehearsalMarksForSegmentIds(ids),
    getRampsForSegmentIds(ids)
  ]);
  return rows.map(row => toSegmentDto(row, fermatas[String(row.id)] || [], rehearsalMarks[String(row.id)] || [], ramps[String(row.id)] || []));
}

export async function createFlowBlock(accountId, scoreId, data) {
  await assertFlowAccess(accountId, scoreId);
  const normalized = validateSegmentPayload(data);
  if (normalized.isLeadIn) await assertNoOtherLeadIn(scoreId, null);

  const segmentId = await withTransaction(async (client) => {
    // The lead-in always sorts first regardless of when it's added - MIN-1 rather than the
    // regular-block MAX+1 below, so adding one after regular blocks already exist doesn't leave
    // it stranded at the end of the sequence.
    const orderIndex = normalized.isLeadIn
      ? Number((await client.query('SELECT COALESCE(MIN(order_index), 1) AS min FROM metronome_segments WHERE parent_score_id = $1', [scoreId])).rows[0].min) - 1
      : Number((await client.query('SELECT COALESCE(MAX(order_index), -1) AS max FROM metronome_segments WHERE parent_score_id = $1', [scoreId])).rows[0].max) + 1;

    const columns = ['parent_score_id', 'order_index', ...SEGMENT_COLUMNS];
    const values = [scoreId, orderIndex, ...segmentColumnValues(normalized)];
    const placeholders = values.map((_, i) => `$${i + 1}`).join(', ');
    const inserted = await client.query(
      `INSERT INTO metronome_segments (${columns.join(', ')}) VALUES (${placeholders}) RETURNING id`,
      values
    );
    const newId = inserted.rows[0].id;
    await replaceFermatas(client, newId, normalized.fermatas);
    await replaceRamps(client, newId, normalized.ramps);
    await replaceRehearsalMarks(client, newId, normalized.rehearsalMarks);
    return newId;
  });

  return getBlockDtoById(segmentId);
}

// Partial update - same "merge only what's present, re-validate the whole row" shape as
// metronomeSegments.js's own updateSegment (the exactly-one-time-signature and lead-in/pickup
// rules can't be checked field-by-field).
export async function updateFlowBlock(accountId, segmentId, data) {
  const current = await getBlockForFlow(accountId, segmentId);

  const mergeKeys = [
    'barCount', 'bpm', 'isLeadIn', 'repeatLeadIn', 'quietSecondsBeforeLeadIn', 'pickupBeats',
    'timeSignatureId', 'accountTimeSignatureId', 'noteValue',
    'rehearsalMark', 'isRepeatStart', 'isRepeatEnd', 'isSectionBoundary', 'isFinalBarline', 'repeatPlayCount',
    'gotoCoda', 'gotoStartDc', 'isCoda', 'isSegno', 'gotoSegno', 'gotoSegnoThenCoda',
    'gotoStartDcThenCoda', 'isFine',
    'isFirstTimeBar', 'isSecondTimeBar', 'repeatEndingNumbers', 'repeatEndingStartBar',
    'introStartBarOffset', 'introStartBeatOffset', 'introEndBarOffset', 'introEndBeatOffset',
    'rampStartBarOffset', 'rampStartBeatOffset', 'rampDurationBars'
  ];
  const merged = {};
  for (const key of mergeKeys) {
    merged[key] = data[key] !== undefined ? data[key] : current[key];
  }
  merged.fermatas = data.fermatas !== undefined ? data.fermatas : current.fermatas;
  merged.ramps = data.ramps !== undefined ? data.ramps : current.ramps;
  merged.rehearsalMarks = data.rehearsalMarks !== undefined ? data.rehearsalMarks : current.rehearsalMarks;
  if (data.timeSignatureId !== undefined && data.accountTimeSignatureId === undefined) merged.accountTimeSignatureId = null;
  if (data.accountTimeSignatureId !== undefined && data.timeSignatureId === undefined) merged.timeSignatureId = null;

  const normalized = validateSegmentPayload(merged);
  if (normalized.isLeadIn && !current.isLeadIn) await assertNoOtherLeadIn(current.scoreId, segmentId);
  const orderIndex = data.orderIndex !== undefined ? Number(data.orderIndex) : current.orderIndex;

  await withTransaction(async (client) => {
    const columns = ['order_index', ...SEGMENT_COLUMNS];
    const values = [orderIndex, ...segmentColumnValues(normalized), segmentId];
    const setClause = columns.map((col, i) => `${col} = $${i + 1}`).join(', ');
    await client.query(`UPDATE metronome_segments SET ${setClause} WHERE id = $${values.length}`, values);
    await replaceFermatas(client, segmentId, normalized.fermatas);
    await replaceRamps(client, segmentId, normalized.ramps);
    await replaceRehearsalMarks(client, segmentId, normalized.rehearsalMarks);
  });

  return getBlockDtoById(segmentId);
}

export async function deleteFlowBlock(accountId, segmentId) {
  // Check-then-delete rather than the ad-hoc side's single DELETE...USING join - Flow ownership
  // isn't a plain account_id column match, so the access check can't be folded into one statement.
  await getBlockForFlow(accountId, segmentId);
  const result = await pool.query('DELETE FROM metronome_segments WHERE id = $1', [segmentId]);
  if (result.rowCount === 0) throw withStatus(404, 'Block not found');
}

// Duplicates a single block (Blocks Studio's per-block "Duplicate" menu item) - copies every
// scalar field plus fermatas/rehearsal marks, inserted immediately after the source block, with
// every later block's order_index bumped up by one to make room. Never duplicates a lead-in (a
// flow has at most one) - the menu item itself is hidden for the lead-in tile, this is defence in
// depth.
export async function duplicateFlowBlock(accountId, segmentId) {
  const source = await getBlockForFlow(accountId, segmentId);
  if (source.isLeadIn) throw withStatus(400, 'The lead-in block cannot be duplicated.');

  const newId = await withTransaction(async (client) => {
    await client.query(
      'UPDATE metronome_segments SET order_index = order_index + 1 WHERE parent_score_id = $1 AND order_index > $2',
      [source.scoreId, source.orderIndex]
    );
    const normalized = validateSegmentPayload(source);
    const columns = ['parent_score_id', 'order_index', ...SEGMENT_COLUMNS];
    const values = [source.scoreId, source.orderIndex + 1, ...segmentColumnValues(normalized)];
    const placeholders = values.map((_, i) => `$${i + 1}`).join(', ');
    const inserted = await client.query(
      `INSERT INTO metronome_segments (${columns.join(', ')}) VALUES (${placeholders}) RETURNING id`,
      values
    );
    const copyId = inserted.rows[0].id;
    await replaceFermatas(client, copyId, normalized.fermatas);
    await replaceRamps(client, copyId, normalized.ramps);
    await replaceRehearsalMarks(client, copyId, normalized.rehearsalMarks);
    return copyId;
  });

  return getBlockDtoById(newId);
}

// Copies every block (including the lead-in, if any) from one flow to another, preserving
// order_index and every field plus fermatas/rehearsal marks - used by the flow-duplicate route
// right after flows.js's duplicateFlow creates the destination's own (empty) score row. Both flows'
// access is already verified by the route's own calls into flows.js before this runs.
export async function copyAllFlowBlocks(sourceScoreId, destScoreId) {
  const { rows } = await pool.query(
    'SELECT * FROM metronome_segments WHERE parent_score_id = $1 ORDER BY order_index',
    [sourceScoreId]
  );
  if (!rows.length) return;
  const ids = rows.map(r => r.id);
  const [fermatas, rehearsalMarks, ramps] = await Promise.all([
    getFermatasForSegmentIds(ids),
    getRehearsalMarksForSegmentIds(ids),
    getRampsForSegmentIds(ids)
  ]);

  await withTransaction(async (client) => {
    for (const row of rows) {
      const normalized = validateSegmentPayload({
        barCount: row.bar_count, bpm: row.bpm, isLeadIn: row.is_lead_in, repeatLeadIn: row.repeat_lead_in,
        quietSecondsBeforeLeadIn: row.quiet_seconds_before_lead_in, pickupBeats: row.pickup_beats,
        timeSignatureId: row.time_signature_id, accountTimeSignatureId: row.account_time_signature_id,
        noteValue: row.note_value, rehearsalMark: row.rehearsal_mark,
        isRepeatStart: row.is_repeat_start, isRepeatEnd: row.is_repeat_end, isSectionBoundary: row.is_section_boundary,
        isFinalBarline: row.is_final_barline,
        repeatPlayCount: row.repeat_play_count, gotoCoda: row.goto_coda, gotoStartDc: row.goto_start_dc,
        isCoda: row.is_coda, isSegno: row.is_segno, gotoSegno: row.goto_segno, gotoSegnoThenCoda: row.goto_segno_then_coda,
        gotoStartDcThenCoda: row.goto_start_dc_then_coda, isFine: row.is_fine,
        isFirstTimeBar: row.is_first_time_bar, isSecondTimeBar: row.is_second_time_bar,
        repeatEndingNumbers: row.repeat_ending_numbers,
        repeatEndingStartBar: row.repeat_ending_start_bar,
        introStartBarOffset: row.intro_start_bar_offset, introStartBeatOffset: row.intro_start_beat_offset,
        introEndBarOffset: row.intro_end_bar_offset, introEndBeatOffset: row.intro_end_beat_offset,
        rampStartBarOffset: row.ramp_start_bar_offset, rampStartBeatOffset: row.ramp_start_beat_offset,
        rampDurationBars: row.ramp_duration_bars,
        fermatas: fermatas[String(row.id)] || [], ramps: ramps[String(row.id)] || [],
        rehearsalMarks: rehearsalMarks[String(row.id)] || []
      });
      const columns = ['parent_score_id', 'order_index', ...SEGMENT_COLUMNS];
      const values = [destScoreId, row.order_index, ...segmentColumnValues(normalized)];
      const placeholders = values.map((_, i) => `$${i + 1}`).join(', ');
      const inserted = await client.query(
        `INSERT INTO metronome_segments (${columns.join(', ')}) VALUES (${placeholders}) RETURNING id`,
        values
      );
      const newId = inserted.rows[0].id;
      await replaceFermatas(client, newId, normalized.fermatas);
      await replaceRamps(client, newId, normalized.ramps);
      await replaceRehearsalMarks(client, newId, normalized.rehearsalMarks);
    }
  });
}

// Whole-sequence reorder (Blocks Studio's drag-and-drop, committed in one call rather than the
// ad-hoc builder's "stage locally, only synced via individual segment saves" approach - Flow
// blocks have no equivalent client-side staging area yet, so each drag commits immediately).
// orderedIds is every non-lead-in block's id in its new order; the lead-in (if present) is left
// alone - it's always first regardless, never part of the reorderable sequence.
export async function reorderFlowBlocks(accountId, scoreId, orderedIds) {
  await assertFlowAccess(accountId, scoreId);
  await withTransaction(async (client) => {
    // Starts one past the lead-in's own order_index (whatever it happens to be, not assumed to be
    // 0) so the new sequence always sorts after it, never accidentally ahead of it.
    const { rows } = await client.query(
      'SELECT order_index FROM metronome_segments WHERE parent_score_id = $1 AND is_lead_in = true',
      [scoreId]
    );
    let nextOrderIndex = rows.length ? Number(rows[0].order_index) + 1 : 0;
    for (const id of orderedIds) {
      await client.query(
        'UPDATE metronome_segments SET order_index = $1 WHERE id = $2 AND parent_score_id = $3 AND is_lead_in = false',
        [nextOrderIndex, id, scoreId]
      );
      nextOrderIndex++;
    }
  });
  return listFlowBlocks(accountId, scoreId);
}
