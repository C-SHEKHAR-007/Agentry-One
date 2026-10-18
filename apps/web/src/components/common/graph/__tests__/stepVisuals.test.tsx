import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { FileText, Globe, ImageIcon, Mic, PenLine } from "lucide-react";
import type { AgentManifestDetail } from "../../../../models";
import { KindChip, stepIcon } from "../stepVisuals";

const agent = (step: Record<string, unknown>) => ({ id: "a", name: "A", manifest: { steps: [{ key: "run", producesArtifactKinds: [], inputSchema: {}, ...step }] } }) as unknown as AgentManifestDetail;

describe("stepIcon", () => {
  it("gives a text model the pen, even when it also makes media", () => {
    expect(stepIcon("custom-caption-skill", agent({ requiresCapability: "text-generation", producesArtifactKinds: ["text", "image", "audio", "search_brief"] }))).toBe(PenLine);
  });
  it("still picks by output for media agents and search", () => {
    expect(stepIcon("voice-agent", agent({ requiresCapability: "audio-generation", producesArtifactKinds: ["audio"] }))).toBe(Mic);
    expect(stepIcon("sketch-agent", agent({ requiresCapability: "image-generation", producesArtifactKinds: ["image"] }))).toBe(ImageIcon);
    expect(stepIcon("web-search-agent", agent({ requiresCapability: "web-search", producesArtifactKinds: ["text"] }))).toBe(Globe);
    expect(stepIcon("echo-agent", agent({ producesArtifactKinds: ["text"] }))).toBe(FileText);
  });
});

describe("KindChip", () => {
  it("shows kinds as words and never breaks a chip across lines", () => {
    render(<KindChip kind="search_brief" />);
    const chip = screen.getByText("search brief");
    expect(chip.className).toContain("whitespace-nowrap");
  });
});
