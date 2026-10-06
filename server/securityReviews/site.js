// ML-231: deep ("assisted") security review history for this site - one entry per review, newest
// last. Admin -> Security (This site) reads this alongside the automated runs in the database; see
// server/services/siteSecurityReview.js and docs/site-security-review.md.
//
// Written by Claude Code during a review. Append a new run - never edit an old one: this file IS the
// audit trail (and git history is its history). A module rather than a .json file so Vercel's bundler
// always traces it into the function.
//
// Per result: checkKey (must match a CHECKS key in siteSecurityReview.js), status
// (pass / warn / fail / info / not_run / error), summary, details (plain strings).
// upstreamCommitSha holds the app version that was reviewed (the field name is shared with the OMR review).
// acceptedAdvisories: dependency advisories assessed as not reachable - the automated OSV check
// reports these as accepted instead of new.

export default {
  targetKey: 'site',
  runs: [
    {
      id: '2026-10-06',
      reviewedAt: '2026-10-06T15:30:00Z',
      reviewer: 'Claude Code (ML-231 session)',
      upstreamCommitSha: '0.45.0',
      tools: [
        'A second reader (a Claude sub-agent, read-only) went through all 241 routes - 149 app, 80 admin, 12 sign-in - and followed every one that takes an id into its service to find the ownership check',
        'Its main findings were then confirmed by hand in the code before being recorded here',
        'Two scans of the front end for member-typed text put into HTML without escaping, every hit read by hand',
        'A read of every place the server fetches a web address',
        'npm audit --omit=dev in the root and in server/ (npm 11)',
        'A pattern search of every tracked file for keys and passwords (not a full Gitleaks run over the history)',
        'The live site\'s response headers (curl)'
      ],
      verdict: {
        status: 'conditional',
        summary: 'Safe for the owner\'s own use today. Not yet ready for other people: the review found five ways one member could affect another. Three are fixed in this change; two are how the data is laid out (teachers, and private organisation names, are shared between all members) and need their own piece of work before anyone else is invited.',
        conditions: [
          { done: true, text: 'A stored file\'s address is checked before it is kept (it let a member run script for others, and delete files that were not theirs).' },
          { done: true, text: 'The server only fetches a member\'s web address if it is on the public internet (it could be used to probe other machines).' },
          { done: true, text: 'Band, challenge, teacher and organisation names are made safe before they are put on the page.' },
          { done: true, text: 'Security headers are sent on every answer; the content security policy is in report-only mode.' },
          { done: false, text: 'Teachers are one list shared by every member: anyone can rename or remove a teacher for everyone, and everyone sees every teacher\'s name. Give each member their own (ML-472).' },
          { done: false, text: 'A private "organisation" a member types in is listed to every member as a band anyone can join. Keep them apart, and decide who can join and edit a band (ML-473).' },
          { done: false, text: 'Enforce the content security policy, which first needs the inline handlers moved out of the pages (ML-474).' },
          { done: false, text: 'Keep Google\'s own access keys out of the sign-in token, and stop putting the token in the address after signing in (ML-475).' },
          { done: false, text: 'Commit the lockfiles so every build installs the same packages, and set a size limit on uploaded recordings (ML-476).' }
        ]
      },
      acceptedAdvisories: [
        { id: 'GHSA-jqcg-44mw-7w3h', package: 'proxy-addr@2.0.7 (through express)', reason: 'the flaw is in trusting a subnet of addresses; this app trusts one proxy hop ("trust proxy", 1), not a subnet. With no lockfile the live site installs the fixed version at its next deploy anyway.' }
      ],
      results: [
        { checkKey: 'object-access', status: 'warn',
          summary: 'Every route that takes an id was followed to its ownership check. 72 take one in the address and about 10 more in the body; all but the ones below restrict the row to the caller. Two real gaps were found and fixed.',
          details: [
            'FIXED - attaching a file to a piece (POST /api/flows/:id/recordings and /documents) stored whatever address the browser sent. A member could attach a public piece\'s file to their own piece and delete it, removing the real file. The address must now be a file in this app\'s own store, uploaded for that very piece (server/services/blobUrls.js, checked against every real stored file on dev), and not already attached; and a file is only deleted when no other piece points at it.',
            'FIXED - deleting a challenge counted the items of any challenge id, so it told a member how many items someone else\'s challenge had. The count is now the caller\'s own.',
            'OPEN, small - a bar or Quick Play block can name another member\'s custom time signature by its id and read its two numbers back (metronomeSegments.js, metronomeSetups.js). No personal information; to be closed with ML-473.',
            'Correct: sessions, challenges, Levels and bars, practice sessions and templates, skill and warm-up lists, practice lists, metronome set-ups and history, custom time signatures, range, cancelling an invite, notifications, a piece\'s bars, MusicXML export, publish and unpublish, account download and deletion.',
            'Admin: all 80 routes are limited to super admins, and the level is read from the database, so the "preview as" header can\'t raise it.'
          ] },
        { checkKey: 'shared-data', status: 'fail',
          summary: 'Three things are shared between all members by the way the data is laid out. With one member there is nobody to affect; they must be put right before anyone else joins.',
          details: [
            'Teachers (the tutors table) have no owner. Renaming a teacher (PUT /api/settings/teachers) renames it on every member\'s lesson history; deleting one removes it for everyone; and every member\'s teacher names are sent to every member in the drop-down lists. ML-472.',
            'A member\'s private "organisation" label is a row in the bands table, so it is listed to every member as a band (GET /api/account/bands), anyone can join it, and a joiner can delete it if it has no history. ML-473.',
            'Joining a band is open to any member, and one join gives the right to edit every piece, recording, document and practice list of that band (only deleting or moving a piece is kept to whoever added it). Open bands are the owner\'s decision for now; it is recorded here because it is the only gate on band data. ML-473.'
          ] },
        { checkKey: 'cross-site-scripting', status: 'warn',
          summary: 'Six places put member-typed text on the page unescaped; all six are fixed. This was a scan and a targeted read, not a proof: the pages build a great deal of HTML by hand, so the real protection is an enforced content security policy.',
          details: [
            'FIXED, serious - a document\'s address was put inside onclick="window.open(\'...\')" as stored. With the unchecked address above, a member could add a document to a band piece that ran script for every member who opened it, and take their sign-in.',
            'FIXED - a band\'s name in My bands (a band is named by whoever adds it, and seen by whoever joins it).',
            'FIXED - a challenge\'s name, and a teacher\'s or organisation\'s name in the drop-downs and in Settings (the member\'s own data, so only themselves at risk - but teachers are shared, see above).',
            'Checked and fine: pieces and their bars, rehearsal marks, recordings, practice lists, the band join list, and the whole admin panel escape what they show.',
            'Not done: a line-by-line read of every innerHTML in app.js (22,000 lines).'
          ] },
        { checkKey: 'sql-injection', status: 'pass',
          summary: 'No query is built from request input. Every value goes in as a numbered parameter.',
          details: ['About 40 queries put something into the SQL text itself; each was read. They are fixed column names, constants in the module, a choice between two fixed strings, or table names read from the database\'s own catalogue.'] },
        { checkKey: 'server-side-fetch', status: 'pass',
          summary: 'One place fetched an address a member typed; it is now limited to the public internet. Everything else the server fetches is a fixed address or this app\'s own file store.',
          details: [
            'FIXED - adding a band fetched its website as typed, following any redirect, and reported the status code back: a member could use the server to probe this machine or a private network. It now refuses anything that is not a public address (server/utils/publicUrl.js, tested), checks every redirect the same way, and says only whether the site answered.',
            'Left open, low: a name that answers with a public address when checked and a private one a moment later (DNS rebinding).',
            'PDF import only ever fetches from this app\'s own store (ML-192).'
          ] },
        { checkKey: 'file-uploads', status: 'warn',
          summary: 'Uploads need a signed-in member with the right to edit the piece, are limited to named file types, and get a random name. Two gaps: recordings have no size limit, and a file\'s address was not checked when it was attached (fixed).',
          details: [
            'OPEN - the recording upload sets file types but no maximum size, so a member could fill the file store (1 GB on the free plan). Score files have a limit. ML-476.',
            'Files are public to anyone who has the address (Vercel Blob public store): the address is long and random, but a recording is not private if its address is passed on. Worth saying in the note to band organisers.'
          ] },
        { checkKey: 'sessions-and-tokens', status: 'warn',
          summary: 'Sign-in tokens are signed, last 30 days, are tied to a number that "sign out everywhere" changes, and a token for another purpose can\'t be used to sign in. Three things to improve.',
          details: [
            'The token is kept in the browser\'s storage, where any script running on the page can read it. That is why injected script matters so much here, and why the content security policy should be enforced (ML-474).',
            'After a Google sign-in the token is put in the address (?authToken=...), so it lands in the browser\'s history. It is removed from the address bar straight away. ML-475.',
            'After a Google sign-in the token also carries Google\'s own access and refresh keys, signed but readable. The app only uses Google to say who someone is, so they should not be kept at all. ML-475.'
          ] },
        { checkKey: 'test-logins', status: 'pass',
          summary: 'Neither shortcut works on the live site.',
          details: [
            'The local "sign in as" shortcut needs NODE_ENV=development and ALLOW_LOCAL_DEV_LOGIN=true, and can only pick one of three fixed test accounts.',
            'The test login needs a secret and now also refuses whenever Vercel says the site is production - NODE_ENV was once set wrongly there, and this no longer depends on it.',
            'No redirect uses an address supplied by the caller, and emailed links use the app\'s own configured address.'
          ] },
        { checkKey: 'rate-limits', status: 'warn',
          summary: 'Signing in, password resets and two-step codes are limited per address and lock after repeated wrong tries. Nothing else is.',
          details: ['The rest of the app has no limit of its own on how often a member can call it; Vercel\'s platform limits are the only brake. Low risk at this size. Worth adding to uploads and to adding a band (which makes the server fetch a website).'] },
        { checkKey: 'device-storage', status: 'pass',
          summary: 'Signing out removes the member\'s information from the device, and a different member signing in wipes it first (ML-220).',
          details: ['The service worker keeps the app\'s own files only. Before ML-220 it kept every answer from the server and never cleared them.'] },
        { checkKey: 'dependency-audit', status: 'warn',
          summary: 'npm audit reports one advisory, in proxy-addr (through express), and it does not apply to how this app is set up. The larger point is that the lockfiles are not committed.',
          details: [
            'GHSA-jqcg-44mw-7w3h (proxy-addr 2.0.7, IP spoofing through a trusted subnet): this app trusts one proxy hop, not a subnet, so the flawed path is not used. Accepted.',
            'package-lock.json is in .gitignore. Every deploy therefore installs whatever the newest matching version of each package is that day: builds are not repeatable, and a bad release of any package would be picked up without anyone choosing it. ML-476.'
          ] },
        { checkKey: 'secrets-in-repo', status: 'pass',
          summary: 'No key, password or token in any tracked file. Secrets are in the hosting settings; .env is ignored.',
          details: ['A pattern search of tracked files (database passwords, Resend, PostHog, Google, Blob and Neon keys, private keys). The git history was not searched with a dedicated tool this time; do that at the next review (Gitleaks).'] },
        { checkKey: 'error-messages', status: 'pass',
          summary: 'An unexpected error is logged on the server and the caller is told only "Something went wrong".',
          details: ['Only a message a service wrote on purpose (a 4xx) is passed through. A missing route or a refused sign-in gives nothing away about what exists.'] }
      ]
    }
  ]
};
