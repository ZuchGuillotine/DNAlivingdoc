
import { db } from '../index';
import { sql } from "drizzle-orm";

async function main() {
  console.log('Starting chat_summaries table migration...');
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS chat_summaries (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) NOT NULL,
        summary TEXT NOT NULL,
        period_start TIMESTAMP NOT NULL,
        period_end TIMESTAMP NOT NULL,
        metadata JSONB,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('Migration completed successfully');
  } catch (error) {
    console.error('Migration failed:', error);
    throw error;
  }
}

main()
  .catch(console.error)
  .finally(() => process.exit());

export async function up(db: any) {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS chat_summaries (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) NOT NULL,
      summary TEXT NOT NULL,
      period_start TIMESTAMP NOT NULL,
      period_end TIMESTAMP NOT NULL,
      metadata JSONB,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);
}

export async function down(db: any) {
  await db.execute(sql`DROP TABLE IF EXISTS chat_summaries;`);
}
