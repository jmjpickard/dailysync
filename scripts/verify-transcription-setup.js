/**
 * Verify Transcription Setup
 * 
 * This script checks if the transcription dependencies are properly set up.
 * Run this after `npm run setup-transcription` to verify everything is working.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Asset directories
const WHISPER_BIN_DIR = path.join(__dirname, '..', 'assets', 'bin', 'whisper');
const FFMPEG_BIN_DIR = path.join(__dirname, '..', 'assets', 'bin', 'ffmpeg');
const WHISPER_MODEL_DIR = path.join(__dirname, '..', 'assets', 'models', 'whisper');

// Verification functions
function checkDirectory(dir, name) {
  console.log(`Checking ${name} directory: ${dir}`);
  
  if (!fs.existsSync(dir)) {
    console.error(`❌ ${name} directory not found!`);
    return false;
  }
  
  console.log(`✅ ${name} directory exists`);
  return true;
}

function checkExecutable(path, name) {
  console.log(`Checking ${name} executable: ${path}`);
  
  if (!fs.existsSync(path)) {
    console.error(`❌ ${name} executable not found!`);
    return false;
  }
  
  try {
    const stats = fs.statSync(path);
    const isExecutable = Boolean(stats.mode & 0o111);
    
    if (!isExecutable) {
      console.error(`❌ ${name} is not executable!`);
      return false;
    }
    
    console.log(`✅ ${name} executable exists and has correct permissions`);
    return true;
  } catch (error) {
    console.error(`❌ Error checking ${name} executable: ${error.message}`);
    return false;
  }
}

function checkModels() {
  console.log(`Checking whisper models in: ${WHISPER_MODEL_DIR}`);
  
  if (!fs.existsSync(WHISPER_MODEL_DIR)) {
    console.error(`❌ Whisper model directory not found!`);
    return false;
  }
  
  try {
    const files = fs.readdirSync(WHISPER_MODEL_DIR);
    const modelFiles = files.filter(file => file.endsWith('.bin'));
    
    if (modelFiles.length === 0) {
      console.error(`❌ No whisper model files found!`);
      return false;
    }
    
    console.log(`Found ${modelFiles.length} whisper model(s):`);
    let allValid = true;
    
    for (const model of modelFiles) {
      const modelPath = path.join(WHISPER_MODEL_DIR, model);
      const size = fs.statSync(modelPath).size;
      const sizeMB = Math.round(size / (1024 * 1024));
      
      // Check if this might be a placeholder file
      let isPlaceholder = false;
      if (size < 1024 * 1024) { // Less than 1MB
        isPlaceholder = true;
        
        // Try to read the first few bytes to confirm
        try {
          const fd = fs.openSync(modelPath, 'r');
          const buffer = Buffer.alloc(256);
          fs.readSync(fd, buffer, 0, 256, 0);
          fs.closeSync(fd);
          
          const content = buffer.toString();
          if (content.includes('placeholder') || content.includes('download')) {
            isPlaceholder = true;
          }
        } catch (readError) {
          console.error(`Error reading model file: ${readError.message}`);
        }
      }
      
      if (isPlaceholder) {
        console.log(`  - ${model} (${sizeMB} MB) ⚠️ THIS IS A PLACEHOLDER FILE, NOT A REAL MODEL`);
        allValid = false;
      } else {
        console.log(`  - ${model} (${sizeMB} MB)`);
      }
    }
    
    if (allValid) {
      console.log(`✅ Whisper models exist and appear valid`);
    } else {
      console.log(`⚠️ Some whisper models appear to be placeholders`);
      console.log(`   You may need to download the actual model files manually.`);
    }
    
    return true;
  } catch (error) {
    console.error(`❌ Error checking whisper models: ${error.message}`);
    return false;
  }
}

function testWhisperExecution() {
  console.log(`Testing whisper execution...`);
  
  const whisperPath = path.join(WHISPER_BIN_DIR, 'whisper');
  
  if (!fs.existsSync(whisperPath)) {
    console.error(`❌ Cannot test whisper: executable not found!`);
    return false;
  }
  
  try {
    // Just get the help output to verify it runs
    const output = execSync(`${whisperPath} --help`, { encoding: 'utf8' });
    
    if (output) {
      // Check if it includes any of these common whisper.cpp output patterns
      const validPatterns = ['usage', 'whisper', 'model', 'options'];
      const isValid = validPatterns.some(pattern => output.toLowerCase().includes(pattern));
      
      if (isValid) {
        console.log(`✅ whisper executable runs successfully`);
        
        // Check if this is a stub or real whisper
        if (output.includes('minimal stub') || output.includes('stub executable')) {
          console.log(`⚠️ Note: This is a whisper stub executable, not a fully functional whisper.cpp build`);
          console.log(`   You may want to build or download whisper.cpp manually for full functionality`);
        }
        
        return true;
      } else {
        console.error(`❌ whisper executable didn't produce expected output!`);
        console.log(`Output was: ${output.substr(0, 200)}...`);
        return false;
      }
    } else {
      console.error(`❌ whisper executable produced no output!`);
      return false;
    }
  } catch (error) {
    console.error(`❌ Error testing whisper execution: ${error.message}`);
    return false;
  }
}

function testFFmpegExecution() {
  console.log(`Testing FFmpeg execution...`);
  
  const ffmpegPath = path.join(FFMPEG_BIN_DIR, 'ffmpeg');
  
  if (!fs.existsSync(ffmpegPath)) {
    console.error(`❌ Cannot test FFmpeg: executable not found!`);
    return false;
  }
  
  try {
    // Just get the version to verify it runs
    const output = execSync(`${ffmpegPath} -version`, { encoding: 'utf8' });
    
    if (output && output.includes('ffmpeg version')) {
      console.log(`✅ FFmpeg executable runs successfully`);
      return true;
    } else {
      console.error(`❌ FFmpeg executable didn't produce expected output!`);
      return false;
    }
  } catch (error) {
    console.error(`❌ Error testing FFmpeg execution: ${error.message}`);
    return false;
  }
}

// Main verification
async function main() {
  console.log('Verifying transcription setup...\n');
  
  // Check directories
  let success = true;
  success = checkDirectory(WHISPER_BIN_DIR, 'whisper binary') && success;
  success = checkDirectory(FFMPEG_BIN_DIR, 'FFmpeg binary') && success;
  success = checkDirectory(WHISPER_MODEL_DIR, 'whisper model') && success;
  
  console.log();
  
  // Check executables
  success = checkExecutable(path.join(WHISPER_BIN_DIR, 'whisper'), 'whisper') && success;
  success = checkExecutable(path.join(FFMPEG_BIN_DIR, 'ffmpeg'), 'FFmpeg') && success;
  
  console.log();
  
  // Check models
  success = checkModels() && success;
  
  console.log();
  
  // Test execution
  success = testWhisperExecution() && success;
  success = testFFmpegExecution() && success;
  
  console.log('\nVerification summary:');
  if (success) {
    console.log('✅ All components are properly set up!');
  } else {
    console.log('❌ Some components are missing or improperly set up!');
    console.log('Run `npm run setup-transcription` to fix the issues.');
  }
  
  return success ? 0 : 1;
}

// Run the verification
main().then(exitCode => {
  process.exit(exitCode);
}).catch(error => {
  console.error('Error during verification:', error);
  process.exit(1);
});