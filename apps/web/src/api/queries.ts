import { useQuery } from "@tanstack/react-query";
import { api } from "./client";
import type {
  AgentStats,
  ArtifactListItem,
  EventItem,
  Project,
  RecentWorkflow,
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

export function useEvents(limit = 15) {
  return useQuery<EventItem[]>({
    queryKey: ["events", limit],
    queryFn: () => api.get(`/events?limit=${limit}`),
    refetchInterval: 15_000,
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
