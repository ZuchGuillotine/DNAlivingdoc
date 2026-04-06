
// server/tests/summaryManager.test.ts

import { summaryTaskManager } from '../cron/summaryManager';
import { advancedSummaryService } from '../services/advancedSummaryService';
import logger from '../utils/logger';

/**
 * Test suite for the SummaryTaskManager
 * 
 * These tests verify the scheduling and execution of summary tasks
 * 
 * Run tests with: npm test -- --testPathPattern=summaryManager
 */

// Mock advancedSummaryService
jest.mock('../services/advancedSummaryService', () => ({
  advancedSummaryService: {
    processDailySummaries: jest.fn().mockResolvedValue(undefined),
    processWeeklySummaries: jest.fn().mockResolvedValue(undefined),
    generateDailySummary: jest.fn().mockResolvedValue(123) // Mock summary ID
  }
}));

describe('Summary Task Manager Tests', () => {
  // Reset mocks before each test
  beforeEach(() => {
    jest.clearAllMocks();
  });
  
  // Stop tasks after each test
  afterEach(() => {
    summaryTaskManager.stopAllTasks();
  });

  test('Should run daily summary task', async () => {
    // Directly run the task
    await summaryTaskManager.runDailySummaryTask();
    
    // Verify it called the summary service
    expect(advancedSummaryService.processDailySummaries).toHaveBeenCalledTimes(1);
    
    // Check the argument is a date object set to yesterday
    const mockCall = advancedSummaryService.processDailySummaries.mock.calls[0][0];
    expect(mockCall).toBeInstanceOf(Date);
    
    // Should be yesterday's date
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    
    // Compare dates (just checking the date part, not time)
    expect(mockCall.toDateString()).toBe(yesterday.toDateString());
  });
  
  test('Should run weekly summary task', async () => {
    // Directly run the task
    await summaryTaskManager.runWeeklySummaryTask();
    
    // Verify it called the summary service
    expect(advancedSummaryService.processWeeklySummaries).toHaveBeenCalledTimes(1);
    
    // Check the argument is a date object set to yesterday
    const mockCall = advancedSummaryService.processWeeklySummaries.mock.calls[0][0];
    expect(mockCall).toBeInstanceOf(Date);
    
    // Should be yesterday's date
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    
    // Compare dates (just checking the date part, not time)
    expect(mockCall.toDateString()).toBe(yesterday.toDateString());
  });
  
  test('Should run real-time summary for specific user', async () => {
    // Test user ID
    const testUserId = 123;
    
    // Run real-time summary
    await summaryTaskManager.runRealtimeSummary(testUserId);
    
    // Verify it called the summary service with correct user ID
    expect(advancedSummaryService.generateDailySummary).toHaveBeenCalledTimes(1);
    expect(advancedSummaryService.generateDailySummary).toHaveBeenCalledWith(testUserId, expect.any(Date));
  });
  
  test('Should schedule and stop daily summary task', () => {
    // Mock setInterval and setTimeout
    jest.useFakeTimers();
    
    // Start the scheduled task
    summaryTaskManager.startDailySummaryTask(2); // 2 AM
    
    // Advance time to trigger the task
    jest.runOnlyPendingTimers();
    
    // Stop the task
    summaryTaskManager.stopAllTasks();
    
    // Reset timers
    jest.useRealTimers();
  });
  
  test('Should schedule and stop weekly summary task', () => {
    // Mock setInterval and setTimeout
    jest.useFakeTimers();
    
    // Start the scheduled task - Sunday (0) at 3 AM
    summaryTaskManager.startWeeklySummaryTask(0, 3);
    
    // Advance time to trigger the task
    jest.runOnlyPendingTimers();
    
    // Stop the task
    summaryTaskManager.stopAllTasks();
    
    // Reset timers
    jest.useRealTimers();
  });
});
import { summaryTaskManager } from '../cron/summaryManager';
import { advancedSummaryService } from '../services/advancedSummaryService';

// Mock the advancedSummaryService
jest.mock('../services/advancedSummaryService', () => ({
  advancedSummaryService: {
    processDailySummaries: jest.fn().mockResolvedValue(null),
    processWeeklySummaries: jest.fn().mockResolvedValue(null),
    generateDailySummary: jest.fn().mockResolvedValue(1)
  }
}));

describe('SummaryTaskManager', () => {
  beforeEach(() => {
    // Clear mocks before each test
    jest.clearAllMocks();
    
    // Stop any tasks that might be running
    summaryTaskManager.stopAllTasks();
  });
  
  test('runDailySummaryTask should call processDailySummaries', async () => {
    await summaryTaskManager.runDailySummaryTask();
    expect(advancedSummaryService.processDailySummaries).toHaveBeenCalled();
  });
  
  test('runWeeklySummaryTask should call processWeeklySummaries', async () => {
    await summaryTaskManager.runWeeklySummaryTask();
    expect(advancedSummaryService.processWeeklySummaries).toHaveBeenCalled();
  });
  
  test('runRealtimeSummary should call generateDailySummary with correct userId', async () => {
    const userId = 123;
    await summaryTaskManager.runRealtimeSummary(userId);
    expect(advancedSummaryService.generateDailySummary).toHaveBeenCalledWith(userId, expect.any(Date));
  });
  
  test('stopAllTasks should clear intervals', () => {
    // We can't directly test the interval clearing, but we can ensure it doesn't throw errors
    expect(() => {
      summaryTaskManager.stopAllTasks();
    }).not.toThrow();
  });
});
