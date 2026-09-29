import { baseApi } from "../../services/api/baseApi";
import { routes } from "../../services/api/routes";
import { listTags } from "../../services/api/tags";
import type { Agent } from "../../models";

export const agentsApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    agents: build.query<Agent[], void>({
      query: () => routes.agents.list,
      providesTags: (res) => listTags("Agent", res),
    }),
  }),
});

export const { useAgentsQuery } = agentsApi;
