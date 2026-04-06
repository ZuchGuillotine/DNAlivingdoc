import { db } from '../db';
import { labResults } from '../db/schema';
import { desc } from 'drizzle-orm';

async function verifyLabStorage() {
  try {
    // Get the most recent lab results
    const results = await db
      .select()
      .from(labResults)
      .orderBy(desc(labResults.uploadedAt))
      .limit(5);

    console.log('\n=== Recent Lab Results Storage Verification ===\n');

    for (const result of results) {
      console.log(`Lab ID: ${result.id}`);
      console.log(`File: ${result.fileName}`);
      console.log(`Upload Date: ${new Date(result.uploadedAt).toLocaleString()}`);

      // Check for summary
      console.log('Summary Status:', result.metadata?.summary ? '✅ Present' : '❌ Missing');
      if (result.metadata?.summary) {
        console.log('Summary Length:', result.metadata.summary.length, 'characters');
        console.log('Summarized At:', result.metadata?.summarizedAt);
      }

      // Ensure we're checking the correct metadata path
      const biomarkerData = result.metadata?.biomarkers;
      const biomarkers = biomarkerData?.parsedBiomarkers || [];
      const biomarkerCount = biomarkers.length;

      console.log('Biomarkers Status:', biomarkerCount > 0 ? '✅ Present' : '❌ Missing');
      console.log('Biomarkers Found:', biomarkerCount);
      console.log('Extraction Date:', biomarkerData?.extractedAt || 'Not available');

      // Additional debugging info
      console.log('\nMetadata Structure:', {
        hasBiomarkersObject: !!result.metadata?.biomarkers,
        hasParsedBiomarkers: !!biomarkerData?.parsedBiomarkers,
        metadataKeys: Object.keys(result.metadata || {}),
        biomarkerDataKeys: Object.keys(biomarkerData || {})
      });

      if (biomarkers.length > 0) {
        console.log('\nBiomarker Examples:');
        biomarkers.slice(0, 3).forEach(b => {
          console.log(`- ${b.name}: ${b.value} ${b.unit}`);
        });
      }

      // Check for any parsing errors
      const parsingErrors = result.metadata?.parsingErrors || [];
      if (parsingErrors.length > 0) {
        console.log('\nParsing Errors:', parsingErrors);
      }

      console.log('\n' + '='.repeat(50) + '\n');
    }

  } catch (error) {
    console.error('Error verifying lab storage:', error);
  } finally {
    process.exit();
  }
}

verifyLabStorage();