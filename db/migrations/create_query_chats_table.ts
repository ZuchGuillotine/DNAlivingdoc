
import { sql } from "drizzle-orm";
import { db } from "../index";

async function main() {
  console.log("Running migration: create query_chats table");
  
  try {
    // Create the table if it doesn't exist
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS query_chats (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id),
        messages JSONB,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        metadata JSONB DEFAULT '{}'::jsonb
      );
    `);
    
    console.log("✅ Migration completed successfully");
  } catch (error) {
    console.error("Migration failed:", error);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error("Migration failed:", error);
  process.exit(1);
});
