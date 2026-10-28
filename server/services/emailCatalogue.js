// ML-617 / ML-618: every email the app sends, as Admin -> Email wording lists them (docs/email-wording.md). Pure data.
// Each email's built-in wording is the words it was sent with before it came onto the page, so nothing a member
// reads changes until the owner changes it there. For each email:
//   group     - members (to a member, ends with the signature), messages (the words around a message the owner
//               writes each time - {message}), alerts (to the owner, no signature: toOwner)
//   fillIns   - { name: what it is }, written {name} in the words; required - those that must be in the words
//   blocks    - fill-ins whose value is paragraphs of plain text (a message) - put in a paragraph of its own
//   builtIn   - { subject, body (HTML paragraphs), button (null for an email with no button) }
//   footer    - the fixed small print after the button (values) => words, or null - never on the page to change
//   sample    - the fill-ins a preview or a test uses
// Fill-ins that are left empty when the email is sent (an optional line) leave no empty paragraph behind.

const p = (...lines) => lines.map((l) => `<p>${l}</p>`).join('');
const FIRST_NAME = 'Their first name, or "there" when we don\'t have one.';
const WAYS_IN = 'How they can get in - "sign in with Google if this email address is a Google account, or choose a password" - from the ways switched on here.';
const MESSAGE = 'What you write in the pop-up each time. It goes in a paragraph of its own.';
export const INVITATION_DAYS = 7; // how long an invitation's link works (passwordAuth.js)
// ML-648: the band leader email's two paragraphs (the fill-ins' values - bands.js puts in the ones switched on)
export const BAND_SUMMARY_WORDS = "Band summary: if players in the band choose to share their piece Levels with the band leader, you can see the average Level and the range for each band piece and for each of its bars - so you can see which bars need the most work. It's anonymous: it never shows who, and nothing shows until at least 3 players have shared on that piece. It's on a band piece's ⋮ menu. Sharing is each player's own choice, and they can switch it off at any time - players switch it on, if they want to, on the band's Members page.";
export const BAND_NOTICES_WORDS = "Band notices: you can send everyone in the band a short notice, from the band's Members page.";

export const GROUPS = [
  { key: 'members', name: 'Emails to members', about: 'Sent to a member when something happens. Each ends with the signature.' },
  { key: 'messages', name: 'Messages you write', about: 'The words around a message you write each time - {message} is what you write in the pop-up. Each ends with the signature.' },
  { key: 'alerts', name: 'Alerts to you', about: 'Sent to you, never to a member. No signature.' }
];

export const EMAILS = {
  // ---- Emails to members ----
  invitation: {
    group: 'members', name: 'Invitation',
    about: 'Someone is invited to Notably Better: Let in on the Waiting list, Invite by email on Accounts, and Invite someone from the main menu.',
    fillIns: { 'first name': FIRST_NAME, 'ways in': WAYS_IN }, required: ['ways in'],
    // The owner's choice, 26 Oct 2026 (option 1)
    builtIn: {
      subject: "You're invited to Notably Better",
      body: p('Hi {first name},', "Welcome to Notably Better! You've been invited to join, and we're really glad you're here.",
        "It's a practice app made for bands. Your band's music is in one place, so you can play it and practise it at your own pace.",
        'Getting in takes a minute: {ways in}.', 'See you there!'),
      button: 'Get started'
    },
    // Fixed: it is what tells someone who wasn't expecting it that they can ignore it
    footer: () => `This link works for ${INVITATION_DAYS} days. If you weren't expecting it, you can ignore this email.`,
    sample: { 'first name': 'Bert' }
  },
  invitation_existing: {
    group: 'members', name: 'Invitation - already signs in with Google',
    about: 'An invitation to someone who already has an account with Google: it lets them add a password.',
    fillIns: { 'first name': FIRST_NAME }, required: [],
    builtIn: {
      subject: "You're invited to Notably Better",
      body: p('Hi {first name},', "You've been invited to log in to Notably Better with your email and a password, as well as Google. Choose a password to get started."),
      button: 'Get started'
    },
    footer: () => `This link works for ${INVITATION_DAYS} days. If you weren't expecting it, you can ignore this email.`,
    sample: { 'first name': 'Bert' }
  },
  band_invite_new: {
    group: 'members', name: 'Band invitation - no account yet',
    about: 'A band\'s organiser invites someone who isn\'t a member yet. It carries the band\'s logo when it has one.',
    fillIns: { 'invited by': 'The name of the person who invited them.', band: 'The band\'s name.', email: 'The address it was sent to.', 'ways in': WAYS_IN },
    required: ['ways in'],
    builtIn: {
      subject: '{invited by} has invited you to join {band}',
      body: p('Hi,', '{invited by} has invited you to join {band} on Notably Better - the practice app the band uses for its music.',
        "You don't have an account yet. To get started, {ways in} - it takes a minute - and the invitation will be waiting for you on My bands."),
      button: 'Get started'
    },
    footer: (v) => `The link works for ${v.days || INVITATION_DAYS} days; ask ${v['invited by'] || 'whoever invited you'} to send it again if it has run out. If you weren't expecting this, you can ignore it and nothing will happen.`,
    sample: { 'invited by': 'Sue Brown', band: 'Cobham Band', email: 'bert@example.com' }
  },
  band_invite_member: {
    group: 'members', name: 'Band invitation - already a member',
    about: 'A band\'s organiser invites someone who already uses Notably Better. It carries the band\'s logo when it has one.',
    fillIns: { 'invited by': 'The name of the person who invited them.', band: 'The band\'s name.', email: 'The address it was sent to.' },
    required: [],
    builtIn: {
      subject: '{invited by} has invited you to join {band}',
      body: p('Hi,', '{invited by} has invited you to join {band} on Notably Better - the practice app the band uses for its music.',
        'To see the invitation, open the app and sign in with this email address ({email}). It will be waiting on My account, under My bands.'),
      button: 'Open Notably Better'
    },
    footer: (v) => `The invitation waits for ${v.days || 30} days. If you weren't expecting it, you can ignore this email and nothing will happen.`,
    sample: { 'invited by': 'Sue Brown', band: 'Cobham Band', email: 'bert@example.com' }
  },
  // ML-648: the owner's words, 28 Oct 2026. Each of the two paragraphs is there only when that feature is on for the
  // band leader's account type - so nobody is promised what they can't see. Sharing stays each player's own choice:
  // the email says where it is switched on, as information, never asking the leader to get players to share.
  band_leader_made: {
    group: 'members', name: 'Made a band leader',
    about: 'An organiser makes a member a band leader of a band (the band\'s Members page). Not sent when an organiser makes themselves one.',
    fillIns: {
      'first name': FIRST_NAME, 'made by': 'The name of the organiser who made them band leader.', band: 'The band\'s name.',
      'band summary': 'What the Band summary is - only when it is switched on for them, otherwise left out.',
      'band notices': 'That they can send the band a notice - only when band notices are switched on for them, otherwise left out.'
    },
    required: [],
    builtIn: {
      subject: "You're now a band leader of {band}",
      body: p('Hi {first name},', '{made by} has just made you a band leader of {band} on Notably Better.', '{band summary}', '{band notices}'),
      button: 'Open Notably Better'
    },
    footer: () => null,
    sample: {
      'first name': 'Bert', 'made by': 'Sue Brown', band: 'Cobham Band',
      'band summary': BAND_SUMMARY_WORDS, 'band notices': BAND_NOTICES_WORDS
    }
  },
  password_reset: {
    group: 'members', name: 'Forgot your password',
    about: 'A member asks for a link to choose a new password ("Forgot your password?" on the sign-in screen).',
    fillIns: { 'first name': FIRST_NAME, 'what they asked': '"reset the password", or "set a password" for an account that has none yet.' },
    required: [],
    builtIn: {
      subject: 'Your Notably Better password',
      body: p('Hi {first name},', 'Someone (hopefully you) asked to {what they asked} for your Notably Better account.'),
      button: 'Choose a new password'
    },
    footer: (v) => `This link works once, for ${v.minutes || 60} minutes. If it wasn't you, ignore this email - your password hasn't changed.`,
    sample: { 'first name': 'Bert', 'what they asked': 'reset the password' }
  },
  password_link_admin: {
    group: 'members', name: 'Password link from you',
    about: 'You send a member a link to choose a new password, from Admin → Accounts.',
    fillIns: { 'first name': FIRST_NAME }, required: [],
    builtIn: {
      subject: 'Your Notably Better password',
      body: p('Hi {first name},', 'The Notably Better team has sent you a link to choose a new password for your account.'),
      button: 'Choose a new password'
    },
    footer: (v) => `This link works once, for ${v.minutes || 60} minutes. If you weren't expecting it, you can ignore this email - your password hasn't changed.`,
    sample: { 'first name': 'Bert' }
  },
  email_change_confirm: {
    group: 'members', name: 'Confirm a new email address',
    about: 'A member asks to sign in with a different address - sent to the new address.',
    fillIns: { 'first name': FIRST_NAME, 'old address': 'The address they sign in with now, mostly hidden (ber***@example.com).' }, required: [],
    builtIn: {
      subject: 'Confirm your new email address for Notably Better',
      body: p('Hi {first name},', 'You asked to use this address to sign in to Notably Better, in place of {old address}.',
        'Nothing changes until you confirm it. When you do, you are signed out everywhere and sign in again with this address.'),
      button: 'Confirm my new email address'
    },
    footer: (v) => `The link works once, for ${v.minutes || 60} minutes. If you didn't ask for this, ignore this email and nothing will change.`,
    sample: { 'first name': 'Bert', 'old address': 'ber***@example.com' }
  },
  email_change_confirm_admin: {
    group: 'members', name: 'Confirm a new email address - changed by you',
    about: 'You start a change of address for a member who has lost the old one - sent to the new address.',
    fillIns: { 'first name': FIRST_NAME, 'old address': 'The address they sign in with now, mostly hidden (ber***@example.com).' }, required: [],
    builtIn: {
      subject: 'Confirm your new email address for Notably Better',
      body: p('Hi {first name},', 'The Notably Better team has been asked to change the email address on your account ({old address}) to this one.',
        'Nothing changes until you confirm it. When you do, you are signed out everywhere and sign in again with this address.'),
      button: 'Confirm my new email address'
    },
    footer: (v) => `The link works once, for ${v.minutes || 60} minutes. If you didn't ask for this, ignore this email and nothing will change.`,
    sample: { 'first name': 'Bert', 'old address': 'ber***@example.com' }
  },
  email_changed: {
    group: 'members', name: 'Email address changed',
    about: 'Sent to the old address once a change of address is confirmed.',
    fillIns: { 'first name': FIRST_NAME, 'new address': 'The new address, mostly hidden (ber***@example.com).' }, required: [],
    builtIn: {
      subject: 'Your Notably Better email address has changed',
      body: p('Hi {first name},', 'The email address for your Notably Better account has been changed to {new address}.',
        'You have been signed out everywhere. From now on, sign in with the new address.'),
      button: 'Open Notably Better'
    },
    footer: () => 'If this wasn\'t you, reply to this email straight away so we can put it right.',
    sample: { 'first name': 'Bert', 'new address': 'ber***@example.org' }
  },
  account_deleted_for_you: {
    group: 'members', name: 'Account deleted - as they asked',
    about: 'You delete a member\'s account for them, from Admin → Accounts, when they ask and can\'t do it themselves.',
    fillIns: { 'first name': FIRST_NAME }, required: [],
    builtIn: {
      subject: 'Your Notably Better account has been deleted',
      body: p('Hello {first name},',
        'Your Notably Better account has been deleted, as we were asked. Your name, email address, pieces and settings are gone, and you have been signed out everywhere.',
        'If you did not ask for this, please tell us: hello@notablybetter.com.',
        'You are welcome back at any time - signing up again starts a fresh account.', 'Notably Better'),
      button: null
    },
    footer: () => null,
    sample: { 'first name': 'Bert' }
  },
  retention_first: {
    group: 'members', name: 'Not used for a while',
    about: 'The first email to an account nobody has used for the time set on Admin → Retention.',
    fillIns: { 'first name': FIRST_NAME, 'time unused': 'How long it hasn\'t been used, from the rule ("22 months").', 'deletion date': 'The day it will be deleted ("24 December 2027").' },
    required: ['deletion date'],
    builtIn: {
      subject: 'Your Notably Better account has not been used for a while',
      body: p('Hello {first name},',
        'You have not used Notably Better for {time unused}. We don\'t keep information about people who have stopped using the app, so your account will be deleted on {deletion date}.',
        'To keep it, just sign in before then. That is all you need to do.',
        'If you no longer want it, you need do nothing. We will remind you once more before it goes.', 'Notably Better'),
      button: 'Open Notably Better'
    },
    footer: () => null,
    sample: { 'first name': 'Bert', 'time unused': '22 months', 'deletion date': '24 December 2027' }
  },
  retention_last: {
    group: 'members', name: 'Last reminder before deletion',
    about: 'The second email to an account nobody has used - the last before it is deleted.',
    fillIns: { 'first name': FIRST_NAME, 'time unused': 'How long it hasn\'t been used, from the rule ("23 months").', 'deletion date': 'The day it will be deleted ("24 December 2027").' },
    required: ['deletion date'],
    builtIn: {
      subject: 'Last reminder: your Notably Better account will be deleted soon',
      body: p('Hello {first name},',
        'You have not used Notably Better for {time unused}. We don\'t keep information about people who have stopped using the app, so your account will be deleted on {deletion date}.',
        'To keep it, just sign in before then. That is all you need to do.',
        'If you no longer want it, you need do nothing. This is the last reminder.', 'Notably Better'),
      button: 'Open Notably Better'
    },
    footer: () => null,
    sample: { 'first name': 'Bert', 'time unused': '23 months', 'deletion date': '24 December 2027' }
  },
  retention_deleted: {
    group: 'members', name: 'Deleted after not being used',
    about: 'Sent once an account nobody used has been deleted, as the two emails before it said.',
    fillIns: { 'first name': FIRST_NAME, 'time unused': 'How long it hadn\'t been used, from the rule ("24 months").' }, required: [],
    builtIn: {
      subject: 'Your Notably Better account has been deleted',
      body: p('Hello {first name},',
        'Your Notably Better account had not been used for {time unused}, so, as we said we would, we have deleted it. Your name, email address, pieces and settings are gone.',
        'You are welcome back at any time - signing up again starts a fresh account.', 'Notably Better'),
      button: null
    },
    footer: () => null,
    sample: { 'first name': 'Bert', 'time unused': '24 months' }
  },
  account_reopened: {
    group: 'members', name: 'Account open again',
    about: 'You reopen a closed account, from Admin → Accounts.',
    fillIns: { 'first name': FIRST_NAME }, required: [],
    builtIn: {
      subject: 'Your Notably Better account is open again',
      body: p('Hello {first name},', 'Your Notably Better account is open again, and you can sign in as before. Everything is as you left it.',
        'If you have a question, email hello@notablybetter.com.', 'Notably Better'),
      button: null
    },
    footer: () => null,
    sample: { 'first name': 'Bert' }
  },

  // ---- Messages you write ----
  account_warning: {
    group: 'messages', name: 'A warning about their account',
    about: 'You warn a member from Admin → Accounts. They also see it in the app.',
    fillIns: { 'first name': FIRST_NAME, message: MESSAGE }, required: ['message'], blocks: ['message'],
    builtIn: { subject: 'Notably Better: a warning about your account', body: p('Hello {first name},', '{message}', 'Notably Better'), button: null },
    footer: () => null,
    sample: { 'first name': 'Bert', message: 'This is a warning about your Notably Better account.\n\nWhy: ...' }
  },
  account_closed: {
    group: 'messages', name: 'Account closed',
    about: 'You close an account from Admin → Accounts.',
    fillIns: { 'first name': FIRST_NAME, message: MESSAGE }, required: ['message'], blocks: ['message'],
    builtIn: { subject: 'Your Notably Better account has been closed', body: p('Hello {first name},', '{message}', 'Notably Better'), button: null },
    footer: () => null,
    sample: { 'first name': 'Bert', message: 'We have closed your Notably Better account, so you can no longer sign in.\n\nWhy: ...' }
  },
  something_removed: {
    group: 'messages', name: 'Something removed',
    about: 'You remove a piece, practice list, document, band logo or recording on Admin → Shared music - sent to the people it belonged to. They also see it in the app.',
    fillIns: { 'first name': FIRST_NAME, 'what was removed': '"a piece has been removed", "a recording has been removed"... - for the subject.', message: MESSAGE },
    required: ['message'], blocks: ['message'],
    builtIn: { subject: 'Notably Better: {what was removed}', body: p('Hello {first name},', '{message}'), button: null },
    footer: () => null,
    sample: { 'first name': 'Bert', 'what was removed': 'a recording has been removed', message: 'We have removed the recording "Rehearsal 3" from Notably Better.\n\nWhy: ...' }
  },
  band_renamed: {
    group: 'messages', name: 'Band renamed',
    about: 'You change a band\'s name on Admin → Shared music - sent to its organisers. They also see it in the app.',
    fillIns: { 'first name': FIRST_NAME, message: MESSAGE }, required: ['message'], blocks: ['message'],
    builtIn: { subject: 'Notably Better: a band has been renamed', body: p('Hello {first name},', '{message}'), button: null },
    footer: () => null,
    sample: { 'first name': 'Bert', message: 'We have changed the name of your band "..." in Notably Better.\n\nWhy: ...' }
  },
  notice_urgent: {
    group: 'messages', name: 'Email copy of an urgent notice',
    about: 'An urgent notice from Admin → Notifications with "Send an email copy" - to every member it is for who hasn\'t switched these off.',
    fillIns: { 'notice title': 'The notice\'s title - for the subject.', message: 'The notice\'s own words.' }, required: ['message'], blocks: ['message'],
    builtIn: {
      subject: '{notice title}',
      body: p('{message}', 'You are getting this email because it is an urgent notice from the Notably Better team, and it is in the app too. To stop email copies of urgent notices, open the app and go to Settings, Notifications.'),
      button: 'Open Notably Better'
    },
    footer: () => 'This email comes from an address that does not take replies. To write to us, email hello@notablybetter.com.',
    sample: { 'notice title': 'The app will be down for an hour on Sunday', message: 'We are moving the app to a new home on Sunday morning...' }
  },
  notice_important: {
    group: 'messages', name: 'Email copy of an important notice',
    about: 'An important notice (about how members\' information is used) from Admin → Notifications - to every member it is for.',
    fillIns: { 'notice title': 'The notice\'s title - for the subject.', message: 'The notice\'s own words.', 'privacy policy': '"Read the privacy policy:" and its address, when the notice links to it; otherwise nothing.' },
    required: ['message'], blocks: ['message'],
    builtIn: {
      subject: '{notice title}',
      body: p('{message}', '{privacy policy}', 'You are getting this email because the notice is about how your information is used. We email a copy of notices like this to every member, and it is in the app too.'),
      button: 'Open Notably Better'
    },
    footer: () => 'This email comes from an address that does not take replies. To write to us, email hello@notablybetter.com.',
    sample: { 'notice title': 'A change to how we keep your information', message: 'From 1 December we keep...', 'privacy policy': 'Read the privacy policy: https://notablybetter.com/privacy.html' }
  },

  // ---- Alerts to you ----
  alert_signup: {
    group: 'alerts', name: 'New sign-up', toOwner: true,
    about: 'Someone new signs up - a first Google sign-in, or an invitation taken up. To SIGNUP_ALERT_EMAIL.',
    fillIns: { name: 'Their name.', email: 'Their email address.', when: 'When they signed up.', how: 'Google, or email and password.', device: 'Their kind of device and browser.' },
    required: [],
    builtIn: { subject: 'New sign-up: {name}', body: p('Someone new has signed up to Notably Better.', 'Name: {name}<br>Email: {email}<br>Signed up: {when}<br>How: {how}<br>Device: {device}'), button: null },
    footer: () => null,
    sample: { name: 'Bert Smith', email: 'bert@example.com', when: 'Monday 26 October 2026 at 14:05', how: 'Google', device: 'iPhone · iOS 18 · Safari' }
  },
  alert_upgrade: {
    group: 'alerts', name: 'Upgrade request', toOwner: true,
    about: 'A member taps "Upgrade now" for a feature. To UPGRADE_REQUEST_EMAIL, or SIGNUP_ALERT_EMAIL.',
    fillIns: { name: 'Their name.', email: 'Their email address.', 'account type': 'Their account type.', feature: 'The feature they asked for.', when: 'When they asked.' },
    required: [],
    builtIn: {
      subject: 'Upgrade request: {name} - {feature}',
      body: p('{name} tapped "Upgrade now" for {feature} in Notably Better.', 'Name: {name}<br>Email: {email}<br>Account type: {account type}<br>Asked for: {feature}<br>When: {when}',
        'To switch it on for them: Admin -> Feature access (for their account type), or change their account type in Admin -> Accounts.'),
      button: null
    },
    footer: () => null,
    sample: { name: 'Bert Smith', email: 'bert@example.com', 'account type': 'standard_member', feature: 'SmartLearn', when: 'Monday 26 October 2026 at 14:05' }
  },
  alert_report: {
    group: 'alerts', name: 'Something reported', toOwner: true,
    about: 'A member reports something. To USAGE_ALERT_EMAIL, or SIGNUP_ALERT_EMAIL.',
    fillIns: { what: 'What was reported ("the piece \\"Blaydon Races\\"").', 'what they wrote': '"They wrote:" and their words, when they wrote any; otherwise nothing.' },
    required: [],
    builtIn: { subject: 'Notably Better: something has been reported', body: p('A member has reported {what}.', '{what they wrote}', 'Open Admin, Shared music to look at it.'), button: null },
    footer: () => null,
    sample: { what: 'the piece "Blaydon Races"', 'what they wrote': 'They wrote: this is not our arrangement.' }
  },
  alert_usage: {
    group: 'alerts', name: 'Getting near a limit', toOwner: true,
    about: 'A service the app uses passes 75% or 90% of its plan\'s limit (Admin → Costs and usage). To USAGE_ALERT_EMAIL, or SIGNUP_ALERT_EMAIL.',
    fillIns: { service: 'The service ("Vercel Blob storage").', percent: 'How far through the limit, as a whole number.', used: 'How much is used, of what ("1.6 of 2 GB this month").', 'when it runs out': '"At this rate the limit is reached on ..." when it can be worked out; otherwise nothing.' },
    required: [],
    builtIn: {
      subject: 'Notably Better: {service} at {percent}% of its limit',
      body: p('{service} is at {percent}% of its limit: {used}.', '{when it runs out}', 'See Admin → Third parties for what happens past the limit and what the next plan costs.'),
      button: null
    },
    footer: () => null,
    sample: { service: 'Vercel Blob storage', percent: '76', used: '1.52 of 2 GB this month', 'when it runs out': 'At this rate the limit is reached on 2026-11-20.' }
  },
  alert_join: {
    group: 'alerts', name: 'New request to join', toOwner: true,
    about: 'Someone asks to join on the public page. To info@notablybetter.com (JOIN_ALERT_EMAIL overrides it).',
    fillIns: { name: 'Their name.', band: 'The band they named, or "none given".', plays: 'Their instrument, or "not given".' },
    required: [],
    builtIn: {
      subject: 'Notably Better: {name} has asked to join',
      body: p('{name} has asked to join Notably Better from the website.', 'Band: {band}<br>Plays: {plays}',
        'Open Admin, Waiting list to let them in, pass them to their band\'s organiser, or turn it down.'),
      button: null
    },
    footer: () => null,
    sample: { name: 'Sam Reed', band: 'Cobham Band (Cobham)', plays: 'Cornet' }
  }
};
