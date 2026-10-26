// ML-617: what the app's emails say, changed by a super admin on Admin -> Email wording without a release
// (docs/email-wording.md). EMAILS lists the emails that can be changed - only the invitation so far - each with
// its built-in wording, the {fill-ins} it may use and the ones it must use. A saved wording (table email_wording)
// takes the built-in one's place; if it ever fails the checks, the built-in wording is sent instead, so the email
// always goes. The app always adds the button's link and the fixed last line itself - neither can be changed.
// The words are HTML with a little formatting (bold, italic, underline, lists - emailHtml.js), cleaned before they are
// saved and again before they are sent; the signature at the bottom is emailSignature.js.
import pool from '../config/db.js';
import { emailBodyHtml, withSignature } from './mail.js';
import { cleanWordsHtml, htmlToText, escapeHtml } from './emailHtml.js';

export const INVITATION_DAYS = 7; // how long an invitation's link works (passwordAuth.js)

// subject and button in characters; body is the words as read (the HTML itself may be up to bodyHtml)
export const LIMITS = { subject: 100, body: 1500, button: 30, bodyHtml: 6000 };

export const EMAILS = {
  invitation: {
    name: 'Invitation',
    about: 'Sent when someone is invited to Notably Better: Let in on the Waiting list, Invite by email on Accounts, and Invite someone from the main menu.',
    fillIns: {
      'first name': 'Their first name, or "there" when we don\'t have one.',
      'ways in': 'How they can get in - "sign in with Google if this email address is a Google account, or choose a password" - from the ways switched on here.'
    },
    required: ['ways in'],
    // The owner's choice, 26 Oct 2026 (option 1)
    builtIn: {
      subject: "You're invited to Notably Better",
      body: [
        'Hi {first name},',
        "Welcome to Notably Better! You've been invited to join, and we're really glad you're here.",
        "It's a practice app made for bands. Your band's music is in one place, so you can play it and practise it at your own pace.",
        'Getting in takes a minute: {ways in}.',
        'See you there!'
      ].map((p) => `<p>${p}</p>`).join(''),
      button: 'Get started'
    },
    // Fixed: it is what tells someone who wasn't expecting it that they can ignore it
    footer: () => `This link works for ${INVITATION_DAYS} days. If you weren't expecting it, you can ignore this email.`,
    sample: { 'first name': 'Bert' }
  }
};

const fail = (status, message) => Object.assign(new Error(message), { status });
const named = (key) => {
  const email = EMAILS[key];
  if (!email) throw fail(404, 'There is no such email.');
  return email;
};
const fillInName = (raw) => raw.trim().replace(/\s+/g, ' ').toLowerCase();
// The body is cleaned here, so everything after works on the HTML that will be kept and sent
const tidy = (w = {}) => ({
  subject: String(w.subject ?? '').replace(/\s+/g, ' ').trim(),
  body: cleanWordsHtml(w.body),
  button: String(w.button ?? '').replace(/\s+/g, ' ').trim()
});
const FILL_IN = /\{([^{}<>]*)\}/g;

// Pure - unit tested. What is wrong with a wording, in words for the page, or null if it can be saved.
export function checkWording(key, wording) {
  const email = named(key);
  const w = tidy(wording);
  const words = htmlToText(w.body);
  if (!w.subject) return 'Write a subject.';
  if (!words) return 'Write the words.';
  if (!w.button) return 'Write the words for the button.';
  for (const part of ['subject', 'button']) {
    if (w[part].length > LIMITS[part]) return `The ${part} can be up to ${LIMITS[part]} characters.`;
  }
  if (words.length > LIMITS.body) return `The words can be up to ${LIMITS.body} characters.`;
  if (w.body.length > LIMITS.bodyHtml) return 'The words have too much formatting - try taking some of it off.';
  if (/<a\s/i.test(String(wording.body || '')) || /https?:\/\/|www\./i.test(`${w.subject} ${words} ${w.button}`)) return 'Leave links out of the words - the app adds the button\'s link itself, and links can go in the signature.';
  for (const text of [w.subject, words, w.button]) {
    if (/[{}]/.test(text.replace(/\{[^{}]*\}/g, ''))) return 'A curly bracket isn\'t closed - fill-ins are written like {first name}.';
    for (const m of text.matchAll(/\{([^{}]*)\}/g)) {
      if (!email.fillIns[fillInName(m[1])]) return `{${m[1]}} isn't a fill-in this email knows. It knows ${Object.keys(email.fillIns).map((f) => `{${f}}`).join(' and ')}.`;
    }
  }
  // A fill-in with formatting part-way through ({first <b>name</b>}) reads right but couldn't be filled in
  if ([...words.matchAll(/\{[^{}]*\}/g)].length !== [...w.body.matchAll(FILL_IN)].length) return 'A fill-in has formatting part-way through it - make the whole fill-in bold (or italic) or none of it.';
  const used = new Set([...w.body.matchAll(FILL_IN)].map((m) => fillInName(m[1])));
  const missing = email.required.find((f) => !used.has(f));
  if (missing) return `The words need {${missing}} in them, so everyone knows how to get in.`;
  return null;
}

// Pure - unit tested. The email itself: fill-ins filled (escaped), the app's button and the fixed last line.
// values: the fill-ins ({ 'first name': ..., 'ways in': ... }) and the button's url. The signature is added as it
// is sent (sendMail).
export function buildEmail(key, wording, values = {}) {
  const email = named(key);
  const w = tidy(wording);
  const fill = (text, escape) => text.replace(FILL_IN, (all, name) => {
    const v = values[fillInName(name)];
    if (v === undefined || v === null) return all;
    return escape ? escapeHtml(v) : String(v);
  });
  return { subject: fill(w.subject, false), ...emailBodyHtml(fill(w.body, true), fill(w.button, false), values.url, email.footer(values)) };
}

// The wording to send: the saved one if it passes the checks, otherwise the built-in one.
export async function wordingFor(key) {
  const email = named(key);
  try {
    const { rows } = await pool.query('SELECT subject, body, button FROM email_wording WHERE key = $1', [key]);
    if (rows.length && !checkWording(key, rows[0])) return tidy(rows[0]);
  } catch (error) {
    console.error(`Email wording (${key}): the saved wording could not be read - the built-in wording is used.`, error.message);
  }
  return { ...email.builtIn };
}

// ---- Admin -> Email wording (super admins, server/routes/admin.js) ----
export async function listEmailWording() {
  const { rows } = await pool.query(
    `SELECT w.key, w.subject, w.body, w.button, w.updated_at, a.first_name, a.surname
       FROM email_wording w LEFT JOIN accounts a ON a.id = w.updated_by_account_id`);
  const saved = new Map(rows.map((r) => [r.key, r]));
  return {
    emails: Object.entries(EMAILS).map(([key, e]) => {
      const row = saved.get(key);
      return {
        key, name: e.name, about: e.about, limits: LIMITS, builtIn: e.builtIn, footer: e.footer(),
        fillIns: Object.entries(e.fillIns).map(([name, what]) => ({ name, what, required: e.required.includes(name) })),
        wording: row ? tidy(row) : { ...e.builtIn },
        changed: !!row,
        changedOn: row ? row.updated_at : null,
        changedBy: row ? `${row.first_name || ''} ${row.surname || ''}`.trim() || null : null
      };
    })
  };
}

export async function saveEmailWording(key, wording, accountId) {
  const problem = checkWording(key, wording);
  if (problem) throw fail(400, problem);
  const w = tidy(wording);
  await pool.query(
    `INSERT INTO email_wording (key, subject, body, button, updated_by_account_id) VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (key) DO UPDATE SET subject = $2, body = $3, button = $4, updated_at = now(), updated_by_account_id = $5`,
    [key, w.subject, w.body, w.button, accountId]);
  return listEmailWording();
}

export async function resetEmailWording(key) {
  named(key);
  await pool.query('DELETE FROM email_wording WHERE key = $1', [key]);
  return listEmailWording();
}

// The email as it would arrive, for the page's preview or a test - a draft from the page, checked first, with the
// signature ({ html, text }) the route gives. values: the fill-ins as they would be sent (the route supplies the
// real ways in); the sample name otherwise.
export function previewEmail(key, wording, values = {}, signature = null) {
  const problem = checkWording(key, wording);
  if (problem) throw fail(400, problem);
  return withSignature(buildEmail(key, wording, { ...named(key).sample, ...values }), signature);
}
