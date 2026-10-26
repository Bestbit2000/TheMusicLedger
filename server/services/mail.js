// ML-355: sending email. Which service is a setting, not code (docs/password-login.md):
//   MAIL_PROVIDER=log     (the default) - written to the email_outbox table, never sent. Local and dev.
//   MAIL_PROVIDER=smtp    - any SMTP server. The live site sends through Brevo:
//                           SMTP_HOST=smtp-relay.brevo.com SMTP_PORT=587 SMTP_USER=<SMTP login> SMTP_PASS=<SMTP key>
//                           (needs `npm install nodemailer` in server/ - it's only loaded for this mode)
// MAIL_FROM is the sender: "Notably Better <noreply@notablybetter.com>".

import pool from '../config/db.js';
import { emailSignature } from './emailSignature.js';
import { withSignature } from './emailLayout.js';

export function mailProvider() {
  return (process.env.MAIL_PROVIDER || 'log').toLowerCase();
}

// True when emails really leave the building - links in them must then use APP_URL, never a request's
// own Host header (which a caller controls).
export function mailIsReal() {
  return mailProvider() !== 'log';
}

// ML-479: what to tell the person who caused an email, once sendMail has come back without an error.
// On a site that only keeps its emails (provider "log" - dev and sandbox) nothing has reached anyone,
// and the app must say so rather than "they have been sent an email". Pure: pass a provider to test it.
export function emailOutcome(provider = mailProvider()) {
  return provider === 'log' ? { emailed: false, notSentHere: true } : { emailed: true };
}
// The same choice for a ready-made sentence: `sent` where emails really go, `held` where they don't.
export function sentOrHeld(sent, held, provider = mailProvider()) {
  return emailOutcome(provider).emailed ? sent : held;
}

async function smtpTransport(options = {}) {
  let nodemailer;
  try { nodemailer = (await import('nodemailer')).default; } catch { throw new Error('MAIL_PROVIDER=smtp needs nodemailer - run npm install nodemailer in server/.'); }
  const port = Number(process.env.SMTP_PORT || 465);
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST, port, secure: port === 465,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    ...options
  });
}
const mailFrom = () => process.env.MAIL_FROM || 'Notably Better <noreply@notablybetter.com>';
async function logMail({ to, subject, text, html }) {
  await pool.query('INSERT INTO email_outbox (to_email, subject, body_text, body_html) VALUES ($1, $2, $3, $4)', [to, subject, text, html || null]);
  if (process.env.NODE_ENV !== 'test') console.log(`[mail:log] to ${to}: ${subject}`);
}

// ML-617: the signature - see emailLayout.js (withSignature). toOwner: an alert to the owner, without it.
export async function sendMail({ to, subject, text, html, toOwner = false }) {
  const provider = mailProvider();
  const signed = toOwner ? { text, html } : withSignature({ text, html }, await emailSignature());
  if (provider === 'log') return logMail({ to, subject, ...signed });
  if (provider === 'smtp') {
    const transport = await smtpTransport();
    await transport.sendMail({ from: mailFrom(), to, subject, ...signed });
    return;
  }
  throw new Error(`Unknown MAIL_PROVIDER "${provider}".`);
}

// ML-499: many emails at once (a notice's email copies) - one connection kept open for the lot, one at a time.
// A failed one is counted and the rest carry on. Returns { sent, failed }.
export async function sendMailBatch(messages) {
  const provider = mailProvider();
  if (provider !== 'log' && provider !== 'smtp') throw new Error(`Unknown MAIL_PROVIDER "${provider}".`);
  const transport = provider === 'smtp' ? await smtpTransport({ pool: true, maxConnections: 1 }) : null;
  const sig = await emailSignature();
  let sent = 0;
  let failed = 0;
  try {
    for (const { toOwner, ...one } of messages) {
      const m = toOwner ? one : withSignature(one, sig);
      try {
        if (transport) await transport.sendMail({ from: mailFrom(), ...m });
        else await logMail(m);
        sent++;
      } catch (error) {
        failed++;
        console.error('An email in a batch could not be sent:', error.message);
      }
    }
  } finally {
    if (transport) transport.close();
  }
  return { sent, failed };
}

// The layout itself lives in emailLayout.js (no database there, so the emails can be built in tests); these
// stay here for everything that asks mail.js for them.
export { emailBody, emailBodyHtml, withSignature, SIGNATURE_MARK } from './emailLayout.js';
