// ML-377: the avatar next to "Hi Andrew" on the home screen - your initials, or one of these drawings
// chosen in My account > My details. No photos. Each drawing is line art on a 48x48 grid: the lines
// take the avatar's colour (currentColor), a `.is-solid` part is filled with the circle's own colour so
// it hides what's behind it, and a `.is-dot` part is a filled dot (a key, a tone hole). The ids must
// match AVATAR_IDS in server/services/accounts.js. Loaded in the browser as window.Avatars (before app.js).
(function (root, factory) {
    if (typeof module === 'object' && module.exports) module.exports = factory();
    else root.Avatars = factory();
}(typeof self !== 'undefined' ? self : this, function () {
    'use strict';

    const LIST = [
        { id: 'cornet', name: 'Cornet', svg: '<path d="M4 24 H8 M8 22 V26"/><path d="M8 24 H30"/><path d="M30 21 C35 20 39 16 44 11 V37 C39 32 35 28 30 27"/><path d="M12 24 V31 C12 34 14 35 17 35 H27 C29 35 30 34 30 31 V27"/><rect x="15" y="17" width="12" height="7" rx="1.5" class="is-solid"/><path d="M17.5 17 V13 M21 17 V13 M24.5 17 V13"/>' },
        { id: 'euphonium', name: 'Euphonium', svg: '<ellipse cx="21" cy="8" rx="9" ry="2.5"/><path d="M12 8 C16 15 17 22 17 32 C17 42 32 42 32 33 V26 M30 8 C25 15 23 22 23 32 C23 36 27 36 27 33 V26"/><rect x="25.5" y="19" width="8" height="8" rx="1.5" class="is-solid"/><path d="M27.5 19 v-3 M29.5 19 v-3 M31.5 19 v-3"/><path d="M25.5 22 C20 20 14 20 8 21"/>' },
        { id: 'trombone', name: 'Trombone', svg: '<path d="M4 14 C8 15 11 17 13 19 V29 C11 31 8 33 4 34 Z" class="is-solid"/><path d="M13 21 H38 M13 27 H26"/><path d="M22 21 H44 C46 21 46 30 44 30 H22"/><path d="M26 27 C28 27 28 21 30 21"/>' },
        { id: 'french-horn', name: 'French horn', svg: '<circle cx="21" cy="24" r="13"/><circle cx="21" cy="24" r="7.5"/><path d="M32 31 C36 34 38 38 38 44 L46 36 C40 36 36 34 33 29" class="is-solid"/><path d="M8 24 H3"/><path d="M21 16.5 V12 M24 17 V12.5 M27 18.5 V14"/>' },
        { id: 'saxophone', name: 'Saxophone', svg: '<path d="M14 4 L18 8 V32 C18 42 32 42 32 32 V26"/><path d="M28 26 C30 21 36 20 38 22"/><path d="M24 12 V32 C24 36 28 36 28 32 V26"/><circle cx="21" cy="16" r="1.4" class="is-dot"/><circle cx="21" cy="21" r="1.4" class="is-dot"/><circle cx="21" cy="26" r="1.4" class="is-dot"/>' },
        { id: 'clarinet', name: 'Clarinet', svg: '<path d="M13 5 L17 9"/><path d="M16 8 L33 34 M20 6 L37 32"/><path d="M33 34 C33 40 38 44 42 42 C44 38 41 33 37 32"/><circle cx="22" cy="14" r="1.3" class="is-dot"/><circle cx="26" cy="20" r="1.3" class="is-dot"/><circle cx="30" cy="26" r="1.3" class="is-dot"/>' },
        { id: 'flute', name: 'Flute', svg: '<path d="M6 34 L40 12 M8 38 L42 16"/><path d="M40 12 L42 16 M6 34 L8 38"/><circle cx="16" cy="30" r="1.3" class="is-dot"/><circle cx="22" cy="26" r="1.3" class="is-dot"/><circle cx="28" cy="22" r="1.3" class="is-dot"/><circle cx="34" cy="18" r="1.3" class="is-dot"/><path d="M11 32.5 l-2 -3"/>' },
        { id: 'snare-drum', name: 'Snare drum', svg: '<path d="M8 22 V34 C8 38 40 38 40 34 V22"/><ellipse cx="24" cy="22" rx="16" ry="5" class="is-solid"/><path d="M13 26 L16 35 M24 27 V37 M35 26 L32 35"/><path d="M14 4 L26 20 M36 5 L24 20"/>' },
        { id: 'metronome', name: 'Metronome', svg: '<path d="M18 5 H30 L38 42 H10 Z"/><path d="M12 34 H36"/><path d="M24 34 L33 10"/><rect x="28" y="16" width="5" height="4" rx="1" transform="rotate(21 30.5 18)" class="is-solid"/>' },
        { id: 'music-stand', name: 'Music stand', svg: '<path d="M8 8 H40 L37 24 H11 Z" class="is-solid"/><path d="M13 13 H35 M12 18 H36"/><path d="M24 24 V38"/><path d="M24 38 L14 44 M24 38 L34 44 M24 38 V44"/>' },
        { id: 'tuning-fork', name: 'Tuning fork', svg: '<path d="M18 4 V20 C18 26 30 26 30 20 V4"/><path d="M24 24 V44"/><path d="M10 10 C8 13 8 17 10 20 M38 10 C40 13 40 17 38 20"/>' },
        { id: 'headphones', name: 'Headphones', svg: '<path d="M9 30 V24 C9 14 16 8 24 8 C32 8 39 14 39 24 V30"/><rect x="6" y="26" width="8" height="13" rx="3" class="is-solid"/><rect x="34" y="26" width="8" height="13" rx="3" class="is-solid"/>' },
    ];
    const byId = (id) => LIST.find(a => a.id === id) || null;

    // Two letters from your first name and surname; one from either on its own; else your email's first letter.
    function initials({ firstName, surname, displayName, email } = {}) {
        const first = (s) => String(s || '').trim().charAt(0).toUpperCase();
        const both = first(firstName) + first(surname);
        return both || first(displayName) || first(email) || '?';
    }

    // The inside of an avatar circle: the chosen drawing, or the initials.
    function inner(profile = {}) {
        const a = byId(profile.avatar);
        if (a) return `<svg viewBox="0 0 48 48" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${a.svg}</svg>`;
        return `<span class="avatar-initials" aria-hidden="true">${initials(profile)}</span>`;
    }
    // Words for a screen reader.
    function label(profile = {}) {
        const a = byId(profile.avatar);
        return a ? `Your avatar: ${a.name}` : `Your avatar: your initials, ${initials(profile).split('').join(' ')}`;
    }

    return { LIST, byId, initials, inner, label };
}));
