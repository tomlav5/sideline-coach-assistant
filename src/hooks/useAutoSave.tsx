import { useEffect, useRef } from 'react';

interface UseAutoSaveProps {
  enabled: boolean;
  interval: number; // in milliseconds
  onSave: () => void;
}

export function useAutoSave({ enabled, interval, onSave }: UseAutoSaveProps) {
  const intervalRef = useRef<NodeJS.Timeout>();
  const saveCallbackRef = useRef(onSave);

  // Update the callback ref when onSave changes
  useEffect(() => {
    saveCallbackRef.current = onSave;
  }, [onSave]);

  useEffect(() => {
    if (enabled) {
      intervalRef.current = setInterval(() => {
        saveCallbackRef.current();
      }, interval);
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [enabled, interval]);

  // Save when page becomes hidden (user switches tabs/apps)
  useEffect(() => {
    if (!enabled) return;

    const handleVisibilityChange = () => {
      if (document.hidden) {
        saveCallbackRef.current();
      }
    };

    const handleBeforeUnload = () => {
      saveCallbackRef.current();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [enabled]);
}