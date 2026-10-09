// ML-464: the retention rule - an account nobody has used for a set time is warned twice by email and
// then deleted. These are the rules on their own, with no database, so they can be tested
// (server/test/retention.test.js). The reading, emailing and deleting is retention.js.
//
// The rule is three lengths of time in one unit: first email, second email, deletion. The owner's rule
// (6 Oct 2026) is 22, 23 and 24 months. The unit and the numbers can be changed on Admin -> Retention
// so the whole thing can be watched working on sandbox in hours instead of years.

export const UNITS = ['hours', 'days', 'months', 'years'];
export const DEFAULT_RULE = { enabled: false, unit: 'months', first: 22, second: 23, remove: 24 };
const withStatus = (status, message) => Object.assign(new Error(message), { status });

// A rule that is safe to store, or an error that says what is wrong with it.
export function tidyRule(input) {
  const r = input || {};
  const unit = UNITS.includes(r.unit) ? r.unit : null;
  if (!unit) throw withStatus(400, 'Choose hours, days, months or years.');
  const n = (v) => Math.round(Number(v));
  const first = n(r.first); const second = n(r.second); const remove = n(r.remove);
  if (![first, second, remove].every((v) => Number.isFinite(v) && v >= 1 && v <= 1000)) throw withStatus(400, 'Each length of time must be a whole number from 1 to 1,000.');
  if (!(first < second && second < remove)) throw withStatus(400, 'The first email must come before the second, and the second before the account is deleted.');
  return { enabled: r.enabled === true, unit, first, second, remove };
}

// A moment, moved on by n of a unit. Months and years go by the calendar (31 January + 1 month is the
// end of February), hours and days by the clock.
export function addPeriod(date, n, unit) {
  const d = new Date(date);
  if (unit === 'hours') return new Date(d.getTime() + n * 3600000);
  if (unit === 'days') return new Date(d.getTime() + n * 86400000);
  const months = unit === 'years' ? n * 12 : n;
  const day = d.getUTCDate();
  const out = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + months, 1, d.getUTCHours(), d.getUTCMinutes(), d.getUTCSeconds()));
  const last = new Date(Date.UTC(out.getUTCFullYear(), out.getUTCMonth() + 1, 0)).getUTCDate();
  out.setUTCDate(Math.min(day, last));
  return out;
}

// When the account was last used, as far as the rule is concerned: the start of the day it was last
// seen, or the day it was made if it has never been seen - and never earlier than `countsFrom`, the
// day last-seen recording began (nobody is counted as unused for time when use wasn't being recorded).
export function unusedSince({ lastSeenOn, createdAt }, countsFrom) {
  const seen = lastSeenOn ? new Date(`${String(lastSeenOn).slice(0, 10)}T00:00:00Z`) : new Date(createdAt);
  const floor = new Date(countsFrom);
  return seen > floor ? seen : floor;
}

// The three moments for one account: first email, second email, deletion.
export function dueDates(account, rule, countsFrom) {
  const since = unusedSince(account, countsFrom);
  return { since, first: addPeriod(since, rule.first, rule.unit), second: addPeriod(since, rule.second, rule.unit), remove: addPeriod(since, rule.remove, rule.unit) };
}

// What happens to an account next, and when. stage: how far it has got (0 nothing yet, 1 first email
// sent, 2 second email sent); stageAt: when that was. The answer is { step: 1 | 2 | 3, when } - step 3
// is the deletion. A step is never taken sooner after the one before than the rule's own gap, so a
// member always gets the full warning they were promised - even if the rule was switched on, or its
// times shortened, when the account was already long unused.
export function nextStep(account, rule, countsFrom) {
  const d = dueDates(account, rule, countsFrom);
  const stage = Number(account.stage) || 0;
  if (stage <= 0) return { step: 1, when: d.first };
  const sent = account.stageAt ? new Date(account.stageAt) : d.since;
  const later = (a, b) => (a > b ? a : b);
  if (stage === 1) return { step: 2, when: later(d.second, new Date(sent.getTime() + (d.second - d.first))) };
  return { step: 3, when: later(d.remove, new Date(sent.getTime() + (d.remove - d.second))) };
}
// The day the account would go, if this warning (step 1 or 2) is sent now - what the email promises.
export function removalDate(account, rule, countsFrom, step, now = new Date()) {
  const d = dueDates(account, rule, countsFrom);
  const afterThis = new Date(new Date(now).getTime() + (d.remove - (step === 1 ? d.first : d.second)));
  return d.remove > afterThis ? d.remove : afterThis;
}
export const isDue = (account, rule, countsFrom, now = new Date()) => nextStep(account, rule, countsFrom).when <= now;

const span = (n, unit) => `${n} ${n === 1 ? unit.replace(/s$/, '') : unit}`;
export const ruleInWords = (rule) => `An account not used for ${span(rule.first, rule.unit)} gets an email, another at ${span(rule.second, rule.unit)}, and is deleted at ${span(rule.remove, rule.unit)}.`;

// The three emails. step 1 and 2 are warnings; step 3 says it has been done.
export function retentionEmail(step, { firstName, rule, removeOn, appUrl }) {
  const hello = `Hello${firstName ? ` ${firstName}` : ''},`;
  const day = new Date(removeOn).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
  const sign = 'Notably Better';
  if (step === 3) {
    return {
      subject: 'Your Notably Better account has been deleted',
      text: [hello, '', `Your Notably Better account had not been used for ${span(rule.remove, rule.unit)}, so, as we said we would, we have deleted it. Your name, email address, pieces and settings are gone.`,
        '', 'You are welcome back at any time - signing up again starts a fresh account.', '', sign].join('\n')
    };
  }
  return {
    subject: step === 1 ? 'Your Notably Better account has not been used for a while' : 'Last reminder: your Notably Better account will be deleted soon',
    text: [hello, '', `You have not used Notably Better for ${span(step === 1 ? rule.first : rule.second, rule.unit)}. We don't keep information about people who have stopped using the app, so your account will be deleted on ${day}.`,
      '', `To keep it, just sign in before then${appUrl ? `: ${appUrl}` : ''}. That is all you need to do.`,
      '', 'If you no longer want it, you need do nothing.' + (step === 1 ? ' We will remind you once more before it goes.' : ' This is the last reminder.'), '', sign].join('\n')
  };
}
