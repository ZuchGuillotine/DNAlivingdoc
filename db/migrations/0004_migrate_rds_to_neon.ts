
import { sql } from "drizzle-orm";

export async function up(db: any) {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS supplement_logs (
      id SERIAL PRIMARY KEY,
      supplement_id INTEGER REFERENCES supplements(id),
      user_id INTEGER REFERENCES users(id),
      taken_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
      notes TEXT,
      effects JSONB,
      created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS qualitative_logs (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id),
      content TEXT NOT NULL,
      logged_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
      type TEXT,
      tags JSONB,
      sentiment_score INTEGER,
      metadata JSONB,
      created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS supplement_reference (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      category TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
    );

    -- Create indexes
    CREATE INDEX IF NOT EXISTS idx_supplement_logs_user_id ON supplement_logs(user_id);
    CREATE INDEX IF NOT EXISTS idx_supplement_logs_taken_at ON supplement_logs(taken_at);
    CREATE INDEX IF NOT EXISTS idx_qualitative_logs_user_id ON qualitative_logs(user_id);
    CREATE INDEX IF NOT EXISTS idx_qualitative_logs_type ON qualitative_logs(type);
  `);
}

export async function down(db: any) {
  await db.execute(sql`
    DROP TABLE IF EXISTS supplement_logs;
    DROP TABLE IF EXISTS qualitative_logs;
    DROP TABLE IF EXISTS supplement_reference;
  `);
}
