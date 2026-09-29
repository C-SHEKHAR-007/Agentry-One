import { useQuery } from "@tanstack/react-query";
import { api } from "./client";
import type {
  AgentStats,
  ArtifactListItem,
  EventItem,
  Project,
  RecentWorkflow,
  RunSummary,
  StatsOverview,
  SystemHealth,
} from "./types";

export function useStatsOverview(refetchInterval = 15_000) {
  return useQuery<StatsOverview>({
    queryKey: ["stats", "overview"],
    queryFn: () => api.get("/stats/overview"),
    refetchInterval,
  });
}

export function useAgentStats() {
  return useQuery<{ agents: AgentStats[] }>({
    queryKey: ["stats", "agents"],
    queryFn: () => api.get("/stats/agents"),
    refetchInterval: 30_000,
  });
}

export function useSystemHealth() {
  return useQuery<SystemHealth>({
    queryKey: ["stats", "system"],
    queryFn: () => api.get("/stats/system"),
    refetchInterval: 30_000,
  });
}

export function useEvents(limit = 15, refetchInterval = 15_000) {
  return useQuery<EventItem[]>({
    queryKey: ["events", limit],
    queryFn: () => api.get(`/events?limit=${limit}`),
    refetchInterval,
  });
}

export function useRecentWorkflows(limit = 10, status?: string) {
  return useQuery<RecentWorkflow[]>({
    queryKey: ["workflows", "recent", limit, status ?? "all"],
    queryFn: () =>
      api.get(`/workflows/recent?limit=${limit}${status ? `&status=${status}` : ""}`),
    refetchInterval: 15_000,
  });
}

export function useArtifacts(params?: { limit?: number; projectId?: string; kind?: string }) {
  const search = new URLSearchParams();
  if (params?.limit) search.set("limit", String(params.limit));
  if (params?.projectId) search.set("projectId", params.projectId);
  if (params?.kind) search.set("kind", params.kind);
  const qs = search.toString();
  return useQuery<ArtifactListItem[]>({
    queryKey: ["artifacts", params?.limit ?? 50, params?.projectId ?? "", params?.kind ?? ""],
    queryFn: () => api.get(`/artifacts${qs ? `?${qs}` : ""}`),
  });
}

export function useProjects() {
  return useQuery<Project[]>({
    queryKey: ["projects"],
    queryFn: () => api.get("/projects"),
  });
}

/** Fetches a 2-hour read-only SAS URL for an artifact from the backend.
 * Cached for 90 min so the URL stays valid; re-fetches well before expiry. */
export function useSasPreviewUrl(artifactId: string | undefined) {
  return useQuery<{ url: string; expiresAt: string }>({
    queryKey: ["artifact-sas-preview", artifactId],
    queryFn: () => api.get(`/artifacts/${artifactId}/sas/preview`),
    enabled: Boolean(artifactId),
    staleTime: 90 * 60 * 1000,   // 90 min — re-fetch before the 2h SAS expires
    gcTime: 95 * 60 * 1000,
  });
}

/** Fetches a 2-hour read-only download SAS URL for an artifact. */
export function useSasDownloadUrl(artifactId: string | undefined) {
  return useQuery<{ url: string; expiresAt: string }>({
    queryKey: ["artifact-sas-download", artifactId],
    queryFn: () => api.get(`/artifacts/${artifactId}/sas/download`),
    enabled: Boolean(artifactId),
    staleTime: 90 * 60 * 1000,
    gcTime: 95 * 60 * 1000,
  });
}

/** Workflow (multi-step) runs: "active" for the dashboard, or "all". */
export function useWorkflowRuns(status: "active" | "all" | string = "active", limit = 6) {
  return useQuery<RunSummary[]>({
    queryKey: ["template-runs", status, limit],
    queryFn: () => api.get(`/template-runs?status=${encodeURIComponent(status)}&limit=${limit}`),
    refetchInterval: status === "active" ? 4_000 : 15_000,
  });
}
