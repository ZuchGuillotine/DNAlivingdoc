
const { sql } = require('drizzle-orm');

module.exports = async function(client) {
  // Create the query_chats table
  await client.query(`
    CREATE TABLE IF NOT EXISTS query_chats (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id),
      messages JSONB NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      metadata JSONB DEFAULT '{}'::jsonb
    );
  `);
  
  console.log('Created query_chats table');
};
import { createPool } from "@vercel/postgres";

export async function migrate() {
  const pool = createPool({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    console.log("Starting migration: adding query_chat_logs table");
    
    // Check if the table already exists to avoid errors
    const tableCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public'
        AND table_name = 'query_chat_logs'
      );
    `);
    
    if (!tableCheck.rows[0].exists) {
      console.log("Table does not exist, creating...");
      
      // Create the table
      await pool.query(`
        CREATE TABLE "query_chat_logs" (
          "id" SERIAL PRIMARY KEY,
          "user_id" INTEGER REFERENCES "users"("id"),
          "content" TEXT NOT NULL,
          "logged_at" TIMESTAMP DEFAULT NOW() NOT NULL,
          "metadata" JSONB DEFAULT '{}'
        );
      `);
      
      console.log("Created query_chat_logs table");
    } else {
      console.log("Table already exists, skipping creation");
    }
    
    console.log("Migration completed successfully");
  } catch (error) {
    console.error("Migration failed:", error);
    throw error;
  } finally {
    await pool.end();
  }
}

// Run the migration if this file is executed directly
if (require.main === module) {
  migrate()
    .then(() => {
      console.log("Migration script completed");
      process.exit(0);
    })
    .catch((err) => {
      console.error("Migration script failed:", err);
      process.exit(1);
    });
}
