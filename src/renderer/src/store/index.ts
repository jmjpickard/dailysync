import { create } from "zustand";
import { persist, createJSONStorage, devtools } from "zustand/middleware";
import { RECORDING_STATES } from "../constants";
import {
  NotificationType,
  DialogConfig,
  MeetingData,
  LLMService,
} from "../types";
import debounce from "lodash.debounce";
import {
  AppState,
  AuthSlice,
  CalendarSlice,
  MeetingDetailSlice,
  RecordingSlice,
  TranscriptionSlice,
  MeetingsSlice,
  SettingsSlice,
  UISlice,
  LLMServiceSlice,
  UIActions,
  CalendarActions,
  RecordingActions,
  LLMServiceActions,
  MeetingDataActions,
  AuthActions,
} from "./types";

// Define initial auth state
const initialAuthState: AuthSlice = {
  auth: {
    isAuthenticated: false,
    isLoading: true,
  },
};

// Define initial calendar state
const initialCalendarState: CalendarSlice = {
  calendar: {
    selectedDate: new Date(),
    selectedEventId: null,
    events: [],
    isLoading: false,
  },
};

// Define initial meeting detail state
const initialMeetingDetailState: MeetingDetailSlice = {
  meetingDetail: {
    selectedEventId: null,
    currentNotes: "",
    currentNotesEventId: null,
    currentTranscript: "",
    currentTranscriptStatus: "idle",
    currentTranscriptProgress: 0,
    currentTranscriptError: undefined,
    currentSummary: "",
    currentSummaryModel: "",
    currentSummaryTimestamp: "",
    isDetailLoading: false,
    isDataReadyForSelectedEvent: false,
    notesSaveStatus: "idle",
    summaryGenerateStatus: "idle",
    hasTranscriptForSummary: false,
    activeTab: "notes",
  },
};

// Define initial recording state
const initialRecordingState: RecordingSlice = {
  recording: {
    state: RECORDING_STATES.IDLE,
    recordingEventId: null,
    audioDevices: [],
    selectedAudioDevice: null,
  },
};

// Define initial transcription state
const initialTranscriptionState: TranscriptionSlice = {
  transcription: {
    transcriptionJobs: {},
  },
};

// Define initial meetings state
const initialMeetingsState: MeetingsSlice = {
  meetings: {
    data: {},
    isLoading: false,
  },
};

// Define initial settings state
const initialSettingsState: SettingsSlice = {
  settings: null,
  saveSettings: async () => {}, // Placeholder implementation
};

// Define initial UI state
const initialUIState: UISlice = {
  ui: {
    sidebarView: "nav",
    notifications: [],
    activeDialog: null,
  },
};

// Define initial LLM service selection state
const initialLLMServiceState: LLMServiceSlice = {
  llm: {
    configuredServices: [],
    selectedService: null,
    showServiceSelector: false,
  },
};

// Create the store
export const useStore = create<AppState>()(
  devtools(
    persist(
      (set, get) => ({
        // Initial state
        ...initialAuthState,
        ...initialCalendarState,
        ...initialMeetingDetailState,
        ...initialRecordingState,
        ...initialTranscriptionState,
        ...initialMeetingsState,
        ...initialSettingsState,
        ...initialUIState,
        ...initialLLMServiceState,

        // UI actions
        setSidebarView: (view) => {
          set((state) => ({
            ui: {
              ...state.ui,
              sidebarView: view,
            },
          }));
        },

        addNotification: (message, type = "info", duration = 5000) => {
          const notification = {
            id: Date.now(),
            message,
            type,
            duration,
          };

          set((state) => ({
            ui: {
              ...state.ui,
              notifications: [...state.ui.notifications, notification],
            },
          }));

          if (duration) {
            setTimeout(() => {
              set((state) => ({
                ui: {
                  ...state.ui,
                  notifications: state.ui.notifications.filter(
                    (n) => n.id !== notification.id
                  ),
                },
              }));
            }, duration);
          }
        },

        removeNotification: (id) => {
          set((state) => ({
            ui: {
              ...state.ui,
              notifications: state.ui.notifications.filter(
                (notification) => notification.id !== id
              ),
            },
          }));
        },

        showDialog: (config) => {
          const newActiveDialog = {
            ...config,
            id: Date.now(),
          };

          set((state) => ({
            ui: {
              ...state.ui,
              activeDialog: newActiveDialog,
            },
          }));
        },

        hideDialog: (id) => {
          set((state) => {
            // If id is provided, only hide dialog if ID matches
            if (
              id !== undefined &&
              state.ui.activeDialog &&
              state.ui.activeDialog.id !== id
            ) {
              return state;
            }

            return {
              ui: {
                ...state.ui,
                activeDialog: null,
              },
            };
          });
        },

        // Calendar actions
        setSelectedDate: (date) => {
          set((state) => ({
            calendar: {
              ...state.calendar,
              selectedDate: date,
            },
          }));

          // Fetch events for the new date
          get().fetchEvents(date);
        },

        fetchEvents: async (date) => {
          const dateToFetch = date || get().calendar.selectedDate;
          const { isAuthenticated } = get().auth;

          if (!isAuthenticated) {
            set((state) => ({
              calendar: { ...state.calendar, events: [] },
            }));
            return;
          }

          try {
            set((state) => ({
              calendar: { ...state.calendar, isLoading: true },
            }));

            const result = await window.electronAPI.fetchEvents(
              dateToFetch.toISOString()
            );

            if (Array.isArray(result)) {
              set((state) => ({
                calendar: { ...state.calendar, events: result },
              }));

              // After fetching events, refresh meeting data cache
              get().refreshMeetingCache();
            } else if (
              result &&
              typeof result === "object" &&
              "error" in result
            ) {
              get().addNotification(result.error, "error");
            }
          } catch (error) {
            console.error("Error fetching events:", error);
            get().addNotification("Failed to fetch events", "error");
          } finally {
            set((state) => ({
              calendar: { ...state.calendar, isLoading: false },
            }));
          }
        },
        // --- setSelectedEventId (UPDATED) ---
        setSelectedEventId: async (id: string | null) => {
          const previousEventId = get().calendar.selectedEventId;
          if (id === previousEventId) return;
          console.log(
            `setSelectedEventId: Switching from event ${previousEventId} to ${id}`
          );

          const notesToSave = get().meetingDetail.currentNotes;
          const notesBelongToPreviousEvent =
            get().meetingDetail.currentNotesEventId === previousEventId;

          // Immediately update state: Set loading, clear details, mark as NOT ready
          set((state) => ({
            calendar: {
              ...state.calendar,
              selectedEventId: id,
            },
            meetingDetail: {
              ...initialMeetingDetailState.meetingDetail, // Reset notes, transcript, summary etc.
              selectedEventId: id, // Set the new ID
              isDetailLoading: true, // Start loading process
              isDataReadyForSelectedEvent: false, // Explicitly mark as NOT ready
              activeTab: state.meetingDetail.activeTab, // Preserve tab
            },
          }));
          console.log(
            `setSelectedEventId: State cleared, set for new event ${id}. Loading started, Data NOT Ready.`
          );

          get().clearDebouncedFunctions();
          console.log(`setSelectedEventId: Debounced functions cleared.`);

          // Save previous notes (async background - no await needed unless required)
          if (notesToSave && notesBelongToPreviousEvent && previousEventId) {
            console.log(
              `setSelectedEventId: Saving notes for previous event ${previousEventId} in background.`
            );
            window.electronAPI
              .saveMeetingNote(previousEventId, notesToSave)
              .then((saveResult) => {
                if (!saveResult || !saveResult.success)
                  console.warn(
                    `setSelectedEventId: Background save failed for previous event ${previousEventId}. Error: ${saveResult?.error}`
                  );
                else
                  console.log(
                    `setSelectedEventId: Background save successful for previous event ${previousEventId}.`
                  );
              })
              .catch((error) =>
                console.error(
                  `setSelectedEventId: Error during background save for previous event ${previousEventId}:`,
                  error
                )
              );
          } else if (previousEventId) {
            console.log(
              `setSelectedEventId: No pending notes needed saving for previous event ${previousEventId}.`
            );
          }

          // Trigger loading data for the new event
          if (id !== null) {
            console.log(
              `setSelectedEventId: Triggering loadDataForSelectedEvent for ${id}.`
            );
            get().loadDataForSelectedEvent(); // Let this run async
          } else {
            // Handle case where no event is selected (id is null).
            console.log(
              `setSelectedEventId: No new event selected. Setting loading false.`
            );
            set((state) => ({
              meetingDetail: {
                ...state.meetingDetail,
                isDetailLoading: false, // Stop loading
                isDataReadyForSelectedEvent: false, // Still not ready
              },
            }));
          }
        }, // End of setSelectedEventId

        // --- loadDataForSelectedEvent (UPDATED) ---
        loadDataForSelectedEvent: async () => {
          const idToLoad = get().meetingDetail.selectedEventId;
          // Safety check: ensure an event is actually selected for loading
          if (!idToLoad) {
            console.warn(
              "loadDataForSelectedEvent called with no selected event ID."
            );
            set((state) => ({
              meetingDetail: {
                ...state.meetingDetail,
                isDetailLoading: false,
                isDataReadyForSelectedEvent: false,
              },
            }));
            return;
          }

          const loadingForEventId = idToLoad;
          console.log(
            `Store: Starting loadDataForSelectedEvent for event ${loadingForEventId}`
          );

          // Flag to track if the final state update should occur
          let shouldMarkReady = false;

          try {
            // Fetch Data Concurrently
            console.log(
              `Store: Fetching Notes, Transcript, Summary for ${loadingForEventId} concurrently.`
            );
            const [notesResult, transcriptResult, summaryResult] =
              await Promise.all([
                window.electronAPI.loadMeetingNote(loadingForEventId),
                window.electronAPI.loadTranscript(loadingForEventId),
                window.electronAPI.loadSummary(loadingForEventId),
              ]);
            console.log(`Store: Fetched data for ${loadingForEventId}.`);

            // CRITICAL CHECK: Ensure the event selected hasn't changed *while* fetching
            if (get().meetingDetail.selectedEventId === loadingForEventId) {
              console.log(
                `Store: Applying fetched data for ${loadingForEventId}.`
              );

              // Process and combine all updates into a single `set` call
              set((state) => {
                let updatedMeetingDetail = { ...state.meetingDetail };
                let updatedMeetingCacheData = {
                  ...(state.meetings.data[loadingForEventId] || {}),
                  eventId: loadingForEventId,
                };

                // --- Process Notes ---
                const loadedNotes =
                  typeof notesResult === "string" ? notesResult : "";
                updatedMeetingDetail = {
                  ...updatedMeetingDetail,
                  currentNotes: loadedNotes,
                  currentNotesEventId: loadingForEventId, // Associate notes correctly
                  notesSaveStatus: "idle",
                };
                updatedMeetingCacheData = {
                  ...updatedMeetingCacheData,
                  notes: loadedNotes,
                  hasNotes: !!loadedNotes,
                };

                // --- Process Transcript ---
                const hasTranscript =
                  transcriptResult &&
                  typeof transcriptResult === "object" &&
                  transcriptResult.success &&
                  !!transcriptResult.transcript;
                const loadedTranscript = hasTranscript
                  ? transcriptResult.transcript
                  : "";
                updatedMeetingDetail = {
                  ...updatedMeetingDetail,
                  currentTranscript: loadedTranscript,
                  currentTranscriptStatus: hasTranscript
                    ? "completed"
                    : transcriptResult?.error
                    ? "failed"
                    : "idle",
                  currentTranscriptProgress: hasTranscript ? 100 : 0,
                  currentTranscriptError: transcriptResult?.error || undefined,
                  hasTranscriptForSummary: hasTranscript,
                };
                updatedMeetingCacheData = {
                  ...updatedMeetingCacheData,
                  transcript: hasTranscript ? loadedTranscript : undefined,
                  hasTranscript: hasTranscript,
                };

                // --- Process Summary ---
                const hasSummary =
                  summaryResult &&
                  typeof summaryResult === "object" &&
                  summaryResult.success &&
                  !!summaryResult.summary;
                const loadedSummary = hasSummary ? summaryResult.summary : "";
                const loadedModel =
                  hasSummary && summaryResult.model ? summaryResult.model : "";
                const loadedTimestamp =
                  hasSummary && summaryResult.timestamp
                    ? summaryResult.timestamp
                    : "";
                updatedMeetingDetail = {
                  ...updatedMeetingDetail,
                  currentSummary: loadedSummary,
                  currentSummaryModel: loadedModel,
                  currentSummaryTimestamp: loadedTimestamp,
                  summaryGenerateStatus: "idle",
                };
                updatedMeetingCacheData = {
                  ...updatedMeetingCacheData,
                  summary: hasSummary ? loadedSummary : undefined,
                  modelUsed: hasSummary ? loadedModel : undefined,
                  lastUpdated: hasSummary ? loadedTimestamp : undefined,
                };

                // *** Data is applied, but DON'T mark ready/not loading YET ***
                // We will do that in the 'finally' block if checks pass.

                return {
                  // Only update the data fields here
                  meetingDetail: {
                    ...state.meetingDetail, // Keep existing loading/ready flags
                    currentNotes: updatedMeetingDetail.currentNotes,
                    currentNotesEventId:
                      updatedMeetingDetail.currentNotesEventId,
                    notesSaveStatus: updatedMeetingDetail.notesSaveStatus,
                    currentTranscript: updatedMeetingDetail.currentTranscript,
                    currentTranscriptStatus:
                      updatedMeetingDetail.currentTranscriptStatus,
                    currentTranscriptProgress:
                      updatedMeetingDetail.currentTranscriptProgress,
                    currentTranscriptError:
                      updatedMeetingDetail.currentTranscriptError,
                    hasTranscriptForSummary:
                      updatedMeetingDetail.hasTranscriptForSummary,
                    currentSummary: updatedMeetingDetail.currentSummary,
                    currentSummaryModel:
                      updatedMeetingDetail.currentSummaryModel,
                    currentSummaryTimestamp:
                      updatedMeetingDetail.currentSummaryTimestamp,
                    summaryGenerateStatus:
                      updatedMeetingDetail.summaryGenerateStatus,
                  },
                  meetings: {
                    ...state.meetings,
                    data: {
                      ...state.meetings.data,
                      [loadingForEventId]: updatedMeetingCacheData,
                    },
                  },
                };
              }); // End of set call

              // If we successfully applied data for the correct event, set flag to mark ready later
              shouldMarkReady = true;
            } else {
              // If the selected event changed while loading, discard the fetched data.
              console.log(
                `Store: Event changed during fetch (now ${
                  get().meetingDetail.selectedEventId
                }), discarding fetched data for ${loadingForEventId}.`
              );
              // Do not modify loading/ready state; let the *new* event's load handle it.
              shouldMarkReady = false;
            }
          } catch (error: any) {
            console.error(
              `Store: Error loading data for ${loadingForEventId}:`,
              error
            );
            shouldMarkReady = false; // Do not mark ready on error
            // Check if the error belongs to the currently selected event before notifying/updating state.
            if (get().meetingDetail.selectedEventId === loadingForEventId) {
              get().addNotification(
                `Error loading meeting data: ${
                  error.message || "Unknown error"
                }`,
                "error"
              );
              // Explicitly set loading false and ready false for this failed event load
              set((state) => ({
                meetingDetail: {
                  ...state.meetingDetail,
                  isDetailLoading: false,
                  isDataReadyForSelectedEvent: false,
                },
              }));
            }
          } finally {
            // --- Final State Update ---
            // Check if we are still on the event we loaded AND the load was marked successful
            if (get().meetingDetail.selectedEventId === loadingForEventId) {
              if (shouldMarkReady) {
                console.log(
                  `Store: Marking data READY and loading FINISHED for ${loadingForEventId}.`
                );
                set((state) => ({
                  meetingDetail: {
                    ...state.meetingDetail,
                    isDetailLoading: false,
                    isDataReadyForSelectedEvent: true,
                  },
                }));
              } else {
                // Load finished (or errored), but we shouldn't mark ready
                // Ensure loading is off if it wasn't turned off by error handling
                if (get().meetingDetail.isDetailLoading) {
                  console.log(
                    `Store: Load attempt for ${loadingForEventId} finished (not marked ready), ensuring loading state is false.`
                  );
                  set((state) => ({
                    meetingDetail: {
                      ...state.meetingDetail,
                      isDetailLoading: false,
                      isDataReadyForSelectedEvent: false, // Ensure not ready
                    },
                  }));
                }
              }
            } else {
              console.log(
                `Store: Load attempt for ${loadingForEventId} finished, but event changed. Final state not updated by this instance.`
              );
            }
          }
        }, // End of loadDataForSelectedEvent

        refreshMeetingCache: async () => {
          try {
            set((state) => ({
              meetings: {
                ...state.meetings,
                isLoading: true,
              },
            }));

            const result = await window.electronAPI.getAllMeetings();

            if (result && typeof result === "object") {
              if ("error" in result) {
                get().addNotification(result.error, "error");
                return;
              }

              if ("meetings" in result && result.success) {
                const allMeetings = result.meetings || {};
                const meetingDataMap: Record<string, MeetingData> = {};

                // Process each meeting
                Object.keys(allMeetings).forEach((eventId) => {
                  const meetingData = allMeetings[eventId];

                  meetingDataMap[eventId] = {
                    eventId,
                    hasTranscript: !!meetingData?.transcript,
                    hasNotes: !!meetingData?.notes,
                    transcript: meetingData?.transcript,
                    notes: meetingData?.notes,
                    summary: meetingData?.summary,
                    modelUsed: meetingData?.modelUsed,
                    lastUpdated: meetingData?.lastUpdated,
                  };
                });

                set((state) => ({
                  meetings: {
                    ...state.meetings,
                    data: meetingDataMap,
                  },
                }));

                // If there's a selected event, update it with fresh data
                const selectedEventId = get().meetingDetail.selectedEventId;
                if (selectedEventId && meetingDataMap[selectedEventId]) {
                  const currentData = meetingDataMap[selectedEventId];
                  set((state) => ({
                    meetingDetail: {
                      ...state.meetingDetail,
                      currentNotes: currentData.notes || "",
                      currentTranscript: currentData.transcript || "",
                      currentTranscriptStatus: currentData.hasTranscript
                        ? "completed"
                        : "idle",
                      hasTranscriptForSummary: currentData.hasTranscript,
                      currentSummary: currentData.summary || "",
                      currentSummaryModel: currentData.modelUsed || "",
                      currentSummaryTimestamp: currentData.lastUpdated || "",
                    },
                  }));
                }
              }
            }
          } catch (error) {
            console.error("Store: Error refreshing meeting cache:", error);
          } finally {
            set((state) => ({
              meetings: {
                ...state.meetings,
                isLoading: false,
              },
            }));
          }
        },

        loadInitialData: async () => {
          try {
            // Load settings
            const settings = await window.electronAPI.loadAllSettings();
            if (settings) {
              set((state) => ({
                settings: settings,
              }));
            }

            // Check auth status
            await get().checkAuth();

            // Load meeting data cache
            await get().refreshMeetingCache();
          } catch (error: any) {
            console.error("Store: Error loading initial data:", error);
            get().addNotification(
              "Error initializing app: " + (error.message || "Unknown error"),
              "error"
            );
          }
        },

        // Auth actions
        checkAuth: async () => {
          try {
            set((state) => ({
              auth: {
                ...state.auth,
                isLoading: true,
              },
            }));

            const authStatus = await window.electronAPI.checkAuth();

            set((state) => ({
              auth: {
                ...state.auth,
                isAuthenticated: authStatus,
              },
            }));

            // If authenticated, fetch events for the selected date
            if (authStatus) {
              get().fetchEvents();
            }
          } catch (error: any) {
            console.error("Store: Error checking auth status:", error);
          } finally {
            set((state) => ({
              auth: {
                ...state.auth,
                isLoading: false,
              },
            }));
          }
        },

        signOut: async () => {
          try {
            await window.electronAPI.signOut();
            set((state) => ({
              auth: {
                ...state.auth,
                isAuthenticated: false,
              },
              calendar: {
                ...state.calendar,
                events: [],
              },
            }));
            get().addNotification("Signed out successfully", "success");
          } catch (error: any) {
            console.error("Store: Error signing out:", error);
            get().addNotification(
              "Error signing out: " + (error.message || "Unknown error"),
              "error"
            );
          }
        },

        startAuth: async () => {
          try {
            set((state) => ({
              auth: {
                ...state.auth,
                isLoading: true,
              },
            }));

            const result = await window.electronAPI.startAuth();

            if (result) {
              set((state) => ({
                auth: {
                  ...state.auth,
                  isAuthenticated: true,
                },
              }));
              get().addNotification("Signed in successfully", "success");
              get().fetchEvents();
            } else {
              get().addNotification("Authentication failed", "error");
            }
          } catch (error: any) {
            console.error("Store: Error during authentication:", error);
            get().addNotification(
              "Error signing in: " + (error.message || "Unknown error"),
              "error"
            );
          } finally {
            set((state) => ({
              auth: {
                ...state.auth,
                isLoading: false,
              },
            }));
          }
        },

        // Recording actions
        setSelectedAudioDevice: (deviceId) => {
          set((state) => ({
            recording: {
              ...state.recording,
              selectedAudioDevice: deviceId,
            },
          }));
        },

        startRecording: async (eventId) => {
          try {
            const result = await window.electronAPI.startRecording(eventId);

            if (result && typeof result === "object" && "error" in result) {
              throw new Error(result.error);
            }

            // State updates will come through IPC listeners
          } catch (error: any) {
            console.error("Store: Error starting recording:", error);
            get().addNotification(
              "Error starting recording: " + (error.message || "Unknown error"),
              "error"
            );
          }
        },

        stopRecording: async () => {
          try {
            const result = await window.electronAPI.stopRecording();

            if (result && typeof result === "object" && "error" in result) {
              throw new Error(result.error);
            }

            // State updates will come through IPC listeners
          } catch (error: any) {
            console.error("Store: Error stopping recording:", error);
            get().addNotification(
              "Error stopping recording: " + (error.message || "Unknown error"),
              "error"
            );
          }
        },

        // LLM service selection actions
        setSelectedLLMService: (service) => {
          set((state) => ({
            llm: {
              ...state.llm,
              selectedService: service,
            },
          }));
        },

        toggleServiceSelector: (show) => {
          set((state) => ({
            llm: {
              ...state.llm,
              showServiceSelector:
                show !== undefined ? show : !state.llm.showServiceSelector,
            },
          }));
        },

        setConfiguredServices: (services) => {
          set((state) => ({
            llm: {
              ...state.llm,
              configuredServices: services,
            },
          }));
        },

        updateConfiguredLLMServices: () => {
          const services: LLMService[] = [];
          const llmSettings = get().settings?.llmSettings;

          if (llmSettings) {
            // Check for Ollama configuration
            if (llmSettings.ollamaUrl && llmSettings.ollamaModel) {
              services.push("ollama");
            }

            // Check for Claude API key
            if (llmSettings.claudeKey) {
              services.push("claude");
            }

            // Check for Gemini API key
            if (llmSettings.geminiKey) {
              services.push("gemini");
            }
          }

          set((state) => ({
            llm: {
              ...state.llm,
              configuredServices: services,
            },
          }));

          // If no service is selected or selected is no longer configured
          const { selectedService } = get().llm;
          if (!selectedService || !services.includes(selectedService)) {
            // Default to first available, preferring Claude
            const defaultService = services.includes("claude")
              ? "claude"
              : services.length > 0
              ? services[0]
              : null;

            set((state) => ({
              llm: {
                ...state.llm,
                selectedService: defaultService,
              },
            }));
          }
        },

        generateSummary: async (service) => {
          const selectedEventId = get().meetingDetail.selectedEventId;
          if (!selectedEventId) return;

          // If service is not provided, use the currently selected service
          const serviceToUse = service || get().llm.selectedService;
          if (!serviceToUse) {
            get().addNotification("No LLM service selected", "error");
            return;
          }

          // Set status to generating
          set((state) => ({
            meetingDetail: {
              ...state.meetingDetail,
              summaryGenerateStatus: "generating",
            },
          }));

          // Close service selector if it's open
          set((state) => ({
            llm: {
              ...state.llm,
              showServiceSelector: false,
            },
          }));

          try {
            // Call the API to generate summary
            const result = await window.electronAPI.generateSummary(
              selectedEventId,
              serviceToUse
            );

            // Check if the selected event is still the same
            if (get().meetingDetail.selectedEventId !== selectedEventId) return;

            if (result && result.success) {
              // Load the newly generated summary
              await get().loadSummaryForSelectedEvent();

              // Update status to generated
              set((state) => ({
                meetingDetail: {
                  ...state.meetingDetail,
                  summaryGenerateStatus: "generated",
                },
              }));

              // Reset status after a delay
              setTimeout(() => {
                if (get().meetingDetail.selectedEventId === selectedEventId) {
                  set((state) => ({
                    meetingDetail: {
                      ...state.meetingDetail,
                      summaryGenerateStatus: "idle",
                    },
                  }));
                }
              }, 2000);

              get().addNotification(
                "Summary generated successfully",
                "success"
              );
            } else {
              throw new Error(result?.error || "Failed to generate summary");
            }
          } catch (error: any) {
            console.error("Store: Error generating summary:", error);

            // Check if the selected event is still the same
            if (get().meetingDetail.selectedEventId === selectedEventId) {
              set((state) => ({
                meetingDetail: {
                  ...state.meetingDetail,
                  summaryGenerateStatus: "error",
                },
              }));

              get().addNotification(
                `Error generating summary: ${error.message || "Unknown error"}`,
                "error"
              );
            }
          }
        },

        loadSummaryForSelectedEvent: async () => {
          const selectedEventId = get().meetingDetail.selectedEventId;
          if (!selectedEventId) return;

          try {
            const result = await window.electronAPI.loadSummary(
              selectedEventId
            );

            // Check if the selected event is still the same
            if (get().meetingDetail.selectedEventId !== selectedEventId) return;

            if (result && result.success && result.summary) {
              // Update meetingDetail state
              set((state) => ({
                meetingDetail: {
                  ...state.meetingDetail,
                  currentSummary: result.summary,
                  currentSummaryModel: result.model || "",
                  currentSummaryTimestamp: result.timestamp || "",
                },
                // Update meeting cache
                meetings: {
                  ...state.meetings,
                  data: {
                    ...state.meetings.data,
                    [selectedEventId]: {
                      ...state.meetings.data[selectedEventId],
                      summary: result.summary,
                      modelUsed: result.model || undefined,
                      lastUpdated: result.timestamp || undefined,
                    },
                  },
                },
              }));
            }
          } catch (error: any) {
            console.error("Store: Error loading summary:", error);

            // We don't update status here as this is just a load operation
            // and we don't want to interfere with other statuses
          }
        },

        retryTranscription: async () => {
          const selectedEventId = get().meetingDetail.selectedEventId;
          if (!selectedEventId) return;

          // Get the job ID from the transcription jobs map if available
          const currentJob =
            get().transcription.transcriptionJobs[selectedEventId];
          const jobId = currentJob?.jobId;

          try {
            // Optimistic update for transcript status
            set((state) => ({
              meetingDetail: {
                ...state.meetingDetail,
                currentTranscriptStatus: "queued",
                currentTranscriptProgress: 0,
                currentTranscriptError: undefined,
              },
              // Also update the transcription job
              transcription: {
                ...state.transcription,
                transcriptionJobs: {
                  ...state.transcription.transcriptionJobs,
                  [selectedEventId]: {
                    ...state.transcription.transcriptionJobs[selectedEventId],
                    status: "queued",
                    progress: 0,
                    error: undefined,
                  },
                },
              },
            }));

            // Call the API to retry transcription
            const result = await window.electronAPI.retryTranscription(
              selectedEventId,
              jobId
            );

            // Check if there was an immediate error
            if (result && typeof result === "object" && "error" in result) {
              throw new Error(result.error);
            }

            // For successful operations, updates will come through IPC listeners
            // so we don't need to update state here
          } catch (error: any) {
            console.error("Store: Error retrying transcription:", error);

            // Check if the selected event is still the same
            if (get().meetingDetail.selectedEventId === selectedEventId) {
              set((state) => ({
                meetingDetail: {
                  ...state.meetingDetail,
                  currentTranscriptStatus: "failed",
                  currentTranscriptError: error.message || "Unknown error",
                },
                // Also update the transcription job
                transcription: {
                  ...state.transcription,
                  transcriptionJobs: {
                    ...state.transcription.transcriptionJobs,
                    [selectedEventId]: {
                      ...state.transcription.transcriptionJobs[selectedEventId],
                      status: "failed",
                      error: error.message || "Unknown error",
                    },
                  },
                },
              }));

              get().addNotification(
                `Error retrying transcription: ${
                  error.message || "Unknown error"
                }`,
                "error"
              );
            }
          }
        },

        // IPC Listener handlers
        synchronizeTranscriptionState: (job) => {
          if (!job || !job.eventId) return;

          // Always update the transcription jobs map
          set((state) => ({
            transcription: {
              ...state.transcription,
              transcriptionJobs: {
                ...state.transcription.transcriptionJobs,
                [job.eventId]: job,
              },
            },
          }));

          // If this is the selected event, update meeting detail state too
          if (job.eventId === get().meetingDetail.selectedEventId) {
            set((state) => ({
              meetingDetail: {
                ...state.meetingDetail,
                currentTranscriptStatus: job.status,
                currentTranscriptProgress: job.progress || 0,
                currentTranscriptError: job.error || undefined,
                hasTranscriptForSummary:
                  job.status === "completed" && !!job.transcript,
                ...(job.transcript && { currentTranscript: job.transcript }),
              },
            }));
          }

          // Update the meeting cache regardless
          set((state) => ({
            meetings: {
              ...state.meetings,
              data: {
                ...state.meetings.data,
                [job.eventId]: {
                  ...state.meetings.data[job.eventId],
                  eventId: job.eventId,
                  hasTranscript: job.status === "completed" && !!job.transcript,
                  ...(job.transcript && { transcript: job.transcript }),
                },
              },
            },
          }));

          // If job is completed, refresh meeting cache to get any other updates
          if (job.status === "completed" && job.transcript) {
            // Don't await here, just trigger the refresh
            get().refreshMeetingCache();
          }
        },

        handleIpcTranscriptionUpdate: (job) => {
          console.log("Store: Received transcription update for job", job);
          // Use the synchronize helper to update all related state
          get().synchronizeTranscriptionState(job);
        },

        handleIpcTranscriptionQueued: (job) => {
          console.log("Store: Received transcription queued for job", job);
          // Use the synchronize helper to update all related state
          get().synchronizeTranscriptionState(job);
        },

        handleIpcRecordingUpdate: (state, eventId) => {
          console.log("Store: Received recording state update", state, eventId);

          // Update recording state
          set((prevState) => ({
            recording: {
              ...prevState.recording,
              state: state as RECORDING_STATES,
              ...(eventId && { recordingEventId: eventId }),
            },
          }));

          // If recording is completed, this typically means a new recording is available
          // for transcription, so we might want to refresh the transcription state
          if (state === RECORDING_STATES.COMPLETED && eventId) {
            // Refresh meeting cache to get any new transcriptions
            get().refreshMeetingCache();
          }
        },

        handleIpcAuthUpdate: (authState) => {
          console.log("Store: Received auth state update", authState);

          // Update auth state
          set((state) => ({
            auth: {
              ...state.auth,
              isAuthenticated: authState,
            },
          }));

          // If now authenticated, fetch events
          if (authState) {
            get().fetchEvents();
          } else {
            // If logged out, clear events
            set((state) => ({
              calendar: {
                ...state.calendar,
                events: [],
              },
            }));
          }
        },

        handleIpcRecordingError: (error) => {
          console.error("Store: Received recording error", error);

          // Show notification
          get().addNotification(`Recording error: ${error}`, "error");
        },

        // Initialize all IPC listeners
        initListeners: () => {
          console.log("Store: Initializing IPC listeners");

          // Set up listener for transcription updates
          const unsubTranscriptionUpdate =
            window.electronAPI.onTranscriptionUpdate((job) =>
              get().handleIpcTranscriptionUpdate(job)
            );

          // Set up listener for transcription queued
          const unsubTranscriptionQueued =
            window.electronAPI.onTranscriptionQueued((job) =>
              get().handleIpcTranscriptionQueued(job)
            );

          // Set up listener for recording state updates
          const unsubRecordingUpdate =
            window.electronAPI.onRecordingStateUpdate((state, eventId) =>
              get().handleIpcRecordingUpdate(state, eventId)
            );

          // Set up listener for auth state changes
          const unsubAuthUpdate = window.electronAPI.onAuthStateChanged(
            (authState) => get().handleIpcAuthUpdate(authState)
          );

          // Set up listener for recording errors
          const unsubRecordingError = window.electronAPI.onRecordingError(
            (error) => get().handleIpcRecordingError(error)
          );

          // Return a combined cleanup function
          return () => {
            console.log("Store: Cleaning up IPC listeners");
            unsubTranscriptionUpdate();
            unsubTranscriptionQueued();
            unsubRecordingUpdate();
            unsubAuthUpdate();
            unsubRecordingError();
          };
        },

        // Notes saving actions
        saveNote: async (force = false) => {
          // Destructure needed state values *at the beginning* of the function call
          // This captures the state relevant to the potential save operation.
          const { currentNotes, selectedEventId, currentNotesEventId } =
            get().meetingDetail;

          // Determine the event ID for which the save should happen.
          // This is the ID associated with the notes currently in the editor buffer.
          const targetEventId = currentNotesEventId;

          // Capture the event ID that is currently selected in the UI for comparison later.
          const currentlySelectedEventIdInUI = selectedEventId;

          // --- Guard Conditions ---
          // 1. We must have a targetEventId associated with the notes.
          if (!targetEventId) {
            console.log(
              `Skipping saveNote: No targetEventId associated with current notes.`
            );
            return;
          }
          // 2. If not forcing the save, we only save if the notes belong to the currently selected event.
          if (!force && targetEventId !== currentlySelectedEventIdInUI) {
            console.log(
              `Skipping saveNote: Not forced, and targetEventId (${targetEventId}) does not match currently selected event (${currentlySelectedEventIdInUI}).`
            );
            return;
          }

          // Capture the actual notes content to save.
          const notesContentToSave = currentNotes;

          console.log(
            `Attempting to save note for event: ${targetEventId}. Force: ${force}. Content length: ${
              notesContentToSave?.length || 0
            }`
          );

          try {
            // --- Set Saving Status (UI Feedback) ---
            // Only show "saving..." in the UI if the event being saved is the one currently displayed.
            if (targetEventId === currentlySelectedEventIdInUI) {
              set((state) => ({
                meetingDetail: {
                  ...state.meetingDetail,
                  notesSaveStatus: "saving",
                },
              }));
            } else {
              // Log if saving a non-selected event's notes (e.g., via force=true during event switch)
              console.log(
                `Saving note for non-selected meeting: ${targetEventId}. UI status not set to 'saving'.`
              );
            }

            // --- Perform the Save Operation ---
            const result = await window.electronAPI.saveMeetingNote(
              targetEventId,
              notesContentToSave
            );

            // --- Handle Successful Save ---
            if (result && result.success) {
              console.log(`Save successful for event: ${targetEventId}`);

              // 1. Update the central cache unconditionally for the saved event.
              //    This ensures the data is stored correctly even if the user navigated away.
              set((state) => ({
                meetings: {
                  ...state.meetings,
                  data: {
                    ...state.meetings.data,
                    [targetEventId]: {
                      ...(state.meetings.data[targetEventId] || {}), // Preserve existing meeting data
                      eventId: targetEventId, // Ensure eventId is present
                      notes: notesContentToSave,
                      hasNotes: true, // Mark that notes exist
                    },
                  },
                },
              }));

              // 2. Check if the event we just saved is *still* selected in the UI *after* the await.
              const isStillSelected =
                get().meetingDetail.selectedEventId === targetEventId;

              if (isStillSelected) {
                // If still selected, update the UI status to 'saved'.
                set((state) => ({
                  meetingDetail: {
                    ...state.meetingDetail,
                    notesSaveStatus: "saved",
                  },
                }));

                // And set a timeout to reset the status back to 'idle' after a short delay.
                setTimeout(() => {
                  // Double-check inside the timeout: are we *still* on the same event,
                  // and is the status still 'saved' (i.e., hasn't been changed by typing)?
                  if (
                    get().meetingDetail.selectedEventId === targetEventId &&
                    get().meetingDetail.notesSaveStatus === "saved"
                  ) {
                    set((state) => ({
                      meetingDetail: {
                        ...state.meetingDetail,
                        notesSaveStatus: "idle",
                      },
                    }));
                  }
                }, 2000); // 2-second delay
              } else {
                // Log if the UI status wasn't updated because the selection changed.
                console.log(
                  `UI status not updated to 'saved' - event ${targetEventId} is no longer selected.`
                );
              }
            } else {
              // If result indicates failure from the backend.
              throw new Error(
                result?.error || "Failed to save note: Unknown backend error"
              );
            }
          } catch (error: any) {
            // --- Handle Errors During Save ---
            console.error(
              `Store: Error saving note for event ${targetEventId}:`,
              error
            );

            // Check *after* the error if the event we tried to save for is still selected.
            const isStillSelectedAfterError =
              get().meetingDetail.selectedEventId === targetEventId;

            if (isStillSelectedAfterError) {
              // If the failed event is still selected, update UI status to 'error' and notify.
              set((state) => ({
                meetingDetail: {
                  ...state.meetingDetail,
                  notesSaveStatus: "error",
                },
              }));
              get().addNotification(
                `Error saving note: ${error.message || "Unknown error"}`,
                "error"
              );
            } else {
              // Log if the UI status wasn't updated because the selection changed.
              console.log(
                `UI status not updated to 'error' - event ${targetEventId} is no longer selected.`
              );
              // Optional: Add a less intrusive notification about a background save failure?
              // get().addNotification(`Failed to save notes for a previous meeting (${targetEventId})`, "warning");
            }
          }
        },

        // Create debounced version of saveNote
        saveNoteDebounced: debounce(async () => {
          // Don't use force parameter for debounced saves
          await get().saveNote(false);
        }, 1000),

        updateNote: (content) => {
          const { selectedEventId, notesSaveStatus } = get().meetingDetail;
          if (!selectedEventId) return;

          // Cancel any pending saves before updating content
          get().saveNoteDebounced.cancel();

          // Store the current event ID to check for race conditions
          const currentEventId = selectedEventId;

          // Update notes content immediately (optimistic update)
          set((state) => ({
            meetingDetail: {
              ...state.meetingDetail,
              currentNotes: content,
              // Store the event ID with the note content to prevent race conditions
              currentNotesEventId: currentEventId,
            },
          }));

          // Reset status if needed
          if (notesSaveStatus === "saved" || notesSaveStatus === "error") {
            set((state) => ({
              meetingDetail: {
                ...state.meetingDetail,
                notesSaveStatus: "idle",
              },
            }));
          }

          // Trigger debounced save
          get().saveNoteDebounced();
        },

        // Cleanup function for debounced functions
        clearDebouncedFunctions: () => {
          // Cancel any pending debounced functions
          get().saveNoteDebounced.cancel();

          // Add other debounced functions here as needed

          // Log that we've cleared all pending operations
          console.log("Store: Cleared all pending debounced operations");
        },

        // Set active tab
        setActiveTab: (tab) => {
          set((state) => ({
            meetingDetail: {
              ...state.meetingDetail,
              activeTab: tab,
            },
          }));
        },

        // Settings actions
        saveSettings: async (settings) => {
          try {
            // Save settings to electron-store via IPC
            const result = await window.electronAPI.invokeRenderer(
              "save-all-settings",
              settings
            );

            if (result && typeof result === "object" && "error" in result) {
              throw new Error(result.error);
            }

            // Update local state
            set((state) => ({
              settings: settings,
            }));

            get().addNotification("Settings saved successfully", "success");
          } catch (error: any) {
            console.error("Store: Error saving settings:", error);
            get().addNotification(
              "Error saving settings: " + (error.message || "Unknown error"),
              "error"
            );
            throw error; // Re-throw to let the component handle it
          }
        },
      }),
      {
        name: "daily-sync-storage",
        storage: createJSONStorage(() => sessionStorage),
        partialize: (state) => ({
          // Only persist selected parts of the state
          settings: state.settings,
          recording: {
            selectedAudioDevice: state.recording.selectedAudioDevice,
          },
        }),
      }
    ),
    { name: "daily-sync-store" }
  )
);

export default useStore;
