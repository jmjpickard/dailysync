// storageTypes.ts
// Defines the TypeScript interfaces used for structuring data in electron-store.

/**
 * Defines the structure for application settings.
 */
export interface Settings {
  googleRefreshToken?: string; // Optional Google Refresh Token for API access
  llmApiKeys?: {
    // Optional API keys for different Large Language Models
    ollama?: string;
    claude?: string;
    gemini?: string;
  };
  whisperModel?: string; // Selected Whisper model for transcription
  defaultMicDevice?: string; // ID of the default microphone device
  [key: string]: any; // Allows for additional, unforeseen settings
}

/**
 * Defines the structure for details imported from a Google Calendar event.
 */
export interface EventDetails {
  id: string; // Unique Google Calendar event ID
  summary?: string; // Event title/summary
  start?: {
    // Event start time/date
    dateTime?: string; // ISO 8601 format if time is included
    date?: string; // YYYY-MM-DD format if all-day event
  };
  end?: {
    // Event end time/date
    dateTime?: string;
    date?: string;
  };
  description?: string; // Event description (often contains meeting links etc.)
  attendees?: Array<{ email: string; responseStatus?: string }>; // List of attendees
  hangoutLink?: string; // Google Meet link, if available
  location?: string; // Physical location or video call link
  [key: string]: any; // Allows for other properties from the Google Calendar API event object
}

/**
 * Defines the structure for all data associated with a single meeting (event).
 */
export interface MeetingData {
  eventDetails: EventDetails; // Details imported from the calendar event
  notes?: string; // User-entered notes for the meeting
  transcriptPath?: string; // File system path to the saved transcript text file
  transcriptStatus?:
    | "queued"
    | "mixing"
    | "transcribing"
    | "completed"
    | "failed"; // Current status of the audio transcription process
  transcriptProgress?: number; // Transcription progress percentage (0-100)
  transcriptError?: string; // Error message if transcription failed
  summary?: string; // LLM-generated summary of the transcript/notes
  summaryModel?: string; // Identifier for the LLM used to generate the summary
  recordingPaths?: {
    // File system paths to saved audio recordings
    system?: string; // Path to system audio recording
    mic?: string; // Path to microphone audio recording
    mixed?: string; // Path to mixed audio recording (if applicable)
  };
  lastUpdated?: number; // Timestamp (milliseconds since epoch) when this meeting's data was last modified
}

/**
 * Defines the overall schema for the electron-store.
 */
export interface StoreSchema {
  settings: Settings; // Application-wide settings
  meetingData: {
    [eventId: string]: MeetingData; // An object where keys are event IDs and values are the corresponding MeetingData
  };
  transcriptionQueueState?: any; // Optional: Persisted state for the transcription queue (structure depends on implementation)
}
