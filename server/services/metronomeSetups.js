// Ad-hoc metronome setups (Jira ML-35), now used only as Quick Play's history (ML-34). The
// Metronome Blocks editor that also kept its own saved setups here was removed on 2026-09-27; its
// old rows are left in the table (superseded, not removed). See docs/database-schema.md
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

// Renames a setup (Quick Play history's "Rename") - does not touch saved_at.
export async function renameAdhocSetup(accountId, id, name) {
  const result = await pool.query(
    'UPDATE adhoc_metronome_setups SET name = $1 WHERE id = $2 AND account_id = $3',
    [name, id, accountId]
  );
  if (result.rowCount === 0) throw withStatus(404, 'Setup not found');
}

// ML-473: a member's own time signature (account_time_signatures) is named by its id, and that id was
// never checked - so a bar or Quick Play block could name another member's and read its two numbers
// back. A block may use one that is the caller's own, or one the same piece or set-up already uses
// (a band piece keeps the time signatures its other members gave it; a copy keeps its original's).
export async function assertOwnTimeSignatures(accountId, blocks, { scoreId = null, setupId = null } = {}) {
  const ids = [...new Set((blocks || []).map((b) => b && b.accountTimeSignatureId).filter((v) => v !== null && v !== undefined && v !== '').map(Number))];
  if (!ids.length) return;
  if (ids.some((id) => !Number.isInteger(id))) throw withStatus(400, 'That time signature is not one of yours.');
  const { rows } = await pool.query(
    `SELECT ats.id FROM account_time_signatures ats
      WHERE ats.id = ANY($1::bigint[])
        AND (ats.account_id = $2
             OR EXISTS (SELECT 1 FROM metronome_segments ms
                         WHERE ms.account_time_signature_id = ats.id
                           AND (ms.parent_score_id = $3 OR ms.parent_adhoc_setup_id = $4)))`,
    [ids, accountId, scoreId, setupId]
  );
  if (rows.length !== ids.length) throw withStatus(400, 'That time signature is not one of yours.');
}

// Quick Play (front page, replaces the old single-bar Metronome tool): every
// press of Play writes the current blocks straight in as history - named
// with a client-supplied local timestamp instead of a chosen name, flagged
// is_quick_play. saved_at is set immediately (there's no separate "keep" step, the
// whole point is it's already history the moment it's created). No lead-in
// support - Quick Play has no lead-in concept, so every block is a plain
// (is_lead_in = false) segment.
// Shared by createQuickPlaySetup/duplicateQuickPlayHistory/overwriteQuickPlayHistorySegments -
// every Quick Play block is a plain (is_lead_in = false) segment.
async function insertQuickPlaySegments(setupId, blocks) {
  for (let i = 0; i < blocks.length; i++) {
    const b = blocks[i];
    await pool.query(
      `INSERT INTO metronome_segments
         (parent_adhoc_setup_id, order_index, bar_count, bpm, is_lead_in, time_signature_id, account_time_signature_id, note_value)
       VALUES ($1, $2, $3, $4, false, $5, $6, $7)`,
      [setupId, i, b.barCount, b.bpm, b.timeSignatureId || null, b.accountTimeSignatureId || null, b.noteValue || null]
    );
  }
}

export async function createQuickPlaySetup(accountId, name, blocks) {
  await assertOwnTimeSignatures(accountId, blocks);
  const inserted = await pool.query(
    'INSERT INTO adhoc_metronome_setups (account_id, name, saved_at, is_quick_play) VALUES ($1, $2, now(), true) RETURNING id',
    [accountId, name]
  );
  const setupId = inserted.rows[0].id;
  await insertQuickPlaySegments(setupId, blocks);
  return getAdhocSetupWithSegments(accountId, setupId);
}

// ML-34 follow-up: Play, once a history row is already "loaded" into Quick Play, overwrites that
// same row's bars instead of writing a brand new history entry every time - name/is_favorite/
// created_at are all left untouched, only the segments themselves are replaced wholesale (delete +
// re-insert, same pattern the block editor already uses for a segment's own child tables).
export async function overwriteQuickPlayHistorySegments(accountId, id, blocks) {
  await assertSetupOwnership(accountId, id);
  await assertOwnTimeSignatures(accountId, blocks, { setupId: id });
  await pool.query('DELETE FROM metronome_segments WHERE parent_adhoc_setup_id = $1', [id]);
  await insertQuickPlaySegments(id, blocks);
  return getAdhocSetupWithSegments(accountId, id);
}

// ML-34 follow-up: "Duplicate" on a history entry - most useful for a favourite you want to keep
// pristine while iterating on a variant. Default name is computed client-side (qpNextDuplicateName,
// against the already-loaded history list) and just passed straight through here.
export async function duplicateQuickPlayHistory(accountId, sourceId, name) {
  const source = await getAdhocSetupWithSegments(accountId, sourceId);
  const inserted = await pool.query(
    'INSERT INTO adhoc_metronome_setups (account_id, name, saved_at, is_quick_play) VALUES ($1, $2, now(), true) RETURNING id',
    [accountId, name]
  );
  const setupId = inserted.rows[0].id;
  await insertQuickPlaySegments(setupId, source.segments.map(s => ({
    barCount: s.barCount, bpm: s.bpm, timeSignatureId: s.timeSignatureId, accountTimeSignatureId: s.accountTimeSignatureId, noteValue: s.noteValue
  })));
  return getAdhocSetupWithSegments(accountId, setupId);
}

// ML-34: the "Show history" list - every Quick Play row (is_quick_play, see
// createQuickPlaySetup above), favourites first (alphabetically), then
// everyone else by when they were played (most recent first). The CASE
// expression is NULL for every non-favourite row, so ORDER BY ties on it and
// falls through to created_at for that whole group - only favourites actually
// sort by name.
// ML-366: every row is kept (to see what people play), but the list only shows so many.
// ML-383: how many depends on the account type - the 'metronome_history_shown' limit on Admin -> Feature
// access (10 Standard, 100 Premium to start) - and favourites count towards it: favourites first, then
// the most recent, `limit` in all. The app says "Limited to the last N metronome plays".
export const HISTORY_SHOWN_DEFAULT = 10;
export async function listQuickPlayHistory(accountId, limit = HISTORY_SHOWN_DEFAULT) {
  const { rows } = await pool.query(
    `WITH shown AS (
       SELECT id FROM adhoc_metronome_setups WHERE account_id = $1 AND is_quick_play = true
        ORDER BY is_favorite DESC, CASE WHEN is_favorite THEN name END ASC, created_at DESC
        LIMIT $2
     )
     SELECT s.id, s.name, s.created_at, s.is_favorite,
            COUNT(ms.id) AS block_count
     FROM adhoc_metronome_setups s
     JOIN shown ON shown.id = s.id
     LEFT JOIN metronome_segments ms ON ms.parent_adhoc_setup_id = s.id
     GROUP BY s.id
     ORDER BY s.is_favorite DESC, CASE WHEN s.is_favorite THEN s.name END ASC, s.created_at DESC`,
    [accountId, limit]
  );
  return rows.map(r => ({
    id: Number(r.id),
    name: r.name,
    createdAt: r.created_at,
    isFavorite: r.is_favorite,
    blockCount: Number(r.block_count)
  }));
}

export async function setAdhocSetupFavorite(accountId, id, isFavorite) {
  const result = await pool.query(
    'UPDATE adhoc_metronome_setups SET is_favorite = $1 WHERE id = $2 AND account_id = $3',
    [!!isFavorite, id, accountId]
  );
  if (result.rowCount === 0) throw withStatus(404, 'Setup not found');
}

export async function deleteAdhocSetup(accountId, id) {
  // Segments cascade via metronome_segments.parent_adhoc_setup_id ON DELETE CASCADE.
  const result = await pool.query(
    'DELETE FROM adhoc_metronome_setups WHERE id = $1 AND account_id = $2',
    [id, accountId]
  );
  if (result.rowCount === 0) throw withStatus(404, 'Setup not found');
}

// fermatas/rehearsalMarks/ramps default to [] so every other caller (duplicate/quick-play, which
// never insert into metronome_segment_fermatas/metronome_segment_rehearsal_marks/
// metronome_segment_ramps - see the ML-103 note on duplicateAdhocSetup/createQuickPlaySetup below)
// doesn't need to pass one. The ad-hoc Metronome Blocks tool doesn't have the Tempo ramps list UI
// (only Flow's Block Inspector does - ML-179 follow-up) so `ramps` is always [] here today; it
// still keeps reading/writing the legacy single rampStartBarOffset/rampDurationBars fields below.
export function toSegmentDto(row, fermatas = [], rehearsalMarks = [], ramps = []) {
  return {
    id: Number(row.id),
    orderIndex: row.order_index,
    barCount: row.bar_count,
    bpm: row.bpm,
    isLeadIn: row.is_lead_in,
    repeatLeadIn: row.repeat_lead_in,
    quietSecondsBeforeLeadIn: row.quiet_seconds_before_lead_in,
    pickupBeats: row.pickup_beats,
    timeSignatureId: row.time_signature_id === null ? null : Number(row.time_signature_id),
    accountTimeSignatureId: row.account_time_signature_id === null ? null : Number(row.account_time_signature_id),
    numerator: row.numerator,
    denominator: row.denominator,
    timeSignatureLabel: row.public_label || `${row.numerator}/${row.denominator}`,
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
    fermatas,
    ramps,
    rehearsalMarks
  };
}

export async function getAdhocSetupWithSegments(accountId, id) {
  const setupResult = await pool.query(
    'SELECT id, name, created_at, saved_at FROM adhoc_metronome_setups WHERE id = $1 AND account_id = $2',
    [id, accountId]
  );
  if (!setupResult.rows.length) throw withStatus(404, 'Setup not found');

  const { rows } = await pool.query(
    `SELECT ms.id, ms.order_index, ms.bar_count, ms.bpm, ms.is_lead_in, ms.repeat_lead_in, ms.quiet_seconds_before_lead_in, ms.pickup_beats,
            ms.time_signature_id, ms.account_time_signature_id, ms.note_value,
            ms.rehearsal_mark, ms.is_repeat_start, ms.is_repeat_end, ms.is_section_boundary, ms.repeat_play_count,
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
     WHERE ms.parent_adhoc_setup_id = $1
     ORDER BY ms.order_index`,
    [id]
  );

  const fermatasBySegment = rows.length
    ? await pool.query(
        'SELECT segment_id, bar_offset, beat_offset, hold_beats, playback_mode FROM metronome_segment_fermatas WHERE segment_id = ANY($1) ORDER BY bar_offset, beat_offset',
        [rows.map(r => r.id)]
      ).then(({ rows: fRows }) => {
        const map = {};
        for (const f of fRows) {
          const key = String(f.segment_id);
          if (!map[key]) map[key] = [];
          map[key].push({ barOffset: f.bar_offset, beatOffset: Number(f.beat_offset), holdBeats: f.hold_beats, playbackMode: f.playback_mode });
        }
        return map;
      })
    : {};

  const rehearsalMarksBySegment = rows.length
    ? await pool.query(
        'SELECT segment_id, mark, bar_offset FROM metronome_segment_rehearsal_marks WHERE segment_id = ANY($1) ORDER BY bar_offset',
        [rows.map(r => r.id)]
      ).then(({ rows: mRows }) => {
        const map = {};
        for (const m of mRows) {
          const key = String(m.segment_id);
          if (!map[key]) map[key] = [];
          map[key].push({ mark: m.mark, barOffset: m.bar_offset });
        }
        return map;
      })
    : {};

  const setup = setupResult.rows[0];
  return {
    id: Number(setup.id),
    name: setup.name,
    createdAt: setup.created_at,
    savedAt: setup.saved_at,
    segments: rows.map(r => toSegmentDto(r, fermatasBySegment[String(r.id)] || [], rehearsalMarksBySegment[String(r.id)] || []))
  };
}
