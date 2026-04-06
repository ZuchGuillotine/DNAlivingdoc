
import express, { type Express } from 'express';
import { 
  generateDailySummary,
  generateWeeklySummary,
  getSummaries,
  triggerRealtimeSummarization
} from '../controllers/summaryController';

// Setup summary routes
function setupSummaryRoutes(app: Express) {
  // Create router
  const router = express.Router();

  // Auth middleware for all routes
  router.use((req, res, next) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Authentication required" });
    }
    next();
  });

  // Summary generation routes
  router.post('/daily', generateDailySummary);
  router.post('/weekly', generateWeeklySummary);
  
  // Summary retrieval routes
  router.get('/', getSummaries);
  
  // Trigger real-time summarization
  router.post('/realtime', triggerRealtimeSummarization);

  // Mount router to /api/summaries
  app.use('/api/summaries', router);
}

export default setupSummaryRoutes;
