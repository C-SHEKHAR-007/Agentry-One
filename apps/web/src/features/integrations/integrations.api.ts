import { baseApi } from "../../services/api/baseApi";
import { routes } from "../../services/api/routes";
import type { InstagramHelperStatus, InstagramLoginProgress } from "../../models";

const login = routes.integrations.instagramBrowserLogin;

/** The Instagram browser-login helper, proxied by the API. Nothing here is
 * cached once unused: each check and each login starts from the helper's
 * live state. */
export const integrationsApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    instagramHelperStatus: build.query<InstagramHelperStatus, void>({
      query: () => login.status,
      keepUnusedDataFor: 0,
    }),
    instagramLoginSession: build.query<InstagramLoginProgress, void>({
      query: () => login.session,
      keepUnusedDataFor: 0,
    }),
    startInstagramLogin: build.mutation<{ status: string }, { projectId: string }>({
      query: (body) => ({ url: login.start, method: "POST", body }),
    }),
    cancelInstagramLogin: build.mutation<void, void>({
      query: () => ({ url: login.cancel, method: "POST" }),
    }),
  }),
});

export const {
  useInstagramHelperStatusQuery,
  useInstagramLoginSessionQuery,
  useStartInstagramLoginMutation,
  useCancelInstagramLoginMutation,
} = integrationsApi;
