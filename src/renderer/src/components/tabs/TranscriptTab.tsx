import React, { useState, useCallback, useMemo } from "react";
import { formatTranscript } from "../../utils/transcriptUtils";
import useStore from "../../store";
import { AppState } from "../../store/types";

interface TranscriptTabProps {
  eventId: string;
}

const TranscriptTab: React.FC<TranscriptTabProps> = ({ eventId }) => {
  // Get state from store using selective selectors
  const transcriptData = useStore((state: AppState) => ({
    transcript: state.meetingDetail.currentTranscript,
    status: state.meetingDetail.currentTranscriptStatus,
    progress: state.meetingDetail.currentTranscriptProgress,
    error: state.meetingDetail.currentTranscriptError,
    isLoading: state.meetingDetail.isDetailLoading,
  }));

  // Get the job ID from the transcription jobs map if needed
  const jobData = useStore(
    (state: AppState) => state.transcription.transcriptionJobs[eventId]
  );

  // Get actions individually to avoid rerenders
  const retryTranscriptionAction = useStore(
    (state: AppState) => state.retryTranscription
  );
  const showNotification = useStore((state: AppState) => state.addNotification);

  // Memoize event handlers to prevent unnecessary re-renders
  const retryTranscription = useCallback(async () => {
    try {
      await retryTranscriptionAction();
      // Updates will come through via IPC listeners handled by the store
    } catch (error) {
      console.error("Error retrying transcription:", error);
    }
  }, [retryTranscriptionAction]);

  const handleExport = useCallback(async () => {
    if (!transcriptData.transcript) {
      showNotification("No transcript to export", "info");
      return;
    }

    try {
      // Create a more descriptive filename
      const date = new Date().toISOString().split("T")[0];
      const filename = `transcript-${date}-${eventId.substring(0, 8)}.txt`;

      const result = await window.electronAPI.exportFile({
        content: transcriptData.transcript,
        filename: filename,
        title: "Export Transcript",
      });

      if (result.success) {
        showNotification("Transcript exported successfully", "success");
      } else if (result.canceled) {
        // User canceled the export, no need to show notification
      } else if ("error" in result) {
        showNotification(
          `Error exporting transcript: ${result.error}`,
          "error"
        );
      }
    } catch (error) {
      console.error("Error exporting transcript:", error);
      showNotification("Failed to export transcript", "error");
    }
  }, [transcriptData.transcript, eventId, showNotification]);

  const handleCopy = useCallback(() => {
    if (!transcriptData.transcript) {
      showNotification("No transcript to copy", "info");
      return;
    }

    navigator.clipboard
      .writeText(transcriptData.transcript)
      .then(() => showNotification("Transcript copied to clipboard", "success"))
      .catch((error) => {
        console.error("Error copying transcript:", error);
        showNotification("Failed to copy transcript to clipboard", "error");
      });
  }, [transcriptData.transcript, showNotification]);

  // Memoize the action buttons for completed state
  const actionButtons = useMemo(
    () => (
      <div className="flex justify-end space-x-2 mb-2">
        <button
          onClick={handleCopy}
          className="px-3 py-1 bg-gray-100 hover:bg-gray-200 rounded text-sm font-medium flex items-center"
          title="Copy to clipboard"
        >
          <svg
            className="w-4 h-4 mr-1"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3"
            />
          </svg>
          Copy
        </button>
        <button
          onClick={handleExport}
          className="px-3 py-1 bg-gray-100 hover:bg-gray-200 rounded text-sm font-medium flex items-center"
          title="Export transcript"
        >
          <svg
            className="w-4 h-4 mr-1"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
            />
          </svg>
          Export
        </button>
      </div>
    ),
    [handleCopy, handleExport]
  );

  // Show loading indicator
  if (transcriptData.isLoading) {
    return (
      <div className="flex justify-center items-center h-full">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  // Render content based on transcription state
  const renderContent = () => {
    // Using a function to contain the switch statement to make it easier to maintain
    switch (transcriptData.status) {
      case "idle":
        return (
          <div className="text-center py-8">
            <svg
              className="h-12 w-12 text-gray-400 mx-auto mb-4"
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
            <h3 className="text-lg font-medium text-gray-900 mb-1">
              No transcript available
            </h3>
            <p className="text-sm text-gray-600 mb-4">
              Record the meeting to generate a transcript
            </p>
          </div>
        );

      case "queued":
        return (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500 mx-auto mb-4"></div>
            <h3 className="text-lg font-medium text-gray-900 mb-1">
              Transcription queued
            </h3>
            <p className="text-sm text-gray-600 mb-4">
              Your recording is waiting to be processed...
            </p>
          </div>
        );

      case "mixing":
        return (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500 mx-auto mb-4"></div>
            <h3 className="text-lg font-medium text-gray-900 mb-1">
              Preparing audio
            </h3>
            <p className="text-sm text-gray-600 mb-4">
              Mixing audio streams for transcription...
            </p>
          </div>
        );

      case "transcribing":
        // Ensure progress is a valid number
        const progress =
          typeof transcriptData.progress === "number"
            ? Math.round(transcriptData.progress)
            : 0;

        return (
          <div className="text-center py-8">
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              Transcribing your recording...
            </h3>

            <div className="max-w-md mx-auto mb-2">
              <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-500 rounded-full transition-all duration-300"
                  style={{ width: `${progress}%` }}
                ></div>
              </div>
            </div>

            <p className="text-sm font-medium text-gray-700">
              {progress}% complete
            </p>
          </div>
        );

      case "completed":
        if (!transcriptData.transcript) {
          return (
            <div className="text-center py-8">
              <svg
                className="h-12 w-12 text-yellow-500 mx-auto mb-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
              <h3 className="text-lg font-medium text-gray-900 mb-1">
                Transcription completed
              </h3>
              <p className="text-sm text-gray-600 mb-4">
                But no text was generated. Please try again.
              </p>
              <button
                onClick={retryTranscription}
                className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                Retry Transcription
              </button>
            </div>
          );
        }

        return (
          <div className="flex flex-col h-full">
            {actionButtons}

            <div
              className="flex-1 p-4 border rounded-lg overflow-y-auto"
              dangerouslySetInnerHTML={{
                __html: formatTranscript(transcriptData.transcript),
              }}
            />
          </div>
        );

      case "failed":
        return (
          <div className="text-center py-8">
            <svg
              className="h-12 w-12 text-red-500 mx-auto mb-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
            <h3 className="text-lg font-medium text-gray-900 mb-1">
              Transcription failed
            </h3>
            <p className="text-sm text-gray-600 mb-4">
              {transcriptData.error || "An unknown error occurred"}
            </p>
            <button
              onClick={retryTranscription}
              className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              Retry Transcription
            </button>
          </div>
        );

      default:
        return (
          <div className="text-center py-8">
            <p className="text-sm text-gray-600">
              Unexpected state: {transcriptData.status}
            </p>
          </div>
        );
    }
  };

  // Return memoized content based on transcript status
  return useMemo(
    () => renderContent(),
    [
      transcriptData.status,
      transcriptData.progress,
      transcriptData.transcript,
      transcriptData.error,
      actionButtons,
      retryTranscription,
    ]
  );
};

export default React.memo(TranscriptTab);
