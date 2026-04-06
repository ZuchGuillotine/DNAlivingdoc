import { debugContext } from '../utils/contextDebugger';
import { chatWithAI, MODELS } from '../openai';
import logger from '../utils/logger';
import { constructUserContext } from './llmContextService';
import { db } from '../../db';
import { qualitativeLogs } from '../../db/schema';
import { checkUserLLMLimit } from '../utils/userLimits';

export async function* qualitativeChatWithAI(userId: string | number | undefined, userQuery: string) {
  try {
    // Convert userId to number for consistent handling
    const userIdNum = typeof userId === 'string' ? parseInt(userId, 10) : (userId as number);

    // Check user limits if we have a valid user ID
    if (!isNaN(userIdNum)) {
      const limitStatus = await checkUserLLMLimit(userIdNum);
      
      // If user has reached their limit and is on trial, inform them
      if (limitStatus.hasReachedLimit && limitStatus.isOnTrial) {
        logger.info('User reached daily chat limit:', {
          userId: userIdNum,
          currentCount: limitStatus.currentCount,
          isPro: limitStatus.isPro,
          isOnTrial: limitStatus.isOnTrial,
          timestamp: new Date().toISOString()
        });
        
        yield {
          error: 'You have reached your daily limit of 10 AI interactions. Please upgrade to continue using this feature.',
          limitReached: true,
          streaming: false
        };
        return;
      }
    }

    // Build context using the context service
    const context = await constructUserContext(userId?.toString() || 'anonymous', userQuery);

    // Debug log the context
    await debugContext(userId?.toString() || 'anonymous', context, 'qualitative');

    // Log the request
    logger.info('Qualitative chat request:', {
      userId,
      messageCount: context.messages.length,
      timestamp: new Date().toISOString()
    });

    // Create a unique request ID to track this request
    const requestId = `req_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;

    // Log the API call
    logger.info(`Making OpenAI API call for qualitative chat:`, {
      userId,
      requestId,
      model: MODELS.QUALITATIVE_CHAT,
      messageCount: context.messages.length,
      timestamp: new Date().toISOString()
    });

    try {
      // Call OpenAI chat with the qualitative model
      const chatStream = chatWithAI(context.messages, MODELS.QUALITATIVE_CHAT);

      // Track full response for saving
      let fullResponse = '';
      let isFirstChunk = true;

      // Process each chunk
      for await (const chunk of chatStream) {
        logger.debug(`Processing chat chunk:`, {
          requestId,
          chunkSize: chunk.response?.length || 0,
          isError: !!chunk.error,
          isFirstChunk,
          timestamp: new Date().toISOString()
        });

        // Check for errors
        if (chunk.error) {
          logger.error(`Error in chat stream chunk:`, {
            requestId,
            error: chunk.error,
            timestamp: new Date().toISOString()
          });
          yield { error: chunk.error, streaming: false };
          return;
        }

        // If chunk has content, accumulate it
        if (chunk.response) {
          fullResponse += chunk.response;
          yield { response: chunk.response, streaming: true };
        }

        isFirstChunk = false;
      }

      // Signal end of streaming
      yield { response: '', streaming: false };

      // Save the conversation only if we have a valid userId and there was a response
      if (userId && fullResponse.trim()) {
        try {
          const conversationData = [
            { role: 'user' as const, content: userQuery },
            { role: 'assistant' as const, content: fullResponse }
          ];

          // Insert as qualitative log
          const userIdNum = typeof userId === 'string' ? parseInt(userId, 10) : userId;
          if (isNaN(userIdNum)) {
            throw new Error('Invalid user ID format');
          }

          await db
            .insert(qualitativeLogs)
            .values({
              userId: userIdNum,
              content: JSON.stringify(conversationData),
              type: 'chat',
              tags: ['ai_conversation'],
              metadata: {
                savedAt: new Date().toISOString(),
                model: MODELS.QUALITATIVE_CHAT,
                requestId,
                messageCount: conversationData.length,
                totalLength: fullResponse.length
              }
            });
        } catch (dbError) {
          logger.error(`Failed to save chat log:`, {
            requestId,
            error: dbError instanceof Error ? dbError.message : String(dbError),
            timestamp: new Date().toISOString()
          });
        }
      }

    } catch (streamError) {
      logger.error(`Stream processing error:`, {
        requestId,
        error: streamError instanceof Error ? streamError.message : String(streamError),
        stack: streamError instanceof Error ? streamError.stack : undefined,
        timestamp: new Date().toISOString()
      });
      yield { error: 'Error processing chat stream', streaming: false };
    }
  } catch (error) {
    logger.error('Error in qualitative chat service:', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      userId,
      timestamp: new Date().toISOString()
    });
    yield { error: 'Error in qualitative chat service', streaming: false };
  }
}