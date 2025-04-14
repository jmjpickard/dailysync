/**
 * Storage Module (Refactored)
 *
 * This module handles persistent storage using electron-store.
 * Refactored to use targeted updates (dot notation) to minimize race conditions
 * where saving one piece of meeting data might overwrite another.
 */

import Store from "electron-store";
// @ts-ignore
const { app } = require("electron");
import path from "path";
import fs from "fs";
import {
  Settings,
  EventDetails,
  MeetingData,
  StoreSchema,
} from "./storageTypes";

// Initialize store with schema
const store = new Store<StoreSchema>({
  name: "daily-sync-data", // Explicitly set the store name
  defaults: {
    settings: {
      whisperModel: "base.en",
    },
    meetingData: {},
  },
  // Consider adding migrations if schema changes significantly over time
});

// --- Directory Setup ---
const userDataPath = app.getPath("userData");
const transcriptsDir = path.join(userDataPath, "transcripts");

// Ensure the transcripts directory exists
try {
  if (!fs.existsSync(transcriptsDir)) {
    fs.mkdirSync(transcriptsDir, { recursive: true });
    console.log(`Created transcripts directory at ${transcriptsDir}`);
  }
} catch (error) {
  console.error(
    `Error creating transcripts directory: ${transcriptsDir}`,
    error
  );
  // Handle error appropriately, maybe notify the user or fallback
}

// --- Helper Function ---

/**
 * Ensures the basic structure for a meeting exists in the store.
 * Creates it if it doesn't exist.
 * @param eventId - The ID of the event.
 * @param eventDetails - Optional initial event details to save if creating.
 */
function ensureMeetingDataExists(
  eventId: string,
  eventDetails?: EventDetails
): void {
  const meetingPath = `meetingData.${eventId}`;
  if (!store.has(meetingPath)) {
    console.log(`Initializing meeting data structure for event: ${eventId}`);
    store.set(meetingPath, {
      // If eventDetails are provided, use them, otherwise use a minimal structure
      eventDetails: eventDetails || { id: eventId },
      lastUpdated: Date.now(),
      // Initialize other fields to sensible defaults if needed
      notes: "",
      transcriptStatus: undefined, // Or 'none'/'not_started'
      summary: "",
    });
  }
}

// --- Settings ---

export function saveSetting(key: string, value: any): void {
  try {
    store.set(`settings.${key}`, value);
    console.log(`Saved setting: ${key}`);
  } catch (error) {
    console.error(`Error saving setting ${key}:`, error);
  }
}

export function loadSetting<T>(key: string, defaultValue: T): T {
  return store.get(`settings.${key}`, defaultValue);
}

export function saveAllSettings(settingsObject: Settings): void {
  try {
    store.set("settings", settingsObject);
    console.log("Saved all settings");
  } catch (error) {
    console.error("Error saving all settings:", error);
  }
}

export function loadAllSettings(): Settings {
  return store.get("settings", {});
}

// --- Meeting Data (Notes) ---

/**
 * Save a meeting note using targeted update.
 * @param eventId - Google Calendar event ID
 * @param noteContent - Note content
 */
export function saveMeetingNote(eventId: string, noteContent: string): void {
  if (!eventId) {
    console.error("Attempted to save note with empty eventId.");
    return;
  }
  try {
    ensureMeetingDataExists(eventId); // Make sure the parent object exists
    const notePath = `meetingData.${eventId}.notes`;
    const lastUpdatedPath = `meetingData.${eventId}.lastUpdated`;

    store.set(notePath, noteContent);
    store.set(lastUpdatedPath, Date.now());

    // Verification (optional, good for debugging)
    const savedNote = store.get(notePath, "");
    console.log(
      `Saved note for meeting: ${eventId}, verified length: ${
        savedNote?.length ?? 0
      }`
    );
  } catch (error) {
    console.error(`Error saving note for event ${eventId}:`, error);
  }
}

/**
 * Load a meeting note.
 * @param eventId - Google Calendar event ID
 * @returns Note content (string)
 */
export function loadMeetingNote(eventId: string): string {
  if (!eventId) {
    console.error("Attempted to load note with empty eventId.");
    return "";
  }
  try {
    const notePath = `meetingData.${eventId}.notes`;
    const noteContent = store.get(notePath, ""); // Default to empty string if not found
    console.log(
      `Loading note for meeting: ${eventId}, loaded length: ${
        noteContent?.length ?? 0
      }`
    );
    return noteContent;
  } catch (error) {
    console.error(`Error loading note for event ${eventId}:`, error);
    return ""; // Return empty string on error
  }
}

// --- Meeting Data (Initial Details) ---

/**
 * Save initial meeting details from Google Calendar.
 * Uses targeted updates for eventDetails and lastUpdated.
 * @param eventId - Google Calendar event ID
 * @param eventObject - Event details from Google Calendar
 */
export function saveInitialMeetingDetails(
  eventId: string,
  eventObject: EventDetails
): void {
  if (!eventId) {
    console.error("Attempted to save details with empty eventId.");
    return;
  }
  try {
    ensureMeetingDataExists(eventId, eventObject); // Pass details in case it needs creation
    const detailsPath = `meetingData.${eventId}.eventDetails`;
    const lastUpdatedPath = `meetingData.${eventId}.lastUpdated`;

    store.set(detailsPath, eventObject); // Overwrite existing details if necessary
    store.set(lastUpdatedPath, Date.now());

    console.log(`Saved/Updated details for meeting: ${eventId}`);
  } catch (error) {
    console.error(`Error saving details for event ${eventId}:`, error);
  }
}

// --- Meeting Data (Transcription) ---

/**
 * Save transcription status, progress, path, or error using targeted updates.
 * Does NOT overwrite notes or other unrelated fields.
 * @param eventId - Google Calendar event ID
 * @param status - Transcription status
 * @param transcript - Transcript text (if completed, will be saved to file)
 * @param error - Error message (if failed)
 * @param progress - Transcription progress percentage
 */
export function saveTranscriptionResult(
  eventId: string,
  status: "queued" | "mixing" | "transcribing" | "completed" | "failed",
  transcript?: string,
  error?: string,
  progress?: number
): void {
  if (!eventId) {
    console.error("Attempted to save transcript result with empty eventId.");
    return;
  }
  try {
    ensureMeetingDataExists(eventId); // Ensure parent object exists
    const basePath = `meetingData.${eventId}`;

    // Update status
    store.set(`${basePath}.transcriptStatus`, status);

    // Update progress if provided
    if (progress !== undefined) {
      store.set(`${basePath}.transcriptProgress`, progress);
    }

    // Clear previous error/path if status is not failed/completed
    // Use store.set(path, undefined) to remove nested properties with typed schemas,
    // as store.delete() might expect top-level keys.
    if (status !== "failed") {
      store.set(`${basePath}.transcriptError`, undefined);
    }
    if (status !== "completed") {
      // Consider if you want to delete the path immediately or keep it
      // store.set(`${basePath}.transcriptPath`, undefined);
    }

    // Handle completed state: save transcript to file and store path
    if (status === "completed" && transcript) {
      const transcriptFileName = `${eventId}_${Date.now()}.txt`;
      const transcriptFilePath = path.join(transcriptsDir, transcriptFileName);
      try {
        fs.writeFileSync(transcriptFilePath, transcript);
        store.set(`${basePath}.transcriptPath`, transcriptFilePath);
        console.log(`Saved transcript to file: ${transcriptFilePath}`);
        // Clear any lingering error message
        store.set(`${basePath}.transcriptError`, undefined);
      } catch (err) {
        console.error("Error saving transcript to file:", err);
        // Store error state if file write fails
        store.set(`${basePath}.transcriptStatus`, "failed");
        store.set(
          `${basePath}.transcriptError`,
          `Failed to write transcript file: ${(err as Error).message}` // Type assertion for error message
        );
        // Clear path if file write failed
        store.set(`${basePath}.transcriptPath`, undefined);
      }
    }

    // Handle failed state: store error message
    if (status === "failed" && error) {
      store.set(`${basePath}.transcriptError`, error);
      // Clear any lingering path
      store.set(`${basePath}.transcriptPath`, undefined);
    }

    // Update timestamp
    store.set(`${basePath}.lastUpdated`, Date.now());

    console.log(
      `Saved transcription result for meeting: ${eventId}, status: ${status}`
    );
  } catch (err) {
    console.error(
      `Error saving transcription result for event ${eventId}:`,
      err
    );
  }
}

/**
 * Load transcript data (status, text from file, path, error, progress).
 * @param eventId - Google Calendar event ID
 * @returns Transcript data or null if meeting not found.
 */
export function loadTranscript(eventId: string): {
  status?: "queued" | "mixing" | "transcribing" | "completed" | "failed";
  text?: string;
  path?: string;
  error?: string;
  progress?: number;
} | null {
  if (!eventId) {
    console.error("Attempted to load transcript with empty eventId.");
    return null;
  }
  try {
    const meetingPath = `meetingData.${eventId}`;
    if (!store.has(meetingPath)) {
      console.log(
        `No meeting data found for eventId ${eventId} during transcript load.`
      );
      return null;
    }

    const meetingData = store.get(meetingPath) as MeetingData; // Get the whole object for reading

    const result: {
      status?: "queued" | "mixing" | "transcribing" | "completed" | "failed";
      text?: string;
      path?: string;
      error?: string;
      progress?: number;
    } = {};

    result.status = meetingData.transcriptStatus;
    result.path = meetingData.transcriptPath;
    result.error = meetingData.transcriptError;
    result.progress = meetingData.transcriptProgress;

    // Try to load transcript text from file if path exists and status is completed
    if (result.status === "completed" && result.path) {
      try {
        if (fs.existsSync(result.path)) {
          result.text = fs.readFileSync(result.path, "utf8");
          console.log(
            `Loaded transcript from file: ${result.path}, length: ${
              result.text?.length ?? 0
            }`
          );
        } else {
          console.warn(
            `Transcript file not found: ${result.path}. Status might be inaccurate.`
          );
          // Optionally update status back to 'failed' or handle appropriately
          // store.set(`${meetingPath}.transcriptStatus`, 'failed');
          // store.set(`${meetingPath}.transcriptError`, 'Transcript file missing.');
        }
      } catch (err: any) {
        console.error(`Error reading transcript file: ${result.path}`, err);
        result.error = `Error reading transcript file: ${err.message}`;
        // Optionally update status
      }
    }

    console.log(
      `Loaded transcript data for event: ${eventId}, status: ${result.status}`
    );
    return result;
  } catch (error) {
    console.error(`Error loading transcript data for event ${eventId}:`, error);
    return null;
  }
}

// --- Meeting Data (Summary) ---

/**
 * Save a summary using targeted updates.
 * @param eventId - Google Calendar event ID
 * @param summaryText - Summary text
 * @param modelUsed - Model used to generate summary
 */
export function saveSummary(
  eventId: string,
  summaryText: string,
  modelUsed: string
): void {
  if (!eventId) {
    console.error("Attempted to save summary with empty eventId.");
    return;
  }
  try {
    ensureMeetingDataExists(eventId); // Ensure parent object exists
    const summaryPath = `meetingData.${eventId}.summary`;
    const modelPath = `meetingData.${eventId}.summaryModel`;
    const lastUpdatedPath = `meetingData.${eventId}.lastUpdated`;

    store.set(summaryPath, summaryText);
    store.set(modelPath, modelUsed);
    store.set(lastUpdatedPath, Date.now());

    console.log(`Saved summary for meeting: ${eventId}`);
  } catch (error) {
    console.error(`Error saving summary for event ${eventId}:`, error);
  }
}

/**
 * Load a summary.
 * @param eventId - Google Calendar event ID
 * @returns Summary data or null if meeting not found.
 */
export function loadSummary(eventId: string): {
  summary: string;
  model: string;
  timestamp?: number; // Changed from string to number for consistency
} | null {
  if (!eventId) {
    console.error("Attempted to load summary with empty eventId.");
    return null;
  }
  try {
    const meetingPath = `meetingData.${eventId}`;
    if (!store.has(meetingPath)) {
      console.log(
        `No meeting data found for eventId ${eventId} during summary load.`
      );
      return null;
    }

    const summary = store.get(`${meetingPath}.summary`, "");
    const model = store.get(`${meetingPath}.summaryModel`, "unknown");
    const timestamp = store.get(`${meetingPath}.lastUpdated`, 0);

    console.log(`Loaded summary for event: ${eventId}`);
    return {
      summary: summary,
      model: model,
      timestamp: timestamp,
    };
  } catch (error) {
    console.error(`Error loading summary for event ${eventId}:`, error);
    return null;
  }
}

// --- Meeting Data (Recording Paths) ---

/**
 * Save recording paths using targeted updates.
 * @param eventId - Google Calendar event ID
 * @param paths - Recording file paths
 */
export function saveRecordingPaths(
  eventId: string,
  paths: { system?: string; mic?: string; mixed?: string }
): void {
  if (!eventId) {
    console.error("Attempted to save recording paths with empty eventId.");
    return;
  }
  try {
    ensureMeetingDataExists(eventId);
    const pathsPath = `meetingData.${eventId}.recordingPaths`;
    const lastUpdatedPath = `meetingData.${eventId}.lastUpdated`;

    store.set(pathsPath, paths);
    store.set(lastUpdatedPath, Date.now());
    console.log(`Saved recording paths for meeting: ${eventId}`);
  } catch (error) {
    console.error(`Error saving recording paths for event ${eventId}:`, error);
  }
}

/**
 * Load recording paths.
 * @param eventId - Google Calendar event ID
 * @returns Recording paths or null.
 */
export function loadRecordingPaths(eventId: string): {
  system?: string;
  mic?: string;
  mixed?: string;
} | null {
  if (!eventId) {
    console.error("Attempted to load recording paths with empty eventId.");
    return null;
  }
  try {
    const pathsPath = `meetingData.${eventId}.recordingPaths`;
    const paths = store.get(pathsPath, null);
    console.log(`Loaded recording paths for event: ${eventId}`);
    return paths;
  } catch (error) {
    console.error(`Error loading recording paths for event ${eventId}:`, error);
    return null;
  }
}

// --- Utility Functions ---

/**
 * Load all data for a specific meeting.
 * @param eventId - Google Calendar event ID
 * @returns Meeting data or null if not found.
 */
export function loadMeetingData(eventId: string): MeetingData | null {
  if (!eventId) {
    console.error("Attempted to load meeting data with empty eventId.");
    return null;
  }
  try {
    const meetingPath = `meetingData.${eventId}`;
    const data = store.get(meetingPath, null);
    console.log(`Loaded all data for meeting: ${eventId}`);
    return data;
  } catch (error) {
    console.error(`Error loading meeting data for event ${eventId}:`, error);
    return null;
  }
}

/**
 * Get list of all saved meetings with basic info, sorted by last updated.
 * @returns Array of meeting info objects.
 */
export function getAllMeetings(): Array<{
  id: string;
  title: string;
  date: string;
  hasNotes: boolean;
  hasTranscript: boolean;
  hasSummary: boolean;
  lastUpdated: number;
}> {
  try {
    const meetingData = store.get("meetingData", {});
    return Object.entries(meetingData)
      .map(([id, data]) => {
        const eventDetails = data.eventDetails || {};
        const meeting = data as MeetingData; // Type assertion for easier access
        return {
          id,
          title: eventDetails.summary || "Untitled Meeting",
          date:
            eventDetails.start?.dateTime ||
            eventDetails.start?.date ||
            "Unknown date",
          hasNotes: !!meeting.notes && meeting.notes.trim().length > 0, // Check if notes have content
          hasTranscript:
            meeting.transcriptStatus === "completed" &&
            !!meeting.transcriptPath,
          hasSummary: !!meeting.summary && meeting.summary.trim().length > 0, // Check if summary has content
          lastUpdated: meeting.lastUpdated || 0,
        };
      })
      .sort((a, b) => b.lastUpdated - a.lastUpdated); // Sort by last updated, newest first
  } catch (error) {
    console.error("Error getting all meetings:", error);
    return []; // Return empty array on error
  }
}

/**
 * Delete all data for a specific meeting, including associated files.
 * @param eventId - Google Calendar event ID
 * @returns {boolean} Success status.
 */
export function deleteMeetingData(eventId: string): boolean {
  if (!eventId) {
    console.error("Attempted to delete meeting data with empty eventId.");
    return false;
  }
  try {
    const meetingPath = `meetingData.${eventId}`;
    if (!store.has(meetingPath)) {
      console.log(`No meeting data found to delete for event: ${eventId}`);
      return false; // Nothing to delete
    }

    const meetingData = store.get(meetingPath) as MeetingData;

    // Delete transcript file if it exists
    if (meetingData.transcriptPath) {
      try {
        if (fs.existsSync(meetingData.transcriptPath)) {
          fs.unlinkSync(meetingData.transcriptPath);
          console.log(`Deleted transcript file: ${meetingData.transcriptPath}`);
        }
      } catch (err) {
        console.error(
          `Error deleting transcript file: ${meetingData.transcriptPath}`,
          err
        );
        // Decide if failure to delete file should stop the whole process
      }
    }

    // Delete recording files if paths exist (add similar logic if needed)
    // if (meetingData.recordingPaths?.mixed && fs.existsSync(meetingData.recordingPaths.mixed)) { ... }

    // Delete meeting data from store
    store.delete(meetingPath as any); // Type assertion to bypass type checking
    console.log(`Deleted meeting data object for: ${eventId}`);
    return true;
  } catch (err) {
    console.error(`Error deleting meeting data for event ${eventId}:`, err);
    return false;
  }
}

// --- Transcription Queue State (Example - Adapt as needed) ---

export function saveTranscriptionQueueState(queueState: any): void {
  try {
    store.set("transcriptionQueueState", queueState);
    console.log("Saved transcription queue state");
  } catch (error) {
    console.error("Error saving transcription queue state:", error);
  }
}

export function loadTranscriptionQueueState(): any {
  try {
    const state = store.get("transcriptionQueueState", null);
    console.log("Loaded transcription queue state");
    return state;
  } catch (error) {
    console.error("Error loading transcription queue state:", error);
    return null;
  }
}

// --- Store Management ---

/**
 * Clear all data (use with caution!).
 */
export function clearAllData(): void {
  try {
    // Optionally delete files in transcriptsDir before clearing the store
    // fs.rmSync(transcriptsDir, { recursive: true, force: true });
    // fs.mkdirSync(transcriptsDir); // Recreate directory
    store.clear();
    console.log("Cleared all stored data from electron-store.");
  } catch (error) {
    console.error("Error clearing all data:", error);
  }
}

// Export the raw store instance for advanced usage or debugging if needed
export { store };
