
import { db } from '../index';
import { sql } from 'drizzle-orm';

async function main() {
  console.log('Starting user tiers update migration...');
  try {
    // First ensure subscription_tier column exists
    await db.execute(sql`
      DO $$ 
      BEGIN 
        IF NOT EXISTS (
          SELECT FROM information_schema.columns 
          WHERE table_name = 'users' AND column_name = 'subscription_tier'
        ) THEN
          ALTER TABLE users ADD COLUMN subscription_tier TEXT DEFAULT 'free' NOT NULL;
        END IF;
      END $$;
    `);

    // Update admin users to pro tier
    await db.execute(sql`
      UPDATE users 
      SET subscription_tier = 'pro'
      WHERE is_admin = true;
    `);

    // Update specific users to core tier
    await db.execute(sql`
      UPDATE users 
      SET subscription_tier = 'core'
      WHERE email = 'delicacybydesign';
    `);

    // Ensure all remaining users have free tier
    await db.execute(sql`
      UPDATE users 
      SET subscription_tier = 'free'
      WHERE subscription_tier IS NULL 
      OR subscription_tier NOT IN ('pro', 'core');
    `);
    
    console.log('✅ Successfully updated existing users with subscription tiers');
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
    // Set all tiers back to free as a safe rollback
    await db.execute(sql`
      UPDATE users 
      SET subscription_tier = 'free';
    `);
    
    console.log('✅ Successfully rolled back subscription tier updates');
    return Promise.resolve();
  } catch (error) {
    console.error('Rollback failed:', error);
    return Promise.reject(error);
  }
}
