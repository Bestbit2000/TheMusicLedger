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

const ORGANISER_ROLES = ['admin', 'owner']; // as bands.js
export const REMOVAL_REASONS = {
  person: 'Someone who is in the recording asked for it to be removed',
  copyright: "It may be someone else's copyright",
  other: 'Another reason'
};
const MAX_MESSAGE = 2000;
const fullName = (r) => [r.first_name, r.surname].filter(Boolean).join(' ').trim() || 'A member';

// Every recording and video held, newest first: a whole rehearsal in the Recordings tool (with the
// pieces it has been given to), a recording put straight on a piece, and a YouTube link.
export async function listRecordingsForAdmin() {
  const [rehearsals, cuts, direct, removals] = await Promise.all([
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
    pool.query('SELECT * FROM recording_removals ORDER BY removed_at DESC, id DESC LIMIT 100')
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
  if (!['rehearsal', 'piece', 'video'].includes(kind) || !/^\d+$/.test(String(id))) throw withStatus(400, 'That recording is not one in the list.');

  const client = await pool.connect();
  let title = '';
  let blobUrl = null;
  let pieceCount = 0;
  const tell = new Set();
  try {
    await client.query('BEGIN');
    let rows; // the recordings on pieces that go
    if (kind === 'rehearsal') {
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
    const scoreIds = [...new Set(rows.map((r) => String(r.score_id)))];
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
  if (blobUrl) {
    try { await del([blobUrl]); fileRemoved = true; } catch (error) { fileError = error.message; console.error('Recording removal: the stored file could not be removed:', error.message); }
  }

  // Tell the people it belonged to (not an account that has since been deleted)
  const people = tell.size
    ? (await pool.query('SELECT id, email, first_name FROM accounts WHERE id = ANY($1) AND deleted_at IS NULL', [[...tell]])).rows
    : [];
  const subject = 'A recording has been removed';
  if (people.length) await createTargetedNotification(adminAccountId, { title: subject, body: text, urgent: true }, people.map((p) => p.id));
  let emailsSent = 0;
  for (const p of people) {
    if (!p.email) continue;
    try { await sendMail({ to: p.email, subject: `The Music Ledger: ${subject.toLowerCase()}`, text: `Hello ${p.first_name || ''},\n\n${text}\n` }); emailsSent++; } catch (error) { console.error('Recording removal: an email could not be sent:', error.message); }
  }

  const by = (await pool.query('SELECT first_name, surname FROM accounts WHERE id = $1', [adminAccountId])).rows[0];
  await pool.query(
    'INSERT INTO recording_removals (removed_by, reason, title, kind, pieces, file_removed, people_told, emails_sent, message) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)',
    [by ? fullName(by) : '', reason, title, kind, pieceCount, fileRemoved, people.length, emailsSent, text]
  );
  return { removed: { title, pieces: pieceCount, fileRemoved, fileError, peopleTold: people.length, emailsSent }, ...(await listRecordingsForAdmin()) };
}
