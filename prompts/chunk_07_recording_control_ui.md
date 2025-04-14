# Chunk 7: Recording Control Logic and UI Integration

**Goal:** Connect the "Record & Transcribe" button in the UI to the permission checks and the native audio capture module, managing the application's recording state.

**Context:** This chunk bridges the user interface action (clicking Record/Stop) with the backend permission handling (Chunk 5) and audio capture (Chunk 6).

**Requirements:**

1.  **Recording State Management (Main Process & Renderer):**

    - Define possible recording states: `IDLE`, `CHECKING_PERMISSIONS`, `REQUESTING_PERMISSIONS`, `READY_TO_RECORD`, `RECORDING`, `STOPPING`, `PROCESSING` (for mixing/transcription later).
    - Maintain the current state, likely managed primarily in the main process and communicated to the renderer via IPC (`webContents.send`) for UI updates.

2.  **IPC Channels:**

    - `invoke('start-recording', eventId)`: Renderer requests main process to start recording for a specific event.
    - `invoke('stop-recording')`: Renderer requests main process to stop recording.
    - `send('recording-state-update', newState, eventId)`: Main process informs renderer about state changes.
    - `send('recording-error', message)`: Main process informs renderer about errors.

3.  **Record Button Logic (Renderer Process):**

    - Get the `[Record & Transcribe]` button element.
    - Listen to state updates (`ipcRenderer.on('recording-state-update', ...)`).
    - **UI Updates based on State:**
      - `IDLE`, `READY_TO_RECORD`: Button text "Record & Transcribe", enabled.
      - `CHECKING_PERMISSIONS`, `REQUESTING_PERMISSIONS`: Button text "Checking Permissions...", disabled.
      - `RECORDING`: Button text "Stop Recording & Queue", enabled. Red color/icon indicator.
      - `STOPPING`: Button text "Stopping...", disabled.
      - `PROCESSING`: Button text "Processing...", disabled. (Covers mixing/transcription later).
    - **Click Handler:**
      - If state is `IDLE` or `READY_TO_RECORD`:
        - Get the `eventId` (or unique identifier) of the currently selected meeting.
        - Call `ipcRenderer.invoke('start-recording', eventId)`.
      - If state is `RECORDING`:
        - Call `ipcRenderer.invoke('stop-recording')`.

4.  **Start Recording Logic (Main Process - Handler for `start-recording`):**

    - Receive `eventId`. Store the `activeRecordingEventId`.
    - Send `recording-state-update` -> `CHECKING_PERMISSIONS`.
    - Call `checkPermissions()` (from Chunk 5).
    - If granted:
      - Send `recording-state-update` -> `READY_TO_RECORD`. (Briefly)
      - Generate temp file paths for system and mic audio. Store these paths.
      - Call the native module's `startRecording(micId, systemPath, micPath)` (from Chunk 6).
      - If `startRecording` succeeds: Send `recording-state-update` -> `RECORDING`.
      - If `startRecording` fails: Send `recording-error`, Send `recording-state-update` -> `IDLE`.
    - If 'not-determined':
      - Send `recording-state-update` -> `REQUESTING_PERMISSIONS`.
      - Call `requestPermissions()`.
      - On result: If granted, proceed as above (generate paths, call native `startRecording`). If denied, send `recording-error` ("Permissions denied..."), Send `recording-state-update` -> `IDLE`.
    - If 'denied':
      - Send `recording-error` ("Permissions denied..."), Send `recording-state-update` -> `IDLE`.

5.  **Stop Recording Logic (Main Process - Handler for `stop-recording`):**

    - Send `recording-state-update` -> `STOPPING`.
    - Call the native module's `stopRecording()`.
    - On success:
      - Retrieve the final paths of the saved system and mic audio files.
      - Trigger the next step: Add job to the mixing/transcription queue (Chunk 10) with the file paths and `activeRecordingEventId`.
      - Send `recording-state-update` -> `PROCESSING`. (The queue worker will later update status further).
      - Clear `activeRecordingEventId`.
    - On failure:
      - Send `recording-error` ("Failed to stop recording cleanly.").
      - Send `recording-state-update` -> `IDLE`. (Or potentially a 'failed' state).

6.  **Visual Recording Indicator:**
    - Besides the button state, add a more persistent visual indicator when recording is active (e.g., a red dot icon in the meeting list next to the active event, or in the app's header/footer). Update this based on the `RECORDING` state.

**Acceptance Criteria:**

- Clicking "Record & Transcribe" correctly initiates the permission check flow (Chunk 5).
- If permissions granted, the native audio capture (Chunk 6) starts, and the button changes to "Stop...". A visual indicator shows recording is active.
- Clicking "Stop..." triggers the native audio capture stop.
- The application state correctly transitions between `IDLE`, `RECORDING`, `STOPPING`, etc.
- The UI (button text/state, visual indicator) accurately reflects the current recording state.
- Error messages related to permissions or recording start/stop failures are communicated to the user.
- The paths to the successfully saved audio files are captured upon stopping.

**Technologies:** Electron (Main/Renderer), TypeScript, IPC, HTML, CSS. (UI Framework if used).
