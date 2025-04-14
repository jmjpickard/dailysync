/**
 * Clean Large Model Files
 * 
 * This script removes any large model files that might cause build size issues.
 * It keeps only the smaller base.en model which is sufficient for most use cases.
 */

const fs = require('fs');
const path = require('path');

// Configuration
const MODELS_DIR = path.join(__dirname, '..', 'assets', 'models', 'whisper');
const MODELS_TO_KEEP = ['ggml-base.en.bin'];

// Main function
function cleanModels() {
  console.log('Cleaning model directory to reduce build size...');
  
  try {
    // Make sure the directory exists
    if (!fs.existsSync(MODELS_DIR)) {
      console.log('Models directory does not exist. Nothing to clean.');
      return;
    }
    
    // Read the directory
    const files = fs.readdirSync(MODELS_DIR);
    let removedCount = 0;
    let totalSize = 0;
    
    // Process each file
    for (const file of files) {
      // Skip if this is a model we want to keep
      if (MODELS_TO_KEEP.includes(file)) {
        console.log(`Keeping model: ${file}`);
        continue;
      }
      
      // Only remove .bin files to avoid deleting other important files
      if (file.endsWith('.bin')) {
        const filePath = path.join(MODELS_DIR, file);
        try {
          // Get file size
          const stats = fs.statSync(filePath);
          const sizeMB = Math.round(stats.size / (1024 * 1024));
          totalSize += sizeMB;
          
          // Remove the file
          fs.unlinkSync(filePath);
          console.log(`Removed model: ${file} (${sizeMB} MB)`);
          removedCount++;
        } catch (error) {
          console.error(`Error removing file ${file}: ${error.message}`);
        }
      }
    }
    
    console.log(`\nCleaning complete:`);
    console.log(`- Removed ${removedCount} model file(s)`);
    console.log(`- Freed approximately ${totalSize} MB of space`);
    console.log(`- Kept essential models: ${MODELS_TO_KEEP.join(', ')}`);
  } catch (error) {
    console.error(`Error cleaning models: ${error.message}`);
    process.exit(1);
  }
}

// Run the script
cleanModels();