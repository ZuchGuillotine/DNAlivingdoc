
import { db } from '../index';
import { sql } from 'drizzle-orm';

export async function up() {
  try {
    await db.execute(sql`
      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS subscription_id TEXT,
      ADD COLUMN IF NOT EXISTS subscription_tier TEXT DEFAULT 'free',
      ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS chat_count INTEGER DEFAULT 0,
      ADD COLUMN IF NOT EXISTS last_rewarded_at TIMESTAMPTZ;
    `);
    console.log('Migration completed successfully');
  } catch (error) {
    console.error('Migration failed:', error);
    throw error;
  }
}

export async function down() {
  try {
    await db.execute(sql`
      ALTER TABLE users
      DROP COLUMN IF EXISTS subscription_id,
      DROP COLUMN IF EXISTS subscription_tier,
      DROP COLUMN IF EXISTS trial_ends_at,
      DROP COLUMN IF EXISTS chat_count,
      DROP COLUMN IF EXISTS last_rewarded_at;
    `);
    console.log('Rollback completed successfully');
  } catch (error) {
    console.error('Rollback failed:', error);
    throw error;
  }
}

// Run migration
up().catch(console.error);
