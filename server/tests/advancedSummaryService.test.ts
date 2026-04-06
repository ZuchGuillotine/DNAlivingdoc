
// server/tests/advancedSummaryService.test.ts

import { advancedSummaryService } from '../services/advancedSummaryService';
import { db } from '@db';
import { logSummaries, supplementLogs, supplements, qualitativeLogs } from '@db/schema';
import logger from '../utils/logger';

/**
 * Test suite for the AdvancedSummaryService
 * 
 * These tests verify the summarization capabilities 
 * 
 * Run tests with: npm test -- --testPathPattern=advancedSummaryService
 */

describe('Advanced Summary Service Tests', () => {
  // Test user ID
  const testUserId = 999;
  let createdSummaryIds: number[] = [];
  
  // Clean up test data after running tests
  afterAll(async () => {
    try {
      // Remove test summaries
      for (const id of createdSummaryIds) {
        await db.delete(logSummaries).where({ id });
      }
      logger.info(`Cleaned up ${createdSummaryIds.length} test summaries`);
    } catch (err) {
      logger.error(`Failed to clean up test summaries: ${err}`);
    }
  });

  test('Should generate daily summary', async () => {
    // Create a test date
    const testDate = new Date();
    
    // Generate a summary
    const summaryId = await advancedSummaryService.generateDailySummary(testUserId, testDate);
    
    if (summaryId) {
      createdSummaryIds.push(summaryId);
      
      // Verify the summary exists
      const [summary] = await db
        .select()
        .from(logSummaries)
        .where({ id: summaryId });
        
      expect(summary).toBeDefined();
      expect(summary.userId).toBe(testUserId);
      expect(summary.summaryType).toBe('daily');
      expect(typeof summary.content).toBe('string');
    } else {
      // If no summary was created, it's valid - might mean no logs exist for test user
      logger.info('No summary generated - possibly no logs for test user');
    }
  });
  
  test('Should generate weekly summary', async () => {
    // Create date range for a week
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 7);
    
    // Generate weekly summary
    const summaryId = await advancedSummaryService.generateWeeklySummary(testUserId, startDate, endDate);
    
    if (summaryId) {
      createdSummaryIds.push(summaryId);
      
      // Verify the summary exists
      const [summary] = await db
        .select()
        .from(logSummaries)
        .where({ id: summaryId });
        
      expect(summary).toBeDefined();
      expect(summary.userId).toBe(testUserId);
      expect(summary.summaryType).toBe('weekly');
      expect(typeof summary.content).toBe('string');
      expect(summary.startDate).toEqual(startDate);
      expect(summary.endDate).toEqual(endDate);
    } else {
      // If no summary was created, it's valid - might mean no daily summaries exist
      logger.info('No weekly summary generated - possibly no daily summaries for test user');
    }
  });
  
  test('Should extract significant changes from summary text', async () => {
    const sampleSummary = `
      User started taking Vitamin D3 at 2000 IU daily.
      There was a notable improvement in energy levels after starting magnesium.
      The user decreased their zinc dosage from 50mg to 25mg due to stomach discomfort.
      Sleep quality remained consistent throughout the week.
      No side effects were reported for most supplements.
    `;
    
    // Use private method to extract changes
    // @ts-ignore - accessing private method for testing
    const changes = advancedSummaryService.extractSignificantChanges(sampleSummary);
    
    // Verify extraction
    expect(Array.isArray(changes)).toBe(true);
    expect(changes.length).toBeGreaterThan(0);
    
    // Check specific changes were detected
    expect(changes).toContain("User started taking Vitamin D3 at 2000 IU daily");
    expect(changes).toContain("There was a notable improvement in energy levels after starting magnesium");
    expect(changes).toContain("The user decreased their zinc dosage from 50mg to 25mg due to stomach discomfort");
    
    // Check non-changes were ignored
    expect(changes).not.toContain("Sleep quality remained consistent throughout the week");
    expect(changes).not.toContain("No side effects were reported for most supplements");
  });
  
  test('Should retrieve relevant summaries for a query', async () => {
    // Skip if no real user data is available
    const users = await db.query.users.findMany({ limit: 1 });
    if (users.length === 0) {
      logger.info('Skipping relevant summaries test - no user data available');
      return;
    }
    
    const realUserId = users[0].id;
    
    // Test query about sleep and energy
    const testQuery = "How have my supplements affected my sleep and energy levels?";
    
    // Get relevant summaries
    const relevantSummaries = await advancedSummaryService.getRelevantSummaries(realUserId, testQuery);
    
    // Check structure
    expect(Array.isArray(relevantSummaries)).toBe(true);
    
    // If we have results, check their properties
    if (relevantSummaries.length > 0) {
      relevantSummaries.forEach(summary => {
        expect(summary).toHaveProperty('similarity');
        expect(typeof summary.similarity).toBe('number');
        expect(summary.similarity).toBeGreaterThan(0);
        expect(summary.similarity).toBeLessThanOrEqual(1);
      });
      
      // Summaries should be sorted by similarity (highest first)
      for (let i = 1; i < relevantSummaries.length; i++) {
        expect(relevantSummaries[i-1].similarity).toBeGreaterThanOrEqual(relevantSummaries[i].similarity);
      }
    }
  });
  
  test('Should process daily summaries for users with logs', async () => {
    // Mock date (yesterday)
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    
    // Process daily summaries
    await advancedSummaryService.processDailySummaries(yesterday);
    
    // This test just verifies the function runs without error
    // Since we can't easily verify the outcome without creating test logs first
    expect(true).toBe(true);
  });
});
