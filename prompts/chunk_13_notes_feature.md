# Chunk 13: Notes Feature Implementation

**Goal:** Implement the "Notes" tab in the Meeting Detail Pane, allowing users to add and edit persistent notes for the selected meeting.

**Context:** Users need a place to jot down manual notes related to a specific meeting instance, and these notes should be saved locally.

**Requirements:**

1.  **UI Element (Renderer - Notes Tab):**

    - Use a suitable HTML element for note input within the "Notes" tab (identified in Chunk 4). Options:
      - Simple `<textarea>`: Easiest, provides basic text input.
      - `contenteditable` `<div>`: Allows richer formatting if desired later, but more complex state management.
      - Basic Markdown Editor Library (e.g., EasyMDE, SimpleMDE integrated with React/Vue/etc.): Provides Markdown support.
    - **Decision:** Start with a simple `<textarea>` for core functionality.

2.  **Loading Notes (Renderer):**

    - When the `selectedEvent` changes:
      - If an event is selected, use IPC to request its notes from the main process: `ipcRenderer.invoke('load-meeting-note', selectedEvent.id)`.
      - Update the `<textarea>` value with the loaded note content.
      - If no event is selected, clear the `<textarea>`.

3.  **Saving Notes (Renderer & Main):**
    - **Autosave Recommended:** Detect changes to the `<textarea>` content (e.g., using the `input` event).
    - **Debouncing:** To avoid saving on every keystroke, debounce the save operation (e.g., save 1-2 seconds after the user stops typing). Use a simple `setTimeout`/`clearTimeout` debounce function.
    - When the debounced save triggers:
      - Get the current content of the `<textarea>`.
      - Get the `id` of the currently `selectedEvent`.
      - If an event is selected, use IPC to tell the main process to save the note: `ipcRenderer.invoke('save-meeting-note', selectedEvent.id, currentNoteContent)`.
    - **Main Process Handler (`save-meeting-note`):**
      - Receive `eventId` and `noteContent`.
      - Call the local storage function (from Chunk 12) to persist the note content associated with the `eventId`.

**Acceptance Criteria:**

- A text input area (e.g., `<textarea>`) is present in the "Notes" tab of the Meeting Detail Pane.
- When a meeting is selected, any previously saved notes for that specific meeting instance are loaded into the text area.
- When the text in the notes area is modified, the changes are automatically saved (using debouncing) to local storage, associated with the selected meeting.
- Notes persist across meeting selections and application restarts.

**Technologies:** Electron (Renderer/Main), HTML (`<textarea>`), CSS, TypeScript, IPC, Local Storage (Chunk 12).
