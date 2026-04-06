import { sql } from "drizzle-orm";
import logger from "./logger";

/**
 * Utility functions for consistent date handling across the application
 */

/**
 * Creates a Date object from a potentially null timestamp
 * @param timestamp The timestamp to convert
 * @param defaultValue Optional default value if timestamp is null
 * @returns Date object or null
 */
export function safeDate(timestamp: Date | string | null, defaultValue: Date | null = null): Date | null {
  if (!timestamp) return defaultValue;
  
  try {
    return new Date(timestamp);
  } catch (error) {
    logger.error("Error creating date from timestamp:", error);
    return defaultValue;
  }
}

/**
 * Formats a date for display, handling null values
 * @param date The date to format
 * @param format The format to use (default: toLocaleDateString)
 * @returns Formatted date string or placeholder
 */
export function formatDate(date: Date | null, format: 'local' | 'iso' | 'time' = 'local'): string {
  if (!date) return 'Not specified';
  
  try {
    switch (format) {
      case 'iso':
        return date.toISOString();
      case 'time':
        return date.toLocaleTimeString();
      default:
        return date.toLocaleDateString();
    }
  } catch (error) {
    logger.error("Error formatting date:", error);
    return 'Invalid date';
  }
}

/**
 * Creates a UTC date boundary for the given date
 * @param date The date to get boundaries for
 * @param boundary Start or end of day
 * @returns Date object set to start or end of UTC day
 */
export function getUtcDayBoundary(date: Date, boundary: 'start' | 'end'): Date {
  const utcDate = new Date(date);
  
  if (boundary === 'start') {
    utcDate.setUTCHours(0, 0, 0, 0);
  } else {
    utcDate.setUTCHours(23, 59, 59, 999);
  }
  
  return utcDate;
}

/**
 * SQL helper for date range queries
 * @param field The database field to compare
 * @param startDate Start of range
 * @param endDate End of range
 * @returns SQL query part for date range
 */
export function dateRangeSql(field: string, startDate: Date, endDate: Date) {
  return sql`${field} BETWEEN ${getUtcDayBoundary(startDate, 'start')} AND ${getUtcDayBoundary(endDate, 'end')}`;
}

/**
 * Validates if a date is within acceptable range
 * @param date The date to validate
 * @param options Validation options
 * @returns true if date is valid and within range
 */
export function isValidDate(
  date: Date | null,
  options: { 
    minDate?: Date,
    maxDate?: Date,
    allowNull?: boolean 
  } = {}
): boolean {
  if (!date) return !!options.allowNull;
  
  const timestamp = date.getTime();
  if (isNaN(timestamp)) return false;
  
  if (options.minDate && timestamp < options.minDate.getTime()) return false;
  if (options.maxDate && timestamp > options.maxDate.getTime()) return false;
  
  return true;
}

/**
 * Gets the date range for a summary period
 * @param period The period type
 * @param referenceDate The reference date (defaults to now)
 * @returns Object with start and end dates
 */
export function getSummaryDateRange(
  period: 'daily' | 'weekly',
  referenceDate: Date = new Date()
): { startDate: Date; endDate: Date } {
  const endDate = getUtcDayBoundary(referenceDate, 'end');
  const startDate = new Date(endDate);
  
  if (period === 'weekly') {
    startDate.setDate(startDate.getDate() - 7);
    startDate.setUTCHours(0, 0, 0, 0);
  } else {
    startDate.setUTCHours(0, 0, 0, 0);
  }
  
  return { startDate, endDate };
} 