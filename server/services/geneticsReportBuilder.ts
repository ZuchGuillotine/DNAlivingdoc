import crypto from 'crypto';
import type { FactGateFact } from './geneticsFactGate';

export interface ReportFinding {
  factId: number;
  factKey: string;
  revisionId: number;
  panel: string;
  tier: number;
  sourceAuthority: string;
  rsid: string;
  genotype: string;
  claimTitle: string;
  claimSummary: string;
  claimDetails: string | null;
  reviewStatusRule: string | null;
  clinvarStarsObserved: number | null;
  confidenceModifier: string | null;
  citations: FactGateFact['citations'];
}

export interface DeterministicReportPayload {
  uploadId: number;
  factsetId: number;
  findings: ReportFinding[];
  coverage: Record<string, unknown>;
  integrity: {
    score: number | null;
    notes: string[];
  };
  limitations: string[];
  deterministicHash: string;
}

function stableSortValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(stableSortValue);
  }
  if (value !== null && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b));
    const sorted: Record<string, unknown> = {};
    for (const [key, child] of entries) {
      sorted[key] = stableSortValue(child);
    }
    return sorted;
  }
  return value;
}

export function stableStringify(value: unknown): string {
  return JSON.stringify(stableSortValue(value));
}

export function buildDeterministicReportPayload(input: {
  uploadId: number;
  factsetId: number;
  findings: ReportFinding[];
  coverage: Record<string, unknown>;
  integrityScore: number | null;
  integrityNotes: string[];
}): DeterministicReportPayload {
  const findings = [...input.findings].sort((a, b) => {
    if (a.tier !== b.tier) return a.tier - b.tier;
    if (a.rsid !== b.rsid) return a.rsid.localeCompare(b.rsid);
    if (a.factId !== b.factId) return a.factId - b.factId;
    return a.revisionId - b.revisionId;
  });

  const limitations = [
    'Raw SNP uploads do not support haplotype/star-allele inference.',
    'Findings are limited to covered rsIDs and approved factset knowledge.',
    'Educational output only; not a diagnosis or treatment recommendation.',
  ];

  const basePayload = {
    uploadId: input.uploadId,
    factsetId: input.factsetId,
    findings,
    coverage: input.coverage,
    integrity: {
      score: input.integrityScore,
      notes: input.integrityNotes,
    },
    limitations,
  };

  const deterministicHash = crypto
    .createHash('sha256')
    .update(stableStringify(basePayload))
    .digest('hex');

  return {
    ...basePayload,
    deterministicHash,
  };
}
