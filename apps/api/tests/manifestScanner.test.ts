import { describe, expect, it } from "vitest";
import { scanAgentManifests } from "../src/modules/agents/manifestScanner.js";

describe("scanAgentManifests", () => {
  it("finds sketch-agent's real manifest.json and resolves its schema $refs", async () => {
    const manifests = await scanAgentManifests();
    const sketch = manifests.find((m) => m.id === "sketch-agent");
    expect(sketch).toBeDefined();
    expect(sketch?.steps).toHaveLength(1);

    const generateStep = sketch?.steps[0];
    expect(generateStep?.key).toBe("generate");
    expect(generateStep?.requiresCapability).toBe("image-generation");

    // inputSchema should be the *resolved* schema object, not a {"$ref": ...} pointer.
    const inputSchema = generateStep?.inputSchema as { type: string; required: string[] };
    expect(inputSchema.type).toBe("object");
    expect(inputSchema.required).toContain("prompt");
  });
});
