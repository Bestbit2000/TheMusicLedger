// ML-231: the security headers every answer from the app carries. They tell the browser what the app
// never needs to do, so a slip elsewhere (a name put on the page unescaped, say) can do less harm.
// The same list is what the site security review checks the live site against (siteSecurityReview.js).
//
// - X-Content-Type-Options: a file is only ever what the server says it is.
// - X-Frame-Options / frame-ancestors: the app can't be shown inside another site's page.
// - Referrer-Policy: other sites are told the app's address, never the page or its query.
// - Permissions-Policy: the microphone is the only device feature the app uses (the tuner).
// - Content-Security-Policy: where scripts, styles, media and connections may come from. No script
//   written in a page is allowed (ML-474: script-src has no 'unsafe-inline') - the inline handlers and
//   the one inline script have been moved out (data-act + CLICK_ACTIONS in app.js; blob-upload.js), and
//   server/test/noInlineScript.test.js fails if one comes back. That is what makes the policy a real
//   second line of defence: script that reached a page as text could not run.
//   It is still sent as REPORT-ONLY until it is switched on: the browser says in its console what the
//   policy would have stopped but stops nothing. Switching it on is two things together, sandbox first
//   (docs/site-security-review.md, "Switching the content security policy on"): CSP_ENFORCE=true on
//   Vercel (the data answers) and `npm run sync-vercel-headers -- --enforce` (the pages).
//   Styles still allow 'unsafe-inline': run-time values are set through the style object, which the
//   policy doesn't stop, but a library may add a style attribute - tightening that is its own piece of work.
// Strict-Transport-Security is added by Vercel itself.
//
// ML-477: on Vercel the pages (public/) are static files that never pass through Express, so this
// middleware only reaches the data answers there. vercel.json's "headers" carries the same list for the
// pages. After changing anything here run `npm run sync-vercel-headers` (server/test/vercelHeaders.test.js
// fails until you do), and after the release check a page with `curl -sI` - the local server serves the
// pages through Express, so a local test can't show this.

// Every outside address a page talks to. Keep in step with server/thirdParties/register.js: an
// address that is in use but missing here is what the report-only policy will complain about.
export const CSP = {
  'default-src': ["'self'"],
  'script-src': ["'self'", 'https://cdn.jsdelivr.net', 'https://eu-assets.i.posthog.com'],
  'style-src': ["'self'", "'unsafe-inline'"],
  'font-src': ["'self'"],
  'img-src': ["'self'", 'data:', 'blob:', 'https://img.youtube.com'],
  'media-src': ["'self'", 'blob:', 'https://*.public.blob.vercel-storage.com'],
  'connect-src': ["'self'", 'https://eu.i.posthog.com', 'https://eu-assets.i.posthog.com', 'https://*.public.blob.vercel-storage.com', 'https://blob.vercel-storage.com', 'https://vercel.com'],
  'frame-src': ['https://www.youtube-nocookie.com'],
  'worker-src': ["'self'"],
  'manifest-src': ["'self'"],
  'object-src': ["'none'"],
  'base-uri': ["'self'"],
  'form-action': ["'self'"],
  'frame-ancestors': ["'none'"]
};
export const cspValue = () => Object.entries(CSP).map(([k, v]) => `${k} ${v.join(' ')}`).join('; ');

export function securityHeaders({ enforceCsp = process.env.CSP_ENFORCE === 'true' } = {}) {
  return {
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'microphone=(self), camera=(), geolocation=(), payment=(), usb=()',
    [enforceCsp ? 'Content-Security-Policy' : 'Content-Security-Policy-Report-Only']: cspValue()
  };
}

export function securityHeadersMiddleware(req, res, next) {
  res.set(securityHeaders());
  next();
}

// Pure: what the review says about a set of response headers (names in any case).
// Each item: { ok, level ('fail' | 'warn'), text }.
export function headerFindings(headers) {
  const h = Object.fromEntries(Object.entries(headers || {}).map(([k, v]) => [k.toLowerCase(), String(v)]));
  const out = [];
  const need = (name, test, why, level = 'fail') => out.push({ ok: !!h[name] && test(h[name]), level, text: `${name}: ${h[name] ? (test(h[name]) ? 'set' : `set, but ${why}`) : 'missing'}` });
  need('strict-transport-security', (v) => Number((/max-age=(\d+)/.exec(v) || [])[1]) >= 15552000, 'for less than six months');
  need('x-content-type-options', (v) => v.toLowerCase() === 'nosniff', 'not "nosniff"');
  out.push({ ok: /deny|sameorigin/i.test(h['x-frame-options'] || '') || /frame-ancestors/.test(h['content-security-policy'] || ''), level: 'fail', text: `framing by other sites: ${/deny|sameorigin/i.test(h['x-frame-options'] || '') || /frame-ancestors/.test(h['content-security-policy'] || '') ? 'refused' : 'allowed'}` });
  need('referrer-policy', (v) => /strict-origin|no-referrer|same-origin/.test(v), 'it sends the full page address to other sites');
  need('permissions-policy', (v) => /geolocation=\(\)/.test(v), 'location is not switched off', 'warn');
  if (h['content-security-policy']) out.push({ ok: !/script-src[^;]*'unsafe-inline'/.test(h['content-security-policy']), level: 'warn', text: `content-security-policy: enforced${/script-src[^;]*'unsafe-inline'/.test(h['content-security-policy']) ? ", but inline script is still allowed ('unsafe-inline')" : ''}` });
  else out.push({ ok: false, level: 'warn', text: `content-security-policy: ${h['content-security-policy-report-only'] ? 'report-only - it warns in the browser console but stops nothing yet' : 'missing'}` });
  return out;
}
