
import { type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { sql } from "drizzle-orm";

export async function up(db: PostgresJsDatabase) {
  try {
    await db.execute(sql`
      DO $$ 
      BEGIN 
        -- Safely alter column types
        ALTER TABLE health_stats 
        ALTER COLUMN height TYPE numeric USING height::numeric,
        ALTER COLUMN weight TYPE numeric USING weight::numeric;

        -- Safely handle age column
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'health_stats' AND column_name = 'age'
        ) THEN
          ALTER TABLE health_stats ADD COLUMN age INTEGER;
        END IF;

      EXCEPTION WHEN others THEN
        RAISE NOTICE 'Error during migration: %', SQLERRM;
        ROLLBACK;
        RAISE;
      END $$;
    `);
  } catch (error) {
    console.error('Migration failed:', error);
    throw error;
  }
}

export async function down(db: PostgresJsDatabase) {
  try {
    await db.execute(sql`
      ALTER TABLE health_stats 
      ALTER COLUMN height TYPE integer USING height::integer,
      ALTER COLUMN weight TYPE integer USING weight::integer,
      DROP COLUMN IF EXISTS age;
    `);
  } catch (error) {
    console.error('Migration rollback failed:', error);
    throw error;
  }
}
