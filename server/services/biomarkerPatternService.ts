/**
    * @description      : 
    * @author           : 
    * @group            : 
    * @created          : 17/05/2025 - 01:24:23
    * 
    * MODIFICATION LOG
    * - Version         : 1.0.0
    * - Date            : 17/05/2025
    * - Author          : 
    * - Modification    : 
**/
import { z } from 'zod';
import logger from '../utils/logger';
import type { BiomarkerCategory } from './biomarkerExtractionService';

// Define pattern tiers with confidence levels
export type PatternTier = 'high' | 'medium' | 'low';

interface PatternConfig {
  pattern: RegExp;
  category: BiomarkerCategory;
  tier: PatternTier;
  confidence: number;
  unitMap?: Record<string, string>; // Map alternative units to standard units
  valueTransform?: (value: string) => number; // Optional value transformation
  validationRules?: {
    minValue?: number;
    maxValue?: number;
    allowedUnits?: string[];
  };
}

// Standard unit mappings for common variations
const UNIT_MAPPINGS: Record<string, Record<string, string>> = {
  glucose: {
    'mg/dL': 'mg/dL',
    'mmol/L': 'mmol/L',
    'mg/100mL': 'mg/dL',
    'g/L': 'mg/dL', // Convert g/L to mg/dL (multiply by 100)
  },
  cholesterol: {
    'mg/dL': 'mg/dL',
    'mmol/L': 'mmol/L',
    'g/L': 'mg/dL', // Convert g/L to mg/dL (multiply by 100)
  },
  // Add more unit mappings as needed
};

// Value transformation functions for unit conversions
const VALUE_TRANSFORMS: Record<string, Record<string, (v: number) => number>> = {
  glucose: {
    'mmol/L->mg/dL': (v) => v * 18, // Convert mmol/L to mg/dL
    'g/L->mg/dL': (v) => v * 100,   // Convert g/L to mg/dL
  },
  cholesterol: {
    'g/L->mg/dL': (v) => v * 100,   // Convert g/L to mg/dL
  },
  // Add more transformations as needed
};

// Enhanced pattern definitions with tiers and validation
export const BIOMARKER_PATTERNS: Record<string, PatternConfig> = {
  // High confidence patterns (exact matches)
  glucose: {
    pattern: /(?:Glucose|Blood Glucose|Fasting Glucose|FBG)\s*(?:Result|Value|Level)?[:=]?\s*(\d+(?:\.\d+)?)\s*(mg\/dL|mmol\/L|g\/L)(?:\s*(?:High|Low|Normal|H|L|N))?/i,
    category: 'metabolic',
    tier: 'high',
    confidence: 0.95,
    unitMap: UNIT_MAPPINGS.glucose,
    valueTransform: (value) => {
      const num = parseFloat(value);
      // Apply unit conversions if needed
      return num;
    },
    validationRules: {
      minValue: 20,
      maxValue: 1000,
      allowedUnits: ['mg/dL', 'mmol/L', 'g/L']
    }
  },

  // Medium confidence patterns (common variations)
  hdl: {
    pattern: /(?:HDL|HDL-C|HDL Cholesterol|High-Density Lipoprotein)(?:\s*(?:Cholesterol|Level|Value))?[:=]?\s*(\d+(?:\.\d+)?)\s*(mg\/dL|mmol\/L)(?:\s*(?:High|Low|Normal|H|L|N))?/i,
    category: 'lipid',
    tier: 'medium',
    confidence: 0.85,
    unitMap: UNIT_MAPPINGS.cholesterol,
    validationRules: {
      minValue: 10,
      maxValue: 200,
      allowedUnits: ['mg/dL', 'mmol/L']
    }
  },

  // Low confidence patterns (fuzzy matches)
  vitaminD: {
    pattern: /(?:Vitamin\s*D|25-?OH\s*Vitamin\s*D|25-?Hydroxyvitamin\s*D|25\(OH\)D)(?:\s*(?:Level|Value|Result))?[:=]?\s*(\d+(?:\.\d+)?)\s*(ng\/mL|nmol\/L)(?:\s*(?:High|Low|Normal|H|L|N))?/i,
    category: 'vitamin',
    tier: 'low',
    confidence: 0.75,
    validationRules: {
      minValue: 5,
      maxValue: 200,
      allowedUnits: ['ng/mL', 'nmol/L']
    }
  },

  // Add more patterns with appropriate tiers...
};

// Pattern matching results with confidence scoring
export interface PatternMatch {
  name: string;
  value: number;
  unit: string;
  category: BiomarkerCategory;
  confidence: number;
  tier: PatternTier;
  sourceText: string;
  validationStatus: 'valid' | 'invalid' | 'warning';
  validationMessage?: string;
}

export class BiomarkerPatternService {
  private validateMatch(match: PatternMatch): PatternMatch {
    const config = BIOMARKER_PATTERNS[match.name];
    if (!config.validationRules) return match;

    const { minValue, maxValue, allowedUnits } = config.validationRules;
    let status: 'valid' | 'invalid' | 'warning' = 'valid';
    let message: string | undefined;

    // Value range validation
    if (minValue !== undefined && match.value < minValue) {
      status = 'warning';
      message = `Value ${match.value} is below expected minimum ${minValue}`;
    }
    if (maxValue !== undefined && match.value > maxValue) {
      status = 'warning';
      message = `Value ${match.value} is above expected maximum ${maxValue}`;
    }

    // Unit validation
    if (allowedUnits && !allowedUnits.includes(match.unit)) {
      status = 'invalid';
      message = `Invalid unit ${match.unit}. Allowed units: ${allowedUnits.join(', ')}`;
    }

    return { ...match, validationStatus: status, validationMessage: message };
  }

  private standardizeUnit(match: PatternMatch): PatternMatch {
    const config = BIOMARKER_PATTERNS[match.name];
    if (!config.unitMap) return match;

    const standardUnit = config.unitMap[match.unit];
    if (!standardUnit) return match;

    // Apply unit conversion if needed
    if (config.valueTransform) {
      const conversionKey = `${match.unit}->${standardUnit}`;
      const transform = VALUE_TRANSFORMS[match.name]?.[conversionKey];
      if (transform) {
        return {
          ...match,
          value: transform(match.value),
          unit: standardUnit,
          confidence: match.confidence * 0.95 // Slightly reduce confidence for converted values
        };
      }
    }

    return { ...match, unit: standardUnit };
  }

  async extractPatterns(text: string): Promise<PatternMatch[]> {
    const matches: PatternMatch[] = [];
    logger.info('Starting pattern extraction with enhanced matching', {
      textLength: text.length,
      patternCount: Object.keys(BIOMARKER_PATTERNS).length
    });

    // Process each pattern
    for (const [name, config] of Object.entries(BIOMARKER_PATTERNS)) {
      const regexMatches = text.matchAll(new RegExp(config.pattern, 'gi'));
      
      for (const match of regexMatches) {
        try {
          const [fullMatch, value, unit, status] = match;
          const parsedValue = parseFloat(value);
          
          if (isNaN(parsedValue)) {
            logger.warn('Failed to parse biomarker value', {
              biomarker: name,
              rawValue: value,
              match: fullMatch
            });
            continue;
          }

          // Create initial match
          const patternMatch: PatternMatch = {
            name,
            value: parsedValue,
            unit: unit || config.validationRules?.allowedUnits?.[0] || '',
            category: config.category,
            confidence: config.confidence,
            tier: config.tier,
            sourceText: fullMatch,
            validationStatus: 'valid'
          };

          // Apply validation and standardization
          const validatedMatch = this.validateMatch(patternMatch);
          if (validatedMatch.validationStatus === 'invalid') {
            logger.warn('Invalid biomarker match', {
              biomarker: name,
              match: validatedMatch,
              message: validatedMatch.validationMessage
            });
            continue;
          }

          // Standardize units
          const standardizedMatch = this.standardizeUnit(validatedMatch);
          
          matches.push(standardizedMatch);
          
          logger.debug('Successfully extracted biomarker', {
            biomarker: name,
            match: standardizedMatch
          });
        } catch (error) {
          logger.error('Error processing pattern match', {
            biomarker: name,
            error: error instanceof Error ? error.message : String(error),
            match: match[0]
          });
        }
      }
    }

    // Sort matches by confidence
    matches.sort((a, b) => b.confidence - a.confidence);

    // Remove duplicates (keep highest confidence match)
    const uniqueMatches = new Map<string, PatternMatch>();
    for (const match of matches) {
      const key = match.name.toLowerCase();
      const existing = uniqueMatches.get(key);
      if (!existing || match.confidence > existing.confidence) {
        uniqueMatches.set(key, match);
      }
    }

    const results = Array.from(uniqueMatches.values());
    
    logger.info('Pattern extraction complete', {
      totalMatches: matches.length,
      uniqueMatches: results.length,
      biomarkersFound: results.map(m => m.name)
    });

    return results;
  }
}

export const biomarkerPatternService = new BiomarkerPatternService(); 