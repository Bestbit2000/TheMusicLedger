import path from 'path';
import { fileURLToPath } from 'url';
import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import passport from './config/passport.js';
import authRoutes from './routes/auth.js';
import apiRoutes from './routes/api.js';
import adminRoutes from './routes/admin.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

// Trust Vercel's proxy so req.protocol correctly reports "https" instead of
// the "http" used internally between Vercel's edge and the function.
app.set('trust proxy', 1);

// Middleware
app.use(cors({
  origin: [
    'http://localhost:3000',
    'http://localhost:5000',
    'http://127.0.0.1:3000',
    'https://the-music-ledger.vercel.app'
  ],
  credentials: true,
  exposedHeaders: ['X-Refreshed-Token']
}));

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// No express-session here, deliberately: its default MemoryStore isn't
// reliable across separate Vercel serverless invocations, and nothing in
// this app actually needs a server-held session - auth stays bearer-token
// based (server/utils/authToken.js), and the login flow's CSRF/state
// protection uses its own signed, session-less store (server/utils/stateStore.js).
app.use(passport.initialize());

// Routes FIRST (before static files)
app.use('/auth', authRoutes);
app.use('/api', apiRoutes);
app.use('/api/admin', adminRoutes);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Serve static frontend files
const publicPath = path.resolve(__dirname, '../public');
app.use(express.static(publicPath));

// SPA fallback - must be last
app.get('*', (req, res) => {
  res.sendFile(path.join(publicPath, 'index.html'));
});

// Error handling
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
});

export default app;
