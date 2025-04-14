import { useCallback, useEffect, useState } from 'react';

/**
 * Map of event channels to their callback types
 */
type IpcListenerMap = {
  onAuthStateChanged: (isAuthenticated: boolean) => void;
  onRecordingStateUpdate: (state: string, eventId?: string) => void;
  onRecordingError: (error: string) => void;
  onTranscriptionQueued: (job: any) => void;
  onTranscriptionUpdate: (job: any) => void;
};

/**
 * Hook to listen for IPC events from the main process
 * 
 * @param channel - The channel to listen on
 * @param callback - The callback to call when an event is received
 */
export function useIpcListener<T extends keyof IpcListenerMap>(
  channel: T, 
  callback: IpcListenerMap[T]
) {
  useEffect(() => {
    // Type assertion needed because TypeScript can't infer the correct method
    const cleanup = (window.electronAPI[channel] as any)(callback);
    return cleanup;
  }, [channel, callback]);
}

/**
 * Hook that returns a function to invoke an IPC method
 * 
 * @param method - The method name to invoke
 * @returns A function that will invoke the method
 */
export function useIpcInvoke<T extends keyof Omit<Window['electronAPI'], keyof IpcListenerMap>>(
  method: T
) {
  // Use useCallback to memoize the function
  return useCallback(
    (...args: Parameters<Window['electronAPI'][T]>) => {
      return (window.electronAPI[method] as any)(...args);
    },
    [method]
  );
}

/**
 * Hook to fetch data using IPC and manage loading/error states
 * 
 * @param method - The method name to invoke
 * @param params - Parameters to pass to the method
 * @param initialData - Initial data to use
 * @param immediate - Whether to fetch immediately
 */
export function useIpcQuery<
  T extends keyof Omit<Window['electronAPI'], keyof IpcListenerMap>,
  R = Awaited<ReturnType<Window['electronAPI'][T]>>
>(
  method: T,
  params: Parameters<Window['electronAPI'][T]>,
  initialData: R | null = null,
  immediate = true
) {
  const [data, setData] = useState<R | null>(initialData);
  const [isLoading, setIsLoading] = useState(immediate);
  const [error, setError] = useState<string | null>(null);
  
  const invoke = useIpcInvoke(method);
  
  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const result = await invoke(...params);
      
      // Check if the result includes an error property
      if (result && typeof result === 'object' && 'error' in result) {
        setError(result.error as string);
        setData(null);
      } else {
        setData(result as R);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setData(null);
    } finally {
      setIsLoading(false);
    }
  }, [invoke, ...params]);
  
  useEffect(() => {
    if (immediate) {
      fetchData();
    }
  }, [fetchData, immediate]);
  
  return { data, isLoading, error, refetch: fetchData };
}