import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.join(__dirname, '.env');
console.log('Loading .env from:', envPath);
const envResult = dotenv.config({ path: envPath });
if (envResult.error) {
  console.error('Dotenv error:', envResult.error.message);
} else {
  console.log('Dotenv loaded successfully');
  console.log('Parsed variables:', Object.keys(envResult.parsed || {}).join(', '));
  console.log('GOOGLE_CLIENT_ID in process.env?', !!process.env.GOOGLE_CLIENT_ID);
}

import express from 'express';
import session from 'express-session';
import cors from 'cors';
import bodyParser from 'body-parser';
import authRoutes from './routes/auth.js';
import apiRoutes from './routes/api.js';
const app = express();
const PORT = process.env.PORT || 3000;

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
  secret: process.env.SESSION_SECRET || 'dev-secret-key-change-in-production',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000
  }
}));

// Routes FIRST (before static files)
app.use('/auth', authRoutes);
app.use('/api', apiRoutes);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Serve static frontend files
const publicPath = path.resolve(__dirname, '../public');
console.log('Serving static files from:', publicPath);

// Debug middleware to log all requests
app.use((req, res, next) => {
  console.log(`[${req.method}] ${req.url}`);
  next();
});

app.use(express.static(publicPath));

// SPA fallback - must be last
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// Error handling
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`🎵 TheMusicLedger backend running on http://localhost:${PORT}`);
});
