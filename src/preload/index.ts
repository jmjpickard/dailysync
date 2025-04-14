import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('electronAPI', {
  // Authentication
  checkAuth: () => ipcRenderer.invoke('google-auth-check'),
  startAuth: () => ipcRenderer.invoke('google-auth-start'),
  getAuthStatus: () => ipcRenderer.invoke('get-google-auth-status'),
  signOut: () => ipcRenderer.invoke('google-auth-signout'),
  onAuthStateChanged: (callback: (isAuthenticated: boolean) => void) => {
    const subscription = (_: any, isAuthenticated: boolean) => callback(isAuthenticated);
    ipcRenderer.on('google-auth-state-changed', subscription);
    return () => {
      ipcRenderer.removeListener('google-auth-state-changed', subscription);
    };
  },

  // Calendar
  fetchEvents: (dateString: string) => ipcRenderer.invoke('fetch-events', dateString),
  openMeetingUrl: (url: string) => ipcRenderer.invoke('open-meeting-url', url),

  // Recording
  startRecording: (eventId: string) => ipcRenderer.invoke('start-recording', eventId),
  stopRecording: () => ipcRenderer.invoke('stop-recording'),
  onRecordingStateUpdate: (callback: (state: string, eventId?: string) => void) => {
    const subscription = (_: any, state: string, eventId?: string) => callback(state, eventId);
    ipcRenderer.on('recording-state-update', subscription);
    return () => {
      ipcRenderer.removeListener('recording-state-update', subscription);
    };
  },
  onRecordingError: (callback: (error: string) => void) => {
    const subscription = (_: any, error: string) => callback(error);
    ipcRenderer.on('recording-error', subscription);
    return () => {
      ipcRenderer.removeListener('recording-error', subscription);
    };
  },
  getAudioDevices: () => ipcRenderer.invoke('get-audio-devices'),
  checkScreenCaptureSupport: () => ipcRenderer.invoke('check-screencapturekit-support'),
  openPrivacySettings: (section: 'microphone' | 'screen') => ipcRenderer.invoke('open-privacy-settings', section),

  // Transcription
  getTranscriptionJobsByEvent: (eventId: string) => ipcRenderer.invoke('get-transcription-jobs-by-event', eventId),
  onTranscriptionQueued: (callback: (job: any) => void) => {
    const subscription = (_: any, job: any) => callback(job);
    ipcRenderer.on('transcription-queued', subscription);
    return () => {
      ipcRenderer.removeListener('transcription-queued', subscription);
    };
  },
  onTranscriptionUpdate: (callback: (job: any) => void) => {
    const subscription = (_: any, job: any) => callback(job);
    ipcRenderer.on('transcription-update', subscription);
    return () => {
      ipcRenderer.removeListener('transcription-update', subscription);
    };
  },
  loadTranscript: (eventId: string) => ipcRenderer.invoke('load-transcript', eventId),
  saveTranscriptionResult: (eventId: string, status: 'completed' | 'failed', transcript?: string, error?: string) => 
    ipcRenderer.invoke('save-transcription-result', eventId, status, transcript, error),
  retryTranscription: (eventId: string, jobId?: string) => ipcRenderer.invoke('retry-transcription', eventId, jobId),

  // Notes
  loadMeetingNote: (eventId: string) => ipcRenderer.invoke('load-meeting-note', eventId),
  saveMeetingNote: (eventId: string, noteContent: string) => ipcRenderer.invoke('save-meeting-note', eventId, noteContent),

  // Meeting Data
  getAllMeetings: () => ipcRenderer.invoke('get-all-meetings'),
  saveMeetingDetails: (eventId: string, eventDetails: any) => ipcRenderer.invoke('save-meeting-details', eventId, eventDetails),
  loadMeetingData: (eventId: string) => ipcRenderer.invoke('load-meeting-data', eventId),
  deleteMeetingData: (eventId: string) => ipcRenderer.invoke('delete-meeting-data', eventId),

  // Summarization
  generateSummary: (eventId: string, serviceType: 'ollama' | 'claude' | 'gemini') => 
    ipcRenderer.invoke('generate-summary', eventId, serviceType),
  loadSummary: (eventId: string) => ipcRenderer.invoke('load-summary', eventId),
  saveSummary: (eventId: string, summaryText: string, modelUsed: string) => 
    ipcRenderer.invoke('save-summary', eventId, summaryText, modelUsed),

  // Settings
  loadAllSettings: () => ipcRenderer.invoke('load-all-settings'),
  saveSetting: (key: string, value: any) => ipcRenderer.invoke('save-setting', key, value),
  saveAllSettings: (settings: any) => ipcRenderer.invoke('save-all-settings', settings),
  saveLLMSettings: (settings: { ollamaUrl: string; ollamaModel: string; claudeKey: string; geminiKey: string }) => 
    ipcRenderer.invoke('save-llm-settings', settings),

  // Utils
  exportFile: (options: { content: string; filename: string; title?: string }) => 
    ipcRenderer.invoke('export-file', options),
})