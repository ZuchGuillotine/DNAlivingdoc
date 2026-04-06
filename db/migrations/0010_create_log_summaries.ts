
import { db } from "../index";
import { sql } from "drizzle-orm";
import logger from "../../server/utils/logger";

async function main() {
  try {
    logger.info("Starting migration: Create log_summaries table with metadata");

    // Create the table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS log_summaries (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) NOT NULL,
        content TEXT NOT NULL,
        summary_type TEXT NOT NULL,
        start_date TIMESTAMP NOT NULL,
        end_date TIMESTAMP NOT NULL,
        metadata JSONB NOT NULL DEFAULT jsonb_build_object(
          'supplementCount', 0,
          'qualitativeLogCount', 0,
          'quantitativeLogCount', 0,
          'significantChanges', jsonb_build_array(),
          'dailySummaryCount', 0
        ),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
      )
    `);

    // Create index on user_id and date range
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_log_summaries_user_date 
      ON log_summaries(user_id, start_date, end_date)
    `);

    // Create index on summary_type
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_log_summaries_type
      ON log_summaries(summary_type)
    `);

    // Create timestamp update function
    await db.execute(sql`
      CREATE OR REPLACE FUNCTION update_log_summaries_timestamp()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.updated_at = CURRENT_TIMESTAMP;
        RETURN NEW;
      END;
      $$ language 'plpgsql'
    `);

    // Create trigger
    await db.execute(sql`
      CREATE OR REPLACE TRIGGER update_log_summaries_timestamp
        BEFORE UPDATE ON log_summaries
        FOR EACH ROW
        EXECUTE FUNCTION update_log_summaries_timestamp()
    `);

    logger.info("Successfully completed migration: Create log_summaries table with metadata");
  } catch (error) {
    logger.error("Error during migration:", error);
    throw error;
  }
}

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
    logger.info("Starting rollback: Drop log_summaries table");
    
    // Drop trigger first
    await db.execute(sql`
      DROP TRIGGER IF EXISTS update_log_summaries_timestamp ON log_summaries
    `);

    // Drop function
    await db.execute(sql`
      DROP FUNCTION IF EXISTS update_log_summaries_timestamp()
    `);

    // Drop table (will automatically drop indexes)
    await db.execute(sql`
      DROP TABLE IF EXISTS log_summaries
    `);

    logger.info("Successfully completed rollback");
  } catch (error) {
    logger.error("Error during rollback:", error);
    throw error;
  }
}
