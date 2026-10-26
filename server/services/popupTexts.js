// ML-618 stage 4: the message each of the owner's pop-ups starts with - warning or closing an account, removing
// something on Admin -> Shared music, renaming a band - changed on Admin -> Email wording without a release
// (docs/email-wording.md, "Starting messages"). A pop-up's message is its parts, one paragraph each: the first line,
// a "Why:" line for the reason chosen, a "What to do next:" line, and the last line. The owner then changes the
// message in the pop-up as he likes before it is sent - this is only where it starts.
// Plain text (the message also shows in the app). Each part's built-in words are the ones the pop-up used before
// (public/admin.js), so nothing changes until they are changed here. Saved parts are in popup_texts (migration 163).
import pool from '../config/db.js';

const why = (lines) => Object.fromEntries(Object.entries(lines).map(([k, v]) => [`why.${k}`, v]));
const ASK = 'If you think this is a mistake, or have a question, email hello@notablybetter.com.';
const ACCOUNT_WHY = { shared: 'Shared something that breaks the terms of use', conduct: 'How they have treated other members', repeated: 'Carried on after a warning', other: 'Another reason' };
const REMOVE_WHY = { person: 'Someone in it asked for it to be removed', copyright: "It may be someone else's copyright", reported: 'A member reported it', terms: 'It breaks the terms of use', other: 'Another reason' };
const SHARED_WHY = { copyright: REMOVE_WHY.copyright, reported: REMOVE_WHY.reported, terms: REMOVE_WHY.terms, other: REMOVE_WHY.other };
const RENAME_WHY = { reported: 'A member reported it', terms: 'It breaks the terms of use', other: 'Another reason' };

// key -> { name, about, reasons: { reason: label }, fillIns: { name: what } (for the first line), parts: { part: built-in } }
export const POPUPS = {
  warn: {
    name: 'Warning a member', about: 'Admin → Accounts → Warn this member.', reasons: ACCOUNT_WHY, fillIns: {},
    parts: {
      opening: 'This is a warning about your Notably Better account.',
      ...why({
        shared: 'Why: something you shared in the app breaks the terms of use, which say what may be shared.',
        conduct: 'Why: the way you have treated other members breaks the terms of use.',
        repeated: 'Why: it has carried on after we warned you about it.',
        other: 'Why: '
      }),
      next: 'What to do next: please read the terms of use (notablybetter.com/terms.html) and keep to them. If it happens again we may close your account.',
      closing: ASK
    }
  },
  close: {
    name: 'Closing an account', about: 'Admin → Accounts → Close this account.', reasons: ACCOUNT_WHY, fillIns: {},
    parts: {
      opening: 'We have closed your Notably Better account, so you can no longer sign in.',
      ...why({
        shared: 'Why: something you shared in the app breaks the terms of use, which say what may be shared.',
        conduct: 'Why: the way you have treated other members breaks the terms of use.',
        repeated: 'Why: it has carried on after we warned you about it.',
        other: 'Why: '
      }),
      next: 'What happens now: anything you shared with a band stays with the band. Your own pieces and practice history are kept for now. If you would like them deleted, or a copy of them, email us and we will do it.',
      closing: 'If you think this is a mistake, email hello@notablybetter.com and we will look again.'
    }
  },
  remove: {
    name: 'Removing a recording, video, document or piece', about: 'Admin → Shared music → Remove, for a recording, a video, a document or a whole piece.',
    reasons: REMOVE_WHY,
    fillIns: { what: 'What it was: the recording "Rehearsal 3", the piece "Blaydon Races", with its recordings and documents,...', 'where from': 'Which pieces it has come off, as a sentence of its own (" It has come off the piece ..."); nothing for a whole piece.' },
    required: ['what'],
    parts: {
      opening: 'We have removed {what} from Notably Better.{where from} Nothing else of yours has changed.',
      ...why({
        person: 'Why: someone who is in it asked us to remove it. Anyone in a recording can ask for that, and when they do we have to remove it everywhere.',
        copyright: 'Why: we were told it may be someone else\'s copyright, and it can\'t stay in the app while that is in doubt.',
        reported: 'Why: a member told us about it, and having looked at it we agree it should not be here.',
        terms: 'Why: it breaks the terms of use, which say what may be shared in the app.',
        other: 'Why: '
      }),
      'next.person': 'What to do next: please don\'t upload it again. You are welcome to add a different recording, as long as everyone in it knows it is being shared.',
      'next.copyright': 'What to do next: please don\'t upload it again unless you have the right to use it. If you do have that right, reply to tell us and we will look again.',
      'next.reported': 'What to do next: please don\'t add it again. The terms of use say what may be shared.',
      'next.terms': 'What to do next: please don\'t add it again. The terms of use say what may be shared.',
      'next.other': 'What to do next: ',
      closing: ASK
    }
  },
  remove_list: {
    name: 'Removing a practice list', about: 'Admin → Shared music → Remove, for a band\'s practice list. Only the list goes; its pieces stay.',
    reasons: SHARED_WHY,
    fillIns: { list: 'The practice list\'s name.', 'from band': '" from" and the band\'s name - or nothing.' },
    required: ['list'],
    parts: {
      opening: 'We have removed the practice list "{list}"{from band} in Notably Better. The pieces that were on it are still there, and nothing else of the band\'s has changed.',
      ...why({
        copyright: 'Why: we were told its name may be someone else\'s to use, and it can\'t stay in the app while that is in doubt.',
        reported: 'Why: a member told us about it, and having looked at it we agree it should not be here.',
        terms: 'Why: it breaks the terms of use, which say what may be shared in the app.',
        other: 'Why: '
      }),
      next: 'What to do next: you are welcome to make the list again with a name that fits the terms of use.',
      'next.other': 'What to do next: ',
      closing: ASK
    }
  },
  remove_logo: {
    name: 'Removing a band\'s logo', about: 'Admin → Shared music → Remove, for a band\'s logo. The band and everything in it stay.',
    reasons: SHARED_WHY,
    fillIns: { band: 'The band\'s name.' },
    required: ['band'],
    parts: {
      opening: 'We have removed the logo of your band "{band}" in Notably Better. Its members, pieces and practice lists are all as they were.',
      ...why({
        copyright: 'Why: we were told the picture may be someone else\'s to use, and it can\'t stay in the app while that is in doubt.',
        reported: 'Why: a member told us about it, and having looked at it we agree it should not be here.',
        terms: 'Why: it breaks the terms of use, which say what may be shared in the app.',
        other: 'Why: '
      }),
      next: 'What to do next: you are welcome to add a different logo that fits the terms of use.',
      'next.other': 'What to do next: ',
      closing: ASK
    }
  },
  rename: {
    name: 'Renaming a band', about: 'Admin → Shared music → Rename, for a band\'s name. The band and everything in it stay.',
    reasons: RENAME_WHY,
    fillIns: { 'old name': 'The band\'s name before.', 'new name': 'The name you give it.' },
    required: ['new name'],
    parts: {
      opening: 'We have changed the name of your band "{old name}" in Notably Better. It is now "{new name}". Its members, pieces and practice lists are all as they were.',
      ...why({
        reported: 'Why: a member told us about the name, and having looked at it we agree it should not be here.',
        terms: 'Why: the name breaks the terms of use, which say what may be shared in the app.',
        other: 'Why: '
      }),
      next: 'What to do next: nothing, unless you would like a different name - email hello@notablybetter.com and we will change it.',
      closing: 'If you think this is a mistake, or have a question, email the same address.'
    }
  }
};

export const PART_MAX = 800;
const fail = (status, message) => Object.assign(new Error(message), { status });
const named = (key) => {
  if (!Object.hasOwn(POPUPS, key)) throw fail(404, 'There is no such pop-up.');
  return POPUPS[key];
};
// What each part is, in words for the page
export function partLabel(popup, part) {
  if (part === 'opening') return 'First line';
  if (part === 'closing') return 'Last line';
  if (part === 'next') return popup.parts['next.other'] !== undefined ? 'What to do next (every reason but "Another reason")' : 'What to do next';
  const [kind, reason] = part.split('.');
  return `${kind === 'why' ? 'Why' : 'What to do next'} - ${popup.reasons[reason] || reason}`;
}
// A part as kept: line breaks tidied, but a trailing space kept ("Why: " is for typing after)
const tidy = (text) => String(text ?? '').replace(/\r\n/g, '\n').replace(/^\n+|\n+$/g, '');

// Pure - unit tested. What is wrong with a part, or null.
export function checkPart(key, part, text) {
  const popup = named(key);
  if (!Object.hasOwn(popup.parts, part)) return 'There is no such part.';
  const t = tidy(text);
  if (!t.trim() && part === 'opening') return 'The first line can\'t be empty - it says what happened.';
  if (t.length > PART_MAX) return `Each part can be up to ${PART_MAX} characters.`;
  if (/[{}]/.test(t.replace(/\{[^{}]*\}/g, ''))) return 'A curly bracket isn\'t closed - fill-ins are written like {band}.';
  const allowed = part === 'opening' ? popup.fillIns : {};
  for (const m of t.matchAll(/\{([^{}]*)\}/g)) {
    const name = m[1].trim().toLowerCase();
    if (!allowed[name]) return part === 'opening'
      ? `{${m[1]}} isn't a fill-in this pop-up knows.${Object.keys(allowed).length ? ` It knows ${Object.keys(allowed).map((f) => `{${f}}`).join(' and ')}.` : ''}`
      : 'Fill-ins only go in the first line.';
  }
  if (part === 'opening') {
    const used = new Set([...t.matchAll(/\{([^{}]*)\}/g)].map((m) => m[1].trim().toLowerCase()));
    const missing = (popup.required || []).find((f) => !used.has(f));
    if (missing) return `The first line needs {${missing}} - it says what happened.`;
  }
  return null;
}

// ---- Admin (super admins, server/routes/admin.js) ----
// Every pop-up with its parts - built-in and as they stand - and, flat, the words each part says now ({ 'warn.opening': ... })
// for the pop-ups themselves (public/admin.js).
export async function listPopupTexts() {
  const { rows } = await pool.query(
    `SELECT t.key, t.text, t.updated_at, a.first_name, a.surname FROM popup_texts t LEFT JOIN accounts a ON a.id = t.updated_by_account_id`);
  const saved = new Map(rows.map((r) => [r.key, r]));
  const texts = {};
  const popups = Object.entries(POPUPS).map(([key, p]) => {
    let last = null;
    const parts = Object.entries(p.parts).map(([part, builtIn]) => {
      const row = saved.get(`${key}.${part}`);
      const usable = row && !checkPart(key, part, row.text);
      if (usable && (!last || row.updated_at > last.updated_at)) last = row;
      texts[`${key}.${part}`] = usable ? tidy(row.text) : builtIn;
      return { part, label: partLabel(p, part), builtIn, text: texts[`${key}.${part}`], changed: !!usable };
    });
    return {
      key, name: p.name, about: p.about, parts,
      fillIns: Object.entries(p.fillIns).map(([name, what]) => ({ name, what, required: (p.required || []).includes(name) })),
      changed: parts.some((x) => x.changed),
      changedOn: last ? last.updated_at : null,
      changedBy: last ? `${last.first_name || ''} ${last.surname || ''}`.trim() || null : null
    };
  });
  return { popups, texts };
}

// Saves a pop-up's parts ({ part: text }). A part back to its built-in words is simply not kept.
export async function savePopupTexts(key, parts = {}, accountId) {
  const popup = named(key);
  for (const [part, text] of Object.entries(parts)) {
    const problem = checkPart(key, part, text);
    if (problem) throw fail(400, `${partLabel(popup, part)}: ${problem}`);
  }
  for (const [part, text] of Object.entries(parts)) {
    const t = tidy(text);
    if (t === popup.parts[part]) await pool.query('DELETE FROM popup_texts WHERE key = $1', [`${key}.${part}`]);
    else {
      await pool.query(
        `INSERT INTO popup_texts (key, text, updated_by_account_id) VALUES ($1, $2, $3)
         ON CONFLICT (key) DO UPDATE SET text = $2, updated_at = now(), updated_by_account_id = $3`, [`${key}.${part}`, t, accountId]);
    }
  }
  return listPopupTexts();
}

export async function resetPopupTexts(key) {
  named(key);
  await pool.query('DELETE FROM popup_texts WHERE key LIKE $1', [`${key}.%`]);
  return listPopupTexts();
}
