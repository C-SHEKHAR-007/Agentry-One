import { describe, expect, it } from "vitest";
import { diffLines, extractPlaceholders, segmentTemplate, textStats, toPromptKey } from "../promptText";

describe("extractPlaceholders", () => {
  it("finds unique placeholders in order, tolerating inner spaces", () => {
    expect(extractPlaceholders("Post about {{topic}} for {{ audience }} — again {{topic}}")).toEqual(["topic", "audience"]);
  });
  it("ignores malformed braces", () => {
    expect(extractPlaceholders("{topic} {{}} {{ 1bad }}")).toEqual([]);
  });
});

describe("segmentTemplate", () => {
  it("splits text and placeholders without losing characters", () => {
    const template = "Hi {{name}},\nwelcome!";
    const segments = segmentTemplate(template);
    expect(segments.map((s) => s.value).join("")).toBe(template);
    expect(segments[1]).toEqual({ kind: "placeholder", value: "{{name}}", name: "name" });
  });
});

describe("diffLines", () => {
  it("marks added, removed and unchanged lines", () => {
    expect(diffLines("a\nb\nc", "a\nB\nc\nd")).toEqual([
      { kind: "same", text: "a" },
      { kind: "removed", text: "b" },
      { kind: "added", text: "B" },
      { kind: "same", text: "c" },
      { kind: "added", text: "d" },
    ]);
  });
  it("is all-same for identical text", () => {
    expect(diffLines("x\ny", "x\ny").every((l) => l.kind === "same")).toBe(true);
  });
});

describe("textStats / toPromptKey", () => {
  it("counts words and lines", () => {
    expect(textStats("one two\nthree")).toEqual({ characters: 13, words: 3, lines: 2 });
    expect(textStats("")).toEqual({ characters: 0, words: 0, lines: 0 });
  });
  it("slugifies keys", () => {
    expect(toPromptKey("  Product Hero Shot! ")).toBe("product-hero-shot");
  });
});
