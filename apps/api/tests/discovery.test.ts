import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "../src/db/client.js";
import { ensureCapabilitiesAndDefaults } from "../src/modules/providers/bootstrap.js";
import { buildBriefSteps } from "../src/modules/contentBriefs/quickStart.js";

describe("Dynamic Providers, Models & Multi-Modal Workflows", () => {
  beforeEach(async () => {
    await ensureCapabilitiesAndDefaults();
  });

  it("seeds capabilities including web-search and video-generation", async () => {
    const capabilities = await prisma.capability.findMany();
    const keys = capabilities.map((c) => c.key);
    expect(keys).toContain("web-search");
    expect(keys).toContain("text-generation");
    expect(keys).toContain("image-generation");
    expect(keys).toContain("video-generation");
  });

  it("builds multi-modal workflow steps with search, copy, visual, and publishing", () => {
    const { steps, requested } = buildBriefSteps(
      "5 Top AI Trends for 2025",
      "energetic and viral",
      ["search", "text", "image", "publish"],
      "test-social-account-id",
    );

    expect(requested).toEqual(["search", "text", "image", "publish"]);
    expect(steps.length).toBe(4);

    // Step 0: Search
    expect(steps[0].agentId).toBe("web-search-agent");
    expect(steps[0].agentStepKey).toBe("search");

    // Step 1: Text Writer with research_brief input
    expect(steps[1].agentId).toBe("content-brief-writer");
    expect(steps[1].inputMapping.research_brief).toEqual({ kind: "fromStep", stepOrder: 0, artifactKind: "text" });

    // Step 2: Visual generation
    expect(steps[2].agentId).toBe("sketch-agent");

    // Step 3: Social Publisher with text and mediaUrl
    expect(steps[3].agentId).toBe("social-publisher");
    expect(steps[3].inputMapping.text).toEqual({ kind: "fromStep", stepOrder: 1, artifactKind: "text" });
    expect(steps[3].inputMapping.mediaUrl).toEqual({ kind: "fromStep", stepOrder: 2, artifactKind: "image" });
  });

  it("supports creating dynamic custom models in the database", async () => {
    const provider = await prisma.providerConfig.findFirst({ where: { isDefault: true } });
    expect(provider).toBeDefined();

    const createdModel = await prisma.model.upsert({
      where: { providerConfigId_modelId: { providerConfigId: provider!.id, modelId: "test-model-flux" } },
      create: {
        providerConfigId: provider!.id,
        modelId: "test-model-flux",
        name: "Flux.1 Schnell",
        inputTypes: ["text"],
        outputTypes: ["image"],
        isActive: true,
      },
      update: {},
    });

    expect(createdModel.modelId).toBe("test-model-flux");
    expect(createdModel.inputTypes).toEqual(["text"]);
    expect(createdModel.outputTypes).toEqual(["image"]);
  });
});
