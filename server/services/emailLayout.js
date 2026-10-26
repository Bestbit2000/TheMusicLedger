// The layout of every email the app sends - pure, no database (mail.js sends them; emailBuild.js fills them in).
import { htmlToText } from './emailHtml.js';

// The one layout every email from the app uses: a few lines, one button, a small footer (and the same in
// plain text). Everything is escaped here - pass words, not HTML.
const esc = (s) => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
// ML-534: an optional picture at the top (a band's logo on its invitation) - an https address only, the same
// one for everyone (nothing in it says who opened the email). The plain text has no picture; the words say it all.
export function emailBody(lines, buttonText, url, footer, { image } = {}) {
  const text = `${lines.join('\n\n')}\n\n${buttonText}: ${url}\n\n${footer}`;
  const picture = image && /^https:\/\//.test(String(image.src || ''))
    ? `<p><img src="${esc(image.src)}" alt="${esc(image.alt || '')}" width="96" height="96" style="width:96px;height:96px;object-fit:contain;border:1px solid #ddd;border-radius:6px"></p>\n`
    : '';
  const html = `<div style="font-family:Arial,sans-serif;font-size:16px;line-height:1.5;color:#222;max-width:520px">
${picture}${lines.map(l => `<p>${esc(l)}</p>`).join('\n')}
<p><a href="${esc(url)}" style="display:inline-block;background:#c9a227;color:#111;padding:12px 20px;border-radius:6px;text-decoration:none;font-weight:bold">${esc(buttonText)}</a></p>
<p style="font-size:13px;color:#555">Or copy this link: ${esc(url)}</p>
${SIGNATURE_MARK}
<p style="font-size:13px;color:#555">${esc(footer)}</p></div>`;
  return { text, html };
}

// ML-617: the same layout for words that are already HTML - cleaned words from Admin -> Email wording (emailHtml.js).
// The plain-text copy is made from them. ML-618: an email may have no button (buttonText null) or no small print
// (footer null), and a band's invitation has its logo at the top (image, as emailBody).
export function emailBodyHtml(bodyHtml, buttonText, url, footer, { image } = {}) {
  const button = buttonText && url;
  const text = [htmlToText(bodyHtml), button ? `${buttonText}: ${url}` : '', footer || ''].filter(Boolean).join('\n\n');
  const picture = image && /^https:\/\//.test(String(image.src || ''))
    ? `<p><img src="${esc(image.src)}" alt="${esc(image.alt || '')}" width="96" height="96" style="width:96px;height:96px;object-fit:contain;border:1px solid #ddd;border-radius:6px"></p>\n`
    : '';
  const html = `<div style="font-family:Arial,sans-serif;font-size:16px;line-height:1.5;color:#222;max-width:520px">
${picture}${bodyHtml}
${button ? `<p><a href="${esc(url)}" style="display:inline-block;background:#c9a227;color:#111;padding:12px 20px;border-radius:6px;text-decoration:none;font-weight:bold">${esc(buttonText)}</a></p>
<p style="font-size:13px;color:#555">Or copy this link: ${esc(url)}</p>
` : ''}${SIGNATURE_MARK}${footer ? `
<p style="font-size:13px;color:#555">${esc(footer)}</p>` : ''}</div>`;
  return { text, html };
}

// ML-617: the signature from Admin -> Email wording goes at the bottom of every email a member gets - where
// emailBody marked its place (before the small print), or at the end. toOwner: an alert to the owner (a new
// request to join, a report, a cost warning, a sign-up) - those go without it. An email with no HTML of its own
// gets a plain one, so the signature's formatting shows.
export const SIGNATURE_MARK = '<!--nb-signature-->';
const signatureBlock = (sig) => `<div style="margin-top:24px">${sig.html}</div>`;
export function withSignature({ text, html, ...rest }, sig) {
  if (!sig || !sig.html) return { text, html, ...rest };
  const paragraphs = String(text || '').split(/\n\s*\n/).map((p) => `<p>${esc(p).replace(/\n/g, '<br>')}</p>`).join('\n');
  const body = html || `<div style="font-family:Arial,sans-serif;font-size:16px;line-height:1.5;color:#222;max-width:520px">${paragraphs}${SIGNATURE_MARK}</div>`;
  return {
    ...rest,
    text: `${text || ''}\n\n${sig.text}`,
    html: body.includes(SIGNATURE_MARK) ? body.replace(SIGNATURE_MARK, signatureBlock(sig)) : `${body}${signatureBlock(sig)}`
  };
}