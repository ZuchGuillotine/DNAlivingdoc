import { and, asc, eq, isNull } from 'drizzle-orm';
import { db } from '@db';
import {
  geneticsCitations,
  geneticsFactRevisionCitations,
  geneticsFactRevisions,
  geneticsFacts,
  geneticsFactsetMemberships,
  geneticsFactsets,
} from '@db/schema';
import { applyFactGate, type FactGateFact } from './geneticsFactGate';

export function genotypeMatchesPattern(pattern: string, genotype: string): boolean {
  const normalizedPattern = pattern.trim().toUpperCase();
  const normalizedGenotype = genotype.trim().toUpperCase();

  if (!normalizedPattern || !normalizedGenotype) {
    return false;
  }

  if (normalizedPattern === '*' || normalizedPattern === 'ANY' || normalizedPattern === 'ALL') {
    return true;
  }

  if (normalizedPattern.includes('/') || normalizedPattern.includes('|') || normalizedPattern.includes(',')) {
    const tokens = normalizedPattern
      .split(/[\/|,]/g)
      .map((token) => token.trim())
      .filter(Boolean);
    return tokens.includes(normalizedGenotype);
  }

  if (normalizedPattern.length === 1) {
    return `${normalizedPattern}${normalizedPattern}` === normalizedGenotype;
  }

  return normalizedPattern === normalizedGenotype;
}

export async function getApprovedFactsByRsid(input: {
  rsid: string;
  genotype?: string;
}): Promise<FactGateFact[]> {
  const conditions = [eq(geneticsFacts.rsid, input.rsid)];

  const rows = await db
    .select({
      factId: geneticsFacts.id,
      factKey: geneticsFacts.factKey,
      panel: geneticsFacts.panel,
      sourceAuthority: geneticsFacts.sourceAuthority,
      rsid: geneticsFacts.rsid,
      genotypePattern: geneticsFacts.genotypePattern,
      status: geneticsFacts.status,
      revisionId: geneticsFactRevisions.id,
      tier: geneticsFactRevisions.tier,
      claimTitle: geneticsFactRevisions.claimTitle,
      claimSummary: geneticsFactRevisions.claimSummary,
      claimDetails: geneticsFactRevisions.claimDetails,
      reviewStatusRule: geneticsFactRevisions.reviewStatusRule,
      clinvarStarsObserved: geneticsFactRevisions.clinvarStarsObserved,
      confidenceModifier: geneticsFactRevisions.confidenceModifier,
      citationId: geneticsCitations.id,
      citationType: geneticsCitations.citationType,
      citationTitle: geneticsCitations.title,
      citationUrl: geneticsCitations.url,
      citationPersistentId: geneticsCitations.persistentId,
    })
    .from(geneticsFacts)
    .innerJoin(
      geneticsFactRevisions,
      and(
        eq(geneticsFactRevisions.factId, geneticsFacts.id),
        isNull(geneticsFactRevisions.effectiveTo)
      )
    )
    .innerJoin(
      geneticsFactsetMemberships,
      eq(geneticsFactsetMemberships.factRevisionId, geneticsFactRevisions.id)
    )
    .innerJoin(
      geneticsFactsets,
      and(
        eq(geneticsFactsets.id, geneticsFactsetMemberships.factsetId),
        eq(geneticsFactsets.isActive, true)
      )
    )
    .leftJoin(
      geneticsFactRevisionCitations,
      eq(geneticsFactRevisionCitations.factRevisionId, geneticsFactRevisions.id)
    )
    .leftJoin(
      geneticsCitations,
      eq(geneticsCitations.id, geneticsFactRevisionCitations.citationId)
    )
    .where(and(...conditions))
    .orderBy(asc(geneticsFactRevisions.tier), asc(geneticsFacts.id));

  const facts = applyFactGate(rows);
  if (!input.genotype) {
    return facts;
  }
  return facts.filter((fact) => genotypeMatchesPattern(fact.genotypePattern, input.genotype!));
}
