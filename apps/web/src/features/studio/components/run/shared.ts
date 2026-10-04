import type { ArtifactItem, RunDetail } from "../../../../models";
import { useArtifactTextQuery } from "../../../artifacts/artifacts.api";
import { useAgentRunArtifactsQuery } from "../../../runs/agentRuns.api";
import { routes } from "../../../../services/api/routes";

export type RunStep = RunDetail["steps"][number];

export type Artifact = ArtifactItem;

/** A step's outputs, once it has completed. */
export function useStepArtifacts(step: RunStep | undefined) {
  return useAgentRunArtifactsQuery(step?.workflowId ?? "", { skip: !step?.workflowId || step.status !== "completed" });
}

/** A text output's contents. */
export function useArtifactText(artifactId: string | undefined) {
  return useArtifactTextQuery(artifactId ?? "", { skip: !artifactId });
}

/** Azure artifacts carry short-lived https SAS URLs; everything else is
 * served by the API itself (through the app's /api proxy, with the session). */
export function mediaUrls(a: Artifact | undefined) {
  if (!a) return { src: undefined, file: undefined };
  return {
    src: a.previewUrl?.startsWith("https://") ? a.previewUrl : routes.files.download(a.id),
    file: a.downloadUrl?.startsWith("https://") ? a.downloadUrl : routes.files.attachment(a.id),
  };
}

export type StepState = "done" | "running" | "review" | "failed" | "waiting" | "skipped";

export function stateOf(step: RunStep | undefined, runLive: boolean): StepState {
  const s = step?.status ?? "pending";
  if (s === "completed") return "done";
  if (s === "failed") return "failed";
  if (s === "awaiting_review") return "review";
  if (!runLive) return "skipped";
  return step?.workflowId ? "running" : "waiting";
}
