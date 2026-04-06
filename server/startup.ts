/**
 * Startup script that loads environment variables before importing any services
 */
import { loadEnvironmentSecrets } from './config/env';

async function startup() {
  console.log('🚀 Starting application...');
  
  // Load environment secrets FIRST in production
  if (process.env.NODE_ENV === 'production') {
    console.log('📦 Production mode: Loading environment secrets before service initialization...');
    try {
      await loadEnvironmentSecrets();
      console.log('✅ Environment secrets loaded successfully');
    } catch (error) {
      console.error('❌ Failed to load environment secrets:', error);
      console.log('⚠️ Application will continue with limited functionality');
    }
  } else {
    console.log('🔧 Development mode: Using local environment variables');
  }
  
  // Now import and start the main server
  console.log('📡 Importing and starting main server...');
  try {
    const { default: initializeAndStart } = await import('./index');
    console.log('✅ Successfully imported main server module');
    console.log('🔄 Starting server initialization...');
    await initializeAndStart();
    console.log('🎉 Server started successfully!');
  } catch (error) {
    console.error('💥 Failed to start main server:', error);
    throw error;
  }
}

// Export the startup function
export default startup;

// Execute startup immediately since this is the entry point
startup().catch((error) => {
  console.error('💥 Startup failed:', error);
  process.exit(1);
});