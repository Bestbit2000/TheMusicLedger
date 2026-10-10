// ML-430: "Download my information" (Account -> My details) - everything the app holds that belongs
// to the member, as one JSON file. It answers the UK GDPR rights of access and of data portability
// without anyone having to ask. Read-only.
//
// Like deletion (accountDeletion.js), it asks the database what belongs to an account instead of
// keeping a list, so a table added later is included by default:
//   1. every table with a column that points at accounts(id) - the member's own rows;
//   2. the rows that hang off those (a piece's blocks and recordings, a session's parts, a quiz's
//      answers...) - followed down through tables that have no account column of their own, so
//      nobody else's rows can come along.
// Left out: sign-in secrets (SECRET_TABLES, and any column whose name says hash, secret or token), and
// what a super admin entered for the app as a whole (APP_OWNED, ROW_FILTER - ML-480).

import pool from '../config/db.js';

// Security material, not information to hand out in a file. What matters about them is summarised in `signIn`.
const SECRET_TABLES = new Set(['account_passwords', 'account_two_step', 'account_recovery_codes']);
const SECRET_COLUMN = /hash|secret|token/i;
// Rows that are the member's to see, but whose children belong to other people or to the app as a
// whole (a band's other members, who has read a notice): exported, not followed.
const NOT_FOLLOWED = new Set(['bands', 'band_members', 'notifications', 'security_review_runs']);
// ML-480: what a super admin enters while running the app is the app's, not that person's own information,
// even though the row records who entered it. Without this the owner's download held every band in the
// shared directory (45 of them, "created by" the account that seeded the list), the announcements he had
// written and the business's costs. An ordinary member has no such rows, so nothing changes for them.
//   APP_OWNED  - whole tables that are the app's records: left out.
//   ROW_FILTER - a table that holds both: only the rows that are the member's own are taken.
export const APP_OWNED = new Set(['notifications', 'third_party_costs', 'security_review_runs']);
// Other people's details, and the app's own workings (the owner, 7 Oct 2026):
//   OTHER_PEOPLE - invites the member sent hold the name and email address of the person invited. That is
//                  someone else's information, so it does not go in a file the member takes away.
//   HOUSEKEEPING - how the app keeps its place, not information about the member: which rest message comes
//                  next, which notices have been opened, a timer or session that is running right now, and
//                  the ids that stop something logged offline being saved twice.
export const OTHER_PEOPLE = new Set(['auth_email_links', 'band_invites']);
export const HOUSEKEEPING = new Set(['account_rest_decks', 'notification_reads', 'active_timer_sessions', 'active_practice_sessions', 'client_writes', 'admin_passkey_challenges']);
const LEFT_OUT = (table) => SECRET_TABLES.has(table) || APP_OWNED.has(table) || OTHER_PEOPLE.has(table) || HOUSEKEEPING.has(table);
export const ROW_FILTER = {
  // My bands (a member's own 'label' rows) and a shared space they set up ('group') are theirs; the band
  // directory ('directory') is a list for everyone, whoever typed it in.
  bands: "kind <> 'directory'"
};
const MAX_DEPTH = 4;

const withStatus = (status, message) => Object.assign(new Error(message), { status });
const clean = (row) => Object.fromEntries(Object.entries(row).filter(([column]) => !SECRET_COLUMN.test(column)));

// Every single-column foreign key: { tbl, col, ref } - `tbl.col` points at `ref`.id
async function foreignKeys() {
  const { rows } = await pool.query(
    `SELECT c.conrelid::regclass::text AS tbl, a.attname AS col, c.confrelid::regclass::text AS ref
       FROM pg_constraint c
       JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = c.conkey[1]
       JOIN pg_attribute r ON r.attrelid = c.confrelid AND r.attnum = c.confkey[1]
      WHERE c.contype = 'f' AND array_length(c.conkey, 1) = 1 AND r.attname = 'id'
      ORDER BY 1, 2`
  );
  return rows;
}

export async function exportMyAccount(accountId) {
  const account = (await pool.query('SELECT * FROM accounts WHERE id = $1', [accountId])).rows[0];
  if (!account || account.deleted_at) throw withStatus(404, 'Account not found.');

  const keys = await foreignKeys();
  const accountTables = new Set(keys.filter((k) => k.ref === 'accounts').map((k) => k.tbl));
  const data = {};
  const seen = new Map(); // table -> Set of ids already exported
  const add = (table, rows) => {
    if (!rows.length) return [];
    if (!seen.has(table)) { seen.set(table, new Set()); data[table] = []; }
    const fresh = rows.filter((row) => row.id === undefined || !seen.get(table).has(String(row.id)));
    for (const row of fresh) { if (row.id !== undefined) seen.get(table).add(String(row.id)); data[table].push(clean(row)); }
    return fresh;
  };

  // 1. The member's own rows
  let frontier = [];
  for (const link of keys.filter((k) => k.ref === 'accounts' && !LEFT_OUT(k.tbl))) {
    const only = ROW_FILTER[link.tbl] ? ` AND (${ROW_FILTER[link.tbl]})` : '';
    const { rows } = await pool.query(`SELECT * FROM ${link.tbl} WHERE ${link.col} = $1${only} ORDER BY 1`, [accountId]);
    const fresh = add(link.tbl, rows);
    if (fresh.length && !NOT_FOLLOWED.has(link.tbl)) frontier.push({ table: link.tbl, ids: fresh.map((r) => r.id).filter((id) => id !== undefined) });
  }

  // 2. What hangs off them, through tables with no account column of their own
  for (let depth = 0; depth < MAX_DEPTH && frontier.length; depth++) {
    const next = [];
    for (const { table, ids } of frontier) {
      if (!ids.length) continue;
      for (const child of keys.filter((k) => k.ref === table && !accountTables.has(k.tbl) && !LEFT_OUT(k.tbl))) {
        const { rows } = await pool.query(`SELECT * FROM ${child.tbl} WHERE ${child.col} = ANY($1) ORDER BY 1`, [ids]);
        const fresh = add(child.tbl, rows);
        if (fresh.length) next.push({ table: child.tbl, ids: fresh.map((r) => r.id).filter((id) => id !== undefined) });
      }
    }
    frontier = next;
  }

  const [password, twoStep] = await Promise.all([
    pool.query('SELECT 1 FROM account_passwords WHERE account_id = $1', [accountId]),
    pool.query('SELECT enabled_at FROM account_two_step WHERE account_id = $1', [accountId])
  ]);

  return {
    app: 'Notably Better',
    exportedAt: new Date().toISOString(),
    about: 'The information Notably Better holds about you. "account" is your details; "data" has one list per kind of record, named as the app stores them. Recordings and documents are listed with the address of each file, not the files themselves. Left out: passwords and sign-in codes; the name and email address of anyone you invited (that is their information, not yours); and the app\'s own workings, such as which notices you have opened.',
    account: clean(account),
    signIn: { hasPassword: password.rows.length > 0, twoStepOn: !!(twoStep.rows[0] && twoStep.rows[0].enabled_at) },
    data
  };
}
