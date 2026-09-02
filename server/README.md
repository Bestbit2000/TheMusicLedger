# TheMusicLedger Backend

Node.js/Express backend for TheMusicLedger music practice tracking app.

## Setup

### 1. Install Dependencies
```bash
cd server
npm install
```

### 2. Create `.env` File
Copy your credentials into a `.env` file in the `/server` directory:
```
GOOGLE_CLIENT_ID=your-client-id
GOOGLE_CLIENT_SECRET=your-client-secret
GOOGLE_SHEET_ID=your-sheet-id
GOOGLE_REDIRECT_URI=http://localhost:3000/auth/callback

FIREBASE_PROJECT_ID=your-project-id
FIREBASE_AUTH_DOMAIN=your-auth-domain
FIREBASE_API_KEY=your-api-key
FIREBASE_STORAGE_BUCKET=your-bucket
FIREBASE_MESSAGING_SENDER_ID=your-sender-id
FIREBASE_APP_ID=your-app-id

FIREBASE_TYPE=service_account
FIREBASE_PRIVATE_KEY_ID=your-key-id
FIREBASE_PRIVATE_KEY=your-private-key
FIREBASE_CLIENT_EMAIL=your-service-account-email
FIREBASE_CLIENT_ID=your-client-id
FIREBASE_AUTH_URI=https://accounts.google.com/o/oauth2/auth
FIREBASE_TOKEN_URI=https://oauth2.googleapis.com/token

SESSION_SECRET=your-random-secret-key-min-32-chars
PORT=3000
NODE_ENV=development
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
- `GET /auth/user` - Get current user (requires Firebase token)
- `POST /auth/logout` - Logout

### Sessions (Practice Logging)
- `GET /api/sessions` - Get all sessions (requires auth)
- `POST /api/sessions` - Log a new session
- `PUT /api/sessions/:id` - Update session
- `DELETE /api/sessions/:id` - Delete session

### Challenges
- `GET /api/challenges` - Get all challenges
- `POST /api/challenges` - Create new challenge
- `PUT /api/challenges/:id` - Update challenge
- `DELETE /api/challenges/:id` - Delete challenge

### Settings
- `GET /api/settings` - Get user settings
- `POST /api/settings/organisations` - Add organisation
- `POST /api/settings/teachers` - Add teacher
- `DELETE /api/settings/organisations/:name` - Remove organisation

## Architecture

```
/server
├── server.js              # Main Express app
├── package.json           # Dependencies
├── .env                   # Credentials (not committed)
├── .env.example          # Example credentials
├── config/
│   ├── firebase.js       # Firebase initialization
│   └── google.js         # Google OAuth & Sheets setup
├── routes/
│   ├── auth.js           # Authentication endpoints
│   └── api.js            # API endpoints
└── middleware/
    └── auth.js           # Authentication middleware
```

## Key Features

- **OAuth 2.0**: Secure Google login
- **Firestore**: Cloud database for sessions, challenges, settings
- **Google Sheets Sync**: Automatically syncs data to Google Sheet
- **User Auth**: Firebase token-based authentication
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

**"Firebase initialization failed"**
- Check `.env` file has all Firebase credentials
- Private key must have `\n` characters preserved

**"Google OAuth error"**
- Make sure redirect URI matches exactly (including http vs https)
- Check Google Cloud credentials are correct

**"CORS error"**
- Frontend must be on localhost:3000 or add to CORS origins in server.js
