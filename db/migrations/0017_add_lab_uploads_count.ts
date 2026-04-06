
import { db } from '../index';
import { sql } from 'drizzle-orm';

async function main() {
  console.log('Starting migration: Adding lab_uploads_count column...');
  
  try {
    await db.execute(sql`
      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS lab_uploads_count INTEGER DEFAULT 0,
      ADD COLUMN IF NOT EXISTS lab_uploads_reset TIMESTAMPTZ;
    `);
    
    console.log('✅ Successfully added lab_uploads_count column');
    
    return Promise.resolve();
  } catch (error) {
    console.error('Migration failed:', error);
    return Promise.reject(error);
  }
}

// Using ES modules syntax for direct execution
if (import.meta.url === import.meta.resolve('./0017_add_lab_uploads_count.ts')) {
  main()
    .then(() => {
      console.log('Migration completed successfully');
      process.exit(0);
    })
    .catch((err) => {
      console.error('Migration failed:', err);
      process.exit(1);
    });
}

export default main;
