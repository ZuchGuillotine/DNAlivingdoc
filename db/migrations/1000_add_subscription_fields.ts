import { sql } from "drizzle-orm";
import { pgTable, boolean, timestamp } from "drizzle-orm/pg-core";

export default async function(db) {
  // First check if isPro column exists
  const checkIsPro = await db.execute(sql`
    SELECT column_name 
    FROM information_schema.columns 
    WHERE table_name = 'users' 
    AND column_name = 'is_pro'
  `);
  
  if (checkIsPro.rows.length === 0) {
    console.log('Adding isPro column to users table');
    await db.execute(sql`
      ALTER TABLE users
      ADD COLUMN is_pro BOOLEAN DEFAULT FALSE
    `);
  }
  
  // Check if trialEndsAt column exists
  const checkTrialEndsAt = await db.execute(sql`
    SELECT column_name 
    FROM information_schema.columns 
    WHERE table_name = 'users' 
    AND column_name = 'trial_ends_at'
  `);
  
  if (checkTrialEndsAt.rows.length === 0) {
    console.log('Adding trialEndsAt column to users table');
    await db.execute(sql`
      ALTER TABLE users
      ADD COLUMN trial_ends_at TIMESTAMP
    `);
  }
  
  // Check if subscriptionTier column exists
  const checkSubscriptionTier = await db.execute(sql`
    SELECT column_name 
    FROM information_schema.columns 
    WHERE table_name = 'users' 
    AND column_name = 'subscription_tier'
  `);
  
  if (checkSubscriptionTier.rows.length === 0) {
    console.log('Adding subscriptionTier column to users table');
    await db.execute(sql`
      ALTER TABLE users
      ADD COLUMN subscription_tier TEXT DEFAULT 'free'
    `);
  }
  
  // Clean up any duplicate aiInteractionsCount columns
  const checkDuplicateAiCount = await db.execute(sql`
    SELECT column_name 
    FROM information_schema.columns 
    WHERE table_name = 'users' 
    AND column_name = 'ai_interactions_count'
  `);
  
  if (checkDuplicateAiCount.rows.length > 1) {
    console.log('Cleaning up duplicate aiInteractionsCount column in users table');
    await db.execute(sql`
      ALTER TABLE users
      DROP COLUMN ai_interactions_count
    `);
    
    await db.execute(sql`
      ALTER TABLE users
      ADD COLUMN ai_interactions_count INTEGER DEFAULT 0
    `);
  }
  
  console.log('User subscription fields migration completed successfully');
}