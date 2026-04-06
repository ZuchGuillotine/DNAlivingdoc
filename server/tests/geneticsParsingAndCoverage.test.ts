import { computeCoverageAndIntegrity } from '../services/geneticsCoverageService';
import { parseRawSnpText } from '../services/geneticsParserService';

describe('geneticsParserService', () => {
  test('parses common raw SNP formats and normalizes calls', () => {
    const raw = `
# comment
rsid\tchromosome\tposition\tgenotype
rs111\t1\t12345\tAG
rs222 2 22222 --
rs333,3,33333,t
`;

    const result = parseRawSnpText(raw);
    expect(result.calls).toHaveLength(3);
    expect(result.calls.find((c) => c.rsid === 'rs111')?.genotype).toBe('AG');
    expect(result.calls.find((c) => c.rsid === 'rs222')?.genotype).toBe('MISSING');
    expect(result.calls.find((c) => c.rsid === 'rs333')?.genotype).toBe('TT');
    expect(result.stats.rowCount).toBe(3);
    expect(result.stats.invalidRows).toBe(0);
  });

  test('tracks duplicates and conflicting duplicate calls', () => {
    const raw = `
rs111\t1\t12345\t--
rs111\t1\t12345\tAA
rs111\t1\t12345\tGG
badrow
`;

    const result = parseRawSnpText(raw);
    expect(result.calls).toHaveLength(1);
    expect(result.calls[0].genotype).toBe('AA');
    expect(result.stats.duplicateCount).toBe(2);
    expect(result.stats.conflictCount).toBe(2);
    expect(result.stats.invalidRows).toBe(1);
  });
});

describe('geneticsCoverageService', () => {
  test('computes coverage by panel and tier with integrity metadata', () => {
    const coverage = computeCoverageAndIntegrity({
      calls: [
        { rsid: 'rs111', genotype: 'AA' },
        { rsid: 'rs222', genotype: 'MISSING' },
        { rsid: 'rs333', genotype: 'CT' },
      ],
      panelRsids: {
        WELLNESS: ['rs111', 'rs222', 'rs999'],
        PGX: ['rs333', 'rs777'],
      },
      factRsids: ['rs111', 'rs222', 'rs333', 'rs777'],
      tierByRsid: {
        rs111: 1,
        rs222: 2,
        rs333: 2,
        rs777: 1,
      },
      duplicateCount: 1,
      conflictCount: 1,
      invalidRows: 2,
    });

    expect(coverage.panelCoverage.byPanel.WELLNESS).toBe(66.67);
    expect(coverage.panelCoverage.byPanel.PGX).toBe(50);
    expect(coverage.panelCoverage.byTier['1']).toBe(50);
    expect(coverage.panelCoverage.byTier['2']).toBe(100);
    expect(coverage.panelCoverage.callRate).toBeCloseTo(0.6667, 4);
    expect(coverage.panelCoverage.missingness).toBeCloseTo(0.3333, 4);
    expect(coverage.integrityScore).toBeLessThan(100);
    expect(coverage.integrityNotes.length).toBeGreaterThan(0);
  });
});
