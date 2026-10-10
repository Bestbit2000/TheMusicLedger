// The bands table holds three kinds of row, told apart by bands.kind (ML-473, migration 108):
//
//   label      a band on one member's "My bands" list (ML-478; it began as the old Sheet's
//              "organisation" - docs/sheets-to-database-cutover.md). Theirs alone: scoped by
//              created_by_account_id, never listed to anyone else, never joinable. A session's
//              band_id always points at a label of the member whose session it is. A label may say
//              which directory entry it is (directory_band_id) and show a shared space the member is
//              in (shared_band_id) - see "My bands" below.
//   directory  an entry in the shared band directory (ML-77/ML-89, docs/band-directory.md): public
//              information, the same for everyone. No members; owns nothing.
//   group      a band's shared space: its members (band_members), pieces and practice lists. A member
//              sets one up for a band on their list (setUpSharing) and is its first organiser; the only way in is an organiser's invitation,
//              which also says what the new member may do - so control stays with the person who
//              started it, and nobody (the owner included) ever has to confirm who anyone is. It may
//              point at the directory entry it is the space for (directory_band_id); two groups can
//              point at the same one.
//
// Until migration 108 nothing told them apart: every member's labels were listed to everyone as bands
// anyone could join, and joining gave the run of everything a band had (site security review, ML-231).

import { publicSiteAnswers } from '../utils/publicUrl.js';
import pool from '../config/db.js';
import { accountDisplayName } from './accounts.js';
import { sendMail, emailBody, emailOutcome } from './mail.js';
import { passwordLinkForNewcomer } from './passwordAuth.js';

const fail = (status, message) => Object.assign(new Error(message), { status });

function toListItem(row) {
  return { name: row.name, archived: !row.active };
}

export async function listBands(accountId) {
  const { rows } = await pool.query(
    `SELECT name, active FROM bands WHERE created_by_account_id = $1 AND kind = 'label' ORDER BY name`,
    [accountId]
  );
  return rows.map(toListItem);
}

// What the "who" box of a rehearsal or performance offers: the member's My bands list, exactly
// (ML-478) - a hidden band is `archived`, so the box leaves it out but an old session still shows it.
export async function listWhoOptions(accountId) {
  await ensureLabels(pool, accountId);
  return listBands(accountId);
}

export async function getOrCreateBand(accountId, name) {
  const existing = await pool.query(
    `SELECT id FROM bands WHERE created_by_account_id = $1 AND name = $2 AND kind = 'label' ORDER BY id LIMIT 1`,
    [accountId, name]
  );
  if (existing.rows.length) return existing.rows[0].id;

  const inserted = await pool.query(
    `INSERT INTO bands (name, created_by_account_id, kind) VALUES ($1, $2, 'label') RETURNING id`,
    [name, accountId]
  );
  return inserted.rows[0].id;
}

export async function renameBand(accountId, oldName, newName) {
  await pool.query(
    `UPDATE bands SET name = $1 WHERE created_by_account_id = $2 AND name = $3 AND kind = 'label'`,
    [newName, accountId, oldName]
  );
}

export async function isBandUsedInHistory(accountId, name) {
  const { rows } = await pool.query(
    `SELECT 1 FROM sessions s JOIN bands b ON b.id = s.band_id
     WHERE b.created_by_account_id = $1 AND b.name = $2 AND b.kind = 'label' LIMIT 1`,
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
      `UPDATE bands SET active = false WHERE created_by_account_id = $1 AND name = $2 AND kind = 'label'`,
      [accountId, name]
    );
  } else {
    await pool.query(
      `DELETE FROM bands WHERE created_by_account_id = $1 AND name = $2 AND kind = 'label'`,
      [accountId, name]
    );
  }
  return usedInHistory;
}

export async function unarchiveBand(accountId, name) {
  await pool.query(
    `UPDATE bands SET active = true WHERE created_by_account_id = $1 AND name = $2 AND kind = 'label'`,
    [accountId, name]
  );
}

// ========================================
// The shared band directory, and a band's shared space (a group) with its members.
// ========================================

// A band is named as it's said - "The Cobham Band" (displayName) - wherever one band is named. It sorts
// by its name without "The" (ML-89), and only an A-Z list shows that form: "Cobham Band, The" (listName,
// ML-405 - it used to be "Cobham Band (The)" everywhere).
export function bandCoreName(name) {
  return /^The\s+(.+)$/i.exec(name)?.[1] ?? name;
}
export function bandListName(name) {
  const core = /^The\s+(.+)$/i.exec(name)?.[1];
  return core ? `${core}, The` : name;
}
// Migration 073: what kind of band, where it rehearses, its brass band section, the band it belongs
// to (a youth/training/second band) and any notes. All optional - older bands have none of them.
export const ENSEMBLE_TYPES = ['Brass Band', 'Concert Band', 'Wind Band', 'Youth Brass Band', 'Youth Wind Band', 'Training Band', 'Brass Ensemble', 'Massed Band'];
export const SECTION_LEVELS = ['Championship', 'First', 'Second', 'Third', 'Fourth', 'Non-contesting'];
const DETAIL_COLUMNS = `b.ensemble_type, b.town, b.county, b.rehearsal_postcode, b.section_level, b.parent_band_id, b.notes,
            (SELECT pb.name FROM bands pb WHERE pb.id = b.parent_band_id) AS parent_name`;
function toDirectoryBand(row) {
  return {
    id: Number(row.id),
    name: row.name,
    displayName: row.name,
    listName: bandListName(row.name),
    website: row.website,
    memberCount: row.member_count !== undefined ? Number(row.member_count) : undefined,
    ensembleType: row.ensemble_type ?? null,
    town: row.town ?? null,
    county: row.county ?? null,
    rehearsalPostcode: row.rehearsal_postcode ?? null,
    sectionLevel: row.section_level ?? null,
    parentBandId: row.parent_band_id ? Number(row.parent_band_id) : null,
    parentName: row.parent_name ?? null,
    notes: row.notes ?? null
  };
}
function sortByDisplayName(bands) {
  return bands.sort((a, b) => bandCoreName(a.name).localeCompare(bandCoreName(b.name)));
}

// The shared directory (active entries only) - for the account page's band picker. No member counts:
// who is in a band's space is its members' business.
export async function listAllBands() {
  const { rows } = await pool.query(
    `SELECT b.id, b.name, b.website, ${DETAIL_COLUMNS} FROM bands b WHERE b.active AND b.kind = 'directory'`
  );
  return sortByDisplayName(rows.map(toDirectoryBand));
}

// The groups an account is in. A group shows the details of the directory entry it is the space for.
// canDelete: only when this account is its ONLY member - deleting it then takes nobody else's
// membership away (its pieces and lists go with it; the screen says so).
export async function getAccountBands(accountId) {
  const { rows } = await pool.query(
    `SELECT g.id, g.name, g.directory_band_id, bm.role,
            d.website, d.ensemble_type, d.town, d.county, d.rehearsal_postcode, d.section_level, d.parent_band_id, d.notes,
            (SELECT pb.name FROM bands pb WHERE pb.id = d.parent_band_id) AS parent_name,
            (SELECT COUNT(*) FROM band_members bm2 WHERE bm2.band_id = g.id) AS member_count
       FROM band_members bm JOIN bands g ON g.id = bm.band_id
       LEFT JOIN bands d ON d.id = g.directory_band_id
      WHERE bm.account_id = $1 AND g.active AND g.kind = 'group'`,
    [accountId]
  );
  return sortByDisplayName(rows.map(r => ({
    ...toDirectoryBand(r),
    directoryBandId: r.directory_band_id ? Number(r.directory_band_id) : null,
    role: r.role,
    level: levelOf(r.role),
    isOrganiser: ORGANISER_ROLES.includes(r.role),
    canDelete: Number(r.member_count) === 1
  })));
}

// What a member of a band may do - band_members.role, set by the organiser who invited them and
// changeable by any organiser afterwards (the owner's decision, 6 Oct 2026):
//   organiser  'admin'   everything below, plus invite, remove, and set what others may do
//                        ('owner' is an older value treated the same). "Organiser" is the owner's word:
//                        "Librarian" is a real post in a band, and this may not be that person.
//   change     'member'  add pieces and practice lists to the band, and change the band's
//   play       'player'  see and play the band's pieces and lists; change nothing (they can still
//                        copy a piece into their own library, and their Levels are their own)
// flows.js and practiceLists.js enforce 'play' (BAND_CAN_CHANGE_SQL, flowPermissions.js).
const ORGANISER_ROLES = ['admin', 'owner'];
export const BAND_LEVELS = { organiser: 'admin', change: 'member', play: 'player' };
const levelOf = (role) => (ORGANISER_ROLES.includes(role) ? 'organiser' : role === 'player' ? 'play' : 'change');
const roleOfLevel = (level) => {
  if (!Object.hasOwn(BAND_LEVELS, level)) throw fail(400, 'Choose what they can do: organiser, change music, or play.');
  return BAND_LEVELS[level];
};
// (the SQL for "may change" is BAND_CAN_CHANGE_SQL in flowPermissions.js)
const INVITE_DAYS = 30;
const MAX_OPEN_INVITES = 50;
const MAX_INVITES_A_DAY = 20; // per organiser - each one sends an email to an address they typed

async function memberRole(db, accountId, bandId) {
  const { rows } = await db.query(
    `SELECT bm.role FROM band_members bm JOIN bands b ON b.id = bm.band_id
      WHERE bm.band_id = $1 AND bm.account_id = $2 AND b.kind = 'group'`,
    [bandId, accountId]
  );
  return rows.length ? rows[0].role : null;
}
// A band you aren't in doesn't exist as far as you can tell (404, not 403).
async function assertMember(db, accountId, bandId) {
  const role = await memberRole(db, accountId, bandId);
  if (!role) throw fail(404, 'Band not found');
  return role;
}
async function assertOrganiser(db, accountId, bandId) {
  const role = await assertMember(db, accountId, bandId);
  if (!ORGANISER_ROLES.includes(role)) throw fail(403, "Only the band's organisers can do that.");
}

// ========================================
// My bands (ML-478; the owner's model, 6 Oct 2026). One list of the bands a member plays with - their
// labels - and exactly what the "Who with?" box of a rehearsal or performance offers.
//   - Adding a band (from the directory, or a name of your own) makes a label and nothing else: it is
//     private to you and needs no invitation.
//   - Sharing is something a band on the list may have: label.shared_band_id is the shared space
//     (a group) whose pieces, practice lists and members show on that entry. It comes by an
//     organiser's invitation, or by a deliberate "Set up sharing" (which makes you its organiser).
//   - An invitation attaches to the band you already have: the same directory entry, or the same
//     name; otherwise the app asks once whether it is the same as one of yours (acceptBandInvite).
//   - Two names for one band can be made one (mergeMyBands: the sessions move, the other name goes),
//     and a band you don't play with now is hidden (active = false): out of the "Who with?" box, kept
//     on the history.
// A label is only ever reached through its owner (myLabel), so nothing here can show one member
// another's list.
// ========================================
const LABEL_NAME_MAX = 80;

async function myLabel(db, accountId, labelId, lock = false) {
  if (!/^\d+$/.test(String(labelId))) throw fail(404, 'Band not found');
  const { rows } = await db.query(
    `SELECT id, name, active, needs_tidy, directory_band_id, shared_band_id FROM bands
      WHERE id = $1 AND created_by_account_id = $2 AND kind = 'label'${lock ? ' FOR UPDATE' : ''}`,
    [labelId, accountId]
  );
  if (!rows.length) throw fail(404, 'Band not found');
  return rows[0];
}
// The shared space a label shows - only while its owner is still in it.
async function sharedSpaceOf(db, accountId, label) {
  if (!label.shared_band_id) return null;
  return (await memberRole(db, accountId, label.shared_band_id)) ? Number(label.shared_band_id) : null;
}
// Is this name already one of the member's bands? (However it is capitalised.)
async function labelNamed(db, accountId, name, exceptId = null) {
  const { rows } = await db.query(
    `SELECT id, directory_band_id, shared_band_id FROM bands
      WHERE created_by_account_id = $1 AND kind = 'label' AND lower(name) = lower($2) AND ($3::bigint IS NULL OR id <> $3) ORDER BY id LIMIT 1`,
    [accountId, name, exceptId]
  );
  return rows[0] || null;
}
// Keeps the list true to the memberships: a label stops showing a space its owner has left or been
// taken out of, and every space they are in shows on a label (making one if need be - a membership
// made before ML-478, or by anything that adds a member without going through an invitation).
async function ensureLabels(db, accountId) {
  await db.query(
    `UPDATE bands l SET shared_band_id = NULL
      WHERE l.kind = 'label' AND l.created_by_account_id = $1 AND l.shared_band_id IS NOT NULL
        AND NOT EXISTS (SELECT 1 FROM band_members bm WHERE bm.band_id = l.shared_band_id AND bm.account_id = $1)`,
    [accountId]
  );
  await db.query(
    `INSERT INTO bands (name, created_by_account_id, kind, directory_band_id, shared_band_id)
     SELECT CASE WHEN EXISTS (SELECT 1 FROM bands t WHERE t.kind = 'label' AND t.created_by_account_id = bm.account_id AND lower(t.name) = lower(g.name))
                 THEN g.name || ' (' || g.id || ')' ELSE g.name END,
            bm.account_id, 'label', g.directory_band_id, g.id
       FROM band_members bm JOIN bands g ON g.id = bm.band_id AND g.kind = 'group'
      WHERE bm.account_id = $1
        AND NOT EXISTS (SELECT 1 FROM bands l WHERE l.kind = 'label' AND l.created_by_account_id = bm.account_id AND l.shared_band_id = g.id)`,
    [accountId]
  );
}

// The member's bands, hidden ones included (`hidden`). `shared` is the shared space an entry shows,
// with what this member may do in it; null when the band is just a name for their own log.
// `sessions`: how many rehearsals and performances are logged with it.
export async function listMyBands(accountId) {
  await ensureLabels(pool, accountId);
  const { rows } = await pool.query(
    `SELECT l.id, l.name, l.active, l.needs_tidy, l.directory_band_id,
            d.website, d.ensemble_type, d.town, d.county, d.rehearsal_postcode, d.section_level, d.parent_band_id, d.notes,
            (SELECT pb.name FROM bands pb WHERE pb.id = d.parent_band_id) AS parent_name,
            g.id AS group_id, g.name AS group_name, bm.role,
            (SELECT COUNT(*) FROM band_members m WHERE m.band_id = g.id) AS group_members,
            (SELECT COUNT(*) FROM sessions s WHERE s.band_id = l.id) AS session_count
       FROM bands l
       LEFT JOIN bands d ON d.id = l.directory_band_id AND d.kind = 'directory'
       LEFT JOIN band_members bm ON bm.band_id = l.shared_band_id AND bm.account_id = l.created_by_account_id
       LEFT JOIN bands g ON g.id = bm.band_id AND g.kind = 'group' AND g.active
      WHERE l.created_by_account_id = $1 AND l.kind = 'label'`,
    [accountId]
  );
  return sortByDisplayName(rows.map((r) => ({
    ...toDirectoryBand(r),
    hidden: !r.active,
    needsTidy: r.needs_tidy && r.active,
    directoryBandId: r.directory_band_id ? Number(r.directory_band_id) : null,
    sessions: Number(r.session_count),
    shared: r.group_id ? {
      bandId: Number(r.group_id),
      name: r.group_name, // the name the whole band sees - the member's own entry may be called something else
      level: levelOf(r.role),
      isOrganiser: ORGANISER_ROLES.includes(r.role),
      members: Number(r.group_members),
      onlyYou: Number(r.group_members) === 1
    } : null
  })));
}

// Picking a band from the directory puts it on your list - private to you. It never puts you into a
// space someone else set up (the way into one of those is an invitation), and it no longer sets one up
// either: that is "Set up sharing". Asking again for a band you already have gives that one back
// (shown again, if it was hidden); a name you had already typed for it becomes it.
export async function addBandFromDirectory(accountId, directoryBandId) {
  if (!/^\d+$/.test(String(directoryBandId))) throw fail(404, 'That band is not in the directory.');
  const { rows } = await pool.query(`SELECT id, name, town FROM bands WHERE id = $1 AND kind = 'directory' AND active`, [directoryBandId]);
  // A group or someone's label is not something to pick: the way into a group is an invitation.
  if (!rows.length) throw fail(404, 'That band is not in the directory. To join a band someone else has set up, ask them to invite you.');
  const entry = rows[0];
  const have = await pool.query(
    `UPDATE bands SET active = true, needs_tidy = false
      WHERE id = (SELECT id FROM bands WHERE created_by_account_id = $1 AND kind = 'label' AND directory_band_id = $2 ORDER BY id LIMIT 1) RETURNING id`,
    [accountId, entry.id]
  );
  if (have.rows.length) return Number(have.rows[0].id);
  const sameName = await labelNamed(pool, accountId, entry.name);
  if (sameName && !sameName.directory_band_id) {
    await pool.query('UPDATE bands SET directory_band_id = $1, name = $2, active = true, needs_tidy = false WHERE id = $3', [entry.id, entry.name, sameName.id]);
    return Number(sameName.id);
  }
  // (two directory bands of one name, in different towns)
  const name = sameName ? `${entry.name} (${entry.town || entry.id})` : entry.name;
  const made = await pool.query(
    `INSERT INTO bands (name, created_by_account_id, kind, directory_band_id) VALUES ($1, $2, 'label', $3) RETURNING id`,
    [name, accountId, entry.id]
  );
  return Number(made.rows[0].id);
}

// A band that isn't in the directory. With a website it is added to the directory too, for the next
// player to find (createSharedBand - the address is how duplicates are caught); without one it is just
// a name on your own list. Either way it is private to you.
export async function addOwnBand(accountId, name, website) {
  const trimmed = String(name || '').trim();
  if (!trimmed) throw fail(400, 'Band name is required.');
  if (trimmed.length > LABEL_NAME_MAX) throw fail(400, `A band's name can be up to ${LABEL_NAME_MAX} letters.`);
  if (String(website || '').trim()) {
    const entry = await createSharedBand(accountId, trimmed, website, { joinCreator: false });
    return addBandFromDirectory(accountId, entry.id);
  }
  const have = await labelNamed(pool, accountId, trimmed);
  if (have) {
    await pool.query('UPDATE bands SET active = true WHERE id = $1', [have.id]);
    return Number(have.id);
  }
  const made = await pool.query(`INSERT INTO bands (name, created_by_account_id, kind) VALUES ($1, $2, 'label') RETURNING id`, [trimmed, accountId]);
  return Number(made.rows[0].id);
}

// "Set up sharing": a shared space for a band on your list, with you as its first member and
// organiser - so you can add the band's music and invite people to it. Deliberate, and separate from
// adding the band. It gives no way into anyone else's space: two members who each set up sharing for
// the same band have two spaces, and meet only by invitation. Asking again gives the same space back.
export async function setUpSharing(accountId, labelId) {
  await requireAdult(pool, accountId);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const label = await myLabel(client, accountId, labelId, true);
    let groupId = await sharedSpaceOf(client, accountId, label);
    if (!groupId) {
      const made = await client.query(
        `INSERT INTO bands (name, created_by_account_id, kind, directory_band_id) VALUES ($1, $2, 'group', $3) RETURNING id`,
        [label.name, accountId, label.directory_band_id]
      );
      groupId = Number(made.rows[0].id);
      await client.query(`INSERT INTO band_members (band_id, account_id, role) VALUES ($1, $2, 'admin')`, [groupId, accountId]);
      await client.query('UPDATE bands SET shared_band_id = $1, active = true, needs_tidy = false WHERE id = $2', [groupId, label.id]);
    }
    await client.query('COMMIT');
    return groupId;
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

// "I don't play with them now": out of the "Who with?" box. A band with rehearsals or performances
// logged is hidden (they stay on the history, under its name); one with none is simply removed.
// A shared band is left first - hiding it would leave its music with nowhere to show.
export async function hideMyBand(accountId, labelId) {
  const label = await myLabel(pool, accountId, labelId);
  if (await sharedSpaceOf(pool, accountId, label)) throw fail(409, 'This band is shared. Leave the shared band first, then you can take it off your list.');
  const { rows } = await pool.query('SELECT 1 FROM sessions WHERE band_id = $1 LIMIT 1', [label.id]);
  if (rows.length) await pool.query('UPDATE bands SET active = false, needs_tidy = false WHERE id = $1', [label.id]);
  else await pool.query('DELETE FROM bands WHERE id = $1', [label.id]);
  return { hidden: rows.length > 0 };
}
export async function showMyBand(accountId, labelId) {
  const label = await myLabel(pool, accountId, labelId);
  await pool.query('UPDATE bands SET active = true WHERE id = $1', [label.id]);
}
// "Keep as my own": it is a band of yours that isn't in the directory - nothing more to ask.
export async function keepMyBand(accountId, labelId) {
  const label = await myLabel(pool, accountId, labelId);
  await pool.query('UPDATE bands SET needs_tidy = false WHERE id = $1', [label.id]);
}

// "Same as another of mine": two names for one band become one. The rehearsals and performances
// logged with `fromId` move onto `intoId`, which also takes its directory entry and shared space if it
// has none of its own; then `fromId` goes. Two shared bands can't be made one - each has its own
// members and music.
export async function mergeMyBands(accountId, fromId, intoId) {
  if (String(fromId) === String(intoId)) throw fail(400, 'Choose a different band to merge it into.');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const from = await myLabel(client, accountId, fromId, true);
    const into = await myLabel(client, accountId, intoId, true);
    const fromShared = await sharedSpaceOf(client, accountId, from);
    const intoShared = await sharedSpaceOf(client, accountId, into);
    if (fromShared && intoShared) throw fail(409, 'Both of these are shared bands, each with its own members and music, so they can\'t be made one.');
    await client.query('UPDATE sessions SET band_id = $1 WHERE band_id = $2', [into.id, from.id]);
    await client.query('DELETE FROM bands WHERE id = $1', [from.id]);
    await client.query(
      'UPDATE bands SET shared_band_id = $1, directory_band_id = $2, active = true, needs_tidy = false WHERE id = $3',
      [intoShared || fromShared, into.directory_band_id || from.directory_band_id, into.id]
    );
    await client.query('COMMIT');
    return Number(into.id);
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

// "Same as a directory band": the name you logged becomes that band, keeping its sessions - and takes
// the band's proper name. If that band (or that name) is already on your list, the two are made one.
// Returns the entry it ended up as.
export async function linkMyBandToDirectory(accountId, labelId, directoryBandId) {
  const label = await myLabel(pool, accountId, labelId);
  if (!/^\d+$/.test(String(directoryBandId))) throw fail(404, 'That band is not in the directory.');
  const { rows } = await pool.query(`SELECT id, name FROM bands WHERE id = $1 AND kind = 'directory' AND active`, [directoryBandId]);
  if (!rows.length) throw fail(404, 'That band is not in the directory.');
  const entry = rows[0];
  const already = await pool.query(
    `SELECT id FROM bands WHERE created_by_account_id = $1 AND kind = 'label' AND directory_band_id = $2 AND id <> $3 ORDER BY id LIMIT 1`,
    [accountId, entry.id, label.id]
  );
  if (already.rows.length) return mergeMyBands(accountId, label.id, already.rows[0].id);
  const sameName = await labelNamed(pool, accountId, entry.name, label.id);
  if (sameName) await mergeMyBands(accountId, sameName.id, label.id); // (it has no directory entry, or `already` would have found it)
  await pool.query('UPDATE bands SET directory_band_id = $1, name = $2, active = true, needs_tidy = false WHERE id = $3', [entry.id, entry.name, label.id]);
  return Number(label.id);
}

// Leaving. If that leaves the group with members but no organiser, whoever has been in it longest
// becomes one - so there is always someone who can invite, remove and tidy up, and nobody outside the
// band has to appoint them.
// The last person out: an empty band goes with them (nothing is left behind that nobody can reach); one
// that still has pieces or practice lists is not left by accident - it is deleted on purpose (Delete
// band), or handed on by inviting someone first.
export async function leaveBand(accountId, bandId) {
  await assertMember(pool, accountId, bandId);
  const { rows } = await pool.query(
    `SELECT (SELECT COUNT(*) FROM band_members WHERE band_id = $1 AND account_id <> $2) AS others,
            (SELECT COUNT(*) FROM scores WHERE owner_band_id = $1) + (SELECT COUNT(*) FROM practice_lists WHERE owner_band_id = $1) AS things`,
    [bandId, accountId]
  );
  if (!Number(rows[0].others)) {
    if (Number(rows[0].things)) throw fail(409, 'You are the only one in this band, and it still has pieces or practice lists. Stop sharing (they go with it), or invite someone else first.');
    await pool.query(`DELETE FROM bands WHERE id = $1 AND kind = 'group'`, [bandId]); // (the entry on My bands stays: shared_band_id is set to null)
    return;
  }
  await pool.query('DELETE FROM band_members WHERE band_id = $1 AND account_id = $2', [bandId, accountId]);
  await ensureLabels(pool, accountId); // ML-478: the band stays on their list, as a band of their own
  await ensureOrganiser(pool, bandId);
}
async function ensureOrganiser(db, bandId) {
  await db.query(
    `UPDATE band_members m SET role = 'admin'
      WHERE m.band_id = $1
        AND NOT EXISTS (SELECT 1 FROM band_members o WHERE o.band_id = $1 AND o.role = ANY($2))
        AND m.account_id = (SELECT f.account_id FROM band_members f WHERE f.band_id = $1 ORDER BY f.joined_at, f.account_id LIMIT 1)`,
    [bandId, ORGANISER_ROLES]
  );
}

// The account page's "Delete" (distinct from Leave, see getAccountBands' canDelete) - re-checked here
// (never trust the client's last-fetched canDelete for a mutating action): a group, whose sole member
// is this account.
export async function deleteBandIfSoleMember(accountId, bandId) {
  await assertMember(pool, accountId, bandId);
  const { rows: memberRows } = await pool.query('SELECT account_id FROM band_members WHERE band_id = $1', [bandId]);
  if (memberRows.length !== 1) throw fail(409, 'This band has other members, so it can only be left, not deleted.');
  await pool.query(`DELETE FROM bands WHERE id = $1 AND kind = 'group'`, [bandId]);
}

// ---- Members and invitations (ML-473). An organiser invites, and says what the new member may do.
// An invitation is addressed to an email address; whoever signs in with that address sees it on My
// bands and says yes or no. The address is sent a short email saying so (the owner, 6 Oct 2026: most
// people invited won't be using the app yet - the email is what brings them). Its link is only the
// app's front door: nothing happens until they sign in with that address. Nothing tells the sender
// whether the address has an account. An invitation nobody answers goes after 30 days.

const cleanEmail = (email) => String(email || '').trim().toLowerCase();

// ML-479: a band shows its members to each other by name, and an invitation says who it is from. An
// account with no name on it (no display name, first name or surname) would be "A member" - which, at
// the top of an email to someone who has never heard of the app, reads like spam. So a name comes
// first: before inviting, and before joining. Never the email address (ML-473). `reason` goes to the
// app with the words, so it can offer the way to My details (sendError).
const nameOf = (row) => String(accountDisplayName({ ...row, email: null }) || '').trim();
async function requireName(db, accountId, message) {
  const { rows } = await db.query('SELECT display_name, first_name, surname FROM accounts WHERE id = $1', [accountId]);
  if (!rows.length || !nameOf(rows[0])) throw Object.assign(fail(409, message), { reason: 'needs-name' });
}
// ML-506 / ML-507: an organiser is an adult. Setting up sharing for a band, or inviting someone to
// one, is running a space other people - perhaps children - are brought into: who is invited, what
// each may do, what is shared. Before either, the member confirms once that they are 18 or over and
// responsible for the band (accounts.organiser_adult_confirmed_on). No proof is asked for. `reason`
// goes to the app with the words, so it can ask there and then (sendError).
export const ADULT_BEFORE_ORGANISING = 'Running a band\'s space is for adults. To set up sharing or invite people, confirm that you are 18 or over and responsible for this band.';
async function requireAdult(db, accountId) {
  const { rows } = await db.query('SELECT organiser_adult_confirmed_on FROM accounts WHERE id = $1', [accountId]);
  if (!rows.length || !rows[0].organiser_adult_confirmed_on) throw Object.assign(fail(409, ADULT_BEFORE_ORGANISING), { reason: 'needs-adult' });
}
export const NAME_BEFORE_INVITING = 'The invitation says who it is from, so add your name before you invite anyone. It is on My account, under My details.';
export const NAME_BEFORE_JOINING = 'Everyone in the band will see your name, so add it before you join. It is on My account, under My details.';
const purgeOldInvites = (db) => db.query(`DELETE FROM band_invites WHERE created_at < now() - make_interval(days => $1)`, [INVITE_DAYS]);

// Who is in the band and what each may do, for its members. The invitations still open are the
// organisers' to see; other members see only how many there are.
export async function listBandMembers(accountId, bandId) {
  const role = await assertMember(pool, accountId, bandId);
  await purgeOldInvites(pool);
  const isOrganiser = ORGANISER_ROLES.includes(role);
  const [{ rows: members }, { rows: invites }] = await Promise.all([
    pool.query(
      `SELECT a.id, a.display_name, a.first_name, a.surname, bm.role, bm.joined_at
         FROM band_members bm JOIN accounts a ON a.id = bm.account_id
        WHERE bm.band_id = $1 ORDER BY bm.joined_at, a.id`,
      [bandId]
    ),
    pool.query('SELECT id, email, role, created_at FROM band_invites WHERE band_id = $1 ORDER BY created_at', [bandId])
  ]);
  return {
    isOrganiser,
    yourLevel: levelOf(role),
    members: members.map((m) => ({
      accountId: Number(m.id),
      // a name, never the email address (accountDisplayName falls back to it; other members don't get it)
      name: accountDisplayName({ ...m, email: null }) || 'A member',
      level: levelOf(m.role),
      isYou: Number(m.id) === Number(accountId),
      joinedAt: m.joined_at
    })),
    invites: isOrganiser ? invites.map((i) => ({ id: Number(i.id), email: i.email, level: levelOf(i.role), sentAt: i.created_at })) : [],
    openInvites: invites.length,
    // ML-479: whether an invitation's email really goes from this site (not on dev or sandbox)
    emailsAreSent: emailOutcome().emailed
  };
}

// Only an organiser invites, and the invitation carries what the new member may do ('play' unless
// said). Inviting an address that is already waiting changes what it allows and sends nothing more -
// unless `resend`, which sends the email again and gives the invitation another 30 days.
// Returns { emailed }: false when nothing was sent - with emailFailed when it should have been, or
// notSentHere on a site that only keeps its emails (ML-479; dev and sandbox). The invitation stands
// either way, and is on their My bands page. Whoever sends the email must have a name on their account.
export async function inviteToBand(accountId, bandId, email, level = 'play', origin = '', { resend = false } = {}) {
  await assertOrganiser(pool, accountId, bandId);
  await requireAdult(pool, accountId);
  const role = roleOfLevel(level);
  const to = cleanEmail(email);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to) || to.length > 254) throw fail(400, 'Enter the email address they sign in with.');
  await purgeOldInvites(pool);
  const already = await pool.query(
    `SELECT 1 FROM band_members bm JOIN accounts a ON a.id = bm.account_id WHERE bm.band_id = $1 AND lower(a.email) = $2`,
    [bandId, to]
  );
  if (already.rows.length) throw fail(409, 'They are already in this band.');
  const open = await pool.query('SELECT COUNT(*) AS n FROM band_invites WHERE band_id = $1', [bandId]);
  if (Number(open.rows[0].n) >= MAX_OPEN_INVITES) throw fail(429, 'This band has a lot of invitations waiting. Cancel some, or wait for them to be answered.');
  const waiting = (await pool.query('SELECT 1 FROM band_invites WHERE band_id = $1 AND email = $2', [bandId, to])).rows.length > 0;
  const sending = !waiting || resend;
  if (sending) {
    await requireName(pool, accountId, NAME_BEFORE_INVITING);
    // Each email counts: a new invitation, or one sent again (which is dated today from then on)
    const today = await pool.query(
      `SELECT COUNT(*) AS n FROM band_invites WHERE invited_by_account_id = $1 AND created_at > now() - interval '24 hours' AND NOT (band_id = $2 AND email = $3)`,
      [accountId, bandId, to]);
    if (Number(today.rows[0].n) >= MAX_INVITES_A_DAY) throw fail(429, `You have invited ${MAX_INVITES_A_DAY} people in the last day - you can invite more tomorrow.`);
  }
  await pool.query(
    `INSERT INTO band_invites (band_id, email, invited_by_account_id, role) VALUES ($1, $2, $3, $4)
     ON CONFLICT (band_id, email) DO UPDATE SET role = EXCLUDED.role${resend ? ', created_at = now(), invited_by_account_id = EXCLUDED.invited_by_account_id' : ''}`,
    [bandId, to, accountId, role]
  );
  if (!sending) return { emailed: false };
  try {
    const { rows } = await pool.query(
      `SELECT g.name AS band_name, a.display_name, a.first_name, a.surname
         FROM bands g, accounts a WHERE g.id = $1 AND a.id = $2`, [bandId, accountId]);
    const from = nameOf(rows[0]); // never empty: requireName, above
    const band = rows[0].band_name;
    const home = String(origin).replace(/\/+$/, '');
    const intro = `${from} has invited you to join ${band} on Notably Better - the practice app the band uses for its music.`;
    // Someone with no account yet gets a link to choose a password (so a Google account isn't needed);
    // anyone else just needs the front door - they sign in the way they already do.
    const newcomer = await passwordLinkForNewcomer(to, home);
    const { text, html } = newcomer
      ? emailBody(['Hi,', intro,
          `You don't have an account yet. Choose a password to make one - it takes a minute - and the invitation will be waiting for you on My bands. (If ${to} is a Google address, you can sign in with Google at ${home} instead.)`],
        'Choose a password', newcomer.url,
        `The link works once, for ${newcomer.days} days; ask ${from} to send it again if it has run out. If you weren't expecting this, you can ignore it and nothing will happen.`)
      : emailBody(['Hi,', intro,
          `To see the invitation, open the app and sign in with this email address (${to}). It will be waiting on My account, under My bands.`],
        'Open Notably Better', `${home}/?band-invite=1`,
        `The invitation waits for ${INVITE_DAYS} days. If you weren't expecting it, you can ignore this email and nothing will happen.`);
    await sendMail({ to, subject: `${from} has invited you to join ${band}`, text, html });
    return emailOutcome();
  } catch (error) {
    console.error('Band invitation: the email was not sent:', error.message);
    return { emailed: false, emailFailed: true };
  }
}

export async function cancelBandInvite(accountId, bandId, inviteId) {
  await assertOrganiser(pool, accountId, bandId);
  const { rowCount } = await pool.query('DELETE FROM band_invites WHERE id = $1 AND band_id = $2', [inviteId, bandId]);
  if (!rowCount) throw fail(404, 'Invitation not found');
}

// ML-478: an invitation attaches to the band you already have. The bands on the member's list that
// show no shared space yet are the ones it could be; the same directory entry, or the same name, is
// taken to be the same band without asking.
async function unsharedLabels(db, accountId) {
  await ensureLabels(db, accountId);
  const { rows } = await db.query(
    `SELECT id, name, directory_band_id FROM bands WHERE created_by_account_id = $1 AND kind = 'label' AND shared_band_id IS NULL ORDER BY lower(name), id`,
    [accountId]
  );
  return rows;
}
const sameBand = (labels, bandName, directoryBandId) =>
  (directoryBandId && labels.find((l) => String(l.directory_band_id) === String(directoryBandId)))
  || labels.find((l) => l.name.toLowerCase() === String(bandName).toLowerCase()) || null;

// The invitations waiting for the signed-in member (matched on their own sign-in address).
// sameAs: the band on their list it will attach to; when there is none, `choices` are the bands it
// could be - the app asks once ("Is this the same band as one of yours?") before accepting.
export async function listMyBandInvites(accountId) {
  await purgeOldInvites(pool);
  const { rows } = await pool.query(
    `SELECT i.id, i.created_at, i.role, g.id AS band_id, g.name AS band_name, g.directory_band_id, s.display_name, s.first_name, s.surname
       FROM band_invites i
       JOIN accounts me ON lower(me.email) = lower(i.email)
       JOIN bands g ON g.id = i.band_id AND g.kind = 'group' AND g.active
       JOIN accounts s ON s.id = i.invited_by_account_id
      WHERE me.id = $1 ORDER BY i.created_at`,
    [accountId]
  );
  const labels = rows.length ? await unsharedLabels(pool, accountId) : [];
  const brief = (l) => ({ id: Number(l.id), name: l.name });
  return rows.map((r) => {
    const same = sameBand(labels, r.band_name, r.directory_band_id);
    return {
      id: Number(r.id), bandId: Number(r.band_id), bandName: r.band_name, level: levelOf(r.role),
      invitedBy: accountDisplayName({ ...r, email: null }) || 'A member', sentAt: r.created_at,
      sameAs: same ? brief(same) : null, choices: same ? [] : labels.map(brief)
    };
  });
}

async function myInvite(db, accountId, inviteId) {
  const { rows } = await db.query(
    `SELECT i.id, i.band_id, i.role, g.name AS band_name, g.directory_band_id, s.display_name, s.first_name, s.surname
       FROM band_invites i JOIN accounts me ON lower(me.email) = lower(i.email)
       JOIN bands g ON g.id = i.band_id AND g.kind = 'group'
       JOIN accounts s ON s.id = i.invited_by_account_id
      WHERE i.id = $1 AND me.id = $2 AND i.created_at >= now() - make_interval(days => $3)`,
    [inviteId, accountId, INVITE_DAYS]
  );
  if (!rows.length) throw fail(404, 'Invitation not found');
  return rows[0];
}
// Saying yes. `labelId` (ML-478): the band on your list this is - the answer to "Is this the same band
// as one of yours?". Left out, it attaches to the same directory entry or the same name if you have
// one, and otherwise becomes a new entry. A band of yours that already shows a shared space keeps it:
// the invitation is then a second entry, marked with who invited you.
export async function acceptBandInvite(accountId, inviteId, { labelId = null } = {}) {
  const invite = await myInvite(pool, accountId, inviteId);
  await requireName(pool, accountId, NAME_BEFORE_JOINING); // ML-479
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const labels = await unsharedLabels(client, accountId);
    let label = null;
    if (labelId !== null && labelId !== undefined) {
      label = labels.find((l) => String(l.id) === String(labelId));
      if (!label) throw fail(409, 'That band of yours can\'t take this invitation - it is already shared, or no longer on your list.');
    } else {
      label = sameBand(labels, invite.band_name, invite.directory_band_id);
    }
    await client.query(
      `INSERT INTO band_members (band_id, account_id, role) VALUES ($1, $2, $3) ON CONFLICT (band_id, account_id) DO NOTHING`,
      [invite.band_id, accountId, invite.role]
    );
    await client.query('DELETE FROM band_invites WHERE id = $1', [inviteId]);
    const shown = await client.query(
      `SELECT 1 FROM bands WHERE created_by_account_id = $1 AND kind = 'label' AND shared_band_id = $2`, [accountId, invite.band_id]);
    if (!shown.rows.length) {
      if (label) {
        // The same band: one entry, with the band's proper name unless another of yours already has it
        const taken = await labelNamed(client, accountId, invite.band_name, label.id);
        await client.query(
          `UPDATE bands SET shared_band_id = $1, directory_band_id = COALESCE(directory_band_id, $2), name = $3, active = true, needs_tidy = false WHERE id = $4`,
          [invite.band_id, invite.directory_band_id, taken ? label.name : invite.band_name, label.id]
        );
      } else {
        // A new entry. If you already have a band of that name (it shows another shared space), say whose this one is
        let name = invite.band_name;
        if (await labelNamed(client, accountId, name)) name = `${invite.band_name} (${nameOf(invite) || 'invited'})`;
        if (await labelNamed(client, accountId, name)) name = `${name} ${invite.band_id}`;
        await client.query(
          `INSERT INTO bands (name, created_by_account_id, kind, directory_band_id, shared_band_id) VALUES ($1, $2, 'label', $3, $4)`,
          [name, accountId, invite.directory_band_id, invite.band_id]
        );
      }
    }
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    client.release();
  }
  await ensureOrganiser(pool, invite.band_id); // a band everyone had left
  return Number(invite.band_id);
}
export async function declineBandInvite(accountId, inviteId) {
  await myInvite(pool, accountId, inviteId);
  await pool.query('DELETE FROM band_invites WHERE id = $1', [inviteId]);
}

// An organiser takes someone out of the band (to go yourself, leave). What they added stays with the band.
export async function removeBandMember(accountId, bandId, memberAccountId) {
  await assertOrganiser(pool, accountId, bandId);
  if (Number(memberAccountId) === Number(accountId)) throw fail(400, 'To go yourself, leave the band.');
  const { rowCount } = await pool.query('DELETE FROM band_members WHERE band_id = $1 AND account_id = $2', [bandId, memberAccountId]);
  if (!rowCount) throw fail(404, 'They are not in this band.');
  await ensureLabels(pool, memberAccountId); // ML-478: it stays on their own list, no longer shared
  await ensureOrganiser(pool, bandId);
}

// An organiser sets what a member may do - another organiser, change music, or play only (themselves
// included - stepping down - as long as one organiser is left).
export async function setBandMemberLevel(accountId, bandId, memberAccountId, level) {
  await assertOrganiser(pool, accountId, bandId);
  const role = roleOfLevel(level);
  if (level !== 'organiser') {
    const { rows } = await pool.query('SELECT COUNT(*) AS n FROM band_members WHERE band_id = $1 AND role = ANY($2) AND account_id <> $3', [bandId, ORGANISER_ROLES, memberAccountId]);
    if (!Number(rows[0].n)) throw fail(409, 'A band needs at least one organiser. Make someone else one first.');
  }
  const { rowCount } = await pool.query('UPDATE band_members SET role = $1 WHERE band_id = $2 AND account_id = $3', [role, bandId, memberAccountId]);
  if (!rowCount) throw fail(404, 'They are not in this band.');
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
// in the list, you can add it - you don't have to be an admin"), and (joinCreator) puts it on the
// creator's own My bands list - privately; it sets up no shared space (ML-478). Website is required (it's the
// sole duplicate-detection key, per the ticket) and is checked two ways:
// reachability (a plain GET resolves, decision: reachability only - no
// attempt to judge "is this actually band-like") and duplicate-by-domain
// against every other active band's own website.
// joinCreator: false (ML-247) for the admin panel - a super admin adding a band to the directory
// isn't joining it, and the phantom membership made an immediate delete archive the band instead
// ("it has a member"). The account page's own "add a band" goes through addOwnBand, which adds it to the member's list.
export async function createSharedBand(accountId, name, website, { joinCreator = true } = {}) {
  const trimmedName = (name || '').trim();
  if (!trimmedName) {
    const e = new Error('Band name is required.'); e.status = 400; throw e;
  }
  const url = normalizeWebsiteUrl(website);
  if (!url) {
    const e = new Error('Enter a valid website address - it\'s needed to check for duplicates.'); e.status = 400; throw e;
  }

  // ML-231: the address is a member's, so it is only ever fetched if it is on the public internet (not
  // this server or a private network - server/utils/publicUrl.js), and nothing about the answer is
  // passed back but whether there was one. It used to be fetched as typed, following any redirect,
  // and the status code was echoed - which let a member use the server to probe other machines.
  if (!(await publicSiteAnswers(url))) {
    const e = new Error("That website couldn't be reached - check the address and try again."); e.status = 400; throw e;
  }

  const hostname = hostnameOf(url);
  const { rows: existingBands } = await pool.query(
    `SELECT id, name, website FROM bands WHERE website IS NOT NULL AND active AND kind = 'directory'`
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
    `INSERT INTO bands (name, website, created_by_account_id, kind) VALUES ($1, $2, $3, 'directory') RETURNING id, name, website`,
    [trimmedName, url.toString(), accountId]
  );
  // The member who adds a band to the directory has it on their own list (private - ML-478).
  if (joinCreator) await addBandFromDirectory(accountId, inserted.rows[0].id);
  return toDirectoryBand(inserted.rows[0]);
}

// ---- Admin panel (ML-89: manage the shared directory - add/edit/delete,
// with each band's member count) ----

// The directory only: a member's labels are theirs, and a band's space is its members' (ML-473).
// memberCount / groupCount: how many people have a space for this entry, across how many spaces.
export async function listBandsForAdmin() {
  const { rows } = await pool.query(
    `SELECT b.id, b.name, b.website, b.contact_email, b.active, ${DETAIL_COLUMNS},
            (SELECT COUNT(DISTINCT bm.account_id) FROM bands g JOIN band_members bm ON bm.band_id = g.id WHERE g.directory_band_id = b.id) AS member_count,
            (SELECT COUNT(*) FROM bands g WHERE g.directory_band_id = b.id) AS group_count
       FROM bands b
      WHERE b.kind = 'directory'
      ORDER BY b.name`
  );
  return sortByDisplayName(rows.map(r => ({ ...toDirectoryBand(r), contactEmail: r.contact_email, active: r.active, groupCount: Number(r.group_count), sessionCount: 0 })));
}

export async function updateBandAdmin(id, { name, website, contactEmail, ...details }) {
  const { rows } = await pool.query(
    `UPDATE bands SET name = $1, website = $2, contact_email = $3 WHERE id = $4 AND kind = 'directory' RETURNING id`,
    [name, website || null, contactEmail || null, id]
  );
  if (!rows.length) { const e = new Error('Band not found'); e.status = 404; throw e; }
  await setBandDetails(id, details);
}

// Migration 073's details, from the admin panel. Blank means "not known".
export async function setBandDetails(id, { ensembleType, town, county, rehearsalPostcode, sectionLevel, parentBandId, notes } = {}) {
  const text = (v, max) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null);
  const bad = (msg) => { const e = new Error(msg); e.status = 400; return e; };
  const type = text(ensembleType, 40);
  if (type && !ENSEMBLE_TYPES.includes(type)) throw bad('Unknown kind of band.');
  const section = text(sectionLevel, 20);
  if (section && !SECTION_LEVELS.includes(section)) throw bad('Unknown section.');
  const parent = parentBandId ? Number(parentBandId) : null;
  if (parent !== null) {
    if (!Number.isInteger(parent) || parent === Number(id)) throw bad("A band can't belong to itself.");
    const { rows } = await pool.query(`SELECT parent_band_id FROM bands WHERE id = $1 AND kind = 'directory'`, [parent]);
    if (!rows.length) throw bad("That main band isn't in the directory.");
    // One level only: a training band belongs to the main band, not to its youth band.
    if (rows[0].parent_band_id !== null) throw bad('That band belongs to another band itself - pick the main one.');
  }
  const postcode = text(rehearsalPostcode, 10);
  await pool.query(
    `UPDATE bands SET ensemble_type = $1, town = $2, county = $3, rehearsal_postcode = $4, section_level = $5,
            parent_band_id = $6, notes = $7 WHERE id = $8 AND kind = 'directory'`,
    [type, text(town, 80), text(county, 80), postcode && postcode.toUpperCase(), section, parent, text(notes, 500), id]
  );
}

// Deleting a directory entry a band's space points at would leave that space with no details, so it
// is archived instead (hidden from the picker; the spaces carry on). Returns the counts so the admin
// panel can say why.
export async function deleteOrArchiveBandAdmin(id) {
  const { rows } = await pool.query(
    `SELECT COUNT(DISTINCT g.id) AS groups, COUNT(DISTINCT bm.account_id) AS members
       FROM bands g LEFT JOIN band_members bm ON bm.band_id = g.id WHERE g.directory_band_id = $1`,
    [id]
  );
  const memberCount = Number(rows[0].members);
  const archived = Number(rows[0].groups) > 0;
  if (archived) await pool.query(`UPDATE bands SET active = false WHERE id = $1 AND kind = 'directory'`, [id]);
  else await pool.query(`DELETE FROM bands WHERE id = $1 AND kind = 'directory'`, [id]);
  return { archived, memberCount, sessionCount: 0 };
}
