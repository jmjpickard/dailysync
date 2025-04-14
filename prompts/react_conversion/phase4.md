Objective: Set up shared state management using React Context API, including state to control sidebar content.

Context: We need to manage shared state like auth status, selected date/event, recording status, transcription progress, and also control what is displayed in the sidebar (e.g., main navigation, settings view).

Task:

1.  Define/update TypeScript types/interfaces in `src/renderer/src/types/index.ts`: Include `CalendarEvent`, `AudioDevice`, `TranscriptionState`, `LLMService` (from summarization), etc. Define an interface for `AppSettings` (e.g., API keys). Define the overall `AppState` interface, including potentially a `sidebarView: 'nav' | 'settings' | 'todos'` state.
2.  Define the `RECORDING_STATES` enum in `src/renderer/src/constants/index.ts`.
3.  Create `src/renderer/src/contexts/AppContext.tsx`:
    - Define the `AppState` interface.
    - Define action types/reducer (`appReducer`) to handle state updates (auth, events, selected items, transcriptions, settings, sidebar view).
    - Create `AppContext` and `AppProvider`.
    - In `AppProvider`, use `useReducer` and `useState`.
    - Initialize state: Default `selectedDate`, default `sidebarView` ('nav'). Fetch initial auth state (`window.electronAPI.checkAuth()`) and settings (`window.electronAPI.loadAllSettings()`) in `useEffect`.
    - Set up IPC listeners (using hooks from Stage 4) in `useEffect` to update context state based on main process events (`onAuthStateChanged`, `onRecordingStateUpdate`, etc.), ensuring cleanup.
    - Provide state values and update functions (e.g., `setSidebarView`, `saveSettings`, `dispatch`) via the `AppContext.Provider`.
4.  Wrap the contents of `src/renderer/src/App.tsx` with `<AppProvider>`.
5.  Create the custom hook `src/renderer/src/contexts/useAppContext.ts`.
