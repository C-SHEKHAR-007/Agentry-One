import { describe, expect, it } from "vitest";
import { applyNote, planRetry } from "../src/modules/templates/service.js";
import { stepVersions, type FamilyRun } from "../src/modules/templates/runVersions.js";

const from = (order: number) => ({ kind: "fromStep" as const, stepOrder: order, artifactKind: "text" });
// 0 (caption) -> 2 (publish), 1 (visual) -> 2
const steps = [
  { stepOrder: 0, inputMapping: {} },
  { stepOrder: 1, inputMapping: {} },
  { stepOrder: 2, inputMapping: { text: from(0), media: from(1) } },
];

describe("planRetry with onlyStep (regenerate one output)", () => {
  it("reruns that step alone and keeps the steps after it", () => {
    const { rerun, reuse } = planRetry(steps, new Set([0, 1, 2]), 0, true);
    expect([...rerun]).toEqual([0]);
    expect([...reuse].sort()).toEqual([1, 2]);
  });

  it("without onlyStep, the steps after it rerun too", () => {
    expect([...planRetry(steps, new Set([0, 1, 2]), 0).rerun].sort()).toEqual([0, 2]);
  });
});

describe("applyNote", () => {
  it("appends the note to the prompt", () => {
    expect(applyNote({ prompt: "a fox", steps: 2 }, " warmer colours ")).toEqual({ prompt: "a fox\n\nRevision note: warmer colours", steps: 2 });
  });
  it("leaves the input alone without a note or a prompt", () => {
    const p = { prompt: "a fox" };
    expect(applyNote(p, null)).toBe(p);
    expect(applyNote(p, "  ")).toBe(p);
    expect(applyNote({ text: "hi" }, "louder")).toEqual({ text: "hi" });
  });
});

describe("stepVersions", () => {
  const t = (iso: string) => new Date(`2026-10-18T${iso}Z`);
  const step = (templateStepId: string, workflowId: string | null, at: string, extra: Partial<FamilyRun["steps"][number]> = {}) => ({
    templateStepId,
    workflowId,
    status: "completed",
    reusedFromStepId: null,
    createdAt: t(at),
    ...extra,
  });

  it("lists each step's outputs oldest first and skips reused or unfinished steps", () => {
    const family: FamilyRun[] = [
      { id: "r1", retryOfId: null, steps: [step("caption", "w1", "10:00:00"), step("visual", "w2", "10:00:00")] },
      // Regenerate the caption: the visual is reused.
      { id: "r2", retryOfId: "r1", steps: [step("caption", "w3", "10:05:00"), step("visual", "w2", "10:05:00", { reusedFromStepId: "x" })] },
      // A variant still running adds nothing yet; a failed one never does.
      { id: "r3", retryOfId: "r1", steps: [step("caption", "w4", "10:06:00", { status: "running" })] },
      { id: "r4", retryOfId: "r2", steps: [step("caption", "w5", "10:04:00", { status: "failed" }), step("caption", "w6", "10:07:00")] },
    ];
    const v = stepVersions(family);
    expect(v.caption.map((x) => [x.workflowId, x.runId])).toEqual([
      ["w1", "r1"],
      ["w3", "r2"],
      ["w6", "r4"],
    ]);
    expect(v.visual.map((x) => x.workflowId)).toEqual(["w2"]);
  });
});
