# Online Safety Act run-through (ML-507)

**Version 1, 8 October 2026**, against release 0.52.0. A first pass at what the Online Safety Act 2023
asks of this app, done from Ofcom's published guidance. It is a careful reading by Claude, **not legal
advice**, and **the owner should confirm it with Ofcom's own tools** (below) - they are the official
route and they produce the records Ofcom expects.

| Version | Date | By | What it is |
|---|---|---|---|
| 1 | 8 October 2026 | Claude, for Andrew Storey | The first run-through: scope, an illegal content risk assessment, a children's access assessment, a children's risk assessment, and the measures expected of a small low-risk service. |

**Next review:** 8 October 2027 at the latest. Ofcom asks for a review at least once a year, **and before
any significant change** to how the service works. It is on Admin → Security → Reviews.

**Ofcom's own tools - use these to confirm what is below:**
- Does the Act apply: <https://www.ofcom.org.uk/online-safety/illegal-and-harmful-content/check>
- The step-by-step toolkit for the illegal content rules: <https://www.ofcom.org.uk/online-safety/illegal-and-harmful-content/check-how-to-comply-with-the-illegal-content-rules>
- The children's access assessment tool: <https://www.ofcom.org.uk/os-toolkit/child-access-assessment/childrens-access-assessment-tool>
- For small services: <https://www.ofcom.org.uk/online-safety/illegal-and-harmful-content/helping-small-services-navigate-the-online-safety-act>

## 1. Does the Act apply?

**Almost certainly yes.**

- The Act covers a **user-to-user service**: one where something a user makes, uploads or shares may be
  seen or heard by another user. Having the means to share is enough; it does not have to be used much.
- In this app a member can put a piece, a recording, a document, a YouTube link and a practice list on a
  band's space, where the band's other members see and play them. Members also see each other's names.
- **None of the exemptions fits.** They are for services whose only user content is email, text
  messages, one-to-one live voice calls, or comments on the provider's own content; internal business
  tools; public bodies; and schools and childcare providers. A band's shared music is none of these.
- **Being small is not an exemption.** Ofcom says over 100,000 services are in scope, "from the largest
  social media platforms to the smallest community forum". What changes with size and risk is how much
  is expected.
- It has UK users and is aimed at them.

What Ofcom says about a service like this one: it takes "a reasonable approach to enforcement" with
small low-risk services and is "not setting out to penalise small, low risk services trying to comply in
good faith".

## 2. What the app lets one member show another

This is the whole of it, and the smallness of the list is the main reason the risk is low.

| What | Who can add it | Who sees it |
|---|---|---|
| A piece: its title, composer and bars | A member with "change music" in the band | The band |
| A recording (sound; up to 25 MB on a piece, 100 MB through the Recordings tool) | The same; through the Recordings tool only an organiser | The band |
| A document: PDF, MusicXML, MuseScore, Sibelius, Finale (up to 25 MB) | A member with "change music" | The band |
| A YouTube link and its title | A member with "change music" | The band |
| A practice list's name | A member with "change music" | The band |
| A band's name | Whoever sets up sharing | The band, and people invited to it |
| A member's name and picture (initials or one of twelve drawings - no photo upload) | The member | The band |
| A public piece | The owner only | Everyone |

**What the app does not have:** messages between members, comments, a public profile, a way to search for
or find other members, a feed, live video or audio, anonymous use, or sign-up without an invitation. A
band is joined only by an organiser's invitation.

## 3. Illegal content risk assessment

Ofcom's method has four steps: know the kinds of illegal content, assess the risk of each, decide and
record the measures, then review. Ofcom lists 17 kinds of priority illegal content (a newer page says
18; the toolkit has the current list). They are grouped here. Each is judged on how likely it is and how
bad it would be, given what section 2 shows the app can and cannot do.

| Kind of illegal content | Risk | Why |
|---|---|---|
| Child sexual abuse material (images, or links to it) | **Low, not negligible** | A PDF can hold images and a YouTube title is free text, so it is possible. But a file reaches only one band's members, the band is invitation-only, every upload is tied to a named account, and nothing can be found from outside. It would be very serious, so it is not rated negligible. |
| Grooming | **Low** | There are no messages, comments or profiles, so one member cannot contact another through the app. An organiser sees members' names and typed their email addresses to invite them. The risk that is left is an adult using a band as cover; see action 2. |
| Terrorism; hate; harassment, stalking, threats and abuse | Low | Only a title, a band's name or a file could carry it, and only to the band. No comments or messages. |
| Controlling or coercive behaviour | Negligible | No way to contact or follow a person. |
| Intimate image abuse; extreme pornography | Low | Only as a file in a PDF or a link, to one band. No photo or video upload in the Recordings tool; a piece's own recording may be an mp4. |
| Sexual exploitation of adults; human trafficking; unlawful immigration | Negligible | Nothing is advertised and nobody can be contacted. |
| Fraud and financial offences; proceeds of crime | Negligible | No payments, no messages, no listings. |
| Drugs and psychoactive substances; firearms, knives and other weapons | Negligible | Nothing can be offered or sought. |
| Encouraging or assisting suicide | Low | Only as a file or a link to one band. |
| Foreign interference; animal cruelty | Negligible | No public reach. |
| Other illegal content: copyright is the realistic one | **Medium for copyright** (not a priority offence under this Act) | Members upload scores and recordings. The terms forbid it, an upload is confirmed once, and there is a take-down route. |

**Overall: low risk.** The features Ofcom's risk profiles worry about most are missing: messaging,
anonymous accounts, public content, user search, livestreaming, recommendations. The one that is present
is **file sharing within a closed group**.

## 4. Children's access assessment

Two stages, as Ofcom sets them out.

- **Stage 1: can children normally reach the service?** Yes. Ofcom allows "no" only where highly
  effective age checks keep children out. The app has none and should not: it is meant for bands that
  include young players.
- **Stage 2: are there, or are there likely to be, a significant number of children?** Yes. Youth and
  training bands, and pupils of teachers, are who it is built for. Ofcom says to err on the side of
  caution and that even a small number can be significant.

**Outcome: the service is likely to be accessed by children.** So the children's duties apply and a
children's risk assessment is needed. Ofcom requires this outcome to be recorded whatever it is; this is
that record.

## 5. Children's risk assessment

The content the Act names as harmful to children, against what the app can carry.

| Kind | Risk | Why |
|---|---|---|
| Primary priority: pornography; content encouraging suicide, self-harm or an eating disorder | **Low** | Possible only as a file or a link shared with one band by someone trusted to change its music. The terms should forbid it outright (action 4) |
| Priority: bullying; abuse and hate; violence; harmful substances; dangerous stunts | **Low** | No comments or messages. A band's name, a piece's title or a practice list's name is the only free text another member sees. A rehearsal recording could embarrass a player: nothing can be written on it, and anyone in it can have it removed |
| Other content harmful to children | Low | As above |
| Contact from adults | **Low, see action 2** | No contact through the app. An organiser chooses who is invited |

**Overall: low risk for children**, for the same reason as section 3.

## 6. The measures Ofcom expects of a small low-risk service

Ofcom's words for a service that has assessed itself, with good reason, as low risk:

| What Ofcom expects | Where the app stands | To do |
|---|---|---|
| "Easy-to-find, understandable terms and conditions" | Terms and a privacy policy, plain English, readable signed out, linked from sign-in and About. They cover copyright and recordings with other people in them. **They do not yet say what may not be shared**, or that it will be removed. | **Action 4** |
| "A complaints tool that allows users to report illegal or harmful material when they see it", with "a process to deal with those complaints" | An email address, and the Feedback form in the menu. **There is no "report this" on a shared piece, recording or document**, and Feedback can be switched off for an account type. | **Action 5** |
| "The ability to review content and take it down quickly" | The owner can remove any recording or video link everywhere in one action, with the people told (Admin → Recordings, ML-490), and rename or remove a band (Admin → Bands). **A piece, a document or a practice list in someone else's band has no such page** - today that would mean going to the database. | **Action 6** |
| "A specific individual responsible for compliance, who we can contact" | The owner, named in the privacy policy with an email address. | Say so in the terms (part of action 4) |
| A written record of each assessment, kept up to date | This document, with a version history, and the yearly review on Admin → Security → Reviews. | **Action 1**: confirm with Ofcom's tools |
| A new assessment before a significant change | Not yet part of the release process. | **Action 7** |

For children, the Protection of Children Codes add to the same list: the report route must be one a
child can find and use, terms a child can follow, and someone who acts on a report. The actions below
are written to meet both.

## Actions

| | Action | Who | Status |
|---|---|---|---|
| 1 | Run Ofcom's checker and its children's access tool, and keep what they produce with this record | The owner | Open |
| 2 | **An organiser is an adult**: a one-time confirmation before setting up sharing or inviting, and a line in the terms. (The same action as in `childrens-code-assessment.md`.) | Claude | **Built 8 October 2026**, not released: the server refuses both until confirmed; the day is kept, and the terms say so. A route for a 16- or 17-year-old organiser was considered and turned down by the owner the same day: an adult sets up the band and can give a young helper the "change music" level |
| 3 | Keep organisers messaging their band (ML-498) parked, and re-run this before building it: it would add contact between members, which changes sections 3 and 5 | - | Parked 8 October 2026 |
| 4 | The terms say what may not be shared (anything illegal, anything sexual, anything hateful or bullying, anything not yours to share), that it will be removed and the account may be closed, how to report it, and who is responsible | The owner (wording) | **Done 8 October 2026**, not released: in the terms' "What you put in", with a report looked at within two working days |
| 5 | **"Report this"** on any piece, recording, document, video link or band a member can see: one tap, an optional line of text, sent to the owner with what it was about. Always there, whatever features an account type has | Claude | **Built 8 October 2026**, not released: "Report" on the menu of a band's or a public piece in My music - the piece is reported with its recordings, documents and links. **Still to do:** the same on the play screen, and for a band's name or a practice list's name |
| 6 | **One place for the owner to take anything down**: extend Admin → Recordings to documents, pieces and practice lists. Each removal tells the people it belonged to and is kept on record, as recordings are now | Claude | **Built 8 October 2026**, not released: the page is now Admin → Shared music - members' reports, recordings and videos, documents, and the pieces a band shares or that are public. **Still to do:** a band's practice list |
| 7 | Add to the release process: "does this change what one member can show another, or let members contact each other?" - if so, this run-through is done again first | Claude | Open |
| 8 | Reports are answered: say in the terms how quickly, and keep a simple log of each report and what was done | The owner, Claude | The log is built (a report is closed with a line saying what was done). How quickly is for the terms (action 4) |

## What would change the answer

Run this again **before** building any of these: messages or comments between members; a member profile
others can open; any way to find or search for members or bands' content from outside a band; photo or
video upload; live audio or video; sign-up without an invitation; letting members make a piece public;
a band directory that shows members.
