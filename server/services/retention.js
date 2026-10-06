// ML-464: retention - accounts nobody uses are warned by email and then deleted, and records that have
// done their job are cleared. The rule (three lengths of time and a switch) is in app_config
// 'retention_rule' and set on Admin -> Retention; the sums are retentionRules.js. Run once a day by the
// daily job (routes/api.js) and by "Run now" on the admin page. See docs/retention.md.
//
// What keeps it safe:
// - It is OFF until the owner switches it on, in each environment.
// - No warning step is taken unless its email was sent, and nobody is deleted who was not warned twice. On the live site that means emails must really be
//   leaving (MAIL_PROVIDER is not "log"); a refused email leaves the account exactly where it was.
// - Super admin accounts are never touched.
// - Using the app again puts an account back to the start (touchLastSeen in accounts.js).
// - A deletion is the same one "Delete my account" does (accountDeletion.js): the row is anonymised
//   and the practice history stays as statistics.
import pool from '../config/db.js';
import { sendMail, mailIsReal } from './mail.js';
import { deleteMyAccount } from './accountDeletion.js';
import { DEFAULT_RULE, tidyRule, nextStep, dueDates, removalDate, ruleInWords, retentionEmail } from './retentionRules.js';

// The day last-seen recording began (migration 103, released in 0.45.0). Nobody is counted as unused
// for any time before it.
export const COUNTS_FROM = '2026-10-06T00:00:00Z';
const MAX_PER_RUN = 50;
const INVITES_KEPT_DAYS = 30;        // a used or expired invite, after it stopped being any use
const FEEDBACK_KEPT_MONTHS = 12;     // feedback, after it was marked resolved

export async function getRule() {
  try {
    const { rows } = await pool.query("SELECT value FROM app_config WHERE key = 'retention_rule'");
    return rows.length ? tidyRule(JSON.parse(rows[0].value)) : { ...DEFAULT_RULE };
  } catch (error) {
    console.error('Retention: the saved rule could not be read, so it is treated as off:', error.message);
    return { ...DEFAULT_RULE };
  }
}
export async function saveRule(input) {
  const rule = tidyRule(input);
  await pool.query(
    `INSERT INTO app_config (key, value) VALUES ('retention_rule', $1)
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`, [JSON.stringify(rule)]);
  return rule;
}

async function candidates() {
  const { rows } = await pool.query(
    `SELECT id, first_name, surname, email, account_level, created_at, to_char(last_seen_on, 'YYYY-MM-DD') AS last_seen_on,
            retention_stage, retention_stage_at
       FROM accounts WHERE deleted_at IS NULL AND account_level <> 'super_admin' ORDER BY id`);
  return rows.map((r) => ({
    id: Number(r.id), firstName: r.first_name, surname: r.surname, email: r.email, accountLevel: r.account_level,
    createdAt: r.created_at, lastSeenOn: r.last_seen_on, stage: r.retention_stage, stageAt: r.retention_stage_at
  }));
}

// Why the job can't run here, or null if it can.
export function blockedBecause(rule) {
  if (!rule.enabled) return 'Retention is switched off.';
  if (process.env.VERCEL_ENV === 'production' && !mailIsReal()) return 'Emails are not being sent from this site yet, so nobody could be warned. Nothing was done.';
  return null;
}

// What the admin page shows: the rule, whether it can run, and every account with what happens to it next.
export async function retentionStatus(now = new Date()) {
  const rule = await getRule();
  const accounts = (await candidates()).map((a) => {
    const next = nextStep(a, rule, COUNTS_FROM);
    return { id: a.id, name: [a.firstName, a.surname].filter(Boolean).join(' '), email: a.email, lastSeenOn: a.lastSeenOn, stage: a.stage, stageAt: a.stageAt,
      nextStep: next.step, nextOn: next.when, due: next.when <= now, removeOn: dueDates(a, rule, COUNTS_FROM).remove };
  }).sort((a, b) => new Date(a.nextOn) - new Date(b.nextOn));
  return { rule, inWords: ruleInWords(rule), blocked: blockedBecause(rule), mailIsReal: mailIsReal(), countsFrom: COUNTS_FROM, accounts,
    alsoCleared: { invitesAfterDays: INVITES_KEPT_DAYS, feedbackAfterMonths: FEEDBACK_KEPT_MONTHS } };
}

// One run: every account whose next step is due takes that one step (never two in a run), then the
// old records are cleared. appUrl goes in the emails.
// (rule and only are for the test: a rule of its own, and nobody but its own throwaway accounts.)
export async function runRetention({ now = new Date(), appUrl = process.env.APP_URL || '', rule: given = null, only = null } = {}) {
  const rule = given ? tidyRule(given) : await getRule();
  const out = { ran: false, why: blockedBecause(rule), firstEmails: 0, secondEmails: 0, deleted: 0, invitesCleared: 0, feedbackCleared: 0, problems: [] };
  if (out.why) return out;
  out.ran = true;
  out.why = null;

  const due = (await candidates()).filter((a) => !only || only.includes(a.id)).map((a) => ({ a, next: nextStep(a, rule, COUNTS_FROM) })).filter((x) => x.next.when <= now).slice(0, MAX_PER_RUN);
  for (const { a, next } of due) {
    try {
      const mail = retentionEmail(next.step, { firstName: a.firstName, rule, removeOn: removalDate(a, rule, COUNTS_FROM, next.step, now), appUrl });
      if (next.step === 3) {
        // The two warnings were the notice (neither step happened unless its email was sent). The
        // account goes first, and only then is the member told it has gone - so the email is never untrue.
        await deleteMyAccount(a.id);
        out.deleted += 1;
        await sendMail({ to: a.email, ...mail }).catch((error) => out.problems.push(`Account ${a.id} was deleted, but the email saying so could not be sent: ${error.message}`));
      } else {
        await sendMail({ to: a.email, ...mail }); // throws if it can't be sent - and then the account stays where it was
        // Only if the account still stands where it stood: someone using the app meanwhile wins
        await pool.query('UPDATE accounts SET retention_stage = $2, retention_stage_at = $3 WHERE id = $1 AND retention_stage = $4 AND deleted_at IS NULL', [a.id, next.step, now, a.stage]);
        if (next.step === 1) out.firstEmails += 1; else out.secondEmails += 1;
      }
    } catch (error) {
      out.problems.push(`Account ${a.id}: ${error.message}`);
      console.error(`Retention: account ${a.id} left as it was:`, error.message);
    }
  }

  if (only) return out; // the test leaves real invites and feedback alone
  try {
    out.invitesCleared = (await pool.query(
      `DELETE FROM auth_email_links WHERE purpose = 'invite'
          AND COALESCE(used_at, expires_at) < now() - make_interval(days => $1)`, [INVITES_KEPT_DAYS])).rowCount;
    out.feedbackCleared = (await pool.query(
      `DELETE FROM feedback WHERE status = 'resolved' AND updated_at < now() - make_interval(months => $1)`, [FEEDBACK_KEPT_MONTHS])).rowCount;
  } catch (error) {
    out.problems.push(`Old records: ${error.message}`);
  }
  return out;
}
