/**
 * Audio Mixer Module
 * 
 * This module provides functionality for mixing audio files using FFmpeg.
 * It's designed to mix system audio and microphone audio recordings
 * into a single audio file suitable for Whisper transcription.
 */

import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { Worker } from 'worker_threads';

// Flag to detect if running in worker context
let isWorkerContext = false;
try {
  // If we can access the Worker constructor and process.resourcesPath exists, we're in worker context
  if (typeof Worker !== 'undefined' && process.resourcesPath) {
    isWorkerContext = true;
  }
} catch (e) {
  // Likely not in worker context
}

/**
 * Safe function to get FFmpeg path that works in both main and worker contexts
 */
function getFFmpegPathSafe(): string {
  try {
    // First try worker-paths if we think we're in a worker
    if (isWorkerContext) {
      try {
        const workerData = require('worker_threads').workerData;
        const isPackaged = workerData?.isPackagedEnvironment || false;
        const resourcesPath = workerData?.resourcesEnvPath || '';
        
        if (isPackaged) {
          return path.join(resourcesPath, "assets", "bin", "ffmpeg", "ffmpeg");
        } else {
          // First check if FFmpeg exists in the dist-electron directory (where worker runs)
          const distElectronPath = path.join(__dirname, "assets", "bin", "ffmpeg", "ffmpeg");
          if (fs.existsSync(distElectronPath)) {
            return distElectronPath;
          }
          // Then try with one level up
          const developmentPath = path.join(__dirname, "..", "assets", "bin", "ffmpeg", "ffmpeg");
          if (fs.existsSync(developmentPath)) {
            return developmentPath;
          }
          // Try with two levels up as last resort
          return path.join(__dirname, "..", "..", "assets", "bin", "ffmpeg", "ffmpeg");
        }
      } catch (workerError) {
        console.error('Error accessing worker data:', workerError);
      }
    }
    
    // Then try main-paths approach with electron.app
    try {
      const { getFFmpegPath } = require('./transcription/main-paths');
      return getFFmpegPath();
    } catch (mainPathError) {
      console.error('Error using main-paths:', mainPathError);
    }
    
    // Attempt multiple possible paths in development environment
    const possiblePaths = [
      path.join(__dirname, "assets", "bin", "ffmpeg", "ffmpeg"),           // Direct in dist-electron
      path.join(__dirname, "..", "assets", "bin", "ffmpeg", "ffmpeg"),     // One level up
      path.join(__dirname, "..", "..", "assets", "bin", "ffmpeg", "ffmpeg") // Two levels up (project root)
    ];
    
    for (const possiblePath of possiblePaths) {
      if (fs.existsSync(possiblePath)) {
        return possiblePath;
      }
    }
    
    // If all else fails, try platform-specific fallbacks
    if (os.platform() === 'darwin') {
      return '/usr/local/bin/ffmpeg';  // Common macOS location
    } else if (os.platform() === 'win32') {
      return path.join(process.cwd(), 'assets', 'bin', 'ffmpeg', 'ffmpeg.exe');
    } else {
      return '/usr/bin/ffmpeg';  // Common Linux location
    }
  } catch (error) {
    console.error('Critical error resolving FFmpeg path:', error);
    // Absolute last resort - try a platform-specific fallback
    if (os.platform() === 'darwin') {
      return '/usr/local/bin/ffmpeg';  // Common macOS location
    } else if (os.platform() === 'win32') {
      return path.join(process.cwd(), 'assets', 'bin', 'ffmpeg', 'ffmpeg.exe');
    } else {
      return '/usr/bin/ffmpeg';  // Common Linux location
    }
  }
}

/**
 * Asynchronously mixes two audio files using FFmpeg
 * 
 * @param {string} systemAudioPath - Path to the system audio file
 * @param {string} micAudioPath - Path to the microphone audio file  
 * @param {string} outputAudioPath - Path where the mixed audio file will be saved
 * @returns {Promise<string>} - A promise that resolves with the output file path
 */
export async function mixAudioFiles(
  systemAudioPath: string, 
  micAudioPath: string, 
  outputAudioPath: string
): Promise<string> {
  return new Promise((resolve, reject) => {
    // Verify input files exist
    if (!fs.existsSync(systemAudioPath)) {
      return reject(new Error(`System audio file not found at: ${systemAudioPath}`));
    }
    
    if (!fs.existsSync(micAudioPath)) {
      return reject(new Error(`Microphone audio file not found at: ${micAudioPath}`));
    }
    
    try {
      // Get the path to bundled FFmpeg using our safe resolution function
      const ffmpegPath = getFFmpegPathSafe();
      console.log(`Resolved FFmpeg path: ${ffmpegPath}`);
      
      // Construct FFmpeg arguments for optimal Whisper input (16kHz mono WAV)
      const args = [
        "-y",                       // Overwrite output file if it exists
        "-i", systemAudioPath,      // System audio input
        "-i", micAudioPath,         // Microphone audio input
        "-filter_complex",
        "[0:a][1:a]amerge=inputs=2[a]", // Merge to stereo first
        "-map", "[a]",              // Map the merged audio
        "-ac", "1",                 // Convert to mono 
        "-ar", "16000",             // Resample to 16kHz
        "-acodec", "pcm_s16le",     // Use 16-bit WAV format
        outputAudioPath             // Output file path
      ];
      
      console.log(`Running FFmpeg with command: ${ffmpegPath} ${args.join(' ')}`);
      
      // Spawn FFmpeg process
      const ffmpegProcess = spawn(ffmpegPath, args);
      
      // Collect stderr data for debugging and error reporting
      let stderr = '';
      ffmpegProcess.stderr.on('data', (data) => {
        stderr += data.toString();
        console.log(`FFmpeg progress: ${data.toString()}`);
      });
      
      // Handle process completion
      ffmpegProcess.on('close', (code) => {
        if (code === 0) {
          // FFmpeg completed successfully
          console.log('Audio mixing completed successfully');
          
          // Verify the output file exists
          if (fs.existsSync(outputAudioPath)) {
            resolve(outputAudioPath);
          } else {
            reject(new Error(`FFmpeg completed but output file not found at: ${outputAudioPath}`));
          }
        } else {
          // FFmpeg failed
          reject(new Error(`FFmpeg failed with code ${code}. Error: ${stderr}`));
        }
      });
      
      // Handle process errors
      ffmpegProcess.on('error', (err) => {
        reject(new Error(`Failed to start FFmpeg: ${err.message}`));
      });
    } catch (error: any) {
      reject(new Error(`Error during audio mixing: ${error.message}`));
    }
  });
}