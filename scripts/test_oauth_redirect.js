/**
 * This script simulates an OAuth redirect to test session and callback handling
 * Run with: node scripts/test_oauth_redirect.js
 */

import express from 'express';
import session from 'express-session';
import createMemoryStore from 'memorystore';
import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const MemoryStore = createMemoryStore(session);

// Session setup
app.use(session({
  secret: process.env.SESSION_SECRET || 'test-secret-key',
  resave: false,
  saveUninitialized: true,
  store: new MemoryStore(),
  cookie: { secure: false, maxAge: 24 * 60 * 60 * 1000 }
}));

// Initialize Passport
app.use(passport.initialize());
app.use(passport.session());

// Passport serialization
passport.serializeUser((user, done) => {
  console.log('Serializing user:', user);
  done(null, user);
});

passport.deserializeUser((obj, done) => {
  console.log('Deserializing user:', obj);
  done(null, obj);
});

// Get the environment variables
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID_TEST;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET_TEST;
const REPL_SLUG = process.env.REPL_SLUG?.toLowerCase();
const REPL_OWNER = process.env.REPL_OWNER; // Keep original casing

// Determine callback URL - match Google Console exactly
const CALLBACK_URL = REPL_SLUG && REPL_OWNER
  ? `https://${REPL_SLUG}.${REPL_OWNER}.repl.co/test/callback`
  : 'http://localhost:3001/test/callback';

console.log('Test server configuration:', {
  callbackUrl: CALLBACK_URL,
  hasClientId: !!GOOGLE_CLIENT_ID,
  hasClientSecret: !!GOOGLE_CLIENT_SECRET,
  replSlug: REPL_SLUG,
  replOwner: REPL_OWNER,
  fullUrl: `https://${REPL_SLUG}.${REPL_OWNER}.repl.co`,
  timestamp: new Date().toISOString()
});

// Google strategy
passport.use(new GoogleStrategy({
  clientID: GOOGLE_CLIENT_ID,
  clientSecret: GOOGLE_CLIENT_SECRET,
  callbackURL: CALLBACK_URL,
  userProfileURL: "https://www.googleapis.com/oauth2/v3/userinfo"
}, (accessToken, refreshToken, profile, done) => {
  console.log('Google profile received:', {
    id: profile.id,
    displayName: profile.displayName,
    emails: profile.emails,
    timestamp: new Date().toISOString()
  });
  return done(null, {
    id: profile.id,
    displayName: profile.displayName,
    email: profile.emails[0].value
  });
}));

// Test routes
app.get('/test', (req, res) => {
  console.log('Session before auth:', req.session);
  console.log('User before auth:', req.user);
  res.send(`
    <h1>OAuth Test</h1>
    <p>Testing Google OAuth flow</p>
    <p>Callback URL: ${CALLBACK_URL}</p>
    <a href="/test/auth">Login with Google</a>
  `);
});

app.get('/test/auth', (req, res, next) => {
  console.log('Starting OAuth flow:', {
    headers: req.headers,
    timestamp: new Date().toISOString()
  });
  passport.authenticate('google', {
    scope: ['profile', 'email'],
    prompt: 'select_account'
  })(req, res, next);
});

app.get('/test/callback', 
  (req, res, next) => {
    console.log('Callback received:', { 
      query: req.query,
      session: req.session,
      sessionId: req.sessionID,
      headers: req.headers,
      timestamp: new Date().toISOString()
    });
    next();
  },
  passport.authenticate('google', { failureRedirect: '/test' }),
  (req, res) => {
    console.log('Authentication successful:', { 
      user: req.user,
      session: req.session,
      isAuthenticated: req.isAuthenticated(),
      timestamp: new Date().toISOString()
    });
    res.send(`
      <h1>Authentication Successful</h1>
      <p>Hello, ${req.user.displayName}</p>
      <p>Email: ${req.user.email}</p>
      <p>Session ID: ${req.sessionID}</p>
      <a href="/test/profile">View Profile</a>
    `);
  }
);

app.get('/test/profile', (req, res) => {
  if (!req.isAuthenticated()) {
    return res.redirect('/test');
  }

  console.log('Profile request:', {
    isAuthenticated: req.isAuthenticated(),
    user: req.user,
    session: req.session,
    timestamp: new Date().toISOString()
  });

  res.send(`
    <h1>Profile</h1>
    <p>ID: ${req.user.id}</p>
    <p>Name: ${req.user.displayName}</p>
    <p>Email: ${req.user.email}</p>
    <a href="/test/logout">Logout</a>
  `);
});

app.get('/test/logout', (req, res) => {
  req.logout(() => {
    res.redirect('/test');
  });
});

// Start test server
const PORT = 3001;
app.listen(PORT, () => {
  console.log(`OAuth test server running at http://0.0.0.0:${PORT}/test`);
  console.log(`Make sure to add ${CALLBACK_URL} to your Google Cloud Console authorized redirect URIs`);
});