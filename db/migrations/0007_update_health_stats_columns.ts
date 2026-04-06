
import { db } from '../index';
import { sql } from "drizzle-orm";

async function main() {
  console.log('Starting migration...');
  try {
    // First ensure user_id is not null and references valid users
    await db.execute(sql`
      DELETE FROM health_stats 
      WHERE user_id IS NULL 
      OR user_id NOT IN (SELECT id FROM users)
    `);
    console.log('Cleaned invalid user references');

    // Keep only the most recent record per user
    await db.execute(sql`
      DELETE FROM health_stats h1 
      WHERE EXISTS (
        SELECT 1 FROM health_stats h2 
        WHERE h2.user_id = h1.user_id 
        AND h2.last_updated > h1.last_updated
      )
    `);
    console.log('Removed older duplicate records');

    // Add height and modify weight columns
    await db.execute(sql`
      ALTER TABLE health_stats 
      ADD COLUMN IF NOT EXISTS height numeric,
      ALTER COLUMN weight TYPE numeric USING weight::numeric
    `);
    console.log('Modified columns');

    // Add primary key constraint
    await db.execute(sql`
      ALTER TABLE health_stats 
      DROP CONSTRAINT IF EXISTS health_stats_pkey,
      ADD CONSTRAINT health_stats_pkey PRIMARY KEY (user_id)
    `);
    console.log('Added primary key constraint');

  } catch (error) {
    console.error('Migration failed:', error);
    throw error;
  }
}

main()
  .catch(console.error)
  .finally(() => process.exit());

export async function up(db: any) {
  try {
    await db.execute(sql`
      DELETE FROM health_stats 
      WHERE user_id IS NULL 
      OR user_id NOT IN (SELECT id FROM users)
    `);
    
    await db.execute(sql`
      DELETE FROM health_stats h1 
      WHERE EXISTS (
        SELECT 1 FROM health_stats h2 
        WHERE h2.user_id = h1.user_id 
        AND h2.last_updated > h1.last_updated
      )
    `);

    await db.execute(sql`
      ALTER TABLE health_stats 
      ADD COLUMN IF NOT EXISTS height numeric,
      ALTER COLUMN weight TYPE numeric USING weight::numeric,
      DROP CONSTRAINT IF EXISTS health_stats_pkey,
      ADD CONSTRAINT health_stats_pkey PRIMARY KEY (user_id)
    `);
  } catch (error) {
    console.error('Migration failed:', error);
    throw error;
  }
}

export async function down(db: any) {
  try {
    await db.execute(sql`
      ALTER TABLE health_stats 
      DROP CONSTRAINT IF EXISTS health_stats_pkey,
      DROP COLUMN IF EXISTS height,
      ALTER COLUMN weight TYPE integer USING weight::integer
    `);
  } catch (error) {
    console.error('Migration rollback failed:', error);
    throw error;
  }
}
