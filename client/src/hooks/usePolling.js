import { useEffect, useRef } from 'react';

export function usePolling(callback, intervalMs = 60000, enabled = true) {
  const savedCallback = useRef(callback);

  useEffect(() => {
    savedCallback.current = callback;
  }, [callback]);

  useEffect(() => {
    if (!enabled || !intervalMs) return;

    const id = setInterval(() => {
      if (savedCallback.current) {
        savedCallback.current();
      }
    }, intervalMs);

    return () => clearInterval(id);
  }, [intervalMs, enabled]);
}

export default usePolling;
