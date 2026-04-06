import { db } from '../index';
import { sql } from 'drizzle-orm';

async function main() {
  console.log('Starting migration: genetics fact gate tables...');

  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS genetics_uploads (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        file_name TEXT NOT NULL,
        file_type TEXT NOT NULL,
        file_url TEXT NOT NULL,
        provider_guess TEXT,
        genome_build_guess TEXT,
        parser_version TEXT,
        ingested_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        metadata JSONB DEFAULT '{}'::jsonb
      );
    `);

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS genetics_genotype_calls (
        id SERIAL PRIMARY KEY,
        upload_id INTEGER NOT NULL REFERENCES genetics_uploads(id) ON DELETE CASCADE,
        rsid TEXT NOT NULL,
        genotype TEXT NOT NULL,
        chromosome TEXT,
        position INTEGER,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS genetics_coverage_maps (
        id SERIAL PRIMARY KEY,
        upload_id INTEGER NOT NULL UNIQUE REFERENCES genetics_uploads(id) ON DELETE CASCADE,
        panel_coverage JSONB NOT NULL DEFAULT '{}'::jsonb,
        integrity_score INTEGER,
        integrity_notes JSONB NOT NULL DEFAULT '[]'::jsonb,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS genetics_citations (
        id SERIAL PRIMARY KEY,
        citation_type TEXT NOT NULL,
        persistent_id TEXT,
        title TEXT NOT NULL,
        authors TEXT,
        year INTEGER,
        journal TEXT,
        url TEXT,
        attribution_text TEXT,
        retrieved_at TIMESTAMP,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS genetics_facts (
        id SERIAL PRIMARY KEY,
        fact_key TEXT NOT NULL UNIQUE,
        panel TEXT NOT NULL,
        source_authority TEXT NOT NULL,
        rsid TEXT NOT NULL,
        genotype_pattern TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'draft',
        created_by TEXT,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS genetics_fact_revisions (
        id SERIAL PRIMARY KEY,
        fact_id INTEGER NOT NULL REFERENCES genetics_facts(id) ON DELETE CASCADE,
        tier INTEGER NOT NULL,
        claim_title TEXT NOT NULL,
        claim_summary TEXT NOT NULL,
        claim_details TEXT,
        review_status_rule TEXT,
        clinvar_stars_min INTEGER,
        clinvar_stars_observed INTEGER,
        confidence_modifier TEXT,
        source_snapshot JSONB DEFAULT '{}'::jsonb,
        judge_report JSONB DEFAULT '{}'::jsonb,
        effective_from TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        effective_to TIMESTAMP,
        supersedes_revision_id INTEGER,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS genetics_fact_revision_citations (
        id SERIAL PRIMARY KEY,
        fact_revision_id INTEGER NOT NULL REFERENCES genetics_fact_revisions(id) ON DELETE CASCADE,
        citation_id INTEGER NOT NULL REFERENCES genetics_citations(id) ON DELETE CASCADE
      );
    `);

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS genetics_factsets (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        inputs JSONB NOT NULL DEFAULT '{}'::jsonb,
        is_active BOOLEAN NOT NULL DEFAULT false,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS genetics_factset_memberships (
        id SERIAL PRIMARY KEY,
        factset_id INTEGER NOT NULL REFERENCES genetics_factsets(id) ON DELETE CASCADE,
        fact_revision_id INTEGER NOT NULL REFERENCES genetics_fact_revisions(id) ON DELETE CASCADE,
        fact_version_hash TEXT,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS genetics_report_versions (
        id SERIAL PRIMARY KEY,
        upload_id INTEGER NOT NULL REFERENCES genetics_uploads(id) ON DELETE CASCADE,
        factset_id INTEGER NOT NULL REFERENCES genetics_factsets(id),
        report_payload_json JSONB NOT NULL,
        ui_render_json JSONB NOT NULL DEFAULT '{}'::jsonb,
        status TEXT NOT NULL DEFAULT 'active',
        generated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS genetics_user_fact_instances (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        upload_id INTEGER NOT NULL REFERENCES genetics_uploads(id) ON DELETE CASCADE,
        fact_id INTEGER NOT NULL REFERENCES genetics_facts(id),
        fact_revision_id INTEGER NOT NULL REFERENCES genetics_fact_revisions(id),
        rsid TEXT NOT NULL,
        genotype TEXT NOT NULL,
        tier INTEGER NOT NULL,
        report_version_id INTEGER NOT NULL REFERENCES genetics_report_versions(id) ON DELETE CASCADE,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_genetics_uploads_user_id ON genetics_uploads(user_id);
    `);
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_genetics_genotype_calls_upload_rsid ON genetics_genotype_calls(upload_id, rsid);
    `);
    await db.execute(sql`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_genetics_genotype_calls_upload_rsid_unique ON genetics_genotype_calls(upload_id, rsid);
    `);
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_genetics_facts_rsid_status ON genetics_facts(rsid, status);
    `);
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_genetics_revisions_fact_id ON genetics_fact_revisions(fact_id);
    `);
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_genetics_memberships_factset_id ON genetics_factset_memberships(factset_id);
    `);
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_genetics_report_versions_upload_id ON genetics_report_versions(upload_id);
    `);
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_genetics_user_fact_instances_user_id ON genetics_user_fact_instances(user_id);
    `);
    await db.execute(sql`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_genetics_factset_single_active ON genetics_factsets((is_active)) WHERE is_active = true;
    `);

    console.log('Genetics fact gate migration completed successfully');
  } catch (error) {
    console.error('Migration failed:', error);
    throw error;
  }
}

main()
  .catch(console.error)
  .finally(() => process.exit());

export async function up(_db: any) {
  await main();
}

export async function down(dbConn: any) {
  await dbConn.execute(sql`DROP TABLE IF EXISTS genetics_user_fact_instances;`);
  await dbConn.execute(sql`DROP TABLE IF EXISTS genetics_report_versions;`);
  await dbConn.execute(sql`DROP TABLE IF EXISTS genetics_factset_memberships;`);
  await dbConn.execute(sql`DROP TABLE IF EXISTS genetics_factsets;`);
  await dbConn.execute(sql`DROP TABLE IF EXISTS genetics_fact_revision_citations;`);
  await dbConn.execute(sql`DROP TABLE IF EXISTS genetics_fact_revisions;`);
  await dbConn.execute(sql`DROP TABLE IF EXISTS genetics_facts;`);
  await dbConn.execute(sql`DROP TABLE IF EXISTS genetics_citations;`);
  await dbConn.execute(sql`DROP TABLE IF EXISTS genetics_coverage_maps;`);
  await dbConn.execute(sql`DROP TABLE IF EXISTS genetics_genotype_calls;`);
  await dbConn.execute(sql`DROP TABLE IF EXISTS genetics_uploads;`);
}
