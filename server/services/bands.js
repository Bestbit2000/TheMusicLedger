// The bands table holds three kinds of row, told apart by bands.kind (ML-473, migration 108):
//
//   label      one member's own name for who a rehearsal or performance was with (the old Sheet's
//              "organisation" - docs/sheets-to-database-cutover.md). Theirs alone: scoped by
//              created_by_account_id, never listed to anyone else, never joinable. A session's
//              band_id always points at a label of the member whose session it is.
//   directory  an entry in the shared band directory (ML-77/ML-89, docs/band-directory.md): public
//              information, the same for everyone. No members; owns nothing.
//   group      a band's shared space: its members (band_members), pieces and practice lists. A member
//              starts one and is its first organiser; the only way in is an organiser's invitation,
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

// What the "who" box of a rehearsal or performance offers: the member's own labels, and the names of
// the bands they are in (picking one makes a label of that name the first time - getOrCreateBand).
export async function listWhoOptions(accountId) {
  const labels = await listBands(accountId);
  const { rows } = await pool.query(
    `SELECT DISTINCT b.name FROM band_members bm JOIN bands b ON b.id = bm.band_id
      WHERE bm.account_id = $1 AND b.kind = 'group' AND b.active`,
    [accountId]
  );
  const have = new Set(labels.map((l) => l.name));
  const extra = rows.filter((r) => !have.has(r.name)).map((r) => ({ name: r.name, archived: false }));
  return [...labels, ...extra].sort((a, b) => a.name.localeCompare(b.name));
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

// Starts a group for a directory entry, with the caller as its first member and organiser. Starting
// one gives no way into anyone else's: a second member who picks the same band gets a space of their
// own, and the two meet only by invitation. Asking again for a band you already have a space for
// gives that space back.
export async function startBandGroup(accountId, directoryBandId) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(`SELECT id, name FROM bands WHERE id = $1 AND kind = 'directory' AND active`, [directoryBandId]);
    // A group or someone's label is not something to pick: the way into a group is an invitation.
    if (!rows.length) throw fail(404, 'That band is not in the directory. To join a band someone else has set up, ask them to invite you.');
    const mine = await client.query(
      `SELECT g.id FROM bands g JOIN band_members bm ON bm.band_id = g.id
        WHERE g.directory_band_id = $1 AND g.kind = 'group' AND bm.account_id = $2 ORDER BY g.id LIMIT 1`,
      [directoryBandId, accountId]
    );
    let groupId = mine.rows.length ? mine.rows[0].id : null;
    if (!groupId) {
      const made = await client.query(
        `INSERT INTO bands (name, created_by_account_id, kind, directory_band_id) VALUES ($1, $2, 'group', $3) RETURNING id`,
        [rows[0].name, accountId, directoryBandId]
      );
      groupId = made.rows[0].id;
      await client.query(`INSERT INTO band_members (band_id, account_id, role) VALUES ($1, $2, 'admin')`, [groupId, accountId]);
    }
    await client.query('COMMIT');
    return Number(groupId);
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    client.release();
  }
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
    if (Number(rows[0].things)) throw fail(409, 'You are the only one in this band, and it still has pieces or practice lists. Delete the band (they go with it), or invite someone else first.');
    await pool.query(`DELETE FROM bands WHERE id = $1 AND kind = 'group'`, [bandId]);
    return;
  }
  await pool.query('DELETE FROM band_members WHERE band_id = $1 AND account_id = $2', [bandId, accountId]);
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
    const intro = `${from} has invited you to join ${band} on The Music Ledger - the practice app the band uses for its music.`;
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
        'Open The Music Ledger', `${home}/?band-invite=1`,
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

// The invitations waiting for the signed-in member (matched on their own sign-in address).
export async function listMyBandInvites(accountId) {
  await purgeOldInvites(pool);
  const { rows } = await pool.query(
    `SELECT i.id, i.created_at, i.role, g.id AS band_id, g.name AS band_name, s.display_name, s.first_name, s.surname
       FROM band_invites i
       JOIN accounts me ON lower(me.email) = lower(i.email)
       JOIN bands g ON g.id = i.band_id AND g.kind = 'group' AND g.active
       JOIN accounts s ON s.id = i.invited_by_account_id
      WHERE me.id = $1 ORDER BY i.created_at`,
    [accountId]
  );
  return rows.map((r) => ({
    id: Number(r.id), bandId: Number(r.band_id), bandName: r.band_name, level: levelOf(r.role),
    invitedBy: accountDisplayName({ ...r, email: null }) || 'A member', sentAt: r.created_at
  }));
}

async function myInvite(db, accountId, inviteId) {
  const { rows } = await db.query(
    `SELECT i.id, i.band_id, i.role FROM band_invites i JOIN accounts me ON lower(me.email) = lower(i.email)
      WHERE i.id = $1 AND me.id = $2 AND i.created_at >= now() - make_interval(days => $3)`,
    [inviteId, accountId, INVITE_DAYS]
  );
  if (!rows.length) throw fail(404, 'Invitation not found');
  return rows[0];
}
export async function acceptBandInvite(accountId, inviteId) {
  const invite = await myInvite(pool, accountId, inviteId);
  await requireName(pool, accountId, NAME_BEFORE_JOINING); // ML-479
  await pool.query(
    `INSERT INTO band_members (band_id, account_id, role) VALUES ($1, $2, $3) ON CONFLICT (band_id, account_id) DO NOTHING`,
    [invite.band_id, accountId, invite.role]
  );
  await pool.query('DELETE FROM band_invites WHERE id = $1', [inviteId]);
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
// in the list, you can add it - you don't have to be an admin"), then joins
// the creator to it as its first admin so a freshly-added band is never left
// with zero members able to manage it later. Website is required (it's the
// sole duplicate-detection key, per the ticket) and is checked two ways:
// reachability (a plain GET resolves, decision: reachability only - no
// attempt to judge "is this actually band-like") and duplicate-by-domain
// against every other active band's own website.
// joinCreator: false (ML-247) for the admin panel - a super admin adding a band to the directory
// isn't joining it, and the phantom membership made an immediate delete archive the band instead
// ("it has a member"). The account page's own "add a band" still joins, since that's the point there.
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
  // The member who adds a band to the directory gets a space for it, as its first organiser.
  if (joinCreator) await startBandGroup(accountId, inserted.rows[0].id);
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
