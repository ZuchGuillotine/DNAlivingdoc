
// Token counting script
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Skip these directories and files
const skipDirs = [
  'node_modules', 
  '.git',
  'dist',
  'build',
  '.vscode'
];

// File extensions to count
const validExtensions = [
  '.js', '.ts', '.jsx', '.tsx',
  '.css', '.scss', '.less',
  '.html', '.md', '.json',
  '.py', '.rb', '.php', '.java',
  '.c', '.cpp', '.h', '.cs',
  '.go', '.rs', '.swift'
];

async function countTokens(dir) {
  let totalTokens = 0;
  let totalFiles = 0;
  let extensionCounts = {};

  async function processDir(currentDir) {
    try {
      const files = await fs.promises.readdir(currentDir);
      
      for (const file of files) {
        const filePath = path.join(currentDir, file);
        const stats = await fs.promises.stat(filePath);
        
        // Skip directories in the skipDirs list
        if (stats.isDirectory()) {
          if (!skipDirs.includes(file)) {
            await processDir(filePath);
          }
          continue;
        }
        
        // Get file extension
        const ext = path.extname(file).toLowerCase();
        
        // Skip files that don't have valid extensions
        if (!validExtensions.includes(ext)) continue;
        
        // Read file content and count tokens (simplified as words)
        try {
          const content = await fs.promises.readFile(filePath, 'utf8');
          // Split by whitespace and count
          const tokens = content.split(/\s+/).filter(Boolean).length;
          
          totalTokens += tokens;
          totalFiles += 1;
          
          // Track counts by extension
          extensionCounts[ext] = (extensionCounts[ext] || 0) + tokens;
          
          console.log(`Processed ${filePath}: ${tokens} tokens`);
        } catch (err) {
          console.error(`Error reading file ${filePath}: ${err.message}`);
        }
      }
    } catch (err) {
      console.error(`Error reading directory ${currentDir}: ${err.message}`);
    }
  }

  await processDir(dir);
  
  return {
    totalTokens,
    totalFiles,
    extensionCounts
  };
}

async function main() {
  console.log('Starting token count...');
  const result = await countTokens('.');
  
  console.log('\n=== Token Count Results ===');
  console.log(`Total Files: ${result.totalFiles}`);
  console.log(`Total Tokens: ${result.totalTokens}`);
  
  console.log('\nTokens by File Extension:');
  Object.entries(result.extensionCounts)
    .sort((a, b) => b[1] - a[1])
    .forEach(([ext, count]) => {
      console.log(`${ext}: ${count} tokens (${((count / result.totalTokens) * 100).toFixed(2)}%)`);
    });
}

main().catch(console.error);
