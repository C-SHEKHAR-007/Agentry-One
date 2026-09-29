import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAppDispatch } from "../../../app/hooks";
import { startActivityStream } from "../../../services/realtime/activity";

/** TanStack Query keys still used by pages not yet on RTK Query (v2.2
 * migration); removed with TanStack Query at the end of the migration. */
const LEGACY_KEYS = [["events"], ["template-runs"], ["template-run"], ["workflows", "recent"], ["workflow"], ["workflow-detail"], ["stats", "overview"], ["templates", "library"]];

/** One live-activity stream for the whole app (see services/realtime/activity). */
export function useLiveActivity(enabled: boolean) {
  const dispatch = useAppDispatch();
  const queryClient = useQueryClient();
  useEffect(() => {
    if (!enabled) return;
    return startActivityStream(dispatch, {
      onFlush: (settled) => {
        for (const queryKey of LEGACY_KEYS) void queryClient.invalidateQueries({ queryKey });
        if (settled) void queryClient.invalidateQueries({ queryKey: ["stats", "agents"] });
      },
    });
  }, [enabled, dispatch, queryClient]);
}
