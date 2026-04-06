#!/bin/bash

echo "=== Testing Server Startup ==="
echo "Killing any existing processes on port 3001..."
lsof -ti:3001 | xargs kill -9 2>/dev/null || true

echo ""
echo "Starting server with debugging..."
echo ""

# Set environment for debugging
export NODE_ENV=development
export DEBUG=*
export NODE_OPTIONS="--trace-warnings"

# Run the debug server
echo "Running debug server..."
npx tsx server/index-debug.ts 