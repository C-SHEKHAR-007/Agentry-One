import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";

/** Queries that show run activity. Invalidating only refetches the ones a
 * mounted page is using, so an idle page makes no requests at all. */
const LIVE_KEYS = [
  ["events"],
  ["template-runs"],
  ["template-run"],
  ["workflows", "recent"],
  ["workflow"],
  ["stats", "overview"],
  ["templates", "library"],
];
/** Settled work changes per-agent totals too. */
const SETTLED = /completed|failed|cancelled/;

/**
 * One server-sent-events stream for the whole app (GET /events/stream): the
 * API pushes a signal whenever a run starts, finishes, fails or waits for
 * review, and we refetch what's on screen. Replaces fast polling; the
 * queries keep a slow fallback interval in case the stream drops. Bursts
 * (a workflow finishing several steps at once) coalesce into one refetch.
 */
export function useLiveActivity(enabled: boolean) {
  const queryClient = useQueryClient();
  useEffect(() => {
    if (!enabled) return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let settled = false;
    const flush = () => {
      timer = null;
      for (const queryKey of LIVE_KEYS) void queryClient.invalidateQueries({ queryKey });
      if (settled) void queryClient.invalidateQueries({ queryKey: ["stats", "agents"] });
      settled = false;
    };
    const source = new EventSource("/api/events/stream");
    source.onmessage = (event) => {
      try {
        const { type } = JSON.parse(event.data) as { type?: string };
        if (type && SETTLED.test(type)) settled = true;
      } catch {
        return;
      }
      if (!timer) timer = setTimeout(flush, 750);
    };
    return () => {
      source.close();
      if (timer) clearTimeout(timer);
    };
  }, [enabled, queryClient]);
}
