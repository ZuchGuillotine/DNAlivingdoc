
import { sql } from "drizzle-orm";

// Migration to convert sleep duration from hours (stored as decimal) to minutes (stored as integer)
// This improves data consistency and makes calculations more precise
export async function up(db) {
  // Convert existing sleep duration values from hours to minutes
  // Multiply by 60 to convert hours to minutes, then round to nearest integer
  await db.execute(sql`
    ALTER TABLE health_stats 
    ALTER COLUMN average_sleep TYPE integer 
    USING ROUND(average_sleep * 60)::integer;
  `);
}

// Revert migration by converting minutes back to hours as decimal
export async function down(db) {
  // Convert integer minutes back to decimal hours by dividing by 60
  // Uses numeric type to preserve decimal precision
  await db.execute(sql`
    ALTER TABLE health_stats 
    ALTER COLUMN average_sleep TYPE numeric 
    USING (average_sleep::numeric / 60)::numeric;
  `);
}
