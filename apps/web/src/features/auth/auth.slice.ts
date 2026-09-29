import { createAsyncThunk, createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type { AuthStatus, AuthUser } from "../../models";
import { baseApi } from "../../services/api/baseApi";
import { authApi } from "./auth.api";

interface AuthState {
  status: AuthStatus;
  user: AuthUser | null;
}
const initialState: AuthState = { status: "loading", user: null };

/** Works out who is signed in: first-run setup pending, signed in (with the
 * user), or signed out. Always asks the server (no cache). */
export const refreshSession = createAsyncThunk("auth/refreshSession", async (_: void, { dispatch }) => {
  const setup = await dispatch(authApi.endpoints.setupStatus.initiate(undefined, { forceRefetch: true, subscribe: false })).unwrap();
  if (setup.needsSetup) return { status: "needsSetup" as const, user: null };
  try {
    const me = await dispatch(authApi.endpoints.me.initiate(undefined, { forceRefetch: true, subscribe: false })).unwrap();
    return { status: "authed" as const, user: me.user };
  } catch {
    return { status: "unauthed" as const, user: null };
  }
});

/** Ends the session and drops every cached response, so the next person on
 * this browser never sees the previous user's projects, providers or team. */
export const logout = createAsyncThunk("auth/logout", async (_: void, { dispatch }) => {
  await dispatch(authApi.endpoints.logout.initiate()).unwrap().catch(() => null);
  dispatch(baseApi.util.resetApiState());
});

const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    /** A request came back 401 (session expired or revoked). */
    sessionExpired(state) {
      state.status = "unauthed";
      state.user = null;
    },
    setUser(state, action: PayloadAction<AuthUser>) {
      state.user = action.payload;
    },
  },
  extraReducers: (b) => {
    b.addCase(refreshSession.fulfilled, (state, { payload }) => {
      state.status = payload.status;
      state.user = payload.user;
    });
    b.addCase(refreshSession.rejected, (state) => {
      state.status = "unauthed";
      state.user = null;
    });
    b.addCase(logout.fulfilled, (state) => {
      state.status = "unauthed";
      state.user = null;
    });
    // A profile update returns the fresh user.
    b.addMatcher(authApi.endpoints.updateProfile.matchFulfilled, (state, { payload }) => {
      if (payload?.user) state.user = payload.user;
    });
  },
});

export const { sessionExpired, setUser } = authSlice.actions;
export const authReducer = authSlice.reducer;
