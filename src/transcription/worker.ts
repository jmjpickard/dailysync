/**
 * Transcription Worker Module
 * 
 * This worker thread handles audio mixing and transcription tasks.
 * It processes jobs from a queue, ensuring only one job runs at a time.
 */

import { parentPort, workerData } from 'worker_threads';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import { mixAudioFiles } from '../audio-mixer';
import { getWhisperPath, getWhisperModelPath } from './worker-paths';

// Define job types
type TranscriptionJobStatus = 'queued' | 'mixing' | 'transcribing' | 'completed' | 'failed';

interface TranscriptionJob {
  jobId: string;
  eventId: string;
  systemAudioPath: string;
  micAudioPath: string;
  status: TranscriptionJobStatus;
  mixedAudioPath?: string;
  transcript?: string;
  error?: string;
  modelName?: string;
}

// Make sure we have a parent port
if (!parentPort) {
  throw new Error('Worker must be run as a worker thread');
}

/**
 * Process a transcription job
 * - Mix audio files
 * - Transcribe mixed audio
 * - Clean up temporary files
 * 
 * @param job The transcription job to process
 */
async function processJob(job: TranscriptionJob): Promise<void> {
  try {
    // Update status to mixing
    updateStatus(job, 'mixing');
    
    // Generate output path for mixed audio
    const tempDir = path.dirname(job.systemAudioPath);
    const mixedOutputPath = path.join(tempDir, `${job.jobId}_mixed.wav`);
    
    try {
      // Mix audio files
      console.log(`Mixing audio files for job ${job.jobId}...`);
      const mixedPath = await mixAudioFiles(
        job.systemAudioPath,
        job.micAudioPath,
        mixedOutputPath
      );
      
      job.mixedAudioPath = mixedPath;
      console.log(`Audio mixing completed. Mixed file: ${mixedPath}`);
      
    } catch (err: any) {
      // If mixing fails, update status and stop processing
      updateStatus(job, 'failed', undefined, `Mixing failed: ${err.message}`);
      return;
    }
    
    // Update status to transcribing with 0% progress
    updateStatus(job, 'transcribing', 0);
    
    // Get whisper executable and model paths
    const whisperPath = getWhisperPath();
    const modelName = job.modelName || 'base.en'; // Default to base.en if not specified
    const modelPath = getWhisperModelPath(`ggml-${modelName}.bin`);
    
    // Make sure the files exist
    if (!fs.existsSync(whisperPath)) {
      updateStatus(job, 'failed', undefined, `Whisper executable not found at: ${whisperPath}`);
      return;
    }
    
    if (!fs.existsSync(modelPath)) {
      updateStatus(job, 'failed', undefined, `Whisper model not found at: ${modelPath}`);
      return;
    }
    
    // Construct arguments for whisper.cpp CLI
    const args = [
      '-m', modelPath,         // Model path
      '-f', job.mixedAudioPath, // Input audio file
      '-l', 'en',              // Language (English)
      '--output-txt',          // Output format
      '--print-progress'       // Show progress updates
    ];
    
    console.log(`Running whisper with command: ${whisperPath} ${args.join(' ')}`);
    
    // Spawn the whisper.cpp process
    const whisperProcess = spawn(whisperPath, args);
    
    // Buffer for collecting stdout (transcript)
    let transcriptBuffer = '';
    
    // Buffer for collecting stderr (progress and errors)
    let stderrBuffer = '';
    
    // Listen to stderr for progress information
    whisperProcess.stderr.on('data', (data) => {
      const output = data.toString();
      stderrBuffer += output;
      
      // Parse percentage from output
      // Whisper outputs progress like: "whisper_print_progress_callback: progress =  xx%"
      const percentageMatch = output.match(/whisper_print_progress_callback: progress =\s+(\d+)%/);
      if (percentageMatch) {
        const percentage = parseInt(percentageMatch[1], 10);
        updateStatus(job, 'transcribing', percentage);
      }
      
      console.log(`Whisper progress: ${output}`);
    });
    
    // Collect stdout for transcript
    whisperProcess.stdout.on('data', (data) => {
      transcriptBuffer += data.toString();
    });
    
    // Handle process completion
    whisperProcess.on('close', (code) => {
      if (code === 0) {
        // Process completed successfully
        console.log('Transcription completed successfully');
        updateStatus(job, 'completed', undefined, undefined, transcriptBuffer);
      } else {
        // Process failed
        console.error(`Whisper failed with code ${code}`);
        updateStatus(job, 'failed', undefined, `Transcription failed with code ${code}: ${stderrBuffer}`);
      }
      
      // Clean up temporary files
      try {
        // Keep for now during development
        // fs.unlinkSync(job.systemAudioPath);
        // fs.unlinkSync(job.micAudioPath);
        // fs.unlinkSync(job.mixedAudioPath!);
        console.log('Temporary audio files would be cleaned up here in production');
      } catch (cleanupErr) {
        console.error('Error cleaning up temporary files:', cleanupErr);
      }
      
      // Signal that we're ready for another job
      parentPort?.postMessage({ type: 'ready' });
    });
    
    // Handle process errors
    whisperProcess.on('error', (err) => {
      console.error('Error starting whisper process:', err);
      updateStatus(job, 'failed', undefined, `Failed to start whisper process: ${err.message}`);
      
      // Signal that we're ready for another job
      parentPort?.postMessage({ type: 'ready' });
    });
    
  } catch (error: any) {
    // Handle any unexpected errors
    console.error('Unexpected error processing job:', error);
    updateStatus(job, 'failed', undefined, `Unexpected error: ${error.message}`);
    
    // Signal that we're ready for another job
    parentPort?.postMessage({ type: 'ready' });
  }
}

/**
 * Update the status of a job and notify the main process
 * 
 * @param job The job to update
 * @param status The new status
 * @param progress Optional progress percentage (0-100)
 * @param error Optional error message
 * @param transcript Optional transcript text
 */
function updateStatus(
  job: TranscriptionJob,
  status: TranscriptionJobStatus,
  progress?: number,
  error?: string,
  transcript?: string
): void {
  // Update the job object
  job.status = status;
  
  // Create status update message
  const statusUpdate: any = {
    type: 'statusUpdate',
    jobId: job.jobId,
    status,
    eventId: job.eventId
  };
  
  // Add optional fields if provided
  if (progress !== undefined) statusUpdate.progress = progress;
  if (error) statusUpdate.error = error;
  if (transcript) statusUpdate.transcript = transcript;
  
  // Send status update to main process
  parentPort?.postMessage(statusUpdate);
}

// Listen for messages from the main process
parentPort.on('message', (message: TranscriptionJob) => {
  console.log(`Worker received job: ${message.jobId} for event ${message.eventId}`);
  
  // Process the job
  processJob(message);
});

// Signal that the worker is ready for jobs
parentPort.postMessage({ type: 'ready' });