# Fix Notes Persistence Issues

## Problem Statement

The application has several issues with notes persistence:

1. Notes saved for meetings disappear when switching between meetings
2. Notes saved for one meeting appear in another meeting, despite being tied to unique event IDs
3. When viewing a transcript and then returning to the notes section, the notes disappear

## Root Causes

After analyzing the codebase, the following issues have been identified:

1. **Race Conditions in State Management**:

   - The Zustand store has race conditions when switching between meetings
   - Debounced save operations may save to the wrong meeting if the event ID changes during the debounce period
   - The store's cache (`meetings.data`) may not be properly synced with the current state

2. **Improper State Cleanup**:

   - When switching meetings, the previous meeting's state is not properly preserved
   - The `loadDataForSelectedEvent` function may overwrite state before pending saves complete

3. **Tab Switching Issues**:
   - The tab switching logic doesn't properly preserve the notes state
   - When switching back to the notes tab, the state may be reloaded incorrectly

## Implementation Plan

### 1. Fix Store State Management

#### 1.1. Improve Event ID Tracking

```typescript
// In src/renderer/src/store/index.ts

// Add a new field to track the event ID that is currently being edited
interface MeetingDetailSlice {
  selectedEventId: string | null;
  currentNotes: string;
  notesSaveStatus: "idle" | "saving" | "saved" | "error";
  // ... other fields
}

// Modify the updateNote function to include the event ID in the state update
updateNote: (content: string) => {
  const { selectedEventId, notesSaveStatus } = get().meetingDetail;
  if (!selectedEventId) return;

  // Update notes content immediately (optimistic update)
  set((state) => ({
    meetingDetail: {
      ...state.meetingDetail,
      currentNotes: content,
      // Store the event ID with the note content to prevent race conditions
      currentNotesEventId: selectedEventId,
    },
  }));

  // Reset status if needed
  if (notesSaveStatus === "saved" || notesSaveStatus === "error") {
    set((state) => ({
      meetingDetail: {
        ...state.meetingDetail,
        notesSaveStatus: "idle",
      },
    }));
  }

  // Trigger debounced save
  get().saveNoteDebounced();
},
```

#### 1.2. Fix the Save Note Function

```typescript
// In src/renderer/src/store/index.ts

// Modify the saveNote function to check the event ID
saveNote: async () => {
  const { currentNotes, selectedEventId, currentNotesEventId } = get().meetingDetail;

  // Only save if we have an event ID and it matches the one the notes were created for
  if (!selectedEventId || selectedEventId !== currentNotesEventId) {
    console.log(`Skipping save for notes: event ID mismatch or missing`);
    return;
  }

  try {
    // Set status to saving
    set((state) => ({
      meetingDetail: {
        ...state.meetingDetail,
        notesSaveStatus: "saving",
      },
    }));

    // Call the API to save the note
    const result = await window.electronAPI.saveMeetingNote(
      selectedEventId,
      currentNotes
    );

    // Check if the selected event is still the same after the async call
    if (get().meetingDetail.selectedEventId !== selectedEventId) {
      console.log(`Event changed during save, discarding result`);
      return;
    }

    if (result && result.success) {
      // Update notesSaveStatus to saved
      set((state) => ({
        meetingDetail: {
          ...state.meetingDetail,
          notesSaveStatus: "saved",
        },
        // Also update the meeting cache
        meetings: {
          ...state.meetings,
          data: {
            ...state.meetings.data,
            [selectedEventId]: {
              ...state.meetings.data[selectedEventId],
              notes: currentNotes,
              hasNotes: true,
            },
          },
        },
      }));

      // Reset status after a delay
      setTimeout(() => {
        // Check again if the selected event is still the same
        if (get().meetingDetail.selectedEventId === selectedEventId) {
          set((state) => ({
            meetingDetail: {
              ...state.meetingDetail,
              notesSaveStatus: "idle",
            },
          }));
        }
      }, 2000);
    } else {
      throw new Error(result?.error || "Failed to save note");
    }
  } catch (error: any) {
    console.error("Store: Error saving note:", error);

    // Only update state if the selected event is still the same
    if (get().meetingDetail.selectedEventId === selectedEventId) {
      set((state) => ({
        meetingDetail: {
          ...state.meetingDetail,
          notesSaveStatus: "error",
        },
      }));
      get().addNotification(
        `Error saving note: ${error.message || "Unknown error"}`,
        "error"
      );
    }
  }
},
```

### 2. Fix Meeting Switching Logic

#### 2.1. Improve the loadDataForSelectedEvent Function

```typescript
// In src/renderer/src/store/index.ts

loadDataForSelectedEvent: async () => {
  const idToLoad = get().meetingDetail.selectedEventId;
  if (!idToLoad) return;

  console.log(`Store: Loading data for event ${idToLoad}`);

  // Set loading state
  set((state) => ({
    meetingDetail: {
      ...state.meetingDetail,
      isDetailLoading: true,
    },
  }));

  try {
    // Cancel any pending debounced operations
    get().clearDebouncedFunctions();

    // Check if data is already in cache
    const cachedData = get().meetings.data[idToLoad];
    if (cachedData) {
      console.log(`Store: Found cached data for ${idToLoad}`);
      // Check if cache has complete data
      if (
        (cachedData.hasNotes && cachedData.notes) ||
        (cachedData.hasTranscript && cachedData.transcript)
      ) {
        // Use cached data to pre-populate meeting detail
        set((state) => ({
          meetingDetail: {
            ...state.meetingDetail,
            currentNotes: cachedData.notes || "",
            currentNotesEventId: idToLoad, // Store the event ID with the notes
            currentTranscript: cachedData.transcript || "",
            currentTranscriptStatus: cachedData.hasTranscript
              ? "completed"
              : "idle",
            hasTranscriptForSummary: cachedData.hasTranscript,
            currentSummary: cachedData.summary || "",
            currentSummaryModel: cachedData.modelUsed || "",
            currentSummaryTimestamp: cachedData.lastUpdated || "",
          },
        }));
      }
    }

    // Load meeting notes from storage
    const notesResult = await window.electronAPI.loadMeetingNote(idToLoad);

    // Check if selected event is still the same before updating state
    if (get().meetingDetail.selectedEventId === idToLoad) {
      set((state) => ({
        meetingDetail: {
          ...state.meetingDetail,
          currentNotes: notesResult || "",
          currentNotesEventId: idToLoad, // Store the event ID with the notes
          notesSaveStatus: "idle",
        },
        meetings: {
          ...state.meetings,
          data: {
            ...state.meetings.data,
            [idToLoad]: {
              ...state.meetings.data[idToLoad],
              eventId: idToLoad,
              notes: notesResult || "",
              hasNotes: !!notesResult,
            },
          },
        },
      }));
    }

    // Load transcript
    const transcriptResult = await window.electronAPI.loadTranscript(idToLoad);

    // Check if selected event is still the same before updating state
    if (get().meetingDetail.selectedEventId === idToLoad) {
      // Update transcript state
      // ... (existing transcript loading code)
    }

    // Load summary
    const summaryResult = await window.electronAPI.loadSummary(idToLoad);

    // Check if selected event is still the same before updating state
    if (get().meetingDetail.selectedEventId === idToLoad) {
      // Update summary state
      // ... (existing summary loading code)
    }
  } catch (error) {
    console.error(`Store: Error loading data for ${idToLoad}:`, error);
    if (get().meetingDetail.selectedEventId === idToLoad) {
      get().addNotification(
        `Error loading meeting data: ${error.message || "Unknown error"}`,
        "error"
      );
    }
  } finally {
    // Ensure we only update loading state if we're still working with the same event
    if (get().meetingDetail.selectedEventId === idToLoad) {
      set((state) => ({
        meetingDetail: {
          ...state.meetingDetail,
          isDetailLoading: false,
        },
      }));
    }
  }
},
```

### 3. Fix Tab Switching Logic

#### 3.1. Modify the TabContainer Component

```typescript
// In src/renderer/src/components/tabs/TabContainer.tsx

const TabContainer: React.FC<TabContainerProps> = ({
  activeTab,
  onTabChange,
  children,
}) => {
  // Get the current event ID from the store
  const selectedEventId = useStore(
    (state) => state.meetingDetail.selectedEventId
  );

  // Memoize the tab buttons to prevent unnecessary re-renders
  const tabButtons = useMemo(() => {
    return tabs.map((tab) => (
      <button
        key={tab.id}
        onClick={() => onTabChange(tab.id)}
        className={`
          whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm
          ${
            activeTab === tab.id
              ? "border-blue-500 text-blue-600"
              : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
          }
        `}
        aria-current={activeTab === tab.id ? "page" : undefined}
      >
        {tab.label}
      </button>
    ));
  }, [activeTab, onTabChange]);

  // Save the current tab in the store when it changes
  useEffect(() => {
    if (selectedEventId) {
      // Store the active tab in the store to persist it across tab switches
      useStore.getState().setActiveTab(activeTab);
    }
  }, [activeTab, selectedEventId]);

  return (
    <div className="mt-4 flex-1 flex flex-col overflow-hidden">
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8" aria-label="Tabs">
          {tabButtons}
        </nav>
      </div>

      <div className="mt-4 flex-1 overflow-y-auto">{children}</div>
    </div>
  );
};
```

#### 3.2. Add Tab Persistence to the Store

```typescript
// In src/renderer/src/store/index.ts

// Add to the MeetingDetailSlice interface
interface MeetingDetailSlice {
  // ... existing fields
  activeTab: 'notes' | 'transcript' | 'summary';
}

// Add to the initial state
const initialMeetingDetailState: MeetingDetailSlice = {
  // ... existing fields
  activeTab: 'notes',
};

// Add a new action to set the active tab
setActiveTab: (tab: 'notes' | 'transcript' | 'summary') => {
  set((state) => ({
    meetingDetail: {
      ...state.meetingDetail,
      activeTab: tab,
    },
  }));
},
```

### 4. Fix the NotesTab Component

#### 4.1. Improve the NotesTab Component

```typescript
// In src/renderer/src/components/tabs/NotesTab.tsx

const NotesTab: React.FC<NotesTabProps> = ({ eventId }) => {
  // Get state from store using selective selectors
  const { notes, saveStatus, isLoading } = useStore(
    (state) => ({
      notes: state.meetingDetail.currentNotes,
      saveStatus: state.meetingDetail.notesSaveStatus,
      isLoading: state.meetingDetail.isDetailLoading,
    }),
    shallow
  );

  // Get actions individually to avoid rerenders
  const updateNote = useStore((state) => state.updateNote);
  const showNotification = useStore((state) => state.addNotification);

  // Ensure notes are loaded when the component mounts
  useEffect(() => {
    // If we have an event ID but no notes, try to load them
    if (eventId && !notes) {
      useStore.getState().loadDataForSelectedEvent();
    }
  }, [eventId, notes]);

  // Memoize event handlers to prevent unnecessary re-renders
  const handleNotesInputChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      updateNote(e.target.value);
    },
    [updateNote]
  );

  // ... rest of the component
};
```

### 5. Fix the DetailPane Component

#### 5.1. Improve the DetailPane Component

```typescript
// In src/renderer/src/components/DetailPane.tsx

const DetailPane: React.FC<DetailPaneProps> = ({
  selectedEventId,
  isAuthenticated,
  showNotification,
}) => {
  // Get the active tab from the store
  const activeTab = useStore((state) => state.meetingDetail.activeTab);

  // Get the setActiveTab action
  const setActiveTab = useStore((state) => state.setActiveTab);

  // Handle tab change
  const handleTabChange = useCallback(
    (tab: "notes" | "transcript" | "summary") => {
      setActiveTab(tab);
    },
    [setActiveTab]
  );

  // Load data when the selected event changes
  useEffect(() => {
    if (selectedEventId) {
      useStore.getState().loadDataForSelectedEvent();
    }
  }, [selectedEventId]);

  // ... rest of the component
};
```

## Testing Plan

1. **Test Meeting Switching**:

   - Create notes for Meeting A
   - Switch to Meeting B
   - Switch back to Meeting A
   - Verify notes for Meeting A are still there
   - Verify notes for Meeting B are separate

2. **Test Tab Switching**:

   - Create notes for a meeting
   - Switch to the transcript tab
   - Switch back to the notes tab
   - Verify notes are still there

3. **Test Concurrent Operations**:

   - Start typing notes for Meeting A
   - Quickly switch to Meeting B before the debounced save completes
   - Verify notes for Meeting A are saved correctly
   - Verify notes for Meeting B are loaded correctly

4. **Test Error Handling**:
   - Simulate network errors during save operations
   - Verify the UI shows appropriate error messages
   - Verify the notes are not lost

## Implementation Steps

1. Update the store types to include the new fields
2. Modify the store implementation to fix the race conditions
3. Update the UI components to use the improved store
4. Add proper cleanup for debounced operations
5. Test the changes thoroughly

## Expected Outcomes

After implementing these changes, the following improvements should be observed:

1. Notes will persist correctly when switching between meetings
2. Notes will be correctly associated with their respective meetings
3. Notes will remain visible when switching between tabs
4. The application will handle race conditions gracefully
5. The user experience will be smoother with fewer data loss incidents
