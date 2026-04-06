import { type PostgresJsDatabase, drizzle } from "drizzle-orm/postgres-js";
import { sql } from "drizzle-orm";
import { pgTable, serial, integer, text, timestamp, numeric, jsonb, index, uniqueIndex } from "drizzle-orm/pg-core";
import { labResults } from "../schema";

// Main biomarker results table
export const biomarkerResults = pgTable("biomarker_results", {
  id: serial("id").primaryKey(),
  labResultId: integer("lab_result_id").references(() => labResults.id, { onDelete: "CASCADE" }).notNull(),
  name: text("name").notNull(),
  value: numeric("value").notNull(),
  unit: text("unit").notNull(),
  category: text("category").notNull(),
  referenceRange: text("reference_range"),
  testDate: timestamp("test_date").notNull(),
  status: text("status"),
  extractionMethod: text("extraction_method").notNull(),
  confidence: numeric("confidence"),
  metadata: jsonb("metadata").$type<{
    sourceText?: string;
    extractionTimestamp?: string;
    validationStatus?: string;
    notes?: string;
  }>(),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// Biomarker processing status tracking
export const biomarkerProcessingStatus = pgTable("biomarker_processing_status", {
  labResultId: integer("lab_result_id").references(() => labResults.id, { onDelete: "CASCADE" }).primaryKey(),
  status: text("status").notNull(),
  extractionMethod: text("extraction_method"),
  biomarkerCount: integer("biomarker_count"),
  errorMessage: text("error_message"),
  startedAt: timestamp("started_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  completedAt: timestamp("completed_at"),
  metadata: jsonb("metadata").$type<{
    regexMatches?: number;
    llmExtractions?: number;
    processingTime?: number;
    retryCount?: number;
  }>(),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// Reference data for biomarkers
export const biomarkerReference = pgTable("biomarker_reference", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  category: text("category").notNull(),
  defaultUnit: text("default_unit").notNull(),
  description: text("description"),
  metadata: jsonb("metadata").$type<{
    commonNames?: string[];
    normalRanges?: {
      gender?: string;
      ageRange?: string;
      range: string;
      unit: string;
    }[];
    importance?: number;
  }>(),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// Migration up function
export async function up(db: PostgresJsDatabase) {
  try {
    // Create biomarker results table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS biomarker_results (
        id SERIAL PRIMARY KEY,
        lab_result_id INTEGER REFERENCES lab_results(id) ON DELETE CASCADE NOT NULL,
        name TEXT NOT NULL,
        value NUMERIC NOT NULL,
        unit TEXT NOT NULL,
        category TEXT NOT NULL,
        reference_range TEXT,
        test_date TIMESTAMP NOT NULL,
        status TEXT,
        extraction_method TEXT NOT NULL,
        confidence NUMERIC,
        metadata JSONB,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
      );

      CREATE INDEX IF NOT EXISTS biomarker_results_lab_result_idx ON biomarker_results(lab_result_id);
      CREATE INDEX IF NOT EXISTS biomarker_results_name_idx ON biomarker_results(name);
      CREATE INDEX IF NOT EXISTS biomarker_results_test_date_idx ON biomarker_results(test_date);
      CREATE INDEX IF NOT EXISTS biomarker_results_name_date_idx ON biomarker_results(name, test_date);
      CREATE UNIQUE INDEX IF NOT EXISTS unique_lab_biomarker ON biomarker_results(lab_result_id, name, test_date);
    `);

    // Create biomarker processing status table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS biomarker_processing_status (
        lab_result_id INTEGER REFERENCES lab_results(id) ON DELETE CASCADE PRIMARY KEY,
        status TEXT NOT NULL,
        extraction_method TEXT,
        biomarker_count INTEGER,
        error_message TEXT,
        started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
        completed_at TIMESTAMP,
        metadata JSONB DEFAULT '{}'::jsonb,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
      );
    `);

    // Create biomarker reference table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS biomarker_reference (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        category TEXT NOT NULL,
        default_unit TEXT NOT NULL,
        description TEXT,
        metadata JSONB DEFAULT '{}'::jsonb,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
      );
    `);

    // Insert initial reference data
    await db.execute(sql`
      INSERT INTO biomarker_reference (name, category, default_unit, description, metadata)
      VALUES 
        ('glucose', 'metabolic', 'mg/dL', 'Blood glucose level', '{"commonNames": ["Blood Sugar", "Fasting Glucose"], "normalRanges": [{"range": "74-106", "unit": "mg/dL"}], "importance": 1}'::jsonb),
        ('cholesterol', 'lipid', 'mg/dL', 'Total cholesterol level', '{"commonNames": ["Total Cholesterol"], "normalRanges": [{"range": "125-200", "unit": "mg/dL"}], "importance": 1}'::jsonb)
      ON CONFLICT (name) DO NOTHING;
    `);

  } catch (error) {
    console.error('Migration failed:', error);
    throw error;
  }
}

export async function down(db: PostgresJsDatabase) {
  try {
    await db.execute(sql`
      DROP TABLE IF EXISTS biomarker_results CASCADE;
      DROP TABLE IF EXISTS biomarker_processing_status CASCADE;
      DROP TABLE IF EXISTS biomarker_reference CASCADE;
    `);
  } catch (error) {
    console.error('Migration rollback failed:', error);
    throw error;
  }
}

// Execute migration if running directly
if (import.meta.url === new URL(process.argv[1], 'file:').href) {
  import('postgres').then(async ({ default: postgres }) => {
    if (!process.env.DATABASE_URL) {
      throw new Error('DATABASE_URL environment variable not set');
    }

    const client = postgres(process.env.DATABASE_URL);
    const db = drizzle(client);

    try {
      console.log('Running biomarker tables migration...');
      await up(db);
      console.log('Migration completed successfully');
    } catch (error) {
      console.error('Migration failed:', error);
      process.exit(1);
    } finally {
      await client.end();
      process.exit();
    }
  });
}