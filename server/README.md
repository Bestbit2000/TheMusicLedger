# TheMusicLedger Backend

Node.js/Express backend for TheMusicLedger music practice tracking app.

## Setup

### 1. Install Dependencies
```bash
cd server
npm install
```

### 2. Create `.env` File
Copy your Google OAuth credentials into a `.env` file in the `/server` directory:
```
GOOGLE_CLIENT_ID=your-client-id
GOOGLE_CLIENT_SECRET=your-client-secret
GOOGLE_SHEET_ID=your-sheet-id
GOOGLE_REDIRECT_URI=http://localhost:3000/auth/callback

SESSION_SECRET=your-random-secret-key-min-32-chars
PORT=3000
NODE_ENV=development
FRONTEND_URL=http://localhost:3000
```

### 3. Run Locally
```bash
npm run dev
```

The server will start on `http://localhost:3000`

## API Endpoints

### Authentication
- `GET /auth/login` - Start OAuth flow
- `GET /auth/callback` - OAuth callback (handled by Google)
- `POST /auth/logout` - Logout

### Sessions (Practice Logging - Google Sheets)
- `GET /api/sessions` - Get all sessions from Google Sheet
- `POST /api/sessions` - Log a new session to Google Sheet

## Architecture

```
/server
├── server.js              # Main Express app
├── package.json           # Dependencies
├── .env                   # Credentials (not committed)
├── config/
│   ├── firebase.js       # Stubbed out (no longer used)
│   └── google.js         # Google OAuth & Sheets setup
├── routes/
│   ├── auth.js           # Google OAuth endpoints
│   └── api.js            # API endpoints (Google Sheets only)
└── middleware/
    └── auth.js           # Token validation middleware
```

## Key Features

- **OAuth 2.0**: Secure Google login via Google
- **Google Sheets**: Single source of truth for all data
- **Token-Based Auth**: User tokens passed from client
- **Simplified Stack**: No backend database dependency
- **Error Handling**: Comprehensive error handling

## Deployment

Before deploying to Vercel:

1. Update `GOOGLE_REDIRECT_URI` to your production URL
2. Add your production domain to Google OAuth authorized URIs
3. Set environment variables in Vercel dashboard
4. Push to GitHub (`.env` is in `.gitignore`)

## Troubleshooting

**"Module not found"**
- Run `npm install` to install dependencies

**"Google OAuth error"**
- Make sure redirect URI matches exactly (including http vs https)
- Check Google Cloud credentials are correct in `.env`
- Verify GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET match your Google Cloud project

**"Google Sheets API error"**
- Make sure GOOGLE_SHEET_ID is correct and matches your sheet ID
- Verify the Google account has edit access to the sheet
- Check that Google Sheets API is enabled in your Google Cloud project

**"CORS error"**
- Frontend must match FRONTEND_URL in `.env`
- Update CORS origins in server.js if needed
