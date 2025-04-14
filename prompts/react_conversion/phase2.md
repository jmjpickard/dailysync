Objective: Configure Electron's Main process and create the Preload script for the React+TS renderer within the new `electron-vite` structure.

Context: We have set up `electron-vite` and Tailwind (Stage 0). The main process logic (IPC handlers) exists in `src/main/index.ts`. We need to bridge communication securely to the React renderer. The original code used various `ipcRenderer.invoke` and `ipcRenderer.on` calls (e.g., 'google-auth-check', 'fetch-events', 'start-recording', 'load-transcript', 'generate-summary', 'load-all-settings', 'onRecordingStateUpdate', 'onTranscriptionUpdate', etc.).

Task:

1.  Modify the `src/main/index.ts` file:
    - Show the necessary code (using `process.env.VITE_DEV_SERVER_URL`, `process.env.DIST`, `path.join`) to correctly load the renderer URL (dev server or production `index.html`) based on the `electron-vite` environment.
    - Ensure the `webPreferences` in `new BrowserWindow({...})` correctly point to the _compiled_ preload script path (e.g., `path.join(__dirname, '../preload/index.js')`) and set `contextIsolation: true`, `nodeIntegration: false`.
    - Confirm existing IPC handler logic is correctly placed or imported within this file.
2.  Create the `src/preload/index.ts` file:
    - Use `contextBridge.exposeInMainWorld` to expose an API key ('electronAPI').
    - Expose _all_ required IPC channels identified from `renderer.ts` AND `summarization/ui.ts`. Provide specific, named functions on the exposed API (e.g., `checkAuth`, `WorkspaceEvents`, `loadTranscript`, `generateSummary`, `loadAllSettings`, `onAuthStateChanged`, `onRecordingStateUpdate`, etc.) wrapping `ipcRenderer.invoke` or `ipcRenderer.on`.
    - For `ipcRenderer.on` wrappers, ensure they return a cleanup function that calls `ipcRenderer.removeListener`.
3.  Create the `src/renderer/src/electron.d.ts` type declaration file:
    - Declare the interface for `window.electronAPI`, including accurate TypeScript types for all exposed functions (arguments and return values). Use placeholder types like `any` for now if the exact data structures aren't defined yet in `types.ts`.
