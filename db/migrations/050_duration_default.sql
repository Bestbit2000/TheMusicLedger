-- ML-236: the quick timer starts on the user's most common practise length (last 90 days).
-- When there's no history to go on, it uses this admin-set default instead - one preset in
-- duration_options flagged as the default, starting at 30 minutes, changeable from Admin ->
-- Metadata lists -> Durations if it turns out most people do something else (e.g. 20).

ALTER TABLE duration_options ADD COLUMN is_default BOOLEAN NOT NULL DEFAULT false;

-- At most one default at a time.
CREATE UNIQUE INDEX duration_options_one_default ON duration_options ((true)) WHERE is_default;

UPDATE duration_options SET is_default = true WHERE minutes = 30;
