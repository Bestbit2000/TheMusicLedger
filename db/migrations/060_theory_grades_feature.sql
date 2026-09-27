-- ML-309 B: the Theory tool's grade picker (Grade 1-5, cumulative, per quiz). Behind its own feature
-- so it can become a paid extra later. Off by default: switch it on per environment in Admin -> Features.
-- What each grade includes lives in public/theoryEngine.js (THEORY_GRADES) and is listed for review on
-- Admin -> Theory grades.
INSERT INTO features (feature_key, name, description, enabled) VALUES
    ('theory_grades', 'Theory grades', 'The Theory tool''s grade picker (ML-309): each quiz can be set to Grade 1-5 (everything up to that grade) instead of the custom options. Off = custom options only. A likely paid feature later.', false)
ON CONFLICT (feature_key) DO NOTHING;
