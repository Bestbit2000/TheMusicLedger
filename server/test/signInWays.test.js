// 26 Oct 2026: an invitation offers every way in that is on (server/services/signInWays.js) - the sentence it gives,
// the email itself (invitationEmail), and that a first Google sign-in takes up a waiting invitation. Pure: the pool
// is never queried.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

process.env.DATABASE_URL ||= 'postgres://test@localhost/test';
const { SIGN_IN_WAYS, invitationWays } = await import('../services/signInWays.js');
const { invitationEmail } = await import('../services/passwordAuth.js');
const read = (path) => fs.readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');

describe('invitationWays', () => {
  test('Google and a password, in the list\'s order whatever order they are asked in', () => {
    assert.equal(invitationWays(['password', 'google']), 'To get started, sign in with Google (if this email address is a Google account) or choose a password.');
  });
  test('only the ways that are on', () => {
    assert.equal(invitationWays(['google']), 'To get started, sign in with Google (if this email address is a Google account).');
    assert.equal(invitationWays(['password']), 'To get started, choose a password.');
    assert.equal(invitationWays([]), '');
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
  test('a newcomer is offered every way in, with one "Get started" button', () => {
    const { subject, text, html } = invitationEmail({ firstName: 'Sam', url, ways: ['google', 'password'], existing: false });
    assert.equal(subject, "You're invited to Notably Better");
    assert.match(text, /^Hi Sam,\n\nYou've been invited to Notably Better\.\n\nTo get started, sign in with Google .* or choose a password\./);
    assert.match(text, /Get started: https:\/\/app\.example\/app\?invite=abc/);
    assert.match(html, />Get started</);
    assert.doesNotMatch(text, /Choose your password/);
  });
  test('with password login off, Google only', () => {
    const { text } = invitationEmail({ url, ways: ['google'], existing: false });
    assert.match(text, /^Hi,\n\nYou've been invited to Notably Better\.\n\nTo get started, sign in with Google \(if this email address is a Google account\)\./);
    assert.doesNotMatch(text, /password/);
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
});
