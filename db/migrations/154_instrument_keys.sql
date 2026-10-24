-- ML-609 (owner, 24 Oct 2026): look an instrument up by a key, never by the words on screen. Renaming an instrument,
-- adding a version of one (ML-602's "B♭ Euphonium (3 valves)") or translating the app could otherwise quietly change
-- what it does.
--
-- family_key: the family as a key ('brass', 'woodwind', 'percussion', 'keyboard', 'strings'). `family` stays as the
-- words shown; everything that decides something - the soft top a 4th above on brass and woodwind (PlayRange), the
-- tuner's concert pitch, Scales' bass-clef shift, rest messages for brass and wind players, the order of the
-- instrument list - reads family_key.
ALTER TABLE instruments ADD COLUMN IF NOT EXISTS family_key text;
UPDATE instruments SET family_key = lower(family) WHERE family_key IS NULL;
ALTER TABLE instruments ALTER COLUMN family_key SET NOT NULL;
ALTER TABLE instruments ADD CONSTRAINT instruments_family_key_check
    CHECK (family_key IN ('brass', 'woodwind', 'percussion', 'keyboard', 'strings'));

-- scale_lists: which ABRSM scale list (ScaleGrades.DATA id) the instrument uses, by the clef it is read in -
-- {"treble": ..., "bass": ..., "tenor": ...}, or {"any": ...} when it is the same in every clef; {} = none (strings,
-- keyboards, percussion). Until now public/scaleGrades.js picked the list by matching the instrument's NAME. These are
-- the lists those rules gave each instrument on 24 Oct 2026 (worked out from them, so nobody's list changes), except
-- four the name rules got wrong (marked true): the contra-alto and contrabass clarinets and the contrabass saxophone got the tuba lists
-- from "EE♭" / "BB♭" in their names, and the soprillo saxophone the flute list from "piccolo" in its name.
ALTER TABLE instruments ADD COLUMN IF NOT EXISTS scale_lists jsonb NOT NULL DEFAULT '{}'::jsonb;
UPDATE instruments i SET scale_lists = v.lists::jsonb
FROM (VALUES
    ('piccolo_c', '{"any":"flute"}', false),
    ('piccolo_db', '{"any":"flute"}', false),
    ('concert_flute', '{"any":"flute"}', false),
    ('alto_flute', '{"any":"flute"}', false),
    ('bass_flute', '{"any":"flute"}', false),
    ('oboe', '{"any":"oboe"}', false),
    ('english_horn', '{"any":"oboe"}', false),
    ('oboe_d_amore', '{"any":"oboe"}', false),
    ('bassoon', '{"any":"bassoon"}', false),
    ('contrabassoon', '{"any":"bassoon"}', false),
    ('heckelphone', '{"any":"oboe"}', false),
    ('ab_piccolo_clarinet', '{"any":"clarinet"}', false),
    ('eb_clarinet', '{"any":"clarinet"}', false),
    ('d_clarinet', '{"any":"clarinet"}', false),
    ('bb_soprano_clarinet', '{"any":"clarinet"}', false),
    ('a_soprano_clarinet', '{"any":"clarinet"}', false),
    ('basset_horn', '{"any":"clarinet"}', false),
    ('eb_alto_clarinet', '{"any":"clarinet"}', false),
    ('bb_bass_clarinet', '{"any":"clarinet"}', false),
    ('eb_contra_alto_clarinet', '{"any":"clarinet"}', true),
    ('bb_contrabass_clarinet', '{"any":"clarinet"}', true),
    ('soprillo_saxophone', '{"any":"saxophone"}', true),
    ('sopranino_saxophone', '{"any":"saxophone"}', false),
    ('bb_soprano_saxophone', '{"any":"saxophone"}', false),
    ('eb_alto_saxophone', '{"any":"saxophone"}', false),
    ('bb_tenor_saxophone', '{"any":"saxophone"}', false),
    ('eb_baritone_saxophone', '{"any":"saxophone"}', false),
    ('bb_bass_saxophone', '{"any":"saxophone"}', false),
    ('eb_contrabass_saxophone', '{"any":"saxophone"}', true),
    ('eb_soprano_cornet', '{"treble":"eb-soprano-cornet"}', false),
    ('bb_cornet', '{"treble":"trumpet-cornet-flugel"}', false),
    ('bb_repiano_cornet', '{"treble":"trumpet-cornet-flugel"}', false),
    ('bb_flugelhorn', '{"treble":"trumpet-cornet-flugel"}', false),
    ('piccolo_trumpet', '{"treble":"trumpet-cornet-flugel"}', false),
    ('eb_d_trumpet', '{"treble":"trumpet-cornet-flugel"}', false),
    ('bb_trumpet', '{"treble":"trumpet-cornet-flugel"}', false),
    ('c_trumpet', '{"treble":"trumpet-cornet-flugel"}', false),
    ('bass_trumpet', '{"treble":"trumpet-cornet-flugel"}', false),
    ('eb_tenor_horn', '{"treble":"eb-tenor-horn"}', false),
    ('french_horn', '{"treble":"horn-f"}', false),
    ('mellophone', '{"treble":"horn-f"}', false),
    ('wagner_tuba', '{"treble":"horn-f"}', false),
    ('bb_baritone_horn', '{"treble":"baritone-euphonium-treble","bass":"baritone-euphonium-bass","tenor":"baritone-euphonium-bass"}', false),
    ('bb_baritone_horn_4v', '{"treble":"baritone-euphonium-treble","bass":"baritone-euphonium-bass","tenor":"baritone-euphonium-bass"}', false),
    ('bb_euphonium', '{"treble":"baritone-euphonium-treble","bass":"baritone-euphonium-bass","tenor":"baritone-euphonium-bass"}', false),
    ('bb_euphonium_3v', '{"treble":"baritone-euphonium-treble","bass":"baritone-euphonium-bass","tenor":"baritone-euphonium-bass"}', false),
    ('alto_trombone', '{"treble":"trombone-treble-clef","bass":"trombone-bass-clef","tenor":"trombone-bass-clef"}', false),
    ('tenor_trombone', '{"treble":"trombone-treble-clef","bass":"trombone-bass-clef","tenor":"trombone-bass-clef"}', false),
    ('bass_trombone', '{"treble":"trombone-treble-clef","bass":"bass-trombone","tenor":"bass-trombone"}', false),
    ('contrabass_trombone', '{"treble":"trombone-treble-clef","bass":"bass-trombone","tenor":"bass-trombone"}', false),
    ('valve_trombone', '{"treble":"trombone-treble-clef","bass":"trombone-bass-clef","tenor":"trombone-bass-clef"}', false),
    ('eb_tuba', '{"treble":"tuba-treble","bass":"tuba-eb-bass-clef"}', false),
    ('eb_tuba_3v', '{"treble":"tuba-treble","bass":"tuba-eb-bass-clef"}', false),
    ('bb_tuba', '{"treble":"tuba-treble","bass":"tuba-bb-bass-clef"}', false),
    ('bb_tuba_3v', '{"treble":"tuba-treble","bass":"tuba-bb-bass-clef"}', false),
    ('c_tuba', '{"treble":"tuba-treble","bass":"tuba-c-bass-clef"}', false),
    ('f_tuba', '{"treble":"tuba-treble","bass":"tuba-f-bass-clef"}', false),
    ('sousaphone', '{"treble":"tuba-treble","bass":"tuba-bb-bass-clef"}', false),
    ('helicon', '{"treble":"tuba-treble","bass":"tuba-bb-bass-clef"}', false)
) AS v(code, lists, corrected)
WHERE i.code = v.code;
