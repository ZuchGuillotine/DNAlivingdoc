import { openai, MODELS } from '../openai';
import { db } from '../../db';
import { qualitativeLogs, queryChats } from '../../db/schema';
import { constructQueryContext } from './llmContextService_query';
import { debugContext } from '../utils/contextDebugger';
import { checkUserLLMLimit } from '../utils/userLimits';

export async function* queryWithAI(messages: Array<{ role: string; content: string }>, userId: string | null) {
  try {
    const userQuery = messages[messages.length - 1].content;
    const userIdNum = userId ? parseInt(userId) : null;
    
    // Check user limits if we have a valid user ID
    if (userIdNum !== null) {
      const limitStatus = await checkUserLLMLimit(userIdNum);
      
      // If user has reached their limit and is on trial, inform them
      if (limitStatus.hasReachedLimit && limitStatus.isOnTrial) {
        console.log('User reached daily query limit:', {
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
    
    const context = await constructQueryContext(userIdNum, userQuery);
    await debugContext(userId || 'anonymous', context, 'query');

    const requestId = `query_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;

    console.log('Processing query with OpenAI:', {
      requestId,
      userId,
      userIdType: typeof userId,
      messageCount: context.messages.length,
      isAuthenticated: !!userId,
      model: MODELS.QUERY_CHAT,
      timestamp: new Date().toISOString()
    });

    try {
      console.log('Using query chat model:', {
        requestId,
        model: MODELS.QUERY_CHAT,
        modelName: "o3-mini",
        isAuthenticated: !!userId,
        timestamp: new Date().toISOString()
      });

      const stream = await openai.chat.completions.create({
        model: MODELS.QUERY_CHAT,
        messages: context.messages,
        max_completion_tokens: 1000,
        stream: true
      });

      let fullResponse = "";

      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content || "";

        if (content) {
          console.log('Processing stream chunk:', {
            requestId,
            contentLength: content.length,
            preview: content.substring(0, 30),
            timestamp: new Date().toISOString()
          });

          fullResponse += content;
          yield { response: content, streaming: true };
        }
      }

      if (userId) {
        try {
          await db.insert(queryChats).values({
            userId: parseInt(userId),
            messages: [
              { role: 'user', content: userQuery },
              { role: 'assistant', content: fullResponse }
            ],
            metadata: {
              savedAt: new Date().toISOString(),
              queryType: 'supplement_info',
              model: MODELS.QUERY_CHAT
            }
          });

          console.log('Saved query chat:', {
            requestId,
            userId,
            timestamp: new Date().toISOString()
          });
        } catch (saveError) {
          console.error("Failed to save query:", {
            requestId,
            error: saveError instanceof Error ? saveError.message : String(saveError),
            stack: saveError instanceof Error ? saveError.stack : undefined,
            timestamp: new Date().toISOString()
          });
        }
      }

      console.log('OpenAI query completed:', {
        requestId,
        userId,
        responseLength: fullResponse.length,
        timestamp: new Date().toISOString()
      });

      yield { response: "", streaming: false };

    } catch (streamError) {
      console.error("OpenAI stream error:", {
        requestId,
        error: streamError instanceof Error ? streamError.message : 'Unknown error',
        stack: streamError instanceof Error ? streamError.stack : undefined,
        userId,
        timestamp: new Date().toISOString()
      });

      yield { 
        error: streamError instanceof Error ? streamError.message : "Error connecting to AI service", 
        streaming: false 
      };
    }
  } catch (error) {
    console.error("OpenAI query error:", {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      userId,
      timestamp: new Date().toISOString()
    });

    yield { 
      error: "I'm having trouble understanding your question right now. Please try again in a moment.",
      streaming: false 
    };
  }
}