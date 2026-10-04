import { baseApi } from "../../services/api/baseApi";
import { routes } from "../../services/api/routes";
import { listTags } from "../../services/api/tags";
import { LIST } from "../../services/api/tags";
import type { Project, Template } from "../../models";

export const projectsApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    projects: build.query<Project[], void>({
      query: () => routes.projects.list,
      providesTags: (res) => listTags("Project", res),
    }),
    project: build.query<Project, string>({
      query: (id) => routes.projects.detail(id),
      providesTags: (_res, _err, id) => [{ type: "Project", id }],
    }),
    projectTemplates: build.query<Template[], string>({
      query: (id) => routes.projects.templates(id),
      providesTags: [{ type: "Template", id: LIST }],
    }),
    createProject: build.mutation<Project, { name: string }>({
      query: (body) => ({ url: routes.projects.create, method: "POST", body }),
      invalidatesTags: [{ type: "Project", id: LIST }],
    }),
    deleteProject: build.mutation<void, string>({
      query: (id) => ({ url: routes.projects.detail(id), method: "DELETE" }),
      // Its workflows, runs and artifacts go with it.
      invalidatesTags: (_res, _err, id) => [{ type: "Project", id }, { type: "Project", id: LIST }, "Template", "Run", "Workflow", "Artifact", "Stats"],
    }),
  }),
});

export const { useProjectsQuery, useProjectQuery, useProjectTemplatesQuery, useCreateProjectMutation, useDeleteProjectMutation } = projectsApi;
