import { baseApi } from "../../services/api/baseApi";
import { routes } from "../../services/api/routes";
import type { AuthUser } from "../../models";

export interface LoginBody {
  email: string;
  password: string;
}
export interface SetupBody {
  email: string;
  password: string;
  firstName?: string;
  lastName?: string;
}
export interface ProfileBody {
  firstName?: string | null;
  lastName?: string | null;
  avatarUrl?: string | null;
  currentPassword?: string;
  newPassword?: string;
}

export const authApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    setupStatus: build.query<{ needsSetup: boolean }, void>({
      query: () => routes.auth.setupStatus,
    }),
    me: build.query<{ user: AuthUser }, void>({
      query: () => routes.auth.me,
      providesTags: ["Me"],
    }),
    login: build.mutation<{ user: AuthUser }, LoginBody>({
      query: (body) => ({ url: routes.auth.login, method: "POST", body }),
    }),
    setup: build.mutation<{ user: AuthUser }, SetupBody>({
      query: (body) => ({ url: routes.auth.setup, method: "POST", body }),
    }),
    logout: build.mutation<void, void>({
      query: () => ({ url: routes.auth.logout, method: "POST" }),
    }),
    updateProfile: build.mutation<{ user: AuthUser }, ProfileBody>({
      query: (body) => ({ url: routes.auth.profile, method: "PATCH", body }),
      invalidatesTags: ["Me", "User"],
    }),
  }),
});

export const { useLoginMutation, useSetupMutation, useUpdateProfileMutation } = authApi;
