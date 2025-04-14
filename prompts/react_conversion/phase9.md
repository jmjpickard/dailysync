Objective: Implement the Notes tab component within the Detail Pane.

Context: We need to replicate the notes functionality from the original `renderer.ts` within a React component. This involves loading notes for the selected event, saving changes automatically with debouncing, and providing copy/export actions. Assumes a `TabbedSection` component exists (from Stage 7) that will render this Notes tab when active.

Task:

1.  **Create `src/renderer/src/hooks/useDebounce.ts` (or find a library):**
    - Implement a basic `useDebounce` hook that takes a value and a delay, returning the debounced value.
2.  **Create `src/renderer/src/components/DetailPane/NotesTab.tsx`:**
    - Accept `event` (`CalendarEvent`) as a prop.
    - Use `useState` to manage the current note content (`noteText`).
    - Use `useState` to manage save status (e.g., 'idle', 'loading', 'saving', 'saved', 'error').
    - Use IPC hooks (`useIpcInvoke`) for `loadMeetingNote`, `saveMeetingNote`, `exportFile`.
    - Use `useEffect` to call `loadMeetingNote(event.id)` when the `event.id` prop changes, updating `noteText` and status.
    - Use the `useDebounce` hook on `noteText`.
    - Use another `useEffect` to call `saveMeetingNote(event.id, debouncedNoteText)` when the `debouncedNoteText` changes (and is different from the initially loaded note), updating save status accordingly.
    - Implement Copy button functionality using `navigator.clipboard.writeText(noteText)`.
    - Implement Export button functionality:
      - Construct a filename (e.g., based on event date/summary).
      - Call `exportFile({ content: noteText, filename: filename, title: 'Export Notes' })`.
      - (Consider adding a notification system later in Stage 13 for feedback).
    - Render a `textarea` element bound to `noteText`.
    - Render Copy and Export buttons.
    - Render a status indicator based on the save status state.
    - Style the component, textarea, buttons, and status using Tailwind CSS.
3.  **Update `src/renderer/src/components/DetailPane/TabbedSection.tsx`:** (Requires implementation detail)
    - This component needs internal state to manage the active tab ('notes', 'transcript', 'summary').
    - Render tab buttons.
    - Conditionally render the `NotesTab` component (passing the `event` prop) when the 'notes' tab is active.
