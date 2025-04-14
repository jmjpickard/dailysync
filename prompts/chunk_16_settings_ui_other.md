**Goal:** Implement the remaining sections of the Settings UI/modal, allowing
users to manage their Google Account connection and view audio permission status.

**Context:** Consolidates various configuration options into a single Settings
interface, pulling together functionality developed in previous chunks.

**Requirements:**

1. **Settings Window/Modal:**

   - Create a dedicated Settings window (`BrowserWindow`) or a modal dialog within
     the main window. Provide a standard way to open it (e.g., App Menu: YourApp >
     Preferences, or File > Settings, or a gear icon button).

2. **Settings Structure (Renderer - Settings UI):**

   - Use tabs or distinct sections within the Settings UI for organization:
     - `Account`
     - `Audio` (or Permissions)
     - `LLM / Summarization` (Defined in Chunk 14)

3. **Account Section:**

   - Display the email address of the currently connected Google Account (if
     authenticated). Get this info via IPC from the main process.
   - Provide a `[Connect Google Account]` button (triggers
     `invoke('google-auth-start')` - Chunk 2). Visible only if not connected.
   - Provide a `[Disconnect]` button. Visible only if connected. - **Disconnect Logic (Main Process):** Create an IPC handler
     `invoke('google-auth-disconnect')`. This should: - Clear the stored Google credentials (using Chunk 12 mechanism). - Update the authentication state. - Inform the renderer to update the UI.

4. **Audio / Permissions Section:**

   - Title: "Audio Recording Permissions".
   - Display current status (`Allowed`/`Denied`/`Not Determined`) for:
     - Microphone Access
     - Screen Recording (for System Audio)
   - Get status via IPC (`invoke('check-audio-permissions')` - Chunk 5).
   - If status is Denied/Not Determined, show a message: "Permissions required for
     recording."
   - Button: `[Open Privacy & Security Settings]` (triggers
     `shell.openExternal(...)` as defined in Chunk 5).

5. **Saving Settings:**
   - While some settings save on change, provide a general "Close" or "Done"
     button for the Settings window/modal.

**Acceptance Criteria:**

- A Settings window/modal can be opened.
- The Account section correctly displays connection status and allows
  connecting/disconnecting Google Account.
- The Audio/Permissions section accurately displays the current status of
  Mic/Screen Recording permissions and provides a link to System Settings.
- Settings persist across app restarts.

**Technologies:** Electron (Main/Renderer), HTML, CSS, TypeScript, IPC, Local
Storage (Chunk 12). (UI Framework if used).

Key changes:

1. Removed the Transcription section completely since models are managed
   internally
2. Simplified the Settings structure to focus on Account, Audio Permissions, and
   LLM sections
3. Removed transcription-related acceptance criteria
4. Maintained all other requirements for Account and Audio/Permissions sections
