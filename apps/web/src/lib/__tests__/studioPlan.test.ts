import { describe, expect, it } from "vitest";
import { briefTopic, planBrief } from "../studioPlan";

const roles = (selected: Parameters<typeof planBrief>[0], account = false) => planBrief(selected, account).steps.map((s) => s.role);

describe("planBrief", () => {
  it("runs exactly what was picked when nothing else is needed", () => {
    expect(roles(["search", "text"])).toEqual(["search", "text"]);
  });

  it("pulls in what a video needs, in run order", () => {
    const plan = planBrief(["video"], false);
    expect(plan.steps.map((s) => s.role)).toEqual(["text", "image", "voice", "video"]);
    expect(plan.steps[0].reason).toEqual({ kind: "required", by: ["video"] });
    expect(plan.steps[3].reason).toEqual({ kind: "selected" });
  });

  it("lists every output that needs a shared dependency", () => {
    const text = planBrief(["voice", "video"], false).steps.find((s) => s.role === "text")!;
    expect(text.reason).toEqual({ kind: "required", by: ["voice", "video"] });
  });

  it("drops publishing without an account, and doesn't pull in its dependencies", () => {
    const plan = planBrief(["search", "publish"], false);
    expect(plan.steps.map((s) => s.role)).toEqual(["search"]);
    expect(plan.dropped[0].role).toBe("publish");
  });

  it("publishes with an account, adding caption and visual", () => {
    expect(roles(["publish"], true)).toEqual(["text", "image", "publish"]);
  });
});

describe("briefTopic", () => {
  it("strips the Studio's name prefix and date", () => {
    expect(briefTopic("Brief: AI agents for small businesses — 2026-09-28")).toBe("AI agents for small businesses");
    expect(briefTopic("My own workflow")).toBe("My own workflow");
  });
});
