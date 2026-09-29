-- The shared band directory gets the details a band picker needs - what kind of band, where it
-- rehearses, its brass band section, and which band it belongs to (a youth or training band, a
-- second band) - and its first real list: concert, wind and brass bands within about 15 miles of
-- Woking and Guildford, including the ones just over the border in Hampshire, Berkshire and London.
--
-- The list was researched on 2026-09-29 and every band checked on a real web page (its own site where
-- it has one, brassbandresults.co.uk for sections, Surrey Arts for the county youth ensembles). No
-- contact emails or people's names. Postcodes only where a page gave them.
--
-- A band already in the directory isn't added twice: a seed band updates an existing one with the
-- same name, one of its old names (the Sheet-era labels "Bourne", "Cobham Main", "Cobham Training"
-- on production - renamed to their full names here), or - for a band with no parent - the same
-- website. Its members and session history stay with it.

ALTER TABLE bands ADD COLUMN ensemble_type TEXT CHECK (ensemble_type IN (
    'Brass Band', 'Concert Band', 'Wind Band', 'Youth Brass Band', 'Youth Wind Band', 'Training Band', 'Brass Ensemble', 'Massed Band'));
ALTER TABLE bands ADD COLUMN town TEXT;
ALTER TABLE bands ADD COLUMN county TEXT;
ALTER TABLE bands ADD COLUMN rehearsal_postcode TEXT;
-- Brass band contest grading (brassbandresults.co.uk); null for everything else.
ALTER TABLE bands ADD COLUMN section_level TEXT CHECK (section_level IN ('Championship', 'First', 'Second', 'Third', 'Fourth', 'Non-contesting'));
-- A youth band, training band or second band belongs to its main band.
ALTER TABLE bands ADD COLUMN parent_band_id BIGINT REFERENCES bands(id) ON DELETE SET NULL;
-- Anything a player should know that doesn't fit a column - e.g. it meets once a year, or it's invitation-only.
ALTER TABLE bands ADD COLUMN notes TEXT;

CREATE INDEX idx_bands_parent ON bands (parent_band_id);

CREATE TEMP TABLE band_seed (
    ord SERIAL, name TEXT, ensemble_type TEXT, town TEXT, county TEXT, rehearsal_postcode TEXT,
    section_level TEXT, website TEXT, parent_name TEXT, notes TEXT, old_names TEXT[] DEFAULT '{}', band_id BIGINT
) ON COMMIT DROP;

INSERT INTO band_seed (name, ensemble_type, town, county, rehearsal_postcode, section_level, website, parent_name, notes) VALUES
    ('Woking Wind Orchestra', 'Wind Band', 'Woking', 'Surrey', 'GU22 9PR', NULL, 'http://wokingwindorchestra.org.uk/', NULL, NULL),
    ('West Surrey Wind Band', 'Youth Wind Band', 'Woking', 'Surrey', 'GU22 9PR', NULL, 'https://www.surreycc.gov.uk/culture-and-leisure/arts/music/ensembles/west-wind', NULL, 'A Surrey Arts (Surrey County Council) county ensemble for young players.'),
    ('Surrey Advanced Brass Ensemble', 'Youth Brass Band', 'Woking', 'Surrey', 'GU22 9PR', NULL, 'https://www.surreycc.gov.uk/culture-and-leisure/arts/music/ensembles/advanced-brass', NULL, 'A Surrey Arts (Surrey County Council) county ensemble for young players.'),
    ('Almac Bisley Brass Band', 'Brass Band', 'Bisley', 'Surrey', 'GU24 9EG', 'Non-contesting', 'https://almacbisleybrassband.org/', NULL, NULL),
    ('Bourne Concert Band of Woking', 'Concert Band', 'Addlestone', 'Surrey', 'KT15 3DH', NULL, 'https://www.bourneconcertband.org.uk/', NULL, NULL),
    ('Friary Brass Band', 'Brass Band', 'Chertsey', 'Surrey', NULL, 'Championship', 'https://www.friarybrassband.com/', NULL, NULL),
    ('Surrey Police Band', 'Concert Band', 'Guildford', 'Surrey', 'GU3 1HG', NULL, 'https://www.surreypoliceband.org.uk/', NULL, NULL),
    ('Surrey County Youth Wind Orchestra', 'Youth Wind Band', 'Guildford', 'Surrey', 'GU1 2TN', NULL, 'https://www.surreycc.gov.uk/culture-and-leisure/arts/music/ensembles/youth-wind', NULL, 'A Surrey Arts (Surrey County Council) county ensemble for young players.'),
    ('South West Surrey Concert Band', 'Youth Wind Band', 'Guildford', 'Surrey', 'GU1 2TN', NULL, 'https://www.swsconcertband.co.uk/', NULL, NULL),
    ('South West Surrey Concert Band Juniors', 'Training Band', 'Guildford', 'Surrey', 'GU1 2TN', NULL, 'https://www.swsconcertband.co.uk/', 'South West Surrey Concert Band', NULL),
    ('South West Winds', 'Youth Wind Band', 'Chilworth', 'Surrey', 'GU4 8NB', NULL, 'https://www.surreycc.gov.uk/culture-and-leisure/arts/music/ensembles/south-west-wind', NULL, 'A Surrey Arts (Surrey County Council) county ensemble for young players.'),
    ('The Cobham Band', 'Brass Band', 'Cobham', 'Surrey', 'KT11 3EJ', 'Third', 'https://thecobhamband.org/', NULL, NULL),
    ('The Cobham Training Band', 'Training Band', 'Cobham', 'Surrey', 'KT11 3EJ', NULL, 'https://thecobhamband.org/the-band/the-cobham-training-band', 'The Cobham Band', NULL),
    ('Camberley and District Silver Band', 'Brass Band', 'Frimley', 'Surrey', NULL, 'Fourth', 'https://camberleyband.org.uk/', NULL, NULL),
    ('Farnborough Concert Band of the Royal British Legion', 'Concert Band', 'Frimley', 'Surrey', NULL, NULL, 'https://www.farnboroughconcertband.org/', NULL, NULL),
    ('Bagshot Concert Band', 'Concert Band', 'Bagshot', 'Surrey', 'GU19 5EQ', NULL, 'http://www.bagshotconcertband.org.uk/', NULL, NULL),
    ('Camberley Youth Wind Orchestra', 'Youth Wind Band', 'Camberley', 'Surrey', 'GU15 4DR', NULL, 'https://www.surreycc.gov.uk/culture-and-leisure/arts/music/ensembles/camberley-youth', NULL, 'A Surrey Arts (Surrey County Council) county ensemble for young players.'),
    ('The Egham Band', 'Brass Band', 'Egham', 'Surrey', 'TW20 9LF', 'First', 'https://www.theeghamband.org.uk/', NULL, NULL),
    ('Egham Youth Band', 'Youth Brass Band', 'Egham', 'Surrey', 'TW20 9LF', NULL, 'https://www.theeghamband.org.uk/', 'The Egham Band', NULL),
    ('Egham Training Band', 'Training Band', 'Egham', 'Surrey', 'TW20 9LF', NULL, 'https://www.theeghamband.org.uk/', 'The Egham Band', NULL),
    ('Egham Community Band', 'Brass Band', 'Egham', 'Surrey', 'TW20 9LF', 'Non-contesting', 'https://www.theeghamband.org.uk/', 'The Egham Band', NULL),
    ('Godalming Band', 'Brass Band', 'Farncombe, Godalming', 'Surrey', 'GU7 3BH', 'Third', 'https://godalmingband.org.uk/', NULL, NULL),
    ('Godalming Youth Band', 'Youth Brass Band', 'Farncombe, Godalming', 'Surrey', 'GU7 3BH', NULL, 'https://godalmingband.org.uk/youth-band/', 'Godalming Band', NULL),
    ('Staines Brass', 'Brass Band', 'Staines-upon-Thames', 'Surrey', 'TW18 4UA', 'Second', 'https://www.stainesbrassband.co.uk/', NULL, NULL),
    ('Staines Lammas Band', 'Brass Band', 'Staines-upon-Thames', 'Surrey', 'TW18 4UA', 'Non-contesting', 'https://www.stainesbrassband.co.uk/', 'Staines Brass', NULL),
    ('Surrey Brass', 'Brass Ensemble', 'Fetcham, Leatherhead', 'Surrey', NULL, NULL, 'https://surreybrass.co.uk/', NULL, 'An invitation-only brass ensemble.'),
    ('Rushmoor Concert Band', 'Concert Band', 'Farnborough', 'Hampshire', 'GU14 0FE', NULL, 'https://www.rushmoorconcertband.org/', NULL, NULL),
    ('Cove Brass', 'Brass Band', 'Cove, Farnborough', 'Hampshire', 'GU14 9RT', 'Non-contesting', 'http://www.covebrass.co.uk/', NULL, NULL),
    ('Alder Valley Brass', 'Brass Band', 'Farnham', 'Surrey', 'GU9 9HF', 'Second', 'https://www.aldervalleybrass.org.uk/', NULL, NULL),
    ('Farnham Brass Band', 'Brass Band', 'Tilford, Farnham', 'Surrey', 'GU10 2DA', 'Non-contesting', 'https://www.farnhambrassband.org.uk/', NULL, NULL),
    ('Farnham Brass Band Training Band', 'Training Band', 'Tilford, Farnham', 'Surrey', 'GU10 2DA', NULL, 'https://www.farnhambrassband.org.uk/about', 'Farnham Brass Band', NULL),
    ('Surrey Symphonic Wind Band', 'Wind Band', 'Farnham', 'Surrey', NULL, NULL, 'https://surreysymphonicwindband.wordpress.com/', NULL, 'Performs at Farnham Maltings; rehearsal venue not stated'),
    ('Mole Valley Silver Band', 'Brass Band', 'Dorking', 'Surrey', NULL, NULL, 'https://www.molevalleysilverband.co.uk/', NULL, NULL),
    ('Mole Valley Silver Band Training Band', 'Training Band', 'Dorking', 'Surrey', 'RH4 1LY', NULL, 'https://www.molevalleysilverband.co.uk/training-band/', 'Mole Valley Silver Band', NULL),
    ('Mid Surrey Wind Band', 'Youth Wind Band', 'Dorking', 'Surrey', 'RH4 1LY', NULL, 'https://www.surreycc.gov.uk/culture-and-leisure/arts/music/ensembles/mid-surrey-wind', NULL, 'A Surrey Arts (Surrey County Council) county ensemble for young players.'),
    ('Mid Surrey Training Band', 'Training Band', 'Dorking', 'Surrey', 'RH4 1LY', NULL, 'https://www.surreycc.gov.uk/culture-and-leisure/arts/music/ensembles/mid-surrey-wind', NULL, 'A Surrey Arts (Surrey County Council) county ensemble for young players.'),
    ('Epsom & Ewell Silver Band', 'Brass Band', 'Epsom', 'Surrey', 'KT18 7AA', 'First', 'http://www.eesb.org.uk/', NULL, NULL),
    ('Haslemere Town Band', 'Brass Band', 'Beacon Hill, Hindhead', 'Surrey', 'GU26 6NL', 'Non-contesting', 'https://www.haslemeretownband.co.uk/', NULL, NULL),
    ('Haslemere Town Band Training Band', 'Training Band', 'Beacon Hill, Hindhead', 'Surrey', 'GU26 6NL', NULL, 'https://www.haslemeretownband.co.uk/join.html', 'Haslemere Town Band', NULL),
    ('Sandhurst Silver Band', 'Brass Band', 'Sandhurst', 'Berkshire', NULL, 'Championship', 'https://www.sandhurstband.co.uk/', NULL, NULL),
    ('Sandhurst Community Brass', 'Brass Band', 'Sandhurst', 'Berkshire', NULL, 'Non-contesting', 'https://www.sandhurstband.co.uk/bands', 'Sandhurst Silver Band', NULL),
    ('Brasshoppers', 'Training Band', 'Sandhurst', 'Berkshire', NULL, NULL, 'https://www.sandhurstband.co.uk/bands', 'Sandhurst Silver Band', NULL),
    ('Bracknell & Wokingham Community Band', 'Wind Band', 'Finchampstead', 'Berkshire', NULL, NULL, 'https://www.bwcb.org/', NULL, NULL),
    ('Linden Wind Orchestra', 'Wind Band', 'Surbiton', 'Greater London', NULL, NULL, 'https://www.lindenwindorchestra.org.uk/', NULL, NULL),
    ('Big and Brassy', 'Massed Band', 'Crowthorne', 'Berkshire', NULL, NULL, 'https://bigandbrassy.co.uk/', NULL, 'Meets once a year: a charity massed band weekend for players from small non-contesting brass bands in Hampshire and Surrey.');

UPDATE band_seed SET old_names = '{Bourne}' WHERE name = 'Bourne Concert Band of Woking';
UPDATE band_seed SET old_names = '{Cobham Main}' WHERE name = 'The Cobham Band';
UPDATE band_seed SET old_names = '{Cobham Training}' WHERE name = 'The Cobham Training Band';

DO $$
DECLARE
    s RECORD;
    found BIGINT;
    owner BIGINT;
BEGIN
    -- The seeded bands are the directory's, so they're "created by" the super admin.
    SELECT id INTO owner FROM accounts WHERE account_level = 'super_admin' ORDER BY id LIMIT 1;
    IF owner IS NULL THEN SELECT id INTO owner FROM accounts ORDER BY id LIMIT 1; END IF;
    IF owner IS NULL THEN RETURN; END IF; -- an empty database has no one to own them - nothing to seed

    FOR s IN SELECT * FROM band_seed ORDER BY ord LOOP
        SELECT b.id INTO found FROM bands b
         WHERE lower(b.name) = lower(s.name)
            OR b.name = ANY (s.old_names)
            OR (s.parent_name IS NULL AND b.website IS NOT NULL
                AND lower(regexp_replace(regexp_replace(b.website, '^https?://(www\.)?', ''), '/.*$', ''))
                  = lower(regexp_replace(regexp_replace(s.website, '^https?://(www\.)?', ''), '/.*$', ''))
                AND s.website NOT LIKE '%surreycc.gov.uk%')
         ORDER BY (lower(b.name) = lower(s.name)) DESC, (b.name = ANY (s.old_names)) DESC, b.id
         LIMIT 1;
        IF found IS NULL THEN
            INSERT INTO bands (name, website, created_by_account_id, ensemble_type, town, county, rehearsal_postcode, section_level, notes)
            VALUES (s.name, s.website, owner, s.ensemble_type, s.town, s.county, s.rehearsal_postcode, s.section_level, s.notes)
            RETURNING id INTO found;
        ELSE
            UPDATE bands SET name = s.name, website = s.website, active = true, ensemble_type = s.ensemble_type, town = s.town,
                   county = s.county, rehearsal_postcode = s.rehearsal_postcode, section_level = s.section_level, notes = s.notes
             WHERE id = found;
        END IF;
        UPDATE band_seed SET band_id = found WHERE ord = s.ord;
    END LOOP;

    UPDATE bands c SET parent_band_id = par.band_id
      FROM band_seed kid JOIN band_seed par ON par.name = kid.parent_name
     WHERE c.id = kid.band_id;
END
$$;
