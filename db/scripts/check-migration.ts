
import { db } from '../index';
import { sql } from 'drizzle-orm';

async function checkUserTable() {
  try {
    const result = await db.execute(sql`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'users'
      ORDER BY column_name;
    `);
    console.log('Users Table Structure:', result.rows);
  } catch (error) {
    console.error('Error checking table structure:', error);
    throw error;
  } finally {
    process.exit();
  }
}

checkUserTable();
