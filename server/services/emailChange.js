// ML-465: changing the email address an account uses.
//
// The address is the account's identity: Google sign-in and email + password both find the account by
// it, sign-in tokens carry it, and band invitations are addressed to it. So changing it is not editing
// a field - the new address has to be proved first, and everything keyed to the old one moves with it.
// The owner's decision (6 Oct 2026), the same for both ways of signing in:
//
//   1. The member types the new address on My details (one who signs in with a password gives it too).
//      An address that already has an account is refused.
//   2. A link goes to the NEW address and works once, for an hour. Nothing changes until it is used.
//   3. Using it (a button, on a screen that says what will happen) swaps the address, signs the member
//      out everywhere, moves any band invitations waiting for the old address, and ends every other
//      emailed link for either address. The OLD address is told it happened.
//   4. They sign in again with the new address - with Google, the Google account for that address.
//   A super admin can start the same thing for someone who has lost the old address (Admin ->
//   Accounts); the link still goes to the new address, so it is still the inbox that proves it.
//
// Signed out everywhere: the account's token_version goes up, and the OLD address is left a marker
// (deleted_account_markers - the same table a deleted account leaves one in) so a sign-in token that
// still names the old address is refused rather than quietly starting a new, empty account
// (getOrCreateAccount). docs/password-login.md, "Changing your email address".
import crypto from 'node:crypto';
import pool from '../config/db.js';
import { sendMail, emailBody, emailOutcome } from './mail.js';
import { verifyPassword } from './passwords.js';
import { deletedEmailHash, forgetTokenVersion } from './tokenVersions.js';
import { limitCalls } from './passwordAuth.js';
import { verifyToken } from '../utils/authToken.js';

export const CHANGE_MINUTES = 60;
const PURPOSE = 'change-email';
const fail = (status, message) => Object.assign(new Error(message), { status });
const clean = (e) => String(e || '').trim().toLowerCase();
const looksLikeEmail = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) && e.length <= 254;
const hash = (secret) => crypto.createHash('sha256').update(String(secret)).digest('hex');

// An address with most of its name hidden: "an***@gmail.com". Shown where the reader may not be the
// member - an email to an address that was typed, and the screen a link opens.
export function maskEmail(email) {
  const [name, domain] = String(email || '').split('@');
  if (!domain) return '***';
  return `${name.slice(0, Math.min(2, Math.max(1, name.length - 1)))}***@${domain}`;
}

async function accountFor(db, accountId, lock = false) {
  const { rows } = await db.query(
    `SELECT a.id, a.email, a.first_name, a.token_version, p.password_hash
       FROM accounts a LEFT JOIN account_passwords p ON p.account_id = a.id
      WHERE a.id = $1 AND a.deleted_at IS NULL${lock ? ' FOR UPDATE OF a' : ''}`, [accountId]);
  if (!rows.length) throw fail(404, 'Account not found.');
  return rows[0];
}
const taken = async (db, email) => (await db.query('SELECT 1 FROM accounts WHERE lower(email) = $1', [email])).rows.length > 0;

// A new address that is one, and isn't the one the account has (checked before anything is counted or sent)
function newAddress(account, newEmail) {
  const to = clean(newEmail);
  if (!looksLikeEmail(to)) throw fail(400, 'Enter a valid email address.');
  if (to === clean(account.email)) throw fail(400, 'That is the address the account already uses.');
  return to;
}

// Makes the link and emails it to the new address. Returns { sentTo, emailed | notSentHere }.
async function start(account, newEmail, origin, { startedBy, byAdmin = false }) {
  const to = newAddress(account, newEmail);
  if (await taken(pool, to)) throw fail(409, 'That address already has an account here, so it can\'t be used.');
  const secret = crypto.randomBytes(32).toString('base64url');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // One request at a time: an earlier link for this account stops working. Old ones are cleared.
    await client.query(`UPDATE auth_email_links SET used_at = now() WHERE purpose = $1 AND for_account_id = $2 AND used_at IS NULL`, [PURPOSE, account.id]);
    await client.query(`DELETE FROM auth_email_links WHERE purpose = $1 AND expires_at < now() - interval '1 day'`, [PURPOSE]);
    await client.query(
      `INSERT INTO auth_email_links (purpose, token_hash, email, for_account_id, created_by_account_id, expires_at)
       VALUES ($1, $2, $3, $4, $5, now() + make_interval(mins => $6))`,
      [PURPOSE, hash(secret), to, account.id, startedBy, CHANGE_MINUTES]);
    const hello = `Hi${account.first_name ? ` ${account.first_name}` : ''},`;
    const { text, html } = emailBody(
      [hello,
        byAdmin
          ? `The Notably Better team has been asked to change the email address on your account (${maskEmail(account.email)}) to this one.`
          : `You asked to use this address to sign in to Notably Better, in place of ${maskEmail(account.email)}.`,
        'Nothing changes until you confirm it. When you do, you are signed out everywhere and sign in again with this address.'],
      'Confirm my new email address', `${String(origin).replace(/\/+$/, '')}/?change-email=${secret}`,
      `The link works once, for ${CHANGE_MINUTES} minutes. If you didn't ask for this, ignore this email and nothing will change.`);
    await sendMail({ to, subject: 'Confirm your new email address for Notably Better', text, html });
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    client.release();
  }
  return { sentTo: to, minutes: CHANGE_MINUTES, ...emailOutcome() };
}

// The member asks, from My details. Someone who signs in with a password gives it - being signed in
// on a phone left on a table is not enough to move the account. (With Google only, being signed in is
// what there is; the new inbox still has to confirm.) Five requests a day.
export async function requestEmailChange(accountId, newEmail, password, origin) {
  const account = await accountFor(pool, accountId);
  newAddress(account, newEmail); // a slip of the fingers doesn't use up one of the five
  await limitCalls('change-email', accountId); // before the password and "already has an account": both could be guessed at
  if (account.password_hash) {
    if (!password) throw fail(400, 'Enter your password to change your email address.');
    if (!(await verifyPassword(String(password), account.password_hash))) throw fail(401, 'That password isn\'t right.');
  }
  return start(account, newEmail, origin, { startedBy: account.id });
}

// A super admin asks for someone who has lost access to their old address. The link still goes to the
// new address: the inbox proves it, not the admin.
export async function adminRequestEmailChange(adminAccountId, accountId, newEmail, origin) {
  const account = await accountFor(pool, accountId);
  return start(account, newEmail, origin, { startedBy: adminAccountId, byAdmin: true });
}

async function liveLink(db, secret, lock = false) {
  const { rows } = await db.query(
    `SELECT id, email, for_account_id FROM auth_email_links
      WHERE token_hash = $1 AND purpose = $2 AND used_at IS NULL AND expires_at > now()${lock ? ' FOR UPDATE' : ''}`,
    [hash(secret || ''), PURPOSE]);
  return rows[0] || null;
}
const GONE = 'This link has expired or already been used. Ask for a new one from My details.';

// What the link will do, for the screen it opens: the old address (mostly hidden) and the new one.
export async function describeEmailChange(secret) {
  const link = await liveLink(pool, secret);
  if (!link) throw fail(404, GONE);
  const account = await accountFor(pool, link.for_account_id).catch(() => null);
  if (!account) throw fail(404, GONE);
  return { from: maskEmail(account.email), to: link.email };
}

// The change itself. `signedInToken`: the sign-in token of the device confirming, if it has one - only
// to say whether that device was signed in as this account (so it can keep its offline copy).
export async function confirmEmailChange(secret, origin, signedInToken = null) {
  const client = await pool.connect();
  let oldEmail; let newEmail; let firstName;
  try {
    await client.query('BEGIN');
    const link = await liveLink(client, secret, true);
    if (!link) throw fail(404, GONE);
    const account = await accountFor(client, link.for_account_id, true).catch(() => null);
    if (!account) throw fail(404, GONE);
    oldEmail = account.email; newEmail = link.email; firstName = account.first_name;
    if (await taken(client, newEmail)) throw fail(409, 'That address now has an account of its own, so it can\'t be used. Nothing has changed.');

    // Signed out everywhere. The new address may itself carry a marker (an account deleted from it
    // in the last month): the number must not go below what that left.
    const oldMarker = deletedEmailHash(oldEmail); const newMarker = deletedEmailHash(newEmail);
    const left = await client.query('SELECT token_version FROM deleted_account_markers WHERE email_hash = $1', [newMarker]);
    const next = Math.max(Number(account.token_version) + 1, left.rows.length ? Number(left.rows[0].token_version) : 0);
    await client.query('UPDATE accounts SET email = $1, token_version = $2 WHERE id = $3', [newEmail, next, account.id]);
    await client.query('DELETE FROM deleted_account_markers WHERE email_hash = $1', [newMarker]);
    // The old address: a token that still names it is refused (and can't start a fresh account)
    await client.query(
      `INSERT INTO deleted_account_markers (email_hash, token_version) VALUES ($1, $2)
       ON CONFLICT (email_hash) DO UPDATE SET token_version = GREATEST(deleted_account_markers.token_version, EXCLUDED.token_version), deleted_at = now()`,
      [oldMarker, next]);

    // Band invitations waiting for the old address follow the member (unless the new one has the same)
    await client.query(
      `UPDATE band_invites i SET email = $2 WHERE lower(i.email) = lower($1)
          AND NOT EXISTS (SELECT 1 FROM band_invites x WHERE x.band_id = i.band_id AND lower(x.email) = lower($2))`,
      [oldEmail, newEmail]);
    await client.query('DELETE FROM band_invites WHERE lower(email) = lower($1)', [oldEmail]);
    // Every other emailed link for either address stops working (this one included)
    await client.query(
      `UPDATE auth_email_links SET used_at = now() WHERE used_at IS NULL AND (lower(email) IN (lower($1), lower($2)) OR for_account_id = $3)`,
      [oldEmail, newEmail, account.id]);
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    client.release();
  }
  forgetTokenVersion(oldEmail);
  forgetTokenVersion(newEmail);

  // The old address is told. If that email can't be sent the change still stands - it is logged.
  try {
    const { text, html } = emailBody(
      [`Hi${firstName ? ` ${firstName}` : ''},`,
        `The email address for your Notably Better account has been changed to ${maskEmail(newEmail)}.`,
        'You have been signed out everywhere. From now on, sign in with the new address.'],
      'Open Notably Better', String(origin).replace(/\/+$/, ''),
      'If this wasn\'t you, reply to this email straight away so we can put it right.');
    await sendMail({ to: oldEmail, subject: 'Your Notably Better email address has changed', text, html });
  } catch (error) {
    console.error('Email change: the old address could not be told:', error.message);
  }

  let wasThisDevice = false;
  try { wasThisDevice = !!signedInToken && clean(verifyToken(signedInToken).userId) === clean(oldEmail); } catch { /* not signed in, or not as this account */ }
  return { email: newEmail, wasThisDevice };
}
