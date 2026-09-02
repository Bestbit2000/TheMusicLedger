import express from 'express';
import { getAuthorizationUrl, getTokensFromCode } from '../config/google.js';
import { getFirestore, getAuth } from '../config/firebase.js';

const router = express.Router();

// Step 1: Redirect to Google OAuth consent screen
router.get('/login', (req, res) => {
  const authUrl = getAuthorizationUrl();
  res.redirect(authUrl);
});

// Step 2: Handle OAuth callback
router.get('/callback', async (req, res) => {
  try {
    const { code } = req.query;

    if (!code) {
      return res.status(400).json({ error: 'No authorization code provided' });
    }

    // Exchange code for tokens
    const tokens = await getTokensFromCode(code);

    // Get user info from Google (via tokens)
    const userEmail = req.query.user_email || 'user@example.com'; // You'll need to get this from Google

    const db = getFirestore();
    const auth = getAuth();

    // Create or update user in Firestore
    const userRef = db.collection('users').doc(userEmail);
    const userDoc = await userRef.get();

    if (!userDoc.exists) {
      // Create new user
      await userRef.set({
        email: userEmail,
        googleAccessToken: tokens.access_token,
        googleRefreshToken: tokens.refresh_token,
        googleTokenExpiry: tokens.expiry_date,
        createdAt: new Date(),
        lastLogin: new Date()
      });
    } else {
      // Update existing user's tokens
      await userRef.update({
        googleAccessToken: tokens.access_token,
        googleRefreshToken: tokens.refresh_token || userDoc.data().googleRefreshToken,
        googleTokenExpiry: tokens.expiry_date,
        lastLogin: new Date()
      });
    }

    // Create Firebase custom token for client
    const firebaseToken = await auth.createCustomToken(userEmail);

    // Redirect to frontend with token
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    res.redirect(`${frontendUrl}?firebaseToken=${firebaseToken}&userId=${userEmail}`);
  } catch (error) {
    console.error('OAuth callback error:', error);
    res.status(500).json({ error: 'Authentication failed', details: error.message });
  }
});

// Get current user (if authenticated via Firebase token)
router.get('/user', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Missing authorization token' });
    }

    const token = authHeader.substring(7);
    const auth = getAuth();
    const decodedToken = await auth.verifyIdToken(token);

    const db = getFirestore();
    const userDoc = await db.collection('users').doc(decodedToken.uid).get();

    if (!userDoc.exists) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      userId: decodedToken.uid,
      email: userDoc.data().email,
      hasGoogleToken: !!userDoc.data().googleAccessToken
    });
  } catch (error) {
    console.error('User endpoint error:', error);
    res.status(401).json({ error: 'Invalid token' });
  }
});

// Logout (client-side, but can clear server state if needed)
router.post('/logout', (req, res) => {
  // Sessions handled by client (token deletion)
  res.json({ message: 'Logout successful' });
});

export default router;
