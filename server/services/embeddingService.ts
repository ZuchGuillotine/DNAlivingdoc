import { openai } from '../openai';
import logger from '../utils/logger';
import { LRUCache } from 'lru-cache';
import { db } from '../../db';
import { logEmbeddings, summaryEmbeddings, logSummaries, qualitativeLogs, supplementLogs, supplements, labResults } from '../../db/schema';
import { and, eq, sql, desc, notInArray, gte } from 'drizzle-orm';

class EmbeddingService {
  // Constants
  private EMBEDDING_MODEL = "text-embedding-ada-002";
  private EMBEDDING_DIMENSIONS = 1536;
  private BATCH_SIZE = 5; // Number of items to process in a batch
  private SIMILARITY_THRESHOLD = 0.75; // Cosine similarity threshold

  // LRU Cache for embeddings
  private embeddingCache: LRUCache<string, number[]>;

  constructor() {
    // Initialize cache with TTL of 1 day and max size of 500 entries
    this.embeddingCache = new LRUCache({
      max: 500,
      ttl: 1000 * 60 * 60 * 24, // 24 hours
      allowStale: false
    });

    logger.info('Embedding service initialized with LRU cache');
  }

  /**
   * Initialize the embedding service
   * Verifies OpenAI connection and database setup
   * @returns Promise<boolean> indicating initialization success
   */
  async initialize(testQuery?: string): Promise<boolean> {
    try {
      logger.info('Initializing EmbeddingService...');

      // Verify OpenAI connectivity with a test embedding
      const testText = testQuery || "Test embedding service initialization";
      const testEmbedding = await this.generateEmbedding(testText);

      if (!testEmbedding || testEmbedding.length !== this.EMBEDDING_DIMENSIONS) {
        logger.error('Test embedding generation failed: incorrect dimensions');
        return false;
      }

      logger.info('EmbeddingService initialized successfully');
      return true;
    } catch (error) {
      logger.error('EmbeddingService initialization failed:', error);
      return false;
    }
  }

  /**
   * Generate an embedding for a text string with caching
   */
  async generateEmbedding(text: string): Promise<number[]> {
    try {
      // Create a cache key - use a hash of the text to avoid key size issues
      const cacheKey = this.hashText(text);

      // Check cache first
      const cachedEmbedding = this.embeddingCache.get(cacheKey);
      if (cachedEmbedding) {
        logger.debug('Cache hit for embedding', {
          textLength: text.length,
          textPreview: text.substring(0, 50) + '...'
        });
        return cachedEmbedding;
      }

      // Not in cache, generate embedding
      logger.debug('Cache miss, generating embedding', {
        textLength: text.length
      });

      const response = await openai.embeddings.create({
        model: this.EMBEDDING_MODEL,
        input: text
      });

      const embedding = response.data[0].embedding;

      // Store in cache
      this.embeddingCache.set(cacheKey, embedding);

      return embedding;
    } catch (error) {
      logger.error('Error generating embedding:', {
        error: error instanceof Error ? error.message : String(error),
        text: text.substring(0, 100) + '...'
      });
      throw error;
    }
  }

  /**
   * Generate a simple hash of text for cache keys
   */
  private hashText(text: string): string {
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
      const char = text.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return 'emb_' + Math.abs(hash).toString(36);
  }

  /**
   * Create an embedding for a qualitative log and store it
   */
  async createLogEmbedding(logId: number, content: string, logType: 'qualitative' | 'quantitative'): Promise<void> {
    try {
      // Check if embedding already exists
      const existingEmbedding = await db
        .select()
        .from(logEmbeddings)
        .where(
          and(
            eq(logEmbeddings.logId, logId),
            eq(logEmbeddings.logType, logType)
          )
        )
        .limit(1);

      if (existingEmbedding.length > 0) {
        logger.debug(`Embedding already exists for ${logType} log ${logId}`);
        return;
      }

      const embedding = await this.generateEmbedding(content);

      await db.insert(logEmbeddings).values({
        logId,
        logType,
        embedding
      });

      logger.info(`Created embedding for ${logType} log ${logId}`);
    } catch (error) {
      logger.error(`Failed to create embedding for ${logType} log ${logId}:`, error);
      throw error;
    }
  }

  /**
   * Create an embedding for a summary and store it
   */
  async createSummaryEmbedding(summaryId: number, content: string): Promise<void> {
    try {
      // Check if embedding already exists
      const existingEmbedding = await db
        .select()
        .from(summaryEmbeddings)
        .where(eq(summaryEmbeddings.summaryId, summaryId))
        .limit(1);

      if (existingEmbedding.length > 0) {
        logger.debug(`Embedding already exists for summary ${summaryId}`);
        return;
      }

      const embedding = await this.generateEmbedding(content);

      await db.insert(summaryEmbeddings).values({
        summaryId,
        embedding
      });

      logger.info(`Created embedding for summary ${summaryId}`);
    } catch (error) {
      logger.error(`Failed to create embedding for summary ${summaryId}:`, error);
      throw error;
    }
  }

  async findSimilarContent(query: string, userId: number, limit: number = 5): Promise<any[]> {
    try {
      logger.info(`Finding similar content for user ${userId} with query: "${query.substring(0, 50)}..."`);

      // Generate embedding for the query
      const queryEmbedding = await this.generateEmbedding(query);
      logger.info(`Generated embedding for query with dimensions: ${queryEmbedding.length}`);

      // First, try vector search with proper casting for similarity search
      let similarContent = [];

      try {
        // pgvector expects '[1,2,3]' string format for query vectors
        const vectorStr = `[${queryEmbedding.join(',')}]`;

        // Query for similar summaries with proper type casting
        const similarSummariesResult = await db.execute(sql`
          SELECT 
            summary_id, 
            NULL as log_id,
            NULL as log_type,
            1 - (embedding <=> ${vectorStr}::vector(1536)) as similarity
          FROM 
            summary_embeddings
          JOIN 
            log_summaries ON summary_id = log_summaries.id
          WHERE 
            log_summaries.user_id = ${userId}
          ORDER BY 
            embedding <=> ${vectorStr}::vector(1536)
          LIMIT ${limit}
        `);

        // Query for similar logs with proper type casting
        const similarLogsResult = await db.execute(sql`
          SELECT 
            NULL as summary_id,
            log_id, 
            log_type,
            1 - (embedding <=> ${vectorStr}::vector(1536)) as similarity
          FROM 
            log_embeddings
          WHERE 
            EXISTS (
              SELECT 1 FROM qualitative_logs 
              WHERE qualitative_logs.id = log_id AND qualitative_logs.user_id = ${userId}
            )
          ORDER BY 
            embedding <=> ${vectorStr}::vector(1536)
          LIMIT ${limit}
        `);

        // Process results - ensuring they're array-like
        const summaries = Array.isArray(similarSummariesResult) 
          ? similarSummariesResult 
          : (similarSummariesResult.rows || []);

        const logs = Array.isArray(similarLogsResult)
          ? similarLogsResult
          : (similarLogsResult.rows || []);

        // Combine and sort by similarity
        similarContent = [...summaries, ...logs]
          .sort((a, b) => (b.similarity - a.similarity))
          .filter(item => item.similarity > this.SIMILARITY_THRESHOLD)
          .slice(0, limit);

        logger.info(`Vector search successful: found ${similarContent.length} relevant items`);
      } catch (vectorError) {
        // Log the vector search error but continue with fallback
        logger.error('Vector search failed, using fallback method:', {
          error: vectorError instanceof Error ? vectorError.message : String(vectorError),
          stack: vectorError instanceof Error ? vectorError.stack : undefined
        });

        // Fall back to recent content if vector search fails
        similarContent = await this.getFallbackContent(userId, limit);
      }

      // Enrich content with actual data from database
      return await this.enrichContentWithData(similarContent, userId);
    } catch (error) {
      logger.error('Error finding similar content:', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        userId,
        timestamp: new Date().toISOString()
      });
      return [];
    }
  }

  // New fallback method to get recent content when vector search fails
  private async getFallbackContent(userId: number, limit: number): Promise<any[]> {
    try {
      logger.info(`Using fallback content retrieval for user ${userId}`);

      // Get recent summaries
      const recentSummaries = await db
        .select({
          id: logSummaries.id,
          content: logSummaries.content,
          summaryType: logSummaries.summaryType,
          startDate: logSummaries.startDate,
          endDate: logSummaries.endDate
        })
        .from(logSummaries)
        .where(eq(logSummaries.userId, userId))
        .orderBy(desc(logSummaries.createdAt))
        .limit(limit);

      // Get recent qualitative logs (non-query type)
      const recentLogs = await db
        .select({
          id: qualitativeLogs.id,
          type: qualitativeLogs.type
        })
        .from(qualitativeLogs)
        .where(
          and(
            eq(qualitativeLogs.userId, userId),
            notInArray(qualitativeLogs.type, ['query'])
          )
        )
        .orderBy(desc(qualitativeLogs.createdAt))
        .limit(limit);

      // Format to match vector search results
      const formattedSummaries = recentSummaries.map(summary => ({
        summary_id: summary.id,
        log_id: null,
        log_type: null,
        similarity: 0.8 // Default similarity for fallback content
      }));

      const formattedLogs = recentLogs.map(log => ({
        summary_id: null,
        log_id: log.id,
        log_type: 'qualitative',
        similarity: 0.7 // Slightly lower default similarity than summaries
      }));

      // Combine and return
      return [...formattedSummaries, ...formattedLogs].slice(0, limit);
    } catch (error) {
      logger.error('Fallback content retrieval failed:', error);
      return [];
    }
  }

  // New helper to enrich content with actual data
  /**
   * Create an embedding for a lab result summary
   */
  async createLabEmbedding(labId: number, content: string): Promise<void> {
    try {
      // Generate embedding for the lab summary
      const embedding = await this.generateEmbedding(content);

      // Update the lab result with the embedding
      await db.update(labResults)
        .set({
          metadata: {
            ...(await db.select().from(labResults).where(eq(labResults.id, labId)).limit(1))[0]?.metadata,
            embedding
          }
        })
        .where(eq(labResults.id, labId));

      logger.info(`Created embedding for lab result ${labId}`);
    } catch (error) {
      logger.error(`Failed to create embedding for lab result ${labId}:`, error);
      throw error;
    }
  }

  /**
   * Find lab results similar to the query
   */
  async findSimilarLabContent(userId: number, query: string, limit: number = 3): Promise<any[]> {
    try {
      // Generate embedding for the query
      const queryEmbedding = await this.generateEmbedding(query);

      // First try vector search if metadata has embeddings
      const userLabResults = await db
        .select()
        .from(labResults)
        .where(eq(labResults.userId, userId));

      // Filter lab results that have embeddings
      const labsWithEmbeddings = userLabResults.filter(
        lab => lab.metadata && lab.metadata.embedding
      );

      if (labsWithEmbeddings.length > 0) {
        // Calculate similarity scores
        const scoredLabs = labsWithEmbeddings.map(lab => {
          // Calculate cosine similarity
          const similarity = this.calculateCosineSimilarity(
            queryEmbedding,
            lab.metadata.embedding
          );

          return {
            ...lab,
            similarity
          };
        });

        // Sort by similarity and take top results
        return scoredLabs
          .sort((a, b) => b.similarity - a.similarity)
          .filter(lab => lab.similarity > this.SIMILARITY_THRESHOLD)
          .slice(0, limit);
      }

      // If no embeddings found, return empty array
      return [];
    } catch (error) {
      logger.error(`Error finding similar lab content:`, error);
      return [];
    }
  }

  /**
   * Calculate cosine similarity between two vectors
   */
  private calculateCosineSimilarity(vecA: number[], vecB: number[]): number {
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < vecA.length; i++) {
      dotProduct += vecA[i] * vecB[i];
      normA += vecA[i] * vecA[i];
      normB += vecB[i] * vecB[i];
    }

    normA = Math.sqrt(normA);
    normB = Math.sqrt(normB);

    if (normA === 0 || normB === 0) {
      return 0;
    }

    return dotProduct / (normA * normB);
  }

  private async enrichContentWithData(contentItems: any[], userId: number): Promise<any[]> {
    const result = [];

    for (const item of contentItems) {
      try {
        if (item.summary_id) {
          // It's a summary
          const [summary] = await db
            .select()
            .from(logSummaries)
            .where(eq(logSummaries.id, item.summary_id))
            .limit(1);

          if (summary) {
            result.push({
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
              result.push({
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
              result.push({
                ...log,
                similarity: item.similarity,
                type: 'quantitative_log'
              });
            }
          }
        }
      } catch (itemError) {
        logger.error(`Error enriching content item:`, {
          error: itemError instanceof Error ? itemError.message : String(itemError),
          itemId: item.summary_id || item.log_id,
          itemType: item.summary_id ? 'summary' : item.log_type
        });
        // Continue with other items
      }
    }

    return result;
  }
}

const embeddingService = new EmbeddingService();
export { embeddingService, EmbeddingService as initialize };
export default embeddingService;
