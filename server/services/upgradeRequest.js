// ML-396: "Upgrade now" on a feature's Learn more pop-up (SmartLearn first). There's no payment screen
// yet, so it emails the owner that this account asked for the feature; the owner switches it on in
// Admin. Goes to UPGRADE_REQUEST_EMAIL, or SIGNUP_ALERT_EMAIL (ML-392 - already set on production).
// Sent through mail.js, so on dev (MAIL_PROVIDER=log) it lands in email_outbox.

// The database pool and mail.js (which opens it) are loaded inside requestUpgrade, so the email and
// the recipient rule can be tested with no database.
import { buildEmail } from './emailBuild.js';
import { EMAILS } from './emailCatalogue.js';

// What can be asked for from the app - a request names one of these, never free text.
export const UPGRADE_FEATURES = { theory_smart_learn: 'SmartLearn' };

// The email itself - pure, so it can be tested. ML-618: the words are on Admin -> Email wording (alert_upgrade);
// wording - the built-in wording if none.
export function upgradeRequestEmail({ firstName, surname, email, accountLevel, featureName, at = new Date() }, wording = EMAILS.alert_upgrade.builtIn) {
  const name = `${firstName || ''} ${surname || ''}`.trim() || '(no name given)';
  const when = at.toLocaleString('en-GB', { timeZone: 'Europe/London', dateStyle: 'full', timeStyle: 'short' });
  return buildEmail('alert_upgrade', wording, { name, email, 'account type': accountLevel || 'unknown', feature: featureName, when });
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
  const { wordingFor } = await import('./emailWording.js');
  const { rows } = await pool.query('SELECT first_name, surname, email, account_level FROM accounts WHERE id = $1', [accountId]);
  const a = rows[0];
  if (!a) throw withStatus(404, 'Account not found.');
  const { subject, text, html } = upgradeRequestEmail({
    firstName: a.first_name, surname: a.surname, email: a.email, accountLevel: a.account_level,
    featureName: UPGRADE_FEATURES[featureKey],
  }, await wordingFor('alert_upgrade'));
  await sendMail({ to, subject, text, html, toOwner: true }); // ML-617: an alert to the owner - no signature
  return { sent: true };
}
