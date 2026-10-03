import { baseApi } from "../../services/api/baseApi";
import { FALLBACK_POLL_MS, poll } from "../../services/api/polling";
import { routes } from "../../services/api/routes";
import { LIST } from "../../services/api/tags";
import type { ArtifactItem, Page, RecentWorkflow, RunLogLine, Workflow, WorkflowEvent } from "../../models";

const PAGE_SIZE = 30;

export interface StartAgentRunBody {
  projectId: string;
  agentId: string;
  input: Record<string, unknown>;
  providerConfigId?: string;
}

/** Agent runs: single-agent executions (/workflows) -- also the steps of
 * workflow runs. */
export const agentRunsApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    recentAgentRuns: build.query<RecentWorkflow[], { limit?: number; status?: string }>({
      query: (p) => routes.workflows.recent(p),
      providesTags: (res) => [...(res ?? []).map((w) => ({ type: "Workflow" as const, id: w.id })), { type: "Workflow", id: LIST }],
    }),
    /** All agent runs, newest first, a page at a time (the Runs page). */
    agentRunsPage: build.infiniteQuery<Page<RecentWorkflow>, { status?: string }, string | null>({
      infiniteQueryOptions: { initialPageParam: null, getNextPageParam: (last) => last.nextCursor },
      query: ({ queryArg, pageParam }) => routes.workflows.recentPage({ status: queryArg.status, limit: PAGE_SIZE, cursor: pageParam }),
      providesTags: (res) => [...(res?.pages ?? []).flatMap((p) => p.items).map((w) => ({ type: "Workflow" as const, id: w.id })), { type: "Workflow", id: LIST }],
    }),
    agentRun: build.query<Workflow, string>({
      query: (id) => routes.workflows.detail(id),
      providesTags: (_res, _err, id) => [{ type: "Workflow", id }],
    }),
    agentRunEvents: build.query<WorkflowEvent[], string>({
      query: (id) => routes.workflows.events(id),
      providesTags: (_res, _err, id) => [{ type: "WorkflowEvents", id }],
    }),
    agentRunLogs: build.query<RunLogLine[], string>({
      query: (id) => routes.workflows.logs(id),
      providesTags: (_res, _err, id) => [{ type: "WorkflowLogs", id }],
    }),
    agentRunArtifacts: build.query<ArtifactItem[], string>({
      query: (id) => routes.workflows.artifacts(id),
      providesTags: (_res, _err, id) => [{ type: "WorkflowArtifacts", id }],
    }),
    startAgentRun: build.mutation<Workflow, StartAgentRunBody>({
      query: ({ projectId, ...body }) => ({ url: routes.projects.startWorkflow(projectId), method: "POST", body }),
      invalidatesTags: [{ type: "Workflow", id: LIST }, { type: "Stats", id: "overview" }, { type: "Event", id: LIST }],
    }),
    cancelAgentRun: build.mutation<void, string>({
      query: (id) => ({ url: routes.workflows.cancel(id), method: "POST" }),
      invalidatesTags: (_res, _err, id) => [{ type: "Workflow", id }, { type: "Workflow", id: LIST }, "Run"],
    }),
    advanceAgentRun: build.mutation<void, { workflowId: string; stepKey: string; notes?: string }>({
      query: ({ workflowId, stepKey, notes }) => ({ url: routes.workflows.advance(workflowId, stepKey), method: "POST", body: { notes } }),
      invalidatesTags: (_res, _err, { workflowId }) => [
        { type: "Workflow", id: workflowId },
        { type: "WorkflowEvents", id: workflowId },
        "Run",
      ],
    }),
    reapStaleRuns: build.mutation<{ reaped: number }, void>({
      query: () => ({ url: routes.workflows.reapStale, method: "POST" }),
      invalidatesTags: [{ type: "Workflow", id: LIST }, "Run"],
    }),
  }),
});

export const {
  useRecentAgentRunsQuery,
  useAgentRunsPageInfiniteQuery,
  useAgentRunQuery,
  useAgentRunEventsQuery,
  useAgentRunLogsQuery,
  useAgentRunArtifactsQuery,
  useStartAgentRunMutation,
  useCancelAgentRunMutation,
  useAdvanceAgentRunMutation,
  useReapStaleRunsMutation,
} = agentRunsApi;

/** Recent agent runs (dashboard, Runs page), fresh via the activity stream. */
export const useRecentAgentRuns = (limit = 10, status?: string) =>
  useRecentAgentRunsQuery({ limit, status }, poll(FALLBACK_POLL_MS));
