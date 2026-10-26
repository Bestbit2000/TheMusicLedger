// ML-618: building the app's emails from their wording - pure, no database, so every email can be built in a test.
// The emails and their built-in wording are emailCatalogue.js; the saved wording and the admin page are emailWording.js;
// the layout is emailLayout.js. docs/email-wording.md.
import { emailBodyHtml, withSignature } from './emailLayout.js';
import { cleanWordsHtml, htmlToText, escapeHtml } from './emailHtml.js';
import { EMAILS } from './emailCatalogue.js';

// subject and button in characters; body is the words as read (the HTML itself may be up to bodyHtml)
export const LIMITS = { subject: 100, body: 1500, button: 30, bodyHtml: 6000 };

export const fail = (status, message) => Object.assign(new Error(message), { status });
export const named = (key) => {
  const email = Object.hasOwn(EMAILS, key) ? EMAILS[key] : null;
  if (!email) throw fail(404, 'There is no such email.');
  return email;
};
export const hasButton = (email) => email.builtIn.button !== null;
// {first name}: their first name, or "there" ("Hi there,") when we don't have one
export const nameOrThere = (firstName) => String(firstName || '').trim() || 'there';
const fillInName = (raw) => raw.trim().replace(/\s+/g, ' ').toLowerCase();
// The body is cleaned here, so everything after works on the HTML that will be kept and sent
export const tidy = (w = {}, email = null) => ({
  subject: String(w.subject ?? '').replace(/\s+/g, ' ').trim(),
  body: cleanWordsHtml(w.body),
  button: email && !hasButton(email) ? null : String(w.button ?? '').replace(/\s+/g, ' ').trim()
});
const FILL_IN = /\{([^{}<>]*)\}/g;

// Pure - unit tested. What is wrong with a wording, in words for the page, or null if it can be saved.
export function checkWording(key, wording) {
  const email = named(key);
  const w = tidy(wording, email);
  const words = htmlToText(w.body);
  if (!w.subject) return 'Write a subject.';
  if (!words) return 'Write the words.';
  if (hasButton(email) && !w.button) return 'Write the words for the button.';
  if (w.subject.length > LIMITS.subject) return `The subject can be up to ${LIMITS.subject} characters.`;
  if (w.button && w.button.length > LIMITS.button) return `The button can be up to ${LIMITS.button} characters.`;
  if (words.length > LIMITS.body) return `The words can be up to ${LIMITS.body} characters.`;
  if (w.body.length > LIMITS.bodyHtml) return 'The words have too much formatting - try taking some of it off.';
  if (/<a\s/i.test(String(wording.body || '')) || /https?:\/\/|www\./i.test(`${w.subject} ${words} ${w.button || ''}`)) return 'Leave links out of the words - the app adds the button\'s link itself, and links can go in the signature.';
  for (const text of [w.subject, words, w.button || '']) {
    if (/[{}]/.test(text.replace(/\{[^{}]*\}/g, ''))) return 'A curly bracket isn\'t closed - fill-ins are written like {first name}.';
    for (const m of text.matchAll(/\{([^{}]*)\}/g)) {
      if (!email.fillIns[fillInName(m[1])]) return `{${m[1]}} isn't a fill-in this email knows. It knows ${Object.keys(email.fillIns).map((f) => `{${f}}`).join(', ')}.`;
    }
  }
  // A fill-in with formatting part-way through ({first <b>name</b>}) reads right but couldn't be filled in
  if ([...words.matchAll(/\{[^{}]*\}/g)].length !== [...w.body.matchAll(FILL_IN)].length) return 'A fill-in has formatting part-way through it - make the whole fill-in bold (or italic) or none of it.';
  const used = new Set([...w.body.matchAll(FILL_IN)].map((m) => fillInName(m[1])));
  const missing = email.required.find((f) => !used.has(f));
  if (missing) return `The words need {${missing}} in them - the email doesn't make sense without it.`;
  // A message is paragraphs of its own, so it can't sit inside a sentence
  for (const block of email.blocks || []) {
    for (const para of w.body.match(/<(p|li)>[\s\S]*?<\/\1>/g) || []) {
      const text = para.replace(/<[^>]+>/g, '').trim();
      const hasIt = [...text.matchAll(/\{([^{}]*)\}/g)].some((m) => fillInName(m[1]) === block);
      if (hasIt && !/^\{[^{}]*\}$/.test(text)) return `Put {${block}} in a paragraph of its own - it is one or more paragraphs itself.`;
    }
  }
  return null;
}

// Pure - unit tested. The email itself: fill-ins filled (escaped), the app's button and the fixed small print.
// values: the fill-ins ({ 'first name': ..., 'ways in': ... }), the button's url and, for a band's invitation, the
// picture ({ src, alt }). A block fill-in ({message}) becomes paragraphs; a fill-in left empty leaves no empty
// paragraph behind. The signature is added as it is sent (sendMail).
export function buildEmail(key, wording, values = {}) {
  const email = named(key);
  const w = tidy(wording, email);
  const blocks = new Set(email.blocks || []);
  const valueOf = (name) => values[fillInName(name)];
  const fill = (text, escape) => text.replace(FILL_IN, (all, name) => {
    const v = valueOf(name);
    if (v === undefined || v === null) return all;
    return escape ? escapeHtml(v).replace(/\n/g, '<br>') : String(v).replace(/\s+/g, ' ');
  });
  // A paragraph that is only a block fill-in becomes the block's own paragraphs
  let body = w.body.replace(/<p>\s*\{([^{}<>]*)\}\s*<\/p>/g, (all, name) => {
    if (!blocks.has(fillInName(name))) return all;
    const v = valueOf(name);
    if (v === undefined || v === null) return all;
    return String(v).split(/\n\s*\n/).map((s) => s.trim()).filter(Boolean)
      .map((s) => `<p>${escapeHtml(s).replace(/\n/g, '<br>')}</p>`).join('');
  });
  body = fill(body, true).replace(/<(p|li)>\s*(<br\s*\/?>\s*)*<\/\1>/g, '');
  const button = hasButton(email) ? fill(w.button, false) : null;
  return {
    subject: fill(w.subject, false),
    ...emailBodyHtml(body, button, values.url, email.footer(values), values.picture ? { image: values.picture } : {})
  };
}

// Is this email an alert to the owner (no signature)?
export const isAlert = (key) => !!named(key).toOwner;

// The email as it would arrive, for the page's preview or a test - a draft from the page, checked first, with the
// signature ({ html, text }) the route gives (none for an alert). values: the fill-ins as they would be sent (the
// route supplies the real ways in and a link); the email's sample otherwise.
export function previewEmail(key, wording, values = {}, signature = null) {
  const problem = checkWording(key, wording);
  if (problem) throw fail(400, problem);
  const email = buildEmail(key, wording, { ...named(key).sample, ...values });
  return isAlert(key) ? email : withSignature(email, signature);
}
