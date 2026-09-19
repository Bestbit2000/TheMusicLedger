// Blocks within an ad-hoc multi-bar metronome setup (Jira ML-35). Every
// invariant the DB enforces with a CHECK constraint (017_multibar_metronome.sql)
// is re-validated here first so a violation comes back as a clear 400 instead
// of a raw constraint-violation 500.

import pool from '../config/db.js';
import { withStatus, assertSetupOwnership, toSegmentDto } from './metronomeSetups.js';

// Mirrors the note_value CHECK constraint (023_segment_note_value.sql, widened by
// 040_note_value_extended.sql).
const NOTE_VALUES = ['semiquaver', 'quaver', 'dotted-quaver', 'crotchet', 'dotted-crotchet', 'minim', 'dotted-minim', 'semibreve'];
// Mirrors the fermata playback_mode CHECK constraint (029_block_landmarks_and_jumps.sql).
const FERMATA_MODES = ['tone', 'silent', 'count'];
// Mirrors the fermata kind CHECK constraint (039_fermata_caesura_kind.sql).
const FERMATA_KINDS = ['fermata', 'caesura'];
// Mirrors the metronome_segment_ramps end_mode/target_mode CHECK constraints (041_tempo_ramps_table.sql).
const RAMP_END_MODES = ['block_end', 'specific'];
const RAMP_TARGET_MODES = ['next_block', 'custom'];

// Runs `fn(client)` inside a transaction, always releasing the client.
// The only place in the service layer that needs one - creating/updating a
// segment now also replaces its fermata/rehearsal-mark rows in the same
// request, and those tables need to land together or not at all.
async function withTransaction(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// Normalizes + validates the fields that make up a segment row. Mirrors the
// DB constraints:
//  - exactly one of timeSignatureId / accountTimeSignatureId
//  - a lead-in with a partial bar (pickupBeats set) is always bar_count = 1 -
//    never combined with a genuine multi-bar count on the same row
//  - a non-lead-in, or a whole-bar lead-in, never carries pickupBeats
//  - noteValue is one of NOTE_VALUES or null
//  - the ML-103 navigation/articulation fields below - see
//    docs/database-schema.md's "Journey/repeat wiring" note for why none of
//    the boolean/text ones carry their own bar offset.
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

  // --- ML-103 navigation/articulation fields ---

  const rehearsalMark = data.rehearsalMark === null || data.rehearsalMark === undefined
    ? null : (String(data.rehearsalMark).trim() || null);

  const isRepeatStart = !!data.isRepeatStart;
  const isRepeatEnd = !!data.isRepeatEnd;
  const isSectionBoundary = !!data.isSectionBoundary;
  // The final barline (end of the piece) - a distinct third "end of bar" structure option
  // alongside plain and isSectionBoundary (a mid-piece double barline), ML-179 follow-up.
  const isFinalBarline = !!data.isFinalBarline;

  let repeatPlayCount = data.repeatPlayCount === null || data.repeatPlayCount === undefined ? null : Number(data.repeatPlayCount);
  if (repeatPlayCount !== null) {
    if (!isRepeatEnd) throw withStatus(400, 'repeatPlayCount only applies to a repeat-end block.');
    if (!Number.isInteger(repeatPlayCount) || repeatPlayCount < 2 || repeatPlayCount > 10) throw withStatus(400, 'repeatPlayCount must be an integer between 2 and 10.');
  }

  const isCoda = !!data.isCoda;
  const gotoCoda = !!data.gotoCoda;
  const gotoStartDc = !!data.gotoStartDc;
  const isSegno = !!data.isSegno;
  const gotoSegno = !!data.gotoSegno;
  const gotoSegnoThenCoda = !!data.gotoSegnoThenCoda;
  // "D.C. al Coda" (db/migrations/038_jump_dc_coda_fine.sql) - the goto_start_dc equivalent of
  // goto_segno_then_coda above. "Fine" marks where playback stops once a D.C./D.S. jump has looped
  // back - distinct from isFinalBarline's literal end of the piece on a normal first pass.
  // Not wired into any playback engine yet (Play Flow doesn't consume jump/sign fields at all today -
  // ML-179 Phase 2). Design note for whenever it is: if gotoSegno/gotoStartDc is set but no block in
  // the flow has isFine, fall back to the block with isFinalBarline; if neither exists anywhere, fall
  // back to simply the last block in the flow.
  const gotoStartDcThenCoda = !!data.gotoStartDcThenCoda;
  const isFine = !!data.isFine;

  // Deliberately no mutual-exclusion CHECK: both may be true together, meaning a
  // combined "1. 2." bracket before a 3rd ending (see docs/database-schema.md).
  const isFirstTimeBar = !!data.isFirstTimeBar;
  const isSecondTimeBar = !!data.isSecondTimeBar;

  // Which repeat-pass numbers (1-10) this bar plays on (ML-179 follow-up, db/migrations/
  // 034_repeat_ending_numbers.sql) - a superset of the old binary 1st/2nd-ending pair above (some
  // pieces use a section on passes 1, 3, 5 and a different one on 2, 4). Null/empty means "not a
  // volta", same as both booleans being false. Sorted + deduped so the stored value is always
  // canonical regardless of what order the client sent them in.
  const repeatEndingNumbers = Array.isArray(data.repeatEndingNumbers) && data.repeatEndingNumbers.length
    ? [...new Set(data.repeatEndingNumbers.map(Number))].sort((a, b) => a - b)
    : null;
  if (repeatEndingNumbers && repeatEndingNumbers.some(n => !Number.isInteger(n) || n < 1 || n > 10)) {
    throw withStatus(400, 'repeatEndingNumbers must be whole numbers between 1 and 10.');
  }

  // Which bar (as an offset within this block) a multi-bar volta/alternate ending starts at -
  // db/migrations/037_volta_start_bar.sql. Not bounded against barCount here - barCount can shrink
  // after the fact, and that's surfaced to the user as a "needs fixing" state, not rejected.
  const repeatEndingStartBar = data.repeatEndingStartBar === null || data.repeatEndingStartBar === undefined
    ? null : Number(data.repeatEndingStartBar);
  if (repeatEndingStartBar !== null && (!Number.isInteger(repeatEndingStartBar) || repeatEndingStartBar < 1)) {
    throw withStatus(400, 'repeatEndingStartBar must be a positive integer.');
  }

  // Start and end are independent, bar-only fields now - a block can be just the start of an intro
  // that finishes in a later block, just the end of one that started earlier, both (a self-contained
  // intro), or neither. The beat-offset half of these columns is a pickup-beat concept the Flow
  // "Intro section" picker doesn't expose (it's bar-granularity only); the column stays in the
  // schema for a possible future beat-level intro, and is just defaulted to beat 1 whenever a bar
  // offset is set, rather than requiring the caller to supply it.
  const introStartOn = data.introStartBarOffset !== null && data.introStartBarOffset !== undefined;
  const introEndOn = data.introEndBarOffset !== null && data.introEndBarOffset !== undefined;
  const intro = {
    introStartBarOffset: introStartOn ? Number(data.introStartBarOffset) : null,
    introStartBeatOffset: introStartOn ? 1 : null,
    introEndBarOffset: introEndOn ? Number(data.introEndBarOffset) : null,
    introEndBeatOffset: introEndOn ? 1 : null
  };
  if (introStartOn && (!Number.isInteger(intro.introStartBarOffset) || intro.introStartBarOffset < 0)) {
    throw withStatus(400, 'introStartBarOffset must be a non-negative integer.');
  }
  if (introEndOn && (!Number.isInteger(intro.introEndBarOffset) || intro.introEndBarOffset < 0)) {
    throw withStatus(400, 'introEndBarOffset must be a non-negative integer.');
  }

  const rampStartFlags = [data.rampStartBarOffset, data.rampStartBeatOffset].map(v => v !== null && v !== undefined);
  if (rampStartFlags[0] !== rampStartFlags[1]) {
    throw withStatus(400, 'Speed change needs both a start bar and start beat offset, or neither.');
  }
  const rampOn = rampStartFlags[0];
  const rampStartBarOffset = rampOn ? Number(data.rampStartBarOffset) : null;
  const rampStartBeatOffset = rampOn ? Number(data.rampStartBeatOffset) : null;
  if (rampOn && (!Number.isInteger(rampStartBarOffset) || rampStartBarOffset < 0
    || !Number.isInteger(rampStartBeatOffset) || rampStartBeatOffset < 0)) {
    throw withStatus(400, 'Speed change start offsets must be non-negative integers.');
  }
  let rampDurationBars = data.rampDurationBars === null || data.rampDurationBars === undefined ? null : Number(data.rampDurationBars);
  if (rampDurationBars !== null) {
    if (!rampOn) throw withStatus(400, 'rampDurationBars only applies alongside a speed-change start offset.');
    if (!Number.isInteger(rampDurationBars) || rampDurationBars < 1) throw withStatus(400, 'rampDurationBars must be a positive integer.');
  }

  const fermatas = Array.isArray(data.fermatas) ? data.fermatas.map(f => {
    const fKind = f.kind === undefined || f.kind === null ? 'fermata' : f.kind;
    const fBarOffset = Number(f.barOffset || 0);
    const fBeatOffset = Number(f.beatOffset);
    const fHoldBeats = Number(f.holdBeats);
    // A caesura is always a silent break by definition - playback_mode only distinguishes how a
    // fermata's hold sounds (tone/silent/count), so it's forced here rather than trusted from the
    // client for a caesura row.
    const fPlaybackMode = fKind === 'caesura' ? 'silent' : (f.playbackMode === undefined || f.playbackMode === null ? 'tone' : f.playbackMode);
    if (!FERMATA_KINDS.includes(fKind)) throw withStatus(400, 'Pause kind must be one of ' + FERMATA_KINDS.join(', ') + '.');
    if (!Number.isInteger(fBarOffset) || fBarOffset < 0) throw withStatus(400, 'Pause bar offset must be a non-negative integer.');
    if (!Number.isInteger(fBeatOffset) || fBeatOffset < 1) throw withStatus(400, 'Pause beat offset must be a positive integer.');
    // 2 is the floor, not 1 - a 1-beat "hold" is indistinguishable from no hold at all. Both UIs that
    // set this (Flow's Pauses picker duration stepper, the ad-hoc Metronome Blocks tool's own fermata
    // hold options - #metroSegFermataHoldOptions) were updated to match; this is the defense-in-depth
    // server-side copy of the same rule.
    if (!Number.isInteger(fHoldBeats) || fHoldBeats < 2 || fHoldBeats > 4) throw withStatus(400, 'Pause duration must be between 2 and 4 beats.');
    if (!FERMATA_MODES.includes(fPlaybackMode)) throw withStatus(400, 'Fermata playback mode must be one of ' + FERMATA_MODES.join(', ') + '.');
    return { kind: fKind, barOffset: fBarOffset, beatOffset: fBeatOffset, holdBeats: fHoldBeats, playbackMode: fPlaybackMode };
  }) : [];

  // A block can hold multiple gradual speed changes (ML-179 follow-up, Flow's Tempo ramps
  // picker) - metronome_segment_ramps, same "child table for a list" shape as fermatas above.
  // The old single rampStart*/rampDurationBars fields (validated above) are left alone - still
  // written by the ad-hoc Metronome Blocks tool's own Speed change card, unrelated to this list.
  const ramps = Array.isArray(data.ramps) ? data.ramps.map(r => {
    const rStartBarOffset = Number(r.startBarOffset || 0);
    const rStartBeatOffset = Number(r.startBeatOffset);
    const rEndMode = r.endMode === undefined || r.endMode === null ? 'block_end' : r.endMode;
    const rTargetMode = r.targetMode === undefined || r.targetMode === null ? 'custom' : r.targetMode;
    if (!Number.isInteger(rStartBarOffset) || rStartBarOffset < 0) throw withStatus(400, 'Ramp start bar offset must be a non-negative integer.');
    if (!Number.isInteger(rStartBeatOffset) || rStartBeatOffset < 1) throw withStatus(400, 'Ramp start beat offset must be a positive integer.');
    if (!RAMP_END_MODES.includes(rEndMode)) throw withStatus(400, 'Ramp end mode must be one of ' + RAMP_END_MODES.join(', ') + '.');
    let rEndBarOffset = null;
    let rEndBeatOffset = null;
    if (rEndMode === 'specific') {
      rEndBarOffset = Number(r.endBarOffset);
      rEndBeatOffset = Number(r.endBeatOffset);
      if (!Number.isInteger(rEndBarOffset) || rEndBarOffset < 0) throw withStatus(400, 'Ramp end bar offset must be a non-negative integer.');
      if (!Number.isInteger(rEndBeatOffset) || rEndBeatOffset < 1) throw withStatus(400, 'Ramp end beat offset must be a positive integer.');
    }
    if (!RAMP_TARGET_MODES.includes(rTargetMode)) throw withStatus(400, 'Ramp target mode must be one of ' + RAMP_TARGET_MODES.join(', ') + '.');
    // A ramp landing at a specific mid-block beat can't defer to "whatever the next block's bpm
    // turns out to be" - that value only means something once the ramp is known to run all the
    // way to the block boundary. Same forced-value precedent as a caesura's playback_mode above.
    if (rEndMode === 'specific' && rTargetMode === 'next_block') {
      throw withStatus(400, 'A ramp ending at a specific beat must use a custom target bpm, not the next block\'s.');
    }
    let rTargetBpm = null;
    if (rTargetMode === 'custom') {
      rTargetBpm = Number(r.targetBpm);
      if (!Number.isInteger(rTargetBpm) || rTargetBpm <= 0) throw withStatus(400, 'Ramp target bpm must be a positive integer.');
    }
    return {
      startBarOffset: rStartBarOffset, startBeatOffset: rStartBeatOffset,
      endMode: rEndMode, endBarOffset: rEndBarOffset, endBeatOffset: rEndBeatOffset,
      targetMode: rTargetMode, targetBpm: rTargetBpm
    };
  }) : [];

  const rehearsalMarks = Array.isArray(data.rehearsalMarks) ? data.rehearsalMarks.map(m => {
    const mBarOffset = Number(m.barOffset || 0);
    const mark = String(m.mark || '').trim();
    if (!mark) throw withStatus(400, 'A rehearsal mark cannot be blank.');
    if (!Number.isInteger(mBarOffset) || mBarOffset < 0) throw withStatus(400, 'Rehearsal mark bar offset must be a non-negative integer.');
    return { mark, barOffset: mBarOffset };
  }) : [];

  return {
    barCount,
    bpm,
    isLeadIn,
    repeatLeadIn: !!data.repeatLeadIn,
    quietSecondsBeforeLeadIn,
    pickupBeats,
    timeSignatureId: hasPublicSig ? Number(data.timeSignatureId) : null,
    accountTimeSignatureId: hasCustomSig ? Number(data.accountTimeSignatureId) : null,
    noteValue,
    rehearsalMark,
    isRepeatStart,
    isRepeatEnd,
    isSectionBoundary,
    isFinalBarline,
    repeatPlayCount,
    isCoda,
    gotoCoda,
    gotoStartDc,
    isSegno,
    gotoSegno,
    gotoSegnoThenCoda,
    gotoStartDcThenCoda,
    isFine,
    isFirstTimeBar,
    isSecondTimeBar,
    repeatEndingNumbers,
    repeatEndingStartBar,
    introStartBarOffset: intro.introStartBarOffset,
    introStartBeatOffset: intro.introStartBeatOffset,
    introEndBarOffset: intro.introEndBarOffset,
    introEndBeatOffset: intro.introEndBeatOffset,
    rampStartBarOffset,
    rampStartBeatOffset,
    rampDurationBars,
    fermatas,
    ramps,
    rehearsalMarks
  };
}

// Column order shared by createSegment's INSERT and updateSegment's UPDATE -
// kept as one list so the two can't silently drift apart.
const SEGMENT_COLUMNS = [
  'bar_count', 'bpm', 'is_lead_in', 'repeat_lead_in', 'quiet_seconds_before_lead_in', 'pickup_beats',
  'time_signature_id', 'account_time_signature_id', 'note_value',
  'rehearsal_mark', 'is_repeat_start', 'is_repeat_end', 'is_section_boundary', 'is_final_barline', 'repeat_play_count',
  'goto_coda', 'goto_start_dc', 'is_coda', 'is_segno', 'goto_segno', 'goto_segno_then_coda',
  'goto_start_dc_then_coda', 'is_fine',
  'is_first_time_bar', 'is_second_time_bar', 'repeat_ending_numbers', 'repeat_ending_start_bar',
  'intro_start_bar_offset', 'intro_start_beat_offset', 'intro_end_bar_offset', 'intro_end_beat_offset',
  'ramp_start_bar_offset', 'ramp_start_beat_offset', 'ramp_duration_bars'
];

function segmentColumnValues(normalized) {
  return [
    normalized.barCount, normalized.bpm, normalized.isLeadIn, normalized.repeatLeadIn, normalized.quietSecondsBeforeLeadIn,
    normalized.pickupBeats, normalized.timeSignatureId, normalized.accountTimeSignatureId, normalized.noteValue,
    normalized.rehearsalMark, normalized.isRepeatStart, normalized.isRepeatEnd, normalized.isSectionBoundary, normalized.isFinalBarline, normalized.repeatPlayCount,
    normalized.gotoCoda, normalized.gotoStartDc, normalized.isCoda, normalized.isSegno, normalized.gotoSegno, normalized.gotoSegnoThenCoda,
    normalized.gotoStartDcThenCoda, normalized.isFine,
    normalized.isFirstTimeBar, normalized.isSecondTimeBar, normalized.repeatEndingNumbers, normalized.repeatEndingStartBar,
    normalized.introStartBarOffset, normalized.introStartBeatOffset, normalized.introEndBarOffset, normalized.introEndBeatOffset,
    normalized.rampStartBarOffset, normalized.rampStartBeatOffset, normalized.rampDurationBars
  ];
}

// Full replace of a segment's fermatas - simplest correct approach given the
// block editor stages everything client-side and only writes on Save, same
// as it already does for segments themselves (see metroBlkSegPayload/
// saveMetroBlkEdit client-side).
async function replaceFermatas(client, segmentId, fermatas) {
  await client.query('DELETE FROM metronome_segment_fermatas WHERE segment_id = $1', [segmentId]);
  if (!fermatas.length) return;
  const values = [];
  const rows = fermatas.map((f, i) => {
    const base = i * 6;
    values.push(segmentId, f.barOffset, f.beatOffset, f.holdBeats, f.playbackMode, f.kind);
    return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 6})`;
  });
  await client.query(
    `INSERT INTO metronome_segment_fermatas (segment_id, bar_offset, beat_offset, hold_beats, playback_mode, kind) VALUES ${rows.join(', ')}`,
    values
  );
}

async function getFermatasForSegmentIds(segmentIds) {
  if (!segmentIds.length) return {};
  const { rows } = await pool.query(
    'SELECT segment_id, bar_offset, beat_offset, hold_beats, playback_mode, kind FROM metronome_segment_fermatas WHERE segment_id = ANY($1) ORDER BY bar_offset, beat_offset',
    [segmentIds]
  );
  const bySegment = {};
  for (const row of rows) {
    const key = String(row.segment_id);
    if (!bySegment[key]) bySegment[key] = [];
    bySegment[key].push({ barOffset: row.bar_offset, beatOffset: row.beat_offset, holdBeats: row.hold_beats, playbackMode: row.playback_mode, kind: row.kind });
  }
  return bySegment;
}

// Full replace of a segment's ramps - same "whole-list, only on Save" shape as replaceFermatas
// above.
async function replaceRamps(client, segmentId, ramps) {
  await client.query('DELETE FROM metronome_segment_ramps WHERE segment_id = $1', [segmentId]);
  if (!ramps.length) return;
  const values = [];
  const rows = ramps.map((r, i) => {
    const base = i * 8;
    values.push(segmentId, r.startBarOffset, r.startBeatOffset, r.endMode, r.endBarOffset, r.endBeatOffset, r.targetMode, r.targetBpm);
    return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 6}, $${base + 7}, $${base + 8})`;
  });
  await client.query(
    `INSERT INTO metronome_segment_ramps (segment_id, start_bar_offset, start_beat_offset, end_mode, end_bar_offset, end_beat_offset, target_mode, target_bpm) VALUES ${rows.join(', ')}`,
    values
  );
}

async function getRampsForSegmentIds(segmentIds) {
  if (!segmentIds.length) return {};
  const { rows } = await pool.query(
    'SELECT segment_id, start_bar_offset, start_beat_offset, end_mode, end_bar_offset, end_beat_offset, target_mode, target_bpm FROM metronome_segment_ramps WHERE segment_id = ANY($1) ORDER BY start_bar_offset, start_beat_offset',
    [segmentIds]
  );
  const bySegment = {};
  for (const row of rows) {
    const key = String(row.segment_id);
    if (!bySegment[key]) bySegment[key] = [];
    bySegment[key].push({
      startBarOffset: row.start_bar_offset, startBeatOffset: row.start_beat_offset,
      endMode: row.end_mode, endBarOffset: row.end_bar_offset, endBeatOffset: row.end_beat_offset,
      targetMode: row.target_mode, targetBpm: row.target_bpm
    });
  }
  return bySegment;
}

// Same "replace wholesale on save" shape as replaceFermatas above.
async function replaceRehearsalMarks(client, segmentId, marks) {
  await client.query('DELETE FROM metronome_segment_rehearsal_marks WHERE segment_id = $1', [segmentId]);
  if (!marks.length) return;
  const values = [];
  const rows = marks.map((m, i) => {
    const base = i * 3;
    values.push(segmentId, m.mark, m.barOffset);
    return `($${base + 1}, $${base + 2}, $${base + 3})`;
  });
  await client.query(
    `INSERT INTO metronome_segment_rehearsal_marks (segment_id, mark, bar_offset) VALUES ${rows.join(', ')}`,
    values
  );
}

async function getRehearsalMarksForSegmentIds(segmentIds) {
  if (!segmentIds.length) return {};
  const { rows } = await pool.query(
    'SELECT segment_id, mark, bar_offset FROM metronome_segment_rehearsal_marks WHERE segment_id = ANY($1) ORDER BY bar_offset',
    [segmentIds]
  );
  const bySegment = {};
  for (const row of rows) {
    const key = String(row.segment_id);
    if (!bySegment[key]) bySegment[key] = [];
    bySegment[key].push({ mark: row.mark, barOffset: row.bar_offset });
  }
  return bySegment;
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

  const segmentId = await withTransaction(async (client) => {
    const maxResult = await client.query(
      'SELECT COALESCE(MAX(order_index), -1) AS max FROM metronome_segments WHERE parent_adhoc_setup_id = $1',
      [setupId]
    );
    const orderIndex = Number(maxResult.rows[0].max) + 1;

    const columns = ['parent_adhoc_setup_id', 'order_index', ...SEGMENT_COLUMNS];
    const values = [setupId, orderIndex, ...segmentColumnValues(normalized)];
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

  return getSegmentDtoById(segmentId);
}

// Re-fetches a single segment joined to whichever time-signature table it
// points at, so callers get back a fully-resolved label/numerator/denominator
// rather than the bare FK id they just wrote.
async function getSegmentDtoById(segmentId) {
  const { rows } = await pool.query(
    `SELECT ms.id, ms.order_index, ms.bar_count, ms.bpm, ms.is_lead_in, ms.repeat_lead_in, ms.quiet_seconds_before_lead_in, ms.pickup_beats,
            ms.time_signature_id, ms.account_time_signature_id, ms.note_value,
            ms.rehearsal_mark, ms.is_repeat_start, ms.is_repeat_end, ms.is_section_boundary, ms.is_final_barline, ms.repeat_play_count,
            ms.goto_coda, ms.goto_start_dc, ms.is_coda, ms.is_segno, ms.goto_segno, ms.goto_segno_then_coda,
            ms.goto_start_dc_then_coda, ms.is_fine,
            ms.is_first_time_bar, ms.is_second_time_bar,
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

async function getSegmentForAccount(accountId, segmentId) {
  const { rows } = await pool.query(
    `SELECT ms.parent_adhoc_setup_id, ms.order_index, ms.bar_count, ms.bpm, ms.is_lead_in, ms.repeat_lead_in, ms.quiet_seconds_before_lead_in, ms.pickup_beats,
            ms.time_signature_id, ms.account_time_signature_id, ms.note_value,
            ms.rehearsal_mark, ms.is_repeat_start, ms.is_repeat_end, ms.is_section_boundary, ms.is_final_barline, ms.repeat_play_count,
            ms.goto_coda, ms.goto_start_dc, ms.is_coda, ms.is_segno, ms.goto_segno, ms.goto_segno_then_coda,
            ms.goto_start_dc_then_coda, ms.is_fine,
            ms.is_first_time_bar, ms.is_second_time_bar,
            ms.intro_start_bar_offset, ms.intro_start_beat_offset, ms.intro_end_bar_offset, ms.intro_end_beat_offset,
            ms.ramp_start_bar_offset, ms.ramp_start_beat_offset, ms.ramp_duration_bars
     FROM metronome_segments ms
     JOIN adhoc_metronome_setups a ON a.id = ms.parent_adhoc_setup_id
     WHERE ms.id = $1 AND a.account_id = $2`,
    [segmentId, accountId]
  );
  if (!rows.length) throw withStatus(404, 'Segment not found');
  const row = rows[0];
  const fermatas = await getFermatasForSegmentIds([segmentId]);
  const ramps = await getRampsForSegmentIds([segmentId]);
  const rehearsalMarks = await getRehearsalMarksForSegmentIds([segmentId]);
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

// Partial update: fetches the current row, merges only the fields the caller
// sent, then re-validates the WHOLE resulting row - the exactly-one-time-
// signature and lead-in/pickup rules can't be checked field-by-field.
export async function updateSegment(accountId, segmentId, data) {
  const current = await getSegmentForAccount(accountId, segmentId);

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
  // Switching which time-signature table a segment points at clears the
  // other FK, unless the caller explicitly set both (their problem then -
  // validateSegmentPayload will reject it).
  if (data.timeSignatureId !== undefined && data.accountTimeSignatureId === undefined) merged.accountTimeSignatureId = null;
  if (data.accountTimeSignatureId !== undefined && data.timeSignatureId === undefined) merged.timeSignatureId = null;

  const normalized = validateSegmentPayload(merged);
  if (normalized.isLeadIn && !current.isLeadIn) await assertNoOtherLeadIn(current.setupId, segmentId);
  const orderIndex = data.orderIndex !== undefined ? Number(data.orderIndex) : current.orderIndex;

  await withTransaction(async (client) => {
    const columns = ['order_index', ...SEGMENT_COLUMNS];
    const values = [orderIndex, ...segmentColumnValues(normalized), segmentId];
    const setClause = columns.map((col, i) => `${col} = $${i + 1}`).join(', ');
    await client.query(
      `UPDATE metronome_segments SET ${setClause} WHERE id = $${values.length}`,
      values
    );
    await replaceFermatas(client, segmentId, normalized.fermatas);
    await replaceRamps(client, segmentId, normalized.ramps);
    await replaceRehearsalMarks(client, segmentId, normalized.rehearsalMarks);
  });

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

// ML-179 Phase 2: also exported so server/services/flowBlocks.js (score-backed blocks) can reuse
// the same validation/column/child-table logic rather than duplicating it - these were already
// parent-agnostic, only the ownership check and which parent-id column gets written differ.
export {
  getFermatasForSegmentIds, getRehearsalMarksForSegmentIds, getRampsForSegmentIds,
  SEGMENT_COLUMNS, segmentColumnValues, validateSegmentPayload,
  replaceFermatas, replaceRehearsalMarks, replaceRamps, withTransaction,
  NOTE_VALUES
};
