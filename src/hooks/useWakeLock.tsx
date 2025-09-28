import { useRef, useEffect } from 'react';

export function useWakeLock() {
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);
  const isSupported = typeof navigator !== 'undefined' && 'wakeLock' in navigator;

  const requestWakeLock = async () => {
    try {
      if (isSupported) {
        // Request a new wake lock (replaces any previous reference)
        const sentinel = await (navigator as any).wakeLock.request('screen');
        wakeLockRef.current = sentinel as WakeLockSentinel;

        // Attempt re-acquire if the lock gets released by the UA
        // Some TS lib versions may not have addEventListener on the type; guard accordingly
        (wakeLockRef.current as any)?.addEventListener?.('release', () => {
          // Optionally re-request on release if page is visible
          if (document.visibilityState === 'visible') {
            // Fire and forget; errors are logged in the catch below
            requestWakeLock();
          }
        });
      }
    } catch (error) {
      // Can fail on unsupported platforms or when the device disallows wake locks
      console.error('Wake lock request failed:', error);
    }
  };

  const releaseWakeLock = () => {
    try {
      if (wakeLockRef.current) {
        wakeLockRef.current.release();
        wakeLockRef.current = null;
      }
    } catch (error) {
      console.error('Wake lock release failed:', error);
    }
  };

  // Re-acquire on visibility return (many browsers release when backgrounded)
  useEffect(() => {
    if (!isSupported) return;
    const onVisible = () => {
      if (document.visibilityState === 'visible' && !wakeLockRef.current) {
        requestWakeLock();
      }
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [isSupported]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      releaseWakeLock();
    };
  }, []);

  return {
    isSupported,
    requestWakeLock,
    releaseWakeLock,
  };
}