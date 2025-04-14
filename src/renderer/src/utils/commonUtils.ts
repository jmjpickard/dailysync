/**
 * General utility functions
 */

/**
 * Debounce function to limit how often a function is called
 * @param func The function to debounce
 * @param wait The time to wait in milliseconds
 * @returns A debounced function
 */
export function debounce<F extends (...args: any[]) => any>(
  func: F,
  wait: number
): (...args: Parameters<F>) => void {
  let timeout: ReturnType<typeof setTimeout> | null = null;

  return function (...args: Parameters<F>): void {
    if (timeout !== null) {
      clearTimeout(timeout);
    }

    timeout = setTimeout(() => {
      func(...args);
      timeout = null;
    }, wait);
  };
}