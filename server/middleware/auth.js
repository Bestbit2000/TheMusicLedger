import { getFirestore, getAuth } from '../config/firebase.js';

export async function requireAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Missing authorization token' });
    }

    const token = authHeader.substring(7);
    const firebaseAuth = getAuth();
    const decodedToken = await firebaseAuth.verifyIdToken(token);

    req.userId = decodedToken.uid;
    req.user = decodedToken;
    next();
  } catch (error) {
    console.error('Auth error:', error);
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}

export async function getUserTokens(userId) {
  const db = getFirestore();
  const userDoc = await db.collection('users').doc(userId).get();

  if (!userDoc.exists) {
    throw new Error('User not found');
  }

  const userData = userDoc.data();
  if (!userData.googleAccessToken) {
    throw new Error('No Google access token found');
  }

  return {
    access_token: userData.googleAccessToken,
    refresh_token: userData.googleRefreshToken,
    expiry_date: userData.googleTokenExpiry
  };
}

export async function saveUserTokens(userId, tokens) {
  const db = getFirestore();
  await db.collection('users').doc(userId).update({
    googleAccessToken: tokens.access_token,
    googleRefreshToken: tokens.refresh_token || undefined,
    googleTokenExpiry: tokens.expiry_date,
    lastTokenUpdate: new Date()
  });
}
