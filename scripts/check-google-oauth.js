#!/usr/bin/env node

console.log('Google OAuth Configuration Check');
console.log('================================\n');

// Check all Google-related environment variables
const googleVars = Object.keys(process.env).filter(key => 
  key.includes('GOOGLE') || key.includes('CLIENT')
);

console.log('Found Google-related environment variables:');
googleVars.forEach(key => {
  console.log(`- ${key}: ${process.env[key] ? '✅ Set' : '❌ Not set'}`);
});

console.log('\nExpected variables for development:');
console.log('- GOOGLE_CLIENT_ID_TEST:', process.env.GOOGLE_CLIENT_ID_TEST ? '✅ Set' : '❌ Not set');
console.log('- GOOGLE_CLIENT_SECRET_TEST:', process.env.GOOGLE_CLIENT_SECRET_TEST ? '✅ Set' : '❌ Not set');

console.log('\nExpected variables for production:');
console.log('- GOOGLE_CLIENT_ID_PROD:', process.env.GOOGLE_CLIENT_ID_PROD ? '✅ Set' : '❌ Not set');
console.log('- GOOGLE_CLIENT_SECRET_PROD:', process.env.GOOGLE_CLIENT_SECRET_PROD ? '✅ Set' : '❌ Not set');

// Check if variables might be named differently
console.log('\nChecking alternative naming patterns:');
console.log('- GOOGLE_CLIENT_ID:', process.env.GOOGLE_CLIENT_ID ? '✅ Set' : '❌ Not set');
console.log('- GOOGLE_CLIENT_SECRET:', process.env.GOOGLE_CLIENT_SECRET ? '✅ Set' : '❌ Not set');

console.log('\n⚠️  IMPORTANT:');
console.log('The code expects these exact variable names:');
console.log('- For development: GOOGLE_CLIENT_ID_TEST and GOOGLE_CLIENT_SECRET_TEST');
console.log('- For production: GOOGLE_CLIENT_ID_PROD and GOOGLE_CLIENT_SECRET_PROD');

console.log('\nIf your variables are named differently, you need to either:');
console.log('1. Rename them in your .env file to match what the code expects');
console.log('2. Or update the code to use your variable names');

console.log('\nTo test Google OAuth in development:');
console.log('1. Ensure GOOGLE_CLIENT_ID_TEST and GOOGLE_CLIENT_SECRET_TEST are set');
console.log('2. Make sure your Google OAuth app has these authorized:');
console.log('   - JavaScript origins: http://localhost:5173');
console.log('   - Redirect URIs: http://localhost:3001/auth/google/callback');
console.log('3. Run: npm run dev:local');
console.log('4. Access: http://localhost:5173/auth');
console.log('5. Click "Sign in with Google"'); 