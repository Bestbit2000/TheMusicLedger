// ML-490: acting on a request to remove a recording (Admin -> Content -> Recordings). The privacy
// policy tells anyone who is in a recording that they can ask for it to be removed. When they do, the
// owner removes it here in one action:
//   - the stored file goes, and it comes off EVERY piece it was on - it cannot stay anywhere once one
//     person objects (the owner, 8 October 2026);
//   - the people it belonged to are told what happened, why and what to do next - an urgent
//     notification in the app, and an email;
//   - a line is kept in recording_removals: when, by whom, why, what, how many were told. Nothing
//     about the person who asked is written down.
// Super admins only (server/routes/admin.js). docs/rehearsal-score.md.

import { del } from '@vercel/blob';
import pool from '../config/db.js';
import { withStatus } from './flows.js';
import { createTargetedNotification } from './notifications.js';
import { sendMail } from './mail.js';
import { listReports } from './contentReports.js';

const ORGANISER_ROLES = ['admin', 'owner']; // as bands.js
export const REMOVAL_REASONS = {
  person: 'Someone who is in the recording asked for it to be removed',
  copyright: "It may be someone else's copyright",
  reported: 'A member reported it',
  terms: 'It breaks the terms of use',
  other: 'Another reason'
};
const MAX_MESSAGE = 2000;
const fullName = (r) => [r.first_name, r.surname].filter(Boolean).join(' ').trim() || 'A member';

// Every recording and video held, newest first: a whole rehearsal in the Recordings tool (with the
// pieces it has been given to), a recording put straight on a piece, and a YouTube link.
export async function listRecordingsForAdmin() {
  const [rehearsals, cuts, direct, removals, documents, pieces, reports, lists, bands] = await Promise.all([
    pool.query(
      `SELECT rr.id, rr.title, rr.file_size_bytes, rr.created_at, a.first_name, a.surname
         FROM rehearsal_recordings rr JOIN accounts a ON a.id = rr.account_id
        ORDER BY rr.created_at DESC`),
    pool.query(
      `SELECT sr.rehearsal_recording_id, s.title AS piece_title, b.name AS band_name
         FROM score_recordings sr JOIN scores s ON s.id = sr.score_id LEFT JOIN bands b ON b.id = s.owner_band_id
        WHERE sr.rehearsal_recording_id IS NOT NULL
        ORDER BY lower(s.title)`),
    pool.query(
      `SELECT sr.id, sr.type, sr.title, sr.file_size_bytes, sr.created_at, s.title AS piece_title, b.name AS band_name,
              a.first_name, a.surname
         FROM score_recordings sr
         JOIN scores s ON s.id = sr.score_id
         LEFT JOIN bands b ON b.id = s.owner_band_id
         LEFT JOIN accounts a ON a.id = COALESCE(s.owner_account_id, s.added_by_account_id)
        WHERE sr.rehearsal_recording_id IS NULL
          AND (sr.blob_url IS NULL OR sr.blob_url NOT IN (SELECT blob_url FROM rehearsal_recordings))
        ORDER BY sr.created_at DESC`),
    pool.query('SELECT * FROM recording_removals ORDER BY removed_at DESC, id DESC LIMIT 100'),
    // ML-507: documents, and the pieces a band shares or that are public - everything one member can show another
    pool.query(
      `SELECT d.id, d.file_name, d.file_size_bytes, d.created_at, s.title AS piece_title, b.name AS band_name, a.first_name, a.surname
         FROM score_documents d
         JOIN scores s ON s.id = d.score_id
         LEFT JOIN bands b ON b.id = s.owner_band_id
         LEFT JOIN accounts a ON a.id = COALESCE(s.owner_account_id, s.added_by_account_id)
        ORDER BY d.created_at DESC`),
    pool.query(
      `SELECT s.id, s.title, s.created_at, s.is_public, b.name AS band_name, a.first_name, a.surname
         FROM scores s
         LEFT JOIN bands b ON b.id = s.owner_band_id
         LEFT JOIN accounts a ON a.id = COALESCE(s.added_by_account_id, s.owner_account_id)
        WHERE s.owner_band_id IS NOT NULL OR s.is_public = true
        ORDER BY s.created_at DESC`),
    listReports(),
    // ML-511: a band's practice lists, and the bands themselves (a band's name is seen by its members)
    pool.query(
      `SELECT pl.id, pl.name, pl.created_at, b.name AS band_name
         FROM practice_lists pl JOIN bands b ON b.id = pl.owner_band_id
        ORDER BY pl.created_at DESC`),
    pool.query(
      `SELECT g.id, g.name, g.created_at, a.first_name, a.surname,
              (SELECT COUNT(*) FROM band_members m WHERE m.band_id = g.id) AS members
         FROM bands g LEFT JOIN accounts a ON a.id = g.created_by_account_id
        WHERE g.kind = 'group' AND g.active
        ORDER BY g.created_at DESC`)
  ]);
  const piece = (r) => ({ title: r.piece_title, band: r.band_name || null });
  return {
    reasons: REMOVAL_REASONS,
    recordings: [
      ...rehearsals.rows.map((r) => ({
        kind: 'rehearsal', id: Number(r.id), title: r.title, addedBy: fullName(r), addedAt: r.created_at,
        sizeBytes: r.file_size_bytes !== null ? Number(r.file_size_bytes) : null,
        pieces: cuts.rows.filter((c) => String(c.rehearsal_recording_id) === String(r.id)).map(piece)
      })),
      ...direct.rows.map((r) => ({
        kind: r.type === 'youtube' ? 'video' : 'piece', id: Number(r.id), title: r.title, addedBy: r.first_name || r.surname ? fullName(r) : (r.band_name || 'A band'), addedAt: r.created_at,
        sizeBytes: r.file_size_bytes !== null ? Number(r.file_size_bytes) : null,
        pieces: [piece(r)]
      }))
    ],
    reports,
    shared: [
      ...pieces.rows.map((r) => ({
        kind: 'score', id: Number(r.id), title: r.title, addedBy: r.first_name || r.surname ? fullName(r) : (r.band_name || 'A band'), addedAt: r.created_at,
        sizeBytes: null, pieces: [{ title: r.is_public ? 'Public library' : 'Shared with the band', band: r.band_name || null }]
      })),
      ...documents.rows.map((r) => ({
        kind: 'document', id: Number(r.id), title: r.file_name, addedBy: r.first_name || r.surname ? fullName(r) : (r.band_name || 'A band'), addedAt: r.created_at,
        sizeBytes: r.file_size_bytes !== null ? Number(r.file_size_bytes) : null, pieces: [piece(r)]
      })),
      ...lists.rows.map((r) => ({
        kind: 'list', id: Number(r.id), title: r.name, addedBy: r.band_name || 'A band', addedAt: r.created_at,
        sizeBytes: null, pieces: [{ title: 'Shared with the band', band: r.band_name || null }]
      })),
      ...bands.rows.map((r) => ({
        kind: 'band', id: Number(r.id), title: r.name, addedBy: r.first_name || r.surname ? fullName(r) : 'A member', addedAt: r.created_at,
        sizeBytes: null, pieces: [{ title: `${r.members} member${Number(r.members) === 1 ? '' : 's'}`, band: null }]
      }))
    ],
    removals: removals.rows.map((r) => ({
      id: Number(r.id), removedAt: r.removed_at, removedBy: r.removed_by, reason: r.reason, title: r.title, kind: r.kind,
      pieces: r.pieces, fileRemoved: r.file_removed, peopleTold: r.people_told, emailsSent: r.emails_sent
    }))
  };
}

// Removes one recording everywhere and tells the people it belonged to. `kind` and `id` are a row
// from the list above; `reason` is a key of REMOVAL_REASONS; `message` is what the members are sent,
// as the owner read and (if he wished) changed it.
export async function removeRecordingOnRequest(adminAccountId, { kind, id, reason, message }) {
  if (!Object.hasOwn(REMOVAL_REASONS, reason)) throw withStatus(400, 'Choose why it is being removed.');
  const text = String(message || '').trim();
  if (!text) throw withStatus(400, 'Write what the members will be told.');
  if (text.length > MAX_MESSAGE) throw withStatus(400, `The message can be up to ${MAX_MESSAGE} characters.`);
  if (!['rehearsal', 'piece', 'video', 'document', 'score', 'list'].includes(kind) || !/^\d+$/.test(String(id))) throw withStatus(400, 'That is not one in the list.');

  const client = await pool.connect();
  let title = '';
  let blobUrl = null;
  let moreBlobs = []; // a whole piece: every file on it
  let pieceCount = 0;
  const tell = new Set();
  try {
    await client.query('BEGIN');
    let rows = []; // the recordings on pieces that go
    let scoreIdsGone = null;
    if (kind === 'score') {
      // ML-507: a whole piece a band shares (or a public one) - its bars, recordings, documents and links
      const found = await client.query('SELECT id, title FROM scores WHERE id = $1 AND (owner_band_id IS NOT NULL OR is_public = true) FOR UPDATE', [id]);
      if (!found.rows.length) throw withStatus(404, 'That piece has already gone.');
      title = found.rows[0].title;
      const files = await client.query(
        'SELECT blob_url FROM score_recordings WHERE score_id = $1 AND blob_url IS NOT NULL UNION SELECT blob_url FROM score_documents WHERE score_id = $1', [id]);
      moreBlobs = files.rows.map((f) => f.blob_url);
      scoreIdsGone = [String(id)];
    } else if (kind === 'list') {
      // ML-511: a band's practice list. Its pieces stay - only the list goes; the band's organisers are told
      const found = await client.query('SELECT id, name, owner_band_id FROM practice_lists WHERE id = $1 AND owner_band_id IS NOT NULL FOR UPDATE', [id]);
      if (!found.rows.length) throw withStatus(404, 'That practice list has already gone.');
      title = found.rows[0].name;
      scoreIdsGone = [];
      const organisers = await client.query('SELECT account_id FROM band_members WHERE band_id = $1 AND role = ANY($2)', [found.rows[0].owner_band_id, ORGANISER_ROLES]);
      organisers.rows.forEach((o) => tell.add(String(o.account_id)));
      await client.query('DELETE FROM practice_lists WHERE id = $1', [id]); // a session planned from it keeps its history (SET NULL)
    } else if (kind === 'document') {
      const found = await client.query('SELECT id, score_id, file_name, blob_url FROM score_documents WHERE id = $1 FOR UPDATE', [id]);
      if (!found.rows.length) throw withStatus(404, 'That document has already gone.');
      title = found.rows[0].file_name;
      blobUrl = found.rows[0].blob_url;
      // the same stored file may be on other pieces: it comes off all of them
      const same = await client.query('SELECT id, score_id FROM score_documents WHERE blob_url = $1', [blobUrl]);
      scoreIdsGone = [...new Set(same.rows.map((r) => String(r.score_id)))];
      await client.query('DELETE FROM score_documents WHERE id = ANY($1)', [same.rows.map((r) => r.id)]);
    } else if (kind === 'rehearsal') {
      const found = await client.query('SELECT * FROM rehearsal_recordings WHERE id = $1 FOR UPDATE', [id]);
      if (!found.rows.length) throw withStatus(404, 'That recording has already gone.');
      title = found.rows[0].title;
      blobUrl = found.rows[0].blob_url;
      tell.add(String(found.rows[0].account_id));
      rows = (await client.query('SELECT id, score_id FROM score_recordings WHERE rehearsal_recording_id = $1 OR blob_url = $2', [id, blobUrl])).rows;
    } else {
      const found = await client.query('SELECT id, score_id, type, title, blob_url FROM score_recordings WHERE id = $1 FOR UPDATE', [id]);
      if (!found.rows.length) throw withStatus(404, 'That recording has already gone.');
      title = found.rows[0].title;
      blobUrl = found.rows[0].blob_url || null;
      // The same stored file may be on other pieces: it comes off all of them
      rows = blobUrl ? (await client.query('SELECT id, score_id FROM score_recordings WHERE blob_url = $1', [blobUrl])).rows : found.rows;
    }
    const scoreIds = scoreIdsGone || [...new Set(rows.map((r) => String(r.score_id)))];
    pieceCount = scoreIds.length;
    if (scoreIds.length) {
      // Whose pieces they were: the owner of a personal piece; a band piece's organisers and whoever added it
      const owners = await client.query(
        `SELECT s.owner_account_id, s.added_by_account_id, s.owner_band_id FROM scores s WHERE s.id = ANY($1)`, [scoreIds]);
      const bandIds = [];
      owners.rows.forEach((s) => {
        if (s.owner_account_id) tell.add(String(s.owner_account_id));
        if (s.owner_band_id) { bandIds.push(s.owner_band_id); if (s.added_by_account_id) tell.add(String(s.added_by_account_id)); }
      });
      if (bandIds.length) {
        const organisers = await client.query('SELECT account_id FROM band_members WHERE band_id = ANY($1) AND role = ANY($2)', [bandIds, ORGANISER_ROLES]);
        organisers.rows.forEach((o) => tell.add(String(o.account_id)));
      }
    }
    if (rows.length) await client.query('DELETE FROM score_recordings WHERE id = ANY($1)', [rows.map((r) => r.id)]);
    if (kind === 'rehearsal') await client.query('DELETE FROM rehearsal_recordings WHERE id = $1', [id]);
    if (kind === 'score') {
      // a practice session that names the piece keeps its history but lets go of the piece
      await client.query('UPDATE session_segments SET score_id = NULL, metronome_segment_id = NULL WHERE score_id = $1', [id]);
      await client.query('DELETE FROM scores WHERE id = $1', [id]);
    }
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    client.release();
  }

  // The file itself. It is removed whatever else happens next; if the store refuses, the page says so.
  let fileRemoved = false;
  let fileError = null;
  // A whole piece: only the files nothing else still points at (a rehearsal recording given to other pieces stays)
  let goners = blobUrl ? [blobUrl] : [];
  if (moreBlobs.length) {
    const still = await pool.query(
      'SELECT blob_url FROM score_recordings WHERE blob_url = ANY($1) UNION SELECT blob_url FROM score_documents WHERE blob_url = ANY($1) UNION SELECT blob_url FROM rehearsal_recordings WHERE blob_url = ANY($1)', [moreBlobs]);
    const used = new Set(still.rows.map((r) => r.blob_url));
    goners = moreBlobs.filter((u) => !used.has(u));
  }
  if (goners.length) {
    try { await del(goners); fileRemoved = true; } catch (error) { fileError = error.message; console.error('Removal: a stored file could not be removed:', error.message); }
  }

  // Tell the people it belonged to (not an account that has since been deleted)
  const people = tell.size
    ? (await pool.query('SELECT id, email, first_name FROM accounts WHERE id = ANY($1) AND deleted_at IS NULL', [[...tell]])).rows
    : [];
  const subject = kind === 'score' ? 'A piece has been removed' : kind === 'list' ? 'A practice list has been removed' : kind === 'document' ? 'A document has been removed' : 'A recording has been removed';
  if (people.length) await createTargetedNotification(adminAccountId, { title: subject, body: text, urgent: true }, people.map((p) => p.id));
  let emailsSent = 0;
  for (const p of people) {
    if (!p.email) continue;
    try { await sendMail({ to: p.email, subject: `Notably Better: ${subject.toLowerCase()}`, text: `Hello ${p.first_name || ''},\n\n${text}\n` }); emailsSent++; } catch (error) { console.error('Recording removal: an email could not be sent:', error.message); }
  }

  const by = (await pool.query('SELECT first_name, surname FROM accounts WHERE id = $1', [adminAccountId])).rows[0];
  await pool.query(
    'INSERT INTO recording_removals (removed_by, reason, title, kind, pieces, file_removed, people_told, emails_sent, message) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)',
    [by ? fullName(by) : '', reason, title, kind, pieceCount, fileRemoved, people.length, emailsSent, text]
  );
  return { removed: { title, pieces: pieceCount, fileRemoved, fileError, peopleTold: people.length, emailsSent }, ...(await listRecordingsForAdmin()) };
}

// ML-511: a band's name that breaks the terms. The band can't be removed - its members, pieces and
// practice lists hang off it - so the owner gives it another name and its organisers are told what
// happened, why and what to do next. Members who still had the old name on their own My bands entry
// for it get the new one too. Kept on the same record as a removal; `title` there is the name it had.
const RENAME_REASONS = ['reported', 'terms', 'other'];
const BAND_NAME_MAX = 80; // as a name on My bands
export async function renameBandOnRequest(adminAccountId, { id, name, reason, message }) {
  if (!RENAME_REASONS.includes(reason)) throw withStatus(400, 'Choose why it is being renamed.');
  const newName = String(name || '').trim();
  if (!newName) throw withStatus(400, 'Give the band its new name.');
  if (newName.length > BAND_NAME_MAX) throw withStatus(400, `A band's name can be up to ${BAND_NAME_MAX} characters.`);
  const text = String(message || '').trim();
  if (!text) throw withStatus(400, 'Write what the organisers will be told.');
  if (text.length > MAX_MESSAGE) throw withStatus(400, `The message can be up to ${MAX_MESSAGE} characters.`);
  if (!/^\d+$/.test(String(id))) throw withStatus(400, 'That is not one in the list.');

  const client = await pool.connect();
  let oldName = '';
  let tell = [];
  try {
    await client.query('BEGIN');
    const found = await client.query(`SELECT name FROM bands WHERE id = $1 AND kind = 'group' FOR UPDATE`, [id]);
    if (!found.rows.length) throw withStatus(404, 'That band has already gone.');
    oldName = found.rows[0].name;
    if (oldName === newName) throw withStatus(400, 'That is the name it has now.');
    await client.query('UPDATE bands SET name = $2 WHERE id = $1', [id, newName]);
    // each member's own entry for it, where it still carries the old name and the new one isn't already theirs
    await client.query(
      `UPDATE bands l SET name = $2
        WHERE l.kind = 'label' AND l.shared_band_id = $1 AND lower(l.name) = lower($3)
          AND NOT EXISTS (SELECT 1 FROM bands o WHERE o.kind = 'label' AND o.created_by_account_id = l.created_by_account_id
                                                   AND o.id <> l.id AND lower(o.name) = lower($2))`,
      [id, newName, oldName]);
    tell = (await client.query('SELECT account_id FROM band_members WHERE band_id = $1 AND role = ANY($2)', [id, ORGANISER_ROLES])).rows.map((o) => String(o.account_id));
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    client.release();
  }

  const people = tell.length
    ? (await pool.query('SELECT id, email, first_name FROM accounts WHERE id = ANY($1) AND deleted_at IS NULL', [tell])).rows
    : [];
  const subject = 'A band has been renamed';
  if (people.length) await createTargetedNotification(adminAccountId, { title: subject, body: text, urgent: true }, people.map((p) => p.id));
  let emailsSent = 0;
  for (const p of people) {
    if (!p.email) continue;
    try { await sendMail({ to: p.email, subject: `Notably Better: ${subject.toLowerCase()}`, text: `Hello ${p.first_name || ''},\n\n${text}\n` }); emailsSent++; } catch (error) { console.error('Band rename: an email could not be sent:', error.message); }
  }
  const by = (await pool.query('SELECT first_name, surname FROM accounts WHERE id = $1', [adminAccountId])).rows[0];
  await pool.query(
    'INSERT INTO recording_removals (removed_by, reason, title, kind, pieces, file_removed, people_told, emails_sent, message) VALUES ($1, $2, $3, $4, 0, false, $5, $6, $7)',
    [by ? fullName(by) : '', reason, oldName, 'band', people.length, emailsSent, text]
  );
  return { renamed: { from: oldName, to: newName, peopleTold: people.length, emailsSent }, ...(await listRecordingsForAdmin()) };
}
