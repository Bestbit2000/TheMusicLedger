// ML-179: score-backed "Flows". See docs/database-schema.md's "Flow" vs
// "Score" naming note - this file, every function in it, and the routes that
// call it all say "Flow" throughout. The underlying table stays `scores`
// (reserved as the future home for real notation, once that's added) -
// that's the one place "score" still appears, intentionally.
//
// Ownership has three shapes, all fitting the existing scores_exactly_one_owner
// CHECK with no schema change - personal (owner_account_id), band-owned
// (owner_band_id, persists across that band's own membership churn), and
// admin/public (owner_account_id = a super admin, is_public = true, managed by
// ANY super admin). Every transition between them is an explicit, reversible
// action below (moveFlowToBand/removeFlowFromBand, publishFlow/unpublishFlow) -
// never a direct column edit from elsewhere.

import pool from '../config/db.js';
import { del } from '@vercel/blob';
import { isSuperAdmin } from './accounts.js';
import { getConfigValue } from './appConfig.js';
import { NOTE_VALUES } from './metronomeSegments.js';
import { canDeleteFlow } from './flowPermissions.js';
import { isPieceFileUrl } from './blobUrls.js';

// ML-231: a stored file's address comes back from the browser after an upload, so it is checked before
// it is kept: it must be a stored file uploaded for this very piece (blobUrls.js), and one that no
// piece already points at. Before this, any address was stored as sent - a member could plant an
// address that ran script for whoever opened the piece, or attach another piece's file and then
// delete it.
async function assertOwnUnusedBlob(blobUrl, scoreId) {
  if (!isPieceFileUrl(blobUrl, scoreId)) throw withStatus(400, 'That file is not one this app stored.');
  const { rows } = await pool.query(
    `SELECT 1 FROM score_recordings WHERE blob_url = $1 UNION ALL SELECT 1 FROM score_documents WHERE blob_url = $1 LIMIT 1`, [blobUrl]);
  if (rows.length) throw withStatus(409, 'That file is already attached to a piece.');
}
// A stored file is only removed when no other piece still points at it.
async function delUnreferenced(blobUrls) {
  const urls = [...new Set(blobUrls.filter(Boolean))];
  if (!urls.length) return;
  const { rows } = await pool.query(
    `SELECT blob_url FROM score_recordings WHERE blob_url = ANY($1) UNION SELECT blob_url FROM score_documents WHERE blob_url = ANY($1)`, [urls]);
  const stillUsed = new Set(rows.map((r) => r.blob_url));
  const free = urls.filter((u) => !stillUsed.has(u));
  if (free.length) await del(free);
}

export function withStatus(status, message) {
  const err = new Error(message);
  err.status = status;
  return err;
}

// A block can span both youtube.com/watch?v=, youtu.be/ and /embed/, /shorts/
// forms - the ID is always the same 11-char [A-Za-z0-9_-] token regardless of
// which form it's embedded in. Always re-parsed and validated server-side,
// never trusted from whatever the client thinks it extracted.
const YOUTUBE_ID_PATTERN = /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/;

export function extractYouTubeVideoId(url) {
  const match = String(url || '').match(YOUTUBE_ID_PATTERN);
  return match ? match[1] : null;
}

function toFlowSummaryDto(row, canEdit, canDelete) {
  return {
    id: Number(row.id),
    title: row.title,
    composer: row.composer || null,
    ownerBandId: row.owner_band_id !== null ? Number(row.owner_band_id) : null,
    ownerAccountId: row.owner_account_id !== null ? Number(row.owner_account_id) : null,
    isPublic: row.is_public,
    createdAt: row.created_at,
    blockCount: Number(row.block_count || 0),
    totalBars: Number(row.total_bars || 0),
    // ML-401: this account has prepared it (has given at least one of its bars a Level)
    prepared: !!row.prepared,
    // ML-404: how many practice lists it's on - deleting it takes it off them, so the confirmation says so
    listCount: Number(row.list_count || 0),
    canEdit: !!canEdit, // ML-310: a public piece is view/play/copy for everyone, edit for super admins
    // ML-411: your own piece, or a band piece you added (a super admin: any piece they can reach)
    canDelete: !!canDelete
  };
}

function toRecordingDto(row) {
  return {
    id: Number(row.id),
    type: row.type,
    title: row.title,
    blobUrl: row.blob_url,
    fileSizeBytes: row.file_size_bytes !== null ? Number(row.file_size_bytes) : null,
    mimeType: row.mime_type,
    youtubeVideoId: row.youtube_video_id,
    youtubeThumbnailUrl: row.youtube_thumbnail_url,
    createdAt: row.created_at
  };
}

function toDocumentDto(row) {
  return {
    id: Number(row.id),
    fileName: row.file_name,
    blobUrl: row.blob_url,
    fileSizeBytes: row.file_size_bytes !== null ? Number(row.file_size_bytes) : null,
    mimeType: row.mime_type,
    createdAt: row.created_at
  };
}

function toFlowDetailDto(score, recordingRows, documentRows, summary, canEdit, canDelete) {
  return {
    id: Number(score.id),
    title: score.title,
    composer: score.composer,
    arranger: score.arranger,
    publisher: score.publisher,
    description: score.description,
    ownerBandId: score.owner_band_id !== null ? Number(score.owner_band_id) : null,
    ownerAccountId: score.owner_account_id !== null ? Number(score.owner_account_id) : null,
    isPublic: score.is_public,
    canEdit: !!canEdit,
    canDelete: !!canDelete, // ML-411
    createdAt: score.created_at,
    recordings: recordingRows.map(toRecordingDto),
    documents: documentRows.map(toDocumentDto),
    blocksSummary: { count: Number(summary.block_count), totalBars: Number(summary.total_bars), totalSeconds: Number(summary.total_seconds || 0) }
  };
}

// Read + access check in one - callers get the raw `scores` row back (not just
// a boolean), since move/publish/unpublish all need to know the row's current
// ownership shape to decide whether the requested transition is even valid.
export async function assertFlowAccess(accountId, scoreId) {
  const { rows } = await pool.query(
    `SELECT s.* FROM scores s
     LEFT JOIN band_members bm ON bm.band_id = s.owner_band_id AND bm.account_id = $2
     WHERE s.id = $1 AND (s.owner_account_id = $2 OR bm.account_id IS NOT NULL)`,
    [scoreId, accountId]
  );
  if (rows.length) return rows[0];

  // Not personally/band owned - the only remaining path is a public flow,
  // manageable by any super admin regardless of who originally published it.
  if (await isSuperAdmin(accountId)) {
    const { rows: publicRows } = await pool.query('SELECT * FROM scores WHERE id = $1 AND is_public = true', [scoreId]);
    if (publicRows.length) return publicRows[0];
  }
  throw withStatus(404, 'Flow not found');
}

// ML-310: read access - everything assertFlowAccess allows (the owner, its band, a super admin for a
// public piece), plus any public piece for everyone: view it, play it, copy it into your own library.
// Every change still goes through assertFlowAccess.
export async function assertFlowReadAccess(accountId, scoreId) {
  try {
    return await assertFlowAccess(accountId, scoreId);
  } catch (error) {
    if (error.status !== 404) throw error;
  }
  const { rows } = await pool.query('SELECT * FROM scores WHERE id = $1 AND is_public = true', [scoreId]);
  if (rows.length) return rows[0];
  throw withStatus(404, 'Flow not found');
}
async function canEditFlow(accountId, scoreId) {
  try { await assertFlowAccess(accountId, scoreId); return true; } catch (error) { return false; }
}

export async function assertBandMembership(accountId, bandId) {
  const { rows } = await pool.query('SELECT 1 FROM band_members WHERE band_id = $1 AND account_id = $2', [bandId, accountId]);
  if (!rows.length) throw withStatus(403, 'You are not a member of that band.');
}

// Admin-editable defaults for a Flow's very first block (ML-179 follow-up) - "Create your own"
// always starts with exactly one block now, same idea as Quick Play's own single default bar
// (qpNewBlock: 4/4, 100bpm, 1 bar, crotchet), but these live in app_config (ML-47) so they don't
// need a release to change - see db/migrations/033_flow_default_block_settings.sql and the admin
// UI's "Flow defaults" subtab. Every value falls back safely (rather than failing flow creation
// outright) if a config row's ever missing, or an admin's typed something that doesn't resolve.
export async function getFlowDefaultBlockSettings() {
  const [timeSigLabel, bpmRaw, barCountRaw, noteValueRaw] = await Promise.all([
    getConfigValue('flow_default_time_signature').catch(() => '4/4'),
    getConfigValue('flow_default_bpm').catch(() => '100'),
    getConfigValue('flow_default_bar_count').catch(() => '1'),
    getConfigValue('flow_default_note_value').catch(() => 'crotchet')
  ]);

  const { rows } = await pool.query('SELECT id FROM time_signature_options WHERE label = $1 AND active = true', [timeSigLabel]);
  let timeSignatureId = rows[0]?.id;
  if (!timeSignatureId) {
    const fallback = await pool.query('SELECT id FROM time_signature_options WHERE active = true ORDER BY sort_order LIMIT 1');
    timeSignatureId = fallback.rows[0]?.id ?? null;
  }

  const bpm = Number.isInteger(Number(bpmRaw)) && Number(bpmRaw) > 0 ? Number(bpmRaw) : 100;
  const barCount = Number.isInteger(Number(barCountRaw)) && Number(barCountRaw) > 0 ? Number(barCountRaw) : 1;
  const noteValue = NOTE_VALUES.includes(noteValueRaw) ? noteValueRaw : 'crotchet';

  return { timeSignatureId: timeSignatureId !== null ? Number(timeSignatureId) : null, bpm, barCount, noteValue };
}

// Admin-editable default name for a brand new flow, same app_config pattern as the block settings
// above (db/migrations/035_flow_default_name.sql, admin UI's "Flow defaults" subtab). Unlike the
// block settings, this one can collide with an existing name, so it's resolved here rather than
// just read verbatim: scoped to the account's own PERSONAL flows only (a same-named band or public
// flow doesn't block reusing the name - "Untitled" is unique per personal library, not globally) -
// "Untitled" if free, else the lowest-numbered "Untitled N" that isn't already taken.
export async function getUniqueDefaultFlowName(accountId) {
  const base = ((await getConfigValue('flow_default_name').catch(() => 'Untitled')) || '').trim() || 'Untitled';
  const { rows } = await pool.query(
    'SELECT title FROM scores WHERE owner_account_id = $1 AND owner_band_id IS NULL AND is_public = false AND title LIKE $2',
    [accountId, `${base}%`]
  );
  const taken = new Set(rows.map(r => r.title));
  if (!taken.has(base)) return base;
  let n = 1;
  while (taken.has(`${base} ${n}`)) n++;
  return `${base} ${n}`;
}

// No name required up front, same "start playing immediately" feel as
// createAdhocSetup - personal is the default/no-friction path; pass bandId to
// create band-owned directly instead (equivalent to moveFlowToBand right after).
export async function createFlow(accountId, { name, bandId } = {}) {
  const effectiveName = (name && name.trim()) || await getUniqueDefaultFlowName(accountId);
  if (bandId) {
    await assertBandMembership(accountId, bandId);
    // ML-411: added_by_account_id - the one member who can delete it again
    const { rows } = await pool.query('INSERT INTO scores (title, owner_band_id, added_by_account_id) VALUES ($1, $2, $3) RETURNING id', [effectiveName, bandId, accountId]);
    return getFlowDetail(accountId, rows[0].id);
  }
  const { rows } = await pool.query('INSERT INTO scores (title, owner_account_id) VALUES ($1, $2) RETURNING id', [effectiveName, accountId]);
  return getFlowDetail(accountId, rows[0].id);
}

// "Load from library": the account's own personal flows, its bands' flows,
// and every public flow - the same combined set assertFlowAccess checks
// per-row, just as one list query instead of one row at a time.
export async function listFlows(accountId) {
  const { rows } = await pool.query(
    `SELECT s.id, s.title, s.composer, s.owner_band_id, s.owner_account_id, s.is_public, s.created_at, s.added_by_account_id,
            BOOL_OR(bm.account_id IS NOT NULL) AS is_band_member,
            COUNT(ms.id) AS block_count,
            -- Bar counts exclude the lead-in: it's a count-in, not part of the piece.
            COALESCE(SUM(ms.bar_count) FILTER (WHERE NOT ms.is_lead_in), 0) AS total_bars,
            EXISTS (SELECT 1 FROM piece_chunks pc WHERE pc.account_id = $1 AND pc.score_id = s.id AND pc.level IS NOT NULL) AS prepared,
            (SELECT COUNT(*) FROM practice_list_scores pls WHERE pls.score_id = s.id) AS list_count
     FROM scores s
     LEFT JOIN metronome_segments ms ON ms.parent_score_id = s.id
     LEFT JOIN band_members bm ON bm.band_id = s.owner_band_id AND bm.account_id = $1
     WHERE s.owner_account_id = $1 OR bm.account_id IS NOT NULL OR s.is_public = true
     GROUP BY s.id
     ORDER BY s.created_at DESC`,
    [accountId]
  );
  const superAdmin = await isSuperAdmin(accountId);
  return rows.map(r => {
    const canEdit = (Number(r.owner_account_id) === Number(accountId) && !r.is_public)
      || r.is_band_member || (r.is_public && superAdmin);
    // Only what you can reach at all (canEdit) - a super admin doesn't get Delete on a band they aren't in
    return toFlowSummaryDto(r, canEdit, canEdit && canDeleteFlow(r, accountId, superAdmin));
  });
}

export async function getFlowDetail(accountId, scoreId) {
  const score = await assertFlowReadAccess(accountId, scoreId);
  const canEdit = await canEditFlow(accountId, scoreId);
  const [{ rows: recordingRows }, { rows: documentRows }, { rows: summaryRows }, superAdmin] = await Promise.all([
    pool.query('SELECT * FROM score_recordings WHERE score_id = $1 ORDER BY order_index, id', [scoreId]),
    pool.query('SELECT * FROM score_documents WHERE score_id = $1 ORDER BY id', [scoreId]),
    // Approximate (a tempo ramp mid-block isn't accounted for) - same spirit as the Blocks Studio
    // client's own flowTotalRuntimeSeconds, just computed here too so the Flow Details Hub can show
    // it without loading every block's full detail.
    pool.query(
      `SELECT COUNT(*) AS block_count,
              COALESCE(SUM(ms.bar_count) FILTER (WHERE NOT ms.is_lead_in), 0) AS total_bars, -- lead-in excluded from bar counts
              COALESCE(SUM(ms.bar_count * COALESCE(tso.numerator, ats.numerator) * 60.0 / ms.bpm), 0) AS total_seconds -- runtime still includes it (it does play)
       FROM metronome_segments ms
       LEFT JOIN time_signature_options tso ON tso.id = ms.time_signature_id
       LEFT JOIN account_time_signatures ats ON ats.id = ms.account_time_signature_id
       WHERE ms.parent_score_id = $1`,
      [scoreId]
    ),
    isSuperAdmin(accountId)
  ]);
  const canDelete = canEdit && canDeleteFlow(score, accountId, superAdmin); // ML-411
  return toFlowDetailDto(score, recordingRows, documentRows, summaryRows[0], canEdit, canDelete);
}

export async function updateFlowMetadata(accountId, scoreId, data) {
  await assertFlowAccess(accountId, scoreId);
  const fields = ['title', 'composer', 'arranger', 'publisher', 'description'];
  const sets = [];
  const values = [];
  for (const field of fields) {
    if (data[field] !== undefined) {
      values.push(data[field]);
      sets.push(`${field} = $${values.length}`);
    }
  }
  if (sets.length) {
    values.push(scoreId);
    await pool.query(`UPDATE scores SET ${sets.join(', ')} WHERE id = $${values.length}`, values);
  }
  return getFlowDetail(accountId, scoreId);
}

export async function moveFlowToBand(accountId, scoreId, bandId) {
  const score = await assertFlowAccess(accountId, scoreId);
  // Number() on both sides, not just the DB value - req.accountId comes through as a string
  // (pg returns BIGINT columns as strings, and nothing here re-parses it), so a bare
  // `!== accountId` never actually matched even for the flow's own owner (ML-179 follow-up fix,
  // found while adding duplicateFlow's identical check).
  if (score.is_public || score.owner_account_id === null || Number(score.owner_account_id) !== Number(accountId)) {
    throw withStatus(400, 'Only a personal flow you own can be moved to a band.');
  }
  await assertBandMembership(accountId, bandId);
  // ML-411: whoever moves it in is the one who added it to the band
  await pool.query('UPDATE scores SET owner_band_id = $1, owner_account_id = NULL, added_by_account_id = $3 WHERE id = $2', [bandId, scoreId, accountId]);
  return getFlowDetail(accountId, scoreId);
}

// Reverse of moveFlowToBand - becomes personal, owned by whichever current
// band member performs the removal (there's no single "band owner account" to
// hand it back to).
export async function removeFlowFromBand(accountId, scoreId) {
  const score = await assertFlowAccess(accountId, scoreId);
  if (score.owner_band_id === null) throw withStatus(400, 'This flow is not band-owned.');
  // ML-411: taking it out takes it away from the band, so it's the same rule as deleting it
  if (!canDeleteFlow(score, accountId, await isSuperAdmin(accountId))) {
    throw withStatus(403, 'Only the person who added this piece to the band can take it out.');
  }
  await pool.query('UPDATE scores SET owner_account_id = $1, owner_band_id = NULL, added_by_account_id = NULL WHERE id = $2', [accountId, scoreId]);
  return getFlowDetail(accountId, scoreId);
}

// ML-441: "Who it's for" on the piece's edit screen - just me, one of my bands, or everyone - changed in
// one step whichever way it goes (band to band included). Who may: whoever may delete it (flowPermissions.js -
// a personal piece's owner, the person who added a band piece, a super admin for a public one), since moving
// a piece takes it away from the people who had it. Making it public stays a super admin's.
//   me     - yours alone
//   band   - a band you are in; you become the one who added it (so the one who can take it out again)
//   public - in everyone's library; held by the super admin who published it
export async function setFlowAudience(accountId, scoreId, to, bandId) {
  const score = await assertFlowAccess(accountId, scoreId);
  const superAdmin = await isSuperAdmin(accountId);
  if (!canDeleteFlow(score, accountId, superAdmin)) {
    throw withStatus(403, score.owner_band_id !== null && !score.is_public
      ? 'Only the person who added this piece to the band can change who it is for.'
      : 'You can\'t change who this piece is for.');
  }
  if (to === 'public') {
    if (!superAdmin) throw withStatus(403, 'Only a super admin can make a piece public.');
    await pool.query('UPDATE scores SET owner_account_id = $1, owner_band_id = NULL, added_by_account_id = NULL, is_public = true WHERE id = $2', [accountId, scoreId]);
  } else if (to === 'band') {
    const band = Number(bandId);
    if (!Number.isInteger(band) || band < 1) throw withStatus(400, 'Choose the band.');
    await assertBandMembership(accountId, band);
    await pool.query('UPDATE scores SET owner_band_id = $1, owner_account_id = NULL, added_by_account_id = $2, is_public = false WHERE id = $3', [band, accountId, scoreId]);
  } else if (to === 'me') {
    await pool.query('UPDATE scores SET owner_account_id = $1, owner_band_id = NULL, added_by_account_id = NULL, is_public = false WHERE id = $2', [accountId, scoreId]);
  } else {
    throw withStatus(400, 'Choose who the piece is for.');
  }
  return getFlowDetail(accountId, scoreId);
}

export async function publishFlow(accountId, scoreId) {
  if (!(await isSuperAdmin(accountId))) throw withStatus(403, 'Only a super admin can publish a flow.');
  await assertFlowAccess(accountId, scoreId);
  await pool.query('UPDATE scores SET owner_account_id = $1, owner_band_id = NULL, added_by_account_id = NULL, is_public = true WHERE id = $2', [accountId, scoreId]);
  return getFlowDetail(accountId, scoreId);
}

// Reverse of publishFlow - becomes personal, owned by whichever admin
// unpublishes it. No stored "previous owner" to revert to instead.
export async function unpublishFlow(accountId, scoreId) {
  if (!(await isSuperAdmin(accountId))) throw withStatus(403, 'Only a super admin can unpublish a flow.');
  const score = await assertFlowAccess(accountId, scoreId);
  if (!score.is_public) throw withStatus(400, 'This flow is not public.');
  await pool.query('UPDATE scores SET owner_account_id = $1, owner_band_id = NULL, is_public = false WHERE id = $2', [accountId, scoreId]);
  return getFlowDetail(accountId, scoreId);
}

// Creates the duplicate's own score row (metadata copied, blocks copied separately by the route -
// see flowBlocks.js's copyAllFlowBlocks) - your own personal pieces and, since ML-310, any public
// piece ("Copy to my library"), and since ML-441 a piece of a band you are in. Always lands
// personal, even duplicating your own flow, same "start simple" default as createFlow itself.
export async function duplicateFlow(accountId, scoreId) {
  const source = await assertFlowReadAccess(accountId, scoreId);
  // Your own personal piece, any public piece (ML-310: "Copy to my library" to adapt it), or a piece of a
  // band you are in (ML-441: your own copy to adjust, leaving the band's alone) - assertFlowReadAccess has
  // already checked the membership.
  const ownPersonal = !source.is_public && source.owner_band_id === null && Number(source.owner_account_id) === Number(accountId);
  if (!ownPersonal && !source.is_public && source.owner_band_id === null) {
    throw withStatus(400, 'Only your own pieces, your bands\' pieces and public pieces can be copied.');
  }
  // ML-401: a copy keeps a link to the public piece it came from - and a copy of that copy keeps the
  // same one - so a public piece's take-up can be counted (Admin -> Flows). Never shown to the player.
  const original = source.is_public ? source.id : (source.copied_from_score_id ?? null);
  const { rows } = await pool.query(
    `INSERT INTO scores (title, composer, arranger, publisher, description, owner_account_id, copied_from_score_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
    [`${source.title} (copy)`, source.composer, source.arranger, source.publisher, source.description, accountId, original]
  );
  return Number(rows[0].id);
}

export async function deleteFlow(accountId, scoreId) {
  const score = await assertFlowAccess(accountId, scoreId);
  // ML-411: a band piece goes for everyone in the band (their practice lists, their Levels), so being
  // a member isn't enough - see flowPermissions.js.
  if (!canDeleteFlow(score, accountId, await isSuperAdmin(accountId))) {
    throw withStatus(403, 'Only the person who added this piece to the band can delete it.');
  }
  // Blob storage doesn't hear about a Postgres ON DELETE CASCADE - every
  // linked object has to be explicitly deleted here first.
  const [{ rows: recordingRows }, { rows: documentRows }] = await Promise.all([
    pool.query('SELECT blob_url FROM score_recordings WHERE score_id = $1 AND blob_url IS NOT NULL', [scoreId]),
    pool.query('SELECT blob_url FROM score_documents WHERE score_id = $1', [scoreId])
  ]);
  const blobUrls = [...recordingRows, ...documentRows].map((r) => r.blob_url).filter(Boolean);
  await pool.query('DELETE FROM scores WHERE id = $1', [scoreId]);
  await delUnreferenced(blobUrls); // ML-231: after the rows have gone; a file another piece still uses stays
}

// Inserts the row for an mp3/mp4 that's already been uploaded straight to
// Blob from the browser (see server/routes/api.js's upload-token route) - the
// client calls this right after `upload()` resolves, rather than relying on
// Blob's own onUploadCompleted webhook, which Vercel can only reach on a real
// deployed URL and never in local dev.
export async function addUploadedRecording(accountId, scoreId, { blobUrl, blobPathname, fileName, fileSizeBytes, mimeType }) {
  await assertFlowAccess(accountId, scoreId);
  if (!blobUrl || !blobPathname) throw withStatus(400, 'Missing uploaded file details.');
  await assertOwnUnusedBlob(blobUrl, scoreId);
  await pool.query(
    `INSERT INTO score_recordings (score_id, type, title, blob_url, blob_pathname, file_size_bytes, mime_type, order_index)
     VALUES ($1, 'upload', $2, $3, $4, $5, $6, (SELECT COALESCE(MAX(order_index), -1) + 1 FROM score_recordings WHERE score_id = $1))`,
    [scoreId, fileName || 'Untitled recording', blobUrl, blobPathname, fileSizeBytes || null, mimeType || null]
  );
  return getFlowDetail(accountId, scoreId);
}

export async function addYouTubeRecording(accountId, scoreId, { url, title }) {
  await assertFlowAccess(accountId, scoreId);
  const videoId = extractYouTubeVideoId(url);
  if (!videoId) throw withStatus(400, "That doesn't look like a YouTube link.");
  const effectiveTitle = (title && title.trim()) || 'YouTube video';
  await pool.query(
    `INSERT INTO score_recordings (score_id, type, title, youtube_video_id, youtube_thumbnail_url, order_index)
     VALUES ($1, 'youtube', $2, $3, $4, (SELECT COALESCE(MAX(order_index), -1) + 1 FROM score_recordings WHERE score_id = $1))`,
    [scoreId, effectiveTitle, videoId, `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`]
  );
  return getFlowDetail(accountId, scoreId);
}

export async function deleteRecording(accountId, scoreId, recordingId) {
  await assertFlowAccess(accountId, scoreId);
  const { rows } = await pool.query('SELECT blob_url FROM score_recordings WHERE id = $1 AND score_id = $2', [recordingId, scoreId]);
  if (!rows.length) throw withStatus(404, 'Recording not found');
  await pool.query('DELETE FROM score_recordings WHERE id = $1', [recordingId]);
  await delUnreferenced([rows[0].blob_url]); // after the row has gone, and only if nothing else points at the file
  return getFlowDetail(accountId, scoreId);
}

// Same "client confirms after upload" shape as addUploadedRecording, for the
// Documents & scores card's PDF/MusicXML uploads.
export async function addDocument(accountId, scoreId, { blobUrl, blobPathname, fileName, fileSizeBytes, mimeType }) {
  await assertFlowAccess(accountId, scoreId);
  if (!blobUrl || !blobPathname || !fileName) throw withStatus(400, 'Missing uploaded file details.');
  await assertOwnUnusedBlob(blobUrl, scoreId);
  await pool.query(
    `INSERT INTO score_documents (score_id, file_name, blob_url, blob_pathname, file_size_bytes, mime_type)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [scoreId, fileName, blobUrl, blobPathname, fileSizeBytes || null, mimeType || null]
  );
  return getFlowDetail(accountId, scoreId);
}

export async function deleteDocument(accountId, scoreId, documentId) {
  await assertFlowAccess(accountId, scoreId);
  const { rows } = await pool.query('SELECT blob_url FROM score_documents WHERE id = $1 AND score_id = $2', [documentId, scoreId]);
  if (!rows.length) throw withStatus(404, 'Document not found');
  await pool.query('DELETE FROM score_documents WHERE id = $1', [documentId]);
  await delUnreferenced([rows[0].blob_url]);
  return getFlowDetail(accountId, scoreId);
}
