import React, { useRef, useState, useCallback, useMemo } from "react";
import useStore from "../../store";
import { shallow } from "zustand/shallow";
import { LLMService } from "../../types";

interface SummaryTabProps {
  eventId: string;
}

// Helper function to format summary text with proper paragraph breaks
const formatSummaryText = (text: string): string => {
  if (!text) return "";

  // Split by lines and filter out empty lines
  const paragraphs = text.split("\n").filter((line) => line.trim().length > 0);

  // Join paragraphs with proper spacing
  return paragraphs.join("\n\n");
};

const SummaryTab: React.FC<SummaryTabProps> = ({ eventId }) => {
  // Get state from store using selective selectors
  const summaryData = useStore((state) => ({
    summary: state.meetingDetail.currentSummary,
    model: state.meetingDetail.currentSummaryModel,
    timestamp: state.meetingDetail.currentSummaryTimestamp,
    generateStatus: state.meetingDetail.summaryGenerateStatus,
    hasTranscript: state.meetingDetail.hasTranscriptForSummary,
    isLoading: state.meetingDetail.isDetailLoading,
  }));

  const llmState = useStore((state) => ({
    configuredServices: state.llm.configuredServices,
    selectedService: state.llm.selectedService,
    showServiceSelector: state.llm.showServiceSelector,
  }));

  // Get actions individually to avoid rerenders
  const generateSummary = useStore((state) => state.generateSummary);
  const toggleServiceSelector = useStore(
    (state) => state.toggleServiceSelector
  );
  const setSelectedLLMService = useStore(
    (state) => state.setSelectedLLMService
  );
  const showNotification = useStore((state) => state.addNotification);

  // Store last selected service
  const lastSelectedServiceRef = useRef<LLMService | null>(null);

  // Memoize event handlers with useCallback
  const handleServiceSelection = useCallback(() => {
    // If only one service is configured, use it directly
    if (llmState.configuredServices.length === 1) {
      generateSummary(llmState.configuredServices[0]);
    }
    // If multiple services are configured, show the selector
    else if (llmState.configuredServices.length > 1) {
      toggleServiceSelector(true);
    }
    // No services configured
    else {
      showNotification(
        "No LLM services configured. Please configure in Settings.",
        "error"
      );
    }
  }, [
    llmState.configuredServices,
    generateSummary,
    toggleServiceSelector,
    showNotification,
  ]);

  const handleSelectService = useCallback(
    (service: LLMService) => {
      // Remember last selected service
      lastSelectedServiceRef.current = service;

      // Set the selected service in the store
      setSelectedLLMService(service);

      // Generate the summary
      generateSummary(service);
    },
    [setSelectedLLMService, generateSummary]
  );

  const handleExport = useCallback(async () => {
    if (!summaryData.summary) {
      showNotification("No summary to export", "info");
      return;
    }

    try {
      // Format filename with date for better organization
      const date = new Date().toISOString().split("T")[0];
      const filename = `summary-${date}-${eventId.substring(0, 8)}.txt`;

      const result = await window.electronAPI.exportFile({
        content: summaryData.summary,
        filename: filename,
        title: "Export Summary",
      });

      if (result.success) {
        showNotification("Summary exported successfully", "success");
      } else if (result.canceled) {
        // User canceled the export, no need to show notification
      } else if ("error" in result) {
        showNotification(`Error exporting summary: ${result.error}`, "error");
      }
    } catch (error) {
      console.error("Error exporting summary:", error);
      showNotification("Failed to export summary", "error");
    }
  }, [summaryData.summary, eventId, showNotification]);

  const handleCopy = useCallback(() => {
    if (!summaryData.summary) {
      showNotification("No summary to copy", "info");
      return;
    }

    navigator.clipboard
      .writeText(summaryData.summary)
      .then(() => showNotification("Summary copied to clipboard", "success"))
      .catch((error) => {
        console.error("Error copying summary:", error);
        showNotification("Failed to copy summary to clipboard", "error");
      });
  }, [summaryData.summary, showNotification]);

  const handleCloseSelector = useCallback(() => {
    toggleServiceSelector(false);
  }, [toggleServiceSelector]);

  // Memoize UI components
  const serviceSelector = useMemo(() => {
    if (!llmState.showServiceSelector) return null;

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">
            Generate Summary
          </h3>
          <p className="text-sm text-gray-600 mb-4">
            Select a model to generate the summary:
          </p>

          <div className="space-y-2 mb-6">
            {llmState.configuredServices.map((service: LLMService) => (
              <button
                key={service}
                onClick={() => handleSelectService(service)}
                className={`w-full py-2 px-4 text-left rounded ${
                  service ===
                  (lastSelectedServiceRef.current || llmState.selectedService)
                    ? "bg-blue-50 text-blue-700 border border-blue-200"
                    : "hover:bg-gray-50 border border-gray-200"
                }`}
              >
                {service.charAt(0).toUpperCase() + service.slice(1)}
                {service === "ollama" && " (Local)"}
              </button>
            ))}
          </div>

          <div className="flex justify-end">
            <button
              onClick={handleCloseSelector}
              className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded text-sm font-medium"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    );
  }, [
    llmState.showServiceSelector,
    llmState.configuredServices,
    llmState.selectedService,
    handleSelectService,
    handleCloseSelector,
  ]);

  // Loading state
  const loadingView = useMemo(
    () => (
      <div className="flex justify-center items-center h-full">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-gray-900"></div>
      </div>
    ),
    []
  );

  // No transcript view
  const noTranscriptView = useMemo(
    () => (
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
            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
          />
        </svg>
        <h3 className="text-lg font-medium text-gray-900 mb-1">
          No transcript available
        </h3>
        <p className="text-sm text-gray-600 mb-4">
          A transcript is required to generate a summary. Record the meeting
          first.
        </p>
      </div>
    ),
    []
  );

  // Generate summary view
  const generateSummaryView = useMemo(
    () => (
      <div className="h-full flex flex-col">
        <div className="flex-1 flex flex-col items-center justify-center">
          <svg
            className="h-12 w-12 text-gray-400 mb-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
            />
          </svg>
          <h3 className="text-lg font-medium text-gray-900 mb-1">
            No summary yet
          </h3>
          <p className="text-sm text-gray-600 mb-4">
            Generate a summary of the transcript using AI.
          </p>

          <button
            onClick={handleServiceSelection}
            disabled={
              summaryData.generateStatus === "generating" ||
              llmState.configuredServices.length === 0
            }
            className={`inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white 
            ${
              llmState.configuredServices.length === 0
                ? "bg-gray-400 cursor-not-allowed"
                : "bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            }
          `}
            title={
              llmState.configuredServices.length === 0
                ? "Configure LLM API keys in Settings"
                : ""
            }
          >
            {summaryData.generateStatus === "generating" ? (
              <>
                <div className="animate-spin h-4 w-4 mr-2 border-2 border-white rounded-full border-t-transparent"></div>
                Generating...
              </>
            ) : (
              "Generate Summary"
            )}
          </button>

          {llmState.configuredServices.length === 0 && (
            <p className="text-xs text-red-500 mt-2">
              No LLM services configured. Please add API keys in Settings.
            </p>
          )}
        </div>
        {serviceSelector}
      </div>
    ),
    [
      summaryData.generateStatus,
      llmState.configuredServices.length,
      handleServiceSelection,
      serviceSelector,
    ]
  );

  // Summary display view
  const summaryDisplayView = useMemo(() => {
    // Memoize formatted timestamp to avoid recalculation on each render
    const formattedTimestamp = new Date(
      summaryData.timestamp || ""
    ).toLocaleString();

    return (
      <div className="flex flex-col h-full">
        <div className="flex justify-between items-center mb-2">
          <div className="text-xs text-gray-500">
            Generated with {summaryData.model} on {formattedTimestamp}
          </div>

          <div className="flex space-x-2">
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
              title="Export summary"
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
            <button
              onClick={handleServiceSelection}
              className="px-3 py-1 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded text-sm font-medium flex items-center"
              disabled={
                summaryData.generateStatus === "generating" ||
                llmState.configuredServices.length === 0
              }
              title={
                llmState.configuredServices.length === 0
                  ? "Configure LLM API keys in Settings"
                  : ""
              }
            >
              {summaryData.generateStatus === "generating" ? (
                <>
                  <div className="animate-spin h-3 w-3 mr-1 border-2 border-current rounded-full border-t-transparent"></div>
                  Regenerating...
                </>
              ) : (
                "Regenerate"
              )}
            </button>
          </div>
        </div>

        <div className="flex-1 p-4 border rounded-lg overflow-y-auto whitespace-pre-wrap">
          {formatSummaryText(summaryData.summary || "")}
        </div>

        {serviceSelector}
      </div>
    );
  }, [
    summaryData.model,
    summaryData.timestamp,
    summaryData.summary,
    summaryData.generateStatus,
    llmState.configuredServices.length,
    handleCopy,
    handleExport,
    handleServiceSelection,
    serviceSelector,
  ]);

  // Conditionally render the appropriate view based on state
  if (summaryData.isLoading) {
    return loadingView;
  }

  if (!summaryData.hasTranscript) {
    return noTranscriptView;
  }

  // No summary yet, but we have a transcript
  if (!summaryData.summary) {
    return generateSummaryView;
  }

  // Display the summary
  return summaryDisplayView;
};

export default React.memo(SummaryTab);
