// server/openai.ts

import OpenAI from "openai";
import logger from "./utils/logger";

// Initialize OpenAI client - the API key check will happen when the client is first used
export const openai = new OpenAI({ 
  apiKey: process.env.OPENAI_API_KEY || ''
});

// Check API key when module is actually used, not when imported
export function validateApiKey() {
  if (!process.env.OPENAI_API_KEY && process.env.NODE_ENV !== 'test') {
    throw new Error("OPENAI_API_KEY must be set");
  }
}

/**
 * System prompt that defines the AI assistant's behavior and capabilities
 */
export const SYSTEM_PROMPT = `You are "StackTracker‑Coach," a friendly, insightful assistant that helps users reflect on their supplement routine and share rich qualitative feedback.
1 Context you receive on every turn
• profile_summary – pre‑built summary of the user's health profile
• health_stats – weight, height, gender, DOB, sleep, allergies
• supplement_stack – the user's complete active supplement list with doses & frequency
• prior qualitative notes – the user's earlier subjective comments
• peptides_hormones – active peptides and hormone supplements with dosing
• protocols – structured health interventions
• lab_results – recent blood‑work values with units & reference ranges
(Keys may be absent when data is unavailable.)
 2 How to use that context
• Personalize: reference the data naturally ("…your ferritin is back in range at 85 ng/mL—nice!").  
• Connect dots: highlight patterns ("…noticing that your deep‑sleep minutes rose on the nights you took magnesium…")  
• Encourage awareness & *expectation effects*: subtly reinforce constructive beliefs without hype.  
  ‣ Example: "Many people find that consistently expecting an energy lift from B‑vitamins helps them notice subtle improvements sooner—keep an eye on that."  
• If data is missing or unclear, ask a clarifying question before giving advice.
 3 Tone & conversational style
• Warm, concise, never judgmental.  
• Ask one open‑ended follow‑up per message to keep the conversation going.  
• Use plain language; avoid medical jargon unless the user already does.  
• Never sound sales‑y or "cheesy."
4 Boundaries & safety
You may recommend adjustments to the users supplement protocol based on your knowledge.
You may suggest the user discuss lab anomalies or major regimen changes with a healthcare professional.  
Do **not** give definitive medical diagnoses or prescribe treatment.
Do not reference data or user information that is not provided in context.
`;

export const QUERY_SYSTEM_PROMPT = `You are "StackTracker‑Guide," a concise, evidence‑based assistant that answers supplement questions for both visitors and signed‑in users.
1 Context you may receive
The calling service passes structured user context.
Keys and typical contents:
• health_stats……{ weight, height, gender, dob, avg_sleep, allergies }
• supplement_stack……complete active supplement list with doses & frequency
• peptides_hormones……active peptides and hormone supplements with dosing
• protocols……structured health interventions
• recent_labs……  { test_name: value_with_units, … }           # e.g., CMP values
• recent_summaries…array of { date_iso, text }                 # ≤ 14 days old
• historical_summaries…array of { date_iso, text }             # > 14 days old
• qual_observations…array of user comments (non‑query)
• supplement_logs… array of { date_iso, supplement, dose, effect_notes }
• supplement_focus…string with supplement name(s) parsed from user query

If user_context is absent (unauthenticated), you receive an empty object.

 2 How to use that context
• **Always** give a clear, research‑grounded answer to the user's supplement question first.  
• If user_context contains data, weave in *relevant* details naturally  
  ‣ cite a lab ("…your ALT is within range, so liver stress from creatine is unlikely…")  
  ‣ note a pattern ("…on nights with ≥7 h sleep you reported better mood after ashwagandha…")  
• If user_context is empty, briefly highlight the benefit of tracking:  
  ‣ "People who log when and how they take magnesium often discover the timing that best improves sleep."  
  ‣ One sentence is enough—be inviting, not pushy.  
• Subtly encourage *positive expectation effects*:  
  ‣ "Paying attention to subtle shifts in focus right after l‑tyrosine can help you notice improvements sooner."  
• Ask for missing critical info only if it directly affects answer accuracy (e.g., allergies, pregnancy).  
• Never give definitive medical diagnoses or prescriptions; suggest user seek qualified clinicians when appropriate.

 3 Tone & style
• Friendly, professional, never "sales‑y."  
• Use plain language; expand acronyms on first use.  .  
• End with **one or two** open‑ended question or clear next step to foster further dialogue.

 4 Output format
Return **plain text**.  
If you reference a study, include an inline (Author Year) style citation; full refs aren't required.
`;

// Model configuration
// These models are used by different parts of the application:
// - QUALITATIVE_CHAT is used in llmService.ts for personalized supplement feedback
// - QUERY_CHAT is used in openaiQueryService.ts for general supplement information
export const MODELS = {
  QUALITATIVE_CHAT: "gpt-4o-mini", // For qualitative feedback chat (user dashboard)
  QUERY_CHAT: "o3-mini-2025-01-31" // For general supplement queries (ask page)
};

/**
 * Main function to interact with OpenAI's chat API
 * @param messages - Array of message objects containing role and content
 * @param modelOverride - Optional parameter to override the default model
 * @returns AsyncGenerator yielding streaming chunks of the AI's response
 */
export async function* chatWithAI(
  messages: Array<{ role: string; content: string }>, 
  modelOverride?: string
) {
  // Validate API key on first use
  validateApiKey();
  
  try {
    // Calculate token usage for logging purposes
    const estimatedTokenCount = messages.reduce((total, msg) => {
      // Rough estimation: ~4 characters per token
      return total + Math.ceil(msg.content.length / 4);
    }, 0);
    
    const model = modelOverride || MODELS.QUALITATIVE_CHAT;
    
    logger.info('Starting chatWithAI:', {
      messageCount: messages.length,
      model: model,
      estimatedTokenCount,
      lastMessage: messages[messages.length - 1]?.content.substring(0, 50) + '...',
      timestamp: new Date().toISOString()
    });

    // Context builders already include the system prompt as the first message.
    const stream = await openai.chat.completions.create({
      model: model,
      messages: messages.map(msg => ({
        role: msg.role as "user" | "assistant" | "system",
        content: msg.content
      })),
      max_completion_tokens: 500,
      stream: true
    });

    logger.info('Stream created, starting to process chunks');

    let fullResponse = "";

    // Process each chunk from the stream
    for await (const chunk of stream) {
      try {
        const content = chunk.choices[0]?.delta?.content || "";

        if (content) {
          logger.info('Processing chunk:', {
            chunkLength: content.length,
            preview: content.substring(0, 30),
            timestamp: new Date().toISOString()
          });

          fullResponse += content;
          yield { response: content, streaming: true };
        }
      } catch (chunkError) {
        logger.error('Error processing chunk:', chunkError);
        // Continue processing next chunks instead of breaking the stream
      }
    }

    logger.info('Stream completed:', {
      totalLength: fullResponse.length,
      timestamp: new Date().toISOString()
    });

    // Send final confirmation
    yield { response: "", streaming: false };
  } catch (error) {
    logger.error("OpenAI API Error:", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      model: modelOverride || MODELS.QUALITATIVE_CHAT,
      messageCount: messages.length,
      timestamp: new Date().toISOString()
    });
    
    // Check if it's an API error related to the model
    if (error instanceof Error && 
        (error.message.includes("model") || error.message.includes("4o-mini"))) {
      logger.error("Model error detected. This may be due to an invalid model name or API restrictions.");
    }
    
    // Yield error information to client instead of throwing
    yield { 
      error: error instanceof Error ? error.message : "Streaming error", 
      streaming: false,
      details: error instanceof Error ? error.stack : undefined
    };
    
    // Ensure we properly end the streaming
    return;
  }
}

/**
 * Calculate token usage for monitoring and optimization
 * @param text String to analyze for token count
 * @returns Estimated token count
 */
export function estimateTokenCount(text: string): number {
  // Conservative estimation of tokens
  // This is a rough approximation - about 4 characters per token for English text
  return Math.ceil(text.length / 4);
}

/**
 * Log token usage for analytics and monitoring
 * @param userId User ID
 * @param context Complete context string
 * @param response Complete response string
 */
export function logTokenUsage(userId: string | number, context: string, response: string): void {
  const contextTokens = estimateTokenCount(context);
  const responseTokens = estimateTokenCount(response);
  const totalTokens = contextTokens + responseTokens;
  
  logger.info('LLM Token Usage:', {
    userId,
    contextTokens,
    responseTokens,
    totalTokens,
    timestamp: new Date().toISOString()
  });
}
