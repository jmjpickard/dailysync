Objective: Implement the Record/Stop meeting functionality and visual indicators.

Context: Users need to record meetings via a button in the Detail Pane. The recording state is managed globally in `AppContext` (updated via the `onRecordingStateUpdate` IPC listener). We need to connect the UI buttons and display indicators.

Task:

1.  **Update `src/renderer/src/components/DetailPane/ActionButtons.tsx`:**
    - Accept `event` (`CalendarEvent`) as a prop.
    - Use `useAppContext` to get `recordingState`, `activeRecordingEventId`, `startRecordingForEvent`, and `stopRecording`.
    - Find the "Record & Transcribe" button (or create it).
    - Determine the button's text, disabled state, and appearance based on the `recordingState` (similar logic to `updateRecordButtonState` in `renderer.ts`, using `RECORDING_STATES` enum). Apply Tailwind classes for different states (e.g., red background when recording).
    - Set the button's `onClick` handler:
      - If `recordingState` indicates recording is active, call `stopRecording()`.
      - If idle/ready, call `startRecordingForEvent(event.id)`. Ensure the button is disabled if no event is selected.
2.  **Update `src/renderer/src/components/EventList/EventListItem.tsx`:**
    - Use `useAppContext` to get `recordingState` and `activeRecordingEventId`.
    - Conditionally render a recording indicator (e.g., a red dot icon/emoji) if `recordingState` is `RECORDING` _and_ the `activeRecordingEventId` matches the `event.id` passed to this component's props.
    - Style the indicator using Tailwind CSS.
