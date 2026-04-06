# Authentication Debugging Guide

## Current Issue

The authentication is failing because of how the application is being accessed in development.

### Problem
- Accessing the app at `http://localhost:3001` (Express server directly) instead of `http://localhost:5173` (Vite dev server)
- This causes session cookies to not be properly handled due to origin mismatches

### Solution

**Always access the application through the Vite dev server at `http://localhost:5173`**

## Why This Matters

1. **Vite Proxy**: The Vite dev server proxies API requests to the Express server, ensuring:
   - Same origin for cookies
   - Proper session handling
   - Hot Module Replacement (HMR) for development

2. **Cookie Domain**: When accessing directly:
   - Frontend at `localhost:3001` makes requests to `localhost:3001/api`
   - But the cookie might be set for a different domain/port
   - Session cookies don't persist across requests

## Correct Development Setup

1. Start the development server:
   ```bash
   npm run dev:local
   # or
   LOCAL_DEV=true npm run dev
   ```

2. Access the application at:
   ```
   http://localhost:5173
   ```
   NOT at `http://localhost:3001`

3. The Vite dev server will:
   - Serve the React app
   - Proxy API requests to `localhost:3001`
   - Handle cookies correctly

## Debugging Steps

If authentication still fails:

1. **Check Browser DevTools**:
   - Network tab: Look for `/api/login` request
   - Check Response Headers for `Set-Cookie`
   - Application tab > Cookies: Verify `stacktracker.sid` exists

2. **Check Server Logs**:
   - Should see "User logged in successfully"
   - Session ID should remain consistent across requests

3. **Common Issues**:
   - Wrong URL (using 3001 instead of 5173)
   - Missing environment variables
   - Browser blocking third-party cookies

## Testing Authentication

1. **Manual Login Test**:
   ```bash
   # Terminal 1: Start server
   npm run dev:local
   
   # Browser: Navigate to
   http://localhost:5173/auth
   
   # Try logging in with test credentials
   ```

2. **Check Session Persistence**:
   - After login, check if redirected to dashboard
   - Refresh the page - should stay logged in
   - Check `/api/user` returns user data

3. **Google OAuth Test**:
   - Click "Sign in with Google"
   - Should redirect to Google
   - After authorization, should return to app logged in

## Environment Variables Required

```bash
# .env file
SESSION_SECRET=<random-32-char-string>
GOOGLE_CLIENT_ID_TEST=<your-test-client-id>
GOOGLE_CLIENT_SECRET_TEST=<your-test-client-secret>
```

## If All Else Fails

1. Clear browser cookies and cache
2. Restart the development server
3. Check that all environment variables are loaded
4. Run the test script:
   ```bash
   node scripts/test-auth-simple.js
   ``` 