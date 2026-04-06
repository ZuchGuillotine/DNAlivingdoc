  ☒ Analyze current codebase structure and deployment configuration
     ☒ Create ECR repository for Docker image hosting
     ☒ Fix Dockerfile to use pre-built dist/ and avoid cloud rebuilds
     ☐ Temporarily disable Secrets Manager loading in env.ts
     ☐ Handle large GOOGLE_VISION_CREDENTIALS via alternative method
     ☐ Build and test Docker image locally
     ☐ Push Docker image to ECR
     ☐ Create Dockerrun.aws.json for EB deployment
     ☐ Configure EB environment variables (except large ones)
     ☐ Deploy to EB and verify application startup
     ☐ Test application functionality end-to-end


# Elastic Beanstalk Deployment Troubleshooting Session

**Date:** June 16-17, 2025  
**Status:** UNRESOLVED - Multiple deployment failures  
**Environment:** AWS Elastic Beanstalk (Docker on Amazon Linux 2023)  
**Application:** StackTracker Node.js/Express app with React frontend

## Problem Statement

The application builds successfully locally and runs on localhost, but consistently fails to deploy on AWS Elastic Beanstalk. After 7-8+ deployment attempts across multiple environments, the application crashes immediately on startup with database connection errors.

## Root Cause Analysis

### Primary Issue: Module Import Order
The fundamental problem is that database imports happen at the **module level** before environment variables can be loaded from AWS Secrets Manager. This creates a chicken-and-egg problem:

1. Application starts → imports modules
2. `db/index.ts` is imported → immediately requires `DATABASE_URL`
3. Environment variables haven't been loaded yet → `DATABASE_URL` is undefined
4. Application crashes before Secrets Manager code can execute

### Secondary Issues Discovered
1. **Dockerfile rebuild conflicts** - Container was rebuilding app during deployment, overwriting local build
2. **`.dockerignore` misconfiguration** - Initially excluded `dist/` directory needed for production
3. **Port configuration mismatches** - App defaulted to 3001 but EB expected port 80
4. **IAM permissions** - Required manual policy attachment for Secrets Manager access

## Deployment History & Attempts

### Environment History
- `stacktracker-env-v3` - Multiple failed deployments, timeouts
- `stacktracker-env-v4` - Created to avoid potential corruption, failed
- `stacktracker-env-v5` - Clean environment, proper VPC, still failing

### Attempt 1: Initial Deployment Issues
**Problem:** Application failing with missing environment variables  
**Approach:** Basic troubleshooting  
**Result:** Confirmed environment variables not available

### Attempt 2: AWS Secrets Manager Integration
**Problem:** Environment variables not available in production  
**Approach:** 
- Created `server/utils/secretsManager.ts` with AWS SDK client
- Modified `server/config/env.ts` to load from Secrets Manager in production
- Added fallback error handling for missing secrets

**Implementation:**
```typescript
// secretsManager.ts
export async function getEnvironmentSecrets(): Promise<Record<string, string>> {
  const secrets = await getSecret('STEBENV');
  return secrets;
}

// env.ts - Modified to load secrets in production
if (process.env.NODE_ENV === 'production') {
  await loadEnvironmentSecrets();
}
```

**Result:** Application still crashed before secrets could load

### Attempt 3: IAM Policy Configuration
**Problem:** Suspected IAM permissions for Secrets Manager  
**Approach:**
- Created IAM policy `StackTrackerSecretsManagerPolicy`
- Attached to `aws-elasticbeanstalk-ec2-role`
- Verified policy allows `secretsmanager:GetSecretValue` and `secretsmanager:DescribeSecret`

**Policy:**
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "secretsmanager:GetSecretValue",
        "secretsmanager:DescribeSecret"
      ],
      "Resource": [
        "arn:aws:secretsmanager:us-west-2:*:secret:STEBENV*"
      ]
    }
  ]
}
```

**Result:** Policy correctly attached, but application still failing

### Attempt 4: .ebextensions Timeout Issues
**Problem:** Deployment timeouts during container commands  
**Approach:**
- Created `.ebextensions/01-secrets-manager.config` with IAM policy setup
- Added container commands to verify Secrets Manager access
- Scripts were timing out after 14+ minutes

**Root Cause:** Complex shell scripts in `.ebextensions` causing deployment timeouts  
**Solution:** Removed problematic scripts, simplified to basic environment configuration

### Attempt 5: Port Configuration Fix
**Problem:** Port mismatch between Dockerfile (80) and application (3001)  
**Approach:**
- Modified server to use port 80 in production: `const PORT = process.env.PORT || (process.env.NODE_ENV === 'production' ? 80 : 3001)`
- Added `PORT: 80` to `.ebextensions` configuration
- Updated Dockerfile to expose port 80

**Result:** Port issue resolved, but core database problem persisted

### Attempt 6: Database Module Graceful Handling
**Problem:** Database module throwing immediately on missing `DATABASE_URL`  
**Approach:**
- Modified `db/index.ts` to not throw error immediately
- Added placeholder database URL: `postgresql://placeholder:placeholder@localhost:5432/placeholder`
- Implemented lazy database connection initialization
- Added graceful error logging instead of crashes

**Implementation:**
```typescript
// db/index.ts - Before fix
if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL must be set");
}

// db/index.ts - After fix
if (!process.env.DATABASE_URL) {
  console.error("⚠️  DATABASE_URL not set - database operations will fail");
  console.error("Please ensure STEBENV secret is configured in AWS Secrets Manager");
}

const poolConfig: PoolConfig = {
  connectionString: process.env.DATABASE_URL || 'postgresql://placeholder:placeholder@localhost:5432/placeholder',
};
```

**Result:** Local build showed changes, but deployed version still had old error

### Attempt 7: Clean Environment Creation
**Problem:** Potential environment corruption from multiple failed deployments  
**Approach:**
- Created fresh `stacktracker-env-v5`
- Ensured proper VPC configuration (`vpc-0028b3c9845c20985` - same as database)
- Verified IAM policy attachment
- Cleaned local Docker cache and build artifacts

**Result:** Fresh environment showed same issues

### Attempt 8: Build Process Investigation
**Problem:** Deployed code different from local build  
**Discoveries:**
- `.dockerignore` was excluding `dist/` directory
- Dockerfile was rebuilding application in container, overwriting local build
- Container build using `npm ci --omit=dev` missing dev dependencies needed for build

**Fixes Applied:**
- Removed `dist/` from `.dockerignore`
- Modified Dockerfile to use pre-built `dist/` instead of rebuilding
- Verified local build contains updated code

**Result:** Still deploying old code version

### Attempt 9: Secrets Manager Connectivity Test
**Problem:** Uncertain if Secrets Manager is accessible from EB  
**Approach:**
- Created test script to verify Secrets Manager connectivity
- Deployed minimal test version
- Result: Test never ran due to build/deployment issues

### Attempt 10: Pre-built Application Deployment
**Problem:** Container rebuild overwriting local changes  
**Approach:**
- Modified Dockerfile to copy pre-built `dist/` directory
- Removed build commands from Dockerfile
- Ensured local build artifacts included in deployment

**Final Dockerfile:**
```dockerfile
# Copy pre-built application
COPY dist/ ./dist/
COPY certs/ ./certs/
COPY server/types/ ./server/types/
```

**Result:** STILL getting identical error, suggesting deeper import order issue

## Current Error Pattern

**Consistent Error Across All Attempts:**
```
DATABASE_URL at db/index.ts: undefined
Error: DATABASE_URL must be set
    at db/index.ts (file:///app/dist/server/index.js:509:13)
    at __init (file:///app/dist/server/index.js:10:56)
```

**Error Characteristics:**
- Happens during module initialization (`__init`)
- Occurs before main application logic runs
- Always at the same line numbers (509, 10:56)
- No evidence of Secrets Manager code execution

## Technical Analysis

### Module Import Chain
The error occurs because of this import sequence:

```
server/index.ts
  ↓ imports './config/env'
  ↓ imports '../db' 
  ↓ db/index.ts executes immediately
  ↓ requires DATABASE_URL before loadEnvironmentSecrets() can run
```

### Files With Database Imports
Multiple files import database at module level:
- `server/routes.ts`
- `server/middleware/stripeAuthMiddleware.ts`
- `server/auth/routes.ts`
- `server/auth/setup.ts`
- All test files

### Build vs Deployment Discrepancy
Despite local build showing updated code with graceful database handling, deployed version consistently shows old error pattern. This suggests:
1. Build artifacts not properly included in deployment
2. Module bundling/caching issues
3. EB platform-specific build process interference

## Environment Configuration

### Current EB Configuration
```yaml
# .ebextensions/01-environment.config
option_settings:
  aws:elasticbeanstalk:application:environment:
    NODE_ENV: production
    PORT: 80
  aws:autoscaling:launchconfiguration:
    IamInstanceProfile: aws-elasticbeanstalk-ec2-role
```

### Secrets Manager Setup
- **Secret Name:** `STEBENV`
- **Region:** `us-west-2`
- **Contains:** All required environment variables as JSON
- **Access:** Verified accessible via AWS CLI locally

### Required Environment Variables
```json
{
  "DATABASE_URL": "postgresql://...",
  "SESSION_SECRET": "...",
  "OPENAI_API_KEY": "sk-...",
  "SENDGRID_API_KEY": "SG...",
  "STRIPE_SECRET_KEY": "sk_live_...",
  "GOOGLE_CLIENT_ID_PROD": "...",
  "GOOGLE_CLIENT_SECRET_PROD": "...",
  "GOOGLE_CLIENT_ID_TEST": "...",
  "GOOGLE_CLIENT_SECRET_TEST": "...",
  "GOOGLE_VISION_CREDENTIALS": "{}",
  "CUSTOM_DOMAIN": "https://..."
}
```

## Potential Solutions

### Solution 1: Bootstrap Script Approach
Create a minimal bootstrap script that loads environment variables before importing any modules:

```typescript
// bootstrap.ts
import { loadEnvironmentSecrets } from './server/utils/secretsManager';

async function bootstrap() {
  if (process.env.NODE_ENV === 'production') {
    await loadEnvironmentSecrets();
  }
  
  // Only import main server after environment is loaded
  const { default: startServer } = await import('./server/index');
  await startServer();
}

bootstrap().catch(console.error);
```

### Solution 2: Dynamic Database Import
Remove all module-level database imports and use dynamic imports only when database is needed:

```typescript
// Instead of: import { db } from '@db';
// Use: const { db } = await import('@db');
```

### Solution 3: Environment Variable Injection
Use EB environment variables instead of Secrets Manager:
- Configure environment variables directly in EB console
- Avoid Secrets Manager complexity during startup

### Solution 4: Containerized Secrets Loading
Modify container startup to load secrets before Node.js starts:

```dockerfile
COPY load-secrets.sh ./
RUN chmod +x load-secrets.sh
CMD ["./load-secrets.sh", "&&", "node", "dist/server/index.js"]
```

### Solution 5: Database Connection Pooling
Defer database connection until first use with proper error handling:

```typescript
let dbConnection: any = null;

export const getDb = async () => {
  if (!dbConnection) {
    if (!process.env.DATABASE_URL) {
      await loadEnvironmentSecrets();
    }
    dbConnection = createDatabase();
  }
  return dbConnection;
};
```

### Solution 6: Platform Change
Consider migrating to a different platform that handles environment loading better:
- AWS App Runner
- AWS ECS/Fargate
- Railway/Render/Vercel

## Lessons Learned

1. **Module-level imports in Node.js execute immediately** - Cannot defer database connections easily
2. **EB auto-deploys during environment creation** - Not just when explicitly deploying
3. **Docker build process can override local builds** - Need careful Dockerfile configuration
4. **Secrets Manager requires careful timing** - Must load before any dependent modules
5. **EB deployment caching can mask changes** - May need complete environment recreation

## Next Steps Recommendations

1. **Immediate:** Try Solution 1 (Bootstrap Script) as it addresses the core import order issue
2. **If #1 fails:** Implement Solution 2 (Dynamic Database Import) 
3. **Alternative:** Use Solution 3 (EB Environment Variables) to eliminate Secrets Manager complexity
4. **Last resort:** Consider Solution 6 (Platform Change) if EB proves too problematic

## Files Modified During Session

### Added Files
- `server/utils/secretsManager.ts` - AWS Secrets Manager client
- `.ebextensions/01-environment.config` - EB environment configuration
- `.dockerignore` - Docker build exclusions
- `test-secrets.js` - Secrets Manager connectivity test (removed)

### Modified Files
- `server/config/env.ts` - Added Secrets Manager loading
- `server/index.ts` - Updated port configuration and startup sequence
- `db/index.ts` - Added graceful database error handling
- `package.json` - Added AWS SDK dependency, updated start script
- `Dockerfile` - Multiple iterations for build process fixes

### Configuration Files
- `.ebextensions/01-secrets-manager.config` - Complex IAM setup (removed due to timeouts)
- `.ebextensions/02-container-commands.config` - Container verification (removed)

## Status Summary

**Environment:** stacktracker-env-v5 (Clean, properly configured)  
**IAM Permissions:** ✅ Correct Secrets Manager policy attached  
**Secrets Manager:** ✅ STEBENV secret accessible and contains all required variables  
**Application Build:** ✅ Builds successfully locally with graceful error handling  
**Deployment Process:** ❌ Consistently fails with module import order issue  

**Critical Blocker:** Database module imports execute before environment variables can be loaded from Secrets Manager, causing immediate application crash.

This issue requires a fundamental architectural change to how the application initializes, not just configuration adjustments.
