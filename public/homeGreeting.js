// ML-377: the home screen's greeting and the one line of encouragement under it. Pure logic, no DOM:
// loaded in the browser (window.HomeGreeting, before app.js) and in Node by
// server/test/homeGreeting.test.js. The screen: app.js renderHomeGreeting; the rules: docs/home-greeting.md.
//
//   - The greeting follows the moment: "Nice work today", "Burning the midnight oil?", "Welcome back",
//     "Happy Saturday", else the time of day - or now and then "Ready to practise?".
//   - The line under it is one of the things that are true for you right now, picked at random, and only
//     ever encouraging: a streak, time this month, where the month is heading, sessions this week, your
//     last session, your practice year, a concert coming up and the pace to be ready, Level 5 passages,
//     the note you're stretching to. Never "you haven't practised". A new player gets a welcome.
(function (root, factory) {
    if (typeof module === 'object' && module.exports) module.exports = factory();
    else root.HomeGreeting = factory();
}(typeof self !== 'undefined' ? self : this, function () {
    'use strict';

    const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const DAY_MS = 86400000;

    // 'YYYY-MM-DD' of a Date, in local time.
    const isoOf = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    // Whole days from a to b ('YYYY-MM-DD'), by calendar date.
    const daysBetween = (a, b) => Math.round((Date.parse(`${b}T12:00:00`) - Date.parse(`${a}T12:00:00`)) / DAY_MS);
    const addDays = (iso, n) => isoOf(new Date(Date.parse(`${iso}T12:00:00`) + n * DAY_MS));
    const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

    // 4h 20m / 3h / 45m
    function formatMinutes(mins) {
        const m = Math.round(mins);
        const h = Math.floor(m / 60), r = m % 60;
        if (!h) return `${r}m`;
        return r ? `${h}h ${r}m` : `${h}h`;
    }

    // Days in a row with a session of this kind, counting back from today - or from yesterday while today
    // has nothing yet, so a streak isn't shown as broken before you've practised today (as the Stats page).
    function currentStreak(dates, today) {
        let n = 0, cursor = dates.has(today) ? today : addDays(today, -1);
        while (dates.has(cursor)) { n++; cursor = addDays(cursor, -1); }
        return n;
    }
    function longestStreak(dates) {
        let best = 0, run = 0, prev = null;
        for (const d of [...dates].sort()) {
            run = prev && addDays(prev, 1) === d ? run + 1 : 1;
            best = Math.max(best, run);
            prev = d;
        }
        return best;
    }

    // The greeting. ctx: { name, now: Date, sessions: [{ dateStr }], random }. '' without a name.
    function greeting({ name, now = new Date(), sessions = [], random = Math.random } = {}) {
        if (!name) return '';
        const today = isoOf(now), hour = now.getHours(), day = now.getDay();
        const last = sessions.reduce((m, s) => (!m || s.dateStr > m ? s.dateStr : m), null);
        if (last === today) return `Nice work today ${name}`;
        if (hour >= 22 || hour < 4) return `Burning the midnight oil, ${name}?`;
        if (last && daysBetween(last, today) >= 3) return `Welcome back ${name}`;
        if (day === 0 || day === 6) return `Happy ${DAY_NAMES[day]} ${name}`;
        if (random() < 1 / 3) return `Ready to practise, ${name}?`;
        return `Good ${hour < 12 ? 'morning' : hour < 18 ? 'afternoon' : 'evening'} ${name}`;
    }

    // Every line that's true right now: [{ key, text }]. ctx:
    //   now, sessions: [{ dateStr, category, duration (minutes), instrumentName }] (every logged session),
    //   practiceYearStart: 'YYYY-MM-DD' when the practice year is switched on, showProjection (the Stats
    //   page's "Show this month's projection"), and - each only when its feature is on and it was loaded -
    //   concert: { name, days }, pace: { name, perDay }, levelFive: n, rangeNote: { note, level }.
    function lines(ctx = {}) {
        const { now = new Date(), sessions = [] } = ctx;
        if (!sessions.length) return [{ key: 'welcome', text: 'Your first session starts here' }];
        const today = isoOf(now);
        const out = [];
        const add = (key, text) => out.push({ key, text });

        const practiseDays = new Set(sessions.filter(s => s.category === 'Practise').map(s => s.dateStr));
        const streak = currentStreak(practiseDays, today), best = longestStreak(practiseDays);
        if (streak >= 2) add('streak', `You're on a ${streak}-day streak`);
        if (streak >= 3 && streak === best) add('record', `Your longest streak yet - ${streak} days`);
        else if (streak >= 2 && best - streak >= 1 && best - streak <= 3) add('record', `${plural(best - streak, 'more day')} to beat your best streak of ${best}`);

        const month = today.slice(0, 7);
        const monthMins = sessions.filter(s => s.dateStr.startsWith(month)).reduce((t, s) => t + (Number(s.duration) || 0), 0);
        if (monthMins >= 1) add('month', `${formatMinutes(monthMins)} practised this month`);
        // The Stats page's projection: this month so far x days in the month / days gone (today counts).
        const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate(), daysGone = now.getDate();
        if (ctx.showProjection && monthMins >= 1 && daysGone >= 3 && daysGone < daysInMonth) {
            add('projection', `On track for ${formatMinutes(monthMins * daysInMonth / daysGone)} this month`);
        }

        const monday = addDays(today, -((now.getDay() + 6) % 7)); // weeks start on Monday, as the Stats page
        const weekSessions = sessions.filter(s => s.dateStr >= monday && s.dateStr <= today).length;
        if (weekSessions >= 1) add('week', `${plural(weekSessions, 'session')} this week`);

        const last = sessions.reduce((m, s) => (!m || s.dateStr > m.dateStr ? s : m), null);
        const ago = daysBetween(last.dateStr, today);
        if (ago <= 1) add('last', `Last practised ${ago === 0 ? 'today' : 'yesterday'}${last.instrumentName ? ` - on ${last.instrumentName}` : ''}`);

        if (ctx.practiceYearStart) {
            const yearMins = sessions.filter(s => s.dateStr >= ctx.practiceYearStart && s.dateStr <= today).reduce((t, s) => t + (Number(s.duration) || 0), 0);
            if (yearMins >= 60) add('year', `${formatMinutes(yearMins)} so far this practice year`);
        }
        if (ctx.concert && ctx.concert.days >= 1 && ctx.concert.days <= 90) {
            add('concert', `${ctx.concert.name} in ${plural(ctx.concert.days, 'day')}`);
        }
        if (ctx.pace && ctx.pace.perDay >= 1) add('pace', `About ${plural(ctx.pace.perDay, 'block')} a day to be ready for ${ctx.pace.name}`);
        if (ctx.levelFive >= 1) add('levels', `${plural(ctx.levelFive, 'passage')} at Level 5`);
        if (ctx.rangeNote && ctx.rangeNote.level >= 1) add('range', `${ctx.rangeNote.note} is at Level ${ctx.rangeNote.level} - keep stretching`);
        return out;
    }

    // One of them, at random - or the one you already had, if it's still true (so it doesn't change under you).
    function pickLine(candidates, keep, random = Math.random) {
        if (!candidates.length) return null;
        return candidates.find(c => c.key === keep) || candidates[Math.floor(random() * candidates.length)];
    }

    return { greeting, lines, pickLine, formatMinutes, isoOf };
}));
