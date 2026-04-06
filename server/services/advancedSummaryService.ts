// server/services/advancedSummaryService.ts (summmarizes quantitative logs)

import OpenAI from "openai";
import { db } from "../../db";
import { logSummaries, qualitativeLogs, supplementLogs, supplements, InsertLogSummary } from "../../db/schema";
import embeddingService from "./embeddingService";
import { eq, and, between, sql, gte, desc } from "drizzle-orm";
import logger from "../utils/logger";

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

/**
 * Improved summary service that consolidates logs using OpenAI
 */
class AdvancedSummaryService {
  // Constants for summarization
  private SUMMARY_MODEL = "gpt-4o-mini";
  private MAX_TOKEN_LIMIT = 16000; // Conservative token limit for input context
  private MAX_LOGS_PER_REQUEST = 50; // Maximum number of logs to summarize in one request

  // System prompt for daily summarization
  private DAILY_SUMMARY_PROMPT = `
  You are an expert supplement analyst tasked with summarizing a user's daily supplement logs and qualitative experiences.

  Guidelines:
  1. Focus ONLY on significant changes or notable experiences (new supplements, dosage changes, unique effects)
  2. Consolidate redundant information and eliminate repetition
  3. Highlight correlations between supplement intake and reported effects
  4. Include both quantitative data (supplements taken) and qualitative observations
  5. Organize information clearly with timestamps where relevant
  6. Maintain medical accuracy and precision in summarizing health information
  7. Keep the summary concise but comprehensive, focusing on changes and patterns

  Your summary should help the user understand their supplement regimen's effects and changes over time.
  `;

  private SUPPLEMENT_SUMMARY_PROMPT = `
You are analyzing a user's supplement intake patterns. Focus on:
1. Regular supplement intake patterns (frequency, dosage)
2. Changes in supplement regimen (dosage changes, starting/stopping)
3. Notable effects or side effects
4. Interactions between supplements

Create a concise summary that highlights:
- Current supplement regimen
- Recent changes (within 7 days)
- Consistent patterns
- Notable effects

Eliminate redundant daily entries and focus on meaningful changes or patterns.`;

  /**
   * Generates summary for a single day's logs
   * @param userId User ID
   * @param date Date to summarize
   * @returns The created summary ID
   */
  async generateDailySummary(userId: number, date: Date): Promise<number | null> {
    try {
      // Set date boundaries to ensure we get all logs for the specified date
      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);

      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);

      logger.info(`Generating daily summary for user ${userId} on ${date.toISOString().split('T')[0]}`);

      // Fetch all supplement logs for the day
      const supplementLogEntries = await db
        .select({
          id: supplementLogs.id,
          supplementId: supplementLogs.supplementId,
          supplementName: supplements.name,
          dosage: supplements.dosage,
          frequency: supplements.frequency,
          takenAt: supplementLogs.takenAt,
          notes: supplementLogs.notes,
          effects: supplementLogs.effects
        })
        .from(supplementLogs)
        .leftJoin(supplements, eq(supplements.id, supplementLogs.supplementId))
        .where(
          and(
            eq(supplementLogs.userId, userId),
            between(supplementLogs.takenAt, startOfDay, endOfDay)
          )
        );

      // Fetch all qualitative logs for the day
      const qualitativeLogEntries = await db
        .select()
        .from(qualitativeLogs)
        .where(
          and(
            eq(qualitativeLogs.userId, userId),
            between(qualitativeLogs.loggedAt, startOfDay, endOfDay)
          )
        );

      // Check if we have enough data to summarize
      if (supplementLogEntries.length === 0 && qualitativeLogEntries.length === 0) {
        logger.info(`No logs found for user ${userId} on ${date.toISOString().split('T')[0]}`);
        return null;
      }

      // Format logs for summarization
      const formattedSupplementLogs = supplementLogEntries.map(log => {
        const timestamp = new Date(log.takenAt).toLocaleTimeString();
        const effectsText = log.effects 
          ? Object.entries(log.effects)
            .map(([key, value]) => `${key}: ${value}`)
            .join(', ')
          : 'No effects recorded';

        return `[${timestamp}] Supplement: ${log.supplementName}, Dosage: ${log.dosage}, Notes: ${log.notes || 'None'}, Effects: ${effectsText}`;
      }).join('\n');

      const formattedQualitativeLogs = qualitativeLogEntries.map(log => {
        const timestamp = new Date(log.loggedAt).toLocaleTimeString();

        // Extract chat content if available
        let content = log.content;
        try {
          // Check if content is JSON (chat history)
          const parsed = JSON.parse(log.content);
          if (Array.isArray(parsed)) {
            // Extract only user messages from chat history
            content = parsed
              .filter(msg => msg.role === 'user')
              .map(msg => msg.content)
              .join('\n');
          }
        } catch (e) {
          // Not JSON, use as is
        }

        return `[${timestamp}] ${content}`;
      }).join('\n');

      // Construct the input for the summarization model
      const dateStr = date.toISOString().split('T')[0];
      const summaryInput = `
      Date: ${dateStr}

      Supplement Logs:
      ${formattedSupplementLogs || 'No supplement logs for this day.'}

      Qualitative Experiences:
      ${formattedQualitativeLogs || 'No qualitative logs for this day.'}
      `;

      // Generate summary using OpenAI
      const completion = await openai.chat.completions.create({
        model: this.SUMMARY_MODEL,
        messages: [
          {
            role: "system",
            content: this.DAILY_SUMMARY_PROMPT
          },
          {
            role: "user",
            content: summaryInput
          }
        ],
        max_tokens: 1000
      });

      const summaryContent = completion.choices[0]?.message?.content?.trim() || 'No summary generated.';

      // Store summary in database
      const [summary] = await db
        .insert(logSummaries)
        .values({
          userId,
          content: summaryContent,
          summaryType: 'daily',
          startDate: startOfDay,
          endDate: endOfDay,
          metadata: {
            supplementCount: supplementLogEntries.length,
            qualitativeLogCount: qualitativeLogEntries.length,
            // Extract any significant changes mentioned in the summary
            significantChanges: this.extractSignificantChanges(summaryContent)
          }
        })
        .returning();

      // Create embedding for the summary
      if (summary) {
        await embeddingService.createSummaryEmbedding(summary.id, summaryContent);
      }

      logger.info(`Generated daily summary for user ${userId} on ${dateStr} with ID ${summary?.id}`);
      return summary?.id || null;

    } catch (error) {
      logger.error(`Error generating daily summary for user ${userId}:`, error);
      return null;
    }
  }

  /**
   * Generate weekly summary from daily summaries
   * @param userId User ID
   * @param startDate Start date of the week
   * @param endDate End date of the week
   * @returns The created summary ID
   */
  async generateWeeklySummary(userId: number, startDate: Date, endDate: Date): Promise<number | null> {
    try {
      // Fetch all daily summaries for the week
      const dailySummaries = await db
        .select()
        .from(logSummaries)
        .where(
          and(
            eq(logSummaries.userId, userId),
            eq(logSummaries.summaryType, 'daily'),
            between(logSummaries.startDate, startDate, endDate)
          )
        )
        .orderBy(logSummaries.startDate);

      if (dailySummaries.length === 0) {
        logger.info(`No daily summaries found for user ${userId} between ${startDate.toISOString()} and ${endDate.toISOString()}`);
        return null;
      }

      // Construct input for weekly summarization
      const weeklyInput = dailySummaries.map(summary => {
        const date = summary.startDate.toISOString().split('T')[0];
        return `Date: ${date}\n${summary.content}`;
      }).join('\n\n');

      // Weekly summarization prompt
      const weeklyPrompt = `
      You are tasked with creating a weekly summary of a user's supplement regimen and experiences.

      Guidelines:
      1. Identify patterns, trends, and correlations across the week
      2. Highlight significant changes that occurred during the week
      3. Note any consistent effects or experiences from specific supplements
      4. Summarize overall adherence to the supplement regimen
      5. Focus on the most important information, eliminating redundancy
      6. Organize the summary in a clear, readable format

      The input contains daily summaries - create a concise weekly overview.
      `;

      // Generate summary using OpenAI
      const completion = await openai.chat.completions.create({
        model: this.SUMMARY_MODEL,
        messages: [
          {
            role: "system",
            content: weeklyPrompt
          },
          {
            role: "user",
            content: weeklyInput
          }
        ],
        max_tokens: 1000
      });

      const summaryContent = completion.choices[0]?.message?.content?.trim() || 'No summary generated.';

      // Store weekly summary
      const [summary] = await db
        .insert(logSummaries)
        .values({
          userId,
          content: summaryContent,
          summaryType: 'weekly',
          startDate,
          endDate,
          metadata: {
            dailySummaryCount: dailySummaries.length,
            significantChanges: this.extractSignificantChanges(summaryContent)
          }
        })
        .returning();

      // Create embedding for the summary
      if (summary) {
        await embeddingService.createSummaryEmbedding(summary.id, summaryContent);
      }

      logger.info(`Generated weekly summary for user ${userId} from ${startDate.toISOString().split('T')[0]} to ${endDate.toISOString().split('T')[0]} with ID ${summary?.id}`);
      return summary?.id || null;

    } catch (error) {
      logger.error(`Error generating weekly summary for user ${userId}:`, error);
      return null;
    }
  }

  /**
   * Extracts significant changes mentioned in a summary
   */
  private extractSignificantChanges(summary: string): string[] {
    const changes: string[] = [];

    // Look for indicators of significant changes
    const changeIndicators = [
      'increased', 'decreased', 'started', 'stopped', 'changed',
      'new supplement', 'dosage change', 'notable', 'significant',
      'improvement', 'worsening', 'side effect'
    ];

    // Extract sentences containing change indicators
    const sentences = summary.split(/[.!?]\s+/);
    for (const sentence of sentences) {
      if (changeIndicators.some(indicator => sentence.toLowerCase().includes(indicator))) {
        // Clean up the sentence and add to changes
        const cleanSentence = sentence.trim().replace(/^\s*[-•]\s*/, '');
        if (cleanSentence && !changes.includes(cleanSentence)) {
          changes.push(cleanSentence);
        }
      }
    }

    return changes;
  }

  /**
   * Process daily summaries for all users for a specific date
   * @param date Date to process
   */
  async processDailySummaries(date: Date = new Date()): Promise<void> {
    try {
      // Get all users with logs on the specified date
      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);

      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);

      // Find users with logs on this date
      const usersWithLogs = await db.execute(sql`
        SELECT DISTINCT user_id
        FROM (
          SELECT user_id FROM supplement_logs 
          WHERE taken_at BETWEEN ${startOfDay} AND ${endOfDay}
          UNION
          SELECT user_id FROM qualitative_logs 
          WHERE logged_at BETWEEN ${startOfDay} AND ${endOfDay}
        ) AS logs
      `);

      logger.info(`Found ${usersWithLogs.length} users with logs on ${date.toISOString().split('T')[0]}`);

      // Process each user
      for (const user of usersWithLogs) {
        const userId = user.user_id;
        
        // Check if summary already exists for this user and date
        const existingSummary = await db
          .select()
          .from(logSummaries)
          .where(
            and(
              eq(logSummaries.userId, userId),
              eq(logSummaries.summaryType, 'daily'),
              between(logSummaries.startDate, startOfDay, endOfDay)
            )
          )
          .limit(1);
          
        if (existingSummary.length > 0) {
          logger.info(`Daily summary already exists for user ${userId} on ${date.toISOString().split('T')[0]}`);
          continue;
        }
        
        // Generate daily summary
        await this.generateDailySummary(userId, date);
      }
      
      logger.info(`Completed daily summary processing for ${date.toISOString().split('T')[0]}`);
    } catch (error) {
      logger.error(`Error processing daily summaries for ${date.toISOString().split('T')[0]}:`, error);
    }
  }
  
  /**
   * Process weekly summaries for all users
   * @param endDate End date of the week (typically Sunday)
   */
  async processWeeklySummaries(endDate: Date = new Date()): Promise<void> {
    try {
      // Calculate start of week (7 days before end date)
      const startDate = new Date(endDate);
      startDate.setDate(startDate.getDate() - 7);
      startDate.setHours(0, 0, 0, 0);
      
      // End date should be end of day
      const endOfDay = new Date(endDate);
      endOfDay.setHours(23, 59, 59, 999);
      
      // Find users with daily summaries in this period
      const usersWithSummaries = await db.execute(sql`
        SELECT DISTINCT user_id
        FROM log_summaries
        WHERE summary_type = 'daily' AND start_date BETWEEN ${startDate} AND ${endOfDay}
      `);
      
      logger.info(`Found ${usersWithSummaries.length} users with daily summaries between ${startDate.toISOString().split('T')[0]} and ${endDate.toISOString().split('T')[0]}`);
      
      // Process each user
      for (const user of usersWithSummaries) {
        const userId = user.user_id;
        
        // Check if weekly summary already exists
        const existingSummary = await db
          .select()
          .from(logSummaries)
          .where(
            and(
              eq(logSummaries.userId, userId),
              eq(logSummaries.summaryType, 'weekly'),
              between(logSummaries.startDate, startDate, endOfDay)
            )
          )
          .limit(1);
          
        if (existingSummary.length > 0) {
          logger.info(`Weekly summary already exists for user ${userId} for week ending ${endDate.toISOString().split('T')[0]}`);
          continue;
        }
        
        // Generate weekly summary
        await this.generateWeeklySummary(userId, startDate, endOfDay);
      }
      
      logger.info(`Completed weekly summary processing for week ending ${endDate.toISOString().split('T')[0]}`);
    } catch (error) {
      logger.error(`Error processing weekly summaries for week ending ${endDate.toISOString().split('T')[0]}:`, error);
    }
  }
  
  /**
   * Generate summary for a specific log entry
   * @param logId ID of the log
   * @param logType Type of log (qualitative or quantitative)
   */
  async generateLogSummary(logId: number, logType: 'qualitative' | 'quantitative'): Promise<string | null> {
    try {
      let logContent = '';
      let userId: number | null = null;
      
      if (logType === 'qualitative') {
        const [log] = await db
          .select()
          .from(qualitativeLogs)
          .where(eq(qualitativeLogs.id, logId))
          .limit(1);
          
        if (!log) {
          logger.error(`Qualitative log ${logId} not found`);
          return null;
        }
        
        logContent = log.content;
        userId = log.userId;
      } else {
        // For quantitative logs, fetch and format the data
        const [log] = await db
          .select({
            userId: supplementLogs.userId,
            takenAt: supplementLogs.takenAt,
            notes: supplementLogs.notes,
            effects: supplementLogs.effects,
            name: supplements.name,
            dosage: supplements.dosage,
            frequency: supplements.frequency
          })
          .from(supplementLogs)
          .leftJoin(supplements, eq(supplements.id, supplementLogs.supplementId))
          .where(eq(supplementLogs.id, logId))
          .limit(1);
          
        if (!log) {
          logger.error(`Quantitative log ${logId} not found`);
          return null;
        }
        
        const effectsText = log.effects 
          ? Object.entries(log.effects)
            .map(([key, value]) => `${key}: ${value}`)
            .join(', ')
          : 'No effects recorded';
          
        logContent = `Supplement: ${log.name}, Taken At: ${log.takenAt.toISOString()}, Dosage: ${log.dosage}, Frequency: ${log.frequency}, Notes: ${log.notes || 'None'}, Effects: ${effectsText}`;
        userId = log.userId;
      }
      
      if (!userId) {
        logger.error(`User ID not found for ${logType} log ${logId}`);
        return null;
      }
      
      // Generate a summary using OpenAI
      const summaryPrompt = `
      You are tasked with summarizing a single supplement log entry. Create a concise summary that captures the key information and any notable effects or observations.
      
      Input: ${logContent}
      
      Please provide a concise summary in 1-2 sentences focusing on the most relevant information.
      `;
      
      const completion = await openai.chat.completions.create({
        model: this.SUMMARY_MODEL,
        messages: [
          {
            role: "user",
            content: summaryPrompt
          }
        ],
        max_tokens: 150
      });
      
      const summary = completion.choices[0]?.message?.content?.trim() || null;
      
      // Create embedding for the log
      if (summary) {
        await embeddingService.createLogEmbedding(logId, logContent, logType);
      }
      
      return summary;
    } catch (error) {
      logger.error(`Error generating log summary for ${logType} log ${logId}:`, error);
      return null;
    }
  }
  
  /**
   * Retrieves the most relevant summaries for a user query
   * @param userId User ID
   * @param query User query text
   * @param limit Maximum number of summaries to return
   * @returns Array of relevant summaries
   */
  async getRelevantSummaries(userId: number, query: string, limit: number = 3): Promise<any[]> {
    try {
      // Use vector search to find similar summaries
      const similarContent = await embeddingService.findSimilarContent(query, userId, limit);
      
      // Fetch the full summary content for each match
      const relevantSummaries = [];
      
      for (const item of similarContent) {
        if (item.summary_id) {
          // It's a summary
          const [summary] = await db
            .select()
            .from(logSummaries)
            .where(eq(logSummaries.id, item.summary_id))
            .limit(1);
            
          if (summary) {
            relevantSummaries.push({
              ...summary,
              similarity: item.similarity,
              type: 'summary'
            });
          }
        } else if (item.log_id) {
          // It's a log
          if (item.log_type === 'qualitative') {
            const [log] = await db
              .select()
              .from(qualitativeLogs)
              .where(eq(qualitativeLogs.id, item.log_id))
              .limit(1);
              
            if (log) {
              relevantSummaries.push({
                ...log,
                similarity: item.similarity,
                type: 'qualitative_log'
              });
            }
          } else {
            // Quantitative log
            const [log] = await db
              .select({
                id: supplementLogs.id,
                userId: supplementLogs.userId,
                takenAt: supplementLogs.takenAt,
                notes: supplementLogs.notes,
                effects: supplementLogs.effects,
                name: supplements.name,
                dosage: supplements.dosage,
                frequency: supplements.frequency
              })
              .from(supplementLogs)
              .leftJoin(supplements, eq(supplements.id, supplementLogs.supplementId))
              .where(eq(supplementLogs.id, item.log_id))
              .limit(1);
              
            if (log) {
              relevantSummaries.push({
                ...log,
                similarity: item.similarity,
                type: 'quantitative_log'
              });
            }
          }
        }
      }
      
      // Sort by similarity score
      return relevantSummaries.sort((a, b) => b.similarity - a.similarity);
    } catch (error) {
      logger.error(`Error getting relevant summaries for user ${userId}:`, error);
      return [];
    }
  }

  /**
   * Generate a summary of supplement patterns and changes
   * @param userId User ID
   * @param days Number of days to analyze
   * @returns The created summary ID
   */
  async generateSupplementPatternSummary(userId: number, days: number = 7): Promise<number | null> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - days);
      
      logger.info(`Generating supplement pattern summary for user ${userId} for the last ${days} days`);
      
      // Fetch all supplement logs for the period
      const supplementLogEntries = await db
        .select({
          supplementId: supplementLogs.supplementId,
          supplementName: supplements.name,
          dosage: supplements.dosage,
          frequency: supplements.frequency,
          takenAt: supplementLogs.takenAt,
          notes: supplementLogs.notes,
          effects: supplementLogs.effects
        })
        .from(supplementLogs)
        .leftJoin(supplements, eq(supplements.id, supplementLogs.supplementId))
        .where(
          and(
            eq(supplementLogs.userId, userId),
            gte(supplementLogs.takenAt, cutoffDate)
          )
        )
        .orderBy(desc(supplementLogs.takenAt))
        .execute();

      const validLogs = supplementLogEntries.filter(log => log.takenAt !== null);
      
      if (validLogs.length === 0) {
        logger.info(`No valid supplement logs found for user ${userId} in the last ${days} days`);
        return null;
      }

      // Group logs by supplement for pattern analysis
      const supplementGroups = new Map<string, Array<(typeof validLogs)[number]>>();
      for (const log of validLogs) {
        const name = log.supplementName || 'Unknown Supplement';
        if (!supplementGroups.has(name)) {
          supplementGroups.set(name, []);
        }
        supplementGroups.get(name)!.push(log);
      }

      // Format logs for pattern analysis
      let summaryInput = 'Supplement Intake Patterns:\n\n';

      for (const [name, logs] of supplementGroups) {
        summaryInput += `${name}:\n`;
        for (const log of logs) {
          // We know takenAt is not null because we filtered earlier
          const timestamp = new Date(log.takenAt!).toLocaleDateString();
          const effectsText = log.effects 
            ? Object.entries(log.effects)
                .map(([key, value]) => `${key}: ${value}`)
                .join(', ')
            : 'No effects recorded';

          summaryInput += `[${timestamp}] Dosage: ${log.dosage || 'Not specified'}, Frequency: ${log.frequency || 'Not specified'}, Effects: ${effectsText}\n`;
        }
        summaryInput += '\n';
      }

      // Generate pattern summary using OpenAI
      const completion = await openai.chat.completions.create({
        model: this.SUMMARY_MODEL,
        messages: [
          {
            role: "system",
            content: this.SUPPLEMENT_SUMMARY_PROMPT
          },
          {
            role: "user",
            content: summaryInput
          }
        ],
        max_tokens: 1000
      });

      const summaryContent = completion.choices[0]?.message?.content?.trim() || 'No patterns identified.';

      // Store summary in database
      const summaryData: InsertLogSummary = {
        userId,
        content: summaryContent,
        summaryType: 'supplement_pattern',
        startDate: cutoffDate,
        endDate: new Date(),
        metadata: {
          supplementCount: validLogs.length,
          qualitativeLogCount: 0,
          quantitativeLogCount: 0,
          significantChanges: []
        }
      };

      const [summary] = await db
        .insert(logSummaries)
        .values(summaryData)
        .returning();

      // Create embedding for the summary
      if (summary) {
        await embeddingService.createSummaryEmbedding(summary.id, summaryContent);
      }

      logger.info(`Generated supplement pattern summary for user ${userId}`);
      return summary?.id || null;

    } catch (error) {
      logger.error(`Error generating supplement pattern summary for user ${userId}:`, error);
      return null;
    }
  }
}

// Export a singleton instance
export const advancedSummaryService = new AdvancedSummaryService();
