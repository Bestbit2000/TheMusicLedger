-- ML-344: My account's pages are "My ..." now (My details, My instruments, My bands, My teachers), not
-- "Your ...". The Range feature's description on Admin -> Features names the screen, so it follows.
UPDATE features
SET description = replace(description, 'My account -> Your instruments', 'My account -> My instruments')
WHERE feature_key = 'range_trainer';
