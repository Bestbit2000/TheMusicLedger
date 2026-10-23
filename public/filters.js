// ML-595: the app's one way of filtering a list - the rules, kept apart from the screens so they can be tested
// (server/test/filters.test.js). The screens (app.js, "FILTERS") draw one Filter button that says how many filters are
// on, the filters on as chips under it - each with an x - and every way of filtering in one pop-up.
//
// A filter is a set of groups, each a set of choices: { key, label, options: [{ value, label }] }. Within a group any
// ticked choice will do (Mine OR a band); across groups every group with something ticked must match (Mine AND with a
// recording). state is { [groupKey]: [value, ...] } - nothing ticked in a group means that group doesn't filter.
// A group with apply: false is kept in the state and shown as a chip, but the screen handles it itself (Archived
// pieces: a different list, not a narrower one). match(item, groupKey, value) says whether an item has a choice.
// Browser script; also loaded by the tests.
(function (root) {
    const ticked = (state, key) => (state && Array.isArray(state[key]) ? state[key] : []);

    function passes(item, groups, state, match, skipKey) {
        return groups.every((g) => g.apply === false || g.key === skipKey || !ticked(state, g.key).length
            || ticked(state, g.key).some((v) => match(item, g.key, v)));
    }
    // The items that pass every group
    function apply(items, groups, state, match) {
        return (items || []).filter((i) => passes(i, groups, state, match, null));
    }
    // How many items a choice would show: every other group as it is, and this choice
    function count(items, groups, state, match, groupKey, value) {
        return (items || []).filter((i) => passes(i, groups, state, match, groupKey) && match(i, groupKey, value)).length;
    }
    // How many filters are on - what the button says
    function activeCount(groups, state) {
        return groups.reduce((n, g) => n + ticked(state, g.key).filter((v) => g.options.some((o) => o.value === v)).length, 0);
    }
    // The filters on, in the order the pop-up lists them - one chip each
    function chips(groups, state) {
        const out = [];
        groups.forEach((g) => g.options.forEach((o) => { if (ticked(state, g.key).includes(o.value)) out.push({ group: g.key, value: o.value, label: o.label }); }));
        return out;
    }
    // A choice ticked or unticked - a new state; a group marked single holds one choice at a time
    function toggle(state, groups, groupKey, value) {
        const g = groups.find((x) => x.key === groupKey);
        const now = ticked(state, groupKey);
        const next = now.includes(value) ? now.filter((v) => v !== value) : (g && g.single ? [value] : [...now, value]);
        return { ...(state || {}), [groupKey]: next };
    }
    // The state without choices that are no longer offered (a band left, a practice list deleted)
    function clean(groups, state) {
        const out = {};
        groups.forEach((g) => { const v = ticked(state, g.key).filter((x) => g.options.some((o) => o.value === x)); if (v.length) out[g.key] = v; });
        return out;
    }

    root.Filters = { apply, count, activeCount, chips, toggle, clean };
})(typeof self !== 'undefined' ? self : globalThis);
