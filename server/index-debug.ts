import dotenv from 'dotenv';
dotenv.config();

import express from "express";
import { createServer } from "http";

console.log('=== SERVER STARTUP DEBUG ===');
console.log('1. Environment loaded');
console.log('NODE_ENV:', process.env.NODE_ENV);
console.log('PORT:', process.env.PORT || 3001);

const app = express();
console.log('2. Express app created');

// Basic middleware only
app.use(express.json());
console.log('3. JSON middleware added');

// Test route
app.get('/test', (req, res) => {
  res.json({ status: 'ok', message: 'Server is running' });
});
console.log('4. Test route added');

// Try to setup auth
try {
  console.log('5. Attempting to setup authentication...');
  const { setupAuthentication } = await import('./auth/setup');
  setupAuthentication(app);
  console.log('6. Authentication setup complete');
} catch (error) {
  console.error('ERROR setting up auth:', error);
}

// Create HTTP server
const server = createServer(app);
console.log('7. HTTP server created');

// Start server
const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3001;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`8. Server listening on port ${PORT}`);
  console.log('=== STARTUP COMPLETE ===');
});

// Error handlers
server.on('error', (error: any) => {
  console.error('Server error:', error);
  if (error.code === 'EADDRINUSE') {
    console.error(`Port ${PORT} is already in use`);
  }
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
}); 