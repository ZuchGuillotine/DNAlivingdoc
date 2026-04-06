import logger from '../utils/logger';
import dotenv from 'dotenv';

dotenv.config();

async function loadDatabaseUrlFromSecretsManager() {
  if (process.env.DATABASE_URL) return;

  if (process.env.ALLOW_LIVE_DB_TESTS !== 'true') {
    logger.warn('DATABASE_URL not set. Skipping AWS Secrets Manager lookup (set ALLOW_LIVE_DB_TESTS=true to enable).');
    return;
  }

  if (!process.env.AWS_DB_SECRET_ID) {
    logger.warn('AWS_DB_SECRET_ID not set. Skipping AWS Secrets Manager lookup.');
    return;
  }

  try {
    const { SecretsManagerClient, GetSecretValueCommand } = await import('@aws-sdk/client-secrets-manager');
    const secretId = process.env.AWS_DB_SECRET_ID;
    const region = process.env.AWS_REGION || 'us-west-2';

    const smClient = new SecretsManagerClient({ region });
    const command = new GetSecretValueCommand({ SecretId: secretId });
    const response = await smClient.send(command);

    if (response.SecretString) {
      const secrets = JSON.parse(response.SecretString);
      if (secrets.DATABASE_URL) {
        process.env.DATABASE_URL = secrets.DATABASE_URL;
        logger.info('Loaded DATABASE_URL from AWS Secrets Manager.');
      }
    }
  } catch (error) {
    logger.error('Failed to load DATABASE_URL from AWS Secrets Manager:', error);
  }
}

logger.level = 'silent';

beforeAll(async () => {
  try {
    await loadDatabaseUrlFromSecretsManager();
    console.log('Test setup complete');
  } catch (error) {
    console.error('Error in test setup:', error);
    throw error;
  }
});

afterAll(async () => {
  try {
    console.log('Test cleanup complete');
  } catch (error) {
    console.error('Error in test cleanup:', error);
  }
});
