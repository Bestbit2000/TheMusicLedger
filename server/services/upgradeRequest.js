// ML-396: "Upgrade now" on a feature's Learn more pop-up (SmartLearn first). There's no payment screen
// yet, so it emails the owner that this account asked for the feature; the owner switches it on in
// Admin. Goes to UPGRADE_REQUEST_EMAIL, or SIGNUP_ALERT_EMAIL (ML-392 - already set on production).
// Sent through mail.js, so on dev (MAIL_PROVIDER=log) it lands in email_outbox.

// The database pool and mail.js (which opens it) are loaded inside requestUpgrade, so the email and
// the recipient rule can be tested with no database.

// What can be asked for from the app - a request names one of these, never free text.
export const UPGRADE_FEATURES = { theory_smart_learn: 'SmartLearn' };

// The email itself - pure, so it can be tested.
export function upgradeRequestEmail({ firstName, surname, email, accountLevel, featureName, at = new Date() }) {
  const name = `${firstName || ''} ${surname || ''}`.trim() || '(no name given)';
  const when = at.toLocaleString('en-GB', { timeZone: 'Europe/London', dateStyle: 'full', timeStyle: 'short' });
  const text = [
    `${name} tapped "Upgrade now" for ${featureName} in The Music Ledger.`,
    '',
    `Name: ${name}`,
    `Email: ${email}`,
    `Account type: ${accountLevel || 'unknown'}`,
    `Asked for: ${featureName}`,
    `When: ${when}`,
    '',
    'To switch it on for them: Admin -> Feature access (for their account type), or change their account type in Admin -> Accounts.',
  ].join('\n');
  return { subject: `Upgrade request: ${name} - ${featureName}`, text };
}

export function upgradeRequestRecipient() {
  const to = process.env.UPGRADE_REQUEST_EMAIL || process.env.SIGNUP_ALERT_EMAIL;
  // On dev nothing leaves the building (email_outbox), so the flow still works with no address set.
  const real = (process.env.MAIL_PROVIDER || 'log').toLowerCase() !== 'log';
  return to || (real ? null : 'owner@themusicledger.local');
}

const withStatus = (status, message) => Object.assign(new Error(message), { status });

export async function requestUpgrade(accountId, featureKey) {
  if (!Object.hasOwn(UPGRADE_FEATURES, featureKey)) throw withStatus(400, 'Unknown feature.');
  const to = upgradeRequestRecipient();
  if (!to) throw withStatus(503, "Upgrade requests aren't set up yet.");
  const { default: pool } = await import('../config/db.js');
  const { sendMail } = await import('./mail.js');
  const { rows } = await pool.query('SELECT first_name, surname, email, account_level FROM accounts WHERE id = $1', [accountId]);
  const a = rows[0];
  if (!a) throw withStatus(404, 'Account not found.');
  const { subject, text } = upgradeRequestEmail({
    firstName: a.first_name, surname: a.surname, email: a.email, accountLevel: a.account_level,
    featureName: UPGRADE_FEATURES[featureKey],
  });
  await sendMail({ to, subject, text });
  return { sent: true };
}
