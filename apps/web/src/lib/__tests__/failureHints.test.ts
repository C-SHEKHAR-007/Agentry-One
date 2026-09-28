import { describe, expect, it } from "vitest";
import { attemptError, failureHint } from "../failureHints";

describe("failureHint", () => {
  it("explains a missing local image model and points at providers", () => {
    const h = failureHint("Local SD-Turbo needs torch + diffusers, which this worker doesn't have. Build …");
    expect(h.title).toBe("No image model is available");
    expect(h.action?.to).toBe("/providers");
  });

  it.each([
    ["no provider configured for required capability 'image-generation'", "No AI provider is set up for this step"],
    ["401 Client Error: Unauthorized for url: https://api.stability.ai", "The provider rejected the credentials"],
    ["429 Too Many Requests", "The provider is rate-limiting requests"],
    ["step 'generate' exceeded its 300s timeout", "The step took too long"],
    ["could not fetch job credentials from the API (HTTP 403)", "The worker couldn't reach the API"],
  ])("%s", (message, title) => {
    expect(failureHint(message).title).toBe(title);
  });

  it("falls back to a generic hint", () => {
    expect(failureHint("KeyError: 'foo'").title).toBe("The agent reported an error");
    expect(failureHint(undefined).title).toBe("The agent reported an error");
  });
});

describe("attemptError", () => {
  it("reads the stored { message } shape", () => {
    expect(attemptError({ message: "boom" })).toBe("boom");
    expect(attemptError("plain")).toBe("plain");
    expect(attemptError(null)).toBeNull();
  });
});
