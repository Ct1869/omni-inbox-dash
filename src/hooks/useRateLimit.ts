import { useRef } from 'react';
import { toast } from 'sonner';

/**
 * Custom hook for rate limiting function calls
 * Prevents spam by limiting the number of calls within a time window
 * 
 * @param limit - Maximum number of calls allowed in the time window
 * @param windowMs - Time window in milliseconds
 * @returns A function that wraps the original function with rate limiting
 * 
 * @example
 * const rateLimitedSend = useRateLimit(5, 60000); // 5 calls per minute
 * const handleSend = rateLimitedSend(async () => {
 *   // Your async logic here
 * });
 */
export function useRateLimit(limit: number, windowMs: number) {
  const callTimestamps = useRef<number[]>([]);

  return function rateLimit<T extends (...args: any[]) => Promise<any>>(
    fn: T
  ): (...args: Parameters<T>) => Promise<ReturnType<T> | void> {
    return async (...args: Parameters<T>) => {
      const now = Date.now();
      
      // Remove old timestamps outside the window
      callTimestamps.current = callTimestamps.current.filter(
        ts => now - ts < windowMs
      );

      // Check if limit exceeded
      if (callTimestamps.current.length >= limit) {
        const waitSeconds = Math.ceil(windowMs / 1000);
        toast.error(`Too many requests. Please wait ${waitSeconds} seconds.`);
        return;
      }

      // Add current timestamp
      callTimestamps.current.push(now);
      
      // Execute function
      return await fn(...args);
    };
  };
}
