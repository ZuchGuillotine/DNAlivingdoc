export interface FactGateCitation {
  id: number;
  citationType: string;
  title: string;
  url: string | null;
  persistentId: string | null;
}

export interface FactGateFact {
  factId: number;
  factKey: string;
  panel: string;
  sourceAuthority: string;
  rsid: string;
  genotypePattern: string;
  revisionId: number;
  tier: number;
  claimTitle: string;
  claimSummary: string;
  claimDetails: string | null;
  reviewStatusRule: string | null;
  clinvarStarsObserved: number | null;
  confidenceModifier: string | null;
  citations: FactGateCitation[];
}

export interface FactGateCandidateRow {
  factId: number;
  factKey: string;
  panel: string;
  sourceAuthority: string;
  rsid: string;
  genotypePattern: string;
  status: string;
  revisionId: number;
  tier: number;
  claimTitle: string;
  claimSummary: string;
  claimDetails: string | null;
  reviewStatusRule: string | null;
  clinvarStarsObserved: number | null;
  confidenceModifier: string | null;
  citationId: number | null;
  citationType: string | null;
  citationTitle: string | null;
  citationUrl: string | null;
  citationPersistentId: string | null;
}

// Enforces that only approved facts with at least one citation can reach user-facing output.
export function applyFactGate(rows: FactGateCandidateRow[]): FactGateFact[] {
  const grouped = new Map<number, FactGateFact>();

  for (const row of rows) {
    if (row.status !== 'approved') {
      continue;
    }

    if (!grouped.has(row.revisionId)) {
      grouped.set(row.revisionId, {
        factId: row.factId,
        factKey: row.factKey,
        panel: row.panel,
        sourceAuthority: row.sourceAuthority,
        rsid: row.rsid,
        genotypePattern: row.genotypePattern,
        revisionId: row.revisionId,
        tier: row.tier,
        claimTitle: row.claimTitle,
        claimSummary: row.claimSummary,
        claimDetails: row.claimDetails,
        reviewStatusRule: row.reviewStatusRule,
        clinvarStarsObserved: row.clinvarStarsObserved,
        confidenceModifier: row.confidenceModifier,
        citations: [],
      });
    }

    const fact = grouped.get(row.revisionId)!;
    if (row.citationId && row.citationType && row.citationTitle) {
      const hasCitation = fact.citations.some((citation) => citation.id === row.citationId);
      if (!hasCitation) {
        fact.citations.push({
          id: row.citationId,
          citationType: row.citationType,
          title: row.citationTitle,
          url: row.citationUrl,
          persistentId: row.citationPersistentId,
        });
      }
    }
  }

  return Array.from(grouped.values()).filter((fact) => fact.citations.length > 0);
}
