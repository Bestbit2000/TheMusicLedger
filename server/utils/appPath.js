// ML-242: the front door (notablybetter.com/) is the public page; the app itself lives at /app. The address
// stays the same, so a sign-in, the offline copy, unsent practice and passkeys all carry on - only the path
// moved. Every link the server makes into the app (emails, the sign-in hand-back) is built here.
export const APP_PATH = '/app';

// The address parts the app reads (public/app.js): a link to the front door carrying one of these was made
// for the app before the move - an email already sent, a bookmark - so the server forwards it to /app.
export const APP_LINK_KEYS = ['invite', 'reset', 'band-invite', 'change-email', 'flow', 'flowMode', 'preview', 'authToken'];

// origin: https://notablybetter.com (no trailing slash needed); query: '?invite=...' or ''
export function appLink(origin, query = '') {
  return `${String(origin).replace(/\/+$/, '')}${APP_PATH}${query}`;
}

// Pure - unit tested. The query of a request to the front door -> where it should go instead, or null to stay.
export function forwardToApp(query = {}) {
  return Object.keys(query).some((key) => APP_LINK_KEYS.includes(key));
}
