// 26 Oct 2026: an invitation offers every way in that is on (server/services/signInWays.js) - the words it gives,
// the email itself (invitationEmail, with the wording from Admin -> Email wording, ML-617), and that a first Google
// sign-in takes up a waiting invitation. Pure: the pool is never queried.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

process.env.DATABASE_URL ||= 'postgres://test@localhost/test';
const { SIGN_IN_WAYS, waysInWords } = await import('../services/signInWays.js');
const { invitationEmail } = await import('../services/passwordAuth.js');
const read = (path) => fs.readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');

describe('waysInWords (the {ways in} fill-in, ML-617)', () => {
  test("Google and a password, in the list's order whatever order they are asked in", () => {
    assert.equal(waysInWords(['password', 'google']), 'sign in with Google if this email address is a Google account, or choose a password');
  });
  test('only the ways that are on', () => {
    assert.equal(waysInWords(['google']), 'sign in with Google if this email address is a Google account');
    assert.equal(waysInWords(['password']), 'choose a password');
    assert.equal(waysInWords([]), '');
  });
  test('every way has a key, a switch and the words an invitation uses', () => {
    for (const w of SIGN_IN_WAYS) {
      assert.match(w.key, /^[a-z]+$/);
      assert.equal(typeof w.on, 'function');
      assert.ok(w.invite.length > 5);
    }
  });
});

describe('the invitation email', () => {
  const url = 'https://app.example/app?invite=abc';
  test("a newcomer gets the owner's wording (option 1), every way in, and one Get started button", () => {
    const { subject, text, html } = invitationEmail({ firstName: 'Sam', url, ways: ['google', 'password'], existing: false });
    assert.equal(subject, "You're invited to Notably Better");
    assert.match(text, /^Hi Sam,\n\nWelcome to Notably Better! You've been invited to join, and we're really glad you're here\.\n\n/);
    assert.match(text, /Getting in takes a minute: sign in with Google if this email address is a Google account, or choose a password\.\n\nSee you there!/);
    assert.match(text, /Get started: https:\/\/app\.example\/app\?invite=abc\n\nThis link works for 7 days\./);
    assert.match(html, />Get started</);
  });
  test('with password login off, Google only; with no name, "Hi there"', () => {
    const { text } = invitationEmail({ url, ways: ['google'], existing: false });
    assert.match(text, /^Hi there,/);
    assert.match(text, /Getting in takes a minute: sign in with Google if this email address is a Google account\./);
    assert.doesNotMatch(text, /password/);
  });
  test('saved wording from Admin -> Email wording is used', () => {
    const wording = { subject: 'Come and play, {first name}', body: 'Hello {first name}!\n\nTo join: {ways in}.', button: 'Join in' };
    const { subject, text } = invitationEmail({ firstName: 'Sam', url, ways: ['password'], existing: false, wording });
    assert.equal(subject, 'Come and play, Sam');
    assert.match(text, /^Hello Sam!\n\nTo join: choose a password\.\n\nJoin in: https:/);
  });
  test('someone who already has an account can only gain a password', () => {
    assert.match(invitationEmail({ firstName: 'Kim', url, ways: ['google', 'password'], existing: true }).text, /with your email and a password, as well as Google/);
  });
});

describe('from the source', () => {
  test('a first Google sign-in takes the invitation: its type, and it is used up', () => {
    const src = read('server/services/accounts.js');
    assert.match(src, /FROM auth_email_links\s+WHERE purpose = 'invite' AND used_at IS NULL AND expires_at > now\(\) AND lower\(email\) = lower\(\$1\)/);
    assert.match(src, /invite\?\.account_level \|\| 'standard_member'/);
    assert.match(src, /if \(invite\) await pool\.query\("UPDATE auth_email_links SET used_at = now\(\) WHERE purpose = 'invite'/);
  });
  test('the invitation, its screen and the sign-in screen all read SIGN_IN_WAYS', () => {
    assert.match(read('server/services/passwordAuth.js'), /export async function createInvite[\s\S]*?const ways = await signInWaysOn\(\);/);
    assert.match(read('server/services/passwordAuth.js'), /export async function describeLink[\s\S]*?signInWaysOn\(\)/);
    assert.match(read('server/routes/auth.js'), /const ways = await signInWaysOn\(\);/);
  });
  test('a reset link still needs password login', () => {
    assert.match(read('server/services/passwordAuth.js'), /purpose === 'invite' \? !ways\.length : !\(await passwordLoginEnabled\(\)\)/);
  });
  test('an invitation reads its wording from Admin -> Email wording', () => {
    assert.match(read('server/services/passwordAuth.js'), /const wording = await wordingFor\(existing \? 'invitation_existing' : 'invitation'\);/);
  });
});
