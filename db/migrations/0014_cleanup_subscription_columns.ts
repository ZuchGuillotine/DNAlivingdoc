
import { db } from '../index';
import { sql } from 'drizzle-orm';

async function main() {
  console.log('Starting subscription columns cleanup migration...');
  try {
    // First ensure all users have a valid tier
    await db.execute(sql`
      UPDATE users 
      SET subscription_tier = 
        CASE 
          WHEN is_pro = true THEN 'pro'
          WHEN subscription_tier = 'active' OR subscription_status = 'active' THEN 'core'
          ELSE 'free'
        END
      WHERE subscription_tier IS NULL
    `);

    // Remove trial_ends_at column
    await db.execute(sql`
      ALTER TABLE users
      DROP COLUMN IF EXISTS trial_ends_at
    `);

    // Remove is_pro column
    await db.execute(sql`
      ALTER TABLE users
      DROP COLUMN IF EXISTS is_pro
    `);

    // Remove subscription_status column
    await db.execute(sql`
      ALTER TABLE users
      DROP COLUMN IF EXISTS subscription_status
    `);
    
    console.log('✅ Successfully cleaned up subscription columns');
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
  try {
    await db.execute(sql`
      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMPTZ
    `);

    await db.execute(sql`
      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS is_pro BOOLEAN DEFAULT false
    `);

    await db.execute(sql`
      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS subscription_status TEXT
    `);
    
    console.log('✅ Successfully restored subscription columns');
    return Promise.resolve();
  } catch (error) {
    console.error('Rollback failed:', error);
    return Promise.reject(error);
  }
}
