import { db } from '../index';
import { sql } from 'drizzle-orm';

async function main() {
  console.log('Starting migration: Adding subscription tier column...');

  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL environment variable is required");
  }

  try {
    // Check if table exists first
    const tableCheck = await db.execute(sql`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public'
        AND table_name = 'users'
      );
    `);
    console.log('Table check completed');

    // Add subscription tier column
    await db.execute(sql`
      ALTER TABLE users 
      ADD COLUMN IF NOT EXISTS subscription_tier TEXT DEFAULT 'free' NOT NULL;
    `);
    console.log('✅ Successfully added subscription_tier column');

    return Promise.resolve();
  } catch (error) {
    console.error('Migration failed:', error);
    return Promise.reject(error);
  }
}

// Execute migration if running directly
if (import.meta.url === new URL(process.argv[1], 'file:').href) {
  main()
    .then(() => {
      console.log('Migration completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Migration failed:', error);
      process.exit(1);
    });
}

export async function up() {
  return main();
}

export async function down() {
  console.log('Starting rollback: Removing subscription tier column...');
  try {
    await db.execute(sql`
      ALTER TABLE users 
      DROP COLUMN IF EXISTS subscription_tier;
    `);
    console.log('✅ Successfully removed subscription_tier column');
    return Promise.resolve();
  } catch (error) {
    console.error('Rollback failed:', error);
    return Promise.reject(error);
  }
}