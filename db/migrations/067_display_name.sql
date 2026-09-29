-- ML-330: a display name - what the app calls you (the home screen's greeting, and to people in your
-- bands), set in My account > My details. Null = use your first name.
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS display_name TEXT
    CHECK (display_name IS NULL OR length(display_name) BETWEEN 1 AND 40);
