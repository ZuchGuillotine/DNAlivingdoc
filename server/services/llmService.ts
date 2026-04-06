// server/services/llmService.ts

import { sql } from 'drizzle-orm';
import { eq, gte, and } from 'drizzle-orm/expressions';
import { db } from '../../db';
import { qualitativeLogs, users } from '../../db/schema';
import { chatWithAI as openAIChatWithAI, MODELS } from "../openai";
import { tierLimitService } from './tierLimitService';

/**
 * Get the count of chat interactions for a user for the current day
 * @param userId User ID for counting daily chats
 * @returns Number of chats for the current day
 */
async function getUserDailyChatCount(userId: number): Promise<number> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const count = await db
    .select({ count: sql<number>`count(*)` })
    .from(qualitativeLogs)
    .where(
      and(
        eq(qualitativeLogs.userId, userId),
        gte(qualitativeLogs.createdAt, today),
        eq(qualitativeLogs.type, 'chat')
      )
    );

  return count[0].count;
}

/**
 * Chat with AI for user feedback on supplements - uses the qualitative model
 * @param messages Array of message objects with role and content
 * @param userId User ID for context and rate limiting
 * @returns Async generator that yields response chunks
 */
export async function chatWithAI(messages: Array<{ role: string; content: string }>, userId: number) {
  try {
    //Added unique identifier to prevent duplicate logs
    const uniqueIdentifier = crypto.randomUUID();
    console.log('Qualitative chat request:', {
      userId,
      messageCount: messages.length,
      timestamp: new Date().toISOString(),
      uniqueIdentifier
    });

    const userRecord = await db.select().from(users).where(eq(users.id, userId)).limit(1);

    if (!userRecord || userRecord.length === 0) {
      console.error('User record not found:', { userId });
      throw new Error('User not found');
    }

    const canUseAI = await tierLimitService.canUseAI(userId);
    if (!canUseAI) {
      throw new Error('Monthly chat limit reached. Please upgrade your plan to continue using AI features.');
    }

    // Define the correct model for qualitative chat
    const QUALITATIVE_MODEL = "gpt-4o-mini";

    // Verify model being used - explicitly logging to help debug model selection issues
    // IMPORTANT: This service must always use the qualitative model (gpt-4o-mini)
    console.log('Using qualitative chat model:', { 
      model: QUALITATIVE_MODEL,
      modelName: QUALITATIVE_MODEL,
      userId,
      timestamp: new Date().toISOString(),
      uniqueIdentifier
    });

    // Use the dedicated qualitative service
    const { qualitativeChatWithAI } = await import('./openaiQualitativeService');
    return qualitativeChatWithAI(userId, messages[messages.length - 1].content);
  } catch (error) {
    console.error('Error in qualitative chat service:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      userId,
      timestamp: new Date().toISOString()
    });
    throw error;
  }
}

/**
 * Process a single message from a user for qualitative feedback
 * This function builds context and initiates a streaming chat with the AI
 * @param userId User ID as string
 * @param message User's message content
 * @returns Async generator for streaming response
 */
export async function qualitativeChatWithAI(userId: string, message: string) {
  try {
    console.log('Qualitative chat request with single message:', {
      userId,
      messagePreview: message.substring(0, 50) + '...',
      timestamp: new Date().toISOString()
    });

    // Convert string userId to number for database queries
    const userIdNum = parseInt(userId, 10);

    if (isNaN(userIdNum)) {
      throw new Error('Invalid user ID');
    }

    // Format the message into the expected format for the LLM
    const formattedMessages = [
      { role: 'user', content: message }
    ];

    //Added logging for qualitative chat
    const response = await chatWithAI(formattedMessages, userIdNum);
    console.log("Qualitative chat response:", {userId, response, timestamp: new Date().toISOString()})
    // Use the existing chatWithAI function with the formatted messages
    return response;
  } catch (error) {
    console.error('Error in qualitative chat with AI service:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      userId,
      timestamp: new Date().toISOString()
    });
    throw error;
  }
}

import crypto from 'crypto';