import { sql } from "drizzle-orm";
import { pgTable, serial, text, integer, timestamp, json } from "drizzle-orm/pg-core";

export async function up(db: any) {
  // Enable required extensions
  await db.execute(sql`
    CREATE EXTENSION IF NOT EXISTS pg_trgm;
    CREATE EXTENSION IF NOT EXISTS fuzzystrmatch;
  `);

  // Create supplement_reference table
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS supplement_reference (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      category TEXT NOT NULL DEFAULT 'General',
      created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_supplement_reference_name_trgm 
      ON supplement_reference USING gin (name gin_trgm_ops);
  `);

  // Create supplement_logs table
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS supplement_logs (
      id SERIAL PRIMARY KEY,
      supplement_id INTEGER REFERENCES supplements(id),
      user_id INTEGER REFERENCES users(id),
      taken_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
      notes TEXT,
      effects JSONB DEFAULT '{}',
      created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT valid_effects CHECK (effects IS NULL OR jsonb_typeof(effects) = 'object')
    );

    CREATE INDEX IF NOT EXISTS idx_supplement_logs_user_id ON supplement_logs(user_id);
    CREATE INDEX IF NOT EXISTS idx_supplement_logs_taken_at ON supplement_logs(taken_at);
  `);

  // Create qualitative_logs table
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS qualitative_logs (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id),
      content TEXT NOT NULL,
      logged_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
      type TEXT NOT NULL,
      tags JSONB DEFAULT '[]',
      sentiment_score INTEGER,
      metadata JSONB DEFAULT '{}',
      created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT valid_tags CHECK (tags IS NULL OR jsonb_typeof(tags) = 'array'),
      CONSTRAINT valid_metadata CHECK (metadata IS NULL OR jsonb_typeof(metadata) = 'object')
    );

    CREATE INDEX IF NOT EXISTS idx_qualitative_logs_user_id ON qualitative_logs(user_id);
    CREATE INDEX IF NOT EXISTS idx_qualitative_logs_logged_at ON qualitative_logs(logged_at);
  `);

  // Create updated_at triggers
  await db.execute(sql`
    CREATE OR REPLACE FUNCTION update_updated_at_column()
    RETURNS TRIGGER AS $$
    BEGIN
        NEW.updated_at = CURRENT_TIMESTAMP;
        RETURN NEW;
    END;
    $$ language 'plpgsql';

    CREATE TRIGGER update_supplement_reference_updated_at
        BEFORE UPDATE ON supplement_reference
        FOR EACH ROW
        EXECUTE FUNCTION update_updated_at_column();

    CREATE TRIGGER update_supplement_logs_updated_at
        BEFORE UPDATE ON supplement_logs
        FOR EACH ROW
        EXECUTE FUNCTION update_updated_at_column();

    CREATE TRIGGER update_qualitative_logs_updated_at
        BEFORE UPDATE ON qualitative_logs
        FOR EACH ROW
        EXECUTE FUNCTION update_updated_at_column();
  `);
}

export async function down(db: any) {
  await db.execute(sql`
    DROP TRIGGER IF EXISTS update_qualitative_logs_updated_at ON qualitative_logs;
    DROP TRIGGER IF EXISTS update_supplement_logs_updated_at ON supplement_logs;
    DROP TRIGGER IF EXISTS update_supplement_reference_updated_at ON supplement_reference;
    DROP FUNCTION IF EXISTS update_updated_at_column();
    DROP TABLE IF EXISTS qualitative_logs;
    DROP TABLE IF EXISTS supplement_logs;
    DROP TABLE IF EXISTS supplement_reference;
  `);
}
