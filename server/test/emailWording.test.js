// ML-617: Admin -> Email wording (server/services/emailWording.js) - the checks a wording must pass before it is
// saved, how an email is built from it, and that the routes are super admins only, behind the admin check. Pure:
// the pool is never queried.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

process.env.DATABASE_URL ||= 'postgres://test@localhost/test';
const { EMAILS, LIMITS, checkWording, buildEmail, previewEmail } = await import('../services/emailWording.js');
const { cleanWordsHtml, cleanSignatureHtml, htmlToText } = await import('../services/emailHtml.js');
const { withSignature, SIGNATURE_MARK } = await import('../services/mail.js');
const read = (path) => fs.readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');

const good = { subject: 'Welcome, {first name}', body: 'Hi {first name},\n\nJoin us: {ways in}.', button: 'Get started' };

describe('checkWording', () => {
  test('the built-in invitation passes, and so does a good one', () => {
    assert.equal(checkWording('invitation', EMAILS.invitation.builtIn), null);
    assert.equal(checkWording('invitation', good), null);
  });
  test('fill-ins are matched whatever their case or spacing', () => {
    assert.equal(checkWording('invitation', { ...good, body: 'Hi { First  Name },\n\n{WAYS IN}.' }), null);
  });
  test('every part must be written', () => {
    assert.match(checkWording('invitation', { ...good, subject: '  ' }), /Write a subject/);
    assert.match(checkWording('invitation', { ...good, body: '' }), /Write the words/);
    assert.match(checkWording('invitation', { ...good, button: '' }), /button/);
  });
  test('the limits', () => {
    assert.match(checkWording('invitation', { ...good, subject: 'x'.repeat(LIMITS.subject + 1) }), /subject can be up to 100/);
    assert.match(checkWording('invitation', { ...good, body: `{ways in} ${'x'.repeat(LIMITS.body)}` }), /words can be up to 1500/);
    assert.match(checkWording('invitation', { ...good, button: 'x'.repeat(LIMITS.button + 1) }), /button can be up to 30/);
  });
  test('{ways in} must be in the words, so nobody is left not knowing how to get in', () => {
    assert.match(checkWording('invitation', { ...good, body: 'Hi {first name}, welcome!' }), /need \{ways in\}/);
    assert.match(checkWording('invitation', { ...good, subject: '{ways in}', body: 'Hi!' }), /need \{ways in\}/, 'only the words count');
  });
  test('an unknown fill-in, or a bracket left open, is refused', () => {
    assert.match(checkWording('invitation', { ...good, body: 'Hi {name}, {ways in}' }), /\{name\} isn't a fill-in this email knows/);
    assert.match(checkWording('invitation', { ...good, body: 'Hi {first name, {ways in}' }), /curly bracket isn't closed/);
    assert.match(checkWording('invitation', { ...good, button: 'Go }' }), /curly bracket isn't closed/);
  });
  test('no links typed in - the app adds the only one', () => {
    assert.match(checkWording('invitation', { ...good, body: 'See https://example.com {ways in}' }), /Leave links out/);
    assert.match(checkWording('invitation', { ...good, body: 'See www.example.com {ways in}' }), /Leave links out/);
  });
  test('an email that does not exist', () => {
    assert.throws(() => checkWording('nope', good), /no such email/);
  });
});

describe('buildEmail', () => {
  test('fill-ins filled, a paragraph per blank line, then the button and the fixed last line', () => {
    const { subject, text, html } = buildEmail('invitation', good, { 'first name': 'Bert', 'ways in': 'choose a password', url: 'https://app.example/app?invite=x' });
    assert.equal(subject, 'Welcome, Bert');
    assert.equal(text, "Hi Bert,\n\nJoin us: choose a password.\n\nGet started: https://app.example/app?invite=x\n\nThis link works for 7 days. If you weren't expecting it, you can ignore this email.");
    assert.match(html, /<p>Hi Bert,<\/p>/);
  });
  test('formatting is kept; a fill-in\'s value is escaped in the HTML', () => {
    const { text, html } = buildEmail('invitation', { ...good, body: '<p>Hi <strong>{first name}</strong>,</p><ul><li>{ways in}</li></ul>' }, { 'first name': 'Bo <b>', 'ways in': 'x', url: 'https://a.example' });
    assert.match(html, /<p>Hi <strong>Bo &lt;b&gt;<\/strong>,<\/p><ul><li>x<\/li><\/ul>/);
    assert.match(text, /^Hi Bo <b>,\n\n- x\n\n/);
  });
  test('the built-in wording is HTML, a paragraph each', () => {
    assert.match(EMAILS.invitation.builtIn.body, /^<p>Hi \{first name\},<\/p><p>Welcome to Notably Better!/);
  });
  test('a preview uses the sample name and refuses a wording that fails the checks', () => {
    assert.match(previewEmail('invitation', good, { 'ways in': 'choose a password', url: 'https://a.example' }).text, /^Hi Bert,/);
    assert.throws(() => previewEmail('invitation', { ...good, body: 'no way in' }), /need \{ways in\}/);
  });
});

describe('the HTML an email may carry (emailHtml.js)', () => {
  const LOGO = 'https://abc.public.blob.vercel-storage.com/email-signature/logo-x.png';
  test('the words keep bold, italic, underline and lists - nothing else', () => {
    assert.equal(cleanWordsHtml('<p>Hi <b>Bo</b> <i>a</i> <u>b</u><script>alert(1)</script><img src=x onerror=1></p><ul><li>one</li></ul><p style="color:red">two</p>'),
      '<p>Hi <b>Bo</b> <i>a</i> <u>b</u></p><ul><li>one</li></ul><p>two</p>');
  });
  test('words typed without tags become paragraphs', () => {
    assert.equal(cleanWordsHtml('Hi {first name},\n\nLine two\nmore'), '<p>Hi {first name},</p><p>Line two<br />more</p>');
  });
  test('a link in the words is refused, not quietly dropped', () => {
    assert.match(checkWording('invitation', { ...good, body: '<p>See <a href="https://x.example">this</a> {ways in}</p>' }), /Leave links out of the words/);
  });
  test('a fill-in with formatting part-way through is refused', () => {
    assert.match(checkWording('invitation', { ...good, body: '<p>Hi {first <b>name</b>}, {ways in}</p>' }), /formatting part-way through/);
    assert.equal(checkWording('invitation', { ...good, body: '<p>Hi <b>{first name}</b>, {ways in}</p>' }), null);
  });
  test('the signature keeps links, tables and simple styles; only the uploaded logo as a picture', () => {
    const clean = cleanSignatureHtml(`<table><tr><td style="color:#123456;font-family:Arial;position:fixed"><img src="${LOGO}" width="120"><img src="https://tracker.example/p.gif"><a href="https://notablybetter.com" onclick="x()">Site</a> <a href="javascript:alert(1)">bad</a> <a href="mailto:hello@notablybetter.com">mail</a></td></tr></table>`, LOGO);
    assert.match(clean, /<td style="color:#123456;font-family:Arial">/);
    assert.match(clean, new RegExp(`<img src="${LOGO.replace(/[.?]/g, '\\$&')}" width="120" />`));
    assert.doesNotMatch(clean, /tracker|onclick|javascript|position/);
    assert.match(clean, /<a href="https:\/\/notablybetter\.com" rel="noopener noreferrer">Site<\/a>/);
    assert.match(clean, /<a href="mailto:hello@notablybetter\.com"/);
  });
  test('with no logo uploaded, no picture at all', () => {
    assert.doesNotMatch(cleanSignatureHtml(`<p><img src="${LOGO}">Hi</p>`, null), /<img/);
  });
  test('the plain-text copy: paragraphs, list items, links once', () => {
    assert.equal(htmlToText('<p>Hi <b>Bert</b></p><ul><li>one</li><li>two</li></ul><p><a href="https://notablybetter.com">Our site</a> &amp; <a href="https://notablybetter.com">notablybetter.com</a></p>'),
      'Hi Bert\n\n- one\n- two\n\nOur site (https://notablybetter.com) & notablybetter.com');
  });
});

describe('the signature on emails (mail.js)', () => {
  const sig = { html: '<p><b>Andrew</b></p>', text: 'Andrew' };
  test('it goes where the email marked its place - before the small print - and at the end of the text', () => {
    const { text, html } = withSignature({ text: 'Words', html: `<div><p>Words</p>${SIGNATURE_MARK}<p>Small print</p></div>` }, sig);
    assert.equal(text, 'Words\n\nAndrew');
    assert.match(html, /<p>Words<\/p><div style="margin-top:24px"><p><b>Andrew<\/b><\/p><\/div><p>Small print<\/p>/);
  });
  test('an email with only text gets an HTML copy so the signature shows', () => {
    const { html } = withSignature({ text: 'Hello <you>\n\nBye' }, sig);
    assert.match(html, /<p>Hello &lt;you&gt;<\/p>\n<p>Bye<\/p><div style="margin-top:24px"><p><b>Andrew<\/b><\/p><\/div>/);
  });
  test('no signature, nothing changes', () => {
    assert.deepEqual(withSignature({ text: 'a', html: 'b' }, { html: '', text: '' }), { text: 'a', html: 'b' });
  });
  test('every alert to the owner goes without it; every email to a member has it', () => {
    for (const f of ['signupAlert.js', 'upgradeRequest.js', 'contentReports.js', 'thirdPartyUsage.js', 'joinRequests.js']) {
      assert.match(read(`server/services/${f}`), /toOwner: true/, f);
    }
    const mail = read('server/services/mail.js');
    assert.match(mail, /const signed = toOwner \? \{ text, html \} : withSignature\(\{ text, html \}, await emailSignature\(\)\);/);
    assert.match(mail, /const m = toOwner \? one : withSignature\(one, sig\);/);
  });
});

describe('from the source', () => {
  test('the signature routes are super admins only, behind the admin check; the logo stays in its own folder', () => {
    const admin = read('server/routes/admin.js');
    for (const route of ["get('/email-signature'", "put('/email-signature'", "delete('/email-signature'", "post('/email-signature/logo/upload-token'", "put('/email-signature/logo'", "delete('/email-signature/logo'"]) {
      assert.match(admin, new RegExp(`router\\.${route.replace(/[()/:.-]/g, (c) => `\\${c}`)}, requireAuth, resolveAccount, requireSuperAdmin, requireAdminCheck,`), route);
    }
    assert.match(admin, /if \(!String\(pathname\)\.startsWith\(LOGO_FOLDER\)\) throw/);
    assert.match(read('server/services/emailSignature.js'), /if \(!isSignatureLogoUrl\(blobUrl\)\) throw fail\(400/);
  });
  test('the routes are super admins only, behind the admin check', () => {
    const admin = read('server/routes/admin.js');
    for (const route of ["get('/email-wording'", "put('/email-wording/:key'", "delete('/email-wording/:key'", "post('/email-wording/:key/preview'", "post('/email-wording/:key/test'"]) {
      assert.match(admin, new RegExp(`router\\.${route.replace(/[()/:.]/g, (c) => `\\${c}`)}, requireAuth, resolveAccount, requireSuperAdmin, requireAdminCheck,`), route);
    }
  });
  test('a test goes to the super admin\'s own address only', () => {
    assert.match(read('server/routes/admin.js'), /SELECT email FROM accounts WHERE id = \$1', \[req\.accountId\]\);\s+await sendMail\(\{ to: rows\[0\]\.email/);
  });
  test('saved wording that fails the checks is never sent - the built-in wording goes instead', () => {
    assert.match(read('server/services/emailWording.js'), /if \(rows\.length && !checkWording\(key, rows\[0\]\)\) return tidy\(rows\[0\]\);[\s\S]*?return \{ \.\.\.email\.builtIn \};/);
  });
});
