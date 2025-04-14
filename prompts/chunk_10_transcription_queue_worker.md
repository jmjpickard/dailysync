# Chunk 10: Transcription Queue and Worker Process

**Goal:** Implement a background worker using Node.js `worker_threads` to manage a queue of transcription jobs, ensuring only one mixing/transcription process runs at a time.

**Context:** Audio mixing and transcription are resource-intensive. Running them sequentially in a background thread prevents blocking the main process and UI, providing a smoother user experience.

**Requirements:**

1.  **Queue Data Structure (Main Process):**

    - Maintain an array or queue (`transcriptionQueue`) in the main process to hold pending jobs.
    - Each job object should contain:
      - `jobId`: A unique identifier.
      - `eventId`: The identifier of the meeting associated with the recording.
      - `systemAudioPath`: Path to the raw system audio file.
      - `micAudioPath`: Path to the raw mic audio file.
      - `status`: Current status ('queued', 'mixing', 'transcribing', 'completed', 'failed').
      - `mixedAudioPath`: (Populated after mixing).
      - `transcript`: (Populated after transcription).
      - `error`: (Populated on failure).

2.  **Worker Thread Setup (`transcription_worker.js`):**

    - Create a new TypeScript file for the worker thread.
    - Import `worker_threads` (`parentPort`).
    - Import necessary functions/modules:
      - The `mixAudioFiles` function (or its implementation logic, adapted for worker context if needed) (from Chunk 8).
      - A function to execute `whisper.cpp` CLI and parse its output (from logic defined for Chunk 11, implemented here).

3.  **Worker Logic (`transcription_worker.js`):**

    - Listen for messages from the main thread using `parentPort.on('message', async (job) => { ... })`.
    - **Processing a Job:**
      - Update status to 'mixing': `parentPort.postMessage({ type: 'statusUpdate', jobId: job.jobId, status: 'mixing', eventId: job.eventId })`.
      - Generate output path for mixed audio (e.g., `jobId + '_mixed.wav'` in temp dir).
      - Call `mixAudioFiles(job.systemAudioPath, job.micAudioPath, mixedOutputPath)`.
      - If mixing fails:
        - Post 'failed' status with error: `parentPort.postMessage({ type: 'statusUpdate', jobId: job.jobId, status: 'failed', error: 'Mixing failed: ' + err.message, eventId: job.eventId })`.
        - Return (stop processing this job).
      - Store `mixedAudioPath`.
      - Update status to 'transcribing': `parentPort.postMessage({ type: 'statusUpdate', jobId: job.jobId, status: 'transcribing', progress: 0, eventId: job.eventId })`.
      - **Execute `whisper.cpp`:**
        - Get paths to bundled `main` and selected model file (passed in job or retrieved via message).
        - Construct args for `whisper.cpp` CLI using `mixedAudioPath`.
        - Spawn the `whisper.cpp` process.
        - Listen to `stderr` for progress: Parse percentage and post progress updates: `parentPort.postMessage({ type: 'statusUpdate', jobId: job.jobId, status: 'transcribing', progress: percentage, eventId: job.eventId })`.
        - Buffer `stdout` for transcript.
        - Await process exit.
      - If `whisper.cpp` fails (non-zero exit code):
        - Capture `stderr`. Post 'failed' status: `parentPort.postMessage({ type: 'statusUpdate', jobId: job.jobId, status: 'failed', error: 'Transcription failed: ' + stderrContent, eventId: job.eventId })`.
      - If `whisper.cpp` succeeds:
        - Get transcript from `stdout`.
        - Post 'completed' status with transcript: `parentPort.postMessage({ type: 'statusUpdate', jobId: job.jobId, status: 'completed', transcript: transcript, eventId: job.eventId })`.
      - Clean up temporary audio files (original system/mic, mixed).
    - Signal readiness: `parentPort.postMessage({ type: 'ready' })` after finishing a job.

4.  **Main Process Worker Management (`main.js`):**
    - Create a `Worker` instance pointing to `transcription_worker.js`.
    - Maintain worker state (`isBusy = false`).
    - Listen for messages from the worker (`worker.on('message', (message) => { ... })`).
      - Handle `ready`: Set `isBusy = false`; trigger `processQueue()`.
      - Handle `statusUpdate`: Find the job in `transcriptionQueue`, update its status/progress/transcript/error. Send IPC message (`webContents.send('transcription-update', job)`) to the renderer process to update the UI. Store the final transcript/error locally (using Chunk 12 mechanism).
    - **Queue Management Functions:**
      - `addJobToQueue(jobData)`: Creates a job object, adds it to `transcriptionQueue`, potentially updates UI about queue length, calls `processQueue()`.
      - `processQueue()`: If `!isBusy` and `transcriptionQueue.length > 0`:
        - Take the next job from the queue.
        - Set `isBusy = true`.
        - Send the job data to the worker: `worker.postMessage(job)`.
    - **Triggering:** Call `addJobToQueue` from the `stop-recording` handler (Chunk 7) when audio files are ready. Call `processQueue` on app startup in case jobs were pending.
    - **Pause/Resume (Optional):** Implement logic to pause (`worker.terminate()`, maybe save queue state) and resume (recreate worker, reload queue, call `processQueue`).

**Acceptance Criteria:**

- A background worker (`worker_threads`) handles transcription jobs.
- A queue in the main process holds pending jobs.
- Jobs are processed sequentially (one mix + transcribe operation at a time).
- The worker correctly calls the mixing function (Chunk 8).
- The worker correctly executes the bundled `whisper.cpp` CLI (Chunk 9).
- The worker parses `whisper.cpp` progress from `stderr` and reports it.
- The worker reports final status (completed/failed), transcript, and errors back to the main process.
- The main process updates the renderer via IPC about job status changes and results.
- The system handles multiple recordings being added to the queue while processing is ongoing.
- Temporary audio files are cleaned up after successful processing.

**Technologies:** Electron (Main Process), Node.js (`worker_threads`, `child_process`), TypeScript.
