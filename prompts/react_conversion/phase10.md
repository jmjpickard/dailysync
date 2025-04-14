Objective: Implement the Transcription tab component within the Detail Pane.

Context: We need to display the status and content of meeting transcriptions, replacing the logic from `updateTranscriptTab` and related functions in `renderer.ts`. The `AppContext` manages the `transcriptionStates` (Map or Record mapping eventId to `TranscriptionState`).

Task:

1.  **Create `src/renderer/src/utils/transcriptUtils.ts` (or similar):**
    - Implement and export `formatTranscript(text: string): string` based on original `renderer.ts` (handling basic paragraphs).
    - Implement and export `formatTimestampedTranscript(text: string): string` based on original `renderer.ts` (handling `[HH:MM:SS.sss --> HH:MM:SS.sss]` lines, grouping). You might need a helper like `timeToSeconds`.
2.  **Create `src/renderer/src/components/DetailPane/TranscriptTab.tsx`:**
    - Accept `event` (`CalendarEvent`) as a prop.
    - Use `useAppContext` to get the `transcriptionStates` Map/Record and the action/function to trigger a retry (e.g., `retryTranscriptionForEvent`).
    - Get the specific `TranscriptionState` for the current `event.id` from the context state (provide a default 'idle' state if not found).
    - Conditionally render UI based on the `state.status`:
      - `'idle'`: Show "No transcript available yet..." message.
      - `'queued'`, `'mixing'`: Show appropriate status messages/indicators.
      - `'transcribing'`: Show "Transcribing..." message, progress bar (using `state.progress`), and percentage text.
      - `'completed'`: Display the formatted transcript (use `formatTimestampedTranscript` or `formatTranscript` based on content) from `state.transcript`. Include a "Copy Transcript" button (`navigator.clipboard`). Handle cases where `state.transcript` might be empty.
      - `'failed'`: Show error message (`state.error`) and a "Retry Transcription" button. The button's `onClick` should call the `retryTranscriptionForEvent(event.id, state.jobId)` function/action from context.
    - Style the different states, progress bar, buttons, and transcript text using Tailwind CSS.
3.  **Update `src/renderer/src/components/DetailPane/TabbedSection.tsx`:**
    - Conditionally render the `TranscriptTab` component (passing the `event` prop) when the 'transcript' tab is active.
