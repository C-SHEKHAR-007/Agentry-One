import { useEffect, useState } from "react";

/** The current time, re-rendering every `intervalMs` while `active`. For live
 * elapsed timers and "updated 12s ago" labels. */
export function useNow(intervalMs = 1000, active = true): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs, active]);
  return now;
}
