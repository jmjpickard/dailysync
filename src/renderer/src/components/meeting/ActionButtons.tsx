import React from "react";

interface ActionButtonsProps {
  meeting: any;
  recordingState: string;
  activeRecordingEventId: string | null;
  selectedEventId: string;
  onStartRecording: () => void;
  onStopRecording: () => void;
  showNotification: (
    message: string,
    type: "success" | "error" | "info" | "warning"
  ) => void;
}

const ActionButtons: React.FC<ActionButtonsProps> = ({
  meeting,
  recordingState,
  activeRecordingEventId,
  selectedEventId,
  onStartRecording,
  onStopRecording,
  showNotification,
}) => {
  const isRecording =
    activeRecordingEventId === selectedEventId &&
    recordingState === "recording";
  const isProcessingRecording =
    activeRecordingEventId === selectedEventId &&
    ["stopping", "processing"].includes(recordingState);
  const isWaitingForBrowser =
    activeRecordingEventId === selectedEventId &&
    recordingState === "waiting_for_browser";

  const handleJoinMeeting = () => {
    if (meeting.hangoutLink) {
      window.electronAPI
        .openMeetingUrl(meeting.hangoutLink)
        .then((result: any) => {
          if ("error" in result) {
            showNotification(
              `Error opening meeting link: ${result.error}`,
              "error"
            );
          }
        })
        .catch((error: any) => {
          console.error("Error opening meeting link:", error);
          showNotification("Failed to open meeting link", "error");
        });
    } else {
      showNotification("No meeting link available", "info");
    }
  };

  return (
    <div className="flex space-x-2 mt-4">
      {meeting.hangoutLink && (
        <button
          onClick={handleJoinMeeting}
          className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded-lg flex items-center justify-center transition-colors"
        >
          <svg
            className="w-5 h-5 mr-2"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
            />
          </svg>
          Join Meeting
        </button>
      )}

      {isRecording || isProcessingRecording || isWaitingForBrowser ? (
        <button
          onClick={onStopRecording}
          disabled={isProcessingRecording || isWaitingForBrowser}
          className={`
            flex-1 py-2 px-4 rounded-lg flex items-center justify-center transition-colors
            ${
              isProcessingRecording || isWaitingForBrowser
                ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                : "bg-red-600 hover:bg-red-700 text-white"
            }
          `}
        >
          {isProcessingRecording ? (
            <>
              <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent mr-2"></div>
              Processing...
            </>
          ) : isWaitingForBrowser ? (
            <>Starting...</>
          ) : (
            <>
              <svg
                className="w-5 h-5 mr-2"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 10a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z"
                />
              </svg>
              Stop Recording
            </>
          )}
        </button>
      ) : (
        <button
          onClick={onStartRecording}
          disabled={recordingState !== "idle"}
          className={`
            flex-1 py-2 px-4 rounded-lg flex items-center justify-center transition-colors
            ${
              recordingState !== "idle"
                ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                : "bg-purple-600 hover:bg-purple-700 text-white"
            }
          `}
        >
          <svg
            className="w-5 h-5 mr-2"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
            />
          </svg>
          Record & Transcribe
        </button>
      )}
    </div>
  );
};

export default ActionButtons;
