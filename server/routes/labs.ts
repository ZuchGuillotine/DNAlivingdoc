import express from 'express';
import { db } from '@db';
import { labResults } from '@db/schema';
import { eq } from 'drizzle-orm';
import fileUpload from 'express-fileupload';
import path from 'path';
import fs from 'fs';
import { labSummaryService } from '../services/labSummaryService';
import { labTextPreprocessingService } from '../services/labTextPreprocessingService';
import logger from '../utils/logger';
import { checkLabUploadLimit } from '../middleware/tierLimitMiddleware';

const router = express.Router();
import labChartDataRouter from './labChartData';
import { debugLabResults } from '../controllers/debugController';

// Mount chart data routes
router.use('/chart-data', labChartDataRouter);

// Debug endpoint - only accessible by admins
router.get('/debug/:labId?', (req, res, next) => {
  if (!req.user?.isAdmin) {
    return res.status(403).json({ error: 'Unauthorized' });
  }
  next();
}, debugLabResults);

// Configure file upload middleware
const uploadMiddleware = fileUpload({
  limits: { fileSize: 50 * 1024 * 1024 },
  useTempFiles: true,
  tempFileDir: '/tmp/',
  safeFileNames: true,
  preserveExtension: true,
  debug: true,
  createParentPath: true,
  parseNested: true,
  abortOnLimit: true
});

// Get all lab results for a user
router.get('/', async (req, res) => {
  try {
    const results = await db
      .select()
      .from(labResults)
      .where(eq(labResults.userId, req.user!.id))
      .orderBy(labResults.uploadedAt, "desc");

    logger.info(`Retrieved ${results.length} lab results for user ${req.user!.id}`);
    res.json(results);
  } catch (error) {
    logger.error('Error fetching lab results:', {
      userId: req.user!.id,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    });
    res.status(500).json({ error: 'Failed to fetch lab results' });
  }
});

// Upload new lab result
router.post('/', uploadMiddleware, checkLabUploadLimit, async (req, res) => {
  try {
    if (!req.files || Object.keys(req.files).length === 0) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const file = req.files.file as fileUpload.UploadedFile;
    const uploadDir = path.join(process.cwd(), 'uploads');
    
    // Ensure upload directory exists
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
      logger.info(`Created uploads directory at ${uploadDir}`);
    }

    const fileName = `${Date.now()}-${file.name}`;
    const filePath = path.join(uploadDir, fileName);
    const relativeUrl = `/uploads/${fileName}`;

    // Move file to uploads directory
    await file.mv(filePath);
    logger.info(`File moved to ${filePath}`);

    // Pre-process the file content
    let preprocessedText;
    try {
      const fileBuffer = fs.readFileSync(filePath);
      preprocessedText = await labTextPreprocessingService.preprocessLabText(fileBuffer, file.mimetype);
      
      logger.info('Lab text pre-processing complete', {
        fileName: file.name,
        mimeType: file.mimetype,
        textLength: preprocessedText.normalizedText.length,
        qualityMetrics: preprocessedText.metadata.qualityMetrics
      });
    } catch (preprocessError) {
      logger.error('Error pre-processing lab text:', {
        fileName: file.name,
        error: preprocessError instanceof Error ? preprocessError.message : String(preprocessError),
        stack: preprocessError instanceof Error ? preprocessError.stack : undefined
      });
      // Continue with upload even if pre-processing fails
      preprocessedText = null;
    }
    
    // Save file info to database with enhanced metadata
    const [result] = await db
      .insert(labResults)
      .values({
        userId: req.user!.id,
        fileName: file.name,
        fileType: file.mimetype,
        fileUrl: relativeUrl,
        metadata: {
          size: file.size,
          lastViewed: new Date().toISOString(),
          originalName: file.name,
          absolutePath: filePath,
          relativePath: relativeUrl,
          uploadTimestamp: Date.now(),
          mimeType: file.mimetype,
          md5: file.md5,
          // Add pre-processed text data if available
          ...(preprocessedText ? {
            preprocessedText: {
              rawText: preprocessedText.rawText,
              normalizedText: preprocessedText.normalizedText,
              processingMetadata: preprocessedText.metadata
            }
          } : {})
        }
      })
      .returning();

    logger.info('Lab result saved:', {
      labId: result.id,
      fileName: file.name,
      fileUrl: relativeUrl,
      userId: req.user!.id,
      fileSize: file.size,
      hasPreprocessedText: !!preprocessedText
    });

    // Trigger background summarization with pre-processed text if available
    try {
      const textToSummarize = preprocessedText?.normalizedText || preprocessedText?.rawText;
      
      labSummaryService.summarizeLabResult(result.id, textToSummarize)
        .then((summary) => {
          if (summary) {
            logger.info(`Background summary generation completed for lab ID ${result.id}`);
          } else {
            logger.warn(`Background summary generation completed but returned null for lab ID ${result.id}`);
          }
        })
        .catch(summaryError => {
          logger.error('Background summary generation failed:', {
            labId: result.id,
            error: summaryError instanceof Error ? summaryError.message : String(summaryError),
            stack: summaryError instanceof Error ? summaryError.stack : undefined
          });
        });
        
      logger.info('Background summary generation started for lab ID:', result.id);
    } catch (summaryError) {
      logger.error('Failed to initiate lab summarization:', {
        labId: result.id,
        error: summaryError instanceof Error ? summaryError.message : String(summaryError),
        stack: summaryError instanceof Error ? summaryError.stack : undefined
      });
    }

    res.json(result);
  } catch (error) {
    logger.error('Error uploading lab result:', {
      userId: req.user!.id,
      fileName: req.files?.file ? (req.files.file as fileUpload.UploadedFile).name : 'unknown',
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    });
    res.status(500).json({ error: 'Failed to upload lab result' });
  }
});

// Delete lab result
router.delete('/:id', async (req, res) => {
  const labId = parseInt(req.params.id);
  
  try {
    // First fetch the record to get file path
    const [labRecord] = await db
      .select()
      .from(labResults)
      .where(eq(labResults.id, labId))
      .limit(1);

    if (!labRecord) {
      logger.warn(`Attempted to delete non-existent lab result: ${labId}`);
      return res.status(404).json({ error: 'Lab result not found' });
    }

    // Delete database record
    await db
      .delete(labResults)
      .where(eq(labResults.id, labId));

    // Delete physical file if it exists
    try {
      const filePath = path.join(process.cwd(), labRecord.fileUrl);
      
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        logger.info(`Deleted lab result file:`, {
          labId,
          filePath,
          fileName: labRecord.fileName
        });
      } else {
        logger.warn(`Lab result file not found during deletion:`, {
          labId,
          filePath,
          fileName: labRecord.fileName
        });
      }
    } catch (fileError) {
      logger.error('Error deleting lab result file:', {
        labId,
        error: fileError instanceof Error ? fileError.message : String(fileError),
        stack: fileError instanceof Error ? fileError.stack : undefined
      });
    }

    res.json({ 
      message: 'Lab result deleted successfully',
      labId,
      fileName: labRecord.fileName
    });
  } catch (error) {
    logger.error('Error deleting lab result:', {
      labId,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    });
    res.status(500).json({ error: 'Failed to delete lab result' });
  }
});

export default router;
