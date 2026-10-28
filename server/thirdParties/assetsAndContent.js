// ML-267: fonts and icons, and other people's content and ideas the app follows.
// See register.js for what each field means.

const CHECKED = '2026-10-04';

const OFL = [
  { label: 'SIL Open Font License 1.1', url: 'https://openfontlicense.org/open-font-license-official-text/' }
];
const OFL_SAYS = [
  'The font may be used in an app, including a paid one.',
  'It can\'t be sold on its own.',
  'A changed version (cutting it down or converting it ourselves would count) can\'t keep the font\'s reserved name.',
  'The authors\' names can\'t be used to promote the app.'
];

export const assets = [
  {
    key: 'font-bravura',
    name: 'Bravura',
    group: 'asset',
    status: 'in_use',
    who: 'Steinberg Media Technologies GmbH (Germany)',
    provides: 'The music font: every note, clef, key signature and symbol the app draws.',
    usedIn: 'public/notation.js; hosted by us in public/fonts/',
    cost: 'Free',
    licence: 'SIL Open Font License 1.1 - reserved name "Bravura"',
    terms: [{ label: 'Bravura', url: 'https://github.com/steinbergmedia/bravura' }, ...OFL],
    licenceFile: 'public/fonts/Bravura-LICENSE.txt',
    termsCheckedOn: CHECKED,
    says: OFL_SAYS,
    asks: [
      { text: 'Keep the copyright notice and licence with the font.', check: { path: 'public/fonts/Bravura-LICENSE.txt' } },
      { text: 'Use the published file unchanged.' }
    ],
    files: ['public/fonts/bravura.woff2']
  },
  {
    key: 'font-opendyslexic',
    name: 'OpenDyslexic',
    group: 'asset',
    status: 'in_use',
    who: 'Abbie Gonzalez',
    provides: 'A reading font choice in Settings → Display and reading.',
    usedIn: 'public/tokens.css, public/display-prefs.js; hosted by us in public/fonts/',
    cost: 'Free',
    licence: 'SIL Open Font License 1.1 - reserved name "OpenDyslexic"',
    terms: [{ label: 'OpenDyslexic', url: 'https://opendyslexic.org' }, { label: 'Source', url: 'https://github.com/antijingoist/opendyslexic' }, ...OFL],
    licenceFile: 'public/fonts/OpenDyslexic-LICENSE.txt',
    termsCheckedOn: CHECKED,
    says: OFL_SAYS,
    asks: [
      { text: 'Keep the copyright notice and licence with the font.', check: { path: 'public/fonts/OpenDyslexic-LICENSE.txt' } },
      { text: 'Use the published files unchanged (downloaded 29 Sep 2026 from the official repo).' }
    ],
    files: ['public/fonts/opendyslexic-regular.woff2', 'public/fonts/opendyslexic-bold.woff2']
  },
  {
    key: 'font-lexend',
    name: 'Lexend',
    group: 'asset',
    status: 'in_use',
    who: 'The Lexend Project',
    provides: 'A reading font choice in Settings → Display and reading.',
    usedIn: 'public/tokens.css, public/display-prefs.js; hosted by us in public/fonts/',
    cost: 'Free',
    licence: 'SIL Open Font License 1.1 - reserved name "RevReading Lexend"',
    terms: [{ label: 'Lexend', url: 'https://www.lexend.com' }, { label: 'Source', url: 'https://github.com/googlefonts/lexend' }, ...OFL],
    licenceFile: 'public/fonts/Lexend-LICENSE.txt',
    termsCheckedOn: CHECKED,
    says: OFL_SAYS,
    asks: [
      { text: 'Keep the copyright notice and licence with the font.', check: { path: 'public/fonts/Lexend-LICENSE.txt' } },
      { text: 'Use the published files unchanged (Google Fonts\' own Latin files, downloaded 29 Sep 2026).' }
    ],
    files: ['public/fonts/lexend-latin.woff2', 'public/fonts/lexend-latin-ext.woff2']
  },
  {
    key: 'font-inter',
    name: 'Inter',
    group: 'asset',
    status: 'in_use',
    who: 'Rasmus Andersson and the Inter Project authors',
    provides: 'The font for all the app\'s ordinary text.',
    usedIn: 'public/tokens.css (--font-sans), declared in public/style.css; hosted by us in public/fonts/ since ML-430',
    cost: 'Free',
    licence: 'SIL Open Font License 1.1 - reserved name "Inter"',
    terms: [{ label: 'Inter', url: 'https://rsms.me/inter/' }, { label: 'Source', url: 'https://github.com/rsms/inter' }, ...OFL],
    licenceFile: 'public/fonts/Inter-LICENSE.txt',
    termsCheckedOn: CHECKED,
    says: OFL_SAYS,
    asks: [
      { text: 'Keep the copyright notice and licence with the font.', check: { path: 'public/fonts/Inter-LICENSE.txt' } },
      { text: 'Use the published files unchanged (Google Fonts\' own Latin files, downloaded 4 Oct 2026).' }
    ],
    files: ['public/fonts/inter-latin.woff2', 'public/fonts/inter-latin-ext.woff2']
  },
  {
    key: 'font-noto-music',
    name: 'Noto Music',
    group: 'asset',
    status: 'in_use',
    who: 'Google LLC - the Noto Project authors',
    provides: 'A few music symbols written as text (segno, coda).',
    usedIn: 'public/tokens.css (--font-music), declared in public/style.css; hosted by us in public/fonts/ since ML-430',
    cost: 'Free',
    licence: 'SIL Open Font License 1.1',
    terms: [{ label: 'Noto Music', url: 'https://fonts.google.com/noto/specimen/Noto+Music' }, { label: 'Source', url: 'https://github.com/notofonts/music' }, ...OFL],
    licenceFile: 'public/fonts/NotoMusic-LICENSE.txt',
    termsCheckedOn: CHECKED,
    says: OFL_SAYS,
    asks: [
      { text: 'Keep the copyright notice and licence with the font.', check: { path: 'public/fonts/NotoMusic-LICENSE.txt' } },
      { text: 'Use the published files unchanged (Google Fonts\' own files, downloaded 4 Oct 2026).' }
    ],
    files: ['public/fonts/noto-music.woff2', 'public/fonts/noto-music-latin.woff2', 'public/fonts/noto-music-latin-ext.woff2']
  },
  {
    key: 'icons-material-symbols',
    name: 'Material Symbols',
    group: 'asset',
    status: 'in_use',
    who: 'Google LLC',
    provides: 'Every icon in the app.',
    usedIn: 'Every .material-symbols-outlined icon (public/tokens.css --font-icons, declared in public/style.css); hosted by us in public/fonts/ since ML-430',
    cost: 'Free',
    licence: 'Apache License 2.0',
    licenceFile: 'public/fonts/MaterialSymbols-LICENSE.txt',
    terms: [
      { label: 'Material Symbols', url: 'https://fonts.google.com/icons' },
      { label: 'Apache License 2.0', url: 'https://www.apache.org/licenses/LICENSE-2.0' }
    ],
    termsCheckedOn: CHECKED,
    says: [
      'Free to use, including commercially.',
      'If we pass the files on (host or copy them), a copy of the licence and any notices must go with them, and changed files must be marked.',
      'No right to use Google\'s names or trade marks.'
    ],
    asks: [
      { text: 'Keep a copy of the Apache 2.0 licence with the font.', check: { path: 'public/fonts/MaterialSymbols-LICENSE.txt' } },
      { text: 'Use the published file unchanged (Google Fonts\' own file, made by Google for just the icons we name - icon_names - by npm run icon-font; ML-650, 28 Oct 2026). A changed file would have to be marked as changed.' }
    ],
    watch: ['Since ML-650 the file holds only the icons the app names (about 500, 454 KB - it was every icon, 4 MB, slow enough that members saw the icons\' names). A new icon needs npm run icon-font; server/test/iconFont.test.js fails until it is in (specs/components/utilities-and-states.md, "Icons while the icon font loads"). Google Fonts is only asked when that script runs - visitors load nothing from Google.'],
    files: ['public/fonts/material-symbols-outlined.woff2', 'public/fonts/icons.json'],
    hosts: ['fonts.google.com', 'fonts.googleapis.com', 'fonts.gstatic.com']
  }
];

export const content = [
  {
    key: 'abrsm',
    name: 'ABRSM syllabuses',
    group: 'content',
    status: 'attention',
    who: 'The Associated Board of the Royal Schools of Music (England and Wales, charity 292182)',
    provides: 'The Scales tool\'s Grade 1-8 lists for brass and woodwind, the guide speeds for scales, and what each Theory grade covers (our own selection and wording).',
    usedIn: 'public/scaleGrades.js, PracticePlan.SCALE_SPEEDS in public/practicePlan.js, public/theoryEngine.js; docs/scales-grades.md',
    cost: 'Nothing paid. No permission has been given.',
    licence: 'Not licensed - ABRSM\'s copyright. Permission is being asked (ML-313).',
    terms: [
      { label: 'ABRSM licensing and permissions', url: 'https://www.abrsm.org/en-gb/more-information/licensing' }
    ],
    termsCheckedOn: CHECKED,
    attention: [
      'ABRSM\'s licensing page says every part of a syllabus needs permission to reproduce, names scales and arpeggios "as they are grouped" in the graded syllabuses, and gives an app offering a practice tool for graded scales as an example that needs permission. That describes the Scales tool. Ask through the "Make a request" form on that page.'
    ],
    says: [
      'All syllabus content is ABRSM\'s copyright and may not be reproduced without permission.',
      'The logo is protected too.',
      'No fee or email address is published; the route is the request form.'
    ],
    asks: [
      { text: 'Show the disclaimer on About: not affiliated with, endorsed by or approved by ABRSM.', check: { path: 'public/app.html', includes: 'affiliated with, endorsed by or approved by ABRSM' } },
      { text: 'Show the disclaimer with the grade lists in the Scales pop-up.', check: { path: 'public/app.html', includes: 'id="scalesGradeDisclaimer"' } },
      { text: 'Never use ABRSM\'s logo, or wording that suggests they approve of the app.' },
      { text: 'Record ABRSM\'s reply here when it comes. Before adding another exam board, check its terms first.' }
    ],
    watch: [
      'A paid Premium tier makes a fee or an objection more likely.',
      'If refused: drop the grade lists and the name, and keep "Everything else" and the player\'s own list; use our own speeds.',
      'This is not a legal opinion. Whether a grouping of scales can be protected at all is a question for a lawyer.'
    ],
    hosts: ['abrsm.org']
  },
  {
    key: 'uk-postcode-place-data',
    name: 'UK postcode and place data (ONS Postcode Directory, OS Open Names)',
    group: 'content',
    status: 'in_use',
    who: 'Office for National Statistics, Ordnance Survey and Royal Mail (Crown copyright and Royal Mail copyright), served to us by postcodes.io',
    provides: 'Where a postcode, town or village is - used only to work out how far a business in Instrument support is from a member\'s bands (ML-610). The positions are kept in place_locations; nothing from the data is shown except the place names and counties in the "Another town" search.',
    usedIn: 'server/services/instrumentSupport.js; scripts/instrument-support-seed-migration.mjs; the credit line on the Instrument support screen (public/app.html); docs/instrument-support.md',
    cost: 'Free',
    licence: 'Open Government Licence v3.0 (the ONS Postcode Directory includes Royal Mail and Ordnance Survey data, free to use under it)',
    terms: [
      { label: 'Open Government Licence v3.0', url: 'https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/' },
      { label: 'ONS licences (postcode products)', url: 'https://www.ons.gov.uk/methodology/geography/licences' },
      { label: 'postcodes.io data sources', url: 'https://postcodes.io/docs/overview' }
    ],
    termsCheckedOn: CHECKED,
    says: [
      'Free to copy, adapt and use commercially, as long as the source is credited and it isn\'t suggested the data\'s owners endorse us.',
      'The ONS Postcode Directory carries three credits: Ordnance Survey, Royal Mail and the Office for National Statistics.'
    ],
    asks: [
      { text: 'Credit it where it is used: "Contains OS data © Crown copyright and database right; contains Royal Mail data © Royal Mail copyright and database right; source: Office for National Statistics, licensed under the Open Government Licence v3.0." - done, at the foot of the Instrument support screen.' },
      { text: 'Don\'t suggest the ONS, Ordnance Survey or Royal Mail endorse the app or the businesses listed.' }
    ],
    watch: [
      'The Royal Mail part of the ONS data is free for using the data as we do (finding positions); it is not a full address file and must not be sold or passed on as one.'
    ]
  },
  {
    key: 'takadimi',
    name: 'Takadimi',
    group: 'content',
    status: 'in_use',
    who: 'Richard Hoffman, William Pelto and John W. White (1996)',
    provides: 'The rhythm syllables (ta ka di mi) used in the Rhythm tool and its crib sheet. The crib sheet\'s drawing and wording are our own.',
    usedIn: 'public/rhythm.js; docs/rhythm.md',
    cost: 'Free',
    licence: 'No licence found. The authors\' article, charts and books are copyright; nothing found restricts using the syllables themselves.',
    terms: [
      { label: 'takadimi.net', url: 'https://www.takadimi.net/' },
      { label: 'The original article', url: 'https://takadimi.net/takadimiArticle.html' }
    ],
    termsCheckedOn: CHECKED,
    says: [
      'First published as "Takadimi: A Beat-Oriented System of Rhythm Pedagogy", Journal of Music Theory Pedagogy vol. 10 (1996).',
      'No trade mark notice or conditions of use were found on the authors\' site.'
    ],
    asks: [
      { text: 'Don\'t copy the authors\' charts, wording or exercises - the crib sheet stays our own drawing and words.' },
      { text: 'Don\'t suggest the app is official or endorsed by the authors.' }
    ],
    watch: [
      'The trade mark registers (UK and US) have not been searched. Before Premium launches, search them or email the authors for a written OK.',
      'Crediting Hoffman, Pelto and White on the crib sheet would be good practice - it isn\'t there now.'
    ]
  },
  {
    key: 'musicxml',
    name: 'MusicXML',
    group: 'content',
    status: 'in_use',
    who: 'W3C Music Notation Community Group (MakeMusic, Inc. runs musicxml.com)',
    provides: 'The file format pieces are imported and exported in. Each file we write names the format\'s definition by its web address; nothing is downloaded.',
    usedIn: 'server/services/flowMusicXml.js, flowMusicXmlReader.js; docs/flow-musicxml.md',
    cost: 'Free, royalty-free',
    licence: 'W3C Community Final Specification Agreement',
    terms: [
      { label: 'MusicXML 4.0', url: 'https://www.w3.org/2021/06/musicxml40/', dated: '1 Jun 2021' },
      { label: 'The agreement', url: 'https://www.w3.org/community/about/process/final/' }
    ],
    termsCheckedOn: CHECKED,
    says: [
      'Anyone may read and write the format, free, including commercially.',
      'Credit is only required when passing on or adapting the specification itself.'
    ],
    asks: [],
    watch: ['Nothing is asked for reading and writing files. If the format\'s definition files are ever copied into the repo, keep their copyright notice and add them here.'],
    hosts: ['musicxml.org', 'musicxml.com']
  },
  {
    key: 'band-directory',
    name: 'Band directory sources',
    group: 'content',
    status: 'in_use',
    who: 'Each band\'s own public web page',
    provides: 'The names, towns and kinds of the concert, wind and brass bands in the shared band directory.',
    usedIn: 'db/band-lists/, the band seed migrations; docs/band-directory.md',
    cost: 'Free',
    licence: 'No licence - plain facts (a name and a town) taken from each band\'s public page, one band at a time',
    terms: [],
    noTermsLink: 'There is no single source: each band is checked on its own page. The rules are in docs/band-directory.md.',
    termsCheckedOn: CHECKED,
    says: [
      'Only bands found on a real web page are added. No list or directory belonging to someone else is copied.'
    ],
    asks: [
      { text: 'Never copy another organisation\'s list of bands wholesale - check each band on its own page.' },
      { text: 'Take a band out, or correct it, if the band asks.' }
    ]
  }
];
