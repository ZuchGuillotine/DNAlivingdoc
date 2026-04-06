/**
    * @description      : 
    * @author           : 
    * @group            : 
    * @created          : 17/05/2025 - 13:24:56
    * 
    * MODIFICATION LOG
    * - Version         : 1.0.0
    * - Date            : 17/05/2025
    * - Author          : 
    * - Modification    : 
**/
import type { Request } from 'express';
import path from 'path';
import fs from 'fs';
import { db } from '../../db';
import { labResults, biomarkerResults, biomarkerProcessingStatus } from '../../db/schema';
import type { SelectLabResult, InsertBiomarkerResult, SelectBiomarkerResult } from '../../db/schema';
import { eq, sql } from 'drizzle-orm';
import logger from '../utils/logger';
import { labTextPreprocessingService } from './labTextPreprocessingService';

import { labSummaryService } from './labSummaryService';
import { fileTypeFromBuffer } from 'file-type';
import { tierLimitService } from './tierLimitService';
import { BiomarkerExtractionService } from './biomarkerExtractionService';

// Use the UploadedFile type from our custom type definitions
type UploadedFile = NonNullable<Request['files']>[string] & {
  name: string;
  data: Buffer;
  size: number;
  encoding: string;
  tempFilePath: string;
  truncated: boolean;
  mimetype: string;
  md5: string;
  mv(path: string): Promise<void>;
};

export interface UploadProgress {
  labResultId: number;
  status: 'uploading' | 'processing' | 'extracting' | 'summarizing' | 'completed' | 'error' | 'retrying';
  progress: number;
  message?: string;
  error?: string;
}

// Add type for biomarker parameter
interface Biomarker {
  name: string;
  value: number | string;
  unit: string;
  category: string;
  referenceRange?: string;
  testDate?: Date | string;
  source?: string;
  extractionMethod?: string;
  status?: string;
  confidence?: number | string;
  sourceText?: string | null;
}

// Add type for lab metadata
interface LabMetadata {
  size: number;
  lastViewed?: string;
  tags?: string[];
  preprocessedText?: {
    rawText: string;
    normalizedText: string;
    processingMetadata: {
      originalFormat: string;
      processingSteps: string[];
      confidence?: number;
      ocrEngine?: string;
      processingTimestamp: string;
      textLength: number;
      lineCount: number;
      hasHeaders: boolean;
      hasFooters: boolean;
      qualityMetrics?: {
        whitespaceRatio: number;
        specialCharRatio: number;
        numericRatio: number;
        potentialOcrErrors: number;
      };
    };
  };
  biomarkers?: {
    parsedBiomarkers: Array<{
      name: string;
      value: number;
      unit: string;
      referenceRange?: string;
      testDate?: string;
      category?: string;
    }>;
    parsingErrors: string[];
    extractedAt: string;
  };
  summary?: string;
  summarizedAt?: string;
}

// Add type for biomarker extraction results
interface BiomarkerExtractionResults {
  parsedBiomarkers: Biomarker[];
  parsingErrors: string[];
}

// Add type for preprocessed text result
interface PreprocessedText {
  rawText: string;
  normalizedText: string;
  metadata: {
    originalFormat: string;
    processingSteps: string[];
    confidence?: number;
    ocrEngine?: string;
    processingTimestamp: string;
    textLength: number;
    lineCount: number;
    hasHeaders: boolean;
    hasFooters: boolean;
    qualityMetrics?: {
      whitespaceRatio: number;
      specialCharRatio: number;
      numericRatio: number;
      potentialOcrErrors: number;
    };
  };
}

// Add these constants at the top of the file after imports
const MAX_RETRIES = 3;
const INITIAL_RETRY_DELAY = 1000; // 1 second
const MAX_RETRY_DELAY = 30000; // 30 seconds

// Add this helper function before the LabUploadService class
async function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Add this helper function before the LabUploadService class
function calculateRetryDelay(retryCount: number): number {
  const delay = Math.min(INITIAL_RETRY_DELAY * Math.pow(2, retryCount), MAX_RETRY_DELAY);
  // Add some jitter to prevent thundering herd
  return delay + Math.random() * 1000;
}

// Add this helper function before the LabUploadService class
async function validateExtractedText(text: string): Promise<boolean> {
  if (!text || text.trim().length === 0) {
    return false;
  }
  
  // Check for minimum content requirements
  const minLength = 50; // Minimum expected text length
  const minWords = 10; // Minimum expected word count
  
  const wordCount = text.split(/\s+/).filter(word => word.length > 0).length;
  
  return text.length >= minLength && wordCount >= minWords;
}

export class LabUploadService {
  private uploadProgress: Map<number, UploadProgress> = new Map();
  private biomarkerExtractionService: BiomarkerExtractionService;

  constructor() {
    this.biomarkerExtractionService = new BiomarkerExtractionService();
  }

  private async validateFile(file: UploadedFile): Promise<void> {
    const allowedTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'image/jpeg',
      'image/png'
    ];

    // Check file size (50MB limit)
    if (file.size > 50 * 1024 * 1024) {
      throw new Error('File size exceeds 50MB limit');
    }

    // Verify file type
    const buffer = file.data;
    const fileType = await fileTypeFromBuffer(buffer);
    
    if (!fileType || !allowedTypes.includes(fileType.mime)) {
      throw new Error(`Unsupported file type: ${fileType?.mime || 'unknown'}`);
    }
  }

  private async saveFile(file: UploadedFile, userId: number): Promise<{ filePath: string; relativeUrl: string }> {
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

    return { filePath, relativeUrl };
  }

  private async createLabResult(
    userId: number,
    file: UploadedFile,
    filePath: string,
    relativeUrl: string
  ): Promise<number> {
    const [result] = await db
      .insert(labResults)
      .values({
        userId,
        fileName: file.name,
        fileType: file.mimetype,
        fileUrl: relativeUrl,
        metadata: {
          size: file.size,
          lastViewed: new Date().toISOString(),
          tags: []
        }
      })
      .returning();

    return result.id;
  }

  private async processLabResult(labResultId: number, filePath: string): Promise<void> {
    let retryCount = 0;
    let lastError: Error | null = null;
    let preprocessedText: PreprocessedText | null = null;

    try {
      // Initialize processing status
      await db
        .insert(biomarkerProcessingStatus)
        .values({
          labResultId,
          status: 'processing',
          startedAt: new Date(),
          metadata: {
            retryCount: 0,
            processingTime: 0
          }
        })
        .onConflictDoUpdate({
          target: biomarkerProcessingStatus.labResultId,
          set: {
            status: 'processing',
            startedAt: new Date(),
            errorMessage: null,
            metadata: {
              retryCount: 0,
              processingTime: 0
            }
          }
        });

      // Update progress
      this.updateProgress(labResultId, {
        status: 'processing',
        progress: 20,
        message: 'Processing lab result...'
      });

      while (retryCount <= MAX_RETRIES) {
        try {
          // Read file buffer
          const fileBuffer = fs.readFileSync(filePath);
          
          // Pre-process the file content
          preprocessedText = await labTextPreprocessingService.preprocessLabText(fileBuffer) as PreprocessedText;
          
          // Validate extracted text
          const isValid = await validateExtractedText(preprocessedText.normalizedText);
          if (!isValid) {
            throw new Error('Extracted text validation failed: insufficient content');
          }

          // Update processing status with text extraction success
          await db
            .update(biomarkerProcessingStatus)
            .set({
              status: 'extracting',
              metadata: {
                textLength: preprocessedText.normalizedText.length,
                retryCount,
                processingTime: Date.now() - new Date().getTime()
              }
            })
            .where(eq(biomarkerProcessingStatus.labResultId, labResultId));

          // Update progress
          this.updateProgress(labResultId, {
            status: 'extracting',
            progress: 50,
            message: 'Extracting biomarkers...'
          });

          // Extract and store biomarkers first
          this.updateProgress(labResultId, {
            status: 'extracting',
            progress: 60,
            message: 'Processing biomarkers...'
          });

          // Process biomarkers with dedicated transaction
          await this.biomarkerExtractionService.processLabResult(labResultId);

          // Update progress for summary generation
          this.updateProgress(labResultId, {
            status: 'summarizing',
            progress: 80,
            message: 'Generating summary...'
          });

          // Generate summary after biomarker processing is complete
          const summary = await labSummaryService.summarizeLabResult(labResultId);

          // Get current metadata to preserve required fields
          const [currentLab] = await db
            .select()
            .from(labResults)
            .where(eq(labResults.id, labResultId))
            .limit(1) as [SelectLabResult | undefined];

          if (!currentLab) {
            throw new Error('Lab result not found during processing');
          }

          // Ensure preprocessedText is not null before accessing its properties
          if (!preprocessedText) {
            throw new Error('Preprocessed text is null');
          }

          // Get biomarker count from the database to update metadata
          const biomarkerCount = await db
            .select({ count: sql`count(*)` })
            .from(biomarkerResults)
            .where(eq(biomarkerResults.labResultId, labResultId))
            .then(res => Number(res[0]?.count || 0));

          // Get stored biomarkers for metadata
          const storedBiomarkers = await db
            .select()
            .from(biomarkerResults)
            .where(eq(biomarkerResults.labResultId, labResultId));

          // Update lab result metadata
          const existingMetadata = (currentLab.metadata || {}) as LabMetadata;
          const updatedMetadata: LabMetadata = {
            size: existingMetadata.size || 0,
            lastViewed: new Date().toISOString(),
            tags: existingMetadata.tags || [],
            preprocessedText: {
              rawText: preprocessedText.rawText,
              normalizedText: preprocessedText.normalizedText,
              processingMetadata: {
                originalFormat: preprocessedText.metadata.originalFormat || 'unknown',
                processingSteps: preprocessedText.metadata.processingSteps || [],
                confidence: preprocessedText.metadata.confidence,
                ocrEngine: preprocessedText.metadata.ocrEngine,
                processingTimestamp: new Date().toISOString(),
                textLength: preprocessedText.normalizedText.length,
                lineCount: preprocessedText.normalizedText.split('\n').length,
                hasHeaders: preprocessedText.metadata.hasHeaders || false,
                hasFooters: preprocessedText.metadata.hasFooters || false,
                qualityMetrics: preprocessedText.metadata.qualityMetrics
              }
            },
            biomarkers: storedBiomarkers.length > 0 ? {
              parsedBiomarkers: storedBiomarkers.map((b: SelectBiomarkerResult) => ({
                name: b.name,
                value: parseFloat(b.value),
                unit: b.unit,
                referenceRange: b.referenceRange || undefined,
                testDate: b.testDate.toISOString(),
                category: b.category
              })),
              parsingErrors: [],
              extractedAt: new Date().toISOString()
            } : undefined,
            summary: summary || undefined,
            summarizedAt: new Date().toISOString()
          };

          await db
            .update(labResults)
            .set({ metadata: updatedMetadata })
            .where(eq(labResults.id, labResultId));

          // Update processing status
          await db
            .update(biomarkerProcessingStatus)
            .set({
              status: 'completed',
              completedAt: new Date(),
              biomarkerCount: biomarkerCount,
              metadata: {
                regexMatches: storedBiomarkers.filter((b: SelectBiomarkerResult) => b.extractionMethod === 'regex').length,
                llmExtractions: storedBiomarkers.filter((b: SelectBiomarkerResult) => b.extractionMethod === 'llm').length,
                processingTime: Date.now() - new Date(currentLab.uploadedAt).getTime(),
                retryCount,
                textLength: preprocessedText.normalizedText.length
              }
            })
            .where(eq(biomarkerProcessingStatus.labResultId, labResultId));

          // Update progress to completed
          this.updateProgress(labResultId, {
            status: 'completed',
            progress: 100,
            message: 'Processing complete'
          });

          // Clean up progress tracking after 5 minutes
          setTimeout(() => {
            this.uploadProgress.delete(labResultId);
          }, 5 * 60 * 1000);

          return; // Success - exit the retry loop

        } catch (error) {
          lastError = error instanceof Error ? error : new Error(String(error));
          retryCount++;

          // Update processing status with retry information
          await db
            .update(biomarkerProcessingStatus)
            .set({
              status: retryCount <= MAX_RETRIES ? 'retrying' : 'error',
              errorMessage: lastError.message,
              metadata: {
                retryCount,
                errorDetails: lastError.stack,
                processingTime: Date.now() - new Date().getTime()
              }
            })
            .where(eq(biomarkerProcessingStatus.labResultId, labResultId));

          if (retryCount <= MAX_RETRIES) {
            const delayMs = calculateRetryDelay(retryCount);
            logger.info(`Retrying lab result processing (attempt ${retryCount}/${MAX_RETRIES})`, {
              labResultId,
              delayMs,
              error: lastError.message
            });

            // Update progress with retry information
            this.updateProgress(labResultId, {
              status: 'retrying',
              progress: Math.max(0, 50 - (retryCount * 10)),
              message: `Retrying processing (attempt ${retryCount}/${MAX_RETRIES})...`
            });

            await delay(delayMs);
            continue;
          }
          break;
        }
      }

      // If we get here, all retries failed
      throw lastError || new Error('Text extraction failed after all retries');

    } catch (error) {
      logger.error('Error processing lab result:', {
        labResultId,
        retryCount,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      });

      // Update progress with error
      this.updateProgress(labResultId, {
        status: 'error',
        progress: 0,
        error: error instanceof Error ? error.message : String(error)
      });

      // Update processing status in database
      await db
        .update(biomarkerProcessingStatus)
        .set({
          status: 'error',
          errorMessage: error instanceof Error ? error.message : String(error),
          completedAt: new Date(),
          metadata: {
            retryCount,
            errorDetails: error instanceof Error ? error.stack : undefined,
            processingTime: Date.now() - new Date().getTime()
          }
        })
        .where(eq(biomarkerProcessingStatus.labResultId, labResultId));

      throw error;
    }
  }

  private updateProgress(labResultId: number, progress: Partial<UploadProgress>): void {
    const current = this.uploadProgress.get(labResultId) || {
      labResultId,
      status: 'uploading',
      progress: 0
    };

    this.uploadProgress.set(labResultId, {
      ...current,
      ...progress
    });
  }

  getUploadProgress(labResultId: number): UploadProgress | undefined {
    return this.uploadProgress.get(labResultId);
  }

  async uploadLabResult(file: UploadedFile, userId: number): Promise<number> {
    try {
      // Check upload limits
      const canUpload = await tierLimitService.canUploadLab(userId);
      if (!canUpload) {
        throw new Error('Lab upload limit reached. Please upgrade your subscription.');
      }

      // Validate file
      await this.validateFile(file);

      // Save file
      const { filePath, relativeUrl } = await this.saveFile(file, userId);

      // Create lab result record
      const labResultId = await this.createLabResult(userId, file, filePath, relativeUrl);

      // Initialize progress tracking
      this.updateProgress(labResultId, {
        status: 'uploading',
        progress: 10,
        message: 'File uploaded, starting processing...'
      });

      // Process in background
      this.processLabResult(labResultId, filePath)
        .catch(error => {
          logger.error('Background processing failed:', {
            labResultId,
            error: error instanceof Error ? error.message : String(error)
          });
        });

      return labResultId;
    } catch (error) {
      logger.error('Error uploading lab result:', {
        userId,
        fileName: file.name,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      });
      throw error;
    }
  }
}

export const labUploadService = new LabUploadService(); 