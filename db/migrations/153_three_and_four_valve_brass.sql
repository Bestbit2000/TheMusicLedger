-- ML-602 (owner, 24 Oct 2026): 3- and 4-valve brass.
--
-- A 3-valve brass instrument can't play the five written notes between its pedal notes and its low register (written
-- C#3 to F3 in treble), and a range here is one unbroken run - so a 3-valve range stops at written F#3, the lowest note
-- before the gap, and leaves the pedal notes out. range_low held the pedal notes until now (the baritone's F#2 was a
-- 3-valve's lowest pedal, the cornets' and tenor horn's C3 the pedal C), so the Range tool could ask for notes that
-- aren't there.
--
-- The euphonium, baritone horn and E♭ and B♭ basses each come as a 3-valve and a 4-valve version, named
-- "B♭ Euphonium (4 valves)" (the usual name first). Players keep the row they have: today's euphonium and basses become
-- the 4-valve versions (brass band instruments are usually 4-valve compensating) and keep their ranges; today's baritone
-- becomes the 3-valve version. Their own comfortable range (account_instruments.bottom_note) is left as they set it.
-- The new rows copy everything else (family, clefs, the bass clef choice in other_clefs, written_to_concert) from their
-- other version, so the scale lists, which still find an instrument by its name (ML-609), work for them too.

-- The renames
UPDATE instruments SET name = 'B♭ Euphonium (4 valves)' WHERE code = 'bb_euphonium';
UPDATE instruments SET name = 'B♭ Baritone Horn (3 valves)' WHERE code = 'bb_baritone_horn';
UPDATE instruments SET name = 'E♭ Tuba (EE♭ Bass, 4 valves)' WHERE code = 'eb_tuba';
UPDATE instruments SET name = 'B♭ Tuba (BB♭ Bass, 4 valves)' WHERE code = 'bb_tuba';

-- The new versions, next to the one they come from in the list
INSERT INTO instruments (code, name, pitch_key, sounding_transposition, clef, theory_clef, family, subfamily, ensembles, role,
                         frequency, notes, sort_order, active, written_to_concert, range_low, range_high, other_clefs)
SELECT v.code, v.name, i.pitch_key, i.sounding_transposition, i.clef, i.theory_clef, i.family, i.subfamily, i.ensembles, i.role,
       i.frequency, i.notes, i.sort_order + 5, i.active, i.written_to_concert, v.range_low, i.range_high, i.other_clefs
FROM (VALUES
    ('bb_euphonium',     'bb_euphonium_3v',     'B♭ Euphonium (3 valves)',       'F#3'),
    ('bb_baritone_horn', 'bb_baritone_horn_4v', 'B♭ Baritone Horn (4 valves)',   'C2'),  -- as the 4-valve euphonium, the same length of tube
    ('eb_tuba',          'eb_tuba_3v',          'E♭ Tuba (EE♭ Bass, 3 valves)',  'F#3'),
    ('bb_tuba',          'bb_tuba_3v',          'B♭ Tuba (BB♭ Bass, 3 valves)',  'F#3')
) AS v(from_code, code, name, range_low)
JOIN instruments i ON i.code = v.from_code
ON CONFLICT (code) DO NOTHING;

-- Every other 3-valve instrument stops at written F#3 too
UPDATE instruments SET range_low = 'F#3'
WHERE code IN ('bb_baritone_horn', 'eb_soprano_cornet', 'bb_cornet', 'bb_repiano_cornet', 'bb_flugelhorn',
               'bb_trumpet', 'c_trumpet', 'eb_tenor_horn');
