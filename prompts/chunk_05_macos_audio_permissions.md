# Chunk 5: macOS Audio Permissions Handling

**Goal:** Implement the logic to check for, request, and handle macOS Screen Recording (for system audio) and Microphone permissions required for audio capture.

**Context:** Before attempting to record audio (Chunk 6), the app must have the necessary permissions from the user. macOS handles these via system prompts, but the app needs to manage the request timing and response handling.

**Requirements:**

1.  **Permission Check Function (Main Process):**

    - Use the `systemPreferences.getMediaAccessStatus()` API in Electron's main process to check the current status ('not-determined', 'granted', 'denied', 'restricted') for:
      - `microphone`
      - `screen` (Note: This covers screen _and_ system audio capture via `ScreenCaptureKit`).
    - Create a helper function `checkPermissions()` that returns an object like `{ microphone: 'granted', screen: 'not-determined' }`.

2.  **Permission Request Function (Main Process):**

    - Use the `systemPreferences.askForMediaAccess()` API.
    - Create a function `requestPermissions()` that:
      - Calls `askForMediaAccess('microphone')` _only if_ the current status is 'not-determined'.
      - Calls `askForMediaAccess('screen')` _only if_ the current status is 'not-determined'.
      - Returns a promise that resolves when the requests are complete (or immediately if permissions were already determined), indicating the final statuses.
    - **Important:** Trigger these requests only in direct response to a user action (like clicking the "Record" button for the first time), as macOS requires this.

3.  **IPC Communication:**

    - Expose the `checkPermissions` and `requestPermissions` logic via IPC channels (e.g., `invoke('check-audio-permissions')`, `invoke('request-audio-permissions')`).

4.  **Renderer Process Logic (Triggering):**

    - When the user clicks the `[Record & Transcribe]` button (from Chunk 4, functionality refined in Chunk 7):
      - First, call `invoke('check-audio-permissions')`.
      - If both statuses are 'granted', proceed with recording logic (Chunk 7).
      - If either is 'not-determined', call `invoke('request-audio-permissions')`.
        - Handle the returned promise. If permissions are now granted, proceed. If denied, show an informative message.
      - If either is 'denied' or 'restricted', show an informative message explaining _why_ recording cannot start and how to fix it.

5.  **User Feedback (Renderer):**

    - Display clear messages to the user:
      - Before the system prompt: "This app needs Microphone and Screen Recording permissions to record meeting audio. macOS will now ask for permission."
      - If permissions are denied: "Recording requires Microphone and Screen Recording permissions. Please grant access in System Settings > Privacy & Security." Include a button/link to open this settings pane directly (`shell.openPath('/System/Library/PreferencePanes/Security.prefPane/')` or a more specific path if possible, or `shell.openExternal('x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture')` / `Privacy_Microphone`).

6.  **Settings UI Update (Placeholder):**
    - (To be fully implemented in Chunk 16) Add a section in Settings that displays the current status of Microphone and Screen Recording permissions and provides the link to open System Settings.

**Acceptance Criteria:**

- The app can check the current status of Microphone and Screen Recording permissions via IPC.
- Clicking the "Record" button triggers permission checks.
- If permissions are 'not-determined', the official macOS system prompts are displayed to the user.
- The app correctly handles the 'granted' and 'denied'/'restricted' states after the prompts or on subsequent checks.
- Informative messages are displayed to the user regarding permission status and how to grant access if denied.
- Recording logic (to be implemented) is only triggered if both permissions are granted.

**Technologies:** Electron (Main/Renderer), Node.js (`systemPreferences`, `shell`), IPC, TypeScript.
