# Chunk 1: Electron Project Setup & Basic UI Layout

**Goal:** Initialize a new Electron project and create the main application window with a basic three-pane layout structure (Mini Calendar/Nav, Daily Event List, Meeting Details).

**Context:** This is the foundational structure for the macOS meeting companion app. We need a main window where all subsequent features will be displayed.

**Requirements:**

1.  **Initialize Electron Project:**

    - Use `npm init` or a boilerplate generator (like `electron-forge` or `electron-react-boilerplate` if using React) to set up a new Electron project.
    - Ensure necessary dependencies (`electron`, etc.) are installed.
    - Configure basic `package.json` details (app name, entry point).

2.  **Main Process Setup (`main.js` or similar):**

    - Import `app`, `BrowserWindow` from `electron`.
    - Create a function `createWindow()`:
      - Instantiate `BrowserWindow` with reasonable default dimensions (e.g., 1200x800).
      - Set `nodeIntegration: true` and `contextIsolation: false` for simplicity initially, OR set up a `preload.js` script for context isolation if preferred (recommended for security). If using preload, define basic IPC channels later.
      - Load the main HTML file (e.g., `index.html`) using `mainWindow.loadFile('index.html')` or `mainWindow.loadURL()` if using a dev server.
      - Handle window closing events.
    - Call `createWindow()` when the app is ready (`app.whenReady().then(...)`).
    - Handle app activation (e.g., recreating window on macOS when dock icon is clicked).
    - Handle app quitting (`app.on('window-all-closed', ...)`).

3.  **Renderer Process UI (`index.html`, `renderer.js`, CSS):**

    - Create `index.html`.
    - In `index.html` or via TypeScript (`renderer.js`), set up the basic three-pane layout using HTML and CSS (Flexbox or Grid are suitable).
      - **Left Pane (approx 20% width):** Placeholder for Mini Calendar and Filters. Label it "Navigation Pane".
      - **Center Pane (approx 40% width):** Placeholder for the list of daily events. Label it "Daily Schedule Pane". Add temporary Prev/Next Day buttons.
      - **Right Pane (approx 40% width):** Placeholder for meeting details. Label it "Detail Pane". Should be initially empty or show "Select a meeting".
    - Style panes minimally for clear visual separation.

4.  **Build/Run Configuration:**
    - Ensure you can run the app in development mode (`npm start` or similar).
    - (Optional) Set up a basic build configuration for macOS (`electron-builder` or `electron-forge`).

**Acceptance Criteria:**

- The Electron application launches successfully on macOS.
- A single window appears with the defined dimensions.
- The window displays three distinct vertical panes with placeholder content/labels.
- The application can be closed properly.
- Basic development workflow (`npm start`) is functional.

**Technologies:** Electron, Node.js, HTML, CSS, TypeScript. (Specify framework like React/Vue/Svelte if applicable).
