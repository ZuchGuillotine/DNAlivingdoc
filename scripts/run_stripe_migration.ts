import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { sql } from 'drizzle-orm';
import dotenv from 'dotenv';

dotenv.config();

async function runMigration() {
  try {
    if (!process.env.DATABASE_URL) {
      throw new Error('DATABASE_URL environment variable not set');
    }

    const connectionString = process.env.DATABASE_URL;
    const client = postgres(connectionString);
    const db = drizzle(client);

    console.log('Adding stripe_customer_id column to users table...');
    
    // Check if the column already exists
    const checkColumnQuery = sql`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'users' AND column_name = 'stripe_customer_id'
    `;
    
    const columnExists = await db.execute(checkColumnQuery);
    
    if (columnExists.length > 0) {
      console.log('Column stripe_customer_id already exists. Skipping...');
    } else {
      // Add the column
      await db.execute(sql`
        ALTER TABLE users 
        ADD COLUMN stripe_customer_id TEXT
      `);
      console.log('Column stripe_customer_id added successfully.');
    }

    await client.end();
    console.log('Migration completed successfully.');
  } catch (error) {
    console.error('Error running migration:', error);
    process.exit(1);
  }
}

runMigration();