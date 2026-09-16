-- ML-153: groups the public time signature catalog into Simple/Compound/Asymmetric families for
-- the redesigned picker's three preset grids (see docs/database-schema.md's time_signature_options
-- entry). Nullable and only seeded for the 12 signatures the new picker actually shows as presets -
-- every other catalog entry (and every account_time_signatures row - custom signatures are never
-- part of this table) stays NULL and simply isn't offered as a preset. More can be promoted into a
-- family later by hand if they turn out to be used a lot (per the ticket), not by another migration
-- pass right now.
ALTER TABLE time_signature_options ADD COLUMN family TEXT CHECK (family IN ('simple', 'compound', 'asymmetric'));

UPDATE time_signature_options SET family = 'simple' WHERE (numerator, denominator) IN ((2,4), (3,4), (4,4), (2,2));
UPDATE time_signature_options SET family = 'compound' WHERE (numerator, denominator) IN ((6,8), (9,8), (12,8), (3,8));
UPDATE time_signature_options SET family = 'asymmetric' WHERE (numerator, denominator) IN ((5,4), (7,4), (5,8), (7,8));
