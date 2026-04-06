/**
    * @description      : 
    * @author           : 
    * @group            : 
    * @created          : 05/06/2025 - 17:35:15
    * 
    * MODIFICATION LOG
    * - Version         : 1.0.0
    * - Date            : 05/06/2025
    * - Author          : 
    * - Modification    : 
**/

import cron from 'node-cron';
import { checkAndReprocessBiomarkers } from '../../scripts/check-biomarkers';
import logger from '../utils/logger';

// Run daily at 2 AM
export const processMissingBiomarkersCron = cron.schedule('0 2 * * *', async () => {
  try {
    logger.info('Starting scheduled biomarker reprocessing check');
    await checkAndReprocessBiomarkers();
    logger.info('Completed scheduled biomarker reprocessing check');
  } catch (error) {
    logger.error('Error in biomarker reprocessing cron:', {
      error: error instanceof Error ? error.message : String(error)
    });
  }
});
