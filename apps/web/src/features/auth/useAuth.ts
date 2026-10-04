import { useCallback } from "react";
import { useAppDispatch, useAppSelector } from "../../app/hooks";
import { logout as logoutThunk, refreshSession } from "./auth.slice";

/** Who is signed in, plus refresh (after login/setup/profile changes) and
 * logout (which also clears every cached API response). */
export function useAuth() {
  const dispatch = useAppDispatch();
  const { status, user } = useAppSelector((s) => s.auth);
  const refresh = useCallback(async () => {
    await dispatch(refreshSession());
  }, [dispatch]);
  const logout = useCallback(async () => {
    await dispatch(logoutThunk());
  }, [dispatch]);
  return { status, user, refresh, logout };
}
