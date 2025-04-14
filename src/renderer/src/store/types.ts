import {
  CalendarEvent,
  AudioDevice,
  TranscriptionState,
  AppSettings,
  Notification,
  NotificationType,
  SidebarView,
  DialogConfig,
  ActiveDialog,
  LLMService,
  MeetingData,
} from "../types";
import { RECORDING_STATES } from "../constants";
import { DebouncedFunc } from "lodash";

// Define meeting detail state
export interface MeetingDetailState {
  selectedEventId: string | null;
  currentNotes: string;
  currentNotesEventId: string | null; // Track which event the notes belong to
  currentTranscript: string;
  currentTranscriptStatus: TranscriptionState["status"];
  currentTranscriptProgress: number;
  currentTranscriptError?: string;
  currentSummary: string;
  currentSummaryModel: string;
  currentSummaryTimestamp: string;
  isDetailLoading: boolean;
  isDataReadyForSelectedEvent: boolean; // <-- New Flag
  notesSaveStatus: "idle" | "saving" | "saved" | "error";
  summaryGenerateStatus: "idle" | "generating" | "generated" | "error";
  hasTranscriptForSummary: boolean;
  activeTab: "notes" | "transcript" | "summary"; // Track active tab
}

// Define LLM service selection state
export interface LLMServiceState {
  configuredServices: LLMService[];
  selectedService: LLMService | null;
  showServiceSelector: boolean;
}

// Define state slices
export interface AuthSlice {
  auth: {
    isAuthenticated: boolean;
    isLoading: boolean;
  };
}

export interface CalendarSlice {
  calendar: {
    selectedDate: Date;
    selectedEventId: string | null;
    events: CalendarEvent[];
    isLoading: boolean;
  };
}

export interface MeetingDetailSlice {
  meetingDetail: MeetingDetailState;
}

export interface RecordingSlice {
  recording: {
    state: RECORDING_STATES;
    recordingEventId: string | null;
    audioDevices: AudioDevice[];
    selectedAudioDevice: string | null;
  };
}

export interface TranscriptionSlice {
  transcription: {
    transcriptionJobs: Record<string, TranscriptionState>;
  };
}

export interface MeetingsSlice {
  meetings: {
    data: Record<string, MeetingData>;
    isLoading: boolean;
  };
}

export interface SettingsSlice {
  settings: AppSettings | null;
  saveSettings: (settings: AppSettings) => Promise<void>;
}

export interface UISlice {
  ui: {
    sidebarView: SidebarView;
    notifications: Notification[];
    activeDialog: ActiveDialog | null;
  };
}

export interface LLMServiceSlice {
  llm: LLMServiceState;
}

// Define all the actions
export interface UIActions {
  setSidebarView: (view: SidebarView) => void;
  addNotification: (
    message: string,
    type?: NotificationType,
    duration?: number
  ) => void;
  removeNotification: (id: number) => void;
  showDialog: (config: DialogConfig) => void;
  hideDialog: (id?: number) => void;
}

export interface CalendarActions {
  setSelectedDate: (date: Date) => void;
  setSelectedEventId: (id: string | null) => void;
  fetchEvents: (date?: Date) => Promise<void>;
}

export interface RecordingActions {
  setSelectedAudioDevice: (deviceId: string | null) => void;
  startRecording: (eventId: string) => Promise<void>;
  stopRecording: () => Promise<void>;
}

export interface MeetingDataActions {
  loadDataForSelectedEvent: () => Promise<void>;
  loadInitialData: () => Promise<void>;
  refreshMeetingCache: () => Promise<void>;
  updateNote: (content: string) => void;
  saveNote: (force?: boolean) => Promise<void>;
  saveNoteDebounced: DebouncedFunc<() => Promise<void>>;
  clearDebouncedFunctions: () => void;
  retryTranscription: () => Promise<void>;
  setActiveTab: (tab: "notes" | "transcript" | "summary") => void;
}

export interface LLMServiceActions {
  setSelectedLLMService: (service: LLMService | null) => void;
  toggleServiceSelector: (show?: boolean) => void;
  setConfiguredServices: (services: LLMService[]) => void;
  updateConfiguredLLMServices: () => void;
  generateSummary: (service?: LLMService) => Promise<void>;
  loadSummaryForSelectedEvent: () => Promise<void>;
}

export interface AuthActions {
  checkAuth: () => Promise<void>;
  signOut: () => Promise<void>;
  startAuth: () => Promise<void>;
  handleIpcAuthUpdate: (authState: boolean) => void;
}

export interface IPCListenerActions {
  initListeners: () => () => void;
  handleIpcTranscriptionUpdate: (job: TranscriptionState) => void;
  handleIpcTranscriptionQueued: (job: TranscriptionState) => void;
  handleIpcRecordingUpdate: (state: string, eventId?: string) => void;
  handleIpcRecordingError: (error: string) => void;
  synchronizeTranscriptionState: (job: TranscriptionState) => void;
}

// Define the main store interface
export type AppState = AuthSlice &
  CalendarSlice &
  MeetingDetailSlice &
  RecordingSlice &
  TranscriptionSlice &
  MeetingsSlice &
  SettingsSlice &
  UISlice &
  LLMServiceSlice &
  UIActions &
  CalendarActions &
  RecordingActions &
  LLMServiceActions &
  MeetingDataActions &
  AuthActions &
  IPCListenerActions;
