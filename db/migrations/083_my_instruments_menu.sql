-- ML-382: My instruments moved out of My account into the ☰ menu (next to My music). The Range feature's
-- description on Admin -> Features names the screen, so it follows. Data only.
UPDATE features
SET description = replace(description, 'My account -> My instruments', 'the menu''s My instruments')
WHERE feature_key = 'range_trainer';
