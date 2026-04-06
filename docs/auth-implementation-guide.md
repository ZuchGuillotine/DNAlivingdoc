# Authentication Implementation Guide

## Overview
This guide covers the steps needed to implement the refactored authentication system.

## Pre-Implementation Checklist

### 1. Clean Up Before Testing
```bash
# Clear session store
rm -rf .sessions/

# Clear node modules and reinstall (to ensure clean state)
rm -rf node_modules/
npm install

# Clear any build artifacts
rm -rf dist/
```

### 2. Environment Variables
Ensure your `.env` file has all required variables:
```env
# Session
SESSION_SECRET=your-strong-secret-here

# Google OAuth (Development)
GOOGLE_CLIENT_ID_TEST=your-test-client-id
GOOGLE_CLIENT_SECRET_TEST=your-test-client-secret

# Google OAuth (Production)
GOOGLE_CLIENT_ID_PROD=your-prod-client-id
GOOGLE_CLIENT_SECRET_PROD=your-prod-client-secret

# Stripe
STRIPE_SECRET_KEY=your-stripe-secret
STRIPE_STARTER_PRODUCT_ID=prod_xxx
STRIPE_PRO_PRODUCT_ID=prod_xxx

# Domain (for production)
CUSTOM_DOMAIN=https://yourdomain.com
```

## Implementation Steps

### Step 1: Remove Old Auth Module
The old `server/auth.ts` file is no longer used but hasn't been deleted. You can either:
- Keep it temporarily as a reference
- Delete it once you've verified the new auth works

### Step 2: Update Client-Side Code
Check if your React app needs updates:

1. **Auth Context/Hooks**: Ensure they handle the new error responses
   ```typescript
   // Example: Handle Google OAuth specific errors
   if (error.authMethod === 'google') {
     // Show "Sign in with Google" button
   }
   ```

2. **API Calls**: Ensure all fetch calls include credentials
   ```typescript
   fetch('/api/endpoint', {
     credentials: 'include',
     // ... other options
   })
   ```

### Step 3: Database Schema Verification
The refactor assumes certain fields exist. Verify your schema includes:
- `users.subscriptionId` (not `stripeSubscriptionId`)
- `users.stripeCustomerId`
- `users.subscriptionTier`

If not, run migrations or update the schema.

### Step 4: Testing Order

#### Local Development Testing
1. **Start fresh**:
   ```bash
   npm run dev:local
   ```

2. **Test Manual Registration**:
   - Register new user at `/auth`
   - Verify session cookie is set
   - Check `/api/user` returns user data

3. **Test Manual Login**:
   - Log out
   - Log back in with email/password
   - Verify session persistence

4. **Test Google OAuth**:
   - Click "Sign in with Google"
   - Should redirect to Google
   - Should return to `/dashboard` after auth

5. **Test Tier Limits**:
   - As free user, try to exceed LLM request limit
   - Should get 429 error with upgrade message

#### Production Testing
1. Set `NODE_ENV=production`
2. Build the app: `npm run build`
3. Start: `npm start`
4. Verify secure cookies are set (check DevTools)

## Common Issues & Solutions

### Issue 1: "Cannot find module" errors
**Solution**: Some imports might need updating
```bash
# Check for any remaining old imports
grep -r "from './auth'" server/
grep -r "setupAuth" server/
```

### Issue 2: Session not persisting
**Solution**: Check cookie settings in DevTools
- Development: Should NOT have `Secure` flag
- Production: Should have `Secure` flag

### Issue 3: Google OAuth redirect fails
**Solution**: Verify callback URL matches exactly
- Dev: `http://localhost:3001/auth/google/callback`
- Prod: `https://yourdomain.com/auth/google/callback`

### Issue 4: TypeScript errors
**Solution**: The remaining errors in `routes.ts` don't affect auth but should be fixed:
```typescript
// Line 155: Change stripeSubscriptionId to subscriptionId
// Line 419: Ensure userId is converted to string
// Line 693: Add null check for loggedAt
```

## Monitoring & Debugging

### Enable Debug Logging
The new auth system includes extensive logging. Monitor:
```bash
# Watch server logs during testing
npm run dev:server
```

### Key Log Points
- "Setting up authentication middleware..."
- "Authentication setup complete"
- "User logged in successfully"
- "Google OAuth callback received"

### Session Store Inspection
```bash
# View active sessions
ls -la .sessions/

# Check session content (for debugging)
cat .sessions/[session-file]
```

## Migration Path for Existing Users

### Users with Google OAuth
- Password field will be 'google_oauth'
- Cannot use email/password login
- Must use Google sign-in

### Users with Email/Password
- Cannot use Google OAuth with same email
- Must continue using email/password

### Handling Conflicts
If a user tries to sign up with Google using an email that already has password auth:
- They'll see: "An account with this email already exists. Please sign in with your email and password."

## AWS Deployment Considerations

### Elastic Beanstalk Configuration
Add to `.ebextensions/nodecommand.config`:
```yaml
option_settings:
  aws:elasticbeanstalk:container:nodejs:
    NodeCommand: "node dist/server/index.js"
  aws:elasticbeanstalk:application:environment:
    NODE_ENV: production
    # Add other env vars here
```

### Session Persistence
Current setup uses file-based sessions. For multi-instance deployments:
1. Use sticky sessions in load balancer, OR
2. Migrate to Redis/DynamoDB (future enhancement)

### Health Checks
The `/health` endpoint is already configured for AWS health checks.

## Post-Implementation Verification

Run through this checklist after implementation:
- [ ] Manual registration works
- [ ] Manual login persists session
- [ ] Google OAuth redirects properly
- [ ] Tier limits are enforced
- [ ] Admin routes require admin role
- [ ] Sessions survive server restart
- [ ] No duplicate auth initialization errors
- [ ] All routes use new middleware

## Rollback Plan

If issues arise:
1. Git stash or commit current changes
2. Revert to previous commit
3. Restart server
4. The old `server/auth.ts` is still available if needed

## Next Steps

Once auth is working:
1. Delete old `server/auth.ts` file
2. Fix remaining TypeScript errors in `routes.ts`
3. Add monitoring for failed auth attempts
4. Consider adding rate limiting to auth endpoints
5. Plan Redis/DynamoDB migration for scaling 