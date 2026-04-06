
import { db } from '../db';
import { labResults } from '../db/schema';
import { eq } from 'drizzle-orm';
import fs from 'fs';
import path from 'path';
import { createWorker } from 'tesseract.js';

async function debugOCR(labId: number) {
  try {
    const [labResult] = await db
      .select()
      .from(labResults)
      .where(eq(labResults.id, labId))
      .limit(1);

    if (!labResult) {
      console.error(`Lab result ${labId} not found`);
      return;
    }

    const fileName = labResult.fileUrl.replace(/^\/uploads\//, '');
    const filePath = path.join(process.cwd(), 'uploads', fileName);

    if (!fs.existsSync(filePath)) {
      console.error(`File not found: ${filePath}`);
      return;
    }

    const fileBuffer = fs.readFileSync(filePath);
    
    console.log('Starting OCR process...');
    const worker = await createWorker('eng');
    const { data: { text } } = await worker.recognize(fileBuffer);
    await worker.terminate();

    console.log('\n=== OCR Results ===');
    console.log('Text length:', text.length);
    console.log('\nFirst 1000 characters:');
    console.log(text.substring(0, 1000));
    console.log('\nLast 1000 characters:');
    console.log(text.substring(Math.max(0, text.length - 1000)));
    
    // Write full results to debug file
    const debugPath = path.join(process.cwd(), 'debug_logs', `ocr_debug_${labId}_${Date.now()}.txt`);
    fs.writeFileSync(debugPath, text);
    console.log(`\nFull OCR results written to: ${debugPath}`);

  } catch (error) {
    console.error('Debug OCR error:', error);
  }
}

// Allow running from command line
const labId = process.argv[2] ? parseInt(process.argv[2]) : null;
if (labId) {
  debugOCR(labId).then(() => process.exit(0));
} else {
  console.log('Please provide a lab ID as argument');
}
