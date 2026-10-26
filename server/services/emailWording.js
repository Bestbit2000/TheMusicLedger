// ML-617 / ML-618: what the app's emails say, changed by a super admin on Admin -> Email wording without a release
// (docs/email-wording.md). The emails themselves - every one the app sends, with its built-in wording, its
// {fill-ins} and which it must use - are listed in emailCatalogue.js. A saved wording (table email_wording) takes
// the built-in one's place; if it ever fails the checks, the built-in wording is sent instead, so the email always
// goes. The app always adds the button's link and the fixed small print itself - neither can be changed.
// The words are HTML with a little formatting (bold, italic, underline, lists - emailHtml.js), cleaned before they are
// saved and again before they are sent; the signature at the bottom is emailSignature.js.
import pool from '../config/db.js';
import { EMAILS, GROUPS, INVITATION_DAYS } from './emailCatalogue.js';
import { LIMITS, fail, named, tidy, hasButton, checkWording, buildEmail } from './emailBuild.js';

export { EMAILS, GROUPS, INVITATION_DAYS };
export { LIMITS, nameOrThere, checkWording, buildEmail, isAlert, previewEmail } from './emailBuild.js';

// The wording to send: the saved one if it passes the checks, otherwise the built-in one.
export async function wordingFor(key) {
  const email = named(key);
  try {
    const { rows } = await pool.query('SELECT subject, body, button FROM email_wording WHERE key = $1', [key]);
    if (rows.length && !checkWording(key, rows[0])) return tidy(rows[0], email);
  } catch (error) {
    console.error(`Email wording (${key}): the saved wording could not be read - the built-in wording is used.`, error.message);
  }
  return { ...email.builtIn };
}

// The email for these fill-ins, in the wording it is sent with now - what every place that sends one calls.
export async function emailFor(key, values = {}) {
  return buildEmail(key, await wordingFor(key), values);
}

// ---- Admin -> Email wording (super admins, server/routes/admin.js) ----
export async function listEmailWording() {
  const { rows } = await pool.query(
    `SELECT w.key, w.subject, w.body, w.button, w.updated_at, a.first_name, a.surname
       FROM email_wording w LEFT JOIN accounts a ON a.id = w.updated_by_account_id`);
  const saved = new Map(rows.map((r) => [r.key, r]));
  return {
    groups: GROUPS,
    emails: Object.entries(EMAILS).map(([key, e]) => {
      const row = saved.get(key);
      return {
        key, group: e.group, name: e.name, about: e.about, limits: LIMITS, builtIn: e.builtIn,
        hasButton: hasButton(e), footer: e.footer(e.sample || {}), toOwner: !!e.toOwner,
        fillIns: Object.entries(e.fillIns).map(([name, what]) => ({ name, what, required: e.required.includes(name) })),
        wording: row ? tidy(row, e) : { ...e.builtIn },
        changed: !!row,
        changedOn: row ? row.updated_at : null,
        changedBy: row ? `${row.first_name || ''} ${row.surname || ''}`.trim() || null : null
      };
    })
  };
}

export async function saveEmailWording(key, wording, accountId) {
  const email = named(key);
  const problem = checkWording(key, wording);
  if (problem) throw fail(400, problem);
  const w = tidy(wording, email);
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

