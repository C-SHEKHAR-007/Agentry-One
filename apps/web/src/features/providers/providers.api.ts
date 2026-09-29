import { baseApi } from "../../services/api/baseApi";
import { routes } from "../../services/api/routes";
import { LIST } from "../../services/api/tags";
import type { CreateModelBody, CreateProviderBody, DiscoveredModel, ProviderConfig, UpdateProviderBody } from "../../models";

// Any provider change can change which models exist and which are defaults.
const PROVIDERS_AND_MODELS = [
  { type: "Provider" as const, id: LIST },
  { type: "Model" as const, id: LIST },
];

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
    createProvider: build.mutation<ProviderConfig, CreateProviderBody>({
      query: (body) => ({ url: routes.providers.create, method: "POST", body }),
      invalidatesTags: PROVIDERS_AND_MODELS,
    }),
    updateProvider: build.mutation<ProviderConfig, { id: string; body: UpdateProviderBody }>({
      query: ({ id, body }) => ({ url: routes.providers.detail(id), method: "PUT", body }),
      invalidatesTags: PROVIDERS_AND_MODELS,
    }),
    deleteProvider: build.mutation<void, string>({
      query: (id) => ({ url: routes.providers.detail(id), method: "DELETE" }),
      invalidatesTags: PROVIDERS_AND_MODELS,
    }),
    /** Asks the provider's endpoint which models it serves. */
    discoverModels: build.mutation<{ success: boolean; count: number }, string>({
      query: (id) => ({ url: routes.providers.discover(id), method: "POST" }),
      invalidatesTags: PROVIDERS_AND_MODELS,
    }),
    /** Makes this the default provider for its capability. */
    setDefaultProvider: build.mutation<void, string>({
      query: (id) => ({ url: routes.providers.setDefault(id), method: "POST" }),
      invalidatesTags: [{ type: "Provider", id: LIST }],
    }),
    setDefaultModel: build.mutation<void, { providerId: string; modelId: string }>({
      query: ({ providerId, modelId }) => ({ url: routes.providers.setDefaultModel(providerId), method: "POST", body: { modelId } }),
      invalidatesTags: PROVIDERS_AND_MODELS,
    }),
    createModel: build.mutation<DiscoveredModel, CreateModelBody>({
      query: (body) => ({ url: routes.models.create, method: "POST", body }),
      invalidatesTags: PROVIDERS_AND_MODELS,
    }),
    deleteModel: build.mutation<void, string>({
      query: (id) => ({ url: routes.models.detail(id), method: "DELETE" }),
      invalidatesTags: PROVIDERS_AND_MODELS,
    }),
  }),
});

export const {
  useProvidersQuery,
  useAllModelsQuery,
  useCreateProviderMutation,
  useUpdateProviderMutation,
  useDeleteProviderMutation,
  useDiscoverModelsMutation,
  useSetDefaultProviderMutation,
  useSetDefaultModelMutation,
  useCreateModelMutation,
  useDeleteModelMutation,
} = providersApi;
