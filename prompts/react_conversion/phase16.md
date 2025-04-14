Objective: Finalize the configuration for Electron Forge (or Electron Builder) and build distributable packages.

Context: The application code has been refactored. We need to ensure the build and packaging process is correctly configured. We are using Electron Forge (as set up in Stage 0).

Task:

1.  **Review `forge.config.js`:**
    - Verify that entry points (`main`, `renderer`, `preload`) are correct for the `electron-vite` build output structure.
    - Check the `packagerConfig`:
      - Ensure `asar` settings are appropriate (confirm `asarUnpack` includes the native `audio-capture-addon` as in the original `package.json`).
      - Verify `icon` path is correct.
      - Confirm `extraResources` paths (for assets, binaries, models) are correct relative to the project root and properly copy necessary files.
    - Check `makers` configuration for desired targets (e.g., DMG/ZIP for macOS).
2.  **Review `package.json`:**
    - Ensure `name`, `version`, `productName`, `author`, `description` are accurate.
    - Verify the `build` command correctly runs `electron-vite build`.
    - Verify the `make` or `package` scripts function correctly.
3.  **Build & Test:**
    - Run the build command (`npm run build`). Check the output directories (`dist`, `dist-electron`) for correctness.
    - Run the packaging command (`npm run make`).
    - Test the generated installer/package on the target platform(s) to ensure it installs and runs correctly, including native addon functionality and resource loading.
4.  **(Optional) Code Signing:** If distributing publicly, explain where to configure code signing for macOS/Windows within Electron Forge/Builder configuration (this usually involves setting environment variables or specific config properties).
