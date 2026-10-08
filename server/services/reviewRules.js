// ML-470: the reviews that come round - what each is, how often, and whether it is due. Pure (no
// database): tested in server/test/reviews.test.js. The reading and recording is in reviews.js.
//
// kind 'marked'  - the owner reads the document and marks it as reviewed (review_log keeps the trail)
// kind 'checks'  - it has automated checks of its own on Admin -> Security; "last done" is the last run
//                  there, and it is run from its own tab, not marked here
export const REVIEWS = [
  { key: 'data-protection', kind: 'marked', name: 'Data protection assessment', months: 12,
    about: 'The UK GDPR assessment: what is held, why, who receives it, and the gaps. Do it again sooner if what is held, or who receives it, changes.',
    where: 'docs/gdpr-assessment.md, and documents 1 and 2 in your compliance documents' },
  { key: 'childrens-code', kind: 'marked', name: 'Children\'s Code self-assessment and impact assessment', months: 12,
    about: 'The 15 standards of the Children\'s Code, and the data protection impact assessment. Do it again sooner if a new feature touches the young players rule - the run-through ends with a list of what would change the answer.',
    where: 'docs/childrens-code-assessment.md (the run-through, ML-506); documents 4 and 5 in your compliance documents; the rule is in specs/README.md' },
  // ML-507: members share music with their band, so the Online Safety Act applies. Ofcom asks for the
  // assessments to be reviewed at least yearly, and before any significant change to how the service works.
  { key: 'online-safety', kind: 'marked', name: 'Online Safety Act assessments', months: 12,
    about: 'Whether the Act applies, the illegal content risk assessment, the children\'s access assessment and the children\'s risk assessment. Ofcom asks for this at least once a year, and before any change to what one member can show another or to how members can contact each other. Confirm it with Ofcom\'s own checker and toolkit.',
    where: 'docs/online-safety-assessment.md (ML-507), with what Ofcom\'s tools produce' },
  { key: 'breach-plan', kind: 'marked', name: 'Data breach plan walk-through', months: 12,
    about: 'Read the plan through as if it had just happened: who you would tell, within 72 hours, and where the details are kept.',
    where: 'Document 3 in your compliance documents' },
  { key: 'site-security', kind: 'checks', name: 'Site security review', months: 1, tab: 'site',
    about: 'The automated checks on this site, monthly. The full review by Claude Code is done after anything that touches sign-in, sharing or uploads.',
    where: 'The "This site" tab; docs/site-security-review.md' },
  { key: 'omr-security', kind: 'checks', name: 'PDF import service review', months: 1, tab: 'omr',
    about: 'The automated checks on the third-party service behind PDF import.',
    where: 'The "PDF import service" tab; docs/omr-security-review.md' }
];
export const MARKED_KEYS = REVIEWS.filter((r) => r.kind === 'marked').map((r) => r.key);

const day = (d) => (d instanceof Date ? d.toISOString().slice(0, 10) : String(d).slice(0, 10));
// The same day of the month, n months on (the 31st of a short month lands on its last day)
export function addMonths(date, n) {
  const [y, m, d] = day(date).split('-').map(Number);
  const first = new Date(Date.UTC(y, m - 1 + n, 1));
  const last = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate();
  return new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth(), Math.min(d, last))).toISOString().slice(0, 10);
}

// Where a review stands: never done, up to date, due soon (the last 30 days of a year, the last 5 of a
// month), or due (the day has come or gone). daysLeft is negative once it is overdue.
export function reviewState(review, lastOn, today = new Date()) {
  if (!lastOn) return { status: 'never', dueOn: null, daysLeft: null };
  const dueOn = addMonths(lastOn, review.months);
  const daysLeft = Math.round((Date.parse(dueOn) - Date.parse(day(today))) / 86400000);
  const soon = review.months >= 12 ? 30 : 5;
  return { status: daysLeft <= 0 ? 'due' : daysLeft <= soon ? 'soon' : 'ok', dueOn, daysLeft };
}
export const needsDoing = (state) => state.status === 'due' || state.status === 'never';

// "Last updated: 6 October 2026" in the privacy policy, as a day - or null if the page doesn't say
const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
export function policyDate(html) {
  const m = /Last updated:\s*(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})/.exec(String(html || ''));
  const month = m ? MONTHS.indexOf(m[2].toLowerCase()) : -1;
  if (month < 0) return null;
  return new Date(Date.UTC(Number(m[3]), month, Number(m[1]))).toISOString().slice(0, 10);
}
// A day as it is said: 2026-10-06 -> 6 October 2026
export const sayDay = (iso) => { const [y, m, d] = String(iso).split('-').map(Number); return `${d} ${MONTHS[m - 1][0].toUpperCase()}${MONTHS[m - 1].slice(1)} ${y}`; };
// The policy must not have changed since the assessment was last looked at
export function policyCheck(policyOn, lastReviewedOn) {
  if (!policyOn) return { ok: false, text: 'The privacy policy has no "Last updated" date that could be read.' };
  if (!lastReviewedOn) return { ok: false, text: `The privacy policy is dated ${sayDay(policyOn)}; this has not been reviewed yet.` };
  return policyOn > lastReviewedOn
    ? { ok: false, text: `The privacy policy was changed on ${sayDay(policyOn)}, after this was last reviewed (${sayDay(lastReviewedOn)}). Check the assessment still matches it.` }
    : { ok: true, text: `The privacy policy is dated ${sayDay(policyOn)} - not changed since the last review.` };
}
