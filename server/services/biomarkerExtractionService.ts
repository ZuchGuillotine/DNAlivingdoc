/**
    * @description      : Service for extracting and validating biomarkers from lab reports
    * @author           : 
    * @group            : 
    * @created          : 07/05/2025 - 22:56:18
    * 
    * MODIFICATION LOG
    * - Version         : 1.0.0
    * - Date            : 07/05/2025
    * - Author          : 
    * - Modification    : Enhanced regex patterns and added more biomarkers
**/
import { z } from 'zod';
import { openai } from '../openai';
import logger from '../utils/logger';
import { db } from '../../db';
import { labResults, biomarkerResults, biomarkerProcessingStatus, type SelectLabResult } from '../../db/schema';
import { eq } from 'drizzle-orm';
import type { InsertBiomarkerResult } from '../../db/schema';
import { BiomarkerPatternService, type PatternMatch } from './biomarkerPatternService';
import { type NeonHttpDatabase } from 'drizzle-orm/neon-http';
import { type PostgresJsTransaction } from 'drizzle-orm/postgres-js';
import type * as schema from '../../db/schema';
import { sql } from 'drizzle-orm';

interface Biomarker {
  name: string;
  value: number | string; // Allow both number and string values for flexibility
  unit?: string;
  category: string;
  referenceRange?: string;
  testDate?: Date | string; // Make testDate optional
  source?: string; // Optional source field
  extractionMethod?: string; // Alternative field for extraction method
  status?: string; // Add status field for High/Low/Normal
  confidence?: number | string; // Allow both number and string for confidence
  sourceText?: string | null; // Allow null values
}

// Zod schema for biomarker validation - More flexible to reduce validation failures
const BiomarkerSchema = z.object({
  name: z.string().min(1),
  // More flexible value handling - allow string or number and convert to number
  value: z.union([
    z.number(),
    z.string().transform(val => {
      const parsed = Number(val);
      if (isNaN(parsed)) {
        logger.warn(`Failed to parse biomarker value as number: ${val}`);
        return 0; // Fallback value to prevent pipeline failure
      }
      return parsed;
    })
  ]),
  unit: z.string().optional(),
  // More flexible category enum with proper error handling
  category: z.string()
    .transform(val => {
      const validCategories = ['lipid', 'metabolic', 'thyroid', 'vitamin', 
        'mineral', 'blood', 'liver', 'kidney', 'hormone', 'other'];
      if (validCategories.includes(val.toLowerCase())) {
        return val.toLowerCase();
      }
      logger.warn(`Invalid biomarker category: ${val}. Defaulting to 'other'`);
      return 'other';
    }),
  referenceRange: z.string().optional(),
  // More flexible date handling with better error recovery
  testDate: z.union([
    z.date(),
    z.string().transform(dateStr => {
      try {
        // Handle ISO strings
        if (/^\d{4}-\d{2}-\d{2}T/.test(dateStr)) {
          return new Date(dateStr);
        }
        // Handle YYYY-MM-DD format
        if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
          return new Date(`${dateStr}T00:00:00.000Z`);
        }
        // Handle MM/DD/YYYY format
        if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(dateStr)) {
          const [month, day, year] = dateStr.split('/');
          return new Date(`${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}T00:00:00.000Z`);
        }
        // Default parsing
        const parsed = new Date(dateStr);
        if (isNaN(parsed.getTime())) {
          logger.warn(`Failed to parse date: ${dateStr}. Using current date.`);
          return new Date();
        }
        return parsed;
      } catch (e) {
        logger.warn(`Error parsing date: ${e instanceof Error ? e.message : String(e)}. Using current date.`);
        return new Date();
      }
    })
  ]),
  // More flexible status handling
  status: z.union([
    z.enum(['High', 'Low', 'Normal']),
    z.string().transform(val => {
      const normalized = val.toLowerCase();
      if (normalized.includes('high')) return 'High';
      if (normalized.includes('low')) return 'Low';
      return 'Normal';
    })
  ]).optional(),
  extractionMethod: z.enum(['regex', 'llm']).default('regex'),
  confidence: z.number().min(0).max(1).default(1.0),
  sourceText: z.string().optional()
});

const BiomarkersArraySchema = z.array(BiomarkerSchema);

export type BiomarkerCategory = 
  | 'metabolic' 
  | 'lipid' 
  | 'vitamin' 
  | 'hormone' 
  | 'mineral' 
  | 'protein' 
  | 'thyroid'
  | 'blood'
  | 'liver'
  | 'kidney'
  | 'other';

// Enhanced biomarker regex patterns with more flexible matching for OCR text
const BIOMARKER_PATTERNS: Record<string, { pattern: RegExp; category: BiomarkerCategory; defaultUnit: string }> = {
  // Lipid Panel - More flexible patterns for OCR text
  cholesterol: {
    pattern: /(?:Total\s*Cholesterol|Cholesterol,?\s*Total|Cholesterol|Chol)[\s:=]*(?!.*(?:range|ref|normal|reference).*?(\d+)\s*[-–—]\s*(\d+))(\d+(?:\.\d+)?)\s*(?:mg\/dL|mmol\/L|mg\/dl|mmol\/l)?\s*(?:High|Low|Normal|H|L|N|\*)?/gi,
    category: 'lipid',
    defaultUnit: 'mg/dL'
  },
  hdl: {
    pattern: /(?:HDL|HDL[-\s]*C|HDL\s*Cholesterol|High[-\s]*Density\s*Lipoprotein)[\s:=]*(?!.*(?:range|ref|normal|reference).*?(\d+)\s*[-–—]\s*(\d+))(\d+(?:\.\d+)?)\s*(?:mg\/dL|mmol\/L|mg\/dl|mmol\/l)?\s*(?:High|Low|Normal|H|L|N|\*)?/gi,
    category: 'lipid',
    defaultUnit: 'mg/dL'
  },
  ldl: {
    pattern: /(?:LDL|LDL[-\s]*C|LDL\s*Cholesterol|Low[-\s]*Density\s*Lipoprotein)[\s:=]*(?!.*(?:range|ref|normal|reference).*?(\d+)\s*[-–—]\s*(\d+))(\d+(?:\.\d+)?)\s*(?:mg\/dL|mmol\/L|mg\/dl|mmol\/l)?\s*(?:High|Low|Normal|H|L|N|\*)?/gi,
    category: 'lipid',
    defaultUnit: 'mg/dL'
  },
  triglycerides: {
    pattern: /(?:Triglycerides?|TG|Trigs?)[\s:=]*(?!.*(?:range|ref|normal|reference).*?(\d+)\s*[-–—]\s*(\d+))(\d+(?:\.\d+)?)\s*(?:mg\/dL|mmol\/L|mg\/dl|mmol\/l)?\s*(?:High|Low|Normal|H|L|N|\*)?/gi,
    category: 'lipid',
    defaultUnit: 'mg/dL'
  },

  // Metabolic Panel - More flexible patterns for OCR
  glucose: {
    pattern: /(?:Glucose|Blood\s*Glucose|Fasting\s*Glucose|FBG|GLU)[\s:=]*(?!.*(?:range|ref|normal|reference).*?(\d+)\s*[-–—]\s*(\d+))(\d{2,3}(?:\.\d+)?)\s*(?:mg\/dL|mmol\/L|mg\/dl|mmol\/l)?\s*(?:High|Low|Normal|H|L|N|\*)?/gi,
    category: 'metabolic',
    defaultUnit: 'mg/dL'
  },
  hemoglobinA1c: {
    pattern: /(?:HbA1c|Hemoglobin A1c|A1C|Hgb A1c)\s*[:=]?\s*(?:(?:Normal range:?\s*[\d\.]+\s*-\s*[\d\.]+\s*(?:%|mmol\/mol))?\s*(\d+(?:\.\d+)?)\s*(?:High|Low|Normal|H|L|N)?\s*(%|mmol\/mol)|(?:%|mmol\/mol)\s*\n?\s*(\d+(?:\.\d+)?)\s*(?:High|Low|Normal|H|L|N)?)/i,
    category: 'metabolic',
    defaultUnit: '%'
  },
  insulin: {
    pattern: /(?:Insulin|Fasting Insulin)\s*[:=]?\s*(?:(?:Normal range:?\s*[\d\.]+\s*-\s*[\d\.]+\s*(?:µIU\/mL|pmol\/L))?\s*(\d+(?:\.\d+)?)\s*(?:High|Low|Normal|H|L|N)?\s*(µIU\/mL|pmol\/L)|(?:µIU\/mL|pmol\/L)\s*\n?\s*(\d+(?:\.\d+)?)\s*(?:High|Low|Normal|H|L|N)?)/i,
    category: 'metabolic',
    defaultUnit: 'µIU/mL'
  },

  // Electrolytes - Enhanced patterns with better unit handling
  sodium: {
    pattern: /(?:Sodium|Na)\s*[:=]?\s*(?:(?:Normal range:?\s*[\d\.]+\s*-\s*[\d\.]+\s*(?:mmol\/L|mEq\/L))?\s*(\d+(?:\.\d+)?)\s*(?:High|Low|Normal|H|L|N)?\s*(mmol\/L|mEq\/L)|(?:mmol\/L|mEq\/L)\s*\n?\s*(\d+(?:\.\d+)?)\s*(?:High|Low|Normal|H|L|N)?)/i,
    category: 'metabolic',
    defaultUnit: 'mmol/L'
  },
  potassium: {
    pattern: /(?:Potassium|K)\s*[:=]?\s*(?:(?:Normal range:?\s*[\d\.]+\s*-\s*[\d\.]+\s*(?:mmol\/L|mEq\/L))?\s*(\d+(?:\.\d+)?)\s*(?:High|Low|Normal|H|L|N)?\s*(mmol\/L|mEq\/L)|(?:mmol\/L|mEq\/L)\s*\n?\s*(\d+(?:\.\d+)?)\s*(?:High|Low|Normal|H|L|N)?)/i,
    category: 'metabolic',
    defaultUnit: 'mmol/L'
  },
  chloride: {
    pattern: /(?:Chloride|Cl)\s*[:=]?\s*(?:(?:Normal range:?\s*[\d\.]+\s*-\s*[\d\.]+\s*(?:mmol\/L|mEq\/L))?\s*(\d+(?:\.\d+)?)\s*(?:High|Low|Normal|H|L|N)?\s*(mmol\/L|mEq\/L)|(?:mmol\/L|mEq\/L)\s*\n?\s*(\d+(?:\.\d+)?)\s*(?:High|Low|Normal|H|L|N)?)/i,
    category: 'metabolic',
    defaultUnit: 'mmol/L'
  },
  co2: {
    pattern: /(?:CO2|Carbon Dioxide|Total CO2)\s*[:=]?\s*(?:(?:Normal range:?\s*[\d\.]+\s*-\s*[\d\.]+\s*(?:mmol\/L|mEq\/L))?\s*(\d+(?:\.\d+)?)\s*(?:High|Low|Normal|H|L|N)?\s*(mmol\/L|mEq\/L)|(?:mmol\/L|mEq\/L)\s*\n?\s*(\d+(?:\.\d+)?)\s*(?:High|Low|Normal|H|L|N)?)/i,
    category: 'metabolic',
    defaultUnit: 'mmol/L'
  },
  anionGap: {
    pattern: /(?:Anion Gap|AG)\s*[:=]?\s*(?:(?:Normal range:?\s*[\d\.]+\s*-\s*[\d\.]+\s*(?:mmol\/L|mEq\/L))?\s*(\d+(?:\.\d+)?)\s*(?:High|Low|Normal|H|L|N)?\s*(mmol\/L|mEq\/L)|(?:mmol\/L|mEq\/L)\s*\n?\s*(\d+(?:\.\d+)?)\s*(?:High|Low|Normal|H|L|N)?)/i,
    category: 'metabolic',
    defaultUnit: 'mmol/L'
  },

  // Thyroid Panel - Enhanced patterns
  tsh: {
    pattern: /(?:TSH|Thyroid Stimulating Hormone)\s*[:=]?\s*(?:(?:Normal range:?\s*[\d\.]+\s*-\s*[\d\.]+\s*(?:mIU\/L|µIU\/mL))?\s*(\d+(?:\.\d+)?)\s*(?:High|Low|Normal|H|L|N)?\s*(mIU\/L|µIU\/mL)|(?:mIU\/L|µIU\/mL)\s*\n?\s*(\d+(?:\.\d+)?)\s*(?:High|Low|Normal|H|L|N)?)/i,
    category: 'thyroid',
    defaultUnit: 'mIU/L'
  },
  t4: {
    pattern: /(?:T4|Free T4|Thyroxine)\s*[:=]?\s*(?:(?:Normal range:?\s*[\d\.]+\s*-\s*[\d\.]+\s*(?:ng\/dL|pmol\/L))?\s*(\d+(?:\.\d+)?)\s*(?:High|Low|Normal|H|L|N)?\s*(ng\/dL|pmol\/L)|(?:ng\/dL|pmol\/L)\s*\n?\s*(\d+(?:\.\d+)?)\s*(?:High|Low|Normal|H|L|N)?)/i,
    category: 'thyroid',
    defaultUnit: 'ng/dL'
  },
  t3: {
    pattern: /(?:T3|Free T3|Triiodothyronine)\s*[:=]?\s*(?:(?:Normal range:?\s*[\d\.]+\s*-\s*[\d\.]+\s*(?:pg\/mL|pmol\/L))?\s*(\d+(?:\.\d+)?)\s*(?:High|Low|Normal|H|L|N)?\s*(pg\/mL|pmol\/L)|(?:pg\/mL|pmol\/L)\s*\n?\s*(\d+(?:\.\d+)?)\s*(?:High|Low|Normal|H|L|N)?)/i,
    category: 'thyroid',
    defaultUnit: 'pg/mL'
  },

  // Vitamins - More flexible patterns
  vitaminD: {
    pattern: /(?:Vitamin D|25-OH Vitamin D|25-Hydroxyvitamin D|25\(OH\)D)\s*[:=]?\s*(?:Normal range:?\s*[\d\.]+\s*-\s*[\d\.]+\s*(?:ng\/mL|nmol\/L))?\s*(\d+(?:\.\d+)?)\s*(?:High|Low|Normal)?\s*(ng\/mL|nmol\/L)/i,
    category: 'vitamin',
    defaultUnit: 'ng/mL'
  },
  vitaminB12: {
    pattern: /(?:Vitamin B12|B12|Cobalamin)\s*[:=]?\s*(?:Normal range:?\s*[\d\.]+\s*-\s*[\d\.]+\s*(?:pg\/mL|pmol\/L))?\s*(\d+(?:\.\d+)?)\s*(?:High|Low|Normal)?\s*(pg\/mL|pmol\/L)/i,
    category: 'vitamin',
    defaultUnit: 'pg/mL'
  },
  folate: {
    pattern: /(?:Folate|Folic Acid|Vitamin B9)\s*[:=]?\s*(?:Normal range:?\s*[\d\.]+\s*-\s*[\d\.]+\s*(?:ng\/mL|nmol\/L))?\s*(\d+(?:\.\d+)?)\s*(?:High|Low|Normal)?\s*(ng\/mL|nmol\/L)/i,
    category: 'vitamin',
    defaultUnit: 'ng/mL'
  },

  // Minerals - More flexible patterns
  ferritin: {
    pattern: /(?:Ferritin)\s*[:=]?\s*(?:Normal range:?\s*[\d\.]+\s*-\s*[\d\.]+\s*(?:ng\/mL|µg\/L))?\s*(\d+(?:\.\d+)?)\s*(?:High|Low|Normal)?\s*(ng\/mL|µg\/L)/i,
    category: 'mineral',
    defaultUnit: 'ng/mL'
  },
  iron: {
    pattern: /(?:Iron|Serum Iron)\s*[:=]?\s*(?:Normal range:?\s*[\d\.]+\s*-\s*[\d\.]+\s*(?:µg\/dL|µmol\/L))?\s*(\d+(?:\.\d+)?)\s*(?:High|Low|Normal)?\s*(µg\/dL|µmol\/L)/i,
    category: 'mineral',
    defaultUnit: 'µg/L'
  },
  magnesium: {
    pattern: /(?:Magnesium|Mg)\s*[:=]?\s*(?:Normal range:?\s*[\d\.]+\s*-\s*[\d\.]+\s*(?:mg\/dL|mmol\/L))?\s*(\d+(?:\.\d+)?)\s*(?:High|Low|Normal)?\s*(mg\/dL|mmol\/L)/i,
    category: 'mineral',
    defaultUnit: 'mg/dL'
  },

  // Blood Count - More flexible patterns
  hemoglobin: {
    pattern: /(?:Hemoglobin|Hgb|Hb)\s*[:=]?\s*(?:Normal range:?\s*[\d\.]+\s*-\s*[\d\.]+\s*(?:g\/dL|g\/L))?\s*(\d+(?:\.\d+)?)\s*(?:High|Low|Normal)?\s*(g\/dL|g\/L)/i,
    category: 'blood',
    defaultUnit: 'g/dL'
  },
  hematocrit: {
    pattern: /(?:Hematocrit|Hct)\s*[:=]?\s*(?:Normal range:?\s*[\d\.]+\s*-\s*[\d\.]+\s*%)?\s*(\d+(?:\.\d+)?)\s*(?:High|Low|Normal)?\s*(%)/i,
    category: 'blood',
    defaultUnit: '%'
  },
  platelets: {
    pattern: /(?:Platelets|PLT)\s*[:=]?\s*(?:Normal range:?\s*[\d\.]+\s*-\s*[\d\.]+\s*(?:K\/µL|10³\/µL))?\s*(\d+(?:\.\d+)?)\s*(?:High|Low|Normal)?\s*(K\/µL|10³\/µL)/i,
    category: 'blood',
    defaultUnit: 'K/µL'
  },

  // Liver Function - More flexible patterns
  alt: {
    pattern: /(?:ALT|Alanine Transaminase|SGPT)\s*[:=]?\s*(?:Normal range:?\s*[\d\.]+\s*-\s*[\d\.]+\s*(?:U\/L|IU\/L))?\s*(\d+(?:\.\d+)?)\s*(?:High|Low|Normal)?\s*(U\/L|IU\/L)/i,
    category: 'liver',
    defaultUnit: 'U/L'
  },
  ast: {
    pattern: /(?:AST|Aspartate Transaminase|SGOT)\s*[:=]?\s*(?:Normal range:?\s*[\d\.]+\s*-\s*[\d\.]+\s*(?:U\/L|IU\/L))?\s*(\d+(?:\.\d+)?)\s*(?:High|Low|Normal)?\s*(U\/L|IU\/L)/i,
    category: 'liver',
    defaultUnit: 'U/L'
  },
  alkalinePhosphatase: {
    pattern: /(?:Alkaline Phosphatase|ALP)\s*[:=]?\s*(?:Normal range:?\s*[\d\.]+\s*-\s*[\d\.]+\s*(?:U\/L|IU\/L))?\s*(\d+(?:\.\d+)?)\s*(?:High|Low|Normal)?\s*(U\/L|IU\/L)/i,
    category: 'liver',
    defaultUnit: 'U/L'
  },

  // Kidney Function - More flexible patterns
  creatinine: {
    pattern: /(?:Creatinine|Cr)\s*[:=]?\s*(?:Normal range:?\s*[\d\.]+\s*-\s*[\d\.]+\s*(?:mg\/dL|µmol\/L))?\s*(\d+(?:\.\d+)?)\s*(?:High|Low|Normal)?\s*(mg\/dL|µmol\/L)/i,
    category: 'kidney',
    defaultUnit: 'mg/dL'
  },
  bun: {
    pattern: /(?:BUN|Blood Urea Nitrogen|Urea)\s*[:=]?\s*(?:Normal range:?\s*[\d\.]+\s*-\s*[\d\.]+\s*(?:mg\/dL|mmol\/L))?\s*(\d+(?:\.\d+)?)\s*(?:High|Low|Normal)?\s*(mg\/dL|mmol\/L)/i,
    category: 'kidney',
    defaultUnit: 'mg/dL'
  },
  egfr: {
    pattern: /(?:eGFR|Estimated GFR|Glomerular Filtration Rate)\s*[:=]?\s*(?:Normal range:?\s*[\d\.]+\s*-\s*[\d\.]+\s*(?:mL\/min\/1\.73m²))?\s*(\d+(?:\.\d+)?)\s*(?:High|Low|Normal)?\s*(mL\/min\/1\.73m²)/i,
    category: 'kidney',
    defaultUnit: 'mL/min/1.73m²'
  },

  // Hormones - More flexible patterns
  cortisol: {
    pattern: /(?:Cortisol)\s*[:=]?\s*(?:Normal range:?\s*[\d\.]+\s*-\s*[\d\.]+\s*(?:µg\/dL|nmol\/L))?\s*(\d+(?:\.\d+)?)\s*(?:High|Low|Normal)?\s*(µg\/dL|nmol\/L)/i,
    category: 'hormone',
    defaultUnit: 'µg/dL'
  },
  testosterone: {
    pattern: /(?:Testosterone|Total Testosterone)\s*[:=]?\s*(?:Normal range:?\s*[\d\.]+\s*-\s*[\d\.]+\s*(?:ng\/dL|nmol\/L))?\s*(\d+(?:\.\d+)?)\s*(?:High|Low|Normal)?\s*(ng\/dL|nmol\/L)/i,
    category: 'hormone',
    defaultUnit: 'ng/dL'
  },
  estradiol: {
    pattern: /(?:Estradiol|E2)\s*[:=]?\s*(?:Normal range:?\s*[\d\.]+\s*-\s*[\d\.]+\s*(?:pg\/mL|pmol\/L))?\s*(\d+(?:\.\d+)?)\s*(?:High|Low|Normal)?\s*(pg\/mL|pmol\/L)/i,
    category: 'hormone',
    defaultUnit: 'pg/mL'
  }
};

// Use the exact types from the schema
type LabMetadata = NonNullable<SelectLabResult['metadata']>;
type BiomarkerMetadata = NonNullable<LabMetadata['biomarkers']>;

// Update the metadata schema to include new fields
type BiomarkerProcessingMetadata = {
  regexMatches?: number;
  llmExtractions?: number;
  processingTime?: number;
  retryCount?: number;
  textLength?: number;
  errorDetails?: string;
  biomarkerCount?: number;
  source?: string;
};

export class BiomarkerExtractionService {
  private async extractWithRegex(text: string, transactionId?: string): Promise<z.infer<typeof BiomarkerSchema>[]> {
    const results: z.infer<typeof BiomarkerSchema>[] = [];
    logger.info('Starting regex extraction with text:', { 
      textLength: text.length,
      textSample: text.substring(0, 500),
      patterns: Object.keys(BIOMARKER_PATTERNS),
      transactionId 
    });

    // Pre-process text to handle fragmented numbers
    const preprocessedText = text
      // Fix numbers running together (e.g., "136145" -> "136 145")
      .replace(/(\d{3})(\d{3})/g, '$1 $2')
      // Fix numbers with status (e.g., "3.4Low" -> "3.4 Low")
      .replace(/(\d+(?:\.\d+)?)(High|Low|Normal|H|L|N)/gi, '$1 $2')
      // Fix numbers with units
      .replace(/(\d+(?:\.\d+)?)(mg\/dL|mmol\/L|g\/dL|g\/L|ng\/mL|µg\/L|IU\/L|mEq\/L|mm³|µL|nL|pL|fL|%|U\/L)/gi, '$1 $2');

    // Extract test date with more flexible patterns
    const datePatterns = [
      /(?:Date|Collection Date|Report Date|Test Date):\s*(\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4})/i,
      /(?:Date|Collection Date|Report Date|Test Date):\s*(\d{4}[-\/]\d{1,2}[-\/]\d{1,2})/i,
      /(?:Date|Collection Date|Report Date|Test Date):\s*(\w+\s+\d{1,2},?\s+\d{4})/i,
      /Collected on (\w+\s+\d{1,2},?\s+\d{4})/i  // Add this pattern for "Collected on" format
    ];

    let testDate: string | undefined;
    for (const pattern of datePatterns) {
      const dateMatch = preprocessedText.match(pattern);
      if (dateMatch) {
        try {
          testDate = new Date(dateMatch[1]).toISOString();
          logger.info('Found test date with regex:', { date: testDate, pattern: pattern.toString() });
          break;
        } catch (e) {
          logger.warn('Failed to parse date:', { date: dateMatch[1], error: e instanceof Error ? e.message : String(e) });
        }
      }
    }

    // More lenient ranges for common biomarkers - primarily to filter out obviously wrong values
    const BIOMARKER_RANGES: Record<string, { min: number; max: number; unit?: string }> = {
      // Metabolic markers - expanded ranges
      glucose: { min: 10, max: 800, unit: 'mg/dL' },
      hemoglobinA1c: { min: 2.0, max: 25.0, unit: '%' },
      insulin: { min: 0.01, max: 500, unit: 'µIU/mL' },
      
      // Lipid panel - expanded ranges
      cholesterol: { min: 20, max: 800, unit: 'mg/dL' },
      hdl: { min: 5, max: 200, unit: 'mg/dL' },
      ldl: { min: 5, max: 600, unit: 'mg/dL' },
      triglycerides: { min: 5, max: 3000, unit: 'mg/dL' },
      
      // Electrolytes - expanded ranges
      sodium: { min: 100, max: 200, unit: 'mmol/L' },
      potassium: { min: 1.0, max: 10.0, unit: 'mmol/L' },
      chloride: { min: 60, max: 150, unit: 'mmol/L' },
      co2: { min: 5, max: 50, unit: 'mmol/L' },
      anionGap: { min: 1, max: 40, unit: 'mmol/L' },
      
      // Blood count - expanded ranges
      hemoglobin: { min: 1, max: 30, unit: 'g/dL' },
      hematocrit: { min: 5, max: 80, unit: '%' },
      platelets: { min: 5, max: 2000, unit: 'K/µL' },
      
      // Kidney function - expanded ranges
      creatinine: { min: 0.01, max: 30, unit: 'mg/dL' },
      bun: { min: 0.5, max: 300, unit: 'mg/dL' },
      egfr: { min: 0.5, max: 250, unit: 'mL/min/1.73m²' },
      
      // Liver function - expanded ranges
      alt: { min: 0.5, max: 3000, unit: 'U/L' },
      ast: { min: 0.5, max: 3000, unit: 'U/L' },
      alkalinePhosphatase: { min: 5, max: 1500, unit: 'U/L' },
      
      // Thyroid - expanded ranges
      tsh: { min: 0.001, max: 150, unit: 'mIU/L' },
      t4: { min: 0.01, max: 50, unit: 'ng/dL' },
      t3: { min: 0.1, max: 25, unit: 'pg/mL' },
      
      // Vitamins - expanded ranges
      vitaminD: { min: 0.5, max: 200, unit: 'ng/mL' },
      vitaminB12: { min: 10, max: 10000, unit: 'pg/mL' },
      folate: { min: 0.1, max: 100, unit: 'ng/mL' },
      
      // Minerals - expanded ranges
      ferritin: { min: 0.5, max: 10000, unit: 'ng/mL' },
      iron: { min: 5, max: 800, unit: 'µg/dL' },
      magnesium: { min: 0.1, max: 10.0, unit: 'mg/dL' },
      
      // Hormones - expanded ranges
      cortisol: { min: 0.01, max: 200, unit: 'µg/dL' },
      testosterone: { min: 0.5, max: 3000, unit: 'ng/dL' },
      estradiol: { min: 0.5, max: 2000, unit: 'pg/mL' }
    };

    // Track matches and validation results
    let totalMatches = 0;
    let validationFailures = 0;
    let successfulExtractions = 0;

    for (const [name, { pattern, category, defaultUnit }] of Object.entries(BIOMARKER_PATTERNS)) {
      // Ensure pattern is global
      const globalPattern = new RegExp(pattern.source, pattern.flags + (pattern.global ? '' : 'g'));

      const matches = preprocessedText.matchAll(globalPattern);

      for (const match of matches) {
        totalMatches++;

        // Handle both ordering patterns (value-unit and unit-value)
        const value = match[1] || match[3]; // First or third capture group
        let unit = match[2] || match[4] || defaultUnit; // Second or fourth capture group or default
        const status = match[0].match(/(?:High|Low|Normal|H|L|N)/i)?.[0];

        // Ensure unit is always present - critical for charting
        if (!unit || unit.trim() === '') {
          unit = defaultUnit;
          logger.info('Applied default unit for biomarker:', {
            biomarker: name,
            value,
            appliedUnit: unit
          });
        }

        if (!value) {
          logger.warn('No value found in match:', { biomarker: name, match: match[0] });
          continue;
        }

        try {
          const parsedValue = parseFloat(value);
          if (isNaN(parsedValue)) {
            logger.warn('Failed to parse biomarker value as number:', {
              biomarker: name,
              rawValue: value
            });
            validationFailures++;
            continue;
          }

          // Check if value is within reasonable range (more lenient validation)
          const range = BIOMARKER_RANGES[name];
          if (range && (parsedValue < range.min || parsedValue > range.max)) {
            // Log warning but don't reject - allow borderline values through
            logger.info('Biomarker value outside typical range, but accepting:', {
              biomarker: name,
              value: parsedValue,
              expectedRange: range,
              matchContext: match[0]
            });
            // Don't increment validationFailures - accept the value
          }

          // Additional check: detect if this might be a reference range value
          if (this.isLikelyReferenceRangeValue(match[0], parsedValue, name)) {
            logger.warn('Skipping likely reference range value:', {
              biomarker: name,
              value: parsedValue,
              context: match[0]
            });
            validationFailures++;
            continue;
          }

          const biomarker = {
            name,
            value: parsedValue,
            unit: unit || defaultUnit,
            testDate,
            category,
            source: 'regex',
            confidence: 0.9,
            status: status ? this.normalizeStatus(status) : undefined
          };

          try {
            const validated = BiomarkerSchema.parse(biomarker);
            results.push(validated);
            successfulExtractions++;
            logger.info('Successfully validated biomarker:', {
              biomarker: name,
              value: parsedValue,
              unit: biomarker.unit,
              status: biomarker.status
            });
          } catch (validationError) {
            validationFailures++;
            logger.warn('Zod validation failed for biomarker:', {
              biomarker: name,
              error: validationError instanceof Error ? validationError.message : String(validationError)
            });
          }
        } catch (parseError) {
          validationFailures++;
          logger.warn('Error processing biomarker value:', {
            biomarker: name,
            error: parseError instanceof Error ? parseError.message : String(parseError)
          });
        }
      }
    }

    // Calculate recall percentage
    const expectedBiomarkers = Object.keys(BIOMARKER_PATTERNS).length;
    const recallPercentage = (successfulExtractions / expectedBiomarkers) * 100;

    if (recallPercentage < 60) {
      logger.warn('Low regex recall detected:', {
        recallPercentage,
        expectedBiomarkers,
        foundBiomarkers: successfulExtractions,
        textLength: preprocessedText.length,
        totalMatches,
        validationFailures,
        sampleText: preprocessedText.substring(0, 200) // Add sample text for debugging
      });
    }

    logger.info('Regex extraction complete:', {
      totalMatches,
      validationFailures,
      successfulExtractions,
      recallPercentage,
      biomarkersFound: results.map(r => r.name)
    });

    return results;
  }

  private async extractWithLLM(text: string, transactionId?: string): Promise<z.infer<typeof BiomarkerSchema>[]> {
    try {
      logger.info('Starting LLM extraction with text length:', { 
        textLength: text.length,
        transactionId 
      });

      const functions = [{
        name: "extract_lab_biomarkers",
        description: "Extract actual patient test results from medical lab report, excluding reference ranges",
        parameters: {
          type: "object",
          properties: {
            biomarkers: {
              type: "array",
              description: "Array of ACTUAL patient test results only. Do not include reference range values.",
              minItems: 0,
              maxItems: 50,
              items: {
                type: "object",
                required: ["name", "value", "unit", "category"],
                additionalProperties: false,
                properties: {
                  name: { 
                    type: "string",
                    description: "Specific biomarker name (e.g., 'Total Cholesterol', 'HDL Cholesterol', 'Glucose')",
                    minLength: 2,
                    maxLength: 100
                  },
                  value: { 
                    type: "number",
                    description: "ACTUAL patient test result value (numeric only, never reference range)",
                    minimum: 0,
                    maximum: 10000
                  },
                  unit: { 
                    type: "string",
                    description: "Unit of measurement. REQUIRED for all biomarkers (infer standard units if missing)",
                    minLength: 1,
                    maxLength: 20,
                    examples: ["mg/dL", "mmol/L", "g/dL", "%", "mIU/L", "ng/mL", "pg/mL", "U/L", "K/µL"]
                  },
                  category: { 
                    type: "string", 
                    description: "Medical category of biomarker",
                    enum: ["lipid", "metabolic", "thyroid", "vitamin", "mineral", "blood", "liver", "kidney", "hormone", "electrolyte", "other"]
                  },
                  referenceRange: { 
                    type: "string",
                    description: "Reference range if explicitly stated in report (e.g., '70-99 mg/dL')",
                    maxLength: 50
                  },
                  testDate: { 
                    type: "string", 
                    description: "Test date in YYYY-MM-DD format from report header/footer",
                    pattern: "^\\d{4}-\\d{2}-\\d{2}$"
                  },
                  status: { 
                    type: "string",
                    description: "Clinical status if indicated in report",
                    enum: ["High", "Low", "Normal"]
                  },
                  confidence: {
                    type: "number",
                    description: "Confidence score 0.0-1.0 based on text clarity",
                    minimum: 0.0,
                    maximum: 1.0
                  }
                }
              }
            },
            extractionNotes: {
              type: "string",
              description: "Brief notes about extraction quality or challenges encountered",
              maxLength: 200
            }
          },
          required: ["biomarkers"]
        }
      }];

      const systemPrompt = `You are an expert medical laboratory report parser with deep understanding of clinical lab report structure and terminology.

## YOUR MISSION
Extract ONLY actual patient test results from this lab report. Your goal is to provide clean, structured data for medical tracking and charting.

## MEDICAL DOCUMENT UNDERSTANDING
Lab reports typically contain:
1. **Patient Results** - The actual measured values for this patient (EXTRACT THESE)
2. **Reference Ranges** - Normal/expected value ranges for comparison (IGNORE THESE)
3. **Quality Control Data** - Lab calibration values (IGNORE THESE)
4. **Header/Footer Info** - Lab name, dates, patient info (USE DATES ONLY)

## CRITICAL EXTRACTION RULES

### 1. IDENTIFY ACTUAL RESULTS
Look for these patterns indicating REAL patient results:
- Values immediately following biomarker names: "Glucose: 95 mg/dL"
- Values in result columns of tables
- Values with status indicators: "Cholesterol: 185 mg/dL (Normal)"
- Values followed by units then status: "Hemoglobin 14.2 g/dL H"

### 2. AVOID REFERENCE RANGE VALUES
NEVER extract values from these contexts:
- "Normal range: 70-99" → SKIP both 70 and 99
- "Reference: 40-160" → SKIP both 40 and 160  
- "Expected: 3.5-5.0" → SKIP both 3.5 and 5.0
- Any value appearing in format "X-Y" or "X to Y"
- Values preceded by words: "normal", "reference", "range", "expected", "typical"

### 3. HANDLE EDGE CASES
- If a biomarker name appears multiple times, extract the result value, not range values
- For "Glucose 95 (Normal: 70-99)", extract 95, ignore 70 and 99
- For fragmented text from OCR, look for the logical result value
- If units are missing, infer standard units based on biomarker type

### 4. REQUIRED OUTPUT QUALITY
- Every biomarker MUST have a valid numeric value
- Every biomarker MUST have a unit (infer if not explicit)
- Use specific names: "HDL Cholesterol" not "Cholesterol"
- Status should reflect actual result vs. reference range when available

## STANDARD UNITS (infer these if not specified):
- Glucose, Cholesterol, HDL, LDL, Triglycerides: mg/dL
- Hemoglobin A1c: %
- TSH: mIU/L  
- Free T4: ng/dL
- Free T3: pg/mL
- Vitamin D: ng/mL
- Vitamin B12: pg/mL
- Creatinine: mg/dL
- Hemoglobin: g/dL
- Hematocrit: %
- ALT, AST: U/L

## EXAMPLES OF CORRECT EXTRACTION:

✅ CORRECT:
"Glucose: 95 mg/dL (Normal range: 70-99)" → Extract: {name: "Glucose", value: 95, unit: "mg/dL"}
"Total Cholesterol 220 High (Normal: <200)" → Extract: {name: "Total Cholesterol", value: 220, unit: "mg/dL", status: "High"}

❌ INCORRECT:
"Normal range: 70-99" → Do NOT extract 70 or 99
"Reference: 40-160 mg/dL" → Do NOT extract 40 or 160

## FOCUS AREAS
Extract these biomarker categories when present:
- **Lipid Panel**: Total Cholesterol, LDL, HDL, Triglycerides
- **Basic Metabolic**: Glucose, Sodium, Potassium, Chloride, CO2, BUN, Creatinine
- **Complete Blood Count**: Hemoglobin, Hematocrit, WBC, RBC, Platelets  
- **Liver Function**: ALT, AST, Alkaline Phosphatase, Bilirubin
- **Thyroid**: TSH, Free T4, Free T3
- **Vitamins**: Vitamin D, B12, Folate
- **Other**: Hemoglobin A1c, Iron, Ferritin, Magnesium, PSA

Remember: Your output will be used for medical tracking and charting. Accuracy is critical.`;

      // Call OpenAI with optimized settings for medical text extraction
      const response = await openai.chat.completions.create({
        model: "gpt-4o", // Keeping 4o for medical accuracy
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Please extract biomarkers from this lab report:\n\n${text}` }
        ],
        temperature: 0.05, // Lower temperature for more consistent medical extraction
        max_tokens: 4096, // Sufficient for complex lab reports
        tools: functions.map(func => ({
          type: "function",
          function: func
        })),
        tool_choice: {
          type: "function",
          function: { name: "extract_lab_biomarkers" }
        }
      });

      // Extract biomarkers from the response
      const toolCall = response.choices[0]?.message?.tool_calls?.[0];
      if (toolCall?.type === 'function' && toolCall.function.name === 'extract_lab_biomarkers') {
        try {
          const parsedFunction = JSON.parse(toolCall.function.arguments);
          const biomarkers = parsedFunction.biomarkers || [];
          const extractionNotes = parsedFunction.extractionNotes || '';

          logger.info('LLM extraction completed:', { 
            count: biomarkers.length,
            extractionNotes,
            sampleBiomarkers: biomarkers.slice(0, 3).map((b: any) => ({
              name: b.name,
              value: b.value,
              unit: b.unit,
              confidence: b.confidence
            }))
          });

          // Enhanced validation and mapping
          const validatedBiomarkers: z.infer<typeof BiomarkerSchema>[] = [];
          let validationErrors = 0;

          for (const b of biomarkers) {
            try {
              // Validate required fields first
              if (!b.name || typeof b.value !== 'number' || !b.unit || !b.category) {
                logger.warn('LLM biomarker missing required fields:', {
                  name: b.name,
                  value: b.value,
                  unit: b.unit,
                  category: b.category
                });
                validationErrors++;
                continue;
              }

              // Convert to our schema format with enhanced validation
              const biomarker = {
                name: b.name.trim(),
                value: b.value,
                unit: b.unit.trim(),
                category: b.category,
                referenceRange: b.referenceRange || undefined,
                testDate: b.testDate || new Date().toISOString().split('T')[0],
                status: b.status || undefined,
                extractionMethod: 'llm' as const,
                source: 'llm',
                confidence: b.confidence || 0.95, // Use LLM confidence if provided
                sourceText: undefined
              };

              // Additional validation checks
              if (biomarker.value < 0 || biomarker.value > 10000) {
                logger.warn('LLM biomarker value out of reasonable range:', {
                  biomarker: biomarker.name,
                  value: biomarker.value
                });
                validationErrors++;
                continue;
              }

              // Validate with our schema
              const validated = BiomarkerSchema.parse(biomarker);
              validatedBiomarkers.push(validated);
              
            } catch (valErr) {
              validationErrors++;
              logger.warn('Failed to validate LLM biomarker:', {
                biomarker: b.name || 'unknown',
                value: b.value,
                unit: b.unit,
                error: valErr instanceof Error ? valErr.message : String(valErr),
                issues: valErr instanceof z.ZodError ? valErr.issues : undefined
              });
            }
          }

          logger.info('LLM extraction validation complete:', {
            originalCount: biomarkers.length,
            validCount: validatedBiomarkers.length,
            validationErrors,
            extractionNotes,
            successRate: biomarkers.length > 0 ? (validatedBiomarkers.length / biomarkers.length * 100).toFixed(1) + '%' : '0%'
          });

          return validatedBiomarkers;
        } catch (parseError) {
          logger.error('Failed to parse LLM function response:', {
            error: parseError instanceof Error ? parseError.message : String(parseError),
            rawResponse: toolCall.function.arguments.substring(0, 500)
          });
        }
      } else {
        logger.warn('LLM extraction did not return expected tool call', {
          hasResponse: !!response.choices[0],
          hasMessage: !!response.choices[0]?.message,
          hasToolCalls: !!response.choices[0]?.message?.tool_calls,
          toolCallType: toolCall?.type,
          functionName: toolCall?.type === 'function' ? toolCall.function.name : undefined
        });
      }

      return [];
    } catch (error) {
      logger.error('LLM extraction failed:', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      });
      return [];
    }
  }

  private async extractWithPatterns(text: string): Promise<Biomarker[]> {
    try {
      const patternService = new BiomarkerPatternService();
      const patternMatches = await patternService.extractPatterns(text);

      // Convert pattern matches to biomarker format with proper typing
      return patternMatches.map((match: PatternMatch) => ({
        name: match.name,
        value: match.value,
        unit: match.unit,
        category: match.category,
        confidence: match.confidence,
        sourceText: match.sourceText,
        extractionMethod: 'pattern' as const,
        status: match.validationStatus === 'valid' ? 'Normal' : 
                match.validationStatus === 'warning' ? 'High' : 'Low',
        testDate: new Date() // Add default test date
      }));
    } catch (error) {
      logger.error('Error in pattern-based extraction:', {
        error: error instanceof Error ? error.message : String(error)
      });
      return [];
    }
  }

  private mergeResultsWithConfidence(
    regexResults: z.infer<typeof BiomarkerSchema>[],
    llmResults: z.infer<typeof BiomarkerSchema>[],
    patternResults: Biomarker[]
  ): z.infer<typeof BiomarkerSchema>[] {
    const mergedMap = new Map<string, z.infer<typeof BiomarkerSchema>>();

    // Helper function to add or update biomarker in map
    const addOrUpdateBiomarker = (biomarker: z.infer<typeof BiomarkerSchema>) => {
      const key = biomarker.name.toLowerCase();
      const existing = mergedMap.get(key);

      if (!existing || (biomarker.confidence && biomarker.confidence > (existing.confidence || 0))) {
        mergedMap.set(key, biomarker);
      }
    };

    // Add results in order of confidence (pattern -> regex -> llm)
    patternResults.forEach(b => addOrUpdateBiomarker(BiomarkerSchema.parse(b)));
    regexResults.forEach(addOrUpdateBiomarker);
    llmResults.forEach(addOrUpdateBiomarker);

    return Array.from(mergedMap.values());
  }

  private validateAndStandardizeResults(results: z.infer<typeof BiomarkerSchema>[]): {
    parsedBiomarkers: z.infer<typeof BiomarkerSchema>[];
    parsingErrors: string[];
  } {
    const validatedBiomarkers: z.infer<typeof BiomarkerSchema>[] = [];
    const errors: string[] = [];

    for (const biomarker of results) {
      try {
        // Validation is already done via parse, just standardize
        const standardized = this.standardizeUnit(biomarker);
        validatedBiomarkers.push(standardized);
      } catch (error) {
        errors.push(`Validation failed for ${biomarker.name}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    return {
      parsedBiomarkers: validatedBiomarkers,
      parsingErrors: errors
    };
  }

  private getMissingCategories(existingResults: z.infer<typeof BiomarkerSchema>[]): string {
    const allCategories: BiomarkerCategory[] = [
      'lipid', 'metabolic', 'thyroid', 'vitamin', 
      'mineral', 'blood', 'liver', 'kidney', 'hormone'
    ];

    const existingCategories = new Set(
      existingResults.map(r => r.category?.toLowerCase() as BiomarkerCategory)
    );

    const missingCategories = allCategories.filter(
      cat => !existingCategories.has(cat)
    );

    return missingCategories.join(', ');
  }

  private standardizeUnit(biomarker: z.infer<typeof BiomarkerSchema>): z.infer<typeof BiomarkerSchema> {
    const numericValue = typeof biomarker.value === 'string' ? 
      parseFloat(biomarker.value) : biomarker.value;

    return {
      ...biomarker,
      value: numericValue
    };
  }

  async extractBiomarkers(text: string, transactionId?: string): Promise<{
    parsedBiomarkers: z.infer<typeof BiomarkerSchema>[];
    parsingErrors: string[];
  }> {
    logger.info('Starting biomarker extraction pipeline', {
      textLength: text.length,
      transactionId
    });

    // 1. First pass: Quick regex extraction for high-confidence matches
    const regexResults = await this.extractWithRegex(text, transactionId);

    // 2. Second pass: Use regex results to guide LLM extraction
    const llmPrompt = this.buildEnhancedPrompt(text, regexResults);
    const llmResults = await this.extractWithLLM(llmPrompt, transactionId);

    // 3. Third pass: Pattern-based extraction for specific formats
    const patternResults = await this.extractWithPatterns(text);

    // 4. Merge results with confidence scoring
    const mergedResults = this.mergeResultsWithConfidence(
      regexResults,
      llmResults,
      patternResults
    );

    logger.info('Extraction pipeline completed', {
      regexCount: regexResults.length,
      llmCount: llmResults.length,
      patternCount: patternResults.length,
      mergedCount: mergedResults.length,
      transactionId
    });

    // 5. Validate and standardize
    return this.validateAndStandardizeResults(mergedResults);
  }

  private buildEnhancedPrompt(text: string, regexResults: z.infer<typeof BiomarkerSchema>[]): string {
    // Build a more focused prompt using regex results
    return `Extract biomarkers from this lab report. 
      I've already found these high-confidence biomarkers: ${JSON.stringify(regexResults)}
      Please focus on finding additional biomarkers, especially in these categories:
      ${this.getMissingCategories(regexResults)}

      Pay special attention to:
      1. Values near reference ranges
      2. Abnormal values (marked High/Low)
      3. Values in tables or structured sections

      Original text:
      ${text}`;
  }

  async storeBiomarkers(labResultId: number, biomarkers: z.infer<typeof BiomarkerSchema>[]): Promise<void> {
    const startTime = new Date();
    const transactionId = `tx_${labResultId}_${Date.now()}`;
    
    logger.info(`Starting atomic biomarker storage`, {
      labResultId,
      biomarkerCount: biomarkers.length,
      transactionId,
      timestamp: startTime.toISOString()
    });

    // Use database transaction for atomic operations
    return await db.transaction(async (tx) => {
      try {
        // Initialize or update processing status within transaction
        const [existingStatus] = await tx
          .select()
          .from(biomarkerProcessingStatus)
          .where(eq(biomarkerProcessingStatus.labResultId, labResultId))
          .limit(1);

        const processingMetadata = {
          biomarkerCount: biomarkers.length,
          processingTime: Date.now() - startTime.getTime(),
          transactionId
        };

        if (existingStatus) {
          await tx
            .update(biomarkerProcessingStatus)
            .set({
              status: 'processing' as const,
              startedAt: new Date(),
              metadata: {
                ...existingStatus.metadata,
                ...processingMetadata
              }
            })
            .where(eq(biomarkerProcessingStatus.labResultId, labResultId));
        } else {
          await tx
            .insert(biomarkerProcessingStatus)
            .values({
              labResultId,
              status: 'processing' as const,
              startedAt: new Date(),
              metadata: processingMetadata
            });
        }

        // Delete existing biomarkers within transaction
        const deleteResult = await tx
          .delete(biomarkerResults)
          .where(eq(biomarkerResults.labResultId, labResultId));

        logger.info(`Deleted existing biomarkers for lab ${labResultId}`, { 
          transactionId,
          deletedCount: deleteResult 
        });

      // Prepare biomarker inserts with proper data types and validation
      const biomarkerInserts = biomarkers
        .map(b => {
          try {
            const numericValue = typeof b.value === 'string' ? parseFloat(b.value) : b.value;
            const numericConfidence = b.confidence !== undefined ?
              (typeof b.confidence === 'string' ? parseFloat(b.confidence) : b.confidence) : 1.0;

            // Parse and validate test date
            let testDateValue: Date;
            try {
              testDateValue = b.testDate instanceof Date ? b.testDate :
                new Date(b.testDate || new Date());
              if (isNaN(testDateValue.getTime())) {
                throw new Error('Invalid date');
              }
            } catch (dateError) {
              logger.warn(`Invalid test date for biomarker ${b.name}, using current date`, {
                providedDate: b.testDate,
                error: dateError instanceof Error ? dateError.message : String(dateError)
              });
              testDateValue = new Date();
            }

            // Validate required fields
            if (!b.name || isNaN(numericValue)) {
              throw new Error(`Invalid biomarker data: ${JSON.stringify(b)}`);
            }

            // Ensure referenceRange is string | undefined, not null
            const referenceRange = b.referenceRange || undefined;

            const insert: InsertBiomarkerResult = {
              labResultId,
              name: b.name,
              value: String(numericValue),
              unit: b.unit || '',
              category: b.category || 'other',
              referenceRange,
              testDate: testDateValue,
              status: b.status || null,
              extractionMethod: b.extractionMethod || 'regex',
              confidence: isNaN(numericConfidence) ? null : String(numericConfidence),
              metadata: {
                sourceText: b.sourceText || undefined,
                extractionTimestamp: new Date().toISOString(),
                validationStatus: 'validated'
              }
            };

            return insert;
          } catch (error) {
            logger.error(`Error formatting biomarker for database: ${b.name}`, {
              error: error instanceof Error ? error.message : String(error),
              biomarker: b
            });
            throw error;
          }
        })
        .filter((b): b is InsertBiomarkerResult => b !== null);

      if (biomarkerInserts.length === 0) {
        throw new Error('No valid biomarkers to insert');
      }

        // Insert biomarkers in chunks within transaction
        const CHUNK_SIZE = 50;
        for (let i = 0; i < biomarkerInserts.length; i += CHUNK_SIZE) {
          const chunk = biomarkerInserts.slice(i, i + CHUNK_SIZE);
          await tx.insert(biomarkerResults).values(chunk);
          logger.info(`Inserted biomarker chunk ${Math.floor(i / CHUNK_SIZE) + 1}/${Math.ceil(biomarkerInserts.length / CHUNK_SIZE)}`, {
            transactionId,
            chunkSize: chunk.length
          });
        }

        // Update lab result metadata within transaction
        const [labResult] = await tx
          .select()
          .from(labResults)
          .where(eq(labResults.id, labResultId))
          .limit(1);

        if (!labResult) {
          throw new Error(`Lab result ${labResultId} not found during metadata update`);
        }

        const existingMetadata = (labResult.metadata || {}) as LabMetadata;
        const biomarkerMetadata: BiomarkerMetadata = {
          parsedBiomarkers: biomarkerInserts.map(b => ({
            name: b.name,
            value: parseFloat(b.value),
            unit: b.unit,
            referenceRange: b.referenceRange || undefined,
            testDate: b.testDate.toISOString(),
            category: b.category
          })),
          parsingErrors: [] as string[],
          extractedAt: new Date().toISOString()
        };

        const updatedMetadata: LabMetadata = {
          ...existingMetadata,
          biomarkers: biomarkerMetadata
        };

        await tx
          .update(labResults)
          .set({
            metadata: updatedMetadata
          })
          .where(eq(labResults.id, labResultId));

        // Update processing status to completed within transaction
        const completionMetadata = {
          processingTime: Date.now() - startTime.getTime(),
          regexMatches: biomarkerInserts.filter(b => b.extractionMethod === 'regex').length,
          llmExtractions: biomarkerInserts.filter(b => b.extractionMethod === 'llm').length,
          transactionId
        };

        await tx
          .update(biomarkerProcessingStatus)
          .set({
            status: 'completed' as const,
            completedAt: new Date(),
            biomarkerCount: biomarkerInserts.length,
            extractionMethod: biomarkerInserts.some(b => b.extractionMethod === 'llm') ? 'hybrid' : 'regex',
            metadata: completionMetadata
          })
          .where(eq(biomarkerProcessingStatus.labResultId, labResultId));

        // Verify storage within transaction
        const verificationCount = await tx
          .select({ count: sql`count(*)` })
          .from(biomarkerResults)
          .where(eq(biomarkerResults.labResultId, labResultId))
          .then(res => Number(res[0]?.count || 0));

        if (verificationCount !== biomarkerInserts.length) {
          const error = new Error(`Storage verification failed for lab ${labResultId}: expected ${biomarkerInserts.length}, found ${verificationCount}`);
          logger.error('Storage verification failed', {
            labResultId,
            expected: biomarkerInserts.length,
            found: verificationCount,
            transactionId
          });
          throw error;
        }

        logger.info(`Successfully completed atomic storage of ${biomarkerInserts.length} biomarkers for lab ${labResultId}`, {
          processingTime: Date.now() - startTime.getTime(),
          biomarkerCount: biomarkerInserts.length,
          transactionId
        });

        // Transaction will auto-commit if we reach here without throwing
      } catch (transactionError) {
        // Log transaction error and let it bubble up to trigger rollback
        logger.error(`Transaction failed for lab ${labResultId}`, {
          error: transactionError instanceof Error ? transactionError.message : String(transactionError),
          transactionId,
          processingTime: Date.now() - startTime.getTime()
        });
        throw transactionError;
      }
    }).catch(async (error) => {
      // Handle transaction failure - update processing status to error state outside transaction
      const errorMetadata = {
        processingTime: Date.now() - startTime.getTime(),
        errorDetails: error instanceof Error ? error.message : String(error),
        transactionId
      };

      try {
        await db
          .update(biomarkerProcessingStatus)
          .set({
            status: 'error' as const,
            errorMessage: error instanceof Error ? error.message : String(error),
            completedAt: new Date(),
            metadata: errorMetadata
          })
          .where(eq(biomarkerProcessingStatus.labResultId, labResultId));
      } catch (statusError) {
        logger.error('Failed to update error status after storage failure:', {
          originalError: error instanceof Error ? error.message : String(error),
          statusError: statusError instanceof Error ? statusError.message : String(statusError),
          transactionId
        });
      }

      logger.error(`Failed to store biomarkers for lab ${labResultId}:`, {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        biomarkerCount: biomarkers.length,
        processingTime: Date.now() - startTime.getTime(),
        transactionId
      });

      throw error;
    });
  }

  async processLabResult(labResultId: number): Promise<void> {
    const startTime = new Date();
    const transactionId = `proc_${labResultId}_${Date.now()}`;
    let textContent: string | undefined;

    logger.info('Starting lab result processing', {
      labResultId,
      transactionId,
      timestamp: startTime.toISOString()
    });

    try {
      // Get the lab result with metadata
      const [labResult] = await db
        .select()
        .from(labResults)
        .where(eq(labResults.id, labResultId))
        .limit(1);

      if (!labResult) {
        throw new Error(`Lab result ${labResultId} not found`);
      }

      // Get text content with proper fallback chain
      textContent = labResult.metadata?.preprocessedText?.normalizedText || 
                   labResult.metadata?.preprocessedText?.rawText ||
                   labResult.metadata?.ocr?.text || 
                   labResult.metadata?.summary;

      if (!textContent) {
        throw new Error(`No text content found for lab result ${labResultId}`);
      }

      // Update processing status to started
      await db.update(biomarkerProcessingStatus)
        .set({
          status: 'processing',
          startedAt: startTime,
          metadata: {
            textLength: textContent.length,
            retryCount: 0
          }
        })
        .where(eq(biomarkerProcessingStatus.labResultId, labResultId));

      // Extract biomarkers
      const { parsedBiomarkers, parsingErrors } = await this.extractBiomarkers(textContent, transactionId);
      const processingTime = Date.now() - startTime.getTime();

      logger.info(`Extracted ${parsedBiomarkers.length} biomarkers from lab result ${labResultId}`, {
        processingTime,
        biomarkers: parsedBiomarkers.map(b => b.name),
        regexCount: parsedBiomarkers.filter(b => b.extractionMethod === 'regex').length,
        llmCount: parsedBiomarkers.filter(b => b.extractionMethod === 'llm').length,
        transactionId,
        parsingErrors: parsingErrors.length > 0 ? parsingErrors : undefined
      });

      if (parsedBiomarkers.length > 0) {
        // Store biomarkers 
        await this.storeBiomarkers(labResultId, parsedBiomarkers);

        // Update lab metadata
        const [currentLabResult] = await db.select().from(labResults).where(eq(labResults.id, labResultId)).limit(1);
        const existingMetadata = (currentLabResult.metadata || {}) as LabMetadata;
        
        const biomarkerMetadata: BiomarkerMetadata = {
          parsedBiomarkers: parsedBiomarkers.map(b => ({
            name: b.name,
            value: typeof b.value === 'string' ? parseFloat(b.value) : b.value,
            unit: b.unit || '',
            referenceRange: b.referenceRange,
            testDate: (b.testDate instanceof Date ? b.testDate : new Date(b.testDate || Date.now())).toISOString(),
            category: b.category
          })),
          parsingErrors: parsingErrors || [],
          extractedAt: new Date().toISOString()
        };

        const updatedMetadata: LabMetadata = {
          ...existingMetadata,
          biomarkers: biomarkerMetadata,
          preprocessedText: existingMetadata.preprocessedText,
          size: existingMetadata.size || 0,
        };

        await db.update(labResults)
          .set({ metadata: updatedMetadata })
          .where(eq(labResults.id, labResultId));

        logger.info(`Successfully updated metadata for lab result ${labResultId}`, { transactionId });
      } else {
        logger.warn(`No biomarkers extracted for lab result ${labResultId}`, { transactionId });

        // Update processing status to indicate no data found
        await db.update(biomarkerProcessingStatus)
          .set({
            status: 'completed',
            completedAt: new Date(),
            biomarkerCount: 0,
            metadata: {
              processingTime,
              regexMatches: 0,
              llmExtractions: 0,
              retryCount: 0,
              transactionId
            }
          })
          .where(eq(biomarkerProcessingStatus.labResultId, labResultId));
      }
    } catch (error) {
      const processingTime = Date.now() - startTime.getTime();

      // Update processing status to error
      await db.update(biomarkerProcessingStatus)
        .set({
          status: 'error',
          completedAt: new Date(),
          metadata: {
            processingTime,
            retryCount: 0,
            textLength: textContent?.length || 0,
            errorDetails: error instanceof Error ? error.message : String(error),
            transactionId
          }
        })
        .where(eq(biomarkerProcessingStatus.labResultId, labResultId));

      logger.error(`Error processing biomarkers for lab result ${labResultId}:`, {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        textLength: textContent?.length || 0,
        transactionId
      });

      throw error; // Propagate the error to be handled by the caller
    }
  }

  private normalizeStatus(status: string): 'High' | 'Low' | 'Normal' {
    const normalized = status.toLowerCase();
    if (normalized.includes('high') || normalized === 'h') return 'High';
    if (normalized.includes('low') || normalized === 'l') return 'Low';
    return 'Normal';
  }

  private isLikelyReferenceRangeValue(context: string, value: number, biomarkerName: string): boolean {
    const lowerContext = context.toLowerCase();
    
    // Enhanced reference range indicators
    const rangeIndicators = [
      'range:', 'ref:', 'reference:', 'normal:', 'typical:', 'standard:',
      'expected:', 'limits:', 'interval:', 'norm:', 'ref range',
      'normal range:', 'reference range:', 'normal values:', 'expected range:',
      'typical range:', 'standard range:', 'within normal limits:', 'wnl:',
      'lab range:', 'lab normal:', 'institutional range:'
    ];
    
    const hasRangeIndicator = rangeIndicators.some(indicator => 
      lowerContext.includes(indicator)
    );
    
    // Check for context words that suggest reference information
    const referenceContextWords = [
      'normal', 'reference', 'range', 'expected', 'typical', 'standard',
      'limits', 'baseline', 'target', 'goal', 'optimal'
    ];
    
    const contextWordCount = referenceContextWords.filter(word => 
      lowerContext.includes(word)
    ).length;
    
    // More aggressive range pattern detection
    const rangePatterns = [
      /(\d+(?:\.\d+)?)\s*[-–—]\s*(\d+(?:\.\d+)?)/g, // Various dash types
      /(\d+(?:\.\d+)?)\s+to\s+(\d+(?:\.\d+)?)/gi,
      /(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)/g,
      /between\s+(\d+(?:\.\d+)?)\s+and\s+(\d+(?:\.\d+)?)/gi
    ];
    
    let isInRange = false;
    for (const pattern of rangePatterns) {
      const matches = Array.from(context.matchAll(pattern));
      for (const rangeMatch of matches) {
        const rangeLow = parseFloat(rangeMatch[1]);
        const rangeHigh = parseFloat(rangeMatch[2]);
        
        // If the extracted value is exactly the low or high end of a range
        if (value === rangeLow || value === rangeHigh) {
          isInRange = true;
          break;
        }
        
        // If the value is suspiciously close to range boundaries
        if (Math.abs(value - rangeLow) < 0.1 || Math.abs(value - rangeHigh) < 0.1) {
          isInRange = true;
          break;
        }
      }
      if (isInRange) break;
    }
    
    // If we found range indicators AND the value appears to be a range boundary
    if (hasRangeIndicator && isInRange) {
      return true;
    }
    
    // Enhanced heuristics: expanded common reference range values
    const commonReferenceValues: Record<string, number[]> = {
      glucose: [70, 99, 100, 125, 140], // Fasting and post-meal ranges
      cholesterol: [200, 239, 240, 300], // Various risk categories
      hdl: [40, 50, 60], // Gender-specific ranges
      ldl: [100, 129, 130, 159, 160, 189, 190], // Risk category boundaries
      triglycerides: [150, 199, 200, 499, 500], // Risk categories
      hemoglobinA1c: [5.7, 6.4, 7.0], // Diabetes diagnostic thresholds
      tsh: [0.4, 4.0, 4.5, 5.0], // Common TSH reference ranges
      creatinine: [0.6, 1.2, 1.3, 1.5], // Common creatinine ranges
      bun: [7, 20, 25], // Common BUN ranges
      sodium: [135, 145], // Electrolyte ranges
      potassium: [3.5, 5.0, 5.1], // Potassium ranges
    };
    
    const suspiciousValues = commonReferenceValues[biomarkerName];
    if (suspiciousValues && suspiciousValues.includes(value)) {
      // If it's a suspicious value and we have any reference context, flag it
      if (hasRangeIndicator || contextWordCount >= 2) {
        return true;
      }
    }
    
    return false;
  }
}

// Export a singleton instance
export const biomarkerExtractionService = new BiomarkerExtractionService();
export default biomarkerExtractionService;