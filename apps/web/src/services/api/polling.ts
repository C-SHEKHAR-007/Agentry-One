import { useEffect, useState } from "react";

/** Fallback refresh for data kept fresh by the live activity stream: only
 * matters if the stream drops. */
export const FALLBACK_POLL_MS = 5 * 60_000;

/** Common options: poll at `ms`, but not while the tab is hidden (matches
 * the previous TanStack Query behaviour). */
export const poll = (ms: number) => ({ pollingInterval: ms, skipPollingIfUnfocused: true });

/**
 * Polling that runs only while the data says it's live (e.g. a run that is
 * still running). Starts polling until the first response arrives, then
 * follows its status.
 */
export function useLiveInterval(status: string | undefined, liveStatuses: readonly string[], ms: number): number {
  const [interval, setIntervalMs] = useState(ms);
  useEffect(() => {
    setIntervalMs(status === undefined || liveStatuses.includes(status) ? ms : 0);
  }, [status, liveStatuses, ms]);
  return interval;
}
