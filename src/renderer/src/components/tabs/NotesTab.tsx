import React, { useCallback } from "react";
import useStore from "../../store";
import { shallow } from "zustand/shallow"; // Import shallow
import type { AppState } from "../../store/types"; // Ensure this path is correct

type SaveStatus = "idle" | "loading" | "saving" | "saved" | "error";

interface NotesTabProps {
  eventId: string; // The ID of the event this tab instance is for
}

const NotesTab: React.FC<NotesTabProps> = ({ eventId }) => {
  // Select only the state directly needed for displaying notes and status.
  // DetailPane now handles the loading/readiness state before rendering us.
  const { currentNotes, notesSaveStatus, currentNotesEventId } = useStore(
    (state: AppState) => ({
      currentNotes: state.meetingDetail.currentNotes,
      notesSaveStatus: state.meetingDetail.notesSaveStatus,
      // Read the event ID associated with the notes buffer for safety check
      currentNotesEventId: state.meetingDetail.currentNotesEventId,
    })
  );

  const updateNote = useStore((state: AppState) => state.updateNote);

  // --- Safety Check / Logging ---
  // Although DetailPane should prevent rendering if data isn't ready,
  // this check adds robustness. If the store's notes context doesn't
  // match this component's eventId, don't render potentially wrong notes.
  if (currentNotesEventId !== eventId) {
    console.warn(
      `NotesTab Render WARNING: Rendering NotesTab for event ${eventId} but the store's notes context (currentNotesEventId) is ${currentNotesEventId}. This might indicate a timing issue or a problem in DetailPane's render logic.`
    );
    // Return null or a placeholder to prevent showing wrong notes
    return (
      <div className="p-4 text-center text-gray-500 italic">
        Syncing note context...
      </div>
    );
  }
  // Log when rendering correctly
  // console.log(`NotesTab Render: Rendering notes area for ${eventId}. Length: ${currentNotes?.length}, Status: ${notesSaveStatus}`);
  // --- End Safety Check ---

  // Callback for textarea changes
  const handleNoteChange = useCallback(
    (event: React.ChangeEvent<HTMLTextAreaElement>) => {
      // Simple check: Ensure we only update if the context still matches
      if (currentNotesEventId === eventId) {
        updateNote(event.target.value);
      } else {
        console.warn("NotesTab: Blocked note update due to context mismatch.");
      }
    },
    [updateNote, currentNotesEventId, eventId] // Include dependencies
  );

  // --- Render Notes Area ---
  // We assume if we reach here, DetailPane has ensured data is ready
  return (
    <div className="flex flex-col h-full">
      {/* Textarea container */}
      <div className="flex-grow relative">
        <textarea
          className="w-full h-full p-4 border border-transparent focus:border-blue-500 resize-none focus:outline-none absolute inset-0"
          value={currentNotes} // Display notes from store
          onChange={handleNoteChange}
          placeholder="Type your meeting notes here..."
          aria-label={`Meeting notes for event ${eventId}`}
        />
      </div>
      {/* Save status footer */}
      <div className="flex justify-end p-2 bg-gray-50 border-t">
        <span className="text-sm text-gray-500 italic">
          {notesSaveStatus === "saving" && "Saving..."}
          {notesSaveStatus === "saved" && "All changes saved"}
          {notesSaveStatus === "error" && "Error saving changes"}
          {notesSaveStatus === "idle" && currentNotes && "Unsaved changes"}
          {notesSaveStatus === "idle" && !currentNotes && ""}{" "}
          {/* Handle idle & empty */}
        </span>
      </div>
    </div>
  );
};

export default NotesTab; // No need for React.memo if parent (DetailPane) controls render via key/readiness
