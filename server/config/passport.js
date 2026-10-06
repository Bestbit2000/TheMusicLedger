// Google-only for now (ML-42). Microsoft is deliberately not added here -
// see ML-43. Auth stays stateless/bearer-token based: this only replaces the
// hand-rolled OAuth2Client flow's mechanics (server/config/google.js,
// removed) with a maintained strategy that gets state/CSRF protection for
// free via SignedStateStore - it does not introduce server-side sessions or
// req.user persistence.

import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { SignedStateStore } from '../utils/stateStore.js';

passport.use(new GoogleStrategy(
  {
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: process.env.GOOGLE_REDIRECT_URI,
    store: new SignedStateStore()
  },
  // ML-475: Google is only asked who someone is. Its own access and refresh keys are dropped here, at
  // the one place they arrive - they used to be carried inside the app's sign-in token (signed, but
  // readable by anyone holding it) although nothing ever called Google again for a member.
  (_accessToken, _refreshToken, profile, done) => {
    const email = profile.emails?.[0]?.value;
    if (!email) return done(new Error('Google profile has no email address'));

    done(null, {
      userId: email,
      email,
      // Carried through so account creation (server/services/accounts.js)
      // has a real name on first login rather than leaving it blank.
      firstName: profile.name?.givenName || '',
      surname: profile.name?.familyName || ''
    });
  }
));

// Required boilerplate only - req.user is never persisted across requests
// (session: false everywhere this strategy is used), so these are never
// actually invoked in practice.
passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((user, done) => done(null, user));

export default passport;
