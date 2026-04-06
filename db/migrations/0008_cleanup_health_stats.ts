
import { db } from '../index';
import { sql } from "drizzle-orm";

async function main() {
  console.log('Starting cleanup migration...');
  try {
    // Drop the old id column and convert allergies to text
    await db.execute(sql`
      ALTER TABLE health_stats 
      DROP COLUMN IF EXISTS id,
      ALTER COLUMN allergies TYPE text USING allergies::text;
    `);
    console.log('Migration completed successfully');
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
      ALTER TABLE health_stats 
      DROP COLUMN IF EXISTS id,
      ALTER COLUMN allergies TYPE text USING allergies::text;
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
      ADD COLUMN IF NOT EXISTS id SERIAL,
      ALTER COLUMN allergies TYPE jsonb USING array_to_json(string_to_array(allergies, '\n'))::jsonb;
    `);
  } catch (error) {
    console.error('Migration rollback failed:', error);
    throw error;
  }
}
