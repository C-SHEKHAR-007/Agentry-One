import { baseApi } from "../../services/api/baseApi";
import { routes } from "../../services/api/routes";
import type { SocialAccount } from "../../models";

export const socialAccountsApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    socialAccounts: build.query<SocialAccount[], string>({
      query: (projectId) => routes.socialAccounts.list(projectId),
      providesTags: (res, _err, projectId) => [
        ...(res ?? []).map((a) => ({ type: "SocialAccount" as const, id: a.id })),
        { type: "SocialAccount", id: `project:${projectId}` },
      ],
    }),
  }),
});

export const { useSocialAccountsQuery } = socialAccountsApi;
