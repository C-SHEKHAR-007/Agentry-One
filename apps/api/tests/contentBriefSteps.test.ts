import { describe, expect, it } from "vitest";
import { buildBriefSteps, ContentBriefError } from "../src/modules/contentBriefs/quickStart.js";

function stepFor(steps: ReturnType<typeof buildBriefSteps>["steps"], agentId: string) {
  return steps.find((s) => s.agentId === agentId);
}

describe("buildBriefSteps", () => {
  it("rejects an empty/invalid formats list", () => {
    expect(() => buildBriefSteps("a topic", undefined, [])).toThrow(ContentBriefError);
    expect(() => buildBriefSteps("a topic", undefined, ["carrier-pigeon"])).toThrow(ContentBriefError);
  });

  it("rejects a blank topic", () => {
    expect(() => buildBriefSteps("   ", undefined, ["text"])).toThrow(ContentBriefError);
  });

  it("text-only: a single content-brief-writer step with no dependencies", () => {
    const { steps } = buildBriefSteps("a topic", undefined, ["text"]);
    expect(steps).toHaveLength(1);
    expect(steps[0].agentId).toBe("content-brief-writer");
    expect(steps[0].inputMapping.topic).toEqual({ kind: "fromRunInput", field: "topic" });
  });

  it("image-only: a single sketch-agent step, no writer step", () => {
    const { steps } = buildBriefSteps("a topic", undefined, ["image"]);
    expect(steps).toHaveLength(1);
    expect(steps[0].agentId).toBe("sketch-agent");
  });

  it("voice implies text, and voice depends on the text step", () => {
    const { steps } = buildBriefSteps("a topic", undefined, ["voice"]);
    expect(steps.map((s) => s.agentId)).toEqual(["content-brief-writer", "voice-agent"]);

    const textStep = stepFor(steps, "content-brief-writer")!;
    const voiceStep = stepFor(steps, "voice-agent")!;
    expect(voiceStep.inputMapping.text).toEqual({ kind: "fromStep", stepOrder: textStep.stepOrder, artifactKind: "text" });
  });

  it("video implies text + image + voice, and depends on all three", () => {
    const { steps, requested } = buildBriefSteps("a topic", "warm", ["video"]);
    expect(requested).toEqual(["video"]);
    expect(steps.map((s) => s.agentId).sort()).toEqual(
      ["content-brief-writer", "sketch-agent", "video-agent", "voice-agent"].sort(),
    );

    const textStep = stepFor(steps, "content-brief-writer")!;
    const imageStep = stepFor(steps, "sketch-agent")!;
    const voiceStep = stepFor(steps, "voice-agent")!;
    const videoStep = stepFor(steps, "video-agent")!;

    expect(videoStep.inputMapping.imagePath).toEqual({ kind: "fromStep", stepOrder: imageStep.stepOrder, artifactKind: "image" });
    expect(videoStep.inputMapping.audioPath).toEqual({ kind: "fromStep", stepOrder: voiceStep.stepOrder, artifactKind: "audio" });
    expect(videoStep.inputMapping.caption).toEqual({ kind: "fromStep", stepOrder: textStep.stepOrder, artifactKind: "text" });

    // Every fromStep reference must point strictly earlier -- forward-only,
    // same invariant templates/validation.ts enforces on save.
    for (const step of steps) {
      for (const value of Object.values(step.inputMapping)) {
        if (value.kind === "fromStep") expect(value.stepOrder).toBeLessThan(step.stepOrder);
      }
    }
  });

  it("text + image together stay independent (no fromStep between them)", () => {
    const { steps } = buildBriefSteps("a topic", undefined, ["text", "image"]);
    for (const step of steps) {
      for (const value of Object.values(step.inputMapping)) {
        expect(value.kind).not.toBe("fromStep");
      }
    }
  });
});
