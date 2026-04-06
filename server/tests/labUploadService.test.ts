/**
    * @description      : 
    * @author           : 
    * @group            : 
    * @created          : 17/05/2025 - 20:37:44
    * 
    * MODIFICATION LOG
    * - Version         : 1.0.0
    * - Date            : 17/05/2025
    * - Author          : 
    * - Modification    : 
**/
import { labUploadService } from '../services/labUploadService';
import { labTextPreprocessingService } from '../services/labTextPreprocessingService';
import { BiomarkerExtractionService } from '../services/biomarkerExtractionService';
import { labSummaryService } from '../services/labSummaryService';
import { db } from '../../db';
import { labResults, biomarkerProcessingStatus } from '../../db/schema';
import { eq } from 'drizzle-orm';
import path from 'path';
import fs from 'fs';
import logger from '../utils/logger';
import { fileTypeFromBuffer } from 'file-type';

// Create a mock instance of BiomarkerExtractionService
const mockBiomarkerExtractionService = {
  extractBiomarkers: jest.fn()
};

// Mock the dependent services
jest.mock('../services/labTextPreprocessingService', () => ({
  labTextPreprocessingService: {
    preprocessLabText: jest.fn()
  }
}));

jest.mock('../services/biomarkerExtractionService', () => ({
  BiomarkerExtractionService: jest.fn().mockImplementation(() => mockBiomarkerExtractionService)
}));

jest.mock('../services/labSummaryService', () => ({
  labSummaryService: {
    summarizeLabResult: jest.fn()
  }
}));

// Mock the database
jest.mock('../../db', () => ({
  db: {
    insert: jest.fn(),
    update: jest.fn(),
    select: jest.fn(),
    query: {
      labResults: {
        findFirst: jest.fn()
      }
    }
  }
}));

describe('LabUploadService Tests', () => {
  const testUserId = 999;
  const testLabResultId = 123;
  let createdLabResultIds: number[] = [];
  const uploadDir = path.join(process.cwd(), 'uploads');

  // Clean up test data after running tests
  afterAll(async () => {
    try {
      // Remove test lab results
      for (const id of createdLabResultIds) {
        await db.delete(labResults).where(eq(labResults.id, id));
        await db.delete(biomarkerProcessingStatus).where(eq(biomarkerProcessingStatus.labResultId, id));
      }
      logger.info(`Cleaned up ${createdLabResultIds.length} test lab results`);

      // Clean up test files
      if (fs.existsSync(uploadDir)) {
        const files = fs.readdirSync(uploadDir);
        for (const file of files) {
          if (file.startsWith('test-')) {
            fs.unlinkSync(path.join(uploadDir, file));
          }
        }
      }
    } catch (err) {
      logger.error(`Failed to clean up test data: ${err}`);
    }
  });

  beforeEach(() => {
    jest.clearAllMocks();
    // Reset mock implementations
    (labTextPreprocessingService.preprocessLabText as jest.Mock).mockReset();
    mockBiomarkerExtractionService.extractBiomarkers.mockReset();
    (labSummaryService.summarizeLabResult as jest.Mock).mockReset();
  });

  beforeAll(() => {
    // (Dummy call so that fileTypeFromBuffer is "used" (and "file-type" is "loaded"))
    (async () => { await fileTypeFromBuffer(Buffer.from('dummy')); })();
  });

  test('Should successfully process a lab result through the entire pipeline', async () => {
    // Mock file data
    const mockFile = {
      name: 'test-lab-result.pdf',
      data: Buffer.from('test lab data'),
      size: 1024,
      encoding: '7bit',
      tempFilePath: '/tmp/test.pdf',
      truncated: false,
      mimetype: 'application/pdf',
      md5: 'test-md5',
      mv: jest.fn().mockResolvedValue(undefined)
    };

    // Mock database responses
    (db.insert as jest.Mock).mockReturnValue({
      values: jest.fn().mockReturnValue({
        returning: jest.fn().mockResolvedValue([{ id: testLabResultId }])
      })
    });

    (db.select as jest.Mock).mockReturnValue({
      from: jest.fn().mockReturnValue({
        where: jest.fn().mockReturnValue({
          limit: jest.fn().mockResolvedValue([{
            id: testLabResultId,
            metadata: { size: 1024 }
          }])
        })
      })
    });

    // Mock preprocessing result
    const mockPreprocessedText = {
      rawText: 'Raw lab text',
      normalizedText: 'Normalized lab text',
      metadata: { pageCount: 1 }
    };
    (labTextPreprocessingService.preprocessLabText as jest.Mock).mockResolvedValue(mockPreprocessedText);

    // Mock biomarker extraction result
    const mockBiomarkers = {
      parsedBiomarkers: [
        {
          name: 'cholesterol',
          value: 180,
          unit: 'mg/dL',
          referenceRange: '100-200',
          testDate: new Date().toISOString(),
          category: 'lipid'
        }
      ],
      parsingErrors: []
    };
    mockBiomarkerExtractionService.extractBiomarkers.mockResolvedValue(mockBiomarkers);

    // Mock summary result
    const mockSummary = 'Test summary of lab results';
    (labSummaryService.summarizeLabResult as jest.Mock).mockResolvedValue(mockSummary);

    // Upload and process the file
    const labResultId = await labUploadService.uploadLabResult(mockFile as any, testUserId);
    createdLabResultIds.push(labResultId);

    // Wait for processing to complete (give it some time)
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Verify the pipeline steps
    expect(labTextPreprocessingService.preprocessLabText).toHaveBeenCalled();
    expect(mockBiomarkerExtractionService.extractBiomarkers).toHaveBeenCalledWith(mockPreprocessedText.normalizedText);
    expect(labSummaryService.summarizeLabResult).toHaveBeenCalledWith(labResultId);

    // Verify database updates
    expect(db.update).toHaveBeenCalledWith(labResults);
    const updateCall = (db.update as jest.Mock).mock.calls.find(call => call[0] === labResults);
    expect(updateCall).toBeDefined();

    // Verify the final metadata structure
    const updateData = updateCall[1].set.metadata;
    expect(updateData).toMatchObject({
      size: 1024,
      preprocessedText: {
        rawText: mockPreprocessedText.rawText,
        normalizedText: mockPreprocessedText.normalizedText,
        processingMetadata: mockPreprocessedText.metadata
      },
      biomarkers: {
        parsedBiomarkers: mockBiomarkers.parsedBiomarkers,
        parsingErrors: mockBiomarkers.parsingErrors,
        extractedAt: expect.any(String)
      },
      summary: mockSummary,
      summarizedAt: expect.any(String)
    });

    // Verify progress tracking
    const progress = labUploadService.getUploadProgress(labResultId);
    expect(progress).toBeDefined();
    expect(progress?.status).toBe('completed');
    expect(progress?.progress).toBe(100);
  });

  test('Should handle processing errors gracefully', async () => {
    // Mock file data
    const mockFile = {
      name: 'test-error.pdf',
      data: Buffer.from('test error data'),
      size: 1024,
      encoding: '7bit',
      tempFilePath: '/tmp/test-error.pdf',
      truncated: false,
      mimetype: 'application/pdf',
      md5: 'test-md5-error',
      mv: jest.fn().mockResolvedValue(undefined)
    };

    // Mock database responses
    (db.insert as jest.Mock).mockReturnValue({
      values: jest.fn().mockReturnValue({
        returning: jest.fn().mockResolvedValue([{ id: testLabResultId + 1 }])
      })
    });

    // Mock preprocessing to throw an error
    (labTextPreprocessingService.preprocessLabText as jest.Mock).mockRejectedValue(
      new Error('Test preprocessing error')
    );

    // Upload the file
    const labResultId = await labUploadService.uploadLabResult(mockFile as any, testUserId);
    createdLabResultIds.push(labResultId);

    // Wait for processing to complete
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Verify error handling
    const progress = labUploadService.getUploadProgress(labResultId);
    expect(progress).toBeDefined();
    expect(progress?.status).toBe('error');
    expect(progress?.error).toContain('Test preprocessing error');

    // Verify error was recorded in database
    expect(db.update).toHaveBeenCalledWith(biomarkerProcessingStatus);
    const statusUpdateCall = (db.update as jest.Mock).mock.calls.find(
      call => call[0] === biomarkerProcessingStatus
    );
    expect(statusUpdateCall).toBeDefined();
    expect(statusUpdateCall[1].set.status).toBe('error');
    expect(statusUpdateCall[1].set.errorMessage).toContain('Test preprocessing error');
  });

  test('Should validate file types and sizes', async () => {
    const invalidFile = {
      name: 'test.txt',
      data: Buffer.from('test data'),
      size: 60 * 1024 * 1024, // 60MB
      encoding: '7bit',
      tempFilePath: '/tmp/test.txt',
      truncated: false,
      mimetype: 'text/plain',
      md5: 'test-md5',
      mv: jest.fn()
    };

    // Test file size validation
    await expect(
      labUploadService.uploadLabResult(invalidFile as any, testUserId)
    ).rejects.toThrow('File size exceeds 50MB limit');

    // Test file type validation
    const invalidTypeFile = {
      ...invalidFile,
      size: 1024,
      mimetype: 'application/x-executable'
    };

    await expect(
      labUploadService.uploadLabResult(invalidTypeFile as any, testUserId)
    ).rejects.toThrow('Unsupported file type');
  });
}); 