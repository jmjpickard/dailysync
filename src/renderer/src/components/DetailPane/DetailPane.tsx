import React, { useCallback, useMemo } from "react";
import useStore from "../../store";
import { shallow } from "zustand/shallow"; // Import shallow
import TabContainer from "../tabs/TabContainer";
import NotesTab from "../tabs/NotesTab";
import TranscriptTab from "../tabs/TranscriptTab";
import SummaryTab from "../tabs/SummaryTab";
import EventHeader from "./EventHeader";
import EventInfoSection from "./EventInfoSection";
import ActionButtons from "./ActionButtons";
import { AppState } from "../../store/types"; // Ensure this path is correct

type TabType = "notes" | "transcript" | "summary";

const DetailPane: React.FC = () => {
  // Get state needed for rendering logic and passing down
  const {
    activeTab,
    isDataReadyForSelectedEvent, // Primary flag for rendering content
    selectedEventId,
  } = useStore((state: AppState) => ({
    activeTab: state.meetingDetail.activeTab,
    isDataReadyForSelectedEvent:
      state.meetingDetail.isDataReadyForSelectedEvent,
    selectedEventId: state.calendar.selectedEventId,
  }));

  // Select events array separately (consider if needed elsewhere or only for selectedEvent)
  const events = useStore((state: AppState) => state.calendar.events);

  // Select recording data - accessing the CORRECT state field
  const recordingData = useStore((state: AppState) => ({
    recordingState: state.recording.state,
    // Access correct field, rename locally if desired (as before)
    activeRecordingEventId: state.recording.recordingEventId,
  }));

  // Select actions individually
  const setActiveTabAction = useStore((state: AppState) => state.setActiveTab);
  const showNotification = useStore((state: AppState) => state.addNotification);
  const startRecordingAction = useStore(
    (state: AppState) => state.startRecording
  );
  const stopRecordingAction = useStore(
    (state: AppState) => state.stopRecording
  );

  // Derive the selected event object only when data is ready
  const selectedEvent = useMemo(() => {
    if (isDataReadyForSelectedEvent && selectedEventId) {
      return events.find((event) => event.id === selectedEventId) || null;
    }
    return null; // Not ready or no ID, so no event object needed yet
  }, [events, selectedEventId, isDataReadyForSelectedEvent]);

  // Memoized callbacks
  const handleTabChange = useCallback(
    (tab: TabType) => {
      setActiveTabAction(tab);
    },
    [setActiveTabAction]
  );

  const startRecording = useCallback(async () => {
    if (!selectedEventId) return;
    try {
      await startRecordingAction(selectedEventId);
    } catch (error) {
      console.error("DetailPane: Error starting recording:", error);
    }
  }, [selectedEventId, startRecordingAction]);

  const stopRecording = useCallback(async () => {
    try {
      await stopRecordingAction();
    } catch (error) {
      console.error("DetailPane: Error stopping recording:", error);
    }
  }, [stopRecordingAction]);

  // --- Render Logic ---

  // 1. If no event is selected ever, show placeholder
  if (!selectedEventId) {
    return (
      <div className="flex-1 h-full bg-white p-4 flex flex-col justify-center items-center text-gray-500">
        <p>Select a meeting to view details</p>
      </div>
    );
  }

  // 2. If an event IS selected, but data is NOT ready, show loader
  if (!isDataReadyForSelectedEvent) {
    return (
      <div className="flex-1 h-full bg-white p-4 flex flex-col justify-center items-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <p className="mt-2 text-gray-500">
          Loading meeting details for {selectedEventId}...
        </p>
      </div>
    );
  }

  // 3. If data IS ready, but we somehow didn't find the event object (defensive check)
  if (!selectedEvent) {
    console.error(
      "DetailPane Error: Data marked ready, but selectedEvent object not found for ID:",
      selectedEventId
    );
    return (
      <div className="flex-1 h-full bg-white p-4 flex flex-col justify-center items-center text-red-500">
        Error loading event details. Please select another event or restart.
      </div>
    );
  }

  // --- Render Full Content ---
  // An event is selected, data is ready, and we found the event object
  return (
    <div className="flex-1 h-full bg-white p-4 flex flex-col overflow-hidden">
      {/* Render Header, Info, Buttons only when event data is available */}
      <EventHeader event={selectedEvent} />
      <EventInfoSection event={selectedEvent} />
      <ActionButtons
        event={selectedEvent}
        recordingState={recordingData.recordingState}
        activeRecordingEventId={recordingData.activeRecordingEventId} // Pass the correctly accessed/renamed state
        selectedEventId={selectedEventId}
        onStartRecording={startRecording}
        onStopRecording={stopRecording}
        showNotification={showNotification}
      />

      {/* Render Tabs - only when data is ready */}
      <TabContainer activeTab={activeTab} onTabChange={handleTabChange}>
        {/* Use key prop to ensure clean remount on event switch */}
        {activeTab === "notes" && (
          <NotesTab key={selectedEventId} eventId={selectedEventId} />
        )}
        {activeTab === "transcript" && (
          <TranscriptTab key={selectedEventId} eventId={selectedEventId} />
        )}
        {activeTab === "summary" && (
          <SummaryTab key={selectedEventId} eventId={selectedEventId} />
        )}
      </TabContainer>
    </div>
  );
};

// Memo might still offer some benefit if props like recordingData change less often
export default React.memo(DetailPane);
