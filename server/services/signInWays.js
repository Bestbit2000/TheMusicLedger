// The ways into Notably Better, in the order the sign-in screen shows them. An invitation lets someone in whichever
// way suits them (the owner, 26 Oct 2026), and there may be more ways later: each way says whether it is on here and
// how an invitation puts it. The invitation email (createInvite), the screen its link opens and the sign-in screen
// (GET /auth/methods) all read this list. A new way is one more entry here, plus its button on the sign-in screen
// (public/app.html, showInviteWays in app.js) and its own sign-in route. docs/password-login.md, "Ways in".
import { isFeatureLive } from './features.js';

export const SIGN_IN_WAYS = [
  // ML-42: always there - Google tells us the address is theirs, and a first sign-in makes the account
  { key: 'google', on: async () => true, invite: 'sign in with Google (if this email address is a Google account)' },
  // ML-355: only while its Live switch is on (read before anyone signs in, so only Live counts)
  { key: 'password', on: () => isFeatureLive('password_login'), invite: 'choose a password' }
];

// The keys of the ways that are on here, in order. A way that can't say is taken as off.
export async function signInWaysOn() {
  const on = await Promise.all(SIGN_IN_WAYS.map(async (w) => { try { return !!(await w.on()); } catch { return false; } }));
  return SIGN_IN_WAYS.filter((_, i) => on[i]).map((w) => w.key);
}

// Pure - unit tested. The sentence an invitation gives: "To get started, sign in with Google (...) or choose a
// password." Only the ways named, in the list's order; '' for none.
export function invitationWays(keys) {
  const phrases = SIGN_IN_WAYS.filter((w) => keys.includes(w.key)).map((w) => w.invite);
  if (!phrases.length) return '';
  const list = phrases.length === 1 ? phrases[0] : `${phrases.slice(0, -1).join(', ')} or ${phrases[phrases.length - 1]}`;
  return `To get started, ${list}.`;
}
