import express from 'express';
import { requireAuth, getUserTokens } from '../middleware/auth.js';
import { getSheetsClient, refreshAccessToken, SHEET_ID } from '../config/google.js';
import { signToken } from '../utils/authToken.js';

const router = express.Router();

const SHEET_NAME = 'Music time';
const SETTINGS_SHEET = 'Settings';
const CHALLENGES_SHEET = 'Challenges';

const COLUMNS = {
  'Practise': { yearCol: 'A', dateCol: 'B', durationCol: 'C' },
  'Rehearsal': { yearCol: 'E', whoCol: 'F', dateCol: 'G', durationCol: 'H' },
  'Lesson': { yearCol: 'J', whoCol: 'K', dateCol: 'L', durationCol: 'M' },
  'Performance': { yearCol: 'O', whoCol: 'P', dateCol: 'Q', durationCol: 'R' }
};

// Organisations live in column A with their archived flag in B; teachers in
// D with their flag in E. Kept as parallel columns (rather than a lookup
// table) since this is still a flat-file Sheet, not a real database.
const SETTINGS_RANGES = {
  organisations: { name: 'A', archived: 'B' },
  teachers: { name: 'D', archived: 'E' }
};

// Which "who" columns on the Music time sheet reference each list - used to
// decide whether removing an entry should archive it instead of deleting it.
const USAGE_WHO_COLUMNS = {
  organisations: ['F', 'P'],
  teachers: ['K']
};

async function getSheetsAuth(req, res) {
  let tokens = getUserTokens(req);
  if (tokens.expiry_date && new Date(tokens.expiry_date) < new Date()) {
    const newTokens = await refreshAccessToken(tokens.refresh_token);
    req.googleAccessToken = newTokens.access_token;

    // The client holds its own bearer token in localStorage - if we don't
    // tell it about the refreshed access token, every subsequent request
    // keeps sending the now-expired one and the user gets bounced back to
    // the login screen. Send the refreshed token back via a response
    // header so the client can update what it has stored.
    if (res) {
      const refreshedPayload = {
        userId: req.userId,
        email: req.userId,
        access_token: newTokens.access_token,
        refresh_token: tokens.refresh_token,
        expiry_date: newTokens.expiry_date
      };
      const newSignedToken = signToken(refreshedPayload);
      res.set('X-Refreshed-Token', newSignedToken);
    }

    return { ...newTokens, refresh_token: tokens.refresh_token };
  }
  return tokens;
}

async function readSettingsList(sheets, type) {
  const { name, archived } = SETTINGS_RANGES[type];
  // Read both columns as ONE range so each row comes back as a matched
  // [name, archived] pair. Fetching them as two separate single-column
  // ranges doesn't work: the Sheets API trims blank cells out of a
  // single-column result entirely (rather than returning a placeholder),
  // so a blank flag cell shifts every later flag onto the wrong name.
  const resp = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: `'${SETTINGS_SHEET}'!${name}4:${archived}100`
  });
  const rows = resp.data.values || [];
  return rows
    .filter(row => row[0])
    .map(row => ({ name: row[0], archived: String(row[1] || '').toUpperCase() === 'TRUE' }));
}

async function writeSettingsList(sheets, type, list) {
  const { name, archived } = SETTINGS_RANGES[type];
  const range = `'${SETTINGS_SHEET}'!${name}4:${archived}100`;

  // values.update only touches cells it's given rows for - when the list
  // shrinks (an item removed), the row that used to hold it would otherwise
  // be left untouched with its old content, so a removal never actually
  // disappears from the sheet. Clear the whole range first.
  await sheets.spreadsheets.values.clear({ spreadsheetId: SHEET_ID, range });

  if (list.length) {
    const values = list.map(item => [item.name, item.archived ? 'TRUE' : '']);
    await sheets.spreadsheets.values.update({
      spreadsheetId: SHEET_ID,
      range,
      valueInputOption: 'RAW',
      resource: { values }
    });
  }
}

async function getUsedNamesSet(sheets, cols) {
  const lists = await Promise.all(cols.map(async col => {
    const resp = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: `'${SHEET_NAME}'!${col}2:${col}1000`
    });
    return (resp.data.values || []).flat();
  }));
  return new Set(lists.flat());
}

async function isNameUsedInHistory(sheets, name, cols) {
  const used = await getUsedNamesSet(sheets, cols);
  return used.has(name);
}

function getPracticeYear(dateObj) {
  const practiceYearEnd = (dateObj.getMonth() >= 10) ? dateObj.getFullYear() + 1 : dateObj.getFullYear();
  return `Year ${practiceYearEnd - 2024}`;
}

function formatDateForSheet(dateObj) {
  const year = dateObj.getFullYear();
  const month = String(dateObj.getMonth() + 1).padStart(2, '0');
  const day = String(dateObj.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Builds a values row matching the actual column order for a category
// (year, [who], date, duration) - some categories have a "who" column
// between year and date, others don't.
function buildSessionRow(cols, practiceYear, dateStr, duration, who) {
  const row = [practiceYear];
  if (cols.whoCol) row.push(who || '');
  row.push(dateStr, Number(duration));
  return row;
}

// ========================================
// DROPDOWN OPTIONS
// ========================================
router.get('/dropdown-options', requireAuth, async (req, res) => {
  try {
    const tokens = await getSheetsAuth(req, res);
    const sheets = getSheetsClient(tokens);

    const [organisations, teachers] = await Promise.all([
      readSettingsList(sheets, 'organisations'),
      readSettingsList(sheets, 'teachers')
    ]);

    res.json({ organisations, teachers });
  } catch (error) {
    console.error('Dropdown options error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ========================================
// SESSIONS (Practice logging)
// ========================================
router.post('/sessions', requireAuth, async (req, res) => {
  try {
    const { category, duration, who, date } = req.body;
    const tokens = await getSheetsAuth(req, res);
    const sheets = getSheetsClient(tokens);

    const dateObj = new Date(date);
    const practiceYear = getPracticeYear(dateObj);
    const cols = COLUMNS[category];

    if (!cols) return res.status(400).json({ error: 'Invalid category' });

    const dateColValues = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: `'${SHEET_NAME}'!${cols.dateCol}1:${cols.dateCol}`
    });

    const values = dateColValues.data.values || [];
    let lastRow = 0;
    for (let i = values.length - 1; i >= 0; i--) {
      if (values[i][0] !== '') { lastRow = i + 1; break; }
    }
    const targetRow = lastRow + 1;

    const rowData = [buildSessionRow(cols, practiceYear, formatDateForSheet(dateObj), duration, who)];

    await sheets.spreadsheets.values.update({
      spreadsheetId: SHEET_ID,
      range: `'${SHEET_NAME}'!${cols.yearCol}${targetRow}:${cols.durationCol}${targetRow}`,
      valueInputOption: 'USER_ENTERED',
      resource: { values: rowData }
    });

    res.json({ message: `Saved ${duration} mins!`, category, row: targetRow });
  } catch (error) {
    console.error('Session save error:', error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/sessions', requireAuth, async (req, res) => {
  try {
    const tokens = await getSheetsAuth(req, res);
    const sheets = getSheetsClient(tokens);

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: `'${SHEET_NAME}'!A2:R1000`
    });

    const data = response.data.values || [];
    const allRecords = [];
    const tz = 'UTC';

    const idx = {
      'Practise': { date: 1, duration: 2, who: null },
      'Rehearsal': { date: 6, duration: 7, who: 5 },
      'Lesson': { date: 11, duration: 12, who: 10 },
      'Performance': { date: 16, duration: 17, who: 15 }
    };

    for (let i = 0; i < data.length; i++) {
      for (const [cat, map] of Object.entries(idx)) {
        const dateVal = data[i][map.date];
        const dur = Number(data[i][map.duration]);
        if (dateVal && dur > 0) {
          try {
            let dateObj;
            if (dateVal instanceof Date) {
              dateObj = dateVal;
            } else if (typeof dateVal === 'string') {
              // Try DD/MM/YYYY format (e.g., "31/08/2026")
              if (dateVal.includes('/')) {
                const parts = dateVal.split('/');
                if (parts.length === 3) {
                  const day = parseInt(parts[0], 10);
                  const month = parseInt(parts[1], 10);
                  const year = parseInt(parts[2], 10);
                  dateObj = new Date(year, month - 1, day);
                  console.log(`Parsed DD/MM/YYYY: ${dateVal} -> ${dateObj.toISOString()}`);
                } else {
                  dateObj = new Date(dateVal);
                }
              } else {
                // Try other formats
                dateObj = new Date(dateVal);
              }
            } else {
              dateObj = new Date(dateVal);
            }

            // Validate the date
            if (isNaN(dateObj.getTime())) {
              console.warn(`Invalid date value: ${dateVal}`);
              continue;
            }

            // Format as YYYY-MM-DD using local time (not UTC)
            const year = dateObj.getFullYear();
            const month = String(dateObj.getMonth() + 1).padStart(2, '0');
            const day = String(dateObj.getDate()).padStart(2, '0');
            const dateStr = `${year}-${month}-${day}`;
            allRecords.push({
              row: i + 2,
              category: cat,
              dateStr: dateStr,
              duration: dur,
              who: map.who !== null ? (data[i][map.who] || '') : ''
            });
          } catch (e) {
            console.warn(`Error processing date ${dateVal}:`, e.message);
            continue;
          }
        }
      }
    }

    res.json(allRecords.sort((a, b) => new Date(b.dateStr) - new Date(a.dateStr)));
  } catch (error) {
    console.error('Sessions fetch error:', error);
    res.status(500).json({ error: error.message });
  }
});

router.put('/sessions/:row', requireAuth, async (req, res) => {
  try {
    const { row } = req.params;
    const { category, duration, who, date } = req.body;
    const tokens = await getSheetsAuth(req, res);
    const sheets = getSheetsClient(tokens);

    const dateObj = new Date(date);
    const practiceYear = getPracticeYear(dateObj);
    const cols = COLUMNS[category];

    if (!cols) return res.status(400).json({ error: 'Invalid category' });

    await sheets.spreadsheets.values.update({
      spreadsheetId: SHEET_ID,
      range: `'${SHEET_NAME}'!${cols.yearCol}${row}:${cols.durationCol}${row}`,
      valueInputOption: 'USER_ENTERED',
      resource: { values: [buildSessionRow(cols, practiceYear, formatDateForSheet(dateObj), duration, who)] }
    });

    res.json({ message: 'Session updated', row });
  } catch (error) {
    console.error('Session update error:', error);
    res.status(500).json({ error: error.message });
  }
});

router.delete('/sessions/:row', requireAuth, async (req, res) => {
  try {
    const { row } = req.params;
    const { category } = req.body;
    const tokens = await getSheetsAuth(req, res);
    const sheets = getSheetsClient(tokens);
    const cols = COLUMNS[category];

    if (!cols) return res.status(400).json({ error: 'Invalid category' });

    // values.update with an empty values array is a no-op - it does not
    // clear existing cell contents. The dedicated clear endpoint is
    // required to actually remove the row's data.
    await sheets.spreadsheets.values.clear({
      spreadsheetId: SHEET_ID,
      range: `'${SHEET_NAME}'!${cols.yearCol}${row}:${cols.durationCol}${row}`
    });

    res.json({ message: 'Session deleted' });
  } catch (error) {
    console.error('Session delete error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ========================================
// SETTINGS (Organisations & Teachers)
// ========================================
router.post('/settings/organisations', requireAuth, async (req, res) => {
  try {
    const { name } = req.body;
    const tokens = await getSheetsAuth(req, res);
    const sheets = getSheetsClient(tokens);

    const organisations = await readSettingsList(sheets, 'organisations');
    organisations.push({ name, archived: false });
    await writeSettingsList(sheets, 'organisations', organisations);

    const teachers = await readSettingsList(sheets, 'teachers');
    res.json({ organisations, teachers });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/settings/teachers', requireAuth, async (req, res) => {
  try {
    const { name } = req.body;
    const tokens = await getSheetsAuth(req, res);
    const sheets = getSheetsClient(tokens);

    const teachers = await readSettingsList(sheets, 'teachers');
    teachers.push({ name, archived: false });
    await writeSettingsList(sheets, 'teachers', teachers);

    const organisations = await readSettingsList(sheets, 'organisations');
    res.json({ organisations, teachers });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/settings/organisations', requireAuth, async (req, res) => {
  try {
    const { oldName, newName } = req.body;
    const tokens = await getSheetsAuth(req, res);
    const sheets = getSheetsClient(tokens);

    const list = await readSettingsList(sheets, 'organisations');
    const updated = list.map(o => o.name === oldName ? { ...o, name: newName } : o);
    await writeSettingsList(sheets, 'organisations', updated);

    res.json({ message: 'Organisation renamed' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/settings/teachers', requireAuth, async (req, res) => {
  try {
    const { oldName, newName } = req.body;
    const tokens = await getSheetsAuth(req, res);
    const sheets = getSheetsClient(tokens);

    const list = await readSettingsList(sheets, 'teachers');
    const updated = list.map(t => t.name === oldName ? { ...t, name: newName } : t);
    await writeSettingsList(sheets, 'teachers', updated);

    res.json({ message: 'Teacher renamed' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Manage Lists needs to know, per item, whether it's referenced in history
// so it can label the archive/remove action correctly before the user acts -
// dropdown-options stays cheap for the common app-load path by not doing this.
router.get('/settings/lists-with-usage', requireAuth, async (req, res) => {
  try {
    const tokens = await getSheetsAuth(req, res);
    const sheets = getSheetsClient(tokens);

    const [organisations, teachers, orgUsed, teacherUsed] = await Promise.all([
      readSettingsList(sheets, 'organisations'),
      readSettingsList(sheets, 'teachers'),
      getUsedNamesSet(sheets, USAGE_WHO_COLUMNS.organisations),
      getUsedNamesSet(sheets, USAGE_WHO_COLUMNS.teachers)
    ]);

    res.json({
      organisations: organisations.map(o => ({ ...o, usedInHistory: orgUsed.has(o.name) })),
      teachers: teachers.map(t => ({ ...t, usedInHistory: teacherUsed.has(t.name) }))
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Deleting an organisation/teacher that's still referenced in session history
// would silently orphan those past sessions, so it's archived instead - kept
// in the list (hidden from new-entry pickers) rather than removed outright.
router.delete('/settings/organisations/:name', requireAuth, async (req, res) => {
  try {
    const name = decodeURIComponent(req.params.name);
    const tokens = await getSheetsAuth(req, res);
    const sheets = getSheetsClient(tokens);

    const usedInHistory = await isNameUsedInHistory(sheets, name, USAGE_WHO_COLUMNS.organisations);
    let list = await readSettingsList(sheets, 'organisations');
    list = usedInHistory
      ? list.map(o => o.name === name ? { ...o, archived: true } : o)
      : list.filter(o => o.name !== name);
    await writeSettingsList(sheets, 'organisations', list);

    res.json({
      message: usedInHistory ? 'Organisation archived (still used in history)' : 'Organisation deleted',
      archived: usedInHistory
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/settings/teachers/:name', requireAuth, async (req, res) => {
  try {
    const name = decodeURIComponent(req.params.name);
    const tokens = await getSheetsAuth(req, res);
    const sheets = getSheetsClient(tokens);

    const usedInHistory = await isNameUsedInHistory(sheets, name, USAGE_WHO_COLUMNS.teachers);
    let list = await readSettingsList(sheets, 'teachers');
    list = usedInHistory
      ? list.map(t => t.name === name ? { ...t, archived: true } : t)
      : list.filter(t => t.name !== name);
    await writeSettingsList(sheets, 'teachers', list);

    res.json({
      message: usedInHistory ? 'Teacher archived (still used in history)' : 'Teacher deleted',
      archived: usedInHistory
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/settings/organisations/:name/unarchive', requireAuth, async (req, res) => {
  try {
    const name = decodeURIComponent(req.params.name);
    const tokens = await getSheetsAuth(req, res);
    const sheets = getSheetsClient(tokens);

    const list = await readSettingsList(sheets, 'organisations');
    const updated = list.map(o => o.name === name ? { ...o, archived: false } : o);
    await writeSettingsList(sheets, 'organisations', updated);

    res.json({ message: 'Organisation unarchived' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/settings/teachers/:name/unarchive', requireAuth, async (req, res) => {
  try {
    const name = decodeURIComponent(req.params.name);
    const tokens = await getSheetsAuth(req, res);
    const sheets = getSheetsClient(tokens);

    const list = await readSettingsList(sheets, 'teachers');
    const updated = list.map(t => t.name === name ? { ...t, archived: false } : t);
    await writeSettingsList(sheets, 'teachers', updated);

    res.json({ message: 'Teacher unarchived' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ========================================
// CHALLENGES
// ========================================
router.get('/challenges', requireAuth, async (req, res) => {
  try {
    const tokens = await getSheetsAuth(req, res);
    const sheets = getSheetsClient(tokens);

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: `'${CHALLENGES_SHEET}'!A:N`
    });

    const data = response.data.values || [];
    const challenges = [];

    for (let i = 1; i < data.length; i++) {
      if (data[i][0]) {
        challenges.push({
          row: i + 1,
          id: String(data[i][0]),
          type: data[i][1] || '',
          who: data[i][2] || '',
          name: data[i][3] || '',
          piece: data[i][4] || '',
          ref: data[i][5] || '',
          barFrom: data[i][6] || '',
          barTo: data[i][7] || '',
          bpm: data[i][8] || '',
          timeSpent: Number(data[i][9]) || 0,
          sessions: Number(data[i][10]) || 0,
          status: data[i][11] || 'To do',
          challPriority: Number(data[i][12]) || 999,
          itemPriority: Number(data[i][13]) || 999
        });
      }
    }

    res.json(challenges.sort((a, b) => {
      if (a.challPriority !== b.challPriority) return a.challPriority - b.challPriority;
      return a.itemPriority - b.itemPriority;
    }));
  } catch (error) {
    console.error('Challenges fetch error:', error);
    res.status(500).json({ error: error.message });
  }
});

router.post('/challenges', requireAuth, async (req, res) => {
  try {
    const { items } = req.body;
    const tokens = await getSheetsAuth(req, res);
    const sheets = getSheetsClient(tokens);

    const newId = items[0].id || Date.now().toString().slice(-6);

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: `'${CHALLENGES_SHEET}'!A:A`
    });

    const data = response.data.values || [];
    let maxChallPriority = 0;
    for (let i = 1; i < data.length; i++) {
      let p = Number(data[i][0]);
      if (!isNaN(p) && p > maxChallPriority && p !== 999) maxChallPriority = p;
    }
    maxChallPriority += 1;

    const rows = items.map((item, idx) => [
      newId, item.type || '', item.who || '', item.name || '', item.piece || '',
      item.ref || '', item.barFrom || '', item.barTo || '', item.bpm || '',
      0, 0, 'To do', item.id ? item.challPriority : maxChallPriority, idx + 1
    ]);

    const sheetData = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: `'${CHALLENGES_SHEET}'!A:A`
    });
    const lastRow = (sheetData.data.values || []).length + 1;

    await sheets.spreadsheets.values.update({
      spreadsheetId: SHEET_ID,
      range: `'${CHALLENGES_SHEET}'!A${lastRow}`,
      valueInputOption: 'RAW',
      resource: { values: rows }
    });

    res.json({ newId });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/challenges/:row', requireAuth, async (req, res) => {
  try {
    const { row } = req.params;
    const { timeSpent, status, piece, ref, barFrom, barTo, bpm } = req.body;
    const tokens = await getSheetsAuth(req, res);
    const sheets = getSheetsClient(tokens);

    // Editing a task's details (piece/ref/bars/bpm, columns E-I) and logging
    // practise progress (timeSpent/status, columns J-L) are independent -
    // only touch whichever half of the row the caller actually sent.
    if ([piece, ref, barFrom, barTo, bpm].some(v => v !== undefined)) {
      await sheets.spreadsheets.values.update({
        spreadsheetId: SHEET_ID,
        range: `'${CHALLENGES_SHEET}'!E${row}:I${row}`,
        valueInputOption: 'RAW',
        resource: { values: [[piece || '', ref || '', barFrom || '', barTo || '', bpm || '']] }
      });
    }

    if (timeSpent !== undefined || status !== undefined) {
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId: SHEET_ID,
        range: `'${CHALLENGES_SHEET}'!J${row}:L${row}`
      });

      const currentRow = (response.data.values || [[0, 0, '']])[0];
      const newTimeSpent = (Number(currentRow[0]) || 0) + (timeSpent || 0);
      const newSessions = (Number(currentRow[1]) || 0) + 1;

      await sheets.spreadsheets.values.update({
        spreadsheetId: SHEET_ID,
        range: `'${CHALLENGES_SHEET}'!J${row}:L${row}`,
        valueInputOption: 'RAW',
        resource: { values: [[newTimeSpent, newSessions, status || currentRow[2]]] }
      });
    }

    res.json({ message: 'Challenge updated' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Appends a new task to an existing challenge group, reusing that group's
// shared id/type/who/name/challPriority (mirrors what POST /challenges does
// for a brand-new challenge, but for one more task under an existing one).
router.post('/challenges/group/:id/items', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { piece, ref, barFrom, barTo, bpm } = req.body;
    const tokens = await getSheetsAuth(req, res);
    const sheets = getSheetsClient(tokens);

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: `'${CHALLENGES_SHEET}'!A:N`
    });
    const data = response.data.values || [];

    let groupRow = null;
    let maxItemPriority = 0;
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][0]) === String(id)) {
        groupRow = data[i];
        const p = Number(data[i][13]);
        if (!isNaN(p) && p > maxItemPriority) maxItemPriority = p;
      }
    }
    if (!groupRow) return res.status(404).json({ error: 'Challenge not found' });

    const newRow = [
      id, groupRow[1] || '', groupRow[2] || '', groupRow[3] || '',
      piece || '', ref || '', barFrom || '', barTo || '', bpm || '',
      0, 0, 'To do', groupRow[12] || 999, maxItemPriority + 1
    ];

    await sheets.spreadsheets.values.update({
      spreadsheetId: SHEET_ID,
      range: `'${CHALLENGES_SHEET}'!A${data.length + 1}`,
      valueInputOption: 'RAW',
      resource: { values: [newRow] }
    });

    res.json({ message: 'Task added' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Whole-challenge operations act on every row sharing a challenge's group id
// (not a single sheet row) - renaming or deleting "the challenge" means every
// task under it, so these can't reuse the single-row :row endpoints below.
router.put('/challenges/group/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, priority } = req.body;
    const tokens = await getSheetsAuth(req, res);
    const sheets = getSheetsClient(tokens);

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: `'${CHALLENGES_SHEET}'!A:N`
    });

    const data = response.data.values || [];
    const updates = [];
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][0]) === String(id)) {
        if (name !== undefined) updates.push({ range: `'${CHALLENGES_SHEET}'!D${i + 1}`, values: [[name]] });
        if (priority !== undefined) updates.push({ range: `'${CHALLENGES_SHEET}'!M${i + 1}`, values: [[priority]] });
      }
    }

    if (updates.length) {
      await sheets.spreadsheets.values.batchUpdate({
        spreadsheetId: SHEET_ID,
        resource: { valueInputOption: 'RAW', data: updates }
      });
    }

    res.json({ message: 'Challenge updated', updated: updates.length });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/challenges/group/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const tokens = await getSheetsAuth(req, res);
    const sheets = getSheetsClient(tokens);

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: `'${CHALLENGES_SHEET}'!A:A`
    });

    const data = response.data.values || [];
    const ranges = [];
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][0]) === String(id)) ranges.push(`'${CHALLENGES_SHEET}'!${i + 1}:${i + 1}`);
    }

    if (ranges.length) {
      await sheets.spreadsheets.values.batchClear({
        spreadsheetId: SHEET_ID,
        resource: { ranges }
      });
    }

    res.json({ message: 'Challenge deleted', deleted: ranges.length });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Closes every not-yet-complete task in a challenge (grouped by shared id,
// not sheet row) in one go, marking them "Closed" rather than "Complete" so
// abandoned work doesn't read as finished.
router.put('/challenges/:id/close', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const tokens = await getSheetsAuth(req, res);
    const sheets = getSheetsClient(tokens);

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: `'${CHALLENGES_SHEET}'!A:L`
    });

    const data = response.data.values || [];
    const updates = [];
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][0]) === String(id) && data[i][11] !== 'Complete') {
        updates.push({ range: `'${CHALLENGES_SHEET}'!L${i + 1}`, values: [['Closed']] });
      }
    }

    if (updates.length) {
      await sheets.spreadsheets.values.batchUpdate({
        spreadsheetId: SHEET_ID,
        resource: { valueInputOption: 'RAW', data: updates }
      });
    }

    res.json({ message: 'Challenge closed', updated: updates.length });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/challenges/:row', requireAuth, async (req, res) => {
  try {
    const { row } = req.params;
    const tokens = await getSheetsAuth(req, res);
    const sheets = getSheetsClient(tokens);

    await sheets.spreadsheets.values.clear({
      spreadsheetId: SHEET_ID,
      range: `'${CHALLENGES_SHEET}'!${row}:${row}`
    });

    res.json({ message: 'Challenge deleted' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
