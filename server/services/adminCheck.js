// ML-518: opening the admin panel asks a super admin to prove it is them - with a passkey (the
// device's fingerprint, face or PIN) or, on a device without one, a code from their authenticator
// app or a recovery code (two-step sign-in's own, ML-355). The rules of how long a check lasts are
// adminCheckRules.js; the guard is requireAdminCheck (middleware/auth.js). docs/admin-passkey.md.
//
// A passkey never sends the fingerprint anywhere: the device checks it and signs the server's
// question with a key only that device holds. What is kept here is the public half of that key.
// The signing sums are the @simplewebauthn/server package (WebAuthn); the browser half is our own
// small file (public/admin-passkeys.js).

import { generateRegistrationOptions, verifyRegistrationResponse, generateAuthenticationOptions, verifyAuthenticationResponse } from '@simplewebauthn/server';
import qrcode from 'qrcode-generator';
import pool from '../config/db.js';
import { twoStepStatus, beginSetup, confirmSetup, verifyLoginCode, newRecoveryCodes, ISSUER } from './twoStep.js';
import { appUrl, limitCalls } from './passwordAuth.js';
import { adminCheckRequired, checkState, checkedToken, lockedToken, IDLE_MS, MAX_MS } from './adminCheckRules.js';

const CHALLENGE_MINUTES = 5;
const MAX_PASSKEYS = 10;
export const PASSKEY_NAME_MAX = 40;

const fail = (status, message) => Object.assign(new Error(message), { status });

// A passkey belongs to one web address. With APP_URL set that is the address (as for emailed links);
// otherwise the one the request came to - a developer's machine, or sandbox.
export function relyingParty(req) {
  const origin = appUrl(req);
  return { origin, rpID: new URL(origin).hostname };
}

const cleanName = (name) => String(name || '').replace(/\s+/g, ' ').trim().slice(0, PASSKEY_NAME_MAX);

async function passkeysFor(accountId, rpID) {
  const { rows } = await pool.query(
    'SELECT id, credential_id, public_key, counter, transports, name, created_at, last_used_at FROM admin_passkeys WHERE account_id = $1 AND rp_id = $2 ORDER BY created_at',
    [accountId, rpID]);
  return rows;
}

async function keepChallenge(accountId, purpose, challenge) {
  await pool.query('DELETE FROM admin_passkey_challenges WHERE expires_at < now()');
  await pool.query(
    'INSERT INTO admin_passkey_challenges (account_id, purpose, challenge, expires_at) VALUES ($1, $2, $3, now() + make_interval(mins => $4))',
    [accountId, purpose, challenge, CHALLENGE_MINUTES]);
}
// The question a device answered, taken out so it can't be answered twice. Throws if it isn't one
// of ours, or has run out.
async function useChallenge(accountId, purpose, response) {
  let challenge;
  try { challenge = JSON.parse(Buffer.from(String(response?.response?.clientDataJSON || ''), 'base64url').toString('utf8')).challenge; } catch { challenge = null; }
  if (!challenge || typeof challenge !== 'string') throw fail(400, 'That passkey answer could not be read - try again.');
  const { rows } = await pool.query(
    'DELETE FROM admin_passkey_challenges WHERE account_id = $1 AND purpose = $2 AND challenge = $3 AND expires_at > now() RETURNING id',
    [accountId, purpose, challenge]);
  if (!rows.length) throw fail(400, 'That took too long - try again.');
  return challenge;
}

// ---- what the "prove it's you" screen needs to know ----
export async function gateStatus(req) {
  const state = checkState(req.tokenPayload?.adm, Date.now());
  const { rpID } = relyingParty(req);
  const [twoStep, keys] = await Promise.all([twoStepStatus(req.accountId), passkeysFor(req.accountId, rpID)]);
  return {
    required: adminCheckRequired(),
    fresh: state.fresh,
    how: state.how,
    until: state.until,
    passkeys: keys.length,
    twoStep: twoStep.enabled,
    recoveryCodesLeft: twoStep.recoveryCodesLeft,
    idleMinutes: IDLE_MS / 60000,
    maxHours: MAX_MS / 3600000
  };
}

// ---- a code: the authenticator app's, or a recovery code ----
export async function passByCode(req, code) {
  await limitCalls('admin-check', req.accountId);
  if (!(await twoStepStatus(req.accountId)).enabled) throw fail(400, 'Set up an authenticator app first.');
  const used = await verifyLoginCode(req.accountId, code); // wrong codes lock as they do at sign-in
  const left = (await twoStepStatus(req.accountId)).recoveryCodesLeft;
  return { token: checkedToken(req.tokenPayload, 'code', Date.now()), usedRecoveryCode: used === 'recovery', recoveryCodesLeft: left };
}

// A super admin who signs in with Google has never been asked for an authenticator app. The first
// time they open the admin panel they set one up here - the one moment the check rests on the
// sign-in alone, which is why each super admin should do it straight away.
export async function beginAuthenticator(req) {
  await limitCalls('admin-check', req.accountId);
  const details = await beginSetup(req.accountId, req.userId); // refuses if two-step is already on
  return { ...details, qr: qrImage(details.otpauthUrl) };
}

// ML-519: the same set-up link as a QR code, for a phone's authenticator app to scan from a computer's
// screen. Drawn here and sent as a picture (an SVG in a data: address) - it holds the setup key, so like
// the key it is shown once and never kept. Always black on white with the quiet border a scanner needs,
// whatever the page's colours. The QR sums are the qrcode-generator package.
export function qrModules(text) {
  const qr = qrcode(0, 'M');
  qr.addData(text);
  qr.make();
  const count = qr.getModuleCount();
  return Array.from({ length: count }, (_, row) => Array.from({ length: count }, (__, col) => qr.isDark(row, col)));
}
export function qrImage(text) {
  const QUIET = 4;
  const modules = qrModules(text);
  const size = modules.length + QUIET * 2;
  let path = '';
  modules.forEach((row, r) => row.forEach((dark, c) => { if (dark) path += `M${c + QUIET} ${r + QUIET}h1v1h-1z`; }));
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" shape-rendering="crispEdges"><rect width="${size}" height="${size}" fill="#fff"/><path d="${path}" fill="#000"/></svg>`;
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
}
export async function confirmAuthenticator(req, code) {
  await limitCalls('admin-check', req.accountId);
  const { recoveryCodes } = await confirmSetup(req.accountId, code);
  return { recoveryCodes, token: checkedToken(req.tokenPayload, 'code', Date.now()) };
}

// ---- checking with a passkey ----
export async function passkeyCheckOptions(req) {
  await limitCalls('admin-check', req.accountId);
  const { rpID } = relyingParty(req);
  const keys = await passkeysFor(req.accountId, rpID);
  if (!keys.length) throw fail(400, 'There is no passkey for this address yet - use a code.');
  const options = await generateAuthenticationOptions({
    rpID,
    allowCredentials: keys.map((k) => ({ id: k.credential_id, transports: k.transports })),
    userVerification: 'required'
  });
  await keepChallenge(req.accountId, 'check', options.challenge);
  return options;
}
export async function passByPasskey(req, response) {
  await limitCalls('admin-check', req.accountId);
  const { origin, rpID } = relyingParty(req);
  const key = (await passkeysFor(req.accountId, rpID)).find((k) => k.credential_id === response?.id);
  if (!key) throw fail(400, 'That passkey isn\'t one of yours for this address.');
  const expectedChallenge = await useChallenge(req.accountId, 'check', response);
  let result;
  try {
    result = await verifyAuthenticationResponse({
      response, expectedChallenge, expectedOrigin: origin, expectedRPID: rpID, requireUserVerification: true,
      credential: { id: key.credential_id, publicKey: new Uint8Array(key.public_key), counter: Number(key.counter), transports: key.transports }
    });
  } catch (error) {
    console.error('Passkey check failed:', error.message);
    throw fail(400, 'That passkey could not be checked - try again, or use a code.');
  }
  if (!result.verified) throw fail(400, 'That passkey could not be checked - try again, or use a code.');
  await pool.query('UPDATE admin_passkeys SET counter = $2, last_used_at = now() WHERE id = $1', [key.id, result.authenticationInfo.newCounter]);
  return { token: checkedToken(req.tokenPayload, 'passkey', Date.now()) };
}

export const lock = (req) => ({ token: lockedToken(req.tokenPayload) });

// A new set of recovery codes, for a current authenticator code. The app's own Sign-in and security
// screen offers this only to someone with a password; a super admin who signs in with Google has it here.
export async function freshRecoveryCodes(req, code) {
  await limitCalls('admin-check', req.accountId);
  return newRecoveryCodes(req.accountId, code);
}

// ---- My passkeys (behind the check, like every other admin page) ----
export async function listPasskeys(req) {
  const { rpID } = relyingParty(req);
  const state = checkState(req.tokenPayload?.adm, Date.now());
  return {
    address: rpID,
    // a new passkey is made on a check that used a code (not asked where the check itself isn't)
    canAdd: !adminCheckRequired() || state.how === 'code',
    passkeys: (await passkeysFor(req.accountId, rpID)).map((k) => ({ id: Number(k.id), name: k.name, createdAt: k.created_at, lastUsedAt: k.last_used_at }))
  };
}

function requireCodeCheck(req) {
  if (!adminCheckRequired()) return;
  if (checkState(req.tokenPayload?.adm, Date.now()).how !== 'code') throw Object.assign(fail(403, 'Enter a code from your authenticator app to add a passkey.'), { reason: 'needs-code' });
}

export async function passkeyRegisterOptions(req) {
  requireCodeCheck(req);
  await limitCalls('admin-check', req.accountId);
  const { rpID } = relyingParty(req);
  const keys = await passkeysFor(req.accountId, rpID);
  if (keys.length >= MAX_PASSKEYS) throw fail(400, `That is ${MAX_PASSKEYS} passkeys - remove one you no longer use first.`);
  const options = await generateRegistrationOptions({
    rpName: `${ISSUER} admin`,
    rpID,
    userName: req.userId,
    userDisplayName: [req.firstName, req.surname].filter(Boolean).join(' ') || req.userId,
    attestationType: 'none',
    excludeCredentials: keys.map((k) => ({ id: k.credential_id, transports: k.transports })),
    authenticatorSelection: { residentKey: 'preferred', userVerification: 'required' }
  });
  await keepChallenge(req.accountId, 'register', options.challenge);
  return options;
}
export async function addPasskey(req, response, name) {
  requireCodeCheck(req);
  await limitCalls('admin-check', req.accountId);
  const { origin, rpID } = relyingParty(req);
  const expectedChallenge = await useChallenge(req.accountId, 'register', response);
  let result;
  try {
    result = await verifyRegistrationResponse({ response, expectedChallenge, expectedOrigin: origin, expectedRPID: rpID, requireUserVerification: true });
  } catch (error) {
    console.error('Passkey not made:', error.message);
    throw fail(400, 'That passkey could not be made - try again.');
  }
  if (!result.verified) throw fail(400, 'That passkey could not be made - try again.');
  const { credential } = result.registrationInfo;
  try {
    await pool.query(
      'INSERT INTO admin_passkeys (account_id, credential_id, public_key, counter, transports, rp_id, name) VALUES ($1, $2, $3, $4, $5, $6, $7)',
      [req.accountId, credential.id, Buffer.from(credential.publicKey), credential.counter, (response?.response?.transports || []).map(String).slice(0, 8), rpID, cleanName(name) || 'Passkey']);
  } catch (error) {
    if (error.code === '23505') throw fail(409, 'That passkey is already on the list.');
    throw error;
  }
  return listPasskeys(req);
}
export async function renamePasskey(req, id, name) {
  const next = cleanName(name);
  if (!next) throw fail(400, 'Give the passkey a name.');
  const { rowCount } = await pool.query('UPDATE admin_passkeys SET name = $3 WHERE id = $1 AND account_id = $2', [id, req.accountId, next]);
  if (!rowCount) throw fail(404, 'That passkey isn\'t on your list.');
  return listPasskeys(req);
}
export async function removePasskey(req, id) {
  const { rowCount } = await pool.query('DELETE FROM admin_passkeys WHERE id = $1 AND account_id = $2', [id, req.accountId]);
  if (!rowCount) throw fail(404, 'That passkey isn\'t on your list.');
  return listPasskeys(req);
}
