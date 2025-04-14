// This file will handle the renderer process logic
import { ipcRenderer } from "electron";
import { SettingsModal } from "./components/SettingsModal";

// Types
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

interface AudioDevice {
  id: string;
  name: string;
}

// Get elements
const prevDayButton = document.getElementById("prev-day") as HTMLButtonElement;
const nextDayButton = document.getElementById("next-day") as HTMLButtonElement;
const currentDateElement = document.getElementById(
  "current-date"
) as HTMLElement;
const googleAuthButton = document.getElementById(
  "google-auth-button"
) as HTMLButtonElement;
const authStatusElement = document.getElementById("auth-status") as HTMLElement;
const eventListElement = document.getElementById("event-list") as HTMLElement;
const detailPaneContentElement = document.getElementById(
  "detail-pane-content"
) as HTMLElement;
const settingsButton = document.getElementById("settings-button") as HTMLButtonElement;

// Create settings modal instance
const settingsModal = new SettingsModal();

// State variables
let selectedDate: Date = new Date();
let selectedEvent: CalendarEvent | null = null;
let recordingState: RECORDING_STATES = RECORDING_STATES.IDLE;
let activeRecordingEventId: string | null = null;
let recordingPaths: {
  systemAudio: string | null;
  micAudio: string | null;
} | null = null;
let recordButton: HTMLButtonElement | null = null;
let audioDevices: AudioDevice[] = [];
let selectedMicDevice: string = ""; // Empty string means use default mic

// Transcription state management
interface TranscriptionState {
  eventId: string;
  status:
    | "idle"
    | "queued"
    | "mixing"
    | "transcribing"
    | "completed"
    | "failed";
  progress?: number;
  transcript?: string;
  error?: string;
  jobId?: string;
}

// Map to store transcription state by event ID
const transcriptionStateMap = new Map<string, TranscriptionState>();

// Format a date for display
function formatDate(date: Date): string {
  const options: Intl.DateTimeFormatOptions = {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  };
  return date.toLocaleDateString("en-US", options);
}

// Format time in a readable format (HH:MM AM/PM)
function formatTime(dateString?: string): string {
  if (!dateString) return "All day";

  const date = new Date(dateString);
  return date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

// Format a date range for display (Jun 15, 2023 4:30 PM - 5:30 PM)
function formatDateTimeRange(
  startDateTime?: string,
  endDateTime?: string
): string {
  if (!startDateTime || !endDateTime) return "All day";

  const startDate = new Date(startDateTime);
  const endDate = new Date(endDateTime);

  const options: Intl.DateTimeFormatOptions = {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  };

  // Format the dates
  let startStr = startDate.toLocaleString("en-US", options);
  let endStr: string;

  // If same day, only show the time for end
  if (startDate.toDateString() === endDate.toDateString()) {
    endStr = endDate.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  } else {
    endStr = endDate.toLocaleString("en-US", options);
  }

  return `${startStr} - ${endStr}`;
}

// Extract meeting link from event
function extractMeetingLink(event: CalendarEvent): string | null {
  // First check for hangoutLink
  if (event.hangoutLink) {
    return event.hangoutLink;
  }

  // Check in description for common meeting URLs
  if (event.description) {
    const urlRegex =
      /(https?:\/\/[^\s]+\.(zoom|meet|teams|webex|gotomeeting)\.[^\s]+)/i;
    const match = event.description.match(urlRegex);
    if (match) {
      return match[0];
    }
  }

  // Check in location
  if (event.location) {
    const urlRegex = /(https?:\/\/[^\s]+)/i;
    const match = event.location.match(urlRegex);
    if (match) {
      return match[0];
    }
  }

  return null;
}

// Update UI to show the selected date
function updateDateDisplay(): void {
  currentDateElement.textContent = formatDate(selectedDate);
}

// Update UI based on authentication state
function updateAuthUI(isAuthenticated: boolean): void {
  if (isAuthenticated) {
    googleAuthButton.textContent = "Disconnect Google Calendar";
    googleAuthButton.classList.remove("disconnected");
    googleAuthButton.classList.add("connected");
    authStatusElement.textContent = "Connected to Google Calendar";

    // Fetch events when authenticated
    fetchEvents();
  } else {
    googleAuthButton.textContent = "Connect Google Calendar";
    googleAuthButton.classList.remove("connected");
    googleAuthButton.classList.add("disconnected");
    authStatusElement.textContent = "Not connected";

    // Clear events when not authenticated
    displayNoEventsMessage("Connect to Google Calendar to see your events");
  }
}

// Fetch events for the selected date
async function fetchEvents(): Promise<void> {
  try {
    // Check if authenticated
    const isAuthenticated = await ipcRenderer.invoke("google-auth-check");
    if (!isAuthenticated) {
      displayNoEventsMessage("Connect to Google Calendar to see your events");
      return;
    }

    // Show loading state
    displayNoEventsMessage("Loading events...");

    // Convert date to ISO string and fetch events
    const events = await ipcRenderer.invoke(
      "fetch-events",
      selectedDate.toISOString()
    );

    // Check for error
    if (events && "error" in events) {
      displayNoEventsMessage(`Error: ${events.error}`);
      return;
    }

    // Display events or no events message
    if (!events || events.length === 0) {
      displayNoEventsMessage("No events for this day");
    } else {
      await displayEvents(events as CalendarEvent[]);
    }
  } catch (error) {
    console.error("Error fetching events:", error);
    displayNoEventsMessage("Failed to load events");
  }
}

// Display a message when there are no events
function displayNoEventsMessage(message: string): void {
  eventListElement.innerHTML = `
    <div class="placeholder">
      <p>${message}</p>
    </div>
  `;
}

// Import the summary UI functions
import { initSummaryTab } from './summarization/ui';

// Display event details in the right pane
async function displayEventDetails(event: CalendarEvent): Promise<void> {
  // Update selectedEvent state
  selectedEvent = event;

  // Extract meeting link if available
  const meetingLink = extractMeetingLink(event);

  // Format date and time
  const dateTimeString = formatDateTimeRange(
    event.start?.dateTime,
    event.end?.dateTime
  );

  // Format attendees if available
  let attendeesHTML = "";
  if (event.attendees && event.attendees.length > 0) {
    attendeesHTML = `
      <div class="detail-section">
        <h3>Attendees</h3>
        <div class="attendees-list">
          ${event.attendees
            .map((a) => `<div class="attendee">${a.email}</div>`)
            .join("")}
        </div>
      </div>
    `;
  }

  // Format location if available
  let locationHTML = "";
  if (event.location) {
    locationHTML = `
      <div class="detail-section">
        <h3>Location</h3>
        <div class="location">${event.location}</div>
      </div>
    `;
  }

  // Build the detail pane HTML
  detailPaneContentElement.innerHTML = `
    <div class="detail-container">
      <div class="header-section">
        <h2>${event.summary || "Untitled Event"}</h2>
        <div class="datetime">${dateTimeString}</div>
      </div>
      
      <div class="info-section">
        ${
          event.description
            ? `
        <div class="detail-section">
          <h3>Description</h3>
          <div class="description">${
            event.description || "No description"
          }</div>
        </div>`
            : ""
        }
        
        ${attendeesHTML}
        ${locationHTML}
        
        ${
          meetingLink
            ? `
        <div class="detail-section">
          <h3>Meeting Link</h3>
          <div class="meeting-link">
            <a href="${meetingLink}" target="_blank">${meetingLink}</a>
          </div>
        </div>`
            : ""
        }
      </div>
      
      <div class="action-buttons">
        <button id="join-meeting-btn" class="action-btn" ${
          !meetingLink ? "disabled" : ""
        }>
          Join Meeting
        </button>
        <button id="record-transcribe-btn" class="action-btn">
          Record & Transcribe
        </button>
      </div>
      
      <div class="tabbed-section">
        <div class="tabs">
          <button class="tab-btn active" data-tab="notes">Notes</button>
          <button class="tab-btn" data-tab="transcript">Transcript</button>
          <button class="tab-btn" data-tab="summary">Summary</button>
        </div>
        
        <div class="tab-content">
          <div id="notes-tab" class="tab-pane active">
            <div class="notes-toolbar">
              <button id="export-notes-btn" class="notes-btn" title="Export Notes">
                <span class="notes-btn-icon">📥</span>
                <span class="notes-btn-text">Export</span>
              </button>
              <button id="copy-notes-btn" class="notes-btn" title="Copy Notes">
                <span class="notes-btn-icon">📋</span>
                <span class="notes-btn-text">Copy</span>
              </button>
            </div>
            <div class="notes-container">
              <textarea class="notes-area" placeholder="Add your notes here..."></textarea>
              <div class="notes-status" id="notes-status"></div>
            </div>
          </div>
          
          <div id="transcript-tab" class="tab-pane">
            <div class="transcript-content">
              <div class="loading-indicator">Checking for transcriptions...</div>
            </div>
          </div>
          
          <div id="summary-tab" class="tab-pane">
            <div class="summary-content">No summary available yet.</div>
            <button id="generate-summary-btn" class="action-btn" disabled>Generate Summary</button>
          </div>
        </div>
      </div>
    </div>
  `;

  // Set up tab switching functionality
  const tabButtons = detailPaneContentElement.querySelectorAll(".tab-btn");
  const tabPanes = detailPaneContentElement.querySelectorAll(".tab-pane");

  tabButtons.forEach((button) => {
    button.addEventListener("click", () => {
      // Remove active class from all buttons and panes
      tabButtons.forEach((btn) => btn.classList.remove("active"));
      tabPanes.forEach((pane) => pane.classList.remove("active"));

      // Add active class to clicked button and corresponding pane
      button.classList.add("active");
      const tabName = button.getAttribute("data-tab");
      if (tabName) {
        const tabPane = document.getElementById(`${tabName}-tab`);
        if (tabPane) {
          tabPane.classList.add("active");
        } else {
          console.error(`Tab pane element not found for tab: ${tabName}`);
        }
      }
    });
  });

  // Set up join meeting button functionality to open meeting URL in browser
  const joinMeetingBtn = document.getElementById("join-meeting-btn");
  if (joinMeetingBtn) {
    joinMeetingBtn.addEventListener("click", async () => {
      if (meetingLink) {
        console.log("Join meeting clicked:", meetingLink);
        try {
          const result = await ipcRenderer.invoke("open-meeting-url", meetingLink);
          if (!result.success && result.error) {
            showNotification("Error", `Failed to open meeting link: ${result.error}`);
          }
        } catch (error) {
          console.error("Error opening meeting link:", error);
          showNotification("Error", "Failed to open meeting link");
        }
      }
    });
  }

  // Set up record & transcribe button functionality
  const recordTranscribeBtn = document.getElementById("record-transcribe-btn");
  if (recordTranscribeBtn) {
    recordTranscribeBtn.addEventListener("click", () => {
      console.log("Record & Transcribe clicked");
      handleRecordButtonClick();
    });
  }

  // Check for existing transcription for this event
  if (event.id) {
    try {
      // First, check if we have a saved state in our state map
      let state = transcriptionStateMap.get(event.id);

      // If no state in memory, try to load from persistent storage
      if (!state) {
        try {
          // Get transcription data from main process
          const result = await ipcRenderer.invoke("load-transcript", event.id);

          if (result.success && result.data) {
            // Create a state from the loaded data
            const loadedState: TranscriptionState = {
              eventId: event.id,
              status: (result.data.status as any) || "idle",
              progress: result.data.progress,
              transcript: result.data.text,
              error: result.data.error,
            };

            // Add to our state map
            transcriptionStateMap.set(event.id, loadedState);
            state = loadedState;

            console.log(
              `Loaded transcription state from persistent storage for event ${event.id}: ${state.status}`
            );
          }
        } catch (storageError) {
          console.error(
            "Error loading transcription from persistent storage:",
            storageError
          );
        }

        // If still no state, try localStorage as fallback
        if (!state) {
          const savedState = loadTranscriptionState(event.id);
          if (savedState) {
            // Add to our state map
            transcriptionStateMap.set(event.id, savedState);
            state = savedState;
            console.log(
              `Loaded transcription state from localStorage for event ${event.id}: ${state.status}`
            );
          }
        }
      }

      // If we have a state (from any source)
      if (state) {
        console.log(
          `Using existing transcription state for event ${event.id}: ${state.status}`
        );

        // If the state is completed or failed, just use it directly
        if (state.status === "completed" || state.status === "failed") {
          updateTranscriptTab(state);
        } else {
          // For other statuses, get the latest from the queue since they might have changed
          checkLatestJobStatus(event.id);
        }
      } else {
        // No state found, check for active jobs in the queue
        checkLatestJobStatus(event.id);
      }

      // Load notes for this event
      loadAndPopulateNotes(event.id);
      
      // Initialize the summary tab
      const summaryTab = document.getElementById("summary-tab");
      if (summaryTab) {
        initSummaryTab(summaryTab, event.id);
      } else {
        console.error('Summary tab element not found when trying to initialize');
      }
    } catch (error) {
      console.error("Error loading transcription state:", error);

      // Show error in transcript tab
      const transcriptTab = document.getElementById("transcript-tab");
      if (transcriptTab) {
        const transcriptContent = transcriptTab.querySelector(
          ".transcript-content"
        );
        if (transcriptContent) {
          transcriptContent.innerHTML = `<p>Error checking for transcriptions.</p>`;
        }
      }
    }
  }
}

/**
 * Check for the latest job status for an event from the main process
 */
async function checkLatestJobStatus(eventId: string): Promise<void> {
  try {
    // Get any existing transcription jobs for this event
    const jobs = await ipcRenderer.invoke(
      "get-transcription-jobs-by-event",
      eventId
    );
    console.log(`Found ${jobs.length} transcription jobs for event ${eventId}`);

    if (jobs && jobs.length > 0) {
      // Sort by created date descending to get the most recent job
      const sortedJobs = [...jobs].sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );

      const latestJob = sortedJobs[0];
      console.log(
        `Latest job for event ${eventId} has status: ${latestJob.status}`
      );

      // Update our state map with the latest job info
      updateTranscriptionState(eventId, {
        status: latestJob.status as any,
        progress: latestJob.progress,
        transcript: latestJob.transcript,
        error: latestJob.error,
        jobId: latestJob.jobId,
      });

      // Update the UI
      updateTranscriptTab(getTranscriptionState(eventId));
    } else {
      // No transcription jobs found for this event
      // Just update the UI with the default 'idle' state
      updateTranscriptTab(getTranscriptionState(eventId));
    }
  } catch (error) {
    console.error("Error fetching transcription jobs:", error);

    // Show error in transcript tab
    const transcriptTab = document.getElementById("transcript-tab");
    if (transcriptTab) {
      const transcriptContent = transcriptTab.querySelector(
        ".transcript-content"
      );
      if (transcriptContent) {
        transcriptContent.innerHTML = `<p>Error checking for transcriptions.</p>`;
      }
    }
  }
}

// Display default detail pane content (empty state)
function displayDefaultDetailPane(): void {
  selectedEvent = null;
  detailPaneContentElement.innerHTML = `
    <div class="placeholder">
      <p>Select a meeting to view details</p>
    </div>
  `;
}

// Display events in the event list
async function displayEvents(events: CalendarEvent[]): Promise<void> {
  // Clear the event list
  eventListElement.innerHTML = "";

  // Get indicators for meetings with saved data
  const meetingDataMap = new Map<
    string,
    {
      hasNotes: boolean;
      hasTranscript: boolean;
    }
  >();

  try {
    // Fetch all meetings with saved data
    const result = await ipcRenderer.invoke("get-all-meetings");

    if (result.success && result.meetings) {
      for (const meeting of result.meetings) {
        meetingDataMap.set(meeting.id, {
          hasNotes: meeting.hasNotes,
          hasTranscript: meeting.hasTranscript,
        });
      }
    }
  } catch (error) {
    console.error("Error getting meeting data indicators:", error);
  }

  // Create event elements
  events.forEach((event) => {
    // Get start and end times
    const startTime = event.start?.dateTime
      ? formatTime(event.start.dateTime)
      : "All day";
    const endTime = event.end?.dateTime ? formatTime(event.end.dateTime) : "";

    // Create event element
    const eventElement = document.createElement("div");
    eventElement.className = "event-item";
    eventElement.dataset.eventId = event.id;

    // Add selected class if this is the selected event
    if (selectedEvent && selectedEvent.id === event.id) {
      eventElement.classList.add("selected");
    }

    // Store event data for detail pane
    eventElement.addEventListener("click", () => {
      // Clear selected class from all events
      document.querySelectorAll(".event-item").forEach((el) => {
        el.classList.remove("selected");
      });

      // Add selected class to this event
      eventElement.classList.add("selected");

      // Display event details in the right pane
      displayEventDetails(event);
    });

    // Check if this meeting has saved data
    const hasData = meetingDataMap.get(event.id);
    const hasNotes = hasData?.hasNotes || false;
    const hasTranscript = hasData?.hasTranscript || false;

    // Create HTML for event
    eventElement.innerHTML = `
      <div class="event-time">${startTime}${
      endTime ? " - " + endTime : ""
    }</div>
      <div class="event-summary">${event.summary || "Untitled Event"}</div>
      <div class="event-icons">
        ${
          event.hangoutLink
            ? '<span class="icon video-icon" title="Has video call">📹</span>'
            : ""
        }
        ${
          event.location
            ? '<span class="icon location-icon" title="Has location">📍</span>'
            : ""
        }
        ${
          hasNotes
            ? '<span class="icon notes-icon" title="Has notes">📝</span>'
            : ""
        }
        ${
          hasTranscript
            ? '<span class="icon transcript-icon" title="Has transcript">📄</span>'
            : ""
        }
      </div>
    `;

    // Add to DOM
    eventListElement.appendChild(eventElement);
  });
}

async function handleGoogleAuth(): Promise<void> {
  console.log("handleGoogleAuth triggered"); // <-- ADD THIS
  try {
    // Get current auth state
    console.log("Checking auth state..."); // <-- ADD THIS
    const isAuthenticated = await ipcRenderer.invoke("google-auth-check");
    console.log(`Is authenticated: ${isAuthenticated}`); // <-- ADD THIS

    if (isAuthenticated) {
      // ... sign out logic ...
    } else {
      // User is not authenticated, trigger auth flow
      googleAuthButton.disabled = true;
      googleAuthButton.textContent = "Connecting...";

      console.log("Invoking google-auth-start..."); // <-- ADD THIS
      const success = await ipcRenderer.invoke("google-auth-start");
      console.log(`google-auth-start success: ${success}`); // <-- ADD THIS

      // Re-enable button
      googleAuthButton.disabled = false;

      // Update UI based on result
      updateAuthUI(success);
    }
  } catch (error) {
    console.error("Error handling Google authentication:", error); // <-- ENSURE THIS IS PRESENT
    // Reset button state on error
    googleAuthButton.disabled = false;
    updateAuthUI(false); // Or update based on known state before error
  }
}

// Navigate to previous day
function navigateToPreviousDay(): void {
  // Clone the date and subtract one day
  const prevDate = new Date(selectedDate);
  prevDate.setDate(prevDate.getDate() - 1);

  // Update selected date
  selectedDate = prevDate;
  updateDateDisplay();

  // Fetch events for the new date
  fetchEvents();
}

// Navigate to next day
function navigateToNextDay(): void {
  // Clone the date and add one day
  const nextDate = new Date(selectedDate);
  nextDate.setDate(nextDate.getDate() + 1);

  // Update selected date
  selectedDate = nextDate;
  updateDateDisplay();

  // Fetch events for the new date
  fetchEvents();
}

// Reset the detail pane when date changes
function resetDetailPane(): void {
  // Clear selected event
  selectedEvent = null;

  // Reset detail pane to default
  displayDefaultDetailPane();

  // Remove selected class from all events
  document.querySelectorAll(".event-item").forEach((el) => {
    el.classList.remove("selected");
  });
}

// Function to handle record button click
async function handleRecordButtonClick(): Promise<void> {
  // Get the currently selected event ID
  if (!selectedEvent) {
    showDialog("No Meeting Selected", "Please select a meeting to record.");
    return;
  }

  // If already recording, stop it
  if (recordingState === RECORDING_STATES.RECORDING) {
    await ipcRenderer.invoke("stop-recording");
    return;
  }

  // Get the eventId of the selected meeting
  const eventId = selectedEvent.id;

  // Start the recording process
  await ipcRenderer.invoke("start-recording", eventId);
}

// Check if the platform supports ScreenCaptureKit
async function checkScreenCaptureKitSupport(): Promise<{
  supported: boolean;
  reason: string | null;
}> {
  try {
    const supportInfo = await ipcRenderer.invoke(
      "check-screencapturekit-support"
    );
    return supportInfo;
  } catch (error) {
    console.error("Error checking ScreenCaptureKit support:", error);
    return { supported: false, reason: "Error checking support" };
  }
}

// Load available audio input devices
async function loadAudioDevices(): Promise<AudioDevice[]> {
  try {
    // Get audio devices from main process
    const devices = await ipcRenderer.invoke("get-audio-devices");

    // Check for error
    if (devices && "error" in devices) {
      console.error("Error loading audio devices:", devices.error);
      return [];
    }

    // Store devices for later use
    audioDevices = (devices as AudioDevice[]) || [];
    return audioDevices;
  } catch (error) {
    console.error("Error loading audio devices:", error);
    return [];
  }
}

// Update the visual recording indicator in the event list
function updateRecordingIndicator(recordingEventId: string | null): void {
  // Clear any existing recording indicators
  document
    .querySelectorAll(".event-item .recording-indicator")
    .forEach((el) => {
      el.remove();
    });

  // If no event is being recorded, we're done
  if (!recordingEventId) {
    return;
  }

  // Find the event item with the matching ID
  const eventItems = document.querySelectorAll(".event-item");
  eventItems.forEach((item) => {
    if (
      item instanceof HTMLElement &&
      item.dataset.eventId === recordingEventId
    ) {
      // Add a recording indicator to this event item
      const indicator = document.createElement("span");
      indicator.className = "recording-indicator";
      indicator.innerHTML = "⚫"; // Red dot (will be styled red in CSS)
      indicator.title = "Recording in progress";

      // Insert the indicator into the event-icons div
      const iconsContainer = item.querySelector(".event-icons");
      if (iconsContainer) {
        iconsContainer.prepend(indicator);
      } else {
        // If no icons container exists, append to the event item
        item.appendChild(indicator);
      }
    }
  });
}

// Initialize IPC listeners for recording state
function initRecordingListeners(): void {
  // Listen for recording state updates from the main process
  ipcRenderer.on(
    "recording-state-update",
    (event, newState: RECORDING_STATES, eventId?: string) => {
      console.log(`Recording state update: ${newState}, event ID: ${eventId}`);
      recordingState = newState;

      // Update the active recording event ID if provided
      if (eventId) {
        activeRecordingEventId = eventId;
      }

      // Update the UI based on the new state
      updateRecordButtonState(newState);

      // Show appropriate notifications based on state transitions
      if (newState === RECORDING_STATES.RECORDING) {
        showNotification("Recording Started", "Recording meeting audio...");
      } else if (newState === RECORDING_STATES.PROCESSING) {
        showNotification("Recording Stopped", "Processing audio recording...");
      }
    }
  );

  // Listen for recording errors from the main process
  ipcRenderer.on("recording-error", (event, errorMessage: string) => {
    console.error("Recording error:", errorMessage);
    showDialog("Recording Error", errorMessage);

    // Reset to IDLE state on error
    recordingState = RECORDING_STATES.IDLE;
    updateRecordButtonState(RECORDING_STATES.IDLE);
  });

  // Listen for transcription job queued
  ipcRenderer.on("transcription-queued", (event, job: any) => {
    console.log(`Job queued: ${job.jobId} for event ${job.eventId}`);
    showNotification(
      "Transcription Queued",
      "Audio recording has been queued for transcription"
    );

    // Update state map
    updateTranscriptionState(job.eventId, {
      eventId: job.eventId,
      status: "queued",
      jobId: job.jobId,
    });

    // If this job is for the currently displayed event, update the transcript tab
    if (selectedEvent && selectedEvent.id === job.eventId) {
      updateTranscriptTab(getTranscriptionState(job.eventId));
    }
  });

  // Listen for transcription status updates
  ipcRenderer.on("transcription-update", (event, job: any) => {
    console.log(
      `Transcription update: ${job.jobId}, status: ${job.status}, progress: ${
        job.progress || "N/A"
      }`
    );

    // Update state map
    updateTranscriptionState(job.eventId, {
      eventId: job.eventId,
      status: job.status as any,
      progress: job.progress,
      transcript: job.transcript,
      error: job.error,
      jobId: job.jobId,
    });

    // Save completed or failed states to localStorage (will be fully implemented in Chunk 12)
    if (job.status === "completed" || job.status === "failed") {
      const state = getTranscriptionState(job.eventId);
      saveTranscriptionState(state);
    }

    // If this job is for the currently displayed event, update the transcript tab
    if (selectedEvent && selectedEvent.id === job.eventId) {
      updateTranscriptTab(getTranscriptionState(job.eventId));
    }

    // Show notifications based on status
    if (job.status === "completed") {
      showNotification(
        "Transcription Complete",
        `Transcription of your meeting is now available`
      );
    } else if (job.status === "failed") {
      showNotification(
        "Transcription Failed",
        `There was an error transcribing your meeting`
      );
    }
  });
}

/**
 * Get transcription state for an event
 * @param eventId The event ID to get state for
 * @returns The transcription state or a default 'idle' state
 */
function getTranscriptionState(eventId: string): TranscriptionState {
  // Return existing state or default to idle
  return (
    transcriptionStateMap.get(eventId) || {
      eventId,
      status: "idle",
    }
  );
}

/**
 * Update transcription state for an event
 * @param eventId The event ID to update
 * @param newState The new state properties (partial state)
 */
function updateTranscriptionState(
  eventId: string,
  newState: Partial<TranscriptionState>
): void {
  // Get current state or create new one
  const currentState = getTranscriptionState(eventId);

  // Merge current state with new state properties
  const updatedState: TranscriptionState = {
    ...currentState,
    ...newState,
    eventId, // Ensure eventId is always set
  };

  // Save to state map
  transcriptionStateMap.set(eventId, updatedState);
}

/**
 * Save transcription state to persistent storage
 */
async function saveTranscriptionState(
  state: TranscriptionState
): Promise<void> {
  try {
    // Only save completed or failed states
    if (state.status === "completed" || state.status === "failed") {
      // Save to main process persistent storage
      if (state.status === "completed" && state.transcript) {
        await ipcRenderer.invoke(
          "save-transcription-result",
          state.eventId,
          "completed",
          state.transcript
        );
      } else if (state.status === "failed" && state.error) {
        await ipcRenderer.invoke(
          "save-transcription-result",
          state.eventId,
          "failed",
          undefined,
          state.error
        );
      }

      // Also save to localStorage as a backup/cache
      const key = `transcription_${state.eventId}`;
      localStorage.setItem(key, JSON.stringify(state));

      console.log(`Saved transcription state for event ${state.eventId}`);
    }
  } catch (error) {
    console.error("Error saving transcription state:", error);

    // Fallback to localStorage only if main process save fails
    try {
      const key = `transcription_${state.eventId}`;
      localStorage.setItem(key, JSON.stringify(state));
      console.log(
        `Saved transcription state to localStorage fallback for event ${state.eventId}`
      );
    } catch (localStorageError) {
      console.error(
        "Error saving to localStorage fallback:",
        localStorageError
      );
    }
  }
}

/**
 * Load transcription state from localStorage
 * This is a fallback for the main persistent storage
 */
function loadTranscriptionState(eventId: string): TranscriptionState | null {
  try {
    const key = `transcription_${eventId}`;
    const savedState = localStorage.getItem(key);

    if (savedState) {
      const state = JSON.parse(savedState) as TranscriptionState;
      console.log(
        `Loaded transcription state for event ${eventId} from localStorage`
      );
      return state;
    }

    return null;
  } catch (error) {
    console.error(
      "Error loading transcription state from localStorage:",
      error
    );
    return null;
  }
}

/**
 * Initialize the transcription state map at app startup
 * This loads saved transcription states
 */
async function initTranscriptionStates(): Promise<void> {
  try {
    // Try to get all meetings from the persistent storage
    const result = await ipcRenderer.invoke("get-all-meetings");

    if (result.success && result.meetings) {
      // For meetings with transcripts, load them
      for (const meeting of result.meetings) {
        if (meeting.hasTranscript) {
          try {
            const transcriptResult = await ipcRenderer.invoke(
              "load-transcript",
              meeting.id
            );

            if (transcriptResult.success && transcriptResult.data) {
              // Create a state object from the loaded data
              const state: TranscriptionState = {
                eventId: meeting.id,
                status: (transcriptResult.data.status as any) || "completed",
                transcript: transcriptResult.data.text,
                error: transcriptResult.data.error,
              };

              // Add to state map
              transcriptionStateMap.set(meeting.id, state);
            }
          } catch (error) {
            console.error(
              `Error loading transcript for meeting ${meeting.id}:`,
              error
            );
          }
        }
      }

      console.log(
        `Loaded ${transcriptionStateMap.size} transcription states from persistent storage`
      );
    }

    // As a fallback/supplement, also load from localStorage
    try {
      // Find all localStorage keys that start with "transcription_"
      const transcriptionKeys = Object.keys(localStorage).filter((key) =>
        key.startsWith("transcription_")
      );

      let countLoaded = 0;

      // Load each state into the map (only if not already loaded)
      for (const key of transcriptionKeys) {
        const eventId = key.replace("transcription_", "");

        // Skip if we already loaded this one from persistent storage
        if (transcriptionStateMap.has(eventId)) {
          continue;
        }

        const savedState = localStorage.getItem(key);
        if (savedState) {
          try {
            const state = JSON.parse(savedState) as TranscriptionState;
            transcriptionStateMap.set(eventId, state);
            countLoaded++;
          } catch (parseError) {
            console.error(
              `Error parsing saved state from localStorage for ${eventId}:`,
              parseError
            );
          }
        }
      }

      if (countLoaded > 0) {
        console.log(
          `Loaded ${countLoaded} additional transcription states from localStorage`
        );
      }
    } catch (localStorageError) {
      console.error("Error loading from localStorage:", localStorageError);
    }
  } catch (error) {
    console.error("Error initializing transcription states:", error);

    // Last resort: try to load just from localStorage
    try {
      const transcriptionKeys = Object.keys(localStorage).filter((key) =>
        key.startsWith("transcription_")
      );

      for (const key of transcriptionKeys) {
        const savedState = localStorage.getItem(key);
        if (savedState) {
          const state = JSON.parse(savedState) as TranscriptionState;
          transcriptionStateMap.set(state.eventId, state);
        }
      }

      console.log(
        `Loaded ${transcriptionStateMap.size} transcription states from localStorage fallback`
      );
    } catch (fallbackError) {
      console.error("Error with localStorage fallback:", fallbackError);
    }
  }
}

/**
 * Retry a failed transcription
 * @param eventId The event ID to retry transcription for
 * @param jobId The original job ID (optional)
 */
async function retryTranscription(
  eventId: string,
  jobId?: string
): Promise<void> {
  try {
    // Update UI immediately to show we're trying
    updateTranscriptionState(eventId, {
      status: "queued",
      error: undefined, // Clear previous error
    });

    // If this is the currently selected event, update the UI
    if (selectedEvent && selectedEvent.id === eventId) {
      updateTranscriptTab(getTranscriptionState(eventId));
    }

    // Call main process to retry transcription
    const result = await ipcRenderer.invoke(
      "retry-transcription",
      eventId,
      jobId
    );

    if (result.error) {
      // If there was an error, update the state back to failed
      updateTranscriptionState(eventId, {
        status: "failed",
        error: result.error,
      });

      // Update UI if needed
      if (selectedEvent && selectedEvent.id === eventId) {
        updateTranscriptTab(getTranscriptionState(eventId));
      }

      showNotification("Retry Failed", result.error);
    } else {
      showNotification(
        "Transcription Queued",
        "Transcription has been re-queued"
      );
    }
  } catch (error: any) {
    console.error("Error retrying transcription:", error);

    // Update state to failed
    updateTranscriptionState(eventId, {
      status: "failed",
      error: error.message || "Error retrying transcription",
    });

    // Update UI if needed
    if (selectedEvent && selectedEvent.id === eventId) {
      updateTranscriptTab(getTranscriptionState(eventId));
    }

    showNotification("Error", "Failed to retry transcription");
  }
}

/**
 * Update the transcript tab with the current status
 * @param state The transcription state to display
 */
function updateTranscriptTab(state: TranscriptionState): void {
  // Find the transcript tab content
  const transcriptTab = document.getElementById("transcript-tab");
  if (!transcriptTab) {
    console.error('Transcript tab element not found');
    return;
  }

  const transcriptContent = transcriptTab.querySelector(".transcript-content");
  if (!transcriptContent) {
    console.error('Transcript content element not found');
    return;
  }

  // Update content based on status
  switch (state.status) {
    case "idle":
      transcriptContent.innerHTML = `
        <p>No transcript available yet. Click "Record & Transcribe" to get started.</p>
      `;
      break;

    case "queued":
      transcriptContent.innerHTML = `
        <div class="transcription-status">
          <p>Your recording is queued for transcription.</p>
          <div class="loading-indicator">Waiting in queue...</div>
        </div>
      `;
      break;

    case "mixing":
      transcriptContent.innerHTML = `
        <div class="transcription-status">
          <p>Preparing audio for transcription...</p>
          <div class="loading-indicator">Mixing audio streams...</div>
        </div>
      `;
      break;

    case "transcribing":
      // Ensure progress is a valid number
      const progress = typeof state.progress === 'number' ? state.progress : 0;
      const roundedProgress = Math.round(progress);
      
      transcriptContent.innerHTML = `
        <div class="transcription-status">
          <p>Transcribing your recording...</p>
          <div class="progress-bar-container">
            <div class="progress-bar" style="width: ${roundedProgress}%"></div>
          </div>
          <div class="progress-text">${roundedProgress}%</div>
        </div>
      `;
      break;

    case "completed":
      if (state.transcript) {
        transcriptContent.innerHTML = `
          <div class="transcript-actions">
            <button id="copy-transcript-btn" class="action-btn">Copy Transcript</button>
          </div>
          <div class="transcript-text">
            ${formatTranscript(state.transcript)}
          </div>
        `;

        // Add copy button functionality
        const copyBtn = document.getElementById("copy-transcript-btn");
        if (copyBtn) {
          copyBtn.addEventListener("click", () => {
            if (state.transcript) {
              navigator.clipboard
                .writeText(state.transcript)
                .then(() => {
                  showNotification("Copied", "Transcript copied to clipboard");
                })
                .catch((err) => {
                  console.error("Failed to copy transcript:", err);
                  showNotification("Error", "Failed to copy transcript");
                });
            }
          });
        }
      } else {
        transcriptContent.innerHTML = `
          <div class="transcription-status">
            <p>Transcription completed, but no text was generated.</p>
          </div>
        `;
      }
      break;

    case "failed":
      transcriptContent.innerHTML = `
        <div class="transcription-status error">
          <p>Transcription failed.</p>
          ${state.error ? `<p class="error-message">${state.error}</p>` : ""}
          <button id="retry-transcription-btn" class="action-btn">Retry Transcription</button>
        </div>
      `;

      // Add retry button functionality
      const retryBtn = document.getElementById("retry-transcription-btn");
      if (retryBtn) {
        retryBtn.addEventListener("click", () => {
          console.log(`Retrying transcription for event ${state.eventId}`);
          retryTranscription(state.eventId, state.jobId);
        });
      }
      break;
  }
}

/**
 * Format a plain text transcript for display
 */
function formatTranscript(text: string): string {
  // Basic formatting: preserve paragraphs, escape HTML
  const escaped = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  // Check if this transcript has timestamp format like [00:00:00.000 --> 00:00:07.000]
  if (escaped.match(/\[\d{2}:\d{2}:\d{2}\.\d{3}\s+-->\s+\d{2}:\d{2}:\d{2}\.\d{3}\]/)) {
    return formatTimestampedTranscript(escaped);
  }

  // Split by lines and wrap paragraphs
  return escaped
    .split("\n")
    .map((line) => (line.trim() ? `<p>${line}</p>` : ""))
    .join("");
}

/**
 * Format a timestamped transcript by grouping into larger chunks
 * @param text The timestamped transcript text
 * @returns Formatted HTML with grouped timestamps
 */
function formatTimestampedTranscript(text: string): string {
  // Regular expression to match timestamp lines
  const timestampRegex = /\[(\d{2}:\d{2}:\d{2}\.\d{3})\s+-->\s+(\d{2}:\d{2}:\d{2}\.\d{3})\]\s*(.*)/;
  
  // Split the transcript into lines
  const lines = text.split("\n");
  
  // Group size in seconds (default 30 seconds)
  const groupSize = 30;
  
  // Initialize variables
  let result = '';
  let currentGroup: { start: string, end: string, lines: string[] } | null = null;
  
  // Process each line
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    
    // Check if this is a timestamp line
    const match = line.match(timestampRegex);
    if (match) {
      const [_, startTime, endTime, content] = match;
      
      // Convert start time to seconds for comparison
      const startSeconds = timeToSeconds(startTime);
      
      // If no current group or this timestamp is outside the current group's range, create a new group
      if (!currentGroup || startSeconds - timeToSeconds(currentGroup.start) >= groupSize) {
        // If we have a current group, add it to the result
        if (currentGroup) {
          result += formatGroup(currentGroup);
        }
        
        // Start a new group
        currentGroup = {
          start: startTime,
          end: endTime,
          lines: [content]
        };
      } else {
        // Update the end time of the current group
        currentGroup.end = endTime;
        // Add this line's content to the current group
        currentGroup.lines.push(content);
      }
    } else {
      // If this is not a timestamp line but we have a current group, add it as plain text
      if (currentGroup) {
        currentGroup.lines.push(line);
      }
    }
  }
  
  // Add the last group if there is one
  if (currentGroup) {
    result += formatGroup(currentGroup);
  }
  
  return result;
}

/**
 * Format a group of transcript lines
 */
function formatGroup(group: { start: string, end: string, lines: string[] }): string {
  const timestamp = `[${group.start} --> ${group.end}]`;
  const content = group.lines.join(' ').trim();
  
  return `<div class="transcript-group">
    <div class="transcript-timestamp">${timestamp}</div>
    <div class="transcript-content-text">${content}</div>
  </div>`;
}

/**
 * Convert a time string (HH:MM:SS.SSS) to seconds
 */
function timeToSeconds(timeStr: string): number {
  const [hours, minutes, seconds] = timeStr.split(':').map(parseFloat);
  return hours * 3600 + minutes * 60 + seconds;
}

/**
 * Load and populate notes for a meeting
 */
async function loadAndPopulateNotes(eventId: string): Promise<void> {
  try {
    // Find notes textarea
    const notesTab = document.getElementById("notes-tab");
    if (!notesTab) {
      console.error('Notes tab element not found');
      return;
    }

    const notesTextarea = notesTab.querySelector(
      ".notes-area"
    ) as HTMLTextAreaElement;
    if (!notesTextarea) {
      console.error('Notes textarea element not found');
      return;
    }

    const notesStatus = notesTab.querySelector(
      "#notes-status"
    ) as HTMLDivElement;

    // Show loading status
    if (notesStatus) {
      notesStatus.textContent = "Loading...";
      notesStatus.className = "notes-status show";
    }

    // Load notes from persistent storage
    const result = await ipcRenderer.invoke("load-meeting-note", eventId);

    if (result.success) {
      // Populate the textarea
      notesTextarea.value = result.note || "";

      // Clear or update status
      if (notesStatus) {
        if (result.note) {
          notesStatus.textContent = "Notes loaded";
          notesStatus.className = "notes-status show saved";

          // Hide after 1.5 seconds
          setTimeout(() => {
            notesStatus.className = "notes-status";
          }, 1500);
        } else {
          notesStatus.className = "notes-status";
        }
      }

      // Add event listeners for keyboard shortcuts and save
      setupNotesEventListeners(notesTextarea, notesStatus, eventId);
    } else if (result.error) {
      console.error("Error loading notes:", result.error);

      // Show error status
      if (notesStatus) {
        notesStatus.textContent = "Error loading notes";
        notesStatus.className = "notes-status show error";
      }
    }
  } catch (error) {
    console.error("Error loading and populating notes:", error);

    // Show error in status
    const notesStatus = document.querySelector(
      "#notes-status"
    ) as HTMLDivElement;
    if (notesStatus) {
      notesStatus.textContent = "Error loading notes";
      notesStatus.className = "notes-status show error";
    }
  }
}

/**
 * Setup event listeners for the notes textarea
 */
function setupNotesEventListeners(
  textarea: HTMLTextAreaElement,
  statusElement: HTMLDivElement | null,
  eventId: string
): void {
  // Save notes when they change (debounced)
  textarea.addEventListener(
    "input",
    debounce(async () => {
      // Show saving status
      if (statusElement) {
        statusElement.textContent = "Saving...";
        statusElement.className = "notes-status show saving";
      }

      // Save notes
      const success = await saveMeetingNotes(eventId, textarea.value);

      // Update status based on result
      if (statusElement) {
        if (success) {
          statusElement.textContent = "Saved";
          statusElement.className = "notes-status show saved";

          // Hide status after 1.5 seconds
          setTimeout(() => {
            statusElement.className = "notes-status";
          }, 1500);
        } else {
          statusElement.textContent = "Error saving";
          statusElement.className = "notes-status show error";
        }
      }
    }, 1000)
  ); // Debounce for 1 second

  // Add keyboard shortcuts
  textarea.addEventListener("keydown", (e) => {
    // Cmd+S or Ctrl+S to save
    if ((e.metaKey || e.ctrlKey) && e.key === "s") {
      e.preventDefault(); // Prevent browser save dialog
      saveMeetingNotes(eventId, textarea.value);

      // Show saving status
      if (statusElement) {
        statusElement.textContent = "Saved";
        statusElement.className = "notes-status show saved";

        // Hide status after 1.5 seconds
        setTimeout(() => {
          statusElement.className = "notes-status";
        }, 1500);
      }
    }
  });

  // Add export button functionality
  const exportBtn = document.getElementById("export-notes-btn");
  if (exportBtn) {
    exportBtn.addEventListener("click", async () => {
      if (!selectedEvent) return;

      try {
        // Get meeting info for filename
        const meetingTitle = selectedEvent.summary || "Untitled Meeting";
        const dateStr = selectedEvent.start?.dateTime
          ? new Date(selectedEvent.start.dateTime).toISOString().split("T")[0]
          : new Date().toISOString().split("T")[0];

        // Format filename
        const safeTitle = meetingTitle
          .replace(/[^a-z0-9]/gi, "_")
          .toLowerCase();
        const filename = `${dateStr}_${safeTitle}_notes.txt`;

        // Export the notes
        const result = await ipcRenderer.invoke("export-file", {
          content: textarea.value,
          filename: filename,
          title: "Export Meeting Notes",
        });

        if (result.success) {
          showNotification("Notes Exported", `Saved to ${result.path}`);
        } else if (result.error) {
          showNotification("Export Failed", result.error);
        }
      } catch (error) {
        console.error("Error exporting notes:", error);
        showNotification("Export Failed", "Could not export notes");
      }
    });
  }

  // Add copy button functionality
  const copyBtn = document.getElementById("copy-notes-btn");
  if (copyBtn) {
    copyBtn.addEventListener("click", () => {
      if (textarea.value) {
        navigator.clipboard
          .writeText(textarea.value)
          .then(() => {
            showNotification("Copied", "Notes copied to clipboard");
          })
          .catch((err) => {
            console.error("Failed to copy notes:", err);
            showNotification("Error", "Failed to copy notes to clipboard");
          });
      } else {
        showNotification("Nothing to Copy", "Notes are empty");
      }
    });
  }
}

/**
 * Save meeting notes
 * @returns {Promise<boolean>} Success indicator
 */
async function saveMeetingNotes(
  eventId: string,
  notes: string
): Promise<boolean> {
  try {
    const result = await ipcRenderer.invoke(
      "save-meeting-note",
      eventId,
      notes
    );

    if (result.success) {
      return true;
    } else if (result.error) {
      console.error("Error saving notes:", result.error);
      return false;
    }

    return false;
  } catch (error) {
    console.error("Error saving notes:", error);
    return false;
  }
}

/**
 * Debounce function to limit how often a function is called
 */
function debounce<F extends (...args: any[]) => any>(
  func: F,
  wait: number
): (...args: Parameters<F>) => void {
  let timeout: ReturnType<typeof setTimeout> | null = null;

  return function (...args: Parameters<F>): void {
    if (timeout !== null) {
      clearTimeout(timeout);
    }

    timeout = setTimeout(() => {
      func(...args);
      timeout = null;
    }, wait);
  };
}

// Update record button text and style based on the current recording state
function updateRecordButtonState(state: RECORDING_STATES): void {
  // Find the record button if not already saved
  if (!recordButton) {
    recordButton = document.getElementById(
      "record-transcribe-btn"
    ) as HTMLButtonElement | null;
  }

  // Update button if found
  if (recordButton) {
    // Remove all state classes first
    recordButton.classList.remove("recording", "processing", "disabled");

    // Set button state based on recording state
    switch (state) {
      case RECORDING_STATES.IDLE:
      case RECORDING_STATES.READY_TO_RECORD:
        recordButton.textContent = "Record & Transcribe";
        recordButton.disabled = false;
        break;

      case RECORDING_STATES.CHECKING_PERMISSIONS:
      case RECORDING_STATES.REQUESTING_PERMISSIONS:
        recordButton.textContent = "Checking Permissions...";
        recordButton.disabled = true;
        recordButton.classList.add("disabled");
        break;
        
      case RECORDING_STATES.WAITING_FOR_BROWSER:
        recordButton.textContent = "Opening Browser...";
        recordButton.disabled = true;
        recordButton.classList.add("disabled");
        break;

      case RECORDING_STATES.RECORDING:
        recordButton.textContent = "Stop Recording & Queue";
        recordButton.disabled = false;
        recordButton.classList.add("recording");
        break;

      case RECORDING_STATES.STOPPING:
        recordButton.textContent = "Stopping...";
        recordButton.disabled = true;
        recordButton.classList.add("disabled");
        break;

      case RECORDING_STATES.PROCESSING:
        recordButton.textContent = "Processing...";
        recordButton.disabled = true;
        recordButton.classList.add("processing");
        break;
    }
  }

  // Update visual recording indicator in event list
  updateRecordingIndicator(
    state === RECORDING_STATES.RECORDING ? activeRecordingEventId : null
  );
}

// Show a temporary notification
function showNotification(title: string, message: string): void {
  // Create notification element
  const notification = document.createElement("div");
  notification.className = "notification";

  // Add content
  notification.innerHTML = `
    <div class="notification-title">${title}</div>
    <div class="notification-message">${message}</div>
  `;

  // Add to DOM
  document.body.appendChild(notification);

  // Show with animation
  setTimeout(() => {
    notification.classList.add("show");
  }, 10);

  // Auto-hide after 3 seconds
  setTimeout(() => {
    notification.classList.remove("show");
    setTimeout(() => {
      document.body.removeChild(notification);
    }, 300); // Wait for fade-out animation
  }, 3000);
}

// Show a dialog explaining permission request before showing system prompts
function showPermissionRequestDialog(): Promise<void> {
  return new Promise((resolve, reject) => {
    // Create overlay
    const overlay = document.createElement("div");
    overlay.className = "modal-overlay";

    // Create dialog
    const dialog = document.createElement("div");
    dialog.className = "modal-dialog";

    // Add content
    dialog.innerHTML = `
      <h3>Permission Required</h3>
      <p>This app needs Microphone and Screen Recording permissions to record meeting audio. 
          macOS will now ask for permission.</p>
      <div class="modal-buttons">
        <button id="permission-cancel" class="modal-btn">Cancel</button>
        <button id="permission-request" class="modal-btn primary">Request Permissions</button>
      </div>
    `;

    // Add to DOM
    overlay.appendChild(dialog);
    document.body.appendChild(overlay);

    // Add event listeners
    const cancelBtn = document.getElementById("permission-cancel");
    if (cancelBtn) {
      cancelBtn.addEventListener("click", () => {
        document.body.removeChild(overlay);
        reject();
      });
    }

    const requestBtn = document.getElementById("permission-request");
    if (requestBtn) {
      requestBtn.addEventListener("click", () => {
        document.body.removeChild(overlay);
        resolve();
      });
    }
  });
}

// Show a dialog explaining how to grant permissions if they were denied
function showPermissionDeniedDialog(permissions: {
  microphone: string;
  screen: string;
}): void {
  // Create overlay
  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";

  // Create dialog
  const dialog = document.createElement("div");
  dialog.className = "modal-dialog";

  // Determine which permissions are denied
  const micDenied =
    permissions.microphone === "denied" ||
    permissions.microphone === "restricted";
  const screenDenied =
    permissions.screen === "denied" || permissions.screen === "restricted";

  // Create message based on which permissions are denied
  let message = "Recording requires ";
  if (micDenied && screenDenied) {
    message += "Microphone and Screen Recording permissions.";
  } else if (micDenied) {
    message += "Microphone permission.";
  } else if (screenDenied) {
    message += "Screen Recording permission.";
  }

  // Add content
  dialog.innerHTML = `
    <h3>Permission Denied</h3>
    <p>${message} Please grant access in System Settings > Privacy & Security.</p>
    <div class="modal-buttons">
      <button id="permission-close" class="modal-btn">Close</button>
      ${
        micDenied
          ? '<button id="open-mic-settings" class="modal-btn">Open Microphone Settings</button>'
          : ""
      }
      ${
        screenDenied
          ? '<button id="open-screen-settings" class="modal-btn">Open Screen Recording Settings</button>'
          : ""
      }
    </div>
  `;

  // Add to DOM
  overlay.appendChild(dialog);
  document.body.appendChild(overlay);

  // Add event listeners
  const closeBtn = document.getElementById("permission-close");
  if (closeBtn) {
    closeBtn.addEventListener("click", () => {
      document.body.removeChild(overlay);
    });
  }

  // Add event listeners for settings buttons if they exist
  const micBtn = document.getElementById("open-mic-settings");
  if (micBtn && micDenied) {
    micBtn.addEventListener("click", () => {
      ipcRenderer.invoke("open-privacy-settings", "microphone");
    });
  }

  const screenBtn = document.getElementById("open-screen-settings");
  if (screenBtn && screenDenied) {
    screenBtn.addEventListener("click", () => {
      ipcRenderer.invoke("open-privacy-settings", "screen");
    });
  }
}

// Generic dialog function
function showDialog(title: string, message: string): void {
  // Create overlay
  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";

  // Create dialog
  const dialog = document.createElement("div");
  dialog.className = "modal-dialog";

  // Add content
  dialog.innerHTML = `
    <h3>${title}</h3>
    <p>${message}</p>
    <div class="modal-buttons">
      <button id="dialog-close" class="modal-btn primary">OK</button>
    </div>
  `;

  // Add to DOM
  overlay.appendChild(dialog);
  document.body.appendChild(overlay);

  // Add event listener
  const closeBtn = document.getElementById("dialog-close");
  if (closeBtn) {
    closeBtn.addEventListener("click", () => {
      document.body.removeChild(overlay);
    });
  }
}

// Initialize the UI
async function init(): Promise<void> {
  console.log("--- init() function started ---");
  // Set up initial date display
  updateDateDisplay();

  // Set up default detail pane
  displayDefaultDetailPane();

  // Check if user is already authenticated
  const isAuthenticated = await ipcRenderer.invoke("google-auth-check");
  updateAuthUI(isAuthenticated);

  // Add event listeners for day navigation buttons
  prevDayButton.addEventListener("click", () => {
    navigateToPreviousDay();
    resetDetailPane();
  });

  nextDayButton.addEventListener("click", () => {
    navigateToNextDay();
    resetDetailPane();
  });

  // Add event listener for Google auth button
  googleAuthButton.addEventListener("click", handleGoogleAuth);
  
  // Add event listener for Settings button
  if (settingsButton) {
    settingsButton.addEventListener("click", () => {
      settingsModal.open();
    });
  }

  // Listen for auth state changes from main process
  ipcRenderer.on(
    "google-auth-state-changed",
    (event, isAuthenticated: boolean) => {
      updateAuthUI(isAuthenticated);
      resetDetailPane();
    }
  );

  // Initialize recording state listeners
  initRecordingListeners();
}

// Initialize the app when the DOM is loaded
console.log("--- Adding DOMContentLoaded listener ---");
document.addEventListener("DOMContentLoaded", () => {
  console.log("--- DOMContentLoaded fired, calling init() ---");
  // Initialize transcription states from localStorage
  initTranscriptionStates();
  // Initialize the rest of the app
  init();
});