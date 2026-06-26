// Client mirror of apps/api/src/modules/templates/validation.ts -- KEEP IN
// SYNC. Pure so the canvas/form editors can validate live; the server runs
// the identical checks again as the save-time hard gate.

import type { InputMappingValue } from "../api/types";

export interface UpstreamStepInfo {
  stepOrder: number;
  producesArtifactKinds: string[];
}

export function validateStepInputMapping(
  stepOrder: number,
  mapping: Record<string, InputMappingValue>,
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
      errors.push(
        `field '${field}': fromStep references step ${value.stepOrder}, which does not exist in this template`,
      );
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

export function validateTemplateSteps(
  steps: Array<{
    stepOrder: number;
    inputMapping: Record<string, InputMappingValue>;
    producesArtifactKinds: string[];
  }>,
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
