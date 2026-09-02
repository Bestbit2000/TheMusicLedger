import express from 'express';
import { requireAuth, getUserTokens, saveUserTokens } from '../middleware/auth.js';
import { getSheetsClient, refreshAccessToken, SHEET_ID } from '../config/google.js';
import { getFirestore } from '../config/firebase.js';

const router = express.Router();

// Helper: Get valid Google Sheets client
async function getSheetsAuth(userId) {
  const tokens = await getUserTokens(userId);

  // Check if token needs refresh
  if (tokens.expiry_date && new Date(tokens.expiry_date) < new Date()) {
    const newTokens = await refreshAccessToken(tokens.refresh_token);
    await saveUserTokens(userId, newTokens);
    return newTokens;
  }

  return tokens;
}

// ========================================
// SESSIONS (Practice logging)
// ========================================

router.post('/sessions', requireAuth, async (req, res) => {
  try {
    const { category, duration, who, date } = req.body;
    const userId = req.userId;
    const db = getFirestore();

    // Save to Firestore
    const sessionRef = db.collection('sessions').doc();
    await sessionRef.set({
      userId,
      category,
      duration: Number(duration),
      who: who || null,
      date: new Date(date),
      createdAt: new Date(),
      syncedToSheet: false
    });

    // Try to sync to Google Sheet
    try {
      const tokens = await getSheetsAuth(userId);
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

      // Get the last row
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId: SHEET_ID,
        range: `'Music time'!${cols.dateCol}:${cols.dateCol}`
      });

      const values = response.data.values || [];
      const lastRow = values.length + 1;

      // Update sheet
      await sheets.spreadsheets.values.update({
        spreadsheetId: SHEET_ID,
        range: `'Music time'!${cols.yearCol}${lastRow}:${cols.durationCol}${lastRow}`,
        valueInputOption: 'RAW',
        resource: {
          values: [[
            practiceYear,
            null, // This will be handled by date formula
            duration,
            null, // Optional fields
            ...(cols.whoCol ? [who || ''] : [])
          ]]
        }
      });

      // Mark as synced
      await sessionRef.update({ syncedToSheet: true });
    } catch (sheetError) {
      console.warn('Sheet sync failed, data saved to Firestore only:', sheetError.message);
    }

    res.json({
      message: `Saved ${duration} mins!`,
      sessionId: sessionRef.id,
      category
    });
  } catch (error) {
    console.error('Session save error:', error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/sessions', requireAuth, async (req, res) => {
  try {
    const userId = req.userId;
    const db = getFirestore();

    const snapshot = await db.collection('sessions')
      .where('userId', '==', userId)
      .orderBy('date', 'desc')
      .get();

    const sessions = [];
    snapshot.forEach(doc => {
      sessions.push({
        id: doc.id,
        ...doc.data(),
        date: doc.data().date.toDate().toISOString().split('T')[0]
      });
    });

    res.json(sessions);
  } catch (error) {
    console.error('Sessions fetch error:', error);
    res.status(500).json({ error: error.message });
  }
});

router.put('/sessions/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { duration, who, date } = req.body;
    const userId = req.userId;
    const db = getFirestore();

    const sessionRef = db.collection('sessions').doc(id);
    const sessionDoc = await sessionRef.get();

    if (!sessionDoc.exists || sessionDoc.data().userId !== userId) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    await sessionRef.update({
      duration: Number(duration),
      who: who || null,
      date: new Date(date),
      updatedAt: new Date()
    });

    res.json({ message: 'Session updated' });
  } catch (error) {
    console.error('Session update error:', error);
    res.status(500).json({ error: error.message });
  }
});

router.delete('/sessions/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.userId;
    const db = getFirestore();

    const sessionRef = db.collection('sessions').doc(id);
    const sessionDoc = await sessionRef.get();

    if (!sessionDoc.exists || sessionDoc.data().userId !== userId) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    await sessionRef.delete();
    res.json({ message: 'Session deleted' });
  } catch (error) {
    console.error('Session delete error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ========================================
// CHALLENGES
// ========================================

router.get('/challenges', requireAuth, async (req, res) => {
  try {
    const userId = req.userId;
    const db = getFirestore();

    const snapshot = await db.collection('challenges')
      .where('userId', '==', userId)
      .orderBy('priority', 'asc')
      .get();

    const challenges = [];
    snapshot.forEach(doc => {
      challenges.push({
        id: doc.id,
        ...doc.data()
      });
    });

    res.json(challenges);
  } catch (error) {
    console.error('Challenges fetch error:', error);
    res.status(500).json({ error: error.message });
  }
});

router.post('/challenges', requireAuth, async (req, res) => {
  try {
    const userId = req.userId;
    const { type, who, name, items } = req.body;
    const db = getFirestore();

    const challengeRef = db.collection('challenges').doc();
    await challengeRef.set({
      userId,
      type,
      who: who || null,
      name,
      items: items || [],
      priority: 999,
      createdAt: new Date(),
      syncedToSheet: false
    });

    res.json({
      message: 'Challenge created',
      challengeId: challengeRef.id
    });
  } catch (error) {
    console.error('Challenge create error:', error);
    res.status(500).json({ error: error.message });
  }
});

router.put('/challenges/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.userId;
    const db = getFirestore();
    const { items, priority, ...updates } = req.body;

    const challengeRef = db.collection('challenges').doc(id);
    const challengeDoc = await challengeRef.get();

    if (!challengeDoc.exists || challengeDoc.data().userId !== userId) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    await challengeRef.update({
      ...updates,
      ...(items && { items }),
      ...(priority !== undefined && { priority }),
      updatedAt: new Date()
    });

    res.json({ message: 'Challenge updated' });
  } catch (error) {
    console.error('Challenge update error:', error);
    res.status(500).json({ error: error.message });
  }
});

router.delete('/challenges/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.userId;
    const db = getFirestore();

    const challengeRef = db.collection('challenges').doc(id);
    const challengeDoc = await challengeRef.get();

    if (!challengeDoc.exists || challengeDoc.data().userId !== userId) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    await challengeRef.delete();
    res.json({ message: 'Challenge deleted' });
  } catch (error) {
    console.error('Challenge delete error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ========================================
// SETTINGS (Organisations, Teachers)
// ========================================

router.get('/settings', requireAuth, async (req, res) => {
  try {
    const userId = req.userId;
    const db = getFirestore();

    const settingsRef = db.collection('settings').doc(userId);
    const settingsDoc = await settingsRef.get();

    if (!settingsDoc.exists) {
      // Return defaults
      return res.json({
        organisations: [],
        teachers: [],
        darkMode: false
      });
    }

    res.json(settingsDoc.data());
  } catch (error) {
    console.error('Settings fetch error:', error);
    res.status(500).json({ error: error.message });
  }
});

router.post('/settings/organisations', requireAuth, async (req, res) => {
  try {
    const userId = req.userId;
    const { name } = req.body;
    const db = getFirestore();

    const settingsRef = db.collection('settings').doc(userId);
    const settingsDoc = await settingsRef.get();

    const orgs = settingsDoc.exists ? (settingsDoc.data().organisations || []) : [];
    orgs.push(name);

    await settingsRef.set({
      organisations: [...new Set(orgs)] // Remove duplicates
    }, { merge: true });

    res.json({ message: 'Organisation added' });
  } catch (error) {
    console.error('Organisation add error:', error);
    res.status(500).json({ error: error.message });
  }
});

router.post('/settings/teachers', requireAuth, async (req, res) => {
  try {
    const userId = req.userId;
    const { name } = req.body;
    const db = getFirestore();

    const settingsRef = db.collection('settings').doc(userId);
    const settingsDoc = await settingsRef.get();

    const teachers = settingsDoc.exists ? (settingsDoc.data().teachers || []) : [];
    teachers.push(name);

    await settingsRef.set({
      teachers: [...new Set(teachers)] // Remove duplicates
    }, { merge: true });

    res.json({ message: 'Teacher added' });
  } catch (error) {
    console.error('Teacher add error:', error);
    res.status(500).json({ error: error.message });
  }
});

router.delete('/settings/organisations/:name', requireAuth, async (req, res) => {
  try {
    const userId = req.userId;
    const { name } = req.params;
    const db = getFirestore();

    const settingsRef = db.collection('settings').doc(userId);
    await settingsRef.update({
      organisations: admin.firestore.FieldValue.arrayRemove(name)
    });

    res.json({ message: 'Organisation removed' });
  } catch (error) {
    console.error('Organisation remove error:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
