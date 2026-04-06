import OpenAI from "openai";
import { db } from "../../db";
import { labResults } from "../../db/schema";
import { and, eq, desc } from "drizzle-orm";
import embeddingService from "./embeddingService";
import { biomarkerExtractionService } from "./biomarkerExtractionService";
import logger from "../utils/logger";
import path from "path";
import fs from "fs";
import { fileTypeFromBuffer } from "file-type";
import { getGoogleVisionCredentials } from '../utils/parameterStore';

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

class LabSummaryService {
  // Constants for summarization
  private SUMMARY_MODEL = "gpt-4o-mini";
  private MAX_TOKEN_LIMIT = 16000;
  private MAX_LABS_PER_REQUEST = 50;

  private async getGoogleVisionCredentials(): Promise<any> {
    try {
      const credentialsStr = await getGoogleVisionCredentials();
      return JSON.parse(credentialsStr);
    } catch (error) {
      logger.error('Failed to get Google Vision credentials from Parameter Store:', error);
      throw new Error('Google Vision credentials not available');
    }
  }

  private LAB_SUMMARY_PROMPT = `
  You are a medical assistant helping to summarize lab results. Focus on:

  1. Highlighting key measurements and their values
  2. Noting any abnormal values (high or low) and their significance
  3. Identifying trends if multiple lab results are provided
  4. Extracting the test date and type of lab (blood work, urine analysis, etc.)
  5. Being concise yet comprehensive about important health markers

  Format the summary in a clear, structured way that prioritizes the most clinically significant findings.
  `;

  async summarizeLabResult(labResultId: number): Promise<string | null> {
    try {
      const [labResult] = await db
        .select()
        .from(labResults)
        .where(eq(labResults.id, labResultId))
        .limit(1);

      if (!labResult) {
        logger.error(`Lab result with ID ${labResultId} not found`);
        return null;
      }

      // Clean up the file URL to get the correct path
      const fileName = labResult.fileUrl.replace(/^\/uploads\//, '');
      const filePath = path.join(process.cwd(), 'uploads', fileName);

      // Verify file exists and is accessible
      if (!fs.existsSync(filePath)) {
        logger.error(`Lab result file not found at path: ${filePath}`);
        return null;
      }

      // Read file buffer once and reuse
      const fileBuffer = fs.readFileSync(filePath);
      const fileType = await fileTypeFromBuffer(fileBuffer);

      let textContent = "";

      if (labResult.fileType === 'application/pdf' || (fileType && fileType.mime === 'application/pdf')) {
        try {
          // Dynamically import pdf-parse
          const pdfParse = await import('pdf-parse').then(module => module.default);

          logger.info(`Processing PDF file: ${filePath}`, {
            fileSize: fileBuffer.length,
            fileName: labResult.fileName
          });

          // Parse PDF directly from buffer
          const pdfData = await pdfParse(fileBuffer, {
            max: 0,
            version: 'v1.10.100' // Force specific PDF.js version
          });

          textContent = pdfData.text;

          if (!textContent || textContent.trim().length === 0) {
            throw new Error('PDF parsing produced empty text content');
          }

          // Extract biomarkers in parallel with other processing
          const biomarkerPromise = biomarkerExtractionService.extractBiomarkers(textContent)
            .then(async (biomarkerResults) => {
              logger.info(`Extracted biomarkers for lab result ${labResultId}`, {
                biomarkerCount: biomarkerResults.parsedBiomarkers.length
              });
              return biomarkerResults;
            })
            .catch(error => {
              logger.error(`Error extracting biomarkers for lab result ${labResultId}:`, error);
              return null;
            });

          // Wait for biomarker extraction before updating metadata
          const biomarkerResults = await biomarkerPromise;
          
          // Explicitly process biomarkers and store them in the database
          try {
            await biomarkerExtractionService.processLabResult(labResultId);
            logger.info(`Successfully processed biomarkers for PDF lab ${labResultId}`);
          } catch (error) {
            logger.error(`Error processing biomarkers for PDF lab ${labResultId}:`, error);
          }

          // Single metadata update that includes both parsed text and biomarkers
          await db
            .update(labResults)
            .set({
              metadata: {
                ...labResult.metadata,
                parsedText: textContent,
                parseDate: new Date().toISOString(),
                biomarkers: biomarkerResults ? {
                  ...biomarkerResults,
                  extractedAt: new Date().toISOString()
                } : undefined
              }
            })
            .where(eq(labResults.id, labResultId));

          // Log the update for verification
          logger.info(`Updated lab result ${labResultId} metadata:`, {
            hasBiomarkers: !!biomarkerResults,
            biomarkerCount: biomarkerResults?.parsedBiomarkers?.length || 0,
            parseDate: new Date().toISOString()
          });

          logger.info(`Successfully parsed PDF for lab result ${labResultId}`, {
            textLength: textContent.length,
            hasBiomarkers: !!biomarkerResults
          });
        } catch (error) {
          logger.error('Error parsing PDF:', {
            error: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined,
            filePath,
            fileName: labResult.fileName,
            fileUrl: labResult.fileUrl,
            timestamp: new Date().toISOString()
          });

          // Fallback to basic metadata
          textContent = `Lab result file: ${labResult.fileName}, uploaded on ${new Date(labResult.uploadedAt).toLocaleDateString()}. 
          File type: PDF. This is a PDF document that could not be parsed. Notes: ${labResult.notes || "No notes provided"}`;
        }
      } else if (labResult.fileType.startsWith('image/') || (fileType && fileType.mime && fileType.mime.startsWith('image/'))) {
        try {
          logger.info(`Starting OCR processing for lab result ${labResultId}`, {
            fileName: labResult.fileName,
            fileType: labResult.fileType,
            fileSize: fileBuffer.length
          });

          const { ImageAnnotatorClient } = await import('@google-cloud/vision');
          const credentials = await this.getGoogleVisionCredentials();
          const client = new ImageAnnotatorClient({
            credentials
          });

          // Configure options for better handling of medical data
          const request = {
            image: {
              content: fileBuffer.toString('base64')
            },
            imageContext: {
              languageHints: ['en'], // English language hint
              textDetectionParams: {
                enableTextDetectionConfidenceScore: true
              }
            }
          };

          const [result] = await client.documentTextDetection(request);
          const text = result.fullTextAnnotation?.text || '';
          const confidence = result.fullTextAnnotation?.pages?.[0]?.confidence || 0;

          // Log detailed OCR results to help debug recognition issues
          logger.info(`Detailed OCR results for lab ${labResultId}:`, {
            rawText: text,
            textByLines: text.split('\n').map((line: string) => line.trim()).filter(Boolean),
            characterCount: text.length,
            lineCount: text.split('\n').length
          });

          // Log full OCR results for debugging
          logger.info(`Full OCR results for lab ${labResultId}:`, {
            text: text,
            textLength: text ? text.length : 0,
            hasContent: !!text,
            timestamp: new Date().toISOString()
          });

          // Log first and last 500 characters to verify content boundaries
          logger.info(`OCR content boundaries for lab ${labResultId}:`, {
            start: text.substring(0, 500),
            end: text.substring(Math.max(0, text.length - 500)),
            totalLength: text.length
          });

          if (!text || text.trim().length === 0) {
            throw new Error('OCR produced empty text content');
          }

          textContent = text;

          // Verify text was extracted
          logger.info(`OCR text content sample for lab result ${labResultId}:`, {
            sample: text.substring(0, 100), // Log first 100 chars
            fullLength: text.length
          });

          // First update the metadata with text content
          await db
            .update(labResults)
            .set({
              metadata: {
                ...labResult.metadata,
                ocr: {
                  text: textContent,
                  processedAt: new Date().toISOString(),
                  confidence: confidence * 100,
                  engineVersion: 'google-vision',
                  parameters: {
                    language: 'en',
                    mode: 'document'
                  }
                }
              }
            })
            .where(eq(labResults.id, labResultId));

          // Then explicitly process biomarkers and await it
          try {
            await biomarkerExtractionService.processLabResult(labResultId);
            logger.info(`Successfully processed biomarkers for lab ${labResultId}`);
          } catch (error) {
            logger.error(`Error processing biomarkers for lab ${labResultId}:`, error);
          }

          // Store OCR text in metadata with standardized structure
          await db
            .update(labResults)
            .set({
              metadata: {
                ...labResult.metadata,
                size: fileBuffer.length,
                ocr: {
                  text: textContent,
                  processedAt: new Date().toISOString(),
                  confidence: confidence * 100, // Convert to percentage
                  engineVersion: 'google-vision',
                  parameters: {
                    language: 'en',
                    mode: 'document'
                  }
                },
                extractedText: textContent,
                extractionMethod: 'google-vision',
                extractionDate: new Date().toISOString()
              }
            })
            .where(eq(labResults.id, labResultId));

          // Extract biomarkers from OCR text
          const biomarkerResults = await biomarkerExtractionService.extractBiomarkers(text)
            .then(async (results) => {
              logger.info(`Extracted biomarkers for OCR lab result ${labResultId}`, {
                biomarkerCount: results.parsedBiomarkers.length
              });
              return results;
            })
            .catch(error => {
              logger.error(`Error extracting biomarkers for OCR lab result ${labResultId}:`, error);
              return null;
            });
          if (biomarkerResults) {
            await db
              .update(labResults)
              .set({
                metadata: {
                  ...labResult.metadata,
                  size: fileBuffer.length,
                  ocr: {
                    text: textContent,
                    processedAt: new Date().toISOString(),
                    confidence: confidence * 100,
                    engineVersion: 'google-vision',
                    parameters: {
                      language: 'en',
                      mode: 'document'
                    }
                  },
                  extractedText: textContent,
                  extractionMethod: 'google-vision',
                  extractionDate: new Date().toISOString(),
                  biomarkers: {
                    parsedBiomarkers: biomarkerResults.parsedBiomarkers,
                    parsingErrors: biomarkerResults.parsingErrors,
                    extractedAt: new Date().toISOString()
                  }
                }
              })
              .where(eq(labResults.id, labResultId));
          }

          logger.info(`Successfully extracted and stored OCR text for lab result ${labResultId}`, {
            textLength: text.length,
            method: 'ocr',
            hasBiomarkers: !!biomarkerResults
          });

          logger.info(`Successfully extracted text from image for lab result ${labResultId}`, {
            textLength: text.length
          });
        } catch (ocrError) {
          logger.error('Error performing OCR on image:', {
            error: ocrError instanceof Error ? ocrError.message : String(ocrError),
            stack: ocrError instanceof Error ? ocrError.stack : undefined,
            filePath,
            fileName: labResult.fileName
          });

          textContent = `Image lab result: ${labResult.fileName}, uploaded on ${new Date(labResult.uploadedAt).toLocaleDateString()}. 
          File type: ${labResult.fileType}. OCR processing failed. Notes: ${labResult.notes || "No notes provided"}`;
        }
      } else if (
        labResult.fileType === 'application/msword' ||
        labResult.fileType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      ) {
        textContent = `Document lab result: ${labResult.fileName}, uploaded on ${new Date(labResult.uploadedAt).toLocaleDateString()}. 
        This is a document file that contains lab results. The file type is ${labResult.fileType}.`;
      } else {
        textContent = `Lab result file: ${labResult.fileName}, uploaded on ${new Date(labResult.uploadedAt).toLocaleDateString()}. 
        File type: ${labResult.fileType}. Notes: ${labResult.notes || "No notes provided"}`;
      }

      if (labResult.notes) {
        textContent += `\n\nUser notes: ${labResult.notes}`;
      }

      const completion = await openai.chat.completions.create({
        model: this.SUMMARY_MODEL,
        messages: [
          {
            role: "system",
            content: this.LAB_SUMMARY_PROMPT
          },
          {
            role: "user",
            content: `Here is a lab result to summarize:\n\n${textContent}`
          }
        ],
        max_tokens: 1000
      });

      const summaryContent = completion.choices[0]?.message?.content?.trim() || 'No summary generated.';

      await db
        .update(labResults)
        .set({
          metadata: {
            ...labResult.metadata,
            size: labResult.metadata?.size || 0,
            summary: summaryContent,
            summarizedAt: new Date().toISOString()
          }
        })
        .where(eq(labResults.id, labResultId));

      await embeddingService.createLabEmbedding(labResultId, summaryContent);

      logger.info(`Generated summary for lab result ${labResultId}`);
      return summaryContent;

    } catch (error) {
      logger.error(`Error summarizing lab result ${labResultId}:`, {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        timestamp: new Date().toISOString()
      });
      return null;
    }
  }

  async getUserLabSummaries(userId: number, limit: number = 5): Promise<any[]> {
    try {
      const userLabResults = await db
        .select()
        .from(labResults)
        .where(eq(labResults.userId, userId))
        .orderBy(desc(labResults.uploadedAt))
        .limit(limit);

      const summaries = [];

      for (const labResult of userLabResults) {
        if (labResult.metadata && labResult.metadata.summary) {
          summaries.push({
            id: labResult.id,
            fileName: labResult.fileName,
            uploadedAt: labResult.uploadedAt,
            summary: labResult.metadata.summary
          });
        } else {
          const summary = await this.summarizeLabResult(labResult.id);
          if (summary) {
            summaries.push({
              id: labResult.id,
              fileName: labResult.fileName,
              uploadedAt: labResult.uploadedAt,
              summary
            });
          }
        }
      }

      return summaries;
    } catch (error) {
      logger.error(`Error fetching lab summaries for user ${userId}:`, error);
      return [];
    }
  }

  async findRelevantLabResults(userId: number, query: string, limit: number = 3): Promise<any[]> {
    try {
      const recentLabs = await db
        .select()
        .from(labResults)
        .where(
          and(
            eq(labResults.userId, userId)
          )
        )
        .orderBy(desc(labResults.uploadedAt))
        .limit(limit);

      for (const lab of recentLabs) {
        if (!lab.metadata?.summary) {
          this.summarizeLabResult(lab.id)
            .then(() => {
              logger.info(`Background summary generated for lab ${lab.id}`);
            })
            .catch(error => {
              logger.error(`Error generating background summary for lab ${lab.id}:`, error);
            });
        }
      }

      return recentLabs;
    } catch (error) {
      logger.error('Error finding relevant lab results:', error);
      return [];
    }
  }
}

// Export a singleton instance with consistent naming
export const labSummaryService = new LabSummaryService();
export default labSummaryService;