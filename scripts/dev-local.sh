#!/bin/bash

echo "========================================="
echo "Starting local development server..."
echo "========================================="
echo ""
echo "This script ensures proper configuration for local development"
echo ""
echo "🌐 Frontend URL: http://localhost:5173"
echo "🔧 API Server URL: http://localhost:3001"
echo ""
echo "IMPORTANT: Always access the application at http://localhost:5173"
echo "The API server at port 3001 is for backend requests only"
echo ""

# Export LOCAL_DEV flag to help the server detect local development
export LOCAL_DEV=true

# CRITICAL: Override NODE_ENV for local development to fix auth
export NODE_ENV=development

echo "✅ Setting NODE_ENV=development"
echo "✅ Using development server configuration (index-dev.ts)"
echo ""
echo "Starting servers..."
echo ""

# Start both the Express server and Vite dev server
npm run dev 