-- ML-618 stage 4: the message each of the owner's pop-ups starts with (warning or closing an account, removing
-- something on Shared music, renaming a band), changed on Admin -> Email wording without a release. One row per part
-- that has been changed ('warn.opening', 'remove.why.person'...); no row means the built-in words in
-- server/services/popupTexts.js. Plain text. updated_by_account_id empties if that account is ever deleted.
CREATE TABLE popup_texts (
    key TEXT PRIMARY KEY CHECK (key ~ '^[a-z_]{1,30}\.[a-z_.]{1,40}$'),
    text TEXT NOT NULL CHECK (char_length(text) <= 800),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_by_account_id BIGINT REFERENCES accounts(id) ON DELETE SET NULL
);
