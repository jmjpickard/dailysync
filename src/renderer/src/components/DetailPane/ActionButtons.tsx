import React from 'react'
import { CalendarEvent, NotificationType } from '../../types'
import { extractMeetingLink } from '../../utils/eventUtils'
import { RECORDING_STATES } from '../../constants'
import useStore from '../../store'

interface ActionButtonsProps {
  event: CalendarEvent;
  recordingState: string;
  activeRecordingEventId: string | null;
  selectedEventId: string;
  onStartRecording: () => void;
  onStopRecording: () => void;
  showNotification: (message: string, type: NotificationType) => void;
}

const ActionButtons: React.FC<ActionButtonsProps> = ({
  event,
  recordingState,
  activeRecordingEventId,
  selectedEventId,
  onStartRecording,
  onStopRecording,
  showNotification
}) => {
  // Check if we're recording this specific event
  const isRecording = activeRecordingEventId === selectedEventId && recordingState === RECORDING_STATES.RECORDING;
  
  // Check for various processing states
  const isProcessingRecording = 
    activeRecordingEventId === selectedEventId && 
    [RECORDING_STATES.STOPPING, RECORDING_STATES.PROCESSING].includes(recordingState as RECORDING_STATES);
  
  const isPermissionChecking = 
    activeRecordingEventId === selectedEventId && 
    [RECORDING_STATES.CHECKING_PERMISSIONS, RECORDING_STATES.REQUESTING_PERMISSIONS].includes(recordingState as RECORDING_STATES);
  
  const isWaitingForBrowser = 
    activeRecordingEventId === selectedEventId && 
    recordingState === RECORDING_STATES.WAITING_FOR_BROWSER;
  
  const isDisabled = 
    recordingState !== RECORDING_STATES.IDLE && 
    recordingState !== RECORDING_STATES.READY_TO_RECORD &&
    !isRecording;
  
  // Extract meeting link from event
  const meetingLink = extractMeetingLink(event);
  
  const handleJoinMeeting = () => {
    if (meetingLink) {
      window.electronAPI.openMeetingUrl(meetingLink)
        .then((result) => {
          if (result && typeof result === 'object' && 'error' in result) {
            showNotification(`Error opening meeting link: ${result.error}`, 'error');
          }
        })
        .catch((error) => {
          console.error('Error opening meeting link:', error);
          showNotification('Failed to open meeting link', 'error');
        });
    } else {
      showNotification('No meeting link available', 'info');
    }
  };
  
  // Get record button text based on state
  const getRecordButtonText = () => {
    switch (recordingState) {
      case RECORDING_STATES.CHECKING_PERMISSIONS:
      case RECORDING_STATES.REQUESTING_PERMISSIONS:
        return 'Checking Permissions...';
      case RECORDING_STATES.WAITING_FOR_BROWSER:
        return 'Opening Browser...';
      case RECORDING_STATES.RECORDING:
        return 'Stop Recording & Queue';
      case RECORDING_STATES.STOPPING:
        return 'Stopping...';
      case RECORDING_STATES.PROCESSING:
        return 'Processing...';
      default:
        return 'Record & Transcribe';
    }
  };
  
  return (
    <div className="flex space-x-2 mt-4">
      {/* Join Meeting Button */}
      {meetingLink && (
        <button
          onClick={handleJoinMeeting}
          className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded-lg flex items-center justify-center transition-colors"
        >
          <svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
          Join Meeting
        </button>
      )}
      
      {/* Record/Stop Button */}
      {isRecording || isProcessingRecording || isWaitingForBrowser || isPermissionChecking ? (
        <button
          onClick={onStopRecording}
          disabled={recordingState !== RECORDING_STATES.RECORDING}
          className={`
            flex-1 py-2 px-4 rounded-lg flex items-center justify-center transition-colors
            ${recordingState !== RECORDING_STATES.RECORDING
              ? 'bg-gray-300 text-gray-500 cursor-not-allowed' 
              : 'bg-red-600 hover:bg-red-700 text-white'}
          `}
          title={recordingState !== RECORDING_STATES.RECORDING 
            ? 'Cannot stop while processing or preparing recording' 
            : 'Stop recording and prepare for transcription'}
        >
          {isProcessingRecording || isPermissionChecking ? (
            <>
              <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent mr-2"></div>
              {getRecordButtonText()}
            </>
          ) : (
            <>
              {isWaitingForBrowser ? (
                <>{getRecordButtonText()}</>
              ) : (
                <>
                  <svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 10a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" />
                  </svg>
                  {getRecordButtonText()}
                </>
              )}
            </>
          )}
        </button>
      ) : (
        <button
          onClick={onStartRecording}
          disabled={isDisabled}
          className={`
            flex-1 py-2 px-4 rounded-lg flex items-center justify-center transition-colors
            ${isDisabled
              ? 'bg-gray-300 text-gray-500 cursor-not-allowed' 
              : 'bg-purple-600 hover:bg-purple-700 text-white'}
          `}
          title={isDisabled 
            ? activeRecordingEventId 
              ? 'A recording is already in progress for another meeting' 
              : 'Cannot record in current state'
            : 'Start recording this meeting'}
        >
          <svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
          </svg>
          {getRecordButtonText()}
        </button>
      )}
    </div>
  );
};

export default React.memo(ActionButtons);