import { baseApi } from "../../services/api/baseApi";
import { routes } from "../../services/api/routes";
import { LIST, listTags } from "../../services/api/tags";
import type { ApiErrorShape } from "../../services/http/errors";
import type { Schedule, TemplateBody, TemplateDetail, TemplateRun, WorkflowSummary } from "../../models";

/** Workflows (templates): the library, the editor, runs and schedules. */
export const templatesApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    workflowLibrary: build.query<WorkflowSummary[], string | void>({
      query: (projectId) => routes.templates.library(projectId || undefined),
      providesTags: (res) => listTags("Template", res),
    }),
    template: build.query<TemplateDetail, string>({
      query: (id) => routes.templates.detail(id),
      providesTags: (_res, _err, id) => [{ type: "Template", id }],
    }),
    createTemplate: build.mutation<TemplateDetail, { projectId: string; body: TemplateBody }>({
      query: ({ projectId, body }) => ({ url: routes.projects.templates(projectId), method: "POST", body }),
      invalidatesTags: [{ type: "Template", id: LIST }, "Project"],
    }),
    updateTemplate: build.mutation<TemplateDetail, { id: string; body: TemplateBody }>({
      query: ({ id, body }) => ({ url: routes.templates.detail(id), method: "PUT", body }),
      // The editor already shows what was saved: write the response into the
      // detail cache (fresh when reopened) instead of refetching it, and
      // refresh the lists that show names and steps.
      invalidatesTags: [{ type: "Template", id: LIST }, "Project"],
      async onQueryStarted({ id }, { dispatch, queryFulfilled }) {
        try {
          const { data } = await queryFulfilled;
          dispatch(templatesApi.util.upsertQueryData("template", id, data));
        } catch {
          /* errors are shown by the caller */
        }
      },
    }),
    deleteTemplate: build.mutation<void, string>({
      query: (id) => ({ url: routes.templates.detail(id), method: "DELETE" }),
      invalidatesTags: (_res, _err, id) => [{ type: "Template", id }, { type: "Template", id: LIST }, "Project"],
    }),
    /** Copies a workflow's steps into a new one ("Copy of …"). */
    duplicateTemplate: build.mutation<TemplateDetail, WorkflowSummary>({
      async queryFn(w, _api, _extra, baseQuery) {
        const full = await baseQuery(routes.templates.detail(w.id));
        if (full.error) return { error: full.error as ApiErrorShape };
        const src = full.data as TemplateDetail;
        const created = await baseQuery({
          url: routes.projects.templates(w.project.id),
          method: "POST",
          body: {
            name: `Copy of ${w.name}`.slice(0, 200),
            description: w.description ?? undefined,
            steps: src.steps.map(({ stepOrder, agentId, agentStepKey, inputMapping }) => ({ stepOrder, agentId, agentStepKey, inputMapping })),
          },
        });
        return created.error ? { error: created.error as ApiErrorShape } : { data: created.data as TemplateDetail };
      },
      invalidatesTags: [{ type: "Template", id: LIST }, "Project"],
    }),
    runTemplate: build.mutation<TemplateRun, { templateId: string; inputs: Record<string, unknown> }>({
      query: ({ templateId, inputs }) => ({ url: routes.templates.run(templateId), method: "POST", body: inputs }),
      invalidatesTags: [{ type: "Run", id: LIST }, { type: "Template", id: LIST }, { type: "Stats", id: "overview" }],
    }),
    schedules: build.query<Schedule[], string>({
      query: (templateId) => routes.templates.schedules(templateId),
      providesTags: (_res, _err, templateId) => [{ type: "Schedule", id: templateId }],
    }),
    addSchedule: build.mutation<Schedule, { templateId: string; cronExpr: string; runInputs: Record<string, unknown> }>({
      query: ({ templateId, ...body }) => ({ url: routes.templates.schedule(templateId), method: "POST", body }),
      invalidatesTags: (_res, _err, { templateId }) => [{ type: "Schedule", id: templateId }, { type: "Template", id: LIST }],
    }),
    deleteSchedule: build.mutation<void, { scheduleId: string; templateId: string }>({
      query: ({ scheduleId }) => ({ url: routes.templates.deleteSchedule(scheduleId), method: "DELETE" }),
      invalidatesTags: (_res, _err, { templateId }) => [{ type: "Schedule", id: templateId }, { type: "Template", id: LIST }],
    }),
  }),
});

export const {
  useWorkflowLibraryQuery,
  useTemplateQuery,
  useCreateTemplateMutation,
  useUpdateTemplateMutation,
  useDeleteTemplateMutation,
  useDuplicateTemplateMutation,
  useRunTemplateMutation,
  useSchedulesQuery,
  useAddScheduleMutation,
  useDeleteScheduleMutation,
} = templatesApi;
