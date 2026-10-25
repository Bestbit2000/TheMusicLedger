// ML-22: the sums behind Admin -> Usage -> Heat map, a tool's buttons and Quiet corners - pure, no database
// (server/test/usageReport.test.js). The database side is usageReport.js. See docs/usage-stats.md.
import { Usage } from './usageRules.js';

const DAY = 86400000;
const iso = (ms) => new Date(ms).toISOString().slice(0, 10);
const dayMs = (d) => Date.parse(`${String(d).slice(0, 10)}T00:00:00Z`);

// The Mondays that start the last n weeks, oldest first, the week of `today` last
export function weekStarts(today, n) {
  const t = dayMs(today);
  const monday = t - ((new Date(t).getUTCDay() + 6) % 7) * DAY;
  return Array.from({ length: n }, (_, i) => iso(monday - (n - 1 - i) * 7 * DAY));
}
const weekOf = (day, weeks) => { const d = String(day).slice(0, 10); let at = -1; weeks.forEach((w, i) => { if (w <= d) at = i; }); return at; };

// A tap's item is "where name": where is the screen or pop-up (or "screen>pop-up"), name the button's own
export function splitTap(item) {
  const at = String(item).indexOf(' ');
  return at < 0 ? { where: String(item), name: '' } : { where: item.slice(0, at), name: item.slice(at + 1) };
}

// One row of the grid from daily lines ({ day, started, finished, members }): a count per week, the total,
// finished as a share of started (null where a use has no finish), and members - the most in one day,
// since the counts never say who (the same person on two days can't be told apart)
function rowFrom(lines, weeks, withFinish) {
  const cells = weeks.map(() => 0);
  let started = 0, finished = 0, members = 0;
  for (const l of lines) {
    const w = weekOf(l.day, weeks);
    if (w < 0) continue;
    cells[w] += Number(l.started) || 0;
    started += Number(l.started) || 0;
    finished += Number(l.finished) || 0;
    members = Math.max(members, Number(l.members) || 0);
  }
  return { cells, started, finished: withFinish && started ? Math.round((finished / started) * 100) : null, members };
}
// lines kept apart by a key, each key's lines added up by day first (several places or kinds on one day)
function byKey(lines, keyOf) {
  const out = new Map();
  for (const l of lines) {
    const k = keyOf(l);
    if (k === null) continue;
    const days = out.get(k) || new Map();
    const d = String(l.day).slice(0, 10);
    const x = days.get(d) || { day: d, started: 0, finished: 0, members: 0 };
    x.started += Number(l.started) || 0; x.finished += Number(l.finished) || 0; x.members += Number(l.members) || 0;
    days.set(d, x);
    out.set(k, days);
  }
  return new Map([...out].map(([k, days]) => [k, [...days.values()]]));
}

// The rounds already kept in their own tables - history back to launch, finished rounds only
// The tool whose buttons a row opens (Usage.GROUPS)
const SESSION = 'Practice session', PIECES = 'Pieces: Rehearse, play, edit', SKILLS = 'Skills: Tempo, Pulse, Pitch, Rhythm';
export const ROW_TOOL = { metronome: 'Metronome (Quick Play)', tuner: 'Tuner', 'tuning-fork': 'Tuning fork', timer: 'Timer', warmups: 'Warm-ups', scales: 'Scales', rehearse: PIECES, recording: PIECES, prepare: SESSION, setup: 'Set-up', theory: 'Theory', ear: SKILLS, tapTempo: SKILLS, gapTrainer: SKILLS, rhythm: SKILLS, range: 'Range' };
const toolFor = (item) => ROW_TOOL[item] || (/^(session|block:|plan:)/.test(item) ? SESSION : null);
export const HISTORY_ROWS = { theory: ['Theory', 'Practise and learn'], ear: ['Pitch', 'Practise and learn'], tapTempo: ['Tempo', 'Practise and learn'], gapTrainer: ['Pulse', 'Practise and learn'], rhythm: ['Rhythm', 'Practise and learn'], range: ['Range', 'Practise and learn'] };

// The grid. kind: 'use' (tools started), 'tap' (buttons pressed, a row per tool) or 'view' (screens opened).
// lines: usage_counts by day ({ day, kind, item, place, started, finished, members }), already filtered by
// place and who; history: { day, item, started, members } from the rounds' own tables (only with place 'all').
export function heatmap({ kind, lines, history, weeks, views }) {
  const groups = [];
  const add = (group, row) => { let g = groups.find((x) => x.name === group); if (!g) groups.push(g = { name: group, rows: [] }); g.rows.push(row); };
  if (kind === 'use') {
    const mine = byKey(lines.filter((l) => l.kind === 'use'), (l) => l.item);
    const hist = byKey(history || [], (l) => l.item);
    for (const group of Usage.ROW_GROUPS) {
      for (const [item, [label, g]] of Object.entries(Usage.USE_ROWS)) if (g === group) add(group, { key: item, label, tool: toolFor(item), ...rowFrom(mine.get(item) || [], weeks, !item.startsWith('plan:')) });
      if (history) for (const [item, [label, g]] of Object.entries(HISTORY_ROWS)) if (g === group) add(group, { key: `history:${item}`, label, history: true, tool: toolFor(item), ...rowFrom(hist.get(item) || [], weeks, false) });
    }
  } else if (kind === 'tap') {
    const tools = byKey(lines.filter((l) => l.kind === 'tap'), (l) => Usage.groupOf(splitTap(l.item).where));
    for (const [tool] of Usage.GROUPS) add('Buttons pressed, by tool', { key: tool, label: tool, tool, ...rowFrom(tools.get(tool) || [], weeks, false) });
  } else {
    const opened = byKey(lines.filter((l) => l.kind === 'view'), (l) => l.item);
    for (const [tool] of Usage.GROUPS) for (const v of views.filter((x) => Usage.groupOf(x) === tool)) add(tool, { key: v, label: Usage.viewLabel(v), tool, ...rowFrom(opened.get(v) || [], weeks, false) });
  }
  return { weeks, groups };
}

// Does a tap match a button in the list? A button on a screen in app.html matches a tap on that screen (or
// pop-up); one the app builds, or one every screen shares (the top bar, the ⋮ menus), any tap with its name.
// (A built button whose value is only known as it runs - data-option="${...}" - is listed as data-option and
// pressed as data-option=small: the same button.)
const sameName = (b, tap) => b.name === tap.name || (!b.html && String(tap.name).startsWith(`${b.name}=`));
const matches = (b, tap) => sameName(b, tap) && (!b.html || b.where === 'top bar' || b.where === 'menu' || tap.where.split('>').pop() === b.where);

// One tool: every button pressed, most first, with its words from the list; and the tool's buttons never
// pressed. taps: { item, place, started, members } added up over the period (members: the most in a day).
export function toolButtons({ tool, taps, buttons }) {
  const mine = taps.map((t) => ({ ...t, ...splitTap(t.item) })).filter((t) => Usage.groupOf(t.where) === tool);
  const rows = new Map();
  for (const t of mine) {
    const r = rows.get(t.item) || { item: t.item, where: t.where, name: t.name, own: 0, session: 0, members: 0 };
    r[t.place === 'session' ? 'session' : 'own'] += Number(t.started) || 0;
    r.members = Math.max(r.members, Number(t.members) || 0);
    rows.set(t.item, r);
  }
  const list = [...rows.values()].map((r) => {
    const b = buttons.find((x) => matches(x, r)) || null;
    const pressed = r.own + r.session;
    return { where: r.where, name: r.name, label: (b && b.label) || nameLabel(r.name), whereLabel: whereLabel(r.where), pressed, inSession: pressed ? Math.round((r.session / pressed) * 100) : 0, members: r.members };
  }).sort((a, b) => b.pressed - a.pressed || a.label.localeCompare(b.label));
  const all = taps.map((t) => splitTap(t.item));
  const ofTool = buttons.filter((b) => b.group === tool);
  const never = ofTool.filter((b) => !all.some((t) => matches(b, t))).map((b) => ({ label: b.label || nameLabel(b.name), whereLabel: whereLabel(b.where), name: b.name }));
  return { tool, rows: list, never, buttons: ofTool.length };
}
// A button with no words of its own (an icon), by its name: "#topBackBtn" -> "Back (top bar)",
// "#scalesBpmMinus" -> "Scales bpm minus", "data-option=up" -> "Option: up"
const NAMED = { '#topBackBtn': 'Back (top bar)', '#navBurgerMenuBtn': 'Menu (☰)', '#topTimerPill': 'Timer (top bar)', 'close (X)': 'Close (X)' };
export function nameLabel(name) {
  if (NAMED[name]) return NAMED[name];
  const [n, v] = String(name).replace(/^#|^data-/, '').split('=');
  const w = n.replace(/Btn$/, '').replace(/[-_]/g, ' ').replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase().trim();
  const text = w.charAt(0).toUpperCase() + w.slice(1);
  return v ? `${text}: ${v}` : text;
}
// Where a tap was, in words: a screen's name, a pop-up's ("scalesSpeedModal" -> "Scales speed"), or both
export function whereLabel(where) {
  // a button the app builds is listed under the code that builds it: "scalesRenderChoose()" -> "Scales choose (a list)"
  const built = (w) => `${Usage.viewLabel(w.replace(/\(\)$/, '').replace(/^(render|open|draw|build|show)(?=[A-Z])/, '').replace(/(Render|Html|Tile)(?=[A-Z]|$)/g, ''))} (a list)`;
  return String(where).split('>').map((w) => (/View$/.test(w) ? Usage.viewLabel(w) : /\(\)$/.test(w) ? built(w) : w === 'top bar' || w === 'menu' ? (w === 'menu' ? 'The menu' : 'Top bar') : Usage.viewLabel(w.replace(/Modal$|Box$|Content$/, '')))).join(' → ');
}

// Quiet corners. features: [{ key, name, enabled, levels }] (levels: the account types it is switched on
// for, super admin left out); uses/viewsOpened: Maps of item -> times in the period; taps: [{ item }].
export function quiet({ features, uses, viewsOpened, taps, buttons, views, below }) {
  const quietFeatures = features.filter((f) => f.enabled && f.levels.length && Usage.FEATURES[f.key]).map((f) => {
    const m = Usage.FEATURES[f.key];
    const n = (m.uses || []).reduce((s, u) => s + (uses.get(u) || 0), 0) + (m.views || []).reduce((s, v) => s + (viewsOpened.get(v) || 0), 0);
    return { key: f.key, name: f.name, uses: n, levels: f.levels };
  }).filter((f) => f.uses < below).sort((a, b) => a.uses - b.uses || a.name.localeCompare(b.name));
  const all = taps.map((t) => splitTap(t.item));
  const tools = [...Usage.GROUPS].map(([tool]) => { // (copied: GROUPS is the vm sandbox's own array)
    const ofTool = buttons.filter((b) => b.group === tool);
    const never = ofTool.filter((b) => !all.some((t) => matches(b, t)));
    return { tool, never: never.length, of: ofTool.length, labels: never.map((b) => `${whereLabel(b.where)} → ${b.label || nameLabel(b.name)}`) };
  }).filter((t) => t.never).sort((a, b) => b.never - a.never);
  const screens = views.filter((v) => !(viewsOpened.get(v) > 0)).map((v) => Usage.viewLabel(v));
  return { features: quietFeatures, tools, neverPressed: tools.reduce((s, t) => s + t.never, 0), buttons: buttons.length, screens, viewCount: views.length };
}
