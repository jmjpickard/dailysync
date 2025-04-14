Objective: Implement the basic structure of the Detail Pane to display core information of the selected event.

Context: We have `AppContext` providing the `selectedEvent` state. We need to display its details, replacing the initial rendering logic within `displayEventDetails` and the placeholder from `displayDefaultDetailPane` from `renderer.ts`.

Task:

1.  **Create `src/renderer/src/utils/eventUtils.ts` (or add to existing utils):**
    - Implement and export `formatDateTimeRange(startDateTime?: string, endDateTime?: string): string` based on original `renderer.ts`.
    - Implement and export `extractMeetingLink(event: CalendarEvent): string | null` based on original `renderer.ts`.
2.  **Create Placeholder Components (if not already done):**
    - `src/renderer/src/components/DetailPane/EventHeader.tsx`
    - `src/renderer/src/components/DetailPane/EventInfoSection.tsx`
    - `src/renderer/src/components/DetailPane/ActionButtons.tsx`
    - `src/renderer/src/components/DetailPane/TabbedSection.tsx`
3.  **Update `src/renderer/src/components/DetailPane/DetailPane.tsx`:**
    - Use `useAppContext` to get `selectedEvent`.
    - If `selectedEvent` is `null`, render a placeholder message (e.g., "Select a meeting to view details") styled with Tailwind.
    - If `selectedEvent` exists, render the placeholder components: `EventHeader`, `EventInfoSection`, `ActionButtons`, `TabbedSection`. Pass the `selectedEvent` object as a prop to these child components.
    - Style the main pane container using Tailwind CSS.
4.  **Implement `src/renderer/src/components/DetailPane/EventHeader.tsx`:**
    - Accept `event` (`CalendarEvent`) as a prop.
    - Display the `event.summary` (or "Untitled Event").
    - Display the formatted date/time range using `formatDateTimeRange(event.start?.dateTime, event.end?.dateTime)`.
    - Style using Tailwind CSS.
5.  **Implement `src/renderer/src/components/DetailPane/EventInfoSection.tsx`:**
    - Accept `event` (`CalendarEvent`) as a prop.
    - Conditionally render sections for Description, Attendees, Location, and Meeting Link based on data availability in the `event` object.
    - Format attendees simply (e.g., mapping emails).
    - Use `extractMeetingLink` to get the meeting link and render it as an anchor tag (`<a>`).
    - Style the sections and content using Tailwind CSS.
