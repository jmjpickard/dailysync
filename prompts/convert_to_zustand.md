# Zustand Refactoring Plan: Prompts for AI Agent

This document outlines a series of prompts to guide an AI agent in refactoring the Daily Sync application's frontend state management from a React Context/useReducer system to Zustand.

---

## Prompt 1: Store Setup & State Definition

**Goal:** Install Zustand, define the primary store structure (`AppState` interface), initialize the store with basic state slices, implement simple synchronous actions, and set up persistence middleware.

**Context:**

- We are replacing the `useReducer` and `Context` pattern found in the provided `AppContext.tsx`.
- The state structure should encompass auth, settings, calendar selection, recording status, UI state (notifications, dialogs, sidebar), the global transcription jobs map, and detailed state for the _currently selected_ meeting (notes, transcript, summary, related statuses).
- Refer to the `AppState` interface in the original `AppContext.tsx` for initial state slices.

**Instructions:**

1.  Ensure Zustand is installed (`npm install zustand` or `yarn add zustand`).
2.  Create a new file (e.g., `src/store/index.ts`).
3.  Define a TypeScript interface `AppState` within `store/index.ts` that includes slices for:
    - `auth` (`isAuthenticated`, `isAuthLoading`)
    - `calendar` (`selectedDate`, `selectedEventId`, `calendarEvents`, `isCalendarLoading`)
    - `meetingDetail` (or similar name):
      - `currentNotes: string`
      - `currentTranscript: string`
      - `currentTranscriptStatus: TranscriptionState['status']`
      - `currentTranscriptProgress: number`
      - `currentTranscriptError?: string`
      - `currentSummary: string`
      - `currentSummaryModel: string`
      - `currentSummaryTimestamp: string`
      - `isDetailLoading: boolean`
      - `notesSaveStatus: 'idle' | 'saving' | 'saved' | 'error'`
      - `summaryGenerateStatus: 'idle' | 'generating' | 'generated' | 'error'`
      - `hasTranscriptForSummary: boolean`
    - `recording` (`recordingState`, `recordingEventId`, `audioDevices`, `selectedAudioDevice`)
    - `transcription` (`transcriptionJobs: Record<string, TranscriptionState>`)
    - `meetings` (`data: Record<string, MeetingData>`) - Add this to maintain a cache of meeting data by event ID
    - `settings` (`settings: AppSettings | null`)
    - `ui` slice:
      - `sidebarView: SidebarView`
      - `notifications: Notification[]`
      - `activeDialog: ActiveDialog | null` 
      - `llmServiceSelection: { selectedService: LLMService | null, showServiceSelector: boolean }` - Add this for LLM service selection UI state
4.  Define the corresponding action interfaces or function signatures within `AppState` (e.g., `setSelectedEventId: (id: string | null) => void;`, `updateNote: (content: string) => void;`, etc.).
5.  Set up persistence middleware for relevant parts of the state that need to be persisted between app sessions:
    ```typescript
    import { create } from 'zustand';
    import { persist, createJSONStorage } from 'zustand/middleware';
    
    export const useStore = create<AppState>()(
      persist(
        (set, get) => ({
          // ...initial state and actions
        }),
        {
          name: 'daily-sync-storage',
          storage: createJSONStorage(() => sessionStorage), // Or custom storage
          partialize: (state) => ({ 
            // Only persist selected parts of the state
            settings: state.settings,
            // etc.
          }),
        }
      )
    );
    ```
6.  Implement the initial state values (similar to `initialState` in `AppContext.tsx`).
7.  Implement the _synchronous_ actions derived from the old reducer/context helpers:
    - `setSidebarView`
    - `addNotification`, `removeNotification` (handle ID generation and timeouts if desired within the action)
    - `showDialog`, `hideDialog`
    - `setSelectedDate`
    - `setSelectedAudioDevice`
    - `setLLMServiceSelection`, `toggleServiceSelector` (for managing LLM service selection)
    - (Placeholders for async actions - to be implemented in next prompts)

**Considerations:**

- Use `set((state) => ({ ... }))` for immutable updates.
- `get()` can be used within actions to access current state.
- Consider organizing the store into slices with separate files for better maintainability.
- Make sure to define interfaces for `MeetingData` and other complex types used in the store.

---

## Prompt 2: Store Async Actions - Data Loading & Event Selection

**Goal:** Implement the core asynchronous logic for selecting an event and loading its associated detailed data (notes, transcript, summary), with appropriate caching and synchronization with Electron storage.

**Context:**

- The store defined in Prompt 1.
- Electron APIs: `loadMeetingNote(eventId)`, `loadTranscript(eventId)`, `loadSummary(eventId)`, `getAllMeetings()`.
- The need to handle race conditions when `selectedEventId` changes quickly.
- The need to maintain a cache of meeting data by event ID.

**Instructions:**

1.  Implement the `setSelectedEventId(id)` action:
    - It should update `selectedEventId` in the state using `set`.
    - If `id` is not null:
      - Reset the `meetingDetail` state slice (clear `currentNotes`, `currentTranscript`, etc.).
      - Set `isDetailLoading: true`.
      - Call an internal async action `loadDataForSelectedEvent()`.
    - If `id` is null:
      - Reset the `meetingDetail` state slice.
      - Set `isDetailLoading: false`.

2.  Implement the internal async action `loadDataForSelectedEvent()`:
    - Get the _current_ `selectedEventId` using `get().selectedEventId`. Store this as `idToLoad`. If null, return.
    - Check if the data is already in the cache (`get().meetings.data[idToLoad]`). If yes and it's complete enough, use it to populate the current detail state and set `isDetailLoading: false`.
    - Use `try/catch/finally`. Inside `try`:
      - Call `await window.electronAPI.loadMeetingNote(idToLoad)`. **Before** calling `set` with the result, check if `get().selectedEventId === idToLoad`. If it matches:
        - Update `currentNotes` and `notesSaveStatus: 'idle'`.
        - Also update the cached data in `meetings.data[idToLoad]`.
      - Call `await window.electronAPI.loadTranscript(idToLoad)`. **Before** calling `set`, check if `get().selectedEventId === idToLoad`. If it matches:
        - Update `currentTranscript`, `currentTranscriptStatus`, etc., and `hasTranscriptForSummary`.
        - Also update the cached data in `meetings.data[idToLoad]`.
      - Call `await window.electronAPI.loadSummary(idToLoad)`. **Before** calling `set`, check if `get().selectedEventId === idToLoad`. If it matches:
        - Update `currentSummary`, `currentSummaryModel`, `currentSummaryTimestamp`.
        - Also update the cached data in `meetings.data[idToLoad]`.
    - Inside `finally`: **Before** calling `set`, check if `get().selectedEventId === idToLoad`. If it matches, set `isDetailLoading: false`. Handle any residual loading statuses if errors occurred mid-load.

3.  Implement `loadInitialData()`: 
    - Fetch initial settings (`loadAllSettings`) and check auth status (`checkAuth`), updating relevant state slices (`settings`, `auth`).
    - Fetch and cache all meetings data using `getAllMeetings()` to populate the `meetings.data` state slice.
    - Initialize any needed UI state (like `llmServiceSelection`) based on settings.

4.  Implement `refreshMeetingCache()`:
    - Call `window.electronAPI.getAllMeetings()`
    - Update the `meetings.data` state slice with the latest data
    - If the currently selected event ID exists in the new data, update the meeting detail state to reflect any changes

**Considerations:**

- The checks `get().selectedEventId === idToLoad` before `set` are critical for preventing race conditions.
- Update loading/error statuses appropriately within the actions.
- Use the meeting cache to reduce unnecessary API calls and improve performance.
- Make sure to update both the current detail state and the cached meeting data when changes occur.

---

## Prompt 3: Store Async Actions - Notes Editing & Debounced Saving

**Goal:** Implement optimistic updates for note editing and debounced saving logic _within the store_, ensuring proper synchronization with the meeting data cache.

**Context:**

- The store defined in Prompt 1 & 2.
- Electron API: `saveMeetingNote(eventId, content)`.
- Requirement: Debounce logic should reside in the store, not components.
- Need to update both the current meeting detail and the cached meeting data.

**Instructions:**

1.  Import a debounce utility (e.g., `import debounce from 'lodash.debounce';`).
2.  Implement the `updateNote(content)` action:
    - Uses `set` to update `currentNotes` immediately (optimistic update).
    - Resets `notesSaveStatus` to 'idle' if it was 'saved' or 'error'.
    - Calls a debounced version of the `saveNote` action (see next step).
3.  Define the `saveNote` async action:
    - Gets `currentNotes` and `selectedEventId` using `get()`. If no ID or notes haven't changed (optional check against a loaded state if needed), return.
    - Sets `notesSaveStatus: 'saving'`.
    - Calls `await window.electronAPI.saveMeetingNote(eventId, notes)`.
    - Handles the result:
      - If successful:
        - Update `notesSaveStatus` to 'saved'.
        - Update the cached meeting data in `meetings.data[eventId]`.
        - Add a `setTimeout` to reset 'saved' back to 'idle' after a delay, checking the `selectedEventId` again within the timeout callback.
      - If failed, set `notesSaveStatus` to 'error' and show a notification.
4.  Create the debounced function _within the store definition_ using the debounce utility, targeting the `saveNote` action:
    ```typescript
    // Example structure within create()
    saveNote: async () => { 
      const { currentNotes, selectedEventId } = get().meetingDetail;
      if (!selectedEventId) return;
      
      try {
        set(state => ({
          meetingDetail: { ...state.meetingDetail, notesSaveStatus: 'saving' }
        }));
        
        const result = await window.electronAPI.saveMeetingNote(selectedEventId, currentNotes);
        
        // Check if the selected event is still the same
        if (get().meetingDetail.selectedEventId !== selectedEventId) return;
        
        if (result.success) {
          // Update status
          set(state => ({
            meetingDetail: { ...state.meetingDetail, notesSaveStatus: 'saved' },
            // Also update the meeting cache
            meetings: {
              ...state.meetings,
              data: {
                ...state.meetings.data,
                [selectedEventId]: {
                  ...state.meetings.data[selectedEventId],
                  notes: currentNotes,
                  hasNotes: true
                }
              }
            }
          }));
          
          // Reset status after delay
          setTimeout(() => {
            // Check if the selected event is still the same
            if (get().meetingDetail.selectedEventId === selectedEventId) {
              set(state => ({
                meetingDetail: { ...state.meetingDetail, notesSaveStatus: 'idle' }
              }));
            }
          }, 2000);
        } else {
          throw new Error(result.error || 'Failed to save note');
        }
      } catch (error) {
        // Only update state if the selected event is still the same
        if (get().meetingDetail.selectedEventId === selectedEventId) {
          set(state => ({
            meetingDetail: { ...state.meetingDetail, notesSaveStatus: 'error' }
          }));
          get().showNotification(`Error saving note: ${error.message}`, 'error');
        }
      }
    },
    
    // Create debounced version
    saveNoteDebounced: debounce(async () => {
      await get().saveNote();
    }, 1000), // 1 second delay
    
    updateNote: (content) => {
      const { selectedEventId, notesSaveStatus } = get().meetingDetail;
      if (!selectedEventId) return;
      
      // Update notes content immediately (optimistic)
      set(state => ({ 
        meetingDetail: { ...state.meetingDetail, currentNotes: content } 
      }));
      
      // Reset status if needed
      if (notesSaveStatus === 'saved' || notesSaveStatus === 'error') {
        set(state => ({ 
          meetingDetail: { ...state.meetingDetail, notesSaveStatus: 'idle' } 
        }));
      }
      
      // Trigger debounced save
      get().saveNoteDebounced();
    },
    ```

5.  Add cleanup for the debounced functions to prevent memory leaks. Include a method to handle this:
    ```typescript  
    // Add to store
    clearDebouncedFunctions: () => {
      get().saveNoteDebounced.cancel();
      // Add other debounced functions as needed
    }
    ```

**Considerations:**

- Ensure the debounced function correctly calls the actual async `saveNote` action.
- Manage the `notesSaveStatus` lifecycle correctly.
- Call `clearDebouncedFunctions` in your app's cleanup/unmount logic to prevent memory leaks.
- Keep the cache of meeting data in sync with the current meeting detail state.
- Use try/catch blocks with error handling to show appropriate notifications to the user.

---

## Prompt 4: Store Async Actions - Summary & Transcription

**Goal:** Implement store actions for generating summaries and retrying transcriptions, integrating LLM service selection management.

**Context:**

- The store defined in previous prompts.
- Electron APIs: `generateSummary(eventId, service)`, `retryTranscription(eventId, jobId?)`.
- The need to manage LLM service selection UI state that was previously held in the SummaryTab component.

**Instructions:**

1.  Implement the LLM service selection actions:
   
   ```typescript
   // Add to AppState interface
   interface LLMServiceState {
     configuredServices: LLMService[];
     selectedService: LLMService | null;
     showServiceSelector: boolean;
   }
   
   // Helper actions for LLM service selection
   setConfiguredServices: (services: LLMService[]) => void;
   setSelectedLLMService: (service: LLMService) => void;
   toggleServiceSelector: (show?: boolean) => void;
   ```

2.  Add a method to update the configured LLM services based on settings:
   
   ```typescript
   updateConfiguredLLMServices: () => {
     const services: LLMService[] = [];
     const llmSettings = get().settings?.llmSettings;
     
     if (llmSettings) {
       // Check for Ollama configuration
       if (llmSettings.ollamaUrl && llmSettings.ollamaModel) {
         services.push('ollama');
       }
       
       // Check for Claude API key
       if (llmSettings.claudeKey) {
         services.push('claude');
       }
       
       // Check for Gemini API key
       if (llmSettings.geminiKey) {
         services.push('gemini');
       }
     }
     
     set({ llm: { ...get().llm, configuredServices: services } });
     
     // If no service is selected or selected is no longer configured
     const { selectedService } = get().llm;
     if (!selectedService || !services.includes(selectedService)) {
       // Default to first available, preferring Claude
       const defaultService = services.includes('claude') 
         ? 'claude' 
         : services.length > 0 ? services[0] : null;
         
       set({ llm: { ...get().llm, selectedService: defaultService } });
     }
   }
   ```

3.  Implement the `generateSummary(service?: LLMService)` async action:
    - Get `selectedEventId`. If null, return.
    - If service is not provided, use the currently selected service from state.
    - Set `summaryGenerateStatus: 'generating'`.
    - Close the service selector if it's open: `set(state => ({ llm: { ...state.llm, showServiceSelector: false } }))`.
    - Call `await window.electronAPI.generateSummary(eventId, service)`.
    - **Before** handling the result, check if `get().selectedEventId` still matches the `eventId` the action started with.
    - If successful and ID matches:
      - Call a specific internal action `loadSummaryForSelectedEvent()` to refresh the summary data.
      - Set status to 'generated', then 'idle' after a delay.
      - Update the cached meeting data in `meetings.data[eventId]`.
      - Show a success notification.
    - If failed and ID matches:
      - Set status to 'error'.
      - Show an error notification.

4.  Implement the `retryTranscription()` async action:
    - Get `selectedEventId`. If null, return.
    - Get the current job ID from the transcription jobs map if available.
    - Set `currentTranscriptStatus: 'queued'` (optimistic update).
    - Also update the transcription job in the transcription jobs map.
    - Call `await window.electronAPI.retryTranscription(eventId, jobId)`.
    - Handle potential immediate errors from the API call:
      - If an error occurs, set status to 'failed' in both meetingDetail and transcription jobs.
      - Show an error notification.
      - Note that successful updates will come through IPC listeners.

5.  Implement the helper action `loadSummaryForSelectedEvent()`:
    - Get `selectedEventId`. If null, return.
    - Call `await window.electronAPI.loadSummary(eventId)`.
    - If successful and the selected event hasn't changed:
      - Update `currentSummary`, `currentSummaryModel`, and `currentSummaryTimestamp`.
      - Update the cached meeting data in `meetings.data[eventId]`.

**Considerations:**

- Continue checking `selectedEventId` before applying results of async operations.
- Use the LLM service selection state to manage the UI previously handled in SummaryTab.
- Make sure both the meeting detail state and the transcription jobs map are updated when retry is called.
- Update the meeting cache when summary generation succeeds.
- Properly integrate notifications for success/error states.

---

## Prompt 5: Store - IPC Listener Handling

**Goal:** Implement comprehensive setup and handling logic for Electron IPC listeners within the store, ensuring synchronization between real-time updates, meeting detail state, and the meeting cache.

**Context:**

- The store defined previously.
- The listener pattern used in `AppContext` (`window.electronAPI.on...`).
- Listeners needed: `onTranscriptionUpdate`, `onTranscriptionQueued`, `onRecordingStateUpdate`, `onAuthStateChanged`, `onRecordingError`.
- The need to maintain consistency between the transcription job map, meeting detail state, and meeting data cache.

**Instructions:**

1.  Implement internal handler actions for each listener type:

    - `handleIpcTranscriptionUpdate(job)`:
      - Updates the `transcriptionJobs` map using `set`.
      - Crucially, it checks if `job.eventId === get().selectedEventId`. If yes:
        - Update the relevant `meetingDetail` slices (`currentTranscript`, `currentTranscriptStatus`, `currentTranscriptProgress`, `currentTranscriptError`, `hasTranscriptForSummary`).
        - If job status is 'completed' with a transcript, set `hasTranscriptForSummary` to true.
      - Always update the meeting cache in `meetings.data[job.eventId]` to reflect the latest transcript status.
      - If job status changes to 'completed', it should also trigger a refresh of the meeting cache.

    - `handleIpcTranscriptionQueued(job)`:
      - Similar to `handleIpcTranscriptionUpdate` but specifically for when jobs are initially queued.
      - Update both the transcription jobs map and meeting detail if it's the selected event.
      - Update the meeting cache for the event.

    - `handleIpcRecordingUpdate(state, eventId)`:
      - Updates the `recording` state slice.
      - If recording state changes to 'completed', it can trigger a refresh of the transcription state (as this typically means a new recording is available for transcription).

    - `handleIpcAuthUpdate(authState)`:
      - Updates the `auth` state slice.
      - If auth state changes (especially from false to true), it can trigger refreshing calendar events and meeting data.

    - `handleIpcRecordingError(error)`:
      - Calls the `showNotification` action.
      - Updates recording error state if needed.

2.  Implement the `initListeners()` action:
    - Inside this action, set up all the IPC listeners, storing their unsubscribe functions:
      ```typescript
      initListeners: () => {
        // Set up listener for transcription updates
        const unsubTranscriptionUpdate = window.electronAPI.onTranscriptionUpdate(
          job => get().handleIpcTranscriptionUpdate(job)
        );
        
        const unsubTranscriptionQueued = window.electronAPI.onTranscriptionQueued(
          job => get().handleIpcTranscriptionQueued(job)
        );
        
        const unsubRecordingUpdate = window.electronAPI.onRecordingStateUpdate(
          (state, eventId) => get().handleIpcRecordingUpdate(state, eventId)
        );
        
        const unsubAuthUpdate = window.electronAPI.onAuthStateChanged(
          authState => get().handleIpcAuthUpdate(authState)
        );
        
        const unsubRecordingError = window.electronAPI.onRecordingError(
          error => get().handleIpcRecordingError(error)
        );
        
        // Return a combined cleanup function
        return () => {
          unsubTranscriptionUpdate();
          unsubTranscriptionQueued();
          unsubRecordingUpdate();
          unsubAuthUpdate();
          unsubRecordingError();
        };
      }
      ```

3. Implement a helper method to ensure that transcription job updates propagate correctly to all parts of the state:

   ```typescript
   synchronizeTranscriptionState: (job: TranscriptionState) => {
     // Always update the transcription jobs map
     set(state => ({
       transcription: {
         ...state.transcription,
         jobs: {
           ...state.transcription.jobs,
           [job.eventId]: job
         }
       }
     }));
     
     // If this is the selected event, update meeting detail state too
     if (job.eventId === get().meetingDetail.selectedEventId) {
       set(state => ({
         meetingDetail: {
           ...state.meetingDetail,
           currentTranscriptStatus: job.status,
           currentTranscriptProgress: job.progress || 0,
           currentTranscriptError: job.error || undefined,
           hasTranscriptForSummary: job.status === 'completed' && !!job.transcript,
           ...(job.transcript && { currentTranscript: job.transcript })
         }
       }));
     }
     
     // Update the meeting cache regardless
     set(state => ({
       meetings: {
         ...state.meetings,
         data: {
           ...state.meetings.data,
           [job.eventId]: {
             ...state.meetings.data[job.eventId],
             hasTranscript: job.status === 'completed' && !!job.transcript,
             ...(job.transcript && { transcript: job.transcript })
           }
         }
       }
     }));
   }
   ```

**Considerations:**

- Ensure listeners correctly call store actions using `get()` to access the latest action references.
- The cleanup function returned by `initListeners` is essential to prevent memory leaks.
- Maintain consistency between the three representations of data: transcription jobs map, meeting detail state, and meeting data cache.
- Handle race conditions by always checking if the current selected event ID matches before updating detail state.
- Use the `synchronizeTranscriptionState` helper to ensure consistent updates across all relevant parts of the state.
- Remember that IPC listeners may be called at any time, including when different events are selected than when the job was started.

---

## Prompt 6: Integrate Store & Refactor App Initialization

**Goal:** Remove the old `AppProvider` and `useReducer` setup, initialize the Zustand store, and set up listeners at the application root, ensuring proper cleanup of all resources.

**Context:**

- The application's root component (e.g., `App.tsx`, `main.tsx`).
- The old `AppProvider` and its associated reducer/context code.
- The new Zustand store (`store.ts`).
- The need to properly clean up resources like debounced functions and IPC listeners.

**Instructions:**

1.  Identify the root component where `AppProvider` is currently used.
2.  Remove the `AppProvider` component wrapping your application.
3.  Remove the `useReducer` hook, the `appReducer` function, the `AppContext` creation, and the `AppProvider` component definition itself (likely from `AppContext.tsx`).
4.  In the root component (`App.tsx` or similar):

    - Import the Zustand store hook: `import useStore from './store';`
    - Add a `useEffect` hook that runs once on component mount with comprehensive initialization and cleanup:

      ```jsx
      useEffect(() => {
        const { 
          loadInitialData, 
          initListeners, 
          clearDebouncedFunctions,
          updateConfiguredLLMServices 
        } = useStore.getState();
        
        // Initial data loading
        loadInitialData().then(() => {
          // Once settings are loaded, initialize LLM services
          updateConfiguredLLMServices();
        });
        
        // Set up IPC listeners
        const cleanupListeners = initListeners();

        // Return a combined cleanup function
        return () => {
          // Clean up IPC listeners
          cleanupListeners();
          
          // Cancel any pending debounced operations
          clearDebouncedFunctions();
        };
      }, []);
      ```

5.  Add a global error boundary component to catch and handle runtime errors gracefully:

    ```jsx
    class ErrorBoundary extends React.Component {
      constructor(props) {
        super(props);
        this.state = { hasError: false, error: null };
      }

      static getDerivedStateFromError(error) {
        return { hasError: true, error };
      }

      componentDidCatch(error, errorInfo) {
        console.error("App error:", error, errorInfo);
        // Optional: Report to error tracking service
      }

      render() {
        if (this.state.hasError) {
          return (
            <div className="error-boundary">
              <h2>Something went wrong</h2>
              <p>The application encountered an unexpected error. Please restart.</p>
              <button 
                onClick={() => window.location.reload()}
                className="px-4 py-2 bg-blue-500 text-white rounded"
              >
                Reload Application
              </button>
            </div>
          );
        }

        return this.props.children;
      }
    }
    ```

6.  Wrap your application with the ErrorBoundary component:

    ```jsx
    function App() {
      // ...
      
      return (
        <ErrorBoundary>
          {/* Your app components */}
        </ErrorBoundary>
      );
    }
    ```

7.  Ensure the rest of your application renders correctly within this root component.

**Considerations:**

- This step fundamentally changes how global state is provided. Ensure all parts of the app previously relying on `AppContext` are updated in subsequent steps.
- The comprehensive cleanup in the `useEffect` return function is essential to prevent memory leaks.
- Adding an error boundary helps prevent the entire app from crashing if there are issues during the migration.
- Make sure to initialize LLM services after settings are loaded for correct configuration.

---

## Prompt 7: Refactor `DetailPane.tsx`

**Goal:** Modify `DetailPane` to connect to the Zustand store for its data and actions, removing internal state management for meeting details while maintaining component performance.

**Context:**

- The previously refactored `DetailPane.tsx` (which lifted state from tabs).
- The new Zustand store (`store.ts`).
- Need to optimize rendering performance while using the global store.

**Instructions:**

1.  Import the Zustand store hook and shallow comparison helper:
    ```jsx
    import useStore from '../store';
    import { shallow } from 'zustand/shallow';
    ```

2.  Remove local `useState` hooks for all meeting detail data that's now in the store:
    - `meeting`, `notesContent`, `initialNotesContent`, `notesSaveStatus`
    - `transcriptContent`, `transcriptStatus`, `transcriptProgress`, `transcriptError`, `transcriptLoadStatus`
    - `summaryContent`, `summaryModel`, `summaryTimestamp`, `summaryLoadStatus`, `summaryGenerateStatus`
    - `hasTranscriptForSummary`, `isLoadingMeeting`

3.  Remove local `useRef` hooks used for managing async context (like `currentEventIdRef`, `notesLoaded`) - the store handles this now with its checks to avoid race conditions.

4.  Remove `useEffect` hooks related to loading data (`loadAllMeetingData`) and debounced saving (`saveNotes`).

5.  Remove the local handler functions: `loadAllMeetingData`, `saveNotes`, `handleNotesChange`, `handleGenerateSummary`, `handleRetryTranscription`.

6.  Keep the `selectedEventId` prop coming from the parent component.

7.  Add a `useEffect` hook to tell the store when the selected event changes:
    ```jsx
    useEffect(() => {
      // Only update if selectedEventId actually changed
      if (selectedEventId !== useStore.getState().calendar.selectedEventId) {
        useStore.getState().setSelectedEventId(selectedEventId);
      }
    }, [selectedEventId]);
    ```

8.  Use granular Zustand selectors to optimize performance, selecting only what's needed:
    ```jsx
    // Select loading state - this will control showing loading spinner
    const isDetailLoading = useStore(state => state.meetingDetail.isDetailLoading);
    
    // Select active meeting details using shallow comparison to prevent unnecessary renders
    const meetingDetails = useStore(
      (state) => ({
        currentNotes: state.meetingDetail.currentNotes,
        currentTranscript: state.meetingDetail.currentTranscript,
        currentTranscriptStatus: state.meetingDetail.currentTranscriptStatus,
        currentTranscriptProgress: state.meetingDetail.currentTranscriptProgress,
        currentTranscriptError: state.meetingDetail.currentTranscriptError,
        currentSummary: state.meetingDetail.currentSummary,
        currentSummaryModel: state.meetingDetail.currentSummaryModel,
        currentSummaryTimestamp: state.meetingDetail.currentSummaryTimestamp,
        notesSaveStatus: state.meetingDetail.notesSaveStatus,
        summaryGenerateStatus: state.meetingDetail.summaryGenerateStatus,
        hasTranscriptForSummary: state.meetingDetail.hasTranscriptForSummary,
      }),
      shallow
    ); 
    
    // Select needed actions - only if they're used directly in this component
    const showNotification = useStore(state => state.showNotification);
    ```

9.  Keep local state only for UI concerns specific to `DetailPane`:
    ```jsx
    const [activeTab, setActiveTab] = useState('notes'); // Or whatever default tab
    ```

10. Update the rendering logic to use the data selected from the store:
    ```jsx
    // Show loading spinner if detail is loading
    if (isDetailLoading) {
      return <LoadingSpinner />;
    }
    
    // Main render with data from store
    return (
      <div className="detail-pane">
        <TabContainer activeTab={activeTab} onTabChange={setActiveTab}>
          <Tab id="notes" label="Notes">
            <NotesTab eventId={selectedEventId} />
          </Tab>
          <Tab id="transcript" label="Transcript">
            <TranscriptTab eventId={selectedEventId} />
          </Tab>
          <Tab id="summary" label="Summary">
            <SummaryTab eventId={selectedEventId} />
          </Tab>
        </TabContainer>
      </div>
    );
    ```

11. Pass only minimal necessary props down to the tab components:
    - The `eventId` for context (useful for export filenames).
    - Don't pass any data or callbacks that tabs can get directly from the store.

12. Optimize with React.memo if needed:
    ```jsx
    export default React.memo(DetailPane);
    ```

**Considerations:**

- `DetailPane` becomes much simpler, primarily orchestrating the `selectedEventId` change and rendering based on store state.
- Using `shallow` comparison is critical for preventing unnecessary re-renders when using object selectors.
- Use granular selectors for better performance - only select what you need.
- Look for any UI-specific state that should remain local to the component rather than going into the store.
- Consider using React.memo to prevent unnecessary re-renders of the DetailPane when parent components re-render.

---

## Prompt 8: Refactor Tab Components (`NotesTab`, `TranscriptTab`, `SummaryTab`)

**Goal:** Connect the individual tab components directly to the Zustand store, removing props previously drilled down from `DetailPane`, while ensuring optimized performance.

**Context:**

- The previously refactored tab components (`*-refactor-v1`).
- The new Zustand store (`store.ts`).
- The need to optimize performance and render efficiency.

**Instructions:**

1.  For each tab component (`NotesTab`, `TranscriptTab`, `SummaryTab`):

    - Import the Zustand store hook and shallow helper: 
      ```jsx
      import useStore from '../store';
      import { shallow } from 'zustand/shallow';
      ```
    
    - Remove props related to data content (`notes`, `transcript`, `summary`, `model`, etc.), statuses (`saveStatus`, `isLoading`, `isGenerating`, etc.), and callbacks (`onNotesChange`, `onGenerateSummary`, `onRetryTranscription`). Keep only the `eventId` prop for export filename generation and context.
    
    - Use properly optimized Zustand selectors to prevent unnecessary rerenders:

      ```jsx
      // NotesTab Example - Group related states with shallow comparison
      const { notes, saveStatus, isLoading } = useStore(
        (state) => ({
          notes: state.meetingDetail.currentNotes,
          saveStatus: state.meetingDetail.notesSaveStatus,
          isLoading: state.meetingDetail.isDetailLoading,
        }),
        shallow
      );
      
      // Get actions individually to avoid rerenders when other state changes
      const updateNote = useStore((state) => state.updateNote);
      const showNotification = useStore((state) => state.showNotification);

      // TranscriptTab Example - Group by data and status
      const transcriptData = useStore(
        (state) => ({
          transcript: state.meetingDetail.currentTranscript,
          status: state.meetingDetail.currentTranscriptStatus,
          progress: state.meetingDetail.currentTranscriptProgress,
          error: state.meetingDetail.currentTranscriptError,
        }),
        shallow
      );
      
      // Get actions individually
      const retryTranscription = useStore((state) => state.retryTranscription);
      const showNotification = useStore((state) => state.showNotification);

      // SummaryTab Example - Access LLM state and settings
      const summaryData = useStore(
        (state) => ({
          summary: state.meetingDetail.currentSummary,
          model: state.meetingDetail.currentSummaryModel,
          timestamp: state.meetingDetail.currentSummaryTimestamp,
          generateStatus: state.meetingDetail.summaryGenerateStatus,
          hasTranscript: state.meetingDetail.hasTranscriptForSummary,
        }),
        shallow
      );
      
      const llmState = useStore(
        (state) => ({
          configuredServices: state.llm.configuredServices,
          selectedService: state.llm.selectedService,
          showServiceSelector: state.llm.showServiceSelector,
        }),
        shallow
      );
      
      // Get actions individually
      const generateSummary = useStore((state) => state.generateSummary);
      const toggleServiceSelector = useStore((state) => state.toggleServiceSelector);
      const setSelectedLLMService = useStore((state) => state.setSelectedLLMService);
      const showNotification = useStore((state) => state.showNotification);
      ```

    - Update event handlers to call the actions obtained from the store directly:
      ```jsx
      // NotesTab example
      const handleNotesChange = (e) => {
        updateNote(e.target.value);
      };
      
      // TranscriptTab example
      const handleRetry = () => {
        retryTranscription();
      };
      
      // SummaryTab example
      const handleGenerateSummary = () => {
        if (llmState.configuredServices.length === 0) {
          showNotification("No LLM services configured. Please configure in Settings.", "error");
          return;
        }
        
        if (llmState.configuredServices.length === 1) {
          // Use the only available service
          generateSummary(llmState.configuredServices[0]);
        } else {
          // Show service selector
          toggleServiceSelector(true);
        }
      };
      
      const handleServiceSelect = (service) => {
        setSelectedLLMService(service);
        generateSummary(service);
      };
      ```
    
    - Remove all `useAppContext` usage as it's no longer needed.
    
    - Implement the LLM service selector dialog directly in the `SummaryTab` using the store state:
      ```jsx
      // LLM Service selector dialog in SummaryTab
      {llmState.showServiceSelector && (
        <div className="service-selector-modal">
          <h3>Select AI Service</h3>
          {llmState.configuredServices.map(service => (
            <button 
              key={service} 
              onClick={() => handleServiceSelect(service)}
              className={service === llmState.selectedService ? 'selected' : ''}
            >
              {service}
            </button>
          ))}
          <button onClick={() => toggleServiceSelector(false)}>Cancel</button>
        </div>
      )}
      ```

2.  For all tabs, optimize with React.memo if needed:

    ```jsx
    export default React.memo(NotesTab);
    export default React.memo(TranscriptTab);
    export default React.memo(SummaryTab);
    ```

3.  For SummaryTab, handle LLM service selection directly with the store:

    ```jsx
    // Inside SummaryTab component
    const handleGenerateClick = () => {
      if (summaryData.generateStatus === 'generating') return;
      
      // Trigger service selection or generate directly if only one service
      if (llmState.configuredServices.length === 1) {
        generateSummary(llmState.configuredServices[0]);
      } else if (llmState.configuredServices.length > 1) {
        toggleServiceSelector(true);
      } else {
        showNotification("No LLM services configured", "error");
      }
    };
    ```

**Considerations:**

- These components should become significantly simpler, focusing purely on rendering the state provided by the store and dispatching actions.
- Use shallow comparison to prevent unnecessary re-renders when working with object selectors.
- Consider extracting complex UI elements (like the service selector dialog) into separate components.
- Use React.memo for components that receive the same props frequently.
- Prefer selecting actions individually rather than including them in state objects with shallow comparison.
- For SummaryTab, the LLM service selection logic that was previously internal state now moves to the store.

---

## Prompt 9: Refactor Other Components & Cleanup

**Goal:** Update any remaining components that used `useAppContext` and remove obsolete code, ensuring a complete migration to Zustand.

**Context:**

- Any other components in the application that were using `useAppContext`.
- The old `AppContext.tsx` file and potentially the `useDebounce` hook file.
- Components that deal with calendar events, settings, auth state, and UI elements.

**Instructions:**

1.  Identify all components that were using `useAppContext`:
    - Search the codebase for `useAppContext` imports
    - Search for `useContext(AppContext)`
    - Look for components that access `state` or `dispatch` from context

2.  For event list and calendar related components:
    ```jsx
    // Before
    const { state, dispatch } = useAppContext();
    const { events, selectedDate, selectedEventId } = state.calendar;
    
    // After
    const events = useStore(state => state.calendar.events);
    const selectedDate = useStore(state => state.calendar.selectedDate);
    const selectedEventId = useStore(state => state.calendar.selectedEventId);
    const setSelectedDate = useStore(state => state.setSelectedDate);
    const setSelectedEventId = useStore(state => state.setSelectedEventId);
    ```

3.  For components handling auth:
    ```jsx
    // Before
    const { state } = useAppContext();
    const { isAuthenticated, isLoading } = state.auth;
    
    // After
    const isAuthenticated = useStore(state => state.auth.isAuthenticated);
    const isLoading = useStore(state => state.auth.isLoading);
    ```

4.  For UI-related components (notifications, modals, etc.):
    ```jsx
    // Before
    const { showNotification, showDialog, hideDialog } = useAppContext();
    
    // After
    const showNotification = useStore(state => state.showNotification);
    const showDialog = useStore(state => state.showDialog);
    const hideDialog = useStore(state => state.hideDialog);
    ```

5.  For settings components:
    ```jsx
    // Before
    const { state, saveSettings } = useAppContext();
    const { settings } = state;
    
    // After
    const settings = useStore(state => state.settings);
    const saveSettings = useStore(state => state.saveSettings);
    ```

6.  For recording interface components:
    ```jsx
    // Before
    const { state } = useAppContext();
    const { state: recordingState, audioDevices } = state.recording;
    
    // After
    const recordingState = useStore(state => state.recording.state);
    const audioDevices = useStore(state => state.recording.audioDevices);
    const startRecording = useStore(state => state.startRecording);
    const stopRecording = useStore(state => state.stopRecording);
    ```

7.  Update event selection:
    - Find any components that dispatch `SET_SELECTED_EVENT` and replace with:
    ```jsx
    // Before
    dispatch({ type: 'SET_SELECTED_EVENT', payload: eventId });
    
    // After
    useStore.getState().setSelectedEventId(eventId);
    // Or if used within component body:
    const setSelectedEventId = useStore(state => state.setSelectedEventId);
    // Then in handlers:
    setSelectedEventId(eventId);
    ```

8.  Cleanup:
    - Once all usages of `useAppContext` are removed, delete the `AppContext.tsx` file.
    - If the `useDebounce` hook is no longer used by any component (since debouncing is now in the store), delete its file.
    - Remove any imports from the deleted files.
    - Check for any remaining references to `AppContext`, `useAppContext`, or any of the action types from the old reducer.

9.  Add store devtools integration for easier debugging:
    ```typescript
    // In store.ts, add devtools middleware:
    import { devtools } from 'zustand/middleware';
    
    export const useStore = create<AppState>()(
      devtools(
        persist(
          (set, get) => ({
            // Store implementation
          }),
          {
            name: 'daily-sync-storage',
            // other persist options
          }
        )
      )
    );
    ```

10. Create a documentation file explaining the new store structure and usage patterns:
    - Create a `STORE.md` file in the project root
    - Document the store structure and main slices
    - Include examples of how to select state and dispatch actions
    - Include performance tips (shallow comparison, selective state access)

**Considerations:**

- This final step ensures the old system is fully removed and the application consistently uses Zustand for global state.
- Performance is critical - remind developers to use shallow comparison for object selectors.
- Ensure any component-specific logic remains in components and doesn't mistakenly move to the store.
- Devtools integration makes debugging state changes much easier during development.
- Documentation will help other developers understand the new state management approach.

---
