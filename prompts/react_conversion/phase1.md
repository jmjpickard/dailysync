Objective: Integrate `electron-vite` and Tailwind CSS into the existing Electron project, replacing the current build setup.

Context: We have an existing Electron project (structure shown in image, `package.json` provided) using `tsc` for the main process and a custom script (`node scripts/build.js`, likely using `esbuild`) for the renderer. We want to switch to `electron-vite` for building main, preload, and the new React+TS renderer, and use Electron Forge for packaging. We also want to set up Tailwind CSS.

Task:

1.  **Dependency Management:**
    - Provide `npm` or `yarn` commands to install necessary dependencies: `electron` (confirm version or update), `@electron-forge/cli`, `electron-vite`, `vite`, `react`, `react-dom`, `@types/react`, `@types/react-dom`.
    - Install Tailwind CSS dependencies: `tailwindcss`, `postcss`, `autoprefixer`.
    - Suggest removing potentially redundant dev dependencies: `concurrently`, `esbuild` (as Vite/electron-vite handle bundling/transpiling).
2.  **Project Restructure:**
    - Advise on restructuring the project to match `electron-vite`'s expected layout (if different from the image): Create `src/preload/index.ts`. Ensure React code resides in `src/renderer/src/`. Move the existing `src/main.ts` to `src/main/index.ts` if needed. Create the root `index.html` file.
3.  **Update `package.json`:**
    - Remove the old `build:main`, `build:renderer`, and `dev` scripts.
    - Add new scripts using `electron-vite` and `electron-forge`: `dev` (`electron-vite dev`), `build` (`electron-vite build`), `package` (`electron-forge package`), `make` (`electron-forge make`). Update the `main` field if necessary (e.g., `dist-electron/main.js`).
4.  **Build Configuration:**
    - Create `electron.vite.config.ts` (provide basic template if needed, minimal config is often sufficient).
    - Create `tailwind.config.js`: Configure `content` to scan React component files (`./src/renderer/src/**/*.{js,jsx,ts,tsx}`).
    - Create `postcss.config.js`: Include `tailwindcss` and `autoprefixer` plugins.
5.  **TypeScript Configuration:**
    - Provide necessary updates for the root `tsconfig.json` and a new `src/renderer/tsconfig.json` suitable for React/Vite (ensure `jsx: 'react-jsx'`). Update `tsconfig.node.json` for main/preload if needed.
6.  **Integrate Electron Forge:**
    - Run `npx electron-forge import` and configure it based on the new structure (entry points, etc.). Update the `forge.config.js` file if needed.
7.  **Global CSS for Tailwind:**
    - Create `src/renderer/src/styles/global.css` (or similar) and include the Tailwind directives (`@tailwind base; @tailwind components; @tailwind utilities;`).
