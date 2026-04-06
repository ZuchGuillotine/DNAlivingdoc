import { pgTable, text } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";

export async function up(db: any) {
  await db.execute(sql`
    ALTER TABLE users 
    ADD COLUMN stripe_customer_id TEXT
  `);
}

export async function down(db: any) {
  await db.execute(sql`
    ALTER TABLE users 
    DROP COLUMN stripe_customer_id
  `);
}