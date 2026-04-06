import { db } from '../../db';
import { qualitativeLogs, chatSummaries } from '../../db/schema';
import { and, lt, gte, eq, asc, inArray } from 'drizzle-orm';
import { chatWithAI } from '../openai';

/**
 * LLM Summary Service
 * This service handles the periodic summarization of user chat logs using OpenAI's GPT model.
 * It processes qualitative feedback and generates concise summaries for better context in future interactions.
 */

/**
 * Generates a summary of chat logs for a specific time period
 * @param userId - The ID of the user whose chats need summarization
 * @param startDate - Beginning of the period to summarize
 * @param endDate - End of the period to summarize
 * @returns Promise containing the generated summary
 */
export async function generateChatSummary(userId: number, startDate: Date, endDate: Date) {
  // Fetch relevant chat logs for the period
  const logs = await db.select()
    .from(qualitativeLogs)
    .where(
      and(
        gte(qualitativeLogs.createdAt, startDate),
        lt(qualitativeLogs.createdAt, endDate)
      )
    );

  // Create summary entry in database
  const summary = await db.insert(chatSummaries).values({
    userId,
    summary: "Summary will be generated",
    periodStart: startDate,
    periodEnd: endDate,
    metadata: {} // Reserved for future use
  });

  return summary;
}

const SUMMARY_PROMPT = `Summarize the following chat interactions, focusing on key insights about the user's supplement experience, notable effects, and any consistent patterns or concerns. Keep the summary concise but informative.`;

/**
 * Summarizes old chats for a given user.
 * @param userId The ID of the user.
 */
export async function summarizeOldChats(userId: number) {
  console.log(`Starting chat summarization for user ${userId}`);
  const twoWeeksAgo = new Date();
  twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);
  console.log(`Looking for chats older than ${twoWeeksAgo.toISOString()}`);

  // Get old chats
  const oldChats = await db.query.qualitativeLogs.findMany({
    where: and(
      eq(qualitativeLogs.userId, userId),
      eq(qualitativeLogs.type, 'chat'),
      lt(qualitativeLogs.createdAt, twoWeeksAgo)
    ),
    orderBy: asc(qualitativeLogs.createdAt)
  });

  if (oldChats.length === 0) {
    console.log(`No old chats found for user ${userId}`);
    return;
  }
  console.log(`Found ${oldChats.length} chats to summarize for user ${userId}`);

  // Prepare chats for summarization
  const chatContent = oldChats.map(chat => {
    try {
      const messages = JSON.parse(chat.content);
      return messages.map((m: any) => `${m.role}: ${m.content}`).join('\n');
    } catch (e) {
      return chat.content;
    }
  }).join('\n---\n');

  // Generate summary using OpenAI with qualitative model
  const { chatWithAI } = await import('../openai');
  const { MODELS } = await import('../openai');
  
  // Start generating the summary
  const summaryGenerator = chatWithAI(
    [
      { role: 'system', content: SUMMARY_PROMPT },
      { role: 'user', content: chatContent }
    ],
    MODELS.QUALITATIVE_CHAT
  );
  
  // Get the first response (we don't need streaming for summaries)
  const first = await summaryGenerator.next();
  const summaryResponse = first.value;

  // Store summary
  await db.insert(chatSummaries).values({
    userId,
    summary: summaryResponse.response,
    periodStart: oldChats[0].createdAt,
    periodEnd: oldChats[oldChats.length - 1].createdAt,
    metadata: {
      chatCount: oldChats.length,
      originalIds: oldChats.map(c => c.id)
    }
  });

  // Optional: Delete old chats after successful summarization
  await db.delete(qualitativeLogs)
    .where(and(
      eq(qualitativeLogs.userId, userId),
      inArray(qualitativeLogs.id, oldChats.map(c => c.id))
    ));
}