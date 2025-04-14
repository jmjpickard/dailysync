# Chunk 12: Local Storage Setup and Integration

**Goal:** Define the local data storage structure and implement functions to save and load application data (meeting details, notes, transcriptions, summaries, settings) persistently on the user's machine.

**Context:** The application needs to store all user-generated data and settings locally. This chunk sets up the mechanism for persistence.

**Requirements:**

1.  **Choose Storage Method:**

    - Select a suitable local storage mechanism for Electron:
      - **`electron-store` (Recommended):** Simple key-value store, good for settings and structured JSON data. Easy to use.
      - **Manual JSON Files:** Store data in `.json` files in `app.getPath('userData')`. Requires manual reading/writing/parsing.
      - **SQLite:** For more complex relational data or large datasets. Requires bundling SQLite and using a Node.js library like `sqlite3` or `better-sqlite3`. (Likely overkill initially).
    - **Decision:** Assume `electron-store` for simplicity unless specific needs dictate otherwise.

2.  **Data Structure Definition:**

    - Define the shape of the data to be stored. Example structure using `electron-store` (keys represent stored items):
      - `settings`: `{ googleRefreshToken: '...', llmApiKeys: { ollama: '...', claude: '...', gemini: '...' }, whisperModel: 'ggml-base.en.bin', ... }`
      - `meetingData`: `{ [eventId]: { eventDetails: { ...google event object... }, notes: '...', transcriptPath: '/path/to/transcript.txt', transcriptStatus: 'completed' | 'failed', transcriptError: '...', summary: '...', summaryModel: 'gemini', recordingPaths: { system: '...', mic: '...' } }, ... }`
        - Note: Storing full transcripts/notes directly in `electron-store` might hit size limits if they are very large. Consider storing large text blobs as separate files in `userData` and storing only the _path_ in `electron-store`. Let's start with storing paths for transcripts, maybe notes directly if usually small. Decide on a strategy for recording paths (keep temporarily for retry, delete after success?).
      - `transcriptionQueueState`: (Optional) Persist the queue state if the app might quit during processing, to allow resuming on next launch.

3.  **Storage Initialization (Main Process):**

    - Install `electron-store`: `npm install electron-store`.
    - Import and initialize `electron-store` in the main process: `const Store = require('electron-store'); const store = new Store();`.

4.  **Save/Load Functions (Main Process or dedicated module):**

    - **Settings:**
      - `saveSetting(key, value)`: `store.set(`settings.${key}`, value)`
      - `loadSetting(key, defaultValue)`: `store.get(`settings.${key}`, defaultValue)`
      - `saveAllSettings(settingsObject)`: `store.set('settings', settingsObject)`
      - `loadAllSettings()`: `store.get('settings', {})`
    - **Meeting Data:**
      - `saveMeetingNote(eventId, noteContent)`: `store.set(`meetingData.${eventId}.notes`, noteContent)`
      - `loadMeetingNote(eventId)`: `store.get(`meetingData.${eventId}.notes`, '')`
      - `saveTranscriptionResult(eventId, status, transcriptFilePathOrError)`: Update specific fields like `store.set(`meetingData.${eventId}.transcriptStatus`, status); store.set(`meetingData.${eventId}.transcriptPath`, transcriptFilePathOrError)`. Handle saving file path vs error message. Consider saving the actual transcript text to a file in `userData` and storing the path.
      - `loadMeetingData(eventId)`: `store.get(`meetingData.${eventId}`, null)`
      - `saveInitialMeetingDetails(eventId, eventObject)`: Store the raw Google event details if needed for later reference: `store.set(`meetingData.${eventId}.eventDetails`, eventObject)`.
      - `saveSummary(eventId, summaryText, modelUsed)`: `store.set(`meetingData.${eventId}.summary`, summaryText); store.set(`meetingData.${eventId}.summaryModel`, modelUsed)`.
    - **IPC for Renderer Access:** If the renderer needs direct access (e.g., for loading notes/transcripts when a meeting is selected), create IPC channels (`invoke('load-meeting-data', eventId)`, `invoke('save-note', eventId, content)`) that call these main process functions. Alternatively, load necessary data in the main process and push it to the renderer when needed.

5.  **Integration Points:**

    - Call save functions whenever data changes (settings updated, note edited, transcription finished, summary generated).
    - Call load functions on app startup (settings) and when data is needed for display (loading meeting details, notes, transcript status).

6.  **Data Directory:** Be aware that data is stored in the standard Electron user data directory (`app.getPath('userData')`).

**Acceptance Criteria:**

- `electron-store` (or chosen method) is installed and initialized.
- A clear data structure for settings and meeting-related data is defined.
- Functions exist to save and load settings.
- Functions exist to save and load notes, transcript status/paths/errors, and summaries associated with specific meeting event IDs.
- Data persists correctly across application restarts.
- Large text data (transcripts) are handled appropriately (stored as files with paths in the store).

**Technologies:** Electron (Main Process), Node.js, `electron-store` (or alternative), TypeScript, IPC.
