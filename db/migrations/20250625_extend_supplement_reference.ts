import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { sql } from 'drizzle-orm';

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL environment variable is required');
  }

  // Configure SSL for RDS connections
  const client = postgres(connectionString, {
    ssl: connectionString.includes('rds.amazonaws.com') 
      ? { rejectUnauthorized: false }
      : false
  });
  const db = drizzle(client);

  try {
    console.log('Adding fields to supplement_reference table...');
    
    // Add new fields to supplement_reference table
    await db.execute(sql`
      ALTER TABLE supplement_reference 
      ADD COLUMN IF NOT EXISTS alternative_names TEXT[],
      ADD COLUMN IF NOT EXISTS description TEXT,
      ADD COLUMN IF NOT EXISTS source TEXT,
      ADD COLUMN IF NOT EXISTS source_url TEXT;
    `);

    console.log('Migration completed successfully!');
  } catch (error) {
    console.error('Migration failed:', error);
    throw error;
  } finally {
    await client.end();
  }
}

// Run migration if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error('Migration failed:', error);
    process.exit(1);
  });
}

export default main;