#!/usr/bin/env node
// Instrument support lists -> a migration (ML-610, docs/instrument-support.md).
//
//   node scripts/instrument-support-seed-migration.mjs db/instrument-support/<list>.json
//
// The list is a checked research list (db/instrument-support/*.json): every business was checked on its own website,
// or is one the owner knows personally and that has agreed to be listed. Each business's position is looked up with
// postcodes.io (its postcode, else its town) so "within about 45 minutes" works without a lookup at run time. The
// migration adds a business that isn't listed yet and updates one that is (the same name, any case). A business
// marked not-yet-agreed (notes say "Not shown until they say yes") is left out. Nothing is ever deleted here.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OFFERS = ['repairs-brass', 'repairs-woodwind', 'repairs-percussion', 'shop-brass', 'shop-woodwind', 'shop-percussion', 'hire'];
const listPath = process.argv[2];
if (!listPath) { console.error('Usage: node scripts/instrument-support-seed-migration.mjs <db/instrument-support/list.json>'); process.exit(1); }
const list = JSON.parse(fs.readFileSync(path.resolve(ROOT, listPath), 'utf8'));

const problems = [];
const businesses = list.businesses.filter(b => !/not shown until they say yes/i.test(b.notes || ''));
for (const b of businesses) {
  if (!b.name) problems.push('a business with no name');
  for (const o of b.offers || []) if (!OFFERS.includes(o)) problems.push(`${b.name}: unknown offer ${o}`);
  if (!(b.offers || []).length) problems.push(`${b.name}: offers nothing`);
  if (!['own website', 'owner'].includes(b.source)) problems.push(`${b.name}: source must be "own website" or "owner"`);
  if (b.source === 'own website' && !b.website) problems.push(`${b.name}: checked on its own website, but no website`);
}
if (problems.length) { console.error(problems.join('\n')); process.exit(1); }

async function locate(b) {
  const get = async (url) => { const r = await fetch(url); return r.ok ? (await r.json()).result : null; };
  if (b.postcode) {
    const p = await get(`https://api.postcodes.io/postcodes/${encodeURIComponent(b.postcode)}`);
    if (p) return { lat: p.latitude, lng: p.longitude, county: p.admin_county || p.admin_district || null };
  }
  if (b.town) {
    const places = await get(`https://api.postcodes.io/places?q=${encodeURIComponent(b.town)}&limit=10`) || [];
    const want = String(b.town).toLowerCase();
    const p = places.find(x => String(x.name_1).toLowerCase() === want && (!b.county || [x.county_unitary, x.region].some(c => String(c || '').toLowerCase().includes(String(b.county).toLowerCase())))) || places.find(x => String(x.name_1).toLowerCase() === want);
    if (p) return { lat: p.latitude, lng: p.longitude, county: p.county_unitary || null };
  }
  return null;
}

const q = (v) => (v == null || v === '' ? 'NULL' : `'${String(v).replace(/'/g, "''")}'`);
const rows = [];
for (const b of businesses) {
  const at = await locate(b);
  if (!at) console.warn(`(no position for ${b.name} - it can only show under "Anywhere in the UK")`);
  const linkKind = /facebook\.com/i.test(b.website || '') ? 'facebook' : 'website';
  rows.push(`    (${q(b.name)}, ARRAY[${b.offers.map(q).join(', ')}]::text[], ${b.group === 'uk-wide' || b.post_in === true}, ${q(b.town)}, ${q(b.county)}, ${q(b.postcode)}, ${at ? at.lat : 'NULL'}, ${at ? at.lng : 'NULL'}, ${q(b.website)}, '${linkKind}', ${q(b.phone)}, ${q(b.email)}, ${q(b.what_they_say)}, '${b.source === 'owner' ? 'owner' : 'website'}', ${q(list.checked_on)}, ${q(b.checked_url)})`);
}

const dir = path.join(ROOT, 'db', 'migrations');
const last = fs.readdirSync(dir).map(f => parseInt(f, 10)).filter(Number.isFinite).sort((a, b) => b - a)[0];
const slug = path.basename(listPath, '.json').replace(/^\d{4}-\d{2}-\d{2}-/, '').replace(/[^a-z0-9]+/gi, '_').toLowerCase();
const file = path.join(dir, `${String(last + 1).padStart(3, '0')}_instrument_support_${slug}.sql`);
const sql = `-- ML-610: Instrument support listings from ${listPath.replace(/\\/g, '/')} (checked ${list.checked_on}).
-- Written by scripts/instrument-support-seed-migration.mjs - each business checked on its own website, or known to the
-- owner and agreed to be listed. Positions from postcodes.io. A business already listed (same name) is updated.
INSERT INTO support_businesses (name, offers, uk_wide, town, county, postcode, latitude, longitude, link_url, link_kind, phone, email, what_they_do, source, checked_on, checked_url)
VALUES
${rows.join(',\n')}
ON CONFLICT ((lower(name))) DO UPDATE SET
    offers = EXCLUDED.offers, uk_wide = EXCLUDED.uk_wide, town = EXCLUDED.town, county = EXCLUDED.county, postcode = EXCLUDED.postcode,
    latitude = EXCLUDED.latitude, longitude = EXCLUDED.longitude, link_url = EXCLUDED.link_url, link_kind = EXCLUDED.link_kind,
    phone = EXCLUDED.phone, email = EXCLUDED.email, what_they_do = EXCLUDED.what_they_do, source = EXCLUDED.source,
    checked_on = EXCLUDED.checked_on, checked_url = EXCLUDED.checked_url, updated_at = now();
`;
fs.writeFileSync(file, sql);
console.log(`wrote ${path.relative(ROOT, file)} - ${rows.length} businesses`);
