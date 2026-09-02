import express from 'express';
import { requireAuth, getUserTokens } from '../middleware/auth.js';
import { getSheetsClient, refreshAccessToken, SHEET_ID } from '../config/google.js';

const router = express.Router();

// Helper: Get valid Google Sheets client
async function getSheetsAuth(req) {
  let tokens = getUserTokens(req);

  // Check if token needs refresh
  if (tokens.expiry_date && new Date(tokens.expiry_date) < new Date()) {
    const newTokens = await refreshAccessToken(tokens.refresh_token);
    req.googleAccessToken = newTokens.access_token;
    return newTokens;
  }

  return tokens;
}

// ========================================
// SESSIONS (Practice logging) - Google Sheets only
// ========================================

router.post('/sessions', requireAuth, async (req, res) => {
  try {
    const { category, duration, who, date } = req.body;

    const tokens = await getSheetsAuth(req);
    const sheets = getSheetsClient(tokens);

    const dateObj = new Date(date);
    const practiceYear = `Year ${dateObj.getFullYear() - 2023}`;

    const categoryMap = {
      'Practise': { yearCol: 'A', dateCol: 'B', durationCol: 'C' },
      'Rehearsal': { yearCol: 'E', whoCol: 'F', dateCol: 'G', durationCol: 'H' },
      'Lesson': { yearCol: 'J', whoCol: 'K', dateCol: 'L', durationCol: 'M' },
      'Performance': { yearCol: 'O', whoCol: 'P', dateCol: 'Q', durationCol: 'R' }
    };

    const cols = categoryMap[category];
    if (!cols) {
      return res.status(400).json({ error: 'Invalid category' });
    }

    // Get the last row
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: `'Music time'!${cols.dateCol}:${cols.dateCol}`
    });

    const values = response.data.values || [];
    const lastRow = values.length + 1;

    // Prepare the row data
    const rowData = [practiceYear];
    if (cols.dateCol) rowData.push(new Date(date).toLocaleDateString());
    if (cols.durationCol) rowData.push(duration);
    if (cols.whoCol) rowData.push(who || '');

    // Update sheet
    await sheets.spreadsheets.values.update({
      spreadsheetId: SHEET_ID,
      range: `'Music time'!${cols.yearCol}${lastRow}`,
      valueInputOption: 'RAW',
      resource: {
        values: [rowData]
      }
    });

    res.json({
      message: `Saved ${duration} mins to sheet!`,
      category,
      row: lastRow
    });
  } catch (error) {
    console.error('Session save error:', error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/sessions', requireAuth, async (req, res) => {
  try {
    const tokens = await getSheetsAuth(req);
    const sheets = getSheetsClient(tokens);

    // Read all data from the sheet
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: `'Music time'!A:R`
    });

    const values = response.data.values || [];
    const sessions = [];

    const categoryMap = {
      'Practise': { yearCol: 0, dateCol: 1, durationCol: 2 },
      'Rehearsal': { yearCol: 4, whoCol: 5, dateCol: 6, durationCol: 7 },
      'Lesson': { yearCol: 9, whoCol: 10, dateCol: 11, durationCol: 12 },
      'Performance': { yearCol: 14, whoCol: 15, dateCol: 16, durationCol: 17 }
    };

    // Parse sessions from sheet
    for (let i = 1; i < values.length; i++) {
      const row = values[i];
      if (row[0] && row[2]) {
        sessions.push({
          row: i,
          category: 'Practise',
          year: row[0],
          date: row[1],
          duration: row[2]
        });
      }
      if (row[4] && row[7]) {
        sessions.push({
          row: i,
          category: 'Rehearsal',
          year: row[4],
          who: row[5],
          date: row[6],
          duration: row[7]
        });
      }
      if (row[9] && row[12]) {
        sessions.push({
          row: i,
          category: 'Lesson',
          year: row[9],
          who: row[10],
          date: row[11],
          duration: row[12]
        });
      }
      if (row[14] && row[17]) {
        sessions.push({
          row: i,
          category: 'Performance',
          year: row[14],
          who: row[15],
          date: row[16],
          duration: row[17]
        });
      }
    }

    res.json(sessions);
  } catch (error) {
    console.error('Sessions fetch error:', error);
    res.status(500).json({ error: error.message });
  }
});

// All data is stored in Google Sheets - keep endpoints simple and focused on sessions

export default router;
