# The Music Ledger

A practice tracking app that syncs with Google Sheets. Originally built with Google Apps Script, now rebuilt as a web app with Node.js backend and Google Sheets API integration.

## Features

- 📊 Track practice sessions by category (Practise, Rehearsal, Lesson, Performance)
- 📈 View statistics with heatmaps and charts
- 🎯 Manage practice challenges and techniques
- 🌙 Dark mode support
- 📱 Responsive design (mobile-friendly)
- ☁️ Google Sheets integration for data storage

## Local Development

### Prerequisites
- Node.js 16+
- npm
- Google account with Google Sheets access

### Setup

1. Clone the repository
```bash
git clone https://github.com/Bestbit2000/TheMusicLedger.git
cd TheMusicLedger
```

2. Set up Google OAuth credentials
   - Go to [Google Cloud Console](https://console.cloud.google.com/)
   - Create a new project
   - Enable Google Sheets API and Google+ API
   - Create OAuth 2.0 credentials (Web Application)
   - Add redirect URIs:
     - `http://localhost:3000/auth/callback` (local development)
     - `https://the-music-ledger.vercel.app/auth/callback` (production)

3. Create `.env` file in the `server/` directory
```
GOOGLE_CLIENT_ID=your_client_id
GOOGLE_CLIENT_SECRET=your_client_secret
GOOGLE_REDIRECT_URI=http://localhost:3000/auth/callback
GOOGLE_SHEET_ID=your_sheet_id
```

4. Get your Google Sheet ID
   - Open your Music Ledger spreadsheet in Google Sheets
   - The ID is in the URL: `https://docs.google.com/spreadsheets/d/{SHEET_ID}/edit`

5. Install and run
```bash
cd server
npm install
npm run dev
```

6. Open `http://localhost:3000` in your browser

## Deployment

### Option 1: Vercel (Recommended)

1. Push your code to GitHub
2. Go to [Vercel](https://vercel.com/)
3. Import your repository
4. Set environment variables in Vercel dashboard:
   - `GOOGLE_CLIENT_ID`
   - `GOOGLE_CLIENT_SECRET`
   - `GOOGLE_REDIRECT_URI` (set to your Vercel domain + /auth/callback)
   - `GOOGLE_SHEET_ID`
5. Update OAuth redirect URIs in Google Cloud Console to include your Vercel URL
6. Deploy!

### Option 2: Heroku

1. Install [Heroku CLI](https://devcenter.heroku.com/articles/heroku-cli)
2. Create a Heroku app: `heroku create your-app-name`
3. Set environment variables:
```bash
heroku config:set GOOGLE_CLIENT_ID=your_id
heroku config:set GOOGLE_CLIENT_SECRET=your_secret
heroku config:set GOOGLE_REDIRECT_URI=https://your-app-name.herokuapp.com/auth/callback
heroku config:set GOOGLE_SHEET_ID=your_sheet_id
```
4. Deploy: `git push heroku main`

### Option 3: Railway, Render, or similar

These platforms support Node.js out of the box. Set environment variables in their dashboards and deploy.

## Project Structure

```
TheMusicLedger/
├── public/              # Frontend (HTML, CSS, JS)
│   ├── index.html
│   ├── app.js
│   └── style.css
├── server/              # Node.js backend
│   ├── server.js
│   ├── package.json
│   ├── config/
│   │   └── google.js    # Google OAuth setup
│   ├── middleware/
│   │   └── auth.js      # Authentication middleware
│   └── routes/
│       ├── auth.js      # OAuth endpoints
│       └── api.js       # Google Sheets API endpoints
└── .env                 # Environment variables (local only)
```

## API Endpoints

- `GET /api/dropdown-options` - Get organisations and teachers
- `GET /api/sessions` - Get all practice sessions
- `POST /api/sessions` - Create new session
- `PUT /api/sessions/:row` - Update session
- `DELETE /api/sessions/:row` - Delete session
- `GET /api/challenges` - Get all challenges
- `POST /api/challenges` - Create challenge
- `PUT /api/challenges/:row` - Update challenge
- `DELETE /api/challenges/:row` - Delete challenge

## Google Sheets Structure

The app expects a Google Sheet with the following structure:

### "Music time" sheet
- Columns A-R with categories:
  - Practise: Year (A), Date (B), Duration (C)
  - Rehearsal: Year (E), Who (F), Date (G), Duration (H)
  - Lesson: Year (J), Who (K), Date (L), Duration (M)
  - Performance: Year (O), Who (P), Date (Q), Duration (R)

### "Settings" sheet
- Organisations in column A (starting at A4)
- Teachers in column D (starting at D4)

### "Challenges" sheet
- Challenge data with metadata

## Troubleshooting

### "Google Sheets API has not been used"
- Enable Google Sheets API in Google Cloud Console
- Wait 5-10 minutes for changes to propagate

### OAuth callback not working
- Check redirect URIs in Google Cloud Console match your deployment URL
- Ensure `GOOGLE_REDIRECT_URI` environment variable is set correctly

### Data not loading
- Verify `GOOGLE_SHEET_ID` is correct
- Check that the sheet has the expected structure
- Ensure user has access to the sheet

## License

MIT

## Author

Built with Claude Code
