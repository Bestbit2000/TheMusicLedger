// ML-610: Instrument support - repairers, shops and hire near a player's bands, in place of the "anyone know a...?"
// WhatsApp question. A plain list the owner keeps (support_businesses): every listing was checked on the business's
// own website, or is one the owner knows that agreed to be listed. No reviews, ratings or endorsements, and contact is
// outside the app. docs/instrument-support.md.
//
// - "Near" is the towns of the bands on My bands (each directory band's rehearsal postcode, else its town), or one
//   town picked for this look only (never kept). A business is near when it is within about 45 minutes' drive of one
//   of them - estimated from the straight-line distance (driveMinutes), so it says "about".
// - Businesses that post, deliver or sell online (uk_wide) are also shown everywhere, under "Anywhere in the UK".
// - Each look is counted - what was looked for and the place it was for, per day - never who looked; and how often
//   each listing was shown. That is the owner's MI now, and what a business that claims its listing sees later.
// - Positions come from postcodes.io (open data, no key) and are kept in place_locations, so each postcode or town is
//   looked up once.
import pool from '../config/db.js';
import { withStatus } from './flows.js';

export const OFFERS = ['repairs-brass', 'repairs-woodwind', 'repairs-percussion', 'shop-brass', 'shop-woodwind', 'shop-percussion', 'hire'];
// What a player can look for, and the offers that count for it
export const LOOKING_FOR = {
  all: OFFERS,
  'repairs-brass': ['repairs-brass'],
  'repairs-woodwind': ['repairs-woodwind'],
  shop: ['shop-brass', 'shop-woodwind', 'shop-percussion'],
  hire: ['hire'],
  percussion: ['repairs-percussion', 'shop-percussion']
};
export const MAX_MINUTES = 45;
const POSTCODES_IO = 'https://api.postcodes.io';

// Straight-line miles between two points
export function milesBetween(a, b) {
  const rad = (d) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat), dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 3958.8 * 2 * Math.asin(Math.sqrt(h));
}
// "About N minutes" by road, from the straight-line distance: roads wander and towns are slow, so 1.7 minutes a mile
// and 3 to set off, to the nearest 5 - and London's traffic adds 20 minutes to anywhere within 10 miles of its centre.
// Checked against the owner's sense of Woking's drives (Staines about 20, Maidenhead about 35, Reading about 45, central
// London about an hour).
const CENTRAL_LONDON = { lat: 51.5074, lng: -0.1278 };
export function driveMinutes(miles, to = null) {
  const london = to && milesBetween(to, CENTRAL_LONDON) < 10 ? 20 : 0;
  return Math.max(5, Math.round((miles * 1.7 + 3 + london) / 5) * 5);
}

// ---- where a postcode or a town is (postcodes.io, kept once found) ----
async function fetchJson(url) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 5000);
  try {
    const r = await fetch(url, { signal: ctrl.signal });
    if (r.status === 404) return null;
    if (!r.ok) throw new Error(`postcodes.io answered ${r.status}`);
    return (await r.json()).result;
  } finally { clearTimeout(timer); }
}
async function remembered(key, find) {
  const { rows } = await pool.query('SELECT label, latitude, longitude FROM place_locations WHERE key = $1', [key]);
  if (rows.length) return rows[0].latitude == null ? null : { label: rows[0].label, lat: rows[0].latitude, lng: rows[0].longitude };
  let found = null;
  try { found = await find(); } catch (e) { return null; } // not reachable now: not kept, so it is tried again next time
  await pool.query(
    `INSERT INTO place_locations (key, label, latitude, longitude) VALUES ($1, $2, $3, $4) ON CONFLICT (key) DO NOTHING`,
    [key, found ? found.label : null, found ? found.lat : null, found ? found.lng : null]);
  return found;
}
export function cleanPostcode(pc) {
  const s = String(pc || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  return /^[A-Z]{1,2}\d[A-Z\d]?\d[A-Z]{2}$/.test(s) ? `${s.slice(0, -3)} ${s.slice(-3)}` : null;
}
export async function locatePostcode(pc) {
  const clean = cleanPostcode(pc);
  if (!clean) return null;
  return remembered(`postcode:${clean}`, async () => {
    const p = await fetchJson(`${POSTCODES_IO}/postcodes/${encodeURIComponent(clean)}`);
    return p ? { label: p.admin_district || clean, lat: p.latitude, lng: p.longitude } : null;
  });
}
// Towns and villages whose names start with what was typed (for the "another town" box), with their county. Nearest
// to the member's bands first (a name that matches exactly before one that only starts with it), so "Farnham" in Surrey
// comes before Farnham in North Yorkshire, and before Farnham Royal.
const PLACE_TYPES = ['City', 'Town', 'Village', 'Suburban Area', 'Hamlet', 'Other Settlement'];
export async function findPlaces(text, accountId = null) {
  const q = String(text || '').trim().slice(0, 60);
  if (q.length < 2) return [];
  let list = [];
  try { list = (await fetchJson(`${POSTCODES_IO}/places?q=${encodeURIComponent(q)}&limit=20`)) || []; } catch (e) { throw withStatus(503, 'Towns can\'t be looked up just now - try again in a moment.'); }
  const home = accountId ? await bandPlaces(accountId).catch(() => []) : [];
  const away = (p) => home.length ? Math.min(...home.map(h => milesBetween(h, { lat: p.latitude, lng: p.longitude }))) : 0;
  const seen = new Set();
  return list.filter(p => PLACE_TYPES.includes(p.local_type))
    .map(p => ({ name: p.name_1, county: p.county_unitary || p.district_borough || p.region || null, away: away(p) }))
    .filter(p => { const k = `${p.name}|${p.county}`; if (seen.has(k)) return false; seen.add(k); return true; })
    .sort((a, b) => (b.name.toLowerCase() === q.toLowerCase()) - (a.name.toLowerCase() === q.toLowerCase()) || a.away - b.away)
    .slice(0, 8)
    .map(({ name, county }) => ({ name, county }));
}
export async function locateTown(name, county) {
  const want = String(name || '').trim();
  if (!want) return null;
  return remembered(`place:${want.toLowerCase()}|${String(county || '').toLowerCase()}`, async () => {
    const list = (await fetchJson(`${POSTCODES_IO}/places?q=${encodeURIComponent(want)}&limit=20`)) || [];
    const same = list.filter(p => String(p.name_1).toLowerCase() === want.toLowerCase() && PLACE_TYPES.includes(p.local_type));
    const inCounty = county ? same.find(p => [p.county_unitary, p.district_borough, p.region].some(c => String(c || '').toLowerCase() === String(county).toLowerCase())) : null;
    const p = inCounty || same.find(p => ['City', 'Town'].includes(p.local_type)) || same[0];
    return p ? { label: p.name_1, lat: p.latitude, lng: p.longitude } : null;
  });
}

// The towns of the bands on My bands (the directory band each is linked to)
async function bandPlaces(accountId) {
  const { rows } = await pool.query(
    `SELECT DISTINCT d.town, d.county, d.rehearsal_postcode
       FROM bands l JOIN bands d ON d.id = l.directory_band_id
      WHERE l.created_by_account_id = $1 AND l.kind = 'label' AND l.active AND d.town IS NOT NULL`,
    [accountId]);
  const places = [];
  for (const r of rows) {
    const at = (r.rehearsal_postcode && await locatePostcode(r.rehearsal_postcode)) || await locateTown(r.town, r.county);
    if (at) places.push({ ...at, label: r.town });
  }
  return places;
}

const toDto = (r) => ({
  id: Number(r.id), name: r.name, offers: r.offers || [], ukWide: r.uk_wide, town: r.town, county: r.county,
  link: r.link_url, linkKind: r.link_kind, phone: r.phone, email: r.email, whatTheyDo: r.what_they_do,
  checkedOn: ymd(r.checked_on), source: r.source
});
// A DATE column comes back as local midnight - read it back the same way, or in British Summer Time it's a day early
function ymd(d) {
  if (!d) return null;
  if (!(d instanceof Date)) return String(d).slice(0, 10);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
const today = () => new Date().toISOString().slice(0, 10);

// The list for one look. near: a town picked for this look ({ name, county }), else the bands' towns.
export async function supportList(accountId, { lookingFor = 'all', near = null } = {}) {
  if (!LOOKING_FOR[lookingFor]) throw withStatus(400, 'Unknown search.');
  const wanted = LOOKING_FOR[lookingFor];
  let places;
  if (near && near.name) {
    const at = await locateTown(near.name, near.county);
    if (!at) throw withStatus(404, `We couldn't find ${near.name}.`);
    places = [{ ...at, label: near.name }];
  } else places = await bandPlaces(accountId);

  const { rows } = await pool.query('SELECT * FROM support_businesses WHERE NOT hidden AND offers && $1::text[] ORDER BY lower(name)', [wanted]);
  const local = [];
  for (const r of rows) {
    if (r.latitude == null || !places.length) continue;
    let best = null;
    for (const p of places) {
      const to = { lat: r.latitude, lng: r.longitude };
      const minutes = driveMinutes(milesBetween(p, to), to);
      if (!best || minutes < best.minutes) best = { minutes, from: p.label };
    }
    if (best.minutes <= MAX_MINUTES) local.push({ ...toDto(r), minutes: best.minutes, from: best.from });
  }
  local.sort((a, b) => a.minutes - b.minutes || a.name.localeCompare(b.name));
  const shownLocal = new Set(local.map(b => b.id));
  const ukWide = rows.filter(r => r.uk_wide && !shownLocal.has(Number(r.id))).map(toDto);

  // Counted: what was looked for, and where - never who
  const nearLabel = near && near.name ? near.name : places.length ? places.map(p => p.label).sort().join(', ') : '(no band towns)';
  try {
    await pool.query(
      `INSERT INTO support_search_counts (day, looked_for, near, searches, empty_searches) VALUES ($1, $2, $3, 1, $4)
       ON CONFLICT (day, looked_for, near) DO UPDATE SET searches = support_search_counts.searches + 1, empty_searches = support_search_counts.empty_searches + EXCLUDED.empty_searches`,
      [today(), lookingFor, nearLabel.slice(0, 200), local.length ? 0 : 1]);
    const ids = [...local.map(b => b.id), ...ukWide.map(b => b.id)];
    if (ids.length) await pool.query(
      `INSERT INTO support_listing_counts (day, business_id, shown) SELECT $1, unnest($2::bigint[]), 1
       ON CONFLICT (day, business_id) DO UPDATE SET shown = support_listing_counts.shown + 1`, [today(), ids]);
  } catch (e) { /* counting is never in the way of the list */ }

  return { lookingFor, near: { picked: !!(near && near.name), towns: places.map(p => p.label) }, maxMinutes: MAX_MINUTES, local, ukWide };
}

// ---- Admin -> Instrument support ----
export async function adminSupport() {
  const { rows } = await pool.query(
    `SELECT b.*, COALESCE((SELECT SUM(shown) FROM support_listing_counts c WHERE c.business_id = b.id AND c.day > CURRENT_DATE - 30), 0) AS shown_30
       FROM support_businesses b ORDER BY b.uk_wide, lower(b.name)`);
  const { rows: searches } = await pool.query(
    `SELECT looked_for, near, SUM(searches)::int AS searches, SUM(empty_searches)::int AS empty
       FROM support_search_counts WHERE day > CURRENT_DATE - 30 GROUP BY looked_for, near ORDER BY SUM(searches) DESC, looked_for LIMIT 100`);
  return {
    businesses: rows.map(r => ({ ...toDto(r), postcode: r.postcode, hidden: r.hidden, checkedUrl: r.checked_url, located: r.latitude != null, shown30: Number(r.shown_30) })),
    searches: searches.map(s => ({ lookingFor: s.looked_for, near: s.near, searches: s.searches, empty: s.empty })),
    offers: OFFERS
  };
}

export function cleanBusiness(input) {
  const b = input || {};
  const text = (v, max) => { const s = String(v == null ? '' : v).trim(); if (s.length > max) throw withStatus(400, 'One of the fields is too long.'); return s || null; };
  const name = text(b.name, 120);
  if (!name) throw withStatus(400, 'A business needs a name.');
  const offers = [...new Set(Array.isArray(b.offers) ? b.offers : [])];
  if (!offers.length || offers.some(o => !OFFERS.includes(o))) throw withStatus(400, 'Choose what it offers.');
  const link = text(b.link, 500);
  // http as well as https (ML-613): a small business's site may only work over http. Never any other kind of link.
  if (link && !/^https?:\/\/[^\s"'<>]+$/i.test(link)) throw withStatus(400, 'The link must be a full web address, starting https:// or http://.');
  const email = text(b.email, 200);
  if (email && !/^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]+$/.test(email)) throw withStatus(400, 'That email address doesn\'t look right.');
  const postcode = text(b.postcode, 10);
  if (postcode && !cleanPostcode(postcode)) throw withStatus(400, 'That postcode doesn\'t look right.');
  const source = b.source === 'owner' ? 'owner' : 'website';
  if (source === 'website' && !link) throw withStatus(400, 'A business checked on its own website needs its website.');
  return {
    name, offers, ukWide: !!b.ukWide, town: text(b.town, 80), county: text(b.county, 80), postcode: postcode ? cleanPostcode(postcode) : null,
    link, linkKind: link && /(^|\.)facebook\.com\//i.test(link.replace(/^https?:\/\//i, '')) ? 'facebook' : 'website',
    phone: text(b.phone, 40), email, whatTheyDo: text(b.whatTheyDo, 400), source, checkedUrl: text(b.checkedUrl, 500), hidden: !!b.hidden
  };
}
async function positionOf(b) {
  const at = (b.postcode && await locatePostcode(b.postcode)) || (b.town && await locateTown(b.town, b.county));
  return at || { lat: null, lng: null };
}
export async function addBusiness(input) {
  const b = cleanBusiness(input);
  const at = await positionOf(b);
  try {
    await pool.query(
      `INSERT INTO support_businesses (name, offers, uk_wide, town, county, postcode, latitude, longitude, link_url, link_kind, phone, email, what_they_do, source, checked_on, checked_url, hidden)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, CURRENT_DATE, $15, $16)`,
      [b.name, b.offers, b.ukWide, b.town, b.county, b.postcode, at.lat, at.lng, b.link, b.linkKind, b.phone, b.email, b.whatTheyDo, b.source, b.checkedUrl, b.hidden]);
  } catch (e) {
    if (e.code === '23505') throw withStatus(409, 'There is already a business with that name.');
    throw e;
  }
  return adminSupport();
}
export async function updateBusiness(id, input) {
  const b = cleanBusiness(input);
  const at = await positionOf(b);
  const { rowCount } = await pool.query(
    `UPDATE support_businesses SET name = $2, offers = $3, uk_wide = $4, town = $5, county = $6, postcode = $7, latitude = $8, longitude = $9,
            link_url = $10, link_kind = $11, phone = $12, email = $13, what_they_do = $14, source = $15, checked_url = $16, hidden = $17,
            checked_on = CURRENT_DATE, updated_at = now()
      WHERE id = $1`,
    [Number(id), b.name, b.offers, b.ukWide, b.town, b.county, b.postcode, at.lat, at.lng, b.link, b.linkKind, b.phone, b.email, b.whatTheyDo, b.source, b.checkedUrl, b.hidden]);
  if (!rowCount) throw withStatus(404, 'That business isn\'t listed.');
  return adminSupport();
}
// A business that asks to be taken off is removed for good, with its counts
export async function removeBusiness(id) {
  await pool.query('DELETE FROM support_businesses WHERE id = $1', [Number(id)]);
  return adminSupport();
}
