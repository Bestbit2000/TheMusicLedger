// ML-355 batch 1: email + password login next to Google (docs/password-login.md).
//  - Invite-only: a super admin invites an email address (createInvite). The emailed link lets the
//    person choose a password (acceptInvite) - which also proves the address - and logs them in.
//  - Log in (login), with too many wrong passwords locking password login for a while.
//  - Forgot password: a one-time link (1 hour) by email; setting a new password signs out everywhere.
// Nothing here says whether an email has an account ("if it has an account, we've sent a link"), and a
// wrong email takes as long as a wrong password. All of it is behind the password_login feature.

import crypto from 'node:crypto';
import pool from '../config/db.js';
import { signToken, verifyToken } from '../utils/authToken.js';
import { hashPassword, verifyPassword, spendPasswordTime, passwordProblem } from './passwords.js';
import { sendMail, mailIsReal } from './mail.js';
import { isFeatureLive } from './features.js';
import { forgetTokenVersion, currentTokenVersion } from './tokenVersions.js';
import { twoStepStatus, beginSetup, confirmSetup, verifyLoginCode } from './twoStep.js';

const INVITE_DAYS = 7;
const RESET_MINUTES = 60;
const LOCK_AFTER = 5;        // wrong passwords in a row
const LOCK_MINUTES = 15;
// Levels an invite can give. Not super_admin - making someone a super admin stays a deliberate change in
// Admin -> Accounts (their next password login then has to set up two-step sign-in).
export const INVITE_LEVELS = ['standard_member', 'premium_member', 'beta_tester', 'teacher', 'band_admin'];

const fail = (status, message) => Object.assign(new Error(message), { status });
export const normaliseEmail = (e) => String(e || '').trim().toLowerCase();
const looksLikeEmail = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) && e.length <= 254;
const hashLinkSecret = (s) => crypto.createHash('sha256').update(String(s)).digest('hex');

export async function passwordLoginEnabled() {
  return isFeatureLive('password_login'); // before login: only the Live switch counts, and missing = off
}
async function requireEnabled() {
  if (!(await passwordLoginEnabled())) throw fail(404, 'Not found');
}

// Where emailed links point. With real email, always APP_URL - a request's Host header is the caller's
// to choose, and a reset link pointing at someone else's site would hand them the account.
export function appUrl(req) {
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/+$/, '');
  if (mailIsReal()) throw fail(500, 'APP_URL must be set before real emails can be sent.');
  return `${req.protocol}://${req.get('host')}`;
}

// ---- rate limits (a row per attempt, so they hold across serverless instances) ----
async function overLimit(kind, key, max, minutes) {
  await pool.query("DELETE FROM auth_rate_events WHERE created_at < now() - interval '1 day'");
  await pool.query('INSERT INTO auth_rate_events (kind, key) VALUES ($1, $2)', [kind, key]);
  const { rows } = await pool.query(
    'SELECT COUNT(*)::int AS n FROM auth_rate_events WHERE kind = $1 AND key = $2 AND created_at > now() - make_interval(mins => $3)',
    [kind, key, minutes]);
  return rows[0].n > max;
}
const TOO_MANY = 'Too many tries from here - wait a few minutes and try again.';

// ---- tokens ----
function signLoginToken(account) {
  return {
    authToken: signToken({ userId: account.email, email: account.email, firstName: account.first_name, surname: account.surname, tv: account.token_version, method: 'password' }),
    userId: account.email
  };
}
// ---- batch 2: the step after a correct password (or an invite / reset link) ----
// Two-step on: a short-lived challenge asks for a code. A super admin without it: a challenge to set it
// up first (it's required for them). Anyone else: logged in. A challenge is signed like a login token
// but has no userId, so it can never be used as one (requireAuth refuses it).
const CHALLENGE_MS = 10 * 60 * 1000;
async function completeLogin(account) {
  const { enabled } = await twoStepStatus(account.id);
  const challenge = (purpose) => signToken({ purpose, accountId: Number(account.id), email: account.email, tv: account.token_version }, CHALLENGE_MS);
  if (enabled) return { twoStep: true, challenge: challenge('two-step') };
  if (account.account_level === 'super_admin') return { twoStepSetup: true, challenge: challenge('two-step-setup') };
  return signLoginToken(account);
}
async function accountFromChallenge(token, purpose) {
  let data;
  try { data = verifyToken(token); } catch { throw fail(401, 'That took too long - log in again.'); }
  if (data.purpose !== purpose || !data.email) throw fail(401, 'That took too long - log in again.');
  const account = await accountByEmail(pool, data.email);
  if (!account || Number(account.id) !== data.accountId || Number(data.tv || 0) < (await currentTokenVersion(account.email))) throw fail(401, 'That took too long - log in again.');
  return account;
}
export async function secondStep(challenge, code, ip) {
  await requireEnabled();
  if (await overLimit('two-step', ip, 30, 15)) throw fail(429, TOO_MANY);
  const account = await accountFromChallenge(challenge, 'two-step');
  const used = await verifyLoginCode(account.id, code);
  const { recoveryCodesLeft } = await twoStepStatus(account.id);
  return { ...signLoginToken(account), usedRecoveryCode: used === 'recovery', recoveryCodesLeft };
}
export async function setupFromChallenge(challenge, ip) {
  await requireEnabled();
  if (await overLimit('two-step', ip, 30, 15)) throw fail(429, TOO_MANY);
  const account = await accountFromChallenge(challenge, 'two-step-setup');
  return beginSetup(account.id, account.email);
}
export async function confirmSetupFromChallenge(challenge, code, ip) {
  await requireEnabled();
  if (await overLimit('two-step', ip, 30, 15)) throw fail(429, TOO_MANY);
  const account = await accountFromChallenge(challenge, 'two-step-setup');
  const { recoveryCodes } = await confirmSetup(account.id, code);
  return { recoveryCodes, ...signLoginToken(account) };
}

async function accountByEmail(client, email) {
  const { rows } = await client.query(
    `SELECT a.id, a.email, a.first_name, a.surname, a.account_level, a.token_version,
            p.password_hash, p.failed_attempts, p.locked_until
       FROM accounts a LEFT JOIN account_passwords p ON p.account_id = a.id
      WHERE lower(a.email) = $1`, [normaliseEmail(email)]);
  return rows[0] || null;
}

// ---- emailed links ----
async function newLink(client, { purpose, email, firstName = null, surname = null, accountLevel = null, createdBy = null, minutes }) {
  const secret = crypto.randomBytes(32).toString('base64url');
  // One live link of a kind per address: a newer one replaces the old.
  await client.query('UPDATE auth_email_links SET used_at = now() WHERE lower(email) = $1 AND purpose = $2 AND used_at IS NULL', [email, purpose]);
  await client.query(
    `INSERT INTO auth_email_links (purpose, token_hash, email, first_name, surname, account_level, created_by_account_id, expires_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, now() + make_interval(mins => $8))`,
    [purpose, hashLinkSecret(secret), email, firstName, surname, accountLevel, createdBy, minutes]);
  return secret;
}
async function liveLink(client, secret, purpose, lock = false) {
  const { rows } = await client.query(
    `SELECT * FROM auth_email_links WHERE token_hash = $1 AND purpose = $2 AND used_at IS NULL AND expires_at > now()${lock ? ' FOR UPDATE' : ''}`,
    [hashLinkSecret(secret), purpose]);
  return rows[0] || null;
}

const esc = (s) => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
function emailBody(lines, buttonText, url, footer) {
  const text = `${lines.join('\n\n')}\n\n${buttonText}: ${url}\n\n${footer}`;
  const html = `<div style="font-family:Arial,sans-serif;font-size:16px;line-height:1.5;color:#222;max-width:520px">
${lines.map(l => `<p>${esc(l)}</p>`).join('\n')}
<p><a href="${esc(url)}" style="display:inline-block;background:#c9a227;color:#111;padding:12px 20px;border-radius:6px;text-decoration:none;font-weight:bold">${esc(buttonText)}</a></p>
<p style="font-size:13px;color:#555">Or copy this link: ${esc(url)}</p>
<p style="font-size:13px;color:#555">${esc(footer)}</p></div>`;
  return { text, html };
}

// ---- invites (super admin) ----
export async function createInvite({ email, firstName, surname, accountLevel, createdBy, origin }) {
  await requireEnabled();
  const to = normaliseEmail(email);
  if (!looksLikeEmail(to)) throw fail(400, 'Enter a valid email address.');
  const level = accountLevel || 'standard_member';
  if (!INVITE_LEVELS.includes(level)) throw fail(400, 'Choose an account type (not super admin).');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const existing = await accountByEmail(client, to);
    if (existing?.password_hash) throw fail(409, 'That email already has a password login - they can use "Forgot password" if they need a new one.');
    const secret = await newLink(client, {
      purpose: 'invite', email: to, firstName: String(firstName || '').trim().slice(0, 80) || null,
      surname: String(surname || '').trim().slice(0, 80) || null, accountLevel: level, createdBy, minutes: INVITE_DAYS * 24 * 60
    });
    const url = `${origin}/?invite=${secret}`;
    const hello = firstName ? `Hi ${String(firstName).trim()},` : 'Hi,';
    const { text, html } = emailBody(
      [hello, `You've been invited to The Music Ledger${existing ? ' - this lets you log in with your email and a password as well as Google' : ''}. Choose a password to get started.`],
      'Choose your password', url, `This link works once, for ${INVITE_DAYS} days. If you weren't expecting it, you can ignore this email.`);
    await sendMail({ to, subject: "You're invited to The Music Ledger", text, html });
    await client.query('COMMIT');
    return { email: to, existingAccount: !!existing };
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    throw e;
  } finally {
    client.release();
  }
}

export async function listPendingInvites() {
  const { rows } = await pool.query(
    `SELECT l.id, l.email, l.first_name, l.surname, l.account_level, l.created_at, l.expires_at
       FROM auth_email_links l WHERE l.purpose = 'invite' AND l.used_at IS NULL AND l.expires_at > now()
      ORDER BY l.created_at DESC`);
  return rows.map(r => ({ id: Number(r.id), email: r.email, firstName: r.first_name, surname: r.surname, accountLevel: r.account_level, createdAt: r.created_at, expiresAt: r.expires_at }));
}

export async function cancelInvite(id) {
  await pool.query("UPDATE auth_email_links SET used_at = now() WHERE id = $1 AND purpose = 'invite' AND used_at IS NULL", [id]);
}

// ---- the link screens (invite / reset): what the link is for, before choosing a password ----
export async function describeLink(secret, purpose, ip) {
  await requireEnabled();
  if (await overLimit('link', ip, 60, 15)) throw fail(429, TOO_MANY);
  const link = await liveLink(pool, String(secret || ''), purpose);
  if (!link) throw fail(404, purpose === 'invite' ? 'This invite has expired or already been used - ask for a new one.' : 'This link has expired or already been used - ask for a new one.');
  return { email: link.email, firstName: link.first_name };
}

async function setPassword(client, accountId, password) {
  const hash = await hashPassword(password);
  await client.query(
    `INSERT INTO account_passwords (account_id, password_hash) VALUES ($1, $2)
     ON CONFLICT (account_id) DO UPDATE SET password_hash = EXCLUDED.password_hash, set_at = now(), failed_attempts = 0, locked_until = NULL`,
    [accountId, hash]);
}

export async function acceptInvite(secret, password, ip) {
  await requireEnabled();
  if (await overLimit('link', ip, 60, 15)) throw fail(429, TOO_MANY);
  const problem = await passwordProblem(password);
  if (problem) throw fail(400, problem);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const link = await liveLink(client, String(secret || ''), 'invite', true);
    if (!link) throw fail(404, 'This invite has expired or already been used - ask for a new one.');
    let account = await accountByEmail(client, link.email);
    if (!account) {
      // A new account gets the invite's name and type; an existing (Google) one keeps its own.
      await client.query('INSERT INTO accounts (email, first_name, surname, account_level) VALUES ($1, $2, $3, $4)',
        [link.email, link.first_name || '', link.surname || '', link.account_level || 'standard_member']);
      account = await accountByEmail(client, link.email);
    }
    await setPassword(client, account.id, password);
    await client.query('UPDATE auth_email_links SET used_at = now() WHERE id = $1', [link.id]);
    await client.query('UPDATE account_passwords SET last_login_at = now() WHERE account_id = $1', [account.id]);
    await client.query('COMMIT');
    return completeLogin(account);
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    throw e;
  } finally {
    client.release();
  }
}

// ---- log in ----
const WRONG = 'That email and password don\'t match. Check them, or use "Forgot your password?".';
export async function login(email, password, ip) {
  await requireEnabled();
  if (await overLimit('login', ip, 30, 15)) throw fail(429, TOO_MANY);
  const account = await accountByEmail(pool, email);
  if (!account || !account.password_hash || typeof password !== 'string') {
    await spendPasswordTime(String(password || ''));
    throw fail(401, WRONG);
  }
  if (account.locked_until && new Date(account.locked_until) > new Date()) {
    const mins = Math.min(LOCK_MINUTES, Math.max(1, Math.ceil((new Date(account.locked_until) - Date.now()) / 60000))); // the database and server clocks can differ a little
    throw fail(423, `Too many wrong passwords - password login is paused for ${mins} minute${mins === 1 ? '' : 's'}. You can reset your password instead.`);
  }
  if (!(await verifyPassword(password, account.password_hash))) {
    await pool.query(
      `UPDATE account_passwords SET failed_attempts = failed_attempts + 1,
              locked_until = CASE WHEN failed_attempts + 1 >= $2 THEN now() + make_interval(mins => $3) ELSE locked_until END
        WHERE account_id = $1`, [account.id, LOCK_AFTER, LOCK_MINUTES]);
    throw fail(401, WRONG);
  }
  await pool.query('UPDATE account_passwords SET failed_attempts = 0, locked_until = NULL, last_login_at = now() WHERE account_id = $1', [account.id]);
  return completeLogin(account);
}

// ---- forgot / reset ----
export async function forgotPassword(email, ip, origin) {
  await requireEnabled();
  const to = normaliseEmail(email);
  if (await overLimit('forgot-ip', ip, 10, 60)) throw fail(429, TOO_MANY);
  // Always the same answer, whether or not there's an account - quietly do nothing when there isn't
  // one, or when this address has asked 3 times in the last hour.
  if (!looksLikeEmail(to) || await overLimit('forgot-email', to, 3, 60)) return;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const account = await accountByEmail(client, to);
    if (account) {
      const secret = await newLink(client, { purpose: 'reset', email: account.email, minutes: RESET_MINUTES });
      const url = `${origin}/?reset=${secret}`;
      const { text, html } = emailBody(
        [`Hi${account.first_name ? ` ${account.first_name}` : ''},`, `Someone (hopefully you) asked to ${account.password_hash ? 'reset the password' : 'set a password'} for your Music Ledger account.`],
        'Choose a new password', url, `This link works once, for ${RESET_MINUTES} minutes. If it wasn't you, ignore this email - your password hasn't changed.`);
      await sendMail({ to: account.email, subject: 'Your Music Ledger password', text, html });
    }
    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    throw e;
  } finally {
    client.release();
  }
}

export async function resetPassword(secret, password, ip) {
  await requireEnabled();
  if (await overLimit('link', ip, 60, 15)) throw fail(429, TOO_MANY);
  const problem = await passwordProblem(password);
  if (problem) throw fail(400, problem);
  const client = await pool.connect();
  let account;
  try {
    await client.query('BEGIN');
    const link = await liveLink(client, String(secret || ''), 'reset', true);
    if (!link) throw fail(404, 'This link has expired or already been used - ask for a new one.');
    account = await accountByEmail(client, link.email);
    if (!account) throw fail(404, 'This link has expired or already been used - ask for a new one.');
    await setPassword(client, account.id, password);
    // Signed out everywhere: every older token (Google ones too) stops working.
    const { rows } = await client.query('UPDATE accounts SET token_version = token_version + 1 WHERE id = $1 RETURNING token_version', [account.id]);
    account.token_version = rows[0].token_version;
    await client.query("UPDATE auth_email_links SET used_at = now() WHERE lower(email) = lower($1) AND purpose = 'reset' AND used_at IS NULL", [account.email]);
    await client.query('UPDATE account_passwords SET last_login_at = now() WHERE account_id = $1', [account.id]);
    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    throw e;
  } finally {
    client.release();
  }
  forgetTokenVersion(account.email);
  return completeLogin(account);
}

// ---- batch 2: Account -> Sign-in and security (logged in) ----
export async function securityStatus(accountId, accountLevel) {
  const [{ rows }, twoStep, enabled] = await Promise.all([
    pool.query('SELECT set_at, last_login_at FROM account_passwords WHERE account_id = $1', [accountId]),
    twoStepStatus(accountId),
    passwordLoginEnabled()
  ]);
  return {
    passwordLogin: enabled,
    hasPassword: !!rows.length,
    passwordSetAt: rows[0]?.set_at || null,
    twoStep,
    twoStepRequired: accountLevel === 'super_admin'
  };
}
export async function requirePasswordAccount(accountId) {
  await requireEnabled();
  const { rows } = await pool.query('SELECT 1 FROM account_passwords WHERE account_id = $1', [accountId]);
  if (!rows.length) throw fail(400, 'Two-step sign-in is for logging in with a password - you log in with Google, which has its own.');
}

// ---- batch 3: admin tools (Admin -> Accounts) ----
async function adminTarget(accountId) {
  const { rows } = await pool.query('SELECT id, email, first_name, token_version FROM accounts WHERE id = $1', [accountId]);
  if (!rows.length) throw fail(404, 'Account not found.');
  return rows[0];
}
// A password reset link, as if they'd asked for one - for someone who can't get in (or to add a password
// to a Google account). Doesn't count against their own forgot-password limit.
export async function adminSendReset(accountId, origin) {
  await requireEnabled();
  const account = await adminTarget(accountId);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const secret = await newLink(client, { purpose: 'reset', email: account.email, minutes: RESET_MINUTES });
    const url = `${origin}/?reset=${secret}`;
    const { text, html } = emailBody(
      [`Hi${account.first_name ? ` ${account.first_name}` : ''},`, 'The Music Ledger team has sent you a link to choose a new password for your account.'],
      'Choose a new password', url, `This link works once, for ${RESET_MINUTES} minutes. If you weren't expecting it, you can ignore this email - your password hasn't changed.`);
    await sendMail({ to: account.email, subject: 'Your Music Ledger password', text, html });
    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    throw e;
  } finally {
    client.release();
  }
  return account.email;
}
// Clears a pause after too many wrong passwords or codes.
export async function adminUnlock(accountId) {
  await adminTarget(accountId);
  await pool.query('UPDATE account_passwords SET failed_attempts = 0, locked_until = NULL WHERE account_id = $1', [accountId]);
  await pool.query('UPDATE account_two_step SET failed_attempts = 0, locked_until = NULL WHERE account_id = $1', [accountId]);
}
// Signs the account out on every device (Google and password logins alike).
export async function adminSignOutEverywhere(accountId) {
  const account = await adminTarget(accountId);
  await pool.query('UPDATE accounts SET token_version = token_version + 1 WHERE id = $1', [accountId]);
  forgetTokenVersion(account.email);
}
// Lost phone and no recovery codes: two-step sign-in off, so they can log in with just the password and
// set it up again (a super admin is asked to at their next password login).
export async function adminTurnOffTwoStep(accountId) {
  await adminTarget(accountId);
  await pool.query('DELETE FROM account_two_step WHERE account_id = $1', [accountId]);
  await pool.query('DELETE FROM account_recovery_codes WHERE account_id = $1', [accountId]);
}

// ---- batch 3: change (or add) your own password, logged in ----
// With a password: the current one first (wrong ones count towards the lock, like logging in), and
// every other device is signed out - this one gets a fresh token. Without one (a Google account): just
// the new password, which adds email + password login.
export async function changeOwnPassword(accountId, current, next, ip) {
  await requireEnabled();
  if (await overLimit('login', ip, 30, 15)) throw fail(429, TOO_MANY);
  const { rows } = await pool.query(
    `SELECT a.email, p.password_hash, p.locked_until FROM accounts a LEFT JOIN account_passwords p ON p.account_id = a.id WHERE a.id = $1`, [accountId]);
  const row = rows[0];
  if (!row) throw fail(404, 'Account not found.');
  if (row.password_hash) {
    if (row.locked_until && new Date(row.locked_until) > new Date()) throw fail(423, 'Too many wrong passwords - try again in a few minutes, or use "Forgot your password?".');
    if (!(await verifyPassword(String(current || ''), row.password_hash))) {
      await pool.query(
        `UPDATE account_passwords SET failed_attempts = failed_attempts + 1,
                locked_until = CASE WHEN failed_attempts + 1 >= $2 THEN now() + make_interval(mins => $3) ELSE locked_until END
          WHERE account_id = $1`, [accountId, LOCK_AFTER, LOCK_MINUTES]);
      throw fail(400, 'Your current password isn\'t right.');
    }
  }
  const problem = await passwordProblem(next);
  if (problem) throw fail(400, problem);
  const client = await pool.connect();
  let account;
  try {
    await client.query('BEGIN');
    await setPassword(client, accountId, next);
    if (row.password_hash) await client.query('UPDATE accounts SET token_version = token_version + 1 WHERE id = $1', [accountId]);
    account = await accountByEmail(client, row.email);
    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    throw e;
  } finally {
    client.release();
  }
  forgetTokenVersion(account.email);
  return { added: !row.password_hash, ...signLoginToken(account) };
}
