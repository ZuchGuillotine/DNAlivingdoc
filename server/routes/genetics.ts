import express from 'express';
import fileUpload from 'express-fileupload';
import fs from 'fs';
import path from 'path';
import { eq, desc, inArray } from 'drizzle-orm';
import { db } from '@db';
import { geneticsCoverageMaps, geneticsGenotypeCalls, geneticsUploads } from '@db/schema';
import { getCoverageReferenceData } from '../services/geneticsCatalogService';
import { getApprovedFactsByRsid } from '../services/geneticsFactService';
import { computeCoverageAndIntegrity } from '../services/geneticsCoverageService';
import { parseRawSnpText } from '../services/geneticsParserService';
import { generateAndStoreDeterministicReport, getLatestReportByUploadId } from '../services/geneticsReportService';
import logger from '../utils/logger';

const router = express.Router();
const parserVersion = 'raw-snp-v1';

const uploadMiddleware = fileUpload({
  limits: { fileSize: 25 * 1024 * 1024 },
  useTempFiles: false,
  abortOnLimit: true,
});

function isGeneticsFeatureEnabled(): boolean {
  if (process.env.WEB_GENETICS_ENABLED === 'true') {
    return true;
  }
  if (process.env.WEB_GENETICS_ENABLED === 'false') {
    return false;
  }
  return process.env.LOCAL_DEV === 'true';
}

router.get('/facts', async (req, res) => {
  if (!isGeneticsFeatureEnabled()) {
    return res.status(404).json({ error: 'Not found' });
  }

  const rsid = typeof req.query.rsid === 'string' ? req.query.rsid.trim() : '';
  const genotype = typeof req.query.genotype === 'string' ? req.query.genotype.trim() : undefined;

  if (!rsid) {
    return res.status(400).json({ error: 'rsid is required' });
  }

  try {
    const facts = await getApprovedFactsByRsid({ rsid, genotype });
    return res.json({ facts });
  } catch (error) {
    logger.error('Failed to retrieve genetics facts:', {
      rsid,
      genotype,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    return res.status(500).json({ error: 'Failed to retrieve genetics facts' });
  }
});

router.get('/uploads', async (req, res) => {
  if (!isGeneticsFeatureEnabled()) {
    return res.status(404).json({ error: 'Not found' });
  }

  try {
    const uploads = await db
      .select()
      .from(geneticsUploads)
      .where(eq(geneticsUploads.userId, req.user!.id))
      .orderBy(desc(geneticsUploads.ingestedAt));

    const uploadIds = uploads.map((upload) => upload.id);
    const coverageRows = uploadIds.length
      ? await db
          .select()
          .from(geneticsCoverageMaps)
          .where(inArray(geneticsCoverageMaps.uploadId, uploadIds))
      : [];

    const coverageByUploadId = new Map<number, (typeof coverageRows)[number]>();
    for (const row of coverageRows) {
      coverageByUploadId.set(row.uploadId, row);
    }

    return res.json({
      uploads: uploads.map((upload) => ({
        ...upload,
        coverage: coverageByUploadId.get(upload.id) || null,
      })),
    });
  } catch (error) {
    logger.error('Failed to list genetics uploads:', {
      userId: req.user?.id,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    return res.status(500).json({ error: 'Failed to list uploads' });
  }
});

router.post('/uploads', uploadMiddleware, async (req, res) => {
  if (!isGeneticsFeatureEnabled()) {
    return res.status(404).json({ error: 'Not found' });
  }

  let rawText = typeof req.body?.rawText === 'string' ? req.body.rawText : '';
  let originalFileName = typeof req.body?.fileName === 'string' ? req.body.fileName : 'genetics-upload.txt';
  let fileType = typeof req.body?.fileType === 'string' ? req.body.fileType : 'text/plain';

  try {
    if (req.files && (req.files as Record<string, unknown>).file) {
      const uploaded = (req.files as Record<string, fileUpload.UploadedFile>).file;
      originalFileName = uploaded.name;
      fileType = uploaded.mimetype || 'text/plain';
      rawText = uploaded.data.toString('utf8');
    }

    if (!rawText.trim()) {
      return res.status(400).json({ error: 'Upload requires rawText or a file' });
    }

    const uploadDir = path.join(process.cwd(), 'uploads', 'genetics');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    const safeBaseName = originalFileName.replace(/[^a-zA-Z0-9._-]/g, '-');
    const storageFileName = `${Date.now()}-${safeBaseName}`;
    const filePath = path.join(uploadDir, storageFileName);
    fs.writeFileSync(filePath, rawText, 'utf8');
    const fileUrl = `/uploads/genetics/${storageFileName}`;

    const parsed = parseRawSnpText(rawText);
    if (parsed.calls.length === 0) {
      return res.status(400).json({ error: 'No valid SNP records found in upload' });
    }

    const referenceData = await getCoverageReferenceData();
    const coverage = computeCoverageAndIntegrity({
      calls: parsed.calls,
      panelRsids: referenceData.panelRsids,
      factRsids: referenceData.factRsids,
      tierByRsid: referenceData.tierByRsid,
      duplicateCount: parsed.stats.duplicateCount,
      conflictCount: parsed.stats.conflictCount,
      invalidRows: parsed.stats.invalidRows,
    });

    const result = await db.transaction(async (tx) => {
      const [upload] = await tx
        .insert(geneticsUploads)
        .values({
          userId: req.user!.id,
          fileName: originalFileName,
          fileType,
          fileUrl,
          providerGuess: typeof req.body?.providerGuess === 'string' ? req.body.providerGuess : null,
          genomeBuildGuess: typeof req.body?.genomeBuildGuess === 'string' ? req.body.genomeBuildGuess : null,
          parserVersion,
          metadata: {
            size: Buffer.byteLength(rawText, 'utf8'),
            rowCount: parsed.stats.rowCount,
            notes: ['raw-snp-upload'],
          },
        })
        .returning();

      await tx.insert(geneticsGenotypeCalls).values(
        parsed.calls.map((call) => ({
          uploadId: upload.id,
          rsid: call.rsid,
          genotype: call.genotype,
          chromosome: call.chromosome,
          position: call.position,
        }))
      );

      const [coverageMap] = await tx
        .insert(geneticsCoverageMaps)
        .values({
          uploadId: upload.id,
          panelCoverage: coverage.panelCoverage,
          integrityScore: coverage.integrityScore,
          integrityNotes: coverage.integrityNotes,
        })
        .returning();

      return { upload, coverageMap };
    });

    return res.status(201).json({
      upload: result.upload,
      coverage: result.coverageMap,
      parseStats: parsed.stats,
    });
  } catch (error) {
    logger.error('Failed to persist genetics upload:', {
      userId: req.user?.id,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    return res.status(500).json({ error: 'Failed to persist genetics upload' });
  }
});

router.post('/analyze-preview', async (req, res) => {
  if (!isGeneticsFeatureEnabled()) {
    return res.status(404).json({ error: 'Not found' });
  }

  const rawText = typeof req.body?.rawText === 'string' ? req.body.rawText : '';
  if (!rawText.trim()) {
    return res.status(400).json({ error: 'rawText is required' });
  }

  const panelRsids = typeof req.body?.panelRsids === 'object' && req.body.panelRsids !== null
    ? req.body.panelRsids as Record<string, string[]>
    : {};

  const factRsids = Array.isArray(req.body?.factRsids) ? req.body.factRsids as string[] : [];
  const tierByRsid = typeof req.body?.tierByRsid === 'object' && req.body.tierByRsid !== null
    ? req.body.tierByRsid as Record<string, number>
    : {};

  try {
    const parsed = parseRawSnpText(rawText);
    const coverage = computeCoverageAndIntegrity({
      calls: parsed.calls,
      panelRsids,
      factRsids,
      tierByRsid,
      duplicateCount: parsed.stats.duplicateCount,
      conflictCount: parsed.stats.conflictCount,
      invalidRows: parsed.stats.invalidRows,
    });

    return res.json({
      parsed,
      coverage,
    });
  } catch (error) {
    logger.error('Failed to preview genetics analysis:', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    return res.status(500).json({ error: 'Failed to analyze genetics file' });
  }
});

router.post('/reports/generate', async (req, res) => {
  if (!isGeneticsFeatureEnabled()) {
    return res.status(404).json({ error: 'Not found' });
  }

  const uploadId = Number.parseInt(String(req.body?.uploadId || ''), 10);
  if (!Number.isFinite(uploadId)) {
    return res.status(400).json({ error: 'uploadId is required' });
  }

  try {
    const generated = await generateAndStoreDeterministicReport({
      uploadId,
      userId: req.user!.id,
    });
    return res.json(generated);
  } catch (error) {
    logger.error('Failed to generate deterministic genetics report:', {
      uploadId,
      userId: req.user?.id,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });

    const message = error instanceof Error ? error.message : 'Failed to generate report';
    const status = message.includes('not found') ? 404 : 500;
    return res.status(status).json({ error: message });
  }
});

router.get('/uploads/:uploadId/report/latest', async (req, res) => {
  if (!isGeneticsFeatureEnabled()) {
    return res.status(404).json({ error: 'Not found' });
  }

  const uploadId = Number.parseInt(req.params.uploadId, 10);
  if (!Number.isFinite(uploadId)) {
    return res.status(400).json({ error: 'Invalid uploadId' });
  }

  try {
    const report = await getLatestReportByUploadId({
      uploadId,
      userId: req.user!.id,
    });
    if (!report) {
      return res.status(404).json({ error: 'Report not found' });
    }
    return res.json({ report });
  } catch (error) {
    logger.error('Failed to fetch latest report:', {
      uploadId,
      userId: req.user?.id,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    return res.status(500).json({ error: 'Failed to fetch report' });
  }
});

export default router;
