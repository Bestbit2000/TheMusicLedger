// ML-267: the register of third parties - every person and company The Music Ledger depends on,
// what they give us, their terms, and what those terms ask of us. Admin -> Third parties shows it;
// `npm run third-party-audit` (and the release gate) checks the code against it.
// How to add or re-check an entry: docs/third-party-providers.md.
//
// Modules rather than .json files so Vercel's bundler always traces them into the function (the
// same reason as server/securityReviews/).
//
// Each entry:
//   key, name       stable id and the name shown
//   group           service (the live app needs it) | asset (font, icon) | content (other people's
//                   material or ideas) | library (npm package) | build (used to build the app)
//   status          in_use | not_in_use | attention (something the owner needs to act on)
//   who             the person or company, and where they are
//   provides        what it gives us, in plain words
//   usedIn          where in the code or set-up
//   plan, cost      the plan we're on and what it costs now; paid: true when money changes hands
//   licence         the licence, or the name of the terms
//   terms           links to the terms, policies and pricing, each with the date printed on it
//   termsCheckedOn  when we last read them (the audit warns when this gets old)
//   licenceFile     our own copy of the licence text, where one is held (open licences only)
//   says            what the terms say, in our own words - never pasted from the terms
//   asks            what they ask of us: { text, check? }. A check is { path, includes? } - a file
//                   that must exist and, optionally, text it must contain - and is run on every
//                   release. With no check it is listed to be checked by hand.
//   attention       things the owner needs to do or decide
//   watch           things to keep an eye on
//   limits, overLimit, nextTier, usageSource
//                   what the plan allows, what happens past it, the next plan up, and how usage
//                   can be measured (the groundwork for costs and usage, ML-267 release 2)
//   hosts, packages, files, googleFonts
//                   what in the code belongs to this entry - how the audit knows it is covered
//
// The summaries were written from each provider's own pages as read on termsCheckedOn. They are
// a working record, not legal advice: read the page itself before relying on a point.

import services from './services.js';
import { assets, content } from './assetsAndContent.js';
import { libraries, build } from './librariesAndTools.js';

export default {
  entries: [...services, ...assets, ...content, ...libraries, ...build],

  // Web addresses that appear in the code but are not a dependency on anyone.
  notDependencies: [
    { host: 'w3.org', why: 'XML and SVG namespace names - nothing is fetched' },
    { host: 'bournebrass.org.uk', why: 'An example band link on the Design page' },
    { host: 'evil.example', why: 'A made-up address in the security self-tests' },
    { host: 'security-probe.invalid', why: 'A made-up address in the security self-tests' },
    { host: 'solfascribe.app', why: 'Quoted in a security review note - never called' }
  ]
};
