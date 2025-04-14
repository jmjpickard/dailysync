interface IElectronAPI {
  // Authentication
  checkAuth: () => Promise<boolean>;
  startAuth: () => Promise<boolean>;
  getAuthStatus: () => Promise<{ authenticated: boolean; email: string }>;
  signOut: () => Promise<boolean>;
  onAuthStateChanged: (callback: (isAuthenticated: boolean) => void) => () => void;

  // Calendar
  fetchEvents: (dateString: string) => Promise<Array<CalendarEvent> | null | { error: string }>;
  openMeetingUrl: (url: string) => Promise<{ success: boolean } | { error: string }>;

  // Recording
  startRecording: (eventId: string) => Promise<{ success: boolean } | { error: string }>;
  stopRecording: () => Promise<{ success: boolean } | { error: string }>;
  onRecordingStateUpdate: (callback: (state: string, eventId?: string) => void) => () => void;
  onRecordingError: (callback: (error: string) => void) => () => void;
  getAudioDevices: () => Promise<Array<{ id: string; name: string }> | { error: string }>;
  checkScreenCaptureSupport: () => Promise<{ supported: boolean; reason: string | null }>;
  openPrivacySettings: (section: 'microphone' | 'screen') => Promise<void>;

  // Transcription
  getTranscriptionJobsByEvent: (eventId: string) => Promise<Array<TranscriptionJob>>;
  onTranscriptionQueued: (callback: (job: TranscriptionJob) => void) => () => void;
  onTranscriptionUpdate: (callback: (job: TranscriptionJob) => void) => () => void;
  loadTranscript: (eventId: string) => Promise<{ 
    success: boolean; 
    data: { 
      status: TranscriptionStatus; 
      text?: string; 
      error?: string;
      progress?: number;
    } 
  } | { error: string }>;
  saveTranscriptionResult: (eventId: string, status: 'completed' | 'failed', transcript?: string, error?: string) => Promise<{ success: boolean } | { error: string }>;
  retryTranscription: (eventId: string, jobId?: string) => Promise<{ success: boolean; jobId: string } | { error: string }>;

  // Notes
  loadMeetingNote: (eventId: string) => Promise<{ success: boolean; note: string } | { error: string }>;
  saveMeetingNote: (eventId: string, noteContent: string) => Promise<{ success: boolean } | { error: string }>;

  // Meeting Data
  getAllMeetings: () => Promise<{ success: boolean; meetings: Record<string, MeetingData> } | { error: string }>;
  saveMeetingDetails: (eventId: string, eventDetails: Partial<MeetingData>) => Promise<{ success: boolean } | { error: string }>;
  loadMeetingData: (eventId: string) => Promise<{ success: boolean; data: MeetingData } | { error: string }>;
  deleteMeetingData: (eventId: string) => Promise<{ success: boolean } | { error: string }>;

  // Summarization
  generateSummary: (eventId: string, serviceType: 'ollama' | 'claude' | 'gemini') => Promise<{ success: boolean; summary: string } | { success: false; error: string }>;
  loadSummary: (eventId: string) => Promise<{ 
    success: boolean; 
    data: { 
      summary: string; 
      modelUsed: string; 
      lastUpdated: string;
    } 
  } | { error: string }>;
  saveSummary: (eventId: string, summaryText: string, modelUsed: string) => Promise<{ success: boolean } | { error: string }>;

  // Settings
  loadAllSettings: () => Promise<{ success: boolean; settings: AppSettings } | { error: string }>;
  saveSetting: (key: string, value: unknown) => Promise<{ success: boolean } | { error: string }>;
  saveAllSettings: (settings: AppSettings) => Promise<{ success: boolean } | { error: string }>;
  saveLLMSettings: (settings: { ollamaUrl: string; ollamaModel: string; claudeKey: string; geminiKey: string }) => Promise<{ success: boolean } | { error: string }>;

  // Utils
  exportFile: (options: { content: string; filename: string; title?: string }) => Promise<{ success: boolean; path?: string } | { success: false; canceled?: boolean; error?: string }>;
}

declare global {
  interface Window {
    electronAPI: IElectronAPI;
  }
}