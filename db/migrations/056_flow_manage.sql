-- ML-299: Flow is split in two. The home screen tool is now "Rehearse" - pick a piece you can see and
-- play it (shown only when there is at least one). Creating, importing, the library and editing move
-- to the ☰ menu's "My music", behind this feature so it can be limited later (a student or band
-- member who shouldn't add their own pieces). On for everyone for now.
INSERT INTO features (feature_key, name, description, enabled) VALUES
    ('flow_manage', 'My music (manage pieces)', 'The ☰ menu''s My music (ML-299): create a piece, import from MusicXML/PDF, the library, and editing. Off = Rehearse only (play the pieces you can see). App-wide for now; per-person limits come later.', true)
ON CONFLICT (feature_key) DO NOTHING;
