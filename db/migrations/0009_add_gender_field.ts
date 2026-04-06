
import { sql } from "drizzle-orm";
import { db } from "../index";

async function up() {
  try {
    await db.execute(sql`
      ALTER TABLE health_stats 
      ADD COLUMN IF NOT EXISTS gender text;
    `);
    console.log('Migration completed successfully');
  } catch (error) {
    console.error('Migration failed:', error);
    throw error;
  }
}

async function down() {
  try {
    await db.execute(sql`
      ALTER TABLE health_stats 
      DROP COLUMN IF EXISTS gender;
    `);
    console.log('Rollback completed successfully');
  } catch (error) {
    console.error('Migration rollback failed:', error);
    throw error;
  }
}

// Execute the migration
up().catch(console.error);
