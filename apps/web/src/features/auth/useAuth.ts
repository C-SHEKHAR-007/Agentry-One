import { useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAppDispatch, useAppSelector } from "../../app/hooks";
import { logout as logoutThunk, refreshSession } from "./auth.slice";

/** Who is signed in, plus refresh (after login/setup/profile changes) and
 * logout. Same shape as the previous AuthContext. */
export function useAuth() {
  const dispatch = useAppDispatch();
  const { status, user } = useAppSelector((s) => s.auth);
  // During the v2.2 migration some pages still use TanStack Query; clear it
  // on logout too so nothing from the previous user survives.
  const queryClient = useQueryClient();
  const refresh = useCallback(async () => {
    await dispatch(refreshSession());
  }, [dispatch]);
  const logout = useCallback(async () => {
    await dispatch(logoutThunk());
    queryClient.clear();
  }, [dispatch, queryClient]);
  return { status, user, refresh, logout };
}
