// ML-430: "Delete my account" - the member does it themselves, and it happens at once.
// What is scrubbed, what is deleted and what is kept is decided here and described to the member in
// the privacy policy (public/privacy.html) and to developers in docs/account-deletion.md. Keep the
// three in step.
//
// The accounts row stays, anonymised: 39 tables cascade from it, so removing it would take the
// practice history too, and the owner wants that kept as statistics with nobody attached.
//
// Deletion is the default. Every table that points at an account is found from the database itself,
// and its rows are deleted unless the table is named in KEPT below - so a table added later is
// cleared without anyone remembering to list it here.

import { del } from '@vercel/blob';
import pool from '../config/db.js';
import { deletedEmailHash, forgetTokenVersion } from './tokenVersions.js';
import { forgetAccountLevel } from './accounts.js';

// Tables whose rows stay attached to the anonymised account: the statistics, and the bands the
// member started (a band carries on for its other members).
const KEPT = new Set(['sessions', 'theory_quiz_attempts', 'drill_attempts', 'flow_authoring_sessions', 'bands']);
const MARKER_DAYS = 31; // login tokens last 30

const withStatus = (status, message) => Object.assign(new Error(message), { status });
export const anonymisedEmail = (accountId) => `deleted-${accountId}@deleted.invalid`;

// Every column that points at accounts(id), with what the database would do on a delete.
async function accountLinks(client) {
  const { rows } = await client.query(
    `SELECT c.conrelid::regclass::text AS tbl, a.attname AS col, c.confdeltype = 'n' AS sets_null
       FROM pg_constraint c
       JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = c.conkey[1]
      WHERE c.contype = 'f' AND c.confrelid = 'accounts'::regclass
      ORDER BY 1, 2`
  );
  return rows;
}

export async function deleteMyAccount(accountId) {
  const client = await pool.connect();
  let email;
  let blobUrls = [];
  try {
    await client.query('BEGIN');
    const { rows } = await client.query('SELECT email, account_level, token_version, deleted_at FROM accounts WHERE id = $1 FOR UPDATE', [accountId]);
    if (!rows.length || rows[0].deleted_at) throw withStatus(404, 'That account has already been deleted.');
    // A super admin owns the public library and runs the app - that account isn't one to remove by a button.
    if (rows[0].account_level === 'super_admin') throw withStatus(403, "A super admin account can't be deleted here. Change its account type first.");
    email = rows[0].email;
    const nextVersion = Number(rows[0].token_version) + 1;

    // The member's own pieces go, with their files. Blob storage doesn't hear about a database delete,
    // so the addresses are collected now and the files removed once the delete has gone through.
    const files = await client.query(
      `SELECT r.blob_url FROM score_recordings r JOIN scores s ON s.id = r.score_id WHERE s.owner_account_id = $1 AND r.blob_url IS NOT NULL
       UNION ALL
       SELECT d.blob_url FROM score_documents d JOIN scores s ON s.id = d.score_id WHERE s.owner_account_id = $1 AND d.blob_url IS NOT NULL`,
      [accountId]
    );
    blobUrls = files.rows.map((r) => r.blob_url);

    // The sessions are kept, but a line in one that names a piece or block about to go would stop that delete.
    await client.query(
      `UPDATE session_segments SET score_id = NULL, metronome_segment_id = NULL
        WHERE (score_id IS NOT NULL OR metronome_segment_id IS NOT NULL)
          AND (session_id IN (SELECT id FROM sessions WHERE account_id = $1)
               OR score_id IN (SELECT id FROM scores WHERE owner_account_id = $1))`,
      [accountId]
    );

    for (const link of await accountLinks(client)) {
      if (link.sets_null) await client.query(`UPDATE ${link.tbl} SET ${link.col} = NULL WHERE ${link.col} = $1`, [accountId]);
      else if (!KEPT.has(link.tbl)) await client.query(`DELETE FROM ${link.tbl} WHERE ${link.col} = $1`, [accountId]);
    }

    // The address itself, where it is held without a link to the account
    await client.query('DELETE FROM auth_email_links WHERE lower(email) = lower($1)', [email]);
    await client.query('DELETE FROM email_outbox WHERE lower(to_email) = lower($1)', [email]);
    await client.query(
      `UPDATE tutors SET display_name = 'Deleted account', first_name = 'Deleted', surname = 'account', email = $2, active = false WHERE lower(email) = lower($1)`,
      [email, anonymisedEmail(accountId)]
    );

    await client.query(
      `UPDATE accounts SET email = $2, first_name = 'Deleted', surname = 'account', display_name = NULL, avatar = NULL,
              account_level = 'standard_member', home_tools = NULL, home_stats = NULL, display_prefs = DEFAULT,
              practice_year_enabled = DEFAULT, practice_year_start_month = DEFAULT, practice_year_start_day = DEFAULT,
              practice_sub_beats_below = DEFAULT, token_version = $3, last_seen_on = NULL, deleted_at = now()
        WHERE id = $1`,
      [accountId, anonymisedEmail(accountId), nextVersion]
    );

    await client.query(`DELETE FROM deleted_account_markers WHERE deleted_at < now() - interval '${MARKER_DAYS} days'`);
    await client.query(
      `INSERT INTO deleted_account_markers (email_hash, token_version) VALUES ($1, $2)
       ON CONFLICT (email_hash) DO UPDATE SET token_version = GREATEST(deleted_account_markers.token_version, EXCLUDED.token_version), deleted_at = now()`,
      [deletedEmailHash(email), nextVersion]
    );
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    client.release();
  }

  forgetTokenVersion(email);
  forgetAccountLevel(accountId);
  // The account is gone whatever happens here; a file that can't be removed is logged for the owner.
  if (blobUrls.length) {
    try { await del(blobUrls); } catch (error) { console.error(`Account deletion: ${blobUrls.length} stored file(s) could not be removed:`, error.message); }
  }
  return { deleted: true, filesRemoved: blobUrls.length };
}
