-- Band directory: West Sussex (Horsham, Crawley, Mid Sussex, East Grinstead, Worthing, Adur, Arun, Chichester and the villages between), incl. just over the Surrey, Kent, Hampshire and Brighton & Hove borders; not the Lewes area of East Sussex - 40 bands from db/band-lists/2026-10-27-west-sussex.json
-- (checked 2026-10-27; every band found on a real web page). Written by
-- scripts/band-seed-migration.mjs - to change a band, edit the list and regenerate, don't hand-edit.
-- Adds new bands and updates ones already in the directory (same name, an old name, or same website);
-- never deletes or archives.

CREATE TEMP TABLE band_seed (
    ord SERIAL, name TEXT, ensemble_type TEXT, town TEXT, county TEXT, rehearsal_postcode TEXT,
    section_level TEXT, website TEXT, parent_name TEXT, notes TEXT, old_names TEXT[], band_id BIGINT
) ON COMMIT DROP;

INSERT INTO band_seed (name, ensemble_type, town, county, rehearsal_postcode, section_level, website, parent_name, notes, old_names) VALUES
    ('Horsham Borough Band', 'Brass Band', 'Cranleigh', 'Surrey', 'GU6 8AF', 'First', 'http://www.horshamboroughband.co.uk/', NULL, 'Horsham''s contesting brass band; it rehearses at Cranleigh Bandroom.', '{}'::text[]),
    ('Slinfold Concert Band', 'Concert Band', 'Slinfold', 'West Sussex', NULL, NULL, 'https://www.slinfoldconcertband.org/', NULL, NULL, '{}'::text[]),
    ('West Sussex Youth Wind Orchestra', 'Youth Wind Band', 'Horsham', 'West Sussex', 'RH13 5HR', NULL, 'https://www.westsussexmusic.co.uk/west-sussex-youth-wind-orchestra/', NULL, 'A West Sussex Music (county music service) ensemble for young players, Grade 5 and above.', '{}'::text[]),
    ('West Sussex Training Wind Orchestra', 'Youth Wind Band', 'Horsham', 'West Sussex', 'RH13 5HR', NULL, 'https://www.westsussexmusic.co.uk/horsham-music-centre/', NULL, 'A West Sussex Music (county music service) ensemble for young players, about Grades 2-4.', '{}'::text[]),
    ('Horsham Junior Wind Orchestra', 'Training Band', 'Horsham', 'West Sussex', 'RH13 5HR', NULL, 'https://www.westsussexmusic.co.uk/horsham-music-centre/', NULL, 'A West Sussex Music (county music service) ensemble for young players, up to Grade 1.', '{}'::text[]),
    ('Crawley Millennium Concert Band', 'Concert Band', 'Crawley', 'West Sussex', 'RH11 0PL', NULL, 'https://www.cmcband.co.uk/', NULL, NULL, '{}'::text[]),
    ('Copthorne Silver Band', 'Brass Band', 'Copthorne', 'West Sussex', 'RH10 3QX', 'Non-contesting', 'https://www.copthornesilverband.co.uk/', NULL, NULL, '{}'::text[]),
    ('Copthorne Silver Band Training Band', 'Training Band', 'Copthorne', 'West Sussex', 'RH10 3QX', NULL, 'https://www.copthornesilverband.co.uk/copy-of-rehearsals', 'Copthorne Silver Band', 'For learners of any age; no experience needed.', '{}'::text[]),
    ('East Grinstead Concert Band', 'Concert Band', 'East Grinstead', 'West Sussex', 'RH19 1DJ', NULL, 'https://www.egcb.co.uk/', NULL, NULL, '{}'::text[]),
    ('Edenbridge Town Band', 'Brass Band', 'Edenbridge', 'Kent', NULL, 'Non-contesting', 'https://edenbridgetownband.co.uk/', NULL, NULL, '{}'::text[]),
    ('Haywards Heath Concert Band', 'Concert Band', 'Haywards Heath', 'West Sussex', NULL, NULL, 'https://hhcb.org.uk/', NULL, 'Formerly Haywards Heath Concert Brass.', '{}'::text[]),
    ('Mid Sussex Brass Band', 'Brass Band', 'Burgess Hill', 'West Sussex', 'RH15 8HS', NULL, 'https://midsussexbrass.weebly.com/', NULL, NULL, '{}'::text[]),
    ('Mid Sussex First Brass', 'Training Band', 'Burgess Hill', 'West Sussex', 'RH15 8HS', NULL, 'https://midsussexbrass.weebly.com/', 'Mid Sussex Brass Band', 'For anyone wanting to learn a brass instrument.', '{}'::text[]),
    ('Worthing Silver Band', 'Brass Band', 'Ferring', 'West Sussex', NULL, 'Non-contesting', 'https://worthingsilverband.co.uk/', NULL, 'Rehearses at Ferring Village Hall.', '{}'::text[]),
    ('Lancing Brass', 'Brass Band', 'Worthing', 'West Sussex', 'BN14 8JL', 'Non-contesting', 'https://www.lancingbrass.org.uk/', NULL, 'Lancing Brass of the Royal British Legion; it moved from Lancing to Worthing in 2025.', '{}'::text[]),
    ('Davison Worthing Youth Concert Band', 'Youth Wind Band', 'Worthing', 'West Sussex', 'BN11 2JX', NULL, 'https://www.dwycb.com/', NULL, 'For young players in full-time education.', '{}'::text[]),
    ('DWYCB Junior Band', 'Training Band', 'Worthing', 'West Sussex', 'BN11 2JX', NULL, 'https://www.dwycb.com/', 'Davison Worthing Youth Concert Band', 'For younger children or those just starting an instrument.', '{}'::text[]),
    ('Worthing Junior Wind Orchestra', 'Training Band', 'Worthing', 'West Sussex', 'BN14 8AH', NULL, 'https://www.westsussexmusic.co.uk/worthing-music-centre/', NULL, 'A West Sussex Music (county music service) ensemble for young players, up to Grade 1.', '{}'::text[]),
    ('Adur Concert Band', 'Concert Band', 'Southwick', 'West Sussex', 'BN42 4NA', NULL, 'https://www.adurconcertband.org.uk/', NULL, 'For adults (18 and over).', '{}'::text[]),
    ('Littlehampton Concert Band', 'Concert Band', 'Littlehampton', 'West Sussex', 'BN17 5EG', NULL, 'https://www.littlehampton-concertband.co.uk/', NULL, NULL, '{}'::text[]),
    ('Southdowns Concert Band', 'Concert Band', 'Walberton', 'West Sussex', 'BN18 0PJ', NULL, 'https://www.southdowns-concertband.co.uk/', NULL, 'For experienced players.', '{}'::text[]),
    ('West Chiltington Silver Band', 'Brass Band', 'West Chiltington', 'West Sussex', NULL, 'Non-contesting', 'https://www.westchiltsilverband.com/', NULL, NULL, '{}'::text[]),
    ('Petworth Town Band', 'Wind Band', 'Petworth', 'West Sussex', NULL, NULL, 'https://www.petworthtownband.com/', NULL, 'A town band of brass, woodwind and percussion.', '{}'::text[]),
    ('Chichester City Band', 'Brass Band', 'Chichester', 'West Sussex', NULL, 'Third', 'https://chichestercityband.co.uk/', NULL, NULL, '{}'::text[]),
    ('Chichester City Community Brass Band', 'Training Band', 'Chichester', 'West Sussex', NULL, NULL, 'https://chichestercityband.co.uk/join/', 'Chichester City Band', 'For juniors and less experienced players of all ages.', '{}'::text[]),
    ('Bognor Regis Concert Band', 'Concert Band', 'Felpham, Bognor Regis', 'West Sussex', 'PO22 8EL', NULL, 'https://bognorregisconcertband.co.uk/', NULL, NULL, '{}'::text[]),
    ('Liss Band', 'Brass Band', 'Liss', 'Hampshire', NULL, NULL, 'https://lissband.co.uk/', NULL, NULL, '{}'::text[]),
    ('Liss Band Training Section', 'Training Band', 'Liss', 'Hampshire', NULL, NULL, 'https://lissband.co.uk/', 'Liss Band', 'For younger or returning players.', '{}'::text[]),
    ('Blendworth Brass Band', 'Brass Band', 'Horndean', 'Hampshire', NULL, 'Non-contesting', 'https://blendworthbrassband.co.uk/', NULL, NULL, '{}'::text[]),
    ('Denmead Brass', 'Brass Band', 'Denmead', 'Hampshire', 'PO7 6LU', 'Second', 'https://denmeadbrass.org.uk/', NULL, 'Formerly Cosham Concert Brass.', '{}'::text[]),
    ('Denmead Training Band', 'Training Band', 'Denmead', 'Hampshire', 'PO7 6LU', NULL, 'https://denmeadbrass.org.uk/', 'Denmead Brass', NULL, '{}'::text[]),
    ('Hangleton Band', 'Brass Band', 'Hove', 'East Sussex', 'BN3 8LF', 'Third', 'https://www.hangletonband.co.uk/', NULL, NULL, '{}'::text[]),
    ('Hangleton Youth Band', 'Youth Brass Band', 'Hove', 'East Sussex', 'BN3 8LF', NULL, 'https://www.hangletonband.co.uk/bands', 'Hangleton Band', 'Ages 8-19, beginners welcome.', '{}'::text[]),
    ('Patcham Silver Band', 'Brass Band', 'Patcham, Brighton', 'East Sussex', NULL, 'Fourth', 'https://patchamsilverband.org/', NULL, NULL, '{}'::text[]),
    ('Patcham Silver Band Youth Band', 'Youth Brass Band', 'Patcham, Brighton', 'East Sussex', NULL, NULL, 'https://patchamsilverband.org/brighton-brass-band/youth-band/', 'Patcham Silver Band', 'For ages 5-18 and learners.', '{}'::text[]),
    ('Brighton and Hove City Brass', 'Brass Band', 'Woodingdean, Brighton', 'East Sussex', 'BN2 6PA', 'Fourth', 'https://www.brightonbrass.co.uk/', NULL, NULL, '{}'::text[]),
    ('Create Music Youth Wind Orchestra', 'Youth Wind Band', 'Brighton', 'East Sussex', 'BN2 4AF', NULL, 'https://createmusic.org.uk/for-children-and-young-people/music-groups/create-music-youth-wind-orchestra/', NULL, 'A Create Music (Brighton & Hove music hub) ensemble for young players, Grades 5-8.', '{}'::text[]),
    ('Brighton & Hove Concert Band', 'Youth Wind Band', 'Brighton', 'East Sussex', 'BN1 6NP', NULL, 'https://createmusic.org.uk/for-children-and-young-people/music-groups/bhmc-sat-concert-band/', NULL, 'A Create Music (Brighton & Hove music hub) ensemble for young players, Grades 3-4.', '{}'::text[]),
    ('Brighton & Hove Wind Band', 'Training Band', 'Brighton', 'East Sussex', 'BN1 6NP', NULL, 'https://createmusic.org.uk/for-children-and-young-people/music-groups/bhmc-sat-wind-band/', NULL, 'A Create Music (Brighton & Hove music hub) ensemble for young players, Grades 1-3.', '{}'::text[]),
    ('Brighton & Hove Brass Ensemble', 'Youth Brass Band', 'Brighton', 'East Sussex', 'BN1 6NP', NULL, 'https://createmusic.org.uk/for-children-and-young-people/music-groups/bhmc-brass-ensemble/', NULL, 'A Create Music (Brighton & Hove music hub) ensemble for young players, Grades 2-3.', '{}'::text[]);

DO $$
DECLARE
    s RECORD;
    found BIGINT;
    owner BIGINT;
BEGIN
    SELECT id INTO owner FROM accounts WHERE account_level = 'super_admin' ORDER BY id LIMIT 1;
    IF owner IS NULL THEN SELECT id INTO owner FROM accounts ORDER BY id LIMIT 1; END IF;
    IF owner IS NULL THEN RETURN; END IF; -- an empty database has no one to own them - nothing to seed

    FOR s IN SELECT * FROM band_seed ORDER BY ord LOOP
        -- ML-473: only directory entries - never a member's own label or a band's shared space
        SELECT b.id INTO found FROM bands b
         WHERE b.kind = 'directory' AND (lower(b.name) = lower(s.name)
            OR b.name = ANY (s.old_names)
            OR (s.parent_name IS NULL AND b.website IS NOT NULL AND s.website NOT LIKE '%surreycc.gov.uk%' AND s.website NOT LIKE '%hants.gov.uk%' AND s.website NOT LIKE '%hantsmusichub.org.uk%' AND s.website NOT LIKE '%westsussexmusic.co.uk%' AND s.website NOT LIKE '%createmusic.org.uk%' AND s.website NOT LIKE '%facebook.com%' AND s.website NOT LIKE '%wordpress.com%'
                AND lower(regexp_replace(regexp_replace(b.website, '^https?://(www\.)?', ''), '/.*$', '')) = lower(regexp_replace(regexp_replace(s.website, '^https?://(www\.)?', ''), '/.*$', ''))))
         ORDER BY (lower(b.name) = lower(s.name)) DESC, (b.name = ANY (s.old_names)) DESC, b.id
         LIMIT 1;
        IF found IS NULL THEN
            INSERT INTO bands (kind, name, website, created_by_account_id, ensemble_type, town, county, rehearsal_postcode, section_level, notes)
            VALUES ('directory', s.name, s.website, owner, s.ensemble_type, s.town, s.county, s.rehearsal_postcode, s.section_level, s.notes)
            RETURNING id INTO found;
        ELSE
            UPDATE bands SET name = s.name, website = s.website, active = true, ensemble_type = s.ensemble_type, town = s.town,
                   county = s.county, rehearsal_postcode = s.rehearsal_postcode, section_level = s.section_level, notes = s.notes
             WHERE id = found;
        END IF;
        UPDATE band_seed SET band_id = found WHERE ord = s.ord;
    END LOOP;

    -- The parent: in this list, else already in the directory (a main main band, one level only).
    UPDATE bands c SET parent_band_id = COALESCE(
            (SELECT par.band_id FROM band_seed par WHERE lower(par.name) = lower(kid.parent_name)),
            (SELECT b.id FROM bands b WHERE b.kind = 'directory' AND lower(b.name) = lower(kid.parent_name) AND b.parent_band_id IS NULL ORDER BY b.id LIMIT 1))
      FROM band_seed kid
     WHERE c.id = kid.band_id AND kid.parent_name IS NOT NULL;
END
$$;
