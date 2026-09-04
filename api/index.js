import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import session from 'express-session';
import cors from 'cors';
import bodyParser from 'body-parser';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const { default: authRoutes } = await import('../server/routes/auth.js');
const { default: apiRoutes } = await import('../server/routes/api.js');

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
  secret: process.env.SESSION_SECRET || 'dev-secret-key-change-in-production',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000
  }
}));

// Serve static frontend files
app.use(express.static(path.join(__dirname, '../public')));

// Routes
app.use('/auth', authRoutes);
app.use('/api', apiRoutes);

// Serve index.html for all non-API routes (SPA support)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

export default app;
