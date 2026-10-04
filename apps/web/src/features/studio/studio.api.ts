import { baseApi } from "../../services/api/baseApi";
import { routes } from "../../services/api/routes";
import { LIST } from "../../services/api/tags";
import type { BriefBody, BriefResult } from "../../models";

export const studioApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    /** Generates a workflow from a brief and starts its first run. */
    createBrief: build.mutation<BriefResult, { projectId: string; body: BriefBody }>({
      query: ({ projectId, body }) => ({ url: routes.projects.briefs(projectId), method: "POST", body }),
      invalidatesTags: [{ type: "Template", id: LIST }, { type: "Run", id: LIST }],
    }),
  }),
});

export const { useCreateBriefMutation } = studioApi;
