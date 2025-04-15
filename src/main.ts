import {
  app,
  BrowserWindow,
  ipcMain,
  systemPreferences,
  shell,
  IpcMainInvokeEvent,
  dialog,
} from "electron";
import path from "path";
import os from "os";
import fs from "fs";
import tmp from "tmp";
import {
  authenticateGoogle,
  loadCredentials,
  isAuthenticated,
  getCalendarClient,
  signOut,
} from "./auth/google-auth";
import audioCaptureAddon from "audio-capture-addon";
import { mixAudioFiles } from "./audio-mixer";
import setupFunctions from "./transcription/setup";

// Browser audio capture imports
import http from "http";
import { WebSocketServer, WebSocket } from "ws";
import express from "express";
import portfinder from "portfinder";

// Types
type AuthState = boolean;
type PermissionStatus = "granted" | "denied" | "restricted" | "not-determined";
type PermissionCheckResult = {
  microphone: PermissionStatus;
  screen: PermissionStatus;
};
type RecordingPaths = {
  systemAudio: string | null;
  micAudio: string | null;
};
type CalendarEvent = {
  id: string;
  summary?: string;
  start?: {
    dateTime?: string;
    date?: string;
  };
  end?: {
    dateTime?: string;
    date?: string;
  };
  description?: string;
  attendees?: Array<{ email: string; responseStatus?: string }>;
  hangoutLink?: string;
  location?: string;
};

// Keep a global reference of the window object to prevent it from being garbage collected
let mainWindow: BrowserWindow | null = null;

// Authentication state
let authState: AuthState = false;

// Recording state management
enum RECORDING_STATES {
  IDLE = "idle",
  CHECKING_PERMISSIONS = "checking_permissions",
  REQUESTING_PERMISSIONS = "requesting_permissions",
  READY_TO_RECORD = "ready_to_record",
  WAITING_FOR_BROWSER = "waiting_for_browser",
  RECORDING = "recording",
  STOPPING = "stopping",
  PROCESSING = "processing",
}

// Keep references to the current recording state and paths
let recordingState: RECORDING_STATES = RECORDING_STATES.IDLE;
let activeRecordingEventId: string | null = null;
let recordingPaths: RecordingPaths = {
  systemAudio: null,
  micAudio: null,
};

// Browser-based audio capture server variables
let httpServer: http.Server | null = null;
let webSocketServer: WebSocketServer | null = null;
let capturePort: number | null = null;
let activeWebSocketClient: WebSocket | null = null;
let micAudioBuffer: Buffer[] = [];
let tabAudioBuffer: Buffer[] = [];
// Calculate correct path for capture page directory
// This handles both development and production environments
// In dev, __dirname is '/src', in prod it's '/dist'
// So we need to ensure we're pointing to the right capture-page location in both environments
let CAPTURE_PAGE_DIR = path.join(__dirname, "../capture-page"); // Default for development

// Check if we're in production by seeing if capture-page exists in the same directory as main.js
const prodCapturePageDir = path.join(__dirname, "capture-page");
if (fs.existsSync(prodCapturePageDir)) {
  CAPTURE_PAGE_DIR = prodCapturePageDir;
}

console.log(`Serving capture page from: ${CAPTURE_PAGE_DIR}`);
console.log(`Current __dirname: ${__dirname}`);

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      webSecurity: true,
    },
  });

  // Load the appropriate URL based on the environment
  if (process.env.NODE_ENV === "development") {
    mainWindow.loadURL("http://localhost:5173");
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, "../dist/index.html"));
  }

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

// Create window when the app is ready
app.whenReady().then(() => {
  // Initialize window
  createWindow();

  // Initialize transcription directory structure
  // This has been moved to the storage module directly
});

// Quit when all windows are closed, except on macOS
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

// On macOS, re-create the window when the dock icon is clicked
app.on("activate", () => {
  if (mainWindow === null) {
    createWindow();
  }
});

// Make sure to clean up the server on app quit
app.on("will-quit", () => {
  stopLocalServer();
});

// ===== Browser-based Audio Capture Server =====

/**
 * Setup local HTTP and WebSocket servers for browser-based audio capture
 * @returns Promise that resolves to the port number
 */
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
        mainWindow?.webContents.send("recording-state-update", recordingState);
        activeRecordingEventId = null;
      });
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

/**
 * Stop the local HTTP and WebSocket servers
 */
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

/**
 * Handle incoming WebSocket messages from the browser capture page
 * @param message The message buffer from the client
 */
async function handleWebSocketMessage(message: Buffer) {
  try {
    // Try parsing as JSON first for status/command messages
    const messageString = message.toString();
    let parsedMessage;
    try {
      parsedMessage = JSON.parse(messageString);
    } catch (e) {
      // If not JSON, assume it's binary audio data
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
          // Assuming data is Base64 encoded
          if (parsedMessage.data) {
            const chunk = Buffer.from(parsedMessage.data, "base64");
            micAudioBuffer.push(chunk);
          }
          break;

        case "tab_chunk":
          if (parsedMessage.data) {
            const chunk = Buffer.from(parsedMessage.data, "base64");
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

/**
 * Process captured audio after recording stops
 */
async function handleCaptureFinished() {
  try {
    // Update state to processing
    recordingState = RECORDING_STATES.PROCESSING;
    mainWindow?.webContents.send("recording-state-update", recordingState);

    if (!activeRecordingEventId) {
      throw new Error("No active recording event ID");
    }

    console.log("Processing captured audio data...");
    console.log(`Mic audio chunks: ${micAudioBuffer.length}`);
    console.log(`Tab audio chunks: ${tabAudioBuffer.length}`);

    // Create temp directories for saving the audio files
    const tempDir = app.getPath("temp");
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");

    // Save mic audio to temp file
    const finalMicPath = path.join(
      tempDir,
      `mic-capture-${activeRecordingEventId}-${timestamp}.webm`
    );

    const finalTabPath = path.join(
      tempDir,
      `tab-capture-${activeRecordingEventId}-${timestamp}.webm`
    );

    if (micAudioBuffer.length > 0) {
      fs.writeFileSync(finalMicPath, Buffer.concat(micAudioBuffer));
      console.log(`Mic audio saved to ${finalMicPath}`);
    } else {
      console.warn("No mic audio data to save");
    }

    if (tabAudioBuffer.length > 0) {
      fs.writeFileSync(finalTabPath, Buffer.concat(tabAudioBuffer));
      console.log(`Tab audio saved to ${finalTabPath}`);
    } else {
      console.warn("No tab audio data to save");
    }

    // Update recording paths
    recordingPaths = {
      systemAudio: tabAudioBuffer.length > 0 ? finalTabPath : null,
      micAudio: micAudioBuffer.length > 0 ? finalMicPath : null,
    };

    // Save recording paths for potential retry
    if (recordingPaths.systemAudio || recordingPaths.micAudio) {
      saveRecordingPaths(activeRecordingEventId, {
        system: recordingPaths.systemAudio!,
        mic: recordingPaths.micAudio!,
      });

      // Get selected whisper model
      const selectedModel = getSetting("whisperModel", "base.en");

      // Add job to transcription queue
      const job = addJobToQueue(
        activeRecordingEventId,
        recordingPaths.systemAudio!,
        recordingPaths.micAudio!,
        selectedModel
      );

      console.log(`Added job ${job.jobId} to transcription queue`);

      // Save meeting details if available
      try {
        const events = await WorkspaceCalendarEvents(new Date());
        if (events && Array.isArray(events)) {
          const event = events.find((e) => e.id === activeRecordingEventId);
          if (event) {
            saveInitialMeetingDetails(activeRecordingEventId, event);
          }
        }
      } catch (error) {
        console.error("Error saving meeting details:", error);
      }

      // Notify the renderer
      mainWindow?.webContents.send("transcription-queued", job);
    }

    // Reset state
    recordingState = RECORDING_STATES.IDLE;
    mainWindow?.webContents.send("recording-state-update", recordingState);

    // Clear buffers and active recording ID
    micAudioBuffer = [];
    tabAudioBuffer = [];
    const finalEventId = activeRecordingEventId;
    activeRecordingEventId = null;

    return {
      success: true,
      eventId: finalEventId,
    };
  } catch (error: any) {
    console.error("Error handling capture finished:", error);

    // Reset state on error
    recordingState = RECORDING_STATES.IDLE;
    mainWindow?.webContents.send("recording-state-update", recordingState);
    activeRecordingEventId = null;
    micAudioBuffer = [];
    tabAudioBuffer = [];

    // Notify renderer
    mainWindow?.webContents.send(
      "recording-error",
      `Error processing recording: ${error.message}`
    );

    return { error: error.message };
  }
}

// ==== Google OAuth Integration =====

// Initialize authentication state when the app is ready
app.whenReady().then(async () => {
  // Check for existing credentials
  authState = await isAuthenticated();

  if (process.platform === "darwin") {
    console.log("--- App Ready ---");
    const initialScreenStatus =
      systemPreferences.getMediaAccessStatus("screen");
    console.log(
      `[App Ready Check] Initial Screen Permission Status: ${initialScreenStatus}`
    );
  }

  // If credentials exist, notify the renderer
  if (mainWindow && authState) {
    mainWindow.webContents.send("google-auth-state-changed", authState);
  }
});

// Get Google Auth status (email and authenticated state)
ipcMain.handle("get-google-auth-status", async () => {
  const isAuth = await isAuthenticated();
  let email = "";

  // You would need to implement a way to get the user's email
  // This could be stored when they authenticate or fetched from Google
  // For now we'll return a placeholder

  return {
    authenticated: isAuth,
    email: isAuth ? "user@example.com" : "",
  };
});

// Disconnect Google Auth
ipcMain.handle("google-auth-disconnect", async () => {
  try {
    const success = signOut();
    authState = false;

    // Notify the renderer of the authentication state change
    if (mainWindow) {
      mainWindow.webContents.send("google-auth-state-changed", authState);
    }

    return { success: true };
  } catch (error: any) {
    console.error("Error disconnecting Google auth:", error);
    return { success: false, error: error.message };
  }
});

// Start Google authentication process
ipcMain.handle("google-auth-start", async (): Promise<boolean> => {
  console.log("[Main] Received google-auth-start request.");
  try {
    const success = await authenticateGoogle();
    authState = success;

    // Notify the renderer of the authentication state change
    if (mainWindow) {
      mainWindow.webContents.send("google-auth-state-changed", authState);
    }

    return success;
  } catch (error) {
    console.error("Error during authentication:", error);
    return false;
  }
});

// Check authentication status
ipcMain.handle("google-auth-check", async (): Promise<boolean> => {
  authState = await isAuthenticated();
  return authState;
});

// Sign out from Google
ipcMain.handle("google-auth-signout", (): boolean => {
  try {
    const success = signOut();
    authState = false;

    // Notify the renderer of the authentication state change
    if (mainWindow) {
      mainWindow.webContents.send("google-auth-state-changed", authState);
    }

    return success;
  } catch (error) {
    console.error("Error during sign out:", error);
    return false;
  }
});

/**
 * Fetch calendar events for the specified date
 * @param {Date|string} date - The date to fetch events for (Date object or ISO string)
 * @returns {Promise<Array|null>} - List of events or null if not authenticated
 */
async function WorkspaceCalendarEvents(
  date: Date | string
): Promise<Array<CalendarEvent> | null | { error: string }> {
  try {
    // Get authenticated calendar client
    const calendarClient = await getCalendarClient();

    // If not authenticated, return empty list
    if (!calendarClient) {
      console.log("Cannot fetch events: User not authenticated");
      return null;
    }

    // Parse date if it's a string
    const eventDate = typeof date === "string" ? new Date(date) : date;

    // Create timeMin (start of day)
    const timeMin = new Date(eventDate);
    timeMin.setHours(0, 0, 0, 0);

    // Create timeMax (end of day)
    const timeMax = new Date(eventDate);
    timeMax.setHours(23, 59, 59, 999);

    console.log(
      `Fetching events for ${timeMin.toISOString()} to ${timeMax.toISOString()}`
    );

    // Call the Calendar API to fetch events
    const response = await calendarClient.events.list({
      calendarId: "primary",
      timeMin: timeMin.toISOString(),
      timeMax: timeMax.toISOString(),
      singleEvents: true,
      orderBy: "startTime",
      fields:
        "items(id,summary,start,end,description,attendees,hangoutLink,location)",
    });

    // Filter out events with missing IDs
    const events = (response.data.items || []).filter(
      (event) => !!event.id
    ) as CalendarEvent[];

    // Save event details to persistent storage
    for (const event of events) {
      try {
        saveInitialMeetingDetails(event.id, event);
      } catch (storageError) {
        console.error(
          `Error saving event details for ${event.id}:`,
          storageError
        );
      }
    }

    return events;
  } catch (error: any) {
    console.error("Error fetching calendar events:", error);
    return { error: error.message || "Failed to fetch events" };
  }
}

// IPC handler for fetching events
ipcMain.handle(
  "fetch-events",
  async (event: IpcMainInvokeEvent, dateString: string) => {
    try {
      return await WorkspaceCalendarEvents(dateString);
    } catch (error: any) {
      console.error("Error in fetch-events handler:", error);
      return { error: error.message || "Failed to process event request" };
    }
  }
);

// ====== macOS Audio Permissions Handling ======

/**
 * Check the current status of microphone and screen recording permissions
 * @returns {Object} An object containing the status of each permission
 */
async function checkPermissions(): Promise<PermissionCheckResult> {
  // Default statuses for non-macOS platforms
  const defaultStatus: PermissionCheckResult = {
    microphone: "not-determined",
    screen: "not-determined",
  };

  // Only check permissions on macOS
  if (process.platform !== "darwin") {
    console.log("Permission checking is only available on macOS");
    return defaultStatus;
  }

  try {
    // Explicitly check each permission status with additional debug info
    console.log("Checking microphone permission status...");
    const micStatus = systemPreferences.getMediaAccessStatus(
      "microphone"
    ) as PermissionStatus;

    console.log("Checking screen recording permission status...");
    const screenStatus = systemPreferences.getMediaAccessStatus(
      "screen"
    ) as PermissionStatus;

    console.log(
      `Current permission status: Microphone = ${micStatus}, Screen = ${screenStatus}`
    );

    // Verify that screen status is returning a valid value
    if (
      !["granted", "denied", "restricted", "not-determined"].includes(
        screenStatus
      )
    ) {
      console.error(
        `Warning: Invalid screen permission status "${screenStatus}"`
      );
    }

    return {
      microphone: micStatus,
      screen: screenStatus,
    };
  } catch (error) {
    console.error("Error checking media access status:", error);
    return defaultStatus;
  }
}

/**
 * Request microphone and screen recording permissions if they're not determined yet
 * @returns {Promise<Object>} An object containing the final status of each permission
 */
async function requestPermissions(): Promise<PermissionCheckResult> {
  // Default statuses for non-macOS platforms
  const defaultStatus: PermissionCheckResult = {
    microphone: "not-determined",
    screen: "not-determined",
  };

  // Only request permissions on macOS
  if (process.platform !== "darwin") {
    console.log("Permission requests are only available on macOS");
    return defaultStatus;
  }

  try {
    // Get current permission status
    const currentStatus = await checkPermissions();

    // Request microphone access if not determined
    if (currentStatus.microphone === "not-determined") {
      console.log("Requesting microphone permission...");
      const micResult = await systemPreferences.askForMediaAccess("microphone");
      currentStatus.microphone = micResult ? "granted" : "denied";
      console.log(`Microphone permission result: ${currentStatus.microphone}`);
    }

    // Request screen recording access if not determined
    if (currentStatus.screen === "not-determined") {
      console.log("Attempting to request screen recording permission...");
      try {
        // For screen recording, Electron doesn't support askForMediaAccess('screen')
        // The actual recording attempt will trigger the system permission prompt
        console.log(
          "Screen recording permission will be requested when recording starts"
        );

        // Check status after attempted request
        const finalScreenStatus = systemPreferences.getMediaAccessStatus(
          "screen"
        ) as PermissionStatus;
        console.log(`Final screen permission status: ${finalScreenStatus}`);

        currentStatus.screen = finalScreenStatus;

        // If still not determined, we'll need to trigger the actual screen recording API
        if (finalScreenStatus === "not-determined") {
          console.log(
            "Permission still not determined. Will trigger prompt when recording starts."
          );
        }
      } catch (error) {
        console.error("Error requesting screen recording permission:", error);
        // On error, keep the not-determined status so we can retry
      }
    }

    return currentStatus;
  } catch (error) {
    console.error("Error requesting permissions:", error);
    return defaultStatus;
  }
}

/**
 * Open macOS System Settings to the specific privacy section
 * @param {string} section - The privacy section to open ('microphone' or 'screen')
 */
function openPrivacySettings(section: "microphone" | "screen"): void {
  if (process.platform !== "darwin") {
    console.log("Opening privacy settings is only available on macOS");
    return;
  }

  try {
    // Use different URLs based on the section
    let settingsUrl =
      "x-apple.systempreferences:com.apple.preference.security?Privacy";

    if (section === "microphone") {
      settingsUrl =
        "x-apple.systempreferences:com.apple.preference.security?Privacy_Microphone";
    } else if (section === "screen") {
      settingsUrl =
        "x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture";
    }

    console.log(`Opening system settings: ${settingsUrl}`);
    shell.openExternal(settingsUrl);
  } catch (error) {
    console.error("Error opening privacy settings:", error);

    // Fallback to opening the general Security & Privacy pane
    try {
      shell.openPath("/System/Library/PreferencePanes/Security.prefPane/");
    } catch (fallbackError) {
      console.error("Error opening fallback privacy settings:", fallbackError);
    }
  }
}

// IPC handlers for permission-related functionality
ipcMain.handle("check-audio-permissions", async () => {
  return await checkPermissions();
});

ipcMain.handle("request-audio-permissions", async () => {
  return await requestPermissions();
});

ipcMain.handle(
  "open-privacy-settings",
  (event: IpcMainInvokeEvent, section: "microphone" | "screen") => {
    openPrivacySettings(section);
  }
);

// ====== macOS Audio Capture Functionality ======

// Generate unique temporary file paths for system and mic audio
function generateAudioFilePaths(): {
  systemAudioPath: string;
  micAudioPath: string;
} {
  try {
    // Get the app's temp directory
    const tempDir = app.getPath("temp");

    // Generate unique filenames
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const systemAudioPath = path.join(tempDir, `system-audio-${timestamp}.m4a`);
    const micAudioPath = path.join(tempDir, `mic-audio-${timestamp}.m4a`);

    console.log(`Generated audio paths: 
      System: ${systemAudioPath}
      Mic: ${micAudioPath}`);

    return {
      systemAudioPath,
      micAudioPath,
    };
  } catch (error) {
    console.error("Error generating audio file paths:", error);
    return {
      systemAudioPath: path.join(os.tmpdir(), `system-audio-${Date.now()}.m4a`),
      micAudioPath: path.join(os.tmpdir(), `mic-audio-${Date.now()}.m4a`),
    };
  }
}

/**
 * Get a list of available audio input devices
 * @returns {Promise<Array>} - Array of devices with id and name
 */
async function getAudioInputDevices(): Promise<
  Array<{ id: string; name: string }> | { error: string }
> {
  try {
    // Check if on macOS and ScreenCaptureKit is supported
    if (process.platform !== "darwin") {
      return { error: "Audio capture is only supported on macOS" };
    }

    if (!audioCaptureAddon.isScreenCaptureKitSupported()) {
      return {
        error:
          "Your macOS version does not support ScreenCaptureKit (requires macOS 12.3+)",
      };
    }

    // Get the list of devices from the native addon
    const devices = audioCaptureAddon.getAudioInputDevices();
    return devices;
  } catch (error: any) {
    console.error("Error getting audio input devices:", error);
    return { error: error.message || "Failed to get audio devices" };
  }
}

/**
 * Start recording both system audio and microphone input
 * @param {string} micDeviceID - ID of the microphone device to use (optional, uses default if empty)
 * @returns {Promise<Object>} - Object containing recording paths or error
 */
async function startAudioRecording(micDeviceID: string = ""): Promise<
  | {
      success: true;
      paths: RecordingPaths;
    }
  | { error: string }
> {
  try {
    // Check permissions first
    const permissions = await checkPermissions();

    // For screen recording, if status is 'not-determined', the actual attempt to
    // record will trigger the system permission prompt
    if (permissions.microphone !== "granted") {
      return {
        error:
          "Missing microphone permission. Please grant microphone permission.",
      };
    }

    // For screen permission, we'll proceed even if it's 'not-determined'
    // The actual recording attempt will trigger the system prompt
    if (
      permissions.screen !== "granted" &&
      permissions.screen !== "not-determined"
    ) {
      return {
        error:
          "Screen recording permission denied. Please grant screen recording permission in System Settings.",
      };
    }

    // Check if on macOS and ScreenCaptureKit is supported
    if (process.platform !== "darwin") {
      return { error: "Audio capture is only supported on macOS" };
    }

    if (!audioCaptureAddon.isScreenCaptureKitSupported()) {
      return {
        error:
          "Your macOS version does not support ScreenCaptureKit (requires macOS 12.3+)",
      };
    }

    // Generate temp file paths
    const paths = generateAudioFilePaths();

    // Start recording using the native addon
    const success = audioCaptureAddon.startRecording(
      micDeviceID,
      paths.systemAudioPath,
      paths.micAudioPath
    );

    if (success) {
      // Save the paths for later
      recordingPaths = {
        systemAudio: paths.systemAudioPath,
        micAudio: paths.micAudioPath,
      };

      console.log("Recording started successfully");
      return {
        success: true,
        paths: recordingPaths,
      };
    } else {
      return { error: "Failed to start recording" };
    }
  } catch (error: any) {
    console.error("Error starting audio recording:", error);
    return { error: error.message || "Failed to start audio recording" };
  }
}

/**
 * Stop the current audio recording
 * @returns {Promise<Object>} - Object containing recording paths or error
 */
async function stopAudioRecording(): Promise<
  | {
      success: true;
      paths: RecordingPaths;
    }
  | { error: string; paths?: RecordingPaths }
> {
  try {
    // Check if we have active recording paths
    if (!recordingPaths.systemAudio || !recordingPaths.micAudio) {
      return { error: "No active recording to stop" };
    }

    // Stop the recording using the native addon
    const success = audioCaptureAddon.stopRecording();

    if (success) {
      console.log("Recording stopped successfully");

      // Check if the files exist
      const systemAudioExists = fs.existsSync(recordingPaths.systemAudio);
      const micAudioExists = fs.existsSync(recordingPaths.micAudio);

      // If either file doesn't exist, something went wrong
      if (!systemAudioExists || !micAudioExists) {
        console.error(`Missing output files: 
          System audio exists: ${systemAudioExists}
          Mic audio exists: ${micAudioExists}`);

        return {
          error: "One or more output files are missing",
          paths: recordingPaths,
        };
      }

      // Return the paths to the recorded files
      const resultPaths = { ...recordingPaths };

      // Clear the active recording paths
      recordingPaths = {
        systemAudio: null,
        micAudio: null,
      };

      return {
        success: true,
        paths: resultPaths,
      };
    } else {
      return { error: "Failed to stop recording" };
    }
  } catch (error: any) {
    console.error("Error stopping audio recording:", error);
    return { error: error.message || "Failed to stop audio recording" };
  }
}

// IPC handlers for audio recording functionality
ipcMain.handle("get-audio-devices", async () => {
  return await getAudioInputDevices();
});

ipcMain.handle(
  "start-audio-recording",
  async (event: IpcMainInvokeEvent, micDeviceID: string) => {
    return await startAudioRecording(micDeviceID);
  }
);

ipcMain.handle("stop-audio-recording", async () => {
  return await stopAudioRecording();
});

// Check if ScreenCaptureKit is supported on this macOS version
ipcMain.handle("check-screencapturekit-support", () => {
  try {
    if (process.platform !== "darwin") {
      return { supported: false, reason: "Not on macOS" };
    }

    const supported = audioCaptureAddon.isScreenCaptureKitSupported();
    return {
      supported,
      reason: supported ? null : "Requires macOS 12.3 or later",
    };
  } catch (error: any) {
    console.error("Error checking ScreenCaptureKit support:", error);
    return {
      supported: false,
      reason: error.message || "Error checking ScreenCaptureKit support",
    };
  }
});

// ====== Recording State Management IPC Handlers ======

/**
 * Start the recording process for a specific event using browser-based capture
 * @param {string} eventId - The ID of the event being recorded
 */
ipcMain.handle(
  "start-recording",
  async (event: IpcMainInvokeEvent, eventId: string) => {
    try {
      // Store the event ID for the recording
      activeRecordingEventId = eventId;

      // Update recording state to checking permissions
      recordingState = RECORDING_STATES.CHECKING_PERMISSIONS;
      event.sender.send("recording-state-update", recordingState, eventId);

      // Set up local server for browser-based capture
      try {
        const port = await setupLocalServer();

        // Update to WAITING_FOR_BROWSER state
        recordingState = RECORDING_STATES.WAITING_FOR_BROWSER;
        event.sender.send("recording-state-update", recordingState);

        // Construct URL with eventId and port parameters
        const captureUrl = `http://localhost:${port}?eventId=${eventId}&port=${port}`;

        // Open the URL in default browser
        console.log(`Opening capture page in browser: ${captureUrl}`);
        await shell.openExternal(captureUrl);

        // The actual recording state change will happen when browser page connects
        // and sends the recording_started status via WebSocket

        return { success: true };
      } catch (error: any) {
        console.error("Failed to set up browser-based capture:", error);
        event.sender.send(
          "recording-error",
          `Failed to set up browser-based capture: ${error.message}`
        );
        recordingState = RECORDING_STATES.IDLE;
        event.sender.send("recording-state-update", recordingState);
        activeRecordingEventId = null;
        return { error: error.message };
      }
    } catch (error: any) {
      console.error("Error starting recording:", error);
      event.sender.send(
        "recording-error",
        `Error starting recording: ${error.message}`
      );
      recordingState = RECORDING_STATES.IDLE;
      event.sender.send("recording-state-update", recordingState);
      activeRecordingEventId = null;
      return { error: error.message || "Unknown error starting recording" };
    }
  }
);

/**
 * Mix audio files (for use directly via IPC)
 * @param {string} systemAudioPath - Path to the system audio file
 * @param {string} micAudioPath - Path to the microphone audio file
 * @returns {Promise<Object>} - Object containing the mixed audio file path or error
 */
async function mixAudio(
  systemAudioPath: string,
  micAudioPath: string
): Promise<{ success: true; mixedAudioPath: string } | { error: string }> {
  try {
    // Generate an output path for the mixed audio
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const outputAudioPath = path.join(
      app.getPath("temp"),
      `mixed-audio-${timestamp}.wav`
    );

    // Verify input files exist
    if (!fs.existsSync(systemAudioPath)) {
      return { error: `System audio file not found at: ${systemAudioPath}` };
    }

    if (!fs.existsSync(micAudioPath)) {
      return { error: `Microphone audio file not found at: ${micAudioPath}` };
    }

    // Mix the audio files
    console.log(`Mixing audio files...`);
    const mixedAudioPath = await mixAudioFiles(
      systemAudioPath,
      micAudioPath,
      outputAudioPath
    );

    console.log(
      `Audio mixing completed successfully. Mixed file: ${mixedAudioPath}`
    );

    return {
      success: true,
      mixedAudioPath,
    };
  } catch (error: any) {
    console.error("Error mixing audio files:", error);
    return { error: error.message || "Unknown error during audio mixing" };
  }
}

// IPC handler for mixing audio
ipcMain.handle(
  "mix-audio",
  async (
    event: IpcMainInvokeEvent,
    systemAudioPath: string,
    micAudioPath: string
  ) => {
    return await mixAudio(systemAudioPath, micAudioPath);
  }
);

// Import the transcription queue
import {
  initTranscriptionQueue,
  addJobToQueue,
  getJobs,
  getJobById,
  getJobsByEventId,
  clearCompletedJobs,
} from "./transcription/queue";

// Import storage functions
import {
  saveSetting,
  loadSetting,
  saveAllSettings,
  loadAllSettings,
  saveMeetingNote,
  loadMeetingNote,
  saveInitialMeetingDetails,
  saveTranscriptionResult,
  loadTranscript,
  saveRecordingPaths,
  loadRecordingPaths,
  saveSummary,
  loadSummary,
  loadMeetingData,
  getAllMeetings,
  deleteMeetingData,
} from "./storage/store";

// Import main process settings
import { getSetting, getSettings } from "./storage/mainSettings";

// ====== Transcription Setup IPC Handlers ======

/**
 * Check if the transcription dependencies are properly set up
 */
ipcMain.handle("check-transcription-setup", () => {
  return setupFunctions.checkSetup();
});

/**
 * Get available whisper models
 */
ipcMain.handle("get-whisper-models", () => {
  return setupFunctions.getModels();
});

// Initialize transcription queue when app is ready
app.whenReady().then(() => {
  console.log("Initializing transcription queue...");
  initTranscriptionQueue();
});

// ====== Transcription Queue IPC Handlers ======

/**
 * Get all jobs in the transcription queue
 */
ipcMain.handle("get-transcription-jobs", () => {
  return getJobs();
});

/**
 * Get a specific job by ID
 */
ipcMain.handle(
  "get-transcription-job",
  (event: IpcMainInvokeEvent, jobId: string) => {
    return getJobById(jobId);
  }
);

/**
 * Get all jobs for a specific event
 */
ipcMain.handle(
  "get-transcription-jobs-by-event",
  (event: IpcMainInvokeEvent, eventId: string) => {
    return getJobsByEventId(eventId);
  }
);

/**
 * Clear completed and failed jobs from the queue
 */
ipcMain.handle("clear-completed-transcription-jobs", () => {
  return clearCompletedJobs();
});

/**
 * Retry a failed transcription
 */
ipcMain.handle(
  "retry-transcription",
  async (event: IpcMainInvokeEvent, eventId: string, jobId?: string) => {
    try {
      console.log(
        `Retrying transcription for event ${eventId}, original job: ${
          jobId || "unknown"
        }`
      );

      // First try to get recording paths from storage
      const storedPaths = loadRecordingPaths(eventId);

      if (
        storedPaths &&
        storedPaths.system &&
        storedPaths.mic &&
        fs.existsSync(storedPaths.system) &&
        fs.existsSync(storedPaths.mic)
      ) {
        console.log(`Using stored recording paths for event ${eventId}`);

        // Use the stored paths
        const newJob = addJobToQueue(
          eventId,
          storedPaths.system,
          storedPaths.mic,
          loadSetting("whisperModel", "base.en") // Use current model setting
        );

        console.log(
          `Created new job ${newJob.jobId} for retry of event ${eventId} using stored paths`
        );

        // Return success
        return { success: true, jobId: newJob.jobId };
      }

      // If no stored paths or files don't exist, try the active queue
      console.log("Stored paths not available, checking active queue jobs");

      // Find the original job to get the audio file paths
      const jobs = getJobsByEventId(eventId);

      // If no jobs found, we can't retry
      if (jobs.length === 0) {
        return {
          error:
            "No previous transcription job found for this event. The recording files may have been deleted.",
        };
      }

      // Get the most recent job
      const sortedJobs = [...jobs].sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );

      const originalJob = sortedJobs[0];

      // Check if we still have the audio files
      if (
        !fs.existsSync(originalJob.systemAudioPath) ||
        !fs.existsSync(originalJob.micAudioPath)
      ) {
        return {
          error: "Audio files are no longer available. Please record again.",
        };
      }

      // Create a new job with the same audio files
      const newJob = addJobToQueue(
        eventId,
        originalJob.systemAudioPath,
        originalJob.micAudioPath,
        originalJob.modelName || loadSetting("whisperModel", "base.en")
      );

      console.log(
        `Created new job ${newJob.jobId} for retry of event ${eventId} using queue job paths`
      );

      // Return success
      return { success: true, jobId: newJob.jobId };
    } catch (error: any) {
      console.error("Error retrying transcription:", error);
      return { error: error.message || "Failed to retry transcription" };
    }
  }
);

// ====== Meeting URL Handling ======

/**
 * Open meeting URL in default browser
 */
ipcMain.handle(
  "open-meeting-url",
  async (event: IpcMainInvokeEvent, url: string) => {
    try {
      console.log(`Opening meeting URL in default browser: ${url}`);
      await shell.openExternal(url);
      return { success: true };
    } catch (error: any) {
      console.error("Error opening meeting URL:", error);
      return { error: error.message || "Failed to open meeting URL" };
    }
  }
);

// ====== Local Storage IPC Handlers ======

/**
 * Save meeting note
 */
ipcMain.handle(
  "save-meeting-note",
  async (event: IpcMainInvokeEvent, eventId: string, noteContent: string) => {
    try {
      saveMeetingNote(eventId, noteContent);
      return { success: true };
    } catch (error: any) {
      console.error("Error saving meeting note:", error);
      return { error: error.message || "Failed to save note" };
    }
  }
);

/**
 * Load meeting note
 */
ipcMain.handle(
  "load-meeting-note",
  async (event: IpcMainInvokeEvent, eventId: string) => {
    try {
      const note = loadMeetingNote(eventId);
      return { success: true, note };
    } catch (error: any) {
      console.error("Error loading meeting note:", error);
      return { error: error.message || "Failed to load note" };
    }
  }
);

/**
 * Save transcription result
 */
ipcMain.handle(
  "save-transcription-result",
  async (
    event: IpcMainInvokeEvent,
    eventId: string,
    status: "completed" | "failed",
    transcript?: string,
    error?: string
  ) => {
    try {
      saveTranscriptionResult(eventId, status, transcript, error);
      return { success: true };
    } catch (error: any) {
      console.error("Error saving transcription result:", error);
      return { error: error.message || "Failed to save transcription" };
    }
  }
);

/**
 * Save initial meeting details from Google Calendar
 */
ipcMain.handle(
  "save-meeting-details",
  async (event: IpcMainInvokeEvent, eventId: string, eventDetails: any) => {
    try {
      saveInitialMeetingDetails(eventId, eventDetails);
      return { success: true };
    } catch (error: any) {
      console.error("Error saving meeting details:", error);
      return { error: error.message || "Failed to save meeting details" };
    }
  }
);

/**
 * Load transcript
 */
ipcMain.handle(
  "load-transcript",
  async (event: IpcMainInvokeEvent, eventId: string) => {
    try {
      const transcriptData = loadTranscript(eventId);
      return { success: true, data: transcriptData };
    } catch (error: any) {
      console.error("Error loading transcript:", error);
      return { error: error.message || "Failed to load transcript" };
    }
  }
);

/**
 * Save summary
 */
ipcMain.handle(
  "save-summary",
  async (
    event: IpcMainInvokeEvent,
    eventId: string,
    summaryText: string,
    modelUsed: string
  ) => {
    try {
      saveSummary(eventId, summaryText, modelUsed);
      return { success: true };
    } catch (error: any) {
      console.error("Error saving summary:", error);
      return { error: error.message || "Failed to save summary" };
    }
  }
);

/**
 * Load summary
 */
ipcMain.handle(
  "load-summary",
  async (event: IpcMainInvokeEvent, eventId: string) => {
    try {
      const summaryData = loadSummary(eventId);
      return { success: true, data: summaryData };
    } catch (error: any) {
      console.error("Error loading summary:", error);
      return { error: error.message || "Failed to load summary" };
    }
  }
);

/**
 * Load all meeting data
 */
ipcMain.handle(
  "load-meeting-data",
  async (event: IpcMainInvokeEvent, eventId: string) => {
    try {
      const meetingData = loadMeetingData(eventId);
      return { success: true, data: meetingData };
    } catch (error: any) {
      console.error("Error loading meeting data:", error);
      return { error: error.message || "Failed to load meeting data" };
    }
  }
);

/**
 * Get all meetings
 */
ipcMain.handle("get-all-meetings", async () => {
  try {
    const meetings = getAllMeetings();
    return { success: true, meetings };
  } catch (error: any) {
    console.error("Error getting all meetings:", error);
    return { error: error.message || "Failed to get meetings" };
  }
});

/**
 * Delete meeting data
 */
ipcMain.handle(
  "delete-meeting-data",
  async (event: IpcMainInvokeEvent, eventId: string) => {
    try {
      const success = deleteMeetingData(eventId);
      return { success };
    } catch (error: any) {
      console.error("Error deleting meeting data:", error);
      return { error: error.message || "Failed to delete meeting data" };
    }
  }
);

/**
 * Save setting
 */
ipcMain.handle(
  "save-setting",
  async (event: IpcMainInvokeEvent, key: string, value: any) => {
    try {
      saveSetting(key, value);
      return { success: true };
    } catch (error: any) {
      console.error("Error saving setting:", error);
      return { error: error.message || "Failed to save setting" };
    }
  }
);

/**
 * Load setting
 */
ipcMain.handle(
  "load-setting",
  async (event: IpcMainInvokeEvent, key: string, defaultValue: any) => {
    try {
      const value = loadSetting(key, defaultValue);
      return { success: true, value };
    } catch (error: any) {
      console.error("Error loading setting:", error);
      return { error: error.message || "Failed to load setting" };
    }
  }
);

/**
 * Save all settings
 */
ipcMain.handle(
  "save-all-settings",
  async (event: IpcMainInvokeEvent, settings: any) => {
    try {
      saveAllSettings(settings);
      return { success: true };
    } catch (error: any) {
      console.error("Error saving all settings:", error);
      return { error: error.message || "Failed to save all settings" };
    }
  }
);

/**
 * Load all settings
 */
ipcMain.handle("load-all-settings", async () => {
  try {
    const settings = loadAllSettings();
    return { success: true, settings };
  } catch (error: any) {
    console.error("Error loading all settings:", error);
    return { error: error.message || "Failed to load all settings" };
  }
});

/**
 * Save LLM settings
 */
ipcMain.handle(
  "save-llm-settings",
  async (
    event: IpcMainInvokeEvent,
    settings: {
      ollamaUrl: string;
      ollamaModel: string;
      claudeKey: string;
      geminiKey: string;
    }
  ) => {
    try {
      // Save each setting individually
      saveSetting("llmApiKeys.ollama", settings.ollamaUrl);
      saveSetting("ollamaModel", settings.ollamaModel);
      saveSetting("llmApiKeys.claude", settings.claudeKey);
      saveSetting("llmApiKeys.gemini", settings.geminiKey);

      return { success: true };
    } catch (error: any) {
      console.error("Error saving LLM settings:", error);
      return { error: error.message || "Failed to save LLM settings" };
    }
  }
);

/**
 * Generate a summary using specified LLM service
 */
ipcMain.handle(
  "generate-summary",
  async (
    event: IpcMainInvokeEvent,
    eventId: string,
    serviceType: "ollama" | "claude" | "gemini"
  ) => {
    try {
      // Load the transcript for this event
      const transcriptData = loadTranscript(eventId);

      // Check if we have a transcript
      if (!transcriptData?.text) {
        return {
          success: false,
          error: "No transcript found for this event",
        };
      }

      // Get the transcript text
      const transcriptText = transcriptData.text;

      // Load the appropriate API key/URL/model from settings
      let apiKeyOrUrl: string;
      let modelName: string | null = null;

      switch (serviceType) {
        case "ollama": {
          apiKeyOrUrl = loadSetting("llmApiKeys.ollama", "");
          modelName = loadSetting("ollamaModel", "llama3");

          if (!apiKeyOrUrl) {
            return {
              success: false,
              error:
                "Ollama URL not configured. Please set it in the Settings.",
            };
          }
          break;
        }

        case "claude": {
          apiKeyOrUrl = loadSetting("llmApiKeys.claude", "");

          if (!apiKeyOrUrl) {
            return {
              success: false,
              error:
                "Claude API key not configured. Please set it in the Settings.",
            };
          }
          break;
        }

        case "gemini": {
          apiKeyOrUrl = loadSetting("llmApiKeys.gemini", "");

          if (!apiKeyOrUrl) {
            return {
              success: false,
              error:
                "Gemini API key not configured. Please set it in the Settings.",
            };
          }
          break;
        }

        default:
          return {
            success: false,
            error: `Unsupported LLM service: ${serviceType}`,
          };
      }

      // Import the generateSummary function here to avoid circular dependencies
      const { generateSummary } = await import("./llm/api");

      // Generate the summary
      const summary = await generateSummary(
        transcriptText,
        serviceType,
        apiKeyOrUrl,
        modelName
      );

      // Save the summary to storage
      saveSummary(eventId, summary, serviceType);

      return {
        success: true,
        summary,
      };
    } catch (error: any) {
      console.error("Error generating summary:", error);
      return {
        success: false,
        error: error.message || "Failed to generate summary",
      };
    }
  }
);

/**
 * Export content to a file
 */
ipcMain.handle(
  "export-file",
  async (
    event: IpcMainInvokeEvent,
    options: {
      content: string;
      filename: string;
      title?: string;
    }
  ) => {
    try {
      // Show save dialog
      const { content, filename, title = "Export File" } = options;

      const saveDialogResult = await dialog.showSaveDialog({
        title,
        defaultPath: path.join(app.getPath("documents"), filename),
        filters: [
          { name: "Text Files", extensions: ["txt"] },
          { name: "All Files", extensions: ["*"] },
        ],
        properties: ["createDirectory"],
      });

      // If canceled
      if (saveDialogResult.canceled || !saveDialogResult.filePath) {
        return { success: false, canceled: true };
      }

      // Write the content to the selected file
      fs.writeFileSync(saveDialogResult.filePath, content, "utf8");

      return {
        success: true,
        path: saveDialogResult.filePath,
      };
    } catch (error: any) {
      console.error("Error exporting file:", error);
      return {
        success: false,
        error: error.message || "Failed to export file",
      };
    }
  }
);

ipcMain.handle("stop-recording", async (event: IpcMainInvokeEvent) => {
  try {
    // Check if we're actually recording
    if (recordingState !== RECORDING_STATES.RECORDING) {
      console.log("Not recording, nothing to stop");
      return { error: "Not currently recording" };
    }

    // Update state to stopping
    recordingState = RECORDING_STATES.STOPPING;
    event.sender.send("recording-state-update", recordingState);

    // Send the stop command to browser via WebSocket
    if (activeWebSocketClient) {
      activeWebSocketClient.send(
        JSON.stringify({ command: "stop", eventId: activeRecordingEventId })
      );
      console.log("Sent stop command to browser");

      // The actual processing and state updates will be handled when the
      // browser confirms it has stopped via the 'stopped' status message

      return { success: true };
    } else {
      console.warn("No active WebSocket client to send stop command to");

      // If we somehow lost the WebSocket connection, reset the state
      recordingState = RECORDING_STATES.IDLE;
      event.sender.send("recording-state-update", recordingState);
      activeRecordingEventId = null;

      return { error: "No active capture connection" };
    }
  } catch (error: any) {
    console.error("Error stopping recording:", error);
    event.sender.send(
      "recording-error",
      `Error stopping recording: ${error.message}`
    );
    recordingState = RECORDING_STATES.IDLE;
    event.sender.send("recording-state-update", recordingState);
    activeRecordingEventId = null;

    return { error: error.message || "Unknown error stopping recording" };
  }
});
