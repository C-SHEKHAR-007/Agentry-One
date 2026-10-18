import type { RunDetail, StepVersion } from "../models";

type RunStep = RunDetail["steps"][number];

/** A step's finished outputs across its run family, labelled v1, v2, … oldest first. */
export function versionsOf(run: Pick<RunDetail, "versions">, step: RunStep | undefined): Array<StepVersion & { label: string }> {
  if (!step) return [];
  return (run.versions?.[step.templateStep.id] ?? []).map((v, i) => ({ ...v, label: `v${i + 1}` }));
}

/** The step as it shows when the person picked another version: same step,
 * that version's workflow. Unchanged when nothing (or an unknown version) is picked. */
export function withVersion(step: RunStep | undefined, run: Pick<RunDetail, "versions">, workflowId: string | undefined): RunStep | undefined {
  if (!step || !workflowId || workflowId === step.workflowId) return step;
  const known = versionsOf(run, step).some((v) => v.workflowId === workflowId);
  return known ? { ...step, workflowId, status: "completed" } : step;
}
