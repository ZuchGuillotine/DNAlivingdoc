import { biomarkerPatternService } from '../biomarkerPatternService';
import type { PatternMatch } from '../biomarkerPatternService';

describe('BiomarkerPatternService', () => {
  // Test data with known biomarkers and their expected values
  const testCases = [
    {
      name: 'Basic glucose test',
      input: 'Glucose: 95 mg/dL',
      expected: {
        name: 'glucose',
        value: 95,
        unit: 'mg/dL',
        confidence: 0.95,
        tier: 'high'
      }
    },
    {
      name: 'HDL with alternative notation',
      input: 'HDL-C Level = 45 mg/dL (Normal)',
      expected: {
        name: 'hdl',
        value: 45,
        unit: 'mg/dL',
        confidence: 0.85,
        tier: 'medium'
      }
    },
    {
      name: 'Vitamin D with complex notation',
      input: '25-OH Vitamin D: 32 ng/mL (Low)',
      expected: {
        name: 'vitaminD',
        value: 32,
        unit: 'ng/mL',
        confidence: 0.75,
        tier: 'low'
      }
    },
    {
      name: 'Multiple biomarkers in one text',
      input: `
        Glucose: 95 mg/dL
        HDL Cholesterol: 45 mg/dL
        Vitamin D: 32 ng/mL
      `,
      expected: [
        {
          name: 'glucose',
          value: 95,
          unit: 'mg/dL',
          confidence: 0.95,
          tier: 'high'
        },
        {
          name: 'hdl',
          value: 45,
          unit: 'mg/dL',
          confidence: 0.85,
          tier: 'medium'
        },
        {
          name: 'vitaminD',
          value: 32,
          unit: 'ng/mL',
          confidence: 0.75,
          tier: 'low'
        }
      ]
    },
    // Edge cases
    {
      name: 'Invalid unit',
      input: 'Glucose: 95 invalid_unit',
      expected: null // Should be filtered out by validation
    },
    {
      name: 'Out of range value',
      input: 'Glucose: 2000 mg/dL', // Above max value
      expected: {
        name: 'glucose',
        value: 2000,
        unit: 'mg/dL',
        confidence: 0.95,
        tier: 'high',
        validationStatus: 'warning'
      }
    },
    {
      name: 'Unit conversion',
      input: 'Glucose: 5.5 mmol/L', // Should convert to mg/dL
      expected: {
        name: 'glucose',
        value: 99, // 5.5 * 18
        unit: 'mg/dL',
        confidence: 0.9025, // 0.95 * 0.95 (reduced for conversion)
        tier: 'high'
      }
    }
  ];

  // Helper function to compare matches
  const compareMatch = (actual: PatternMatch, expected: any) => {
    expect(actual.name).toBe(expected.name);
    expect(actual.value).toBeCloseTo(expected.value, 1);
    expect(actual.unit).toBe(expected.unit);
    expect(actual.confidence).toBeCloseTo(expected.confidence, 2);
    expect(actual.tier).toBe(expected.tier);
    if (expected.validationStatus) {
      expect(actual.validationStatus).toBe(expected.validationStatus);
    }
  };

  // Test individual cases
  test.each(testCases)('$name', async ({ input, expected }) => {
    const results = await biomarkerPatternService.extractPatterns(input);
    
    if (expected === null) {
      expect(results).toHaveLength(0);
      return;
    }

    if (Array.isArray(expected)) {
      expect(results).toHaveLength(expected.length);
      expected.forEach((exp, index) => {
        compareMatch(results[index], exp);
      });
    } else {
      expect(results).toHaveLength(1);
      compareMatch(results[0], expected);
    }
  });

  // Test recall and precision
  describe('Recall and Precision', () => {
    const comprehensiveTestData = [
      // True positives (should be found)
      { input: 'Glucose: 95 mg/dL', expected: true },
      { input: 'HDL-C: 45 mg/dL', expected: true },
      { input: 'Vitamin D: 32 ng/mL', expected: true },
      { input: 'Glucose Result = 95 mg/dL (Normal)', expected: true },
      { input: '25-OH Vitamin D Level: 32 ng/mL', expected: true },
      
      // False positives (should not be found)
      { input: 'Random text with numbers: 95', expected: false },
      { input: 'Glucose: invalid mg/dL', expected: false },
      { input: 'HDL: 45 invalid_unit', expected: false },
      
      // Edge cases
      { input: 'Glucose: 95 mg/dL (High)', expected: true },
      { input: 'Glucose: 95 mg/100mL', expected: true }, // Alternative unit
      { input: 'Glucose: 5.5 mmol/L', expected: true }, // Unit conversion
    ];

    test('measures recall and precision', async () => {
      let truePositives = 0;
      let falsePositives = 0;
      let falseNegatives = 0;

      for (const { input, expected } of comprehensiveTestData) {
        const results = await biomarkerPatternService.extractPatterns(input);
        const found = results.length > 0;

        if (expected && found) truePositives++;
        if (!expected && found) falsePositives++;
        if (expected && !found) falseNegatives++;
      }

      const recall = truePositives / (truePositives + falseNegatives);
      const precision = truePositives / (truePositives + falsePositives);

      console.log('Performance Metrics:', {
        truePositives,
        falsePositives,
        falseNegatives,
        recall: recall.toFixed(3),
        precision: precision.toFixed(3)
      });

      // Assert minimum performance requirements
      expect(recall).toBeGreaterThanOrEqual(0.95); // 95% recall
      expect(precision).toBeGreaterThanOrEqual(0.98); // 98% precision
    });
  });

  // Test validation and standardization
  describe('Validation and Standardization', () => {
    test('validates value ranges', async () => {
      const results = await biomarkerPatternService.extractPatterns('Glucose: 2000 mg/dL');
      expect(results[0].validationStatus).toBe('warning');
      expect(results[0].validationMessage).toContain('above expected maximum');
    });

    test('validates units', async () => {
      const results = await biomarkerPatternService.extractPatterns('Glucose: 95 invalid_unit');
      expect(results).toHaveLength(0); // Invalid unit should be filtered out
    });

    test('standardizes units', async () => {
      const results = await biomarkerPatternService.extractPatterns('Glucose: 5.5 mmol/L');
      expect(results[0].unit).toBe('mg/dL');
      expect(results[0].value).toBeCloseTo(99, 1); // 5.5 * 18
    });
  });

  // Test confidence scoring
  describe('Confidence Scoring', () => {
    test('assigns appropriate confidence based on tier', async () => {
      const results = await biomarkerPatternService.extractPatterns(`
        Glucose: 95 mg/dL
        HDL-C: 45 mg/dL
        Vitamin D: 32 ng/mL
      `);

      const glucose = results.find(r => r.name === 'glucose');
      const hdl = results.find(r => r.name === 'hdl');
      const vitaminD = results.find(r => r.name === 'vitaminD');

      expect(glucose?.confidence).toBeCloseTo(0.95, 2);
      expect(hdl?.confidence).toBeCloseTo(0.85, 2);
      expect(vitaminD?.confidence).toBeCloseTo(0.75, 2);
    });

    test('reduces confidence for unit conversions', async () => {
      const results = await biomarkerPatternService.extractPatterns('Glucose: 5.5 mmol/L');
      expect(results[0].confidence).toBeCloseTo(0.9025, 2); // 0.95 * 0.95
    });
  });
}); 