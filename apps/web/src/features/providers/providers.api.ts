import { baseApi } from "../../services/api/baseApi";
import { routes } from "../../services/api/routes";
import { LIST } from "../../services/api/tags";
import type { DiscoveredModel, ProviderConfig } from "../../models";

/** AI providers (BYOK configs) and the models discovered on them. */
export const providersApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    providers: build.query<ProviderConfig[], string | void>({
      query: (capability) => routes.providers.list(capability || undefined),
      providesTags: (res) => [...(res ?? []).map((p) => ({ type: "Provider" as const, id: p.id })), { type: "Provider", id: LIST }],
    }),
    allModels: build.query<DiscoveredModel[], void>({
      query: () => routes.models.list,
      providesTags: [{ type: "Model", id: LIST }],
    }),
  }),
});

export const { useProvidersQuery, useAllModelsQuery } = providersApi;
