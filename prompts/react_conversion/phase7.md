Objective: Implement the Event List React components to display calendar events for the selected date and handle event selection.

Context: We have `AppContext` providing `selectedDate`, `events` state, `isLoadingEvents` state, `selectedEvent`, `allMeetingsData` (map/object indicating which event IDs have notes/transcripts), and functions `WorkspaceEventsForDate` (or similar action that uses `window.electronAPI.fetchEvents` and updates context state) and `setSelectedEvent`. We need to replace the logic from `WorkspaceEvents`, `displayEvents`, and `displayNoEventsMessage` in the original `renderer.ts`.

Task:
1.  **Create `src/renderer/src/utils/timeUtils.ts` (or add to `dateUtils.ts`):**
    * Implement and export the `formatTime(dateString?: string): string` function based on the original `renderer.ts`.
2.  **Create `src/renderer/src/components/EventList/EventListItem.tsx`:**
    * Create a functional component that accepts an `event` object (`CalendarEvent` type) and `isSelected` (boolean) and `hasNotes`/`hasTranscript` (booleans) as props.
    * Use the `useAppContext` hook to get the `setSelectedEvent` function.
    * Display the event time (using `formatTime`) and summary.
    * Include icons (e.g., simple emojis or SVG placeholders) conditionally based on `event.hangoutLink`, `event.location`, and the `hasNotes`/`hasTranscript` props. We will add the recording indicator later (Stage 12).
    * Add an `onClick` handler that calls `setSelectedEvent(event)`.
    * Style the component using Tailwind CSS. Apply different styles (e.g., background color) if `isSelected` is true.
3.  **Update `src/renderer/src/components/EventList/EventListPane.tsx`:**
    * Use `useAppContext` to get `selectedDate`, `events`, `isLoadingEvents`, `selectedEvent`, `allMeetingsData`, and the `WorkspaceEventsForDate` function/action.
    * Use `useEffect` to call `WorkspaceEventsForDate` whenever `selectedDate` changes. Ensure `WorkspaceEventsForDate` sets the `isLoadingEvents` state in the context correctly.
    * Conditionally render:
        * A loading indicator (e.g., simple text "Loading...") if `isLoadingEvents` is true.
        * A "No events..." message (similar to `displayNoEventsMessage`) if loading is finished and `events` array is empty.
        * Map over the `events` array and render an `EventListItem` for each event if events exist. Pass the `event` object, check if it's the `selectedEvent` (for `isSelected` prop), and check `allMeetingsData` for the `hasNotes`/`hasTranscript` props.
    * Style the pane container and the list items/messages using Tailwind CSS (e.g., padding, scrolling behavior if needed).