import { useEffect } from "react";
import { useAppDispatch } from "../../../app/hooks";
import { startActivityStream } from "../../../services/realtime/activity";

/** One live-activity stream for the whole app (see services/realtime/activity). */
export function useLiveActivity(enabled: boolean) {
  const dispatch = useAppDispatch();
  useEffect(() => {
    if (!enabled) return;
    return startActivityStream(dispatch);
  }, [enabled, dispatch]);
}
