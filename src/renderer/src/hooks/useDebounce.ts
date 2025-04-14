import { useState, useEffect, useRef } from 'react';

/**
 * A hook that debounces a value with a specified delay
 * @param value The value to debounce
 * @param delay The delay in milliseconds
 * @param resetTrigger Optional value that when changed will reset the debounce state
 * @returns The debounced value
 */
export default function useDebounce<T, R = any>(
  value: T, 
  delay: number, 
  resetTrigger?: R
): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);
  
  // Track if this is the first change (on initial mount)
  const isFirstRender = useRef(true);
  // Track the initial value to compare against
  const initialValue = useRef<T>(value);
  // Track the previous reset trigger
  const prevResetTrigger = useRef<R | undefined>(resetTrigger);

  // Reset debounce state when resetTrigger changes
  useEffect(() => {
    if (
      resetTrigger !== undefined && 
      prevResetTrigger.current !== resetTrigger && 
      !isFirstRender.current
    ) {
      // Reset state when the trigger changes (e.g., when eventId changes)
      isFirstRender.current = true;
      initialValue.current = value;
      setDebouncedValue(value);
    }
    
    prevResetTrigger.current = resetTrigger;
  }, [resetTrigger, value]);

  useEffect(() => {
    // If this is the first render, set the value immediately without debounce
    // This prevents unnecessary debouncing when initially loading data
    if (isFirstRender.current) {
      setDebouncedValue(value);
      initialValue.current = value;
      isFirstRender.current = false;
      return;
    }
    
    // Skip debouncing if setting back to initial value (prevents save loops)
    if (value === initialValue.current) {
      setDebouncedValue(value);
      return;
    }
    
    // For all subsequent updates, use the debounce timer
    const timer = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    // Clean up the timeout if the value changes before the delay period
    return () => {
      clearTimeout(timer);
    };
  }, [value, delay]);

  return debouncedValue;
}