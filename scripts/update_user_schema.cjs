// CommonJS style imports
const { db } = require('../db/index');
const { sql } = require('drizzle-orm');

async function addColumnsToUserTable() {
  try {
    console.log('Adding auth token columns to users table...');

    // First, check if columns already exist
    const checkResult = await db.execute(sql`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'users' 
      AND column_name = 'auth_token'
    `);

    if (checkResult.length > 0) {
      console.log('Auth token columns already exist, skipping...');
      return;
    }

    // Add auth_token column
    await db.execute(sql`
      ALTER TABLE users 
      ADD COLUMN IF NOT EXISTS auth_token TEXT
    `);

    // Add auth_token_expiry column
    await db.execute(sql`
      ALTER TABLE users 
      ADD COLUMN IF NOT EXISTS auth_token_expiry TIMESTAMP
    `);

    console.log('Successfully added auth token columns to users table');
  } catch (error) {
    console.error('Error updating users table:', error);
  } finally {
    process.exit(0);
  }
}

addColumnsToUserTable();