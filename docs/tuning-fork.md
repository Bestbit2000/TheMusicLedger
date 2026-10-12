# Tuning fork (ML-158)

A note to tune to: pick it on a stave, press play, and it sounds until you stop it. Feature
**`tuning_fork`** (migration `130`, off until switched on in Admin → Feature access). Code: the TUNING FORK
section of `public/app.js`; `#tuningForkView` in `index.html`; spec
`specs/components/tuning-fork.md`. Decided with the owner on 12 Oct 2026.

## Where it is

A tool of its own: All tools → Everyday → Tuning fork (and Home, if made a favourite).

**Not on the Tuner** (owner, 12 Oct 2026). The ticket asked for it there too, and a button on the tuner's
card that opened it as a pop-up was built - then taken out the same day: he didn't want it on the Tuner.

## The note

- **Written for your instrument.** It is drawn in the clef you read that instrument in and at its written
  pitch (My instruments: `theoryClef`, `writtenToConcert` - ML-528), with "sounds as concert B♭" under it.
  With more than one instrument a box chooses which (your main one to start with). With none it is treble
  clef at concert pitch.
- **It starts on the usual tuning note** (`forkUsualNote`): a band tunes to **concert B♭**, so brass and
  woodwind start there - written C on a B♭ instrument, G on an E♭ one, B♭ on a flute or trombone in bass
  clef. Strings and anything else start on **concert A**. Of the octaves the instrument can play, it is the
  one nearest the middle line of the stave (third-space C for a cornet).
- **Changing it:** tap the stave near a note for that natural note, then − and + for a semitone. It stays
  inside the instrument's range (the same outer limit Range uses). "Back to the usual tuning note" undoes it.
- **How high it sounds:** the written note plus the instrument's transposition, at the Tuner's own
  **A =** setting (`tunerA4Freq`, 440 unless changed) - one setting for both.

## The sound

One held note (`forkStart` / `forkStop`): a soft triangle wave with a quieter octave above it, so a low
note can still be heard on a phone's small speaker. It fades in and out, and a change of note or volume
while it sounds is followed without a restart. It has its own audio context, made on the first Play.

The note stops by itself when you leave the screen or the app goes to the background. Nothing listens
while it sounds: its screen has no tuner on it, and leaving the screen stops the note. (If it is ever put
beside a tuner, pause the tuner first - it would hear the fork and call you in tune.)

## What is kept

Nothing on the server, so it works offline and the privacy policy doesn't mention it. On the device
(`localStorage` `tml.fork`): the note for each instrument, the instrument chosen here, and the volume.

## Adding to it

- A new sound, or playing more than one note: the voice is `forkVoice` (`{ oscs, gain }`).
- The usual tuning note for a kind of instrument is the one place to change: `forkUsualNote`.
- It is a home tool: its id `tuning-fork` is in `HOME_TOOL_IDS` (`server/services/accounts.js`) and counted
  in `server/test/homeTools.test.js`.
