import { SecretsManagerClient, GetSecretValueCommand } from "@aws-sdk/client-secrets-manager";
import logger from './logger';

// Lazy-initialize the client to ensure credentials are available
let client: SecretsManagerClient | null = null;

function getClient(): SecretsManagerClient {
  if (!client) {
    client = new SecretsManagerClient({
      region: process.env.AWS_REGION || "us-west-2"
    });
  }
  return client;
}

interface SecretsCache {
  [key: string]: {
    value: any;
    timestamp: number;
    ttl: number;
  };
}

const secretsCache: SecretsCache = {};
const DEFAULT_TTL = 5 * 60 * 1000; // 5 minutes in milliseconds

export async function getSecret(secretName: string, ttl: number = DEFAULT_TTL): Promise<any> {
  try {
    // Check cache first
    const cached = secretsCache[secretName];
    if (cached && (Date.now() - cached.timestamp) < cached.ttl) {
      logger.debug(`Using cached secret for ${secretName}`);
      return cached.value;
    }

    console.log(`🔐 Fetching secret from AWS Secrets Manager: ${secretName}`);
    console.log(`🌍 AWS Region: ${process.env.AWS_REGION || "us-west-2"}`);
    console.log(`🔑 NODE_ENV: ${process.env.NODE_ENV}`);
    
    const command = new GetSecretValueCommand({
      SecretId: secretName,
    });

    const response = await getClient().send(command);
    
    if (!response.SecretString) {
      throw new Error(`No secret string found for ${secretName}`);
    }

    let secretValue;
    try {
      // Try to parse as JSON first
      secretValue = JSON.parse(response.SecretString);
    } catch {
      // If not JSON, return as string
      secretValue = response.SecretString;
    }

    // Cache the result
    secretsCache[secretName] = {
      value: secretValue,
      timestamp: Date.now(),
      ttl
    };

    logger.info(`Successfully fetched and cached secret: ${secretName}`);
    return secretValue;

  } catch (error) {
    logger.error(`Error fetching secret ${secretName}:`, error);
    throw error;
  }
}

export async function getEnvironmentSecrets(): Promise<Record<string, string>> {
  try {
    console.log('🔐 Loading main environment secrets from STEBENV...');
    const secrets = await getSecret('arn:aws:secretsmanager:us-west-2:881490119784:secret:STEBENV-GOgM9v');
    
    // If secrets is already an object, return it
    if (typeof secrets === 'object' && secrets !== null) {
      console.log('✅ Successfully loaded environment secrets from STEBENV');
      return secrets;
    }
    
    // If it's a string, try to parse it
    if (typeof secrets === 'string') {
      try {
        const parsed = JSON.parse(secrets);
        console.log('✅ Successfully parsed environment secrets from STEBENV');
        return parsed;
      } catch {
        logger.error('STEBENV secret is not valid JSON');
        throw new Error('STEBENV secret must be a JSON object');
      }
    }
    
    throw new Error('STEBENV secret has unexpected format');
  } catch (error) {
    logger.error('❌ Failed to fetch environment secrets:', error);
    throw error;
  }
}

export async function getGoogleVisionCredentials(): Promise<string> {
  try {
    console.log('🔐 Loading Google Vision credentials from GOOGLEOCR...');
    const credentials = await getSecret('arn:aws:secretsmanager:us-west-2:881490119784:secret:GOOGLEOCR-DvqiRC');
    
    // Return as string (JSON string for Google Vision)
    if (typeof credentials === 'string') {
      console.log('✅ Successfully loaded Google Vision credentials from GOOGLEOCR');
      return credentials;
    } else if (typeof credentials === 'object') {
      console.log('✅ Successfully loaded Google Vision credentials from GOOGLEOCR (object format)');
      return JSON.stringify(credentials);
    }
    
    throw new Error('GOOGLEOCR secret has unexpected format');
  } catch (error) {
    logger.error('❌ Failed to fetch Google Vision credentials:', error);
    throw error;
  }
}

// Clear cache (useful for testing or forcing refresh)
export function clearSecretsCache(): void {
  Object.keys(secretsCache).forEach(key => delete secretsCache[key]);
}