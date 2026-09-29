import { describe, expect, it } from "vitest";
import { computeDepths, consumersOf, fieldIssues, layoutSteps, runInputsOf, type GraphStep } from "../workflowGraph";

// The content-brief shape: search -> writer -> voice -> video, sketch -> video.
const steps: GraphStep[] = [
  { stepOrder: 0, agentId: "search", agentStepKey: "search", inputMapping: { query: { kind: "fromRunInput", field: "topic" } } },
  {
    stepOrder: 1,
    agentId: "writer",
    agentStepKey: "run",
    inputMapping: { topic: { kind: "fromRunInput", field: "topic" }, research_brief: { kind: "fromStep", stepOrder: 0, artifactKind: "text" } },
  },
  { stepOrder: 2, agentId: "sketch", agentStepKey: "generate", inputMapping: { prompt: { kind: "fromRunInput", field: "imagePrompt" } } },
  { stepOrder: 3, agentId: "voice", agentStepKey: "generate", inputMapping: { text: { kind: "fromStep", stepOrder: 1, artifactKind: "text" } } },
  {
    stepOrder: 4,
    agentId: "video",
    agentStepKey: "assemble",
    inputMapping: {
      audioPath: { kind: "fromStep", stepOrder: 3, artifactKind: "audio" },
      imagePath: { kind: "fromStep", stepOrder: 2, artifactKind: "image" },
    },
  },
];
const produces: Record<string, string[]> = { search: ["text"], writer: ["text"], sketch: ["image"], voice: ["audio"], video: ["video"] };
const producesFor = (s: GraphStep) => produces[s.agentId] ?? [];

describe("computeDepths / layoutSteps", () => {
  it("places each step one column after its deepest dependency", () => {
    const d = computeDepths(steps);
    expect([0, 1, 2, 3, 4].map((o) => d.get(o))).toEqual([0, 1, 0, 2, 3]);
  });

  it("lays out columns left to right without overlapping nodes", () => {
    const pos = layoutSteps(steps);
    expect(pos.get(0)!.x).toBeLessThan(pos.get(1)!.x);
    expect(pos.get(3)!.x).toBeLessThan(pos.get(4)!.x);
    // steps 0 and 2 share column 0 but not a row
    expect(pos.get(0)!.x).toBe(pos.get(2)!.x);
    expect(pos.get(0)!.y).not.toBe(pos.get(2)!.y);
  });

  it("tolerates dangling and self references", () => {
    const broken: GraphStep[] = [
      { stepOrder: 0, agentId: "a", agentStepKey: "run", inputMapping: { x: { kind: "fromStep", stepOrder: 0, artifactKind: "text" } } },
      { stepOrder: 1, agentId: "b", agentStepKey: "run", inputMapping: { y: { kind: "fromStep", stepOrder: 9, artifactKind: "text" } } },
    ];
    expect([...computeDepths(broken).values()]).toEqual([0, 0]);
  });
});

describe("runInputsOf / consumersOf", () => {
  it("collects run inputs with the steps that use them", () => {
    expect(runInputsOf(steps)).toEqual([
      { name: "topic", usedBy: [0, 1] },
      { name: "imagePrompt", usedBy: [2] },
    ]);
  });

  it("lists downstream consumers of a step's outputs", () => {
    expect(consumersOf(steps, 1)).toEqual([{ stepOrder: 3, field: "text", artifactKind: "text" }]);
  });
});

describe("fieldIssues", () => {
  it("is empty for a valid step", () => {
    expect(fieldIssues(steps[4], steps, producesFor)).toEqual({});
  });

  it("explains wrong kinds, missing and later sources, and required fields", () => {
    const bad: GraphStep = {
      stepOrder: 2,
      agentId: "video",
      agentStepKey: "assemble",
      inputMapping: {
        imagePath: { kind: "fromStep", stepOrder: 0, artifactKind: "image" },
        audioPath: { kind: "fromStep", stepOrder: 4, artifactKind: "audio" },
        caption: { kind: "fromStep", stepOrder: -1, artifactKind: "text" },
      },
    };
    const issues = fieldIssues(bad, steps, producesFor, ["durationSec"]);
    expect(issues.imagePath).toMatch(/Step 1 doesn't produce image \(it outputs text\)/);
    expect(issues.audioPath).toMatch(/earlier step/);
    expect(issues.caption).toMatch(/no longer exists/);
    expect(issues.durationSec).toMatch(/Required/);
  });
});
