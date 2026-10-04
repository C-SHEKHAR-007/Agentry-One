import { baseApi } from "../../services/api/baseApi";
import { routes } from "../../services/api/routes";
import type { ArtifactListItem, Page, SignedUrl } from "../../models";

// Signed URLs last 2h; cache them for 90 minutes so they're refreshed first.
const SAS_CACHE_S = 90 * 60;

export const artifactsApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    artifacts: build.query<ArtifactListItem[], { limit?: number; projectId?: string; kind?: string }>({
      query: (p) => routes.artifacts.list(p),
      providesTags: (res) => [...(res ?? []).map((a) => ({ type: "Artifact" as const, id: a.id })), { type: "Artifact", id: "LIST" }],
    }),
    /** Artifacts, newest first, a page at a time (the Artifacts page). */
    /** Every kind the caller has artifacts of (for the filter). */
    artifactKinds: build.query<string[], string | void>({
      query: (projectId) => routes.artifacts.kinds(projectId || undefined),
      providesTags: [{ type: "Artifact", id: "LIST" }],
    }),
    artifactsPage: build.infiniteQuery<Page<ArtifactListItem>, { projectId?: string; kind?: string; q?: string }, string | null>({
      infiniteQueryOptions: { initialPageParam: null, getNextPageParam: (last) => last.nextCursor },
      query: ({ queryArg, pageParam }) => routes.artifacts.listPage({ ...queryArg, limit: 48, cursor: pageParam }),
      providesTags: (res) => [...(res?.pages ?? []).flatMap((p) => p.items).map((a) => ({ type: "Artifact" as const, id: a.id })), { type: "Artifact", id: "LIST" }],
    }),
    artifactPreviewUrl: build.query<SignedUrl, string>({
      query: (id) => routes.artifacts.sasPreview(id),
      keepUnusedDataFor: SAS_CACHE_S,
    }),
    artifactDownloadUrl: build.query<SignedUrl, string>({
      query: (id) => routes.artifacts.sasDownload(id),
      keepUnusedDataFor: SAS_CACHE_S,
    }),
    /** A text artifact's contents (captions, research briefs, JSON). */
    artifactText: build.query<string, string>({
      query: (id) => ({ url: routes.artifacts.download(id), responseType: "text" }),
      keepUnusedDataFor: 300,
    }),
  }),
});

export const { useArtifactsQuery, useArtifactsPageInfiniteQuery, useArtifactKindsQuery, useArtifactPreviewUrlQuery, useArtifactDownloadUrlQuery, useArtifactTextQuery } = artifactsApi;
