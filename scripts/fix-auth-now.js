#!/usr/bin/env node

console.log('Auth Fix Check');
console.log('==============\n');

// Check current environment
console.log('Current Environment:');
console.log('NODE_ENV:', process.env.NODE_ENV);
console.log('CUSTOM_DOMAIN:', process.env.CUSTOM_DOMAIN);
console.log('SESSION_SECRET:', process.env.SESSION_SECRET ? '✅ Set' : '❌ Missing');

console.log('\n⚠️  CRITICAL ISSUE FOUND:');
console.log('Your NODE_ENV is set to "production" which forces secure cookies.');
console.log('Secure cookies DO NOT work over HTTP (localhost).\n');

console.log('IMMEDIATE FIX - Run the server with:');
console.log('----------------------------------------');
console.log('NODE_ENV=development npm run dev\n');

console.log('Or if you must keep NODE_ENV=production, use:');
console.log('FORCE_HTTPS=false NODE_ENV=production npm run dev\n');

console.log('The issue is that browsers will NOT send secure cookies over HTTP.');
console.log('This is why every request gets a new session ID.\n');

console.log('To verify the fix works:');
console.log('1. Start server with: NODE_ENV=development npm run dev');
console.log('2. Go to http://localhost:5173/auth');
console.log('3. Login - you should stay logged in');
console.log('4. Check DevTools > Application > Cookies');
console.log('   You should see stacktracker.sid cookie'); 