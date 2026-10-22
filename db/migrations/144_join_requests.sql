-- ML-580: the waiting list on the public page. While Notably Better is invite only, someone asks to join from
-- the front door: first name, last name, email, optionally the band they play with (a directory band, or one
-- they type) and their instrument, and a tick that they are 13 or over or a parent or carer is filling it in.
-- The owner sees each request on Admin -> Waiting list and lets them in (the ordinary invitation email), passes
-- it to a band's organiser (a notice), or turns it down. A request is deleted once it is dealt with, and
-- otherwise after 90 days (clearOldRecords, the daily job). One request per email address. Nothing here is
-- tied to an account: the person has none yet. docs/waiting-list.md.
CREATE TABLE IF NOT EXISTS join_requests (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    first_name TEXT NOT NULL CHECK (length(first_name) BETWEEN 1 AND 80),
    last_name TEXT NOT NULL CHECK (length(last_name) BETWEEN 1 AND 80),
    email TEXT NOT NULL CHECK (length(email) BETWEEN 3 AND 254),
    directory_band_id BIGINT REFERENCES bands(id) ON DELETE SET NULL,   -- a band picked from the directory
    band_name TEXT CHECK (band_name IS NULL OR length(band_name) <= 120), -- or one they typed ("another one")
    instrument_id BIGINT REFERENCES instruments(id) ON DELETE SET NULL,
    age_confirmed BOOLEAN NOT NULL CHECK (age_confirmed),                 -- 13 or over, or a parent or carer
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS join_requests_email ON join_requests (lower(email));

-- The form's Live switch (Admin -> Feature access). Off: the page says to write to hello@ instead. It is read
-- before anyone has signed in, so only Live counts (isFeatureLive), not an account type.
INSERT INTO features (feature_key, name, description, enabled) VALUES
    ('waiting_list', 'Waiting list on the public page', 'The "Ask to join" form on the front door (ML-580): someone gives their name, email, band and instrument, and the owner lets them in or passes them to the band''s organiser from Admin -> Waiting list. Only Live counts - it is used signed out. Off: the page asks people to write to hello@notablybetter.com instead.', true)
ON CONFLICT (feature_key) DO NOTHING;
