-- Warm-ups: no rests after the last note (owner, 1 October 2026). A rest bar at the end of a warm-up only
-- adds a silent bar before the next go or, in a practice session's looping warm-up (ML-390), before the
-- next warm-up. Eight of the seeded long tones ended with a whole-bar rest; any exercise an admin has
-- written that ends in rests is trimmed the same way. Saving in Admin -> Warm-ups now trims them too
-- (Warmups.trimEndRests, public/warmups.js). An exercise that is only rests is left alone (the editor
-- can't save one).

UPDATE warmup_exercises w
   SET notes = (
         SELECT jsonb_agg(e.note ORDER BY e.i)
           FROM jsonb_array_elements(w.notes) WITH ORDINALITY AS e(note, i)
          WHERE e.i <= (SELECT max(n.i)
                          FROM jsonb_array_elements(w.notes) WITH ORDINALITY AS n(note, i)
                         WHERE n.note->>'p' IS NOT NULL)
       ),
       updated_at = now()
 WHERE jsonb_typeof(w.notes) = 'array'
   AND jsonb_array_length(w.notes) > 0
   AND (w.notes->-1->>'p') IS NULL
   AND EXISTS (SELECT 1 FROM jsonb_array_elements(w.notes) AS n(note) WHERE n.note->>'p' IS NOT NULL);
