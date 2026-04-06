import { buildDeterministicReportPayload, stableStringify, type ReportFinding } from '../services/geneticsReportBuilder';

function finding(overrides: Partial<ReportFinding> = {}): ReportFinding {
  return {
    factId: 10,
    factKey: 'FACT-A',
    revisionId: 100,
    panel: 'PGX',
    tier: 2,
    sourceAuthority: 'ClinVar',
    rsid: 'rs111',
    genotype: 'AA',
    claimTitle: 'Claim A',
    claimSummary: 'Summary A',
    claimDetails: null,
    reviewStatusRule: 'ClinVar >= 1 star',
    clinvarStarsObserved: 2,
    confidenceModifier: 'moderate',
    citations: [
      {
        id: 1,
        citationType: 'database_record',
        title: 'Citation A',
        url: 'https://example.com/a',
        persistentId: 'VCV1',
      },
    ],
    ...overrides,
  };
}

describe('geneticsReportBuilder', () => {
  test('stableStringify sorts nested object keys', () => {
    const value = {
      z: 1,
      a: {
        d: 4,
        b: 2,
      },
    };
    expect(stableStringify(value)).toBe('{"a":{"b":2,"d":4},"z":1}');
  });

  test('deterministic hash is stable for equivalent findings in different order', () => {
    const base = {
      uploadId: 5,
      factsetId: 9,
      coverage: {
        byPanel: { PGX: 80, WELLNESS: 40 },
      },
      integrityScore: 78,
      integrityNotes: ['note-1'],
    };

    const payloadOne = buildDeterministicReportPayload({
      ...base,
      findings: [
        finding({ factId: 12, revisionId: 120, rsid: 'rs333', tier: 1 }),
        finding({ factId: 11, revisionId: 110, rsid: 'rs222', tier: 2 }),
      ],
    });

    const payloadTwo = buildDeterministicReportPayload({
      ...base,
      findings: [
        finding({ factId: 11, revisionId: 110, rsid: 'rs222', tier: 2 }),
        finding({ factId: 12, revisionId: 120, rsid: 'rs333', tier: 1 }),
      ],
    });

    expect(payloadOne.findings[0].rsid).toBe('rs333');
    expect(payloadOne.deterministicHash).toBe(payloadTwo.deterministicHash);
  });
});
