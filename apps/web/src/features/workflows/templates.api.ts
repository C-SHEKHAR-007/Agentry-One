import { baseApi } from "../../services/api/baseApi";
import { routes } from "../../services/api/routes";
import { listTags } from "../../services/api/tags";
import type { WorkflowSummary } from "../../models";

/** Workflows (templates): the library, the editor and schedules. */
export const templatesApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    workflowLibrary: build.query<WorkflowSummary[], string | void>({
      query: (projectId) => routes.templates.library(projectId || undefined),
      providesTags: (res) => listTags("Template", res),
    }),
  }),
});

export const { useWorkflowLibraryQuery } = templatesApi;
