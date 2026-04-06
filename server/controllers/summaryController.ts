
// server/controllers/summaryController.ts

import { Request, Response } from 'express';
import { advancedSummaryService } from '../services/advancedSummaryService';
import { summaryTaskManager } from '../cron/summaryManager';
import { db } from '../../db';
import { logSummaries } from '../../db/schema';
import { eq, and, between, desc } from 'drizzle-orm';
import logger from '../utils/logger';

/**
 * Generate a daily summary for the current user
 */
export async function generateDailySummary(req: Request, res: Response): Promise<void> {
  try {
    if (!req.isAuthenticated()) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const { date } = req.body;
    let targetDate: Date;
    
    if (date) {
      targetDate = new Date(date);
      // Check if date is valid
      if (isNaN(targetDate.getTime())) {
        res.status(400).json({ error: 'Invalid date format' });
        return;
      }
    } else {
      targetDate = new Date(); // Default to today
    }
    
    // Generate summary
    const summaryId = await advancedSummaryService.generateDailySummary(req.user!.id, targetDate);
    
    if (summaryId) {
      // Fetch the generated summary
      const [summary] = await db
        .select()
        .from(logSummaries)
        .where(eq(logSummaries.id, summaryId))
        .limit(1);
      
      res.status(200).json({
        success: true,
        summary,
        message: 'Daily summary generated successfully'
      });
    } else {
      res.status(400).json({
        success: false,
        message: 'No data available to generate summary'
      });
    }
  } catch (error) {
    logger.error('Error generating daily summary:', {
      error: error instanceof Error ? error.message : String(error),
      userId: req.user?.id,
      timestamp: new Date().toISOString()
    });
    
    res.status(500).json({
      success: false,
      error: 'Failed to generate summary',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

/**
 * Generate a weekly summary for the specified week
 */
export async function generateWeeklySummary(req: Request, res: Response): Promise<void> {
  try {
    if (!req.isAuthenticated()) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const { startDate, endDate } = req.body;
    
    // Validate date inputs
    if (!startDate || !endDate) {
      res.status(400).json({ error: 'Both startDate and endDate are required' });
      return;
    }
    
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      res.status(400).json({ error: 'Invalid date format' });
      return;
    }
    
    // Generate summary
    const summaryId = await advancedSummaryService.generateWeeklySummary(req.user!.id, start, end);
    
    if (summaryId) {
      // Fetch the generated summary
      const [summary] = await db
        .select()
        .from(logSummaries)
        .where(eq(logSummaries.id, summaryId))
        .limit(1);
      
      res.status(200).json({
        success: true,
        summary,
        message: 'Weekly summary generated successfully'
      });
    } else {
      res.status(400).json({
        success: false,
        message: 'No data available to generate summary'
      });
    }
  } catch (error) {
    logger.error('Error generating weekly summary:', {
      error: error instanceof Error ? error.message : String(error),
      userId: req.user?.id,
      timestamp: new Date().toISOString()
    });
    
    res.status(500).json({
      success: false,
      error: 'Failed to generate summary',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

/**
 * Retrieve summaries for a date range
 */
export async function getSummaries(req: Request, res: Response): Promise<void> {
  try {
    if (!req.isAuthenticated()) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const { startDate, endDate, summaryType } = req.query;
    
    if (!startDate || !endDate) {
      res.status(400).json({ error: 'Both startDate and endDate are required' });
      return;
    }
    
    const start = new Date(startDate as string);
    const end = new Date(endDate as string);
    
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      res.status(400).json({ error: 'Invalid date format' });
      return;
    }
    
    // Build query
    let query = db
      .select()
      .from(logSummaries)
      .where(
        and(
          eq(logSummaries.userId, req.user!.id),
          between(logSummaries.startDate, start, end)
        )
      )
      .orderBy(desc(logSummaries.startDate));
    
    // Add type filter if specified
    if (summaryType) {
      query = query.where(eq(logSummaries.summaryType, summaryType as string));
    }
    
    const summaries = await query;
    
    res.status(200).json({
      success: true,
      summaries,
      count: summaries.length
    });
  } catch (error) {
    logger.error('Error retrieving summaries:', {
      error: error instanceof Error ? error.message : String(error),
      userId: req.user?.id,
      timestamp: new Date().toISOString()
    });
    
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve summaries',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

/**
 * Trigger real-time summarization for the current user
 */
export async function triggerRealtimeSummarization(req: Request, res: Response): Promise<void> {
  try {
    if (!req.isAuthenticated()) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }
    
    // Run the summarization task
    await summaryTaskManager.runRealtimeSummary(req.user!.id);
    
    res.status(200).json({
      success: true,
      message: 'Real-time summarization triggered successfully'
    });
  } catch (error) {
    logger.error('Error triggering real-time summarization:', {
      error: error instanceof Error ? error.message : String(error),
      userId: req.user?.id,
      timestamp: new Date().toISOString()
    });
    
    res.status(500).json({
      success: false,
      error: 'Failed to trigger summarization',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}
