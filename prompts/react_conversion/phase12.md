Objective: Implement a Settings component displayed within the application's sidebar/navigation area.

Context: Instead of a modal, settings should be shown in the navigation sidebar. The `AppContext` provides the current `settings` object, the current `sidebarView` state ('nav', 'settings', etc.), and functions `setSidebarView` and `saveSettings` (which should call the corresponding IPC invoke).

Task:

1.  **Create `src/renderer/src/components/Settings/SettingsPane.tsx`:**
    - Create a functional component.
    - Use `useAppContext` to get `settings` and the `saveSettings` function/action.
    - Use `useState` to manage local form state for the settings fields (e.g., API keys for Ollama, Claude, Gemini). Initialize local state from the `settings` in context using `useEffect`.
    - Render form elements (input fields) for each setting (e.g., LLM API Keys). Use appropriate input types.
    - Implement an "Save Settings" button. Its `onClick` handler should:
      - Create the updated settings object from the local form state.
      - Call the `saveSettings` function from context, passing the new settings object.
      - Optionally show a temporary "Saved!" confirmation or handle errors.
    - Style the form and inputs using Tailwind CSS. Ensure it fits well within the sidebar layout.
2.  **Update `src/renderer/src/components/Sidebar/Sidebar.tsx`:**
    - Use `useAppContext` to get `sidebarView` and `setSidebarView`.
    - Render standard navigation elements (e.g., placeholder buttons/links).
    - Render a "Settings" icon/button. Its `onClick` should call `setSidebarView('settings')`.
    - Conditionally render the main navigation OR the `<SettingsPane />` component based on the value of `sidebarView`. Add a "Back" button within the settings view to call `setSidebarView('nav')`.
    - Apply Tailwind CSS for sidebar layout, navigation items, and the settings button.
