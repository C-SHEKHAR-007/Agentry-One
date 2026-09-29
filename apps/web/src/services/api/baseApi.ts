import { createApi } from "@reduxjs/toolkit/query/react";
import { axiosBaseQuery } from "./axiosBaseQuery";
import { TAGS } from "./tags";

/**
 * The single RTK Query API. Features add their endpoints with
 * `baseApi.injectEndpoints` (features/<area>/<area>.api.ts), so each area
 * owns its API file while all of them share one cache in the Redux store.
 */
export const baseApi = createApi({
  reducerPath: "api",
  baseQuery: axiosBaseQuery(),
  tagTypes: TAGS,
  // Keep data briefly after the last subscriber leaves (navigating back is
  // instant); freshness comes from tags + the live activity stream.
  keepUnusedDataFor: 60,
  refetchOnMountOrArgChange: 30,
  refetchOnReconnect: true,
  refetchOnFocus: true, // as before (TanStack Query did this by default)
  endpoints: () => ({}),
});
