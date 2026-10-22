-- ML-578: a piece made straight from a MuseScore file (.mscz) - its bars, time signatures, speeds, rehearsal
-- letters, repeats and signs become the piece's blocks, as "Import from MusicXML" does (docs/flow-musicxml.md,
-- "MuseScore files"). Its own switch, beside flow_import_musicxml, so it can be tried before anyone else has it.
--
-- A new feature is Super admin only until it is switched on for account types (Admin -> Feature access). The
-- owner's rule (22 Oct 2026, "free to practise, more with Premium") puts it in Premium; he switches it on there
-- once he has tried his own files.
INSERT INTO features (feature_key, name, description, enabled) VALUES
    ('flow_import_musescore', 'Import a piece from MuseScore', 'Add a piece -> Import from a file: make a piece from a MuseScore 4 file (.mscz) - its bars, time signatures, speeds, rehearsal letters, repeats and signs. The file is read and not kept; the member can attach it to the piece themselves. No outside service.', true)
ON CONFLICT (feature_key) DO NOTHING;
