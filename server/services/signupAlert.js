// ML-392: an email to the owner whenever a new account is created - a first Google login, or an invite
// accepted with a password. Who gets it is SIGNUP_ALERT_EMAIL (Vercel, Production only); unset = no
// email. Sent through mail.js, so on dev (MAIL_PROVIDER=log) it lands in email_outbox. A failed alert
// never stops the sign-up: it's logged and the request carries on.

// "iPhone · iOS 17.4 · Safari", "Android phone (Pixel 8) · Android 14 · Chrome" - from the browser's
// User-Agent. iPhones never say their model; Chrome on Android only does through the Sec-CH-UA-Model
// client hint (asked for with Accept-CH in app.js), which arrives as `model`.
export function describeDevice(userAgent = '', model = '') {
  const ua = String(userAgent || '');
  if (!ua) return 'Unknown device';
  const v = (re) => { const m = ua.match(re); return m ? m[1].replace(/_/g, '.') : ''; };
  const named = (os, version) => (version ? `${os} ${version}` : '');
  const hintModel = String(model || '').replace(/^"|"$/g, '').trim();
  let device, system = '';
  if (/iPhone/.test(ua)) { device = 'iPhone'; system = named('iOS', v(/OS (\d+[_\d]*)/)); }
  else if (/iPad/.test(ua)) { device = 'iPad'; system = named('iPadOS', v(/OS (\d+[_\d]*)/)); }
  else if (/Android/.test(ua)) {
    const uaModel = v(/Android [\d.]+; ([^;)]+)\)/).trim();
    const phoneModel = hintModel || (uaModel !== 'K' ? uaModel : ''); // "K": Chrome's hidden model
    device = `Android ${/Mobile/.test(ua) ? 'phone' : 'tablet'}${phoneModel ? ` (${phoneModel})` : ''}`;
    system = named('Android', v(/Android ([\d.]+)/));
  }
  else if (/CrOS/.test(ua)) device = 'Chromebook';
  // iPads ask for desktop sites by default and say "Macintosh" - the server can't tell those apart.
  else if (/Macintosh/.test(ua)) device = 'Mac (or an iPad)';
  else if (/Windows/.test(ua)) device = 'Windows PC';
  else if (/Linux/.test(ua)) device = 'Linux computer';
  else device = 'Unknown device';
  const browser = /EdgA?\//.test(ua) ? 'Edge'
    : /SamsungBrowser/.test(ua) ? 'Samsung Internet'
    : /FxiOS|Firefox\//.test(ua) ? 'Firefox'
    : /CriOS|Chrome\//.test(ua) ? 'Chrome'
    : /Safari\//.test(ua) ? 'Safari'
    : '';
  return [device, system, browser].filter(Boolean).join(' · ');
}

// The email itself - pure, so it can be tested.
export function signupAlertEmail({ firstName, surname, email, method, device, at = new Date() }) {
  const name = `${firstName || ''} ${surname || ''}`.trim() || '(no name given)';
  const when = at.toLocaleString('en-GB', { timeZone: 'Europe/London', dateStyle: 'full', timeStyle: 'short' });
  const text = [
    'Someone new has signed up to Notably Better.',
    '',
    `Name: ${name}`,
    `Email: ${email}`,
    `Signed up: ${when}`,
    `How: ${method}`,
    `Device: ${device}`,
  ].join('\n');
  return { subject: `New sign-up: ${name}`, text };
}

// Sends the alert, or does nothing when SIGNUP_ALERT_EMAIL isn't set. Never throws.
export async function sendSignupAlert({ firstName, surname, email, method, userAgent, model }) {
  const to = process.env.SIGNUP_ALERT_EMAIL;
  if (!to) return false;
  try {
    const { subject, text } = signupAlertEmail({ firstName, surname, email, method, device: describeDevice(userAgent, model) });
    const { sendMail } = await import('./mail.js'); // loaded here: it opens the database pool
    await sendMail({ to, subject, text });
    return true;
  } catch (error) {
    console.error('Sign-up alert not sent:', error.message);
    return false;
  }
}
