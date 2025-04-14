/**
 * Transcription Queue Manager (Updated with enhanced logging & error handling)
 *
 * This module manages a queue of transcription jobs and a worker thread
 * to process them. It ensures that only one job is processed at a time
 * and includes robust error handling for worker creation.
 */

import { Worker } from "worker_threads";
import path from "path";
import fs from "fs"; // Import fs module for path checking
import { v4 as uuidv4 } from "uuid";
import { app, BrowserWindow } from "electron";
import { getIsPackagedFlag, getMainProcessResourcesPath } from "./main-paths";

// --- Configuration for worker recreation ---
const MAX_WORKER_CREATION_ATTEMPTS = 5; // Limit consecutive recreation attempts
const RECREATION_DELAY_MS = 2000; // Delay before attempting recreation (milliseconds)
// -----------------------------------------

// Define job types
type TranscriptionJobStatus =
  | "queued"
  | "mixing"
  | "transcribing"
  | "completed"
  | "failed";

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
  progress?: number;
  createdAt: Date;
}

interface StatusUpdate {
  type: "statusUpdate";
  jobId: string;
  status: TranscriptionJobStatus;
  eventId: string;
  progress?: number;
  error?: string;
  transcript?: string;
}

interface WorkerReadyMessage {
  type: "ready";
}

type WorkerMessage = StatusUpdate | WorkerReadyMessage;

// Queue to hold pending transcription jobs
let transcriptionQueue: TranscriptionJob[] = [];

// Worker state
let worker: Worker | null = null;
let isWorkerBusy = false;
let workerCreationAttempts = 0; // Counter for consecutive recreation attempts
let recreationTimeout: NodeJS.Timeout | null = null; // To manage delayed recreation

/**
 * Initialize the transcription queue and worker.
 */
export function initTranscriptionQueue(): void {
  console.log("Initializing Transcription Queue...");
  // Clear any pending recreation timeout from previous states
  if (recreationTimeout) {
    clearTimeout(recreationTimeout);
    recreationTimeout = null;
  }

  // Create the worker thread if it doesn't exist
  if (!worker) {
    console.log("Worker doesn't exist, initiating creation...");
    // Reset attempts count when initializing explicitly
    workerCreationAttempts = 0;
    createWorker();
  } else {
    console.log("Worker already exists. Ensuring state is ready.");
    // If re-initializing, ensure worker isn't stuck being busy
    isWorkerBusy = false;
    // Reset attempts as the existing worker is considered stable for now
    workerCreationAttempts = 0;
    // Ensure queue processing is attempted if worker is ready
    processQueue();
  }
}

/**
 * Create a new worker thread with path validation and error handling.
 */
function createWorker(): void {
  // Prevent duplicate creation calls if already scheduled
  if (recreationTimeout) {
    console.warn(
      "Worker creation already scheduled. Skipping duplicate creation call."
    );
    return;
  }
  // Stop if maximum attempts reached
  if (workerCreationAttempts >= MAX_WORKER_CREATION_ATTEMPTS) {
    console.error(
      `[Worker Error] Max worker creation attempts (${MAX_WORKER_CREATION_ATTEMPTS}) reached. Stopping worker creation.`
    );
    return;
  }

  let workerPath: string;
  try {
    // Determine worker script path. Assumes worker.js is in the same directory.
    // This usually works correctly in development and packaged apps (if packaged correctly).
    workerPath = path.join(__dirname, "worker.js");

    console.log(
      `[Worker Create] Attempting creation (Attempt ${
        workerCreationAttempts + 1
      }/${MAX_WORKER_CREATION_ATTEMPTS})`
    );
    console.log(`[Worker Create] Resolved worker path: ${workerPath}`);

    // *** CRUCIAL CHECK: Validate worker script existence ***
    try {
      if (!fs.existsSync(workerPath)) {
        // Log critical error and schedule retry
        console.error(
          `[Worker Error] Worker script *NOT FOUND* at path: ${workerPath}`
        );
        console.error(
          "[Worker Error] This often happens if 'worker.js' isn't copied correctly during packaging or path is wrong."
        );
        // Schedule a retry - maybe the file appears later? Unlikely but safer.
        scheduleWorkerRecreation(`Worker script not found at ${workerPath}`);
        return; // Stop this creation attempt
      } else {
        console.log(`[Worker Create] Worker script FOUND at: ${workerPath}`);
      }
    } catch (fsError: any) {
      console.error(
        `[Worker Error] Filesystem error checking worker path existence: ${fsError.message}`
      );
      scheduleWorkerRecreation(`Filesystem error checking worker path`);
      return; // Stop this creation attempt
    }
    // ********************************************************

    // --- Attempt to create the worker ---
    console.log("[Worker Create] Calling 'new Worker()'...");
    // Get environment flags from main-paths.ts safely
    let isPackaged = false;
    let resourcesPath = '';
    
    try {
      isPackaged = getIsPackagedFlag();
      resourcesPath = getMainProcessResourcesPath();
      
      // Ensure FFmpeg binary is available in dist-electron for development mode
      if (!isPackaged) {
        const ffmpegSrc = path.join(app.getAppPath(), 'assets', 'bin', 'ffmpeg', 'ffmpeg');
        const ffmpegDestDir = path.join(__dirname, '..', 'assets', 'bin', 'ffmpeg');
        const ffmpegDest = path.join(ffmpegDestDir, 'ffmpeg');
        
        try {
          // Create directory if it doesn't exist
          if (!fs.existsSync(ffmpegDestDir)) {
            fs.mkdirSync(ffmpegDestDir, { recursive: true });
            console.log(`[Worker Create] Created FFmpeg directory at ${ffmpegDestDir}`);
          }
          
          // Only copy if source exists and destination doesn't
          if (fs.existsSync(ffmpegSrc) && !fs.existsSync(ffmpegDest)) {
            fs.copyFileSync(ffmpegSrc, ffmpegDest);
            fs.chmodSync(ffmpegDest, 0o755); // Make executable
            console.log(`[Worker Create] Copied FFmpeg from ${ffmpegSrc} to ${ffmpegDest}`);
          } else if (fs.existsSync(ffmpegDest)) {
            console.log(`[Worker Create] FFmpeg already exists at ${ffmpegDest}`);
          } else if (!fs.existsSync(ffmpegSrc)) {
            console.error(`[Worker Create] Source FFmpeg not found at ${ffmpegSrc}`);
          }
        } catch (ffmpegError) {
          console.error('[Worker Create] Error setting up FFmpeg in development mode:', ffmpegError);
        }
      }
    } catch (pathError) {
      console.error('[Worker Create] Error getting app environment flags:', pathError);
      // Provide fallback values in case Electron app object is not available
      if (process.env.NODE_ENV === 'production') {
        isPackaged = true;
        resourcesPath = process.resourcesPath || '';
      }
    }

    console.log(
      `[Worker Create] Passing workerData: isPackagedEnvironment=${isPackaged}, resourcesEnvPath=${resourcesPath}`
    );

    worker = new Worker(workerPath, {
      workerData: {
        isPackagedEnvironment: isPackaged,
        resourcesEnvPath: resourcesPath,
      },
    });
    // ------------------------------------

    // Reset state and attempts count *after* successful 'new Worker()' call
    isWorkerBusy = false;
    workerCreationAttempts = 0; // Reset attempts as we successfully started creation
    console.log(
      "[Worker Create] Worker instance created successfully. Setting up listeners..."
    );

    // --- Setup Listeners ---
    worker.on("message", handleWorkerMessage);
    worker.on("error", (error) => {
      console.error("[Worker Error] Worker instance reported error:", error);
      cleanupAndScheduleRecreation(`Worker reported an error object`);
    });
    worker.on("exit", (code) => {
      console.log(`[Worker Exit] Worker exited with code ${code}`);
      if (code !== 0) {
        console.error(
          `[Worker Error] Worker stopped unexpectedly with non-zero exit code ${code}.`
        );
        cleanupAndScheduleRecreation(
          `Worker exited with non-zero code ${code}`
        );
      } else {
        console.log(
          "[Worker Exit] Worker exited cleanly (code 0). Not attempting automatic recreation."
        );
        // Reset attempts if exited cleanly, assuming it might be intentional
        workerCreationAttempts = 0;
        // Clean up reference if it exited cleanly but wasn't terminated manually
        if (worker) {
          worker.removeAllListeners();
          worker = null;
          isWorkerBusy = false;
        }
      }
    });
    // ------------------------

    console.log("[Worker Create] Worker thread setup listeners completed.");
    // Try processing queue now that worker is theoretically ready
    processQueue();
  } catch (error: any) {
    // This catch block handles synchronous errors during 'new Worker()' itself.
    // A SIGTRAP crash might bypass this, but it's essential for other errors.
    console.error(
      "[Worker Error] !!! CRITICAL ERROR during new Worker() call:",
      error.message,
      error.stack
    );
    cleanupAndScheduleRecreation(`Exception during 'new Worker()' constructor`);
  }
}

/**
 * Cleans up the existing worker reference and schedules recreation.
 * @param reason Reason for recreation.
 */
function cleanupAndScheduleRecreation(reason: string): void {
  if (worker) {
    worker.removeAllListeners(); // Clean up listeners to prevent memory leaks
    worker = null;
  }
  isWorkerBusy = false; // Ensure queue isn't blocked
  scheduleWorkerRecreation(reason);
}

/**
 * Schedules a delayed attempt to recreate the worker, respecting limits.
 * @param reason Reason for recreation.
 */
function scheduleWorkerRecreation(reason: string): void {
  workerCreationAttempts++; // Increment attempt counter *before* checking limit
  console.log(
    `[Worker Retry] Scheduling attempt ${workerCreationAttempts}/${MAX_WORKER_CREATION_ATTEMPTS}. Reason: ${reason}`
  );

  if (workerCreationAttempts >= MAX_WORKER_CREATION_ATTEMPTS) {
    console.error(
      `[Worker Retry] Max worker creation attempts reached after error: ${reason}. Worker will NOT be recreated automatically.`
    );
    return; // Stop retrying
  }

  // Clear existing timeout if any, preventing duplicate schedules
  if (recreationTimeout) {
    clearTimeout(recreationTimeout);
  }

  // Schedule the next attempt
  console.log(
    `[Worker Retry] Scheduling recreation in ${RECREATION_DELAY_MS}ms.`
  );
  recreationTimeout = setTimeout(() => {
    console.log(
      `[Worker Retry] Attempting scheduled worker recreation (Attempt ${
        workerCreationAttempts + 1
      })...`
    );
    recreationTimeout = null; // Clear the timeout handle as we are now attempting
    createWorker(); // Try creating again
  }, RECREATION_DELAY_MS);
}

/**
 * Handle messages received from the worker thread.
 */
function handleWorkerMessage(message: WorkerMessage): void {
  // Optional: Reset attempts counter if we receive any message, assuming worker is somewhat alive.
  // However, it might be better to only reset on successful creation/clean exit.
  // workerCreationAttempts = 0;

  if (message.type === "ready") {
    console.log('[Worker Message] Worker sent "ready".');
    isWorkerBusy = false;
    // Explicitly reset attempts count when worker confirms it's ready
    workerCreationAttempts = 0;
    if (recreationTimeout) {
      // Clear any pending retry if worker recovered
      clearTimeout(recreationTimeout);
      recreationTimeout = null;
    }
    processQueue();
  } else if (message.type === "statusUpdate") {
    const jobIndex = transcriptionQueue.findIndex(
      (job) => job.jobId === message.jobId
    );
    if (jobIndex !== -1) {
      const job = transcriptionQueue[jobIndex];
      job.status = message.status;
      if (message.progress !== undefined) job.progress = message.progress;
      if (message.error) {
        job.error = message.error;
        console.error(
          `[Job Error] Job ${job.jobId} failed in worker: ${message.error}`
        );
      }
      if (message.transcript) job.transcript = message.transcript;

      console.log(
        `[Job Update] Job ${job.jobId} status: ${job.status}`,
        message.progress !== undefined ? `(${job.progress}%)` : ""
      );

      // Send IPC message (ensure window exists)
      const mainWindow = BrowserWindow.getAllWindows()[0];
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send("transcription-update", { ...job }); // Send a copy
      }

      // Dynamic import for storage to avoid circular dependencies
      try {
        import("../storage/store")
          .then((storage) => {
            // Logic for saving different states (completed, failed, progress)
            if (job.status === "completed" && job.transcript) {
              storage.saveTranscriptionResult(
                job.eventId,
                "completed",
                job.transcript
              );
            } else if (job.status === "failed" && job.error) {
              storage.saveTranscriptionResult(
                job.eventId,
                "failed",
                undefined,
                job.error
              );
            } else if (
              job.status === "transcribing" &&
              job.progress !== undefined
            ) {
              storage.saveTranscriptionResult(
                job.eventId,
                "transcribing",
                undefined,
                undefined,
                job.progress
              );
            }
          })
          .catch((importError) => {
            console.error(
              "[Storage Error] Error dynamically importing storage module:",
              importError
            );
          });
      } catch (error: any) {
        console.error(
          "[Storage Error] Error initiating save transcription result:",
          error.message
        );
      }
    } else {
      console.warn(
        `[Worker Message] Received status update for unknown job ID: ${message.jobId}`
      );
    }
  } else {
    console.warn(
      "[Worker Message] Received unknown message type from worker:",
      (message as any)?.type
    );
  }
}

/**
 * Process the next job in the queue if the worker is available and not busy.
 */
export function processQueue(): void {
  if (!worker) {
    // Don't log every time if queue is empty, only if jobs are waiting
    if (transcriptionQueue.some((job) => job.status === "queued")) {
      console.log("[Process Queue] Worker not available. Cannot process.");
    }
    // Optional: Trigger creation if missing? Be careful not to loop.
    // if (!recreationTimeout && workerCreationAttempts < MAX_WORKER_CREATION_ATTEMPTS) { createWorker(); }
    return;
  }

  if (isWorkerBusy) {
    // console.log("[Process Queue] Worker is busy."); // Can be noisy
    return;
  }

  const nextJob = transcriptionQueue.find((job) => job.status === "queued");
  if (!nextJob) {
    // console.log("[Process Queue] No queued jobs found."); // Can be noisy
    return;
  }

  console.log(
    `[Process Queue] Processing job ${nextJob.jobId} for event ${nextJob.eventId}`
  );
  isWorkerBusy = true; // Mark busy *before* sending

  try {
    worker.postMessage({ ...nextJob }); // Send a copy
    console.log(`[Process Queue] Job ${nextJob.jobId} sent to worker.`);
  } catch (postError: any) {
    console.error(
      `[Process Queue] Error posting message to worker for job ${nextJob.jobId}: ${postError.message}`
    );
    isWorkerBusy = false; // Free up queue if post fails
    cleanupAndScheduleRecreation("Failed to post message to worker");
  }
}

/**
 * Add a new job to the transcription queue.
 */
export function addJobToQueue(
  eventId: string,
  systemAudioPath: string,
  micAudioPath: string,
  modelName?: string
): TranscriptionJob {
  const jobId = uuidv4();
  const job: TranscriptionJob = {
    jobId,
    eventId,
    systemAudioPath,
    micAudioPath,
    status: "queued",
    modelName,
    createdAt: new Date(),
  };

  transcriptionQueue.push(job);
  console.log(
    `[Queue] Added job ${jobId} for event ${eventId}. Queue length: ${transcriptionQueue.length}`
  );

  // Notify renderer
  const mainWindow = BrowserWindow.getAllWindows()[0];
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send("transcription-queued", { ...job }); // Send copy
  }

  // Ensure worker exists if needed (alternative creation trigger)
  if (
    !worker &&
    !recreationTimeout &&
    workerCreationAttempts < MAX_WORKER_CREATION_ATTEMPTS
  ) {
    console.log(
      "[Queue] Worker doesn't exist while adding job, attempting creation."
    );
    workerCreationAttempts = 0; // Reset attempts for this explicit trigger
    createWorker();
  } else {
    // If worker exists or is being created, try processing queue
    processQueue();
  }

  return { ...job }; // Return a copy
}

// --- Getter Functions (Returning Copies) ---

export function getJobs(): TranscriptionJob[] {
  return [...transcriptionQueue];
}
export function getJobById(jobId: string): TranscriptionJob | null {
  const job = transcriptionQueue.find((j) => j.jobId === jobId);
  return job ? { ...job } : null;
}
export function getJobsByEventId(eventId: string): TranscriptionJob[] {
  return transcriptionQueue
    .filter((j) => j.eventId === eventId)
    .map((j) => ({ ...j }));
}

// --- Control Functions ---

export function pauseQueue(terminateWorker = false): void {
  console.log(`[Control] Pausing queue. Terminate worker: ${terminateWorker}`);
  isWorkerBusy = true; // Prevent processQueue from sending new jobs

  if (terminateWorker && worker) {
    console.log("[Control] Terminating worker due to pauseQueue(true)...");
    // Prevent automatic recreation after explicit termination via pause
    workerCreationAttempts = MAX_WORKER_CREATION_ATTEMPTS;
    if (recreationTimeout) clearTimeout(recreationTimeout);
    recreationTimeout = null;
    worker.terminate();
    worker = null;
  }
}

export function resumeQueue(): void {
  console.log("[Control] Resuming queue processing.");
  isWorkerBusy = false; // Allow queue processing

  if (!worker) {
    console.log(
      "[Control] Worker doesn't exist while resuming, attempting creation."
    );
    workerCreationAttempts = 0; // Reset attempts for explicit resume
    if (recreationTimeout) clearTimeout(recreationTimeout);
    recreationTimeout = null;
    createWorker();
  } else {
    // If worker exists, ensure processing is attempted
    processQueue();
  }
}

export function clearCompletedJobs(): number {
  const initialLength = transcriptionQueue.length;
  transcriptionQueue = transcriptionQueue.filter(
    (job) => job.status !== "completed" && job.status !== "failed"
  );
  const removedCount = initialLength - transcriptionQueue.length;
  console.log(
    `[Control] Cleared ${removedCount} completed/failed jobs. Queue length: ${transcriptionQueue.length}`
  );
  return removedCount;
}

export function shutdownQueue(): void {
  console.log("[Control] Shutting down transcription queue...");
  if (worker) {
    console.log("[Control] Terminating worker during shutdown.");
    // Prevent any pending/future recreation during shutdown
    workerCreationAttempts = MAX_WORKER_CREATION_ATTEMPTS;
    if (recreationTimeout) clearTimeout(recreationTimeout);
    recreationTimeout = null;
    worker.terminate();
    worker = null;
  }
  transcriptionQueue = [];
  console.log("[Control] Transcription queue cleared and worker terminated.");
}
