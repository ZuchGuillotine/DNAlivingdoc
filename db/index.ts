/**
    * @description      : 
    * @author           : 
    * @group            : 
    * @created          : 17/05/2025 - 00:45:02
    * 
    * MODIFICATION LOG
    * - Version         : 1.0.0
    * - Date            : 17/05/2025
    * - Author          : 
    * - Modification    : 
**/
// Environment variables are now loaded in server/config/env.ts
// which must be imported before this module
console.log("DATABASE_URL at db/index.ts:", process.env.DATABASE_URL);
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool, PoolConfig } from 'pg';
import * as schema from './schema';
import * as fs from 'fs';
import { TLSSocket, PeerCertificate } from 'tls';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log("Environment variables related to SSL:", {
  NODE_ENV: process.env.NODE_ENV,
  NODE_EXTRA_CA_CERTS: process.env.NODE_EXTRA_CA_CERTS,
  AWS_RDS_CA_CERT_PATH: process.env.AWS_RDS_CA_CERT_PATH,
  __dirname: __dirname,
  cwd: process.cwd()
});

if (!process.env.DATABASE_URL) {
  console.error("⚠️  DATABASE_URL not set - database operations will fail");
  console.error("Please ensure STEBENV secret is configured in AWS Secrets Manager");
  // Don't throw immediately - let the app try to start
  // Create a placeholder connection to prevent module load crashes
}

const isProduction = process.env.NODE_ENV === 'production';

const poolConfig: PoolConfig = {
  connectionString: process.env.DATABASE_URL || 'postgresql://placeholder:placeholder@localhost:5432/placeholder',
  max: 20, // Maximum number of connections
  min: 2,  // Minimum number of connections
  acquireTimeoutMillis: 60000, // 60 seconds
  createTimeoutMillis: 30000,  // 30 seconds
  destroyTimeoutMillis: 5000,  // 5 seconds
  idleTimeoutMillis: 30000,    // 30 seconds
  reapIntervalMillis: 1000,    // 1 second
  createRetryIntervalMillis: 500, // 500ms between retries
  propagateCreateError: false,
};

// In production, enforce SSL with the AWS RDS CA certificate.
if (process.env.DATABASE_URL && process.env.DATABASE_URL.includes('rds.amazonaws.com')) {
  console.log('RDS connection detected, configuring SSL...');
  if (isProduction) {
    console.log('Production mode: Using strict SSL with AWS RDS CA certificate');
    const caPath = process.env.AWS_RDS_CA_CERT_PATH || '/app/certs/stcert.pem';
    
    const possiblePaths = [
      caPath,
      '/app/certs/stcert.pem',
      path.join(process.cwd(), 'certs', 'stcert.pem'),
      path.resolve(__dirname, '../certs/stcert.pem')
    ];

    let certContent: string | null = null;

    for (const tryPath of possiblePaths) {
      if (fs.existsSync(tryPath)) {
        console.log(`Found RDS CA bundle at: ${tryPath}`);
        certContent = fs.readFileSync(tryPath, 'utf8');
        break;
      }
    }

    if (certContent) {
      poolConfig.ssl = {
        rejectUnauthorized: true,
        ca: certContent,
        minVersion: 'TLSv1.2'
      };
    } else {
      console.error(`❌ RDS CA bundle not found. Using insecure SSL configuration.`);
      poolConfig.ssl = {
        rejectUnauthorized: false
      };
    }
  } else {
    console.log('Development mode: Using permissive SSL configuration');
    poolConfig.ssl = {
      rejectUnauthorized: false
    };
  }
}

let pool: Pool;
let db: ReturnType<typeof drizzle>;

try {
  pool = new Pool(poolConfig);
  db = drizzle(pool, { schema });
  console.log('✅ Database pool created successfully');
} catch (error) {
  console.error('❌ Failed to create database pool:', error);
  console.log('⚠️ Creating placeholder database connection to prevent startup crashes');
  // Create a minimal pool configuration that won't fail
  const fallbackConfig: PoolConfig = {
    connectionString: 'postgresql://placeholder:placeholder@localhost:5432/placeholder',
    max: 1,
    min: 0,
    acquireTimeoutMillis: 1000,
    createTimeoutMillis: 1000,
    destroyTimeoutMillis: 1000,
    idleTimeoutMillis: 1000,
    reapIntervalMillis: 1000,
    createRetryIntervalMillis: 500,
    propagateCreateError: false,
  };
  
  try {
    pool = new Pool(fallbackConfig);
    db = drizzle(pool, { schema });
  } catch (fallbackError) {
    console.error('❌ Even fallback database pool failed:', fallbackError);
    throw fallbackError;
  }
}

export { db };
export * from './schema';