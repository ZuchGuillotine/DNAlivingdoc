#!/usr/bin/env node

import fetch from 'node-fetch';
import { CookieJar } from 'tough-cookie';
import { wrapper } from 'fetch-cookie';

const fetchWithCookies = wrapper(fetch, new CookieJar());

const BASE_URL = process.env.BASE_URL || 'http://localhost:3001';

async function testAuth() {
  console.log('Testing authentication at:', BASE_URL);
  console.log('-----------------------------------\n');

  // Test 1: Check session endpoint
  console.log('1. Testing session endpoint...');
  try {
    const sessionRes = await fetchWithCookies(`${BASE_URL}/api/debug/session`);
    const sessionData = await sessionRes.json();
    console.log('Session status:', sessionData);
  } catch (error) {
    console.error('Session check failed:', error.message);
  }

  console.log('\n-----------------------------------\n');

  // Test 2: Try to login with test credentials
  console.log('2. Testing login...');
  const testCredentials = {
    email: process.env.TEST_EMAIL || 'test@example.com',
    password: process.env.TEST_PASSWORD || 'testpassword'
  };

  try {
    const loginRes = await fetchWithCookies(`${BASE_URL}/api/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(testCredentials),
    });

    console.log('Login response status:', loginRes.status);
    console.log('Login response headers:', loginRes.headers.raw());
    
    const loginData = await loginRes.json();
    console.log('Login response data:', loginData);

    if (loginRes.ok) {
      console.log('\n✅ Login successful!');
      
      // Test 3: Check if session persists
      console.log('\n3. Checking if session persists...');
      const userRes = await fetchWithCookies(`${BASE_URL}/api/user`);
      console.log('User endpoint status:', userRes.status);
      
      if (userRes.ok) {
        const userData = await userRes.json();
        console.log('User data:', userData);
        console.log('\n✅ Session persistence working!');
      } else {
        console.log('\n❌ Session not persisted');
        const errorData = await userRes.json();
        console.log('Error:', errorData);
      }
    } else {
      console.log('\n❌ Login failed');
    }
  } catch (error) {
    console.error('Login test failed:', error.message);
  }

  console.log('\n-----------------------------------\n');

  // Test 4: Check Google OAuth configuration
  console.log('4. Checking Google OAuth configuration...');
  console.log('Environment:', process.env.NODE_ENV || 'development');
  console.log('Google Client ID (Test):', process.env.GOOGLE_CLIENT_ID_TEST ? '✅ Set' : '❌ Not set');
  console.log('Google Client Secret (Test):', process.env.GOOGLE_CLIENT_SECRET_TEST ? '✅ Set' : '❌ Not set');
  console.log('Google Client ID (Prod):', process.env.GOOGLE_CLIENT_ID_PROD ? '✅ Set' : '❌ Not set');
  console.log('Google Client Secret (Prod):', process.env.GOOGLE_CLIENT_SECRET_PROD ? '✅ Set' : '❌ Not set');
  console.log('Session Secret:', process.env.SESSION_SECRET ? '✅ Set' : '❌ Not set');
}

testAuth().catch(console.error); 