-- ML-613: five Instrument support listings had no email although each business publishes one on its own contact
-- page (checked 25 Oct 2026, while making the list for the Article 14 emails, ML-610). Fills an empty email only,
-- so a change made on Admin -> Instrument support since is never overwritten.
UPDATE support_businesses b SET email = v.email, updated_at = now()
  FROM (VALUES
    ('heritage music', 'sales@heritage-music.co.uk'),
    ('howarth of london', 'sales@howarthlondon.com'),
    ('john packer', 'sales@johnpacker.co.uk'),
    ('ritz music', 'hello@ritzmusicstudio.com'),
    ('wessex tubas', 'coda@wessex-tubas.com')
  ) AS v(name, email)
 WHERE lower(b.name) = v.name AND (b.email IS NULL OR b.email = '');
