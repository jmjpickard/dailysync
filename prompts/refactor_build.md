# Prompt: Refactor Electron Renderer Build Process with esbuild

**Role:** You are an expert software engineer specializing in Electron and TypeScript build systems.

**Objective:** Refactor the build process for the renderer code in an existing Electron/TypeScript project to use `esbuild` as a bundler. This is necessary to resolve the `"Uncaught ReferenceError: exports is not defined"` error occurring in the renderer process, even though `nodeIntegration: true` is set.

## Current Project Setup:

1.  **Framework:** Electron with TypeScript.
2.  **Source Files:**
    - Main Process: `src/main.ts`
    - Renderer Process: `src/renderer.ts`
    - HTML: `src/index.html`
3.  **Build Process (`package.json` script):**
    ```json
    "scripts": {
      "build:ts": "tsc",
      "start": "npm run build:ts && electron .",
      // Potentially other scripts like lint, test, etc.
    }
    ```
4.  **TypeScript Configuration (`tsconfig.json`):** Compiles TypeScript to JavaScript (likely using `"module": "commonjs"`) into an output directory (e.g., `./dist`).
    ```json
    // Example tsconfig.json (provide your actual relevant parts)
    {
      "compilerOptions": {
        "target": "es2016",
        "module": "commonjs", // This causes the 'exports' output
        "outDir": "./dist",
        "strict": true,
        "esModuleInterop": true
        // ... other options
      },
      "include": ["src/**/*"],
      "exclude": ["node_modules"]
    }
    ```
5.  **HTML Script Loading (`src/index.html`):** Currently loads the raw `tsc` output.
    ```html
    <body>
      <script src="../dist/renderer.js"></script>
    </body>
    ```
6.  **Main Process WebPreferences (`src/main.ts`):**
    ```typescript
    // Inside createWindow() function
    mainWindow = new BrowserWindow({
      // ... other options
      webPreferences: {
        nodeIntegration: true, // Currently true
        contextIsolation: false, // Currently false
      },
    });
    // Make sure mainWindow loads index.html
    mainWindow.loadFile(path.join(__dirname, "../src/index.html")); // Adjust path
    ```
7.  **Problem:** When running the application, the Developer Tools console for the renderer window shows: `renderer.js:2 Uncaught ReferenceError: exports is not defined`.

## Desired Solution:

Use `esbuild` to bundle the renderer process code (`src/renderer.ts`) and its dependencies into a single file. The main process code (`src/main.ts`) should still be compiled using `tsc`.

## Detailed Tasks:

1.  **Install `esbuild`:** Add `esbuild` as a development dependency to `package.json`.
2.  **Update Build Scripts (`package.json`):**
    - Modify the `build:ts` script (or create new scripts like `build:main` and `build:renderer`) to achieve the following:
      - Compile `src/main.ts` using `tsc` (outputting to `./dist/main.js` or similar).
      - Bundle `src/renderer.ts` using `esbuild`, outputting to a file like `./dist/renderer.bundle.js`.
    - Ensure the `start` script uses the updated build script(s). Consider using `npm-run-all` or `concurrently` if you create separate build scripts that need to run together.
3.  **Configure `esbuild`:**
    - **Entry Point:** `src/renderer.ts`
    - **Output File:** `./dist/renderer.bundle.js` (or similar)
    - **Platform:** Set to `'browser'` (even with nodeIntegration, it's fundamentally a browser env).
    - **Target:** Choose an appropriate ES target (e.g., `'es2020'`).
    - **Bundle:** Ensure dependencies are bundled (`bundle: true`).
    - **Sourcemap:** Enable sourcemaps (`sourcemap: true`) for easier debugging.
    - **Format:** Use `'iife'` (Immediately Invoked Function Expression) as it's safe for browser scripts.
    - **External (Optional but Recommended):** Mark `electron` as external if you are importing it in the renderer, as it's provided by the environment (`external: ['electron']`).
4.  **Copy HTML:** Modify the build script to also copy `src/index.html` to `dist/index.html`.
5.  **Update HTML (`src/index.html`):** Change the `<script>` tag inside the _copied_ `dist/index.html` (or modify the source `src/index.html` _before_ copying) to load the new bundled file (e.g., `<script defer src="./renderer.bundle.js"></script>`). Use `defer`. The path should be relative to the HTML file's location in `dist`.
6.  **Update Main Process (`src/main.ts`):** Update the `mainWindow.loadFile` path to load the HTML file from its new location in the `dist` folder (e.g., `dist/index.html`).
7.  **`tsconfig.json`:** No changes should be strictly necessary in `tsconfig.json` _for esbuild_, as `esbuild` uses its own configuration. However, `tsc` still needs it for `main.ts` and potentially for type checking during the `esbuild` step if configured.

## Output Requirements:

Provide the complete content of the modified files:

- `package.json` (specifically the `scripts` and relevant `devDependencies`)
- `src/index.html` (if modified directly) OR `dist/index.html` (if copied and modified) - specify which approach was taken. Show the updated `<script>` tag.
- `src/main.ts` (specifically the updated `mainWindow.loadFile` line)
- Any new build script file created (e.g., `build.js` if not using command-line arguments in `package.json`).

## Constraints:

- Maintain `nodeIntegration: true` and `contextIsolation: false` for now.
- Ensure the main process build (`tsc`) is not broken.
- Prioritize using `esbuild` command-line interface (CLI) arguments directly within the `package.json` scripts unless the configuration becomes too complex, in which case a separate `build.js` script using the `esbuild` JavaScript API is acceptable.
