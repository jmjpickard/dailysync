Objective: Implement the Header React components, including Date Navigation and Google Authentication, using state from context and Tailwind CSS.

Context: We have set up `AppContext` (Stage 3) providing shared state (`selectedDate`, `isAuthenticated`) and update functions/actions. We also have IPC hooks (Stage 4). We now need to build the header UI, replacing logic previously handled by direct DOM manipulation in `renderer.ts` (like `updateDateDisplay`, `updateAuthUI`, `handleGoogleAuth`, `MapsToPreviousDay`, `MapsToNextDay`).

Task:

1.  **Create `src/renderer/src/components/Header/DateNavigator.tsx`:**
    - Create a functional component.
    - Use the `useAppContext` hook to get the `selectedDate` state and the function(s) needed to update it (e.g., `goToPreviousDay`, `goToNextDay` - assume these functions exist or are dispatched via context actions).
    - Implement Prev Day ("<") and Next Day (">") buttons. Add `onClick` handlers that call the corresponding context functions/dispatch actions.
    - Display the `selectedDate`. Use a utility function `formatDate(date: Date)` for formatting (you can implement a basic version of `formatDate` based on the original `renderer.ts` logic within this file or in a separate `utils/dateUtils.ts` file for now).
    - Style the component using Tailwind CSS classes (e.g., flexbox for layout, button styling).
2.  **Create `src/renderer/src/components/Header/AuthButton.tsx`:**
    - Create a functional component.
    - Use the `useAppContext` hook to get the `isAuthenticated` state and the functions/actions to trigger authentication (e.g., `signIn`, `signOut`).
    - Render a button whose text changes based on `isAuthenticated` ("Connect Google Calendar" vs. "Disconnect Google Calendar").
    - Add an `onClick` handler that calls the appropriate context function (`signIn` or `signOut`). These context functions should internally handle calling the necessary `window.electronAPI` functions (`startAuth`, etc.).
    - Optionally, display a status text element based on `isAuthenticated` ("Not connected" / "Connected").
    - Style the button and status text using Tailwind CSS, potentially changing button appearance based on auth state (like the original `connected`/`disconnected` classes). Add loading/disabled states if the context provides them during auth.
3.  **Update `src/renderer/src/components/Header/Header.tsx`:**
    - Import and render `DateNavigator` and `AuthButton`.
    - Arrange these components within the header using Tailwind CSS (e.g., flexbox with space-between).
    - Add overall header styling (background color, padding, border etc.) using Tailwind.
4.  **(Optional Utility)** If you haven't created it yet, create `src/renderer/src/utils/dateUtils.ts` and implement the `formatDate` function based on the original `renderer.ts`, exporting it for use in `DateNavigator.tsx`.
    ```typescript
    // Example src/renderer/src/utils/dateUtils.ts
    export function formatDate(date: Date): string {
      const options: Intl.DateTimeFormatOptions = {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      };
      return date.toLocaleDateString("en-US", options);
    }
    ```
