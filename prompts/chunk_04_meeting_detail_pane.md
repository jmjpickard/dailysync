# Chunk 4: Meeting Detail Pane UI & Basic Interaction

**Goal:** Populate the right-hand Detail Pane with information about the meeting selected in the Center Pane. Add placeholder UI elements for notes, transcript, summary, and action buttons.

**Context:** When the user selects a meeting from the daily list (Chunk 3), they need to see its full details and access related actions.

**Requirements:**

1.  **State Management (Renderer):**

    - Maintain a state variable holding the currently selected event object (or `null` if none selected).

2.  **Event Selection Handling (Renderer):**

    - Modify the event list display (from Chunk 3) so that clicking on an event item updates the `selectedEvent` state with the full data of that clicked event.

3.  **Detail Pane UI (`renderer.js` or UI component):**

    - When `selectedEvent` state is updated (and not `null`):
      - Clear any previous content in the Right Pane.
      - **Header Section:** Display prominently:
        - Event Title (`selectedEvent.summary`).
        - Date & Time range (formatted nicely from `selectedEvent.start.dateTime` and `selectedEvent.end.dateTime`).
      - **Info Section:** Display other relevant details from the event object:
        - Description (`selectedEvent.description`).
        - Attendees (list `selectedEvent.attendees.map(a => a.email)`).
        - Location (`selectedEvent.location`).
        - Meeting Link (`selectedEvent.hangoutLink` or link parsed from description/location).
      - **Action Buttons Section:** Add buttons (initially enabled/disabled based on logic):
        - `[Join Meeting]` button: Enabled if a meeting link is found. (Functionality added later).
        - `[Record & Transcribe]` button: (Functionality added later). Initially just a placeholder.
      - **Tabbed Section (or distinct areas):** Create placeholders for:
        - **Notes Tab:** Label "Notes". Contain a placeholder `textarea` or div.
        - **Transcript Tab:** Label "Transcript". Contain placeholder text "No transcript available yet."
        - **Summary Tab:** Label "Summary". Contain placeholder text "No summary available yet." and a disabled `[Generate Summary]` button.

4.  **Deselection/Empty State:**
    - If `selectedEvent` is `null` (e.g., app start, date changed with no event selected), the Right Pane should display its initial message ("Select a meeting").

**Acceptance Criteria:**

- Clicking an event in the Center Pane updates the Right Pane.
- The Right Pane correctly displays the selected event's title, time, description, attendees, location, and meeting link (if available).
- Placeholder buttons "Join Meeting" and "Record & Transcribe" are visible.
- Placeholder tabs/sections for Notes, Transcript, and Summary are visible with appropriate initial text/state.
- When no event is selected, the Right Pane shows the default empty state message.

**Technologies:** Electron (Renderer), HTML, CSS, TypeScript. (UI Framework if used).
