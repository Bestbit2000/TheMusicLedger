import { securityHeadersMiddleware } from './middleware/securityHeaders.js';
import path from 'path';
import { fileURLToPath } from 'url';
import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import passport from './config/passport.js';
import authRoutes from './routes/auth.js';
import apiRoutes from './routes/api.js';
import adminRoutes from './routes/admin.js';
import { sendError } from './utils/httpErrors.js';
import { APP_PATH, forwardToApp } from './utils/appPath.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

// Trust Vercel's proxy so req.protocol correctly reports "https" instead of
// the "http" used internally between Vercel's edge and the function.
app.set('trust proxy', 1);

// ML-231: security headers on every answer (server/middleware/securityHeaders.js)
app.use(securityHeadersMiddleware);

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

// ML-392: Chrome hides an Android phone's model unless the site asks for it - then the app's own
// requests carry it (Sec-CH-UA-Model), for the owner's new sign-up email. Other browsers ignore this.
app.use((req, res, next) => { res.set('Accept-CH', 'Sec-CH-UA-Model'); next(); });

// An answer from the server is never kept by a browser. Express gives every JSON answer an ETag, so a
// browser asks "has it changed?" and, on "no" (304), hands the app the answer it kept - headers and all.
// One of those headers is X-Refreshed-Token (ML-475): a kept answer carrying it was replayed for weeks,
// and each time the app swapped its good sign-in for that old one - which, once it had run out, signed the
// member out on every page load. Found on 12 Oct 2026; it is very likely what ML-48 was. The app also asks
// with cache: 'no-store' (apiCall), which is what frees a browser that already holds such an answer.
app.use(['/api', '/auth'], (req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });

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

// ML-242: the front door is the public page and the app lives at /app (server/utils/appPath.js). A link to
// the front door made for the app before the move (an invitation or reset email, ?flow=, a preview) is
// forwarded to /app with its address intact; a sign-in hand-back after the "#" never reaches the server, so
// the public page's own public-hop.js forwards that, and a member already signed in on the device.
// /app is served without a trailing slash so the page's relative links (tokens.css, app.js) still resolve
// from the root; /app/ is sent there.
app.get('/', (req, res) => {
  if (forwardToApp(req.query)) return res.redirect(302, `${APP_PATH}${req.originalUrl.slice(1)}`);
  res.sendFile(path.join(publicPath, 'welcome.html'));
});
app.get(APP_PATH, (req, res) => {
  if (req.path.endsWith('/')) return res.redirect(301, `${APP_PATH}${req.originalUrl.slice(APP_PATH.length + 1)}`);
  res.sendFile(path.join(publicPath, 'index.html'));
});

app.use(express.static(publicPath, { index: false }));

// SPA fallback - must be last
app.get('*', (req, res) => {
  res.sendFile(path.join(publicPath, 'index.html'));
});

// Error handling - same sendError helper every route's own try/catch uses (server/utils/
// httpErrors.js), for anything that somehow escapes those instead (e.g. a synchronous throw
// outside a route handler).
app.use((err, req, res, next) => {
  sendError(res, err);
});

export default app;
