# Product values

What the app is for and the lines it holds. Read this before proposing a feature, a price, a gate or
anything one member can see about another. It is the "why" behind decisions that are otherwise
scattered through the specs and feature docs.

Written 6 Oct 2026 from the owner's decisions during the competitor analysis
([competitor-analysis.md](competitor-analysis.md)). The values are the owner's; change one only on
his say-so, and change this page in the same commit.

## The values

### 1. The band's own music comes first

A band can put in **any** piece it is playing: a new arrangement, a hand-written part, something
decades old that is in no online library. The app never depends on a publisher's catalogue.

- A piece needs only its structure (bars, time, speed) to be useful. A notation file, a PDF or a
  recording is a bonus, never a requirement.
- Anything that makes entering a piece from the paper part faster (Quick entry, import) is core work,
  not a nice-to-have.

### 2. Share the music, never the progress

A band shares its pieces and its practice lists. It does **not** share how any member is getting on.

- **A band leader, conductor or organiser never sees a member's Levels, forecast, practice time or
  when they last practised** - not by name, and not on a dashboard.
- The one exception is a **teacher seeing their own students**, which is what a teacher is for.
- Why: a player who knows nobody is watching marks the bars they can't play. One who thinks the
  conductor can see will not. The owner's own test: he would not want his conductor to know he is
  behind on Saturday's pieces.

### 3. Nobody marks anybody

How ready a player is comes out of the practice they have already done. Nobody uploads a recording
to be judged, and nobody passes or fails a colleague.

- This is the opposite of the "Assessments" in Making Music Platform, where a leader passes or fails
  each member on each piece.
- It goes with the wording rule the app already follows: results are positive only (Levels, not
  scores or wrong answers; the home greeting; rest messages).

### 4. Bands are how the app spreads, not who pays

The app is **free for a band**. Members who want more pay for it themselves (Premium).

- Band features - sharing pieces, band practice lists, invitations - belong in the free tier.
- The practice tools are where the money can come from, and that money is what lets the band side
  stay free. A band that struggles to pay its fees should find the app takes a cost away, not adds one.
- Do not propose charging a band unless the owner raises it.

### 5. Easy enough that nobody has to be chased or taught

If a member needs showing how, or an organiser still has to go round asking people, the feature has
failed - however much it can do.

- The owner's test: "Even I don't really know how to properly use it, and I'm writing an app" (said
  of the band's current members area, which has 23 tiles and four past events with no attendance
  recorded).
- Fewer things done well beats a grid of everything. This is the same thinking as the design rules
  in `specs/README.md` (one button, one pop-up; one question a step).

### 6. Built for bands, in a band's words

The app is written for wind, brass and concert band players. It is not a choir, school or covers-band
tool with the labels changed.

- No screen should ask a euphonium player for a "Singing" result.
- Words on screen are the ones a player uses: piece, bars, part, band, practice list.

## Values the app already held

These were decided earlier and sit alongside the six above.

- **A member's data is theirs and little of it is kept.** Anonymous, cookieless analytics; self-hosted
  fonts; delete-my-account; retention. See [account-deletion.md](account-deletion.md),
  [retention.md](retention.md) and the privacy policy.
- **Everyone can read and use it.** WCAG 2.2 AA, dyslexia-friendly reading. See
  `specs/foundations/accessibility.md` and [display-and-reading.md](display-and-reading.md).
- **Ownership wording.** A player's own things are "My ...", not "Your ...".
- **Only real things.** A band is only added to the directory if it was found on a real web page.

## Proposed, not yet agreed

Ideas from the competitor analysis that the owner has heard but not decided. Do not build from these
without asking.

- **Availability for events** ("are you coming on the 10th?"), answered in one tap with the app doing
  the chasing, so a band needs only one app. Only that - not a member database, fees, minutes or the
  rest of a band secretary's admin.
- **An event carries its programme**, so a player sees the pieces for that date next to their own
  readiness (seen by them only - value 2).
- **Sit alongside** a band's existing admin tool at first, rather than asking a secretary to switch
  everything at once.

## How to use this page

- A new feature that shows one member something about another: check value 2 first.
- A new gate or price: check value 4, then [feature-access-plan.md](feature-access-plan.md) and
  [business-case.md](business-case.md).
- A new screen: check value 5, then `specs/README.md`.
- If a request seems to cut across a value, say so and ask - don't quietly build round it.
