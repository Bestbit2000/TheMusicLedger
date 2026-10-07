// ML-484: which name the app goes by ON SCREEN - a trial, so the owner can live with a candidate name
// before choosing one. One setting for everyone, signed in or not: the sign-in picture, the name and
// small mark at the top of Home and in the menu rail, and the browser tab. Nothing legal follows it -
// the privacy policy, the terms, emails and the installed app stay "The Music Ledger". docs/brand-trial.md.
//
// Kept as one row in app_config ('brand'). With no row, or a value that isn't one of the three, it is
// the default - so nothing has to be seeded, and a bad value can never reach a page.

import pool from '../config/db.js';
import { withStatus } from './metronomeSetups.js';

export const DEFAULT_BRAND = 'music-ledger';
// The names are here for the admin page and the tests; the pictures and what the app shows are public/brand.js.
export const BRANDS = {
  'music-ledger': 'The Music Ledger',
  'notably-better': 'Notably Better',
  fivetto: 'Fivetto'
};

export const validBrand = (key) => (typeof key === 'string' && Object.hasOwn(BRANDS, key) ? key : DEFAULT_BRAND);

export async function getBrand() {
  const { rows } = await pool.query("SELECT value FROM app_config WHERE key = 'brand'");
  return validBrand(rows[0]?.value);
}

export async function setBrand(key) {
  if (typeof key !== 'string' || !Object.hasOwn(BRANDS, key)) throw withStatus(400, 'Choose one of the three names.');
  await pool.query(
    `INSERT INTO app_config (key, value) VALUES ('brand', $1)
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`, [key]);
  return key;
}
