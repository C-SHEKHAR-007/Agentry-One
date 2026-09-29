import { baseApi } from "../../services/api/baseApi";
import { FALLBACK_POLL_MS, poll, useLiveInterval } from "../../services/api/polling";
import { routes } from "../../services/api/routes";
import { LIST } from "../../services/api/tags";
import { LIVE_STATUSES } from "../../lib/status";
import type { RunDetail, RunSummary } from "../../models";

/** Workflow (multi-step) runs: /template-runs. */
export const runsApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    workflowRuns: build.query<RunSummary[], { status?: string; limit?: number }>({
      query: (p) => routes.runs.list(p),
      providesTags: (res) => [...(res ?? []).map((r) => ({ type: "Run" as const, id: r.id })), { type: "Run", id: LIST }],
    }),
    workflowRun: build.query<RunDetail, string>({
      query: (id) => routes.runs.detail(id),
      providesTags: (_res, _err, id) => [{ type: "Run", id }],
    }),
    cancelWorkflowRun: build.mutation<void, string>({
      query: (id) => ({ url: routes.runs.cancel(id), method: "POST" }),
      invalidatesTags: (_res, _err, id) => [{ type: "Run", id }, { type: "Run", id: LIST }, "Workflow"],
    }),
  }),
});

export const { useWorkflowRunsQuery, useWorkflowRunQuery, useCancelWorkflowRunMutation } = runsApi;

/** Runs list ("active" for the dashboard, "all" or one status for Runs). */
export const useWorkflowRuns = (status: string = "active", limit = 6) =>
  useWorkflowRunsQuery({ status, limit }, poll(FALLBACK_POLL_MS));

/** One run, polled every 2s while it's live (for in-step progress, which
 * isn't pushed); step starts/finishes also arrive via the activity stream. */
export function useWorkflowRunLive(runId: string | undefined, ms = 2000) {
  const state = runsApi.endpoints.workflowRun.useQueryState(runId ?? "", { skip: !runId });
  const interval = useLiveInterval(state.data?.status, LIVE_STATUSES, ms);
  return useWorkflowRunQuery(runId ?? "", { skip: !runId, ...poll(interval) });
}
