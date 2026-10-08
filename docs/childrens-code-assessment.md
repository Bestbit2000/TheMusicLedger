# Children's Code run-through (ML-506)

**Version 1, 8 October 2026**, against release 0.52.0. A run-through of the whole app against the ICO's
Children's Code (the Age Appropriate Design Code), standard by standard. It is a careful reading by
Claude, **not legal advice**.

| Version | Date | By | What it is |
|---|---|---|---|
| 1 | 8 October 2026 | Claude, for Andrew Storey | The first run-through kept in the repo. Done because recordings were switched on for every account type that day. The owner's own self-assessment (document 4) and impact assessment (document 5) are in his compliance documents; this does not replace them. |

**Next review:** 8 October 2027, or sooner if a new feature touches the young players rule
(`specs/README.md`). It is on Admin → Security → Reviews. Each review adds a row above and updates the table.

**The code itself:** <https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/childrens-information/childrens-code-guidance-and-resources/age-appropriate-design-a-code-of-practice-for-online-services/>.
It is still the code in force. The ICO says it is under review because of the Data (Use and Access) Act
2025 and may change; that Act's own duty to consider children's needs is met by conforming to the code.

## Does it apply?

Yes. The code applies to an online service **likely to be accessed by under-18s**, whether or not it is
aimed at them. Children play in bands and learn with teachers, so they are likely to use this.

## The questions the owner asked

**"The app doesn't know who is a child."** That is allowed, and it is the choice the app has made. Standard 3
gives two ways: find out each user's age with enough certainty, or **apply the standards to every user**.
The app does the second. Nobody is asked their age; everyone gets the protective settings. That also
means holding less about children, not more.

**"It doesn't record a child - it plays back recordings that are uploaded."** True, and it matters: the
app's microphone is never used to keep anything. But a recording held in the app with a child's playing
or voice in it is still information about that child, whoever made it. What the app holds about a child
is: a name, an email address, what they play and practise, and any recording they are in.

**"How does a parent give consent?"** For using the app, the law does not ask for a parent's consent here.
A parent must consent only where a service relies on **consent** as its lawful reason and offers itself
to a child under 13. This app relies on performing its agreement with the member and on legitimate
interests, not consent. The policy asks under-13s to use it with a parent, guardian or teacher, which is
the proportionate step.

For **being in a recording**, the consent is the band's to get, not the app's. A band that records its
young players should have a parent's agreement, as bands already do for photographs and performances.
The app's part is to make the person uploading say so. Since 0.51.0 they confirm once, before a first
upload, that they have the right to upload it; that wording now includes a parent's agreement for anyone
under 16 (action 1). The app keeps the date. **It does not need to hold proof of each parent's consent** -
the band does, as it would for a photograph.

**"Do we need a parent membership that can view entries?"** No, and I would not build one. The code does
not require parental controls. If a service has them, standard 11 says the child must be told they are
being watched. A parent view of a child's practice would also cut across the app's own values: nobody
sees a member's practice except the member, and a teacher sees only their own students.

**"Nothing stops a 10-year-old being a band's organiser."** Correct, and it is the one real gap found. An
organiser invites people by email, decides what each may do, and shares music with the band. That is an
adult's job. See action 2.

## The fifteen standards

| # | Standard | Verdict | What the app does | To do |
|---|---|---|---|---|
| 1 | Best interests of the child | Met | Nothing is taken from a child beyond what practising needs. No adverts, no selling, no profile. Encouragement is positive only. A conductor never sees a player's practice. | - |
| 2 | Data protection impact assessment | **Action** | One exists (the owner's document 5). It predates recordings. | Add the recordings section drafted in his compliance folder on 8 Oct 2026 (action 3) |
| 3 | Age-appropriate application | Met | No age is asked. The standards are applied to every user. Under-13s are asked to use it with a parent, guardian or teacher. | - |
| 4 | Transparency | Met | A plain "Young players" part in the privacy policy, written to the child, now including recordings. The policy and terms are readable signed out. Changes that matter are shown as a notice that must be acknowledged. | - |
| 5 | Detrimental use of data | Met | The no-pressure rule (`specs/README.md`): no streak punishes a missed day, no league table, no reminder designed to bring someone back, nothing compares players. | Keep to it: streak and deadline notices were left out of the notification work for this reason |
| 6 | Policies and community standards | **Action** | The terms say only add what you have the right to use; a recording is removed on request and the people it belonged to told. But the terms do not yet say what may not be shared, and a member has no button to report something. | Actions 4 and 5 (also asked for by the Online Safety Act) |
| 7 | Default settings | Met | Everything a member makes is private. A piece or recording reaches a band only when someone with the right to puts it there. A member's practice is never shared with a band. | - |
| 8 | Data minimisation | Met | A name and an email address; no date of birth, address, phone or payment details. The Recordings tool takes sound only. Usage is counted without knowing who anyone is. | - |
| 9 | Data sharing | Met | Within the member's own band only, and only music, never progress. A public piece carries no recording. The providers that hold data are under contract, except the email provider (GDPR gap 13). | The email provider, when a paid one is chosen |
| 10 | Geolocation | Not applicable | None is collected. | - |
| 11 | Parental controls | Not applicable | None are offered and nothing is monitored. | Do not add a parent view without re-running this standard |
| 12 | Profiling | Met | None. Levels and results are the member's own and feed nothing else. | - |
| 13 | Nudge techniques | Met | The private choice is the default and never the smaller button. Limits are stated once and block nothing else. The one upgrade prompt says what it gives and how to ask, once. | - |
| 14 | Connected toys and devices | Not applicable | None. | - |
| 15 | Online tools | Met | Download my information and Delete my account are on My details, for everyone, without asking. Anyone in a recording can ask for it to be removed. The "Young players" part says who to ask. | A report button would strengthen this (action 5) |

**10 met, 2 with an action, 3 not applicable.**

## Actions

| | Action | Who | Status |
|---|---|---|---|
| 1 | The upload confirmation and the Recordings tool's how-to say that anyone under 16 in a recording needs a parent's agreement | Claude | Done 8 October 2026, not yet released |
| 2 | **An organiser is an adult.** Before someone sets up sharing for a band or sends a band invitation, they confirm once that they are 18 or over and responsible for the band; the terms say so. No proof is asked for - the same weight as the upload confirmation | Claude | Built 8 October 2026, not released. The terms say so. **A 16- or 17-year-old as organiser was considered and turned down by the owner (8 Oct 2026): safer that an adult sets up the band and gives a young helper the "change music" level, which lets them add and share the band's music without inviting anyone** |
| 3 | Add the recordings section to the impact assessment (a new dated copy of document 5) | The owner | Draft is in his compliance folder |
| 4 | The terms say what may not be shared, and what happens if it is | The owner (wording) | Open - also in `online-safety-assessment.md` |
| 5 | A "Report this" button on anything a band shares | Claude | Built 8 October 2026 for a piece and everything on it, not released - see `online-safety-assessment.md` |
| 6 | Tell a band's organisers how sharing with a band works, and that young players' parents must agree to recordings, before a band with young players is invited | The owner | Open (a condition since the first assessment) |

## What would change the answer

Run this again before building any of these: a parent or guardian view; anything that asks or guesses a
member's age; messages between members; a public profile or a way to find other members; reminders,
streak notices or anything that compares players; taking payment from a member.
