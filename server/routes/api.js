import express from 'express';
import { requireAuth, getUserTokens } from '../middleware/auth.js';
import { getSheetsClient, refreshAccessToken, SHEET_ID } from '../config/google.js';

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

async function getSheetsAuth(req) {
  let tokens = getUserTokens(req);
  if (tokens.expiry_date && new Date(tokens.expiry_date) < new Date()) {
    const newTokens = await refreshAccessToken(tokens.refresh_token);
    req.googleAccessToken = newTokens.access_token;
    return newTokens;
  }
  return tokens;
}

function getPracticeYear(dateObj) {
  const practiceYearEnd = (dateObj.getMonth() >= 10) ? dateObj.getFullYear() + 1 : dateObj.getFullYear();
  return `Year ${practiceYearEnd - 2024}`;
}

// ========================================
// DROPDOWN OPTIONS
// ========================================
router.get('/dropdown-options', requireAuth, async (req, res) => {
  try {
    const tokens = await getSheetsAuth(req);
    const sheets = getSheetsClient(tokens);

    const orgsResponse = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: `'${SETTINGS_SHEET}'!A4:A100`
    });

    const teachersResponse = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: `'${SETTINGS_SHEET}'!D4:D100`
    });

    const organisations = (orgsResponse.data.values || []).flat().filter(String);
    const teachers = (teachersResponse.data.values || []).flat().filter(String);

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
    const tokens = await getSheetsAuth(req);
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

    const rowData = [[practiceYear, dateObj, Number(duration)]];
    if (cols.whoCol) rowData[0].push(who || '');

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
    const tokens = await getSheetsAuth(req);
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
    const tokens = await getSheetsAuth(req);
    const sheets = getSheetsClient(tokens);

    const dateObj = new Date(date);
    const practiceYear = getPracticeYear(dateObj);
    const cols = COLUMNS[category];

    await sheets.spreadsheets.values.update({
      spreadsheetId: SHEET_ID,
      range: `'${SHEET_NAME}'!${cols.yearCol}${row}:${cols.durationCol}${row}`,
      valueInputOption: 'USER_ENTERED',
      resource: { values: [[practiceYear, dateObj, Number(duration), who || '']] }
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
    const tokens = await getSheetsAuth(req);
    const sheets = getSheetsClient(tokens);
    const cols = COLUMNS[category];

    await sheets.spreadsheets.values.update({
      spreadsheetId: SHEET_ID,
      range: `'${SHEET_NAME}'!${cols.yearCol}${row}:${cols.durationCol}${row}`,
      valueInputOption: 'RAW',
      resource: { values: [[]] }
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
    const tokens = await getSheetsAuth(req);
    const sheets = getSheetsClient(tokens);

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: `'${SETTINGS_SHEET}'!A4:A100`
    });

    let values = (response.data.values || []).flat().filter(String);
    values.push(name);
    const out = values.map(v => [v]);

    await sheets.spreadsheets.values.update({
      spreadsheetId: SHEET_ID,
      range: `'${SETTINGS_SHEET}'!A4:A100`,
      valueInputOption: 'RAW',
      resource: { values: out }
    });

    const orgResponse = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: `'${SETTINGS_SHEET}'!A4:A100`
    });
    const teachersResponse = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: `'${SETTINGS_SHEET}'!D4:D100`
    });

    res.json({
      organisations: (orgResponse.data.values || []).flat().filter(String),
      teachers: (teachersResponse.data.values || []).flat().filter(String)
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/settings/teachers', requireAuth, async (req, res) => {
  try {
    const { name } = req.body;
    const tokens = await getSheetsAuth(req);
    const sheets = getSheetsClient(tokens);

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: `'${SETTINGS_SHEET}'!D4:D100`
    });

    let values = (response.data.values || []).flat().filter(String);
    values.push(name);
    const out = values.map(v => [v]);

    await sheets.spreadsheets.values.update({
      spreadsheetId: SHEET_ID,
      range: `'${SETTINGS_SHEET}'!D4:D100`,
      valueInputOption: 'RAW',
      resource: { values: out }
    });

    const orgResponse = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: `'${SETTINGS_SHEET}'!A4:A100`
    });
    const teachersResponse = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: `'${SETTINGS_SHEET}'!D4:D100`
    });

    res.json({
      organisations: (orgResponse.data.values || []).flat().filter(String),
      teachers: (teachersResponse.data.values || []).flat().filter(String)
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/settings/organisations/:name', requireAuth, async (req, res) => {
  try {
    const { name } = req.params;
    const tokens = await getSheetsAuth(req);
    const sheets = getSheetsClient(tokens);

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: `'${SETTINGS_SHEET}'!A4:A100`
    });

    let values = (response.data.values || []).flat().filter(String);
    values = values.filter(v => v !== decodeURIComponent(name));
    const out = values.map(v => [v]);

    await sheets.spreadsheets.values.update({
      spreadsheetId: SHEET_ID,
      range: `'${SETTINGS_SHEET}'!A4:A100`,
      valueInputOption: 'RAW',
      resource: { values: out }
    });

    res.json({ message: 'Organisation deleted' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/settings/teachers/:name', requireAuth, async (req, res) => {
  try {
    const { name } = req.params;
    const tokens = await getSheetsAuth(req);
    const sheets = getSheetsClient(tokens);

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: `'${SETTINGS_SHEET}'!D4:D100`
    });

    let values = (response.data.values || []).flat().filter(String);
    values = values.filter(v => v !== decodeURIComponent(name));
    const out = values.map(v => [v]);

    await sheets.spreadsheets.values.update({
      spreadsheetId: SHEET_ID,
      range: `'${SETTINGS_SHEET}'!D4:D100`,
      valueInputOption: 'RAW',
      resource: { values: out }
    });

    res.json({ message: 'Teacher deleted' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ========================================
// CHALLENGES
// ========================================
router.get('/challenges', requireAuth, async (req, res) => {
  try {
    const tokens = await getSheetsAuth(req);
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
    const tokens = await getSheetsAuth(req);
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
    const { timeSpent, status } = req.body;
    const tokens = await getSheetsAuth(req);
    const sheets = getSheetsClient(tokens);

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

    res.json({ message: 'Challenge updated' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/challenges/:row', requireAuth, async (req, res) => {
  try {
    const { row } = req.params;
    const tokens = await getSheetsAuth(req);
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
