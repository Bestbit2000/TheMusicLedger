// ML-357: the ABRSM grade scale lists (Grades 1-4, brass and woodwind) and the Scales tool's grade grid -
// which scales the chosen grades need for your instrument, and whether each is ready to play, fits in
// another octave, is outside your range (for now) or is beyond the instrument. The ready ones are the
// list Previous / Next / Shuffle go round. See docs/scales-grades.md.
//
// DATA is ABRSM's own syllabuses (checked 2026-09-29, see SOURCES): brass from 2023 (revised Jan 2026),
// woodwind from 2026 (scales unchanged from 2022). Each grade is a standalone list, not cumulative.
// Treble-clef brass and all woodwind lists are written pitch; bass-clef brass lists are concert pitch.
// Each entry is "kind|keyId|form|octaves|pattern|start":
//   kind     scale | arpeggio | chromatic (from the key's tonic) | dom7 (in the key)
//   form     major | natural | harmonic | melodic - where ABRSM lets the player choose a minor form
//            (Grades 1-2: natural, harmonic or melodic; 3-4: harmonic or melodic) each form is its own entry
//   octaves  1 | 1.5 ("a 12th") | 2;  pattern "toDominant" = one octave up, then down to the dominant below
//   start    "octaveUp" = from the tonic an octave above the lowest one
// Bassoon Grade 3 B flat major ("a 12th") is the one value not confirmed from the page layout - ML-358.
// Browser: window.ScaleGrades (needs TheoryEngine, loaded first). Node tests load it the same way.
(function (root, factory) {
    if (typeof module === 'object' && module.exports) module.exports = factory(root);
    else root.ScaleGrades = factory(root);
})(typeof self !== 'undefined' ? self : this, function (root) {
    'use strict';

    const SOURCES = [
        "https://www.abrsm.org/sites/default/files/2026-02/Brass%202023%20Practical%20syllabus%20%280%20ALL%29%2020260128%20%281%29.pdf",
        "https://www.abrsm.org/sites/default/files/2023-09/brass-2023-prac-syllabus-10feb23.pdf",
        "https://www.abrsm.org/sites/default/files/2025-06/ABRSM%20Woodwind%20Practical%20Grades%20Qualification%20Specification%20from%202026.pdf",
        "https://www.abrsm.org/sites/default/files/2023-10/Woodwind%202022%20Practical%20syllabus%20(3%20Flute)%2020230911.pdf"
    ];

    const DATA = {
        'horn-f': { name: "Horn", family: 'brass', clef: 'treble', grades: {
            1: ["scale|C major|major|1||octaveUp","scale|A minor|natural|1||octaveUp","scale|A minor|harmonic|1||octaveUp","scale|A minor|melodic|1||octaveUp","arpeggio|C major|major|1||octaveUp","arpeggio|A minor|harmonic|1||octaveUp"],
            2: ["scale|Bb major|major|1||octaveUp","scale|D major|major|1||octaveUp","scale|A minor|natural|1||octaveUp","scale|A minor|harmonic|1||octaveUp","scale|A minor|melodic|1||octaveUp","scale|D minor|natural|1||octaveUp","scale|D minor|harmonic|1||octaveUp","scale|D minor|melodic|1||octaveUp","arpeggio|Bb major|major|1||octaveUp","arpeggio|D major|major|1||octaveUp","arpeggio|A minor|harmonic|1||octaveUp","arpeggio|D minor|harmonic|1||octaveUp"],
            3: ["scale|Eb major|major|1||octaveUp","scale|G major|major|1.5||","scale|C minor|harmonic|1||octaveUp","scale|C minor|melodic|1||octaveUp","scale|G minor|harmonic|1.5||","scale|G minor|melodic|1.5||","arpeggio|Eb major|major|1||octaveUp","arpeggio|G major|major|1.5||","arpeggio|C minor|harmonic|1||octaveUp","arpeggio|G minor|harmonic|1.5||","chromatic|C major|major|1||"],
            4: ["scale|Bb major|major|1.5||","scale|Eb major|major|1|toDominant|","scale|E major|major|2||","scale|F major|major|2||","scale|A minor|harmonic|1.5||","scale|A minor|melodic|1.5||","scale|B minor|harmonic|1.5||","scale|B minor|melodic|1.5||","scale|F minor|harmonic|2||","scale|F minor|melodic|2||","arpeggio|Bb major|major|1.5||","arpeggio|Eb major|major|1|toDominant|","arpeggio|E major|major|2||","arpeggio|F major|major|2||","arpeggio|A minor|harmonic|1.5||","arpeggio|B minor|harmonic|1.5||","arpeggio|F minor|harmonic|2||","chromatic|G major|major|1||","dom7|F major|major|1||"]
        } },
        'trumpet-cornet-flugel': { name: "Trumpet, cornet and flugelhorn", family: 'brass', clef: 'treble', grades: {
            1: ["scale|C major|major|1||","scale|A minor|natural|1||","scale|A minor|harmonic|1||","scale|A minor|melodic|1||","arpeggio|C major|major|1||","arpeggio|A minor|harmonic|1||"],
            2: ["scale|Bb major|major|1||","scale|D major|major|1||","scale|A minor|natural|1||","scale|A minor|harmonic|1||","scale|A minor|melodic|1||","scale|D minor|natural|1||","scale|D minor|harmonic|1||","scale|D minor|melodic|1||","arpeggio|Bb major|major|1||","arpeggio|D major|major|1||","arpeggio|A minor|harmonic|1||","arpeggio|D minor|harmonic|1||"],
            3: ["scale|Eb major|major|1||","scale|E major|major|1||","scale|C minor|harmonic|1||","scale|C minor|melodic|1||","scale|E minor|harmonic|1||","scale|E minor|melodic|1||","arpeggio|Eb major|major|1||","arpeggio|E major|major|1||","arpeggio|C minor|harmonic|1||","arpeggio|E minor|harmonic|1||","chromatic|D major|major|1||"],
            4: ["scale|F major|major|1||","scale|Ab major|major|1.5||","scale|Bb major|major|1.5||","scale|Eb major|major|1|toDominant|","scale|F minor|harmonic|1||","scale|F minor|melodic|1||","scale|A minor|harmonic|1.5||","scale|A minor|melodic|1.5||","scale|B minor|harmonic|1.5||","scale|B minor|melodic|1.5||","arpeggio|F major|major|1||","arpeggio|Ab major|major|1.5||","arpeggio|Bb major|major|1.5||","arpeggio|Eb major|major|1|toDominant|","arpeggio|F minor|harmonic|1||","arpeggio|A minor|harmonic|1.5||","arpeggio|B minor|harmonic|1.5||","chromatic|Bb major|major|1||","dom7|Bb major|major|1||"]
        } },
        'eb-tenor-horn': { name: "E flat horn (tenor horn)", family: 'brass', clef: 'treble', grades: {
            1: ["scale|C major|major|1||","scale|A minor|natural|1||","scale|A minor|harmonic|1||","scale|A minor|melodic|1||","arpeggio|C major|major|1||","arpeggio|A minor|harmonic|1||"],
            2: ["scale|Bb major|major|1||","scale|D major|major|1||","scale|A minor|natural|1||","scale|A minor|harmonic|1||","scale|A minor|melodic|1||","scale|D minor|natural|1||","scale|D minor|harmonic|1||","scale|D minor|melodic|1||","arpeggio|Bb major|major|1||","arpeggio|D major|major|1||","arpeggio|A minor|harmonic|1||","arpeggio|D minor|harmonic|1||"],
            3: ["scale|Eb major|major|1||","scale|E major|major|1||","scale|C minor|harmonic|1||","scale|C minor|melodic|1||","scale|E minor|harmonic|1||","scale|E minor|melodic|1||","arpeggio|Eb major|major|1||","arpeggio|E major|major|1||","arpeggio|C minor|harmonic|1||","arpeggio|E minor|harmonic|1||","chromatic|D major|major|1||"],
            4: ["scale|F major|major|1||","scale|Ab major|major|1.5||","scale|Bb major|major|1.5||","scale|Eb major|major|1|toDominant|","scale|F minor|harmonic|1||","scale|F minor|melodic|1||","scale|A minor|harmonic|1.5||","scale|A minor|melodic|1.5||","scale|B minor|harmonic|1.5||","scale|B minor|melodic|1.5||","arpeggio|F major|major|1||","arpeggio|Ab major|major|1.5||","arpeggio|Bb major|major|1.5||","arpeggio|Eb major|major|1|toDominant|","arpeggio|F minor|harmonic|1||","arpeggio|A minor|harmonic|1.5||","arpeggio|B minor|harmonic|1.5||","chromatic|Bb major|major|1||","dom7|Bb major|major|1||"]
        } },
        'trombone-bass-clef': { name: "Trombone (tenor), bass clef", family: 'brass', clef: 'bass', grades: {
            1: ["scale|Bb major|major|1||","scale|G minor|natural|1||","scale|G minor|harmonic|1||","scale|G minor|melodic|1||","arpeggio|Bb major|major|1||","arpeggio|G minor|harmonic|1||"],
            2: ["scale|Ab major|major|1||","scale|C major|major|1||","scale|G minor|natural|1||","scale|G minor|harmonic|1||","scale|G minor|melodic|1||","scale|C minor|natural|1||","scale|C minor|harmonic|1||","scale|C minor|melodic|1||","arpeggio|Ab major|major|1||","arpeggio|C major|major|1||","arpeggio|G minor|harmonic|1||","arpeggio|C minor|harmonic|1||"],
            3: ["scale|Db major|major|1||","scale|D major|major|1||","scale|Bb minor|harmonic|1||","scale|Bb minor|melodic|1||","scale|D minor|harmonic|1||","scale|D minor|melodic|1||","arpeggio|Db major|major|1||","arpeggio|D major|major|1||","arpeggio|Bb minor|harmonic|1||","arpeggio|D minor|harmonic|1||","chromatic|C major|major|1||"],
            4: ["scale|F major|major|1||","scale|Db major|major|1||","scale|Ab major|major|1.5||","scale|Eb major|major|1|toDominant|","scale|Eb minor|harmonic|1||","scale|Eb minor|melodic|1||","scale|E minor|harmonic|1||octaveUp","scale|E minor|melodic|1||octaveUp","scale|G minor|harmonic|1.5||","scale|G minor|melodic|1.5||","arpeggio|F major|major|1||","arpeggio|Db major|major|1||","arpeggio|Ab major|major|1.5||","arpeggio|Eb major|major|1|toDominant|","arpeggio|Eb minor|harmonic|1||","arpeggio|E minor|harmonic|1||octaveUp","arpeggio|G minor|harmonic|1.5||","chromatic|D major|major|1||","dom7|Bb major|major|1||"]
        } },
        'trombone-treble-clef': { name: "Trombone (tenor), treble clef", family: 'brass', clef: 'treble', grades: {
            1: ["scale|C major|major|1||","scale|A minor|natural|1||","scale|A minor|harmonic|1||","scale|A minor|melodic|1||","arpeggio|C major|major|1||","arpeggio|A minor|harmonic|1||"],
            2: ["scale|Bb major|major|1||","scale|D major|major|1||","scale|A minor|natural|1||","scale|A minor|harmonic|1||","scale|A minor|melodic|1||","scale|D minor|natural|1||","scale|D minor|harmonic|1||","scale|D minor|melodic|1||","arpeggio|Bb major|major|1||","arpeggio|D major|major|1||","arpeggio|A minor|harmonic|1||","arpeggio|D minor|harmonic|1||"],
            3: ["scale|Eb major|major|1||","scale|E major|major|1||","scale|C minor|harmonic|1||","scale|C minor|melodic|1||","scale|E minor|harmonic|1||","scale|E minor|melodic|1||","arpeggio|Eb major|major|1||","arpeggio|E major|major|1||","arpeggio|C minor|harmonic|1||","arpeggio|E minor|harmonic|1||","chromatic|D major|major|1||"],
            4: ["scale|G major|major|1||","scale|Eb major|major|1||","scale|Bb major|major|1.5||","scale|F major|major|1|toDominant|","scale|F minor|harmonic|1||","scale|F minor|melodic|1||","scale|F# minor|harmonic|1||octaveUp","scale|F# minor|melodic|1||octaveUp","scale|A minor|harmonic|1.5||","scale|A minor|melodic|1.5||","arpeggio|G major|major|1||","arpeggio|Eb major|major|1||","arpeggio|Bb major|major|1.5||","arpeggio|F major|major|1|toDominant|","arpeggio|F minor|harmonic|1||","arpeggio|F# minor|harmonic|1||octaveUp","arpeggio|A minor|harmonic|1.5||","chromatic|E major|major|1||","dom7|C major|major|1||"]
        } },
        'baritone-euphonium-treble': { name: "Baritone and euphonium, treble clef", family: 'brass', clef: 'treble', grades: {
            1: ["scale|C major|major|1||","scale|A minor|natural|1||","scale|A minor|harmonic|1||","scale|A minor|melodic|1||","arpeggio|C major|major|1||","arpeggio|A minor|harmonic|1||"],
            2: ["scale|Bb major|major|1||","scale|D major|major|1||","scale|A minor|natural|1||","scale|A minor|harmonic|1||","scale|A minor|melodic|1||","scale|D minor|natural|1||","scale|D minor|harmonic|1||","scale|D minor|melodic|1||","arpeggio|Bb major|major|1||","arpeggio|D major|major|1||","arpeggio|A minor|harmonic|1||","arpeggio|D minor|harmonic|1||"],
            3: ["scale|Eb major|major|1||","scale|E major|major|1||","scale|C minor|harmonic|1||","scale|C minor|melodic|1||","scale|E minor|harmonic|1||","scale|E minor|melodic|1||","arpeggio|Eb major|major|1||","arpeggio|E major|major|1||","arpeggio|C minor|harmonic|1||","arpeggio|E minor|harmonic|1||","chromatic|D major|major|1||"],
            4: ["scale|F major|major|1||","scale|Ab major|major|1.5||","scale|Bb major|major|1.5||","scale|Eb major|major|1|toDominant|","scale|F minor|harmonic|1||","scale|F minor|melodic|1||","scale|A minor|harmonic|1.5||","scale|A minor|melodic|1.5||","scale|B minor|harmonic|1.5||","scale|B minor|melodic|1.5||","arpeggio|F major|major|1||","arpeggio|Ab major|major|1.5||","arpeggio|Bb major|major|1.5||","arpeggio|Eb major|major|1|toDominant|","arpeggio|F minor|harmonic|1||","arpeggio|A minor|harmonic|1.5||","arpeggio|B minor|harmonic|1.5||","chromatic|Bb major|major|1||","dom7|Bb major|major|1||"]
        } },
        'baritone-euphonium-bass': { name: "Baritone and euphonium, bass clef", family: 'brass', clef: 'bass', grades: {
            1: ["scale|Bb major|major|1||","scale|G minor|natural|1||","scale|G minor|harmonic|1||","scale|G minor|melodic|1||","arpeggio|Bb major|major|1||","arpeggio|G minor|harmonic|1||"],
            2: ["scale|Ab major|major|1||","scale|C major|major|1||","scale|G minor|natural|1||","scale|G minor|harmonic|1||","scale|G minor|melodic|1||","scale|C minor|natural|1||","scale|C minor|harmonic|1||","scale|C minor|melodic|1||","arpeggio|Ab major|major|1||","arpeggio|C major|major|1||","arpeggio|G minor|harmonic|1||","arpeggio|C minor|harmonic|1||"],
            3: ["scale|Db major|major|1||","scale|D major|major|1||","scale|Bb minor|harmonic|1||","scale|Bb minor|melodic|1||","scale|D minor|harmonic|1||","scale|D minor|melodic|1||","arpeggio|Db major|major|1||","arpeggio|D major|major|1||","arpeggio|Bb minor|harmonic|1||","arpeggio|D minor|harmonic|1||","chromatic|C major|major|1||"],
            4: ["scale|Eb major|major|1||","scale|F# major|major|1.5||","scale|Ab major|major|1.5||","scale|Db major|major|1|toDominant|","scale|Eb minor|harmonic|1||","scale|Eb minor|melodic|1||","scale|G minor|harmonic|1.5||","scale|G minor|melodic|1.5||","scale|A minor|harmonic|1.5||","scale|A minor|melodic|1.5||","arpeggio|Eb major|major|1||","arpeggio|F# major|major|1.5||","arpeggio|Ab major|major|1.5||","arpeggio|Db major|major|1|toDominant|","arpeggio|Eb minor|harmonic|1||","arpeggio|G minor|harmonic|1.5||","arpeggio|A minor|harmonic|1.5||","chromatic|Ab major|major|1||","dom7|Ab major|major|1||"]
        } },
        'tuba-treble': { name: "Tuba / brass band bass, treble clef", family: 'brass', clef: 'treble', grades: {
            1: ["scale|C major|major|1||","scale|A minor|natural|1||","scale|A minor|harmonic|1||","scale|A minor|melodic|1||","arpeggio|C major|major|1||","arpeggio|A minor|harmonic|1||"],
            2: ["scale|Bb major|major|1||","scale|D major|major|1||","scale|A minor|natural|1||","scale|A minor|harmonic|1||","scale|A minor|melodic|1||","scale|D minor|natural|1||","scale|D minor|harmonic|1||","scale|D minor|melodic|1||","arpeggio|Bb major|major|1||","arpeggio|D major|major|1||","arpeggio|A minor|harmonic|1||","arpeggio|D minor|harmonic|1||"],
            3: ["scale|Eb major|major|1||","scale|E major|major|1||","scale|C minor|harmonic|1||","scale|C minor|melodic|1||","scale|E minor|harmonic|1||","scale|E minor|melodic|1||","arpeggio|Eb major|major|1||","arpeggio|E major|major|1||","arpeggio|C minor|harmonic|1||","arpeggio|E minor|harmonic|1||","chromatic|D major|major|1||"],
            4: ["scale|F major|major|1||","scale|Ab major|major|1.5||","scale|Bb major|major|1.5||","scale|Eb major|major|1|toDominant|","scale|F minor|harmonic|1||","scale|F minor|melodic|1||","scale|A minor|harmonic|1.5||","scale|A minor|melodic|1.5||","scale|B minor|harmonic|1.5||","scale|B minor|melodic|1.5||","arpeggio|F major|major|1||","arpeggio|Ab major|major|1.5||","arpeggio|Bb major|major|1.5||","arpeggio|Eb major|major|1|toDominant|","arpeggio|F minor|harmonic|1||","arpeggio|A minor|harmonic|1.5||","arpeggio|B minor|harmonic|1.5||","chromatic|Bb major|major|1||","dom7|Bb major|major|1||"]
        } },
        'tuba-eb-bass-clef': { name: "E flat tuba, bass clef", family: 'brass', clef: 'bass', grades: {
            1: ["scale|Eb major|major|1||","scale|C minor|natural|1||","scale|C minor|harmonic|1||","scale|C minor|melodic|1||","arpeggio|Eb major|major|1||","arpeggio|C minor|harmonic|1||"],
            2: ["scale|Db major|major|1||","scale|F major|major|1||","scale|C minor|natural|1||","scale|C minor|harmonic|1||","scale|C minor|melodic|1||","scale|F minor|natural|1||","scale|F minor|harmonic|1||","scale|F minor|melodic|1||","arpeggio|Db major|major|1||","arpeggio|F major|major|1||","arpeggio|C minor|harmonic|1||","arpeggio|F minor|harmonic|1||"],
            3: ["scale|F# major|major|1||","scale|G major|major|1||","scale|Eb minor|harmonic|1||","scale|Eb minor|melodic|1||","scale|G minor|harmonic|1||","scale|G minor|melodic|1||","arpeggio|F# major|major|1||","arpeggio|G major|major|1||","arpeggio|Eb minor|harmonic|1||","arpeggio|G minor|harmonic|1||","chromatic|F major|major|1||"],
            4: ["scale|Ab major|major|1||","scale|B major|major|1.5||","scale|Db major|major|1.5||","scale|F# major|major|1|toDominant|","scale|G# minor|harmonic|1||","scale|G# minor|melodic|1||","scale|C minor|harmonic|1.5||","scale|C minor|melodic|1.5||","scale|D minor|harmonic|1.5||","scale|D minor|melodic|1.5||","arpeggio|Ab major|major|1||","arpeggio|B major|major|1.5||","arpeggio|Db major|major|1.5||","arpeggio|F# major|major|1|toDominant|","arpeggio|G# minor|harmonic|1||","arpeggio|C minor|harmonic|1.5||","arpeggio|D minor|harmonic|1.5||","chromatic|Db major|major|1||","dom7|Db major|major|1||"]
        } },
        'tuba-bb-bass-clef': { name: "B flat tuba, bass clef", family: 'brass', clef: 'bass', grades: {
            1: ["scale|Bb major|major|1||","scale|G minor|natural|1||","scale|G minor|harmonic|1||","scale|G minor|melodic|1||","arpeggio|Bb major|major|1||","arpeggio|G minor|harmonic|1||"],
            2: ["scale|Ab major|major|1||","scale|C major|major|1||","scale|G minor|natural|1||","scale|G minor|harmonic|1||","scale|G minor|melodic|1||","scale|C minor|natural|1||","scale|C minor|harmonic|1||","scale|C minor|melodic|1||","arpeggio|Ab major|major|1||","arpeggio|C major|major|1||","arpeggio|G minor|harmonic|1||","arpeggio|C minor|harmonic|1||"],
            3: ["scale|Db major|major|1||","scale|D major|major|1||","scale|Bb minor|harmonic|1||","scale|Bb minor|melodic|1||","scale|D minor|harmonic|1||","scale|D minor|melodic|1||","arpeggio|Db major|major|1||","arpeggio|D major|major|1||","arpeggio|Bb minor|harmonic|1||","arpeggio|D minor|harmonic|1||","chromatic|C major|major|1||"],
            4: ["scale|Eb major|major|1||","scale|F# major|major|1.5||","scale|Ab major|major|1.5||","scale|Db major|major|1|toDominant|","scale|Eb minor|harmonic|1||","scale|Eb minor|melodic|1||","scale|G minor|harmonic|1.5||","scale|G minor|melodic|1.5||","scale|A minor|harmonic|1.5||","scale|A minor|melodic|1.5||","arpeggio|Eb major|major|1||","arpeggio|F# major|major|1.5||","arpeggio|Ab major|major|1.5||","arpeggio|Db major|major|1|toDominant|","arpeggio|Eb minor|harmonic|1||","arpeggio|G minor|harmonic|1.5||","arpeggio|A minor|harmonic|1.5||","chromatic|Ab major|major|1||","dom7|Ab major|major|1||"]
        } },
        'tuba-c-bass-clef': { name: "C tuba, bass clef", family: 'brass', clef: 'bass', grades: {
            1: ["scale|C major|major|1||","scale|A minor|natural|1||","scale|A minor|harmonic|1||","scale|A minor|melodic|1||","arpeggio|C major|major|1||","arpeggio|A minor|harmonic|1||"],
            2: ["scale|Bb major|major|1||","scale|D major|major|1||","scale|A minor|natural|1||","scale|A minor|harmonic|1||","scale|A minor|melodic|1||","scale|D minor|natural|1||","scale|D minor|harmonic|1||","scale|D minor|melodic|1||","arpeggio|Bb major|major|1||","arpeggio|D major|major|1||","arpeggio|A minor|harmonic|1||","arpeggio|D minor|harmonic|1||"],
            3: ["scale|Eb major|major|1||","scale|E major|major|1||","scale|C minor|harmonic|1||","scale|C minor|melodic|1||","scale|E minor|harmonic|1||","scale|E minor|melodic|1||","arpeggio|Eb major|major|1||","arpeggio|E major|major|1||","arpeggio|C minor|harmonic|1||","arpeggio|E minor|harmonic|1||","chromatic|D major|major|1||"],
            4: ["scale|F major|major|1||","scale|Ab major|major|1.5||","scale|Bb major|major|1.5||","scale|Eb major|major|1|toDominant|","scale|F minor|harmonic|1||","scale|F minor|melodic|1||","scale|A minor|harmonic|1.5||","scale|A minor|melodic|1.5||","scale|B minor|harmonic|1.5||","scale|B minor|melodic|1.5||","arpeggio|F major|major|1||","arpeggio|Ab major|major|1.5||","arpeggio|Bb major|major|1.5||","arpeggio|Eb major|major|1|toDominant|","arpeggio|F minor|harmonic|1||","arpeggio|A minor|harmonic|1.5||","arpeggio|B minor|harmonic|1.5||","chromatic|Bb major|major|1||","dom7|Bb major|major|1||"]
        } },
        'tuba-f-bass-clef': { name: "F tuba, bass clef", family: 'brass', clef: 'bass', grades: {
            1: ["scale|F major|major|1||","scale|D minor|natural|1||","scale|D minor|harmonic|1||","scale|D minor|melodic|1||","arpeggio|F major|major|1||","arpeggio|D minor|harmonic|1||"],
            2: ["scale|Eb major|major|1||","scale|G major|major|1||","scale|D minor|natural|1||","scale|D minor|harmonic|1||","scale|D minor|melodic|1||","scale|G minor|natural|1||","scale|G minor|harmonic|1||","scale|G minor|melodic|1||","arpeggio|Eb major|major|1||","arpeggio|G major|major|1||","arpeggio|D minor|harmonic|1||","arpeggio|G minor|harmonic|1||"],
            3: ["scale|Ab major|major|1||","scale|A major|major|1||","scale|F minor|harmonic|1||","scale|F minor|melodic|1||","scale|A minor|harmonic|1||","scale|A minor|melodic|1||","arpeggio|Ab major|major|1||","arpeggio|A major|major|1||","arpeggio|F minor|harmonic|1||","arpeggio|A minor|harmonic|1||","chromatic|G major|major|1||"],
            4: ["scale|Bb major|major|1||","scale|Db major|major|1.5||","scale|Eb major|major|1.5||","scale|Ab major|major|1|toDominant|","scale|Bb minor|harmonic|1||","scale|Bb minor|melodic|1||","scale|D minor|harmonic|1.5||","scale|D minor|melodic|1.5||","scale|E minor|harmonic|1.5||","scale|E minor|melodic|1.5||","arpeggio|Bb major|major|1||","arpeggio|Db major|major|1.5||","arpeggio|Eb major|major|1.5||","arpeggio|Ab major|major|1|toDominant|","arpeggio|Bb minor|harmonic|1||","arpeggio|D minor|harmonic|1.5||","arpeggio|E minor|harmonic|1.5||","chromatic|Eb major|major|1||","dom7|Eb major|major|1||"]
        } },
        'flute': { name: "Flute", family: 'woodwind', clef: 'treble', grades: {
            1: ["scale|F major|major|1||","scale|G major|major|1||","scale|E minor|natural|1||","scale|E minor|harmonic|1||","scale|E minor|melodic|1||","arpeggio|F major|major|1||","arpeggio|G major|major|1||","arpeggio|E minor|harmonic|1||"],
            2: ["scale|C major|major|1||octaveUp","scale|F major|major|1.5||","scale|G major|major|1.5||","scale|A minor|natural|1||","scale|A minor|harmonic|1||","scale|A minor|melodic|1||","scale|E minor|natural|1.5||","scale|E minor|harmonic|1.5||","scale|E minor|melodic|1.5||","arpeggio|C major|major|1||octaveUp","arpeggio|F major|major|1.5||","arpeggio|G major|major|1.5||","arpeggio|A minor|harmonic|1||","arpeggio|E minor|harmonic|1.5||"],
            3: ["scale|G major|major|1.5||","scale|Bb major|major|1.5||","scale|D major|major|2||","scale|F major|major|2||","scale|E minor|harmonic|1.5||","scale|E minor|melodic|1.5||","scale|G minor|harmonic|1.5||","scale|G minor|melodic|1.5||","scale|D minor|harmonic|2||","scale|D minor|melodic|2||","arpeggio|G major|major|1.5||","arpeggio|Bb major|major|1.5||","arpeggio|D major|major|2||","arpeggio|F major|major|2||","arpeggio|E minor|harmonic|1.5||","arpeggio|G minor|harmonic|1.5||","arpeggio|D minor|harmonic|2||","chromatic|G major|major|1||"],
            4: ["scale|A major|major|1.5||","scale|Bb major|major|1.5||","scale|C major|major|2||","scale|Eb major|major|2||","scale|G major|major|2||","scale|A minor|harmonic|1.5||","scale|A minor|melodic|1.5||","scale|B minor|harmonic|1.5||","scale|B minor|melodic|1.5||","scale|C minor|harmonic|2||","scale|C minor|melodic|2||","scale|G minor|harmonic|2||","scale|G minor|melodic|2||","arpeggio|A major|major|1.5||","arpeggio|Bb major|major|1.5||","arpeggio|C major|major|2||","arpeggio|Eb major|major|2||","arpeggio|G major|major|2||","arpeggio|A minor|harmonic|1.5||","arpeggio|B minor|harmonic|1.5||","arpeggio|C minor|harmonic|2||","arpeggio|G minor|harmonic|2||","chromatic|D major|major|2||","dom7|G major|major|2||"]
        } },
        'oboe': { name: "Oboe", family: 'woodwind', clef: 'treble', grades: {
            1: ["scale|F major|major|1||","scale|G major|major|1||","scale|D minor|natural|1||","scale|D minor|harmonic|1||","scale|D minor|melodic|1||","arpeggio|F major|major|1||","arpeggio|G major|major|1||","arpeggio|D minor|harmonic|1||"],
            2: ["scale|C major|major|1||octaveUp","scale|D major|major|1.5||","scale|F major|major|1.5||","scale|A minor|natural|1||","scale|A minor|harmonic|1||","scale|A minor|melodic|1||","scale|D minor|natural|1.5||","scale|D minor|harmonic|1.5||","scale|D minor|melodic|1.5||","arpeggio|C major|major|1||octaveUp","arpeggio|D major|major|1.5||","arpeggio|F major|major|1.5||","arpeggio|A minor|harmonic|1||","arpeggio|D minor|harmonic|1.5||"],
            3: ["scale|Bb major|major|1||octaveUp","scale|D major|major|1.5||","scale|G major|major|1.5||","scale|C major|major|2||","scale|B minor|harmonic|1||octaveUp","scale|B minor|melodic|1||octaveUp","scale|E minor|harmonic|1.5||","scale|E minor|melodic|1.5||","scale|G minor|harmonic|1.5||","scale|G minor|melodic|1.5||","arpeggio|Bb major|major|1||octaveUp","arpeggio|D major|major|1.5||","arpeggio|G major|major|1.5||","arpeggio|C major|major|2||","arpeggio|B minor|harmonic|1||octaveUp","arpeggio|E minor|harmonic|1.5||","arpeggio|G minor|harmonic|1.5||","chromatic|G major|major|1||"],
            4: ["scale|A major|major|1||","scale|E major|major|1.5||","scale|G major|major|1.5||","scale|D major|major|2||","scale|Eb major|major|2||","scale|F# minor|harmonic|1||","scale|F# minor|melodic|1||","scale|E minor|harmonic|1.5||","scale|E minor|melodic|1.5||","scale|F minor|harmonic|1.5||","scale|F minor|melodic|1.5||","scale|C minor|harmonic|2||","scale|C minor|melodic|2||","arpeggio|A major|major|1||","arpeggio|E major|major|1.5||","arpeggio|G major|major|1.5||","arpeggio|D major|major|2||","arpeggio|Eb major|major|2||","arpeggio|F# minor|harmonic|1||","arpeggio|E minor|harmonic|1.5||","arpeggio|F minor|harmonic|1.5||","arpeggio|C minor|harmonic|2||","chromatic|G major|major|1.5||","dom7|F major|major|2||"]
        } },
        'clarinet': { name: "Clarinet", family: 'woodwind', clef: 'treble', grades: {
            1: ["scale|F major|major|1||","scale|G major|major|1||","scale|A minor|natural|1||","scale|A minor|harmonic|1||","scale|A minor|melodic|1||","arpeggio|F major|major|1||","arpeggio|G major|major|1||","arpeggio|A minor|harmonic|1||"],
            2: ["scale|Bb major|major|1||","scale|F major|major|1.5||","scale|C major|major|1.5||","scale|D minor|natural|1||","scale|D minor|harmonic|1||","scale|D minor|melodic|1||","scale|A minor|natural|1.5||","scale|A minor|harmonic|1.5||","scale|A minor|melodic|1.5||","arpeggio|Bb major|major|1||","arpeggio|F major|major|1.5||","arpeggio|C major|major|1.5||","arpeggio|D minor|harmonic|1||","arpeggio|A minor|harmonic|1.5||"],
            3: ["scale|A major|major|1.5||","scale|D major|major|1.5||","scale|G major|major|2||","scale|Bb major|major|2||","scale|B minor|harmonic|1.5||","scale|B minor|melodic|1.5||","scale|D minor|harmonic|1.5||","scale|D minor|melodic|1.5||","scale|G minor|harmonic|2||","scale|G minor|melodic|2||","arpeggio|A major|major|1.5||","arpeggio|D major|major|1.5||","arpeggio|G major|major|2||","arpeggio|Bb major|major|2||","arpeggio|B minor|harmonic|1.5||","arpeggio|D minor|harmonic|1.5||","arpeggio|G minor|harmonic|2||","chromatic|G major|major|1||"],
            4: ["scale|Eb major|major|1.5||","scale|F major|major|2||","scale|A major|major|2||","scale|C major|major|2||","scale|D major|major|2||","scale|C minor|harmonic|1.5||","scale|C minor|melodic|1.5||","scale|A minor|harmonic|2||","scale|A minor|melodic|2||","scale|B minor|harmonic|2||","scale|B minor|melodic|2||","scale|D minor|harmonic|2||","scale|D minor|melodic|2||","arpeggio|Eb major|major|1.5||","arpeggio|F major|major|2||","arpeggio|A major|major|2||","arpeggio|C major|major|2||","arpeggio|D major|major|2||","arpeggio|C minor|harmonic|1.5||","arpeggio|A minor|harmonic|2||","arpeggio|B minor|harmonic|2||","arpeggio|D minor|harmonic|2||","chromatic|F major|major|2||","dom7|C major|major|2||"]
        } },
        'bassoon': { name: "Bassoon", family: 'woodwind', clef: 'bass', grades: {
            1: ["scale|F major|major|1||","scale|G major|major|1||","scale|E minor|natural|1||","scale|E minor|harmonic|1||","scale|E minor|melodic|1||","arpeggio|F major|major|1||","arpeggio|G major|major|1||","arpeggio|E minor|harmonic|1||"],
            2: ["scale|C major|major|1||octaveUp","scale|D major|major|1.5||","scale|F major|major|1.5||","scale|A minor|natural|1||","scale|A minor|harmonic|1||","scale|A minor|melodic|1||","scale|D minor|natural|1.5||","scale|D minor|harmonic|1.5||","scale|D minor|melodic|1.5||","arpeggio|C major|major|1||octaveUp","arpeggio|D major|major|1.5||","arpeggio|F major|major|1.5||","arpeggio|A minor|harmonic|1||","arpeggio|D minor|harmonic|1.5||"],
            3: ["scale|G major|major|1.5||","scale|A major|major|1.5||","scale|Bb major|major|1.5||octaveUp","scale|C major|major|2||","scale|E minor|harmonic|1.5||","scale|E minor|melodic|1.5||","scale|A minor|harmonic|1.5||","scale|A minor|melodic|1.5||","scale|D minor|harmonic|2||","scale|D minor|melodic|2||","arpeggio|G major|major|1.5||","arpeggio|A major|major|1.5||","arpeggio|Bb major|major|1.5||octaveUp","arpeggio|C major|major|2||","arpeggio|E minor|harmonic|1.5||","arpeggio|A minor|harmonic|1.5||","arpeggio|D minor|harmonic|2||","chromatic|G major|major|1||"],
            4: ["scale|Bb major|major|2||","scale|D major|major|2||","scale|Eb major|major|2||","scale|E major|major|2||","scale|F major|major|2||","scale|B minor|harmonic|2||","scale|B minor|melodic|2||","scale|C minor|harmonic|2||","scale|C minor|melodic|2||","scale|E minor|harmonic|2||","scale|E minor|melodic|2||","scale|G minor|harmonic|2||","scale|G minor|melodic|2||","arpeggio|Bb major|major|2||","arpeggio|D major|major|2||","arpeggio|Eb major|major|2||","arpeggio|E major|major|2||","arpeggio|F major|major|2||","arpeggio|B minor|harmonic|2||","arpeggio|C minor|harmonic|2||","arpeggio|E minor|harmonic|2||","arpeggio|G minor|harmonic|2||","chromatic|F major|major|2||","dom7|C major|major|2||"]
        } },
        'saxophone': { name: "Saxophone", family: 'woodwind', clef: 'treble', grades: {
            1: ["scale|F major|major|1||","scale|G major|major|1||","scale|D minor|natural|1||","scale|D minor|harmonic|1||","scale|D minor|melodic|1||","arpeggio|F major|major|1||","arpeggio|G major|major|1||","arpeggio|D minor|harmonic|1||"],
            2: ["scale|C major|major|1||octaveUp","scale|D major|major|1.5||","scale|F major|major|1.5||","scale|A minor|natural|1||","scale|A minor|harmonic|1||","scale|A minor|melodic|1||","scale|D minor|natural|1.5||","scale|D minor|harmonic|1.5||","scale|D minor|melodic|1.5||","arpeggio|C major|major|1||octaveUp","arpeggio|D major|major|1.5||","arpeggio|F major|major|1.5||","arpeggio|A minor|harmonic|1||","arpeggio|D minor|harmonic|1.5||"],
            3: ["scale|Bb major|major|1||octaveUp","scale|G major|major|1.5||","scale|C major|major|2||","scale|D major|major|2||","scale|B minor|harmonic|1||octaveUp","scale|B minor|melodic|1||octaveUp","scale|G minor|harmonic|1.5||","scale|G minor|melodic|1.5||","scale|D minor|harmonic|2||","scale|D minor|melodic|2||","arpeggio|Bb major|major|1||octaveUp","arpeggio|G major|major|1.5||","arpeggio|C major|major|2||","arpeggio|D major|major|2||","arpeggio|B minor|harmonic|1||octaveUp","arpeggio|G minor|harmonic|1.5||","arpeggio|D minor|harmonic|2||","chromatic|G major|major|1||"],
            4: ["scale|A major|major|1||","scale|E major|major|1.5||","scale|G major|major|1.5||","scale|D major|major|2||","scale|Eb major|major|2||","scale|F# minor|harmonic|1||","scale|F# minor|melodic|1||","scale|E minor|harmonic|1.5||","scale|E minor|melodic|1.5||","scale|F minor|harmonic|1.5||","scale|F minor|melodic|1.5||","scale|C minor|harmonic|2||","scale|C minor|melodic|2||","arpeggio|A major|major|1||","arpeggio|E major|major|1.5||","arpeggio|G major|major|1.5||","arpeggio|D major|major|2||","arpeggio|Eb major|major|2||","arpeggio|F# minor|harmonic|1||","arpeggio|E minor|harmonic|1.5||","arpeggio|F minor|harmonic|1.5||","arpeggio|C minor|harmonic|2||","chromatic|G major|major|1.5||","dom7|F major|major|2||"]
        } }
    };

    // Which ABRSM list an instrument (by its name in the instruments catalogue) uses, by the clef it's
    // read in. Checked top to bottom - trumpets before piccolo, horns before tubas (Wagner tuba).
    const RULES = [
        [/cornet|trumpet|flugel/i, { treble: 'trumpet-cornet-flugel' }],
        [/tenor horn|alto horn/i, { treble: 'eb-tenor-horn' }],
        [/french horn|mellophone|wagner/i, { treble: 'horn-f' }],
        [/trombone/i, { treble: 'trombone-treble-clef', bass: 'trombone-bass-clef', tenor: 'trombone-bass-clef' }],
        [/baritone horn|euphonium/i, { treble: 'baritone-euphonium-treble', bass: 'baritone-euphonium-bass', tenor: 'baritone-euphonium-bass' }],
        [/e♭ tuba|eb tuba|ee♭/i, { treble: 'tuba-treble', bass: 'tuba-eb-bass-clef' }],
        [/b♭ tuba|bb tuba|bb♭|sousaphone|helicon/i, { treble: 'tuba-treble', bass: 'tuba-bb-bass-clef' }],
        [/\bc tuba/i, { treble: 'tuba-treble', bass: 'tuba-c-bass-clef' }],
        [/\bf tuba/i, { treble: 'tuba-treble', bass: 'tuba-f-bass-clef' }],
        [/flute|piccolo(?! (trumpet|clarinet))/i, { any: 'flute' }],
        [/oboe|english horn|cor anglais|heckelphone/i, { any: 'oboe' }],
        [/clarinet|basset/i, { any: 'clarinet' }],
        [/bassoon/i, { any: 'bassoon' }],
        [/saxophone/i, { any: 'saxophone' }],
    ];
    // The ABRSM list for an instrument read in a clef, or null (no list - strings, keyboards, percussion).
    function groupFor(instrumentName, clef) {
        const rule = RULES.find(([re]) => re.test(String(instrumentName || '')));
        if (!rule) return null;
        const id = rule[1].any || rule[1][clef] || null;
        return id ? { id, name: DATA[id].name, clef: DATA[id].clef } : null;
    }

    // The 15 columns, in chromatic order: every major key, and every minor key (enharmonic pairs both kept).
    const MAJOR_COLUMNS = ['C', 'C#', 'Db', 'D', 'Eb', 'E', 'F', 'F#', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B', 'Cb'];
    const MINOR_COLUMNS = ['C', 'C#', 'D', 'D#', 'Eb', 'E', 'F', 'F#', 'G', 'G#', 'Ab', 'A', 'A#', 'Bb', 'B'];

    // The grade lists' entries for the ticked grades, each once, with the grades that ask for it.
    function requirements(groupId, grades) {
        const g = DATA[groupId];
        if (!g) return [];
        const byId = new Map();
        for (const grade of [...grades].sort()) {
            for (const entry of g.grades[grade] || []) {
                const [kind, keyId, form, octaves, pattern, start] = entry.split('|');
                const id = [kind, keyId, form, octaves, pattern].join('|');
                if (!byId.has(id)) byId.set(id, { id, kind, keyId, form, octaves: Number(octaves), pattern: pattern || null, octaveUp: start === 'octaveUp', grades: [] });
                byId.get(id).grades.push(Number(grade));
            }
        }
        return [...byId.values()];
    }

    // The grid's rows: one per kind of scale and length, only where the ticked grades need one.
    const ROW_ORDER = [
        ['major', 'scale', 'major', 'Scales'], ['major', 'arpeggio', 'major', 'Arpeggios'], ['major', 'chromatic', 'major', 'Chromatic'], ['major', 'dom7', 'major', 'Dominant 7ths'],
        ['minor', 'scale', 'natural', 'Natural minor'], ['minor', 'scale', 'harmonic', 'Harmonic minor'], ['minor', 'scale', 'melodic', 'Melodic minor'],
        ['minor', 'arpeggio', 'harmonic', 'Arpeggios'], ['minor', 'dom7', 'harmonic', 'Dominant 7ths'],
    ];
    const LENGTHS = [[1, null, '1 octave'], [1, 'toDominant', '1 octave, down to the dominant'], [1.5, null, 'a 12th'], [2, null, '2 octaves'], [3, null, '3 octaves']];
    const lengthLabel = (octaves, pattern) => (LENGTHS.find(([o, p]) => o === Number(octaves) && p === (pattern || null)) || [0, 0, octaves + ' octaves'])[2];

    // ---- is it playable? ----
    const SEMI = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
    const ALTER = { bb: -2, b: -1, '': 0, n: 0, '#': 1, x: 2 };
    function midiOf(pitch) {
        const m = /^([A-G])(bb|b|n|#|x)?(-?\d+)$/.exec(String(pitch));
        return m ? (Number(m[3]) + 1) * 12 + SEMI[m[1]] + ALTER[m[2] || ''] : null;
    }
    // ctx: { clef, low, high } the instrument's outer limits and { bottom, top } your comfortable range, as
    // MIDI numbers in the pitch the list is written in (either pair may be null - not known).
    // The usual placement is where the Scales tool writes it anyway - the bottom tonic on or just under the
    // stave (an octave higher where the list says so) - moved to the nearest octave the instrument can
    // play if it can't play that one. (Not "the lowest the instrument can go": the catalogue's outer
    // limits include pedal notes, which would put every low-brass scale in the pedals.)
    // Returns { state, tonicOctave }:
    //   ready - the usual placement is inside your range (or your range isn't set);
    //   other - it isn't, but another octave is;  locked - needed, but nothing fits your range yet;
    //   beyond - the instrument can't play it at all.
    function placement(item, ctx) {
        const T = root.TheoryEngine;
        const build = (o) => T.buildScale({ keyId: item.keyId, form: item.form, type: item.kind, octaves: item.octaves, pattern: item.pattern, direction: 'both', clef: ctx.clef, tonicOctave: o });
        const spans = [];
        for (let o = 0; o <= 8; o++) {
            const ms = build(o).pitches.map(midiOf);
            spans.push({ o, lo: Math.min(...ms), hi: Math.max(...ms) });
        }
        const inside = (s, lo, hi) => (lo == null || s.lo >= lo) && (hi == null || s.hi <= hi);
        const known = ctx.low != null && ctx.high != null;
        const possible = known ? spans.filter(s => inside(s, ctx.low, ctx.high)) : spans;
        if (!possible.length) return { state: 'beyond', tonicOctave: null };
        const nearest = (list, o) => list.slice().sort((a, b) => Math.abs(a.o - o) - Math.abs(b.o - o) || a.o - b.o)[0];
        const standard = build(null).tonicOctave + (item.octaveUp ? 1 : 0);
        const usual = nearest(possible, standard);
        if (ctx.bottom == null || ctx.top == null || inside(usual, ctx.bottom, ctx.top)) return { state: 'ready', tonicOctave: usual.o };
        const mine = possible.filter(s => inside(s, ctx.bottom, ctx.top));
        if (mine.length) return { state: 'other', tonicOctave: nearest(mine, usual.o).o };
        return { state: 'locked', tonicOctave: null };
    }

    // The whole grid for a list and the ticked grades: the major-key and minor-key sections, each a set
    // of rows of 15 cells, and the list to play from (ready and other-octave cells, in grid order).
    // "Not needed" wins over everything - a scale the grades don't ask for is never checked at all.
    function grid(groupId, grades, ctx) {
        const items = requirements(groupId, grades);
        const sections = { major: [], minor: [] };
        const pool = [];
        for (const [section, kind, form, label] of ROW_ORDER) {
            for (const [octaves, pattern] of LENGTHS) {
                const here = items.filter(i => i.kind === kind && i.form === form && i.octaves === octaves && (i.pattern || null) === pattern && i.keyId.endsWith(' ' + section));
                if (!here.length) continue;
                const columns = section === 'major' ? MAJOR_COLUMNS : MINOR_COLUMNS;
                const cells = columns.map(tonic => {
                    const item = here.find(i => i.keyId === tonic + ' ' + section);
                    if (!item) return { tonic, state: 'no' };
                    const p = placement(item, ctx);
                    return { tonic, state: p.state, tonicOctave: p.tonicOctave, item };
                });
                cells.filter(c => c.state === 'ready' || c.state === 'other').forEach(c => pool.push({
                    keyId: c.item.keyId, form: c.item.form, type: c.item.kind, octaves: c.item.octaves, pattern: c.item.pattern, tonicOctave: c.tonicOctave, grades: c.item.grades,
                }));
                sections[section].push({ kind, form, label, sub: lengthLabel(octaves, pattern), cells });
            }
        }
        return { sections, pool, needed: items.length };
    }

    return { SOURCES, DATA, RULES, MAJOR_COLUMNS, MINOR_COLUMNS, groupFor, requirements, grid, placement, midiOf, lengthLabel };
});
