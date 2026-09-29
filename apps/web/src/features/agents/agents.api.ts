import { baseApi } from "../../services/api/baseApi";
import { routes } from "../../services/api/routes";
import { listTags } from "../../services/api/tags";
import { useEffect, useMemo } from "react";
import { shallowEqual } from "react-redux";
import { useAppDispatch, useAppSelector } from "../../app/hooks";
import type { Agent, AgentManifestDetail, Capability, CustomAgentBody, ScaffoldBody, ScaffoldResult } from "../../models";
import { LIST } from "../../services/api/tags";

export const agentsApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    agents: build.query<Agent[], void>({
      query: () => routes.agents.list,
      providesTags: (res) => listTags("Agent", res),
    }),
    agent: build.query<AgentManifestDetail, string>({
      query: (id) => routes.agents.detail(id),
      providesTags: (_res, _err, id) => [{ type: "Agent", id }],
    }),
    capabilities: build.query<Capability[], void>({
      query: () => routes.agents.capabilities,
      providesTags: [{ type: "Capability", id: LIST }],
      keepUnusedDataFor: 600,
    }),
    /** Re-reads every agent manifest on the server. */
    rescanAgents: build.mutation<{ agents: { id: string }[] }, void>({
      query: () => ({ url: routes.agents.rescan, method: "POST" }),
      invalidatesTags: ["Agent", { type: "Stats", id: "system" }],
    }),
    scaffoldAgent: build.mutation<ScaffoldResult, ScaffoldBody>({
      query: (body) => ({ url: routes.agents.scaffold, method: "POST", body }),
      invalidatesTags: [{ type: "Agent", id: LIST }],
    }),
    createCustomAgent: build.mutation<Agent, CustomAgentBody>({
      query: (body) => ({ url: routes.agents.custom, method: "POST", body }),
      invalidatesTags: [{ type: "Agent", id: LIST }],
    }),
    deleteAgent: build.mutation<void, string>({
      query: (id) => ({ url: routes.agents.detail(id), method: "DELETE" }),
      invalidatesTags: (_res, _err, id) => [{ type: "Agent", id }, { type: "Agent", id: LIST }],
    }),
  }),
});

export const {
  useAgentsQuery,
  useAgentQuery,
  useCapabilitiesQuery,
  useRescanAgentsMutation,
  useScaffoldAgentMutation,
  useCreateCustomAgentMutation,
  useDeleteAgentMutation,
} = agentsApi;

/** Manifests for several agents at once (one cache entry each), e.g. every
 * agent a workflow's steps use. */
export function useAgentManifests(ids: string[]): Map<string, AgentManifestDetail> {
  const dispatch = useAppDispatch();
  const key = [...new Set(ids)].sort().join(",");
  useEffect(() => {
    if (!key) return;
    const subs = key.split(",").map((id) => dispatch(agentsApi.endpoints.agent.initiate(id)));
    return () => subs.forEach((s) => s.unsubscribe());
  }, [key, dispatch]);
  const list = useMemo(() => (key ? key.split(",") : []), [key]);
  // shallowEqual: only re-render when one of these manifests changes.
  const manifests = useAppSelector((st) => list.map((id) => agentsApi.endpoints.agent.select(id)(st).data), shallowEqual);
  return useMemo(() => {
    const map = new Map<string, AgentManifestDetail>();
    list.forEach((id, i) => manifests[i] && map.set(id, manifests[i]!));
    return map;
  }, [list, manifests]);
}
