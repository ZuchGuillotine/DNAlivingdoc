
import { db } from '../db';
import { labResults } from '../db/schema';
import { eq } from 'drizzle-orm';

async function checkLabOCR() {
  try {
    const results = await db
      .select()
      .from(labResults)
      .where(eq(labResults.fileType, 'image/jpeg'));
    
    console.log('Found image lab results:', results.length);
    
    for (const result of results) {
      console.log('\nLab Result:', {
        id: result.id,
        fileName: result.fileName,
        uploadedAt: result.uploadedAt,
        metadata: {
          ocrText: result.metadata?.ocrText ? `${result.metadata.ocrText.substring(0, 100)}...` : 'No OCR text',
          ocrDate: result.metadata?.ocrDate,
          textLength: result.metadata?.ocrText?.length || 0
        }
      });
    }
  } catch (error) {
    console.error('Error checking lab OCR:', error);
  }
}

checkLabOCR();
