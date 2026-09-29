/**
 * v2.2 migration bridge. Pages not yet moved to RTK Query still refresh data
 * after a change with `queryClient.invalidateQueries({ queryKey: [...] })`.
 * Some of the data they show already lives in the RTK Query cache, so each
 * invalidation is forwarded to the matching cache tags as well. Deleted
 * together with TanStack Query at the end of the migration.
 */
import { QueryClient, type InvalidateQueryFilters, type QueryKey } from "@tanstack/react-query";
import { baseApi } from "../services/api/baseApi";
import type { Tag } from "../services/api/tags";
import type { AppDispatch } from "../app/store";

const TAG_FOR_KEY: Record<string, Tag[]> = {
  projects: ["Project"],
  project: ["Project"],
  agents: ["Agent"],
  agent: ["Agent"],
  capabilities: ["Capability"],
  "all-models": ["Model"],
  providers: ["Provider"],
  templates: ["Template"],
  template: ["Template"],
  schedules: ["Schedule"],
  "template-runs": ["Run"],
  "template-run": ["Run"],
  workflows: ["Workflow"],
  workflow: ["Workflow"],
  "workflow-detail": ["Workflow"],
  "workflow-events": ["WorkflowEvents"],
  "workflow-logs": ["WorkflowLogs"],
  "workflow-artifacts": ["WorkflowArtifacts"],
  artifacts: ["Artifact"],
  stats: ["Stats"],
  events: ["Event"],
  prompts: ["Prompt"],
  users: ["User"],
  settings: ["Setting"],
  socialAccounts: ["SocialAccount"],
  notifications: ["Notification"],
};

export class BridgedQueryClient extends QueryClient {
  private dispatch: AppDispatch | null = null;

  bindStore(dispatch: AppDispatch) {
    this.dispatch = dispatch;
  }

  override invalidateQueries(filters?: InvalidateQueryFilters, options?: Parameters<QueryClient["invalidateQueries"]>[1]) {
    const key = (filters?.queryKey ?? []) as QueryKey;
    const tags = typeof key[0] === "string" ? TAG_FOR_KEY[key[0]] : undefined;
    if (this.dispatch && tags) this.dispatch(baseApi.util.invalidateTags(tags));
    return super.invalidateQueries(filters, options);
  }
}
