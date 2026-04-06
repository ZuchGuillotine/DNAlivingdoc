
# Integration Guidelines for New Data Types

This document provides detailed guidelines for integrating additional data types (e.g., heart rate, sleep tracking, blood pressure) into the hybrid context system, ensuring they're properly summarized, embedded, and retrieved.

## Step-by-Step Integration Process

### 1. Database Schema Updates

First, extend the database schema to accommodate your new data type:

```typescript
// 1. Create a migration file: db/migrations/add_new_data_type.ts

import { sql } from "drizzle-orm";
import { db } from "../index";

async function main() {
  console.log('Starting migration for new data type...');
  try {
    // Create the new data table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS heart_rate_logs (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id),
        logged_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        value INTEGER NOT NULL,  // For example, heart rate in BPM
        source TEXT,             // Device or method used
        activity TEXT,           // Activity during measurement
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      
      CREATE INDEX IF NOT EXISTS idx_heart_rate_logs_user_id 
        ON heart_rate_logs(user_id);
      CREATE INDEX IF NOT EXISTS idx_heart_rate_logs_logged_at 
        ON heart_rate_logs(logged_at);
    `);
    
    console.log('Migration completed successfully');
  } catch (error) {
    console.error('Migration failed:', error);
    throw error;
  }
}

// Execute migration
main().catch(console.error);
```

Then update your schema.ts file:

```typescript
// 2. Update db/schema.ts to include the new table
import { pgTable, serial, integer, text, timestamp } from "drizzle-orm/pg-core";
// ...existing imports

// Add new table definition
export const heartRateLogs = pgTable("heart_rate_logs", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  loggedAt: timestamp("logged_at").notNull().defaultNow(),
  value: integer("value").notNull(),
  source: text("source"),
  activity: text("activity"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow()
});

// Add type definitions
export type InsertHeartRateLog = typeof heartRateLogs.$inferInsert;
export type SelectHeartRateLog = typeof heartRateLogs.$inferSelect;
```

### 2. Extend Summary Service

Update the summarization service to include the new data type:

```typescript
// 3. Modify server/services/advancedSummaryService.ts

// Add to the generateDailySummary method
async generateDailySummary(userId: number, date: Date): Promise<number | null> {
  try {
    // Existing code...
    
    // Fetch heart rate logs for the day
    const heartRateLogs = await db
      .select()
      .from(heartRateLogs)
      .where(
        and(
          eq(heartRateLogs.userId, userId),
          between(heartRateLogs.loggedAt, startOfDay, endOfDay)
        )
      );
    
    // Format heart rate logs
    const formattedHeartRateLogs = heartRateLogs.map(log => {
      const timestamp = new Date(log.loggedAt).toLocaleTimeString();
      return `[${timestamp}] Heart Rate: ${log.value} BPM${log.activity ? ` (Activity: ${log.activity})` : ''}${log.notes ? ` - Notes: ${log.notes}` : ''}`;
    }).join('\n');
    
    // Add to the input for summarization
    const summaryInput = `
    Date: ${dateStr}
    
    // Existing code for supplement logs and qualitative logs...
    
    Heart Rate Data:
    ${formattedHeartRateLogs || 'No heart rate data recorded for this day.'}
    `;
    
    // Rest of the method remains the same...
  } catch (error) {
    // Error handling...
  }
}
```

### 3. Update Embedding Service

If needed, extend the embedding service to handle the new data type:

```typescript
// 4. Modify server/services/embeddingService.ts

// Add a method for creating heart rate log embeddings
async createHeartRateLogEmbedding(logId: number, content: string): Promise<void> {
  try {
    const embedding = await this.generateEmbedding(content);
    
    await db.insert(logEmbeddings).values({
      logId,
      logType: 'heart_rate',
      embedding
    });
    
    logger.info(`Created embedding for heart rate log ${logId}`);
  } catch (error) {
    logger.error(`Failed to create embedding for heart rate log ${logId}:`, error);
    throw error;
  }
}

// Update processBatch method to include the new type
async processLogBatch(logIds: number[], logType: 'qualitative' | 'quantitative' | 'heart_rate'): Promise<void> {
  // Existing code...
  
  // Add case for heart rate logs
  if (logType === 'heart_rate') {
    const [log] = await db.execute(sql`
      SELECT 
        value, 
        logged_at,
        activity,
        notes
      FROM 
        heart_rate_logs
      WHERE 
        id = ${logId}
    `);
    
    if (log) {
      content = `Heart Rate: ${log.value} BPM, Time: ${new Date(log.logged_at).toISOString()}, Activity: ${log.activity || 'None'}, Notes: ${log.notes || 'None'}`;
    }
  }
  
  // Existing code for embedding creation...
}
```

### 4. Update Context Building Service

Modify the context building services to include the new data type:

```typescript
// 5. Update server/services/llmContextService.ts and llmContextService_query.ts

// In constructUserContext and constructQueryContext

// Fetch heart rate data
const heartRateData = await db
  .select()
  .from(heartRateLogs)
  .where(eq(heartRateLogs.userId, userIdNum))
  .orderBy(desc(heartRateLogs.loggedAt))
  .limit(10);  // Get recent data

// Format heart rate data for context
let heartRateContext = '';
if (heartRateData.length > 0) {
  // Calculate average
  const avgHeartRate = Math.round(
    heartRateData.reduce((sum, log) => sum + log.value, 0) / heartRateData.length
  );
  
  // Find min/max
  const minHeartRate = Math.min(...heartRateData.map(log => log.value));
  const maxHeartRate = Math.max(...heartRateData.map(log => log.value));
  
  heartRateContext = `
Recent Heart Rate Data:
- Average: ${avgHeartRate} BPM
- Range: ${minHeartRate}-${maxHeartRate} BPM
- Latest: ${heartRateData[0].value} BPM (${format(new Date(heartRateData[0].loggedAt), 'MMM d, yyyy h:mm a')})
`;

  // Add specific readings if relevant
  if (heartRateData.length > 1) {
    heartRateContext += `- Recent readings: ${heartRateData.slice(0, 5).map(log => log.value).join(', ')} BPM\n`;
  }
}

// Add to messages
const messages = [
  { role: "system", content: SYSTEM_PROMPT },
  { role: "user", content: `
User Context - Health Statistics:
${healthStatsContext}

${heartRateContext}  // Add the new data here

// Rest of the existing context...

User Query:
${userQuery}
` }
];
```

### 5. Create API Routes

Create API routes to manage the new data type:

```typescript
// 6. Create a new file: server/routes/heartRateRoutes.ts

import express, { type Express } from 'express';
import { db } from '@db';
import { heartRateLogs } from '@db/schema';
import { eq, and, between, desc } from 'drizzle-orm';
import logger from '../utils/logger';

// Setup heart rate routes
function setupHeartRateRoutes(app: Express) {
  // Create router
  const router = express.Router();

  // Auth middleware for all routes
  router.use((req, res, next) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Authentication required" });
    }
    next();
  });

  // Get heart rate logs
  router.get('/', async (req, res) => {
    try {
      const { startDate, endDate } = req.query;
      
      // Validate parameters
      if (!startDate || !endDate) {
        return res.status(400).json({ error: 'Start and end dates are required' });
      }
      
      const start = new Date(startDate as string);
      const end = new Date(endDate as string);
      
      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        return res.status(400).json({ error: 'Invalid date format' });
      }
      
      // Fetch logs
      const logs = await db
        .select()
        .from(heartRateLogs)
        .where(
          and(
            eq(heartRateLogs.userId, req.user!.id),
            between(heartRateLogs.loggedAt, start, end)
          )
        )
        .orderBy(desc(heartRateLogs.loggedAt));
      
      res.json(logs);
    } catch (error) {
      logger.error('Error fetching heart rate logs:', error);
      res.status(500).json({
        error: 'Failed to fetch heart rate logs',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Log heart rate
  router.post('/', async (req, res) => {
    try {
      const { value, source, activity, notes, loggedAt } = req.body;
      
      // Validate input
      if (typeof value !== 'number' || value <= 0) {
        return res.status(400).json({ error: 'Valid heart rate value is required' });
      }
      
      // Insert log
      const [log] = await db
        .insert(heartRateLogs)
        .values({
          userId: req.user!.id,
          value,
          source: source || null,
          activity: activity || null,
          notes: notes || null,
          loggedAt: loggedAt ? new Date(loggedAt) : new Date()
        })
        .returning();
      
      res.status(201).json(log);
    } catch (error) {
      logger.error('Error creating heart rate log:', error);
      res.status(500).json({
        error: 'Failed to create heart rate log',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Update heart rate log
  router.put('/:id', async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: 'Invalid ID format' });
      }
      
      const { value, source, activity, notes, loggedAt } = req.body;
      
      // Validate input
      if (typeof value !== 'number' || value <= 0) {
        return res.status(400).json({ error: 'Valid heart rate value is required' });
      }
      
      // Update log
      const [log] = await db
        .update(heartRateLogs)
        .set({
          value,
          source: source || null,
          activity: activity || null,
          notes: notes || null,
          loggedAt: loggedAt ? new Date(loggedAt) : undefined,
          updatedAt: new Date()
        })
        .where(
          and(
            eq(heartRateLogs.id, id),
            eq(heartRateLogs.userId, req.user!.id)
          )
        )
        .returning();
      
      if (!log) {
        return res.status(404).json({ error: 'Heart rate log not found' });
      }
      
      res.json(log);
    } catch (error) {
      logger.error('Error updating heart rate log:', error);
      res.status(500).json({
        error: 'Failed to update heart rate log',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Delete heart rate log
  router.delete('/:id', async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: 'Invalid ID format' });
      }
      
      const [log] = await db
        .delete(heartRateLogs)
        .where(
          and(
            eq(heartRateLogs.id, id),
            eq(heartRateLogs.userId, req.user!.id)
          )
        )
        .returning();
      
      if (!log) {
        return res.status(404).json({ error: 'Heart rate log not found' });
      }
      
      res.json({ success: true, message: 'Heart rate log deleted successfully' });
    } catch (error) {
      logger.error('Error deleting heart rate log:', error);
      res.status(500).json({
        error: 'Failed to delete heart rate log',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Register router
  app.use('/api/heart-rate', router);
  
  logger.info('Heart rate routes registered');
}

export default setupHeartRateRoutes;
```

## Testing the Integration

After implementing all the components, you should test each part:

1. **Database schema**: Verify table creation and indexing
2. **API endpoints**: Test CRUD operations for the new data type
3. **Summarization**: Ensure the new data type is properly included in summaries
4. **Embedding generation**: Verify embeddings are created for the new data 
5. **Context retrieval**: Test that the new data appears in LLM context when relevant

## Updating the Frontend

Finally, update the frontend to allow users to interact with the new data type:

1. Create UI components for viewing and managing the new data
2. Add appropriate React hooks for data fetching and mutation
3. Integrate the new UI into the existing interface
4. Update any relevant visualizations to include the new data

Remember to follow the project's established patterns for frontend components and data fetching.
