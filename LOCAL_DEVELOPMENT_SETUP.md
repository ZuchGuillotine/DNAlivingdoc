# Local Development Setup Guide

## Overview
Yes, your application **is configured** for local development! You have all the pieces in place. Here's how to set up local development to test the biomarker chart and avoid the slow deployment cycle.

## Current Setup Analysis

### ✅ What You Have
- **Concurrent dev script**: `npm run dev` runs both client (Vite) and server simultaneously
- **Local dev script**: `npm run dev:local` with proper environment setup
- **Proxy configuration**: Vite proxies `/api` and `/auth` to localhost:3001
- **Environment loading**: Supports both `.env` files and AWS Secrets Manager
- **Database configuration**: Set up to work with your public RDS database

### 🎯 Architecture
```
Client (Vite)     Server (Express)     Database (RDS)
Port 5173    →    Port 3001       →    Public Postgres
```

## Step-by-Step Local Setup

### 1. **Create Local Environment File**

Create a `.env` file in your project root with your database credentials:

```bash
# Database (your public RDS instance)
DATABASE_URL=postgresql://your_username:your_password@your_rds_endpoint:5432/your_database

# Session management
SESSION_SECRET=your-session-secret-key

# OpenAI (for LLM features) 
OPENAI_API_KEY=sk-your-openai-key

# Google OAuth (optional for local testing)
GOOGLE_CLIENT_ID_TEST=your-google-client-id
GOOGLE_CLIENT_SECRET_TEST=your-google-client-secret

# Stripe (optional for local testing)
STRIPE_SECRET_KEY=sk_test_your-stripe-key

# Development flags
NODE_ENV=development
LOCAL_DEV=true
```

### 2. **Start Local Development**

```bash
# Option 1: Use the specialized local dev script
npm run dev:local

# Option 2: Standard dev script
npm run dev

# Option 3: Individual services (for debugging)
npm run dev:server  # Only server on port 3001
npm run dev:client  # Only client on port 5173
```

### 3. **Access Your Application**

- **Frontend**: http://localhost:5173 ← **Use this URL**
- **API**: http://localhost:3001/api (proxied automatically)
- **Server direct**: http://localhost:3001 (not recommended)

## Testing the Biomarker Chart Locally

### 1. **Verify Database Connection**
```bash
# Test database connection
npx tsx scripts/debug-biomarker-chart.ts
```

### 2. **Access Logs in Real-Time**
- Open browser console (F12)
- Navigate to `/labs`
- Watch for our debug messages:
  - `🔍 Fetching lab chart data...`
  - `📡 API Response:...`
  - `📊 Raw API Data:...`

### 3. **Test API Directly**
```bash
# Test authentication and data
curl -X GET "http://localhost:3001/api/labs/chart-data" \
  -H "Content-Type: application/json" \
  -H "Cookie: connect.sid=your_session_cookie"

# Test debug endpoint
curl -X GET "http://localhost:3001/api/labs/chart-data/debug" \
  -H "Content-Type: application/json" \
  -H "Cookie: connect.sid=your_session_cookie"
```

## Development Workflow

### 🔄 **Recommended Workflow**
1. **Local Development Cycle**:
   ```bash
   # Make changes to components/hooks
   npm run dev:local
   # Test in browser at localhost:5173
   # Check console logs and network tab
   # Iterate quickly
   ```

2. **When Ready to Deploy**:
   ```bash
   git add .
   git commit -m "Fix biomarker chart issue"
   git push origin main
   # App Runner auto-deploys
   ```

### 🐛 **Debugging Features**

#### Frontend Debugging
- **Hot reload**: Changes reflected instantly
- **Console logging**: All our debug messages visible
- **Network inspection**: See exact API calls
- **React DevTools**: Inspect component state

#### Backend Debugging
- **Auto-restart**: Server restarts on changes (tsx watch)
- **Environment logging**: See which env vars are loaded
- **Database query logs**: Monitor SQL queries
- **Error stack traces**: Full error context

#### Database Testing
- **Direct connection**: Connect with your preferred SQL client
- **Migration testing**: Run migrations locally
- **Data seeding**: Create test data for development

## Troubleshooting Common Issues

### 🔧 **Database Connection Issues**
```bash
# Test connection manually
psql "postgresql://username:password@your-rds-endpoint:5432/database"

# Check if RDS security groups allow your IP
# Check if DATABASE_URL is correctly formatted
```

### 🔧 **Port Conflicts**
```bash
# If ports 3001 or 5173 are in use
lsof -ti:3001 | xargs kill -9  # Kill process on 3001
lsof -ti:5173 | xargs kill -9  # Kill process on 5173
```

### 🔧 **Environment Variable Issues**
```bash
# Verify .env file is loaded
node -e "require('dotenv').config(); console.log(process.env.DATABASE_URL)"

# Check if AWS credentials are interfering
unset AWS_ACCESS_KEY_ID
unset AWS_SECRET_ACCESS_KEY
```

### 🔧 **CORS Issues (unlikely locally)**
Your Vite proxy handles this, but if needed:
- Server CORS is configured for localhost
- Proxy routes `/api` and `/auth` properly

## Performance Benefits

### ⚡ **Local vs Deployment Speed**
- **Local iteration**: ~2-5 seconds (hot reload)
- **App Runner deployment**: ~3-5 minutes
- **Testing cycle**: Immediate vs waiting for logs

### 🎯 **What You Can Test Locally**
- ✅ Database queries and biomarker data
- ✅ API endpoints and authentication
- ✅ Chart rendering and filtering
- ✅ Component interactions
- ✅ Error handling and edge cases
- ✅ Performance and network requests

### 🚫 **What Requires Deployment**
- ❌ Production SSL certificates
- ❌ AWS-specific configurations
- ❌ Production domain routing
- ❌ Production environment secrets

## Next Steps

1. **Create your `.env` file** with database credentials
2. **Run `npm run dev:local`**
3. **Open localhost:5173/labs**
4. **Check browser console** for our debug messages
5. **Test the biomarker chart functionality**

Once you confirm it works locally, you'll know the fix is ready for deployment!

## Quick Test Script

Create this test file to verify everything works:

```bash
# test-local-setup.sh
#!/bin/bash
echo "🧪 Testing local development setup..."

# Test if .env exists
if [ -f .env ]; then
    echo "✅ .env file found"
else
    echo "❌ .env file missing - create one with DATABASE_URL"
    exit 1
fi

# Test if dependencies are installed
if [ -d node_modules ]; then
    echo "✅ Dependencies installed"
else
    echo "📦 Installing dependencies..."
    npm install
fi

# Test database connection
echo "🔍 Testing database connection..."
npx tsx -e "
import { db } from './db/index.js';
import { sql } from 'drizzle-orm';
try {
  await db.execute(sql\`SELECT 1\`);
  console.log('✅ Database connection successful');
} catch (error) {
  console.log('❌ Database connection failed:', error.message);
}
process.exit(0);
"

echo "🚀 Ready for local development!"
echo "Run: npm run dev:local"
echo "Open: http://localhost:5173"
```

This setup will dramatically speed up your development cycle and let you debug the biomarker chart issue much more efficiently! 