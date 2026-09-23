# MusicXML 4.0 schema (vendored for tests)

Official W3C MusicXML 4.0 XSD, from https://github.com/w3c/musicxml/tree/v4.0/schema, used by
`server/test/musicXmlSchema.test.js` to validate every file `flowToMusicXml` writes (ML-204).

One local change: the two `<xs:import schemaLocation="...">` lines in `musicxml.xsd` point at
the local `xml.xsd`/`xlink.xsd` files next to it rather than `http://www.musicxml.org/xsd/...`,
so validation never needs the network.
