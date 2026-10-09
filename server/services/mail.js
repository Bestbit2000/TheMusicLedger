// ML-355: sending email. Which service is a setting, not code (docs/password-login.md):
//   MAIL_PROVIDER=log     (the default) - written to the email_outbox table, never sent. Local and dev.
//   MAIL_PROVIDER=smtp    - any SMTP server. The live site sends through Brevo:
//                           SMTP_HOST=smtp-relay.brevo.com SMTP_PORT=587 SMTP_USER=<SMTP login> SMTP_PASS=<SMTP key>
//                           (needs `npm install nodemailer` in server/ - it's only loaded for this mode)
// MAIL_FROM is the sender: "Notably Better <noreply@notablybetter.com>".

import pool from '../config/db.js';

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

export async function sendMail({ to, subject, text, html }) {
  const provider = mailProvider();
  const from = process.env.MAIL_FROM || 'Notably Better <noreply@notablybetter.com>';
  if (provider === 'log') {
    await pool.query('INSERT INTO email_outbox (to_email, subject, body_text, body_html) VALUES ($1, $2, $3, $4)', [to, subject, text, html || null]);
    if (process.env.NODE_ENV !== 'test') console.log(`[mail:log] to ${to}: ${subject}`);
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

// The one layout every email from the app uses: a few lines, one button, a small footer (and the same in
// plain text). Everything is escaped here - pass words, not HTML.
const esc = (s) => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export function emailBody(lines, buttonText, url, footer) {
  const text = `${lines.join('\n\n')}\n\n${buttonText}: ${url}\n\n${footer}`;
  const html = `<div style="font-family:Arial,sans-serif;font-size:16px;line-height:1.5;color:#222;max-width:520px">
${lines.map(l => `<p>${esc(l)}</p>`).join('\n')}
<p><a href="${esc(url)}" style="display:inline-block;background:#c9a227;color:#111;padding:12px 20px;border-radius:6px;text-decoration:none;font-weight:bold">${esc(buttonText)}</a></p>
<p style="font-size:13px;color:#555">Or copy this link: ${esc(url)}</p>
<p style="font-size:13px;color:#555">${esc(footer)}</p></div>`;
  return { text, html };
}
