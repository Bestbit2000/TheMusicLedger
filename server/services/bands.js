// "Organisations" (the old Sheet's Rehearsal/Performance "who") are bands
// now - see docs/sheets-to-database-cutover.md for why. Scoped by
// created_by_account_id since bands.name has no uniqueness constraint on its
// own (two accounts could each have their own band called the same thing).
//
// The functions below this point (ML-77/ML-89) are a second, unrelated use
// of the same `bands` table - a real, shared, cross-account directory with
// actual membership (band_members), for "which band do you belong to" -
// intentionally NOT scoped by created_by_account_id. See the section comment
// further down.

import pool from '../config/db.js';

function toListItem(row) {
  return { name: row.name, archived: !row.active };
}

export async function listBands(accountId) {
  const { rows } = await pool.query(
    'SELECT name, active FROM bands WHERE created_by_account_id = $1 ORDER BY name',
    [accountId]
  );
  return rows.map(toListItem);
}

export async function getOrCreateBand(accountId, name) {
  const existing = await pool.query(
    'SELECT id FROM bands WHERE created_by_account_id = $1 AND name = $2',
    [accountId, name]
  );
  if (existing.rows.length) return existing.rows[0].id;

  const inserted = await pool.query(
    'INSERT INTO bands (name, created_by_account_id) VALUES ($1, $2) RETURNING id',
    [name, accountId]
  );
  return inserted.rows[0].id;
}

export async function renameBand(accountId, oldName, newName) {
  await pool.query(
    'UPDATE bands SET name = $1 WHERE created_by_account_id = $2 AND name = $3',
    [newName, accountId, oldName]
  );
}

export async function isBandUsedInHistory(accountId, name) {
  const { rows } = await pool.query(
    `SELECT 1 FROM sessions s JOIN bands b ON b.id = s.band_id
     WHERE b.created_by_account_id = $1 AND b.name = $2 LIMIT 1`,
    [accountId, name]
  );
  return rows.length > 0;
}

// Deleting a band still referenced in session history would silently orphan
// those past sessions, so it's archived instead - kept in the list (hidden
// from new-entry pickers) rather than removed outright. Mirrors the old
// Sheet's archive-if-used behaviour exactly.
export async function archiveOrDeleteBand(accountId, name) {
  const usedInHistory = await isBandUsedInHistory(accountId, name);
  if (usedInHistory) {
    await pool.query(
      'UPDATE bands SET active = false WHERE created_by_account_id = $1 AND name = $2',
      [accountId, name]
    );
  } else {
    await pool.query(
      'DELETE FROM bands WHERE created_by_account_id = $1 AND name = $2',
      [accountId, name]
    );
  }
  return usedInHistory;
}

export async function unarchiveBand(accountId, name) {
  await pool.query(
    'UPDATE bands SET active = true WHERE created_by_account_id = $1 AND name = $2',
    [accountId, name]
  );
}

// ========================================
// Shared band directory + real membership (ML-77/ML-89) - a different
// concept from the private per-account list above, which stays exactly as-is
// for session "who" tagging (see resolveWho in routes/api.js). These query
// the same `bands` table with no created_by_account_id filter, plus the
// previously-unused `band_members` table (band_id, account_id, role - see
// db/migrations/001_identity.sql) for real cross-account membership.
// ========================================

// "The X" -> "X (The)" (ML-89) so the shared directory sorts and reads by
// the band's real name, not by the word "The".
function bandCoreName(name) {
  return /^The\s+(.+)$/i.exec(name)?.[1] ?? name;
}
function bandDisplayName(name) {
  const core = /^The\s+(.+)$/i.exec(name)?.[1];
  return core ? `${core} (The)` : name;
}
function toDirectoryBand(row) {
  return {
    id: Number(row.id),
    name: row.name,
    displayName: bandDisplayName(row.name),
    website: row.website,
    memberCount: row.member_count !== undefined ? Number(row.member_count) : undefined
  };
}
function sortByDisplayName(bands) {
  return bands.sort((a, b) => bandCoreName(a.name).localeCompare(bandCoreName(b.name)));
}

// The full shared directory (active bands only) - for the account page's
// band picker.
export async function listAllBands() {
  const { rows } = await pool.query(
    `SELECT b.id, b.name, b.website, COUNT(bm.account_id) AS member_count
     FROM bands b LEFT JOIN band_members bm ON bm.band_id = b.id
     WHERE b.active
     GROUP BY b.id`
  );
  return sortByDisplayName(rows.map(toDirectoryBand));
}

// canDelete (ML-89 follow-up): true only when this account is the band's ONLY member and it has no
// session history anywhere - i.e. deleting it wouldn't remove anyone else's membership or orphan any
// past session. Every other case is leave-only, since the band still means something to someone/
// something else. Mirrors archiveOrDeleteBand's "used in history" check above, extended to also check
// real membership (not a concern for the private per-account list, which has no such thing).
export async function getAccountBands(accountId) {
  const { rows } = await pool.query(
    `SELECT b.id, b.name, b.website, bm.role,
            (SELECT COUNT(*) FROM band_members bm2 WHERE bm2.band_id = b.id) AS total_members,
            EXISTS(SELECT 1 FROM sessions s WHERE s.band_id = b.id) AS used_in_sessions
     FROM band_members bm JOIN bands b ON b.id = bm.band_id
     WHERE bm.account_id = $1 AND b.active`,
    [accountId]
  );
  return sortByDisplayName(rows.map(r => ({
    ...toDirectoryBand(r),
    role: r.role,
    canDelete: Number(r.total_members) === 1 && !r.used_in_sessions
  })));
}

export async function joinBand(accountId, bandId) {
  await pool.query(
    `INSERT INTO band_members (band_id, account_id, role) VALUES ($1, $2, 'member')
     ON CONFLICT (band_id, account_id) DO NOTHING`,
    [bandId, accountId]
  );
}

export async function leaveBand(accountId, bandId) {
  await pool.query('DELETE FROM band_members WHERE band_id = $1 AND account_id = $2', [bandId, accountId]);
}

// The account page's "Delete" option (distinct from Leave, see getAccountBands' canDelete) - only
// permitted when re-checked server-side too (never trust the client's last-fetched canDelete flag for
// a mutating action): this account must be the band's sole member, with no session history at all.
export async function deleteBandIfSoleMember(accountId, bandId) {
  const { rows: memberRows } = await pool.query('SELECT account_id FROM band_members WHERE band_id = $1', [bandId]);
  if (memberRows.length !== 1 || Number(memberRows[0].account_id) !== Number(accountId)) {
    const e = new Error('This band has other members, so it can only be left, not deleted.'); e.status = 409; throw e;
  }
  const { rows: sessionRows } = await pool.query('SELECT 1 FROM sessions WHERE band_id = $1 LIMIT 1', [bandId]);
  if (sessionRows.length) {
    const e = new Error('This band is still referenced in session history, so it can only be left, not deleted.'); e.status = 409; throw e;
  }
  await pool.query('DELETE FROM bands WHERE id = $1', [bandId]);
}

function normalizeWebsiteUrl(input) {
  const trimmed = (input || '').trim();
  if (!trimmed) return null;
  let url;
  try {
    url = new URL(/^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`);
  } catch {
    return null;
  }
  return /^https?:$/.test(url.protocol) ? url : null;
}
function hostnameOf(url) {
  return url.hostname.replace(/^www\./i, '').toLowerCase();
}

// Adds a brand new band to the shared directory (ML-89: "if the band isn't
// in the list, you can add it - you don't have to be an admin"), then joins
// the creator to it as its first admin so a freshly-added band is never left
// with zero members able to manage it later. Website is required (it's the
// sole duplicate-detection key, per the ticket) and is checked two ways:
// reachability (a plain GET resolves, decision: reachability only - no
// attempt to judge "is this actually band-like") and duplicate-by-domain
// against every other active band's own website.
export async function createSharedBand(accountId, name, website) {
  const trimmedName = (name || '').trim();
  if (!trimmedName) {
    const e = new Error('Band name is required.'); e.status = 400; throw e;
  }
  const url = normalizeWebsiteUrl(website);
  if (!url) {
    const e = new Error('Enter a valid website address - it\'s needed to check for duplicates.'); e.status = 400; throw e;
  }

  let response;
  try {
    response = await fetch(url.toString(), { method: 'GET', redirect: 'follow', signal: AbortSignal.timeout(8000) });
  } catch {
    const e = new Error("That website couldn't be reached - check the address and try again."); e.status = 400; throw e;
  }
  if (!response.ok) {
    const e = new Error(`That website returned an error (${response.status}) - check the address and try again.`);
    e.status = 400; throw e;
  }

  const hostname = hostnameOf(url);
  const { rows: existingBands } = await pool.query(
    'SELECT id, name, website FROM bands WHERE website IS NOT NULL AND active'
  );
  const duplicate = existingBands.find(row => {
    const existingUrl = normalizeWebsiteUrl(row.website);
    return existingUrl && hostnameOf(existingUrl) === hostname;
  });
  if (duplicate) {
    const e = new Error(`"${duplicate.name}" already uses that website - pick it from the list instead.`);
    e.status = 409; throw e;
  }

  const inserted = await pool.query(
    'INSERT INTO bands (name, website, created_by_account_id) VALUES ($1, $2, $3) RETURNING id, name, website',
    [trimmedName, url.toString(), accountId]
  );
  await pool.query(
    `INSERT INTO band_members (band_id, account_id, role) VALUES ($1, $2, 'admin')
     ON CONFLICT (band_id, account_id) DO NOTHING`,
    [inserted.rows[0].id, accountId]
  );
  return toDirectoryBand(inserted.rows[0]);
}

// ---- Admin panel (ML-89: manage the shared directory - add/edit/delete,
// with each band's member count) ----

export async function listBandsForAdmin() {
  const { rows } = await pool.query(
    `SELECT b.id, b.name, b.website, b.contact_email, b.active,
            COUNT(DISTINCT bm.account_id) AS member_count
     FROM bands b LEFT JOIN band_members bm ON bm.band_id = b.id
     GROUP BY b.id
     ORDER BY b.name`
  );
  return sortByDisplayName(rows.map(r => ({ ...toDirectoryBand(r), contactEmail: r.contact_email, active: r.active })));
}

export async function updateBandAdmin(id, { name, website, contactEmail }) {
  const { rows } = await pool.query(
    'UPDATE bands SET name = $1, website = $2, contact_email = $3 WHERE id = $4 RETURNING id',
    [name, website || null, contactEmail || null, id]
  );
  if (!rows.length) { const e = new Error('Band not found'); e.status = 404; throw e; }
}

// Deleting a band still linked to a real member or referenced in session
// history would silently orphan that data, so it's archived instead - same
// archive-if-used pattern as archiveOrDeleteBand above, just checking real
// membership too, not just session history.
export async function deleteOrArchiveBandAdmin(id) {
  const [{ rows: memberRows }, { rows: sessionRows }] = await Promise.all([
    pool.query('SELECT 1 FROM band_members WHERE band_id = $1 LIMIT 1', [id]),
    pool.query('SELECT 1 FROM sessions WHERE band_id = $1 LIMIT 1', [id])
  ]);
  const inUse = memberRows.length > 0 || sessionRows.length > 0;
  if (inUse) {
    await pool.query('UPDATE bands SET active = false WHERE id = $1', [id]);
  } else {
    await pool.query('DELETE FROM bands WHERE id = $1', [id]);
  }
  return inUse;
}
