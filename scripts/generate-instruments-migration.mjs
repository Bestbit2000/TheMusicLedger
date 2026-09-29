// ML-309: writes the instrument catalogue (band_instruments_master_catalog.json) into a migration, so
// the same meta rows reach dev, sandbox and production through `npm run migrate` like any other
// schema change. Re-run with a new migration file name when the catalogue changes - the INSERT is an
// upsert on `code`, so an existing instrument keeps its id (and every account/session pointing at it).
// Usage: node scripts/generate-instruments-migration.mjs <catalogue.json> <db/migrations/NNN_name.sql>
import fs from 'node:fs';

const [src, out] = process.argv.slice(2);
if (!src || !out) throw new Error('Usage: generate-instruments-migration.mjs <catalogue.json> <migration.sql>');
const catalogue = JSON.parse(fs.readFileSync(src, 'utf8'));

const q = v => v === null || v === undefined ? 'NULL' : `'${String(v).replace(/'/g, "''")}'`;
const arr = list => `ARRAY[${list.map(q).join(', ')}]::text[]`;

// The clef the Theory tool starts on for this instrument. Where the catalogue lists a brass band clef
// (treble, transposing) that wins - brass band players read treble even on bass-register instruments.
// Otherwise the first clef named. A player can still pick any clef on the quiz.
function theoryClef(clef) {
    if (/Treble[^/]*Brass Band/i.test(clef)) return 'treble';
    if (/grand staff/i.test(clef)) return 'grand';
    if (/neutral|percussion/i.test(clef)) return 'none';
    const first = clef.split('/')[0].toLowerCase();
    for (const c of ['treble', 'bass', 'alto', 'tenor']) if (first.includes(c)) return c;
    return 'treble';
}

const rows = catalogue.instruments.map((i, n) => `    (${[
    q(i.id), q(i.name), q(i.key), q(i.sounding_transposition), q(i.clef), q(theoryClef(i.clef)),
    q(i.family), q(i.subfamily), arr(i.ensembles || []), q(i.role), q(i.frequency), q(i.notes), (n + 1) * 10
].join(', ')})`);

const sql = `-- ML-309: the instrument catalogue - a meta table every account picks its instruments from (My account
-- -> My instruments), so practice time can be measured per instrument (usage stats now; comparing
-- with other players later). Generated from band_instruments_master_catalog.json by
-- scripts/generate-instruments-migration.mjs - edit the catalogue and generate a new migration rather
-- than hand-editing rows here. Upsert on code: ids never change once an account or session uses one.
--
-- theory_clef is the clef the Theory tool starts on for that instrument (brass band treble wins where
-- the catalogue lists one); 'grand' = keyboard, 'none' = unpitched percussion.
CREATE TABLE IF NOT EXISTS instruments (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    pitch_key TEXT,
    sounding_transposition TEXT,
    clef TEXT,
    theory_clef TEXT NOT NULL DEFAULT 'treble' CHECK (theory_clef IN ('treble', 'bass', 'alto', 'tenor', 'grand', 'none')),
    family TEXT NOT NULL,
    subfamily TEXT,
    ensembles TEXT[] NOT NULL DEFAULT '{}',
    role TEXT,
    frequency TEXT,
    notes TEXT,
    sort_order INT NOT NULL DEFAULT 0,
    active BOOLEAN NOT NULL DEFAULT true
);

INSERT INTO instruments (code, name, pitch_key, sounding_transposition, clef, theory_clef, family, subfamily, ensembles, role, frequency, notes, sort_order) VALUES
${rows.join(',\n')}
ON CONFLICT (code) DO UPDATE SET
    name = EXCLUDED.name, pitch_key = EXCLUDED.pitch_key, sounding_transposition = EXCLUDED.sounding_transposition,
    clef = EXCLUDED.clef, theory_clef = EXCLUDED.theory_clef, family = EXCLUDED.family, subfamily = EXCLUDED.subfamily,
    ensembles = EXCLUDED.ensembles, role = EXCLUDED.role, frequency = EXCLUDED.frequency, notes = EXCLUDED.notes,
    sort_order = EXCLUDED.sort_order;

-- The instruments an account plays; at most one is its main instrument (the default for new sessions
-- and for the Theory tool).
CREATE TABLE IF NOT EXISTS account_instruments (
    account_id BIGINT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    instrument_id BIGINT NOT NULL REFERENCES instruments(id),
    is_primary BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (account_id, instrument_id)
);
CREATE UNIQUE INDEX IF NOT EXISTS account_instruments_one_primary ON account_instruments (account_id) WHERE is_primary;

-- Which instrument a practice session was on. Null for sessions logged before this, or by an account
-- with no instruments set. Set server-side (POST /api/sessions) to the chosen or main instrument.
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS instrument_id BIGINT REFERENCES instruments(id);
CREATE INDEX IF NOT EXISTS sessions_instrument_id ON sessions (instrument_id) WHERE instrument_id IS NOT NULL;
`;
fs.writeFileSync(out, sql);
console.log(`wrote ${out}: ${rows.length} instruments`);
