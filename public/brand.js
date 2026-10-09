// The app's name. It was "The Music Ledger" (a working title) until it was renamed Notably Better; for
// two days before that, ML-484 let a super admin switch the name on screen between three candidates.
// That switch is gone - there is one name, and the pictures that go with it are written straight into
// the pages (images/brands/notably-better-*). docs/app-name.md.
//
// Write the app's name on screen with Brand.name(), never as a new literal, so it is in one place.
(function () {
    'use strict';
    const NAME = 'Notably Better';
    try { localStorage.removeItem('tml.brand'); } catch (e) { /* the trial's remembered choice - nothing reads it now */ }
    window.Brand = { name: () => NAME };
})();
