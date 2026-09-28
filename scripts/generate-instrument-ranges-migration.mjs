// ML-322: writes each instrument's transposition (semitones) and typical written range from
// band_instruments_master_catalog.json into a migration, the same way generate-instruments-migration.mjs
// writes the catalogue itself. Only the UPDATEs are generated; the schema around them is in the
// migration's own header, written by hand (see 065_range.sql). Re-run with a new migration name when
// the ranges in the catalogue change.
// Usage: node scripts/generate-instrument-ranges-migration.mjs <catalogue.json> > rows.sql
import fs from 'node:fs';

const [src] = process.argv.slice(2);
if (!src) throw new Error('Usage: generate-instrument-ranges-migration.mjs <catalogue.json>');
const catalogue = JSON.parse(fs.readFileSync(src, 'utf8'));
const q = v => v === null || v === undefined ? 'NULL' : `'${String(v).replace(/'/g, "''")}'`;
const pitch = /^[A-G](#|b)?-?\d$/;

const lines = catalogue.instruments.map(i => {
    const r = i.written_range;
    if (r && !(pitch.test(r[0]) && pitch.test(r[1]))) throw new Error(`Bad range for ${i.id}: ${r}`);
    const n = i.written_to_concert_semitones;
    return `UPDATE instruments SET written_to_concert = ${n === null || n === undefined ? 'NULL' : Number(n)}, range_low = ${q(r && r[0])}, range_high = ${q(r && r[1])} WHERE code = ${q(i.id)};`;
});
process.stdout.write(lines.join('\n') + '\n');
