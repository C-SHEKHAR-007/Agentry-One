import { describe, expect, it } from "vitest";
import { coerceRunInput, groupRunInputs } from "../runInputs";
import type { TemplateStep } from "../../models/templates";

const step = (stepOrder: number, agentId: string, inputMapping: TemplateStep["inputMapping"]): TemplateStep => ({ stepOrder, agentId, agentStepKey: "run", inputMapping });

describe("groupRunInputs", () => {
  it("groups run inputs under the first step that uses them, in step order", () => {
    const groups = groupRunInputs([
      step(1, "sketch-agent", { prompt: { kind: "fromRunInput", field: "topic" }, steps: { kind: "fromRunInput", field: "quality" } }),
      step(0, "dynamic", { prompt: { kind: "fromRunInput", field: "topic" }, context: { kind: "literal", value: "x" } }),
      step(2, "social-publisher", { socialAccountId: { kind: "fromRunInput", field: "socialAccountId" }, text: { kind: "fromStep", stepOrder: 0, artifactKind: "text" } }),
    ]);
    expect(groups).toEqual([
      { stepOrder: 0, agentId: "dynamic", agentStepKey: "run", fields: [{ field: "topic", agentField: "prompt", alsoUsedBy: [1] }] },
      { stepOrder: 1, agentId: "sketch-agent", agentStepKey: "run", fields: [{ field: "quality", agentField: "steps", alsoUsedBy: [] }] },
      { stepOrder: 2, agentId: "social-publisher", agentStepKey: "run", fields: [{ field: "socialAccountId", agentField: "socialAccountId", alsoUsedBy: [] }] },
    ]);
  });

  it("skips steps with no run inputs", () => {
    expect(groupRunInputs([step(0, "a", { x: { kind: "literal", value: 1 } })])).toEqual([]);
  });
});

describe("coerceRunInput", () => {
  it("uses the agent field's type", () => {
    expect(coerceRunInput("4", "integer")).toBe(4);
    expect(coerceRunInput("2.5", "number")).toBe(2.5);
    expect(coerceRunInput("true", "boolean")).toBe(true);
    expect(coerceRunInput("a fox", "string")).toBe("a fox");
    expect(coerceRunInput("  ", "string")).toBeUndefined();
    expect(coerceRunInput("abc", "integer")).toBe("abc");
  });
});
