
import { db } from '../../db';
import { users } from '../../db/schema';
import stripeService from '../services/stripe';
import { eq } from 'drizzle-orm';
import cron from 'node-cron';
import logger from '../utils/logger';

// Run daily at 3 AM
export const updateTrialStatusesCron = cron.schedule('0 3 * * *', async () => {
  try {
    logger.info('Starting scheduled trial status update');
    const now = new Date();
    
    // Get all users who are on trial or have expired trials
    const trialUsers = await db.query.users.findMany({
      where: eq(users.subscriptionId, null)
    });

    // Update status for each user
    for (const user of trialUsers) {
      await stripeService.updateTrialStatus(user.id);
    }
    logger.info('Completed scheduled trial status update');
  } catch (error) {
    logger.error('Error in trial status update cron:', {
      error: error instanceof Error ? error.message : String(error)
    });
  }
});
