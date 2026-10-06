#!/usr/bin/env node
// Band directory lists -> a migration (see .claude/skills/band-directory and docs/band-directory.md).
//
//   node scripts/band-seed-migration.mjs db/band-lists/<list>.json                  checks the list, writes the next db/migrations/NNN_bands_<slug>.sql
//   node --env-file=.env scripts/band-seed-migration.mjs <list>.json --dry-run      also runs it on the dev branch inside a transaction, prints what it would do, and rolls back
//
// The list is a checked research list (db/band-lists/*.json): every band was found on a real web page.
// The migration adds bands that aren't in the directory and updates the ones that are - the same
// matching as migration 073: the same name (any case), one of its old_names, or - for a band with no
// parent - the same website domain (except shared council pages). A parent is looked up in the list
// first, then in the directory by name. Nothing is ever deleted or archived here.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TYPES = ['Brass Band', 'Concert Band', 'Wind Band', 'Youth Brass Band', 'Youth Wind Band', 'Training Band', 'Brass Ensemble', 'Massed Band'];
const SECTIONS = ['Championship', 'First', 'Second', 'Third', 'Fourth', 'Non-contesting'];
// Pages several bands share (a county music service's ensemble pages) - never a reason to merge two bands.
const SHARED_HOSTS = ['surreycc.gov.uk', 'hants.gov.uk', 'hantsmusichub.org.uk', 'facebook.com', 'wordpress.com'];

const args = process.argv.slice(2);
const listPath = args.find(a => !a.startsWith('--'));
const dryRun = args.includes('--dry-run');
if (!listPath) { console.error('Usage: node scripts/band-seed-migration.mjs <db/band-lists/list.json> [--dry-run]'); process.exit(1); }
const list = JSON.parse(fs.readFileSync(path.resolve(ROOT, listPath), 'utf8'));
const bands = Array.isArray(list) ? list : list.bands;

// ---- check the list ----
const problems = [];
const names = new Set();
for (const [i, b] of bands.entries()) {
  const at = `#${i + 1} ${b.name || '(no name)'}`;
  if (!b.name || typeof b.name !== 'string') problems.push(`${at}: no name`);
  if (names.has((b.name || '').toLowerCase())) problems.push(`${at}: listed twice`);
  names.add((b.name || '').toLowerCase());
  if (!TYPES.includes(b.ensemble_type)) problems.push(`${at}: ensemble_type "${b.ensemble_type}" isn't one of ${TYPES.join(', ')}`);
  if (b.section_level != null && !SECTIONS.includes(b.section_level)) problems.push(`${at}: section_level "${b.section_level}" isn't one of ${SECTIONS.join(', ')}`);
  if (b.section_level && !/Brass/.test(b.ensemble_type)) problems.push(`${at}: only brass bands have a section`);
  if (!b.website || !/^https?:\/\//.test(b.website)) problems.push(`${at}: needs a website (http/https) - it's how duplicates are found`);
  if (b.rehearsal_postcode && !/^[A-Z]{1,2}\d[A-Z\d]? ?\d[A-Z]{2}$/i.test(b.rehearsal_postcode)) problems.push(`${at}: "${b.rehearsal_postcode}" isn't a UK postcode`);
  if (/@/.test(JSON.stringify(b))) problems.push(`${at}: contains an email address - leave contact details out`);
  if (b.old_names && !Array.isArray(b.old_names)) problems.push(`${at}: old_names must be a list`);
}
for (const b of bands) {
  if (b.parent_name && b.parent_name.toLowerCase() === b.name.toLowerCase()) problems.push(`${b.name}: is its own parent`);
  const parent = bands.find(p => p.name.toLowerCase() === (b.parent_name || '').toLowerCase());
  if (parent && parent.parent_name) problems.push(`${b.name}: its parent "${parent.name}" has a parent itself - one level only`);
}
if (problems.length) { console.error(`The list has ${problems.length} problem(s):\n  - ${problems.join('\n  - ')}`); process.exit(1); }

// ---- write the SQL ----
const q = (v) => (v == null || v === '' ? 'NULL' : `'${String(v).replace(/'/g, "''")}'`);
const arr = (a) => (a && a.length ? `ARRAY[${a.map(q).join(', ')}]::text[]` : "'{}'::text[]");
const values = bands.map(b => `    (${[q(b.name), q(b.ensemble_type), q(b.town), q(b.county), q(b.rehearsal_postcode && b.rehearsal_postcode.toUpperCase()), q(b.section_level), q(b.website), q(b.parent_name), q(b.notes), arr(b.old_names)].join(', ')})`).join(',\n');
const hostSql = (col) => `lower(regexp_replace(regexp_replace(${col}, '^https?://(www\\.)?', ''), '/.*$', ''))`;
const shared = SHARED_HOSTS.map(h => `s.website NOT LIKE '%${h}%'`).join(' AND ');

const seedSql = `CREATE TEMP TABLE band_seed (
    ord SERIAL, name TEXT, ensemble_type TEXT, town TEXT, county TEXT, rehearsal_postcode TEXT,
    section_level TEXT, website TEXT, parent_name TEXT, notes TEXT, old_names TEXT[], band_id BIGINT
) ON COMMIT DROP;

INSERT INTO band_seed (name, ensemble_type, town, county, rehearsal_postcode, section_level, website, parent_name, notes, old_names) VALUES
${values};

DO $$
DECLARE
    s RECORD;
    found BIGINT;
    owner BIGINT;
BEGIN
    SELECT id INTO owner FROM accounts WHERE account_level = 'super_admin' ORDER BY id LIMIT 1;
    IF owner IS NULL THEN SELECT id INTO owner FROM accounts ORDER BY id LIMIT 1; END IF;
    IF owner IS NULL THEN RETURN; END IF; -- an empty database has no one to own them - nothing to seed

    FOR s IN SELECT * FROM band_seed ORDER BY ord LOOP
        -- ML-473: only directory entries - never a member's own label or a band's shared space
        SELECT b.id INTO found FROM bands b
         WHERE b.kind = 'directory' AND (lower(b.name) = lower(s.name)
            OR b.name = ANY (s.old_names)
            OR (s.parent_name IS NULL AND b.website IS NOT NULL AND ${shared}
                AND ${hostSql('b.website')} = ${hostSql('s.website')}))
         ORDER BY (lower(b.name) = lower(s.name)) DESC, (b.name = ANY (s.old_names)) DESC, b.id
         LIMIT 1;
        IF found IS NULL THEN
            INSERT INTO bands (kind, name, website, created_by_account_id, ensemble_type, town, county, rehearsal_postcode, section_level, notes)
            VALUES ('directory', s.name, s.website, owner, s.ensemble_type, s.town, s.county, s.rehearsal_postcode, s.section_level, s.notes)
            RETURNING id INTO found;
        ELSE
            UPDATE bands SET name = s.name, website = s.website, active = true, ensemble_type = s.ensemble_type, town = s.town,
                   county = s.county, rehearsal_postcode = s.rehearsal_postcode, section_level = s.section_level, notes = s.notes
             WHERE id = found;
        END IF;
        UPDATE band_seed SET band_id = found WHERE ord = s.ord;
    END LOOP;

    -- The parent: in this list, else already in the directory (a main main band, one level only).
    UPDATE bands c SET parent_band_id = COALESCE(
            (SELECT par.band_id FROM band_seed par WHERE lower(par.name) = lower(kid.parent_name)),
            (SELECT b.id FROM bands b WHERE b.kind = 'directory' AND lower(b.name) = lower(kid.parent_name) AND b.parent_band_id IS NULL ORDER BY b.id LIMIT 1))
      FROM band_seed kid
     WHERE c.id = kid.band_id AND kid.parent_name IS NOT NULL;
END
$$;
`;

if (dryRun) {
  if (process.env.NEON_BRANCH !== 'dev') { console.error(`--dry-run only runs on the dev branch (NEON_BRANCH is "${process.env.NEON_BRANCH || ''}") - see docs/environments.md.`); process.exit(1); }
  const { default: pg } = await import('pg');
  const c = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await c.connect();
  try {
    await c.query('BEGIN');
    const before = new Map((await c.query('SELECT id, name FROM bands')).rows.map(r => [Number(r.id), r.name]));
    await c.query(seedSql);
    const after = (await c.query(`SELECT b.id, b.name, p.name AS parent FROM bands b LEFT JOIN bands p ON p.id = b.parent_band_id
                                  WHERE lower(b.name) = ANY ($1) ORDER BY b.name`, [bands.map(b => b.name.toLowerCase())])).rows;
    const added = after.filter(r => !before.has(Number(r.id)));
    const updated = after.filter(r => before.has(Number(r.id)));
    console.log(`Dry run on dev (rolled back): ${added.length} added, ${updated.length} updated.`);
    updated.forEach(r => console.log(`  updated: ${r.name}${before.get(Number(r.id)) !== r.name ? ` (was "${before.get(Number(r.id))}")` : ''}`));
    const orphans = bands.filter(b => b.parent_name && !after.find(r => r.name.toLowerCase() === b.name.toLowerCase())?.parent);
    orphans.forEach(b => console.log(`  WARNING: ${b.name} - parent "${b.parent_name}" not found`));
  } finally {
    await c.query('ROLLBACK');
    await c.end();
  }
  process.exit(0);
}

const slug = path.basename(listPath, '.json').replace(/^\d{4}-\d{2}-\d{2}-/, '').replace(/[^a-z0-9]+/gi, '_').toLowerCase();
const existing = fs.readdirSync(path.join(ROOT, 'db/migrations')).filter(f => /^\d{3}_/.test(f)).sort();
const next = String(Number(existing[existing.length - 1].slice(0, 3)) + 1).padStart(3, '0');
const out = path.join(ROOT, 'db/migrations', `${next}_bands_${slug}.sql`);
const header = `-- Band directory: ${list.area || slug} - ${bands.length} bands from ${listPath.replace(/\\/g, '/')}
-- (checked ${list.checked_on || 'see the list'}; every band found on a real web page). Written by
-- scripts/band-seed-migration.mjs - to change a band, edit the list and regenerate, don't hand-edit.
-- Adds new bands and updates ones already in the directory (same name, an old name, or same website);
-- never deletes or archives.

`;
fs.writeFileSync(out, header + seedSql);
console.log(`Wrote ${path.relative(ROOT, out)} (${bands.length} bands).`);
