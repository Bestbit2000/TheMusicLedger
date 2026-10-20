-- ML-539: every warm-up is in 3/4 or 4/4 (owner, 20 October 2026). A warm-up's count-in is one bar, so the
-- seeded "March tune" in 2/4 at 96 bpm gave only two clicks before it started - too quick to come in. A 2/4
-- warm-up becomes 4/4: two of its bars make one, and no note moves (a note can't cross a 2/4 bar line, so it
-- can't cross a 4/4 one either); an odd last bar is a short last bar, which the engine allows. Admin ->
-- Warm-ups and the server only take 3 or 4 beats in a bar from now on (server/services/warmups.js).

UPDATE warmup_exercises
   SET beats_per_bar = 4,
       updated_at = now()
 WHERE beats_per_bar = 2;

-- The seeded March tune's tip said "two in a bar" - changed only where it is still the seeded wording.
UPDATE warmup_exercises
   SET tip = 'Bright and steady, like a march.',
       updated_at = now()
 WHERE tip = 'Bright and steady - two in a bar.';
