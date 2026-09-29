/** Cache tags: what a response contains, so mutations and live signals can
 * refresh exactly the affected data. `LIST` is the id for collection
 * entries (e.g. { type: "Run", id: "LIST" }). */
export const TAGS = [
  "Me",
  "User",
  "Project",
  "Agent",
  "Capability",
  "Model",
  "Provider",
  "Workflow",
  "WorkflowLogs",
  "WorkflowEvents",
  "WorkflowArtifacts",
  "Template",
  "Schedule",
  "Run",
  "Artifact",
  "Prompt",
  "SocialAccount",
  "Event",
  "Stats",
  "Notification",
  "Setting",
] as const;

export type Tag = (typeof TAGS)[number];
export const LIST = "LIST" as const;

/** Tags for a list response: one per item plus the list itself. */
export function listTags<T extends { id: string }>(type: Tag, items: T[] | undefined) {
  return [...(items ?? []).map((i) => ({ type, id: i.id })), { type, id: LIST }];
}
