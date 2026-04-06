import { getGoogleVisionCredentials as getSecretsManagerCredentials } from './secretsManager';
import logger from './logger';

export async function getGoogleVisionCredentials(): Promise<string> {
  try {
    // First try to get from environment variable (for local development)
    if (process.env.GOOGLE_VISION_CREDENTIALS) {
      console.log('🔧 Using Google Vision credentials from environment variable');
      return process.env.GOOGLE_VISION_CREDENTIALS;
    }

    // Try AWS Secrets Manager (production)
    try {
      console.log('🔐 Attempting to load Google Vision credentials from AWS Secrets Manager...');
      const credentials = await getSecretsManagerCredentials();
      console.log('✅ Successfully loaded Google Vision credentials from Secrets Manager');
      return credentials;
    } catch (secretsError) {
      logger.warn('AWS Secrets Manager access failed, falling back to embedded credentials:', secretsError);
    }

    // No fallback credentials - require proper environment setup
    console.log('❌ No Google Vision credentials available');
    throw new Error('Google Vision credentials not found. Please set GOOGLE_VISION_CREDENTIALS environment variable or configure AWS Secrets Manager.');
  } catch (error) {
    logger.error('❌ Failed to get Google Vision credentials:', error);
    throw error;
  }
}