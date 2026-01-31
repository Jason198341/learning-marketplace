import { useState, useEffect, useRef, useCallback } from 'react';

interface UseApiOptions {
  immediate?: boolean;
  timeout?: number;
}

interface UseApiReturn<T> {
  data: T | null;
  isLoading: boolean;
  error: Error | null;
  execute: () => Promise<T | null>;
  reset: () => void;
}

export function useApi<T>(
  apiCall: () => Promise<T>,
  deps: unknown[] = [],
  options: UseApiOptions = {}
): UseApiReturn<T> {
  const { immediate = true, timeout = 10000 } = options;

  const [data, setData] = useState<T | null>(null);
  const [isLoading, setIsLoading] = useState(immediate);
  const [error, setError] = useState<Error | null>(null);

  const isMountedRef = useRef(true);
  const abortControllerRef = useRef<AbortController | null>(null);

  const execute = useCallback(async (): Promise<T | null> => {
    // Cancel previous request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    setIsLoading(true);
    setError(null);

    try {
      // Create timeout promise
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Request timeout')), timeout);
      });

      // Race between API call and timeout
      const result = await Promise.race([apiCall(), timeoutPromise]);

      if (isMountedRef.current) {
        setData(result);
        setIsLoading(false);
        return result;
      }
    } catch (err) {
      console.error('[useApi] Error:', err);
      if (isMountedRef.current) {
        setError(err instanceof Error ? err : new Error('Unknown error'));
        setData(null);
        setIsLoading(false);
      }
    }

    return null;
  }, [apiCall, timeout]);

  const reset = useCallback(() => {
    setData(null);
    setError(null);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    isMountedRef.current = true;

    if (immediate) {
      execute();
    }

    return () => {
      isMountedRef.current = false;
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return { data, isLoading, error, execute, reset };
}

export default useApi;
