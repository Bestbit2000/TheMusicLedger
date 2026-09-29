// ML-355: sending email. Which service is a setting, not code (docs/password-login.md):
//   MAIL_PROVIDER=log     (the default) - written to the email_outbox table, never sent. Local and dev.
//   MAIL_PROVIDER=smtp    - any SMTP server, e.g. a dedicated Gmail account with an app password:
//                           SMTP_HOST=smtp.gmail.com SMTP_PORT=465 SMTP_USER=... SMTP_PASS=<app password>
//                           (needs `npm install nodemailer` in server/ - it's only loaded for this mode)
//   MAIL_PROVIDER=resend  - Resend's HTTP API, once the app has its own domain: RESEND_API_KEY=...
// MAIL_FROM is the sender, e.g. "The Music Ledger <musicledger.mail@gmail.com>".

import pool from '../config/db.js';

export function mailProvider() {
  return (process.env.MAIL_PROVIDER || 'log').toLowerCase();
}

// True when emails really leave the building - links in them must then use APP_URL, never a request's
// own Host header (which a caller controls).
export function mailIsReal() {
  return mailProvider() !== 'log';
}

export async function sendMail({ to, subject, text, html }) {
  const provider = mailProvider();
  const from = process.env.MAIL_FROM || 'The Music Ledger <no-reply@themusicledger.local>';
  if (provider === 'log') {
    await pool.query('INSERT INTO email_outbox (to_email, subject, body_text, body_html) VALUES ($1, $2, $3, $4)', [to, subject, text, html || null]);
    if (process.env.NODE_ENV !== 'test') console.log(`[mail:log] to ${to}: ${subject}`);
    return;
  }
  if (provider === 'resend') {
    if (!process.env.RESEND_API_KEY) throw new Error('RESEND_API_KEY is not set.');
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to: [to], subject, text, html }),
      signal: AbortSignal.timeout(10000)
    });
    if (!res.ok) throw new Error(`Resend refused the email (${res.status}).`);
    return;
  }
  if (provider === 'smtp') {
    let nodemailer;
    try { nodemailer = (await import('nodemailer')).default; } catch { throw new Error('MAIL_PROVIDER=smtp needs nodemailer - run npm install nodemailer in server/.'); }
    const port = Number(process.env.SMTP_PORT || 465);
    const transport = nodemailer.createTransport({
      host: process.env.SMTP_HOST, port, secure: port === 465,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
    });
    await transport.sendMail({ from, to, subject, text, html });
    return;
  }
  throw new Error(`Unknown MAIL_PROVIDER "${provider}".`);
}
