import { drizzle } from 'drizzle-orm/postgres-js';
import { sql } from 'drizzle-orm';
import logger from '../../server/utils/logger';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Verify DATABASE_URL is loaded
if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is not set');
}

// Migration function to add preprocessed text fields
async function up(db: any) {
  try {
    logger.info('Starting migration: Add preprocessed text fields to labResults metadata');

    // Add preprocessed text fields to existing metadata
    await db.execute(sql`
      UPDATE lab_results
      SET metadata = jsonb_set(
        COALESCE(metadata, '{}'::jsonb),
        '{preprocessedText}',
        '{
          "rawText": null,
          "normalizedText": null,
          "processingMetadata": {
            "originalFormat": null,
            "processingSteps": [],
            "processingTimestamp": null,
            "textLength": 0,
            "lineCount": 0,
            "hasHeaders": false,
            "hasFooters": false,
            "qualityMetrics": {
              "whitespaceRatio": 0,
              "specialCharRatio": 0,
              "numericRatio": 0,
              "potentialOcrErrors": 0
            }
          }
        }'::jsonb,
        true
      )
      WHERE metadata->>'preprocessedText' IS NULL;
    `);

    logger.info('Successfully added preprocessed text fields to labResults metadata');
  } catch (error) {
    logger.error('Migration failed:', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    });
    throw error;
  }
}

// Migration function to remove preprocessed text fields
async function down(db: any) {
  try {
    logger.info('Starting rollback: Remove preprocessed text fields from labResults metadata');

    // Remove preprocessed text fields from metadata
    await db.execute(sql`
      UPDATE lab_results
      SET metadata = metadata - 'preprocessedText'
      WHERE metadata ? 'preprocessedText';
    `);

    logger.info('Successfully removed preprocessed text fields from labResults metadata');
  } catch (error) {
    logger.error('Rollback failed:', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    });
    throw error;
  }
}

// Execute migration if run directly
if (import.meta.url === new URL(process.argv[1], 'file:').href) {
  import('postgres').then(async ({ default: postgres }) => {
    const client = postgres(process.env.DATABASE_URL!);
    const db = drizzle(client);
    
    try {
      // Check if we're rolling back
      const isRollback = process.argv.includes('--rollback');
      
      if (isRollback) {
        logger.info('Executing rollback...');
        await down(db);
      } else {
        logger.info('Executing migration...');
        await up(db);
      }
      
      logger.info('Migration completed successfully');
    } catch (error) {
      logger.error('Migration failed:', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      });
      process.exit(1);
    } finally {
      await client.end();
    }
  });
}

export { up, down }; 