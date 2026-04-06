
const { execSync } = require('child_process');

try {
  console.log('Checking if query_chats table exists...');
  
  // Use npx tsx to run a quick script to query the database
  const result = execSync(`npx tsx -e "
    import { db } from './db';
    import { sql } from 'drizzle-orm';
    
    async function checkTable() {
      const result = await db.execute(sql\`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_name = 'query_chats'
        ) as exists;
      \`);
      console.log('Table exists:', result[0].exists);
    }
    
    checkTable().catch(console.error);
  "`).toString();
  
  console.log(result);
} catch (error) {
  console.error('Error checking table:', error.message);
}
