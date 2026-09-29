/** What a Content Studio brief will actually run. Mirrors the server's
 * buildBriefSteps (apps/api/src/modules/contentBriefs/quickStart.ts): some
 * outputs need others (a video needs a caption, a visual and a voiceover), and
 * publishing only happens with a connected account. */

export type Role = "search" | "text" | "image" | "voice" | "video" | "publish";

export const ROLE_ORDER: Role[] = ["search", "text", "image", "voice", "video", "publish"];

export const AGENT_TO_ROLE: Record<string, Role> = {
  "web-search-agent": "search",
  "content-brief-writer": "text",
  "sketch-agent": "image",
  "voice-agent": "voice",
  "video-agent": "video",
  "social-publisher": "publish",
};

/** Which roles each role needs to run first. */
const NEEDS: Partial<Record<Role, Role[]>> = {
  voice: ["text"],
  video: ["text", "image", "voice"],
  publish: ["text", "image"],
};

export interface PlannedStep {
  role: Role;
  /** Why it runs: picked by the user, or pulled in by another output. */
  reason: { kind: "selected" } | { kind: "required"; by: Role[] };
}

export interface StudioPlan {
  steps: PlannedStep[];
  /** Roles the user picked that won't run, with why. */
  dropped: Array<{ role: Role; why: string }>;
}

export function planBrief(selected: Role[], hasPublishAccount: boolean): StudioPlan {
  const picked = new Set(selected);
  const dropped: StudioPlan["dropped"] = [];
  if (picked.has("publish") && !hasPublishAccount) {
    picked.delete("publish");
    dropped.push({ role: "publish", why: "Choose a connected account to publish automatically." });
  }
  const requiredBy = new Map<Role, Set<Role>>();
  for (const role of picked) {
    for (const need of NEEDS[role] ?? []) {
      if (!requiredBy.has(need)) requiredBy.set(need, new Set());
      requiredBy.get(need)!.add(role);
    }
  }
  const steps: PlannedStep[] = [];
  for (const role of ROLE_ORDER) {
    if (picked.has(role)) steps.push({ role, reason: { kind: "selected" } });
    else if (requiredBy.has(role)) steps.push({ role, reason: { kind: "required", by: [...requiredBy.get(role)!] } });
  }
  return { steps, dropped };
}

/** "Brief: AI agents for small businesses — 2026-09-28" -> the topic part. */
export function briefTopic(templateName: string): string {
  return templateName.replace(/^Brief:\s*/, "").replace(/\s+—\s+\d{4}-\d{2}-\d{2}$/, "");
}
