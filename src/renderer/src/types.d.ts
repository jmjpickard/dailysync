export interface IElectronAPI {
  ipcRenderer: {
    send: (channel: string, ...args: any[]) => void;
    on: (channel: string, listener: (...args: any[]) => void) => () => void;
    once: (channel: string, listener: (...args: any[]) => void) => void;
    invoke: (channel: string, ...args: any[]) => Promise<any>;
  };
}

export interface CalendarEvent {
  id: string;
  summary?: string;
  start?: {
    dateTime?: string;
    date?: string;
  };
  end?: {
    dateTime?: string;
    date?: string;
  };
  description?: string;
  attendees?: Array<{ email: string; responseStatus?: string }>;
  hangoutLink?: string;
  location?: string;
}

export interface AudioDevice {
  id: string;
  name: string;
}

export type TranscriptionStatus =
  | "idle"
  | "queued"
  | "mixing"
  | "transcribing"
  | "completed"
  | "failed";

export interface TranscriptionState {
  eventId: string;
  status: TranscriptionStatus;
  progress?: number;
  transcript?: string;
  error?: string;
  jobId?: string;
}

export interface TranscriptionJob {
  jobId: string;
  eventId: string;
  status: TranscriptionStatus;
  progress?: number;
  transcript?: string;
  error?: string;
  createdAt: string;
  updatedAt: string;
}

export type LLMService = "ollama" | "claude" | "gemini";

export interface LLMSettings {
  ollamaUrl: string;
  ollamaModel: string;
  claudeKey: string;
  geminiKey: string;
}

export interface MeetingData {
  eventId: string;
  hasTranscript: boolean;
  hasNotes: boolean;
  transcript?: string;
  notes?: string;
  summary?: string;
  modelUsed?: string;
  lastUpdated?: string;
}

export interface AppSettings {
  googleRefreshToken?: string;
  llmSettings: LLMSettings;
  whisperModel?: string;
  defaultMicDevice?: string;
  theme?: "light" | "dark" | "system";
  autoStartRecording?: boolean;
  enableAutoTranscription?: boolean;
  [key: string]: any; // Allow for future extensibility
}

export type NotificationType = "success" | "error" | "info" | "warning";

export interface Notification {
  id: number;
  message: string;
  type: NotificationType;
  duration?: number;
}

export type SidebarView = "nav" | "settings" | "todos";

export type DialogType =
  | "alert"
  | "confirm"
  | "permission"
  | "serviceSelection"
  | null;

export interface DialogConfig {
  type: DialogType;
  title?: string;
  message?: string;
  data?: any;
  onConfirm?: () => void;
  onCancel?: () => void;
}

export interface ActiveDialog extends DialogConfig {
  id: number;
}

declare global {
  interface Window {
    electron: IElectronAPI;
    electronAPI: {
      getAuthStatus: () => Promise<{ authenticated: boolean; email?: string }>;
      onAuthStateChanged: (
        callback: (isAuthenticated: boolean) => void
      ) => () => void;
      fetchEvents: (
        date: string
      ) => Promise<CalendarEvent[] | { error: string }>;
      checkAuth: () => Promise<boolean>;
      loadAllSettings: () => Promise<AppSettings>;
      openPrivacySettings: (section: "microphone" | "screen") => Promise<void>;
      signOut: () => Promise<void>;
      startAuth: () => Promise<boolean>;
      invokeRenderer: (channel: string, ...args: any[]) => Promise<any>;
      checkScreenCaptureSupport: () => Promise<{ supported: boolean }>;
      generateSummary: (
        eventId: string,
        serviceType: LLMService
      ) => Promise<any>;
      loadSummary: (eventId: string) => Promise<any>;
      saveAllSettings: (settings: AppSettings) => Promise<any>;
      getAllMeetings: () => Promise<any>;
      loadTranscript: (eventId: string) => Promise<any>;
      exportFile: (options: {
        content: string;
        filename: string;
        title?: string;
      }) => Promise<any>;
      openMeetingUrl: (url: string) => Promise<void | { error: string }>;
      startRecording: (eventId: string) => Promise<any>;
      stopRecording: () => Promise<any>;
      onRecordingStateUpdate: (
        callback: (state: string, eventId?: string) => void
      ) => () => void;
      onRecordingError: (callback: (error: string) => void) => () => void;
      onTranscriptionUpdate: (callback: (job: any) => void) => () => void;
      onTranscriptionQueued: (callback: (job: any) => void) => () => void;
      loadMeetingNote: (eventId: string) => Promise<any>;
      saveMeetingNote: (eventId: string, noteContent: string) => Promise<any>;
      retryTranscription: (eventId: string, jobId?: string) => Promise<any>;
    };
  }
}
