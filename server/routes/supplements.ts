import express from 'express';
import { db } from '../../db';
import { supplements, supplementLogs } from '../../db/schema';
import { eq, and, gte, sql } from 'drizzle-orm';

const router = express.Router();

// Middleware to check authentication
const requireAuth = (req: any, res: any, next: any) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ error: "Authentication required" });
  }
  next();
};

// Get user's supplement streak
router.get('/streak', requireAuth, async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Get supplements logged in the last 14 days
    const twoWeeksAgo = new Date();
    twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);

    const logs = await db.select()
      .from(supplementLogs)
      .where(
        and(
          eq(supplementLogs.userId, userId),
          gte(supplementLogs.takenAt, twoWeeksAgo)
        )
      );

    // Count consecutive days
    const streakDays = logs.reduce((streak, log) => {
      if (!log.takenAt) return streak;
      const logDate = new Date(log.takenAt).toDateString();
      const today = new Date().toDateString();
      return logDate === today ? streak + 1 : streak;
    }, 0);

    console.log('Streak calculation result:', {
      userId,
      streakDays,
      logsCount: logs.length,
      timestamp: new Date().toISOString()
    });

    res.json({ streakDays });
  } catch (error) {
    console.error('Error fetching streak:', error);
    res.status(500).json({ error: 'Failed to fetch streak data' });
  }
});

export default router;
// Get count of user's supplement logs
router.get('/count', requireAuth, async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const result = await db
      .select({ count: sql`count(*)::int` })
      .from(supplementLogs)
      .where(eq(supplementLogs.userId, userId));

    res.json(result[0]?.count || 0);
  } catch (error) {
    console.error('Error counting supplement logs:', error);
    res.status(500).json({ error: 'Failed to count supplement logs' });
  }
});
