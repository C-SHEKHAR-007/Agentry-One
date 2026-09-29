import { baseApi } from "../../services/api/baseApi";
import { FALLBACK_POLL_MS, poll } from "../../services/api/polling";
import { routes } from "../../services/api/routes";
import type { AgentStats, CostBreakdown, EventItem, StatsOverview, StatsSeries, SystemHealth } from "../../models";

export const statsApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    statsOverview: build.query<StatsOverview, void>({
      query: () => routes.stats.overview,
      providesTags: [{ type: "Stats", id: "overview" }],
    }),
    agentStats: build.query<{ agents: AgentStats[] }, void>({
      query: () => routes.stats.agents,
      providesTags: [{ type: "Stats", id: "agents" }],
    }),
    statsSeries: build.query<StatsSeries, number>({
      query: (days) => routes.stats.series(days),
      providesTags: [{ type: "Stats", id: "series" }],
    }),
    costs: build.query<CostBreakdown, number>({
      query: (days) => routes.stats.costs(days),
      providesTags: [{ type: "Stats", id: "costs" }],
    }),
    systemHealth: build.query<SystemHealth, void>({
      query: () => routes.stats.system,
      providesTags: [{ type: "Stats", id: "system" }],
    }),
    /** The recent activity feed (dashboard). */
    recentEvents: build.query<EventItem[], number>({
      query: (limit) => routes.events.recent(limit),
      providesTags: [{ type: "Event", id: "LIST" }],
    }),
  }),
});

export const {
  useStatsOverviewQuery,
  useAgentStatsQuery,
  useStatsSeriesQuery,
  useCostsQuery,
  useSystemHealthQuery,
  useRecentEventsQuery,
} = statsApi;

/** Dashboard numbers; kept fresh by the activity stream. */
export const useStatsOverview = () => useStatsOverviewQuery(undefined, poll(FALLBACK_POLL_MS));
export const useAgentStats = () => useAgentStatsQuery(undefined, poll(FALLBACK_POLL_MS));
export const useRecentEvents = (limit = 15) => useRecentEventsQuery(limit, poll(FALLBACK_POLL_MS));
/** Worker liveness isn't an event, so health is checked once a minute. */
export function useSystemHealth() {
  const result = useSystemHealthQuery(undefined, poll(60_000));
  return { ...result, dataUpdatedAt: result.fulfilledTimeStamp ?? 0 };
}
