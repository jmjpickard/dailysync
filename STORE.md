# Daily Sync - Zustand Store Documentation

This document explains the store structure and usage patterns for the Daily Sync application, which uses Zustand for state management.

## Store Structure

The store is organized into the following slices:

### Auth Slice
- `auth.isAuthenticated`: Boolean indicating if the user is authenticated
- `auth.isLoading`: Boolean indicating if auth is being loaded

### Calendar Slice
- `calendar.selectedDate`: Current selected date
- `calendar.selectedEventId`: Currently selected event ID
- `calendar.events`: Array of calendar events
- `calendar.isLoading`: Boolean indicating if calendar events are loading

### Meeting Detail Slice
- `meetingDetail.selectedEventId`: Currently selected event ID (duplicated for convenience)
- `meetingDetail.currentNotes`: Notes for the currently selected meeting
- `meetingDetail.currentTranscript`: Transcript for the currently selected meeting
- `meetingDetail.currentTranscriptStatus`: Status of the current transcript
- `meetingDetail.currentTranscriptProgress`: Progress percentage of transcription
- `meetingDetail.currentTranscriptError`: Any error message from transcription
- `meetingDetail.currentSummary`: Summary for the currently selected meeting
- `meetingDetail.currentSummaryModel`: The model used for the summary
- `meetingDetail.currentSummaryTimestamp`: When the summary was generated
- `meetingDetail.isDetailLoading`: Boolean indicating if meeting details are loading
- `meetingDetail.notesSaveStatus`: Status of notes saving ('idle', 'saving', 'saved', 'error')
- `meetingDetail.summaryGenerateStatus`: Status of summary generation ('idle', 'generating', 'generated', 'error')
- `meetingDetail.hasTranscriptForSummary`: Boolean indicating if there is a transcript available for summarization

### Recording Slice
- `recording.state`: Current recording state (from RECORDING_STATES enum)
- `recording.recordingEventId`: Event ID for the current recording
- `recording.audioDevices`: Available audio input devices
- `recording.selectedAudioDevice`: Currently selected audio device ID

### Transcription Slice
- `transcription.transcriptionJobs`: Map of transcription jobs by event ID

### Meetings Slice
- `meetings.data`: Cached meeting data by event ID
- `meetings.isLoading`: Boolean indicating if meetings data is loading

### Settings Slice
- `settings`: App settings object
- `saveSettings`: Function to save updated settings to storage

### UI Slice
- `ui.sidebarView`: Current sidebar view
- `ui.notifications`: Array of notification objects
- `ui.activeDialog`: Currently active dialog

### LLM Service Selection Slice
- `llmServiceSelection.selectedService`: Currently selected LLM service
- `llmServiceSelection.showServiceSelector`: Boolean to control service selector visibility

## Usage Examples

### Selecting State

You can select a specific part of the state to optimize performance:

```tsx
// Select a single value
const isAuthenticated = useStore(state => state.auth.isAuthenticated);

// Select multiple values with shallow comparison to prevent unnecessary rerenders
import { shallow } from 'zustand/shallow';

const { notes, saveStatus } = useStore(
  state => ({
    notes: state.meetingDetail.currentNotes,
    saveStatus: state.meetingDetail.notesSaveStatus
  }),
  shallow
);
```

### Dispatching Actions

The store provides actions that can be accessed directly:

```tsx
// Inside a component
const setSidebarView = useStore(state => state.setSidebarView);
const showNotification = useStore(state => state.showNotification);

// Usage
setSidebarView('settings');
showNotification('Settings saved successfully', 'success');
```

For imperative use outside of React components:

```tsx
import { useStore } from './store';

// Get the current state or dispatch an action imperatively
useStore.getState().setSelectedEventId('event-123');
```

## Performance Tips

1. **Select only what you need**: Only select the specific parts of state that your component uses to prevent unnecessary rerenders.

2. **Use shallow comparison**: When selecting multiple values, use the shallow comparison to prevent unnecessary rerenders.

```tsx
// GOOD: Use shallow for object selections
const { status, progress } = useStore(
  state => ({
    status: state.meetingDetail.currentTranscriptStatus,
    progress: state.meetingDetail.currentTranscriptProgress
  }),
  shallow
);

// BAD: This will cause unnecessary rerenders
const status = useStore(state => state.meetingDetail.currentTranscriptStatus);
const progress = useStore(state => state.meetingDetail.currentTranscriptProgress);
```

3. **Select actions individually**: When selecting actions, select them individually rather than as part of an object:

```tsx
// GOOD: Select actions individually
const showNotification = useStore(state => state.showNotification);
const hideDialog = useStore(state => state.hideDialog);

// BAD: This may cause unnecessary rerenders
const { showNotification, hideDialog } = useStore(
  state => ({
    showNotification: state.showNotification,
    hideDialog: state.hideDialog
  }),
  shallow
);
```

4. **Memoize components**: Use React.memo for components that may receive the same props frequently:

```tsx
const MyComponent = React.memo(({ eventId }) => {
  // Component implementation
});
```

## Middleware

This store uses the following middleware:

1. **devtools**: Enables Redux DevTools integration for debugging
2. **persist**: Persists selected parts of the state to sessionStorage

## Future Improvements

Future improvements to the store:
- Add slice-specific selectors for more granular state access
- Organization into separate files for better maintainability
- Add more robust error handling and recovery mechanisms