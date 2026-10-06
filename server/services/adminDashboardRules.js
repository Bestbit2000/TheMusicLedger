// ML-443: the two rules behind Admin -> Dashboard that are worth testing on their own - no database
// (server/test/adminDashboard.test.js). The reading is in adminDashboard.js.
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;


// Pure: days from today to the first of the launch month ('2027-01'); negative once it has passed.
export function daysToLaunch(launch, today = new Date()) {
  const m = /^(\d{4})-(\d{2})$/.exec(launch || '');
  if (!m) return null;
  const from = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  return Math.round((Date.UTC(Number(m[1]), Number(m[2]) - 1, 1) - from) / 86400000);
}

// Pure: the list of what needs the owner, from the parts that could be read. Each says which page deals with it.
export function needsYou({ feedback, attention, limits, tests, security, reviews }) {
  const list = [];
  if (tests && tests.failed) list.push({ level: 'fail', page: 'release-tests', text: `${plural(tests.failed, 'back-test is', 'back-tests are')} failing` });
  (limits || []).forEach((m) => list.push({ level: m.level, page: 'costs-usage', text: `${m.name} is at ${m.percent}% of the plan's limit` }));
  if (security && security.siteFailing) list.push({ level: 'fail', page: 'security', text: `${plural(security.siteFailing, 'security check on this site is', 'security checks on this site are')} failing` });
  if (security && security.siteRunDue) list.push({ level: 'warn', page: 'security', text: 'The monthly security checks on this site are due' });
  if (security && security.siteChanged) list.push({ level: 'info', page: 'security', text: 'A release has gone out since this site\'s last full security review' });
  if (security && security.upstreamChanged) list.push({ level: 'warn', page: 'security', text: 'The PDF import service has changed since its last full security review' });
  if (security && security.runDue) list.push({ level: 'warn', page: 'security', text: 'The automated security checks are due to be run again' });
  if (reviews) list.push({ level: 'warn', page: 'security', text: `${plural(reviews, 'review is', 'reviews are')} due - data protection, the Children's Code or the breach plan` }); // ML-470
  if (feedback) list.push({ level: 'info', page: 'feedback', text: `${plural(feedback, 'piece', 'pieces')} of feedback not looked at yet` });
  if (attention) list.push({ level: 'info', page: 'third-parties', text: `${plural(attention, 'third-party item needs', 'third-party items need')} attention` });
  return list;
}
