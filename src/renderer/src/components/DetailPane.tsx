import React, { useState, useEffect, useCallback, useRef } from "react";
import MeetingHeader from "./meeting/MeetingHeader";
import MeetingInfo from "./meeting/MeetingInfo";
import ActionButtons from "./meeting/ActionButtons";
import TabContainer from "./tabs/TabContainer";
import NotesTab from "./tabs/NotesTab";
import TranscriptTab from "./tabs/TranscriptTab"; // Assuming similar refactor needed
import SummaryTab from "./tabs/SummaryTab"; // Assuming similar refactor needed
import { useDebounce } from "@renderer/hooks";
import { MeetingData } from "@renderer/types";

type TabType = "notes" | "transcript" | "summary";
type SaveStatus = "idle" | "loading" | "saving" | "saved" | "error";

interface DetailPaneProps {
  selectedEventId: string | null;
  isAuthenticated: boolean;
  showNotification: (
    message: string,
    type: "success" | "error" | "info" | "warning"
  ) => void;
}

const DetailPane: React.FC<DetailPaneProps> = ({
  selectedEventId,
  isAuthenticated, // Keep if needed for other logic
  showNotification,
}) => {
  // --- State for Meeting Details ---
  const [meeting, setMeeting] = useState<MeetingData | null>(null); // Use defined type
  const [isLoadingMeeting, setIsLoadingMeeting] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<TabType>("notes");

  // --- State for Notes (Lifted from NotesTab) ---
  const [notesContent, setNotesContent] = useState<string>("");
  const [initialNotesContent, setInitialNotesContent] = useState<string>(""); // Track initial state for save comparison
  const [notesSaveStatus, setNotesSaveStatus] = useState<SaveStatus>("idle");
  const notesLoaded = useRef<boolean>(false); // Track if notes have been loaded for current event

  // --- State for Transcript & Summary (Placeholder - Apply similar pattern) ---
  // const [transcriptContent, setTranscriptContent] = useState<string>('');
  // const [summaryContent, setSummaryContent] = useState<string>('');

  // --- State for Recording ---
  const [recordingState, setRecordingState] = useState<string>("idle");
  const [activeRecordingEventId, setActiveRecordingEventId] = useState<
    string | null
  >(null);

  // --- Refs for Async Operations ---
  const currentEventIdRef = useRef<string | null>(null); // Track the ID we are actually working with

  // --- Debounce Notes ---
  // Debounce the notesContent state. Delay of 1 second.
  const debouncedNotes = useDebounce(notesContent, 1000);

  // --- Effect for Loading Data on Event Change ---
  useEffect(() => {
    // Update the ref immediately when selectedEventId changes
    currentEventIdRef.current = selectedEventId;

    if (selectedEventId) {
      console.log(
        `DetailPane: Event changed to ${selectedEventId}. Loading data.`
      );
      // Reset states for the new event
      setIsLoadingMeeting(true);
      setMeeting(null);
      setNotesContent(""); // Clear notes immediately
      setInitialNotesContent("");
      setNotesSaveStatus("loading");
      notesLoaded.current = false;
      // Reset transcript/summary states here too

      // Load all meeting data (details, notes, transcript, summary)
      loadAllMeetingData(selectedEventId);
    } else {
      // Clear all state if no event is selected
      console.log("DetailPane: No event selected. Clearing data.");
      setMeeting(null);
      setNotesContent("");
      setInitialNotesContent("");
      setNotesSaveStatus("idle");
      notesLoaded.current = false;
      currentEventIdRef.current = null;
      // Clear transcript/summary states
    }
  }, [selectedEventId]); // Only re-run when selectedEventId changes

  // --- Function to Load All Data ---
  const loadAllMeetingData = async (eventId: string) => {
    // Ensure we are still loading for the intended eventId
    if (eventId !== currentEventIdRef.current) {
      console.log(
        `DetailPane: Aborting load for ${eventId} as event changed to ${currentEventIdRef.current}`
      );
      return;
    }
    console.log(`DetailPane: Loading all data for ${eventId}`);
    setIsLoadingMeeting(true); // Keep overall loading state

    try {
      // Fetch main meeting details
      const meetingResult = await window.electronAPI.loadMeetingNote(eventId);
      if (eventId !== currentEventIdRef.current) return; // Check again after await

      if (meetingResult.success) {
        setMeeting(meetingResult.data);
      } else {
        showNotification(
          `Error loading meeting details: ${meetingResult.error}`,
          "error"
        );
        setMeeting(null); // Clear meeting details on error
      }

      // Fetch notes specifically (storage function returns string directly)
      setNotesSaveStatus("loading"); // Set notes status specifically
      const notesResult = await window.electronAPI.loadMeetingNote(eventId);
      if (eventId !== currentEventIdRef.current) return; // Check again

      // notesResult should be the string content directly based on refactored storage
      console.log(
        `DetailPane: Loaded notes for ${eventId}, length: ${
          notesResult?.length ?? 0
        }`
      );
      setNotesContent(notesResult || ""); // Handle null/undefined just in case
      setInitialNotesContent(notesResult || "");
      setNotesSaveStatus("idle");
      notesLoaded.current = true;

      // TODO: Fetch transcript data similarly
      // const transcriptResult = await window.electronAPI.loadTranscript(eventId);
      // if (eventId !== currentEventIdRef.current) return;
      // setTranscriptContent(transcriptResult?.text || '');

      // TODO: Fetch summary data similarly
      // const summaryResult = await window.electronAPI.loadSummary(eventId);
      // if (eventId !== currentEventIdRef.current) return;
      // setSummaryContent(summaryResult?.summary || '');
    } catch (error) {
      console.error("Error loading meeting data:", error);
      showNotification("Failed to load meeting details", "error");
      // Reset states on catch
      setMeeting(null);
      setNotesContent("");
      setInitialNotesContent("");
      setNotesSaveStatus("error");
      notesLoaded.current = false;
    } finally {
      // Ensure we only stop loading if we are still on the same event
      if (eventId === currentEventIdRef.current) {
        setIsLoadingMeeting(false);
        // If notes status is still loading (e.g., error happened before notes loaded), set to error
        if (notesSaveStatus === "loading") {
          setNotesSaveStatus("error");
        }
      }
    }
  };

  // --- Effect for Debounced Notes Saving ---
  useEffect(() => {
    // Only save if:
    // 1. Notes have loaded for the current event
    // 2. The debounced notes are different from the initial notes loaded
    // 3. We are not currently loading/saving
    // 4. The event ID context is still the currently selected one
    if (
      notesLoaded.current &&
      debouncedNotes !== initialNotesContent &&
      notesSaveStatus !== "loading" &&
      notesSaveStatus !== "saving" &&
      currentEventIdRef.current && // Ensure we have an event context
      selectedEventId === currentEventIdRef.current // Double check prop vs ref
    ) {
      console.log(
        `DetailPane: Debounced change detected for ${currentEventIdRef.current}. Saving notes.`
      );
      saveNotes(debouncedNotes, currentEventIdRef.current);
    }
  }, [
    debouncedNotes,
    initialNotesContent,
    notesLoaded.current,
    selectedEventId,
    notesSaveStatus,
  ]); // Dependencies

  // --- Function to Save Notes ---
  const saveNotes = async (content: string, targetEventId: string) => {
    // Prevent saving if targetEventId doesn't match the current context
    if (targetEventId !== currentEventIdRef.current || !targetEventId) {
      console.warn(
        `DetailPane: Aborting save for ${targetEventId} because current event is ${currentEventIdRef.current}`
      );
      return;
    }

    setNotesSaveStatus("saving");
    try {
      console.log(`DetailPane: Calling saveMeetingNote for ${targetEventId}`);
      // Assuming saveMeetingNote now returns a simple success/error object
      const result = await window.electronAPI.saveMeetingNote(
        targetEventId,
        content
      );

      // IMPORTANT: Check if the event context is STILL valid *after* the await
      if (targetEventId === currentEventIdRef.current) {
        if (result.success) {
          setNotesSaveStatus("saved");
          setInitialNotesContent(content); // Update baseline upon successful save
          console.log(
            `DetailPane: Notes saved successfully for ${targetEventId}`
          );
        } else {
          showNotification(`Error saving notes: ${result.error}`, "error");
          setNotesSaveStatus("error");
        }
      }
    } catch (error) {
      console.error("Error saving notes:", error);
      showNotification("Failed to save notes", "error");
      setNotesSaveStatus("error");
    }
  };

  const handleTabChange = (tab: TabType) => {
    setActiveTab(tab);
  };

  const handleNotesChange = (newNotes: string) => {
    setNotesContent(newNotes);
  };

  const startRecording = () => {
    // Implementation of startRecording
  };

  const stopRecording = () => {
    // Implementation of stopRecording
  };

  return (
    <div className="w-2/5 h-full bg-white p-4 flex flex-col overflow-hidden">
      {meeting && <MeetingHeader meeting={meeting} />}
      {meeting && <MeetingInfo meeting={meeting} />}
      {meeting && selectedEventId && (
        <ActionButtons
          meeting={meeting}
          recordingState={recordingState}
          activeRecordingEventId={activeRecordingEventId}
          selectedEventId={selectedEventId} // Pass the actual selected ID
          onStartRecording={startRecording}
          onStopRecording={stopRecording}
          showNotification={showNotification}
        />
      )}

      {/* Tab Container - Render children based on activeTab */}
      {/* The key change is passing state down and getting changes via callbacks */}
      <TabContainer activeTab={activeTab} onTabChange={handleTabChange}>
        {/* Notes Tab */}
        <div className={activeTab === "notes" ? "block h-full" : "hidden"}>
          {/* Render NotesTab only when active, but state is held in DetailPane */}
          {/* Pass down notes state, save status, and change handler */}
          {selectedEventId && (
            <NotesTab
              eventId={selectedEventId} // Keep passing eventId for context if needed (e.g., export)
            />
          )}
        </div>

        {/* Transcript Tab (Apply similar pattern) */}
        <div className={activeTab === "transcript" ? "block h-full" : "hidden"}>
          {/* Example: Pass transcript data down */}
          {selectedEventId && <TranscriptTab eventId={selectedEventId} />}
        </div>

        {/* Summary Tab (Apply similar pattern) */}
        <div className={activeTab === "summary" ? "block h-full" : "hidden"}>
          {/* Example: Pass summary data down */}
          {selectedEventId && <SummaryTab eventId={selectedEventId} />}
        </div>
      </TabContainer>
    </div>
  );
};

export default DetailPane;
