import { useEffect } from "react";
import { useAppDispatch } from "../../app/hooks";
import { refreshSession } from "./auth.slice";

/** Works out the session once at startup (setup pending / signed in / out). */
export function SessionBootstrap() {
  const dispatch = useAppDispatch();
  useEffect(() => {
    void dispatch(refreshSession());
  }, [dispatch]);
  return null;
}
