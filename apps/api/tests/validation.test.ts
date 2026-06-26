import { describe, expect, it } from "vitest";
import { validateStepInputMapping, validateTemplateSteps } from "../src/modules/templates/validation.js";
import type { InputMapping } from "../src/modules/templates/types.js";

describe("validateStepInputMapping", () => {
  it("passes literal and fromRunInput mappings without needing upstream steps", () => {
    const mapping: InputMapping = {
      prompt: { kind: "literal", value: "a cat" },
      steps: { kind: "fromRunInput", field: "stepsCount" },
    };
    expect(validateStepInputMapping(0, mapping, [])).toEqual([]);
  });

  it("passes a fromStep mapping when the upstream step produces the referenced kind", () => {
    const mapping: InputMapping = { image: { kind: "fromStep", stepOrder: 0, artifactKind: "image" } };
    const errors = validateStepInputMapping(1, mapping, [{ stepOrder: 0, producesArtifactKinds: ["image"] }]);
    expect(errors).toEqual([]);
  });

  it("rejects a fromStep mapping when the upstream step doesn't produce that kind", () => {
    const mapping: InputMapping = { prompt: { kind: "fromStep", stepOrder: 0, artifactKind: "candidate_list" } };
    const errors = validateStepInputMapping(1, mapping, [{ stepOrder: 0, producesArtifactKinds: ["image"] }]);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatch(/does not produce an artifact of kind 'candidate_list'/);
  });

  it("rejects a fromStep reference to a step that isn't earlier (forward-only)", () => {
    const mapping: InputMapping = { prompt: { kind: "fromStep", stepOrder: 1, artifactKind: "image" } };
    const errors = validateStepInputMapping(1, mapping, [{ stepOrder: 1, producesArtifactKinds: ["image"] }]);
    expect(errors[0]).toMatch(/forward-only/);
  });

  it("rejects a fromStep reference to a step that doesn't exist in the template", () => {
    const mapping: InputMapping = { prompt: { kind: "fromStep", stepOrder: 5, artifactKind: "image" } };
    const errors = validateStepInputMapping(6, mapping, []);
    expect(errors[0]).toMatch(/does not exist in this template/);
  });
});

describe("validateTemplateSteps", () => {
  it("validates a full multi-step template end to end, order-independent input", () => {
    const steps = [
      {
        stepOrder: 1,
        agentId: "b",
        agentStepKey: "generate",
        inputMapping: { prompt: { kind: "fromStep", stepOrder: 0, artifactKind: "image" } } as InputMapping,
        producesArtifactKinds: ["image"],
      },
      {
        stepOrder: 0,
        agentId: "a",
        agentStepKey: "generate",
        inputMapping: { prompt: { kind: "literal", value: "a cat" } } as InputMapping,
        producesArtifactKinds: ["image"],
      },
    ];
    expect(validateTemplateSteps(steps)).toEqual([]);
  });

  it("collects errors across multiple steps, prefixed with which step failed", () => {
    const steps = [
      {
        stepOrder: 0,
        agentId: "a",
        agentStepKey: "generate",
        inputMapping: {} as InputMapping,
        producesArtifactKinds: ["image"],
      },
      {
        stepOrder: 1,
        agentId: "b",
        agentStepKey: "generate",
        inputMapping: { prompt: { kind: "fromStep", stepOrder: 0, artifactKind: "text" } } as InputMapping,
        producesArtifactKinds: ["image"],
      },
    ];
    const errors = validateTemplateSteps(steps);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatch(/^step 1:/);
  });
});
