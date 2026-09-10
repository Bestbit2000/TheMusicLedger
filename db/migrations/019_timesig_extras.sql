-- 3/2 was missing from the public catalog (ML-35 follow-up).
INSERT INTO time_signature_options (numerator, denominator, label, sort_order)
VALUES (3, 2, '3/2', 14);

-- Lets a custom time signature still in use by existing blocks be taken out of
-- the picker for NEW blocks ("archived") without deleting it outright and
-- breaking whatever already references it. Only one still unused can be
-- deleted for real - see server/services/timeSignatures.js.
ALTER TABLE account_time_signatures ADD COLUMN active BOOLEAN NOT NULL DEFAULT true;
