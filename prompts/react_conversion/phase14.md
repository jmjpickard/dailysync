Objective: Implement reusable Notification and Dialog components controlled by application state.

Context: The original code used functions like `showNotification` and various `show...Dialog` functions with direct DOM manipulation. We need React components for these UI elements, managed via `AppContext`.

Task:

1.  **Update `AppContext` (`src/renderer/src/contexts/AppContext.tsx`):**
    - Add state for managing notifications (e.g., an array `notifications: {id: string, title: string, message: string}[]`).
    - Add state for managing the currently active dialog (e.g., `activeDialog: {type: 'alert' | 'permission' | 'serviceSelection' | null, title?: string, message?: string, data?: any}`).
    - Add functions/actions to:
      - `showNotification(title: string, message: string)`: Adds a notification to the array with a unique ID, potentially removing it after a timeout.
      - `showDialog(config: DialogConfig)`: Sets the `activeDialog` state.
      - `hideDialog()`: Sets `activeDialog` to null.
2.  **Create `src/renderer/src/components/Notifications/Notification.tsx`:**
    - Accept `id`, `title`, `message`, `onDismiss` props.
    - Render a single notification element with title and message.
    - Include a dismiss button or handle auto-dismiss via `useEffect` and `setTimeout` calling `onDismiss(id)`.
    - Style using Tailwind CSS, including entrance/exit animations if desired.
3.  **Create `src/renderer/src/components/Notifications/Notifications.tsx` (Manager):**
    - Use `useAppContext` to get the `notifications` array and the dismiss action.
    - Map over the `notifications` array and render a `Notification` component for each one, passing necessary props.
    - Position this manager component appropriately in `App.tsx` (e.g., fixed position in a corner).
4.  **Create `src/renderer/src/components/Dialogs/Dialog.tsx`:**
    - Accept props like `title`, `children` (for content), `buttons` (an array of button configs: `{ text: string, onClick: () => void, type: 'primary' | 'secondary' }`), `onClose`.
    - Render a modal dialog structure (overlay + content box).
    - Display title, content (`children`), and map over `buttons` to render them. Wire up `onClick` handlers.
    - Handle closing via overlay click or close button calling `onClose`.
    - Style using Tailwind CSS.
5.  **Create `src/renderer/src/components/Dialogs/Dialogs.tsx` (Manager):**
    - Use `useAppContext` to get `activeDialog` state and `hideDialog` function.
    - If `activeDialog` is not null:
      - Render the `Dialog` component.
      - Dynamically generate the title, content (`message`), and buttons based on `activeDialog.type` and `activeDialog.data`. Replicate the logic/text from the original `showPermission...Dialog`, `showServiceSelectionUI`, and generic `showDialog`. Button clicks should perform relevant actions (e.g., call `window.electronAPI.openPrivacySettings` via an invoke hook for permission dialogs) and/or call `hideDialog`.
6.  **Update `App.tsx`:** Render the `<Notifications />` and `<Dialogs />` manager components.
7.  **Refactor:** Replace calls in other components that _would_ have called original functions (like `showNotification`, `showServiceSelectionUI`) with calls to the new context functions (`showNotification`, `showDialog`).
