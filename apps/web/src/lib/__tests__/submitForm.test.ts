import { describe, expect, it } from "vitest";
import { buildUiSchema, promptFieldOf, randomSeed, sliderStep, widgetFor } from "../submitForm";

// The Sketch agent's real input schema.
const sketch = {
  prompt: { type: "string", title: "Prompt", minLength: 1 },
  negativePrompt: { type: "string", title: "Negative prompt" },
  steps: { type: "integer", title: "Inference steps", default: 2, minimum: 1, maximum: 4 },
  seed: { type: "integer", title: "Seed" },
  width: { type: "integer", title: "Width", default: 512 },
  height: { type: "integer", title: "Height", default: 512 },
};

describe("promptFieldOf", () => {
  it("prefers a field named prompt, else the first string field", () => {
    expect(promptFieldOf(sketch)).toBe("prompt");
    expect(promptFieldOf({ count: { type: "integer" }, text: { type: "string" } })).toBe("text");
    expect(promptFieldOf({ shout: { type: "boolean" } })).toBeNull();
    expect(promptFieldOf(undefined)).toBeNull();
  });
});

describe("widgetFor", () => {
  it("picks a widget for each Sketch field", () => {
    const ui = buildUiSchema(sketch, "prompt");
    expect(ui).toEqual({
      prompt: { "ui:widget": "prompt" },
      negativePrompt: { "ui:widget": "textarea" },
      steps: { "ui:widget": "slider" },
      seed: { "ui:widget": "seed" },
      "ui:order": ["prompt", "negativePrompt", "*"],
    });
  });

  it("puts the prompt first even when the schema lists it last (jsonb key order)", () => {
    const fromDb = { seed: sketch.seed, steps: sketch.steps, width: sketch.width, height: sketch.height, prompt: sketch.prompt };
    expect(buildUiSchema(fromDb, "prompt")["ui:order"]).toEqual(["prompt", "*"]);
    expect(buildUiSchema({ width: sketch.width }, null)["ui:order"]).toBeUndefined();
  });

  it("shows short enums as chips and long ones as a dropdown", () => {
    expect(widgetFor("time_range", { type: "string", enum: ["day", "week", "month"] }, null)).toBe("chips");
    const many = Array.from({ length: 10 }, (_, i) => `v${i}`);
    expect(widgetFor("lang", { type: "string", enum: many }, null)).toBe("default");
  });

  it("needs both bounds for a slider", () => {
    expect(widgetFor("durationSec", { type: "number", minimum: 1, maximum: 120 }, null)).toBe("slider");
    expect(widgetFor("width", { type: "integer", minimum: 64 }, null)).toBe("default");
    expect(widgetFor("x", { type: "integer", minimum: 3, maximum: 3 }, null)).toBe("default");
  });

  it("handles nullable types and enum prompt fields", () => {
    expect(widgetFor("seed", { type: ["integer", "null"] }, null)).toBe("seed");
    expect(widgetFor("prompt", { type: "string", enum: ["a", "b"] }, "prompt")).toBe("chips");
  });
});

describe("helpers", () => {
  it("draws seeds in the 32-bit range", () => {
    expect(randomSeed(() => 0)).toBe(0);
    expect(randomSeed(() => 0.999999999)).toBeLessThan(4_294_967_295);
    expect(Number.isInteger(randomSeed())).toBe(true);
  });

  it("uses whole steps for integers and fine steps for numbers", () => {
    expect(sliderStep({ type: "integer", minimum: 1, maximum: 4 })).toBe(1);
    expect(sliderStep({ type: "number", minimum: 0, maximum: 1 })).toBe(0.01);
    expect(sliderStep({ type: "number", minimum: 1, maximum: 120 })).toBe(1.2);
  });
});
