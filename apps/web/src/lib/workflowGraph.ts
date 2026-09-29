/** Pure helpers for the workflow (template) editor: layout, run inputs,
 * downstream consumers and friendly per-field validation. Kept free of React
 * so they can be unit-tested and shared by the canvas and the form view. */

import type { InputMappingValue } from "../api/types";

export interface GraphStep {
  stepOrder: number;
  agentId: string;
  agentStepKey: string;
  inputMapping: Record<string, InputMappingValue>;
}

/** Column index per step: 0 for steps with no step dependencies, else one
 * more than the deepest step it reads from. Unknown/cyclic references (mid-
 * edit states) fall back to 0 rather than throwing. */
export function computeDepths(steps: GraphStep[]): Map<number, number> {
  const byOrder = new Map(steps.map((s) => [s.stepOrder, s]));
  const depths = new Map<number, number>();

  function depthOf(order: number, seen: Set<number>): number {
    const known = depths.get(order);
    if (known !== undefined) return known;
    if (seen.has(order)) return 0;
    seen.add(order);
    const step = byOrder.get(order);
    const deps = step
      ? [
          ...new Set(
            Object.values(step.inputMapping)
              .filter((v): v is Extract<InputMappingValue, { kind: "fromStep" }> => v.kind === "fromStep")
              .map((v) => v.stepOrder)
              .filter((o) => byOrder.has(o) && o !== order),
          ),
        ]
      : [];
    const depth = deps.length === 0 ? 0 : 1 + Math.max(...deps.map((d) => depthOf(d, seen)));
    depths.set(order, depth);
    return depth;
  }

  for (const s of steps) depthOf(s.stepOrder, new Set());
  return depths;
}

export const NODE_WIDTH = 248;
export const COLUMN_GAP = 64;
export const ROW_GAP = 28;
export const NODE_HEIGHT = 156;

/** Left-to-right layered layout: one column per depth, columns vertically
 * centred on each other so the graph reads as a flow. */
export function layoutSteps(steps: GraphStep[], originX = 0): Map<number, { x: number; y: number }> {
  const depths = computeDepths(steps);
  const columns = new Map<number, GraphStep[]>();
  for (const s of [...steps].sort((a, b) => a.stepOrder - b.stepOrder)) {
    const d = depths.get(s.stepOrder) ?? 0;
    columns.set(d, [...(columns.get(d) ?? []), s]);
  }
  const tallest = Math.max(1, ...[...columns.values()].map((c) => c.length));
  const fullHeight = tallest * NODE_HEIGHT + (tallest - 1) * ROW_GAP;
  const out = new Map<number, { x: number; y: number }>();
  for (const [depth, col] of columns) {
    const colHeight = col.length * NODE_HEIGHT + (col.length - 1) * ROW_GAP;
    const top = (fullHeight - colHeight) / 2;
    col.forEach((s, i) => {
      out.set(s.stepOrder, { x: originX + depth * (NODE_WIDTH + COLUMN_GAP), y: top + i * (NODE_HEIGHT + ROW_GAP) });
    });
  }
  return out;
}

export function maxDepth(steps: GraphStep[]): number {
  return Math.max(0, ...computeDepths(steps).values());
}

/** Run-time inputs the workflow asks for (fields mapped `fromRunInput`),
 * with the steps that use each. */
export function runInputsOf(steps: GraphStep[]): Array<{ name: string; usedBy: number[] }> {
  const map = new Map<string, Set<number>>();
  for (const s of steps) {
    for (const v of Object.values(s.inputMapping)) {
      if (v.kind === "fromRunInput" && v.field.trim()) {
        map.set(v.field, (map.get(v.field) ?? new Set()).add(s.stepOrder));
      }
    }
  }
  return [...map.entries()].map(([name, used]) => ({ name, usedBy: [...used].sort((a, b) => a - b) }));
}

/** Later steps (and fields) that read an artifact produced by `order`. */
export function consumersOf(steps: GraphStep[], order: number): Array<{ stepOrder: number; field: string; artifactKind: string }> {
  const out: Array<{ stepOrder: number; field: string; artifactKind: string }> = [];
  for (const s of steps) {
    for (const [field, v] of Object.entries(s.inputMapping)) {
      if (v.kind === "fromStep" && v.stepOrder === order) out.push({ stepOrder: s.stepOrder, field, artifactKind: v.artifactKind });
    }
  }
  return out.sort((a, b) => a.stepOrder - b.stepOrder);
}

/** Human-facing step label (steps are 0-based internally). */
export const stepLabel = (order: number) => `Step ${order + 1}`;

/** Friendly problems per field for one step, e.g. a reference to a step that
 * was removed or an artifact kind the source step doesn't produce. Mirrors
 * the server's save-time checks (lib/templateValidation.ts). */
export function fieldIssues(
  step: GraphStep,
  steps: GraphStep[],
  producesFor: (s: GraphStep) => string[],
  requiredFields: string[] = [],
): Record<string, string> {
  const issues: Record<string, string> = {};
  for (const [field, v] of Object.entries(step.inputMapping)) {
    if (v.kind === "fromStep") {
      const source = steps.find((s) => s.stepOrder === v.stepOrder);
      if (!source) issues[field] = "The step this read from no longer exists — pick another source.";
      else if (v.stepOrder >= step.stepOrder) issues[field] = `Can only read from an earlier step (${stepLabel(v.stepOrder)} runs after this one).`;
      else {
        const kinds = producesFor(source);
        if (!kinds.includes(v.artifactKind)) {
          issues[field] = `${stepLabel(v.stepOrder)} doesn't produce ${v.artifactKind} (it outputs ${kinds.join(", ") || "nothing"}).`;
        }
      }
    } else if (v.kind === "fromRunInput" && !v.field.trim()) {
      issues[field] = "Name the run input this reads from.";
    }
  }
  for (const field of requiredFields) {
    const v = step.inputMapping[field];
    const missing = !v || (v.kind === "literal" && (v.value === "" || v.value === undefined || v.value === null));
    if (missing && !issues[field]) issues[field] = "Required — set a value or choose a source.";
  }
  return issues;
}
