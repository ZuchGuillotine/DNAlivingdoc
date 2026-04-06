import { Request, Response } from 'express';
import { db } from '../../db';
import { labResults, biomarkerResults } from '../../db/schema';
import { eq, sql } from 'drizzle-orm';
import logger from '../utils/logger';

export const debugLabResults = async (req: Request, res: Response) => {
  if (!req.user?.isAdmin) {
    return res.status(403).json({ error: 'Unauthorized' });
  }

  const { labId } = req.params;
  
  try {
    if (labId) {
      // Get specific lab result with both biomarker sources
      const [labResult] = await db
        .select({
          id: labResults.id,
          fileName: labResults.fileName,
          uploadedAt: labResults.uploadedAt,
          metadata: labResults.metadata,
          biomarkers: biomarkerResults
        })
        .from(labResults)
        .leftJoin(biomarkerResults, eq(biomarkerResults.labResultId, labResults.id))
        .where(eq(labResults.id, parseInt(labId)))
        .limit(1);
      
      if (!labResult) {
        return res.status(404).json({ error: 'Lab result not found' });
      }
      
      // Get all biomarkers from the table for this lab
      const tableBiomarkers = await db
        .select()
        .from(biomarkerResults)
        .where(eq(biomarkerResults.labResultId, parseInt(labId)))
        .orderBy(biomarkerResults.name);

      // Extract biomarker info from metadata for comparison
      const metadataBiomarkers = labResult.metadata?.biomarkers?.parsedBiomarkers || [];
      
      return res.status(200).json({
        labResult: {
          id: labResult.id,
          fileName: labResult.fileName,
          uploadedAt: labResult.uploadedAt,
          biomarkerComparison: {
            tableCount: tableBiomarkers.length,
            metadataCount: metadataBiomarkers.length,
            tableBiomarkers: tableBiomarkers.map(b => ({
              name: b.name,
              value: b.value,
              unit: b.unit,
              category: b.category,
              testDate: b.testDate,
              status: b.status
            })),
            metadataBiomarkers: metadataBiomarkers.map(b => ({
              name: b.name,
              value: b.value,
              unit: b.unit,
              category: b.category,
              testDate: b.testDate
            })),
            extractedAt: labResult.metadata?.biomarkers?.extractedAt,
            hasOcr: !!labResult.metadata?.ocr,
            hasParsedText: !!labResult.metadata?.parsedText
          }
        }
      });
    } else {
      // Get summary of all lab results with biomarker counts from both sources
      const results = await db
        .select({
          id: labResults.id,
          fileName: labResults.fileName,
          uploadedAt: labResults.uploadedAt,
          userId: labResults.userId,
          metadata: labResults.metadata,
          biomarkerCount: sql<number>`count(${biomarkerResults.id})`
        })
        .from(labResults)
        .leftJoin(biomarkerResults, eq(biomarkerResults.labResultId, labResults.id))
        .groupBy(labResults.id);
      
      const summary = results.map(result => {
        const metadataBiomarkers = result.metadata?.biomarkers?.parsedBiomarkers || [];
        return {
          id: result.id,
          fileName: result.fileName,
          uploadedAt: result.uploadedAt,
          userId: result.userId,
          biomarkerCounts: {
            table: Number(result.biomarkerCount) || 0,
            metadata: metadataBiomarkers.length
          },
          biomarkerNames: metadataBiomarkers.map(b => b.name),
          extractedAt: result.metadata?.biomarkers?.extractedAt,
          hasDiscrepancy: Number(result.biomarkerCount) !== metadataBiomarkers.length
        };
      });
      
      return res.status(200).json({ 
        summary,
        totalLabResults: results.length,
        labsWithBiomarkers: summary.filter(s => s.biomarkerCounts.table > 0 || s.biomarkerCounts.metadata > 0).length,
        labsWithDiscrepancies: summary.filter(s => s.hasDiscrepancy).length
      });
    }
  } catch (error) {
    logger.error('Error in debug endpoint:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};
