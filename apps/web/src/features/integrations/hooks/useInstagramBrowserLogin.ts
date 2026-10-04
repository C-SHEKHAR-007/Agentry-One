import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useAppDispatch } from "../../../app/hooks";
import { errorMessage } from "../../../services/http/errors";
import {
  useCancelInstagramLoginMutation,
  useInstagramHelperStatusQuery,
  useInstagramLoginSessionQuery,
  useStartInstagramLoginMutation,
} from "../integrations.api";
import { projectAccountsTag, socialAccountsApi } from "../socialAccounts.api";

const POLL_MS = 1500;

/**
 * The one-click Instagram login: the helper (via the API) opens Chrome on
 * the desktop, the user signs in there, and the helper links the account.
 * While a login is in progress its state is polled -- also while this tab
 * is in the background, since the user is busy in the Chrome window.
 */
export function useInstagramBrowserLogin({ projectId, enabled, onConnected }: { projectId: string; enabled: boolean; onConnected: () => void }) {
  const dispatch = useAppDispatch();
  const [active, setActive] = useState(false);
  const [message, setMessage] = useState("");
  const [offline, setOffline] = useState<boolean | null>(null);

  const helper = useInstagramHelperStatusQuery(undefined, { skip: !enabled, refetchOnMountOrArgChange: true });
  const session = useInstagramLoginSessionQuery(undefined, { skip: !active, pollingInterval: POLL_MS });
  const [startLogin] = useStartInstagramLoginMutation();
  const [cancelLogin] = useCancelInstagramLoginMutation();

  // Each check of the helper replaces what a failed start concluded.
  useEffect(() => {
    if (helper.currentData) setOffline(!helper.currentData.online);
    else if (helper.isError) setOffline(true);
  }, [helper.currentData, helper.isError]);

  const progress = session.currentData;
  useEffect(() => {
    if (!active || !progress) return;
    const stop = () => {
      setActive(false);
      setMessage("");
    };
    if (progress.status === "success") {
      stop();
      toast.success(`Instagram account ${progress.handle || ""} connected successfully!`);
      dispatch(socialAccountsApi.util.invalidateTags([projectAccountsTag(projectId)]));
      onConnected();
    } else if (progress.status === "closed") {
      stop();
      toast.warning("Chrome window was closed before Instagram login completed.");
    } else if (progress.status === "failed") {
      stop();
      toast.error(progress.error || "Instagram login failed.");
    } else if (progress.status === "in_progress") {
      setMessage(progress.elapsed > 0 ? `Waiting for login in Chrome window (${progress.elapsed}s)...` : "Waiting for login in Chrome window...");
    }
  }, [active, progress, projectId, dispatch, onConnected]);

  const start = () => {
    setMessage("Opening Google Chrome on your desktop...");
    startLogin({ projectId })
      .unwrap()
      .then(() => {
        setOffline(false);
        setActive(true);
        setMessage("Chrome is open! Please log into Instagram in Chrome...");
        toast.info("Google Chrome opened! Please log into Instagram in the browser window.");
      })
      .catch((err) => {
        setMessage("");
        if ((err as { code?: string })?.code === "helper_offline") setOffline(true);
        toast.error(errorMessage(err, "Could not start the Instagram login"));
      });
  };

  const cancel = () => {
    setActive(false);
    setMessage("");
    cancelLogin().catch(() => {});
  };

  return {
    /** null until checked. */
    helperOnline: offline === null ? null : !offline,
    /** A login is starting or waiting for the user. */
    loggingIn: active || message !== "",
    message,
    start,
    cancel,
  };
}
