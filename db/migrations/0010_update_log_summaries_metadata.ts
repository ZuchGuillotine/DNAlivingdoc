
import { db } from "../index";
import { sql } from "drizzle-orm";
import { logSummaries } from "../schema";
import logger from "../../server/utils/logger";

/**
 * Migration to update log_summaries metadata schema
 * - Adds support for dailySummaryCount in metadata
 * - Maintains backward compatibility with existing records
 * - Updates TypeScript types to match actual usage
 */
async function main() {
  try {
    logger.info("Starting migration: Update log_summaries metadata schema");

    // Step 1: Create a function to safely update metadata
    await db.execute(sql`
      CREATE OR REPLACE FUNCTION update_log_summary_metadata()
      RETURNS void AS $$
      BEGIN
        -- Update existing weekly summaries to include dailySummaryCount if not present
        UPDATE log_summaries
        SET metadata = metadata || 
          jsonb_build_object(
            'dailySummaryCount',
            COALESCE((metadata->>'supplementCount')::integer, 0)
          )
        WHERE summary_type = 'weekly'
        AND NOT metadata ? 'dailySummaryCount';

        -- Ensure all required metadata fields exist with default values
        UPDATE log_summaries
        SET metadata = metadata || 
          jsonb_build_object(
            'supplementCount', COALESCE((metadata->>'supplementCount')::integer, 0),
            'qualitativeLogCount', COALESCE((metadata->>'qualitativeLogCount')::integer, 0),
            'quantitativeLogCount', COALESCE((metadata->>'quantitativeLogCount')::integer, 0),
            'significantChanges', COALESCE(metadata->'significantChanges', '[]'::jsonb)
          );
      END;
      $$ LANGUAGE plpgsql;
    `);

    // Step 2: Execute the function
    await db.execute(sql`SELECT update_log_summary_metadata();`);

    // Step 3: Add a trigger to ensure new records follow the schema
    await db.execute(sql`
      CREATE OR REPLACE FUNCTION validate_log_summary_metadata()
      RETURNS trigger AS $$
      BEGIN
        -- Ensure metadata is a JSONB object
        IF NEW.metadata IS NULL THEN
          NEW.metadata := '{}'::jsonb;
        END IF;

        -- Set default values for required fields if not present
        NEW.metadata := NEW.metadata || 
          jsonb_build_object(
            'supplementCount', COALESCE((NEW.metadata->>'supplementCount')::integer, 0),
            'qualitativeLogCount', COALESCE((NEW.metadata->>'qualitativeLogCount')::integer, 0),
            'quantitativeLogCount', COALESCE((NEW.metadata->>'quantitativeLogCount')::integer, 0),
            'significantChanges', COALESCE(NEW.metadata->'significantChanges', '[]'::jsonb)
          );

        -- Add dailySummaryCount for weekly summaries
        IF NEW.summary_type = 'weekly' THEN
          NEW.metadata := NEW.metadata || 
            jsonb_build_object(
              'dailySummaryCount',
              COALESCE((NEW.metadata->>'dailySummaryCount')::integer, 0)
            );
        END IF;

        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;

      DROP TRIGGER IF EXISTS ensure_valid_metadata ON log_summaries;
      
      CREATE TRIGGER ensure_valid_metadata
        BEFORE INSERT OR UPDATE ON log_summaries
        FOR EACH ROW
        EXECUTE FUNCTION validate_log_summary_metadata();
    `);

    logger.info("Successfully completed migration: Update log_summaries metadata schema");
  } catch (error) {
    logger.error("Error during migration:", error);
    throw error;
  }
}

// Execute the migration
main()
  .catch((error) => {
    console.error('Migration failed:', error);
    process.exit(1);
  })
  .finally(() => {
    process.exit(0);
  });

export async function up() {
  return main();
}

export async function down() {
  try {
    logger.info("Starting rollback: Update log_summaries metadata schema");

    // Remove the trigger and function
    await db.execute(sql`
      DROP TRIGGER IF EXISTS ensure_valid_metadata ON log_summaries;
      DROP FUNCTION IF EXISTS validate_log_summary_metadata();
      DROP FUNCTION IF EXISTS update_log_summary_metadata();
    `);

    logger.info("Successfully completed rollback: Update log_summaries metadata schema");
  } catch (error) {
    logger.error("Error during rollback:", error);
    throw error;
  }
}
