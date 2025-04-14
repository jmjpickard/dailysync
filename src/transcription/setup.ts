/**
 * Transcription Setup Module
 *
 * This module handles checking if the transcription dependencies
 * are properly set up and provides information about them.
 */

import {
  checkTranscriptionDependencies,
  getAvailableWhisperModels,
  WhisperModel,
  TranscriptionDependencies,
} from "./main-paths";

// Define an extended model type with additional fields
export interface WhisperModelInfo extends WhisperModel {
  description: string;
  quality: string;
  sizeMB: number;
}

/**
 * Check if the transcription dependencies are properly set up
 * @returns {Object} Object containing the status of each dependency
 */
function checkSetup(): TranscriptionDependencies {
  return checkTranscriptionDependencies();
}

/**
 * Get a formatted list of available whisper models
 * @returns {Array<Object>} Array of available models with name, description, and size
 */
function getModels(): WhisperModelInfo[] {
  const models = getAvailableWhisperModels();

  // Add human-readable descriptions
  return models.map((model) => {
    let description = "";
    let quality = "";

    // Add descriptions based on model name
    if (model.name.includes("tiny")) {
      description = "Fastest, lowest accuracy";
      quality = "Low";
    } else if (model.name.includes("base")) {
      description = "Fast, moderate accuracy";
      quality = "Moderate";
    } else if (model.name.includes("small")) {
      description = "Good balance of speed and accuracy";
      quality = "Good";
    } else if (model.name.includes("medium")) {
      description = "High accuracy, slower processing";
      quality = "High";
    } else if (model.name.includes("large")) {
      description = "Highest accuracy, slowest processing";
      quality = "Excellent";
    }

    // Add language info
    if (model.name.includes(".en")) {
      description += " (English only)";
    } else {
      description += " (Multilingual)";
    }

    // Format size in MB
    const sizeMB = Math.round(model.size / (1024 * 1024));

    return {
      ...model,
      description,
      quality,
      sizeMB,
    };
  });
}

// Explicitly export with default to ensure compatibility
export default {
  checkSetup,
  getModels,
};
