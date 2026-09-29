import { baseApi } from "../../services/api/baseApi";
import { routes } from "../../services/api/routes";
import { listTags } from "../../services/api/tags";
import type { Project } from "../../models";

export const projectsApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    projects: build.query<Project[], void>({
      query: () => routes.projects.list,
      providesTags: (res) => listTags("Project", res),
    }),
  }),
});

export const { useProjectsQuery } = projectsApi;
