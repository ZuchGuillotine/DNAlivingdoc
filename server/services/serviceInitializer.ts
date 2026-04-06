import path from 'path';
import fs from 'fs';
import logger from '../utils/logger';

/**
 * Initializes all services required for the hybrid context approach
 */
class ServiceInitializer {
  /**
   * Initialize all services in the correct order
   */
  async initializeServices(): Promise<void> {
    try {
      logger.info('Starting service initialization...');

      // Initialize PGVector services first
      await this.initializePGVector();

      // Initialize summarization services
      await this.initializeSummarization();

      // Initialize lab results services
      await this.initializeLabServices();

      // Initialize supplement service
      await this.initializeSupplementService();

      // Start scheduled tasks if in production mode
      if (process.env.NODE_ENV === 'production') {
        const { summaryTaskManager } = await import('../cron/summaryManager');
        this.startScheduledTasks(summaryTaskManager);
      } else {
        logger.info('Scheduled tasks not started in development mode');
      }

      logger.info('Service initialization completed successfully');
    } catch (error) {
      logger.error('Service initialization failed:', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      });

      // Even if initialization fails, we'll continue running the app
      // This allows the app to function with reduced capabilities
    }
  }

  /**
   * Initialize PGVector related services
   */
  private async initializePGVector(): Promise<void> {
    try {
      logger.info('Initializing PGVector services...');
      const { default: embeddingService } = await import('./embeddingService');

      // Verify PGVector availability and initialize embedding service
      const initialized = await embeddingService.initialize();

      if (!initialized) {
        throw new Error('Failed to initialize embedding service');
      }

      logger.info('PGVector services initialized successfully');
    } catch (error) {
      logger.error('PGVector initialization failed:', error);
      throw error;
    }
  }

  /**
   * Initialize summarization services
   */
  private async initializeSummarization(): Promise<void> {
    try {
      logger.info('Initializing summarization services...');
      const { default: embeddingService } = await import('./embeddingService');
      const { advancedSummaryService } = await import('./advancedSummaryService');

      // Verify OpenAI API access for summarization
      try {
        // Perform a simple test to ensure OpenAI connectivity
        const testEmbedding = await embeddingService.generateEmbedding('Test embedding generation');
        logger.info('OpenAI embedding generation verified successfully');
      } catch (error) {
        logger.error('OpenAI embedding test failed:', error);
        throw new Error('OpenAI API connectivity check failed. Please verify your API key.');
      }

      logger.info('Summarization services initialized successfully');
    } catch (error) {
      logger.error('Summarization service initialization failed:', error);
      throw error;
    }
  }

  /**
   * Initialize lab results services
   */
  private async initializeLabServices(): Promise<void> {
    try {
      logger.info('Initializing lab results services...');
      const { labSummaryService } = await import('./labSummaryService');
      // Any specific initialization for labSummaryService would go here

      // Ensure uploads directory exists
      const uploadsDir = path.join(process.cwd(), 'uploads');
      try {
        if (!fs.existsSync(uploadsDir)) {
          fs.mkdirSync(uploadsDir, { recursive: true });
          logger.info('Created uploads directory at:', uploadsDir);
        }
        
        // Verify directory permissions
        fs.accessSync(uploadsDir, fs.constants.R_OK | fs.constants.W_OK);
        logger.info('Uploads directory verified with correct permissions');
        
        // Pre-load required modules for lab processing to avoid initialization issues
        logger.info('Preloading PDF processing modules...');
        try {
          // Dynamically import pdf-parse to ensure it's loaded correctly
          import('pdf-parse').then(() => {
            logger.info('PDF processing module loaded successfully');
          }).catch(err => {
            logger.warn('PDF processing module preload warning (non-fatal):', err);
          });
        } catch (moduleError) {
          logger.warn('Module preloading warning (non-fatal):', moduleError);
        }
      } catch (error) {
        logger.error('Failed to setup uploads directory:', error);
        throw error; // This is critical enough to fail startup
      }

      logger.info('Lab results services initialized successfully');
    } catch (error) {
      logger.error('Lab services initialization failed:', error);
      // Continue even if lab services fail to initialize
    }
  }

  /**
   * Initialize the supplement service
   */
  private async initializeSupplementService(): Promise<void> {
    try {
      logger.info('Initializing supplement service...');
      const { supplementService } = await import('./supplements');
      // This will start the async data loading for the trie
      const instance = supplementService.getInstance();
      await instance.initialize();
      logger.info('Supplement service initialization started in background.');
    } catch (error) {
      logger.error('Supplement service initialization failed:', error);
      // Non-fatal, continue running
    }
  }

  /**
   * Start scheduled tasks for summarization
   */
  private startScheduledTasks(summaryTaskManager: any): void {
    try {
      logger.info('Starting scheduled tasks...');

      // Start daily summary task to run at 1 AM
      summaryTaskManager.startDailySummaryTask(1);

      // Start weekly summary task to run on Sunday at 2 AM
      summaryTaskManager.startWeeklySummaryTask(0, 2);

      // Start lab processing task to run daily at 3 AM
      // summaryTaskManager.startLabProcessingTask(3);

      logger.info('Scheduled tasks started successfully');
    } catch (error) {
      logger.error('Failed to start scheduled tasks:', error);
      // We'll continue even if tasks fail to start
    }
  }

  /**
   * Function to gracefully shut down services
   * Called when the application is shutting down
   */
  async shutdownServices(): Promise<void> {
    try {
      logger.info('Shutting down services...');
      const { summaryTaskManager } = await import('../cron/summaryManager');

      // Stop all scheduled tasks
      summaryTaskManager.stopAllTasks();

      logger.info('Services shut down successfully');
    } catch (error) {
      logger.error('Error shutting down services:', error);
      // Continue shutdown process even if errors occur
    }
  }
}

// Export singleton instance
export const serviceInitializer = new ServiceInitializer();
