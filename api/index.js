import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Load environment variables
dotenv.config({ path: path.join(process.cwd(), '.env') });
dotenv.config({ path: path.join(process.cwd(), '.env.local') });
dotenv.config({ path: path.join(process.cwd(), 'server', '.env') });

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Import Express app creation
async function createApp() {
  const express = (await import('express')).default;
  const session = (await import('express-session')).default;
  const cors = (await import('cors')).default;
  const bodyParser = (await import('body-parser')).default;

  const app = express();

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

  // Import routes
  try {
    const authModule = await import('../server/routes/auth.js');
    const apiModule = await import('../server/routes/api.js');

    app.use('/auth', authModule.default);
    app.use('/api', apiModule.default);
  } catch (error) {
    console.error('Error importing routes:', error);
    throw error;
  }

  // SPA fallback
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/index.html'));
  });

  return app;
}

// Create app instance (cached)
let appInstance = null;

async function getApp() {
  if (!appInstance) {
    appInstance = await createApp();
  }
  return appInstance;
}

// Export handler for Vercel
export default async (req, res) => {
  const app = await getApp();
  return app(req, res);
};
