import { applyFactGate, type FactGateCandidateRow } from '../services/geneticsFactGate';

function buildRow(overrides: Partial<FactGateCandidateRow> = {}): FactGateCandidateRow {
  return {
    factId: 1,
    factKey: 'FACT-1',
    panel: 'PGX',
    sourceAuthority: 'ClinVar',
    rsid: 'rs123',
    genotypePattern: 'AG',
    status: 'approved',
    revisionId: 100,
    tier: 2,
    claimTitle: 'Example title',
    claimSummary: 'Example summary',
    claimDetails: null,
    reviewStatusRule: 'ClinVar >= 1 star',
    clinvarStarsObserved: 2,
    confidenceModifier: 'moderate',
    citationId: 500,
    citationType: 'database_record',
    citationTitle: 'ClinVar record',
    citationUrl: 'https://example.com',
    citationPersistentId: 'VCV0000001',
    ...overrides,
  };
}

describe('geneticsFactService Fact Gate', () => {
  test('returns only approved facts with at least one citation', () => {
    const rows: FactGateCandidateRow[] = [
      buildRow(),
      buildRow({
        factId: 2,
        factKey: 'FACT-2',
        revisionId: 101,
        status: 'in_review',
      }),
      buildRow({
        factId: 3,
        factKey: 'FACT-3',
        revisionId: 102,
        citationId: null,
        citationType: null,
        citationTitle: null,
      }),
    ];

    const facts = applyFactGate(rows);
    expect(facts).toHaveLength(1);
    expect(facts[0].factKey).toBe('FACT-1');
    expect(facts[0].citations).toHaveLength(1);
  });

  test('deduplicates repeated citation rows from joins', () => {
    const rows: FactGateCandidateRow[] = [
      buildRow(),
      buildRow(),
      buildRow({
        citationId: 501,
        citationTitle: 'Secondary citation',
      }),
    ];

    const facts = applyFactGate(rows);
    expect(facts).toHaveLength(1);
    expect(facts[0].citations).toHaveLength(2);
    expect(facts[0].citations.map((c) => c.id)).toEqual([500, 501]);
  });

  test('retains independent approved revisions', () => {
    const rows: FactGateCandidateRow[] = [
      buildRow(),
      buildRow({
        factId: 2,
        factKey: 'FACT-2',
        revisionId: 200,
        rsid: 'rs999',
        citationId: 700,
        citationTitle: 'CPIC guideline',
        citationType: 'guideline',
      }),
    ];

    const facts = applyFactGate(rows);
    expect(facts).toHaveLength(2);
    expect(facts[0].factKey).toBe('FACT-1');
    expect(facts[1].factKey).toBe('FACT-2');
  });
});
