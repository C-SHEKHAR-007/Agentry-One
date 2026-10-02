import { describe, expect, it } from "vitest";
import { dependenciesOf, planRetry } from "../src/modules/templates/service.js";
import type { InputMapping } from "../src/modules/templates/types.js";

describe("dependenciesOf", () => {
  it("returns an empty set for a step with no fromStep fields", () => {
    const mapping: InputMapping = {
      prompt: { kind: "literal", value: "a cat" },
      steps: { kind: "fromRunInput", field: "stepsCount" },
    };
    expect(dependenciesOf({ inputMapping: mapping })).toEqual(new Set());
  });

  it("collects every stepOrder referenced across all fields (fan-in)", () => {
    const mapping: InputMapping = {
      imagePath: { kind: "fromStep", stepOrder: 1, artifactKind: "image" },
      audioPath: { kind: "fromStep", stepOrder: 2, artifactKind: "audio" },
      caption: { kind: "fromStep", stepOrder: 0, artifactKind: "text" },
    };
    expect(dependenciesOf({ inputMapping: mapping })).toEqual(new Set([1, 2, 0]));
  });

  it("dedupes repeated references to the same upstream step", () => {
    const mapping: InputMapping = {
      a: { kind: "fromStep", stepOrder: 0, artifactKind: "text" },
      b: { kind: "fromStep", stepOrder: 0, artifactKind: "text" },
    };
    expect(dependenciesOf({ inputMapping: mapping })).toEqual(new Set([0]));
  });
});

describe("planRetry", () => {
  const from = (order: number) => ({ kind: "fromStep" as const, stepOrder: order, artifactKind: "text" });
  // 0 -> 1 -> 3, and 0 -> 2 (a parallel branch)
  const steps = [
    { stepOrder: 0, inputMapping: {} },
    { stepOrder: 1, inputMapping: { brief: from(0) } },
    { stepOrder: 2, inputMapping: { brief: from(0) } },
    { stepOrder: 3, inputMapping: { caption: from(1) } },
  ];
  const sorted = (s: Set<number>) => [...s].sort();

  it("reruns the failed step and what depends on it, reusing the rest", () => {
    // 1 failed; 0 and 2 completed; 3 never started.
    const plan = planRetry(steps, new Set([0, 2]));
    expect(sorted(plan.rerun)).toEqual([1, 3]);
    expect(sorted(plan.reuse)).toEqual([0, 2]);
  });

  it("from a chosen step reruns it and everything downstream", () => {
    const plan = planRetry(steps, new Set([0, 1, 2, 3]), 1);
    expect(sorted(plan.rerun)).toEqual([1, 3]);
    expect(sorted(plan.reuse)).toEqual([0, 2]);
  });

  it("from the first step reruns everything", () => {
    expect(sorted(planRetry(steps, new Set([0, 1, 2, 3]), 0).rerun)).toEqual([0, 1, 2, 3]);
  });

  it("never reuses a step that didn't complete, even off the chosen path", () => {
    // Retrying from 1 while the parallel branch 2 had been cancelled.
    const plan = planRetry(steps, new Set([0, 1]), 1);
    expect(sorted(plan.rerun)).toEqual([1, 2, 3]);
    expect(sorted(plan.reuse)).toEqual([0]);
  });

  it("has nothing to rerun when every step completed and none is chosen", () => {
    expect(planRetry(steps, new Set([0, 1, 2, 3])).rerun.size).toBe(0);
  });
});
