/**
 * Path Resolution - Worker Thread Version
 * 
 * This module handles path resolution in the worker thread context,
 * where the Electron 'app' module is NOT available and environment
 * information comes from workerData.
 */

import path from "path";
import fs from "fs";
import { workerData } from "worker_threads";

// Define the type for data passed from the main process
export interface PathWorkerData {
  isPackagedEnvironment: boolean;
  resourcesEnvPath: string;
}

// Types for whisper models
export interface WhisperModel {
  name: string;
  filename: string;
  path: string;
  size: number;
}

export interface TranscriptionDependencies {
  whisper: {
    exists: boolean;
    path: string;
  };
  ffmpeg: {
    exists: boolean;
    path: string;
  };
  models: {
    count: number;
    models: WhisperModel[];
  };
}

// Get isPackaged and resourcesPath safely from workerData
// This function is used internally to safely access workerData values
function getWorkerEnvironment(): PathWorkerData {
  // Make sure workerData exists and has the right shape
  if (!workerData || typeof workerData !== 'object') {
    console.warn('[Worker Paths] workerData is not available, using safe defaults');
    return {
      isPackagedEnvironment: false,
      resourcesEnvPath: '',
    };
  }

  // Type assertion with runtime check
  const data = workerData as Partial<PathWorkerData>;
  return {
    isPackagedEnvironment: !!data.isPackagedEnvironment,
    resourcesEnvPath: data.resourcesEnvPath || '',
  };
}

/**
 * Get the path to the whisper.cpp executable
 * @returns {string} Path to the whisper.cpp executable
 */
export function getWhisperPath(): string {
  const { isPackagedEnvironment, resourcesEnvPath } = getWorkerEnvironment();
  
  if (isPackagedEnvironment) {
    return path.join(resourcesEnvPath, "assets", "main");
  } else {
    // In development, use path relative to this file's location after build (e.g., in dist)
    return path.join(__dirname, "..", "..", "assets", "main");
  }
}

/**
 * Get the path to the FFmpeg executable
 * @returns {string} Path to the FFmpeg executable
 */
export function getFFmpegPath(): string {
  const { isPackagedEnvironment, resourcesEnvPath } = getWorkerEnvironment();
  
  if (isPackagedEnvironment) {
    return path.join(resourcesEnvPath, "assets", "bin", "ffmpeg", "ffmpeg");
  } else {
    return path.join(
      __dirname,
      "..",
      "..",
      "assets",
      "bin",
      "ffmpeg",
      "ffmpeg"
    );
  }
}

/**
 * Get the path to a whisper model file
 * @param {string} modelName - The name of the model file (e.g., 'ggml-base.en.bin')
 * @returns {string} Path to the model file
 */
export function getWhisperModelPath(modelName: string): string {
  const { isPackagedEnvironment, resourcesEnvPath } = getWorkerEnvironment();
  
  if (isPackagedEnvironment) {
    return path.join(
      resourcesEnvPath,
      "assets",
      "models",
      "whisper",
      modelName
    );
  } else {
    return path.join(
      __dirname,
      "..",
      "..",
      "assets",
      "models",
      "whisper",
      modelName
    );
  }
}

/**
 * Get the base directory for whisper models
 * @returns {string} Path to the models directory
 */
function getModelsDir(): string {
  const { isPackagedEnvironment, resourcesEnvPath } = getWorkerEnvironment();
  
  if (isPackagedEnvironment) {
    return path.join(resourcesEnvPath, "assets", "models", "whisper");
  } else {
    return path.join(__dirname, "..", "..", "assets", "models", "whisper");
  }
}

/**
 * Get all available whisper models
 * @returns {Array<WhisperModel>} Array of available models
 */
export function getAvailableWhisperModels(): WhisperModel[] {
  const modelsDir = getModelsDir();

  try {
    if (!fs.existsSync(modelsDir)) {
      console.warn(`[Worker Paths] Models directory not found: ${modelsDir}`);
      return [];
    }

    const files = fs.readdirSync(modelsDir);
    const models = files
      .filter((file) => file.endsWith(".bin"))
      .map((file) => {
        const modelPath = path.join(modelsDir, file);
        // Check existence again before statSync
        if (!fs.existsSync(modelPath)) return null;
        try {
          return {
            name: file.replace(/^ggml-/, "").replace(/\.bin$/, ""), // More robust cleaning
            filename: file,
            path: modelPath,
            size: fs.statSync(modelPath).size,
          };
        } catch (statError) {
          console.error(
            `[Worker Paths] Error getting stats for model ${modelPath}:`,
            statError
          );
          return null;
        }
      })
      .filter((model): model is WhisperModel => model !== null); // Filter out nulls and type guard

    return models;
  } catch (error) {
    console.error(
      "[Worker Paths] Error getting available whisper models:",
      error
    );
    return [];
  }
}

/**
 * Check if the transcription dependencies are properly set up
 * @returns {TranscriptionDependencies} Object containing the status of each dependency
 */
export function checkTranscriptionDependencies(): TranscriptionDependencies {
  try {
    const whisperPath = getWhisperPath();
    const ffmpegPath = getFFmpegPath();
    const models = getAvailableWhisperModels();

    return {
      whisper: {
        exists: fs.existsSync(whisperPath),
        path: whisperPath,
      },
      ffmpeg: {
        exists: fs.existsSync(ffmpegPath),
        path: ffmpegPath,
      },
      models: {
        count: models.length,
        models: models,
      },
    };
  } catch (error) {
    console.error(
      "[Worker Paths] Error checking transcription dependencies:",
      error
    );
    // Return default structure indicating failure
    return {
      whisper: {
        exists: false,
        path: "",
      },
      ffmpeg: {
        exists: false,
        path: "",
      },
      models: {
        count: 0,
        models: [],
      },
    };
  }
}