import { baseApi } from "../../services/api/baseApi";
import { routes } from "../../services/api/routes";
import { listTags, LIST } from "../../services/api/tags";
import type { Role, User } from "../../models";

export interface CreateUserBody {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  role: Role;
}

/** Workspace members (owners only). */
export const usersApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    users: build.query<User[], void>({
      query: () => routes.users.list,
      providesTags: (res) => listTags("User", res),
    }),
    createUser: build.mutation<User, CreateUserBody>({
      query: (body) => ({ url: routes.users.create, method: "POST", body }),
      invalidatesTags: [{ type: "User", id: LIST }],
    }),
    updateUserRole: build.mutation<User, { id: string; role: Role }>({
      query: ({ id, role }) => ({ url: routes.users.detail(id), method: "PATCH", body: { role } }),
      invalidatesTags: (_res, _err, { id }) => [{ type: "User", id }, { type: "User", id: LIST }],
    }),
    deleteUser: build.mutation<void, string>({
      query: (id) => ({ url: routes.users.detail(id), method: "DELETE" }),
      invalidatesTags: (_res, _err, id) => [{ type: "User", id }, { type: "User", id: LIST }],
    }),
  }),
});

export const { useUsersQuery, useCreateUserMutation, useUpdateUserRoleMutation, useDeleteUserMutation } = usersApi;
