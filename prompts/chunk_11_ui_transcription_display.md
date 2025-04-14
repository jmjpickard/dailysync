# Chunk 11: UI Display for Transcription Status and Results

**Goal:** Update the Meeting Detail Pane's "Transcript" tab to dynamically display the status of the transcription job (Queued, Mixing, Transcribing, Completed, Failed) including progress, and show the final transcript or error message.

**Context:** The user needs visual feedback on the transcription process managed by the background worker (Chunk 10).

**Requirements:**

1.  **IPC Listener (Renderer Process):**

    - Set up a listener for transcription updates from the main process: `ipcRenderer.on('transcription-update', (event, jobUpdate) => { ... })`.
    - `jobUpdate` object should contain at least: `eventId`, `status`, `progress` (optional), `transcript` (optional), `error` (optional).

2.  **State Management (Renderer):**

    - Maintain state associated with each meeting event regarding its transcription status. This could be a map or object where keys are `eventId`s.
    - Example state for an event: `{ status: 'idle' | 'queued' | 'mixing' | 'transcribing' | 'completed' | 'failed', progress: 0-100, transcript: '...', error: '...' }`.
    - Load initial transcription status/results from local storage (Chunk 12) when displaying meeting details.

3.  **UI Update Logic (Renderer Process - Transcript Tab):**

    - When the `ipcRenderer` receives a `transcription-update`:
      - Find the relevant event's state using `jobUpdate.eventId`.
      - Update the state with the new `status`, `progress`, `transcript`, `error`.
    - When the `selectedEvent` changes (Chunk 4):
      - Check the transcription state for the `selectedEvent.id`.
      - Render the "Transcript" tab content based on the current state:
        - **`idle`**: "No transcript available." (Or hide tab/section if preferred).
        - **`queued`**: "Queued for transcription...". (Maybe show queue position if available).
        - **`mixing`**: "Preparing audio (Mixing)...". (Could show an indeterminate progress bar).
        - **`transcribing`**: "Transcribing... [XX%]". Display a progress bar reflecting the `progress` value.
        - **`completed`**: Display the `transcript` text in a scrollable area. Maybe add a "Copy Transcript" button.
        - **`failed`**: Display an error message: "Transcription Failed: [error message]". Add a `[Retry Transcription]` button.

4.  **Retry Functionality:**

    - If the "Retry Transcription" button exists (in the 'failed' state):
      - On click, invoke a new IPC channel `invoke('retry-transcription', eventId)`.
      - **Main Process Handler:** Find the original job data (needs file paths - requires storing these temporarily or permanently alongside the status), potentially re-add it to the `transcriptionQueue` with status 'queued', and trigger `processQueue()`. Update the UI state back to 'queued'.

5.  **Persistence:**
    - Ensure that the final state (`completed` with transcript, or `failed` with error) is saved via the local storage mechanism (Chunk 12) so it persists across app restarts.

**Acceptance Criteria:**

- The Transcript tab accurately reflects the current status (Queued, Mixing, Transcribing, Completed, Failed) for the selected meeting.
- A progress bar is displayed and updated during the 'transcribing' state based on `whisper.cpp` output.
- The final transcript text is displayed correctly when status is 'completed'.
- Error messages are shown clearly when status is 'failed'.
- A "Retry" button appears on failure and triggers the re-queuing of the transcription job.
- Status and final results persist when selecting different meetings or restarting the app (requires Chunk 12).

**Technologies:** Electron (Renderer), TypeScript, IPC, HTML, CSS. (UI Framework if used).
