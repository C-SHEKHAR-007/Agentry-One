import type { TemplateStep } from "../models/templates";

/** A run-time input, shown once, under the first step that uses it. */
export interface RunInputField {
  /** The name the run inputs are sent under. */
  field: string;
  /** The agent input it fills in that step (its schema gives type and title). */
  agentField: string;
  /** Other steps that read the same run input. */
  alsoUsedBy: number[];
}

export interface RunInputGroup {
  stepOrder: number;
  agentId: string;
  agentStepKey: string;
  fields: RunInputField[];
}

/** The workflow's run inputs grouped by the step that uses them, in step order. */
export function groupRunInputs(steps: TemplateStep[]): RunInputGroup[] {
  const ordered = [...steps].sort((a, b) => a.stepOrder - b.stepOrder);
  const firstUse = new Map<string, RunInputField>();
  const groups: RunInputGroup[] = [];
  for (const step of ordered) {
    const fields: RunInputField[] = [];
    for (const [agentField, mapping] of Object.entries(step.inputMapping)) {
      if (mapping.kind !== "fromRunInput") continue;
      const seen = firstUse.get(mapping.field);
      if (seen) {
        if (!seen.alsoUsedBy.includes(step.stepOrder)) seen.alsoUsedBy.push(step.stepOrder);
        continue;
      }
      const f: RunInputField = { field: mapping.field, agentField, alsoUsedBy: [] };
      firstUse.set(mapping.field, f);
      fields.push(f);
    }
    if (fields.length) groups.push({ stepOrder: step.stepOrder, agentId: step.agentId, agentStepKey: step.agentStepKey, fields });
  }
  return groups;
}

/** A run input's value from what was typed, using the agent field's type, so
 * "4" reaches an integer field as 4 and an empty box sends nothing. */
export function coerceRunInput(raw: string, type: string | undefined): unknown {
  if (raw.trim() === "") return undefined;
  if (type === "integer") {
    const n = Number.parseInt(raw, 10);
    return Number.isFinite(n) ? n : raw;
  }
  if (type === "number") {
    const n = Number(raw);
    return Number.isFinite(n) ? n : raw;
  }
  if (type === "boolean") return raw === "true";
  return raw;
}
