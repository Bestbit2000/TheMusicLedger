// ML-528: the clef a player reads an instrument in - chosen per person (account_instruments.clef), from the
// clefs the instrument is read in (its own, instruments.theory_clef, and instruments.other_clefs).
//
// Everything stored about an instrument's notes - written_to_concert, range_low / range_high, a player's
// bottom_note / top_note, the Range tool's Levels - is written pitch in the instrument's OWN clef. A player
// who reads another clef sees the same sounding notes written for theirs: every pitch moves by `shift`
// semitones on the way out (toMine) and back on the way in (toOwn). A treble-clef euphonium part sounds a
// major 9th lower than written (-14) and a bass-clef one is at concert pitch (0), so written C4 in treble
// is B♭2 in bass: shift -14. No database here - instruments.js and range.js use it, and it is unit-tested.
import fs from 'node:fs';
import vm from 'node:vm';

const sandbox = { self: {} };
for (const f of ['notation.js', 'range.js']) {
  vm.runInNewContext(fs.readFileSync(new URL(`../../public/${f}`, import.meta.url), 'utf8'), sandbox);
}
const PlayRange = sandbox.self.PlayRange;

export const READING_CLEFS = ['treble', 'bass', 'alto', 'tenor'];

// The clefs an instrument is read in, its own first: [{ clef, writtenToConcert }]. Only its own for most;
// none at all for an instrument with no single clef (a piano's grand staff, unpitched percussion).
export function clefChoices(row) {
  if (!READING_CLEFS.includes(row.theory_clef)) return [];
  const own = { clef: row.theory_clef, writtenToConcert: Number(row.written_to_concert) || 0 };
  const others = (Array.isArray(row.other_clefs) ? row.other_clefs : [])
    .filter(c => c && READING_CLEFS.includes(c.clef) && c.clef !== own.clef)
    .map(c => ({ clef: c.clef, writtenToConcert: Number(c.writtenToConcert) || 0 }));
  return [own, ...others];
}

// How this player reads the instrument. `chosen` is account_instruments.clef (null, or a clef the
// instrument isn't read in, means its own). shift: semitones from the instrument's own written pitch to
// the player's.
export function clefView(row, chosen) {
  const choices = clefChoices(row);
  const mine = choices.find(c => c.clef === chosen) || choices[0] || null;
  if (!mine || mine === choices[0]) {
    return { clef: row.theory_clef, writtenToConcert: row.written_to_concert, shift: 0, choices, isOwn: true };
  }
  return { clef: mine.clef, writtenToConcert: mine.writtenToConcert, shift: choices[0].writtenToConcert - mine.writtenToConcert, choices, isOwn: false };
}

// A written pitch moved by some semitones, spelled the usual way a range is (C♯, E♭, F♯, A♭, B♭). Not
// moved at all (the player reads the instrument's own clef), it is handed back exactly as it was spelled.
export function shiftPitch(pitch, semitones) {
  if (!pitch || !semitones) return pitch || null;
  return PlayRange.pitchOf(PlayRange.midiOf(pitch) + semitones, 'usual');
}
export const toMine = (view, pitch) => shiftPitch(pitch, view.shift);
export const toOwn = (view, pitch) => shiftPitch(pitch, -view.shift);
