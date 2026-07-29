"use client";

import { useCallback, useRef, useSyncExternalStore } from "react";

/**
 * Ticking clock for countdowns. Stays `null` through the server render and the
 * hydrating client render so both produce identical markup, then starts
 * reporting wall-clock time once subscribed.
 */
export function useNow(intervalMs = 10_000): number | null {
  const snapshot = useRef<number | null>(null);

  const subscribe = useCallback(
    (onStoreChange: () => void) => {
      const tick = () => {
        snapshot.current = Date.now();
        onStoreChange();
      };
      tick();
      const timer = setInterval(tick, intervalMs);
      return () => clearInterval(timer);
    },
    [intervalMs],
  );

  return useSyncExternalStore(
    subscribe,
    () => snapshot.current,
    () => null,
  );
}
