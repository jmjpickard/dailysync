# Chunk 9: whisper.cpp & Dependencies Setup and Bundling

**Goal:** Set up the build process to compile `whisper.cpp`, download models, bundle `whisper.cpp` executable, models, and `ffmpeg` within the Electron application package for macOS.

**Context:** The audio mixing (Chunk 8) and transcription (Chunk 10) rely on external executables (`ffmpeg`, `whisper.cpp`) and model files. These need to be correctly included in the distributable application.

**Requirements:**

1.  **`whisper.cpp` Compilation:**

    - Add a build script (e.g., in `package.json`'s `scripts` section, or a separate build file) that:
      - Clones the `whisper.cpp` repository (or uses it as a submodule).
      - Runs `make` within the `whisper.cpp` directory to compile the `main` executable.
      - **Crucially:** Ensure compilation targets macOS and potentially creates a universal binary (x86_64 + arm64). This might require specific Make flags or build environment setup (e.g., running `make` twice with different arch flags and using `lipo` to combine). Reference `whisper.cpp` documentation for cross-compilation/universal binary instructions.
      - Copy the compiled `main` executable to a known location within your project structure (e.g., `assets/bin/whisper/`).

2.  **Whisper Model Download:**

    - The build script should also download the desired `whisper.cpp` compatible model files (e.g., `ggml-base.en.bin`, `ggml-small.en.bin`) using the provided download scripts in the `whisper.cpp` repo or `curl`/`wget`.
    - Place the downloaded `.bin` files in a known location (e.g., `assets/models/whisper/`).
    - Choose which models to bundle by default (e.g., start with `base.en`).

3.  **FFmpeg Download/Bundling:**

    - Download a static, universal macOS build of `ffmpeg` from a trusted source (e.g., ffmpeg.org, Evermeet.cx).
    - Place the `ffmpeg` executable in your assets directory (e.g., `assets/bin/ffmpeg/`).
    - Ensure license compliance (check the license of the specific build you download).

4.  **Electron Build Configuration (`electron-builder` or `electron-forge`):**

    - Configure your Electron build tool to:
      - Include the `assets/bin/` and `assets/models/` directories (or wherever you placed the executables and models) into the final application package's resources directory (`YourApp.app/Contents/Resources/`).
      - Use the `extraResources` configuration option in `electron-builder` or equivalent in `electron-forge`.
      - **Ensure Execute Permissions:** Configure the build tool to set execute permissions (`+x`) for the bundled `main` and `ffmpeg` executables within the `.app` package. `electron-builder` usually handles this automatically for files in `extraResources`.

5.  **Path Resolution:**
    - In the main process code (where `ffmpeg` and `whisper.cpp` are called), reliably determine the path to these bundled resources at runtime. Use `path.join(process.resourcesPath, 'assets/bin/whisper/main')` or similar. `process.resourcesPath` points to the `Resources` directory inside the packaged `.app`.

**Acceptance Criteria:**

- The project's build process (`npm run build` or similar) successfully compiles `whisper.cpp` for macOS (ideally universal).
- The build process downloads specified Whisper model files.
- The build process includes a pre-downloaded `ffmpeg` executable.
- The final packaged `.app` file (after running the build) contains the `main` executable, the `.bin` model files, and the `ffmpeg` executable within its `Contents/Resources` directory (or subdirectories).
- The bundled `main` and `ffmpeg` executables have execute permissions within the `.app`.
- Code can reliably determine the runtime path to these bundled executables and models.

**Technologies:** Node.js (Build Scripts), Make, curl/wget, lipo (macOS), Electron Build Tools (`electron-builder` or `electron-forge`), Shell scripting.
