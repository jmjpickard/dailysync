import { useState, useCallback, useEffect } from 'react';
import { useIpcInvoke, useIpcListener } from './useIpc';
import { TranscriptionState } from '../types';

/**
 * Hook to manage transcription state and actions for a specific event
 * 
 * @param eventId - The ID of the event to manage transcription for
 */
export function useTranscription(eventId: string | null) {
  const [transcriptionState, setTranscriptionState] = useState<TranscriptionState | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  
  const getTranscriptionJobsByEvent = useIpcInvoke('getTranscriptionJobsByEvent');
  const loadTranscript = useIpcInvoke('loadTranscript');
  const saveTranscriptionResult = useIpcInvoke('saveTranscriptionResult');
  const retryTranscription = useIpcInvoke('retryTranscription');
  
  // Listen for transcription queue updates
  useIpcListener('onTranscriptionQueued', (job) => {
    if (job.eventId === eventId) {
      setTranscriptionState(job);
    }
  });
  
  // Listen for transcription status updates
  useIpcListener('onTranscriptionUpdate', (job) => {
    if (job.eventId === eventId) {
      setTranscriptionState(job);
    }
  });
  
  // Load transcription job when eventId changes
  useEffect(() => {
    const loadTranscriptionJob = async () => {
      if (!eventId) {
        setTranscriptionState(null);
        return;
      }
      
      try {
        setIsLoading(true);
        const jobs = await getTranscriptionJobsByEvent(eventId);
        
        // Get the most recent job if available
        if (Array.isArray(jobs) && jobs.length > 0) {
          setTranscriptionState(jobs[0]);
        } else {
          setTranscriptionState(null);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
        setTranscriptionState(null);
      } finally {
        setIsLoading(false);
      }
    };
    
    loadTranscriptionJob();
  }, [eventId, getTranscriptionJobsByEvent]);
  
  // Function to load transcript content
  const getTranscriptContent = useCallback(async () => {
    if (!eventId) return null;
    
    try {
      setIsLoading(true);
      const result = await loadTranscript(eventId);
      
      if (result && typeof result === 'object') {
        if ('error' in result) {
          setError(result.error);
          return null;
        } else if ('success' in result && result.success && 'data' in result) {
          return result.data;
        }
      }
      
      return null;
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [eventId, loadTranscript]);
  
  // Function to save transcription result
  const saveTranscript = useCallback(async (
    status: 'completed' | 'failed',
    transcript?: string,
    errorMessage?: string
  ) => {
    if (!eventId) return false;
    
    try {
      setIsLoading(true);
      const result = await saveTranscriptionResult(eventId, status, transcript, errorMessage);
      
      if (result && typeof result === 'object' && 'error' in result) {
        setError(result.error);
        return false;
      }
      
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [eventId, saveTranscriptionResult]);
  
  // Function to retry transcription
  const retry = useCallback(async () => {
    if (!eventId) return false;
    
    try {
      setIsLoading(true);
      const jobId = transcriptionState?.jobId;
      const result = await retryTranscription(eventId, jobId);
      
      if (result && typeof result === 'object' && 'error' in result) {
        setError(result.error);
        return false;
      }
      
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [eventId, retryTranscription, transcriptionState?.jobId]);
  
  return {
    transcriptionState,
    isLoading,
    error,
    getTranscriptContent,
    saveTranscript,
    retryTranscription: retry
  };
}