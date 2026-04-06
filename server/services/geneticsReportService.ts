import { and, desc, eq } from 'drizzle-orm';
import { db } from '@db';
import {
  geneticsCoverageMaps,
  geneticsFactsets,
  geneticsGenotypeCalls,
  geneticsReportVersions,
  geneticsUploads,
  geneticsUserFactInstances,
} from '@db/schema';
import { getApprovedFactsByRsid } from './geneticsFactService';
import type { FactGateFact } from './geneticsFactGate';
import {
  buildDeterministicReportPayload,
  type ReportFinding,
} from './geneticsReportBuilder';

function toFinding(fact: FactGateFact, genotype: string): ReportFinding {
  return {
    factId: fact.factId,
    factKey: fact.factKey,
    revisionId: fact.revisionId,
    panel: fact.panel,
    tier: fact.tier,
    sourceAuthority: fact.sourceAuthority,
    rsid: fact.rsid,
    genotype,
    claimTitle: fact.claimTitle,
    claimSummary: fact.claimSummary,
    claimDetails: fact.claimDetails,
    reviewStatusRule: fact.reviewStatusRule,
    clinvarStarsObserved: fact.clinvarStarsObserved,
    confidenceModifier: fact.confidenceModifier,
    citations: fact.citations,
  };
}

export async function generateAndStoreDeterministicReport(input: {
  uploadId: number;
  userId: number;
}) {
  const upload = await db.query.geneticsUploads.findFirst({
    where: eq(geneticsUploads.id, input.uploadId),
  });

  if (!upload || upload.userId !== input.userId) {
    throw new Error('Upload not found');
  }

  const activeFactset = await db.query.geneticsFactsets.findFirst({
    where: eq(geneticsFactsets.isActive, true),
  });
  if (!activeFactset) {
    throw new Error('No active factset found');
  }

  const calls = await db
    .select({
      rsid: geneticsGenotypeCalls.rsid,
      genotype: geneticsGenotypeCalls.genotype,
    })
    .from(geneticsGenotypeCalls)
    .where(eq(geneticsGenotypeCalls.uploadId, input.uploadId));

  const coverage = await db.query.geneticsCoverageMaps.findFirst({
    where: eq(geneticsCoverageMaps.uploadId, input.uploadId),
  });

  const findingsByRevision = new Map<number, ReportFinding>();
  for (const call of calls) {
    const facts = await getApprovedFactsByRsid({
      rsid: call.rsid,
      genotype: call.genotype,
    });
    for (const fact of facts) {
      if (!findingsByRevision.has(fact.revisionId)) {
        findingsByRevision.set(fact.revisionId, toFinding(fact, call.genotype));
      }
    }
  }

  const reportPayload = buildDeterministicReportPayload({
    uploadId: input.uploadId,
    factsetId: activeFactset.id,
    findings: Array.from(findingsByRevision.values()),
    coverage: coverage?.panelCoverage || {},
    integrityScore: coverage?.integrityScore ?? null,
    integrityNotes: coverage?.integrityNotes || [],
  });

  return db.transaction(async (tx) => {
    await tx
      .update(geneticsReportVersions)
      .set({ status: 'historical' })
      .where(
        and(
          eq(geneticsReportVersions.uploadId, input.uploadId),
          eq(geneticsReportVersions.status, 'active')
        )
      );

    const [insertedReport] = await tx
      .insert(geneticsReportVersions)
      .values({
        uploadId: input.uploadId,
        factsetId: activeFactset.id,
        reportPayloadJson: reportPayload,
        uiRenderJson: {
          sections: ['summary', 'findings', 'coverage', 'integrity', 'sources'],
          findingCount: reportPayload.findings.length,
          deterministicHash: reportPayload.deterministicHash,
        },
        status: 'active',
      })
      .returning();

    if (reportPayload.findings.length > 0) {
      await tx.insert(geneticsUserFactInstances).values(
        reportPayload.findings.map((finding) => ({
          userId: input.userId,
          uploadId: input.uploadId,
          factId: finding.factId,
          factRevisionId: finding.revisionId,
          rsid: finding.rsid,
          genotype: finding.genotype,
          tier: finding.tier,
          reportVersionId: insertedReport.id,
        }))
      );
    }

    return {
      report: insertedReport,
      payload: reportPayload,
    };
  });
}

export async function getLatestReportByUploadId(input: {
  uploadId: number;
  userId: number;
}) {
  const upload = await db.query.geneticsUploads.findFirst({
    where: eq(geneticsUploads.id, input.uploadId),
  });
  if (!upload || upload.userId !== input.userId) {
    return null;
  }

  const [report] = await db
    .select()
    .from(geneticsReportVersions)
    .where(eq(geneticsReportVersions.uploadId, input.uploadId))
    .orderBy(desc(geneticsReportVersions.generatedAt))
    .limit(1);

  return report || null;
}
