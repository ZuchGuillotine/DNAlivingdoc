
import { db } from '../index';
import { sql } from "drizzle-orm";

async function main() {
  console.log('Starting lab_results table migration...');
  try {
    // Create table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS lab_results (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) NOT NULL,
        file_name TEXT NOT NULL,
        file_type TEXT NOT NULL,
        file_url TEXT NOT NULL,
        uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
        notes TEXT,
        metadata JSONB DEFAULT '{"size": 0}'::jsonb NOT NULL
      );
    `);

    // Create index
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_lab_results_user_id ON lab_results(user_id);
    `);
    
    console.log('Lab results migration completed successfully');
  } catch (error) {
    console.error('Migration failed:', error);
    throw error;
  }
}

main()
  .catch(console.error)
  .finally(() => process.exit());

export async function up(db: any) {
  await main();
}

export async function down(db: any) {
  try {
    await db.execute(sql`
      DROP TABLE IF EXISTS lab_results;
    `);
  } catch (error) {
    console.error('Migration rollback failed:', error);
    throw error;
  }
}
