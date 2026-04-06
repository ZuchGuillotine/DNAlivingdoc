/**
 * @description      : Service for pre-processing and normalizing text from lab reports
 * @author           : 
 * @group            : 
 * @created          : 17/05/2025 - 01:24:23
 * 
 * MODIFICATION LOG
 * - Version         : 1.0.0
 * - Date            : 17/05/2025
 * - Author          : 
 * - Modification    : Initial implementation
**/

import { z } from 'zod';
import logger from '../utils/logger';
import mammoth from 'mammoth';
import { ImageAnnotatorClient } from '@google-cloud/vision';
import { fileTypeFromBuffer } from 'file-type';
import { getGoogleVisionCredentials } from '../utils/parameterStore';

// Define the schema for pre-processed text output
const PreprocessedTextSchema = z.object({
  rawText: z.string(),
  normalizedText: z.string(),
  metadata: z.object({
    originalFormat: z.string(),
    processingSteps: z.array(z.string()),
    confidence: z.number().optional(),
    ocrEngine: z.string().optional(),
    processingTimestamp: z.string(),
    textLength: z.number(),
    lineCount: z.number(),
    hasHeaders: z.boolean(),
    hasFooters: z.boolean(),
    qualityMetrics: z.object({
      whitespaceRatio: z.number(),
      specialCharRatio: z.number(),
      numericRatio: z.number(),
      potentialOcrErrors: z.number()
    }).optional()
  })
});

type PreprocessedText = z.infer<typeof PreprocessedTextSchema>;

// Common OCR error corrections
const OCR_CORRECTIONS: Record<string, string> = {
  'l': '1', // lowercase L to 1
  'O': '0', // uppercase O to 0
  'o': '0', // lowercase o to 0
  'I': '1', // uppercase I to 1
  'i': '1', // lowercase i to 1
  'rn': 'm', // rn to m
  'cl': 'd', // cl to d
  'vv': 'w', // vv to w
};

// Common lab report phrases to standardize
const PHRASE_STANDARDIZATION: Record<string, string> = {
  'Reference Range:': 'Reference Range:',
  'Ref Range:': 'Reference Range:',
  'Normal Range:': 'Reference Range:',
  'Normal Values:': 'Reference Range:',
  'Test Results:': 'Results:',
  'Lab Results:': 'Results:',
  'Test Date:': 'Date:',
  'Collection Date:': 'Date:',
  'Specimen Date:': 'Date:',
  'Patient Name:': 'Name:',
  'Patient ID:': 'ID:',
  'Medical Record Number:': 'MRN:',
  'DOB:': 'Date of Birth:',
  'Birth Date:': 'Date of Birth:',
};

// Common headers and footers to remove
/* const HEADER_FOOTER_PATTERNS = [
  /^Page \d+ of \d+$/i,
  /^Confidential.*$/i,
  /^©.*Laboratory.*$/i,
  /^.*Laboratory Report.*$/i,
  /^.*All rights reserved.*$/i,
  /^.*Page \d+.*$/i,
  /^.*Generated on:.*$/i,
  /^.*Report Date:.*$/i,
]; */

interface QualityMetrics {
  confidence: number;
  medicalTermCount: number;
  numericValueCount: number;
  unitConsistencyScore: number;
  whitespaceRatio: number;
  specialCharRatio: number;
  numericRatio: number;
  potentialOcrErrors: number;
  overallQualityScore: number;
}

interface QualityScores {
  confidence: number;
  medicalTermCount: number;
  numericValueCount: number;
  unitConsistencyScore: number;
  whitespaceRatio: number;
  specialCharRatio: number;
  numericRatio: number;
  [key: string]: number; // Add index signature
}

// Add new utility for PDF column reflow
interface ReflowedLine {
  biomarker: string;
  value: string;
  unit: string;
  status?: string;
  referenceRange?: string;
  lineNumber: number;
  confidence: number; // Add confidence score
}

export class LabTextPreprocessingService {
  private async processPdf(buffer: Buffer): Promise<PreprocessedText> {
    const extractionAttempts: Array<{method: string, text: string | null, error?: string}> = [];
    
    // Method 1: Standard pdf-parse with enhanced options
    try {
      const pdfParse = await import('pdf-parse').then(module => module.default);
      const pdfData = await pdfParse(buffer, {
        max: 0,
        version: 'v1.10.100',
        pagerender: (pageData: any) => {
          const textContent = pageData.getTextContent();
          const textItems = textContent.items.map((item: any) => ({
            text: item.str || '',
            x: item.transform[4],
            y: item.transform[5]
          }));

          // Sort items by position (top to bottom, left to right)
          textItems.sort((a: any, b: any) => {
            if (Math.abs(a.y - b.y) < 5) { // Same line
              return a.x - b.x;
            }
            return b.y - a.y; // Different lines
          });

          // Join text with proper spacing
          let lastY = -1;
          let lastX = -1;
          const lines: string[] = [];
          let currentLine = '';

          for (const item of textItems) {
            if (lastY !== -1 && Math.abs(item.y - lastY) > 5) {
              if (currentLine) {
                lines.push(currentLine.trim());
                currentLine = '';
              }
            } else if (lastX !== -1 && (item.x - lastX) > 20) {
              currentLine += ' ';
            }
            currentLine += item.text;
            lastY = item.y;
            lastX = item.x + (item.text.length * 5);
          }

          if (currentLine) {
            lines.push(currentLine.trim());
          }

          return lines.join('\n');
        }
      });

      const text = pdfData.text;
      if (text && text.trim().length > 0) {
        extractionAttempts.push({
          method: 'pdf-parse-enhanced',
          text: text
        });
        logger.info('PDF text extraction successful with enhanced pdf-parse', {
          method: 'pdf-parse-enhanced',
          textLength: text.length,
          pageCount: pdfData.numpages
        });
        return this.normalizeText(text, 'pdf');
      }
    } catch (error) {
      extractionAttempts.push({
        method: 'pdf-parse-enhanced',
        text: null,
        error: error instanceof Error ? error.message : String(error)
      });
      logger.warn('Enhanced pdf-parse extraction failed', {
        method: 'pdf-parse-enhanced',
        error: error instanceof Error ? error.message : String(error)
      });
    }

    // Method 2: Basic pdf-parse without custom renderer
    try {
      const pdfParse = await import('pdf-parse').then(module => module.default);
      const pdfData = await pdfParse(buffer, {
        max: 0,
        version: 'v1.10.100'
      });

      const text = pdfData.text;
      if (text && text.trim().length > 0) {
        extractionAttempts.push({
          method: 'pdf-parse-basic',
          text: text
        });
        logger.info('PDF text extraction successful with basic pdf-parse', {
          method: 'pdf-parse-basic',
          textLength: text.length,
          pageCount: pdfData.numpages
        });
        return this.normalizeText(text, 'pdf');
      }
    } catch (error) {
      extractionAttempts.push({
        method: 'pdf-parse-basic',
        text: null,
        error: error instanceof Error ? error.message : String(error)
      });
      logger.warn('Basic pdf-parse extraction failed', {
        method: 'pdf-parse-basic',
        error: error instanceof Error ? error.message : String(error)
      });
    }

    // Method 3: Try OCR as last resort using existing Google Vision infrastructure
    try {
      // Convert PDF to base64 for OCR
      const base64Pdf = buffer.toString('base64');
      
      // Use our existing OCR infrastructure
      const credentialsStr = await getGoogleVisionCredentials();
      const credentials = JSON.parse(credentialsStr);
      const client = new ImageAnnotatorClient({ credentials });

      // Enhanced OCR configuration for PDF documents
      const [result] = await client.documentTextDetection({
        image: { content: base64Pdf },
        imageContext: {
          languageHints: ['en'],
          textDetectionParams: {
            enableTextDetectionConfidenceScore: true
          },
          // Simplified crop hints for better compatibility  
          cropHintsParams: {
            aspectRatios: [1.0, 1.414, 0.707] // Square, A4 portrait, A4 landscape
          }
        }
      });

      const fullText = result.fullTextAnnotation?.text || '';
      const confidence = result.fullTextAnnotation?.pages?.[0]?.confidence || 0;

      if (fullText && fullText.trim().length > 0) {
        extractionAttempts.push({
          method: 'ocr-fallback',
          text: fullText
        });
        logger.info('PDF text extraction successful with OCR fallback', {
          method: 'ocr-fallback',
          textLength: fullText.length,
          confidence
        });

        // Use our existing image processing pipeline for OCR text
        return this.normalizeText(fullText, 'pdf', {
          confidence,
          ocrEngine: 'google-vision',
          qualityMetrics: this.calculateQualityMetrics(fullText, {
            confidence,
            medicalTerms: this.countMedicalTerms(fullText),
            numericValues: this.countNumericValues(fullText),
            unitConsistency: this.checkUnitConsistency(fullText)
          })
        });
      }
    } catch (error) {
      extractionAttempts.push({
        method: 'ocr-fallback',
        text: null,
        error: error instanceof Error ? error.message : String(error)
      });
      logger.warn('OCR fallback extraction failed', {
        method: 'ocr-fallback',
        error: error instanceof Error ? error.message : String(error)
      });
    }

    // If all methods failed, log detailed attempt information and throw error
    logger.error('All PDF text extraction methods failed', {
      attempts: extractionAttempts,
      bufferSize: buffer.length
    });
    
    throw new Error('PDF text extraction failed - all methods exhausted');
  }

  private preprocessPdfText(text: string): string {
    // Split into lines for processing
    const lines = text.split('\n');
    const processedLines: string[] = [];
    
    // Track if we're in a biomarker section
    let inBiomarkerSection = false;
    let currentBiomarker: string | null = null;
    let currentValue: string | null = null;
    let currentRange: string | null = null;
    let currentUnit: string | null = null;
    
    for (let i = 0; i < lines.length; i++) {
      let line = lines[i].trim();
      
      // Skip empty lines
      if (!line) continue;
      
      /* // Detect biomarker section start
      if (line.match(/^(?:Results|Test Results|Lab Results|Biomarkers|Blood Work|COMPREHENSIVE METABOLIC PANEL)/i)) {
        inBiomarkerSection = true;
        processedLines.push(line); // Keep the section header
        continue;
      }
      
      if (inBiomarkerSection) {
        // Look for biomarker names (usually followed by values or ranges)
        if (line.match(/^[A-Za-z][A-Za-z\s]+(?:[A-Za-z])?$/) && !line.match(/^(?:Normal|Reference|Range|High|Low)$/i)) {
          // If we have a pending biomarker, add it
          if (currentBiomarker && (currentValue || currentRange)) {
            const parts = [
              currentBiomarker,
              currentValue ? `: ${currentValue}` : '',
              currentUnit ? ` ${currentUnit}` : '',
              currentRange ? ` (${currentRange})` : ''
            ].filter(Boolean);
            processedLines.push(parts.join(''));
          }
          
          currentBiomarker = line;
          currentValue = null;
          currentRange = null;
          currentUnit = null;
          continue;
        }
        
        // Look for reference ranges
        const rangeMatch = line.match(/(?:Normal|Reference) range:?\s*([\d\.]+\s*-\s*[\d\.]+)\s*(mg\/dL|mmol\/L|g\/dL|g\/L|ng\/mL|µg\/L|IU\/L|mEq\/L|mm³|µL|nL|pL|fL|%|U\/L)?/i);
        if (rangeMatch) {
          currentRange = rangeMatch[1];
          if (rangeMatch[2]) currentUnit = rangeMatch[2];
          continue;
        }
        
        // Look for values (numbers with optional units)
        const valueMatch = line.match(/(\d+(?:\.\d+)?)\s*(mg\/dL|mmol\/L|g\/dL|g\/L|ng\/mL|µg\/L|IU\/L|mEq\/L|mm³|µL|nL|pL|fL|%|U\/L)?/i);
        if (valueMatch && currentBiomarker) {
          currentValue = valueMatch[1];
          if (valueMatch[2]) currentUnit = valueMatch[2];
          // Add the biomarker with its value
          const parts = [
            currentBiomarker,
            `: ${currentValue}`,
            currentUnit ? ` ${currentUnit}` : '',
            currentRange ? ` (${currentRange})` : ''
          ].filter(Boolean);
          processedLines.push(parts.join(''));
          currentBiomarker = null;
          currentValue = null;
          currentRange = null;
          currentUnit = null;
          continue;
        }
      } */
      
      // Add non-biomarker lines as is
      processedLines.push(line);
    }
    
    // Add any pending biomarker
    if (currentBiomarker && (currentValue || currentRange)) {
      const parts = [
        currentBiomarker,
        currentValue ? `: ${currentValue}` : '',
        currentUnit ? ` ${currentUnit}` : '',
        currentRange ? ` (${currentRange})` : ''
      ].filter(Boolean);
      processedLines.push(parts.join(''));
    }
    
    const processedText = processedLines.join('\n');
    
    // Log the processed text for debugging
    logger.info('PDF text preprocessing complete', {
      originalLength: text.length,
      processedLength: processedText.length,
      sampleText: processedText.substring(0, 200)
    });
    
    return processedText;
  }

  private async processDocx(buffer: Buffer): Promise<PreprocessedText> {
    try {
      const result = await mammoth.extractRawText({ buffer });
      return this.normalizeText(result.value, 'docx');
    } catch (error) {
      logger.error('Error processing DOCX:', error);
      throw new Error('Failed to process DOCX file');
    }
  }

  private async processImage(buffer: Buffer): Promise<PreprocessedText> {
    logger.info('Starting image processing with Google Vision OCR', {
      bufferSize: buffer.length,
      timestamp: new Date().toISOString()
    });

    try {
      // Get Google Vision credentials from Parameter Store or environment
      let credentials;
      try {
        const credentialsStr = await getGoogleVisionCredentials();
        credentials = JSON.parse(credentialsStr);
        logger.info('Successfully obtained Google Vision credentials');
      } catch (error) {
        logger.error('Failed to get Google Vision credentials:', {
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined
        });
        throw new Error('Google Vision credentials not available');
      }
      
      const client = new ImageAnnotatorClient({ credentials });

      let result;
      let ocrMethod = 'document_text_detection';
      
      try {
        // Try enhanced document text detection first
        logger.info('Attempting enhanced document text detection');
        [result] = await client.documentTextDetection({
          image: { content: buffer.toString('base64') },
          imageContext: {
            languageHints: ['en'],
            textDetectionParams: {
              enableTextDetectionConfidenceScore: true
            },
            // Simplified crop hints for better compatibility
            cropHintsParams: {
              aspectRatios: [1.0, 1.414, 0.707] // Square, A4 portrait, A4 landscape
            }
          }
        });
      } catch (enhancedError) {
        logger.warn('Enhanced document text detection failed, trying basic text detection:', {
          error: enhancedError instanceof Error ? enhancedError.message : String(enhancedError)
        });
        
        try {
          // Fallback to basic text detection
          ocrMethod = 'text_detection';
          [result] = await client.textDetection({
            image: { content: buffer.toString('base64') }
          });
        } catch (basicError) {
          logger.error('Both OCR methods failed:', {
            enhancedError: enhancedError instanceof Error ? enhancedError.message : String(enhancedError),
            basicError: basicError instanceof Error ? basicError.message : String(basicError)
          });
          throw basicError;
        }
      }

      const rawText = result.fullTextAnnotation?.text || '';
      const confidence = result.fullTextAnnotation?.pages?.[0]?.confidence || 0;
      
      logger.info('Google Vision OCR completed', {
        ocrMethod,
        textLength: rawText.length,
        confidence,
        hasText: rawText.length > 0,
        textSample: rawText.substring(0, 100)
      });

      if (!rawText || rawText.trim().length === 0) {
        logger.warn('Google Vision OCR returned empty text');
        throw new Error('OCR extraction returned no text content');
      }
      
      // Enhanced OCR error corrections for medical documents
      const medicalOcrCorrections: Record<string, string> = {
        ...OCR_CORRECTIONS,
        // Medical-specific corrections
        'mg/dl': 'mg/dL',
        'mmol/l': 'mmol/L',
        'ng/ml': 'ng/mL',
        'ug/l': 'µg/L',
        'iu/l': 'IU/L',
        'mcg/l': 'µg/L',
        'mcg/dl': 'µg/dL',
        'meq/l': 'mEq/L',
        'mm3': 'mm³',
        'ul': 'µL',
        'nl': 'nL',
        'pl': 'pL',
        'fl': 'fL',
        // Common medical OCR errors
        'hemoglobin': 'Hemoglobin',
        'hematocrit': 'Hematocrit',
        'glucose': 'Glucose',
        'cholesterol': 'Cholesterol',
        'triglycerides': 'Triglycerides',
        'creatinine': 'Creatinine',
        'bun': 'BUN',
        'alt': 'ALT',
        'ast': 'AST',
        'tsh': 'TSH',
        't4': 'T4',
        't3': 'T3',
        'vitamin d': 'Vitamin D',
        'vitamin b12': 'Vitamin B12',
        'folate': 'Folate',
        'ferritin': 'Ferritin',
        'iron': 'Iron',
        'magnesium': 'Magnesium'
      };

      // Enhanced medical text preprocessing for better biomarker extraction
      let correctedText = rawText;
      
      // Step 1: Fix fragmented biomarker names common in OCR - expanded list
      const biomarkerNameFixes = {
        // Common fragmentations
        'Hemo globin': 'Hemoglobin',
        'Hema tocrit': 'Hematocrit', 
        'Glu cose': 'Glucose',
        'Choles terol': 'Cholesterol',
        'Trigly cerides': 'Triglycerides',
        'Creati nine': 'Creatinine',
        'Vita min D': 'Vitamin D',
        'Vita min B12': 'Vitamin B12',
        'Thy roid': 'Thyroid',
        'Fer ritin': 'Ferritin',
        'Magne sium': 'Magnesium',
        'Cal cium': 'Calcium',
        'Phos phorus': 'Phosphorus',
        'Alka line': 'Alkaline',
        'Phospha tase': 'Phosphatase',
        
        // Additional common OCR fragmentations
        'So dium': 'Sodium',
        'Potas sium': 'Potassium', 
        'Chlo ride': 'Chloride',
        'Pro tein': 'Protein',
        'Albu min': 'Albumin',
        'Biliru bin': 'Bilirubin',
        'Uric Acid': 'Uric Acid',
        'Iron Bind': 'Iron Binding',
        'Trans ferrin': 'Transferrin',
        'Fola te': 'Folate',
        'Insu lin': 'Insulin',
        'Corti sol': 'Cortisol',
        'Testos terone': 'Testosterone',
        'Estra diol': 'Estradiol',
        
        // HDL/LDL variations
        'HDL Chol': 'HDL Cholesterol',
        'LDL Chol': 'LDL Cholesterol',
        'Total Chol': 'Total Cholesterol',
        'H D L': 'HDL',
        'L D L': 'LDL',
        
        // Thyroid markers
        'T S H': 'TSH',
        'Free T4': 'Free T4',
        'Free T3': 'Free T3',
        'T 4': 'T4',
        'T 3': 'T3',
        
        // Blood count markers
        'W B C': 'WBC',
        'R B C': 'RBC',
        'Plate lets': 'Platelets',
        'M C V': 'MCV',
        'M C H': 'MCH',
        'M C H C': 'MCHC',
        'R D W': 'RDW',
        
        // Liver markers
        'A L T': 'ALT',
        'A S T': 'AST',
        'A L P': 'ALP',
        'G G T': 'GGT',
        'L D H': 'LDH',
        
        // Kidney markers
        'B U N': 'BUN',
        'e G F R': 'eGFR',
        'EGFR': 'eGFR',
        
        // Special cases
        'HbA 1c': 'HbA1c',
        'Hb A1c': 'HbA1c',
        'A 1 C': 'A1C',
        'PSA Total': 'PSA',
        'Vitamin B 12': 'Vitamin B12',
        'Vitamin D 25': 'Vitamin D'
      };
      
      Object.entries(biomarkerNameFixes).forEach(([fragmented, correct]) => {
        const regex = new RegExp(fragmented, 'gi');
        correctedText = correctedText.replace(regex, correct);
      });
      
      // Step 2: More aggressive fragmented numbers and units reconstruction
      correctedText = correctedText
        // Fix split numbers with various patterns
        .replace(/(\d)\s+(\d+\.?\d*)/g, '$1$2') // "1 23.4" -> "123.4"
        .replace(/(\d+)\s*\.\s*(\d+)/g, '$1.$2') // "123 . 4" -> "123.4"
        .replace(/(\d+)\s*,\s*(\d+)/g, '$1.$2') // "123 , 4" -> "123.4" (European format)
        
        // Fix separated decimal numbers
        .replace(/(\d+)\s+(\d{1,3})\s+(\d+)/g, '$1$2.$3') // "12 3 45" -> "123.45"
        .replace(/(\d)\s(\d)\s(\d)/g, '$1$2$3') // "1 2 3" -> "123"
        
        // Fix numbers with status codes fragmented
        .replace(/(\d+(?:\.\d+)?)\s+(H|L|N)\s/gi, '$1 $2 ') // "95 H " -> "95 H "
        .replace(/(\d+(?:\.\d+)?)(H|L|N)(\s|$)/gi, '$1 $2$3') // "95H" -> "95 H"
        
        // Fix units separated from numbers with various spacing
        .replace(/(\d+(?:\.\d+)?)\s+(mg\s*\/\s*dL|mmol\s*\/\s*L|g\s*\/\s*dL|ng\s*\/\s*mL|µg\s*\/\s*L|IU\s*\/\s*L|mEq\s*\/\s*L|U\s*\/\s*L|pg\s*\/\s*mL|µU\s*\/\s*mL|mU\s*\/\s*L|K\s*\/\s*µL)/gi, '$1 $2')
        
        // Fix heavily fragmented units
        .replace(/mg\s*\/\s*d\s*L/gi, 'mg/dL')
        .replace(/m\s*g\s*\/\s*d\s*L/gi, 'mg/dL')
        .replace(/mmol\s*\/\s*L/gi, 'mmol/L')
        .replace(/m\s*mol\s*\/\s*L/gi, 'mmol/L')
        .replace(/ng\s*\/\s*m\s*L/gi, 'ng/mL')
        .replace(/n\s*g\s*\/\s*m\s*L/gi, 'ng/mL')
        .replace(/µg\s*\/\s*L/gi, 'µg/L')
        .replace(/µ\s*g\s*\/\s*L/gi, 'µg/L')
        .replace(/IU\s*\/\s*L/gi, 'IU/L')
        .replace(/I\s*U\s*\/\s*L/gi, 'IU/L')
        .replace(/mEq\s*\/\s*L/gi, 'mEq/L')
        .replace(/m\s*Eq\s*\/\s*L/gi, 'mEq/L')
        .replace(/U\s*\/\s*L/gi, 'U/L')
        .replace(/pg\s*\/\s*m\s*L/gi, 'pg/mL')
        .replace(/p\s*g\s*\/\s*m\s*L/gi, 'pg/mL')
        .replace(/µU\s*\/\s*m\s*L/gi, 'µU/mL')
        .replace(/µ\s*U\s*\/\s*m\s*L/gi, 'µU/mL')
        .replace(/mU\s*\/\s*L/gi, 'mU/L')
        .replace(/m\s*U\s*\/\s*L/gi, 'mU/L')
        .replace(/K\s*\/\s*µ\s*L/gi, 'K/µL')
        .replace(/K\s*\/\s*µL/gi, 'K/µL')
        
        // Fix percentage symbols
        .replace(/(\d+(?:\.\d+)?)\s*%/g, '$1%')
        .replace(/(\d+(?:\.\d+)?)\s*per\s*cent/gi, '$1%')
        
        // Fix common OCR errors in units
        .replace(/rng\/mL/gi, 'ng/mL')
        .replace(/mcg\/L/gi, 'µg/L')
        .replace(/ug\/L/gi, 'µg/L')
        .replace(/mcg\/dL/gi, 'µg/dL')
        .replace(/ug\/dL/gi, 'µg/dL');
      
      // Step 3: Enhanced line reconstruction for biomarkers split across lines
      const lines = correctedText.split('\n');
      const processedLines: string[] = [];
      let i = 0;
      
      // Common biomarker keywords to help identify biomarker names
      const biomarkerKeywords = [
        'cholesterol', 'glucose', 'hemoglobin', 'hematocrit', 'triglycerides',
        'creatinine', 'sodium', 'potassium', 'chloride', 'protein', 'albumin',
        'bilirubin', 'vitamin', 'iron', 'ferritin', 'magnesium', 'calcium',
        'phosphorus', 'alkaline', 'phosphatase', 'thyroid', 'insulin', 'cortisol',
        'testosterone', 'estradiol', 'folate', 'hdl', 'ldl', 'tsh', 'alt', 'ast',
        'bun', 'egfr', 'wbc', 'rbc', 'platelets', 'mcv', 'mch', 'mchc', 'rdw'
      ];
      
      while (i < lines.length) {
        const currentLine = lines[i]?.trim();
        const nextLine = lines[i + 1]?.trim();
        const nextNextLine = lines[i + 2]?.trim();
        
        if (currentLine && nextLine) {
          // Enhanced biomarker name detection
          const isLikelyBiomarkerName = (line: string): boolean => {
            // Check if it contains biomarker keywords
            const containsKeyword = biomarkerKeywords.some(keyword => 
              line.toLowerCase().includes(keyword)
            );
            
            // Check if it looks like a biomarker name pattern
            const namePattern = /^[A-Za-z][A-Za-z\s\-\/()]+[A-Za-z\d]$/.test(line) &&
                               !line.match(/^\d/) && // Doesn't start with number
                               line.length > 2 && line.length < 60; // Reasonable length
                               
            return containsKeyword || namePattern;
          };
          
          // Enhanced value detection
          const isLikelyValue = (line: string): boolean => {
            return /^\d+(?:\.\d+)?/.test(line) || // Starts with number
                   /\d+(?:\.\d+)?\s*(?:mg\/dL|mmol\/L|g\/dL|ng\/mL|µg\/L|IU\/L|mEq\/L|U\/L|pg\/mL|%|K\/µL)/i.test(line); // Contains number with unit
          };
          
          const isBiomarkerName = isLikelyBiomarkerName(currentLine);
          const nextLineHasValue = isLikelyValue(nextLine);
          
          if (isBiomarkerName && nextLineHasValue) {
            // Combine biomarker name with its value
            processedLines.push(`${currentLine}: ${nextLine}`);
            i += 2; // Skip both lines
            continue;
          }
          
          // Handle cases where biomarker name, value, and unit are on separate lines
          if (isBiomarkerName && nextLine && nextNextLine) {
            const nextLineIsNumber = /^\d+(?:\.\d+)?$/.test(nextLine);
            const nextNextLineIsUnit = /^(?:mg\/dL|mmol\/L|g\/dL|ng\/mL|µg\/L|IU\/L|mEq\/L|U\/L|pg\/mL|%|K\/µL)$/i.test(nextNextLine);
            
            if (nextLineIsNumber && nextNextLineIsUnit) {
              processedLines.push(`${currentLine}: ${nextLine} ${nextNextLine}`);
              i += 3; // Skip all three lines
              continue;
            }
          }
          
          // Handle fragmented lines where value and unit are separated
          const fragmentedValuePattern = /(\d+(?:\.\d+)?)\s*$/.exec(currentLine);
          const fragmentedUnitPattern = /^(?:mg\/dL|mmol\/L|g\/dL|ng\/mL|µg\/L|IU\/L|mEq\/L|U\/L|pg\/mL|%|K\/µL)/i.exec(nextLine);
          
          if (fragmentedValuePattern && fragmentedUnitPattern) {
            // Merge value line with unit line
            const reconstructed = currentLine + ' ' + nextLine;
            processedLines.push(reconstructed);
            i += 2;
            continue;
          }
        }
        
        if (currentLine) {
          processedLines.push(currentLine);
        }
        i++;
      }
      
      correctedText = processedLines.join('\n');
      
      // Step 4: Apply standard medical OCR corrections
      Object.entries(medicalOcrCorrections).forEach(([error, correction]) => {
        const regex = new RegExp(`\\b${error}\\b`, 'gi');
        correctedText = correctedText.replace(regex, correction);
      });

      // Calculate detailed quality metrics
      const qualityMetrics = this.calculateQualityMetrics(correctedText, {
        confidence,
        medicalTerms: this.countMedicalTerms(correctedText),
        numericValues: this.countNumericValues(correctedText),
        unitConsistency: this.checkUnitConsistency(correctedText)
      });

      const preprocessed = await this.normalizeText(correctedText, 'image', {
        confidence,
        ocrEngine: `google-vision-${ocrMethod}`,
        qualityMetrics
      });

      return preprocessed;
    } catch (error) {
      logger.error('Error processing image:', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      });
      throw new Error('Failed to process image file');
    }
  }

  private countMedicalTerms(text: string): number {
    const medicalTerms = [
      'hemoglobin', 'hematocrit', 'glucose', 'cholesterol', 'triglycerides',
      'creatinine', 'bun', 'alt', 'ast', 'tsh', 't4', 't3', 'vitamin',
      'ferritin', 'iron', 'magnesium', 'calcium', 'sodium', 'potassium',
      'chloride', 'co2', 'anion gap', 'albumin', 'bilirubin', 'alkaline',
      'phosphatase', 'protein', 'globulin', 'a/g ratio', 'bun/creatinine',
      'egfr', 'ldl', 'hdl', 'vldl', 'lipoprotein', 'apolipoprotein',
      'homocysteine', 'c-reactive', 'sed rate', 'wbc', 'rbc', 'platelets',
      'neutrophils', 'lymphocytes', 'monocytes', 'eosinophils', 'basophils',
      'mcv', 'mch', 'mchc', 'rdw', 'mpv', 'pt', 'inr', 'aptt', 'fibrinogen',
      'd-dimer', 'fsh', 'lh', 'estradiol', 'progesterone', 'testosterone',
      'cortisol', 'acth', 'aldosterone', 'renin', 'parathyroid', 'calcitonin',
      'insulin', 'c-peptide', 'hba1c', 'vitamin d', 'vitamin b12', 'folate',
      'ferritin', 'iron', 'transferrin', 'tibc', 'uibc', 'zinc', 'copper',
      'magnesium', 'calcium', 'phosphorus', 'sodium', 'potassium', 'chloride',
      'co2', 'anion gap', 'osmolality', 'albumin', 'globulin', 'protein',
      'bilirubin', 'alkaline phosphatase', 'ast', 'alt', 'ggt', 'ldh',
      'amylase', 'lipase', 'creatinine', 'bun', 'uric acid', 'egfr'
    ];
    
    return medicalTerms.reduce((count, term) => {
      const regex = new RegExp(`\\b${term}\\b`, 'gi');
      return count + (text.match(regex) || []).length;
    }, 0);
  }

  private countNumericValues(text: string): number {
    // Match numbers with units (e.g., "123 mg/dL", "45.6 mmol/L")
    const numericPattern = /\d+(?:\.\d+)?\s*(?:mg\/dL|mmol\/L|g\/dL|g\/L|ng\/mL|µg\/L|IU\/L|mEq\/L|mm³|µL|nL|pL|fL|%|U\/L)/gi;
    return (text.match(numericPattern) || []).length;
  }

  private checkUnitConsistency(text: string): number {
    const unitPatterns = {
      'mg/dL': /mg\/dL/gi,
      'mmol/L': /mmol\/L/gi,
      'ng/mL': /ng\/mL/gi,
      'µg/L': /µg\/L/gi,
      'IU/L': /IU\/L/gi,
      'mEq/L': /mEq\/L/gi,
      'mm³': /mm³/gi,
      'µL': /µL/gi,
      'nL': /nL/gi,
      'pL': /pL/gi,
      'fL': /fL/gi,
      '%': /%/g,
      'U/L': /U\/L/gi
    };

    const unitCounts = Object.entries(unitPatterns).map(([unit, pattern]) => ({
      unit,
      count: (text.match(pattern) || []).length
    }));

    // Calculate consistency score based on unit distribution
    const totalUnits = unitCounts.reduce((sum, { count }) => sum + count, 0);
    if (totalUnits === 0) return 0;

    const expectedCount = totalUnits / unitCounts.length;
    const variance = unitCounts.reduce((sum, { count }) => {
      const diff = count - expectedCount;
      return sum + (diff * diff);
    }, 0) / unitCounts.length;

    // Convert variance to a 0-1 score (1 being most consistent)
    return Math.max(0, 1 - (variance / (totalUnits * totalUnits)));
  }

  private calculateQualityMetrics(text: string, additionalMetrics: any = {}) {
    // Handle empty text case
    if (!text || text.length === 0) {
      return {
        whitespaceRatio: 0,
        specialCharRatio: 0,
        numericRatio: 0,
        potentialOcrErrors: 0,
        medicalTermCount: 0,
        numericValueCount: 0,
        unitConsistencyScore: 0,
        overallQualityScore: 0
      };
    }

    const baseMetrics = {
      whitespaceRatio: Math.min(1, Math.max(0, (text.match(/\s/g) || []).length / text.length)),
      specialCharRatio: Math.min(1, Math.max(0, (text.match(/[^a-zA-Z0-9\s]/g) || []).length / text.length)),
      numericRatio: Math.min(1, Math.max(0, (text.match(/[0-9]/g) || []).length / text.length)),
      potentialOcrErrors: Object.keys(OCR_CORRECTIONS).reduce((count, error) => {
        const matches = text.match(new RegExp(error, 'g')) || [];
        return count + matches.length;
      }, 0)
    };

    return {
      ...baseMetrics,
      ...additionalMetrics,
      medicalTermCount: additionalMetrics.medicalTerms || 0,
      numericValueCount: additionalMetrics.numericValues || 0,
      unitConsistencyScore: additionalMetrics.unitConsistency || 0,
      overallQualityScore: this.calculateOverallQualityScore({
        ...baseMetrics,
        ...additionalMetrics
      })
    };
  }

  private calculateOverallQualityScore(metrics: QualityMetrics): number {
    const weights: Record<string, number> = {
      confidence: 0.3,
      medicalTermCount: 0.2,
      numericValueCount: 0.2,
      unitConsistencyScore: 0.15,
      whitespaceRatio: 0.05,
      specialCharRatio: 0.05,
      numericRatio: 0.05
    };

    const scores: QualityScores = {
      confidence: metrics.confidence || 0,
      medicalTermCount: Math.min(metrics.medicalTermCount / 20, 1),
      numericValueCount: Math.min(metrics.numericValueCount / 30, 1),
      unitConsistencyScore: metrics.unitConsistencyScore || 0,
      whitespaceRatio: 1 - Math.abs(metrics.whitespaceRatio - 0.15),
      specialCharRatio: 1 - Math.min(metrics.specialCharRatio / 0.1, 1),
      numericRatio: Math.min(metrics.numericRatio / 0.2, 1)
    };

    return Object.entries(weights).reduce((score, [key, weight]) => {
      return score + (scores[key] * weight);
    }, 0);
  }

  private reflowPdfColumns(lines: string[]): string[] {
    const reflowedLines: ReflowedLine[] = [];
    let currentBiomarker: ReflowedLine | null = null;
    let pendingUnit: string | null = null;
    let pendingRange: string | null = null;
    let pendingStatus: string | null = null;
    
    /* // Enhanced patterns for better matching
    const unitPattern = /(?:mg\/dL|mmol\/L|g\/dL|g\/L|ng\/mL|µg\/L|IU\/L|mEq\/L|mm³|µL|nL|pL|fL|%|U\/L|mL\/min\/1\.73m²)/i;
    const rangePattern = /(?:Normal|Reference) range:?\s*([\d\.]+\s*-\s*[\d\.]+)\s*(?:mg\/dL|mmol\/L|g\/dL|g\/L|ng\/mL|µg\/L|IU\/L|mEq\/L|mm³|µL|nL|pL|fL|%|U\/L|mL\/min\/1\.73m²)?/i;
    const statusPattern = /(?:High|Low|Normal|H|L|N|Abnormal|A)/i;
    const valuePattern = /(\d+(?:\.\d+)?)/;
    
    // Helper to check if a line is likely a biomarker name
    const isBiomarkerName = (line: string): boolean => {
      // Must start with capital letter, contain only letters and spaces
      // and not be a common non-biomarker word
      const nonBiomarkers = new Set(['Normal', 'Reference', 'Range', 'High', 'Low', 'Results', 'Test', 'Lab']);
      return /^[A-Z][a-zA-Z\s]+$/.test(line) && !nonBiomarkers.has(line.trim());
    }; */

    // Helper to calculate confidence score
    const calculateConfidence = (line: ReflowedLine): number => {
      let score = 1.0;
      
      // Penalize missing components
      if (!line.value) score *= 0.5;
      if (!line.unit) score *= 0.8;
      if (!line.referenceRange) score *= 0.9;
      
      // Bonus for complete entries
      if (line.value && line.unit && line.referenceRange && line.status) {
        score *= 1.1;
      }
      
      // Penalize if value is outside typical ranges
      const value = parseFloat(line.value);
      if (!isNaN(value)) {
        if (line.unit.includes('mg/dL')) {
          if (value > 1000 || value < 0) score *= 0.8;
        } else if (line.unit.includes('mmol/L')) {
          if (value > 100 || value < 0) score *= 0.8;
        }
      }
      
      return Math.min(1.0, Math.max(0.0, score));
    };

    // Process lines with lookahead for better context
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      
      /* // Look for biomarker name
      if (isBiomarkerName(line)) {
        // If we have a pending biomarker, add it
        if (currentBiomarker) {
          currentBiomarker.confidence = calculateConfidence(currentBiomarker);
          reflowedLines.push(currentBiomarker);
        }
        
        // Start new biomarker
        currentBiomarker = {
          biomarker: line,
          value: '',
          unit: '',
          lineNumber: i,
          confidence: 1.0
        };
        
        // Look ahead for immediate value/unit
        const nextLine = lines[i + 1]?.trim();
        if (nextLine) {
          // Check for value and unit in next line
          const valueMatch = nextLine.match(valuePattern);
          const unitMatch = nextLine.match(unitPattern);
          const statusMatch = nextLine.match(statusPattern);
          
          if (valueMatch) {
            currentBiomarker.value = valueMatch[1];
            if (unitMatch) currentBiomarker.unit = unitMatch[0];
            if (statusMatch) currentBiomarker.status = statusMatch[0];
            i++; // Skip next line since we processed it
          }
        }
        continue;
      }
      
      // Process current line for existing biomarker
      if (currentBiomarker) {
        // Look for reference range
        const rangeMatch = line.match(rangePattern);
        if (rangeMatch) {
          currentBiomarker.referenceRange = rangeMatch[1];
          // If range includes unit, use it
          const rangeUnitMatch = line.match(unitPattern);
          if (rangeUnitMatch && !currentBiomarker.unit) {
            currentBiomarker.unit = rangeUnitMatch[0];
          }
          continue;
        }
        
        // Look for unit
        const unitMatch = line.match(unitPattern);
        if (unitMatch && !currentBiomarker.unit) {
          currentBiomarker.unit = unitMatch[0];
          continue;
        }
        
        // Look for value if we don't have one
        if (!currentBiomarker.value) {
          const valueMatch = line.match(valuePattern);
          if (valueMatch) {
            currentBiomarker.value = valueMatch[1];
            // Check for status in same line
            const statusMatch = line.match(statusPattern);
            if (statusMatch) {
              currentBiomarker.status = statusMatch[0];
            }
            continue;
          }
        }
        
        // Look for status if we don't have one
        if (!currentBiomarker.status) {
          const statusMatch = line.match(statusPattern);
          if (statusMatch) {
            currentBiomarker.status = statusMatch[0];
            continue;
          }
        }
        
        // If we have a complete biomarker, add it
        if (currentBiomarker.value && (currentBiomarker.unit || currentBiomarker.referenceRange)) {
          currentBiomarker.confidence = calculateConfidence(currentBiomarker);
          reflowedLines.push(currentBiomarker);
          currentBiomarker = null;
        }
      } */
    }
    
    // Add any pending biomarker
    if (currentBiomarker) {
      currentBiomarker.confidence = calculateConfidence(currentBiomarker);
      reflowedLines.push(currentBiomarker);
    }
    
    // Convert reflowed lines back to text with confidence scores
    return reflowedLines.map(line => {
      const parts = [
        `${line.biomarker}:`,
        line.value,
        line.unit,
        line.status ? `(${line.status})` : '',
        line.referenceRange ? `[${line.referenceRange}]` : '',
        `{confidence:${line.confidence.toFixed(2)}}`
      ].filter(Boolean);
      
      return parts.join(' ');
    });
  }

  private async normalizeText(
    text: string,
    originalFormat: string,
    metadata: {
      confidence?: number;
      ocrEngine?: string;
      qualityMetrics?: QualityMetrics;
    } = {}
  ): Promise<PreprocessedText> {
    const startTime = Date.now();
    const processingSteps: string[] = [];
    let normalizedText = text;

    // Step 0: Reflow PDF columns if needed (DISABLED for debugging)
    if (originalFormat === 'pdf') {
      processingSteps.push('reflow_columns');
      // TEMP FIX: Skip reflow to prevent text loss
      // const lines = normalizedText.split('\n');
      // const reflowedLines = this.reflowPdfColumns(lines);
      // normalizedText = reflowedLines.join('\n');
    }

    // Step 1: Basic cleanup with better whitespace preservation
    processingSteps.push('basic_cleanup');
    normalizedText = normalizedText
      .replace(/\r\n/g, '\n') // Normalize line endings
      .replace(/\t/g, '  ') // Replace tabs with double spaces
      // Preserve intentional whitespace
      .replace(/(\d)\s+(\d)/g, '$1 $2') // Keep single space between numbers
      .replace(/([A-Za-z])\s+(\d)/g, '$1 $2') // Keep single space between letters and numbers
      .replace(/(\d)\s+([A-Za-z])/g, '$1 $2') // Keep single space between numbers and letters
      .replace(/([A-Za-z])\s+([A-Za-z])/g, '$1 $2') // Keep single space between letters
      // Handle newlines more intelligently
      .replace(/\n{3,}/g, '\n\n') // Replace 3+ newlines with exactly 2
      .replace(/([.!?])\s*\n\s*([A-Z])/g, '$1\n\n$2') // Add extra newline after sentences
      .replace(/([A-Z][a-z]+:)\s*\n\s*(\d)/g, '$1 $2') // Join biomarker names with their values
      .trim();

    // Step 2: Remove headers and footers while preserving biomarker sections
    processingSteps.push('remove_headers_footers');
    const lines = normalizedText.split('\n');
    /* const filteredLines = lines.filter((line, index) => {
      // Keep lines that are likely biomarker entries
      if (line.match(/^[A-Z][a-zA-Z\s]+:/) || // Biomarker name with colon
          line.match(/^\d+(?:\.\d+)?\s*(?:mg\/dL|mmol\/L|g\/dL|g\/L|ng\/mL|µg\/L|IU\/L|mEq\/L|mm³|µL|nL|pL|fL|%|U\/L)/i) || // Value with unit
          line.match(/(?:Normal|Reference) range:/i)) { // Reference range
        return true;
      }
      
      // Remove header/footer patterns
      return !HEADER_FOOTER_PATTERNS.some(pattern => pattern.test(line.trim()));
    }); */
    normalizedText = lines.join('\n'); // Temporarily keep all lines

    // Step 3: Standardize common phrases while preserving context
    processingSteps.push('standardize_phrases');
    Object.entries(PHRASE_STANDARDIZATION).forEach(([original, standard]) => {
      // Only replace if it's a standalone phrase or at start of line
      const regex = new RegExp(`(^|\\n|\\s)${original}(\\s|\\n|$)`, 'gi');
      normalizedText = normalizedText.replace(regex, `$1${standard}$2`);
    });

    // Step 4: Fix common OCR errors with context awareness
    processingSteps.push('fix_ocr_errors');
    /* Object.entries(OCR_CORRECTIONS).forEach(([error, correction]) => {
      // Only apply corrections in numeric contexts
      normalizedText = normalizedText
        // Fix numbers with units
        .replace(new RegExp(`(\\d)${error}(\\s*(?:mg\/dL|mmol\/L|g\/dL|g\/L|ng\/mL|µg\/L|IU\/L|mEq\/L|mm³|µL|nL|pL|fL|%|U\/L))`, 'gi'),
          `$1${correction}$2`)
        // Fix numbers in ranges
        .replace(new RegExp(`(\\d)${error}(\\s*-\s*\\d)`, 'g'),
          `$1${correction}$2`)
        // Fix numbers with status
        .replace(new RegExp(`(\\d)${error}(\\s*(?:High|Low|Normal))`, 'gi'),
          `$1${correction}$2`);
    }); */

    // Step 5: Calculate quality metrics
    const qualityMetrics = this.calculateQualityMetrics(normalizedText, {
      ...metadata.qualityMetrics,
      // Add new metrics for biomarker detection
      biomarkerCount: this.countBiomarkers(normalizedText),
      unitConsistency: this.checkUnitConsistency(normalizedText),
      valueRangeConsistency: this.checkValueRanges(normalizedText)
    });

    // Step 6: Final cleanup - preserve intentional whitespace
    processingSteps.push('final_cleanup');
    normalizedText = normalizedText
      /* // Preserve biomarker formatting
      .replace(/([A-Z][a-zA-Z\s]+):\s*\n\s*(\d)/g, '$1: $2') // Join biomarker names with values
      .replace(/(\d)\s*\n\s*(mg\/dL|mmol\/L|g\/dL|g\/L|ng\/mL|µg\/L|IU\/L|mEq\/L|mm³|µL|nL|pL|fL|%|U\/L)/gi,
        '$1 $2') // Join values with units */
      // Clean up excessive whitespace
      .replace(/\n{3,}/g, '\n\n') // Remove excessive newlines
      .replace(/\s{3,}/g, '  ') // Replace 3+ spaces with exactly 2
      .trim();

    const processingTime = Date.now() - startTime;

    // Log detailed processing metrics
    logger.info('Text normalization complete', {
      originalFormat,
      processingSteps,
      processingTime,
      textLength: normalizedText.length,
      qualityMetrics,
      biomarkerCount: qualityMetrics.biomarkerCount,
      unitConsistency: qualityMetrics.unitConsistency,
      valueRangeConsistency: qualityMetrics.valueRangeConsistency
    });

    return {
      rawText: text,
      normalizedText,
      metadata: {
        originalFormat,
        processingSteps,
        processingTimestamp: new Date().toISOString(),
        textLength: normalizedText.length,
        lineCount: normalizedText.split('\n').length,
        hasHeaders: this.detectHeaders(normalizedText),
        hasFooters: this.detectFooters(normalizedText),
        confidence: metadata.confidence,
        ocrEngine: metadata.ocrEngine,
        qualityMetrics,
        ...metadata
      }
    };
  }

  private detectHeaders(text: string): boolean {
    /* const firstLines = text.split('\n').slice(0, 3);
    return HEADER_FOOTER_PATTERNS.some(pattern => 
      firstLines.some(line => pattern.test(line.trim()))
    ); */
    return false; // Temporarily disable header detection
  }

  private detectFooters(text: string): boolean {
    /* const lastLines = text.split('\n').slice(-3);
    return HEADER_FOOTER_PATTERNS.some(pattern => 
      lastLines.some(line => pattern.test(line.trim()))
    ); */
    return false; // Temporarily disable footer detection
  }

  async preprocessLabText(buffer: Buffer, mimeType?: string): Promise<PreprocessedText> {
    try {
      // Detect file type if not provided
      const detectedType = mimeType || (await fileTypeFromBuffer(buffer))?.mime;
      
      if (!detectedType) {
        throw new Error('Could not detect file type');
      }

      logger.info('Starting lab text preprocessing', {
        mimeType: detectedType,
        bufferSize: buffer.length
      });

      let preprocessedText: PreprocessedText;

      // Process based on file type
      if (detectedType === 'application/pdf') {
        preprocessedText = await this.processPdf(buffer);
      } else if (
        detectedType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
        detectedType === 'application/msword'
      ) {
        preprocessedText = await this.processDocx(buffer);
      } else if (
        detectedType.startsWith('image/')
      ) {
        preprocessedText = await this.processImage(buffer);
      } else {
        throw new Error(`Unsupported file type: ${detectedType}`);
      }

      // Validate the output
      const validated = PreprocessedTextSchema.parse(preprocessedText);

      logger.info('Lab text preprocessing complete', {
        mimeType: detectedType,
        textLength: validated.normalizedText.length,
        processingSteps: validated.metadata.processingSteps
      });

      return validated;
    } catch (error) {
      logger.error('Error preprocessing lab text:', {
        error: error instanceof Error ? error.message : String(error),
        mimeType
      });
      throw error;
    }
  }

  // Add new helper methods for quality metrics
  private countBiomarkers(text: string): number {
    /* const biomarkerPattern = /^[A-Z][a-zA-Z\s]+:\s*\d+(?:\.\d+)?\s*(?:mg\/dL|mmol\/L|g\/dL|g\/L|ng\/mL|µg\/L|IU\/L|mEq\/L|mm³|µL|nL|pL|fL|%|U\/L)/gim;
    return (text.match(biomarkerPattern) || []).length; */
    return 0; // Temporarily disable biomarker counting
  }

  private checkValueRanges(text: string): number {
    /* const rangePattern = /(?:Normal|Reference) range:\s*([\d\.]+\s*-\s*[\d\.]+)/gi;
    const ranges = Array.from(text.matchAll(rangePattern)).map(match => {
      const [min, max] = match[1].split('-').map(v => parseFloat(v.trim()));
      return { min, max };
    });
    
    if (ranges.length === 0) return 0;
    
    // Check if ranges are within typical limits
    const validRanges = ranges.filter(range => {
      if (isNaN(range.min) || isNaN(range.max)) return false;
      if (range.min >= range.max) return false;
      
      // Typical ranges for common units
      if (text.includes('mg/dL')) {
        return range.min >= 0 && range.max <= 1000;
      } else if (text.includes('mmol/L')) {
        return range.min >= 0 && range.max <= 100;
      }
      return true;
    });
    
    return validRanges.length / ranges.length; */
    return 0; // Temporarily disable range checking
  }
}

export const labTextPreprocessingService = new LabTextPreprocessingService(); 