Objective: Set up the core React application structure, entry point, and a layout including a sidebar/navigation pane, using Tailwind CSS.

Context: We have configured Electron Main/Preload (Stage 1). Now we set up the basic React shell in `src/renderer/src/`. The layout should include a sidebar (for future navigation/settings) alongside the main content area (Event List, Detail Pane).

Task:

1.  Create the React entry point `src/renderer/src/main.tsx`:
    - Use `ReactDOM.createRoot` to render the `<App />` component into the `<div id="root"></div>`. Include `<React.StrictMode>`.
2.  Create the main application component `src/renderer/src/App.tsx`:
    - Define a functional component.
    - Import and render placeholder components for `Sidebar`, `EventListPane`, and `DetailPane`.
    - Use Tailwind CSS classes (e.g., flexbox/grid) to create a layout with a fixed-width `Sidebar` on the left, and the `EventListPane` and `DetailPane` taking up the remaining space (potentially side-by-side or stacked depending on desired layout).
    - Import the global CSS file (`import './styles/global.css'`) where Tailwind directives are included.
3.  Create placeholder component files: `src/renderer/src/components/Sidebar/Sidebar.tsx`, `src/renderer/src/components/EventList/EventListPane.tsx`, `src/renderer/src/components/DetailPane/DetailPane.tsx`. They can return a simple div with their name and basic Tailwind styling (e.g., background color, border) for visualization.
