import { baseApi } from "../../services/api/baseApi";
import { routes } from "../../services/api/routes";
import type { Setting } from "../../models";

export interface PutSettingBody {
  scope: "global" | "project" | "agent";
  key: string;
  value: unknown;
  projectId?: string;
  agentId?: string;
}

export const settingsApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    settings: build.query<Setting[], void>({
      query: () => routes.settings.list,
      providesTags: [{ type: "Setting", id: "LIST" }],
    }),
    version: build.query<{ name: string; version: string }, void>({
      query: () => routes.system.version,
      keepUnusedDataFor: 3600,
    }),
    putSetting: build.mutation<Setting, PutSettingBody>({
      query: (body) => ({ url: routes.settings.put, method: "PUT", body }),
      // Pricing feeds cost figures everywhere.
      invalidatesTags: [{ type: "Setting", id: "LIST" }, "Stats"],
    }),
  }),
});

export const { useSettingsQuery, useVersionQuery, usePutSettingMutation } = settingsApi;
