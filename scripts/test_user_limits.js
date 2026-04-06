/**
 * Script to test the user limit functionality
 * 
 * This script can be used to test if the daily limit functionality
 * is working correctly by checking the count directly
 * from the database for a specific user.
 */

const { db } = require('../dist/db');
const { users, qualitativeLogs, queryChats } = require('../dist/db/schema');
const { eq, and, count, sql, desc, gte } = require('drizzle-orm');

// User ID to check (replace with a valid user ID from your system)
const userId = 1; 

// Rate limit constant (should match the one in userLimits.ts)
const DAILY_FREE_LIMIT = 10;

async function testUserLimits() {
  try {
    console.log(`Testing user limits for userId: ${userId}`);
    
    // Get the user's subscription status
    const userResult = await db
      .select({
        username: users.username,
        email: users.email,
        isPro: users.isPro,
        subscriptionStatus: users.subscriptionStatus,
        trialEndsAt: users.trialEndsAt
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    
    if (!userResult || userResult.length === 0) {
      console.error(`User not found with ID: ${userId}`);
      return;
    }
    
    const user = userResult[0];
    console.log('User details:');
    console.log(`  Username: ${user.username}`);
    console.log(`  Email: ${user.email}`);
    console.log(`  Is Pro: ${!!user.isPro}`);
    console.log(`  Subscription Status: ${user.subscriptionStatus || 'None'}`);
    console.log(`  Trial Ends At: ${user.trialEndsAt ? new Date(user.trialEndsAt).toLocaleString() : 'N/A'}`);
    
    // Determine if the user is on a trial
    const isProSubscriber = !!user.isPro;
    const isOnTrial = 
      !isProSubscriber && 
      (user.subscriptionStatus === 'trial' || 
       (user.trialEndsAt && new Date() < new Date(user.trialEndsAt)));
    
    console.log(`\nSubscription detection:`);
    console.log(`  Is Pro Subscriber: ${isProSubscriber}`);
    console.log(`  Is On Trial: ${isOnTrial}`);
    
    // Get the start of today (UTC)
    const now = new Date();
    const startOfDay = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
    );
    
    console.log(`\nCounting logs since: ${startOfDay.toISOString()}`);
    
    // Count qualitative logs for today
    const qualitativeLogsCount = await db
      .select({ count: count() })
      .from(qualitativeLogs)
      .where(
        and(
          eq(qualitativeLogs.userId, userId),
          gte(qualitativeLogs.createdAt, startOfDay)
        )
      );
    
    // Count query chats for today
    const queryChatsCount = await db
      .select({ count: count() })
      .from(queryChats)
      .where(
        and(
          eq(queryChats.userId, userId),
          gte(queryChats.createdAt, startOfDay)
        )
      );
    
    // Calculate totals
    const qualCount = qualitativeLogsCount[0]?.count || 0;
    const queryCount = queryChatsCount[0]?.count || 0;
    const totalCount = qualCount + queryCount;
    
    console.log(`Log counts for today:`);
    console.log(`  Qualitative Logs: ${qualCount}`);
    console.log(`  Query Chats: ${queryCount}`);
    console.log(`  Total Count: ${totalCount}`);
    
    // Check limit status
    const hasReachedLimit = isOnTrial && totalCount >= DAILY_FREE_LIMIT;
    console.log(`\nLimit Status:`);
    console.log(`  Daily Limit: ${DAILY_FREE_LIMIT}`);
    console.log(`  Has Reached Limit: ${hasReachedLimit}`);
    console.log(`  Remaining Requests: ${isOnTrial ? Math.max(0, DAILY_FREE_LIMIT - totalCount) : 'Unlimited'}`);
    
    // Get most recent logs for context
    console.log(`\nMost recent qualitative logs:`);
    const recentQualLogs = await db
      .select({
        id: qualitativeLogs.id,
        type: qualitativeLogs.type,
        createdAt: qualitativeLogs.createdAt
      })
      .from(qualitativeLogs)
      .where(eq(qualitativeLogs.userId, userId))
      .orderBy(desc(qualitativeLogs.createdAt))
      .limit(5);
    
    recentQualLogs.forEach(log => {
      console.log(`  ID: ${log.id}, Type: ${log.type}, Created: ${new Date(log.createdAt).toLocaleString()}`);
    });
    
    console.log(`\nMost recent query chats:`);
    const recentQueryChats = await db
      .select({
        id: queryChats.id,
        createdAt: queryChats.createdAt
      })
      .from(queryChats)
      .where(eq(queryChats.userId, userId))
      .orderBy(desc(queryChats.createdAt))
      .limit(5);
    
    recentQueryChats.forEach(chat => {
      console.log(`  ID: ${chat.id}, Created: ${new Date(chat.createdAt).toLocaleString()}`);
    });
    
  } catch (error) {
    console.error('Error testing user limits:', error);
  } finally {
    process.exit(0);
  }
}

// Run the test
testUserLimits();