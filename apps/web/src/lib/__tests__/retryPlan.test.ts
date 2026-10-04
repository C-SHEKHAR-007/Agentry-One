import { describe, expect, it } from "vitest";
import type { InputMappingValue } from "../../models";
import { canRetry, planRetry } from "../retryPlan";

const from = (o: number) => ({ kind: "fromStep" as const, stepOrder: o, artifactKind: "text" });
// 0 -> 1 -> 3, and 0 -> 2
const steps: { stepOrder: number; inputMapping: Record<string, InputMappingValue> }[] = [
  { stepOrder: 0, inputMapping: {} },
  { stepOrder: 1, inputMapping: { a: from(0) } },
  { stepOrder: 2, inputMapping: { a: from(0) } },
  { stepOrder: 3, inputMapping: { a: from(1) } },
];
const sorted = (s: Set<number>) => [...s].sort();

describe("planRetry (mirrors the API)", () => {
  it("reruns the failed step and its dependants", () => {
    const p = planRetry(steps, new Set([0, 2]));
    expect(sorted(p.rerun)).toEqual([1, 3]);
    expect(sorted(p.reuse)).toEqual([0, 2]);
  });
  it("from a chosen step", () => {
    expect(sorted(planRetry(steps, new Set([0, 1, 2, 3]), 1).rerun)).toEqual([1, 3]);
  });
});

describe("canRetry", () => {
  it("only once the run has stopped and nothing is running", () => {
    expect(canRetry({ status: "failed", steps: [{ status: "completed" }, { status: "failed" }] })).toBe(true);
    expect(canRetry({ status: "running", steps: [] })).toBe(false);
    expect(canRetry({ status: "failed", steps: [{ status: "running" }] })).toBe(false);
  });
});
