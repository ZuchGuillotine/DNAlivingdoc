import { type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { sql } from "drizzle-orm";
import logger from '../../server/utils/logger';
import { db } from '../index';
import type { NeonHttpDatabase } from 'drizzle-orm/neon-http';
import type * as schema from '../schema';

type ColumnInfo = {
  column_name: string;
  data_type: string;
  column_default: string | null;
  is_nullable: string;
};

// Migration up function
export async function up(db: NeonHttpDatabase<typeof schema>) {
  try {
    logger.info('Starting migration: Update biomarker processing metadata schema');
    
    // Create backup table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS biomarker_processing_status_backup AS 
      SELECT * FROM biomarker_processing_status
    `);
    
    // Update the metadata column type
    await db.execute(sql`
      ALTER TABLE biomarker_processing_status
      ALTER COLUMN metadata TYPE jsonb USING metadata::jsonb
    `);
    
    // Update the column comment
    await db.execute(sql`
      COMMENT ON COLUMN biomarker_processing_status.metadata IS '{
        regexMatches?: number;
        llmExtractions?: number;
        processingTime?: number;
        retryCount?: number;
        textLength?: number;
        errorDetails?: string;
        biomarkerCount?: number;
        source?: string;
      }'
    `);

    // Verify the migration
    const verifyResult = await db.execute<ColumnInfo>(sql`
      SELECT column_name, data_type, column_default, is_nullable 
      FROM information_schema.columns 
      WHERE table_name = 'biomarker_processing_status' 
      AND column_name = 'metadata'
    `);

    const firstRow = verifyResult.rows?.[0];
    if (!firstRow) {
      throw new Error('Migration verification failed: metadata column not found');
    }

    logger.info('Successfully updated biomarker processing status metadata schema', {
      verification: firstRow
    });
  } catch (error) {
    logger.error('Error updating biomarker processing status metadata schema:', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    });
    
    // Attempt to restore from backup
    try {
      const backupExists = await db.execute(sql`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public'
          AND table_name = 'biomarker_processing_status_backup'
        )
      `);
      
      if (backupExists.rows?.[0]?.exists) {
        await db.execute(sql`
          INSERT INTO biomarker_processing_status 
          SELECT * FROM biomarker_processing_status_backup 
          WHERE NOT EXISTS (
            SELECT 1 FROM biomarker_processing_status 
            WHERE biomarker_processing_status.lab_result_id = biomarker_processing_status_backup.lab_result_id
          )
        `);
        logger.info('Restored data from backup after migration failure');
      } else {
        logger.warn('Backup table does not exist, skipping restore');
      }
    } catch (restoreError) {
      logger.error('Failed to restore from backup:', {
        error: restoreError instanceof Error ? restoreError.message : String(restoreError)
      });
    }
    
    throw error;
  } finally {
    // Clean up backup table
    try {
      await db.execute(sql`
        DROP TABLE IF EXISTS biomarker_processing_status_backup
      `);
    } catch (cleanupError) {
      logger.warn('Failed to clean up backup table:', {
        error: cleanupError instanceof Error ? cleanupError.message : String(cleanupError)
      });
    }
  }
}

// Migration down function
export async function down(db: NeonHttpDatabase<typeof schema>) {
  try {
    logger.info('Starting migration rollback: Revert biomarker processing metadata schema');
    
    // Create backup before rollback
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS biomarker_processing_status_backup AS 
      SELECT * FROM biomarker_processing_status
    `);

    // Update the metadata column type
    await db.execute(sql`
      ALTER TABLE biomarker_processing_status
      ALTER COLUMN metadata TYPE jsonb USING metadata::jsonb
    `);
    
    // Update the column comment
    await db.execute(sql`
      COMMENT ON COLUMN biomarker_processing_status.metadata IS '{
        regexMatches?: number;
        llmExtractions?: number;
        processingTime?: number;
        retryCount?: number;
      }'
    `);

    // Verify the rollback
    const verifyResult = await db.execute<ColumnInfo>(sql`
      SELECT column_name, data_type, column_default, is_nullable 
      FROM information_schema.columns 
      WHERE table_name = 'biomarker_processing_status' 
      AND column_name = 'metadata'
    `);

    const firstRow = verifyResult.rows?.[0];
    if (!firstRow) {
      throw new Error('Rollback verification failed: metadata column not found');
    }

    logger.info('Successfully reverted biomarker processing status metadata schema', {
      verification: firstRow
    });
  } catch (error) {
    logger.error('Error reverting biomarker processing status metadata schema:', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    });
    
    // Attempt to restore from backup
    try {
      const backupExists = await db.execute(sql`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public'
          AND table_name = 'biomarker_processing_status_backup'
        )
      `);
      
      if (backupExists.rows?.[0]?.exists) {
        await db.execute(sql`
          INSERT INTO biomarker_processing_status 
          SELECT * FROM biomarker_processing_status_backup 
          WHERE NOT EXISTS (
            SELECT 1 FROM biomarker_processing_status 
            WHERE biomarker_processing_status.lab_result_id = biomarker_processing_status_backup.lab_result_id
          )
        `);
        logger.info('Restored data from backup after rollback failure');
      } else {
        logger.warn('Backup table does not exist, skipping restore');
      }
    } catch (restoreError) {
      logger.error('Failed to restore from backup:', {
        error: restoreError instanceof Error ? restoreError.message : String(restoreError)
      });
    }
    
    throw error;
  } finally {
    // Clean up backup table
    try {
      await db.execute(sql`
        DROP TABLE IF EXISTS biomarker_processing_status_backup
      `);
    } catch (cleanupError) {
      logger.warn('Failed to clean up backup table:', {
        error: cleanupError instanceof Error ? cleanupError.message : String(cleanupError)
      });
    }
  }
}

// Add direct execution support for running the migration
if (import.meta.url === new URL(process.argv[1], 'file:').href) {
  up(db as NeonHttpDatabase<typeof schema>).catch((error) => {
    logger.error('Migration failed:', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    });
    process.exit(1);
  });
} 