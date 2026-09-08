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
  // 5-arg form deliberately - passport-oauth2 only hands back the raw token
  // response (params, incl. expires_in) when the verify callback's arity is
  // 5, vs. 4 for the simpler (accessToken, refreshToken, profile, done) form.
  (accessToken, refreshToken, params, profile, done) => {
    const email = profile.emails?.[0]?.value;
    if (!email) return done(new Error('Google profile has no email address'));

    const expiresInMs = (params.expires_in ? Number(params.expires_in) : 3600) * 1000;

    done(null, {
      userId: email,
      email,
      // Carried through so account creation (server/services/accounts.js)
      // has a real name on first login rather than leaving it blank.
      firstName: profile.name?.givenName || '',
      surname: profile.name?.familyName || '',
      access_token: accessToken,
      refresh_token: refreshToken,
      expiry_date: Date.now() + expiresInMs
    });
  }
));

// Required boilerplate only - req.user is never persisted across requests
// (session: false everywhere this strategy is used), so these are never
// actually invoked in practice.
passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((user, done) => done(null, user));

export default passport;
