#!/usr/bin/env node

const BASE_URL = process.env.BASE_URL || 'http://localhost:3001';

console.log('Simple Auth Test');
console.log('================\n');

// Check environment variables
console.log('Environment Configuration:');
console.log('- NODE_ENV:', process.env.NODE_ENV || 'development');
console.log('- SESSION_SECRET:', process.env.SESSION_SECRET ? '✅ Set' : '❌ Not set');
console.log('- GOOGLE_CLIENT_ID_TEST:', process.env.GOOGLE_CLIENT_ID_TEST ? '✅ Set' : '❌ Not set');
console.log('- GOOGLE_CLIENT_SECRET_TEST:', process.env.GOOGLE_CLIENT_SECRET_TEST ? '✅ Set' : '❌ Not set');
console.log('- GOOGLE_CLIENT_ID_PROD:', process.env.GOOGLE_CLIENT_ID_PROD ? '✅ Set' : '❌ Not set');
console.log('- GOOGLE_CLIENT_SECRET_PROD:', process.env.GOOGLE_CLIENT_SECRET_PROD ? '✅ Set' : '❌ Not set');
console.log('- CUSTOM_DOMAIN:', process.env.CUSTOM_DOMAIN || 'Not set');

console.log('\nTo test authentication manually:');
console.log('1. Start the dev server: npm run dev');
console.log('2. Open browser DevTools Network tab');
console.log('3. Navigate to http://localhost:5173/auth');
console.log('4. Try logging in with test credentials');
console.log('5. Check the Network tab for:');
console.log('   - POST /api/login request');
console.log('   - Look for Set-Cookie header in response');
console.log('   - Check if stacktracker.sid cookie is set');
console.log('   - Verify subsequent /api/user requests include the cookie');

console.log('\nFor Google OAuth:');
console.log('1. Ensure you have created OAuth 2.0 credentials in Google Cloud Console');
console.log('2. Add http://localhost:5173 to Authorized JavaScript origins');
console.log('3. Add http://localhost:3001/auth/google/callback to Authorized redirect URIs');
console.log('4. Set the GOOGLE_CLIENT_ID_TEST and GOOGLE_CLIENT_SECRET_TEST env vars');
console.log('5. Restart the server and try "Sign in with Google"'); 