
import { db } from '../db';
import { users, supplements, supplementLogs, healthStats, qualitativeLogs, queryChats, chatSummaries } from '../db/schema';
import { sql, and, ne, notInArray } from 'drizzle-orm';

async function cleanupUsers() {
  console.log('Starting user cleanup...');
  
  try {
    // Get IDs of users to keep
    const usersToKeep = await db.select({ id: users.id })
      .from(users)
      .where(
        or(
          sql`LOWER(${users.username}) = LOWER('bencox820')`,
          sql`LOWER(${users.username}) = LOWER('christyrcox')`
        )
      );
    
    const userIdsToKeep = usersToKeep.map(u => u.id);
    
    if (userIdsToKeep.length === 0) {
      console.error('Warning: Could not find the specified users to keep!');
      return;
    }
    
    console.log(`Found ${userIdsToKeep.length} users to keep with IDs: ${userIdsToKeep.join(', ')}`);
    
    // Get IDs of users to delete
    const usersToDelete = await db.select({ id: users.id, username: users.username })
      .from(users)
      .where(
        notInArray(users.id, userIdsToKeep)
      );
    
    console.log(`Found ${usersToDelete.length} users to delete`);
    
    // Perform operations sequentially without using a transaction
    
    // 1. Delete from chat_summaries
    const deletedChatSummaries = await db.delete(chatSummaries)
      .where(notInArray(chatSummaries.userId, userIdsToKeep))
      .returning({ id: chatSummaries.id });
    console.log(`Deleted ${deletedChatSummaries.length} chat summaries`);
    
    // 2. Delete from query_chats
    const deletedQueryChats = await db.delete(queryChats)
      .where(notInArray(queryChats.userId, userIdsToKeep))
      .returning({ id: queryChats.id });
    console.log(`Deleted ${deletedQueryChats.length} query chats`);
    
    // 3. Delete from qualitative_logs
    const deletedQualitativeLogs = await db.delete(qualitativeLogs)
      .where(notInArray(qualitativeLogs.userId, userIdsToKeep))
      .returning({ id: qualitativeLogs.id });
    console.log(`Deleted ${deletedQualitativeLogs.length} qualitative logs`);
    
    // 4. Delete from supplement_logs
    const deletedSupplementLogs = await db.delete(supplementLogs)
      .where(notInArray(supplementLogs.userId, userIdsToKeep))
      .returning({ id: supplementLogs.id });
    console.log(`Deleted ${deletedSupplementLogs.length} supplement logs`);
    
    // 5. Delete from health_stats
    const deletedHealthStats = await db.delete(healthStats)
      .where(notInArray(healthStats.userId, userIdsToKeep))
      .returning({ userId: healthStats.userId });
    console.log(`Deleted ${deletedHealthStats.length} health stats records`);
    
    // 6. Delete from supplements
    const deletedSupplements = await db.delete(supplements)
      .where(notInArray(supplements.userId, userIdsToKeep))
      .returning({ id: supplements.id });
    console.log(`Deleted ${deletedSupplements.length} supplements`);
    
    // 7. Finally delete the users
    const deletedUsers = await db.delete(users)
      .where(notInArray(users.id, userIdsToKeep))
      .returning({ id: users.id, username: users.username });
    
    console.log(`Successfully deleted ${deletedUsers.length} users:`);
    deletedUsers.forEach(user => {
      console.log(`- ID: ${user.id}, Username: ${user.username}`);
    });
    
    console.log('Database cleanup completed successfully!');
    
  } catch (error) {
    console.error('Error during cleanup:', error);
  } finally {
    process.exit(0);
  }
}

// Missing import function
function or(...conditions) {
  return sql`(${sql.join(conditions, sql` OR `)})`;
}

cleanupUsers();
