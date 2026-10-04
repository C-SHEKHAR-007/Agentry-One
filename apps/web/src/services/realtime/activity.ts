import { baseApi } from "../api/baseApi";
import { routes } from "../api/routes";
import type { AppDispatch } from "../../app/store";
import type { Tag } from "../api/tags";
import { openStream } from "./stream";

/** What a run-activity signal can change. Invalidating a tag only refetches
 * data a mounted page is using, so an idle page makes no requests. */
const ACTIVITY_TAGS: Array<Tag | { type: Tag; id: string }> = [
  "Run",
  "Workflow",
  "WorkflowLogs",
  "WorkflowEvents",
  "WorkflowArtifacts",
  "Event",
  { type: "Template", id: "LIST" },
  { type: "Stats", id: "overview" },
];
/** Settled work changes per-agent totals too. */
const SETTLED = /completed|failed|cancelled/;

/**
 * Opens the app-wide activity stream (GET /events/stream): the API pushes a
 * signal whenever a run starts, finishes, fails or waits for review, and the
 * affected cache entries are refreshed. Bursts (a workflow finishing several
 * steps at once) coalesce into one refresh after `coalesceMs`.
 */
export function startActivityStream(
  dispatch: AppDispatch,
  { coalesceMs = 750 }: { coalesceMs?: number } = {},
): () => void {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let settled = false;
  const flush = () => {
    timer = null;
    dispatch(baseApi.util.invalidateTags(settled ? [...ACTIVITY_TAGS, { type: "Stats", id: "agents" }] : ACTIVITY_TAGS));
    settled = false;
  };
  const close = openStream<{ type?: string }>(routes.streams.activity, ({ type }) => {
    if (type && SETTLED.test(type)) settled = true;
    if (!timer) timer = setTimeout(flush, coalesceMs);
  });
  return () => {
    close();
    if (timer) clearTimeout(timer);
  };
}
