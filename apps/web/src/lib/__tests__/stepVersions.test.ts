import { describe, expect, it } from "vitest";
import { versionsOf, withVersion } from "../stepVersions";
import type { RunDetail } from "../../models";

type RunStep = RunDetail["steps"][number];
const step = { id: "rs1", status: "completed", workflowId: "w3", templateStep: { id: "ts1" } } as unknown as RunStep;
const run = {
  versions: {
    ts1: [
      { workflowId: "w1", runId: "r1", createdAt: "2026-10-18T10:00:00Z" },
      { workflowId: "w3", runId: "r2", createdAt: "2026-10-18T10:05:00Z" },
    ],
  },
};

describe("versionsOf", () => {
  it("labels versions v1, v2 in order", () => {
    expect(versionsOf(run, step).map((v) => [v.label, v.workflowId])).toEqual([
      ["v1", "w1"],
      ["v2", "w3"],
    ]);
  });
  it("is empty without versions or a step", () => {
    expect(versionsOf({}, step)).toEqual([]);
    expect(versionsOf(run, undefined)).toEqual([]);
  });
});

describe("withVersion", () => {
  it("shows the picked version's workflow", () => {
    expect(withVersion(step, run, "w1")).toMatchObject({ id: "rs1", workflowId: "w1", status: "completed" });
  });
  it("keeps the step for no pick, the current one, or an unknown workflow", () => {
    expect(withVersion(step, run, undefined)).toBe(step);
    expect(withVersion(step, run, "w3")).toBe(step);
    expect(withVersion(step, run, "nope")).toBe(step);
  });
});
