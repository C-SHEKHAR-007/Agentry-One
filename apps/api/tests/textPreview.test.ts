import { describe, expect, it } from "vitest";
import { isTextArtifact, PREVIEW_CHARS, previewFromHead } from "../src/modules/artifacts/textPreview.js";

describe("text previews", () => {
  it("only for text-like artifacts", () => {
    expect(isTextArtifact({ mimeType: "text/plain", kind: "caption" })).toBe(true);
    expect(isTextArtifact({ mimeType: "application/json", kind: "research" })).toBe(true);
    expect(isTextArtifact({ mimeType: "image/png", kind: "image" })).toBe(false);
  });

  it("trims to the preview length", () => {
    expect(previewFromHead(Buffer.from("x".repeat(PREVIEW_CHARS + 50))).length).toBe(PREVIEW_CHARS);
    expect(previewFromHead(Buffer.from("short"))).toBe("short");
  });

  it("drops a multi-byte character cut in half by the byte limit", () => {
    const full = Buffer.from("café ✨");
    expect(previewFromHead(full.subarray(0, full.length - 1))).toBe("café ");
  });
});
