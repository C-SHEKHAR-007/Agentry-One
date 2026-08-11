import { describe, expect, it } from "vitest";
import { dependenciesOf } from "../src/modules/templates/service.js";
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
