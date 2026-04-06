import type { ParsedGenotypeCall } from './geneticsParserService';

export interface CoverageInput {
  calls: ParsedGenotypeCall[];
  panelRsids: Record<string, string[]>;
  factRsids: string[];
  tierByRsid?: Record<string, number>;
  duplicateCount?: number;
  conflictCount?: number;
  invalidRows?: number;
}

export interface CoverageResult {
  panelCoverage: {
    byPanel: Record<string, number>;
    byTier: Record<string, number>;
    coveredRsids: string[];
    missingRsids: string[];
    callRate: number;
    missingness: number;
    duplicates: number;
    conflicts: number;
    invalidRows: number;
  };
  integrityScore: number;
  integrityNotes: string[];
}

function asPercent(numerator: number, denominator: number): number {
  if (denominator === 0) {
    return 0;
  }
  return Number(((numerator / denominator) * 100).toFixed(2));
}

export function computeCoverageAndIntegrity(input: CoverageInput): CoverageResult {
  const callByRsid = new Map<string, ParsedGenotypeCall>();
  for (const call of input.calls) {
    callByRsid.set(call.rsid, call);
  }

  const coveredRsids: string[] = [];
  const missingRsids: string[] = [];

  const byPanel: Record<string, number> = {};
  for (const [panelName, panelSet] of Object.entries(input.panelRsids)) {
    const coveredInPanel = panelSet.filter((rsid) => callByRsid.has(rsid)).length;
    byPanel[panelName] = asPercent(coveredInPanel, panelSet.length);
  }

  const byTierCount: Record<string, { covered: number; total: number }> = {};
  const tierByRsid = input.tierByRsid || {};
  for (const rsid of input.factRsids) {
    const tier = tierByRsid[rsid] ?? 0;
    const tierKey = String(tier);
    if (!byTierCount[tierKey]) {
      byTierCount[tierKey] = { covered: 0, total: 0 };
    }
    byTierCount[tierKey].total += 1;

    if (callByRsid.has(rsid)) {
      byTierCount[tierKey].covered += 1;
      coveredRsids.push(rsid);
    } else {
      missingRsids.push(rsid);
    }
  }

  const byTier: Record<string, number> = {};
  for (const [tier, counts] of Object.entries(byTierCount)) {
    byTier[tier] = asPercent(counts.covered, counts.total);
  }

  const totalCalls = input.calls.length;
  const nonMissingCalls = input.calls.filter((call) => call.genotype !== 'MISSING').length;
  const missingness = totalCalls > 0 ? Number(((totalCalls - nonMissingCalls) / totalCalls).toFixed(4)) : 1;
  const callRate = totalCalls > 0 ? Number((nonMissingCalls / totalCalls).toFixed(4)) : 0;

  const duplicates = input.duplicateCount ?? 0;
  const conflicts = input.conflictCount ?? 0;
  const invalidRows = input.invalidRows ?? 0;

  let integrityScore = 100;
  integrityScore -= Math.round(missingness * 40);
  integrityScore -= Math.min(duplicates, 20);
  integrityScore -= Math.min(conflicts * 2, 20);
  integrityScore -= Math.min(invalidRows, 20);
  integrityScore = Math.max(0, Math.min(100, integrityScore));

  const integrityNotes: string[] = [];
  if (missingness > 0.15) {
    integrityNotes.push('High missing genotype rate may reduce report confidence.');
  }
  if (duplicates > 0) {
    integrityNotes.push(`Duplicate rsID records detected: ${duplicates}.`);
  }
  if (conflicts > 0) {
    integrityNotes.push(`Conflicting duplicate genotype calls detected: ${conflicts}.`);
  }
  if (invalidRows > 0) {
    integrityNotes.push(`Invalid input rows ignored during parsing: ${invalidRows}.`);
  }
  if (!integrityNotes.length) {
    integrityNotes.push('No critical integrity issues detected.');
  }

  return {
    panelCoverage: {
      byPanel,
      byTier,
      coveredRsids: Array.from(new Set(coveredRsids)),
      missingRsids: Array.from(new Set(missingRsids)),
      callRate,
      missingness,
      duplicates,
      conflicts,
      invalidRows,
    },
    integrityScore,
    integrityNotes,
  };
}
