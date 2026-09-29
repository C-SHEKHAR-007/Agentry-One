/**
 * v2.2 migration shim: the shared hooks pages used to import from here, now
 * backed by RTK Query (one Redux cache). Pages move to importing from
 * features/* directly; this file is deleted when none use it.
 */
import { useArtifactDownloadUrlQuery, useArtifactPreviewUrlQuery, useArtifactsQuery } from "../features/artifacts/artifacts.api";
import { useProjectsQuery } from "../features/projects/projects.api";
import { useRecentAgentRuns } from "../features/runs/agentRuns.api";
import { useWorkflowRuns as useWorkflowRunsHook } from "../features/runs/runs.api";
import { useAgentStats as useAgentStatsHook, useRecentEvents, useStatsOverview as useStatsOverviewHook, useSystemHealth as useSystemHealthHook } from "../features/stats/stats.api";

export const useStatsOverview = useStatsOverviewHook;
export const useAgentStats = useAgentStatsHook;
export const useSystemHealth = useSystemHealthHook;
export const useEvents = (limit = 15) => useRecentEvents(limit);
export const useRecentWorkflows = (limit = 10, status?: string) => useRecentAgentRuns(limit, status);
export const useWorkflowRuns = useWorkflowRunsHook;
export const useProjects = () => useProjectsQuery();
export const useArtifacts = (params: { limit?: number; projectId?: string; kind?: string } = {}) =>
  useArtifactsQuery({ limit: params.limit ?? 50, projectId: params.projectId || undefined, kind: params.kind || undefined });
export const useSasPreviewUrl = (artifactId: string | undefined) => useArtifactPreviewUrlQuery(artifactId ?? "", { skip: !artifactId });
export const useSasDownloadUrl = (artifactId: string | undefined) => useArtifactDownloadUrlQuery(artifactId ?? "", { skip: !artifactId });
