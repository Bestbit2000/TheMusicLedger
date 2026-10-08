// ML-489 (the rehearsal score, step B): the Recordings tool. A whole rehearsal, recorded on a phone's
// own recorder, is uploaded here once and then "given" to pieces: each piece gets a cut of it - an
// ordinary recording on the piece (score_recordings) that points at the same stored file, with where
// it starts and ends (ML-312) and which upload it came from. See docs/rehearsal-score.md.
//
// The owner's rules (7 October 2026):
//   - the app does not record; this is only ever a file the member uploads;
//   - anyone can upload and use a recording on their own pieces; only a band's ORGANISER can give one
//     to a band's piece;
//   - how many a member may keep is a limit by account type (rehearsal_recordings_max, Admin ->
//     Feature access): low for Standard, about a concert's worth for a band organiser. Only their own
//     uploads count;
//   - deleting a recording here takes its cuts with it, and the file.

import { del } from '@vercel/blob';
import pool from '../config/db.js';
import { withStatus, assertFlowAccess, FlowJourney } from './flows.js';
import { getLimit } from './features.js';
import { isRehearsalFileUrl, MAX_REHEARSAL_FILE_BYTES } from './blobUrls.js';

const ORGANISER_ROLES = ['admin', 'owner']; // as bands.js
const DEFAULT_LIMIT = 2;
const TOO_BIG = `That file is over ${MAX_REHEARSAL_FILE_BYTES / (1024 * 1024)} MB. Record at your phone's ordinary quality setting - a "lossless" or WAV recording is about ten times the size.`;

const isDay = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s));
// A DATE column arrives as a JS Date at local midnight: read it with the local getters, or it slips a day in summer time.
const day = (d) => { if (!d) return null; const x = new Date(d); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`; };

export async function recordingsLimit() {
  const n = await getLimit('rehearsal_recordings_max', DEFAULT_LIMIT);
  return Number.isFinite(n) && n >= 0 ? n : DEFAULT_LIMIT;
}
async function countMine(accountId) {
  const { rows } = await pool.query('SELECT count(*)::int AS n FROM rehearsal_recordings WHERE account_id = $1', [accountId]);
  return rows[0].n;
}
// Refuses before any file goes up, and again when it is kept - the first saves the member an upload.
export async function assertRoomForOne(accountId) {
  const [used, limit] = await Promise.all([countMine(accountId), recordingsLimit()]);
  if (used >= limit) throw withStatus(409, limit === 0 ? "Recordings aren't available on your account." : `You can keep ${limit} recording${limit === 1 ? '' : 's'} here at a time. Delete one you have finished with to add another.`);
}

// The pieces this member may give a recording to: their own (not a public one), and the pieces of a
// band they organise. What "Add a piece" offers; the server checks again when the cut is made.
async function piecesFor(accountId) {
  const { rows } = await pool.query(
    `SELECT s.id, s.title, b.name AS band_name
       FROM scores s
       LEFT JOIN bands b ON b.id = s.owner_band_id
       LEFT JOIN band_members bm ON bm.band_id = s.owner_band_id AND bm.account_id = $1
      WHERE (s.owner_account_id = $1 AND s.is_public = false)
         OR (s.owner_band_id IS NOT NULL AND bm.role = ANY($2))
      ORDER BY lower(s.title), s.id`,
    [accountId, ORGANISER_ROLES]
  );
  return rows.map((r) => ({ id: Number(r.id), title: r.title, band: r.band_name || null }));
}

// Everything the tool shows: the member's recordings, each with the pieces it has been given to.
export async function listRecordings(accountId) {
  const [{ rows }, { rows: cutRows }, limit, pieces] = await Promise.all([
    pool.query('SELECT * FROM rehearsal_recordings WHERE account_id = $1 ORDER BY created_at DESC, id DESC', [accountId]),
    pool.query(
      `SELECT sr.id, sr.rehearsal_recording_id, sr.score_id, sr.clip_start_ms, sr.clip_end_ms, s.title AS piece_title, b.name AS band_name
         FROM score_recordings sr
         JOIN rehearsal_recordings rr ON rr.id = sr.rehearsal_recording_id
         JOIN scores s ON s.id = sr.score_id
         LEFT JOIN bands b ON b.id = s.owner_band_id
        WHERE rr.account_id = $1
        ORDER BY sr.clip_start_ms NULLS FIRST, sr.id`,
      [accountId]
    ),
    recordingsLimit(),
    piecesFor(accountId)
  ]);
  const ms = (v) => (v === null || v === undefined ? null : Number(v));
  return {
    limit,
    used: rows.length,
    maxBytes: MAX_REHEARSAL_FILE_BYTES,
    folder: `recordings/${Number(accountId)}`, // where the browser uploads to: the member's own folder in the file store
    pieces,
    recordings: rows.map((r) => ({
      id: Number(r.id), title: r.title, recordedOn: day(r.recorded_on), blobUrl: r.blob_url,
      fileSizeBytes: r.file_size_bytes !== null ? Number(r.file_size_bytes) : null, mimeType: r.mime_type, createdAt: r.created_at,
      cuts: cutRows.filter((c) => String(c.rehearsal_recording_id) === String(r.id)).map((c) => ({
        id: Number(c.id), scoreId: Number(c.score_id), pieceTitle: c.piece_title, band: c.band_name || null,
        clipStartMs: ms(c.clip_start_ms), clipEndMs: ms(c.clip_end_ms)
      }))
    }))
  };
}

// Keeps an upload that has just gone to the file store. The address is the member's word, so it must be
// a stored file in THEIR OWN recordings folder (blobUrls.js) that nothing points at yet.
export async function addRecording(accountId, { blobUrl, blobPathname, fileName, fileSizeBytes, mimeType, title, recordedOn }) {
  if (!blobUrl || !blobPathname) throw withStatus(400, 'Missing uploaded file details.');
  if (!isRehearsalFileUrl(blobUrl, accountId)) throw withStatus(400, 'That file is not one this app stored.');
  if (Number(fileSizeBytes) > MAX_REHEARSAL_FILE_BYTES) throw withStatus(413, TOO_BIG);
  if (/^video\//i.test(String(mimeType || ''))) throw withStatus(400, 'Only a sound recording can be added here, not a video.');
  if (recordedOn && !isDay(recordedOn)) throw withStatus(400, 'The day it was recorded has to be a date.');
  await assertRoomForOne(accountId);
  const taken = await pool.query(
    'SELECT 1 FROM rehearsal_recordings WHERE blob_url = $1 UNION ALL SELECT 1 FROM score_recordings WHERE blob_url = $1 UNION ALL SELECT 1 FROM score_documents WHERE blob_url = $1 LIMIT 1', [blobUrl]);
  if (taken.rows.length) throw withStatus(409, 'That file has already been added.');
  const name = String(title || fileName || 'Rehearsal recording').trim().slice(0, 200) || 'Rehearsal recording';
  await pool.query(
    'INSERT INTO rehearsal_recordings (account_id, title, recorded_on, blob_url, blob_pathname, file_size_bytes, mime_type) VALUES ($1, $2, $3, $4, $5, $6, $7)',
    [accountId, name, recordedOn || null, blobUrl, blobPathname, fileSizeBytes || null, mimeType || null]
  );
  return listRecordings(accountId);
}

async function mine(accountId, recordingId) {
  const { rows } = await pool.query('SELECT * FROM rehearsal_recordings WHERE id = $1 AND account_id = $2', [recordingId, accountId]);
  if (!rows.length) throw withStatus(404, 'Recording not found');
  return rows[0];
}

// Gives a recording to a piece: a cut - where the piece starts and ends in the file. The member must be
// able to change the piece, and for a band's piece must be one of the band's organisers.
export async function addCut(accountId, recordingId, { scoreId, startMs, endMs }) {
  const rec = await mine(accountId, recordingId);
  const score = await assertFlowAccess(accountId, scoreId);
  if (score.owner_band_id) {
    const { rows } = await pool.query('SELECT role FROM band_members WHERE band_id = $1 AND account_id = $2', [score.owner_band_id, accountId]);
    if (!rows.length || !ORGANISER_ROLES.includes(rows[0].role)) throw withStatus(403, "Only the band's organisers can put a recording on the band's pieces.");
  } else if (Number(score.owner_account_id) !== Number(accountId) || score.is_public) {
    throw withStatus(403, 'A recording can go on your own pieces, or on the pieces of a band you organise.');
  }
  const clip = FlowJourney.cleanClip({ startMs, endMs });
  if (!clip.ok) throw withStatus(400, clip.message);
  await pool.query(
    `INSERT INTO score_recordings (score_id, type, title, blob_url, blob_pathname, file_size_bytes, mime_type, clip_start_ms, clip_end_ms, rehearsal_recording_id, order_index)
     VALUES ($1, 'upload', $2, $3, $4, $5, $6, $7, $8, $9, (SELECT COALESCE(MAX(order_index), -1) + 1 FROM score_recordings WHERE score_id = $1))`,
    [scoreId, rec.title, rec.blob_url, rec.blob_pathname, rec.file_size_bytes, rec.mime_type, clip.startMs, clip.endMs, rec.id]
  );
  return listRecordings(accountId);
}

// Deletes a recording, the cuts made from it (on the member's pieces and on a band's), and the file.
export async function deleteRecording(accountId, recordingId) {
  const rec = await mine(accountId, recordingId);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('DELETE FROM score_recordings WHERE rehearsal_recording_id = $1', [rec.id]);
    await client.query('DELETE FROM rehearsal_recordings WHERE id = $1', [rec.id]);
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    client.release();
  }
  // Only once nothing points at the file any more (a cut made before this tool tracked them would).
  const still = await pool.query('SELECT 1 FROM score_recordings WHERE blob_url = $1 UNION ALL SELECT 1 FROM rehearsal_recordings WHERE blob_url = $1 LIMIT 1', [rec.blob_url]);
  if (!still.rows.length) {
    try { await del([rec.blob_url]); } catch (error) { console.error('Recordings: a stored file could not be removed:', error.message); }
  }
  return listRecordings(accountId);
}
