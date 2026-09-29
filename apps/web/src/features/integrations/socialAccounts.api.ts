import { baseApi } from "../../services/api/baseApi";
import { routes } from "../../services/api/routes";
import type { ConnectionTestResult, DirectLoginBody, SocialAccount } from "../../models";

/** A project's connected social accounts are cached under this tag. */
export const projectAccountsTag = (projectId: string) => ({ type: "SocialAccount" as const, id: `project:${projectId}` });

export const socialAccountsApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    socialAccounts: build.query<SocialAccount[], string>({
      query: (projectId) => routes.socialAccounts.list(projectId),
      providesTags: (res, _err, projectId) => [
        ...(res ?? []).map((a) => ({ type: "SocialAccount" as const, id: a.id })),
        projectAccountsTag(projectId),
      ],
    }),
    /** Connects an account with credentials (bot token, API keys, password...). */
    connectSocialAccount: build.mutation<SocialAccount, DirectLoginBody>({
      query: (body) => ({ url: routes.socialAccounts.directLogin, method: "POST", body }),
      invalidatesTags: (_res, _err, { projectId }) => [projectAccountsTag(projectId)],
    }),
    testSocialAccount: build.mutation<ConnectionTestResult, { id: string; projectId: string }>({
      query: ({ id }) => ({ url: routes.socialAccounts.test(id), method: "POST" }),
      invalidatesTags: (_res, _err, { id }) => [{ type: "SocialAccount", id }],
    }),
    deleteSocialAccount: build.mutation<void, { id: string; projectId: string }>({
      query: ({ id }) => ({ url: routes.socialAccounts.detail(id), method: "DELETE" }),
      invalidatesTags: (_res, _err, { id, projectId }) => [{ type: "SocialAccount", id }, projectAccountsTag(projectId)],
    }),
  }),
});

export const {
  useSocialAccountsQuery,
  useConnectSocialAccountMutation,
  useTestSocialAccountMutation,
  useDeleteSocialAccountMutation,
} = socialAccountsApi;
