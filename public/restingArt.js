// The "nothing waiting" drawing: someone relaxing back in a deckchair with a euphonium. One drawing for each empty
// screen that means "you're all done here" - Notifications (app.js) and Admin -> Waiting list (owner, 29 Oct 2026) -
// so they always match. Lines in the label colour, the instrument filled with the page colour so it hides the lines
// behind it (.notifications-empty-art in style.css): both follow the theme and the background tint. Decoration only.
(function () {
    'use strict';
    const SVG = `<svg class="notifications-empty-art" viewBox="0 0 240 170" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">
            <path d="M18 40 L66 152"/><path d="M66 134 C102 128 140 126 176 128"/><path d="M158 128 L176 156"/><path d="M90 132 L70 156"/><path d="M12 158 H228"/>
            <circle cx="48" cy="46" r="14"/><path d="M36 38 C40 28 54 26 60 34"/><path d="M45 45 q3 -2.5 6 0"/><path d="M50 53 q4 3.5 9 0"/>
            <path d="M38 60 C46 86 58 110 70 130"/><path d="M60 58 C70 78 82 98 96 122"/>
            <path d="M96 122 C110 108 124 98 138 94 C150 104 164 118 176 126"/><path d="M82 132 C102 124 120 114 134 110 C146 118 158 128 170 136"/><path d="M176 126 C184 122 194 122 198 128 C196 134 184 136 170 136"/>
            <path d="M52 64 C72 80 96 80 112 70"/>
            <g class="is-solid"><path d="M77 22 C86 38 89 56 89 90 C89 114 122 116 122 94 L122 72 L113 72 L113 94 C113 104 102 104 102 90 C102 56 105 38 115 22 Z"/><ellipse cx="96" cy="22" rx="19" ry="5"/><rect x="110" y="56" width="15" height="17" rx="2.5"/></g>
            <path d="M113.5 56 v-5 M117.5 56 v-5 M121.5 56 v-5"/><path d="M110 62 C94 56 80 54 62 52"/>
            <path d="M56 70 C62 88 72 100 92 100"/>
        </svg>`;
    window.RestingArt = { svg: () => SVG };
})();
