# Implementation Plan: Browser-Based Audio Capture

**Goal:** Replace the native audio capture using `audio-capture-addon` with a browser-based approach leveraging `getDisplayMedia` (for tab audio) and `getUserMedia` (for mic audio) via a local web server and WebSockets. This aims to bypass native framework issues potentially caused by MDM/security software on managed machines.

**Core Architecture:**

1.  **Electron Main Process:** Runs HTTP & WebSocket servers, manages overall state, receives audio data, interacts with transcription queue.
2.  **Local Server (HTTP/WebSocket):** Serves a simple capture webpage, handles WebSocket communication.
3.  **Capture Web Page:** Runs in the user's default browser, uses Web APIs to capture audio, streams data back via WebSocket.
4.  **Electron Renderer Process:** Initiates the process, updates UI based on state changes, displays final results.

---

## Stage 1: Main Process Modifications (`main.ts`)

**1.1 Add Dependencies:**

- Install required libraries:
  ```bash
  npm install ws portfinder express
  # OR: npm install ws portfinder (if using built-in http + manual file serving)
  ```

**1.2 Server Setup:**

- Import necessary modules: `http`, `WebSocketServer` from `ws`, `path`, `fs`, `portfinder`, `shell`, `express` (if using).
- Define path to the capture page static files (create this directory, e.g., `src/capture-page`).
- Add global variables:

  ```typescript
  import { WebSocketServer, WebSocket } from "ws";
  import http from "http";
  import express from "express"; // If using express
  import portfinder from "portfinder";

  let httpServer: http.Server | null = null;
  let webSocketServer: WebSocketServer | null = null;
  let capturePort: number | null = null;
  let activeWebSocketClient: WebSocket | null = null; // Store the connected browser client
  let micAudioBuffer: Buffer[] = []; // Buffer for incoming mic audio
  let tabAudioBuffer: Buffer[] = []; // Buffer for incoming tab audio
  const CAPTURE_PAGE_DIR = path.join(__dirname, "../capture-page"); // Adjust path as needed
  ```

- Create `setupLocalServer` function (async):

  ```typescript
  async function setupLocalServer(): Promise<number> {
    if (httpServer && capturePort) {
      console.log(`Local server already running on port ${capturePort}`);
      return capturePort;
    }

    try {
      capturePort = await portfinder.getPortPromise({ port: 3000 }); // Start searching from port 3000
      console.log(`Found available port: ${capturePort}`);

      const app = express(); // Using express for simplicity
      app.use(express.static(CAPTURE_PAGE_DIR)); // Serve static files

      httpServer = http.createServer(app);

      webSocketServer = new WebSocketServer({ server: httpServer });

      webSocketServer.on("connection", (ws) => {
        console.log("Browser capture page connected via WebSocket.");
        activeWebSocketClient = ws;
        micAudioBuffer = []; // Reset buffers on new connection
        tabAudioBuffer = [];

        ws.on("message", handleWebSocketMessage); // Separate handler function

        ws.on("close", () => {
          console.log("Browser capture page disconnected.");
          if (activeWebSocketClient === ws) {
            activeWebSocketClient = null;
            // Optionally stop recording state if connection drops unexpectedly
            if (recordingState === RECORDING_STATES.RECORDING) {
              console.warn("WebSocket closed unexpectedly during recording.");
              // Consider triggering stop logic or error state
              // For now, we primarily rely on explicit stop command
            }
          }
        });

        ws.on("error", (error) => {
          console.error("WebSocket error:", error);
          if (activeWebSocketClient === ws) {
            activeWebSocketClient = null;
          }
          // Handle error state in UI
          mainWindow?.webContents.send(
            "recording-error",
            `Capture connection error: ${error.message}`
          );
          recordingState = RECORDING_STATES.IDLE;
          mainWindow?.webContents.send(
            "recording-state-update",
            recordingState
          );
          activeRecordingEventId = null;
        });

        // Optional: Send initial message or confirmation
        // ws.send(JSON.stringify({ type: 'status', message: 'Connected successfully' }));
      });

      await new Promise<void>((resolve, reject) => {
        httpServer!.listen(capturePort!, "127.0.0.1", () => {
          console.log(
            `Local server listening on http://localhost:${capturePort}`
          );
          resolve();
        });
        httpServer!.on("error", reject);
      });

      return capturePort;
    } catch (error) {
      console.error("Failed to set up local server:", error);
      capturePort = null;
      throw error; // Re-throw to be caught by caller
    }
  }
  ```

- Create `stopLocalServer` function:
  ```typescript
  function stopLocalServer() {
    console.log("Attempting to stop local server...");
    if (activeWebSocketClient) {
      activeWebSocketClient.close();
      activeWebSocketClient = null;
    }
    if (webSocketServer) {
      webSocketServer.close(() => {
        console.log("WebSocket server closed.");
        webSocketServer = null;
      });
    }
    if (httpServer) {
      httpServer.close(() => {
        console.log("HTTP server closed.");
        httpServer = null;
        capturePort = null;
      });
    }
  }
  ```
- Ensure `stopLocalServer` is called on app quit (`app.on('will-quit', stopLocalServer);`).

**1.3 Modify `start-recording` IPC Handler:**

- **Remove:** Permission checks (`checkPermissions`, `requestPermissions`) - the browser will handle these.
- **Remove:** Calls to `audioCaptureAddon.startRecording`.
- **Remove:** Generation/use of `recordingPaths` at this stage.
- **Add:**
  - Call `await setupLocalServer();`. Handle potential errors.
  - Construct the URL: `const captureUrl = \`http://localhost:${capturePort}?eventId=${eventId}\`;` (pass eventId).
  - Use `await shell.openExternal(captureUrl);`.
  - Update state: Set `recordingState = RECORDING_STATES.READY_TO_RECORD;` (or a new state like `WAITING_FOR_BROWSER`). Send state update to renderer.
  - Keep `activeRecordingEventId = eventId;`.
  - Return success: `{ success: true }`.

**1.4 WebSocket Message Handling:**

- Create `handleWebSocketMessage` function:

  ```typescript
  async function handleWebSocketMessage(message: Buffer) {
    try {
      // Try parsing as JSON first for status/command messages
      const messageString = message.toString();
      let parsedMessage;
      try {
        parsedMessage = JSON.parse(messageString);
      } catch (e) {
        // If not JSON, assume it's binary audio data
        // We need a way to distinguish mic/tab audio if sent raw
        // Option: Assume specific binary format or rely on prior setup message
        // For now, let's assume JSON structure for simplicity
        console.error(
          "Received non-JSON WebSocket message, cannot process directly."
        );
        return;
      }

      // Process structured messages
      if (parsedMessage && parsedMessage.type) {
        switch (parsedMessage.type) {
          case "status":
            console.log(
              `Status from browser (${parsedMessage.eventId}): ${parsedMessage.status}`,
              parsedMessage.message || ""
            );
            if (
              parsedMessage.status === "recording_started" &&
              parsedMessage.eventId === activeRecordingEventId
            ) {
              recordingState = RECORDING_STATES.RECORDING;
              mainWindow?.webContents.send(
                "recording-state-update",
                recordingState,
                activeRecordingEventId
              );
            } else if (parsedMessage.status === "error") {
              mainWindow?.webContents.send(
                "recording-error",
                `Capture error: ${parsedMessage.message}`
              );
              recordingState = RECORDING_STATES.IDLE;
              mainWindow?.webContents.send(
                "recording-state-update",
                recordingState
              );
              activeRecordingEventId = null;
              stopLocalServer(); // Stop server on error
            } else if (
              parsedMessage.status === "stopped" &&
              parsedMessage.eventId === activeRecordingEventId
            ) {
              console.log(
                `Browser indicated capture stopped for event ${activeRecordingEventId}`
              );
              // Trigger post-processing now that browser confirmed stop
              await handleCaptureFinished();
              stopLocalServer(); // Stop server after processing
            }
            break;

          case "mic_chunk":
            // Assuming data is ArrayBuffer/Blob sent as Base64 or similar in JSON
            // Or handle raw Buffer if not using JSON envelope for audio
            if (parsedMessage.data) {
              // Convert Base64 back to Buffer if necessary
              // For now, assume data is directly usable Buffer/ArrayBuffer
              const chunk = Buffer.from(parsedMessage.data); // Adjust based on actual format sent
              micAudioBuffer.push(chunk);
            }
            break;

          case "tab_chunk":
            if (parsedMessage.data) {
              const chunk = Buffer.from(parsedMessage.data); // Adjust based on actual format sent
              tabAudioBuffer.push(chunk);
            }
            break;

          default:
            console.warn(
              "Received unknown WebSocket message type:",
              parsedMessage.type
            );
        }
      }
    } catch (error) {
      console.error("Error processing WebSocket message:", error);
    }
  }
  ```

**1.5 Post-Capture Processing (`handleCaptureFinished`):**

- Create this new async function called by the 'stopped' status message handler.
- Set state to `PROCESSING`. Send update.
- Combine buffered audio chunks (`micAudioBuffer`, `tabAudioBuffer`) into complete Buffers.
- Save Buffers to temporary files (using `fs.writeFileSync` or streams). Get the temp paths.

  ```typescript
  // Example saving buffers to temp files
  const tempDir = app.getPath("temp");
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const finalMicPath = path.join(
    tempDir,
    `mic-capture-${activeRecordingEventId}-${timestamp}.webm`
  ); // Use appropriate extension
  const finalTabPath = path.join(
    tempDir,
    `tab-capture-${activeRecordingEventId}-${timestamp}.webm`
  ); // Use appropriate extension

  fs.writeFileSync(finalMicPath, Buffer.concat(micAudioBuffer));
  fs.writeFileSync(finalTabPath, Buffer.concat(tabAudioBuffer));
  console.log(`Saved captured audio: Mic=${finalMicPath}, Tab=${finalTabPath}`);
  ```

- **Crucially:** Update `recordingPaths` with these _new temporary paths_.
- Call `saveRecordingPaths(activeRecordingEventId, { system: finalTabPath, mic: finalMicPath });`
- Add the job to the transcription queue using `addJobToQueue` with the `finalEventId`, `finalTabPath` (as system), `finalMicPath`, and selected model.
- Send `transcription-queued` message to renderer.
- Reset state to `IDLE`. Send update.
- Clear `activeRecordingEventId`, `micAudioBuffer`, `tabAudioBuffer`.

**1.6 Modify `stop-recording` IPC Handler:**

- **Remove:** `audioCaptureAddon.stopRecording` call and file existence checks.
- **Keep:** Initial state check (`recordingState !== RECORDING_STATES.RECORDING`).
- **Add:**
  - Set state to `STOPPING`. Send update.
  - Send 'stop' command to browser via WebSocket:
    ```typescript
    if (activeWebSocketClient) {
      activeWebSocketClient.send(
        JSON.stringify({ command: "stop", eventId: activeRecordingEventId })
      );
      console.log("Sent stop command to browser.");
    } else {
      console.warn("Stop requested, but no active browser connection found.");
      // Decide how to handle this - maybe just reset state?
      recordingState = RECORDING_STATES.IDLE;
      mainWindow?.webContents.send("recording-state-update", recordingState);
      activeRecordingEventId = null;
      return { error: "No active capture connection." };
    }
    ```
  - Return `{ success: true }` (indicating the stop _request_ was sent). The actual processing happens when the browser confirms via WebSocket message.

---

## Stage 2: Capture Web Page (`src/capture-page/index.html`, `capture.js`)

**2.1 Create Files:**

- `src/capture-page/index.html`: Basic HTML (e.g., Title, Status Div, maybe Start/Stop buttons although likely auto-start).
- `src/capture-page/style.css`: Basic styling.
- `src/capture-page/capture.js`: Main logic.

**2.2 `capture.js` Logic:**

- Get `eventId` from URL query parameters (`new URLSearchParams(window.location.search).get('eventId')`).
- Establish WebSocket connection: `const socket = new WebSocket('ws://localhost:<PORT>');` (Need to get port - maybe fixed, passed in query, or retrieved via another mechanism).
- Implement `socket.onopen`, `onerror`, `onclose`.
- Global variables: `micStream`, `displayStream`, `micRecorder`, `tabRecorder`, `audioContext`, etc.
- **`startCapture()` function (call on `socket.onopen` or button click):**
  - Display "Requesting permissions..." status.
  - `micStream = await navigator.mediaDevices.getUserMedia({ audio: true });`
  - `displayStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });` (Handle errors gracefully, update status).
  - Check if `displayStream` has audio track.
  - Create `MediaRecorder` for mic: `micRecorder = new MediaRecorder(micStream, { mimeType: 'audio/webm;codecs=opus' });` (Choose appropriate mimeType/codec).
  - Create `MediaRecorder` for tab audio (if available): `tabRecorder = new MediaRecorder(new MediaStream(displayStream.getAudioTracks()), { mimeType: 'audio/webm;codecs=opus' });`.
  - `micRecorder.ondataavailable = (event) => sendChunk('mic_chunk', event.data);`
  - `tabRecorder.ondataavailable = (event) => sendChunk('tab_chunk', event.data);`
  - `micRecorder.start(1000);` // Send chunks every second
  - `tabRecorder.start(1000);`
  - Update status to "Recording".
  - Send status update back via WebSocket: `socket.send(JSON.stringify({ type: 'status', status: 'recording_started', eventId }));`
- **`sendChunk(type, blob)` function:**
  - Convert Blob to ArrayBuffer or Base64 if sending via JSON.
  - `socket.send(JSON.stringify({ type: type, eventId: eventId, data: /* Converted Data */ }));`
  - _Alternative:_ Send raw Blobs/ArrayBuffers if WebSocket server handles binary. `socket.send(blob);` (requires prefixing/metadata or separate messages to identify stream type). JSON is often simpler.
- **`stopCapture()` function:**
  - Check and stop recorders (`micRecorder?.stop()`, `tabRecorder?.stop()`).
  - Check and stop media tracks (`micStream?.getTracks()...`, `displayStream?.getTracks()...`).
  - Update status to "Stopping...".
  - Send 'stopped' status message _after_ recorders finish: Add event listeners for `recorder.onstop` before calling `stop()`. Inside `onstop`, once both have stopped, send the message: `socket.send(JSON.stringify({ type: 'status', status: 'stopped', eventId }));`.
  - Close WebSocket: `socket.close();`.
  - Maybe close the tab: `window.close();`
- **Handle WebSocket `onmessage`:** Listen for commands from main process (like 'stop').
  ```javascript
  socket.onmessage = (event) => {
    try {
      const message = JSON.parse(event.data);
      if (message.command === "stop" && message.eventId === eventId) {
        console.log("Received stop command from Electron.");
        stopCapture();
      }
    } catch (e) {
      console.error("Error processing message from Electron:", e);
    }
  };
  ```
- **Error Handling:** Wrap promises in try/catch, handle `getUserMedia`/`getDisplayMedia` errors (e.g., `NotAllowedError`), update status div on page, send error status via WebSocket.

---

## Stage 3: Renderer Process Modifications (`renderer.ts`)

- **Triggering Capture:**
  - Modify `handleRecordButtonClick`: Instead of calling `start-recording` and expecting the recording state machine to proceed directly, it should call an IPC handler (maybe rename `start-recording`'s purpose or use a new one like `initiate-browser-capture`) that opens the browser URL.
  - Update the button state (`recordButton`) to reflect "Opening Capture Page..." or similar. The actual "Recording" state will now be set later when the WebSocket confirms the browser has started.
- **State Updates:** The existing `recording-state-update` listener should still work, but it will now receive `RECORDING` state updates triggered by WebSocket messages from the browser (relayed by `main.ts`), not directly from the native addon call. Ensure UI updates correctly for `WAITING_FOR_BROWSER` (if added), `PROCESSING`, etc.
- **User Guidance:** Add UI elements explaining that capture happens in a separate browser tab and instructing the user what to do (select tab, share audio).

---

## Stage 4: Integration and Data Flow

- **Audio Data:** Ensure the `handleWebSocketMessage` in `main.ts` correctly receives, buffers, and saves the audio data chunks sent from `capture.js`.
- **Transcription Input:** Verify the format saved (`.webm` with Opus in the example) is compatible with your `audio-mixer` (if still needed) and transcription engine. You might need `ffmpeg` (via `fluent-ffmpeg` npm package) to convert formats if required _after_ the temporary files are saved. The `addJobToQueue` function will now use the paths to these temporary `.webm` (or converted `.wav`/`.mp3`) files.
- **Mixing:** Decide if mixing is still needed. If you capture mic and tab audio separately and queue them, the transcription service might handle speaker diarization better. If mixing is required, call your `mixAudioFiles` function in `handleCaptureFinished` _before_ calling `addJobToQueue`, passing the temp mic/tab paths and using the output mixed path for the queue.

---

## Stage 5: Error Handling and UX Improvements

- **Browser Permissions:** Handle `NotAllowedError` gracefully in `capture.js`, update the page status, and send an error message back via WebSocket so the Electron app can inform the user.
- **WebSocket Disconnects:** Implement robust handling for unexpected WebSocket closures on both client (`capture.js`) and server (`main.ts`). Update UI state accordingly.
- **Tab Selection:** Clearly instruct the user in the Electron UI _before_ opening the browser tab about the need to select the correct meeting tab and enable audio sharing in the browser's prompt. The capture page itself could also reiterate this.
- **Server Port Conflicts:** Use `portfinder` reliably. Handle errors if no port is available.
- **Server Lifecycle:** Ensure the HTTP/WebSocket server starts reliably and shuts down cleanly when the app quits or capture stops/errors out.

---

This revised plan integrates the browser capture flow into your existing Electron structure, replacing the native calls while leveraging your current IPC, state management, and transcription queue logic. Remember to handle the asynchronous nature carefully, especially around starting/stopping and transferring audio data.
