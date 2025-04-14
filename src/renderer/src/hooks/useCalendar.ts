import { useState, useCallback, useEffect } from 'react';
import { useIpcInvoke } from './useIpc';
import { CalendarEvent } from '../types';

/**
 * Hook to fetch calendar events for a specific date
 * 
 * @param initialDate - Initial date to fetch events for
 * @param isAuthenticated - Whether the user is authenticated
 */
export function useCalendarEvents(initialDate: Date, isAuthenticated: boolean) {
  const [selectedDate, setSelectedDate] = useState<Date>(initialDate);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  
  const fetchEvents = useIpcInvoke('fetchEvents');
  const openMeetingUrl = useIpcInvoke('openMeetingUrl');
  
  const loadEvents = useCallback(async (date: Date) => {
    if (!isAuthenticated) {
      setEvents([]);
      return;
    }
    
    try {
      setIsLoading(true);
      setError(null);
      const result = await fetchEvents(date.toISOString());
      
      if (Array.isArray(result)) {
        setEvents(result);
      } else if (result && typeof result === 'object' && 'error' in result) {
        setError(result.error);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsLoading(false);
    }
  }, [fetchEvents, isAuthenticated]);
  
  // Load events when selected date or auth state changes
  useEffect(() => {
    loadEvents(selectedDate);
  }, [selectedDate, isAuthenticated, loadEvents]);
  
  // Function to change the selected date
  const changeDate = useCallback((date: Date) => {
    setSelectedDate(date);
  }, []);
  
  // Function to open a meeting URL
  const joinMeeting = useCallback(async (url: string) => {
    try {
      const result = await openMeetingUrl(url);
      return result;
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      return { error: String(err) };
    }
  }, [openMeetingUrl]);
  
  return {
    selectedDate,
    events,
    isLoading,
    error,
    changeDate,
    joinMeeting,
    refreshEvents: () => loadEvents(selectedDate)
  };
}