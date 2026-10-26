// ML-617: the signature at the bottom of every email a member gets - set on Admin -> Email wording, kept in
// email_signature (migration 161). The alerts the app sends the owner (sendMail's toOwner) don't carry it.
// HTML pasted or formatted on the page, cleaned before it is kept and again before it is sent (emailHtml.js);
// the one picture allowed is the logo uploaded on the page, kept in the file store's email-signature/ folder.
// Read once a minute at most - every email asks for it. docs/email-wording.md.
import { del } from '@vercel/blob';
import pool from '../config/db.js';
import { cleanSignatureHtml, htmlToText } from './emailHtml.js';
import { storedPath } from './blobUrls.js';

export const SIGNATURE_MAX = 10000;
export const LOGO_FOLDER = 'email-signature/';
export const MAX_LOGO_BYTES = 1024 * 1024; // 1 MB - as a band's logo
export const LOGO_TYPES = ['image/png', 'image/jpeg', 'image/webp']; // never svg, which can carry script

const fail = (status, message) => Object.assign(new Error(message), { status });
export const isSignatureLogoUrl = (url) => (storedPath(url) || '').startsWith(LOGO_FOLDER);

let kept = null; // { at, value }
export function forgetSignature() { kept = null; }

async function row() {
  const { rows } = await pool.query(
    `SELECT s.html, s.logo_url, s.updated_at, a.first_name, a.surname
       FROM email_signature s LEFT JOIN accounts a ON a.id = s.updated_by_account_id WHERE s.id`);
  return rows[0] || null;
}

// For sending: { html, text } - both '' when there is none. Never throws: an email goes without it rather than not at all.
export async function emailSignature() {
  if (kept && Date.now() - kept.at < 60000) return kept.value;
  let value = { html: '', text: '' };
  try {
    const r = await row();
    const html = r ? cleanSignatureHtml(r.html, r.logo_url) : '';
    value = { html, text: htmlToText(html) };
  } catch (error) {
    console.error('Email signature could not be read - emails go without it:', error.message);
  }
  kept = { at: Date.now(), value };
  return value;
}

// ---- Admin -> Email wording (super admins) ----
export async function signatureForAdmin() {
  const r = await row();
  return {
    html: r ? cleanSignatureHtml(r.html, r.logo_url) : '',
    logoUrl: r ? r.logo_url : null,
    changedOn: r ? r.updated_at : null,
    changedBy: r ? `${r.first_name || ''} ${r.surname || ''}`.trim() || null : null,
    max: SIGNATURE_MAX
  };
}

async function currentLogo() {
  const r = await row();
  return r ? r.logo_url : null;
}

// Cleans and keeps it. Says what was taken out, in words, when the cleaning changed more than spacing.
export async function saveSignature(html, accountId) {
  const logo = await currentLogo();
  const clean = cleanSignatureHtml(html, logo);
  if (clean.length > SIGNATURE_MAX) throw fail(400, `The signature is too long once cleaned (${clean.length} characters of HTML; up to ${SIGNATURE_MAX}). Try pasting it again with less in it.`);
  await pool.query(
    `INSERT INTO email_signature (id, html, logo_url, updated_by_account_id) VALUES (true, $1, $2, $3)
     ON CONFLICT (id) DO UPDATE SET html = $1, updated_at = now(), updated_by_account_id = $3`,
    [clean, logo, accountId]);
  forgetSignature();
  return signatureForAdmin();
}

async function deleteFile(url) {
  if (!url || !isSignatureLogoUrl(url)) return;
  try { await del([url]); } catch (error) { console.error('Email signature: a stored logo could not be removed:', error.message); }
}

// The logo, after the browser has uploaded it to the store (the upload-token route checks the folder too).
// A logo that replaces another takes its place in the signature, and the old file goes.
export async function setSignatureLogo({ blobUrl, fileSizeBytes, mimeType }, accountId) {
  if (!isSignatureLogoUrl(blobUrl)) throw fail(400, 'That is not a logo uploaded here.');
  if (!LOGO_TYPES.includes(mimeType)) throw fail(400, 'A logo has to be a picture: PNG, JPEG or WebP.');
  if (Number(fileSizeBytes) > MAX_LOGO_BYTES) throw fail(413, 'A logo can be up to 1 MB.');
  const r = await row();
  const old = r ? r.logo_url : null;
  const html = r && old ? r.html.split(old).join(blobUrl) : (r ? r.html : '');
  await pool.query(
    `INSERT INTO email_signature (id, html, logo_url, updated_by_account_id) VALUES (true, $1, $2, $3)
     ON CONFLICT (id) DO UPDATE SET html = $1, logo_url = $2, updated_at = now(), updated_by_account_id = $3`,
    [html, blobUrl, accountId]);
  if (old && old !== blobUrl) await deleteFile(old);
  forgetSignature();
  return signatureForAdmin();
}

// The logo off: out of the signature (cleaning drops a picture that isn't the logo) and out of the store.
export async function removeSignatureLogo(accountId) {
  const r = await row();
  if (!r || !r.logo_url) return signatureForAdmin();
  await pool.query('UPDATE email_signature SET html = $1, logo_url = NULL, updated_at = now(), updated_by_account_id = $2 WHERE id',
    [cleanSignatureHtml(r.html, null), accountId]);
  await deleteFile(r.logo_url);
  forgetSignature();
  return signatureForAdmin();
}

// No signature at all: the row and the logo file go.
export async function removeSignature() {
  const r = await row();
  await pool.query('DELETE FROM email_signature');
  if (r) await deleteFile(r.logo_url);
  forgetSignature();
  return signatureForAdmin();
}
