import { baseApi } from "../../services/api/baseApi";
import { routes } from "../../services/api/routes";
import { LIST } from "../../services/api/tags";
import type { Prompt } from "../../models";

/** The prompt library: versioned prompt templates per agent. */
export const promptsApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    prompts: build.query<Prompt[], string | void>({
      query: (agentId) => routes.prompts.list({ agentId: agentId || undefined }),
      providesTags: (res) => [...(res ?? []).map((p) => ({ type: "Prompt" as const, id: p.id })), { type: "Prompt", id: LIST }],
    }),
    /** Saves a prompt; an existing key gets a new version. */
    createPrompt: build.mutation<Prompt, { agentId: string; key: string; template: string }>({
      query: (body) => ({ url: routes.prompts.create, method: "POST", body }),
      invalidatesTags: [{ type: "Prompt", id: LIST }],
    }),
    deletePrompt: build.mutation<void, string>({
      query: (id) => ({ url: routes.prompts.detail(id), method: "DELETE" }),
      invalidatesTags: (_res, _err, id) => [{ type: "Prompt", id }, { type: "Prompt", id: LIST }],
    }),
  }),
});

export const { usePromptsQuery, useCreatePromptMutation, useDeletePromptMutation } = promptsApi;
