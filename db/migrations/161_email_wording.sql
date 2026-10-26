-- ML-617: what the app's emails say, changed on Admin -> Email wording without a release. One row per email
-- (its key, e.g. 'invitation'); no row means the built-in wording in server/services/emailWording.js, which
-- also holds the list of emails, their {fill-ins} and the checks a saved wording must pass. The words are HTML
-- with a few kinds of formatting only (bold, italic, underline, lists) - cleaned before they are kept; the app
-- adds the button's link and the fixed last line itself. updated_by_account_id is who saved it last; it empties
-- if that account is ever deleted (account deletion sets such columns to nothing), and the wording stays.
-- docs/email-wording.md.
CREATE TABLE email_wording (
    key TEXT PRIMARY KEY CHECK (key ~ '^[a-z_]{1,40}$'),
    subject TEXT NOT NULL CHECK (char_length(subject) BETWEEN 1 AND 100),
    body TEXT NOT NULL CHECK (char_length(body) BETWEEN 1 AND 6000),
    button TEXT NOT NULL CHECK (char_length(button) BETWEEN 1 AND 30),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_by_account_id BIGINT REFERENCES accounts(id) ON DELETE SET NULL
);

-- The signature at the bottom of every email a member gets (not the alerts to the owner): HTML pasted or
-- formatted on the page, cleaned before it is kept (server/services/emailSignature.js) - links (https, mailto,
-- tel) are allowed here, and the only picture is the logo uploaded on the page (logo_url, in the file store's
-- email-signature/ folder). One row at most; none = no signature.
CREATE TABLE email_signature (
    id BOOLEAN PRIMARY KEY DEFAULT true CHECK (id),
    html TEXT NOT NULL DEFAULT '' CHECK (char_length(html) <= 10000),
    logo_url TEXT,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_by_account_id BIGINT REFERENCES accounts(id) ON DELETE SET NULL
);
