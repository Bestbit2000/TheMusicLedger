// ML-242: what the public pricing page shows - which of a fixed list of features and limits Standard and
// Premium have, read from Admin -> Feature access (features / feature_access / feature_limits). Open to
// anyone (GET /api/pricing, listed in OPEN_ROUTES): it says nothing about any member, only how the two
// account types are set, and only for the keys listed here.
import { featureOn, limitFor, featureMatrix, featureLimits } from './features.js';

export const PRICING_PLANS = ['standard_member', 'premium_member'];

// Every key public/pricing.html asks about. A key not in the catalog is left out of the answer, so the page
// keeps what it has typed (piece_files until ML-579 adds it).
export const PRICING_FEATURES = [
  'flow_create', 'flow_manage', 'rehearse', 'piece_files', 'flow_import_musicxml', 'flow_import_musescore', 'piece_from_photo',
  'flow_export_musicxml', 'metronome_save_to_flow', 'rehearsal_recordings', 'practice_levels', 'warmups',
  'scales_practice', 'scales_levels', 'theory_practice', 'metronome', 'metronome_history', 'tuner',
  'tuner_rewind', 'timer', 'session_logging'
];
export const PRICING_LIMITS = ['metronome_history_shown', 'home_tools', 'home_stats'];

// Pure - unit tested. matrix: Map key -> { live, levels }; limits: Map key -> { [type]: n }.
export function pricingFrom(matrix, limits) {
  const out = {};
  for (const plan of PRICING_PLANS) {
    const features = {};
    for (const key of PRICING_FEATURES) if (matrix.has(key)) features[key] = featureOn(matrix.get(key), plan);
    const planLimits = {};
    for (const key of PRICING_LIMITS) {
      const n = limitFor(limits.get(key), plan, null);
      if (Number.isFinite(n)) planLimits[key] = n;
    }
    out[plan] = { features, limits: planLimits };
  }
  return out;
}

export async function pricingColumns() {
  return pricingFrom(await featureMatrix(), await featureLimits());
}
