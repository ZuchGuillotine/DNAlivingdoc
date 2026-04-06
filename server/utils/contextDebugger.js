import fs from 'fs';
import path from 'path';
import logger from './logger';
import { safeDate } from './dateUtils';

/**
 * Types for TypeScript compatibility
 * @typedef {Object} ContextMessage
 * @property {'system'|'user'|'assistant'} role
 * @property {string} content
 */

/**
 * @typedef {Object} UserContextFlags
 * @property {boolean} hasHealthStats
 * @property {boolean} hasRecentSummaries
 * @property {boolean} hasHistoricalSummaries
 * @property {boolean} hasQualitativeObservations
 * @property {boolean} hasSupplementLogs
 * @property {boolean} hasDirectSupplementInfo
 */

/**
 * @typedef {Object} TokenEstimate
 * @property {string} role
 * @property {number} tokens
 * @property {string} preview
 */

/**
 * Checks if context debugging is enabled based on environment
 * @returns {boolean}
 */
function isDebugEnabled() {
  return process.env.NODE_ENV !== 'production' || process.env.ENABLE_CONTEXT_DEBUG === 'true';
}

/**
 * Analyzes context messages for presence of different context types
 * @param {ContextMessage[]} messages
 * @returns {UserContextFlags}
 */
function analyzeUserContext(messages) {
  const containsNonEmpty = (content, marker) => 
    content.includes(marker) && !content.includes(`No ${marker.toLowerCase()} found`);

  return {
    hasHealthStats: messages.some(m => 
      m.content.includes('User Context - Health Statistics') || 
      m.content.includes('User Health Profile')),
    hasRecentSummaries: messages.some(m => containsNonEmpty(m.content, 'Recent Summaries')),
    hasHistoricalSummaries: messages.some(m => containsNonEmpty(m.content, 'Historical Health Summaries')),
    hasQualitativeObservations: messages.some(m => containsNonEmpty(m.content, 'Qualitative Observations')),
    hasSupplementLogs: messages.some(m => containsNonEmpty(m.content, 'Supplement Logs')),
    hasDirectSupplementInfo: messages.some(m => m.content.includes('Direct Supplement Information'))
  };
}

/**
 * Calculates token estimates for messages
 * @param {ContextMessage[]} messages
 * @returns {Object} Token estimates
 */
function calculateTokenEstimates(messages) {
  return {
    total: messages.reduce((acc, msg) => acc + Math.ceil(msg.content.length / 4), 0),
    byMessage: messages.map(msg => ({
      role: msg.role,
      tokens: Math.ceil(msg.content.length / 4),
      preview: msg.content.substring(0, 50) + (msg.content.length > 50 ? '...' : '')
    }))
  };
}

/**
 * Debugs the context being passed to LLM services
 * Creates debug logs with context information for analysis
 * 
 * @param {string|number} userId - The user ID
 * @param {object} contextData - The context data object containing messages
 * @param {string} contextType - Type of context ('qualitative' or 'query')
 * @returns {Promise<object|void>} - Debug data object or void
 */
export async function debugContext(userId, contextData, contextType = 'qualitative') {
  try {
    if (!isDebugEnabled()) {
      return;
    }
    
    // Use safeDate for consistent date handling
    const timestamp = safeDate(new Date())?.toISOString().replace(/[:.]/g, '-') ?? 
      new Date().toISOString().replace(/[:.]/g, '-');
    
    const userIdStr = String(userId);
    
    const debugData = {
      timestamp,
      userId: userIdStr,
      contextType,
      messageCount: contextData.messages.length,
      systemPrompt: contextData.messages.find(m => m.role === 'system')?.content,
      userContext: analyzeUserContext(contextData.messages),
      query: contextData.messages.find(m => m.content.includes('User Query:'))?.content.split('User Query:')[1]?.trim(),
      messages: contextData.messages,
      tokenEstimates: calculateTokenEstimates(contextData.messages)
    };
    
    const debugDir = path.join(process.cwd(), 'debug_logs');
    
    // Create directory if it doesn't exist
    if (!fs.existsSync(debugDir)) {
      fs.mkdirSync(debugDir, { recursive: true });
    }
    
    const filename = `${contextType}_context_${userIdStr}_${timestamp}.json`;
    const filepath = path.join(debugDir, filename);
    
    fs.writeFileSync(filepath, JSON.stringify(debugData, null, 2));
    
    logger.info(`Debug context written to ${filepath}`);
    
    return debugData;
  } catch (error) {
    logger.error('Error writing debug context:', error);
    // Don't throw, just log the error to prevent disrupting the main function
  }
}

/**
 * Legacy function for context debugging
 * Maintained for backward compatibility
 */
export function writeContextToFile(userId, context, type = 'qualitative') {
  try {
    // Call the enhanced debugContext function
    return debugContext(userId, context, type);
  } catch (error) {
    logger.error('Error in legacy context debugging:', error);
  }
}

/**
 * Debug helper to analyze token count in a context
 * @param {string|number} userId - User ID 
 * @param {object} context - Context object with messages array
 * @returns {object} Token usage analysis
 */
export function analyzeTokenUsage(userId, context) {
  try {
    const messages = context.messages || [];
    const analysis = {
      userId,
      ...calculateTokenEstimates(messages),
      messageCount: messages.length
    };
    
    logger.info(`Token usage analysis for user ${userId}:`, {
      totalTokens: analysis.total,
      messageCount: messages.length
    });
    
    return analysis;
  } catch (error) {
    logger.error('Error analyzing token usage:', error);
    return { error: 'Failed to analyze token usage' };
  }
}

export default {
  debugContext,
  writeContextToFile,
  analyzeTokenUsage
}; 