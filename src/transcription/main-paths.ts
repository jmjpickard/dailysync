/**
 * Path Resolution - Main Process Version
 * 
 * This module handles path resolution in the main process context,
 * where the Electron 'app' module is available.
 */

import path from "path";
import fs from "fs";
import { app } from "electron";

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

/**
 * Get whether the app is running in a packaged environment
 * @returns {boolean} True if running in packaged environment
 */
export function getIsPackagedFlag(): boolean {
  return app.isPackaged;
}

/**
 * Get the base resources path for the app
 * @returns {string} Path to the resources directory
 */
export function getMainProcessResourcesPath(): string {
  return process.resourcesPath;
}

/**
 * Get the path to the whisper.cpp executable
 * @returns {string} Path to the whisper.cpp executable
 */
export function getWhisperPath(): string {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, "assets", "main");
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
  if (app.isPackaged) {
    return path.join(process.resourcesPath, "assets", "bin", "ffmpeg", "ffmpeg");
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
  if (app.isPackaged) {
    return path.join(
      process.resourcesPath,
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
  if (app.isPackaged) {
    return path.join(process.resourcesPath, "assets", "models", "whisper");
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
      console.warn(`[Main Paths] Models directory not found: ${modelsDir}`);
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
            `[Main Paths] Error getting stats for model ${modelPath}:`,
            statError
          );
          return null;
        }
      })
      .filter((model): model is WhisperModel => model !== null); // Filter out nulls and type guard

    return models;
  } catch (error) {
    console.error(
      "[Main Paths] Error getting available whisper models:",
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
      "[Main Paths] Error checking transcription dependencies:",
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