// ML-617: the HTML that goes into the app's emails from Admin -> Email wording - cleaned by sanitize-html (in the
// third-party register) before it is saved and again before it is sent, so only what is listed here survives.
// Pure - unit tested in server/test/emailWording.test.js. docs/email-wording.md.
//   - The words: bold, italic, underline and lists. No links (the app's own button is the only one), no pictures,
//     no styles.
//   - The signature: that, plus links (https, mailto, tel), simple tables and a few styles a pasted signature uses
//     (colours, fonts, sizes, spacing). The only picture is the logo uploaded on the page - any other is taken out,
//     so nothing in an email can load from somewhere else and see who opened it.
import sanitizeHtml from 'sanitize-html';

export const escapeHtml = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const DROP_WITH_CONTENT = ['script', 'style', 'textarea', 'option', 'noscript', 'title', 'head', 'iframe', 'object', 'svg', 'math'];
export const WORDS_TAGS = ['p', 'br', 'strong', 'b', 'em', 'i', 'u', 'ul', 'ol', 'li'];

// Words typed with no tags at all (an older saved wording, or plain text pasted into Edit as HTML): a paragraph per
// blank line, line breaks kept.
function plainToHtml(text) {
  return String(text).split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean)
    .map((p) => `<p>${escapeHtml(p).replace(/\n/g, '<br>')}</p>`).join('');
}

export function cleanWordsHtml(html) {
  const raw = String(html ?? '').replace(/\r\n/g, '\n').trim();
  const asHtml = /<[a-z!/]/i.test(raw) ? raw : plainToHtml(raw);
  return sanitizeHtml(asHtml, { allowedTags: WORDS_TAGS, allowedAttributes: {}, nonTextTags: DROP_WITH_CONTENT }).trim();
}

const colour = [/^#[0-9a-f]{3,8}$/i, /^rgba?\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*(,\s*[\d.]+\s*)?\)$/i, /^[a-z]{3,20}$/i];
const size = [/^\d{1,3}(\.\d+)?(px|pt|em|rem|%)?$/];
const box = [/^-?\d{1,3}(\.\d+)?(px|pt|em|%)?( -?\d{1,3}(\.\d+)?(px|pt|em|%)?){0,3}$/];
const SIGNATURE_STYLES = {
  color: colour, 'background-color': colour,
  'font-size': size, 'line-height': size, width: size, height: size,
  'font-family': [/^[\w\s,'"-]{1,120}$/],
  'font-weight': [/^(normal|bold|bolder|lighter|\d00)$/], 'font-style': [/^(normal|italic)$/],
  'text-decoration': [/^(none|underline)$/], 'text-align': [/^(left|right|center)$/], 'vertical-align': [/^(top|middle|bottom|baseline)$/],
  padding: box, margin: box, 'padding-top': box, 'padding-bottom': box, 'padding-left': box, 'padding-right': box,
  'margin-top': box, 'margin-bottom': box, 'margin-left': box, 'margin-right': box,
  border: [/^\d{1,2}px (solid|dotted|dashed) (#[0-9a-f]{3,8}|[a-z]{3,20})$/i, /^none$/],
  'border-top': [/^\d{1,2}px (solid|dotted|dashed) (#[0-9a-f]{3,8}|[a-z]{3,20})$/i, /^none$/]
};

// logoUrl: the logo uploaded on the page, the one picture allowed (null = none)
export function cleanSignatureHtml(html, logoUrl = null) {
  return sanitizeHtml(String(html ?? '').trim(), {
    allowedTags: [...WORDS_TAGS, 'div', 'span', 'small', 'a', 'img', 'table', 'thead', 'tbody', 'tr', 'td', 'th', 'hr', 'font'],
    allowedAttributes: {
      a: ['href', 'title', 'rel'],
      img: ['src', 'alt', 'width', 'height'],
      table: ['width', 'cellpadding', 'cellspacing', 'border'],
      td: ['colspan', 'rowspan', 'width', 'align', 'valign'], th: ['colspan', 'rowspan', 'width', 'align', 'valign'],
      font: ['color', 'size', 'face'],
      '*': ['style']
    },
    allowedStyles: { '*': SIGNATURE_STYLES },
    allowedSchemes: ['https', 'mailto', 'tel'],
    allowedSchemesByTag: { img: ['https'] },
    allowProtocolRelative: false,
    nonTextTags: DROP_WITH_CONTENT,
    exclusiveFilter: (frame) => frame.tag === 'img' && (!logoUrl || frame.attribs.src !== logoUrl),
    // a link tells the site it goes to nothing about where it came from
    transformTags: { a: (tagName, attribs) => ({ tagName, attribs: { ...attribs, rel: 'noopener noreferrer' } }) },
  }).trim();
}

// The plain-text copy every email carries alongside its HTML: paragraphs, list items as "- ", a link as
// "words (address)" when the words don't already say it.
export function htmlToText(html) {
  const decode = (s) => s.replace(/&nbsp;/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
    .replace(/&#39;|&#x27;/g, "'").replace(/&amp;/g, '&');
  let s = String(html ?? '')
    .replace(/<a\b[^>]*\bhref="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi, (all, href, words) => {
      const w = words.replace(/<[^>]+>/g, '').trim();
      const to = decode(href).replace(/^mailto:|^tel:/i, '');
      const bare = to.replace(/^https?:\/\//i, '').replace(/\/$/, '');
      return !w ? to : w.includes(bare) ? w : `${w} (${to})`;
    })
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<li\b[^>]*>/gi, '\n- ')
    .replace(/<\/(p|div|tr|table|ul|ol|h\d)>/gi, '\n\n')
    .replace(/<\/(td|th)>/gi, ' ')
    .replace(/<hr\b[^>]*>/gi, '\n\n')
    .replace(/<[^>]+>/g, '');
  s = decode(s).split('\n').map((l) => l.replace(/[ \t]+/g, ' ').trim()).join('\n');
  return s.replace(/\n{3,}/g, '\n\n').trim();
}
