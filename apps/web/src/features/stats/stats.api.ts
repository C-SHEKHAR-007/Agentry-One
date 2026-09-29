import { baseApi } from "../../services/api/baseApi";
import { routes } from "../../services/api/routes";
import type { SystemHealth } from "../../models";

export const statsApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    systemHealth: build.query<SystemHealth, void>({
      query: () => routes.stats.system,
      providesTags: [{ type: "Stats", id: "system" }],
    }),
  }),
});

export const { useSystemHealthQuery } = statsApi;
