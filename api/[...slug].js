import dotenv from 'dotenv';
import express from 'express';
import session from 'express-session';
import cors from 'cors';
import bodyParser from 'body-parser';
import path from 'path';
import { fileURLToPath } from 'url';

// Load environment variables
dotenv.config({ path: path.join(process.cwd(), '.env') });
dotenv.config({ path: path.join(process.cwd(), '.env.local') });
dotenv.config({ path: path.join(process.cwd(), 'server', '.env') });

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let app = null;

async function initApp() {
  if (app) return app;

  console.log('[Handler] Initializing app...');
  app = express();

  // Middleware
  app.use(cors({
    origin: [
      'http://localhost:3000',
      'http://localhost:5000',
      'http://127.0.0.1:3000',
      'https://the-music-ledger.vercel.app'
    ],
    credentials: true
  }));

  app.use(bodyParser.json());
  app.use(bodyParser.urlencoded({ extended: true }));

  // Session configuration
  app.use(session({
    secret: process.env.SESSION_SECRET || 'dev-secret-key',
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === 'production',
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000
    }
  }));

  // Serve static files
  app.use(express.static(path.join(__dirname, '../public')));

  // Import and register routes
  try {
    const authMod = await import('../server/routes/auth.js');
    app.use('/auth', authMod.default);
    console.log('[Handler] Auth routes loaded');
  } catch (e) {
    console.error('[Handler] Auth routes error:', e.message);
  }

  try {
    const apiMod = await import('../server/routes/api.js');
    app.use('/api', apiMod.default);
    console.log('[Handler] API routes loaded');
  } catch (e) {
    console.error('[Handler] API routes error:', e.message);
  }

  // SPA fallback
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/index.html'));
  });

  console.log('[Handler] App ready');
  return app;
}

// Export handler for Vercel
export default async (req, res) => {
  try {
    const expressApp = await initApp();
    expressApp(req, res);
  } catch (error) {
    console.error('[Handler] Error:', error);
    res.status(500).json({ error: 'Server error', details: error.message });
  }
};
