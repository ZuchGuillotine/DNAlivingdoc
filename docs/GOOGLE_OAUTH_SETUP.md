# Google OAuth Setup Guide

This guide will help you set up Google OAuth for the StackTracker application.

## Prerequisites

- A Google Cloud Console account
- Access to create OAuth 2.0 credentials

## Step 1: Create a Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Click on the project dropdown and select "New Project"
3. Give your project a name (e.g., "StackTracker")
4. Click "Create"

## Step 2: Enable Required APIs

1. In the Google Cloud Console, go to "APIs & Services" > "Library"
2. Search for and enable the following APIs:
   - Google+ API (or Google People API if Google+ is deprecated)
   - Google Identity Toolkit API

## Step 3: Configure OAuth Consent Screen

1. Go to "APIs & Services" > "OAuth consent screen"
2. Choose "External" user type (unless you have a Google Workspace account)
3. Fill in the required fields:
   - App name: StackTracker
   - User support email: Your email
   - Developer contact information: Your email
4. Add scopes:
   - `../auth/userinfo.email`
   - `../auth/userinfo.profile`
5. Add test users if in testing mode (your email address)
6. Save and continue

## Step 4: Create OAuth 2.0 Credentials

### For Development (Test Credentials)

1. Go to "APIs & Services" > "Credentials"
2. Click "Create Credentials" > "OAuth client ID"
3. Choose "Web application"
4. Name it "StackTracker Development"
5. Add Authorized JavaScript origins:
   ```
   http://localhost:5173
   http://localhost:3001
   ```
6. Add Authorized redirect URIs:
   ```
   http://localhost:3001/auth/google/callback
   ```
7. Click "Create"
8. Copy the Client ID and Client Secret

### For Production

1. Create another OAuth client ID for production
2. Name it "StackTracker Production"
3. Add Authorized JavaScript origins:
   ```
   https://your-domain.com
   ```
4. Add Authorized redirect URIs:
   ```
   https://your-domain.com/auth/google/callback
   ```
5. Click "Create"
6. Copy the Client ID and Client Secret

## Step 5: Configure Environment Variables

Create or update your `.env` file with the following variables:

```bash
# Session secret (generate a random string)
SESSION_SECRET=your-random-session-secret-at-least-32-chars

# Google OAuth - Development
GOOGLE_CLIENT_ID_TEST=your-development-client-id
GOOGLE_CLIENT_SECRET_TEST=your-development-client-secret

# Google OAuth - Production
GOOGLE_CLIENT_ID_PROD=your-production-client-id
GOOGLE_CLIENT_SECRET_PROD=your-production-client-secret

# Custom domain (for production)
CUSTOM_DOMAIN=https://your-domain.com
```

## Step 6: Test the Configuration

1. Start your development server:
   ```bash
   npm run dev
   ```

2. Run the auth test script:
   ```bash
   node scripts/test-auth-simple.js
   ```

3. Navigate to http://localhost:5173/auth
4. Click "Sign in with Google"
5. You should be redirected to Google's OAuth consent screen
6. After authorization, you should be redirected back to your app

## Troubleshooting

### "Error 400: redirect_uri_mismatch"

This means the redirect URI doesn't match what's configured in Google Cloud Console.

1. Check the error page for the exact redirect URI being used
2. Add that exact URI to your OAuth client's Authorized redirect URIs
3. Wait a few minutes for changes to propagate

### "This app isn't verified"

This warning appears when your app is in testing mode.

1. Click "Advanced" > "Go to StackTracker (unsafe)"
2. Or add test users in the OAuth consent screen configuration

### Session Not Persisting

1. Check browser DevTools > Application > Cookies
2. Look for the `stacktracker.sid` cookie
3. Ensure it's being set with correct attributes:
   - Path: /
   - HttpOnly: true
   - SameSite: Lax (for development)

### Google Login Button Does Nothing

1. Check browser console for errors
2. Ensure GOOGLE_CLIENT_ID_TEST is set in your environment
3. Restart the server after setting environment variables

## Security Best Practices

1. **Never commit credentials**: Keep your `.env` file in `.gitignore`
2. **Use different credentials**: Separate development and production OAuth clients
3. **Restrict origins**: Only add necessary origins to your OAuth configuration
4. **Regular audits**: Periodically review your OAuth consent screen and credentials
5. **Secure session secret**: Use a cryptographically secure random string

## Publishing Your App

When ready to go live:

1. Submit your OAuth consent screen for verification
2. This process can take several days to weeks
3. Until verified, only test users can use Google login
4. Follow Google's verification requirements carefully 