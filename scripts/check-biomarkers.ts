/**
    * @description      : 
    * @author           : 
    * @group            : 
    * @created          : 22/06/2025 - 23:59:47
    * 
    * MODIFICATION LOG
    * - Version         : 1.0.0
    * - Date            : 22/06/2025
    * - Author          : 
    * - Modification    : 
**/
import { db } from '../db';
import { labResults, biomarkerResults, biomarkerProcessingStatus } from '../db/schema';
import { eq, isNull, or, and, sql } from 'drizzle-orm';
import { biomarkerExtractionService } from '../server/services/biomarkerExtractionService';
import logger from '../server/utils/logger';

async function checkAndReprocessBiomarkers() {
  try {
    // First check processing status and storage details
    const labId = 97; // Latest lab ID from your example
    
    // Get processing status
    const [status] = await db
      .select()
      .from(biomarkerProcessingStatus)
      .where(eq(biomarkerProcessingStatus.labResultId, labId));

    console.log('\nProcessing Status:');
    console.log('------------------');
    console.log('Status:', status?.status);
    console.log('Started At:', status?.startedAt?.toLocaleString());
    console.log('Completed At:', status?.completedAt?.toLocaleString());
    console.log('Biomarker Count:', status?.biomarkerCount);

    // Get storage comparison
    const biomarkerCount = await db
      .select({ count: sql`count(*)` })
      .from(biomarkerResults)
      .where(eq(biomarkerResults.labResultId, labId))
      .then(res => Number(res[0]?.count || 0));

    const [labResult] = await db
      .select()
      .from(labResults)
      .where(eq(labResults.id, labId));

    const metadataBiomarkers = labResult?.metadata?.biomarkers?.parsedBiomarkers?.length || 0;

    console.log('\nStorage Comparison:');
    console.log('-------------------');
    console.log('Biomarkers in dedicated table:', biomarkerCount);
    console.log('Biomarkers in metadata:', metadataBiomarkers);

    // Sample data
    const biomarkerSamples = await db
      .select()
      .from(biomarkerResults)
      .where(eq(biomarkerResults.labResultId, labId))
      .limit(3);

    console.log('\nSample from biomarker_results table:');
    console.log('----------------------------------');
    console.log(biomarkerSamples);

    console.log('\nSample from metadata:');
    console.log('--------------------');
    console.log(labResult?.metadata?.biomarkers?.parsedBiomarkers?.slice(0, 3));

    console.log('\nStorage Details:');
    console.log('----------------');
    console.log('Lab ID:', labId);
    console.log('Upload Date:', labResult?.uploadedAt?.toLocaleString());
    console.log('Has Preprocessed Text:', !!labResult?.metadata?.preprocessedText);
    console.log('Processing Metadata:', status?.metadata);

    // Now check for labs needing reprocessing
    logger.info('Starting biomarker data check and reprocessing');

    const labsWithoutBiomarkers = await db
      .select({
        id: labResults.id,
        uploadedAt: labResults.uploadedAt,
        fileName: labResults.fileName,
        biomarkerCount: sql`count(${biomarkerResults.id})`
      })
      .from(labResults)
      .leftJoin(biomarkerResults, eq(biomarkerResults.labResultId, labResults.id))
      .leftJoin(biomarkerProcessingStatus, eq(biomarkerProcessingStatus.labResultId, labResults.id))
      .where(
        or(
          isNull(biomarkerProcessingStatus.labResultId),
          eq(biomarkerProcessingStatus.status, 'error'),
          eq(biomarkerProcessingStatus.status, 'processing')
        )
      )
      .groupBy(labResults.id)
      .having(sql`count(${biomarkerResults.id}) = 0`);

    if (labsWithoutBiomarkers.length === 0) {
      logger.info('No labs found requiring biomarker reprocessing');
      return;
    }

    logger.info(`Found ${labsWithoutBiomarkers.length} labs requiring biomarker processing`);

    // Process each lab
    for (const lab of labsWithoutBiomarkers) {
      try {
        logger.info(`Processing lab ${lab.id} (${lab.fileName})`);
        await biomarkerExtractionService.processLabResult(lab.id);
        logger.info(`Successfully processed lab ${lab.id}`);
      } catch (error) {
        logger.error(`Failed to process lab ${lab.id}:`, {
          error: error instanceof Error ? error.message : String(error),
          labId: lab.id,
          fileName: lab.fileName
        });
      }
    }

  } catch (error) {
    logger.error('Error in biomarker reprocessing script:', {
      error: error instanceof Error ? error.message : String(error)
    });
    throw error;
  }
}

export { checkAndReprocessBiomarkers };
