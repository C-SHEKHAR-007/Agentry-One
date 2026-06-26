import type { InputMapping, TemplateStepInput, UpstreamStepInfo } from "./types.js";

/** Pure validation -- no DB, no I/O -- so it can run identically at build-time
 * (live, in the UI editor), save-time (the hard gate), and in unit tests.
 * Returns a list of human-readable errors; empty means valid. */
export function validateStepInputMapping(
  stepOrder: number,
  mapping: InputMapping,
  upstreamSteps: UpstreamStepInfo[],
): string[] {
  const errors: string[] = [];

  for (const [field, value] of Object.entries(mapping)) {
    if (value.kind !== "fromStep") continue;

    if (value.stepOrder >= stepOrder) {
      errors.push(
        `field '${field}': fromStep references step ${value.stepOrder}, which is not earlier than this step (${stepOrder}) -- references must be forward-only`,
      );
      continue;
    }

    const upstream = upstreamSteps.find((s) => s.stepOrder === value.stepOrder);
    if (!upstream) {
      errors.push(`field '${field}': fromStep references step ${value.stepOrder}, which does not exist in this template`);
      continue;
    }

    if (!upstream.producesArtifactKinds.includes(value.artifactKind)) {
      errors.push(
        `field '${field}': step ${value.stepOrder} does not produce an artifact of kind '${value.artifactKind}' (produces: ${upstream.producesArtifactKinds.join(", ") || "none"})`,
      );
    }
  }

  return errors;
}

/** Validates every step in a template, in order, against the steps that
 * precede it -- the save-time hard gate described in the plan. */
export function validateTemplateSteps(
  steps: Array<TemplateStepInput & { producesArtifactKinds: string[] }>,
): string[] {
  const errors: string[] = [];
  const sorted = [...steps].sort((a, b) => a.stepOrder - b.stepOrder);

  for (const step of sorted) {
    const upstream = sorted
      .filter((s) => s.stepOrder < step.stepOrder)
      .map((s) => ({ stepOrder: s.stepOrder, producesArtifactKinds: s.producesArtifactKinds }));
    const stepErrors = validateStepInputMapping(step.stepOrder, step.inputMapping, upstream);
    errors.push(...stepErrors.map((e) => `step ${step.stepOrder}: ${e}`));
  }

  return errors;
}
