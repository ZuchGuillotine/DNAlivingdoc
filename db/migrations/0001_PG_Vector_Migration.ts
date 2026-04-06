import { sql } from "drizzle-orm";
import { db } from "../index";

async function main() {
  console.log('Starting PGVector migration...');
  try {
    // Enable the vector extension
    console.log('Enabling pgvector extension...');
    await db.execute(sql`
      CREATE EXTENSION IF NOT EXISTS vector;
    `);

    // Create a table for storing embeddings of qualitative logs
    console.log('Creating log_embeddings table...');
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS log_embeddings (
        id SERIAL PRIMARY KEY,
        log_id INTEGER NOT NULL,
        log_type TEXT NOT NULL, -- 'qualitative' or 'quantitative'
        embedding vector(1536), -- 1536 dimensions for OpenAI embeddings
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Create a table for storing embeddings of chat summaries
    console.log('Creating summary_embeddings table...');
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS summary_embeddings (
        id SERIAL PRIMARY KEY,
        summary_id INTEGER NOT NULL,
        embedding vector(1536),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Create indexes for fast vector search
    console.log('Creating vector search indexes...');

    // For logs
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_log_embeddings ON log_embeddings 
      USING ivfflat (embedding vector_cosine_ops)
      WITH (lists = 100);
    `);

    // For summaries
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_summary_embeddings ON summary_embeddings 
      USING ivfflat (embedding vector_cosine_ops)
      WITH (lists = 100);
    `);

    console.log('PGVector migration completed successfully');
  } catch (error) {
    console.error('Migration failed:', error);
    throw error;
  }
}

// Execute migration
main()
  .catch(console.error)
  .finally(() => process.exit());

// Export up/down functions for drizzle
export async function up(db: any) {
  await db.execute(sql`CREATE EXTENSION IF NOT EXISTS vector;`);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS log_embeddings (
      id SERIAL PRIMARY KEY,
      log_id INTEGER NOT NULL,
      log_type TEXT NOT NULL,
      embedding vector(1536),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS summary_embeddings (
      id SERIAL PRIMARY KEY,
      summary_id INTEGER NOT NULL,
      embedding vector(1536),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS idx_log_embeddings ON log_embeddings 
    USING ivfflat (embedding vector_cosine_ops)
    WITH (lists = 100);
  `);

  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS idx_summary_embeddings ON summary_embeddings 
    USING ivfflat (embedding vector_cosine_ops)
    WITH (lists = 100);
  `);
}

export async function down(db: any) {
  await db.execute(sql`DROP INDEX IF EXISTS idx_log_embeddings;`);
  await db.execute(sql`DROP INDEX IF EXISTS idx_summary_embeddings;`);
  await db.execute(sql`DROP TABLE IF EXISTS log_embeddings;`);
  await db.execute(sql`DROP TABLE IF EXISTS summary_embeddings;`);
  // Note: We don't drop the vector extension as it might be used by other tables
}