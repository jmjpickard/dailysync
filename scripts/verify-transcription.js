/**
 * Verify Transcription Setup
 * 
 * A simpler verification script that checks if the necessary files are in place
 * This is a lightweight alternative to the previous setup system
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Configuration
const ASSETS_DIR = path.join(__dirname, '..', 'assets');
const MAIN_EXECUTABLE = path.join(ASSETS_DIR, 'main');
const MODEL_DIR = path.join(ASSETS_DIR, 'models', 'whisper');
const MODEL_FILE = path.join(MODEL_DIR, 'ggml-base.en.bin');

console.log('Verifying transcription setup...');
console.log('Checking for main executable...');

// Check if main executable exists
if (!fs.existsSync(MAIN_EXECUTABLE)) {
  console.error('❌ Main executable not found at:', MAIN_EXECUTABLE);
  process.exit(1);
}

// Make sure it's executable
try {
  fs.accessSync(MAIN_EXECUTABLE, fs.constants.X_OK);
  console.log('✅ Main executable is accessible and executable');
} catch (err) {
  console.error('❌ Main executable exists but is not executable');
  console.log('Attempting to make it executable...');
  try {
    fs.chmodSync(MAIN_EXECUTABLE, 0o755);
    console.log('✅ Made main executable executable');
  } catch (chmodErr) {
    console.error('❌ Failed to make main executable executable:', chmodErr.message);
    process.exit(1);
  }
}

// Check if the model directory exists
console.log('Checking for model directory...');
if (!fs.existsSync(MODEL_DIR)) {
  console.error('❌ Model directory not found at:', MODEL_DIR);
  console.log('Creating model directory...');
  try {
    fs.mkdirSync(MODEL_DIR, { recursive: true });
    console.log('✅ Created model directory');
  } catch (mkdirErr) {
    console.error('❌ Failed to create model directory:', mkdirErr.message);
    process.exit(1);
  }
}

// Check if the model file exists
console.log('Checking for model file...');
if (!fs.existsSync(MODEL_FILE)) {
  console.error('❌ Model file not found at:', MODEL_FILE);
  console.log('You need to download the model file manually and place it at:', MODEL_FILE);
  console.log('You can download the model from: https://huggingface.co/ggml-org/whisper-base.en/resolve/main/ggml-base.en.bin');
  process.exit(1);
}

// Try to run the main executable with --help to verify it works
console.log('Testing main executable...');
try {
  const result = execSync(`${MAIN_EXECUTABLE} --help`, { timeout: 5000 });
  console.log('✅ Main executable ran successfully');
} catch (execErr) {
  console.error('❌ Failed to run main executable:', execErr.message);
  process.exit(1);
}

console.log('\n✅ Transcription setup verified successfully!');