# Chunk 3: Google Calendar Integration - Fetching & Displaying Events

**Goal:** Fetch Google Calendar events for a selected date using the authenticated Google API client and display them chronologically in the center pane of the UI. Implement basic date navigation.

**Context:** Now that authentication is handled (Chunk 2), we can use the Google Calendar API to retrieve event data for the user's primary calendar.

**Requirements:**

1.  **Date Selection State:**

    - In the renderer process (`renderer.js` or UI framework state), manage the currently selected date. Default to the current date (`new Date()`).

2.  **API Call Logic (Main Process):**

    - Create a function `WorkspaceCalendarEvents(date)` in the main process.
    - This function requires access to the authenticated Google API client (from Chunk 2). If not authenticated, it should return an empty list or an error state.
    - Use the `google.calendar({version: 'v3', auth: oauth2Client})` API.
    - Call `calendar.events.list()`:
      - Specify `calendarId: 'primary'`.
      - Set `timeMin` to the start of the selected `date` (e.g., `date.setHours(0, 0, 0, 0)`).
      - Set `timeMax` to the end of the selected `date` (e.g., `date.setHours(23, 59, 59, 999)`).
      - Set `singleEvents: true` (to expand recurring events).
      - Set `orderBy: 'startTime'`.
      - Request necessary fields (e.g., `id`, `summary`, `start`, `end`, `description`, `attendees`, `hangoutLink`, `location`).
    - Handle potential API errors (e.g., invalid credentials, network issues).
    - Return the list of events (or an error indicator).

3.  **IPC Communication:**

    - Create an IPC channel (e.g., `invoke('fetch-events', dateString)`) for the renderer to request events for a specific date.
    - The main process handler calls `WorkspaceCalendarEvents` and returns the results (or error) to the renderer.

4.  **Renderer Process Logic (`renderer.js` or UI component):**
    - **Date Navigation UI:**
      - Implement the "Previous Day" and "Next Day" buttons in the Center Pane.
      - Clicking these buttons should update the selected date state.
      - (Optional) Implement the Mini Calendar in the Left Pane. Clicking a date updates the selected date state. Display the currently selected date prominently.
    - **Fetching Events:**
      - Whenever the selected date changes, call the IPC channel `invoke('fetch-events', selectedDate.toISOString())`.
      - Handle the returned promise: display a loading state while fetching, show events on success, display an error message on failure.
    - **Displaying Events:**
      - In the Center Pane, clear the previous list.
      - Iterate through the fetched event list.
      - For each event, display key information clearly:
        - Start Time (formatted nicely, e.g., HH:MM AM/PM).
        - End Time (optional).
        - Event Summary (Title).
        - (Optional) Icons indicating if it has a video call link or location.
      - Make each event item clickable (this will be used in Chunk 4 to show details). Store the event data (especially the event `id` and full details) associated with the clickable element.

**Acceptance Criteria:**

- The center pane displays calendar events for the current date by default after successful authentication.
- Events are listed chronologically by start time.
- Start time and title (summary) are clearly visible for each event.
- Clicking "Previous Day" / "Next Day" buttons updates the selected date and fetches/displays events for that new date.
- (Optional) The mini-calendar allows selecting a date, which updates the center pane.
- A loading state is shown while events are being fetched.
- Appropriate messages are shown if authentication is missing or API calls fail.
- Each displayed event item is interactive (e.g., clickable).

**Technologies:** Electron (Main/Renderer), Node.js, `googleapis`, HTML, CSS, TypeScript, IPC. (UI Framework if used).
