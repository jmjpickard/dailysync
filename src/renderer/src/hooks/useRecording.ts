import { useState, useCallback, useEffect } from 'react';
import { useIpcInvoke, useIpcListener } from './useIpc';
import { RECORDING_STATES } from '../constants';
import { AudioDevice } from '../types';

/**
 * Hook to manage recording state and actions
 */
export function useRecording() {
  const [recordingState, setRecordingState] = useState<RECORDING_STATES>(RECORDING_STATES.IDLE);
  const [currentEventId, setCurrentEventId] = useState<string | null>(null);
  const [audioDevices, setAudioDevices] = useState<AudioDevice[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  const startRecording = useIpcInvoke('startRecording');
  const stopRecording = useIpcInvoke('stopRecording');
  const getAudioDevices = useIpcInvoke('getAudioDevices');
  const checkScreenCaptureSupport = useIpcInvoke('checkScreenCaptureSupport');
  const openPrivacySettings = useIpcInvoke('openPrivacySettings');
  
  // Listen for recording state updates
  useIpcListener('onRecordingStateUpdate', (state, eventId) => {
    setRecordingState(state as RECORDING_STATES);
    if (eventId) {
      setCurrentEventId(eventId);
    }
  });
  
  // Listen for recording errors
  useIpcListener('onRecordingError', (errorMessage) => {
    setError(errorMessage);
  });
  
  // Fetch available audio devices
  const loadAudioDevices = useCallback(async () => {
    try {
      const devices = await getAudioDevices();
      if (Array.isArray(devices)) {
        setAudioDevices(devices);
        // If no device is selected and we have devices, select the first one
        if (!selectedDevice && devices.length > 0) {
          setSelectedDevice(devices[0].id);
        }
      } else if (devices && 'error' in devices) {
        setError(devices.error);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, [getAudioDevices, selectedDevice]);
  
  // Load audio devices on mount
  useEffect(() => {
    loadAudioDevices();
  }, [loadAudioDevices]);
  
  // Start recording function
  const startRecordingSession = useCallback(async (eventId: string) => {
    try {
      setError(null);
      const result = await startRecording(eventId);
      
      if (result && typeof result === 'object' && 'error' in result) {
        setError(result.error);
        return false;
      }
      
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      return false;
    }
  }, [startRecording]);
  
  // Stop recording function
  const stopRecordingSession = useCallback(async () => {
    try {
      setError(null);
      const result = await stopRecording();
      
      if (result && typeof result === 'object' && 'error' in result) {
        setError(result.error);
        return false;
      }
      
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      return false;
    }
  }, [stopRecording]);
  
  // Check if screen capture is supported
  const checkScreenCapture = useCallback(async () => {
    try {
      return await checkScreenCaptureSupport();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      return { supported: false, reason: String(err) };
    }
  }, [checkScreenCaptureSupport]);
  
  // Open system privacy settings
  const openSystemPrivacySettings = useCallback(async (section: 'microphone' | 'screen') => {
    try {
      await openPrivacySettings(section);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, [openPrivacySettings]);
  
  return {
    recordingState,
    currentEventId,
    audioDevices,
    selectedDevice,
    error,
    setSelectedDevice,
    startRecording: startRecordingSession,
    stopRecording: stopRecordingSession,
    checkScreenCapture,
    openSystemPrivacySettings,
    refreshAudioDevices: loadAudioDevices
  };
}