
// server/tests/llmContextService.test.ts

import { constructUserContext } from '../services/llmContextService';
import { constructQueryContext } from '../services/llmContextService_query';
import { db } from '@db';
import logger from '../utils/logger';
import { estimateTokenCount } from './setup';

/**
 * Test suite for the LLM Context Services
 * 
 * These tests verify the context building functionality for both
 * qualitative feedback and general query systems
 * 
 * Run tests with: npm test -- --testPathPattern=llmContextService
 */

describe('LLM Context Service Tests', () => {
  // Skip tests if database is not available
  beforeAll(async () => {
    try {
      await db.query.users.findFirst();
    } catch (error) {
      logger.error('Database not available for llmContextService tests, skipping');
      // Mark all tests to be skipped
      jest.setTimeout(0);
    }
  });

  test('Should construct user context for feedback chat', async () => {
    // Skip if no real user data is available
    const users = await db.query.users.findMany({ limit: 1 });
    if (users.length === 0) {
      logger.info('Skipping user context test - no user data available');
      return;
    }
    
    const realUserId = users[0].id.toString();
    
    // Test message for feedback
    const testMessage = "I've been taking magnesium for two weeks and notice my sleep has improved. What else should I track?";
    
    // Build context
    const context = await constructUserContext(realUserId, testMessage);
    
    // Check structure
    expect(context).toBeDefined();
    expect(context.messages).toBeDefined();
    expect(Array.isArray(context.messages)).toBe(true);
    expect(context.messages.length).toBeGreaterThan(0);
    
    // Should have user message as the last message
    const lastMessage = context.messages[context.messages.length - 1];
    expect(lastMessage.role).toBe('user');
    expect(lastMessage.content).toBe(testMessage);
    
    // Log token count for optimization tracking
    const contextString = JSON.stringify(context.messages);
    const tokens = estimateTokenCount(contextString);
    logger.info(`User context token count: ${tokens}`);
  });
  
  test('Should construct query context for supplement information', async () => {
    // Skip if no real user data is available
    const users = await db.query.users.findMany({ limit: 1 });
    if (users.length === 0) {
      logger.info('Skipping query context test - no user data available');
      return;
    }
    
    const realUserId = users[0].id;
    
    // Test query
    const testQuery = "What are the benefits of Vitamin D3 supplementation?";
    
    // Build context
    const context = await constructQueryContext(realUserId, testQuery);
    
    // Check structure
    expect(context).toBeDefined();
    expect(context.messages).toBeDefined();
    expect(Array.isArray(context.messages)).toBe(true);
    expect(context.messages.length).toBeGreaterThan(0);
    
    // Should have user query as the last message
    const lastMessage = context.messages[context.messages.length - 1];
    expect(lastMessage.role).toBe('user');
    expect(lastMessage.content).toContain(testQuery);
    
    // Log token count for optimization tracking
    const contextString = JSON.stringify(context.messages);
    const tokens = estimateTokenCount(contextString);
    logger.info(`Query context token count: ${tokens}`);
  });
  
  test('Should handle unauthenticated users for query context', async () => {
    // Build context for unauthenticated user (null userId)
    const testQuery = "What are the benefits of Vitamin D3 supplementation?";
    const context = await constructQueryContext(null, testQuery);
    
    // Check structure
    expect(context).toBeDefined();
    expect(context.messages).toBeDefined();
    expect(Array.isArray(context.messages)).toBe(true);
    expect(context.messages.length).toBeGreaterThan(0);
    
    // Should have user query as the last message
    const lastMessage = context.messages[context.messages.length - 1];
    expect(lastMessage.role).toBe('user');
    expect(lastMessage.content).toContain(testQuery);
    
    // Should NOT contain user-specific information
    const contextString = JSON.stringify(context.messages);
    expect(contextString).not.toContain('health_stats');
    expect(contextString).not.toContain('user_logs');
  });
  
  test('Should produce different contexts for different query types', async () => {
    // Skip if no real user data is available
    const users = await db.query.users.findMany({ limit: 1 });
    if (users.length === 0) {
      logger.info('Skipping context comparison test - no user data available');
      return;
    }
    
    const realUserId = users[0].id;
    const userIdString = realUserId.toString();
    
    // Feedback message and info query on the same topic
    const feedbackMessage = "I started taking Vitamin D3 and my energy has improved.";
    const infoQuery = "What are the common benefits of Vitamin D3 supplementation?";
    
    // Build both contexts
    const feedbackContext = await constructUserContext(userIdString, feedbackMessage);
    const queryContext = await constructQueryContext(realUserId, infoQuery);
    
    // Convert to strings for comparison
    const feedbackString = JSON.stringify(feedbackContext.messages);
    const queryString = JSON.stringify(queryContext.messages);
    
    // They should be different - different system prompts and context building
    expect(feedbackString).not.toEqual(queryString);
    
    // Log differences in token count
    const feedbackTokens = estimateTokenCount(feedbackString);
    const queryTokens = estimateTokenCount(queryString);
    
    logger.info(`Feedback context tokens: ${feedbackTokens}`);
    logger.info(`Query context tokens: ${queryTokens}`);
    logger.info(`Token difference: ${Math.abs(feedbackTokens - queryTokens)}`);
  });
});
import { constructUserContext } from '../services/llmContextService';
import { db } from '../../db';

// Mock the db
jest.mock('../../db', () => ({
  db: {
    select: jest.fn().mockReturnValue({
      from: jest.fn().mockReturnValue({
        where: jest.fn().mockReturnValue({
          limit: jest.fn().mockResolvedValue([])
        })
      })
    }),
    execute: jest.fn().mockResolvedValue([])
  }
}));

describe('LLM Context Service', () => {
  test('constructUserContext should return a context object with messages array', async () => {
    const userId = 1;
    const messageHistory = [
      { role: 'user', content: 'Hello' },
      { role: 'assistant', content: 'Hi there!' }
    ];
    
    const result = await constructUserContext(userId, messageHistory);
    
    expect(result).toHaveProperty('messages');
    expect(Array.isArray(result.messages)).toBe(true);
    expect(result.messages.length).toBeGreaterThan(0);
  });
  
  test('constructUserContext should handle undefined userId', async () => {
    const userId = undefined;
    const messageHistory = [
      { role: 'user', content: 'Hello' }
    ];
    
    const result = await constructUserContext(userId as any, messageHistory);
    
    expect(result).toHaveProperty('messages');
    expect(Array.isArray(result.messages)).toBe(true);
    expect(result.messages.length).toBeGreaterThan(0);
  });
});
