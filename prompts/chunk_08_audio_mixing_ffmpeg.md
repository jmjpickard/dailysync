# Chunk 8: Audio Mixing using FFmpeg

**Goal:** Implement a function that takes the paths to the separately recorded system audio and microphone audio files and merges them into a single audio file using the FFmpeg command-line tool.

**Context:** `whisper.cpp` works best with a single audio input. Before transcription, the two audio streams captured in Chunk 6 need to be combined. FFmpeg is a powerful, widely used tool for this.

**Requirements:**

1.  **FFmpeg Bundling:**

    - Ensure `ffmpeg` executable (static build for macOS, universal binary preferred) is included in the application package resources. (This bundling process itself might be defined in Chunk 9, but the _dependency_ is established here). Verify license compliance (FFmpeg is typically LGPL/GPL).

2.  **Mixing Function (Main Process or Worker Thread):**

    - Create an asynchronous function `mixAudioFiles(systemAudioPath, micAudioPath, outputAudioPath)`.
    - **Locate FFmpeg:** Get the path to the bundled `ffmpeg` executable (e.g., using `path.join(process.resourcesPath, 'ffmpeg')` - adjust based on bundling).
    - **Construct FFmpeg Command:** Create the argument array for `ffmpeg`. A common strategy is to map system audio to the left channel and mic to the right channel of a stereo file:
      ```TypeScript
      const args = [
        "-y", // Overwrite output file if it exists
        "-i",
        systemAudioPath,
        "-i",
        micAudioPath,
        "-filter_complex",
        "[0:a][1:a]join=inputs=2:channel_layout=stereo[a]", // Join inputs into stereo
        "-map",
        "[a]", // Map the filtered audio stream
        outputAudioPath, // Output file path
      ];
      // Alternative (simple merge if stereo isn't crucial, might depend on source formats):
      // const args = [ '-y', '-i', systemAudioPath, '-i', micAudioPath, '-filter_complex', '[0:a][1:a]amerge=inputs=2[a]', '-map', '[a]', outputAudioPath ];
      ```
      - Experiment with FFmpeg options to find what works best for `whisper.cpp` input (e.g., specifying codec `-acodec pcm_s16le`, sample rate `-ar 16000` might be beneficial for Whisper). Whisper generally prefers 16kHz mono WAV, so aiming for that might be ideal:
      ```TypeScript
      const args = [
        "-y",
        "-i",
        systemAudioPath,
        "-i",
        micAudioPath,
        "-filter_complex",
        "[0:a][1:a]amerge=inputs=2[a]", // Merge to stereo first
        "-map",
        "[a]",
        "-ac 1", // Force mono output
        "-ar",
        "16000", // Resample to 16kHz
        "-acodec",
        "pcm_s16le", // Standard WAV codec
        outputAudioPath, // Output .wav file
      ];
      ```
    - **Execute FFmpeg:** Use `child_process.spawn` to run `ffmpeg` with the constructed arguments.
    - **Promise Handling:** Wrap the execution in a Promise.
      - Listen for `stderr` to capture FFmpeg progress/errors (optional but good for debugging).
      - Resolve the promise with the `outputAudioPath` when the process exits with code `0`.
      - Reject the promise with an error (including `stderr` content) if the process exits with a non-zero code.

3.  **Integration Point:**
    - This `mixAudioFiles` function will be called by the Transcription Queue Worker (Chunk 10) _before_ invoking `whisper.cpp`. The worker will provide the input paths (from the stopped recording) and determine the desired output path (another temporary file).

**Acceptance Criteria:**

- An async function `mixAudioFiles` exists.
- Given valid paths to two input audio files (system, mic) and an output path, the function executes the bundled `ffmpeg`.
- `ffmpeg` successfully creates a single mixed audio file at the output path.
- The function returns a promise that resolves with the output path on success.
- The function returns a promise that rejects with an informative error on failure (e.g., ffmpeg not found, ffmpeg error, input files missing).
- The output audio format is suitable for input into `whisper.cpp` (e.g., 16kHz mono WAV).

**Technologies:** Electron (Main Process or Worker), Node.js (`child_process`, `path`), FFmpeg CLI.
