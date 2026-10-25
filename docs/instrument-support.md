# Instrument support (ML-610)

A small, checked "who to ask" list for band players - repairers, shops and hire near their bands - in place
of the "anyone know a...?" question on the band's WhatsApp. Not a general directory. Feature
`instrument_support`: switched on for every account type from release 0.71.0 (owner, 25 Oct 2026), by migration
157 so every environment is the same; it is free to use and on the pricing page. It can be switched off on
Admin → Feature access.

## The owner's decisions (24-25 Oct 2026)

- **Called "Instrument support", a ☰ menu item** in the You group, straight after My instruments (not a
  tool: it is used now and then). **My instruments links to it** ("Need a repair, a shop or hire?"),
  opening it on the main instrument's family. A later instrument care timetable in My instruments will link
  to a service / repair person here too.
- **Repairers, shops and hire only.** No insurers (charging for placement may count as promoting a
  financial product) and no teachers (the app can't check safeguarding, and young players use it).
- **A plain list** - no reviews, no ratings, no "our band uses this".
- **Concert band as well as brass**: woodwind and band percussion too.
- **Near = within about 45 minutes' drive of the towns of the bands on My bands**, nearest first. A
  member can pick another town for one look; nothing is kept. Nothing new is asked about a member.
- **UK-wide businesses** (post-in repairs, online shops, UK hire) always show, in their own "Anywhere in the
  UK" group under the local ones - and so does a business with a workshop more than 45 minutes away that
  also posts.
- **Only real businesses, added by the owner**: from the business's own website, or one the owner knows
  that has said yes to being listed (a Facebook page will do for its link). Nobody adds themselves.
- **Free to be listed, always.** Paid extras for a business may come later, with "claiming a listing" (a
  link sent to an email address on its own website's domain); not in the first version.
- **Contact is outside the app** - the business's website or Facebook page, phone or email. No
  messaging, so the Online Safety picture doesn't change.
- **Counts, never who**: each look counts what was looked for and where (a town, or "My bands' towns"),
  and each listing counts how often it was shown - no account attached. The owner sees them on Admin →
  Instrument support; a business might see its own later, once it has claimed its listing.
- The menu was re-ordered with it ("Option A"): My music · **My app settings** (was Settings) · My
  instruments · Instrument support in the You group, and **My account** moved down next to Log out.

## How it works

**Server:** `server/services/instrumentSupport.js`; `GET /api/support` (`for`, `near`, `county`) and
`GET /api/support/places?q=` behind `requireFeature('instrument_support')`; the admin routes
`/api/admin/support` (GET, POST, PUT `/:id`, DELETE `/:id`).

**Tables** (migration 155): `support_businesses` (one row per business: `offers` is a list of
`repairs-brass`, `repairs-woodwind`, `repairs-percussion`, `shop-brass`, `shop-woodwind`,
`shop-percussion`, `hire`; `uk_wide`; town, county, postcode and its position; `link_url` + `link_kind`
(website or facebook); phone, email, what they do; `source` website or owner; `checked_on`, `checked_url`;
`hidden`), `support_search_counts` (day, looked for, near, searches, searches that found nothing nearby),
`support_listing_counts` (day, business, times shown) and `place_locations` (a cache of every postcode and
town looked up, so each is looked up once).

**Where things are.** A business's position comes from its postcode, else its town. A member's places are
the directory bands their My bands rows are linked to (the band's rehearsal postcode, else its town); a
band typed in by hand and not in the directory has no town, and the screen says so and offers "near".
Positions come from [postcodes.io](https://postcodes.io) (open data, no key, nothing about a member is sent
- only a band's or a business's postcode or town, or the town a member typed).

**The drive time** is an estimate from the straight-line distance, `driveMinutes(miles, to)`: miles × 1.7 +
3, plus 20 for anywhere within 10 miles of central London, rounded to 5 minutes, never under 5. It errs
long: a business is listed under the nearest of the member's towns, and "within about 45 minutes" is
`MAX_MINUTES`.

**Looking for** - Everything, Brass repairs, Woodwind repairs, A shop, Hire, Percussion (`LOOKING_FOR` in
the service). From My instruments it starts on the main instrument's family (`instruments.family_key`,
ML-609).

## Adding an area

1. Research the area by hand, as for the band directory: only a business found on its own website (or one
   the owner knows has said yes). Write the list to `db/instrument-support/<date>-<area>.json` -
   `businesses` (each with `group` local or uk-wide, its offers, town, postcode, website, `post_in`,
   `source`, `checked_url`) and `left_out` (each with why). An entry whose `notes` say "Not shown until
   they say yes" is skipped. `2026-10-25-woking.json` is the first, and the example.
2. `node scripts/instrument-support-seed-migration.mjs` looks up each position and writes the next
   `db/migrations/NNN_instrument_support_<area>.sql` (an upsert by name, so running an area again updates
   it).
3. Apply it to dev, check the list in the app, and release it like any migration.

Single changes - a new business, a business asking to be changed or taken off - are made on
Admin → Instrument support. **Hide** keeps a row while waiting for a yes; **Remove** deletes it and its
counts, for a business that asks to come off.

## Privacy

A sole trader's name, phone number and email are personal data. The privacy policy names what is listed,
where it comes from, how a business asks to be changed or taken off (hello@notablybetter.com, or Send
feedback in the app), and that a look is counted by what and where, never who. The owner approved the
policy wording and the design on 25 Oct 2026. The third-party register has postcodes.io (the service) and
the data it serves (UK postcode and place data, Open Government Licence - credited at the foot of the
screen) as two entries.

## Young players, Online Safety and GDPR (checked 25 Oct 2026, before switching on)

- **Children's Code:** checked standard by standard in
  `compliance-documents/2026-10-25 Children's Code check - Instrument support.md` (the owner's folder, not in git).
  Answered: the screen and the policy's "Young players" part say to ask a parent or carer before getting in touch
  with a business. Paid extras for businesses, if they come, need standards 5 and 13 checked again first.
- **Online Safety:** version 6 of `docs/online-safety-assessment.md` - no contact between members, risk unchanged.
  Businesses managing their own listing, or members reviewing businesses, would need it run again.
- **GDPR:** a sole trader's details taken from their website must be told it is listed (Article 14) - an email to
  each listed business, within a month of listing (the first list by 25 November 2026). Drafts for the record of
  processing, the legitimate interests assessment and the impact assessment are in the same compliance file.
- **Notice:** an Important one with the privacy policy link, as it was switched on (release 0.71.0).
