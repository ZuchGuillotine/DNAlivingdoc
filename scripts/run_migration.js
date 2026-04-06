
import { execSync } from 'child_process';
import { resolve } from 'path';
import { fileURLToPath } from 'url';

// Get the migration file to run from command line arguments
const migrationFile = process.argv[2];

if (!migrationFile) {
  console.error('Please specify a migration file to run');
  console.error('Example: node scripts/run_migration.js db/migrations/create_query_chats_table.ts');
  process.exit(1);
}

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const fullPath = resolve(__dirname, '..', migrationFile);

try {
  console.log(`Running migration: ${migrationFile}`);
  execSync(`npx tsx ${fullPath}`, { stdio: 'inherit' });
} catch (error) {
  console.error('Migration failed:', error.message);
  process.exit(1);
}
