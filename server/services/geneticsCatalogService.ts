import { and, eq, isNull } from 'drizzle-orm';
import { db } from '@db';
import { geneticsFactRevisions, geneticsFacts, geneticsFactsetMemberships, geneticsFactsets } from '@db/schema';

export interface CoverageReferenceData {
  panelRsids: Record<string, string[]>;
  factRsids: string[];
  tierByRsid: Record<string, number>;
}

export async function getCoverageReferenceData(): Promise<CoverageReferenceData> {
  const rows = await db
    .select({
      rsid: geneticsFacts.rsid,
      panel: geneticsFacts.panel,
      tier: geneticsFactRevisions.tier,
      status: geneticsFacts.status,
    })
    .from(geneticsFacts)
    .innerJoin(
      geneticsFactRevisions,
      and(eq(geneticsFactRevisions.factId, geneticsFacts.id), isNull(geneticsFactRevisions.effectiveTo))
    )
    .innerJoin(
      geneticsFactsetMemberships,
      eq(geneticsFactsetMemberships.factRevisionId, geneticsFactRevisions.id)
    )
    .innerJoin(
      geneticsFactsets,
      and(eq(geneticsFactsets.id, geneticsFactsetMemberships.factsetId), eq(geneticsFactsets.isActive, true))
    );

  const panelMap = new Map<string, Set<string>>();
  const factSet = new Set<string>();
  const tierByRsid: Record<string, number> = {};

  for (const row of rows) {
    if (row.status !== 'approved') {
      continue;
    }

    const panel = row.panel || 'UNSPECIFIED';
    if (!panelMap.has(panel)) {
      panelMap.set(panel, new Set<string>());
    }
    panelMap.get(panel)!.add(row.rsid);
    factSet.add(row.rsid);

    if (tierByRsid[row.rsid] === undefined || row.tier < tierByRsid[row.rsid]) {
      tierByRsid[row.rsid] = row.tier;
    }
  }

  const panelRsids: Record<string, string[]> = {};
  for (const [panel, rsids] of panelMap.entries()) {
    panelRsids[panel] = Array.from(rsids.values()).sort();
  }

  return {
    panelRsids,
    factRsids: Array.from(factSet.values()).sort(),
    tierByRsid,
  };
}
